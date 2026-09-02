import * as React from "react";
import {
  Terminal,
  FileCode,
  BrainCircuit,
  Bot,
  User,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ListTodo,
  Wrench,
  Globe
} from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { ThreadItem } from "@/src/types/protocol";
import { cn } from "@/src/lib/utils";

interface MessageItemProps {
  item: ThreadItem;
  isStreaming?: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({ item, isStreaming }) => {
  const [copied, setCopied] = React.useState(false);
  const [showReasoning, setShowReasoning] = React.useState(true);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (item.type === "userMessage") {
    return (
      <div className="flex justify-end my-4 px-4">
        <div className="flex items-start gap-3 max-w-[85%] sm:max-w-[75%]">
          <div className="flex flex-col items-end gap-1.5">
            <div className="bg-zinc-800 border border-zinc-700/80 rounded-2xl rounded-tr-xs px-4 py-2.5 text-zinc-100 text-sm shadow-md">
              {item.content.map((c, idx) => {
                if (c.type === "text") {
                  return (
                    <div key={idx} className="whitespace-pre-wrap leading-relaxed font-sans">
                      {c.text}
                    </div>
                  );
                }
                if (c.type === "skill") {
                  return (
                    <span key={idx}>
                      <Badge variant="purple" className="my-1 mr-1">
                        ${c.name}
                      </Badge>
                    </span>
                  );
                }
                if (c.type === "mention") {
                  return (
                    <span key={idx}>
                      <Badge variant="info" className="my-1 mr-1">
                        {c.name}
                      </Badge>
                    </span>
                  );
                }
                return null;
              })}
            </div>
            <span className="text-[10px] text-zinc-500 mr-1">User</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center shrink-0 text-zinc-200">
            <User className="w-4 h-4" />
          </div>
        </div>
      </div>
    );
  }

  if (item.type === "reasoning") {
    return (
      <div className="my-2 px-4 max-w-[95%] sm:max-w-[85%]">
        <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setShowReasoning(!showReasoning)}
            className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/80 hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 font-medium">
              <BrainCircuit className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Thought Process & Reasoning</span>
              {isStreaming && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping ml-1" />
              )}
            </div>
            {showReasoning ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {showReasoning && (
            <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/40 text-zinc-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {item.summary && <div className="text-indigo-300 mb-1 font-sans font-medium">{item.summary}</div>}
              {item.content && <div className="text-zinc-400">{item.content}</div>}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (item.type === "commandExecution") {
    return (
      <div className="my-3 px-4 max-w-[95%] sm:max-w-[85%]">
        <div className="border border-zinc-800 bg-zinc-950 rounded-xl overflow-hidden shadow-md">
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-zinc-400 text-[11px]">Command Execution</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  item.status === "completed"
                    ? "success"
                    : item.status === "failed" || item.status === "declined"
                    ? "destructive"
                    : "secondary"
                }
                className="text-[10px] py-0 px-1.5"
              >
                {item.status}
              </Badge>
              <button
                type="button"
                onClick={() => handleCopy(item.command)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                title="Copy command"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-3 font-mono text-xs text-zinc-200">
            <div className="text-emerald-400 font-semibold mb-1 select-all">$ {item.command}</div>
            {item.cwd && <div className="text-zinc-500 text-[10px] mb-2 font-sans">Directory: {item.cwd}</div>}
            {item.aggregatedOutput && (
              <pre className="mt-2 p-2 bg-black/50 rounded-lg text-zinc-300 text-[11px] overflow-x-auto whitespace-pre-wrap leading-tight border border-zinc-800/60 max-h-64">
                {item.aggregatedOutput}
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (item.type === "fileChange") {
    return (
      <div className="my-3 px-4 max-w-[95%] sm:max-w-[85%]">
        <div className="border border-zinc-800 bg-zinc-950 rounded-xl overflow-hidden shadow-md">
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
              <FileCode className="w-3.5 h-3.5 text-amber-400" />
              <span>Workspace Patch</span>
            </div>
            <Badge
              variant={item.status === "completed" ? "success" : "secondary"}
              className="text-[10px] py-0 px-1.5"
            >
              {item.status}
            </Badge>
          </div>

          <div className="p-3 font-mono text-xs">
            {item.changes?.map((c, idx) => (
              <div key={idx} className="mb-2 last:mb-0">
                <div className="flex items-center justify-between text-zinc-300 text-xs font-semibold mb-1">
                  <span>{c.path}</span>
                  <Badge variant="outline" className="text-[9px] py-0">{c.kind}</Badge>
                </div>
                <div className="bg-black/60 rounded-lg p-2.5 overflow-x-auto border border-zinc-800 text-[11px] leading-tight">
                  {c.diff.split("\n").map((line, lineIdx) => {
                    const isAdd = line.startsWith("+") && !line.startsWith("+++");
                    const isDel = line.startsWith("-") && !line.startsWith("---");
                    const isHdr = line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++");
                    return (
                      <div
                        key={lineIdx}
                        className={cn(
                          "whitespace-pre",
                          isAdd && "text-emerald-400 bg-emerald-950/30",
                          isDel && "text-red-400 bg-red-950/30",
                          isHdr && "text-blue-400 font-semibold"
                        )}
                      >
                        {line}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (item.type === "plan") {
    return (
      <div className="my-2 px-4 max-w-[95%] sm:max-w-[85%]">
        <div className="border border-zinc-800 bg-zinc-900/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-zinc-200">
          <ListTodo className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
          <div className="flex-1 whitespace-pre-wrap">{item.text}</div>
        </div>
      </div>
    );
  }

  if (item.type === "mcpToolCall") {
    return (
      <div className="my-2 px-4 max-w-[95%] sm:max-w-[85%]">
        <div className="border border-zinc-800 bg-zinc-900/60 rounded-xl p-3 text-xs text-zinc-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-mono">
              <Wrench className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold text-cyan-300">{item.server}</span>
              <span className="text-zinc-500">/</span>
              <span className="text-zinc-300">{item.tool}</span>
            </div>
            <Badge variant="outline" className="text-[10px]">{item.status}</Badge>
          </div>
          {item.arguments && (
            <pre className="bg-black/50 p-2 rounded text-[11px] text-zinc-400 overflow-x-auto">
              {JSON.stringify(item.arguments, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  }

  if (item.type === "agentMessage") {
    return (
      <div className="flex justify-start my-4 px-4">
        <div className="flex items-start gap-3 max-w-[92%] sm:max-w-[85%]">
          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 text-emerald-400 shadow-sm">
            <Bot className="w-4 h-4" />
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl rounded-tl-xs px-4 py-3.5 text-zinc-100 text-sm shadow-md leading-relaxed">
              <div className="prose prose-invert max-w-none text-zinc-200 text-sm space-y-2">
                {renderFormattedText(item.text)}
              </div>
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-1 align-middle" />
              )}
            </div>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-zinc-500">Codex Agent</span>
              <button
                type="button"
                onClick={() => handleCopy(item.text)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 flex items-center gap-1 text-[10px]"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

function renderFormattedText(text: string) {
  if (!text) return null;

  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const firstLineEnd = part.indexOf("\n");
      const lang = firstLineEnd !== -1 ? part.slice(3, firstLineEnd).trim() : "";
      const code = firstLineEnd !== -1 ? part.slice(firstLineEnd + 1, -3) : part.slice(3, -3);

      return (
        <div key={index} className="my-3 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 font-mono text-xs">
          {lang && (
            <div className="px-3 py-1 bg-zinc-900 text-zinc-400 text-[10px] border-b border-zinc-800 flex items-center justify-between font-sans">
              <span>{lang}</span>
            </div>
          )}
          <pre className="p-3 overflow-x-auto text-zinc-200 leading-relaxed">
            <code>{code}</code>
          </pre>
        </div>
      );
    }

    const lines = part.split("\n");
    return (
      <div key={index} className="space-y-1">
        {lines.map((line, lineIdx) => {
          if (line.startsWith("### ")) {
            return <h3 key={lineIdx} className="text-base font-semibold text-zinc-100 mt-2 mb-1">{line.slice(4)}</h3>;
          }
          if (line.startsWith("## ")) {
            return <h2 key={lineIdx} className="text-lg font-semibold text-zinc-100 mt-3 mb-1">{line.slice(3)}</h2>;
          }
          if (line.startsWith("# ")) {
            return <h1 key={lineIdx} className="text-xl font-bold text-zinc-100 mt-4 mb-2">{line.slice(2)}</h1>;
          }
          if (line.startsWith("- ")) {
            return (
              <div key={lineIdx} className="flex items-start gap-2 pl-2">
                <span className="text-emerald-400">•</span>
                <span>{renderInlineMarkdown(line.slice(2))}</span>
              </div>
            );
          }
          if (!line.trim()) {
            return <div key={lineIdx} className="h-2" />;
          }
          return <p key={lineIdx}>{renderInlineMarkdown(line)}</p>;
        })}
      </div>
    );
  });
}

function renderInlineMarkdown(str: string) {
  const segments = str.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith("`") && seg.endsWith("`")) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-emerald-300 font-mono text-xs">
          {seg.slice(1, -1)}
        </code>
      );
    }
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-zinc-100">
          {seg.slice(2, -2)}
        </strong>
      );
    }
    return seg;
  });
}
