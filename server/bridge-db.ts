import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

export interface ServerRecord {
  id: string;
  codex_home: string;
  listen_port: number;
  listen_addr: string;
  pid: number | null;
  status: "running" | "stopped" | "failed";
  model_provider: string;
  created_at: string;
  updated_at: string;
  last_log: string;
}

export interface ThreadConfigRecord {
  id: string;
  name: string;
  model_provider: string;
  model: string;
  cwd: string;
  approval_policy: string;
  approvals_reviewer: string;
  config_json: string;
  service_name: string;
  base_instructions: string;
  developer_instructions: string;
  personality: string;
  ephemeral: number;
  session_start_source: string;
  created_at: string;
  updated_at: string;
}

export interface AuthSessionRecord {
  id: string;
  account_type: string;
  codex_home: string;
  status: "pending" | "completed" | "cancelled" | "failed" | "logged_out";
  login_url: string;
  account_info_json: string;
  created_at: string;
  updated_at: string;
}

export interface OperationLogRecord {
  id: number;
  action: string;
  details: string;
  created_at: string;
}

class BridgeDatabase {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    const defaultDir = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
    const resolvedPath = dbPath || path.join(defaultDir, "codex-bridge.sqlite");
    this.db = new DatabaseSync(resolvedPath);
    this.initTables();
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        codex_home TEXT NOT NULL,
        listen_port INTEGER NOT NULL,
        listen_addr TEXT NOT NULL,
        pid INTEGER,
        status TEXT NOT NULL,
        model_provider TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_log TEXT
      );

      CREATE TABLE IF NOT EXISTS thread_configs (
        id TEXT PRIMARY KEY,
        name TEXT,
        model_provider TEXT NOT NULL,
        model TEXT NOT NULL,
        cwd TEXT,
        approval_policy TEXT,
        approvals_reviewer TEXT,
        config_json TEXT,
        service_name TEXT,
        base_instructions TEXT,
        developer_instructions TEXT,
        personality TEXT,
        ephemeral INTEGER DEFAULT 0,
        session_start_source TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        account_type TEXT NOT NULL,
        codex_home TEXT NOT NULL,
        status TEXT NOT NULL,
        login_url TEXT,
        account_info_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  // --- Servers CRUD ---
  public upsertServer(server: ServerRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO servers (
        id, codex_home, listen_port, listen_addr, pid, status, model_provider, created_at, updated_at, last_log
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        codex_home = excluded.codex_home,
        listen_port = excluded.listen_port,
        listen_addr = excluded.listen_addr,
        pid = excluded.pid,
        status = excluded.status,
        model_provider = excluded.model_provider,
        updated_at = excluded.updated_at,
        last_log = excluded.last_log
    `);

    stmt.run(
      server.id,
      server.codex_home,
      server.listen_port,
      server.listen_addr,
      server.pid,
      server.status,
      server.model_provider,
      server.created_at,
      server.updated_at,
      server.last_log || ""
    );
  }

  public getServer(id: string): ServerRecord | null {
    const stmt = this.db.prepare("SELECT * FROM servers WHERE id = ?");
    const res = stmt.get(id);
    return (res as unknown as ServerRecord) || null;
  }

  public getServerByPort(port: number): ServerRecord | null {
    const stmt = this.db.prepare("SELECT * FROM servers WHERE listen_port = ?");
    const res = stmt.get(port);
    return (res as unknown as ServerRecord) || null;
  }

  public getServerByHome(codexHome: string): ServerRecord | null {
    const stmt = this.db.prepare("SELECT * FROM servers WHERE codex_home = ?");
    const res = stmt.get(codexHome);
    return (res as unknown as ServerRecord) || null;
  }

  public getServerByProvider(provider: string): ServerRecord | null {
    const stmt = this.db.prepare("SELECT * FROM servers WHERE model_provider = ?");
    const res = stmt.get(provider);
    return (res as unknown as ServerRecord) || null;
  }

  public listServers(): ServerRecord[] {
    const stmt = this.db.prepare("SELECT * FROM servers ORDER BY updated_at DESC");
    return (stmt.all() as unknown as ServerRecord[]) || [];
  }

  public updateServerStatus(id: string, status: ServerRecord["status"], pid: number | null, lastLog?: string): void {
    const now = new Date().toISOString();
    if (lastLog !== undefined) {
      const stmt = this.db.prepare(`
        UPDATE servers SET status = ?, pid = ?, last_log = ?, updated_at = ? WHERE id = ?
      `);
      stmt.run(status, pid, lastLog, now, id);
    } else {
      const stmt = this.db.prepare(`
        UPDATE servers SET status = ?, pid = ?, updated_at = ? WHERE id = ?
      `);
      stmt.run(status, pid, now, id);
    }
  }

  public deleteServer(id: string): void {
    const stmt = this.db.prepare("DELETE FROM servers WHERE id = ?");
    stmt.run(id);
  }

  // --- Thread Configs CRUD ---
  public saveThreadConfig(config: ThreadConfigRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO thread_configs (
        id, name, model_provider, model, cwd, approval_policy, approvals_reviewer,
        config_json, service_name, base_instructions, developer_instructions,
        personality, ephemeral, session_start_source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        model_provider = excluded.model_provider,
        model = excluded.model,
        cwd = excluded.cwd,
        approval_policy = excluded.approval_policy,
        approvals_reviewer = excluded.approvals_reviewer,
        config_json = excluded.config_json,
        service_name = excluded.service_name,
        base_instructions = excluded.base_instructions,
        developer_instructions = excluded.developer_instructions,
        personality = excluded.personality,
        ephemeral = excluded.ephemeral,
        session_start_source = excluded.session_start_source,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      config.id,
      config.name,
      config.model_provider,
      config.model,
      config.cwd,
      config.approval_policy,
      config.approvals_reviewer,
      config.config_json,
      config.service_name,
      config.base_instructions,
      config.developer_instructions,
      config.personality,
      config.ephemeral,
      config.session_start_source,
      config.created_at,
      config.updated_at
    );
  }

  public listThreadConfigs(limit = 20): ThreadConfigRecord[] {
    const stmt = this.db.prepare("SELECT * FROM thread_configs ORDER BY updated_at DESC LIMIT ?");
    return (stmt.all(limit) as unknown as ThreadConfigRecord[]) || [];
  }

  public getLatestThreadConfig(): ThreadConfigRecord | null {
    const stmt = this.db.prepare("SELECT * FROM thread_configs ORDER BY updated_at DESC LIMIT 1");
    const res = stmt.get();
    return (res as unknown as ThreadConfigRecord) || null;
  }

  // --- Auth Sessions CRUD ---
  public saveAuthSession(session: AuthSessionRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO auth_sessions (
        id, account_type, codex_home, status, login_url, account_info_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        login_url = excluded.login_url,
        account_info_json = excluded.account_info_json,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      session.id,
      session.account_type,
      session.codex_home,
      session.status,
      session.login_url,
      session.account_info_json,
      session.created_at,
      session.updated_at
    );
  }

  public getAuthSession(id: string): AuthSessionRecord | null {
    const stmt = this.db.prepare("SELECT * FROM auth_sessions WHERE id = ?");
    const res = stmt.get(id);
    return (res as unknown as AuthSessionRecord) || null;
  }

  public getLatestAuthSessionForType(accountType: string): AuthSessionRecord | null {
    const stmt = this.db.prepare("SELECT * FROM auth_sessions WHERE account_type = ? ORDER BY updated_at DESC LIMIT 1");
    const res = stmt.get(accountType);
    return (res as unknown as AuthSessionRecord) || null;
  }

  // --- Operation Logs ---
  public logOperation(action: string, details: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO operation_logs (action, details, created_at) VALUES (?, ?, ?)
    `);
    const detailsStr = typeof details === "string" ? details : JSON.stringify(details);
    stmt.run(action, detailsStr, new Date().toISOString());
  }

  public listLogs(limit = 50): OperationLogRecord[] {
    const stmt = this.db.prepare("SELECT * FROM operation_logs ORDER BY id DESC LIMIT ?");
    return (stmt.all(limit) as unknown as OperationLogRecord[]) || [];
  }
}

export const bridgeDb = new BridgeDatabase();
