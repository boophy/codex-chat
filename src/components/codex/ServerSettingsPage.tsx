import { ArrowLeft, Server, Radio, RefreshCw, Play, Square, KeyRound, ExternalLink, Activity, CheckCircle2, XCircle, Terminal, Zap, Globe, Plus, Copy, Check, AlertTriangle } from "lucide-react";
import { ServerSettingsPageProps, BridgeProxyConfig, BridgeProxyMode, ConnectionTestResult, ServerRecord } from "@/src/types";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { CodexAuthClient } from "@/src/lib/auth-client";
import { wsClient } from "@/src/lib/websocket-client";
import { Switch } from "@/src/components/ui/switch";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Input } from "@/src/components/ui/input";
import { cn } from "@/src/lib/utils";

export type { ServerSettingsPageProps };

export const ServerSettingsPage: React.FC<ServerSettingsPageProps> = ({
  currentWsUrl,
  connectionStatus,
  diagnostics,
  currentProvider = "shengsuanyun",
  onBack,
  onSaveWsUrl,
  onFetchDiagnostics,
  onRefreshConnection
}) => {
  const [activeTab, setActiveTab] = useState<"gateway" | "instances" | "auth" | "diagnostics">("gateway");
  const [wsUrl, setWsUrl] = useState(currentWsUrl);
  const [bridgeConfig, setBridgeConfig] = useState<BridgeProxyConfig | null>(null);
  const [proxyMode, setProxyMode] = useState<BridgeProxyMode>("auto");
  const [targetUrl, setTargetUrl] = useState("");
  const [autoProxyRunning, setAutoProxyRunning] = useState(true);
  const [stripOrigin, setStripOrigin] = useState(true);
  const [experimentalApi, setExperimentalApi] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [testTargetUrl, setTestTargetUrl] = useState("");
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [serverDetails, setServerDetails] = useState<any | null>(null);
  const [newCodexHome, setNewCodexHome] = useState("~/.codex-shengsuanyun");
  const [newPort, setNewPort] = useState("8080");
  const [newProvider, setNewProvider] = useState(currentProvider || "shengsuanyun");
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [serverLogsCopied, setServerLogsCopied] = useState(false);
  const [accountType, setAccountType] = useState("chatgpt");
  const [accountResult, setAccountResult] = useState<any | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [lastLoginId, setLastLoginId] = useState<string | null>(null);
  const unsubLoginRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setWsUrl(currentWsUrl);
  }, [currentWsUrl]);

  const fetchBridgeConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/codex/bridge/config");
      if (res.ok) {
        const data: BridgeProxyConfig = await res.json();
        setBridgeConfig(data);
        setProxyMode(data.mode);
        setTargetUrl(data.targetUrl || "");
        setAutoProxyRunning(data.autoProxyRunningServer);
        setStripOrigin(data.stripOrigin);
        setExperimentalApi(data.experimentalApi);
        if (data.servers) {
          setServers(data.servers);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch bridge config:", err);
    }
  }, []);

  // Fetch Server Instances
  const fetchServers = useCallback(async () => {
    setLoadingServers(true);
    try {
      const res = await fetch("/api/codex/servers");
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingServers(false);
    }
  }, []);

  const fetchServerDetails = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/codex/servers/${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        setServerDetails(data.server);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchBridgeConfig();
    fetchServers();
    const interval = setInterval(() => {
      fetchBridgeConfig();
      fetchServers();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchBridgeConfig, fetchServers]);

  useEffect(() => {
    if (selectedServerId) {
      fetchServerDetails(selectedServerId);
      const interval = setInterval(() => fetchServerDetails(selectedServerId), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedServerId, fetchServerDetails]);

  useEffect(() => {
    return () => {
      if (unsubLoginRef.current) {
        unsubLoginRef.current();
        unsubLoginRef.current = null;
      }
    };
  }, []);

  const handleSaveBridgeConfig = async () => {
    setIsSavingConfig(true);
    setConfigSaveSuccess(false);
    try {
      const res = await fetch("/api/codex/bridge/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: proxyMode,
          targetUrl: targetUrl.trim(),
          autoProxyRunningServer: autoProxyRunning,
          activeProvider: currentProvider,
          stripOrigin,
          experimentalApi
        })
      });

      if (res.ok) {
        await fetchBridgeConfig();
        // Also update the frontend client WS URL if changed
        if (wsUrl.trim() !== currentWsUrl) {
          onSaveWsUrl(wsUrl.trim());
        }
        setConfigSaveSuccess(true);
        setTimeout(() => setConfigSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save bridge config:", err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Test Connection
  const handleTestConnection = async (target?: string) => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const probeTarget = target || testTargetUrl || targetUrl || bridgeConfig?.resolvedUpstream || "ws://127.0.0.1:8080";
      const res = await fetch("/api/codex/bridge/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: probeTarget })
      });
      if (res.ok) {
        const data: ConnectionTestResult = await res.json();
        setTestResult(data);
      } else {
        setTestResult({
          ok: false,
          error: `HTTP ${res.status}: ${res.statusText}`
        });
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        error: err.message || "Failed to execute connection test"
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleStartServer = async () => {
    setIsStartingServer(true);
    try {
      const res = await fetch("/api/codex/servers/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codexHome: newCodexHome.trim(),
          listenPort: newPort ? parseInt(newPort, 10) : undefined,
          modelProvider: newProvider.trim(),
          forceRestart: true
        })
      });
      if (res.ok) {
        const data = await res.json();
        await fetchServers();
        await fetchBridgeConfig();
        if (data.server?.id) {
          setSelectedServerId(data.server.id);
        }
      }
    } catch (e) {
      console.error("Failed to start server instance:", e);
    } finally {
      setIsStartingServer(false);
    }
  };

  const handleStopServer = async (id: string) => {
    try {
      await fetch(`/api/codex/servers/${encodeURIComponent(id)}/stop`, { method: "POST" });
      await fetchServers();
      await fetchBridgeConfig();
      if (selectedServerId === id) {
        await fetchServerDetails(id);
      }
    } catch (e) {
      console.error("Failed to stop server:", e);
    }
  };

  const handleSetInstanceAsUpstream = async (server: ServerRecord) => {
    setProxyMode("direct");
    setTargetUrl(server.listen_addr);
    setIsSavingConfig(true);
    try {
      await fetch("/api/codex/bridge/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "direct",
          targetUrl: server.listen_addr,
          autoProxyRunningServer: false,
          activeProvider: server.model_provider,
          stripOrigin: true
        })
      });
      await fetchBridgeConfig();
      // Ensure frontend WS connects via proxy or direct
      if (wsUrl !== "/ws") {
        setWsUrl("/ws");
        onSaveWsUrl("/ws");
      }
      setConfigSaveSuccess(true);
      setTimeout(() => setConfigSaveSuccess(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Account Flow Actions
  const handleAccountAction = async (action: "start" | "cancel" | "logout" | "read") => {
    setAccountLoading(true);
    setAccountResult(null);
    try {
      if (action === "read") {
        const res = await CodexAuthClient.checkAccountStatus(wsClient);
        setAccountResult({
          method: "account/read",
          transport: "WebSocket JSON-RPC",
          timestamp: new Date().toLocaleTimeString(),
          result: res
        });
      } else if (action === "start") {
        const startRes = await CodexAuthClient.startLogin(wsClient, {
          type: accountType,
          appBrand: "codex",
          codexStreamlinedLogin: true,
          useHostedLoginSuccessPage: true
        });
        setLastLoginId(startRes.loginId);
        setAccountResult({
          method: "account/login/start",
          transport: "WebSocket JSON-RPC",
          timestamp: new Date().toLocaleTimeString(),
          result: startRes
        });
        if (startRes.authUrl) {
          CodexAuthClient.openAuthInBrowser(startRes.authUrl);
        }
        if (unsubLoginRef.current) unsubLoginRef.current();
        unsubLoginRef.current = CodexAuthClient.listenAuthNotifications(
          wsClient,
          (completed) => {
            setAccountResult((prev: any) => ({
              ...prev,
              latestNotification: "account/login/completed",
              completedNotification: completed,
              completedAt: new Date().toLocaleTimeString()
            }));
          },
          (updated) => {
            setAccountResult((prev: any) => ({
              ...prev,
              latestNotification: "account/updated",
              updatedNotification: updated,
              updatedAt: new Date().toLocaleTimeString()
            }));
          }
        );
      } else if (action === "cancel") {
        const cancelRes = await CodexAuthClient.cancelLogin(wsClient, lastLoginId || "manual-cancel");
        setAccountResult({
          method: "account/login/cancel",
          transport: "WebSocket JSON-RPC",
          timestamp: new Date().toLocaleTimeString(),
          result: cancelRes
        });
      } else if (action === "logout") {
        await CodexAuthClient.logout(wsClient);
        setAccountResult({
          method: "account/logout",
          transport: "WebSocket JSON-RPC",
          timestamp: new Date().toLocaleTimeString(),
          result: { success: true, message: "Logged out. Credentials and active token cleared." }
        });
      }
    } catch (err: any) {
      setAccountResult({
        error: err.message || "Failed to execute RPC action",
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setAccountLoading(false);
    }
  };

  const copyLogs = () => {
    if (serverDetails?.logs) {
      navigator.clipboard.writeText(serverDetails.logs.join("\n"));
      setServerLogsCopied(true);
      setTimeout(() => setServerLogsCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden select-none">
      <header className="h-14 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} title="Return to Chat"
            className="h-8 px-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-medium">Back to Chat</span>
          </Button>

          <div className="h-4 w-px bg-zinc-800 hidden sm:block" />
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-zinc-100 truncate">
                  Backend Service & Gateway Manager
                </h1>
                <Badge variant={connectionStatus === "connected" ? "success" : "secondary"}
                  className="text-[10px] py-0 hidden md:inline-flex items-center gap-1"
                >
                  <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      connectionStatus === "connected" ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
                    )}
                  />
                  {connectionStatus}
                </Badge>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono truncate hidden sm:block">
                {bridgeConfig?.resolvedUpstream
                  ? `Proxying → ${bridgeConfig.resolvedUpstream}`
                  : `Mode: ${proxyMode} (Mock/Embedded Engine)`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" size="sm" variant="outline" disabled={loadingServers}
            onClick={() => {
              fetchBridgeConfig();
              fetchServers();
              onFetchDiagnostics();
            }}
            className="h-8 text-xs border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 gap-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loadingServers && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button type="button" size="sm" variant="outline" onClick={() => handleTestConnection()} disabled={testingConnection}
            className="h-8 text-xs border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-amber-300 hover:text-amber-200 gap-1.5"
          >
            <Activity className={cn("w-3.5 h-3.5", testingConnection && "animate-spin")} />
            <span className="hidden md:inline">Test Upstream</span>
          </Button>

          <Button type="button" size="sm" onClick={handleSaveBridgeConfig} disabled={isSavingConfig}
            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 shadow-sm"
          >
            {configSaveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Saved & Applied</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>{isSavingConfig ? "Saving..." : "Apply & Connect"}</span>
              </>
            )}
          </Button>
        </div>
      </header>

      <div className="border-b border-zinc-800/80 bg-zinc-950/90 px-4 sm:px-6 flex items-center justify-between shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1 sm:gap-2 py-2">
          <button type="button" onClick={() => setActiveTab("gateway")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer",
              activeTab === "gateway"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
            )}
          >
            <Radio className="w-3.5 h-3.5 text-indigo-400" />
            <span>Connection & Proxy Gateway</span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 border-zinc-700">
              {proxyMode}
            </Badge>
          </button>

          <button type="button" onClick={() => setActiveTab("instances")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer",
              activeTab === "instances"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
            )}
          >
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span>Process & Instances</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-300 font-mono">
              {servers.length}
            </span>
          </button>

          <button type="button" onClick={() => setActiveTab("auth")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer",
              activeTab === "auth"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
            )}
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>OAuth & Account Auth</span>
          </button>

          <button type="button" onClick={() => setActiveTab("diagnostics")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer",
              activeTab === "diagnostics"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
            )}
          >
            <Activity className="w-3.5 h-3.5 text-rose-400" />
            <span>System Diagnostics & Guide</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-6xl w-full mx-auto">
        {activeTab === "gateway" && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-indigo-400" />
                    WebSocket Client Endpoint & Routing Strategy
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Configure frontend connection and how the Codex Bridge forwards RPC packets to upstream servers.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={connectionStatus === "connected" ? "success" : "secondary"}>
                    {connectionStatus}
                  </Badge>
                  {bridgeConfig?.resolvedUpstream && (
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-2 py-0.5 rounded">
                      Upstream: {bridgeConfig.resolvedUpstream}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-medium text-zinc-300">
                  Client WebSocket Endpoint (Used by browser)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} placeholder="ws://127.0.0.1:8080 or /ws"
                    className="font-mono text-xs bg-zinc-950 border-zinc-800 text-zinc-200"
                  />
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => {
                      onSaveWsUrl(wsUrl.trim());
                      onRefreshConnection?.();
                    }}
                    className="text-xs border-zinc-800 shrink-0"
                  >
                    Save Client URL
                  </Button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="text-zinc-500 text-[11px]">Recommended Presets:</span>
                  <button type="button"
                    onClick={() => {
                      setWsUrl("/ws");
                      setProxyMode("auto");
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded text-[11px] font-mono transition-colors border cursor-pointer",
                      wsUrl === "/ws"
                        ? "bg-indigo-950/80 border-indigo-500 text-indigo-200 font-semibold"
                        : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100"
                    )}
                  >
                    /ws (Smart Proxy — Fixes 403)
                  </button>
                  <button type="button" onClick={() => setWsUrl("ws://127.0.0.1:8081")}
                    className={cn(
                      "px-2.5 py-1 rounded text-[11px] font-mono transition-colors border cursor-pointer",
                      wsUrl === "ws://127.0.0.1:8081"
                        ? "bg-indigo-950/80 border-indigo-500 text-indigo-200 font-semibold"
                        : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100"
                    )}
                  >
                    ws://127.0.0.1:8081 (Bridge Standalone)
                  </button>
                  <button type="button" onClick={() => setWsUrl("ws://127.0.0.1:8080")}
                    className={cn(
                      "px-2.5 py-1 rounded text-[11px] font-mono transition-colors border cursor-pointer",
                      wsUrl === "ws://127.0.0.1:8080"
                        ? "bg-indigo-950/80 border-indigo-500 text-indigo-200 font-semibold"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    ws://127.0.0.1:8080 (Direct Codex Server)
                  </button>
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <label className="text-xs font-medium text-zinc-300">
                  Bridge Proxy Mode (How bridge handles upstream traffic)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div onClick={() => setProxyMode("auto")}
                    className={cn(
                      "p-3.5 rounded-lg border transition-all cursor-pointer space-y-1.5",
                      proxyMode === "auto"
                        ? "bg-indigo-950/40 border-indigo-500/80 shadow-sm"
                        : "bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-indigo-400" />
                        Auto Proxy
                      </span>
                      {proxyMode === "auto" && (
                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Automatically detects running instances. Forwards to the active server, or falls back to mock.
                    </p>
                  </div>

                  <div onClick={() => setProxyMode("direct")}
                    className={cn(
                      "p-3.5 rounded-lg border transition-all cursor-pointer space-y-1.5",
                      proxyMode === "direct"
                        ? "bg-emerald-950/40 border-emerald-500/80 shadow-sm"
                        : "bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        Direct Upstream
                      </span>
                      {proxyMode === "direct" && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Always proxies all traffic to the designated Target URL below with origin stripping.
                    </p>
                  </div>

                  <div onClick={() => setProxyMode("mock")}
                    className={cn(
                      "p-3.5 rounded-lg border transition-all cursor-pointer space-y-1.5",
                      proxyMode === "mock"
                        ? "bg-amber-950/40 border-amber-500/80 shadow-sm"
                        : "bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-amber-400" />
                        Local Mock Engine
                      </span>
                      {proxyMode === "mock" && (
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Uses the embedded JSON-RPC mock engine for offline testing, prototyping, and thread simulation.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-zinc-300">
                    Upstream Server Target URL
                  </label>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    e.g. ws://127.0.0.1:8080
                  </span>
                </div>
                <div className="flex gap-2">
                  <Input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="ws://127.0.0.1:8080"
                    className="font-mono text-xs bg-zinc-950 border-zinc-800 text-zinc-200"
                  />
                  {servers.length > 0 && (
                    <select defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) setTargetUrl(e.target.value);
                      }}
                      className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded px-2 font-mono"
                    >
                      <option value="" disabled>Pick running server...</option>
                      {servers.map((s) => (
                        <option key={s.id} value={s.listen_addr}>
                          {s.id} ({s.model_provider} - {s.listen_addr})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between">
                  <div className="space-y-0.5 pr-2">
                    <div className="text-xs font-medium text-zinc-200">
                      Strip Origin Header (Bypasses 403)
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      Removes browser origin header to avoid rejection by codex-app-server.
                    </div>
                  </div>
                  <Switch checked={stripOrigin} onCheckedChange={setStripOrigin} />
                </div>

                <div className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between">
                  <div className="space-y-0.5 pr-2">
                    <div className="text-xs font-medium text-zinc-200">
                      Auto-route to Running Server
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      Automatically binds proxy to freshly launched codex process.
                    </div>
                  </div>
                  <Switch checked={autoProxyRunning} onCheckedChange={setAutoProxyRunning} />
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-semibold text-zinc-200">
                    Live Upstream Health & Handshake Prober
                  </h3>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => handleTestConnection()}
                  disabled={testingConnection}
                  className="h-7 text-xs border-zinc-700 gap-1.5"
                >
                  <RefreshCw className={cn("w-3 h-3", testingConnection && "animate-spin")} />
                  <span>Run Probe Now</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                  <span className="text-zinc-400">/readyz Probe:</span>
                  <span className={cn(
                      "flex items-center gap-1.5 font-semibold",
                      testResult?.readyzOk ? "text-emerald-400" : "text-amber-400"
                    )}
                  >
                    {testResult?.readyzOk ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    {testResult?.readyzText || (testResult ? "Offline" : "Untested")} ({testResult?.readyzCode || 0})
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                  <span className="text-zinc-400">/healthz Probe:</span>
                  <span className={cn(
                      "flex items-center gap-1.5 font-semibold",
                      testResult?.healthzOk ? "text-emerald-400" : "text-amber-400"
                    )}
                  >
                    {testResult?.healthzOk ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    {testResult?.healthzText || (testResult ? "Offline" : "Untested")} ({testResult?.healthzCode || 0})
                  </span>
                </div>
              </div>

              {testResult && (
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Roundtrip Probe Latency:</span>
                    <span className="text-indigo-400 font-semibold">{testResult.latencyMs} ms</span>
                  </div>
                  {testResult.error && (
                    <div className="text-rose-400 text-[11px] pt-1 border-t border-zinc-800/60">
                      Error: {testResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200/90 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Why Direct ws://127.0.0.1:8080 Returns HTTP 403 Forbidden:</span>
              </div>
              <p className="text-zinc-300 text-[11px] leading-relaxed">
                The native <code className="text-amber-300 font-mono">codex app-server</code> inspects incoming WebSocket handshake headers and forcibly rejects any request containing an <code className="text-amber-300 font-mono">Origin</code> header. Standard web browsers cannot omit this header when connecting directly.
              </p>
              <p className="text-zinc-300 text-[11px] leading-relaxed">
                👉 <strong>Solution:</strong> By connecting your client to <code className="text-indigo-300 font-mono font-bold">/ws</code>, the bridge proxy strips the Origin header on the server side before forwarding packets to the target Codex server, completely bypassing the 403 rejection.
              </p>
            </div>
          </div>
        )}

        {activeTab === "instances" && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Launch New Codex App-Server Instance
                  </h2>
                </div>
                <span className="text-xs text-zinc-500 font-mono">codex app-server --listen</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400">
                    CODEX_HOME (Directory for config & auth.json)
                  </label>
                  <input type="text" value={newCodexHome} placeholder="~/.codex-shengsuanyun"
                    onChange={(e) => {
                      setNewCodexHome(e.target.value);
                      if (e.target.value.includes(".")) {
                        const clean = e.target.value.split(".").pop()?.replace(/[^a-zA-Z0-9_-]/g, "");
                        if (clean) setNewProvider(clean);
                      }
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400">
                    Model Provider Identifier
                  </label>
                  <input type="text" value={newProvider} onChange={(e) => setNewProvider(e.target.value)} placeholder="shengsuanyun"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400">
                    Listen Port & Trigger
                  </label>
                  <div className="flex gap-2">
                    <input type="number" value={newPort} onChange={(e) => setNewPort(e.target.value)} placeholder="8080"
                      className="w-24 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono"
                    />
                    <Button type="button" size="sm" onClick={handleStartServer} disabled={isStartingServer}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs rounded-lg"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isStartingServer ? "Starting..." : "Start Process"}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-zinc-200">
                  Registered Server Instances ({servers.length})
                </h3>
                <span className="text-[11px] text-zinc-500 font-mono">
                  Managed by bridge & SQLite
                </span>
              </div>

              {servers.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-xs">
                  No registered server instances yet. Launch one above.
                </div>
              ) : (
                <div className="space-y-2">
                  {servers.map((s) => {
                    const isRunning = s.status === "running";
                    const isSelected = selectedServerId === s.id;
                    const isCurrentUpstream = bridgeConfig?.resolvedUpstream === s.listen_addr;

                    return (
                      <div key={s.id}
                        className={cn(
                          "p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3",
                          isSelected
                            ? "bg-zinc-900/90 border-zinc-700"
                            : "bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900/70"
                        )}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={cn(
                              "w-3 h-3 rounded-full mt-1 shrink-0",
                              isRunning ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
                            )}
                          />
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-zinc-100">{s.id}</span>
                              <Badge variant={isRunning ? "success" : "secondary"} className="text-[10px] py-0">
                                {s.status}
                              </Badge>
                              {isCurrentUpstream && (
                                <Badge variant="purple" className="text-[10px] py-0">
                                  Current Proxy Target
                                </Badge>
                              )}
                              {s.pid && (
                                <span className="text-[11px] text-zinc-400 font-mono">PID: {s.pid}</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 font-mono">
                              <span>Addr: <strong className="text-zinc-200">{s.listen_addr}</strong></span>
                              <span>Provider: <strong className="text-zinc-200">{s.model_provider}</strong></span>
                              <span className="text-zinc-500 truncate max-w-xs">{s.codex_home}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                          {!isCurrentUpstream && isRunning && (
                            <Button type="button" size="sm" variant="outline" onClick={() => handleSetInstanceAsUpstream(s)}
                              className="text-xs border-indigo-700 text-indigo-300 hover:bg-indigo-950/80 gap-1"
                            >
                              <Zap className="w-3 h-3" />
                              <span>Route Traffic Here</span>
                            </Button>
                          )}

                          <Button type="button" size="sm" variant="outline"
                            onClick={() => setSelectedServerId(isSelected ? null : s.id)}
                            className="text-xs border-zinc-700"
                          >
                            {isSelected ? "Hide Logs" : "View Logs"}
                          </Button>

                          {isRunning ? (
                            <Button type="button" size="sm" variant="destructive"
                              onClick={() => handleStopServer(s.id)}
                              className="text-xs gap-1"
                            >
                              <Square className="w-3 h-3 fill-current" />
                              <span>Stop</span>
                            </Button>
                          ) : (
                            <Button type="button" size="sm" variant="outline"
                              onClick={() => {
                                setNewCodexHome(s.codex_home);
                                setNewPort(s.listen_port.toString());
                                setNewProvider(s.model_provider);
                                handleStartServer();
                              }}
                              className="text-xs border-emerald-800 text-emerald-400 hover:bg-emerald-950/80 gap-1"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Restart</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedServerId && serverDetails && (
              <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    <span className="font-semibold text-zinc-200">
                      Process Terminal Logs: {serverDetails.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={copyLogs}
                      className="h-7 text-xs text-zinc-400 hover:text-zinc-100 gap-1"
                    >
                      {serverLogsCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{serverLogsCopied ? "Copied" : "Copy"}</span>
                    </Button>
                    <span className="text-[11px] font-mono text-zinc-500">
                      Updated: {new Date(serverDetails.updated_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-black/90 font-mono text-xs text-zinc-300 max-h-60 overflow-y-auto space-y-1 border border-zinc-900">
                  {serverDetails.logs && serverDetails.logs.length > 0 ? (
                    serverDetails.logs.map((line: string, idx: number) => (
                      <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                        {line}
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-600">No output logs recorded yet for this instance.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "auth" && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    Account Authentication & OAuth Flow (account/*)
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Trigger and test the official Codex authentication JSON-RPC methods against the active server.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs text-zinc-400 font-mono self-start sm:self-auto">
                  Active Provider: {currentProvider}
                </Badge>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300">
                  Target Account Type:
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {["chatgpt", "openai", "aws", "github"].map((type) => (
                    <button key={type} type="button" onClick={() => setAccountType(type)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-mono transition-colors border cursor-pointer",
                        accountType === type
                          ? "bg-amber-950/60 border-amber-500 text-amber-200 font-semibold"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-2">
                <Button  type="button"  size="sm"  variant="outline"  disabled={accountLoading}
                  onClick={() => handleAccountAction("start")}
                  className="text-amber-300 hover:text-amber-200 border-amber-800/60 text-xs gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>account/login/start</span>
                </Button>

                <Button type="button" size="sm" variant="outline" disabled={accountLoading}
                  onClick={() => handleAccountAction("cancel")}
                  className="text-zinc-300 text-xs border-zinc-700"
                >
                  <span>account/login/cancel</span>
                </Button>

                <Button type="button" size="sm" variant="outline" disabled={accountLoading}
                  onClick={() => handleAccountAction("read")}
                  className="text-indigo-300 hover:text-indigo-200 border-indigo-900/60 text-xs gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>account/read</span>
                </Button>

                <Button type="button" size="sm" variant="outline" disabled={accountLoading}
                  onClick={() => handleAccountAction("logout")}
                  className="text-rose-400 hover:text-rose-300 border-rose-900/60 text-xs"
                >
                  <span>account/logout</span>
                </Button>
              </div>

              {accountResult && (
                <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 space-y-2.5 mt-4">
                  <div className="flex items-center justify-between text-zinc-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                      JSON-RPC Response ({accountResult.transport || "WebSocket"}):
                    </span>
                    {accountResult?.latestNotification && (
                      <Badge variant="purple" className="text-[10px] py-0">
                        {accountResult.latestNotification}
                      </Badge>
                    )}
                  </div>

                  {accountResult?.result?.authUrl && (
                    <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-semibold text-indigo-200">
                          OAuth Login URL Generated
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate max-w-md">
                          {accountResult.result.authUrl}
                        </div>
                      </div>
                      <Button size="sm"
                        onClick={() => CodexAuthClient.openAuthInBrowser(accountResult.result.authUrl)}
                        className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open in Browser</span>
                      </Button>
                    </div>
                  )}

                  <pre className="text-zinc-400 overflow-x-auto text-[11px] bg-zinc-900/70 p-3 rounded-lg border border-zinc-900 leading-relaxed">
                    {JSON.stringify(accountResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "diagnostics" && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Live Server Process Diagnostics
                  </h2>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={onFetchDiagnostics}
                  className="h-7 text-xs border-zinc-700 gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Query /diagnostics</span>
                </Button>
              </div>

              {diagnostics?.process ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-500 text-[11px]">Process ID</span>
                    <div className="text-sm font-semibold text-zinc-200 mt-1">
                      {diagnostics.process.id}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-500 text-[11px]">Resident Memory (RSS)</span>
                    <div className="text-sm font-semibold text-emerald-400 mt-1">
                      {(diagnostics.process.residentMemoryBytes / (1024 * 1024)).toFixed(1)} MB
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-500 text-[11px]">Virtual Memory</span>
                    <div className="text-sm font-semibold text-indigo-400 mt-1">
                      {(diagnostics.process.virtualMemoryBytes / (1024 * 1024)).toFixed(1)} MB
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-500">
                  Click &ldquo;Query /diagnostics&rdquo; above to query runtime metrics from the connected server.
                </div>
              )}

              {diagnostics?.gauges && diagnostics.gauges.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-medium text-zinc-300">Server Metrics & Gauges</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                    {diagnostics.gauges.map((g, idx) => (
                      <div key={idx}
                        className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between"
                      >
                        <span className="text-zinc-400">{g.name}</span>
                        <span className="text-zinc-200 font-semibold">{g.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-semibold text-zinc-200">
                  Codex CLI Terminal Commands Reference
                </h3>
              </div>

              <div className="bg-black/90 rounded-lg p-3.5 font-mono text-xs text-zinc-300 border border-zinc-900 space-y-3">
                <div>
                  <div className="text-emerald-400 font-semibold text-[11px]">
                    # 1. Launch native codex app-server listening on port 8080
                  </div>
                  <div className="text-zinc-400 mt-0.5">
                    ./codex app-server --listen ws://127.0.0.1:8080
                  </div>
                </div>

                <div>
                  <div className="text-indigo-400 font-semibold text-[11px]">
                    # 2. Launch with custom CODEX_HOME
                  </div>
                  <div className="text-zinc-400 mt-0.5">
                    CODEX_HOME=~/.codex-shengsuanyun ./codex app-server --listen ws://127.0.0.1:8080
                  </div>
                </div>

                <div>
                  <div className="text-purple-400 font-semibold text-[11px]">
                    # 3. Launch dedicated WebSocket bridge
                  </div>
                  <div className="text-zinc-400 mt-0.5">
                    npm run codex:bridge
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
