export type SandboxMode =
  | "read_only"
  | "workspace_write"
  | "danger_full_access"
  | "read-only"
  | "workspace-write"
  | "danger-full-access";

export type AskForApproval =
  | "untrusted"
  | "on-request"
  | "always"
  | "never"
  | {
      granular: {
        sandbox_approval?: boolean;
        rules?: boolean;
        skill_approval?: boolean;
        request_permissions?: boolean;
        mcp_elicitations?: boolean;
      };
    };

export type ApprovalsReviewer = "user" | "auto_review" | "guardian_subagent";

export type AutoCompactTokenLimitScope = "full_context" | "after_prefix";

export type Personality = "none" | "friendly" | "pragmatic" | "thoughtful" | "concise";

export type WebSearchMode = "disabled" | "cached" | "indexed" | "live";

export type ReasoningEffort = string;

export type ReasoningSummary = "auto" | "concise" | "detailed" | "none";

export type Verbosity = "low" | "medium" | "high";

export interface WebSearchToolConfig {
  mode?: WebSearchMode;
  max_results?: number;
  [key: string]: any;
}

export interface ToolsToml {
  web_search?: WebSearchToolConfig;
  [toolName: string]: any;
}

export interface FeaturesToml {
  rmcp_client?: boolean;
  apps?: boolean;
  undo?: boolean;
  subagents?: boolean;
  skills?: boolean;
  [feature: string]: boolean | undefined;
}

export interface AgentsToml {
  max_turns?: number;
  max_subagents?: number;
  auto_compact_token_limit?: number;
  auto_compact_token_limit_scope?: AutoCompactTokenLimitScope;
  base_instructions?: string;
  developer_instructions?: string;
  personality?: Personality;
  verbosity?: Verbosity;
  [key: string]: any;
}

export interface ConfigToml {
  model?: string;
  review_model?: string;
  model_provider?: string;
  model_context_window?: number;
  model_auto_compact_token_limit?: number;
  model_auto_compact_token_limit_scope?: AutoCompactTokenLimitScope;
  model_reasoning_effort?: ReasoningEffort;
  model_reasoning_summary?: "auto" | "concise" | "detailed" | "none";
  sandbox_mode?: SandboxMode;
  ask_for_approval?: AskForApproval;
  approvals_reviewer?: ApprovalsReviewer;
  tools?: ToolsToml;
  features?: FeaturesToml;
  agents?: AgentsToml;
  [key: string]: any;
}

export type JsonValueType = "string" | "number" | "boolean" | "json";

export interface CustomKeyValueEntry {
  key: string;
  type: JsonValueType;
  value: any;
}

export interface PolicyOption {
  id: AskForApproval;
  key: string;
  label: string;
  badge: string;
  desc: string;
  colorClass?: string;
  badgeClass?: string;
}

export interface ReviewerOption {
  id: ApprovalsReviewer;
  label: string;
  badge: string;
  badgeClass?: string;
  desc: string;
}

export interface ReasoningEffortOption {
  id?: string;
  effort?: string;
  reasoningEffort?: ReasoningEffort;
  label?: string;
  description?: string;
  desc?: string;
}



export const POLICY_OPTIONS: PolicyOption[] = [
  {
    id: "on-request",
    key: "on-request",
    label: "On Request (Default)",
    badge: "Recommended",
    badgeClass: "text-emerald-400 bg-emerald-950/60 border-emerald-800/50",
    desc: "Asks confirmation before executing high-risk or external operations",
    colorClass: "text-emerald-400"
  },
  {
    id: "untrusted",
    key: "untrusted",
    label: "Untrusted Only",
    badge: "Cautious",
    badgeClass: "text-blue-400 bg-blue-950/60 border-blue-800/50",
    desc: "Prompts whenever affecting files outside current workspace",
    colorClass: "text-blue-400"
  },
  {
    id: "always" as AskForApproval,
    key: "always",
    label: "Always Ask",
    badge: "Strict",
    badgeClass: "text-amber-400 bg-amber-950/60 border-amber-800/50",
    desc: "Every single tool call and command requires explicit approval",
    colorClass: "text-amber-400"
  },
  {
    id: "never",
    key: "never",
    label: "Never Ask",
    badge: "Dangerous",
    badgeClass: "text-rose-400 bg-rose-950/60 border-rose-800/50",
    desc: "Autonomous execution without stopping for permission prompts",
    colorClass: "text-rose-400"
  }
];

export const REVIEWER_OPTIONS: ReviewerOption[] = [
  {
    id: "user",
    label: "user",
    badge: "Interactive UI",
    badgeClass: "text-purple-400 bg-purple-950/60 border-purple-800/50",
    desc: "Interactive banners & human confirmation in chat"
  },
  {
    id: "auto_review",
    label: "auto_review",
    badge: "Automated Rules",
    badgeClass: "text-blue-400 bg-blue-950/60 border-blue-800/50",
    desc: "Automated evaluation against configured security rules"
  },
  {
    id: "guardian_subagent",
    label: "guardian_subagent",
    badge: "AI Guardian",
    badgeClass: "text-indigo-400 bg-indigo-950/60 border-indigo-800/50",
    desc: "Dedicated AI guardian subagent audits safety"
  }
];