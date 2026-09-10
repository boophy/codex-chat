import { Thread, ThreadItem, Model, SkillMetadata, AppInfo, GetAccountRateLimitsResponse, ServerDiagnosticsResponse, ThreadTokenUsage, CommandExecutionRequestApprovalParams, FileChangeRequestApprovalParams, AskForApproval, ReasoningEffort, UserInput, ConnectionStatus, LogFrame, AccountStatusResult } from "@/src/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProtocolInspector } from "@/src/components/ProtocolInspector";
import { NewThreadPage } from "@/src/components/codex/NewThreadPage";
import { ModelSelector } from "@/src/components/codex/ModelSelector";
import { SkillsAppsModal } from "@/src/components/SkillsAppsModal";
import { ApprovalBanner } from "@/src/components/ApprovalBanner";
import { Bot, Sparkles, Terminal, Sliders } from "lucide-react";
import { LoginModal } from "@/src/components/codex/LoginModal";
import { SettingsModal } from "@/src/components/SettingsModal";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { MessageItem } from "@/src/components/MessageItem";
import { ChatHeader } from "@/src/components/ChatHeader";
import { CodexAuthClient } from "@/src/lib/auth-client";
import { ChatInput } from "@/src/components/ChatInput";
import { wsClient } from "@/src/lib/websocket-client";
import { Sidebar } from "@/src/components/Sidebar";

