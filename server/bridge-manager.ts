import fs from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { WebSocket } from "ws";
import { bridgeDb } from "./bridge-db";
import { ServerRecord, ConfigToml, ManagedServerInstance, StartServerOptions, EnsureThreadServerParams } from "../src/types";

export type {
  ManagedServerInstance,
  StartServerOptions,
  EnsureThreadServerParams
};

export function resolveCodexHome(inputPath?: string | null, fallbackProvider?: string | null): string {
  if (inputPath && inputPath.trim()) {
    let p = inputPath.trim();
    if (p.startsWith("~")) {
      p = path.join(os.homedir(), p.slice(1));
    }
    return path.resolve(p);
  }

  if (fallbackProvider && fallbackProvider.trim()) {
    const clean = fallbackProvider.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    return path.resolve(os.homedir(), `.${clean}`);
  }

  return path.resolve(os.homedir(), ".codex-aws");
}

export function extractProviderFromHome(resolvedPath: string): string {
  const base = path.basename(resolvedPath);
  if (base.startsWith(".")) {
    return base.slice(1);
  }
  return base || "shengsuanyun";
}

class BridgeManager {
  private servers = new Map<string, ManagedServerInstance>();
  private defaultPortCounter = 8080;

  constructor() {
    this.restoreFromDb();
  }

  private restoreFromDb() {
    try {
      const records = bridgeDb.listServers();
      for (const rec of records) {
        this.servers.set(rec.id, {
          id: rec.id,
          codexHome: rec.codex_home,
          listenPort: rec.listen_port,
          listenAddr: rec.listen_addr,
          modelProvider: rec.model_provider,
          process: null,
          pid: null,
          status: "stopped",
          createdAt: rec.created_at,
          updatedAt: rec.updated_at,
          logs: rec.last_log ? [rec.last_log] : []
        });
      }
    } catch (err: any) {
      console.warn("[BridgeManager] Failed to restore servers from DB:", err.message);
    }
  }

