import { Model, Thread, ThreadItem, SkillMetadata, AppInfo, ThreadTokenUsage, CommandExecutionRequestApprovalParams, FileChangeRequestApprovalParams, ServerDiagnosticsResponse, GetAccountRateLimitsResponse } from "./protocol";
import { AskForApproval, ApprovalsReviewer, ConfigToml } from "./config";
import { AccountStatusResult } from "./auth";
import { ConnectionStatus, LogFrame } from "./rpc";

export interface ServerManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface ApprovalPolicySelectorProps {
  approvalPolicy: AskForApproval;
  onSelectApprovalPolicy: (policy: AskForApproval) => void;
  variant?: "dropdown" | "form";
  className?: string;
}

export interface ApprovalSettingsProps {
  approvalPolicy: AskForApproval;
  approvalsReviewer: ApprovalsReviewer;
  onSelectApprovalPolicy: (policy: AskForApproval) => void;
  onSelectApprovalsReviewer: (reviewer: ApprovalsReviewer) => void;
  className?: string;
  disabled?: boolean;
}

export interface NewThreadPageProps {
  models: Model[];
  currentModel: string;
  currentEffort: string;
  currentApprovalPolicy: AskForApproval;
  currentProvider?: string;
  onBack: () => void;
  onStartThread: (params: any) => Promise<void> | void;
  onOpenProviderModal?: (provider?: string) => void;
}

export interface SessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: Model[];
  currentModel: string;
  currentEffort: string;
  currentApprovalPolicy: AskForApproval;
  currentApprovalsReviewer?: ApprovalsReviewer;
  currentProvider?: string;
  onSelectModel?: (model: string) => void;
  onSelectEffort?: (effort: string) => void;
  onSelectApprovalPolicy?: (policy: AskForApproval) => void;
  onSelectApprovalsReviewer?: (reviewer: ApprovalsReviewer) => void;
  onStartThread?: (params: any) => Promise<void> | void;
  onSwitchProvider?: (provider: string) => void;
}

export interface NewThreadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: Model[];
  currentModel: string;
  currentEffort: string;
  currentApprovalPolicy: AskForApproval;
  onStartThread: (params: any) => Promise<void> | void;
  onOpenPageMode?: () => void;
}

export interface ReasoningEffortSelectorProps {
  selectedEffort: string;
  onSelectEffort: (effort: string) => void;
  variant?: "dropdown" | "form" | "pill";
  className?: string;
}

export interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProvider?: string;
  onProviderChange?: (newProvider: string) => Promise<void> | void;
  onLoginSuccess?: (account: any) => void;
  onLogoutSuccess?: () => void;
}

export interface DirectoryPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPath?: string;
  onSelectPath: (selectedPath: string) => void;
}

export interface ConfigTomlEditorProps {
  config: Partial<ConfigToml>;
  onChange: (updated: Partial<ConfigToml>) => void;
  modelProvider?: string;
  className?: string;
}

export interface ModelSelectorProps {
  // Inline & Selection Props
  models?: Model[];
  selectedModel?: string;
  currentModel?: string;
  selectedProvider?: string;
  currentProvider?: string;
  targetProvider?: string;
  onSelectModel?: (model: string) => void;
  onSelectProvider?: (provider: string) => void;
  variant?: "dropdown" | "form" | "compact" | "button" | "menu" | "combobox";
  className?: string;
  inline?: boolean;

  // Merged Modal / Switcher Props (from ProviderSwitchModal)
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  currentThread?: Thread | null;
  onProviderSwitched?: (newProvider: string) => void;
  onThreadRestored?: (thread: Thread) => void;
  onRefreshData?: () => Promise<void>;
  onOpenProviderModal?: (provider?: string) => void;
  onOpenLoginModal?: (provider?: string) => void;
}

export interface ChatInputProps {
  onSendMessage: (text: string, skills: string[], mentions: string[]) => void;
  onSteerTurn: (text: string) => void;
  onInterrupt: () => void;
  isTurnInProgress: boolean;
  skills: SkillMetadata[];
  apps: AppInfo[];
  disabled?: boolean;
}

export interface ChatHeaderProps {
  currentThread: Thread | null;
  models: Model[];
  selectedModel: string;
  selectedEffort: string;
  approvalPolicy: AskForApproval;
  tokenUsage: ThreadTokenUsage | null;
  isTurnInProgress: boolean;
  connectionStatus: ConnectionStatus;
  showInspector: boolean;
  currentProvider?: string;
  currentAccount?: AccountStatusResult | null;
  onSelectModel: (model: string) => void;
  onSelectEffort: (effort: string) => void;
  onSelectApprovalPolicy: (policy: AskForApproval) => void;
  onInterrupt: () => void;
  onToggleInspector: () => void;
  onOpenSettings: () => void;
  onReconnect: () => void;
  onOpenProviderModal?: (provider?: string) => void;
  onOpenLoginModal?: () => void;
}

export interface SidebarProps {
  threads: Thread[];
  activeThreadId: string | null;
  connectionStatus: ConnectionStatus;
  rateLimits: GetAccountRateLimitsResponse | null;
  models?: Model[];
  selectedModel?: string;
  selectedEffort?: string;
  approvalPolicy?: AskForApproval;
  currentProvider?: string;
  currentAccount?: AccountStatusResult | null;
  onSelectThread: (threadId: string) => void;
  onNewThread: (customParams?: any) => void | Promise<void>;
  onOpenNewThreadPage?: () => void;
  onForkThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
  onOpenSkillsApps: () => void;
  onReconnect: () => void;
  onOpenProviderModal?: (provider?: string) => void;
  onOpenLoginModal?: () => void;
}

export interface MessageItemProps {
  item: ThreadItem;
  isStreaming?: boolean;
}

export interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentWsUrl: string;
  connectionStatus: ConnectionStatus;
  diagnostics: ServerDiagnosticsResponse | null;
  onSaveWsUrl: (url: string) => void;
  onFetchDiagnostics: () => void;
}

export interface ProtocolInspectorProps {
  logs: LogFrame[];
  onClear: () => void;
  onClose: () => void;
}

export interface ApprovalBannerProps {
  commandRequest: CommandExecutionRequestApprovalParams | null;
  fileRequest: FileChangeRequestApprovalParams | null;
  onDecideCommand: (decision: "accept" | "acceptForSession" | "decline" | "cancel") => void;
  onDecideFile: (decision: "accept" | "acceptForSession" | "decline" | "cancel") => void;
}

export interface SkillsAppsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skills: SkillMetadata[];
  apps: AppInfo[];
  onSelectPrompt: (prompt: string) => void;
}
