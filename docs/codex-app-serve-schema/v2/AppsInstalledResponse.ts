
import type { InstalledApp } from "./InstalledApp";

/**
 * The installed connectors in one committed runtime snapshot.
 */
export type AppsInstalledResponse = { apps: Array<InstalledApp>, };
