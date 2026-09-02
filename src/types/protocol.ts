export interface JsonRpcRequest<T = any> {
  id: number | string;
  method: string;
  params?: T;
  jsonrpc?: "2.0";
}

export interface JsonRpcNotification<T = any> {
  method: string;
  params: T;
  jsonrpc?: "2.0";
}

export interface JsonRpcResponse<T = any> {
  id: number | string;
  result?: T;
  error?: JsonRpcError;
  jsonrpc?: "2.0";
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

export interface ClientInfo {
  name: string;
  title?: string;
  version?: string;
}

export interface ClientCapabilities {
  experimentalApi?: boolean;
  optOutNotificationMethods?: string[];
  extensions?: Record<string, any>;
  requestAttestation?: boolean;
}

export interface InitializeParams {
  clientInfo: ClientInfo;
  capabilities?: ClientCapabilities;
}

export interface InitializeResult {
  userAgent?: string;
  codexHome?: string;
  platformFamily?: string;
  platformOs?: string;
}

export type ThreadStatusType = "notLoaded" | "idle" | "active" | "systemError";

export interface ThreadStatus {
  type: ThreadStatusType;
  activeFlags?: string[];
}

export interface ThreadGitInfo {
  sha: string | null;
  branch: string | null;
  originUrl: string | null;
}

export interface Thread {
  id: string;
  preview?: string;
  modelProvider?: string;
  createdAt: number;
  updatedAt?: number;
  recencyAt?: number;
  status: ThreadStatus;
  model?: string | null;
  reasoningEffort?: string | null;
  ephemeral?: boolean;
  path?: string | null;
  forkedFromId?: string | null;
  sessionId?: string | null;
  gitInfo?: ThreadGitInfo | null;
  agentNickname?: string | null;
  agentRole?: string | null;
  turns?: Turn[];
  sectionId?: string | null;
}

export type TurnStatus = "inProgress" | "completed" | "interrupted" | "failed";

export interface Turn {
  id: string;
  status: TurnStatus;
  items: ThreadItem[];
  error?: {
    message: string;
    codexErrorInfo?: string;
    additionalDetails?: any;
    misalignment?: any;
  } | null;
}

export type InputContent =
  | { type: "text"; text: string }
  | { type: "image"; url: string }
  | { type: "localImage"; path: string }
  | { type: "audio"; url: string }
  | { type: "localAudio"; path: string }
  | { type: "skill"; name: string; path: string }
  | { type: "mention"; name: string; path: string };

export interface CommandAction {
  type: string;
  path?: string;
  command?: string;
}

export interface FileChangeEntry {
  path: string;
  kind: "add" | "modify" | "delete";
  diff: string;
}

export type ThreadItem =
  | {
      type: "userMessage";
      id: string;
      clientId?: string;
      content: InputContent[];
    }
  | {
      type: "agentMessage";
      id: string;
      text: string;
      phase?: string;
      memoryCitation?: string;
      delivery?: "async" | null;
      questions?: Array<{ title: string; options: string[] | null }> | null;
    }
  | {
      type: "reasoning";
      id: string;
      summary?: string;
      content?: string;
    }
  | {
      type: "commandExecution";
      id: string;
      pluginId?: string;
      scriptPath?: string;
      command: string;
      cwd: string;
      status: "inProgress" | "completed" | "failed" | "declined";
      commandActions?: CommandAction[];
      aggregatedOutput?: string;
      exitCode?: number | null;
      durationMs?: number;
    }
  | {
      type: "fileChange";
      id: string;
      changes: FileChangeEntry[];
      status: "inProgress" | "completed" | "failed" | "declined";
    }
  | {
      type: "mcpToolCall";
      id: string;
      server: string;
      tool: string;
      status: "inProgress" | "completed" | "failed";
      arguments: Record<string, any>;
      appContext?: {
        connectorId: string;
        linkId: string;
        resourceUri: string;
        appName: string;
        actionName: string;
      };
      readOnlyHint?: boolean | null;
      result?: any;
      error?: any;
    }
  | {
      type: "plan";
      id: string;
      text: string;
    }
  | {
      type: "contextCompaction";
      id: string;
    }
  | {
      type: "webSearch";
      id: string;
      query: string;
      action?: any;
      results?: any;
    }
  | {
      type: "functionCallOutput";
      id: string;
      name: string;
      namespace?: string | null;
      output: string | any[];
    };

export interface TokenUsage {
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
}

export interface PlanStep {
  step: string;
  status: "pending" | "inProgress" | "completed";
}

export type ApprovalDecision =
  | "accept"
  | "acceptForSession"
  | "decline"
  | "cancel"
  | { acceptWithExecpolicyAmendment: { execpolicy_amendment: any[] } }
  | { applyNetworkPolicyAmendment: { network_policy_amendment: { host: string; action: string } } };

export interface CommandApprovalRequest {
  itemId: string;
  threadId: string;
  turnId: string;
  environmentId?: string | null;
  kind?: "command" | "writeStdin";
  approvalId?: string;
  reason?: string;
  command?: string;
  cwd?: string;
  commandActions?: CommandAction[];
  availableDecisions?: string[];
}

export interface FileChangeApprovalRequest {
  itemId: string;
  threadId: string;
  turnId: string;
  reason?: string;
  grantRoot?: string;
  changes?: FileChangeEntry[];
}

export interface UserInputRequest {
  isBlocking: boolean;
  questions: Array<{ id: string; query: string; options?: string[] }>;
}

export interface ModelInfo {
  id: string;
  displayName: string;
  description?: string;
  supportedReasoningEfforts?: string[];
  defaultReasoningEffort?: string;
  hidden?: boolean;
}

export interface SkillInfo {
  name: string;
  description: string;
  enabled: boolean;
  pluginId?: string | null;
  interface?: {
    displayName?: string;
    shortDescription?: string;
    iconSmall?: string;
    brandColor?: string;
    defaultPrompt?: string;
  };
}

export interface AppInfo {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  isAccessible?: boolean;
  isEnabled?: boolean;
}

export interface RateLimitsInfo {
  rateLimits?: {
    primary?: {
      usedPercent: number;
      windowDurationMins: number;
      resetsAt: number;
    };
  };
  rateLimitResetCredits?: {
    availableCount: number;
  };
}

export interface DiagnosticSnapshot {
  process: {
    id: number;
    residentMemoryBytes: number;
    physicalFootprintBytes: number | null;
  };
  gauges: Array<{ name: string; value: number }>;
}
