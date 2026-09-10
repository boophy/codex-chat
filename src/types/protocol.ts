export type AbsolutePathBuf = string;
export type LegacyAppPathString = string;
export type PathUri = string;
export type RequestId = string | number;
export type ThreadId = string;
export type ResponseItemId = string;
export type GitSha = string;
export type JsonValue = number | string | boolean | Array<JsonValue> | { [key in string]?: JsonValue } | null;

import type {
  AuthMode,
  PlanType,
  TokenData,
  AgentIdentityStorage,
  BedrockApiKeyAuth,
  BedrockAccessKeysAuth,
  AuthDotJson,
  AccountInfo,
  AccountReadResponse,
  AccountLoginStartParams,
  AccountLoginStartResponse,
  AccountLoginCompletedParams,
  AccountUpdatedParams,
  AccountLoginCancelParams
} from "./auth";

import type {
  SandboxMode,
  AskForApproval,
  ApprovalsReviewer,
  Personality,
  Verbosity,
  ReasoningEffort,
  ReasoningSummary,
  ReasoningEffortOption
} from "./config";

export type {
  AuthMode,
  PlanType,
  TokenData,
  AgentIdentityStorage,
  BedrockApiKeyAuth,
  BedrockAccessKeysAuth,
  AuthDotJson,
  AccountInfo,
  AccountReadResponse,
  AccountLoginStartParams,
  AccountLoginStartResponse,
  AccountLoginCompletedParams,
  AccountUpdatedParams,
  AccountLoginCancelParams
};

export type {
  SandboxMode,
  AskForApproval,
  ApprovalsReviewer,
  Personality,
  Verbosity,
  ReasoningEffort,
  ReasoningSummary,
  ReasoningEffortOption
};

export type MessagePhase = "commentary" | "final_answer";
export type ModeKind = "plan" | "default";
export type InputModality = "text" | "image" | "audio";
export type MultiAgentVersion = "disabled" | "v1" | "v2";
export type SortDirection = "asc" | "desc";
export type ThreadSortKey = "created_at" | "updated_at" | "recency_at" | "section_position";
export type ThreadHistoryMode = "legacy" | "paginated";
export type SessionSource = "cli" | "vscode" | "exec" | "appServer" | { custom: string } | { subAgent: any } | "unknown";
export type ThreadSource = string;
export type ThreadSourceKind = "cli" | "vscode" | "exec" | "appServer" | "subAgent" | "subAgentReview" | "subAgentCompact" | "subAgentThreadSpawn" | "subAgentOther" | "unknown";

export type NetworkAccess = "restricted" | "enabled";

export type SandboxPolicy =
  | { type: "dangerFullAccess" }
  | { type: "readOnly"; networkAccess: boolean }
  | { type: "externalSandbox"; networkAccess: NetworkAccess }
  | { type: "workspaceWrite"; writableRoots: Array<AbsolutePathBuf>; networkAccess: boolean; excludeTmpdirEnvVar: boolean; excludeSlashTmp: boolean };

export interface ClientInfo {
  name: string;
  title: string | null;
  version: string;
}

export interface InitializeCapabilities {
  experimentalApi: boolean;
  requestAttestation: boolean;
  mcpServerOpenaiFormElicitation?: boolean;
  optOutNotificationMethods?: Array<string> | null;
  extensions?: { [key in string]?: JsonValue } | null;
}

export interface InitializeParams {
  clientInfo: ClientInfo;
  capabilities: InitializeCapabilities | null;
}

export interface InitializeResponse {
  userAgent: string;
  codexHome: AbsolutePathBuf;
  platformFamily: string;
  platformOs: string;
}

export interface TextPosition {
  line: number;
  column: number;
}

export interface TextRange {
  start: TextPosition;
  end: TextPosition;
}

export interface ByteRange {
  start: number;
  end: number;
}

export interface TextElement {
  byteRange: ByteRange;
  placeholder: string | null;
}

export type ImageDetail = "auto" | "low" | "high" | "original";

export type UserInput =
  | { type: "text"; text: string; text_elements: Array<TextElement> }
  | { type: "image"; detail?: ImageDetail; url: string }
  | { type: "localImage"; detail?: ImageDetail; path: string }
  | { type: "audio"; url: string }
  | { type: "localAudio"; path: string }
  | { type: "skill"; name: string; path: string }
  | { type: "mention"; name: string; path: string };

