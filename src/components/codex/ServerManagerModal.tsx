import { Server, Play, Square, RefreshCw, Terminal, KeyRound, ExternalLink, Plus, Check, ArrowLeft, Activity, CheckCircle2, XCircle, Copy, ChevronRight, Wifi, Radio, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/src/components/ui/dialog";
import { ServerManagerModalProps, ConnectionTestResult, ServerRecord } from "@/src/types";
import { FC, useEffect, useState, useRef, useCallback } from "react";
import { CodexAuthClient } from "@/src/lib/auth-client";
import { wsClient } from "@/src/lib/websocket-client";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Badge } from "@/src/components/ui/badge";
import { cn } from "@/src/lib/utils";

export type { ServerManagerModalProps };

export const ServerManagerModal: FC<ServerManagerModalProps> = ({
  open,
  onOpenChange,
  onOpenFullPage,
}) => {
  const [activeView, setActiveView] = useState<"list" | "testing">("list");
  const [selectedServer, setSelectedServer] = useState<ServerRecord | any | null>(null);
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverDetails, setServerDetails] = useState<any | null>(null);
  const [newCodexHome, setNewCodexHome] = useState("~/.codex-shengsuanyun");
  const [newPort, setNewPort] = useState("8080");
  const [newProvider, setNewProvider] = useState("codex-shengsuanyun");
  const [isStarting, setIsStarting] = useState(false);

  // Testing View State (from SettingsModal)
  const [testWsUrl, setTestWsUrl] = useState<string>("");
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<ConnectionTestResult & { wsOk?: boolean; wsMessage?: string } | null>(null);
  const [appliedSuccess, setAppliedSuccess] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);

  // Account Authentication Flow State
  const [accountType, setAccountType] = useState("chatgpt");
  const [accountResult, setAccountResult] = useState<any | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [lastLoginId, setLastLoginId] = useState<string | null>(null);
  const unsubLoginRef = useRef<(() => void) | null>(null);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/codex/servers");
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
      }
    } catch (e) {
      console.error("Failed to fetch servers:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchServerDetails = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/codex/servers/${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        setServerDetails(data.server);
        if (selectedServer && selectedServer.id === id) {
          setSelectedServer(data.server);
        }
      }
    } catch (e) {
      console.error("Failed to fetch server details:", e);
    }
  }, [selectedServer]);

  useEffect(() => {
    if (open) {
      fetchServers();
      const interval = setInterval(fetchServers, 4000);
      return () => clearInterval(interval);
    } else {
      setActiveView("list");
      setSelectedServer(null);
      setHealthStatus(null);
      setAppliedSuccess(false);
    }
  }, [open, fetchServers]);

  useEffect(() => {
    if (selectedServer?.id) {
      fetchServerDetails(selectedServer.id);
      const interval = setInterval(() => fetchServerDetails(selectedServer.id), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedServer?.id, fetchServerDetails]);

  useEffect(() => {
    return () => {
      if (unsubLoginRef.current) {
        unsubLoginRef.current();
        unsubLoginRef.current = null;
      }
    };
  }, []);

  // Launch a new server process
  const handleStartServer = async () => {
    setIsStarting(true);
    try {
      const res = await fetch("/api/codex/servers/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codexHome: newCodexHome,
          listenPort: newPort ? parseInt(newPort, 10) : undefined,
          modelProvider: newProvider
        })
      });
      if (res.ok) {
        await fetchServers();
      }
    } catch (e) {
      console.error("Failed to start server:", e);
    } finally {
      setIsStarting(false);
    }
  };

  // Stop a server process
  const handleStopServer = async (id: string) => {
    try {
      await fetch(`/api/codex/servers/${encodeURIComponent(id)}/stop`, { method: "POST" });
      await fetchServers();
      if (selectedServer?.id === id) {
        await fetchServerDetails(id);
      }
    } catch (e) {
      console.error("Failed to stop server:", e);
    }
  };

  const handleStartSpecificServer = async (s: ServerRecord | any) => {
    try {
      await fetch("/api/codex/servers/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codexHome: s.codex_home || s.codexHome,
          listenPort: s.listen_port || s.listenPort,
          modelProvider: s.model_provider || s.modelProvider,
          forceRestart: true
        })
      });
      await fetchServers();
      if (s.id) {
        await fetchServerDetails(s.id);
      }
    } catch (e) {
      console.error("Failed to start specific server:", e);
    }
  };

  // Click on a server item -> Switch to Testing View
  const handleSelectServerForTesting = (s: ServerRecord) => {
    setSelectedServer(s);
    setActiveView("testing");
    setHealthStatus(null);
    setAppliedSuccess(false);

    // Default to origin-stripping proxy route or direct listen port
    const defaultUrl = s.listen_port
      ? `/ws?port=${s.listen_port}&provider=${s.model_provider}`
      : (s.listen_addr || "/ws");
    setTestWsUrl(defaultUrl);
    fetchServerDetails(s.id);
  };

  // Return back to instance list
  const handleBackToList = () => {
    setActiveView("list");
    setSelectedServer(null);
    setHealthStatus(null);
    setAppliedSuccess(false);
    fetchServers();
  };

  // Test server health and availability (/readyz, /healthz, and probe)
  const handleCheckHealth = async () => {
    if (!selectedServer) return;
    setCheckingHealth(true);
    setHealthStatus(null);

    const startTime = Date.now();
    try {
      // 1. Probe via server-side bridge test-connection endpoint
      const probeTarget = testWsUrl.trim() || selectedServer.listen_addr;
      const res = await fetch("/api/codex/bridge/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: probeTarget })
      });

      let probeData: ConnectionTestResult = { ok: false, latencyMs: Date.now() - startTime };
      if (res.ok) {
        probeData = await res.json();
      } else {
        probeData.error = `HTTP ${res.status}: Probe endpoint unavailable`;
      }

      // 2. Also check if active server is marked running
      const isRunning = selectedServer.status === "running";
      let wsMessage = isRunning ? "Server process is active" : "Server is stopped";

      if (probeData.ok) {
        wsMessage = "HTTP /readyz & /healthz responded successfully";
      } else if (!isRunning) {
        wsMessage = "Process is stopped. Click 'Start Process' to launch it.";
      }

      setHealthStatus({
        ...probeData,
        latencyMs: probeData.latencyMs || (Date.now() - startTime),
        wsOk: probeData.ok || isRunning,
        wsMessage
      });
    } catch (err: any) {
      setHealthStatus({
        ok: false,
        latencyMs: Date.now() - startTime,
        error: err?.message || "Failed to query health endpoints",
        wsOk: false,
        wsMessage: "Connection probe error"
      });
    } finally {
      setCheckingHealth(false);
    }
  };

  // Apply tested URL to app
  const handleApplyWsUrl = () => {
    const finalUrl = testWsUrl.trim();
    if (!finalUrl) return;

    if (onSaveWsUrl) {
      onSaveWsUrl(finalUrl);
    } else {
      wsClient.setUrl(finalUrl);
      wsClient.reconnect();
    }

    setAppliedSuccess(true);
    setTimeout(() => setAppliedSuccess(false), 3000);
  };

  // Copy logs to clipboard
  const handleCopyLogs = () => {
    if (!serverDetails?.logs) return;
    navigator.clipboard.writeText(serverDetails.logs.join("\n"));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  // Account actions (account/login/start, cancel, logout, read)
  const handleAccountAction = async (action: "start" | "cancel" | "logout" | "read") => {
    setAccountLoading(true);
    setAccountResult(null);
    try {
      if (action === "read") {
        const res = await CodexAuthClient.checkAccountStatus(wsClient);
        setAccountResult({
          method: "account/read",
          transport: "WebSocket JSON-RPC",
          result: res
        });
      } else if (action === "start") {
        const startRes = await CodexAuthClient.startLogin(wsClient, {
          type: "chatgpt",
          appBrand: "codex",
          codexStreamlinedLogin: true,
          useHostedLoginSuccessPage: true
        });
        setLastLoginId(startRes.loginId);
        setAccountResult({
          method: "account/login/start",
          transport: "WebSocket JSON-RPC",
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
              completedNotification: completed
            }));
          },
          (updated) => {
            setAccountResult((prev: any) => ({
              ...prev,
              latestNotification: "account/updated",
              updatedNotification: updated
            }));
          }
        );
      } else if (action === "cancel") {
        const cancelRes = await CodexAuthClient.cancelLogin(wsClient, lastLoginId || "manual-cancel");
        setAccountResult({
          method: "account/login/cancel",
          transport: "WebSocket JSON-RPC",
          result: cancelRes
        });
      } else if (action === "logout") {
        await CodexAuthClient.logout(wsClient);
        setAccountResult({
          method: "account/logout",
          transport: "WebSocket JSON-RPC",
          result: { success: true, message: "Logged out. Credentials cleared." }
        });
      }
    } catch (err: any) {
      setAccountResult({ error: err.message });
    } finally {
      setAccountLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/40 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {activeView === "testing" ? (
              <Button type="button" size="sm" variant="ghost" onClick={handleBackToList}
                className="text-xs text-zinc-300 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 gap-1.5 h-8 px-2.5"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-indigo-400" />
                <span>Back to List</span>
              </Button>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Server className="w-4 h-4" />
              </div>
            )}

            <div>
              <DialogTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                {activeView === "testing" && selectedServer ? (
                  <>
                    <span>Server Diagnostics & Connection</span>
                    <Badge variant="outline" className="text-[10px] font-mono border-zinc-700 bg-zinc-900 text-zinc-300">
                      {selectedServer.id}
                    </Badge>
                  </>
                ) : (
                  <span>Codex App-Server Process Manager</span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                {activeView === "testing" && selectedServer ? (
                  <span>Test port availability, probe /readyz & /healthz, and switch app connection endpoint</span>
                ) : (
                  <span>Manage backend instances, ports, and click any server to test its availability and connection</span>
                )}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenFullPage && activeView === "list" && (
              <Button type="button" size="sm" variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onOpenFullPage();
                }}
                className="text-xs border-indigo-800/80 bg-indigo-950/40 text-indigo-200 hover:bg-indigo-900/60 gap-1.5 h-8"
              >
                <span>Full Page View</span>
              </Button>
            )}

            <Button type="button" size="sm" variant="ghost" disabled={loading}
              onClick={activeView === "testing" && selectedServer ? () => fetchServerDetails(selectedServer.id) : fetchServers}
              className="text-zinc-400 hover:text-zinc-100 gap-1 text-xs h-8 px-2.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              <span>Refresh</span>
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {activeView === "list" ? (
            <>
              <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Launch New Server Instance</span>
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">codex app-server --listen</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400">CODEX_HOME (Auto-created if absent)</label>
                    <input type="text" value={newCodexHome} placeholder="~/.codex-shengsuanyun"
                      onChange={(e) => {
                        setNewCodexHome(e.target.value);
                        if (e.target.value.includes(".")) {
                          const clean = e.target.value.split(".").pop()?.replace(/[^a-zA-Z0-9_-]/g, "");
                          if (clean) setNewProvider(clean);
                        }
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400">Model Provider Identifier</label>
                    <input type="text" value={newProvider} placeholder="codex-aws" onChange={(e) => setNewProvider(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400">Listen Port</label>
                    <div className="flex gap-2">
                      <input type="number" value={newPort} placeholder="8080" onChange={(e) => setNewPort(e.target.value)}
                        className="w-24 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono"
                      />
                      <Button type="button" size="sm" onClick={handleStartServer} disabled={isStarting}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white gap-1 text-xs"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>{isStarting ? "Starting..." : "Start Process"}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-200">Running / Registered Instances ({servers.length})</span>
                    <span className="text-[11px] text-zinc-500 hidden sm:inline">
                      (Click any row to test availability & inspect connection)
                    </span>
                  </div>
                  <span className="text-[11px] text-indigo-400 flex items-center gap-1 font-medium">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Select server to test</span>
                  </span>
                </div>

                {servers.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-zinc-800 rounded-lg text-zinc-500 space-y-1">
                    <div>No active or registered codex app-server processes.</div>
                    <div className="text-xs text-zinc-600">Start one above or click New Thread to spawn automatically.</div>
                  </div>
                ) : (
                  <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800 bg-zinc-900/30">
                    {servers.map((s) => {
                      const isRunning = s.status === "running";
                      return (
                        <div key={s.id} role="button" tabIndex={0}
                          onClick={() => handleSelectServerForTesting(s)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectServerForTesting(s);
                            }
                          }}
                          className={cn(
                            "p-3.5 flex items-center justify-between transition-all cursor-pointer group text-left",
                            "hover:bg-zinc-850 hover:border-l-2 hover:border-l-indigo-500 bg-zinc-900/40"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                            <div className={cn(
                                "w-2.5 h-2.5 rounded-full shrink-0",
                                isRunning ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-zinc-600"
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-zinc-200 group-hover:text-indigo-300 transition-colors">
                                  {s.id}
                                </span>
                                <Badge
                                  variant={isRunning ? "success" : "secondary"}
                                  className="text-[9px] py-0"
                                >
                                  {s.status}
                                </Badge>
                                {s.pid && (
                                  <span className="text-[10px] text-zinc-400 font-mono bg-zinc-800/80 px-1.5 py-0.2 rounded">
                                    PID: {s.pid}
                                  </span>
                                )}
                                <span className="text-[10px] text-indigo-400 bg-indigo-950/60 border border-indigo-800/40 px-1.5 py-0.2 rounded font-mono">
                                  {s.model_provider}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400 font-mono mt-1">
                                <span className="text-zinc-300">Port: {s.listen_port}</span>
                                <span>Addr: {s.listen_addr}</span>
                                <span className="text-zinc-500 truncate max-w-55" title={s.codex_home}>
                                  {s.codex_home}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="hidden sm:flex items-center gap-1 text-[11px] text-indigo-300 bg-indigo-950/60 border border-indigo-600/40 px-2.5 py-1 rounded group-hover:bg-indigo-900/60 group-hover:border-indigo-500 transition-all shadow-sm">
                              <Activity className="w-3 h-3 text-indigo-400" />
                              <span>Test & Configure</span>
                              <ChevronRight className="w-3.5 h-3.5 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                            </div>

                            {isRunning ? (
                              <Button type="button" size="sm" variant="destructive" className="h-7 px-2.5 gap-1 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStopServer(s.id);
                                }}
                              >
                                <Square className="w-3 h-3 fill-current" />
                                <span>Stop</span>
                              </Button>
                            ) : (
                              <Button type="button" size="sm" variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartSpecificServer(s);
                                }}
                                className="h-7 px-2.5 text-emerald-400 hover:text-emerald-300 border-emerald-800/50 hover:bg-emerald-950/40 gap-1 text-xs"
                              >
                                <Play className="w-3 h-3 fill-current" />
                                <span>Start</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-semibold text-zinc-200">Account Authentication Flow (account/*)</span>
                  </div>
                  <span className="text-[11px] text-zinc-500">Auto-boots server with CODEX_HOME=~/.codex-{"{type}"}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-zinc-400">Account Type:</span>
                  {["chatgpt", "openai", "aws", "github", "shengsuanyun"].map((type) => (
                    <button key={type} type="button" onClick={() => setAccountType(type)}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer border",
                        accountType === type
                          ? "bg-amber-950/60 border-amber-500 text-amber-200 font-semibold"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="button" size="sm" variant="outline" disabled={accountLoading}
                    onClick={() => handleAccountAction("start")}
                    className="text-amber-300 hover:text-amber-200 border-amber-800/60 text-xs h-7"
                  >
                    account/login/start
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={accountLoading}
                    onClick={() => handleAccountAction("cancel")}
                    className="text-zinc-300 text-xs h-7 border-zinc-700"
                  >
                    account/login/cancel
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={accountLoading} 
                    onClick={() => handleAccountAction("logout")}
                    className="text-rose-400 hover:text-rose-300 border-rose-900/60 text-xs h-7"
                  >
                    account/logout
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={accountLoading}
                    onClick={() => handleAccountAction("read")}
                    className="text-indigo-300 hover:text-indigo-200 border-indigo-900/60 text-xs h-7"
                  >
                    account/read
                  </Button>
                </div>

                {accountResult && (
                  <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 space-y-1.5">
                    <div className="flex items-center justify-between text-zinc-400 font-semibold">
                      <span>RPC Response ({accountResult.transport || "WebSocket"}):</span>
                      {accountResult?.latestNotification && (
                        <Badge variant="purple" className="text-[9px] py-0">
                          {accountResult.latestNotification}
                        </Badge>
                      )}
                    </div>
                    {accountResult?.result?.authUrl && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <Button size="sm"
                          onClick={() => CodexAuthClient.openAuthInBrowser(accountResult.result.authUrl)}
                          className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Open Browser OAuth URL</span>
                        </Button>
                        <span className="text-[10px] text-zinc-500 truncate">{accountResult.result.authUrl}</span>
                      </div>
                    )}
                    <pre className="text-zinc-400 overflow-x-auto text-[10px] bg-zinc-900/60 p-2 rounded max-h-36">
                      {JSON.stringify(accountResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            selectedServer && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-100 font-mono">
                        {selectedServer.id}
                      </span>
                      <Badge variant={selectedServer.status === "running" ? "success" : "secondary"}
                        className="text-[10px] py-0"
                      >
                        {selectedServer.status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] text-indigo-300 border-indigo-700/60 bg-indigo-950/40 font-mono">
                        Provider: {selectedServer.model_provider}
                      </Badge>
                      {selectedServer.pid && (
                        <span className="text-[10px] text-zinc-400 font-mono">PID: {selectedServer.pid}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400 font-mono">
                      <span>Port: <strong className="text-zinc-200">{selectedServer.listen_port}</strong></span>
                      <span>Target: {selectedServer.listen_addr}</span>
                      <span className="text-zinc-500 truncate max-w-70">HOME: {selectedServer.codex_home}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {selectedServer.status === "running" ? (
                      <Button type="button" size="sm" variant="destructive"
                        onClick={() => handleStopServer(selectedServer.id)}
                        className="h-7 text-xs gap-1"
                      >
                        <Square className="w-3 h-3 fill-current" />
                        <span>Stop Process</span>
                      </Button>
                    ) : (
                      <Button type="button" size="sm"
                        onClick={() => handleStartSpecificServer(selectedServer)}
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Start Process</span>
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-indigo-400" />
                      <span className="font-semibold text-zinc-200">WebSocket Endpoint Configuration</span>
                    </div>
                    <Badge variant={connectionStatus === "connected" ? "success" : "secondary"}
                      className="text-[10px] py-0"
                    >
                      App Status: {connectionStatus}
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                      <span>Server Endpoint URL:</span>
                      <span className="text-[10px] text-zinc-500">Edit or choose preset below</span>
                    </div>
                    <div className="flex gap-2">
                      <Input value={testWsUrl} onChange={(e) => setTestWsUrl(e.target.value)}
                        placeholder={`/ws?port=${selectedServer.listen_port} or ws://127.0.0.1:${selectedServer.listen_port}`}
                        className="font-mono text-xs bg-zinc-950 border-zinc-800 h-8"
                      />
                      <Button type="button" size="sm" onClick={handleApplyWsUrl}
                        className="h-8 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5 shrink-0"
                      >
                        {appliedSuccess ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" />
                            <span>Connected!</span>
                          </>
                        ) : (
                          <>
                            <Radio className="w-3.5 h-3.5" />
                            <span>Apply to App</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-zinc-500">Quick Presets:</span>
                    <button type="button"
                      onClick={() => setTestWsUrl(`/ws?port=${selectedServer.listen_port}&provider=${selectedServer.model_provider}`)}
                      className="px-2 py-0.5 rounded bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 font-mono text-[10px] transition-colors border border-indigo-700/60 cursor-pointer"
                    >
                      /ws?port={selectedServer.listen_port} (Proxy - Bypasses 403)
                    </button>
                    <button type="button"
                      onClick={() => setTestWsUrl(`ws://127.0.0.1:${selectedServer.listen_port}`)}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-[10px] transition-colors border border-zinc-700 cursor-pointer"
                    >
                      ws://127.0.0.1:{selectedServer.listen_port} (Direct TCP)
                    </button>
                    <button type="button" onClick={() => setTestWsUrl("/ws")}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-mono text-[10px] transition-colors border border-zinc-700 cursor-pointer"
                    >
                      /ws (Default Auto-Bridge)
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-950/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-200 font-medium">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span>Availability & Health Probe</span>
                    </div>

                    <Button type="button" variant="outline" size="sm" onClick={handleCheckHealth}
                      disabled={checkingHealth}
                      className="h-7 text-xs px-2.5 gap-1.5 border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
                    >
                      <RefreshCw className={cn("w-3 h-3 text-emerald-400", checkingHealth && "animate-spin")} />
                      <span>{checkingHealth ? "Probing Server..." : "Test Availability"}</span>
                    </Button>
                  </div>

                  <p className="text-[11px] text-zinc-400">
                    Probes HTTP <code className="text-emerald-400 font-mono">/readyz</code> and <code className="text-emerald-400 font-mono">/healthz</code> endpoints and tests network latency to verify whether this server instance is responding.
                  </p>

                  {healthStatus ? (
                    <div className="p-3 rounded bg-zinc-900/80 border border-zinc-800 space-y-2 font-mono text-[11px]">
                      <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
                        <span className="text-zinc-400 font-sans font-medium">Probe Result:</span>
                        <div className="flex items-center gap-2">
                          {healthStatus.latencyMs !== undefined && (
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px]",
                              healthStatus.latencyMs < 50 ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60" : "bg-amber-950 text-amber-300 border border-amber-800/60"
                            )}>
                              {healthStatus.latencyMs}ms latency
                            </span>
                          )}
                          <Badge variant={healthStatus.ok ? "success" : "destructive"} className="text-[10px] py-0">
                            {healthStatus.ok ? "Ready & Online" : "Probe Offline"}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div className="p-2 rounded bg-black/50 border border-zinc-800 flex items-center justify-between">
                          <span className="text-zinc-400">/readyz endpoint:</span>
                          <span className={cn("flex items-center gap-1 font-semibold", healthStatus.readyzOk ? "text-emerald-400" : "text-amber-400")}>
                            {healthStatus.readyzOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            <span>{healthStatus.readyzText || "Offline"}</span>
                            {healthStatus.readyzCode && <span className="text-zinc-500 font-normal">({healthStatus.readyzCode})</span>}
                          </span>
                        </div>

                        <div className="p-2 rounded bg-black/50 border border-zinc-800 flex items-center justify-between">
                          <span className="text-zinc-400">/healthz endpoint:</span>
                          <span className={cn("flex items-center gap-1 font-semibold", healthStatus.healthzOk ? "text-emerald-400" : "text-amber-400")}>
                            {healthStatus.healthzOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            <span>{healthStatus.healthzText || "Offline"}</span>
                            {healthStatus.healthzCode && <span className="text-zinc-500 font-normal">({healthStatus.healthzCode})</span>}
                          </span>
                        </div>
                      </div>

                      {healthStatus.wsMessage && (
                        <div className="text-[10px] text-zinc-400 pt-1 flex items-center gap-1.5">
                          <Radio className="w-3 h-3 text-indigo-400" />
                          <span>Status: {healthStatus.wsMessage}</span>
                        </div>
                      )}

                      {healthStatus.error && (
                        <div className="p-2 rounded bg-rose-950/40 border border-rose-900/60 text-rose-300 text-[10px]">
                          Note: {healthStatus.error}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded border border-dashed border-zinc-800 text-center text-zinc-500 text-[11px]">
                      Click &quot;Test Availability&quot; above to probe this server instance.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 text-[11px] space-y-1.5 text-amber-300/90">
                    <div className="font-semibold text-amber-200 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Why Direct TCP gets 403:</span>
                    </div>
                    <p className="text-zinc-300 leading-relaxed text-[10px]">
                      Codex app-server restricts browser handshakes and rejects requests with an <code className="text-amber-300 font-mono">Origin</code> header (HTTP 403). Web browsers forcibly attach this header.
                    </p>
                    <p className="text-zinc-300 leading-relaxed text-[10px]">
                      👉 <strong>Solution:</strong> Use proxy route <code className="text-indigo-300 font-mono font-bold">/ws?port={selectedServer.listen_port}</code> which automatically strips the Origin header on container egress.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950 space-y-1.5 font-mono text-[10px]">
                    <div className="flex items-center gap-1.5 text-zinc-200 font-sans font-medium text-xs">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      <span>CLI Quick Command</span>
                    </div>
                    <div className="text-emerald-400 font-semibold text-[10px]">
                      # Run standalone app-server instance:
                    </div>
                    <div className="text-zinc-400 bg-black/60 p-2 rounded border border-zinc-900 select-all overflow-x-auto">
                      CODEX_HOME={selectedServer.codex_home} ./codex app-server --listen ws://127.0.0.1:{selectedServer.listen_port}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-950 space-y-2">
                  <div className="flex items-center justify-between text-zinc-400">
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Process Output Logs ({selectedServer.id})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="ghost" onClick={handleCopyLogs}
                        className="h-6 text-[10px] px-2 gap-1 text-zinc-400 hover:text-zinc-200"
                      >
                        {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedLogs ? "Copied" : "Copy Logs"}</span>
                      </Button>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {serverDetails?.updated_at ? `Updated: ${new Date(serverDetails.updated_at).toLocaleTimeString()}` : ""}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-black/80 font-mono text-[11px] text-zinc-300 max-h-48 overflow-y-auto space-y-1 border border-zinc-900">
                    {serverDetails?.logs && serverDetails.logs.length > 0 ? (
                      serverDetails.logs.map((line: string, idx: number) => (
                        <div key={idx} className="whitespace-pre-wrap">{line}</div>
                      ))
                    ) : selectedServer.last_log ? (
                      <div className="whitespace-pre-wrap text-zinc-400">{selectedServer.last_log}</div>
                    ) : (
                      <div className="text-zinc-600">No output logs recorded yet for this process.</div>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/40 flex flex-row items-center justify-between sm:justify-between shrink-0">
          {activeView === "testing" ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={handleBackToList}
                className="text-xs border-zinc-700 text-zinc-300 hover:text-white gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-zinc-400" />
                <span>Back to Instances List</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}
                  className="text-xs border-zinc-700 text-zinc-400"
                >
                  Close
                </Button>
                <Button type="button" variant="default" size="sm" onClick={handleApplyWsUrl}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
                >
                  {appliedSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Applied!</span>
                    </>
                  ) : (
                    <>
                      <Radio className="w-3.5 h-3.5" />
                      <span>Apply & Connect</span>
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-[11px] text-zinc-500">
                Total Instances: {servers.length} ({servers.filter((s) => s.status === "running").length} active)
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}
                className="text-xs border-zinc-700 text-zinc-300"
              >
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