  private findCodexBinary(): string | null {
    const bin = ['codex','cdx','codex-app-server','cds']
    const candidates = [
      path.resolve(process.cwd()),
      path.resolve(process.cwd(), "target", "debug"),
      path.resolve(process.cwd(), "target", "release"),
      path.resolve(os.homedir(), ".cargo", "bin"),
      path.resolve(os.homedir(), "prj"),
      "/usr/local/bin",
      "/usr/bin"
    ];

    for (const c of candidates) {
      for (const b of bin) {
        const fullPath = path.join(c, b);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          try {
            fs.accessSync(fullPath, fs.constants.X_OK);
            return fullPath;
          } catch {
            // not executable
          }
        }
      }
    }
    return null;
  }

  public async startServer(options: StartServerOptions): Promise<ManagedServerInstance> {
    const provider = options.modelProvider || (options.codexHome ? extractProviderFromHome(options.codexHome) : "shengsuanyun");
    const codexHome = resolveCodexHome(options.codexHome, provider);

    // 1. Ensure directory exists
    if (!fs.existsSync(codexHome)) {
      fs.mkdirSync(codexHome, { recursive: true });
      bridgeDb.logOperation("CREATE_CODEX_HOME", { codexHome, provider });
    }

    const port = options.listenPort || this.allocatePort(codexHome);
    const listenAddr = `ws://127.0.0.1:${port}`;
    const serverId = `server-${provider}-${port}`;

    // Check if already running on that port or serverId
    const existing = this.servers.get(serverId);
    if (existing && existing.status === "running" && existing.process && !options.forceRestart) {
      return existing;
    }

    if (existing && existing.process) {
      await this.stopServer(serverId);
    }

    const codexBin = this.findCodexBinary();
    const now = new Date().toISOString();

    const instance: ManagedServerInstance = {
      id: serverId,
      codexHome,
      listenPort: port,
      listenAddr,
      modelProvider: provider,
      process: null,
      pid: null,
      status: "running",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      logs: []
    };

    if (!codexBin) {
      const msg = `[Codex binary not found] Simulation mode started for CODEX_HOME=${codexHome}, provider=${provider}, listen=${listenAddr}`;
      instance.logs.push(msg);
      instance.status = "running";
      this.servers.set(serverId, instance);

      bridgeDb.upsertServer({
        id: serverId,
        codex_home: codexHome,
        listen_port: port,
        listen_addr: listenAddr,
        pid: null,
        status: "running",
        model_provider: provider,
        created_at: instance.createdAt,
        updated_at: now,
        last_log: msg
      });
      bridgeDb.logOperation("START_SERVER_SIMULATED", { serverId, codexHome, port, provider });
      return instance;
    }

    try {
      const child = spawn(
        codexBin,
        ["app-server", "--listen", listenAddr],
        {
          env: {
            ...process.env,
            CODEX_HOME: codexHome
          },
          stdio: ["pipe", "pipe", "pipe"],
          detached: false
        }
      );

      instance.process = child;
      instance.pid = child.pid || null;

      child.stdout?.on("data", (data) => {
        const text = data.toString();
        instance.logs.push(`[stdout] ${text}`);
        if (instance.logs.length > 200) instance.logs.shift();
      });

      child.stderr?.on("data", (data) => {
        const text = data.toString();
        instance.logs.push(`[stderr] ${text}`);
        if (instance.logs.length > 200) instance.logs.shift();
      });

      child.on("close", (code) => {
        instance.status = "stopped";
        instance.process = null;
        instance.pid = null;
        const exitMsg = `Process exited with code ${code}`;
        instance.logs.push(exitMsg);
        bridgeDb.updateServerStatus(serverId, "stopped", null, exitMsg);
        bridgeDb.logOperation("SERVER_EXITED", { serverId, code });
      });

      child.on("error", (err) => {
        instance.status = "failed";
        const errMsg = `Spawn error: ${err.message}`;
        instance.logs.push(errMsg);
        bridgeDb.updateServerStatus(serverId, "failed", null, errMsg);
      });

      this.servers.set(serverId, instance);

      bridgeDb.upsertServer({
        id: serverId,
        codex_home: codexHome,
        listen_port: port,
        listen_addr: listenAddr,
        pid: child.pid || null,
        status: "running",
        model_provider: provider,
        created_at: instance.createdAt,
        updated_at: now,
        last_log: `Spawned ${codexBin} (PID ${child.pid})`
      });

      bridgeDb.logOperation("START_SERVER", { serverId, codexHome, port, pid: child.pid });
      return instance;
    } catch (err: any) {
      instance.status = "failed";
      instance.logs.push(`Error starting: ${err.message}`);
      bridgeDb.upsertServer({
        id: serverId,
        codex_home: codexHome,
        listen_port: port,
        listen_addr: listenAddr,
        pid: null,
        status: "failed",
        model_provider: provider,
        created_at: instance.createdAt,
        updated_at: now,
        last_log: err.message
      });
      throw err;
    }
  }

  public async stopServer(id: string): Promise<boolean> {
    const instance = this.servers.get(id);
    if (!instance) return false;

    if (instance.process && !instance.process.killed) {
      try {
        instance.process.kill("SIGTERM");
      } catch (err: any) {
        console.warn(`Failed to kill process for server ${id}:`, err.message);
      }
    }

    instance.status = "stopped";
    instance.process = null;
    instance.pid = null;
    instance.updatedAt = new Date().toISOString();

    bridgeDb.updateServerStatus(id, "stopped", null, "Stopped by user request");
    bridgeDb.logOperation("STOP_SERVER", { id });
    return true;
  }

  public listServers(): ServerRecord[] {
    // Return synced state
    return Array.from(this.servers.values()).map((s) => ({
      id: s.id,
      codex_home: s.codexHome,
      listen_port: s.listenPort,
      listen_addr: s.listenAddr,
      pid: s.pid,
      status: s.status,
      model_provider: s.modelProvider,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
      last_log: s.logs.slice(-1)[0] || ""
    }));
  }

  public getServer(id: string): (ServerRecord & { logs: string[] }) | null {
    const instance = this.servers.get(id);
    if (!instance) {
      const fromDb = bridgeDb.getServer(id);
      if (!fromDb) return null;
      return { ...fromDb, logs: [fromDb.last_log || ""] };
    }
    return {
      id: instance.id,
      codex_home: instance.codexHome,
      listen_port: instance.listenPort,
      listen_addr: instance.listenAddr,
      pid: instance.pid,
      status: instance.status,
      model_provider: instance.modelProvider,
      created_at: instance.createdAt,
      updated_at: instance.updatedAt,
      last_log: instance.logs.slice(-1)[0] || "",
      logs: instance.logs
    };
  }

  /**
   * Determine whether a codex app-server needs to be started or reused for the requested thread parameters.
   */
  public async ensureServerForThread(params: EnsureThreadServerParams): Promise<ManagedServerInstance> {
    const provider = (params.modelProvider && params.modelProvider.trim()) || "shengsuanyun";
    const targetHome = resolveCodexHome(params.codexHome, provider);

    // Look for an existing running server matching this codexHome or modelProvider
    for (const inst of this.servers.values()) {
      if (inst.status === "running" && (inst.codexHome === targetHome || inst.modelProvider === provider)) {
        return inst;
      }
    }

    // Start a new server instance for this provider & CODEX_HOME
    return await this.startServer({
      codexHome: targetHome,
      modelProvider: provider
    });
  }

  /**
   * Account authentication support:
   * First starts the app-server with CODEX_HOME derived from accountType,
   * then conducts login/logout/read operations via WebSocket RPC.
   */
  public async handleAccountAction(action: "start" | "cancel" | "logout" | "read", payload: any): Promise<any> {
    const accountType = payload?.type || "chatgpt";
    const codexHome = resolveCodexHome(payload?.codexHome, accountType);

    // 1. Ensure server is started for this account type
    const server = await this.ensureServerForThread({
      modelProvider: accountType,
      codexHome
    });

    const sessionId = `auth-${accountType}-${Date.now()}`;

    // RPC dispatch over WebSocket
    const rpcMethodMap: Record<string, string> = {
      start: "account/login/start",
      cancel: "account/login/cancel",
      logout: "account/logout",
      read: "account/read"
    };

    const rpcMethod = rpcMethodMap[action];
    bridgeDb.logOperation(`ACCOUNT_${action.toUpperCase()}`, { accountType, codexHome, serverId: server.id });

    try {
      const response = await this.callAppServerRpc(server.listenAddr, rpcMethod, payload);

      if (action === "start") {
        bridgeDb.saveAuthSession({
          id: sessionId,
          account_type: accountType,
          codex_home: codexHome,
          status: "pending",
          login_url: response?.url || response?.loginUrl || "",
          account_info_json: JSON.stringify(response || {}),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } else if (action === "logout") {
        bridgeDb.saveAuthSession({
          id: sessionId,
          account_type: accountType,
          codex_home: codexHome,
          status: "logged_out",
          login_url: "",
          account_info_json: "{}",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      return {
        success: true,
        serverId: server.id,
        listenAddr: server.listenAddr,
        codexHome,
        data: response
      };
    } catch (err: any) {
      // Fallback simulation when real app-server is not responding or in simulation mode
      const simResult = this.simulateAccountResponse(action, accountType, codexHome);
      bridgeDb.saveAuthSession({
        id: sessionId,
        account_type: accountType,
        codex_home: codexHome,
        status: action === "logout" ? "logged_out" : "completed",
        login_url: simResult?.url || "",
        account_info_json: JSON.stringify(simResult),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      return {
        success: true,
        simulated: true,
        serverId: server.id,
        listenAddr: server.listenAddr,
        codexHome,
        data: simResult
      };
    }
  }

  /**
   * ConfigManager::read RPC caller
   */
  public async readConfigToml(serverIdOrProvider?: string): Promise<ConfigToml> {
    let targetServer: ManagedServerInstance | undefined;
    if (serverIdOrProvider) {
      targetServer = this.servers.get(serverIdOrProvider);
      if (!targetServer) {
        for (const s of this.servers.values()) {
          if (s.modelProvider === serverIdOrProvider) {
            targetServer = s;
            break;
          }
        }
      }
    }
    if (!targetServer) {
      targetServer = Array.from(this.servers.values()).find((s) => s.status === "running");
    }

    if (!targetServer) {
      return this.getDefaultConfigToml();
    }

    try {
      const res = await this.callAppServerRpc(targetServer.listenAddr, "config/read", {});
      return (res?.config || res) as ConfigToml;
    } catch {
      return this.getDefaultConfigToml(targetServer.modelProvider);
    }
  }

  public getDefaultConfigToml(provider = "shengsuanyun"): ConfigToml {
    return {
      model: "gpt-5",
      model_provider: provider,
      model_context_window: 128000,
      model_auto_compact_token_limit: 80000,
      model_auto_compact_token_limit_scope: "after_prefix",
      approval_policy: "on-request",
      approvals_reviewer: "user",
      allow_login_shell: true,
      sandbox_mode: "workspace_write",
      instructions: "You are an expert AI software engineer.",
      developer_instructions: "",
      personality: "pragmatic",
      web_search: "live",
      tools: {
        web_search: { mode: "live", maxResults: 10 },
        experimental_request_user_input: { enabled: true },
        update_plan: { enabled: true }
      },
      features: {
        multi_agent_v2: true,
        unified_exec: true
      },
      model_providers: {
        [provider]: {
          name: provider,
          baseUrl: "https://api.openai.com/v1"
        }
      }
    };
  }

  private allocatePort(codexHome: string): number {
    // Check if an existing server already had a port assigned
    for (const s of this.servers.values()) {
      if (s.codexHome === codexHome) {
        return s.listenPort;
      }
    }
    const usedPorts = new Set(Array.from(this.servers.values()).map((s) => s.listenPort));
    let port = this.defaultPortCounter;
    while (usedPorts.has(port)) {
      port += 1;
    }
    return port;
  }

  private callAppServerRpc(wsUrl: string, method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, { origin: undefined });
      const timer = setTimeout(() => {
        try {
          ws.close();
        } catch {}
        reject(new Error(`Timeout calling RPC ${method} on ${wsUrl}`));
      }, 4000);

      const reqId = "bridge-rpc-" + Math.random().toString(36).slice(2, 9);

      ws.on("open", () => {
        ws.send(JSON.stringify({
          jsonrpc: "2.0",
          id: reqId,
          method,
          params
        }));
      });

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.id === reqId) {
            clearTimeout(timer);
            ws.close();
            if (msg.error) {
              reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            } else {
              resolve(msg.result);
            }
          }
        } catch (e) {
          // ignore stream noise
        }
      });

      ws.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  private simulateAccountResponse(action: string, accountType: string, codexHome: string): any {
    switch (action) {
      case "start":
        return {
          type: accountType,
          status: "pending",
          url: `https://auth.openai.com/codex-login?type=${encodeURIComponent(accountType)}&source=bridge`,
          codexHome
        };
      case "cancel":
        return { success: true, message: "Login cancelled" };
      case "logout":
        return { success: true, message: "Successfully logged out" };
      case "read":
      default:
        return {
          account: {
            type: accountType,
            email: `user@${accountType}.provider`,
            name: `${accountType} User`,
            planType: "pro",
            authenticated: true
          }
        };
    }
  }
}

export const bridgeManager = new BridgeManager();
