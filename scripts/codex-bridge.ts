import { ServerThread, TokenData, AgentIdentityStorage, BedrockApiKeyAuth, BedrockAccessKeysAuth, AuthDotJson, ProviderOption, DEFAULT_POPULAR_MODELS, SUPPORTED_PROVIDERS, AccountInfo } from "../src/types";
import { bridgeManager } from "../server/bridge-manager";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { bridgeDb } from "../server/bridge-db";
import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import os from "os";

export type {
  ServerThread,
  TokenData,
  AgentIdentityStorage,
  BedrockApiKeyAuth,
  BedrockAccessKeysAuth,
  AuthDotJson
};

const threads = new Map<string, ServerThread>();
let activeModelProvider = "shengsuanyun";

export function getCodexHomeForProvider(provider: string): string {
  const clean = (provider || "shengsuanyun").trim().replace(/[^a-zA-Z0-9_-]/g, "");
  const folder = clean.startsWith("codex-") ? `.${clean}` : `.codex-${clean}`;
  return path.resolve(os.homedir(), folder);
}

export function getRawAuthDotJson(provider: string): AuthDotJson | null {
  const codexHome = getCodexHomeForProvider(provider);
  const authFile = path.join(codexHome, "auth.json");
  if (fs.existsSync(authFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(authFile, "utf-8"));
      return raw as AuthDotJson;
    } catch (e) {
      console.warn(`[Bridge] Failed to read raw auth.json from ${codexHome}:`, e);
    }
  }
  return null;
}

export function getAccountFromStoredAuth(pid: string): AccountInfo {
  const provider: ProviderOption | undefined = SUPPORTED_PROVIDERS.find(p => p.id === pid);
  if(!provider) {
    throw new Error(`Unsupported provider: ${pid}`);
  }
  const codexHome = getCodexHomeForProvider(pid);
  const authFile = path.join(codexHome, "auth.json");
  if (fs.existsSync(authFile)) {
    try {
      const raw: any = JSON.parse(fs.readFileSync(authFile, "utf-8"));
      if (raw) {
        if (raw.auth_mode =="shengSuanYunAccessKeys" && raw.shengsuanyun_access_keys?.jwt_token?.trim()) {
          fetch("https://api.shengsuanyun.com/user/info", {
            method: "GET",
            headers: {
              "x-token": raw.shengsuanyun_access_keys.jwt_token
            }
          })
          .then(res=>res.json())
          .then(data => {
            return {
              type: "shengsuanyun",
              email: data.data.email,
              name: data.data.name,
              planType: ""
            };
          })
          .catch(err => {
            console.error(`[Bridge] Failed to fetch ShengSuanYun user info for provider ${provider}:`, err);
          });
        }
      }
    } catch (e) {
      console.warn(`[Bridge] Failed to parse auth.json for provider ${pid}:`, e);
    }
  }

  return {
    type: "unkown", email: "", name: "", planType: ""
  };
}

interface PendingLoginSession {
  loginId: string;
  type: string;
  providerId: string;
  ws?: WebSocket;
  timer: NodeJS.Timeout;
  createdAt: number;
}

const pendingLoginSessions = new Map<string, PendingLoginSession>();

export const connectedClients = new Set<WebSocket>();

export function broadcastWsNotification(method: string, params: any) {
  const payload = JSON.stringify({
    jsonrpc: "2.0",
    method,
    params
  });
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch {}
    }
  }
}

function initDefaultThreads() {
  if (threads.size === 0) {
    const t1: ServerThread = {
      id: "thr_welcome_codex_01",
      preview: "WebSocket Client & Full-Stack Engine Setup",
      modelProvider: "openai",
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 3600000,
      recencyAt: Date.now() - 3600000,
      status: { type: "idle" },
      model: "gpt-5.4-codex",
      reasoningEffort: "medium",
      ephemeral: false,
      path: "/workspace/projects/codex-client",
      archived: false,
      turns: [
        {
          id: "turn_init_01",
          status: "completed",
          items: [
            {
              type: "userMessage",
              id: "msg_user_01",
              content: [{ type: "text", text: "Hello! Show me the capabilities of the Codex App Server protocol." }]
            },
            {
              type: "reasoning",
              id: "rsn_01",
              summary: "Analyzing project context and JSON-RPC 2.0 streaming requirements...",
              content: "Inspecting transports: stdio, websocket, unix socket.\nLoaded skills and dynamic tools."
            },
            {
              type: "commandExecution",
              id: "cmd_01",
              command: "codex app-server --listen ws://127.0.0.1:4500",
              cwd: "/workspace/projects/codex-client",
              status: "completed",
              aggregatedOutput: "[info] Codex app-server listening on ws://127.0.0.1:4500\n[info] Ready to accept JSON-RPC 2.0 frames",
              exitCode: 0,
              durationMs: 42
            },
            {
              type: "agentMessage",
              id: "msg_agent_01",
              text: "Welcome to the **Codex Web Chat Client**! Connected via JSON-RPC 2.0 bidirectional WebSocket protocol.\n\nKey features available in this session:\n- **Streaming agent tokens** & live thought reasoning deltas\n- **Interactive Command & File Change approvals**\n- **Live diff viewers** and terminal execution feeds\n- **Turn steering** & instant interrupt controls\n- **Full Protocol Inspector** for debugging JSON-RPC frames in real time"
            }
          ]
        }
      ]
    };
    threads.set(t1.id, t1);
  }
}
initDefaultThreads();

