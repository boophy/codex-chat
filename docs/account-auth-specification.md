# Codex App Server 账户与登录协议规范 (Account Authentication Specification)

本文档记录了 `codex-app-server` 原生提供的全部账户认证、OAuth 流程与相关 JSON-RPC 2.0 接口规范。
客户端直接通过 WebSocket JSON-RPC 访问下列方法与通知，无需在中间中间件中重复实现。

---

## 登录详细功能清单与时序

| 步骤 | 功能 | 类型 | RPC 方法 / 事件名 | 参数 / 结构 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **连接握手** | Client Request | `initialize` | `{ clientInfo: { name, title, version }, capabilities: { experimentalApi: true } }` | WebSocket 建立连接后第一步，必须先完成，随后客户端发送 `initialized` 通知 |
| **2** | **检查登录** | Client Request | `account/read` | `{ refreshToken: false }` | 避免重复登录，返回 `account.type`, `planType`, `requiresOpenaiAuth` |
| **3** | **发起登录** | Client Request | `account/login/start` | `{ type: "chatgpt", appBrand: "codex", codexStreamlinedLogin: true, useHostedLoginSuccessPage: true }` | 返回 `loginId` 和 `authUrl` |
| **4** | **打开授权** | 客户端动作 | `window.open(authUrl)` | 非 RPC | 在浏览器中打开授权页面，服务端内部会启动本地回调 HTTP 接收 OAuth 回调 |
| **5** | **监听通知** | Server Notify | `account/login/completed`<br>`account/updated` | `{ loginId, success, error }`<br>`{ authMode, planType }` | 无 `id`，需通过 WebSocket 长连接持续监听回调通知 |
| **6** | **取消登录** | Client Request | `account/login/cancel` | `{ loginId: string }` | 传 `loginId`，用于用户主动放弃或关闭授权弹窗 |
| **7** | **登出功能** | Client Request | `account/logout` | `{}` | 清空当前已存凭证，服务端广播 `account/updated` |

---

## 详细协议格式

### 1. 建立连接 + initialize
- 客户端发送：
```json
{
  "method": "initialize",
  "id": 1,
  "params": {
    "clientInfo": {
      "name": "codex_web_chat",
      "title": "Codex Web Chat Client",
      "version": "1.0.0"
    },
    "capabilities": {
      "experimentalApi": true,
      "requestAttestation": false,
      "optOutNotificationMethods": []
    }
  }
}
```
- 服务端返回：
```json
{
  "id": 1,
  "result": {
    "userAgent": "codex-app-server/0.1.0",
    "codexHome": "/root/.codex",
    "platformFamily": "unix",
    "platformOs": "linux"
  }
}
```
- 客户端紧接着发送 `initialized` 通知：
```json
{
  "method": "initialized"
}
```

### 2. 检查已有登录状态: `account/read`
- 客户端发送：
```json
{
  "method": "account/read",
  "id": 2,
  "params": {
    "refreshToken": false
  }
}
```
- 响应示例（未登录）：
```json
{
  "id": 2,
  "result": {
    "account": null,
    "requiresOpenaiAuth": true
  }
}
```
- 响应示例（已登录 ChatGPT）：
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
> **判断规则**：如果 `res.account?.type === "chatgpt"` 且有对应信息，或者 `!res.requiresOpenaiAuth`，说明凭证有效，直接进入“已登录”状态。

### 3. 发起登录: `account/login/start`
- 客户端发送：
```json
{
  "method": "account/login/start",
  "id": 3,
  "params": {
    "type": "chatgpt",
    "appBrand": "codex",
    "codexStreamlinedLogin": true,
    "useHostedLoginSuccessPage": true
  }
}
```
- 服务端返回：
```json
{
  "id": 3,
  "result": {
    "type": "chatgpt",
    "loginId": "0195ec6b-1d6f-7c2e-8c7a-56f2c4a8b9d1",
    "authUrl": "https://chatgpt.com/oauth/authorize?client_id=...&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fauth%2Fcallback"
  }
}
```

### 4. 浏览器端完成授权
客户端调用：
```typescript
const win = window.open(authUrl, "_blank");
```
并在 UI 上展示授权链接复制按钮以及“重新打开授权窗口”按钮，以防被浏览器拦截弹出。
用户在 OpenAI 授权页确认并登录后，重定向到服务端的本地回调端口。

### 5. 监听服务端主动推送通知
#### (a) `account/login/completed`
```json
{
  "method": "account/login/completed",
  "params": {
    "loginId": "0195ec6b-1d6f-7c2e-8c7a-56f2c4a8b9d1",
    "success": true,
    "error": null,
    "onboardingEntrypoint": null
  }
}
```
- 若 `success === true`：授权成功，调用 `account/read` 刷新账号信息。
- 若 `success === false`：授权失败或被拒绝，提示 `error` 消息。
- 客户端同时设置 10 分钟倒计时保护，超时后自动置为失败。

#### (b) `account/updated`
```json
{
  "method": "account/updated",
  "params": {
    "authMode": "chatgpt",
    "planType": "plus"
  }
}
```
登出成功时广播：
```json
{
  "method": "account/updated",
  "params": {
    "authMode": null,
    "planType": null
  }
}
```

### 6. 取消登录: `account/login/cancel`
- 客户端发送：
```json
{
  "method": "account/login/cancel",
  "id": 4,
  "params": {
    "loginId": "0195ec6b-1d6f-7c2e-8c7a-56f2c4a8b9d1"
  }
}
```
- 服务端返回：
```json
{
  "id": 4,
  "result": {
    "status": "canceled"
  }
}
```

### 7. 登出: `account/logout`
- 客户端发送：
```json
{
  "method": "account/logout",
  "id": 5,
  "params": {}
}
```
- 服务端返回：
```json
{
  "id": 5,
  "result": {}
}
```
同时服务端会广播 `account/updated` (`authMode: null`)。
