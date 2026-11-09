#!/usr/bin/env python3
"""
codex.py

交互式命令行工具，通过 stdio 与 `codex app-server` 进程通信，
用于手动测试其 JSON-RPC 2.0 接口（initialize / thread / turn / item /
approvals 等）。零第三方依赖，仅用 Python 标准库。

用法：
    python codex.py
    python codex.py --bin codex --args "app-server --stdio"
    python codex.py --bin /usr/local/bin/codex --raw-log
    python codex.py --experimental --auto-approve

启动后会自动完成 initialize/initialized 握手，然后进入 REPL。
输入 `help` 查看所有内置命令。
"""

from __future__ import annotations

import argparse
import itertools
import json
import queue
import shlex
import subprocess
import sys
import threading
import time
from typing import Any, Dict, List, Optional


# --------------------------------------------------------------------------
# 终端着色：无第三方依赖；非 tty（例如被重定向到文件）时自动降级为无色输出
# --------------------------------------------------------------------------
class C:
    enabled = sys.stdout.isatty()

    @staticmethod
    def _wrap(code: str, s: str) -> str:
        return f"\x1b[{code}m{s}\x1b[0m" if C.enabled else s

    @staticmethod
    def dim(s: str) -> str: return C._wrap("2", s)
    @staticmethod
    def bold(s: str) -> str: return C._wrap("1", s)
    @staticmethod
    def cyan(s: str) -> str: return C._wrap("36", s)
    @staticmethod
    def green(s: str) -> str: return C._wrap("32", s)
    @staticmethod
    def yellow(s: str) -> str: return C._wrap("33", s)
    @staticmethod
    def red(s: str) -> str: return C._wrap("31", s)
    @staticmethod
    def magenta(s: str) -> str: return C._wrap("35", s)


def ts() -> str:
    return time.strftime("%H:%M:%S")


def pretty(obj: Any, max_len: int = 4000) -> str:
    s = json.dumps(obj, ensure_ascii=False, indent=2)
    if len(s) > max_len:
        s = s[:max_len] + f"\n... [截断，完整长度 {len(s)} 字符]"
    return s


def try_parse_json(s: str) -> Any:
    """把用户输入的字符串解析成 JSON；空字符串视为 None。"""
    s = s.strip()
    if not s:
        return None
    return json.loads(s)


