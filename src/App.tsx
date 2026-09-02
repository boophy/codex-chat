import * as React from "react";
import { wsClient, ConnectionStatus, LogFrame } from "@/src/lib/websocket-client";
import { Sidebar } from "@/src/components/Sidebar";
import { ChatHeader } from "@/src/components/ChatHeader";
import { MessageItem } from "@/src/components/MessageItem";
import { ChatInput } from "@/src/components/ChatInput";
import { ApprovalBanner } from "@/src/components/ApprovalBanner";
import { ProtocolInspector } from "@/src/components/ProtocolInspector";
import { SettingsModal } from "@/src/components/SettingsModal";
import { SkillsAppsModal } from "@/src/components/SkillsAppsModal";
import {
  Thread,
  Turn,
  ThreadItem,
  ModelInfo,
  SkillInfo,
  AppInfo,
  RateLimitsInfo,
  DiagnosticSnapshot,
  TokenUsage,
  CommandApprovalRequest,
  FileChangeApprovalRequest
} from "@/src/types/protocol";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Bot, Sparkles, Terminal, ShieldAlert } from "lucide-react";

export default function App() {
  const [connectionStatus, setConnectionStatus] = React.useState<ConnectionStatus>("disconnected");
  const [threads, setThreads] = React.useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = React.useState<string | null>(null);
  const [currentThread, setCurrentThread] = React.useState<Thread | null>(null);
  const [models, setModels] = React.useState<ModelInfo[]>([]);
  const [skills, setSkills] = React.useState<SkillInfo[]>([]);
  const [apps, setApps] = React.useState<AppInfo[]>([]);
  const [rateLimits, setRateLimits] = React.useState<RateLimitsInfo | null>(null);
  const [diagnostics, setDiagnostics] = React.useState<DiagnosticSnapshot | null>(null);
  const [selectedModel, setSelectedModel] = React.useState("gpt-5.4-codex");
  const [selectedEffort, setSelectedEffort] = React.useState("medium");
  const [approvalPolicy, setApprovalPolicy] = React.useState("unlessTrusted");
  const [tokenUsage, setTokenUsage] = React.useState<TokenUsage | null>(null);
  const [isTurnInProgress, setIsTurnInProgress] = React.useState(false);

  const [commandApproval, setCommandApproval] = React.useState<CommandApprovalRequest | null>(null);
  const [fileApproval, setFileApproval] = React.useState<FileChangeApprovalRequest | null>(null);
  const commandApprovalResolverRef = React.useRef<((res: any) => void) | null>(null);
  const fileApprovalResolverRef = React.useRef<((res: any) => void) | null>(null);

  const [showInspector, setShowInspector] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [showSkillsApps, setShowSkillsApps] = React.useState(false);
  const [logs, setLogs] = React.useState<LogFrame[]>([]);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const connectAndInitialize = React.useCallback(async () => {
    try {
      await wsClient.connect();
      await fetchInitialData();
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchInitialData = async () => {
    try {
      const [threadListRes, modelListRes, skillsListRes, appsListRes, rateLimitsRes] =
        await Promise.allSettled([
          wsClient.request("thread/list", {}),
          wsClient.request("model/list", {}),
          wsClient.request("skills/list", {}),
          wsClient.request("app/list", {}),
          wsClient.request("account/rateLimits/read", {})
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

      if (skillsListRes.status === "fulfilled" && skillsListRes.value?.data?.[0]?.skills) {
        setSkills(skillsListRes.value.data[0].skills);
      }

      if (appsListRes.status === "fulfilled" && appsListRes.value?.data) {
        setApps(appsListRes.value.data);
      }

      if (rateLimitsRes.status === "fulfilled" && rateLimitsRes.value) {
        setRateLimits(rateLimitsRes.value);
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

  React.useEffect(() => {
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
            return { ...i, summary: (i.summary || "") + params.delta };
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
    };
  }, [connectAndInitialize]);

  const selectThread = async (threadId: string) => {
    setActiveThreadId(threadId);
    try {
      const res = await wsClient.request("thread/read", { threadId, includeTurns: true });
      if (res?.thread) {
        setCurrentThread(res.thread);
        if (res.thread.model) setSelectedModel(res.thread.model);
        if (res.thread.reasoningEffort) setSelectedEffort(res.thread.reasoningEffort);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewThread = async () => {
    try {
      const res = await wsClient.request("thread/start", {
        model: selectedModel,
        effort: selectedEffort,
        approvalPolicy: approvalPolicy
      });
      if (res?.thread) {
        setThreads((prev) => [res.thread, ...prev]);
        setActiveThreadId(res.thread.id);
        setCurrentThread(res.thread);
      }
    } catch (err) {
      console.error(err);
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

  const handleArchiveThread = async (threadId: string) => {
    try {
      await wsClient.request("thread/archive", { threadId });
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
          effort: selectedEffort,
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
    const inputs: any[] = [{ type: "text", text }];

    attachedSkills.forEach((s) => {
      inputs.push({ type: "skill", name: s, path: `/skills/${s}/SKILL.md` });
    });

    attachedMentions.forEach((m) => {
      inputs.push({ type: "mention", name: m, path: `app://${m}` });
    });

    try {
      setIsTurnInProgress(true);
      await wsClient.request("turn/start", {
        threadId,
        input: inputs,
        model: selectedModel,
        effort: selectedEffort,
        approvalPolicy
      });
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
        input: [{ type: "text", text }]
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleInterrupt = async () => {
    if (!activeThreadId) return;
    try {
      await wsClient.request("turn/interrupt", { threadId: activeThreadId });
      setIsTurnInProgress(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDecideCommand = (decision: "accept" | "acceptForSession" | "decline" | "cancel") => {
    if (commandApprovalResolverRef.current) {
      commandApprovalResolverRef.current(decision);
      commandApprovalResolverRef.current = null;
    }
    setCommandApproval(null);
  };

  const handleDecideFile = (decision: "accept" | "acceptForSession" | "decline" | "cancel") => {
    if (fileApprovalResolverRef.current) {
      fileApprovalResolverRef.current(decision);
      fileApprovalResolverRef.current = null;
    }
    setFileApproval(null);
  };

  const handleSaveWsUrl = (newUrl: string) => {
    wsClient.setUrl(newUrl);
    wsClient.disconnect();
    connectAndInitialize();
  };

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      <Sidebar
        threads={threads}
        activeThreadId={activeThreadId}
        connectionStatus={connectionStatus}
        rateLimits={rateLimits}
        onSelectThread={selectThread}
        onNewThread={handleNewThread}
        onForkThread={handleForkThread}
        onArchiveThread={handleArchiveThread}
        onDeleteThread={handleDeleteThread}
        onOpenSkillsApps={() => setShowSkillsApps(true)}
        onReconnect={connectAndInitialize}
      />

      <main className="flex-1 flex flex-col min-w-0 h-full relative">
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
          onSelectModel={setSelectedModel}
          onSelectEffort={setSelectedEffort}
          onSelectApprovalPolicy={setApprovalPolicy}
          onInterrupt={handleInterrupt}
          onToggleInspector={() => setShowInspector(!showInspector)}
          onOpenSettings={() => {
            fetchDiagnostics();
            setShowSettings(true);
          }}
          onReconnect={connectAndInitialize}
        />

        <div className="flex-1 overflow-y-auto relative flex flex-col">
          {(!currentThread || !currentThread.turns || currentThread.turns.length === 0) ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 mb-4 shadow-xl">
                <Bot className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-zinc-100 mb-2">Codex App Server Chat</h2>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                Connect via JSON-RPC 2.0 WebSocket protocol with live token streaming, reasoning traces, terminal command approvals, and file diff visualizers.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                <button
                  type="button"
                  onClick={() => handleSendMessage("Explain how Codex JSON-RPC 2.0 streaming works", [], [])}
                  className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-800/60 transition-colors cursor-pointer text-xs"
                >
                  <div className="font-semibold text-zinc-200 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Protocol Architecture
                  </div>
                  <div className="text-zinc-500 text-[11px]">Inspect request lifecycle and events</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMessage("Run tests and verify build output with shell command approval", [], [])}
                  className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-800/60 transition-colors cursor-pointer text-xs"
                >
                  <div className="font-semibold text-zinc-200 mb-1 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                    Command Approval Flow
                  </div>
                  <div className="text-zinc-500 text-[11px]">Trigger live execution approval dialog</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMessage("$skill-creator Add a new skill for triaging flaky CI", ["skill-creator"], [])}
                  className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-800/60 transition-colors cursor-pointer text-xs"
                >
                  <div className="font-semibold text-purple-300 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Invoke Skill ($)
                  </div>
                  <div className="text-zinc-500 text-[11px]">Use $skill-creator generator</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMessage("@github-connector Check recent PRs and repository diffs", [], ["github-connector"])}
                  className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-800/60 transition-colors cursor-pointer text-xs"
                >
                  <div className="font-semibold text-cyan-300 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    Invoke Connected App (@)
                  </div>
                  <div className="text-zinc-500 text-[11px]">Connect with @github-connector</div>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-4">
              {currentThread.turns.map((turn: Turn, tIdx: number) => {
                const isLastTurn = tIdx === currentThread.turns!.length - 1;
                return (
                  <div key={turn.id} className="space-y-1">
                    {turn.items.map((item: ThreadItem) => (
                      <MessageItem
                        key={item.id}
                        item={item}
                        isStreaming={isLastTurn && isTurnInProgress && item.type === "agentMessage"}
                      />
                    ))}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

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
      </main>

      {showInspector && (
        <ProtocolInspector
          logs={logs}
          onClear={() => {
            wsClient.clearLogs();
            setLogs([]);
          }}
          onClose={() => setShowInspector(false)}
        />
      )}

      <SettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
        currentWsUrl={wsClient.getUrl()}
        connectionStatus={connectionStatus}
        diagnostics={diagnostics}
        onSaveWsUrl={handleSaveWsUrl}
        onFetchDiagnostics={fetchDiagnostics}
      />

      <SkillsAppsModal
        open={showSkillsApps}
        onOpenChange={setShowSkillsApps}
        skills={skills}
        apps={apps}
        onSelectPrompt={(p) => handleSendMessage(p, [], [])}
      />
    </div>
  );
}
