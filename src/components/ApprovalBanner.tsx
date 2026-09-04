import { FC } from "react";
import { ShieldAlert, Terminal, FileCode, Check, X, Clock } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { CommandExecutionRequestApprovalParams, FileChangeRequestApprovalParams } from "@/src/types/protocol";

interface ApprovalBannerProps {
  commandRequest: CommandExecutionRequestApprovalParams | null;
  fileRequest: FileChangeRequestApprovalParams | null;
  onDecideCommand: (decision: "accept" | "acceptForSession" | "decline" | "cancel") => void;
  onDecideFile: (decision: "accept" | "acceptForSession" | "decline" | "cancel") => void;
}

export const ApprovalBanner: FC<ApprovalBannerProps> = ({
  commandRequest,
  fileRequest,
  onDecideCommand,
  onDecideFile
}) => {
  if (!commandRequest && !fileRequest) return null;

  return (
    <div className="mx-4 my-2 border border-amber-500/50 bg-amber-950/30 backdrop-blur-md rounded-xl p-4 shadow-xl text-zinc-100 animate-in fade-in slide-in-from-bottom-2 duration-200">
      {commandRequest && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="font-semibold text-sm text-amber-200">Command Execution Approval Required</span>
            </div>
            <Badge variant="warning" className="text-[11px]">Server Request</Badge>
          </div>

          <div className="text-xs text-zinc-300">
            {commandRequest.reason || "The agent is requesting permission to execute a shell command in your workspace."}
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-xs text-zinc-200 flex items-start gap-2">
            <Terminal className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
            <div className="overflow-x-auto select-all">
              <div className="text-emerald-400 font-semibold">$ {commandRequest.command}</div>
              {commandRequest.cwd && (
                <div className="text-zinc-500 text-[10px] mt-1">Directory: {commandRequest.cwd}</div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button size="sm" variant="outline"
              onClick={() => onDecideCommand("cancel")}
              className="text-zinc-400 hover:text-zinc-200 border-zinc-700"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Cancel Turn
            </Button>
            <Button size="sm" variant="destructive"
              onClick={() => onDecideCommand("decline")}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Decline
            </Button>
            <Button size="sm" variant="secondary"
              onClick={() => onDecideCommand("acceptForSession")}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            >
              <Clock className="w-3.5 h-3.5 mr-1" />
              Allow for Session
            </Button>
            <Button size="sm" variant="accent" onClick={() => onDecideCommand("accept")}>
              <Check className="w-3.5 h-3.5 mr-1" />
              Approve Once
            </Button>
          </div>
        </div>
      )}

      {fileRequest && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
            <div className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="font-semibold text-sm text-amber-200">File Change Approval Required</span>
            </div>
            <Badge variant="warning" className="text-[11px]">Server Request</Badge>
          </div>

          <div className="text-xs text-zinc-300">
            {fileRequest.reason || "The agent is requesting permission to apply modifications to your workspace files."}
          </div>

          {fileRequest.changes && fileRequest.changes.length > 0 && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs text-zinc-200">
              {fileRequest.changes.map((c, idx) => (
                <div key={idx} className="mb-2 last:mb-0">
                  <div className="text-amber-300 font-semibold mb-1">{c.path} ({typeof c.kind === "string" ? c.kind : c.kind.type})</div>
                  <pre className="text-zinc-400 text-[11px] whitespace-pre-wrap">{c.diff}</pre>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button size="sm" variant="destructive" onClick={() => onDecideFile("decline")}>
              <X className="w-3.5 h-3.5 mr-1" />
              Decline
            </Button>
            <Button size="sm" variant="secondary"
              onClick={() => onDecideFile("acceptForSession")}
            >
              <Clock className="w-3.5 h-3.5 mr-1" />
              Allow for Session
            </Button>
            <Button size="sm" variant="accent" onClick={() => onDecideFile("accept")}>
              <Check className="w-3.5 h-3.5 mr-1" />
              Approve Patch
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
