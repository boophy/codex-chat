import { ShieldCheck, UserCheck, Check, ChevronsUpDown } from "lucide-react";
import { AskForApproval, ApprovalsReviewer } from "@/src/types/protocol";
import { useEffect, useRef, useState, FC } from "react";
import { cn } from "@/src/lib/utils";

export interface ApprovalSettingsProps {
  approvalPolicy: AskForApproval;
  approvalsReviewer: ApprovalsReviewer;
  onSelectApprovalPolicy: (policy: AskForApproval) => void;
  onSelectApprovalsReviewer: (reviewer: ApprovalsReviewer) => void;
  className?: string;
  disabled?: boolean;
}

interface PolicyOption {
  id: AskForApproval;
  key: string;
  label: string;
  badge: string;
  badgeClass: string;
  desc: string;
}

interface ReviewerOption {
  id: ApprovalsReviewer;
  label: string;
  badge: string;
  badgeClass: string;
  desc: string;
}

const POLICY_OPTIONS: PolicyOption[] = [
  {
    id: "on-request",
    key: "on-request",
    label: "On Request (Default)",
    badge: "Recommended",
    badgeClass: "text-emerald-400 bg-emerald-950/60 border-emerald-800/50",
    desc: "Asks confirmation before executing high-risk or external operations"
  },
  {
    id: "untrusted",
    key: "untrusted",
    label: "Untrusted Only",
    badge: "Cautious",
    badgeClass: "text-blue-400 bg-blue-950/60 border-blue-800/50",
    desc: "Prompts whenever affecting files outside current workspace"
  },
  {
    id: "always" as AskForApproval,
    key: "always",
    label: "Always Ask",
    badge: "Strict",
    badgeClass: "text-amber-400 bg-amber-950/60 border-amber-800/50",
    desc: "Every single tool call and command requires explicit approval"
  },
  {
    id: "never",
    key: "never",
    label: "Never Ask",
    badge: "Dangerous",
    badgeClass: "text-rose-400 bg-rose-950/60 border-rose-800/50",
    desc: "Autonomous execution without stopping for permission prompts"
  }
];

const REVIEWER_OPTIONS: ReviewerOption[] = [
  {
    id: "user",
    label: "user",
    badge: "Interactive UI",
    badgeClass: "text-purple-400 bg-purple-950/60 border-purple-800/50",
    desc: "Interactive banners & human confirmation in chat"
  },
  {
    id: "auto_review",
    label: "auto_review",
    badge: "Automated Rules",
    badgeClass: "text-blue-400 bg-blue-950/60 border-blue-800/50",
    desc: "Automated evaluation against configured security rules"
  },
  {
    id: "guardian_subagent",
    label: "guardian_subagent",
    badge: "AI Guardian",
    badgeClass: "text-indigo-400 bg-indigo-950/60 border-indigo-800/50",
    desc: "Dedicated AI guardian subagent audits safety"
  }
];