export type ThreadActiveFlag = "waitingOnApproval" | "waitingOnUserInput";

export type ThreadStatus =
  | { type: "notLoaded" }
  | { type: "idle" }
  | { type: "systemError" }
  | { type: "active"; activeFlags: Array<ThreadActiveFlag> };

export interface GitInfo {
  sha: string | null;
  branch: string | null;
  originUrl: string | null;
}

export interface ThreadSectionAppearance {
  icon: string | null;
  color: string | null;
}

export interface ThreadSection {
  id: string;
  name: string;
  appearance: ThreadSectionAppearance | null;
}

export interface Thread {
  id: string;
  sessionId: string;
  forkedFromId: string | null;
  parentThreadId: string | null;
  preview: string;
  ephemeral: boolean;
  section: ThreadSection | null;
  sectionEnteredAt: number | null;
  projectId: string | null;
  historyMode: ThreadHistoryMode;
  modelProvider: string;
  createdAt: number;
  updatedAt: number;
  recencyAt: number | null;
  status: ThreadStatus;
  path: string | null;
  cwd: AbsolutePathBuf;
  cliVersion: string;
  source: SessionSource;
  threadSource: ThreadSource | null;
  agentNickname: string | null;
  agentRole: string | null;
  gitInfo: GitInfo | null;
  name: string | null;
  turns: Array<Turn>;
}

export type TurnStatus = "completed" | "interrupted" | "failed" | "inProgress";
export type TurnItemsView = "notLoaded" | "summary" | "full";

export type CodexErrorInfo =
  | "contextWindowExceeded"
  | "sessionBudgetExceeded"
  | "usageLimitExceeded"
  | "rateLimitExceeded"
  | "serverOverloaded"
  | "cyberPolicy"
  | "misalignmentPolicyViolation"
  | { httpConnectionFailed: { httpStatusCode: number | null } }
  | { responseStreamConnectionFailed: { httpStatusCode: number | null } }
  | "internalServerError"
  | "unauthorized"
  | "badRequest"
  | "threadRollbackFailed"
  | "sandboxError"
  | { responseStreamDisconnected: { httpStatusCode: number | null } }
  | { responseTooManyFailedAttempts: { httpStatusCode: number | null } }
  | { activeTurnNotSteerable: { turnKind: "review" | "compact" } }
  | "other";

export interface MisalignmentSteer {
  message: string;
}

export interface MisalignmentErrorDetails {
  errorType: string | null;
  detailedExplanation: string | null;
  steer: MisalignmentSteer | null;
}

export interface TurnError {
  message: string;
  codexErrorInfo: CodexErrorInfo | null;
  additionalDetails: string | null;
  misalignment: MisalignmentErrorDetails | null;
}

export interface Turn {
  id: string;
  items: Array<ThreadItem>;
  itemsView: TurnItemsView;
  status: TurnStatus;
  error: TurnError | null;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
}

export type AgentMessageDelivery = "async";

export interface MemoryCitationEntry {
  path: string;
  lineStart: number;
  lineEnd: number;
  note: string;
}

export interface MemoryCitation {
  entries: Array<MemoryCitationEntry>;
  threadIds: Array<string>;
}

export type FunctionCallOutputContentItem =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail?: ImageDetail }
  | { type: "input_audio"; audio_url: string }
  | { type: "encrypted_content"; encrypted_content: string };

export type FunctionCallOutputBody = string | Array<FunctionCallOutputContentItem>;

export type CommandAction =
  | { type: "read"; command: string; name: string; path: LegacyAppPathString }
  | { type: "listFiles"; command: string; path: string | null }
  | { type: "search"; command: string; query: string | null; path: string | null }
  | { type: "unknown"; command: string };

export type CommandExecutionSource = "agent" | "userShell" | "unifiedExecStartup" | "unifiedExecInteraction";
export type CommandExecutionStatus = "inProgress" | "completed" | "failed" | "declined";

export type PatchChangeKind = { type: "add" } | { type: "delete" } | { type: "update"; move_path: string | null };
export type PatchApplyStatus = "inProgress" | "completed" | "failed" | "declined";

export interface FileUpdateChange {
  path: string;
  kind: PatchChangeKind;
  diff: string;
}

export type McpToolCallStatus = "inProgress" | "completed" | "failed";

export interface McpToolCallAppContext {
  connectorId: string;
  linkId: string | null;
  resourceUri: string | null;
  appName: string | null;
  actionName: string | null;
}

