import * as React from "react";
import {
  Settings,
  Activity,
  RefreshCw
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Switch } from "@/src/components/ui/switch";
import { Badge } from "@/src/components/ui/badge";
import { ServerDiagnosticsResponse } from "@/src/types/protocol";
import { ConnectionStatus } from "@/src/lib/websocket-client";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentWsUrl: string;
  connectionStatus: ConnectionStatus;
  diagnostics: ServerDiagnosticsResponse | null;
  onSaveWsUrl: (url: string) => void;
  onFetchDiagnostics: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onOpenChange,
  currentWsUrl,
  connectionStatus,
  diagnostics,
  onSaveWsUrl,
  onFetchDiagnostics
}) => {
  const [url, setUrl] = React.useState(currentWsUrl);
  const [experimentalApi, setExperimentalApi] = React.useState(true);

  React.useEffect(() => {
    setUrl(currentWsUrl);
  }, [currentWsUrl, open]);

  const handleSave = () => {
    onSaveWsUrl(url.trim());
    onOpenChange(false);
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
          <div className="space-y-1.5">
            <label className="text-zinc-300 font-medium flex items-center justify-between">
              <span>WebSocket URL</span>
              <Badge
                variant={connectionStatus === "connected" ? "success" : "secondary"}
                className="text-[10px] py-0"
              >
                {connectionStatus}
              </Badge>
            </label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ws://127.0.0.1:4500 or /ws"
              className="font-mono text-xs"
            />
            <span className="text-[10px] text-zinc-500">
              Default is relative <code className="text-zinc-400">/ws</code>. You can point to any local or remote <code className="text-zinc-400">codex app-server --listen ws://...</code>
            </span>
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
                <button
                  type="button"
                  onClick={onFetchDiagnostics}
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