export default function App() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [currentView, setCurrentView] = useState<"chat" | "new-thread">("chat");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [currentThread, setCurrentThread] = useState<Thread | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [skills, setSkills] = useState<SkillMetadata[]>([]);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [rateLimits, setRateLimits] = useState<GetAccountRateLimitsResponse | null>(null);
  const [diagnostics, setDiagnostics] = useState<ServerDiagnosticsResponse | null>(null);
  const [currentAccount, setCurrentAccount] = useState<AccountStatusResult | null>(null);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState("gpt-5.4-codex");
  const [selectedEffort, setSelectedEffort] = useState<ReasoningEffort>("medium");
  const [approvalPolicy, setApprovalPolicy] = useState<AskForApproval>("on-request");
  const [tokenUsage, setTokenUsage] = useState<ThreadTokenUsage | null>(null);
  const [isTurnInProgress, setIsTurnInProgress] = useState(false);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [commandApproval, setCommandApproval] = useState<CommandExecutionRequestApprovalParams | null>(null);
  const [fileApproval, setFileApproval] = useState<FileChangeRequestApprovalParams | null>(null);
  const commandApprovalResolverRef = useRef<((res: any) => void) | null>(null);
  const fileApprovalResolverRef = useRef<((res: any) => void) | null>(null);
  const [showInspector, setShowInspector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSkillsApps, setShowSkillsApps] = useState(false);
  const [logs, setLogs] = useState<LogFrame[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [currentProvider, setCurrentProvider] = useState<string>(() => {
    try {
      const cached = localStorage.getItem("codex_thread_config_v2");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.modelProvider) return parsed.modelProvider;
      }
    } catch {}
    return "shengsuanyun";
  });
  const hasInitialLoginPrompted = useRef<boolean>(false);
  const [showProviderSwitchModal, setShowProviderSwitchModal] = useState<boolean>(false);
  const [targetSwitchProvider, setTargetSwitchProvider] = useState<string | undefined>(undefined);

  const handleOpenProviderModal = (providerToSwitch?: string) => {
    setTargetSwitchProvider(providerToSwitch);
    setShowProviderSwitchModal(true);
  };

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
        setModels(modelListRes.value.data);
      }

      if (skillsListRes.status === "fulfilled" && skillsListRes.value?.data) {
        const skillsArray: SkillMetadata[] = [];
        skillsListRes.value.data.forEach((entry: any) => {
          if (entry.skills) {
            skillsArray.push(...entry.skills);
          }
        });
        setSkills(skillsArray);
      }

      if (appsListRes.status === "fulfilled" && appsListRes.value?.data) {
        setApps(appsListRes.value.data);
      }

      if (rateLimitsRes.status === "fulfilled" && rateLimitsRes.value) {
        setRateLimits(rateLimitsRes.value);
      }

      if (accountStatusRes.status === "fulfilled" && accountStatusRes.value) {
        setCurrentAccount(accountStatusRes.value);
        if (accountStatusRes.value.providerId) {
          setCurrentProvider(accountStatusRes.value.providerId);
        }
        // If not logged in on initial load, prompt login window
        if (!accountStatusRes.value.isLoggedIn && !hasInitialLoginPrompted.current) {
          hasInitialLoginPrompted.current = true;
          setShowLoginModal(true);
        }
      } else if (!hasInitialLoginPrompted.current) {
        hasInitialLoginPrompted.current = true;
        setShowLoginModal(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDiagnostics = async () => {
    try {
      const diag = await wsClient.request("server/diagnostics", {});
      setDiagnostics(diag);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const unsubStatus = wsClient.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    const unsubLogs = wsClient.onLog((frame) => {
      setLogs((prev) => [frame, ...prev.slice(0, 299)]);
    });

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
          setActiveTurnId(null);
        }
      }
    });

    const unsubTurnStarted = wsClient.on("turn/started", (params) => {
      setIsTurnInProgress(true);
      if (params?.turn) {
        setActiveTurnId(params.turn.id);
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
      setActiveTurnId(null);
      setCommandApproval(null);
      setFileApproval(null);
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
        setCommandApproval(params);
        commandApprovalResolverRef.current = (decision) => {
          setCommandApproval(null);
          respond({ decision });
        };
      }
    );

    const unsubFileApprovalReq = wsClient.onRequest(
      "item/fileChange/requestApproval",
      (params, respond) => {
        setFileApproval(params);
        fileApprovalResolverRef.current = (decision) => {
          setFileApproval(null);
          respond({ decision });
        };
      }
    );

    const unsubAccountUpdated = wsClient.on("account/updated", (params) => {
      if (params?.account) {
        setCurrentAccount({
          isLoggedIn: true,
          account: params.account,
          requiresOpenaiAuth: false,
          authMode: params.authMode || "chatgpt"
        });
      } else if (params?.authMode === null) {
        setCurrentAccount({
          isLoggedIn: false,
          account: null,
          requiresOpenaiAuth: true,
          authMode: null
        });
      }
    });

    const unsubAccountCompleted = wsClient.on("account/login/completed", (params) => {
      if (params?.success) {
        CodexAuthClient.checkAccountStatus(wsClient).then((res) => {
          setCurrentAccount(res);
        }).catch(() => {});
      }
    });

    connectAndInitialize();

    return () => {
      unsubStatus();
      unsubLogs();
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
      unsubAccountUpdated();
      unsubAccountCompleted();
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
            setCurrentAccount(authStatus);
            if (!authStatus.isLoggedIn) {
              setShowLoginModal(true);
            }
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

  const handleNewThread = async (customParams?: any) => {
    try {
      const targetProv = customParams?.modelProvider || currentProvider;
      if (targetProv !== currentProvider) {
        await wsClient.request("server/restart", {
          modelProvider: targetProv,
          codexHome: `~/.codex-${targetProv}`,
          forceRestart: true
        });
        setCurrentProvider(targetProv);
        const authStatus = await CodexAuthClient.checkAccountStatus(wsClient);
        setCurrentAccount(authStatus);
        if (!authStatus.isLoggedIn) {
          setShowLoginModal(true);
          return;
        }
      } else {
        const authStatus = await CodexAuthClient.checkAccountStatus(wsClient);
        if (!authStatus.isLoggedIn) {
          setShowLoginModal(true);
          return;
        }
      }

      const payload: any = {
        model: selectedModel,
        modelProvider: targetProv,
        approvalPolicy,
        ...(customParams || {})
      };
      const res = await wsClient.request("thread/start", payload);
      if (res?.thread) {
        setThreads((prev) => [res.thread, ...prev]);
        setActiveThreadId(res.thread.id);
        setCurrentThread(res.thread);
        if (payload.model) {
          setSelectedModel(payload.model);
        }
        if (payload.approvalPolicy) {
          setApprovalPolicy(payload.approvalPolicy);
        }
      }
    } catch (err) {
      console.error("[App] Failed to start new thread:", err);
    }
  };

  const handleForkThread = async (threadId: string) => {
    try {
      const res = await wsClient.request("thread/fork", { threadId });
      if (res?.thread) {
        setThreads((prev) => [res.thread, ...prev]);
        setActiveThreadId(res.thread.id);
        setCurrentThread(res.thread);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    try {
      await wsClient.request("thread/delete", { threadId });
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (activeThreadId === threadId) {
        const remaining = threads.filter((t) => t.id !== threadId);
        if (remaining.length > 0) {
          selectThread(remaining[0].id);
        } else {
          setActiveThreadId(null);
          setCurrentThread(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (text: string, attachedSkills: string[], attachedMentions: string[]) => {
    if (!activeThreadId) {
      try {
        const threadRes = await wsClient.request("thread/start", {
          model: selectedModel,
          approvalPolicy
        });
        if (threadRes?.thread) {
          setThreads((prev) => [threadRes.thread, ...prev]);
          setActiveThreadId(threadRes.thread.id);
          setCurrentThread(threadRes.thread);
          executeTurn(threadRes.thread.id, text, attachedSkills, attachedMentions);
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }

    executeTurn(activeThreadId, text, attachedSkills, attachedMentions);
  };

  const executeTurn = async (threadId: string, text: string, attachedSkills: string[], attachedMentions: string[]) => {
    const inputs: UserInput[] = [{ type: "text", text, text_elements: [] }];

    attachedSkills.forEach((s) => {
      inputs.push({ type: "skill", name: s, path: `/skills/${s}/SKILL.md` });
    });

    attachedMentions.forEach((m) => {
      inputs.push({ type: "mention", name: m, path: `app://${m}` });
    });

    try {
      setIsTurnInProgress(true);
      const res = await wsClient.request("turn/start", {
        threadId,
        input: inputs,
        model: selectedModel,
        effort: selectedEffort,
        approvalPolicy
      });
      if (res?.turn) {
        setActiveTurnId(res.turn.id);
      }
    } catch (err) {
      console.error(err);
      setIsTurnInProgress(false);
    }
  };

  const handleSteerTurn = async (text: string) => {
    if (!activeThreadId) return;
    try {
      await wsClient.request("turn/steer", {
        threadId: activeThreadId,
        expectedTurnId: activeTurnId || "turn_active",
        input: [{ type: "text", text, text_elements: [] }]
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleInterrupt = async () => {
    if (!activeThreadId) return;
    try {
      await wsClient.request("turn/interrupt", {
        threadId: activeThreadId,
        turnId: activeTurnId || "turn_active"
      });
      setIsTurnInProgress(false);
      setActiveTurnId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDecideCommand = (decision: "accept" | "acceptForSession" | "decline" | "cancel") => {
    if (commandApprovalResolverRef.current) {
      commandApprovalResolverRef.current(decision);
      commandApprovalResolverRef.current = null;
    }
  };

  const handleDecideFile = (decision: "accept" | "acceptForSession" | "decline" | "cancel") => {
    if (fileApprovalResolverRef.current) {
      fileApprovalResolverRef.current(decision);
      fileApprovalResolverRef.current = null;
    }
  };

  const allItems: ThreadItem[] = useMemo(() => {
    if (!currentThread || !currentThread.turns) return [];
    return currentThread.turns.flatMap((t) => t.items || []);
  }, [currentThread]);

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans antialiased">
      <Sidebar
        threads={threads}
        activeThreadId={activeThreadId}
        connectionStatus={connectionStatus}
        rateLimits={rateLimits}
        models={models}
        selectedModel={selectedModel}
        selectedEffort={selectedEffort}
        approvalPolicy={approvalPolicy}
        currentProvider={currentProvider}
        currentAccount={currentAccount}
        onSelectThread={selectThread}
        onNewThread={handleNewThread}
        onOpenNewThreadPage={() => setCurrentView("new-thread")}
        onForkThread={handleForkThread}
        onDeleteThread={handleDeleteThread}
        onOpenSkillsApps={() => setShowSkillsApps(true)}
        onReconnect={connectAndInitialize}
        onOpenLoginModal={() => setShowLoginModal(true)}
      />

      {currentView === "new-thread" ? (
        <NewThreadPage
          models={models}
          currentModel={selectedModel}
          currentEffort={selectedEffort}
          currentApprovalPolicy={approvalPolicy}
          currentProvider={currentProvider}
          onBack={() => setCurrentView("chat")}
          onStartThread={async (params) => {
            await handleNewThread(params);
            setCurrentView("chat");
          }}
          onOpenProviderModal={handleOpenProviderModal}
        />
      ) : (
        <main className="flex-1 flex flex-col min-w-0 h-full relative bg-zinc-950">
          <ChatHeader
            currentThread={currentThread}
            models={models}
            selectedModel={selectedModel}
            selectedEffort={selectedEffort}
            approvalPolicy={approvalPolicy}
            tokenUsage={tokenUsage}
            isTurnInProgress={isTurnInProgress}
            connectionStatus={connectionStatus}
            showInspector={showInspector}
            currentProvider={currentProvider}
            currentAccount={currentAccount}
            onSelectModel={setSelectedModel}
            onSelectEffort={(eff) => setSelectedEffort(eff as ReasoningEffort)}
            onSelectApprovalPolicy={setApprovalPolicy}
            onInterrupt={handleInterrupt}
            onToggleInspector={() => setShowInspector(!showInspector)}
            onOpenSettings={() => setShowSettings(true)}
            onReconnect={connectAndInitialize}
            onOpenProviderModal={handleOpenProviderModal}
            onOpenLoginModal={() => setShowLoginModal(true)}
          />

          <div className="flex-1 flex min-h-0 relative">
            <div className="flex-1 flex flex-col min-h-0 bg-linear-to-b from-zinc-950 via-zinc-950 to-zinc-900/30">
              <ScrollArea className="flex-1 px-2 sm:px-4 py-4">
                {allItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto min-h-[50vh]">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 mb-4 shadow-xl">
                      <Bot className="w-7 h-7" />
                    </div>
                    <h3 className="font-semibold text-lg text-zinc-100 mb-1">Codex Interactive Agent</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mb-6">
                      Real-time WebSocket protocol client for Codex App Server. Ask questions, execute shell commands, manage patches, or invoke skills and apps.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full text-left">
                      <button type="button"
                        onClick={() => setCurrentView("new-thread")}
                        className="p-3 rounded-xl border border-emerald-800/40 bg-emerald-950/20 hover:bg-emerald-950/40 transition-colors text-xs text-zinc-300 cursor-pointer"
                      >
                        <div className="font-semibold text-emerald-400 flex items-center gap-1 mb-1">
                          <Sliders className="w-3.5 h-3.5" /> Thread Config
                        </div>
                        <div className="text-[11px] text-zinc-500">Working directory, model & ConfigToml</div>
                      </button>
                      <button type="button"
                        onClick={() => handleSendMessage("Analyze project structure and run diagnostic tests", [], [])}
                        className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/80 transition-colors text-xs text-zinc-300 cursor-pointer"
                      >
                        <div className="font-semibold text-emerald-400 flex items-center gap-1 mb-1">
                          <Terminal className="w-3.5 h-3.5" /> Workspace Analysis
                        </div>
                        <div className="text-[11px] text-zinc-500">Run shell commands & inspect files</div>
                      </button>
                      <button type="button"
                        onClick={() => handleSendMessage("Refactor code for high performance and strict TypeScript types", [], [])}
                        className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/80 transition-colors text-xs text-zinc-300 cursor-pointer"
                      >
                        <div className="font-semibold text-indigo-400 flex items-center gap-1 mb-1">
                          <Sparkles className="w-3.5 h-3.5" /> Deep Code Reasoning
                        </div>
                        <div className="text-[11px] text-zinc-500">Chain-of-thought with reasoning deltas</div>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-6xl mx-auto pb-4">
                    {allItems.map((item) => (
                      <MessageItem key={item.id} item={item} isStreaming={isTurnInProgress}/>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              <ApprovalBanner
                commandRequest={commandApproval}
                fileRequest={fileApproval}
                onDecideCommand={handleDecideCommand}
                onDecideFile={handleDecideFile}
              />

              <ChatInput
                onSendMessage={handleSendMessage}
                onSteerTurn={handleSteerTurn}
                onInterrupt={handleInterrupt}
                isTurnInProgress={isTurnInProgress}
                skills={skills}
                apps={apps}
                disabled={connectionStatus !== "connected"}
              />
            </div>

            {showInspector && (
              <div className="w-96 border-l border-zinc-800 h-full bg-zinc-950/95 flex flex-col shrink-0 animate-in slide-in-from-right-10 duration-200">
                <ProtocolInspector logs={logs} onClear={() => setLogs([])} onClose={()=>setShowInspector(false)}/>
              </div>
            )}
          </div>
        </main>
      )}

      <SettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
        currentWsUrl={wsClient.getUrl()}
        connectionStatus={connectionStatus}
        diagnostics={diagnostics}
        onSaveWsUrl={(url) => {
          wsClient.setUrl(url);
          connectAndInitialize();
        }}
        onFetchDiagnostics={fetchDiagnostics}
      />

      <SkillsAppsModal
        open={showSkillsApps}
        onOpenChange={setShowSkillsApps}
        skills={skills}
        apps={apps}
        onSelectPrompt={(p) => { handleSendMessage(p, [], []);}}
      />

      <ModelSelector
        open={showProviderSwitchModal}
        onOpenChange={setShowProviderSwitchModal}
        targetProvider={targetSwitchProvider}
        currentProvider={currentProvider}
        models={models}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        currentThread={currentThread}
        onProviderSwitched={(newProvider) => {
          setCurrentProvider(newProvider);
          try {
            const cached = localStorage.getItem("codex_thread_config_v2");
            const data = cached ? JSON.parse(cached) : {};
            localStorage.setItem("codex_thread_config_v2", JSON.stringify({ ...data, modelProvider: newProvider }));
          } catch {}
        }}
        onThreadRestored={(restoredThread) => {
          setCurrentThread(restoredThread);
          setActiveThreadId(restoredThread.id);
        }}
        onRefreshData={fetchInitialData}
        onOpenLoginModal={(prov) => {
          if (prov) setCurrentProvider(prov);
          setShowLoginModal(true);
        }}
      />

      <LoginModal
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
        currentProvider={currentProvider}
        onProviderChange={async (newProvider) => {
          setCurrentProvider(newProvider);
          try {
            const cached = localStorage.getItem("codex_thread_config_v2");
            const data = cached ? JSON.parse(cached) : {};
            localStorage.setItem("codex_thread_config_v2", JSON.stringify({ ...data, modelProvider: newProvider }));
          } catch {}
          await fetchInitialData();
        }}
        onLoginSuccess={() => {
          CodexAuthClient.checkAccountStatus(wsClient).then(setCurrentAccount).catch(() => {});
          fetchInitialData();
        }}
      />
    </div>
  );
}
