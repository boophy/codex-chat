import { Plus, MessageSquare, GitBranch, Trash2, Zap, RefreshCw, Layers, Sliders, Server } from "lucide-react";
import { FC, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Thread, GetAccountRateLimitsResponse, Model, AskForApproval } from "@/src/types/protocol";
import { ConnectionStatus } from "@/src/lib/websocket-client";
import { NewThreadModal } from "@/src/components/codex/NewThreadModal";
import { ServerManagerModal } from "@/src/components/codex/ServerManagerModal";
import { cn } from "@/src/lib/utils";

interface SidebarProps {
  threads: Thread[];
  activeThreadId: string | null;
  connectionStatus: ConnectionStatus;
  rateLimits: GetAccountRateLimitsResponse | null;
  models?: Model[];
  selectedModel?: string;
  selectedEffort?: string;
  approvalPolicy?: AskForApproval;
  onSelectThread: (threadId: string) => void;
  onNewThread: (customParams?: any) => void | Promise<void>;
  onOpenNewThreadPage?: () => void;
  onForkThread: (threadId: string) => void;
  onArchiveThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
  onOpenSkillsApps: () => void;
  onReconnect: () => void;
}

export const Sidebar: FC<SidebarProps> = ({
  threads,
  activeThreadId,
  connectionStatus,
  rateLimits,
  models = [],
  selectedModel = "gpt-5",
  selectedEffort = "medium",
  approvalPolicy = "on-request",
  onSelectThread,
  onNewThread,
  onOpenNewThreadPage,
  onForkThread,
  onArchiveThread,
  onDeleteThread,
  onOpenSkillsApps,
  onReconnect
}) => {
  const [newThreadModalOpen, setNewThreadModalOpen] = useState(false);
  const [serverModalOpen, setServerModalOpen] = useState(false);

  return (
    <>
      <aside className="w-72 bg-zinc-950 border-r border-zinc-800 flex flex-col h-full shrink-0 select-none">
        <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-emerald-400 font-bold shadow-xs">
              <Zap className="w-4 h-4 fill-emerald-400" />
            </div>
            <div>
              <div className="font-bold text-sm text-zinc-100 tracking-tight">Codex App Server</div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <span className={cn(
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

          <div className="flex items-center gap-1">
            <Button size="xsIcon" variant="ghost" onClick={() => setServerModalOpen(true)}
              className="text-zinc-400 hover:text-indigo-400"
              title="Codex App-Server Process & Account Manager"
            >
              <Server className="w-3.5 h-3.5" />
            </Button>
            <Button size="xsIcon" variant="ghost" onClick={onReconnect}
              className="text-zinc-400 hover:text-zinc-100"
              title="Reconnect WebSocket"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="p-3 border-b border-zinc-800/80 space-y-2">
          <div className="flex items-center gap-1.5">
            <Button
              onClick={() => {
                if (onOpenNewThreadPage) {
                  onOpenNewThreadPage();
                } else {
                  setNewThreadModalOpen(true);
                }
              }}
              className="flex-1 justify-center gap-2 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 font-semibold shadow-sm h-9 text-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Thread</span>
              <Sliders className="w-3.5 h-3.5 text-zinc-600 ml-auto" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => onNewThread()}
              className="h-9 px-2 text-zinc-400 hover:text-zinc-100 border-zinc-800 bg-zinc-900/60 cursor-pointer"
              title="Quick Start without configuring"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
            </Button>
          </div>
        </div>

        <div className="px-3 pt-3 pb-1 flex items-center justify-between text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
          <span>Threads ({threads.length})</span>
          <button type="button" onClick={onOpenSkillsApps}
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
                  <div key={t.id} onClick={() => onSelectThread(t.id)}
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
                          className={cn("w-3.5 h-3.5 shrink-0",
                            isActive ? "text-emerald-400" : "text-zinc-500"
                          )}
                        />
                        <span className="font-medium truncate text-zinc-200">
                          {t.name || t.preview || "Untitled Thread"}
                        </span>
                      </div>

                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
                        <button type="button" title="Fork Thread"
                          onClick={(e) => {
                            e.stopPropagation();
                            onForkThread(t.id);
                          }}
                          className="p-1 text-zinc-400 hover:text-indigo-400"
                        >
                          <GitBranch className="w-3 h-3" />
                        </button>
                        <button type="button" title="Delete Thread"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteThread(t.id);
                          }}
                          className="p-1 text-zinc-400 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      <span className="truncate">{t.modelProvider || "codex-aws"}</span>
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
                <span>
                  {rateLimits.rateLimits.primary.windowDurationMins
                    ? `${rateLimits.rateLimits.primary.windowDurationMins}m window`
                    : "Active"}
                </span>
                <span>{rateLimits.rateLimitResetCredits?.availableCount || 0} Credits</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-1 text-[11px] text-zinc-400">
            <button type="button" onClick={() => setServerModalOpen(true)}
              className="flex items-center gap-1.5 hover:text-indigo-300 cursor-pointer"
            >
              <Server className="w-3 h-3 text-indigo-400" />
              <span>Manage Servers</span>
            </button>
            <span className="font-mono text-[10px] text-zinc-500">v2 / JSON-RPC</span>
          </div>
        </div>
      </aside>

      <NewThreadModal
        open={newThreadModalOpen}
        onOpenChange={setNewThreadModalOpen}
        models={models}
        currentModel={selectedModel}
        currentEffort={selectedEffort}
        currentApprovalPolicy={approvalPolicy}
        onStartThread={async (params) => {
          await onNewThread(params);
        }}
      />
      
      <ServerManagerModal open={serverModalOpen} onOpenChange={setServerModalOpen} />
    </>
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