# --------------------------------------------------------------------------
# JSON-RPC 2.0 over stdio（newline-delimited JSON）客户端
# --------------------------------------------------------------------------
class CodexAppServerClient:
    def __init__(self, cmd: List[str], log_raw: bool = False, auto_approve: bool = False):
        self.log_raw = log_raw
        self.auto_approve = auto_approve
        try:
            self.proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,  # 行缓冲
            )
        except FileNotFoundError as e:
            raise SystemExit(f"无法启动进程 {cmd!r}: {e}")

        self._id_seq = itertools.count(1)
        self._pending: Dict[Any, "queue.Queue[Dict]"] = {}
        self._pending_lock = threading.Lock()
        self.notification_handlers: List[Any] = []
        self.pending_server_requests: "queue.Queue[Dict]" = queue.Queue()
        self.closed = False

        threading.Thread(target=self._read_stdout, daemon=True).start()
        threading.Thread(target=self._read_stderr, daemon=True).start()

    def next_id(self) -> int:
        return next(self._id_seq)

    # ---------------- 发送 ----------------
    def _write(self, obj: Dict) -> None:
        line = json.dumps(obj, ensure_ascii=False)
        if self.log_raw:
            print(C.dim(f"[{ts()}] » {line}"))
        try:
            assert self.proc.stdin is not None
            self.proc.stdin.write(line + "\n")
            self.proc.stdin.flush()
        except (BrokenPipeError, ValueError):
            print(C.red("[错误] 目标进程已退出，无法写入 stdin。"))

    def request(self, method: str, params: Optional[Dict] = None, timeout: float = 30.0) -> Dict:
        """发送一个带 id 的请求，阻塞等待匹配 id 的响应（result 或 error）。"""
        req_id = self.next_id()
        msg: Dict[str, Any] = {"jsonrpc": "2.0", "id": req_id, "method": method}
        if params is not None:
            msg["params"] = params
        q: "queue.Queue[Dict]" = queue.Queue()
        with self._pending_lock:
            self._pending[req_id] = q
        self._write(msg)
        try:
            return q.get(timeout=timeout)
        except queue.Empty:
            with self._pending_lock:
                self._pending.pop(req_id, None)
            raise TimeoutError(f"等待 {method} (id={req_id}) 的响应超时（{timeout}s）")

    def notify(self, method: str, params: Optional[Dict] = None) -> None:
        msg: Dict[str, Any] = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            msg["params"] = params
        self._write(msg)

    def respond(self, req_id: Any, result: Any = None, error: Any = None) -> None:
        """回应一个服务器发起的请求（approvals / elicitation / attestation 等）。"""
        msg: Dict[str, Any] = {"jsonrpc": "2.0", "id": req_id}
        if error is not None:
            msg["error"] = error
        else:
            msg["result"] = {} if result is None else result
        self._write(msg)

    def on_notification(self, handler) -> None:
        self.notification_handlers.append(handler)

    # ---------------- 接收 ----------------
    def _read_stdout(self) -> None:
        assert self.proc.stdout is not None
        for line in self.proc.stdout:
            line = line.strip()
            if not line:
                continue
            if self.log_raw:
                print(C.dim(f"[{ts()}] « {line}"))
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                print(C.red(f"[无法解析的一行输出] {line}"))
                continue
            self._dispatch(msg)
        self.closed = True
        print(C.red(f"\n[{ts()}] app-server 的 stdout 已关闭（进程可能已退出，exit code={self.proc.poll()}）。"))

    def _read_stderr(self) -> None:
        assert self.proc.stderr is not None
        for line in self.proc.stderr:
            line = line.rstrip()
            if line:
                print(C.dim(f"[stderr] {line}"))

    def _dispatch(self, msg: Dict) -> None:
        has_id = "id" in msg and msg["id"] is not None
        has_method = "method" in msg

        if has_id and not has_method:
            # 对我们发出的 request 的响应
            req_id = msg["id"]
            with self._pending_lock:
                q = self._pending.pop(req_id, None)
            if q is not None:
                q.put(msg)
            else:
                print(C.yellow(f"[{ts()}] 收到一个无人等待的响应（id={req_id}）: {pretty(msg)}"))
            return

        if has_id and has_method:
            # 服务器发起的请求，需要我们主动回一条带同一个 id 的响应
            self._handle_server_request(msg)
            return

        if has_method and not has_id:
            # 通知（notification）
            method = msg.get("method")
            params = msg.get("params")
            self._print_notification(method, params)
            for h in self.notification_handlers:
                try:
                    h(method, params)
                except Exception as e:  # noqa: BLE001
                    print(C.red(f"[通知处理器异常] {e}"))
            return

        print(C.yellow(f"[{ts()}] 无法识别的消息: {pretty(msg)}"))

    def _print_notification(self, method: Optional[str], params: Any) -> None:
        # 高频流式 delta 通知做单行精简展示，避免刷屏
        if method and method.endswith("/delta") and isinstance(params, dict):
            delta = params.get("delta", "")
            if isinstance(delta, str) and len(delta) > 60:
                delta = delta[:60] + "…"
            item_id = params.get("itemId", "")
            print(C.dim(f"[{ts()}] · {method}  itemId={item_id}  delta={delta!r}"))
            return
        print(f"\n{C.cyan(f'[{ts()}] ◀ notify')} {C.bold(str(method))}")
        print(pretty(params))

    def _handle_server_request(self, msg: Dict) -> None:
        req_id = msg["id"]
        method = msg["method"]
        params = msg.get("params")
        print(f"\n{C.magenta(f'[{ts()}] ◀ SERVER REQUEST')} {C.bold(method)}  (id={req_id})")
        print(pretty(params))

        if self.auto_approve and self._looks_like_approval(method):
            decision = self._default_auto_decision(method)
            print(C.green(f"[auto-approve] 自动回应: {pretty(decision)}"))
            self.respond(req_id, result=decision)
            return

        self.pending_server_requests.put({"id": req_id, "method": method, "params": params})
        print(C.yellow(
            f"已加入待处理队列（当前 {self.pending_server_requests.qsize()} 条）。"
            f" 输入 'approve' 交互式处理，或 'respond {req_id} <json>' 直接回应。"
        ))

    @staticmethod
    def _looks_like_approval(method: str) -> bool:
        return method in (
            "item/commandExecution/requestApproval",
            "item/fileChange/requestApproval",
            "item/permissions/requestApproval",
        )

    @staticmethod
    def _default_auto_decision(method: str) -> Dict:
        if method == "item/permissions/requestApproval":
            return {"scope": "turn", "permissions": {}}
        return {"decision": "accept"}

    def close(self) -> None:
        try:
            if self.proc.stdin:
                self.proc.stdin.close()
        except Exception:  # noqa: BLE001
            pass
        try:
            self.proc.terminate()
        except Exception:  # noqa: BLE001
            pass


