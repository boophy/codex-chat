import { FC, useEffect, useState } from "react";
import { Server, Play, Square, RefreshCw, Terminal, KeyRound, ExternalLink, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { cn } from "@/src/lib/utils";

export interface ServerManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ServerManagerModal: FC<ServerManagerModalProps> = ({ open, onOpenChange }) => {
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [serverDetails, setServerDetails] = useState<any | null>(null);
  const [newCodexHome, setNewCodexHome] = useState("~/.codex-aws");
  const [newPort, setNewPort] = useState("8080");
  const [newProvider, setNewProvider] = useState("codex-aws");
  const [isStarting, setIsStarting] = useState(false);
  const [accountType, setAccountType] = useState("chatgpt");
  const [accountResult, setAccountResult] = useState<any | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);

  const fetchServers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/codex/servers");
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchServerDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/codex/servers/${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        setServerDetails(data.server);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (open) {
      fetchServers();
      const interval = setInterval(fetchServers, 4000);
      return () => clearInterval(interval);
    }
  }, [open]);

  useEffect(() => {
    if (selectedServerId) {
      fetchServerDetails(selectedServerId);
      const interval = setInterval(() => fetchServerDetails(selectedServerId), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedServerId]);

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
      console.error(e);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopServer = async (id: string) => {
    try {
      await fetch(`/api/codex/servers/${encodeURIComponent(id)}/stop`, { method: "POST" });
      await fetchServers();
      if (selectedServerId === id) {
        await fetchServerDetails(id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAccountAction = async (action: "start" | "cancel" | "logout" | "read") => {
    setAccountLoading(true);
    setAccountResult(null);
    try {
      let res;
      if (action === "read") {
        res = await fetch(`/api/codex/account/read?type=${encodeURIComponent(accountType)}`);
      } else {
        res = await fetch(`/api/codex/account/login/${action === "start" ? "start" : action === "cancel" ? "cancel" : ""}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: accountType, codexHome: `~/.codex-${accountType}` })
        });
        if (action === "logout") {
          res = await fetch("/api/codex/account/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: accountType, codexHome: `~/.codex-${accountType}` })
          });
        }
      }
      const data = await res?.json();
      setAccountResult(data);
      await fetchServers();
    } catch (err: any) {
      setAccountResult({ error: err.message });
    } finally {
      setAccountLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/40 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-zinc-100">
                Codex App-Server Process Manager
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Manage backend instances, ports, CODEX_HOME directories, and OAuth account logins
              </DialogDescription>
            </div>
          </div>

          <Button type="button" size="sm" variant="ghost" onClick={fetchServers} disabled={loading}
            className="text-zinc-400 hover:text-zinc-100 gap-1 text-xs"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            <span>Refresh</span>
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
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
                <input type="text" value={newCodexHome} placeholder="~/.codex-aws"
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
                <input type="text" value={newProvider} placeholder="codex-aws"
                  onChange={(e) => setNewProvider(e.target.value)}
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
              <span className="font-semibold text-zinc-200">Running / Registered Instances ({servers.length})</span>
            </div>

            {servers.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-zinc-800 rounded-lg text-zinc-500">
                No active codex app-server processes. Start one above or trigger a New Thread.
              </div>
            ) : (
              <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800 bg-zinc-900/30">
                {servers.map((s) => {
                  const isRunning = s.status === "running";
                  const isSelected = selectedServerId === s.id;
                  return (
                    <div key={s.id}
                      className={cn(
                        "p-3 flex items-center justify-between hover:bg-zinc-900/70 transition-colors",
                        isSelected && "bg-zinc-900/90"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                            "w-2.5 h-2.5 rounded-full shrink-0",
                            isRunning ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
                          )}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-200">{s.id}</span>
                            <Badge variant={isRunning ? "success" : "secondary"} className="text-[9px] py-0">
                              {s.status}
                            </Badge>
                            {s.pid && (
                              <span className="text-[10px] text-zinc-400 font-mono">PID: {s.pid}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono mt-0.5">
                            <span>Listen: {s.listen_addr}</span>
                            <span>Provider: {s.model_provider}</span>
                            <span className="text-zinc-500 truncate max-w-[200px]">{s.codex_home}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button type="button" size="sm" variant="outline" className="text-xs"
                          onClick={() => setSelectedServerId(isSelected ? null : s.id)}
                        >
                          {isSelected ? "Hide Logs" : "View Logs"}
                        </Button>

                        {isRunning ? (
                          <Button type="button" size="sm" variant="destructive" className="gap-1 text-xs"
                            onClick={() => handleStopServer(s.id)}
                          >
                            <Square className="w-3 h-3 fill-current" />
                            <span>Stop</span>
                          </Button>
                        ) : (
                          <Button type="button" size="sm" variant="outline"
                            onClick={() =>
                              handleStartServer()
                            }
                            className="text-emerald-400 hover:text-emerald-300 gap-1 text-xs"
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
            <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-950 space-y-2">
              <div className="flex items-center justify-between text-zinc-400">
                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Logs for {serverDetails.id}</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  Updated: {new Date(serverDetails.updated_at).toLocaleTimeString()}
                </span>
              </div>
              <div className="p-2.5 rounded bg-black/80 font-mono text-[11px] text-zinc-300 max-h-40 overflow-y-auto space-y-1">
                {(serverDetails.logs && serverDetails.logs.length > 0) ? (
                  serverDetails.logs.map((line: string, idx: number) => (
                    <div key={idx} className="whitespace-pre-wrap">{line}</div>
                  ))
                ) : (
                  <div className="text-zinc-600">No output logs recorded yet.</div>
                )}
              </div>
            </div>
          )}

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
              {["chatgpt", "openai", "aws", "github"].map((type) => (
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
                className="text-amber-300 hover:text-amber-200 border-amber-800/60 text-xs"
              >
                account/login/start
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={accountLoading}
                onClick={() => handleAccountAction("cancel")}
                className="text-zinc-300 text-xs"
              >
                account/login/cancel
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={accountLoading}
                onClick={() => handleAccountAction("logout")}
                className="text-rose-400 hover:text-rose-300 border-rose-900/60 text-xs"
              >
                account/logout
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={accountLoading}
                onClick={() => handleAccountAction("read")}
                className="text-indigo-300 hover:text-indigo-200 border-indigo-900/60 text-xs"
              >
                account/read
              </Button>
            </div>

            {accountResult && (
              <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 space-y-1">
                <div className="text-zinc-500 font-semibold">Response:</div>
                {accountResult?.data?.url && (
                  <div className="flex items-center gap-1.5 text-indigo-400 underline">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <a href={accountResult.data.url} target="_blank" rel="noreferrer">
                      Open Login Authorization URL
                    </a>
                  </div>
                )}
                <pre className="text-zinc-400 overflow-x-auto text-[10px]">
                  {JSON.stringify(accountResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
