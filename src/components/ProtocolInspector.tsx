import * as React from "react";
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Trash2,
  Copy,
  Check,
  Code2,
  Filter,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Badge } from "@/src/components/ui/badge";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { LogFrame } from "@/src/lib/websocket-client";
import { cn } from "@/src/lib/utils";

interface ProtocolInspectorProps {
  logs: LogFrame[];
  onClear: () => void;
  onClose: () => void;
}

export const ProtocolInspector: React.FC<ProtocolInspectorProps> = ({
  logs,
  onClear,
  onClose
}) => {
  const [filterType, setFilterType] = React.useState<string>("all");
  const [search, setSearch] = React.useState<string>("");
  const [selectedLog, setSelectedLog] = React.useState<LogFrame | null>(null);
  const [copied, setCopied] = React.useState(false);

  const filteredLogs = logs.filter((log) => {
    if (filterType === "in" && log.direction !== "in") return false;
    if (filterType === "out" && log.direction !== "out") return false;
    if (filterType === "notification" && log.type !== "notification") return false;
    if (filterType === "request" && log.type !== "request") return false;
    if (filterType === "response" && log.type !== "response") return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchMethod = log.method?.toLowerCase().includes(q);
      const matchId = String(log.requestId || "").includes(q);
      const matchPayload = JSON.stringify(log.payload).toLowerCase().includes(q);
      return matchMethod || matchId || matchPayload;
    }
    return true;
  });

  const handleCopyPayload = (payload: any) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="w-96 lg:w-[480px] bg-zinc-950 border-l border-zinc-800 flex flex-col h-full shrink-0 select-none z-20 shadow-2xl">
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-sm text-zinc-100">JSON-RPC 2.0 Protocol Monitor</span>
          <Badge variant="secondary" className="text-[10px] py-0">{logs.length}</Badge>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="xsIcon"
            variant="ghost"
            onClick={onClear}
            className="text-zinc-400 hover:text-zinc-100"
            title="Clear Frame Logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="xsIcon"
            variant="ghost"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-2.5 border-b border-zinc-800/80 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search methods, IDs, or payloads..."
            className="pl-8 h-8 text-xs bg-zinc-900 border-zinc-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 text-[10px]">
          {["all", "in", "out", "notification", "request", "response"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={cn(
                "px-2 py-0.5 rounded-md capitalize font-medium transition-colors cursor-pointer border",
                filterType === type
                  ? "bg-zinc-800 text-zinc-100 border-zinc-700"
                  : "bg-zinc-900/50 text-zinc-400 border-transparent hover:text-zinc-200"
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto border-b border-zinc-800 divide-y divide-zinc-900">
          {filteredLogs.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">
              No matching JSON-RPC frames captured yet.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isSelected = selectedLog?.id === log.id;
              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className={cn(
                    "p-2.5 text-xs font-mono transition-colors cursor-pointer flex items-start justify-between gap-2",
                    isSelected ? "bg-zinc-900 text-zinc-100" : "hover:bg-zinc-900/50 text-zinc-300"
                  )}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      {log.direction === "in" ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-zinc-200 truncate">
                          {log.method || (log.requestId ? `Resp #${log.requestId}` : "Frame")}
                        </span>
                        {log.type === "notification" && (
                          <Badge variant="purple" className="text-[9px] py-0 px-1 font-sans">
                            notify
                          </Badge>
                        )}
                        {log.type === "request" && (
                          <Badge variant="info" className="text-[9px] py-0 px-1 font-sans">
                            req #{log.requestId}
                          </Badge>
                        )}
                        {log.type === "error" && (
                          <Badge variant="destructive" className="text-[9px] py-0 px-1 font-sans">
                            error
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500 truncate max-w-[260px]">
                        {JSON.stringify(log.payload)}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] text-zinc-600 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {selectedLog && (
          <div className="h-56 bg-zinc-950 p-3 flex flex-col shrink-0 border-t border-zinc-800 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
              <div className="flex items-center gap-2 font-mono text-zinc-300">
                <span className="font-semibold text-emerald-400">
                  {selectedLog.method || `Request #${selectedLog.requestId}`}
                </span>
                <span className="text-zinc-500 text-[10px]">
                  ({selectedLog.direction === "in" ? "Incoming" : "Outgoing"})
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleCopyPayload(selectedLog.payload)}
                className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 text-[11px] p-1"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>

            <pre className="flex-1 overflow-y-auto p-2 bg-zinc-900/70 border border-zinc-800/80 rounded-lg text-[11px] font-mono text-zinc-200 mt-2 leading-relaxed whitespace-pre-wrap select-all">
              {JSON.stringify(selectedLog.payload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </aside>
  );
};