export interface McpToolCallResult {
  content: Array<JsonValue>;
  structuredContent: JsonValue | null;
  _meta: JsonValue | null;
}

export interface McpToolCallError {
  message: string;
}

export type DynamicToolCallOutputContentItem =
  | { type: "inputText"; text: string }
  | { type: "inputImage"; imageUrl: string }
  | { type: "inputAudio"; audioUrl: string };

export type DynamicToolCallStatus = "inProgress" | "completed" | "failed";

export type CollabAgentTool =
  | "spawnAgent"
  | "sendInput"
  | "resumeAgent"
  | "wait"
  | "closeAgent"
  | "sendMessage"
  | "followupTask"
  | "interruptAgent"
  | "listAgents";

export type CollabAgentToolCallStatus = "inProgress" | "completed" | "failed" | "interrupted";
export type CollabAgentStatus = "pendingInit" | "running" | "interrupted" | "completed" | "errored" | "shutdown" | "notFound";

export interface CollabAgentState {
  status: CollabAgentStatus;
  message: string | null;
}

export type SubAgentActivityKind = "started" | "interacted" | "interrupted" | "completed";

export type WebSearchAction =
  | { type: "search"; query: string | null; queries: Array<string> | null }
  | { type: "openPage"; url: string | null }
  | { type: "findInPage"; url: string | null; pattern: string | null }
  | { type: "other" };

export interface WebSearchItem {
  id: string;
  query: string;
  action: WebSearchAction | null;
  results: Array<JsonValue> | null;
}

export interface SleepItem {
  id: string;
  durationMs: number;
}

export type ImageGenerationFailure = { type: "usageLimitExceeded"; limitId: string; resetsAt: number | null };

export interface ImageGenerationItem {
  id: string;
  status: string;
  revisedPrompt: string | null;
  result: string;
  transparentBackground?: boolean;
  failure: ImageGenerationFailure | null;
  savedPath?: AbsolutePathBuf;
}

export interface HookPromptFragment {
  text: string;
  hookRunId: string;
}

export type ThreadItem =
  | { type: "userMessage"; id: string; clientId: string | null; content: Array<UserInput> }
  | { type: "hookPrompt"; id: string; fragments: Array<HookPromptFragment> }
  | { type: "agentMessage"; id: string; text: string; phase: MessagePhase | null; memoryCitation: MemoryCitation | null; delivery: AgentMessageDelivery | null }
  | { type: "functionCallOutput"; id: string; name: string; namespace: string | null; output: FunctionCallOutputBody }
  | { type: "plan"; id: string; text: string }
  | { type: "reasoning"; id: string; summary: Array<string>; content: Array<string> }
  | {
      type: "commandExecution";
      id: string;
      pluginId: string | null;
      scriptPath: string | null;
      command: string;
      cwd: LegacyAppPathString;
      processId: string | null;
      source: CommandExecutionSource;
      status: CommandExecutionStatus;
      commandActions: Array<CommandAction>;
      aggregatedOutput: string | null;
      exitCode: number | null;
      durationMs: number | null;
    }
  | { type: "fileChange"; id: string; changes: Array<FileUpdateChange>; status: PatchApplyStatus }
  | {
      type: "mcpToolCall";
      id: string;
      server: string;
      tool: string;
      status: McpToolCallStatus;
      arguments: JsonValue;
      appContext: McpToolCallAppContext | null;
      mcpAppResourceUri?: string;
      pluginId: string | null;
      readOnlyHint: boolean | null;
      result: McpToolCallResult | null;
      error: McpToolCallError | null;
      durationMs: number | null;
    }
  | {
      type: "dynamicToolCall";
      id: string;
      namespace: string | null;
      tool: string;
      arguments: JsonValue;
      status: DynamicToolCallStatus;
      contentItems: Array<DynamicToolCallOutputContentItem> | null;
      success: boolean | null;
      durationMs: number | null;
    }
  | {
      type: "collabAgentToolCall";
      id: string;
      tool: CollabAgentTool;
      status: CollabAgentToolCallStatus;
      senderThreadId: string;
      receiverThreadIds: Array<string>;
      prompt: string | null;
      model: string | null;
      reasoningEffort: ReasoningEffort | null;
      agentsStates: { [key in string]?: CollabAgentState };
    }
  | { type: "subAgentActivity"; id: string; kind: SubAgentActivityKind; agentThreadId: string; agentPath: string }
  | ({ type: "webSearch" } & WebSearchItem)
  | { type: "imageView"; id: string; path: LegacyAppPathString }
  | ({ type: "sleep" } & SleepItem)
  | ({ type: "imageGeneration" } & ImageGenerationItem)
  | { type: "enteredReviewMode"; id: string; review: string }
  | { type: "exitedReviewMode"; id: string; review: string }
  | { type: "contextCompaction"; id: string };

