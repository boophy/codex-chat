import { Thread, ProviderOption, SwitchStage, ModelSelectorProps, SUPPORTED_PROVIDERS } from "@/src/types";
import { Server, Check, ChevronsUpDown, Sparkles, Search, X } from "lucide-react";
import { CodexAuthClient, AccountStatusResult } from "@/src/lib/auth-client";
import { FC, useEffect, useMemo, useRef, useState } from "react";
import { wsClient } from "@/src/lib/websocket-client";
import { cn } from "@/src/lib/utils";

export type { ProviderOption, SwitchStage, ModelSelectorProps };
export const ModelSetting: FC<ModelSelectorProps> = ({
  onSelectModel,
  onSelectProvider,
  className
}) => {
  const effectiveModel = selectedModel || currentModel || "openai/gpt-6-astra";
  const effectiveCurrentProvider = currentProvider || selectedProvider || "shengsuanyun";
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const isModalMode = open !== undefined ? open : internalModalOpen;
  const setModalOpen = onOpenChange || setInternalModalOpen;
  const [providerInput, setProviderInput] = useState(targetProvider || selectedProvider || effectiveCurrentProvider);
  const [isProviderOpen, setIsProviderOpen] = useState(false);
  const providerRef = useRef<HTMLDivElement>(null);
  const [modelInput, setModelInput] = useState(effectiveModel);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);
  const [chosenProvider, setChosenProvider] = useState<string>(
    targetProvider || effectiveCurrentProvider
  );
  const [chosenModel, setChosenModel] = useState<string>(effectiveModel);
  const [stage, setStage] = useState<SwitchStage>("idle");
  const [loginId, setLoginId] = useState<string | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const unsubCompletedRef = useRef<(() => void) | null>(null);
  const unsubUpdatedRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setModelInput(effectiveModel);
    setChosenModel(effectiveModel);
  }, [effectiveModel]);

  useEffect(() => {
    if (isModalMode) {
      const p = targetProvider || chosenProvider || effectiveCurrentProvider;
      setChosenProvider(p);
      setProviderInput(p);
      setStage("idle");
      setLoginId(null);

      checkAccountStatus(p);

      // If targetProvider differs from currentProvider and was explicitly opened for switch, trigger flow
      if (targetProvider && targetProvider !== effectiveCurrentProvider) {
        startSwitchFlow(targetProvider, chosenModel, currentThread || null);
      }
    } else {
      cleanupListeners();
    }
  }, [isModalMode, targetProvider]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setIsProviderOpen(false);
      }
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setIsModelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const cleanupListeners = () => {
    if (unsubCompletedRef.current) {
      unsubCompletedRef.current();
      unsubCompletedRef.current = null;
    }
    if (unsubUpdatedRef.current) {
      unsubUpdatedRef.current();
      unsubUpdatedRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  const checkAccountStatus = async (_prov?: string) => {
    try {
      const status = await CodexAuthClient.checkAccountStatus(wsClient);
      return status;
    } catch (err: any) {
      console.warn("[AccountRead] Failed:", err);
      const fallback: AccountStatusResult = {
        isLoggedIn: false,
        account: null,
        requiresOpenaiAuth: true,
        authMode: null
      };
      return fallback;
    }
  };

  // Full Provider Switch & Auth Workflow
  const startSwitchFlow = async (newProvider: string, targetModelId: string, savedThread: Thread | null) => {
    cleanupListeners();
    setStage("restarting");
    setChosenProvider(newProvider);

    try {
      let restartSucceeded = false;
      try {
        if (wsClient.status !== "connected") {
          await wsClient.connect();
        }
        const rpcRes = await wsClient.request("server/restart", {
          modelProvider: newProvider,
          codexHome: `~/.codex-${newProvider}`,
          forceRestart: true
        });
        if (rpcRes?.success || rpcRes?.activeProvider) {
          restartSucceeded = true;
        }
      } catch (wsErr: any) {
        console.warn(`WebSocket RPC restart note: ${wsErr.message}`);
      }

      // 2. HTTP Fallback if needed
      if (!restartSucceeded) {
        try {
          const restartRes = await fetch("/api/codex/servers/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              modelProvider: newProvider,
              codexHome: `~/.codex-${newProvider}`,
              forceRestart: true
            })
          });
          if (restartRes.ok) {
            restartSucceeded = true;
          }
        } catch {}
      }

      // 3. Fallback: WebSocket RPC "provider/switch"
      if (!restartSucceeded) {
        try {
          await wsClient.request("provider/switch", { provider: newProvider });
          restartSucceeded = true;
        } catch {}
      }
      wsClient.disconnect();
      await wsClient.connect();
      setStage("checking_auth");
      const authStatus = await checkAccountStatus(newProvider);

      if (authStatus.isLoggedIn) {
        await restoreThreadAndComplete(newProvider, targetModelId, savedThread);
        return;
      }

      if (!authStatus.isLoggedIn) {
        onProviderSwitched?.(newProvider);
        if (onOpenLoginModal) {
          onOpenChange?.(false);
          onOpenLoginModal(newProvider);
          return;
        }
        setStage("login_required");
        await executeLoginStart(newProvider, targetModelId, savedThread);
        return;
      }
    } catch (err: any) {
      console.error("[SwitchFlow] Error:", err);
      setStage("error");
    }
  };

  // Step 3: Initiate account/login/start
  const executeLoginStart = async (provider: string, targetModelId: string, savedThread: Thread | null) => {
    try {
      setStage("authenticating");
      const loginRes = await CodexAuthClient.startLogin(wsClient, {
        type: "chatgpt",
        appBrand: "codex",
        codexStreamlinedLogin: true,
        useHostedLoginSuccessPage: true
      });

      const returnedLoginId = loginRes.loginId;
      setLoginId(returnedLoginId);


      unsubCompletedRef.current = CodexAuthClient.listenAuthNotifications(
        wsClient,
        async (params) => {
          cleanupListeners();

          if (params?.success) {
            await checkAccountStatus(provider);
            await restoreThreadAndComplete(provider, targetModelId, savedThread);
          } else {
            const err = params?.error || "User cancelled or denied authorization";
            setStage("error");
          }
        },
      );
    } catch (err: any) {
      cleanupListeners();
      setStage("error");
    }
  };

  // Step 4: Restore active thread
  const restoreThreadAndComplete = async (newProvider: string, targetModelId: string, savedThread: Thread | null) => {
    setStage("restoring_thread");

    try {
      if (savedThread && savedThread.id) {
        try {
          const readRes = await wsClient.request("thread/read", {
            threadId: savedThread.id,
            includeTurns: true
          });
          if (readRes?.thread) {
            onThreadRestored?.(readRes.thread);
          } else {
            await wsClient.request("thread/restore", { thread: savedThread });
            onThreadRestored?.(savedThread);
          }
        } catch {
          try {
            await wsClient.request("thread/restore", { thread: savedThread });
            onThreadRestored?.(savedThread);
          } catch {}
        }
      } 
      if (onRefreshData) {
        await onRefreshData();
      }

      onSelectModel?.(targetModelId);
      onSelectProvider?.(newProvider);
      onProviderSwitched?.(newProvider);
      setStage("completed");

      setTimeout(() => {
        setModalOpen(false);
      }, 1500);
    } catch (err: any) {
      console.warn("[RestoreThread] Warning:", err);
      onSelectModel?.(targetModelId);
      onSelectProvider?.(newProvider);
      onProviderSwitched?.(newProvider);
      setStage("completed");
      setTimeout(() => {
        setModalOpen(false);
      }, 1500);
    }
  };

  const filteredProviders = useMemo(() => {
    const q = (providerInput || "").toLowerCase().trim();
    if (!q) return SUPPORTED_PROVIDERS;
    return SUPPORTED_PROVIDERS.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.home?.toLowerCase().includes(q)
    );
  }, [providerInput]);

  const hasExactProviderMatch = useMemo(() => {
    const q = (providerInput || "").toLowerCase().trim();
    return SUPPORTED_PROVIDERS.some((p) => p.id.toLowerCase() === q);
  }, [providerInput]);

  const currentProviderObj = SUPPORTED_PROVIDERS.find((p) => p.id === (chosenProvider || selectedProvider));

  const handleSelectProviderInline = (provId: string) => {
    setProviderInput(provId);
    setChosenProvider(provId);
    onSelectProvider?.(provId);
    setIsProviderOpen(false);
  };

  return(
    <div className={cn("space-y-4", className)}>
      {onSelectProvider && (
        <div className={cn("space-y-1.5 relative", isProviderOpen ? "z-30" : "z-20")} ref={providerRef}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span>Model Provider (model_provider / CODEX_HOME)</span>
            </label>
            <div className="flex items-center gap-2">
              {currentProviderObj && (
                <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">
                  {currentProviderObj.home}
                </span>
              )}
              <button type="button" onClick={() => setModalOpen(true)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer"
                title="Open Provider Switch Modal"
              >
                切换管理
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="relative flex items-center">
              <div className="absolute left-2.5 flex items-center pointer-events-none text-zinc-400">
                <Search className="w-3.5 h-3.5 text-zinc-500" />
              </div>
              <input type="text" value={providerInput}
                placeholder="Search or enter provider (e.g. codex-aws, openai, ollama)..."
                onFocus={() => setIsProviderOpen(true)}
                onChange={(e) => {
                  setProviderInput(e.target.value);
                  setIsProviderOpen(true);
                  if (e.target.value.trim()) {
                    onSelectProvider(e.target.value.trim());
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && providerInput.trim()) {
                    handleSelectProviderInline(providerInput.trim());
                  } else if (e.key === "Escape") {
                    setIsProviderOpen(false);
                  }
                }}
                className="w-full bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 rounded-lg pl-8 pr-16 py-2 text-xs text-zinc-100 placeholder-zinc-500 font-mono transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-text"
              />
              <div className="absolute right-1.5 flex items-center gap-1">
                {providerInput && (
                  <button type="button" title="Clear input"
                    onClick={() => {
                      setProviderInput("");
                      setIsProviderOpen(true);
                    }}
                    className="p-1 text-zinc-400 hover:text-zinc-200 rounded cursor-pointer transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <button type="button" title="Toggle providers list"
                  onClick={() => setIsProviderOpen(!isProviderOpen)}
                  className="p-1 text-zinc-400 hover:text-indigo-400 rounded cursor-pointer transition-colors"
                >
                  <ChevronsUpDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {isProviderOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl max-h-64 overflow-y-auto backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-150 divide-y divide-zinc-900">
                {providerInput.trim() && !hasExactProviderMatch && (
                  <button type="button"
                    onClick={() => handleSelectProviderInline(providerInput.trim())}
                    className="w-full flex items-center justify-between p-2.5 text-left text-xs bg-indigo-950/30 hover:bg-indigo-900/40 text-indigo-300 border-b border-indigo-900/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <div className="truncate">
                        <span className="font-semibold">Use custom provider: </span>
                        <span className="font-mono text-indigo-200">"{providerInput.trim()}"</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-indigo-400/80 font-mono shrink-0 ml-2">
                      ~/.codex-{providerInput.trim()}
                    </span>
                  </button>
                )}

                <div className="p-1 space-y-0.5">
                  {filteredProviders.length === 0 && hasExactProviderMatch ? null : filteredProviders.length === 0 ? (
                    <div className="p-3 text-center text-xs text-zinc-500">
                      No matching providers. Press Enter or click above to use "{providerInput}".
                    </div>
                  ) : (
                    filteredProviders.map((prov) => {
                      const isSelected = (selectedProvider || effectiveCurrentProvider) === prov.id;
                      return (
                        <button key={prov.id} type="button" onClick={() => handleSelectProviderInline(prov.id)}
                          className={cn(
                            "w-full flex items-center justify-between p-2 rounded-md text-left text-xs transition-colors cursor-pointer group",
                            isSelected
                              ? "bg-indigo-950/60 border border-indigo-500/50 text-indigo-200"
                              : "hover:bg-zinc-900 text-zinc-300 border border-transparent"
                          )}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-zinc-100 group-hover:text-indigo-300">
                                {prov.name}
                              </span>
                              <span className="text-[10px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                                {prov.id}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                              {prov.desc}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">
                              {prov.home}
                            </span>
                            {isSelected ? (
                              <Check className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <div className="w-4 h-4" />
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
