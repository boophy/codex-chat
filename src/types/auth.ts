import { AccountInfo as ProtocolAccountInfo } from "./protocol";

export type AuthMode =
  | "apikey"
  | "chatgpt"
  | "chatgptAuthTokens"
  | "headers"
  | "agentIdentity"
  | "personalAccessToken"
  | "bedrockApiKey"
  | "bedrockAccessKeys";

export type PlanType =
  | "free"
  | "go"
  | "plus"
  | "pro"
  | "prolite"
  | "team"
  | "self_serve_business_prolite"
  | "self_serve_business_usage_based"
  | "business"
  | "ent26"
  | "enterprise_cbp_automation"
  | "enterprise_cbp_usage_based"
  | "enterprise"
  | "edu"
  | "edu_plus"
  | "edu_pro"
  | "unknown";

export interface TokenData {
  id_token: string;
  access_token: string;
  refresh_token?: string | null;
  account_id?: string | null;
}

export interface AgentIdentityStorage {
  agent_runtime_id?: string | null;
  agent_private_key?: string | null;
  account_id?: string | null;
  chatgpt_user_id?: string | null;
  email?: string | null;
  name?: string | null;
  plan_type?: string | null;
  [key: string]: any;
}

export interface BedrockApiKeyAuth {
  api_key: string;
  [key: string]: any;
}

export interface BedrockAccessKeysAuth {
  access_key_id: string;
  secret_access_key: string;
  region?: string | null;
  session_token?: string | null;
  [key: string]: any;
}

/**
 * Rust struct AuthDotJson (codex-rs):
 * pub struct AuthDotJson {
 *     pub auth_mode: Option<AuthMode>,
 *     pub openai_api_key: Option<String>,      // serialized as "OPENAI_API_KEY"
 *     pub tokens: Option<TokenData>,
 *     pub last_refresh: Option<DateTime<Utc>>,
 *     pub agent_identity: Option<AgentIdentityStorage>,
 *     pub personal_access_token: Option<String>,
 *     pub bedrock_api_key: Option<BedrockApiKeyAuth>,
 *     pub bedrock_access_keys: Option<BedrockAccessKeysAuth>,
 * }
 */
export interface AuthDotJson {
  auth_mode?: string | null;
  OPENAI_API_KEY?: string | null;
  tokens?: TokenData | null;
  last_refresh?: string | null;
  agent_identity?: AgentIdentityStorage | null;
  personal_access_token?: string | null;
  bedrock_api_key?: BedrockApiKeyAuth | null;
  bedrock_access_keys?: BedrockAccessKeysAuth | null;
  [key: string]: any;
}

export interface AccountInfo {
  type: string;
  email?: string | null;
  name?: string | null;
  planType?: string | null;
  plan_type?: string | null;
  accountId?: string | null;
  account_id?: string | null;
  [key: string]: any;
}

export interface AccountStatusResult {
  authenticated?: boolean;
  isLoggedIn?: boolean;
  account: AccountInfo | null;
  requiresOpenaiAuth?: boolean;
  authMode?: string | null;
  providerId?: string | null;
  authDotJson?: AuthDotJson | null;
  tokenValid?: boolean;
  codexHome?: string;
  error?: string | null;
  lastRefresh?: string | null;
  [key: string]: any;
}


export interface StartLoginOptions {
  type?: "chatgpt" | string;
  appBrand?: "codex" | "chatgpt" | string;
  codexStreamlinedLogin?: boolean;
  useHostedLoginSuccessPage?: boolean;
  providerId?: string;
  [key: string]: any;
}

export type AuthStepState =
  | "idle"
  | "switching_server"
  | "checking"
  | "starting"
  | "waiting_browser"
  | "success"
  | "error";

export interface AccountReadResponse {
  account: AccountInfo | null;
  requiresOpenaiAuth: boolean;
  authMode?: string | null;
  providerId?: string;
  authDotJson?: AuthDotJson | null;
}

export interface AccountLoginStartParams {
  type: "chatgpt" | string;
  providerId?: string;
  appBrand?: string;
  codexStreamlinedLogin?: boolean;
  useHostedLoginSuccessPage?: boolean;
  [key: string]: any;
}

export interface AccountLoginStartResponse {
  loginId: string;
  authUrl: string;
  loginUrl?: string;
}

export interface AccountLoginCompletedParams {
  success: boolean;
  authMode?: AuthMode | string;
  error?: string;
}

export interface AccountUpdatedParams {
  account: AccountInfo | null;
  authMode?: AuthMode | string;
  requiresOpenaiAuth?: boolean;
  authDotJson?: AuthDotJson | null;
}

export interface AccountLoginCancelParams {
  loginId?: string;
  [key: string]: any;
}
