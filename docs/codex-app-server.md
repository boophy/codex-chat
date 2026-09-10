# codex-app-server Documentation & Protocol Specification

`codex app-server` is the interface Codex uses to power rich interfaces such as the [Codex VS Code extension](https://marketplace.visualstudio.com/items?itemName=openai.chatgpt).

## Table of Contents

- [Protocol](#protocol)
- [Message Schema](#message-schema)
- [Core Primitives](#core-primitives)
- [Lifecycle Overview](#lifecycle-overview)
- [Initialization](#initialization)
- [API Overview](#api-overview)
- [Events](#events)
- [Approvals](#approvals)
- [Skills](#skills)
- [Apps](#apps)
- [Auth endpoints](#auth-endpoints)
- [Experimental API Opt-in](#experimental-api-opt-in)

---

## 登录详细功能清单（Login Functional Checklist）

### 1. 建立连接 + initialize
Web client 需要先与 app-server 建立 JSON-RPC 2.0 连接（WebSocket 或 stdio/unix socket），并完成 `initialize` 握手。
- 发送 `initialize` 请求：
```json
{
  "method": "initialize",
  "id": 1,
  "params": {
    "clientInfo": {
      "name": "my_client",
      "title": "My Client",
      "version": "0.1.0"
    },
    "capabilities": {
      "experimentalApi": true
    }
  }
}
```
- 服务端返回初始化响应：`{ userAgent, codexHome, platformFamily, platformOs }`。
- 客户端随后发送无 id 的 `initialized` 通知：
```json
{
  "method": "initialized"
}
```

### 2. 检查已有登录状态
调用 `account/read`，判断当前 `authMode` 是否已经是 `chatgpt`（或 `requiresOpenaiAuth: false`）。如果是，直接进入“已登录”状态，不需要重新走 OAuth。
- 请求：
```json
{ "method": "account/read", "id": 2, "params": { "refreshToken": false } }
```
- 响应：
```json
{
  "id": 2,
  "result": {
    "account": {
      "type": "chatgpt",
      "email": "user@example.com",
      "planType": "plus"
    },
    "requiresOpenaiAuth": true
  }
}
```

### 3. 发起登录：account/login/start
发送 `type: "chatgpt"` 请求，可选参数 `appBrand`、`codexStreamlinedLogin`、`useHostedLoginSuccessPage`：
- 请求：
```json
{
  "method": "account/login/start",
  "id": 3,
  "params": {
    "type": "chatgpt",
    "codexStreamlinedLogin": true,
    "useHostedLoginSuccessPage": true,
    "appBrand": "codex"
  }
}
```
- 响应返回 `loginId` 和 `authUrl`：
```json
{
  "id": 3,
  "result": {
    "type": "chatgpt",
    "loginId": "<uuid>",
    "authUrl": "https://chatgpt.com/oauth/authorize?..."
  }
}
```

### 4. 打开浏览器完成 OAuth
Web client 在新标签页或弹窗中打开 `authUrl`（`window.open(authUrl, "_blank")`），让用户在浏览器中完成 ChatGPT 登录授权。
服务端内部会启动本地回调 HTTP 服务器等待 OAuth 回调，客户端无需实现 OAuth 回调服务器。

### 5. 监听通知：account/login/completed / account/updated
登录成功或失败都会通过服务端主动推送的通知（无 id 的 JSON-RPC 消息）告知客户端：
- 登录完成通知 `account/login/completed`：
```json
{
  "method": "account/login/completed",
  "params": {
    "loginId": "<uuid>",
    "success": true,
    "error": null,
    "onboardingEntrypoint": null
  }
}
```
- 账户更新通知 `account/updated`：
```json
{
  "method": "account/updated",
  "params": {
    "authMode": "chatgpt",
    "planType": "plus"
  }
}
```
需要处理三种结果：
- 成功：`success: true`，`authMode: "chatgpt"`
- 失败：`success: false`，带 `error` 消息
- 超时：内部 10 分钟超时后同样发出失败通知

### 6. 支持取消登录
如果用户在浏览器授权前关闭弹窗/放弃，调用 `account/login/cancel` 传入 `loginId`：
- 请求：
```json
{
  "method": "account/login/cancel",
  "id": 4,
  "params": {
    "loginId": "<uuid>"
  }
}
```
- 响应：
```json
{
  "id": 4,
  "result": {
    "status": "canceled"
  }
}
```

### 7. 登出功能
调用 `account/logout` 用于清空当前凭证：
- 请求：
```json
{
  "method": "account/logout",
  "id": 5
}
```
- 响应：
```json
{
  "id": 5,
  "result": {}
}
```
- 服务端会广播通知：
```json
{
  "method": "account/updated",
  "params": {
    "authMode": null,
    "planType": null
  }
}
```

---

## 官方完整协议与端点说明 (Official App-Server Spec)

### Protocol

Similar to MCP, `codex app-server` supports bidirectional communication using JSON-RPC 2.0 messages (with the `"jsonrpc":"2.0"` header omitted on the wire).

Supported transports:
- stdio (`--stdio` or `--listen stdio://`, default): newline-delimited JSON (JSONL)
- websocket (`--listen ws://IP:PORT`): one JSON-RPC message per websocket text frame
- unix socket (`--listen unix://` or `--listen unix://PATH`): websocket connections over `$CODEX_HOME/app-server-control/app-server-control.sock` or a custom socket path, using standard HTTP Upgrade handshake

When running with `--listen ws://IP:PORT`, the same listener also serves basic HTTP health probes:
- `GET /readyz` returns `200 OK` once the listener is accepting new connections.
- `GET /healthz` returns `200 OK` when no `Origin` header is present.
- Any request carrying an `Origin` header is rejected with `403 Forbidden` (Proxy handles stripping Origin).

### Core Primitives
- **Thread**: Conversation between user and Codex agent.
- **Turn**: One turn of the conversation, starting with user message and finishing with agent message.
- **Item**: User inputs and agent outputs (userMessage, reasoning, agentMessage, commandExecution, fileChange, mcpToolCall, etc.).

### Auth Endpoints & Account Lifecycle
- `account/read` - Fetch current account info (`account`, `requiresOpenaiAuth`).
- `account/login/start` - Initiate login (`apiKey`, `chatgpt`, `chatgptDeviceCode`, `amazonBedrock`, `amazonBedrockAccessKeys`).
- `account/login/cancel` - Cancel a pending login by `loginId`.
- `account/logout` - Sign out. Emits `account/updated` on success.
- `account/rateLimits/read` - Read primary and secondary rate limits, resetsAt, credits.
- `account/login/completed` (Notification) - Emitted when a login attempt finishes (`loginId`, `success`, `error`).
- `account/updated` (Notification) - Emitted whenever auth mode changes (`authMode`, `planType`).
- `account/rateLimits/updated` (Notification) - Emitted when rate limits change.
