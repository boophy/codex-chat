import type { AskForApproval, ApprovalsReviewer, ConfigToml, Personality } from "./config";
import type { SessionStartSource } from "./session";

export interface ThreadConfig {
  modelProvider?: string;
  codexHome?: string;
  model?: string;
  cwd?: string;
  approvalPolicy?: AskForApproval;
  approvalsReviewer?: ApprovalsReviewer;
  config?: Partial<ConfigToml>;
  serviceName?: string;
  baseInstructions?: string;
  developerInstructions?: string;
  personality?: Personality;
  ephemeral?: boolean;
  sessionStartSource?: SessionStartSource;
  [key: string]: any;
}

export type ThreadConfigInput = Partial<ThreadConfig>;