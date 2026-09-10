/**
 * Primary Application Entry Point
 * All unified bridge and server capabilities have been merged into scripts/codex-bridge.ts
 */
export * from "./scripts/codex-bridge";
import { startServer } from "./scripts/codex-bridge";

startServer();
