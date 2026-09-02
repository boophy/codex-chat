import * as React from "react";
import {
  Plus,
  MessageSquare,
  GitBranch,
  Trash2,
  Zap,
  RefreshCw,
  Layers
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Thread, GetAccountRateLimitsResponse } from "@/src/types/protocol";
import { ConnectionStatus } from "@/src/lib/websocket-client";
import { cn } from "@/src/lib/utils";

interface SidebarProps {
  threads: Thread[];
  activeThreadId: string | null;
  connectionStatus: ConnectionStatus;
  rateLimits: GetAccountRateLimitsResponse | null;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  onForkThread: (threadId: string) => void;
  onArchiveThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
  onOpenSkillsApps: () => void;
  onReconnect: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  threads,
  activeThreadId,
  connectionStatus,
  rateLimits,
  onSelectThread,
  onNewThread,
  onForkThread,
  onArchiveThread,
  onDeleteThread,
  onOpenSkillsApps,
  onReconnect
}) => {
  return (
    <aside className="w-72 bg-zinc-950 border-r border-zinc-800 flex flex-col h-full shrink-0 select-none">
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-emerald-400 font-bold shadow-xs">
            <Zap className="w-4 h-4 fill-emerald-400" />
          </div>
          <div>
            <div className="font-bold text-sm text-zinc-100 tracking-tight">Codex App Server</div>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span
                className={cn}
              />
              <span
                className={cn(
                  "w-2 h-2 rounded-full inline-block",
                  connectionStatus === "connected" && "bg-emerald-500 animate-pulse",
                  connectionStatus === "connecting" && "bg-amber-500 animate-ping",
                  connectionStatus === "error" && "bg-red-500",
                  connectionStatus === "disconnected" && "bg-zinc-600"
                )}
              />
              <span className="capitalize font-mono text-[10px]">{connectionStatus}</span>
            </div>
          </div>
        </div>

        <Button
          size="xsIcon"
          variant="ghost"
          onClick={onReconnect}
          className="text-zinc-400 hover:text-zinc-100"
          title="Reconnect WebSocket"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="p-3 border-b border-zinc-800/80">
        <Button
          onClick={onNewThread}
          className="w-full justify-center gap-2 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 font-semibold shadow-sm h-9 text-xs"
        >
          <Plus className="w-4 h-4" />
          New Thread
        </Button>
      </div>

      <div className="px-3 pt-3 pb-1 flex items-center justify-between text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
        <span>Threads ({threads.length})</span>
        <button
          type="button"
          onClick={onOpenSkillsApps}
          className="text-indigo-400 hover:text-indigo-300 font-normal normal-case text-xs flex items-center gap-1 cursor-pointer"
        >
          <Layers className="w-3 h-3" />
          Skills & Apps
        </button>
      </div>

      <ScrollArea className="flex-1 px-2 py-1">
        <div className="space-y-1">
          {threads.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-500">
              No threads found. Click New Thread to start.
            </div>
          ) : (
            threads.map((t) => {
              const isActive = t.id === activeThreadId;
              return (
                <div
                  key={t.id}
                  onClick={() => onSelectThread(t.id)}
                  className={cn(
                    "group relative flex flex-col p-2.5 rounded-lg text-xs transition-all cursor-pointer border",
                    isActive
                      ? "bg-zinc-900 border-zinc-700/80 text-zinc-100 shadow-xs"
                      : "border-transparent hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare
                        className={cn(
                          "w-3.5 h-3.5 shrink-0",
                          isActive ? "text-emerald-400" : "text-zinc-500"
                        )}
                      />
                      <span className="font-medium truncate text-zinc-200">
                        {t.name || t.preview || "Untitled Thread"}
                      </span>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onForkThread(t.id);
                        }}
                        className="p-1 text-zinc-400 hover:text-indigo-400"
                        title="Fork Thread"
                      >
                        <GitBranch className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteThread(t.id);
                        }}
                        className="p-1 text-zinc-400 hover:text-red-400"
                        title="Delete Thread"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span className="truncate">{t.modelProvider || "openai"}</span>
                    <span>{formatTime(t.recencyAt || t.createdAt)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-zinc-800 bg-zinc-950/60 space-y-2">
        {rateLimits?.rateLimits?.primary && (
          <div className="p-2 rounded-lg bg-zinc-900/70 border border-zinc-800/80 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between text-zinc-400 font-medium">
              <span>Quota Window</span>
              <span className="text-zinc-200 font-mono">
                {rateLimits.rateLimits.primary.usedPercent}% used
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${rateLimits.rateLimits.primary.usedPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>{rateLimits.rateLimits.primary.windowDurationMins ? `${rateLimits.rateLimits.primary.windowDurationMins}m window` : "Active"}</span>
              <span>{rateLimits.rateLimitResetCredits?.availableCount || 0} Credits</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-1 text-[11px] text-zinc-500">
          <span>Codex Protocol v2</span>
          <span>JSON-RPC 2.0</span>
        </div>
      </div>
    </aside>
  );
};

function formatTime(ts: number) {
  if (!ts) return "";
  const tsMs = ts < 1e11 ? ts * 1000 : ts;
  const diff = Date.now() - tsMs;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(tsMs).toLocaleDateString();
}
