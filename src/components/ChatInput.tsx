import * as React from "react";
import {
  Send,
  Sparkles,
  Compass,
  Square,
  CornerDownLeft,
  Paperclip,
  Wrench,
  Wand2,
  Navigation2
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { Badge } from "@/src/components/ui/badge";
import { SkillInfo, AppInfo } from "@/src/types/protocol";

interface ChatInputProps {
  onSendMessage: (text: string, skills: string[], mentions: string[]) => void;
  onSteerTurn: (text: string) => void;
  onInterrupt: () => void;
  isTurnInProgress: boolean;
  skills: SkillInfo[];
  apps: AppInfo[];
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onSteerTurn,
  onInterrupt,
  isTurnInProgress,
  skills,
  apps,
  disabled
}) => {
  const [text, setText] = React.useState("");
  const [attachedSkills, setAttachedSkills] = React.useState<string[]>([]);
  const [attachedMentions, setAttachedMentions] = React.useState<string[]>([]);
  const [showMentionMenu, setShowMentionMenu] = React.useState(false);
  const [mentionType, setMentionType] = React.useState<"skill" | "app">("skill");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
            <button
              type="button"
              onClick={() => setShowMentionMenu(false)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              Esc
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {mentionType === "skill" ? (
              skills.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => addSkill(s.name)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 flex flex-col transition-colors cursor-pointer text-xs"
                >
                  <span className="font-semibold text-purple-300">${s.name}</span>
                  <span className="text-[10px] text-zinc-400 line-clamp-1">{s.description}</span>
                </button>
              ))
            ) : (
              apps.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => addApp(a.id)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 flex flex-col transition-colors cursor-pointer text-xs"
                >
                  <span className="font-semibold text-cyan-300">@{a.id}</span>
                  <span className="text-[10px] text-zinc-400 line-clamp-1">{a.name} - {a.description}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span className="text-[11px] text-zinc-500 mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-zinc-400" />
          Quick Insert:
        </span>
        {skills.slice(0, 3).map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => addSkill(s.name)}
            className="px-2 py-0.5 rounded-md bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/50 text-purple-300 text-[11px] font-mono transition-colors cursor-pointer"
          >
            ${s.name}
          </button>
        ))}
        {apps.slice(0, 2).map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => addApp(a.id)}
            className="px-2 py-0.5 rounded-md bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/50 text-cyan-300 text-[11px] font-mono transition-colors cursor-pointer"
          >
            @{a.id}
          </button>
        ))}
      </div>

      <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/80 shadow-lg focus-within:border-zinc-600 transition-colors">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={
            isTurnInProgress
              ? "Steer active turn (type additional guidance)..."
              : "Ask Codex to build features, inspect code, run tests, or invoke skills with $..."
          }
          className="min-h-[72px] max-h-[180px] p-3 text-sm bg-transparent border-0 focus-visible:ring-0 text-zinc-100 placeholder:text-zinc-500"
          disabled={disabled}
        />

        <div className="flex items-center justify-between p-2 pt-0 border-t border-zinc-800/40 mt-1">
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
            <span>JSON-RPC 2.0</span>
            {isTurnInProgress && (
              <Badge variant="purple" className="text-[10px] py-0 font-sans">
                Steer Mode Active
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isTurnInProgress && (
              <Button
                size="sm"
                variant="destructive"
                onClick={onInterrupt}
                className="h-8 px-3 text-xs gap-1.5"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </Button>
            )}

            <Button
              size="sm"
              variant={isTurnInProgress ? "secondary" : "default"}
              onClick={handleSubmit}
              disabled={!text.trim() || disabled}
              className="h-8 px-3.5 text-xs font-semibold gap-1.5 bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
            >
              {isTurnInProgress ? (
                <>
                  <Navigation2 className="w-3.5 h-3.5" />
                  <span>Steer</span>
                </>
              ) : (
                <>
                  <span>Send</span>
                  <CornerDownLeft className="w-3.5 h-3.5 opacity-70" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