const SKILLS = [
  {
    name: "skill-creator",
    description: "Create or update custom reusable Codex skills",
    enabled: true,
    pluginId: null,
    interface: {
      displayName: "Skill Creator",
      shortDescription: "Interactive skill generator",
      brandColor: "#10b981",
      defaultPrompt: "$skill-creator Create a new test runner skill"
    }
  },
  {
    name: "git-workflow",
    description: "Inspect branches, create commits, resolve merge conflicts",
    enabled: true,
    pluginId: null,
    interface: {
      displayName: "Git Workflow",
      shortDescription: "Git VCS automated actions",
      brandColor: "#f59e0b",
      defaultPrompt: "$git-workflow Review uncommitted changes"
    }
  },
  {
    name: "security-audit",
    description: "Scan source code for vulnerabilities and policy leaks",
    enabled: true,
    pluginId: null,
    interface: {
      displayName: "Security Auditor",
      shortDescription: "Static security analyzer",
      brandColor: "#ef4444",
      defaultPrompt: "$security-audit Audit all dependencies and network calls"
    }
  }
];

const APPS = [
  {
    id: "github-connector",
    name: "GitHub",
    description: "Browse PRs, issues, commits and repository metadata",
    logoUrl: "https://api.iconify.design/lucide:github.svg",
    isAccessible: true,
    isEnabled: true
  },
  {
    id: "postgres-db",
    name: "PostgreSQL Database",
    description: "Query schema and execute read-only SQL queries",
    logoUrl: "https://api.iconify.design/lucide:database.svg",
    isAccessible: true,
    isEnabled: true
  },
  {
    id: "jira-tracker",
    name: "Jira Software",
    description: "Manage sprint tickets and user stories",
    logoUrl: "https://api.iconify.design/lucide:kanban.svg",
    isAccessible: true,
    isEnabled: true
  }
];

export const app = express();
export const PORT = 3000;
export const server = http.createServer(app);
export const wss = new WebSocketServer({ server, path: "/ws" });

