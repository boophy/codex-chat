import { AskForApproval, ApprovalsReviewer, ConfigToml } from "./config";

export type SessionStartSource = "startup" | "clear";

export interface SessionStartParams {
  cwd?: string;
  model?: string;
  approvalPolicy?: AskForApproval;
  approvalsReviewer?: ApprovalsReviewer;
  source?: SessionStartSource;
  configToml?: Partial<ConfigToml>;
  modelProvider?: string;
  effort?: string;
  [key: string]: any;
}

export interface DirEntry {
  name: string;
  path: string;
  isHidden: boolean;
  mtime?: string;
}

export interface RootEntry {
  name: string;
  path: string;
}
