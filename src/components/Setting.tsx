import { Thread, ThreadItem, SkillMetadata, AppInfo, GetAccountRateLimitsResponse, ServerDiagnosticsResponse, ThreadTokenUsage, CommandExecutionRequestApprovalParams, FileChangeRequestApprovalParams, AskForApproval, ReasoningEffort, UserInput, ConnectionStatus, LogFrame, AccountStatusResult } from "@/src/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProtocolInspector } from "@/src/components/ProtocolInspector";
import { NewThreadPage } from "@/src/components/codex/NewThreadPage";
import { ModelSelector } from "@/src/components/codex/ModelSelector";
import { SkillsAppsModal } from "@/src/components/SkillsAppsModal";
import { ApprovalBanner } from "@/src/components/ApprovalBanner";
import { Bot, Sparkles, Terminal, Sliders } from "lucide-react";
import { SettingsModal } from "@/src/components/SettingsModal";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { MessageItem } from "@/src/components/MessageItem";
import { ChatHeader } from "@/src/components/ChatHeader";
import { CodexAuthClient } from "@/src/lib/auth-client";
import { useCodex, resolveProvider } from "@/src/lib/ctx";
import { ChatInput } from "@/src/components/ChatInput";
import { wsClient } from "@/src/lib/websocket-client";
import { Button } from "./ui/button";

type Props = {
  init?: string;
  selectedModel?: string;
  className?: string;
  onSelectModel?: (model: string) => void;
  onSelectProvider?: (provider: string) => void;
  onOpenLoginModal?: (provider?: string) => void;
}
export default function Settings({
  init = "model",
  selectedModel,
  className,
  onSelectModel,
  onSelectProvider,
  onOpenLoginModal
}: Props) {
  const [it, setIt] = useState<string>(init);
  const { models, provider } = useCodex();
  const providerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ModelSelector 的 provider 输入框每敲一个键都会回调 onSelectProvider，
  // 这里做一次防抖，等输入结束后再向上提交最终的 provider id。
  const handleSelectProvider = useCallback((nextProvider: string) => {
    const clean = nextProvider.trim();
    if (!clean) return;
    if (providerTimerRef.current) clearTimeout(providerTimerRef.current);
    providerTimerRef.current = setTimeout(() => onSelectProvider?.(clean), 400);
  }, [onSelectProvider]);

  useEffect(() => {
    return () => {
      if (providerTimerRef.current) clearTimeout(providerTimerRef.current);
    };
  }, []);

  return (
    <div className="flex-1 flex min-h-0 bg-linear-to-b from-zinc-950 via-zinc-950 to-zinc-900/30">
      <div className="h-full w-18 flex flex-col items-center gap-6 py-3">
        <Button className="bg-transparent hover:bg-transparent"
          onClick={()=>setIt("model")}
        >
          <Sliders className="w-4 h-4 text-white" />
        </Button>
        <Button className="bg-transparent hover:bg-transparent"
          onClick={()=>setIt("server")}
        >
          <Terminal className="w-4 h-4 text-white" />
        </Button>
        <Button className="bg-transparent hover:bg-transparent"
          onClick={()=>setIt("seetings")}
        >
          <Sparkles className="w-4 h-4 text-white" />
        </Button>
        <Button className="bg-transparent hover:bg-transparent"
          onClick={()=>setIt("about")}
        >
          <Bot className="w-4 h-4 text-white" />
        </Button>
      </div>
      <div className="flex-1 flex flex-col min-h-0 py-3">
        {(() => {
          switch (it) {
            case "model":
              return <ModelSelector
                models={models}
                selectedModel={selectedModel}
                currentProvider={provider.id}
                onSelectModel={onSelectModel}
                onSelectProvider={handleSelectProvider}
                className={className}
                onOpenLoginModal={onOpenLoginModal}
              />;
            default:
              return null;
          }
        })()}
      </div>
    </div>);
}
