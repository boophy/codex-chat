import { spawn } from "child_process";
import type { ChildProcessWithoutNullStreams } from "child_process";
import { createInterface } from "readline";

type MessageHandler = (msg: any) => void;
type LineHandler = (line: string) => void;
type CloseHandler = (code: number | null) => void;
type ErrorHandler = (err: Error) => void;
type LogHandler = (line: string) => void;

interface Pending {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  init?: boolean;
}

export class CodexStdioTransport {
  private child: ChildProcessWithoutNullStreams | null = null;
  private rl: ReturnType<typeof createInterface> | null = null;
  private nextId = 1;
  private pending = new Map<number | string, Pending>();
  private lineHandlers = new Set<LineHandler>();
  private messageHandlers = new Set<MessageHandler>();
  private closeHandlers = new Set<CloseHandler>();
  private errorHandlers = new Set<ErrorHandler>();
  private logHandlers = new Set<LogHandler>();
  private readyPromise: Promise<void> | null = null;
  private closed = false;

  constructor(
    private bin: string,
    private codexHome: string,
    private args: string[] = []
  ) {}

  get process(): ChildProcessWithoutNullStreams | null {
    return this.child;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  start(): void {
    this.child = spawn(this.bin, ["app-server", "--stdio", ...this.args], {
      env: { ...process.env, CODEX_HOME: this.codexHome },
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.rl = createInterface({ input: this.child.stdout });
    this.rl.on("line", (line) => this.handleLine(line));

    this.child.stderr?.on("data", (data) => {
      const text = data.toString();
      this.logHandlers.forEach((fn) => fn(text));
    });

    this.child.on("error", (err) => {
      this.failPending(new Error(`codex process error: ${err.message}`));
      this.errorHandlers.forEach((fn) => fn(err));
    });

    this.child.on("close", (code) => {
      this.closed = true;
      this.failPending(new Error(`codex process closed (${code})`));
      this.closeHandlers.forEach((fn) => fn(code));
    });
  }

  sendLine(line: string): void {
    if (!this.child || this.closed) return;
    this.child.stdin.write(line + "\n");
  }

  send(msg: any): void {
    this.sendLine(JSON.stringify(msg));
  }

  request(method: string, params?: any, timeoutMs = 30000): Promise<any> {
    return this.ensureReady().then(() => this.dispatch(method, params, timeoutMs));
  }

  notify(method: string, params?: any): void {
    this.ensureReady()
      .then(() => this.send({ method, params }))
      .catch(() => {});
  }

  onLine(fn: LineHandler): () => void {
    this.lineHandlers.add(fn);
    return () => this.lineHandlers.delete(fn);
  }

  onMessage(fn: MessageHandler): () => void {
    this.messageHandlers.add(fn);
    return () => this.messageHandlers.delete(fn);
  }

  onClose(fn: CloseHandler): () => void {
    this.closeHandlers.add(fn);
    return () => this.closeHandlers.delete(fn);
  }

  onError(fn: ErrorHandler): () => void {
    this.errorHandlers.add(fn);
    return () => this.errorHandlers.delete(fn);
  }

  onLog(fn: LogHandler): () => void {
    this.logHandlers.add(fn);
    return () => this.logHandlers.delete(fn);
  }

  close(): void {
    this.closed = true;
    if (this.rl) this.rl.close();
    if (this.child) {
      try {
        this.child.kill("SIGTERM");
      } catch {}
    }
  }

  private ensureReady(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const id = `init-${this.nextId++}`;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("codex stdio initialize timed out"));
        this.readyPromise = null;
      }, 10000);

      this.pending.set(id, {
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (e: Error) => {
          clearTimeout(timer);
          reject(e);
          this.readyPromise = null;
        },
        timer,
        init: true
      });

      this.send({
        method: "initialize",
        id,
        params: {
          clientInfo: {
            name: "codex_bridge",
            title: "Codex Bridge",
            version: "1.0.0"
          }
        }
      });
    });

    return this.readyPromise;
  }

  private dispatch(method: string, params: any, timeoutMs: number): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`codex request ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.send({ method, id, params });
    });
  }

  private handleLine(line: string): void {
    this.lineHandlers.forEach((fn) => fn(line));

    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }

    this.messageHandlers.forEach((fn) => fn(msg));

    if (
      msg.id !== undefined &&
      msg.id !== null &&
      (msg.result !== undefined || msg.error !== undefined)
    ) {
      const entry = this.pending.get(msg.id);
      if (entry) {
        this.pending.delete(msg.id);
        clearTimeout(entry.timer);
        if (msg.error) {
          entry.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          entry.resolve(msg.result);
        }
        if (entry.init) {
          this.send({ method: "initialized", params: {} });
        }
      }
    }
  }

  private failPending(err: Error): void {
    this.pending.forEach((entry) => {
      clearTimeout(entry.timer);
      entry.reject(err);
    });
    this.pending.clear();
    if (this.readyPromise) {
      this.readyPromise = null;
    }
  }
}