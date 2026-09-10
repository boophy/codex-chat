export interface ManagedServerInstance {
  id: string;
  codexHome: string;
  listenPort: number;
  listenAddr: string;
  modelProvider: string;
  process?: any;
  pid: number | null;
  status: "running" | "stopped" | "failed";
  createdAt: string;
  updatedAt: string;
  logs: string[];
}

export interface StartServerOptions {
  codexHome?: string;
  listenPort?: number;
  modelProvider?: string;
  forceRestart?: boolean;
}

export interface EnsureThreadServerParams {
  modelProvider?: string | null;
  codexHome?: string | null;
  model?: string | null;
}

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

export interface ServerThread {
  id: string;
  preview: string;
  modelProvider: string;
  createdAt: number;
  updatedAt: number;
  recencyAt: number;
  status: { type: "idle" | "active" | "notLoaded"; activeFlags?: string[] };
  model: string;
  reasoningEffort: string;
  ephemeral: boolean;
  path: string | null;
  archived: boolean;
  turns: any[];
}
