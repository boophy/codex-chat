import { AskForApproval } from "@/src/types/protocol";
import { ShieldCheck, Check } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { FC } from "react";

export interface ApprovalPolicySelectorProps {
  approvalPolicy: AskForApproval;
  onSelectApprovalPolicy: (policy: AskForApproval) => void;
  variant?: "dropdown" | "form";
  className?: string;
}

export { ApprovalSettings } from "./ApprovalSettings";

interface PolicyOption {
  id: AskForApproval;
  key: string;
  label: string;
  badge: string;
  desc: string;
  colorClass: string;
}

const POLICY_OPTIONS: PolicyOption[] = [
  {
    id: "on-request",
    key: "on-request",
    label: "On Request (Default)",
    badge: "Recommended",
    desc: "Agent asks for confirmation when executing high-risk or external operations",
    colorClass: "text-emerald-400"
  },
  {
    id: "untrusted",
    key: "untrusted",
    label: "Untrusted Only",
    badge: "Cautious",
    desc: "Prompts whenever scripts or commands affect files outside current trusted repo",
    colorClass: "text-blue-400"
  },
  {
    id: "always" as AskForApproval,
    key: "always",
    label: "Always Ask",
    badge: "Strict",
    desc: "Every single tool call and command execution requires explicit approval",
    colorClass: "text-amber-400"
  },
  {
    id: "never",
    key: "never",
    label: "Never Ask",
    badge: "Dangerous",
    desc: "Autonomous execution without stopping for permission prompts",
    colorClass: "text-rose-400"
  }
];

export const ApprovalPolicySelector: FC<ApprovalPolicySelectorProps> = ({
  approvalPolicy,
  onSelectApprovalPolicy,
  variant = "dropdown",
  className
}) => {
  const currentKey = typeof approvalPolicy === "string" ? approvalPolicy : "granular";

  if (variant === "form") {
    return (
      <div className={cn("space-y-1.5", className)}>
        <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>Approval Policy (approval_policy)</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {POLICY_OPTIONS.map((pol) => {
            const isSelected = currentKey === pol.key;
            return (
              <button key={pol.key} type="button" onClick={() => onSelectApprovalPolicy(pol.id)}
                className={cn(
                  "p-2.5 rounded-md border text-left text-xs transition-all cursor-pointer flex flex-col justify-between",
                  isSelected
                    ? "border-amber-500 bg-amber-950/30 text-amber-200 shadow-xs"
                    : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-zinc-200">{pol.label}</span>
                    <span className={cn("text-[9px] px-1 py-0.5 rounded font-mono font-bold bg-zinc-800", pol.colorClass)}>
                      {pol.badge}
                    </span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 leading-tight">{pol.desc}</span>
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
        <span>Approval Policy</span>
        <ShieldCheck className="w-3 h-3 text-amber-400" />
      </div>
      {POLICY_OPTIONS.map((pol) => {
        const isSelected = currentKey === pol.key;
        return (
          <button key={pol.key} type="button" onClick={() => onSelectApprovalPolicy(pol.id)}
            className={cn(
              "w-full flex items-center justify-between px-2 py-1.5 rounded text-left text-xs cursor-pointer transition-colors",
              isSelected
                ? "bg-zinc-800 text-amber-400 font-semibold"
                : "text-zinc-300 hover:bg-zinc-800/60"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span>{pol.label}</span>
              <span className={cn("text-[9px] px-1 py-0 rounded font-mono", pol.colorClass)}>
                {pol.badge}
              </span>
            </div>
            {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
};
