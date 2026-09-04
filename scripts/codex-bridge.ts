import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { bridgeDb } from "../server/bridge-db";
import { bridgeManager, extractProviderFromHome } from "../server/bridge-manager";

const LISTEN_PORT = parseInt(process.env.BRIDGE_PORT || "8081", 10);
const DEFAULT_TARGET_WS_URL = process.env.CODEX_WS_URL || "ws://127.0.0.1:8080";

function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*"
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || "/", `http://localhost:${LISTEN_PORT}`);
  const pathname = parsedUrl.pathname;

  // 1. Health probes
  if (pathname === "/readyz" || pathname === "/healthz") {
    sendJson(res, 200, { status: "ok", bridge: true, uptime: process.uptime() });
    return;
  }

  // 2. Server Management API
  if (pathname === "/api/codex/servers" && req.method === "GET") {
    const servers = bridgeManager.listServers();
    sendJson(res, 200, { servers });
    return;
  }

  if (pathname === "/api/codex/servers/start" && req.method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const serverInstance = await bridgeManager.startServer({
        codexHome: body.codexHome,
        listenPort: body.listenPort ? parseInt(body.listenPort, 10) : undefined,
        modelProvider: body.modelProvider,
        forceRestart: body.forceRestart
      });
      sendJson(res, 200, { success: true, server: serverInstance });
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  if (pathname.startsWith("/api/codex/servers/") && pathname.endsWith("/stop") && req.method === "POST") {
    const id = pathname.replace("/api/codex/servers/", "").replace("/stop", "");
    const stopped = await bridgeManager.stopServer(id);
    sendJson(res, 200, { success: stopped, id });
    return;
  }

  if (pathname.startsWith("/api/codex/servers/") && req.method === "GET") {
    const id = pathname.replace("/api/codex/servers/", "");
    const serverDetails = bridgeManager.getServer(id);
    if (!serverDetails) {
      sendJson(res, 404, { error: "Server not found" });
    } else {
      sendJson(res, 200, { server: serverDetails });
    }
    return;
  }

  // 3. Thread Config & Ensure Server
  if (pathname === "/api/codex/threads/ensure-and-save" && req.method === "POST") {
    try {
      const body = await parseJsonBody(req);
      // Fallback modelProvider if not set: default to ~/.codex-aws => 'codex-aws'
      const modelProvider = (body.modelProvider && body.modelProvider.trim()) || "codex-aws";
      const codexHome = body.codexHome || `~/.${modelProvider}`;

      // Ensure app-server is running
      const serverInst = await bridgeManager.ensureServerForThread({
        modelProvider,
        codexHome,
        model: body.model
      });

      const threadId = body.id || `thread-cfg-${Date.now()}`;
      const record = {
        id: threadId,
        name: body.name || `Thread (${modelProvider})`,
        model_provider: modelProvider,
        model: body.model || "gpt-5",
        cwd: body.cwd || process.cwd(),
        approval_policy: typeof body.approvalPolicy === "object" ? JSON.stringify(body.approvalPolicy) : String(body.approvalPolicy || "on-request"),
        approvals_reviewer: body.approvalsReviewer || "user",
        config_json: JSON.stringify(body.config || {}),
        service_name: body.serviceName || "",
        base_instructions: body.baseInstructions || "",
        developer_instructions: body.developerInstructions || "",
        personality: body.personality || "pragmatic",
        ephemeral: body.ephemeral ? 1 : 0,
        session_start_source: body.sessionStartSource || "startup",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      bridgeDb.saveThreadConfig(record);
      bridgeDb.logOperation("THREAD_CONFIG_SAVED", { threadId, modelProvider, serverPort: serverInst.listenPort });

      sendJson(res, 200, {
        success: true,
        hydratedConfig: {
          ...body,
          modelProvider,
          cwd: record.cwd,
          targetServer: {
            id: serverInst.id,
            listenAddr: serverInst.listenAddr,
            listenPort: serverInst.listenPort
          }
        },
        savedRecord: record
      });
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  if (pathname === "/api/codex/threads/configs" && req.method === "GET") {
    const configs = bridgeDb.listThreadConfigs();
    sendJson(res, 200, { configs });
    return;
  }

  if (pathname === "/api/codex/config/read" && req.method === "GET") {
    try {
      const provider = parsedUrl.searchParams.get("provider") || undefined;
      const config = await bridgeManager.readConfigToml(provider);
      sendJson(res, 200, { config });
    } catch (err: any) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // 4. Account Operations
  if (pathname === "/api/codex/account/login/start" && req.method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const result = await bridgeManager.handleAccountAction("start", body);
      // Broadcast update notification
      broadcastWsNotification("account/login/started", result);
      sendJson(res, 200, result);
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  if (pathname === "/api/codex/account/login/cancel" && req.method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const result = await bridgeManager.handleAccountAction("cancel", body);
      broadcastWsNotification("account/updated", { status: "login_cancelled" });
      sendJson(res, 200, result);
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  if (pathname === "/api/codex/account/logout" && req.method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const result = await bridgeManager.handleAccountAction("logout", body);
      broadcastWsNotification("account/updated", { status: "logged_out" });
      sendJson(res, 200, result);
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  if (pathname === "/api/codex/account/read" && req.method === "GET") {
    try {
      const type = parsedUrl.searchParams.get("type") || "chatgpt";
      const result = await bridgeManager.handleAccountAction("read", { type });
      sendJson(res, 200, result);
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // Default informational status
  sendJson(res, 200, {
    name: "Codex Bridge Service",
    status: "online",
    activeServers: bridgeManager.listServers().filter((s) => s.status === "running").length,
    endpoints: [
      "/api/codex/servers",
      "/api/codex/servers/start",
      "/api/codex/threads/ensure-and-save",
      "/api/codex/config/read",
      "/api/codex/account/login/start",
      "/api/codex/account/read"
    ]
  });
});

const wss = new WebSocketServer({ server });
const connectedClients = new Set<WebSocket>();

function broadcastWsNotification(method: string, params: any) {
  const payload = JSON.stringify({
    jsonrpc: "2.0",
    method,
    params
  });
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

wss.on("connection", (clientWs, req) => {
  connectedClients.add(clientWs);
  console.log(`[Bridge] Client connected from ${req.socket.remoteAddress}`);

  // Determine target upstream WS address based on request URL query params or active servers
  const parsedUrl = new URL(req.url || "/", "http://localhost:8081");
  const targetPort = parsedUrl.searchParams.get("port");
  const provider = parsedUrl.searchParams.get("provider");

  let upstreamUrl = DEFAULT_TARGET_WS_URL;
  if (targetPort) {
    upstreamUrl = `ws://127.0.0.1:${targetPort}`;
  } else if (provider) {
    const running = bridgeManager.listServers().find((s) => s.model_provider === provider && s.status === "running");
    if (running) {
      upstreamUrl = running.listen_addr;
    }
  }

  // Connect upstream with NO Origin header to avoid 403 Forbidden
  const upstreamWs = new WebSocket(upstreamUrl, {
    headers: {},
    origin: undefined
  });

  const pendingQueue: any[] = [];
  let upstreamOpen = false;

  upstreamWs.on("open", () => {
    upstreamOpen = true;
    console.log(`[Bridge] Connected to Codex upstream at ${upstreamUrl}`);
    while (pendingQueue.length > 0) {
      const msg = pendingQueue.shift();
      upstreamWs.send(msg);
    }
  });

  clientWs.on("message", (data, isBinary) => {
    try {
      const parsed = JSON.parse(data.toString());
      // Intercept account login completion notifications from client if sent
      if (parsed.method === "account/login/completed") {
        broadcastWsNotification("account/login/completed", parsed.params || {});
      }
    } catch {}

    if (upstreamOpen && upstreamWs.readyState === WebSocket.OPEN) {
      upstreamWs.send(data, { binary: isBinary });
    } else {
      pendingQueue.push(data);
    }
  });

  upstreamWs.on("message", (data, isBinary) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (parsed.method === "account/login/completed" || parsed.method === "account/updated") {
        broadcastWsNotification(parsed.method, parsed.params || {});
      }
    } catch {}

    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data, { binary: isBinary });
    }
  });

  clientWs.on("close", (code, reason) => {
    connectedClients.delete(clientWs);
    if (upstreamWs.readyState === WebSocket.OPEN || upstreamWs.readyState === WebSocket.CONNECTING) {
      upstreamWs.close();
    }
  });

  upstreamWs.on("close", (code, reason) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(code, reason);
    }
  });

  upstreamWs.on("error", (err) => {
    console.error(`[Bridge] Upstream error: ${err.message}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, `Upstream error: ${err.message}`);
    }
  });

  clientWs.on("error", (err) => {
    upstreamWs.close();
  });
});

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`=======================================================`);
  console.log(` Codex Bridge & Process Manager active on ws://127.0.0.1:${LISTEN_PORT}`);
  console.log(` REST API available for Server / Config / Account management`);
  console.log(` SQLite database connected with WAL persistence`);
  console.log(` Stripping Origin header to prevent HTTP 403 rejection`);
  console.log(`=======================================================`);
});
