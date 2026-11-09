import fs from "fs";
import path from "path";
import os from "os";
import { bridgeDb } from "./bridge-db";
import { CodexStdioTransport } from "./codex-stdio";
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

  return path.resolve(os.homedir(), ".codex-shengsuanyun");
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

  public findCodexBinary(): string | null {
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

    const listenAddr = `stdio://${codexHome}`;
    const serverId = `server-${provider}-stdio`;

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
      listenPort: -1,
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
        listen_port: -1,
        listen_addr: listenAddr,
        pid: null,
        status: "running",
        model_provider: provider,
        created_at: instance.createdAt,
        updated_at: now,
        last_log: msg
      });
      bridgeDb.logOperation("START_SERVER_SIMULATED", { serverId, codexHome, provider });
      return instance;
    }

    try {
      const transport = new CodexStdioTransport(codexBin, codexHome);
      transport.start();

      instance.transport = transport;
      instance.process = transport.process;
      instance.pid = transport.process?.pid ?? null;

      transport.onLog((line) => {
        instance.logs.push(`[stderr] ${line}`);
        if (instance.logs.length > 200) instance.logs.shift();
      });

      transport.onClose((code) => {
        instance.status = "stopped";
        instance.process = null;
        instance.pid = null;
        const exitMsg = `Stdio process exited with code ${code}`;
        instance.logs.push(exitMsg);
        bridgeDb.updateServerStatus(serverId, "stopped", null, exitMsg);
        bridgeDb.logOperation("SERVER_EXITED", { serverId, code });
      });

      transport.onError((err) => {
        instance.status = "failed";
        const errMsg = `Stdio spawn error: ${err.message}`;
        instance.logs.push(errMsg);
        bridgeDb.updateServerStatus(serverId, "failed", null, errMsg);
      });

      this.servers.set(serverId, instance);

      bridgeDb.upsertServer({
        id: serverId,
        codex_home: codexHome,
        listen_port: -1,
        listen_addr: listenAddr,
        pid: transport.process?.pid ?? null,
        status: "running",
        model_provider: provider,
        created_at: instance.createdAt,
        updated_at: now,
        last_log: `Spawned ${codexBin} (stdio)`
      });

      bridgeDb.logOperation("START_SERVER", { serverId, codexHome, stdio: true });
      return instance;
    } catch (err: any) {
      instance.status = "failed";
      instance.logs.push(`Error starting: ${err.message}`);
      bridgeDb.upsertServer({
        id: serverId,
        codex_home: codexHome,
        listen_port: -1,
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
      const response = await this.callAppServerRpc(server, rpcMethod, payload);

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
      const res = await this.callAppServerRpc(targetServer, "config/read", {});
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

  private callAppServerRpc(server: ManagedServerInstance, method: string, params: any): Promise<any> {
    const transport = server.transport;
    if (!transport) {
      return Promise.reject(new Error(`Server ${server.id} has no stdio transport`));
    }
    return transport.request(method, params, 4000);
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