export const ApprovalSettings: FC<ApprovalSettingsProps> = ({
  approvalPolicy,
  approvalsReviewer,
  onSelectApprovalPolicy,
  onSelectApprovalsReviewer,
  className,
  disabled = false
}) => {
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [isReviewerOpen, setIsReviewerOpen] = useState(false);
  const policyRef = useRef<HTMLDivElement>(null);
  const reviewerRef = useRef<HTMLDivElement>(null);
  const currentPolicyKey = typeof approvalPolicy === "string" ? approvalPolicy : "granular";
  const activePolicy = POLICY_OPTIONS.find((p) => p.key === currentPolicyKey) || POLICY_OPTIONS[0];
  const activeReviewer = REVIEWER_OPTIONS.find((r) => r.id === approvalsReviewer) || REVIEWER_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (policyRef.current && !policyRef.current.contains(e.target as Node)) {
        setIsPolicyOpen(false);
      }
      if (reviewerRef.current && !reviewerRef.current.contains(e.target as Node)) {
        setIsReviewerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3.5", className)}>
      {/* 1. Approval Policy Selection Box */}
      <div className={cn("space-y-1.5 relative", isPolicyOpen ? "z-30" : "z-20")} ref={policyRef}>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Approval Policy (approval_policy)</span>
          </label>
          <span className={cn("text-[9px] px-1.5 py-0.2 rounded font-mono font-medium border", activePolicy.badgeClass)}>
            {activePolicy.badge}
          </span>
        </div>

        <div className="relative">
          <button type="button" disabled={disabled}
            onClick={() => {
              setIsPolicyOpen(!isPolicyOpen);
              setIsReviewerOpen(false);
            }}
            className={cn(
              "w-full flex items-center justify-between bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer text-left",
              isPolicyOpen && "border-amber-500/70 ring-1 ring-amber-500/50"
            )}
          >
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-100 truncate">{activePolicy.label}</span>
              </div>
              <div className="text-[11px] text-zinc-500 truncate mt-0.5">{activePolicy.desc}</div>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          </button>

          {isPolicyOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl p-1 max-h-60 overflow-y-auto backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-150 space-y-0.5">
              {POLICY_OPTIONS.map((pol) => {
                const isSelected = currentPolicyKey === pol.key;
                return (
                  <button key={pol.key} type="button"
                    onClick={() => {
                      onSelectApprovalPolicy(pol.id);
                      setIsPolicyOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-2 rounded-md text-left text-xs transition-colors cursor-pointer group",
                      isSelected
                        ? "bg-amber-950/40 border border-amber-500/50 text-amber-200"
                        : "hover:bg-zinc-900 text-zinc-300 border border-transparent"
                    )}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-zinc-100 group-hover:text-amber-300">
                          {pol.label}
                        </span>
                        <span className={cn("text-[9px] px-1 py-0.2 rounded font-mono font-medium border", pol.badgeClass)}>
                          {pol.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate mt-0.5">{pol.desc}</div>
                    </div>
                    {isSelected ? (
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className={cn("space-y-1.5 relative", isReviewerOpen ? "z-30" : "z-20")} ref={reviewerRef}>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>Approvals Reviewer</span>
          </label>
          <span className={cn("text-[9px] px-1.5 py-0.2 rounded font-mono font-medium border", activeReviewer.badgeClass)}>
            {activeReviewer.badge}
          </span>
        </div>

        <div className="relative">
          <button type="button" disabled={disabled}
            onClick={() => {
              setIsReviewerOpen(!isReviewerOpen);
              setIsPolicyOpen(false);
            }}
            className={cn(
              "w-full flex items-center justify-between bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer text-left",
              isReviewerOpen && "border-purple-500/70 ring-1 ring-purple-500/50"
            )}
          >
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-100 font-mono">{activeReviewer.label}</span>
                <span className="text-[11px] text-zinc-400">({activeReviewer.badge})</span>
              </div>
              <div className="text-[11px] text-zinc-500 truncate mt-0.5">{activeReviewer.desc}</div>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          </button>

          {isReviewerOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl p-1 max-h-60 overflow-y-auto backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-150 space-y-0.5">
              {REVIEWER_OPTIONS.map((rev) => {
                const isSelected = approvalsReviewer === rev.id;
                return (
                  <button key={rev.id} type="button"
                    onClick={() => {
                      onSelectApprovalsReviewer(rev.id);
                      setIsReviewerOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-2 rounded-md text-left text-xs transition-colors cursor-pointer group",
                      isSelected
                        ? "bg-purple-950/40 border border-purple-500/50 text-purple-200"
                        : "hover:bg-zinc-900 text-zinc-300 border border-transparent"
                    )}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold font-mono text-zinc-100 group-hover:text-purple-300">
                          {rev.label}
                        </span>
                        <span className={cn("text-[9px] px-1 py-0.2 rounded font-mono font-medium border", rev.badgeClass)}>
                          {rev.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate mt-0.5">{rev.desc}</div>
                    </div>
                    {isSelected ? (
                      <Check className="w-4 h-4 text-purple-400 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
