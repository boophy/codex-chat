import { FC } from "react";
import { cn } from "@/src/lib/utils";
import { Zap, Check } from "lucide-react";
import { ReasoningEffortSelectorProps } from "@/src/types";

export const EFFORT_OPTIONS = [
  { id: "none", label: "None", desc: "Standard generation without chain-of-thought" },
  { id: "low", label: "Low", desc: "Fast reasoning for lightweight tasks" },
  { id: "medium", label: "Medium", desc: "Balanced reasoning depth and speed (Default)" },
  { id: "high", label: "High", desc: "Thorough multi-step analysis for complex bugs" },
  { id: "xhigh", label: "Extra High", desc: "Maximum budget deliberation and exploration" }
];
export type { ReasoningEffortSelectorProps };
export const ReasoningEffortSelector: FC<ReasoningEffortSelectorProps> = ({
  selectedEffort,
  onSelectEffort,
  variant = "dropdown",
  className
}) => {
  if (variant === "form") {
    return (
      <div className={cn("space-y-1.5", className)}>
        <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-indigo-400" />
          <span>Reasoning Effort (model_reasoning_effort)</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {EFFORT_OPTIONS.map((eff) => {
            const isSelected = selectedEffort.toLowerCase() === eff.id;
            return (
              <button key={eff.id} type="button" onClick={() => onSelectEffort(eff.id)}
                className={cn(
                  "p-2 rounded-md border text-left text-xs transition-all cursor-pointer flex flex-col justify-between",
                  isSelected
                    ? "border-indigo-500 bg-indigo-950/40 text-indigo-200 shadow-xs font-medium"
                    : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold capitalize">{eff.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 leading-tight">{eff.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("py-1 space-y-0.5", className)}>
      <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 flex items-center justify-between">
        <span>Reasoning Effort</span>
        <Zap className="w-3 h-3 text-indigo-400" />
      </div>
      {EFFORT_OPTIONS.map((eff) => {
        const isSelected = selectedEffort.toLowerCase() === eff.id;
        return (
          <button key={eff.id} type="button" onClick={() => onSelectEffort(eff.id)}
            className={cn(
              "w-full flex items-center justify-between px-2 py-1.5 rounded text-left text-xs cursor-pointer transition-colors",
              isSelected
                ? "bg-zinc-800 text-indigo-400 font-semibold"
                : "text-zinc-300 hover:bg-zinc-800/60"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="capitalize">{eff.label} Effort</span>
            </div>
            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
};