# --------------------------------------------------------------------------
# REPL：命令解析与状态追踪（last thread/turn 便于快速测试）
# --------------------------------------------------------------------------
HELP_TEXT = f"""
{C.bold("可用命令")}

  {C.green("--- 通用 JSON-RPC ---")}
  call <method> [json]          发送任意请求并等待响应，例如:
                                   call thread/list {{"limit": 5}}
  notify <method> [json]        发送任意通知（无需响应），例如:
                                   notify initialized
  respond <id> <json>           直接回应一个服务器发起的请求，例如:
                                   respond 61 {{"decision": "accept"}}

  {C.green("--- 审批 / 服务器发起的请求 ---")}
  pending                       列出当前排队等待处理的服务器请求
  approve                       交互式处理队首的一条服务器请求
  auto on|off                   开/关自动批准模式（对 approval 类请求自动 accept）

  {C.green("--- 常用快捷方式 ---")}
  init                           手动重发 initialize 握手信息（正常仅需启动时自动执行一次）
  threads [json]                 thread/list 快捷方式
  newthread [cwd]                thread/start 快捷方式，结果记为 $thread
  resume <threadId>               thread/resume 快捷方式，结果记为 $thread
  send [threadId] <text...>       turn/start 快捷方式（纯文本输入）；省略 threadId 时用 $thread
  interrupt [threadId] [turnId]   turn/interrupt 快捷方式；省略时用 $thread/$turn
  models                          model/list 快捷方式
  config                          config/read 快捷方式
  login <apiKey>                  account/login/start(type=apiKey) 快捷方式

  {C.green("--- 其它 ---")}
  state                          显示当前 $thread/$turn/连接状态/待处理队列长度
  rawlog on|off                  开/关打印原始 JSON 报文
  help                           显示本帮助
  quit / exit                    退出（会尝试终止子进程）
"""


