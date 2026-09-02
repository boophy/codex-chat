import * as React from "react";
import {
  Square,
  Sparkles,
  SlidersHorizontal,
  Code2,
  Activity,
  Cpu,
  RefreshCw,
  Coins,
  ShieldCheck,
  Zap
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/src/components/ui/dropdown-menu";
import { ModelInfo, TokenUsage, Thread } from "@/src/types/protocol";
import { ConnectionStatus } from "@/src/lib/websocket-client";

interface ChatHeaderProps {
  currentThread: Thread | null;
  models: ModelInfo[];
  selectedModel: string;
  selectedEffort: string;
  approvalPolicy: string;
  tokenUsage: TokenUsage | null;
  isTurnInProgress: boolean;
  connectionStatus: ConnectionStatus;
  showInspector: boolean;
  onSelectModel: (model: string) => void;
  onSelectEffort: (effort: string) => void;
  onSelectApprovalPolicy: (policy: string) => void;
  onInterrupt: () => void;
  onToggleInspector: () => void;
  onOpenSettings: () => void;
  onReconnect: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  currentThread,
  models,
  selectedModel,
  selectedEffort,
  approvalPolicy,
  tokenUsage,
  isTurnInProgress,
  connectionStatus,
  showInspector,
  onSelectModel,
  onSelectEffort,
  onSelectApprovalPolicy,
  onInterrupt,
  onToggleInspector,
  onOpenSettings,
  onReconnect
}) => {
  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-4 flex items-center justify-between gap-3 shrink-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-zinc-100 truncate max-w-[200px] sm:max-w-[340px]">
              {currentThread?.preview || "No Thread Selected"}
            </span>
            {isTurnInProgress && (
              <Badge variant="purple" className="flex items-center gap-1 animate-pulse text-[10px] py-0">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                Thinking & Streaming...
              </Badge>
            )}
          </div>
          <span className="text-[11px] text-zinc-500 font-mono truncate">
            {currentThread ? `ID: ${currentThread.id}` : "Select or create a thread"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {tokenUsage && (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 font-mono">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>Tokens:</span>
            <span className="text-zinc-200 font-semibold">{tokenUsage.totalTokens || 0}</span>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-zinc-800 bg-zinc-900/60">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">{selectedModel}</span>
              <Badge variant="secondary" className="text-[9px] px-1 py-0">{selectedEffort}</Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Codex Model</DropdownMenuLabel>
            {models.map((m) => (
              <DropdownMenuItem
                key={m.id}
                onClick={() => onSelectModel(m.id)}
                className={selectedModel === m.id ? "bg-zinc-800 text-emerald-400 font-semibold" : ""}
              >
                <div className="flex flex-col">
                  <span>{m.displayName}</span>
                  <span className="text-[10px] text-zinc-500">{m.id}</span>
                </div>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Reasoning Effort</DropdownMenuLabel>
            {["low", "medium", "high", "ultra"].map((eff) => (
              <DropdownMenuItem
                key={eff}
                onClick={() => onSelectEffort(eff)}
                className={selectedEffort === eff ? "bg-zinc-800 text-indigo-400 font-semibold capitalize" : "capitalize"}
              >
                {eff} Effort
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Approval Policy</DropdownMenuLabel>
            {[
              { id: "unlessTrusted", label: "Ask unless trusted" },
              { id: "always", label: "Always ask approvals" },
              { id: "never", label: "Never ask (Full Access)" }
            ].map((pol) => (
              <DropdownMenuItem
                key={pol.id}
                onClick={() => onSelectApprovalPolicy(pol.id)}
                className={approvalPolicy === pol.id ? "bg-zinc-800 text-amber-400 font-semibold" : ""}
              >
                {pol.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {isTurnInProgress && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onInterrupt}
            className="h-8 px-2.5 text-xs font-semibold gap-1 animate-in fade-in"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Interrupt</span>
          </Button>
        )}

        <Button
          variant={showInspector ? "secondary" : "outline"}
          size="sm"
          onClick={onToggleInspector}
          className="h-8 px-2.5 text-xs border-zinc-800"
          title="Toggle JSON-RPC 2.0 Protocol Inspector"
        >
          <Code2 className="w-3.5 h-3.5 text-indigo-400 mr-1" />
          <span className="hidden md:inline">Protocol</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSettings}
          className="h-8 w-8 p-0 border-zinc-800"
          title="Server Connection & Settings"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-300" />
        </Button>
      </div>
    </header>
  );
};
