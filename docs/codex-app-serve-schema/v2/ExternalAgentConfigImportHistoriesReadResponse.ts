
import type { ExternalAgentConfigImportHistory } from "./ExternalAgentConfigImportHistory";
import type { ExternalAgentImportedConnectorCandidate } from "./ExternalAgentImportedConnectorCandidate";

export type ExternalAgentConfigImportHistoriesReadResponse = { data: Array<ExternalAgentConfigImportHistory>, connectors: Array<ExternalAgentImportedConnectorCandidate>, };