class Repl:
    def __init__(self, client: CodexAppServerClient):
        self.client = client
        self.last_thread_id: Optional[str] = None
        self.last_turn_id: Optional[str] = None
        client.on_notification(self._track_ids)

    def _track_ids(self, method: Optional[str], params: Any) -> None:
        if not isinstance(params, dict):
            return
        if method == "thread/started":
            tid = (params.get("thread") or {}).get("id")
            if tid:
                self.last_thread_id = tid
        elif method == "turn/started":
            turn = params.get("turn") or {}
            if turn.get("id"):
                self.last_turn_id = turn["id"]

    # ---------------- 命令实现 ----------------
    def cmd_call(self, rest: str) -> None:
        method, _, json_part = rest.partition(" ")
        if not method:
            print(C.red("用法: call <method> [json-params]"))
            return
        try:
            params = try_parse_json(json_part)
        except json.JSONDecodeError as e:
            print(C.red(f"参数不是合法 JSON: {e}"))
            return
        try:
            resp = self.client.request(method, params)
        except TimeoutError as e:
            print(C.red(str(e)))
            return
        if "error" in resp:
            print(C.red(f"◀ error: {pretty(resp['error'])}"))
        else:
            print(C.green("◀ result:"))
            print(pretty(resp.get("result")))

    def cmd_notify(self, rest: str) -> None:
        method, _, json_part = rest.partition(" ")
        if not method:
            print(C.red("用法: notify <method> [json-params]"))
            return
        try:
            params = try_parse_json(json_part)
        except json.JSONDecodeError as e:
            print(C.red(f"参数不是合法 JSON: {e}"))
            return
        self.client.notify(method, params)

    def cmd_respond(self, rest: str) -> None:
        id_part, _, json_part = rest.partition(" ")
        if not id_part:
            print(C.red("用法: respond <id> <json-result>"))
            return
        try:
            req_id: Any = int(id_part)
        except ValueError:
            req_id = id_part  # 允许字符串 id
        try:
            result = try_parse_json(json_part) or {}
        except json.JSONDecodeError as e:
            print(C.red(f"结果不是合法 JSON: {e}"))
            return
        self.client.respond(req_id, result=result)
        print(C.green(f"已回应 id={req_id}"))

    def cmd_pending(self) -> None:
        items = list(self.client.pending_server_requests.queue)
        if not items:
            print(C.dim("（无待处理的服务器请求）"))
            return
        for it in items:
            print(f"  id={it['id']}  method={it['method']}")

    def cmd_approve(self) -> None:
        try:
            item = self.client.pending_server_requests.get_nowait()
        except queue.Empty:
            print(C.dim("（当前没有待处理的服务器请求）"))
            return
        print(f"{C.magenta('处理请求')} id={item['id']} method={item['method']}")
        print(pretty(item["params"]))
        method = item["method"]
        if method in ("item/commandExecution/requestApproval", "item/fileChange/requestApproval"):
            ans = input("决定 [a]ccept / [s]ession / [d]ecline / [c]ancel / 自定义json: ").strip()
            mapping = {"a": "accept", "s": "acceptForSession", "d": "decline", "c": "cancel"}
            if ans in mapping:
                self.client.respond(item["id"], result={"decision": mapping[ans]})
            elif ans:
                try:
                    self.client.respond(item["id"], result=json.loads(ans))
                except json.JSONDecodeError:
                    print(C.red("无法解析为 JSON，已放弃回应，该请求会保持挂起。"))
                    self.client.pending_server_requests.put(item)  # 放回队列
            else:
                self.client.pending_server_requests.put(item)
        elif method == "item/permissions/requestApproval":
            ans = input("授予全部请求的权限？[y]es / [n]o(拒绝全部) / 自定义json result: ").strip()
            if ans.lower() == "y":
                perms = (item["params"] or {}).get("permissions", {})
                self.client.respond(item["id"], result={"scope": "turn", "permissions": perms})
            elif ans.lower() == "n":
                self.client.respond(item["id"], result={"scope": "turn", "permissions": {}})
            elif ans:
                try:
                    self.client.respond(item["id"], result=json.loads(ans))
                except json.JSONDecodeError:
                    print(C.red("无法解析为 JSON，已放弃回应。"))
                    self.client.pending_server_requests.put(item)
        else:
            ans = input("输入回应的 JSON result（回车 = {}）: ").strip()
            try:
                result = json.loads(ans) if ans else {}
            except json.JSONDecodeError:
                print(C.red("无法解析为 JSON，已放弃回应。"))
                self.client.pending_server_requests.put(item)
                return
            self.client.respond(item["id"], result=result)
        print(C.green("已回应。"))

    def cmd_init(self, rest: str, client_name: str, experimental: bool) -> None:
        resp = self.client.request("initialize", {
            "clientInfo": {"name": client_name, "title": "Codex App-Server REPL", "version": "0.1.0"},
            "capabilities": {"experimentalApi": experimental},
        })
        if "error" in resp:
            print(C.red(f"initialize 失败: {pretty(resp['error'])}"))
            return
        print(C.green("initialize 成功:"))
        print(pretty(resp.get("result")))
        self.client.notify("initialized")
        print(C.green("已发送 initialized 通知。"))

    def cmd_threads(self, rest: str) -> None:
        try:
            params = try_parse_json(rest) or {}
        except json.JSONDecodeError as e:
            print(C.red(f"参数不是合法 JSON: {e}"))
            return
        self.cmd_call("thread/list " + json.dumps(params))

    def cmd_newthread(self, rest: str) -> None:
        params: Dict[str, Any] = {}
        cwd = rest.strip()
        if cwd:
            params["cwd"] = cwd
        resp = self.client.request("thread/start", params)
        if "error" in resp:
            print(C.red(pretty(resp["error"])))
            return
        thread = resp["result"]["thread"]
        self.last_thread_id = thread["id"]
        print(C.green(f"新线程: {thread['id']}  (已记为 $thread)"))
        print(pretty(thread))

    def cmd_resume(self, rest: str) -> None:
        thread_id = rest.strip() or self.last_thread_id
        if not thread_id:
            print(C.red("用法: resume <threadId>"))
            return
        resp = self.client.request("thread/resume", {"threadId": thread_id, "excludeTurns": True})
        if "error" in resp:
            print(C.red(pretty(resp["error"])))
            return
        self.last_thread_id = thread_id
        print(C.green(f"已恢复线程 {thread_id}  (已记为 $thread)"))
        print(pretty(resp["result"]))

    def cmd_send(self, rest: str) -> None:
        parts = rest.split(maxsplit=1)
        thread_id = self.last_thread_id
        text = rest
        if parts and parts[0].startswith("thr_") and len(parts) == 2:
            thread_id = parts[0]
            text = parts[1]
        if not thread_id:
            print(C.red("没有可用的 threadId：请先 newthread，或显式传入 send <threadId> <text>"))
            return
        if not text.strip():
            print(C.red("用法: send [threadId] <text...>"))
            return
        resp = self.client.request("turn/start", {
            "threadId": thread_id,
            "input": [{"type": "text", "text": text}],
        })
        if "error" in resp:
            print(C.red(pretty(resp["error"])))
            return
        turn = resp["result"]["turn"]
        self.last_turn_id = turn["id"]
        print(C.green(f"turn 已开始: {turn['id']} (已记为 $turn)；后续 item/*、turn/* 通知会自动打印。"))

    def cmd_interrupt(self, rest: str) -> None:
        parts = rest.split()
        thread_id = parts[0] if len(parts) >= 1 else self.last_thread_id
        turn_id = parts[1] if len(parts) >= 2 else self.last_turn_id
        if not thread_id or not turn_id:
            print(C.red("用法: interrupt [threadId] [turnId]（或先用 send 建立 $thread/$turn）"))
            return
        resp = self.client.request("turn/interrupt", {"threadId": thread_id, "turnId": turn_id})
        if "error" in resp:
            print(C.red(pretty(resp["error"])))
        else:
            print(C.green("已请求中断。"))

    def cmd_models(self) -> None:
        self.cmd_call("model/list")

    def cmd_config(self) -> None:
        self.cmd_call("config/read")

    def cmd_login(self, rest: str) -> None:
        api_key = rest.strip()
        if not api_key:
            print(C.red("用法: login <apiKey>"))
            return
        self.cmd_call("account/login/start " + json.dumps({"type": "apiKey", "apiKey": api_key}))

    def cmd_state(self) -> None:
        print(pretty({
            "thread": self.last_thread_id,
            "turn": self.last_turn_id,
            "process_alive": self.client.proc.poll() is None,
            "pending_server_requests": self.client.pending_server_requests.qsize(),
            "auto_approve": self.client.auto_approve,
            "raw_log": self.client.log_raw,
        }))

    # ---------------- 主循环 ----------------
    def run(self, client_name: str, experimental: bool) -> None:
        print(HELP_TEXT)
        while True:
            try:
                line = input(C.bold("> "))
            except (EOFError, KeyboardInterrupt):
                print()
                break
            line = line.strip()
            if not line:
                continue
            cmd, _, rest = line.partition(" ")
            rest = rest.strip()
            try:
                if cmd in ("quit", "exit"):
                    break
                elif cmd == "help":
                    print(HELP_TEXT)
                elif cmd == "call":
                    self.cmd_call(rest)
                elif cmd == "notify":
                    self.cmd_notify(rest)
                elif cmd == "respond":
                    self.cmd_respond(rest)
                elif cmd == "pending":
                    self.cmd_pending()
                elif cmd == "approve":
                    self.cmd_approve()
                elif cmd == "auto":
                    self.client.auto_approve = rest.strip().lower() == "on"
                    print(C.green(f"auto_approve = {self.client.auto_approve}"))
                elif cmd == "init":
                    self.cmd_init(rest, client_name, experimental)
                elif cmd == "threads":
                    self.cmd_threads(rest)
                elif cmd == "newthread":
                    self.cmd_newthread(rest)
                elif cmd == "resume":
                    self.cmd_resume(rest)
                elif cmd == "send":
                    self.cmd_send(rest)
                elif cmd == "interrupt":
                    self.cmd_interrupt(rest)
                elif cmd == "models":
                    self.cmd_models()
                elif cmd == "config":
                    self.cmd_config()
                elif cmd == "login":
                    self.cmd_login(rest)
                elif cmd == "state":
                    self.cmd_state()
                elif cmd == "rawlog":
                    self.client.log_raw = rest.strip().lower() == "on"
                    print(C.green(f"raw_log = {self.client.log_raw}"))
                else:
                    print(C.red(f"未知命令: {cmd!r}，输入 help 查看可用命令。"))
            except TimeoutError as e:
                print(C.red(str(e)))
            except Exception as e:  # noqa: BLE001
                print(C.red(f"[命令执行异常] {type(e).__name__}: {e}"))


