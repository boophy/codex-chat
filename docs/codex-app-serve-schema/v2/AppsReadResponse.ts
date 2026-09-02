
import type { ConnectorMetadata } from "./ConnectorMetadata";

/**
 * EXPERIMENTAL - app/read response.
 */
export type AppsReadResponse = { apps: Array<ConnectorMetadata>, missingAppIds: Array<string>, };