export async function startServer() {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Permissive CORS and preflight handling
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  const REAL_BACKEND_URL = process.env.CODEX_BACKEND_URL || (process.env.CODEX_REAL === "1" ? "ws://127.0.0.1:8080" : null);

  // 1. Health probes & Diagnostics
  app.get("/readyz", async (req, res) => {
    if (REAL_BACKEND_URL) {
      try {
        const httpTarget = REAL_BACKEND_URL.replace(/^ws/, "http");
        const resp = await fetch(`${httpTarget}/readyz`, { headers: {} });
        const text = await resp.text();
        return res.status(resp.status).send(text);
      } catch (err: any) {
        return res.status(502).send(`Cannot reach codex /readyz: ${err.message}`);
      }
    }
    res.status(200).send("OK");
  });

  app.get("/healthz", async (req, res) => {
    if (REAL_BACKEND_URL) {
      try {
        const httpTarget = REAL_BACKEND_URL.replace(/^ws/, "http");
        const resp = await fetch(`${httpTarget}/healthz`, { headers: {} });
        const text = await resp.text();
        return res.status(resp.status).send(text);
      } catch (err: any) {
        return res.status(502).send(`Cannot reach codex /healthz: ${err.message}`);
      }
    }
    res.status(200).send("OK");
  });

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      activeThreads: threads.size,
      activeProvider: activeModelProvider,
      threadConfigsCount: bridgeDb.listThreadConfigs().length,
      mode: REAL_BACKEND_URL ? "proxy" : "mock"
    });
  });

  // 2. Server Management API
  app.get("/api/codex/servers", (req, res) => {
    res.json({ servers: bridgeManager.listServers() });
  });

  const handleServerStart = async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const query = req.query || {};
      const modelProvider = body.modelProvider || query.modelProvider;
      if (modelProvider) {
        activeModelProvider = modelProvider.trim();
      }
      const codexHome = body.codexHome || query.codexHome;
      const listenPort = (body.listenPort || query.listenPort) ? parseInt(body.listenPort || query.listenPort, 10) : undefined;
      const forceRestart = body.forceRestart !== undefined ? body.forceRestart : true;

      const serverInstance = await bridgeManager.startServer({
        codexHome,
        listenPort,
        modelProvider: activeModelProvider,
        forceRestart
      });
      res.json({ success: true, server: serverInstance, activeProvider: activeModelProvider });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  app.post("/api/codex/servers/start", handleServerStart);
  app.post("/api/codex/servers/start/", handleServerStart);
  app.get("/api/codex/servers/start", handleServerStart);

  app.post("/api/codex/servers/:id/stop", async (req, res) => {
    const stopped = await bridgeManager.stopServer(req.params.id);
    res.json({ success: stopped, id: req.params.id });
  });

  app.get("/api/codex/servers/:id", (req, res) => {
    const serverDetails = bridgeManager.getServer(req.params.id);
    if (!serverDetails) {
      return res.status(404).json({ error: "Server not found" });
    }
    res.json({ server: serverDetails });
  });

  // 3. Codex Config Reader
  app.get("/api/codex/config/read", async (req, res) => {
    try {
      const provider = (req.query.provider as string) || undefined;
      const config = await bridgeManager.readConfigToml(provider);
      res.json({ config });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. OAuth Simulation Consent Screen
  app.get("/auth/oauth-sim", (req, res) => {
    const loginId = (req.query.loginId as string) || "";
    const type = (req.query.type as string) || "chatgpt";
    const appBrand = (req.query.appBrand as string) || "Codex";

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenAI Authorization - ${appBrand}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-zinc-950 text-zinc-100 flex items-center justify-center min-h-screen p-4 font-sans antialiased">
  <div class="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-6">
    <div class="flex items-center justify-between pb-4 border-b border-zinc-800">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
          🤖
        </div>
        <div>
          <h2 class="text-base font-semibold text-zinc-100">Authorize ${appBrand}</h2>
          <p class="text-xs text-zinc-400">OpenAI ChatGPT Subscription Access</p>
        </div>
      </div>
      <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800">
        OAuth 2.0
      </span>
    </div>

    <div class="space-y-3 text-xs text-zinc-300">
      <p class="leading-relaxed">
        <strong>${appBrand}</strong> is requesting permission to access your ChatGPT subscription to perform reasoning, execute code tasks, and manage session turns.
      </p>

      <div class="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2">
        <div class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Account Credentials</div>
        <div class="flex items-center justify-between font-mono text-[11px]">
          <span class="text-zinc-400">Account:</span>
          <span class="text-zinc-200">user.chatgpt@openai.com</span>
        </div>
        <div class="flex items-center justify-between font-mono text-[11px]">
          <span class="text-zinc-400">Plan:</span>
          <span class="text-emerald-400 font-semibold">ChatGPT Plus</span>
        </div>
        <div class="flex items-center justify-between font-mono text-[11px]">
          <span class="text-zinc-400">Login ID:</span>
          <span class="text-zinc-500 truncate max-w-40">${loginId || "N/A"}</span>
        </div>
      </div>

      <div class="text-[11px] text-zinc-400 space-y-1">
        <div class="flex items-center gap-1.5 text-emerald-400">
          <span>✓</span> Read quota, credits, and active rate limits
        </div>
        <div class="flex items-center gap-1.5 text-emerald-400">
          <span>✓</span> Stream reasoning tokens and turn responses
        </div>
        <div class="flex items-center gap-1.5 text-emerald-400">
          <span>✓</span> Manage execution approvals in workspace
        </div>
      </div>
    </div>

    <div id="actionArea" class="space-y-3 pt-2">
      <button id="btnAuthorize" onclick="submitAuth('approve')" class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-medium text-xs text-white transition-colors cursor-pointer shadow-lg shadow-emerald-950/50">
        Authorize & Complete Login
      </button>
      <button id="btnDeny" onclick="submitAuth('deny')" class="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-medium text-xs text-zinc-300 transition-colors cursor-pointer">
        Cancel / Deny
      </button>
    </div>

    <div id="statusMessage" class="hidden p-3 rounded-xl text-center text-xs"></div>
  </div>

  <script>
    async function submitAuth(action) {
      const btnAuthorize = document.getElementById("btnAuthorize");
      const btnDeny = document.getElementById("btnDeny");
      const actionArea = document.getElementById("actionArea");
      const statusMessage = document.getElementById("statusMessage");

      btnAuthorize.disabled = true;
      btnDeny.disabled = true;

      try {
        const resp = await fetch("/auth/oauth-sim/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loginId: "${loginId}", action })
        });
        const data = await resp.json();

        actionArea.classList.add("hidden");
        statusMessage.classList.remove("hidden");

        if (action === "approve" && data.success) {
          statusMessage.className = "p-4 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-center text-xs space-y-2";
          statusMessage.innerHTML = "<div class='font-semibold text-sm'>✓ Authorization Successful</div><div>Your session has been authenticated with OpenAI ChatGPT. You can now close this tab.</div>";
          setTimeout(() => { window.close(); }, 2000);
        } else {
          statusMessage.className = "p-4 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-center text-xs space-y-2";
          statusMessage.innerHTML = "<div class='font-semibold text-sm'>Authorization Cancelled</div><div>You declined or cancelled the login request. You can close this tab.</div>";
          setTimeout(() => { window.close(); }, 2500);
        }
      } catch (err) {
        actionArea.classList.add("hidden");
        statusMessage.classList.remove("hidden");
        statusMessage.className = "p-4 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-center text-xs";
        statusMessage.innerText = "Error completing authorization: " + err.message;
      }
    }
  </script>
</body>
</html>`);
  });

  // 8. File System Directory Browsing for CWD Picker
  app.get("/api/fs/directories", (req, res) => {
    try {
      let reqPath = (req.query.path as string) || "";
      if (!reqPath || reqPath.trim() === "") {
        reqPath = process.cwd();
      } else if (reqPath.startsWith("~")) {
        reqPath = path.join(os.homedir(), reqPath.slice(1));
      }

      const resolvedPath = path.resolve(reqPath);
      if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ error: "Directory does not exist", path: resolvedPath });
      }

      const stat = fs.statSync(resolvedPath);
      if (!stat.isDirectory()) {
        return res.status(400).json({ error: "Path is not a directory", path: resolvedPath });
      }

      const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
      const directories: Array<{ name: string; path: string; isHidden: boolean; mtime?: string }> = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const entryPath = path.join(resolvedPath, entry.name);
          try {
            const entryStat = fs.statSync(entryPath);
            directories.push({
              name: entry.name,
              path: entryPath,
              isHidden: entry.name.startsWith("."),
              mtime: entryStat.mtime.toISOString()
            });
          } catch {
            directories.push({
              name: entry.name,
              path: entryPath,
              isHidden: entry.name.startsWith(".")
            });
          }
        }
      }

      directories.sort((a, b) => {
        if (a.isHidden !== b.isHidden) return a.isHidden ? 1 : -1;
        return a.name.localeCompare(b.name);
      });

      const parentPath = path.dirname(resolvedPath);
      const isRoot = parentPath === resolvedPath;

      const roots = [
        { name: "Current Project", path: process.cwd() },
        { name: "User Home (~)", path: os.homedir() },
        { name: "Root (/)", path: "/" }
      ];

      res.json({
        currentPath: resolvedPath,
        parentPath: isRoot ? null : parentPath,
        directories,
        roots
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/fs/create-directory", (req, res) => {
    try {
      const { parentPath, dirName } = req.body;
      if (!dirName || typeof dirName !== "string" || dirName.includes("/") || dirName.includes("\\")) {
        return res.status(400).json({ error: "Invalid directory name" });
      }
      const targetDir = path.resolve(parentPath, dirName);
      if (fs.existsSync(targetDir)) {
        return res.status(400).json({ error: "Directory already exists" });
      }
      fs.mkdirSync(targetDir, { recursive: true });
      res.json({ success: true, path: targetDir });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/fs/resolve-folder", (req, res) => {
    try {
      const { folderName, currentPath } = req.body;
      if (!folderName || typeof folderName !== "string") {
        return res.status(400).json({ error: "folderName is required" });
      }

      if (path.isAbsolute(folderName)) {
        return res.json({ fullPath: path.resolve(folderName) });
      }

      const baseDir = (currentPath && typeof currentPath === "string" && currentPath.trim())
        ? path.resolve(currentPath.startsWith("~") ? path.join(os.homedir(), currentPath.slice(1)) : currentPath)
        : process.cwd();

      if (path.basename(baseDir) === folderName) {
        return res.json({ fullPath: baseDir });
      }

      const directCandidate = path.join(baseDir, folderName);
      if (fs.existsSync(directCandidate) && fs.statSync(directCandidate).isDirectory()) {
        return res.json({ fullPath: directCandidate });
      }

      const parentDir = path.dirname(baseDir);
      const siblingCandidate = path.join(parentDir, folderName);
      if (fs.existsSync(siblingCandidate) && fs.statSync(siblingCandidate).isDirectory()) {
        return res.json({ fullPath: siblingCandidate });
      }

      const projCandidate = path.join(process.cwd(), folderName);
      if (fs.existsSync(projCandidate) && fs.statSync(projCandidate).isDirectory()) {
        return res.json({ fullPath: projCandidate });
      }

      const homeCandidate = path.join(os.homedir(), folderName);
      if (fs.existsSync(homeCandidate) && fs.statSync(homeCandidate).isDirectory()) {
        return res.json({ fullPath: homeCandidate });
      }

      if (fs.existsSync("/workspace")) {
        const wsCandidate = path.join("/workspace", folderName);
        if (fs.existsSync(wsCandidate) && fs.statSync(wsCandidate).isDirectory()) {
          return res.json({ fullPath: wsCandidate });
        }
      }

      const searchDirs = [process.cwd(), "/workspace", os.homedir()].filter(d => fs.existsSync(d));
      for (const searchRoot of searchDirs) {
        try {
          const entries = fs.readdirSync(searchRoot, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              if (entry.name === folderName) {
                return res.json({ fullPath: path.join(searchRoot, entry.name) });
              }
              try {
                const subPath = path.join(searchRoot, entry.name);
                const subEntries = fs.readdirSync(subPath, { withFileTypes: true });
                for (const sub of subEntries) {
                  if (sub.isDirectory() && sub.name === folderName) {
                    return res.json({ fullPath: path.join(subPath, sub.name) });
                  }
                }
              } catch {
                // ignore
              }
            }
          }
        } catch {
          // ignore
        }
      }

      const fallbackPath = path.resolve(baseDir, folderName);
      return res.json({ fullPath: fallbackPath });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Unified WebSocket Server (Bridge Proxy + Mock Fallback)
  wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
    connectedClients.add(ws);

    const reqUrl = new URL(req.url || "/ws", "http://localhost:3000");
    const targetPort = reqUrl.searchParams.get("port");
    const targetProvider = reqUrl.searchParams.get("provider");

    let targetRealUrl: string | null = null;
    if (targetPort) {
      targetRealUrl = `ws://127.0.0.1:${targetPort}`;
    } else if (targetProvider) {
      const running = bridgeManager.listServers().find((s) => s.model_provider === targetProvider && s.status === "running");
      if (running) targetRealUrl = running.listen_addr;
    }

    if (!targetRealUrl) {
      targetRealUrl = REAL_BACKEND_URL || (reqUrl.searchParams.get("backend") === "real" ? "ws://127.0.0.1:8080" : null);
    }

    if (!targetRealUrl) {
      const anyRunning = bridgeManager.listServers().find((s) => s.status === "running");
      if (anyRunning) {
        targetRealUrl = anyRunning.listen_addr;
      }
    }

    if (targetRealUrl) {
      console.log(`[Bridge Proxy] Forwarding client connection to real Codex server at ${targetRealUrl} (Origin stripped)`);
      const upstreamWs = new WebSocket(targetRealUrl, {
        origin: undefined
      });

      const buffer: any[] = [];
      let upstreamReady = false;

      upstreamWs.on("open", () => {
        upstreamReady = true;
        while (buffer.length > 0) {
          upstreamWs.send(buffer.shift());
        }
      });

      ws.on("message", (msg) => {
        try {
          const parsed = JSON.parse(msg.toString());
          if (parsed.method === "account/login/completed") {
            broadcastWsNotification("account/login/completed", parsed.params || {});
          }
        } catch {}

        if (upstreamReady && upstreamWs.readyState === WebSocket.OPEN) {
          upstreamWs.send(msg);
        } else {
          buffer.push(msg);
        }
      });

      upstreamWs.on("message", (msg) => {
        try {
          const parsed = JSON.parse(msg.toString());
          if (parsed.method === "account/login/completed" || parsed.method === "account/updated") {
            broadcastWsNotification(parsed.method, parsed.params || {});
          }
        } catch {}

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(msg);
        }
      });

      upstreamWs.on("close", () => {
        connectedClients.delete(ws);
        if (ws.readyState === WebSocket.OPEN) ws.close();
      });

      upstreamWs.on("error", (err) => {
        console.error(`[Bridge Proxy] Upstream connection error: ${err.message}`);
        if (ws.readyState === WebSocket.OPEN) ws.close(1011, `Upstream error: ${err.message}`);
      });

      ws.on("close", () => {
        connectedClients.delete(ws);
        if (upstreamWs.readyState === WebSocket.OPEN) upstreamWs.close();
      });

      return;
    }

    // Mock Simulation JSON-RPC Engine
    let isInitialized = false;
    let activeTurnAbort = false;

    const send = (msgObj: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msgObj));
      }
    };

    const sendNotification = (method: string, params: any) => {
      send({ method, params, jsonrpc: "2.0" });
    };

    const sendRequest = (method: string, params: any): Promise<any> => {
      const id = "srv_req_" + Math.random().toString(36).substring(2, 9);
      send({ id, method, params, jsonrpc: "2.0" });
      return new Promise((resolve) => {
        const handler = (raw: any) => {
          try {
            const data = JSON.parse(raw.toString());
            if (data.id === id) {
              ws.off("message", handler);
              resolve(data.result);
            }
          } catch {}
        };
        ws.on("message", handler);
      });
    };

    ws.on("message", async (raw: any) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.id !== undefined && !msg.method) {
          return;
        }

        const { id, method, params } = msg;

        if (!method) return;

        if (method === "initialize") {
          isInitialized = true;
          send({
            id,
            result: {
              userAgent: "codex-app-server/0.1.0-sim (linux; x86_64)",
              protocolVersion: "2.0",
              capabilities: {
                streaming: true,
                tools: true,
                approvals: true,
                diffs: true
              }
            },
            jsonrpc: "2.0"
          });
          return;
        }

        if (method === "initialized") {
          return;
        }

        if (method === "server/start" || method === "server/restart") {
          const newProv = (params?.modelProvider || activeModelProvider || "shengsuanyun").trim();
          activeModelProvider = newProv;
          const targetCodexHome = params?.codexHome || getCodexHomeForProvider(newProv);
          try {
            const serverInst = await bridgeManager.startServer({
              codexHome: targetCodexHome,
              listenPort: params?.listenPort,
              modelProvider: newProv,
              forceRestart: true
            });
            const authStatus = getAccountFromStoredAuth(newProv);
            send({
              id,
              result: { success: true, server: serverInst, activeProvider: activeModelProvider, codexHome: targetCodexHome, authStatus },
              jsonrpc: "2.0"
            });
          } catch (err: any) {
            send({
              id,
              result: { success: true, activeProvider: activeModelProvider, note: err.message },
              jsonrpc: "2.0"
            });
          }
          return;
        }

        if (method === "provider/switch") {
          if (params?.provider) {
            activeModelProvider = params.provider.trim();
          }
          const authStatus = getAccountFromStoredAuth(activeModelProvider);
          send({
            id,
            result: { success: true, activeProvider: activeModelProvider, authStatus },
            jsonrpc: "2.0"
          });
          return;
        }

        if (method === "server/diagnostics") {
          const mem = process.memoryUsage();
          send({
            id,
            result: {
              uptimeSeconds: Math.floor(process.uptime()),
              rssBytes: mem.rss,
              heapUsedBytes: mem.heapUsed,
              heapTotalBytes: mem.heapTotal,
              activeThreadsCount: threads.size,
              version: "codex-app-server 0.1.0-mock",
              activeModelProvider
            },
            jsonrpc: "2.0"
          });
          return;
        }

        if (method === "model/list") {
          send({ id, result: { models: DEFAULT_POPULAR_MODELS }, jsonrpc: "2.0" });
          return;
        }

        if (method === "skills/list") {
          send({
            id,
            result: {
              skills: SKILLS,
              config: {
                developerInstructions: "You are an autonomous engineering assistant executing commands and writing clean code."
              }
            },
            jsonrpc: "2.0"
          });
          return;
        }

        if (method === "app/list") {
          send({ id, result: { apps: APPS }, jsonrpc: "2.0" });
          return;
        }

        if (method === "account/read") {
          const authStatus = getAccountFromStoredAuth(activeModelProvider);
          const rawAuthDotJson = getRawAuthDotJson(activeModelProvider);

          send({
            id,
            result: {
              account: authStatus.account,
              requiresOpenaiAuth: authStatus.requiresOpenaiAuth,
              authMode: authStatus.authenticated ? (authStatus.account?.type || "chatgpt") : null,
              providerId: activeModelProvider,
              authDotJson: rawAuthDotJson
            },
            jsonrpc: "2.0"
          });
          return;
        }

        if (method === "account/login/start") {
          const loginId = "login_" + Math.random().toString(36).substring(2, 12);
          const authUrl = `http://localhost:${PORT}/auth/oauth-sim?loginId=${loginId}&type=chatgpt&appBrand=Codex`;

          const timer = setTimeout(() => {
            const sess = pendingLoginSessions.get(loginId);
            if (sess) {
              pendingLoginSessions.delete(loginId);
              if (sess.ws && sess.ws.readyState === WebSocket.OPEN) {
                sess.ws.send(
                  JSON.stringify({
                    jsonrpc: "2.0",
                    method: "account/login/completed",
                    params: { success: false, error: "Login session timed out (10 minutes)" }
                  })
                );
              }
            }
          }, 10 * 60 * 1000);

          pendingLoginSessions.set(loginId, {
            loginId,
            type: params?.type || "chatgpt",
            providerId: activeModelProvider,
            ws,
            timer,
            createdAt: Date.now()
          });

          send({
            id,
            result: {
              loginId,
              authUrl,
              type: "chatgpt",
              pollIntervalMs: 2000
            },
            jsonrpc: "2.0"
          });
          return;
        }

        if (method === "account/login/cancel") {
          const loginId = params?.loginId;
          if (loginId && pendingLoginSessions.has(loginId)) {
            const sess = pendingLoginSessions.get(loginId)!;
            clearTimeout(sess.timer);
            pendingLoginSessions.delete(loginId);
          }
          send({
            id,
            result: { success: true },
            jsonrpc: "2.0"
          });
          sendNotification("account/login/completed", {
            success: false,
            error: "Login cancelled by client"
          });
          return;
        }

        if (method === "account/logout") {
          send({ id, result: { success: true }, jsonrpc: "2.0" });
          sendNotification("account/updated", { account: null, requiresOpenaiAuth: true });
          return;
        }

        if (method === "account/rateLimits/read") {
          send({
            id,
            result: {
              rateLimits: {
                primary: {
                  usedPercent: 42,
                  windowDurationMinutes: 60,
                  resetsAt: new Date(Date.now() + 1800000).toISOString()
                },
                secondary: {
                  usedPercent: 18,
                  windowDurationMinutes: 1440,
                  resetsAt: new Date(Date.now() + 43200000).toISOString()
                }
              }
            },
            jsonrpc: "2.0"
          });
          return;
        }

        if (method === "thread/list") {
          const list = Array.from(threads.values()).map((t) => ({
            id: t.id,
            preview: t.preview,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
            recencyAt: t.recencyAt,
            status: t.status,
            model: t.model,
            reasoningEffort: t.reasoningEffort,
            ephemeral: t.ephemeral,
            path: t.path,
            archived: t.archived
          }));
          send({ id, result: { threads: list }, jsonrpc: "2.0" });
          return;
        }

        if (method === "thread/read") {
          const t = threads.get(params.threadId);
          if (!t) {
            send({ id, error: { code: -32602, message: "Thread not found" }, jsonrpc: "2.0" });
            return;
          }
          send({ id, result: { thread: t }, jsonrpc: "2.0" });
          return;
        }

        if (method === "thread/restore") {
          const t = params.thread || threads.get(params.threadId);
          if (t && t.id) {
            threads.set(t.id, t);
            send({ id, result: { success: true, thread: t }, jsonrpc: "2.0" });
          } else {
            send({ id, error: { code: -32602, message: "Thread not found to restore" }, jsonrpc: "2.0" });
          }
          return;
        }

        if (method === "thread/start") {
          const newId = "thr_" + Math.random().toString(36).substring(2, 9);
          const t: ServerThread = {
            id: newId,
            preview: params?.preview || params?.input?.[0]?.text || "New Thread",
            modelProvider: params?.modelProvider || activeModelProvider || "codex-aws",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            recencyAt: Date.now(),
            status: { type: "idle" },
            model: params?.model || "gpt-5.4-codex",
            reasoningEffort: params?.reasoningEffort || "medium",
            ephemeral: !!params?.ephemeral,
            path: params?.cwd || "/workspace/projects/codex-client",
            archived: false,
            turns: []
          };
          threads.set(newId, t);
          send({ id, result: { thread: t }, jsonrpc: "2.0" });
          sendNotification("thread/created", { thread: t });
          return;
        }

        if (method === "thread/resume") {
          const t = threads.get(params.threadId);
          if (!t) {
            send({ id, error: { code: -32602, message: "Thread not found" }, jsonrpc: "2.0" });
            return;
          }
          t.status = { type: "idle" };
          send({ id, result: { thread: t }, jsonrpc: "2.0" });
          return;
        }

        if (method === "thread/fork") {
          const orig = threads.get(params.threadId);
          if (!orig) {
            send({ id, error: { code: -32602, message: "Original thread not found" }, jsonrpc: "2.0" });
            return;
          }
          const forkId = "thr_fork_" + Math.random().toString(36).substring(2, 8);
          const forked: ServerThread = {
            ...orig,
            id: forkId,
            preview: `Fork of ${orig.preview}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            recencyAt: Date.now(),
            turns: JSON.parse(JSON.stringify(orig.turns))
          };
          threads.set(forkId, forked);
          send({ id, result: { thread: forked }, jsonrpc: "2.0" });
          sendNotification("thread/created", { thread: forked });
          return;
        }

        if (method === "thread/archive") {
          const t = threads.get(params.threadId);
          if (t) {
            t.archived = true;
            send({ id, result: { success: true }, jsonrpc: "2.0" });
            sendNotification("thread/status/changed", { threadId: t.id, status: { type: "idle" } });
          } else {
            send({ id, error: { code: -32602, message: "Thread not found" }, jsonrpc: "2.0" });
          }
          return;
        }

        if (method === "thread/unarchive") {
          const t = threads.get(params.threadId);
          if (t) {
            t.archived = false;
            send({ id, result: { success: true }, jsonrpc: "2.0" });
          } else {
            send({ id, error: { code: -32602, message: "Thread not found" }, jsonrpc: "2.0" });
          }
          return;
        }

        if (method === "thread/rollback") {
          const t = threads.get(params.threadId);
          if (t) {
            const numTurns = params.numTurns || 1;
            t.turns = t.turns.slice(0, Math.max(0, t.turns.length - numTurns));
            send({ id, result: { thread: t }, jsonrpc: "2.0" });
          } else {
            send({ id, error: { code: -32602, message: "Thread not found" }, jsonrpc: "2.0" });
          }
          return;
        }

        if (method === "turn/interrupt") {
          activeTurnAbort = true;
          send({ id, result: { success: true }, jsonrpc: "2.0" });
          return;
        }

        if (method === "turn/steer") {
          send({ id, result: { success: true, note: "Prompt guidance injected into active context" }, jsonrpc: "2.0" });
          return;
        }

        if (method === "turn/start") {
          const thread = threads.get(params.threadId);
          if (!thread) {
            send({ id, error: { code: -32602, message: "Thread not found" }, jsonrpc: "2.0" });
            return;
          }

          const turnId = "turn_" + Math.random().toString(36).substring(2, 9);
          const userText = params.input?.[0]?.text || "Run step";

          const userItem = {
            type: "userMessage",
            id: "msg_usr_" + Math.random().toString(36).substring(2, 8),
            content: params.input || [{ type: "text", text: userText }]
          };

          const newTurn: { id: string; status: string; items: any[] } = {
            id: turnId,
            status: "inProgress",
            items: [userItem]
          };

          thread.turns.push(newTurn);
          thread.updatedAt = Date.now();
          thread.recencyAt = Date.now();
          thread.status = { type: "active" };

          send({
            id,
            result: {
              turn: {
                id: turnId,
                status: "inProgress",
                items: [userItem]
              }
            },
            jsonrpc: "2.0"
          });

          sendNotification("turn/started", { turn: newTurn });
          sendNotification("thread/status/changed", { threadId: thread.id, status: thread.status });

          activeTurnAbort = false;

          (async () => {
            const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

            const reasoningItem = {
              type: "reasoning",
              id: "rsn_" + Math.random().toString(36).substring(2, 8),
              summary: "Analyzing prompt intent, inspecting AST, and planning execution steps...",
              content: ""
            };
            newTurn.items.push(reasoningItem);
            sendNotification("item/started", { item: reasoningItem });

            const reasoningThoughts = [
              "Parsing user instruction:\n`" + userText + "`\n",
              "Validating active skills (git-workflow, skill-creator, security-audit)...\n",
              "Determining sandbox environment and permission policies...\n",
              "Synthesizing file diffs and command actions...\n"
            ];

            for (const thought of reasoningThoughts) {
              if (activeTurnAbort) break;
              await sleep(80);
              reasoningItem.content += thought;
              sendNotification("item/reasoning/delta", {
                itemId: reasoningItem.id,
                delta: thought
              });
            }

            sendNotification("item/completed", { item: reasoningItem });

            const isCommandRequest = /run|test|npm|exec|build|install|check|start/i.test(userText);
            const isFileEditRequest = /edit|file|create|write|update|change/i.test(userText);

            if (isCommandRequest && !activeTurnAbort) {
              const cmdItem: {
                type: string;
                id: string;
                command: string;
                cwd: string;
                status: string;
                aggregatedOutput: string;
              } = {
                type: "commandExecution",
                id: "cmd_" + Math.random().toString(36).substring(2, 8),
                command: userText.includes("test") ? "npm test -- --coverage" : "npm run check",
                cwd: thread.path || "/workspace",
                status: "inProgress",
                aggregatedOutput: ""
              };
              newTurn.items.push(cmdItem);
              sendNotification("item/started", { item: cmdItem });

              if (params?.approvalPolicy !== "never") {
                const approvalRes = await sendRequest("item/commandExecution/requestApproval", {
                  itemId: cmdItem.id,
                  threadId: thread.id,
                  turnId,
                  command: cmdItem.command,
                  cwd: cmdItem.cwd,
                  reason: "Execute test runner in sandbox environment",
                  availableDecisions: ["accept", "acceptForSession", "decline", "cancel"]
                });

                sendNotification("serverRequest/resolved", { threadId: thread.id, requestId: "srv_req_approval" });

                if (approvalRes?.decision === "decline" || approvalRes?.decision === "cancel") {
                  cmdItem.status = "declined";
                  cmdItem.aggregatedOutput = "[approval declined by user]";
                  sendNotification("item/completed", { item: cmdItem });
                } else {
                  const deltas = [
                    "> jest --coverage\n",
                    " PASS  src/protocol.test.ts\n",
                    "  ✓ handles JSON-RPC 2.0 requests (12ms)\n",
                    "  ✓ streams agentMessage deltas smoothly (8ms)\n",
                    "  ✓ handles user approval flows (15ms)\n\n",
                    "Test Suites: 1 passed, 1 total\nTests:       3 passed, 3 total\nSnapshots:   0 total\nTime:        0.842 s\n"
                  ];
                  for (const d of deltas) {
                    if (activeTurnAbort) break;
                    await sleep(150);
                    cmdItem.aggregatedOutput += d;
                    sendNotification("item/commandExecution/outputDelta", {
                      itemId: cmdItem.id,
                      stream: "stdout",
                      deltaBase64: Buffer.from(d).toString("base64")
                    });
                  }
                  cmdItem.status = "completed";
                  sendNotification("item/completed", { item: cmdItem });
                }
              } else {
                cmdItem.aggregatedOutput = "PASS 3 tests passed successfully.";
                cmdItem.status = "completed";
                sendNotification("item/completed", { item: cmdItem });
              }
            }

            if (isFileEditRequest && !activeTurnAbort) {
              const fileItem: { type: string; id: string; changes: any[]; status: string } = {
                type: "fileChange",
                id: "file_" + Math.random().toString(36).substring(2, 8),
                changes: [
                  {
                    path: "src/services/chatEngine.ts",
                    kind: "modify",
                    diff: `--- a/src/services/chatEngine.ts\n+++ b/src/services/chatEngine.ts\n@@ -12,4 +12,6 @@\n export function handleMessage(msg: string) {\n-  return parseInput(msg);\n+  const sanitized = sanitize(msg);\n+  return dispatchJsonRpc(sanitized);\n }\n`
                  }
                ],
                status: "inProgress"
              };
              newTurn.items.push(fileItem);
              sendNotification("item/started", { item: fileItem });
              await sleep(300);
              fileItem.status = "completed";
              sendNotification("item/completed", { item: fileItem });
              sendNotification("turn/diff/updated", {
                threadId: thread.id,
                turnId,
                diff: fileItem.changes[0].diff
              });
            }

            if (activeTurnAbort) {
              newTurn.status = "interrupted";
              thread.status = { type: "idle" };
              sendNotification("turn/completed", { turn: newTurn });
              sendNotification("thread/status/changed", { threadId: thread.id, status: thread.status });
              return;
            }

            const agentItem = {
              type: "agentMessage",
              id: "msg_ag_" + Math.random().toString(36).substring(2, 8),
              text: ""
            };
            newTurn.items.push(agentItem);
            sendNotification("item/started", { item: agentItem });

            const sampleResponse =
              `Task executed successfully.\n\n` +
              `### Execution Summary\n` +
              `- **Protocol**: JSON-RPC 2.0 streaming via WebSocket\n` +
              `- **Thread**: \`${thread.id}\`\n` +
              `- **Model**: \`${thread.model}\` (${thread.reasoningEffort} reasoning)\n\n` +
              `\`\`\`typescript\n` +
              `// JSON-RPC 2.0 message envelope\n` +
              `const response = await wsClient.request("turn/start", {\n` +
              `  threadId: "${thread.id}",\n` +
              `  input: [{ type: "text", text: "${userText.slice(0, 30)}" }]\n` +
              `});\n` +
              `\`\`\`\n\n` +
              `The active turn is now complete and ready for your next prompt.`;

            const chunks = sampleResponse.match(/.{1,12}/gs) || [sampleResponse];
            for (const chunk of chunks) {
              if (activeTurnAbort) break;
              await sleep(35);
              agentItem.text += chunk;
              sendNotification("item/agentMessage/delta", {
                itemId: agentItem.id,
                delta: chunk
              });
            }

            sendNotification("item/completed", { item: agentItem });

            sendNotification("thread/tokenUsage/updated", {
              threadId: thread.id,
              tokenUsage: {
                totalTokens: 1420,
                inputTokens: 680,
                outputTokens: 740,
                reasoningTokens: 210
              }
            });

            newTurn.status = activeTurnAbort ? "interrupted" : "completed";
            thread.status = { type: "idle" };

            sendNotification("turn/completed", { turn: newTurn });
            sendNotification("thread/status/changed", { threadId: thread.id, status: thread.status });
          })();

          return;
        }

        send({ id, error: { code: -32601, message: `Method '${method}' not implemented in mock engine` }, jsonrpc: "2.0" });
      } catch (err: any) {
        send({ error: { code: -32700, message: "Parse error: " + err.message }, jsonrpc: "2.0" });
      }
    });

    ws.on("close", () => {
      connectedClients.delete(ws);
    });
  });

  // 10. Vite Dev Middleware / Static Production Assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`=======================================================`);
    console.log(` Codex Bridge & Server unified on http://0.0.0.0:${PORT}`);
    console.log(` REST API + WebSocket (/ws) active with full persistence`);
    console.log(`=======================================================`);
  });
}

// Auto-run if executed directly
if (process.argv[1] && (process.argv[1].endsWith("codex-bridge.ts") || process.argv[1].endsWith("codex-bridge.js"))) {
  startServer();
}
