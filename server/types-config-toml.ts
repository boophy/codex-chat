export type SandboxMode = "read_only" | "workspace_write" | "danger_full_access";

export type AskForApproval =
  | "untrusted"
  | "on-request"
  | "always"
  | "never"
  | {
      granular: {
        sandbox_approval: boolean;
        rules: boolean;
        skill_approval: boolean;
        request_permissions: boolean;
        mcp_elicitations: boolean;
      };
    };

export type ApprovalsReviewer = "user" | "auto_review" | "guardian_subagent";

export type AutoCompactTokenLimitScope = "full_context" | "after_prefix";

export type Personality = "none" | "friendly" | "pragmatic" | "thoughtful" | "concise";

export type WebSearchMode = "disabled" | "cached" | "indexed" | "live";

export type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";

export type Verbosity = "low" | "medium" | "high";

export interface ModelProviderInfo {
  name: string;
  baseUrl?: string | null;
  apiKeyEnv?: string | null;
  auth?: {
    command?: string;
  } | null;
  aws?: {
    region?: string;
    profile?: string;
  } | null;
}

export interface WebSearchToolConfig {
  mode?: WebSearchMode;
  maxResults?: number;
}

export interface ToolsToml {
  web_search?: WebSearchToolConfig | null;
  experimental_request_user_input?: { enabled: boolean } | null;
  update_plan?: { enabled: boolean } | null;
}

export interface FeaturesToml {
  multi_agent_v2?: boolean;
  unified_exec?: boolean;
  web_search?: boolean;
  memories?: boolean;
  [key: string]: boolean | undefined;
}

export interface AgentsToml {
  enabled?: boolean;
  max_concurrent_threads_per_session?: number;
  max_depth?: number;
  default_subagent_model?: string;
  default_subagent_reasoning_effort?: ReasoningEffort;
  interrupt_message?: boolean;
}

/**
 * Full representation of ConfigToml from Codex rust codebase (config_toml.rs)
 */
export interface ConfigToml {
  model?: string | null;
  review_model?: string | null;
  model_provider?: string | null;
  model_context_window?: number | null;
  model_auto_compact_token_limit?: number | null;
  model_auto_compact_token_limit_scope?: AutoCompactTokenLimitScope | null;
  approval_policy?: AskForApproval | null;
  approvals_reviewer?: ApprovalsReviewer | null;
  allow_login_shell?: boolean | null;
  sandbox_mode?: SandboxMode | null;
  default_permissions?: string | null;
  instructions?: string | null;
  developer_instructions?: string | null;
  compact_prompt?: string | null;
  model_providers?: Record<string, ModelProviderInfo>;
  project_doc_max_bytes?: number | null;
  tool_output_token_limit?: number | null;
  model_reasoning_effort?: ReasoningEffort | null;
  personality?: Personality | null;
  service_tier?: string | null;
  openai_base_url?: string | null;
  web_search?: WebSearchMode | null;
  tools?: ToolsToml | null;
  agents?: AgentsToml | null;
  features?: FeaturesToml | null;
  oss_provider?: string | null;
  check_for_update_on_startup?: boolean | null;
  disable_paste_burst?: boolean | null;
  /** Support dynamic arbitrary key: JsonValue fields configured by the user */
  [key: string]: any;
}