# --------------------------------------------------------------------------
# 入口
# --------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description="交互式测试 codex app-server 的 stdio JSON-RPC 接口")
    parser.add_argument("--bin", default="codex", help="codex 可执行文件路径，默认 'codex'")
    parser.add_argument("--args", default="app-server --stdio",
                         help="传给可执行文件的参数（用空格分隔），默认 'app-server --stdio'")
    parser.add_argument("--client-name", default="codex", help="initialize.clientInfo.name")
    parser.add_argument("--experimental", action="store_true", help="握手时开启 capabilities.experimentalApi")
    parser.add_argument("--auto-approve", action="store_true", help="对 approval 类服务器请求自动 accept")
    parser.add_argument("--raw-log", action="store_true", help="打印原始 JSON-RPC 报文（调试用）")
    parser.add_argument("--no-auto-init", action="store_true", help="不要自动发送 initialize，改为手动执行 'init'")
    args = parser.parse_args()

    cmd = [args.bin] + shlex.split(args.args)
    print(C.dim(f"启动: {' '.join(cmd)}"))
    client = CodexAppServerClient(cmd, log_raw=args.raw_log, auto_approve=args.auto_approve)
    repl = Repl(client)

    if not args.no_auto_init:
        time.sleep(0.1)  # 给子进程一点启动时间
        print(C.dim("正在自动发送 initialize/initialized 握手…"))
        repl.cmd_init("", args.client_name, args.experimental)

    try:
        repl.run(args.client_name, args.experimental)
    finally:
        client.close()
        print(C.dim("已退出。"))


if __name__ == "__main__":
    main()