export type ExecPolicyAmendment = Array<string>;
export type NetworkPolicyRuleAction = "allow" | "deny";

export interface NetworkPolicyAmendment {
  host: string;
  action: NetworkPolicyRuleAction;
}

export type CommandExecutionApprovalDecision =
  | "accept"
  | "acceptForSession"
  | { acceptWithExecpolicyAmendment: { execpolicy_amendment: ExecPolicyAmendment } }
  | { applyNetworkPolicyAmendment: { network_policy_amendment: NetworkPolicyAmendment } }
  | "decline"
  | "cancel";

export type CommandExecutionApprovalKind = "command" | "writeStdin";
export type NetworkApprovalProtocol = "http" | "https" | "socks5Tcp" | "socks5Udp";

export interface NetworkApprovalContext {
  host: string;
  protocol: NetworkApprovalProtocol;
}

export interface CommandExecutionRequestApprovalParams {
  kind: CommandExecutionApprovalKind;
  threadId: string;
  turnId: string;
  itemId: string;
  startedAtMs: number;
  approvalId?: string | null;
  environmentId: string | null;
  reason?: string | null;
  networkApprovalContext?: NetworkApprovalContext | null;
  command?: string | null;
  cwd?: LegacyAppPathString | null;
  commandActions?: Array<CommandAction> | null;
  proposedExecpolicyAmendment?: ExecPolicyAmendment | null;
  proposedNetworkPolicyAmendments?: Array<NetworkPolicyAmendment> | null;
}

export interface CommandExecutionRequestApprovalResponse {
  decision: CommandExecutionApprovalDecision;
}

export type FileChangeApprovalDecision = "accept" | "acceptForSession" | "decline" | "cancel";

export interface FileChangeRequestApprovalParams {
  threadId: string;
  turnId: string;
  itemId: string;
  startedAtMs: number;
  reason?: string | null;
  grantRoot?: string | null;
}

export interface FileChangeRequestApprovalResponse {
  decision: FileChangeApprovalDecision;
}

export interface ToolRequestUserInputOption {
  label: string;
  description: string;
}

export interface ToolRequestUserInputQuestion {
  id: string;
  header: string;
  question: string;
  isOther: boolean;
  isSecret: boolean;
  options: Array<ToolRequestUserInputOption> | null;
}

export interface ToolRequestUserInputParams {
  threadId: string;
  turnId: string;
  itemId: string;
  questions: Array<ToolRequestUserInputQuestion>;
  isBlocking: boolean;
  autoResolutionMs: number | null;
}

export interface ToolRequestUserInputAnswer {
  answers: Array<string>;
}

export interface ToolRequestUserInputResponse {
  answers: { [key in string]?: ToolRequestUserInputAnswer };
}

export interface TokenUsageBreakdown {
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
}

export interface ThreadTokenUsage {
  total: TokenUsageBreakdown;
  last: TokenUsageBreakdown;
  modelContextWindow: number | null;
}

export type TurnPlanStepStatus = "pending" | "inProgress" | "completed";

export interface TurnPlanStep {
  step: string;
  status: TurnPlanStepStatus;
}

export interface TurnToolOutput {
  name: string;
  namespace: string | null;
  output: FunctionCallOutputBody;
}

export interface TurnStartParams {
  threadId: string;
  clientUserMessageId?: string | null;
  input: Array<UserInput>;
  turnTrigger?: string | null;
  toolOutput?: TurnToolOutput | null;
  cwd?: string | null;
  approvalPolicy?: AskForApproval | null;
  approvalsReviewer?: ApprovalsReviewer | null;
  sandboxPolicy?: SandboxPolicy | null;
  model?: string | null;
  serviceTier?: string | null;
  serviceTierForTurn?: string | null;
  effort?: ReasoningEffort | null;
  summary?: ReasoningSummary | null;
  personality?: Personality | null;
  outputSchema?: JsonValue | null;
}

