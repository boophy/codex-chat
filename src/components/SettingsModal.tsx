import { FC, useEffect, useState, } from "react";
import { Settings, Activity, RefreshCw, CheckCircle2, XCircle, Terminal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Switch } from "@/src/components/ui/switch";
import { Badge } from "@/src/components/ui/badge";
import { SettingsModalProps } from "@/src/types";

export type { SettingsModalProps };

export const SettingsModal: FC<SettingsModalProps> = ({
  open,
  onOpenChange,
  currentWsUrl,
  connectionStatus,
  diagnostics,
  onSaveWsUrl,
  onFetchDiagnostics
}) => {
  const [url, setUrl] = useState(currentWsUrl);
  const [experimentalApi, setExperimentalApi] = useState(true);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{
    readyz?: { ok: boolean; text: string; code?: number };
    healthz?: { ok: boolean; text: string; code?: number };
    error?: string;
  } | null>(null);

  useEffect(() => {
    setUrl(currentWsUrl);
    setHealthStatus(null);
  }, [currentWsUrl, open]);

  const handleSave = () => {
    onSaveWsUrl(url.trim());
    onOpenChange(false);
  };

  const handleCheckHealth = async () => {
    setCheckingHealth(true);
    setHealthStatus(null);
    try {
      const [readyzRes, healthzRes] = await Promise.all([
        fetch("/readyz").catch((e) => ({ ok: false, status: 0, text: () => Promise.resolve(e.message) })),
        fetch("/healthz").catch((e) => ({ ok: false, status: 0, text: () => Promise.resolve(e.message) }))
      ]);

      const readyzText = typeof readyzRes.text === "function" ? await readyzRes.text() : "Failed";
      const healthzText = typeof healthzRes.text === "function" ? await healthzRes.text() : "Failed";

      setHealthStatus({
        readyz: { ok: readyzRes.ok, text: readyzText, code: readyzRes.status },
        healthz: { ok: healthzRes.ok, text: healthzText, code: healthzRes.status }
      });
    } catch (err: any) {
      setHealthStatus({
        error: err?.message || "Failed to query health endpoints"
      });
    } finally {
      setCheckingHealth(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            Codex App Server Connection
          </DialogTitle>
          <DialogDescription>
            Configure WebSocket endpoint and client capabilities according to the Codex specification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="space-y-2">
            <div className="text-zinc-300 font-medium flex items-center justify-between">
              <span>WebSocket URL</span>
              <Badge variant={connectionStatus === "connected" ? "success" : "secondary"}
                className="text-[10px] py-0"
              >
                {connectionStatus}
              </Badge>
            </div>

            <Input value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="ws://127.0.0.1:8080 or /ws"
              className="font-mono text-xs"
            />

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-zinc-500">Presets:</span>
              <button type="button" onClick={() => setUrl("/ws")}
                className="px-2 py-0.5 rounded bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 font-mono text-[10px] transition-colors border border-indigo-700/60"
              >
                /ws (Proxy - Fixes 403)
              </button>
              <button type="button" onClick={() => setUrl("ws://127.0.0.1:3000/ws")}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-[10px] transition-colors border border-zinc-700"
              >
                ws://127.0.0.1:3000/ws (Bridge)
              </button>
              <button type="button" onClick={() => setUrl("ws://127.0.0.1:8080")}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-mono text-[10px] transition-colors border border-zinc-700"
              >
                ws://127.0.0.1:8080 (Direct)
              </button>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Real Backend Quick Start</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleCheckHealth}
                disabled={checkingHealth}
                className="h-6 text-[10px] px-2 gap-1 border-zinc-700"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${checkingHealth ? "animate-spin" : ""}`} />
                Check /readyz
              </Button>
            </div>

            <div className="bg-black/60 rounded p-2.5 font-mono text-[10px] text-zinc-300 border border-zinc-900 space-y-1.5">
              <div>
                <div className="text-emerald-400 font-semibold"># 1. Start Codex App-Server</div>
                <div className="text-zinc-400">./codex app-server --listen ws://127.0.0.1:8080</div>
              </div>

              <div>
                <div className="text-indigo-400 font-semibold"># 2. Start the Bridge (origin-stripping proxy + UI)</div>
                <div className="text-zinc-400">CODEX_BACKEND_URL=ws://127.0.0.1:8080 npm run codex:bridge</div>
                <div className="text-[9px] text-zinc-500">Connect to &quot;/ws&quot; in the web UI. Set CODEX_BACKEND_URL to your app-server&apos;s --listen address.</div>
              </div>

              <div>
                <div className="text-purple-400 font-semibold"># Alternative: Vite-only dev server (no REST API)</div>
                <div className="text-zinc-400">npm run dev:codex</div>
                <div className="text-[9px] text-zinc-500">Connect to &quot;/ws&quot; in the web UI; proxies to CODEX_WS_URL (default ws://127.0.0.1:8080).</div>
              </div>
            </div>

            {healthStatus && (
              <div className="mt-1 pt-1 border-t border-zinc-800/80 space-y-1 text-[11px] font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">/readyz:</span>
                  <span className={`flex items-center gap-1 ${healthStatus.readyz?.ok ? "text-emerald-400" : "text-amber-400"}`}>
                    {healthStatus.readyz?.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {healthStatus.readyz?.text || "Offline"} ({healthStatus.readyz?.code || 0})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">/healthz:</span>
                  <span className={`flex items-center gap-1 ${healthStatus.healthz?.ok ? "text-emerald-400" : "text-amber-400"}`}>
                    {healthStatus.healthz?.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {healthStatus.healthz?.text || "Offline"} ({healthStatus.healthz?.code || 0})
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-950/60">
            <div className="space-y-0.5">
              <div className="text-zinc-200 font-medium">Experimental API Opt-in</div>
              <div className="text-[10px] text-zinc-500">
                Enables dynamic tools, diagnostics, and granular permissions.
              </div>
            </div>
            <Switch checked={experimentalApi} onCheckedChange={setExperimentalApi} />
          </div>

          {diagnostics?.process && (
            <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950 font-mono text-[11px] space-y-1.5">
              <div className="flex items-center justify-between text-zinc-400 font-sans font-semibold border-b border-zinc-800 pb-1">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  Live Server Diagnostics
                </span>
                <button type="button" onClick={onFetchDiagnostics}
                  className="text-zinc-500 hover:text-zinc-300 p-0.5"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span>Process ID:</span>
                <span>{diagnostics.process.id}</span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span>Memory (RSS):</span>
                <span>{(diagnostics.process.residentMemoryBytes / (1024 * 1024)).toFixed(1)} MB</span>
              </div>
              {diagnostics.gauges?.map((g, idx) => (
                <div key={idx} className="flex justify-between text-zinc-400">
                  <span>{g.name}:</span>
                  <span className="text-zinc-200">{g.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="default" size="sm" onClick={handleSave}>
            Apply & Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

