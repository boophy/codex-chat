import { SessionModal } from "@/src/components/codex/SessionModal";
import { Cpu, Coins, Square, Radio } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { ChatHeaderProps} from "@/src/types";
import { FC, useState } from "react";

export type { ChatHeaderProps };

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  currentThread,
  models,
  selectedModel,
  selectedEffort,
  approvalPolicy,
  tokenUsage,
  isTurnInProgress,
  showInspector,
  currentProvider = "shengsuanyun",
  onSelectModel,
  onSelectEffort,
  onSelectApprovalPolicy,
  onInterrupt,
  onToggleInspector,
  onOpenSettings,
  onOpenProviderModal
}) => {
  const [showSessionModal, setShowSessionModal] = useState(false);
  const currentModelObj = models.find((m) => m.id === selectedModel || m.model === selectedModel);

  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-4 flex items-center justify-between gap-3 shrink-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-zinc-100 truncate max-w-50 sm:max-w-85">
              {currentThread?.name || currentThread?.preview || "No Thread Selected"}
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
            <span className="text-zinc-200 font-semibold">{tokenUsage.total?.totalTokens || 0}</span>
          </div>
        )}

        <Button variant="outline" size="sm" onClick={() => setShowSessionModal(true)}
          className="h-8 gap-1.5 text-xs border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/80 cursor-pointer"
          title="Open Model Configuration"
        >
          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">{currentModelObj?.displayName || selectedModel}</span>
          <Badge variant="secondary" className="text-[9px] px-1 py-0">{selectedEffort}</Badge>
        </Button>

        <SessionModal
          open={showSessionModal}
          onOpenChange={setShowSessionModal}
          models={models}
          currentModel={selectedModel}
          currentEffort={selectedEffort}
          currentApprovalPolicy={approvalPolicy}
          currentProvider={currentProvider}
          onSelectModel={onSelectModel}
          onSelectEffort={onSelectEffort}
          onSelectApprovalPolicy={onSelectApprovalPolicy}
          onSwitchProvider={(provider) => {
            onOpenProviderModal?.(provider);
          }}
        />

        {isTurnInProgress ? (
          <Button size="sm" variant="destructive" onClick={onInterrupt}
            className="h-8 gap-1.5 text-xs shadow-sm"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Interrupt</span>
          </Button>
        ) : null}

        <Button size="sm" variant={showInspector ? "secondary" : "outline"} onClick={onToggleInspector}
          className="h-8 gap-1.5 text-xs border-zinc-800"
          title="JSON-RPC Protocol Inspector"
        >
          <Radio className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden md:inline">Protocol Inspector</span>
        </Button>

        <Button size="sm" variant="outline" onClick={onOpenSettings}
          className="h-8 text-xs border-zinc-800 text-zinc-300"
        >
          Settings
        </Button>
      </div>
    </header>
  );
};
