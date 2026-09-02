
import type { ExternalAgentConfigImportHistoryRecordSuccessParams } from "./ExternalAgentConfigImportHistoryRecordSuccessParams";
import type { ExternalAgentConfigImportItemTypeFailure } from "./ExternalAgentConfigImportItemTypeFailure";
import type { ExternalAgentConfigMigrationItemType } from "./ExternalAgentConfigMigrationItemType";

export type ExternalAgentConfigImportHistoryRecordTypeResultParams = { itemType: ExternalAgentConfigMigrationItemType, successes: Array<ExternalAgentConfigImportHistoryRecordSuccessParams>, failures: Array<ExternalAgentConfigImportItemTypeFailure>, };