export interface TurnStartResponse {
  turn: Turn;
}

export interface TurnSteerParams {
  threadId: string;
  clientUserMessageId?: string | null;
  input: Array<UserInput>;
  expectedTurnId: string;
}

export interface TurnSteerResponse {
  turnId: string;
}

export interface TurnInterruptParams {
  threadId: string;
  turnId: string;
}

export type TurnInterruptResponse = Record<string, never>;

export interface ThreadStartParams {
  model?: string | null;
  modelProvider?: string | null;
  serviceTier?: string | null;
  cwd?: string | null;
  approvalPolicy?: AskForApproval | null;
  approvalsReviewer?: ApprovalsReviewer | null;
  sandbox?: SandboxMode | null;
  config?: { [key in string]?: JsonValue } | null;
  serviceName?: string | null;
  baseInstructions?: string | null;
  developerInstructions?: string | null;
  personality?: Personality | null;
  ephemeral?: boolean | null;
  sessionStartSource?: "startup" | "clear" | null;
  threadSource?: ThreadSource | null;
}

export interface ThreadStartResponse {
  thread: Thread;
  model: string;
  modelProvider: string;
  serviceTier: string | null;
  cwd: AbsolutePathBuf;
  instructionSources: Array<LegacyAppPathString>;
  approvalPolicy: AskForApproval;
  approvalsReviewer: ApprovalsReviewer;
  sandbox: SandboxPolicy;
  reasoningEffort: ReasoningEffort | null;
}

export interface ThreadResumeParams {
  threadId: string;
  model?: string | null;
  modelProvider?: string | null;
  serviceTier?: string | null;
  cwd?: string | null;
  approvalPolicy?: AskForApproval | null;
  approvalsReviewer?: ApprovalsReviewer | null;
  sandbox?: SandboxMode | null;
  config?: { [key in string]?: JsonValue } | null;
  baseInstructions?: string | null;
  developerInstructions?: string | null;
  personality?: Personality | null;
  excludeTurns?: boolean;
}

export interface ThreadResumeResponse {
  thread: Thread;
  model: string;
  modelProvider: string;
  serviceTier: string | null;
  cwd: AbsolutePathBuf;
  instructionSources: Array<LegacyAppPathString>;
  approvalPolicy: AskForApproval;
  approvalsReviewer: ApprovalsReviewer;
  sandbox: SandboxPolicy;
  reasoningEffort: ReasoningEffort | null;
  turnsBackwardsCursor: string | null;
  itemsBackwardsCursor: string | null;
}

export interface ThreadForkParams {
  threadId: string;
  lastTurnId?: string | null;
  model?: string | null;
  modelProvider?: string | null;
  serviceTier?: string | null;
  cwd?: string | null;
  approvalPolicy?: AskForApproval | null;
  approvalsReviewer?: ApprovalsReviewer | null;
  sandbox?: SandboxMode | null;
  config?: { [key in string]?: JsonValue } | null;
  baseInstructions?: string | null;
  developerInstructions?: string | null;
  ephemeral?: boolean;
  threadSource?: ThreadSource | null;
  excludeTurns?: boolean;
}

export interface ThreadForkResponse {
  thread: Thread;
  model: string;
  modelProvider: string;
  serviceTier: string | null;
  cwd: AbsolutePathBuf;
  instructionSources: Array<LegacyAppPathString>;
  approvalPolicy: AskForApproval;
  approvalsReviewer: ApprovalsReviewer;
  sandbox: SandboxPolicy;
  reasoningEffort: ReasoningEffort | null;
}

export interface ThreadListParams {
  cursor?: string | null;
  limit?: number | null;
  sortKey?: ThreadSortKey | null;
  sortDirection?: SortDirection | null;
  modelProviders?: Array<string> | null;
  sourceKinds?: Array<ThreadSourceKind> | null;
  archived?: boolean | null;
  sectionId?: string | null;
  cwd?: string | Array<string> | null;
  useStateDbOnly?: boolean;
  searchTerm?: string | null;
}

export interface ThreadListResponse {
  data: Array<Thread>;
  nextCursor: string | null;
  backwardsCursor: string | null;
}

export interface ThreadReadParams {
  threadId: string;
  includeTurns?: boolean;
}

export interface ThreadReadResponse {
  thread: Thread;
}

