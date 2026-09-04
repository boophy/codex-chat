import { ChangeEvent, FC, useRef, useState } from "react";
import { Send, Navigation2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { Badge } from "@/src/components/ui/badge";
import { SkillMetadata, AppInfo } from "@/src/types/protocol";

interface ChatInputProps {
  onSendMessage: (text: string, skills: string[], mentions: string[]) => void;
  onSteerTurn: (text: string) => void;
  onInterrupt: () => void;
  isTurnInProgress: boolean;
  skills: SkillMetadata[];
  apps: AppInfo[];
  disabled?: boolean;
}

export const ChatInput: FC<ChatInputProps> = ({
  onSendMessage,
  onSteerTurn,
  onInterrupt,
  isTurnInProgress,
  skills,
  apps,
  disabled
}) => {
  const [text, setText] = useState("");
  const [attachedSkills, setAttachedSkills] = useState<string[]>([]);
  const [attachedMentions, setAttachedMentions] = useState<string[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionType, setMentionType] = useState<"skill" | "app">("skill");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    const lastChar = val.slice(-1);
    if (lastChar === "$") {
      setMentionType("skill");
      setShowMentionMenu(true);
    } else if (lastChar === "@") {
      setMentionType("app");
      setShowMentionMenu(true);
    } else if (val.endsWith(" ") || val === "") {
      setShowMentionMenu(false);
    }
  };

  const addSkill = (skillName: string) => {
    if (!attachedSkills.includes(skillName)) {
      setAttachedSkills([...attachedSkills, skillName]);
    }
    if (!text.includes(`$${skillName}`)) {
      setText((prev) => (prev ? `${prev} $${skillName} ` : `$${skillName} `));
    }
    setShowMentionMenu(false);
    textareaRef.current?.focus();
  };

  const addApp = (appName: string) => {
    if (!attachedMentions.includes(appName)) {
      setAttachedMentions([...attachedMentions, appName]);
    }
    if (!text.includes(`@${appName}`)) {
      setText((prev) => (prev ? `${prev} @${appName} ` : `@${appName} `));
    }
    setShowMentionMenu(false);
    textareaRef.current?.focus();
  };

  const handleSubmit = () => {
    if (!text.trim() || disabled) return;

    if (isTurnInProgress) {
      onSteerTurn(text.trim());
    } else {
      onSendMessage(text.trim(), attachedSkills, attachedMentions);
    }

    setText("");
    setAttachedSkills([]);
    setAttachedMentions([]);
    setShowMentionMenu(false);
  };

  return (
    <div className="p-4 bg-zinc-950 border-t border-zinc-800/80 relative">
      {showMentionMenu && (
        <div className="absolute bottom-full left-4 mb-2 w-72 bg-zinc-900 border border-zinc-700 rounded-xl p-2 shadow-2xl z-20 animate-in fade-in zoom-in-95">
          <div className="text-[11px] font-semibold text-zinc-400 px-2 py-1 flex items-center justify-between border-b border-zinc-800 mb-1">
            <span>{mentionType === "skill" ? "Insert Skill ($)" : "Insert Connected App (@)"}</span>
            <button type="button"
              onClick={() => setShowMentionMenu(false)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              Esc
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {mentionType === "skill" ? (
              skills.length === 0 ? (
                <div className="text-[11px] text-zinc-500 p-2">No skills discovered</div>
              ) : (
                skills.map((s) => (
                  <button key={s.name} type="button" onClick={() => addSkill(s.name)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 flex items-center justify-between text-xs text-purple-300 font-mono transition-colors"
                  >
                    <span>${s.name}</span>
                    <span className="text-[10px] text-zinc-500 font-sans">skill</span>
                  </button>
                ))
              )
            ) : (
              apps.length === 0 ? (
                <div className="text-[11px] text-zinc-500 p-2">No apps discovered</div>
              ) : (
                apps.map((a) => (
                  <button key={a.id} type="button" onClick={() => addApp(a.id)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 flex items-center justify-between text-xs text-cyan-300 font-mono transition-colors"
                  >
                    <span>@{a.id}</span>
                    <span className="text-[10px] text-zinc-500 font-sans">{a.name}</span>
                  </button>
                ))
              )
            )}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        {(attachedSkills.length > 0 || attachedMentions.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            {attachedSkills.map((s) => (
              <button key={s} type="button" title="Click to remove"
                onClick={() => setAttachedSkills(attachedSkills.filter((x) => x !== s))}
              >
                <Badge variant="purple"
                  className="gap-1 cursor-pointer hover:bg-purple-900/60 text-xs py-0.5"
                >
                  ${s}
                  <span className="text-[10px] opacity-70">×</span>
                </Badge>
              </button>
            ))}
            {attachedMentions.map((m) => (
              <button key={m} type="button" title="Click to remove"
                onClick={() => setAttachedMentions(attachedMentions.filter((x) => x !== m))}
              >
                <Badge variant="info"
                  className="gap-1 cursor-pointer hover:bg-blue-900/60 text-xs py-0.5"
                >
                  @{m}
                  <span className="text-[10px] opacity-70">×</span>
                </Badge>
              </button>
            ))}
          </div>
        )}

        <div className="relative flex items-end rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-lg focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600 transition-all">
          <Textarea ref={textareaRef} value={text} onChange={handleTextChange} onKeyDown={handleKeyDown}
            placeholder={
              isTurnInProgress
                ? "Agent is working... Type to steer or provide guidance..."
                : "Ask Codex, run shell tasks, or type $ for skills and @ for apps..."
            }
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent border-0 focus-visible:ring-0 resize-none min-h-[44px] max-h-32 py-3 px-4 text-sm text-zinc-100 placeholder:text-zinc-500"
          />

          <div className="flex items-center gap-1.5 p-2 shrink-0">
            <button type="button" title="Insert Skill ($)"
              onClick={() => {
                setMentionType("skill");
                setShowMentionMenu(!showMentionMenu);
              }}
              className="p-1.5 text-zinc-400 hover:text-purple-400 rounded-lg hover:bg-zinc-800 transition-colors text-xs font-mono font-semibold"
            >
              $
            </button>
            <button type="button" title="Insert App (@)"
              onClick={() => {
                setMentionType("app");
                setShowMentionMenu(!showMentionMenu);
              }}
              className="p-1.5 text-zinc-400 hover:text-cyan-400 rounded-lg hover:bg-zinc-800 transition-colors text-xs font-mono font-semibold"
            >
              @
            </button>

            {isTurnInProgress ? (
              <Button size="sm" variant="default" onClick={handleSubmit} disabled={!text.trim()}
                className="h-8 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
              >
                <Navigation2 className="w-3.5 h-3.5" />
                <span>Steer</span>
              </Button>
            ) : (
              <Button size="xsIcon" variant="accent" onClick={handleSubmit} 
                disabled={!text.trim() || disabled}
                className="w-8 h-8 rounded-xl shadow-xs"
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-2 text-[11px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 text-[10px] bg-zinc-800 border border-zinc-700 rounded text-zinc-400 font-mono">Enter</kbd> to send
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 text-[10px] bg-zinc-800 border border-zinc-700 rounded text-zinc-400 font-mono">Shift + Enter</kbd> for newline
            </span>
          </div>
          <span>Codex JSON-RPC Stream</span>
        </div>
      </div>
    </div>
  );
};
