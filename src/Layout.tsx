import { Thread, ThreadItem, SkillMetadata, ThreadTokenUsage, AskForApproval, ReasoningEffort } from "@/src/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCodex, resolveProvider } from "@/src/lib/ctx";
import { ChatHeader } from "@/src/components/ChatHeader";
import { CodexAuthClient } from "@/src/lib/auth-client";
import { wsClient } from "@/src/lib/websocket-client";
import Settings from "./components/Setting";
import Chat from "./components/Chat";

export default function Layout() {
  const [currentView, setCurrentView] = useState<'chat'|'settings'>('chat');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [currentThread, setCurrentThread] = useState<Thread | null>(null);
  const [selectedModel, setSelectedModel] = useState("openai/gpt-6-astra");
  const [selectedEffort, setSelectedEffort] = useState<ReasoningEffort>("medium");
  const [approvalPolicy, setApprovalPolicy] = useState<AskForApproval>("on-request");
  const [tokenUsage, setTokenUsage] = useState<ThreadTokenUsage | null>(null);
  const [isTurnInProgress, setIsTurnInProgress] = useState(false);
  const commandApprovalResolverRef = useRef<((res: any) => void) | null>(null);
  const fileApprovalResolverRef = useRef<((res: any) => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showProviderSwitchModal, setShowProviderSwitchModal] = useState<boolean>(false);
  const [targetSwitchProvider, setTargetSwitchProvider] = useState<string | undefined>(undefined);

  const { provider, models, dispatch } = useCodex();
  const currentProvider = provider.id;
  const setCurrentProvider = useCallback((id: string) => {
    dispatch({ type: "SET_PROVIDER", payload: resolveProvider(id) });
  }, [dispatch]);
  const hasInitialLoginPrompted = useRef<boolean>(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const connectAndInitialize = useCallback(async () => {
    try {
      await wsClient.connect();
      await fetchInitialData();
    } catch (err) {
      console.error(err);
    }
  }, []);
  const fetchInitialData = async () => {
      try {
        const [threadListRes, modelListRes, skillsListRes, appsListRes, rateLimitsRes, accountStatusRes] =
          await Promise.allSettled([
            wsClient.request("thread/list", {}),
            wsClient.request("model/list", {}),
            wsClient.request("skills/list", {}),
            wsClient.request("app/list", {}),
            wsClient.request("account/rateLimits/read", {}),
            CodexAuthClient.checkAccountStatus(wsClient)
          ]);
  
        if (threadListRes.status === "fulfilled" && threadListRes.value?.data) {
          const list = threadListRes.value.data as Thread[];
          setThreads(list);
          if (list.length > 0 && !activeThreadId) {
            selectThread(list[0].id);
          }
        }
  
        if (modelListRes.status === "fulfilled" && modelListRes.value?.data) {
          dispatch({ type: "SET_MODELS", payload: modelListRes.value.data });
        }
  
        if (skillsListRes.status === "fulfilled" && skillsListRes.value?.data) {
          const skillsArray: SkillMetadata[] = [];
          skillsListRes.value.data.forEach((entry: any) => {
            if (entry.skills) {
              skillsArray.push(...entry.skills);
            }
          });
        }
        if (accountStatusRes.status === "fulfilled" && accountStatusRes.value) {
          if (accountStatusRes.value.providerId) {
            setCurrentProvider(accountStatusRes.value.providerId);
          }
          // If not logged in on initial load, prompt login window
          if (!accountStatusRes.value.isLoggedIn && !hasInitialLoginPrompted.current) {
            hasInitialLoginPrompted.current = true;
          }
        } else if (!hasInitialLoginPrompted.current) {
          hasInitialLoginPrompted.current = true;
        }
      } catch (e) {
        console.error(e);
      }
    };
  

  
    useEffect(() => {
      const unsubThreadStarted = wsClient.on("thread/started", (params) => {
        if (params?.thread) {
          setThreads((prev) => {
            const exists = prev.some((t) => t.id === params.thread.id);
            if (exists) {
              return prev.map((t) => (t.id === params.thread.id ? params.thread : t));
            }
            return [params.thread, ...prev];
          });
        }
      });
  
      const unsubThreadStatus = wsClient.on("thread/status/changed", (params) => {
        if (params?.threadId && params?.status) {
          setThreads((prev) =>
            prev.map((t) => (t.id === params.threadId ? { ...t, status: params.status } : t))
          );
          setCurrentThread((curr) => {
            if (curr && curr.id === params.threadId) {
              return { ...curr, status: params.status };
            }
            return curr;
          });
          if (params.status.type === "idle" || params.status.type === "notLoaded") {
            setIsTurnInProgress(false);
          }
        }
      });
  
      const unsubTurnStarted = wsClient.on("turn/started", (params) => {
        setIsTurnInProgress(true);
        if (params?.turn) {
          setCurrentThread((curr) => {
            if (!curr) return curr;
            const turnExists = curr.turns?.some((t) => t.id === params.turn.id);
            const turns = turnExists
              ? curr.turns?.map((t) => (t.id === params.turn.id ? params.turn : t))
              : [...(curr.turns || []), params.turn];
            return { ...curr, turns };
          });
        }
      });
  
      const unsubTurnCompleted = wsClient.on("turn/completed", (params) => {
        setIsTurnInProgress(false);
        if (params?.turn) {
          setCurrentThread((curr) => {
            if (!curr) return curr;
            const turns = (curr.turns || []).map((t) =>
              t.id === params.turn.id ? { ...t, status: params.turn.status, error: params.turn.error } : t
            );
            return { ...curr, turns };
          });
        }
      });
  
      const unsubItemStarted = wsClient.on("item/started", (params) => {
        if (!params?.item) return;
        const item: ThreadItem = params.item;
        setCurrentThread((curr) => {
          if (!curr || !curr.turns || curr.turns.length === 0) return curr;
          const lastTurn = curr.turns[curr.turns.length - 1];
          const itemExists = lastTurn.items.some((i) => i.id === item.id);
          const newItems = itemExists
            ? lastTurn.items.map((i) => (i.id === item.id ? item : i))
            : [...lastTurn.items, item];
          const updatedTurns = curr.turns.map((t, idx) =>
            idx === curr.turns!.length - 1 ? { ...t, items: newItems } : t
          );
          return { ...curr, turns: updatedTurns };
        });
        setTimeout(scrollToBottom, 50);
      });
  
      const unsubItemCompleted = wsClient.on("item/completed", (params) => {
        if (!params?.item) return;
        const item: ThreadItem = params.item;
        setCurrentThread((curr) => {
          if (!curr || !curr.turns || curr.turns.length === 0) return curr;
          const lastTurn = curr.turns[curr.turns.length - 1];
          const newItems = lastTurn.items.map((i) => (i.id === item.id ? item : i));
          const updatedTurns = curr.turns.map((t, idx) =>
            idx === curr.turns!.length - 1 ? { ...t, items: newItems } : t
          );
          return { ...curr, turns: updatedTurns };
        });
        setTimeout(scrollToBottom, 50);
      });
  
      const unsubAgentDelta = wsClient.on("item/agentMessage/delta", (params) => {
        if (!params?.itemId || params.delta === undefined) return;
        setCurrentThread((curr) => {
          if (!curr || !curr.turns || curr.turns.length === 0) return curr;
          const lastTurn = curr.turns[curr.turns.length - 1];
          const newItems = lastTurn.items.map((i) => {
            if (i.id === params.itemId && i.type === "agentMessage") {
              return { ...i, text: (i.text || "") + params.delta };
            }
            return i;
          });
          const updatedTurns = curr.turns.map((t, idx) =>
            idx === curr.turns!.length - 1 ? { ...t, items: newItems } : t
          );
          return { ...curr, turns: updatedTurns };
        });
        setTimeout(scrollToBottom, 20);
      });
  
      const unsubReasoningDelta = wsClient.on("item/reasoning/summaryTextDelta", (params) => {
        if (!params?.itemId || params.delta === undefined) return;
        setCurrentThread((curr) => {
          if (!curr || !curr.turns || curr.turns.length === 0) return curr;
          const lastTurn = curr.turns[curr.turns.length - 1];
          const newItems = lastTurn.items.map((i) => {
            if (i.id === params.itemId && i.type === "reasoning") {
              const currentSummary = Array.isArray(i.summary) ? i.summary.join("") : (i.summary || "");
              return { ...i, summary: [currentSummary + params.delta] };
            }
            return i;
          });
          const updatedTurns = curr.turns.map((t, idx) =>
            idx === curr.turns!.length - 1 ? { ...t, items: newItems } : t
          );
          return { ...curr, turns: updatedTurns };
        });
      });
  
      const unsubCmdOutputDelta = wsClient.on("item/commandExecution/outputDelta", (params) => {
        if (!params?.itemId) return;
        let text = "";
        if (params.deltaBase64) {
          try {
            text = atob(params.deltaBase64);
          } catch {
            text = params.deltaBase64;
          }
        }
        if (!text) return;
        setCurrentThread((curr) => {
          if (!curr || !curr.turns || curr.turns.length === 0) return curr;
          const lastTurn = curr.turns[curr.turns.length - 1];
          const newItems = lastTurn.items.map((i) => {
            if (i.id === params.itemId && i.type === "commandExecution") {
              return { ...i, aggregatedOutput: (i.aggregatedOutput || "") + text };
            }
            return i;
          });
          const updatedTurns = curr.turns.map((t, idx) =>
            idx === curr.turns!.length - 1 ? { ...t, items: newItems } : t
          );
          return { ...curr, turns: updatedTurns };
        });
        setTimeout(scrollToBottom, 20);
      });
  
      const unsubTokenUsage = wsClient.on("thread/tokenUsage/updated", (params) => {
        if (params?.tokenUsage) {
          setTokenUsage(params.tokenUsage);
        }
      });
  
      const unsubCommandApprovalReq = wsClient.onRequest(
        "item/commandExecution/requestApproval",
        (params, respond) => {
          commandApprovalResolverRef.current = (decision) => {
            respond({ decision });
          };
        }
      );
  
      const unsubFileApprovalReq = wsClient.onRequest(
        "item/fileChange/requestApproval",
        (params, respond) => {
          fileApprovalResolverRef.current = (decision) => {
            respond({ decision });
          };
        }
      );
  

  
      connectAndInitialize();
  
      return () => {
        unsubThreadStarted();
        unsubThreadStatus();
        unsubTurnStarted();
        unsubTurnCompleted();
        unsubItemStarted();
        unsubItemCompleted();
        unsubAgentDelta();
        unsubReasoningDelta();
        unsubCmdOutputDelta();
        unsubTokenUsage();
        unsubCommandApprovalReq();
        unsubFileApprovalReq();
      };
    }, [connectAndInitialize]);
  
    const selectThread = async (threadId: string) => {
      setActiveThreadId(threadId);
      setCurrentView("chat");
      try {
        const res = await wsClient.request("thread/read", { threadId, includeTurns: true });
        if (res?.thread) {
          setCurrentThread(res.thread);
          const threadProvider = res.thread.modelProvider;
          if (threadProvider && threadProvider !== currentProvider) {
            try {
              await wsClient.request("server/restart", {
                modelProvider: threadProvider,
                codexHome: `~/.codex-${threadProvider}`,
                forceRestart: true
              });
              setCurrentProvider(threadProvider);
              const authStatus = await CodexAuthClient.checkAccountStatus(wsClient);
            } catch (e) {
              console.warn("Failed to switch app-server for thread provider:", e);
            }
          }
          if (res.thread.modelProvider) {
            const matched = models.find((m) => m.modelProvider === res.thread.modelProvider);
            if (matched) setSelectedModel(matched.model);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
  const handleOpenProviderModal = (providerToSwitch?: string) => {
    setTargetSwitchProvider(providerToSwitch);
    setShowProviderSwitchModal(true);
  };
  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans antialiased">
      <main className="flex-1 flex flex-col min-w-0 h-full relative bg-zinc-950">
        <ChatHeader
          currentThread={currentThread}
          models={models}
          selectedModel={selectedModel}
          selectedEffort={selectedEffort}
          approvalPolicy={approvalPolicy}
          tokenUsage={tokenUsage}
          isTurnInProgress={isTurnInProgress}
          currentProvider={currentProvider}
          onSelectModel={setSelectedModel}
          onSelectEffort={(eff) => setSelectedEffort(eff as ReasoningEffort)}
          onSelectApprovalPolicy={setApprovalPolicy}
          onOpenSettings={setCurrentView}
          onOpenProviderModal= {handleOpenProviderModal}
        />
        <div className="flex-1 flex min-h-0 relative">
          {currentView === 'chat' ? <Chat /> : (
            <Settings
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
              onSelectProvider={setCurrentProvider}
            />
          )}
        </div>
      </main>
    </div>);
}