export interface ThreadArchiveParams {
  threadId: string;
}

export type ThreadArchiveResponse = Record<string, never>;

export interface ThreadDeleteParams {
  threadId: string;
}

export type ThreadDeleteResponse = Record<string, never>;

export interface ModelServiceTier {
  id: string;
  name: string;
  description: string;
}

export interface Model {
  id: string;
  model: string;
  upgrade: string | null;
  upgradeInfo: any | null;
  availabilityNux: any | null;
  displayName: string;
  description: string;
  modelSpecialty: string | null;
  hidden: boolean;
  supportedReasoningEfforts: Array<ReasoningEffortOption>;
  defaultReasoningEffort: ReasoningEffort;
  inputModalities: Array<InputModality>;
  supportsPersonality: boolean;
  multiAgentVersion: MultiAgentVersion | null;
  additionalSpeedTiers: Array<string>;
  serviceTiers: Array<ModelServiceTier>;
  defaultServiceTier: string | null;
  isDefault: boolean;
}

export interface ModelListParams {
  cursor?: string | null;
  limit?: number | null;
  includeHidden?: boolean | null;
}

export interface ModelListResponse {
  data: Array<Model>;
  nextCursor: string | null;
}

export interface SkillInterface {
  displayName?: string;
  shortDescription?: string;
  iconSmall?: AbsolutePathBuf;
  iconLarge?: AbsolutePathBuf;
  iconSmallUrl: string | null;
  iconLargeUrl: string | null;
  brandColor?: string;
  defaultPrompt?: string;
}

export type SkillScope = "user" | "repo" | "system" | "admin";

export interface SkillMetadata {
  name: string;
  description: string;
  shortDescription?: string;
  interface?: SkillInterface;
  dependencies?: any;
  path: AbsolutePathBuf;
  scope: SkillScope;
  enabled: boolean;
  pluginId: string | null;
}

export interface SkillErrorInfo {
  path: string;
  message: string;
}

export interface SkillsListEntry {
  cwd: string;
  skills: Array<SkillMetadata>;
  errors: Array<SkillErrorInfo>;
}

export interface SkillsListParams {
  cwds?: Array<string>;
  forceReload?: boolean;
}

export interface SkillsListResponse {
  data: Array<SkillsListEntry>;
}

export interface AppInfo {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  logoUrlDark: string | null;
  iconAssets: { [key in string]?: string } | null;
  iconDarkAssets: { [key in string]?: string } | null;
  distributionChannel: string | null;
  branding: any | null;
  appMetadata: any | null;
  labels: { [key in string]?: string } | null;
  installUrl: string | null;
  isAccessible: boolean;
  isEnabled: boolean;
  pluginDisplayNames: Array<string>;
}

export interface AppsListParams {
  cursor?: string | null;
  limit?: number | null;
  threadId?: string | null;
  forceRefetch?: boolean;
}

export interface AppsListResponse {
  data: Array<AppInfo>;
  nextCursor: string | null;
}

export interface RateLimitWindow {
  usedPercent: number;
  windowDurationMins: number | null;
  resetsAt: number | null;
}

export interface RateLimitResetCredit {
  id: string;
  resetType: string;
  status: string;
  grantedAt: number;
  expiresAt: number | null;
  title: string | null;
  description: string | null;
}

export interface RateLimitResetCreditsSummary {
  availableCount: number;
  credits: Array<RateLimitResetCredit> | null;
}

export interface RateLimitSnapshot {
  limitId: string | null;
  limitName: string | null;
  primary: RateLimitWindow | null;
  secondary: RateLimitWindow | null;
  credits: any | null;
  individualLimit: any | null;
  spendControlReached: boolean | null;
  planType: PlanType | null;
  rateLimitReachedType: string | null;
}

export interface GetAccountRateLimitsResponse {
  rateLimits: RateLimitSnapshot;
  rateLimitsByLimitId: { [key in string]?: RateLimitSnapshot } | null;
  rateLimitResetCredits: RateLimitResetCreditsSummary | null;
}

export interface ServerDiagnosticsProcess {
  id: number;
  residentMemoryBytes: number | null;
  physicalFootprintBytes: number | null;
}

export interface ServerDiagnosticsGauge {
  name: string;
  value: number;
}

export interface ServerDiagnosticsResponse {
  process: ServerDiagnosticsProcess;
  gauges: Array<ServerDiagnosticsGauge>;
}
