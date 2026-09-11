import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/dialog";
import { AskForApproval, ApprovalsReviewer, SessionStartSource, SessionModalProps, NewThreadModalProps } from "@/src/types";
import { ReasoningEffortSelector } from "./ReasoningEffortSelector";
import { Cpu, AlertCircle, Check, Server } from "lucide-react";
import { ApprovalSettings } from "./ApprovalSettings";
import { Button } from "@/src/components/ui/button";
import { ModelSelector } from "./ModelSelector";
import { useState, FC, useEffect } from "react";
import { cn } from "@/src/lib/utils";

export type { SessionStartSource, SessionModalProps, NewThreadModalProps };
const LOCAL_STORAGE_KEY = "codex_thread_config_v2";

export const SessionModal: FC<SessionModalProps> = ({
  open,
  onOpenChange,
  models,
  currentModel,
  currentEffort,
  currentApprovalPolicy,
  currentApprovalsReviewer = "user",
  currentProvider = "shengsuanyun",
  onSelectModel,
  onSelectEffort,
  onSelectApprovalPolicy,
  onSelectApprovalsReviewer,
  onStartThread,
  onSwitchProvider
}) => {
  const [modelProvider, setModelProvider] = useState<string>(currentProvider || "shengsuanyun");
  const [model, setModel] = useState<string>(currentModel || "gpt-5");
  const [reasoningEffort, setReasoningEffort] = useState<string>(currentEffort || "medium");
  const [approvalPolicy, setApprovalPolicy] = useState<AskForApproval>(currentApprovalPolicy || "on-request");
  const [approvalsReviewer, setApprovalsReviewer] = useState<ApprovalsReviewer>(currentApprovalsReviewer);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "info" | "error" | "success" } | null>(null);

  // Sync state when props or open state change
  useEffect(() => {
    if (currentProvider) setModelProvider(currentProvider);
    if (currentModel) setModel(currentModel);
    if (currentEffort) setReasoningEffort(currentEffort);
    if (currentApprovalPolicy) setApprovalPolicy(currentApprovalPolicy);
    if (currentApprovalsReviewer) setApprovalsReviewer(currentApprovalsReviewer);
  }, [currentProvider, currentModel, currentEffort, currentApprovalPolicy, currentApprovalsReviewer, open]);

  // Load provider & defaults from local storage
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.modelProvider && !currentProvider) setModelProvider(parsed.modelProvider);
        if (parsed.model && !currentModel) setModel(parsed.model);
        if (parsed.approvalPolicy && !currentApprovalPolicy) setApprovalPolicy(parsed.approvalPolicy);
        if (parsed.approvalsReviewer && !currentApprovalsReviewer) setApprovalsReviewer(parsed.approvalsReviewer);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const saveToStorage = (patch: Record<string, any>) => {
    try {
      const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
      const data = existing ? JSON.parse(existing) : {};
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...data, ...patch }));
    } catch {
      // ignore storage error
    }
  };

  const handleProviderChange = (newProvider: string) => {
    const cleanProvider = newProvider.trim() || "shengsuanyun";
    setModelProvider(cleanProvider);
    saveToStorage({ modelProvider: cleanProvider });

    if (cleanProvider !== currentProvider && onSwitchProvider) {
      onOpenChange(false);
      onSwitchProvider(cleanProvider);
    }
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    onSelectModel?.(newModel);
    saveToStorage({ model: newModel });
  };

  const handleEffortChange = (newEffort: string) => {
    setReasoningEffort(newEffort);
    onSelectEffort?.(newEffort);
    saveToStorage({ reasoningEffort: newEffort });
  };

  const handleApprovalPolicyChange = (newPolicy: AskForApproval) => {
    setApprovalPolicy(newPolicy);
    onSelectApprovalPolicy?.(newPolicy);
    saveToStorage({ approvalPolicy: newPolicy });
  };

  const handleReviewerChange = (newReviewer: ApprovalsReviewer) => {
    setApprovalsReviewer(newReviewer);
    onSelectApprovalsReviewer?.(newReviewer);
    saveToStorage({ approvalsReviewer: newReviewer });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/40 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-xs">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-zinc-100">
                  Model Configuration
                </DialogTitle>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Configure the active LLM engine, reasoning effort, and execution safety policy
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {statusMessage && (
            <div className={cn(
                "p-2.5 rounded-md text-xs flex items-center gap-2",
                statusMessage.type === "error" && "bg-rose-950/40 border border-rose-800 text-rose-300",
                statusMessage.type === "info" && "bg-indigo-950/40 border border-indigo-800 text-indigo-300",
                statusMessage.type === "success" && "bg-emerald-950/40 border border-emerald-800 text-emerald-300"
              )}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
          )}

          <div className="space-y-4">
            <ModelSelector
              models={models}
              selectedModel={model}
              selectedProvider={modelProvider}
              onSelectModel={handleModelChange}
              onSelectProvider={handleProviderChange}
            />

            <ReasoningEffortSelector
              selectedEffort={reasoningEffort}
              onSelectEffort={handleEffortChange}
              variant="form"
            />

            <ApprovalSettings
              approvalPolicy={approvalPolicy}
              approvalsReviewer={approvalsReviewer}
              onSelectApprovalPolicy={handleApprovalPolicyChange}
              onSelectApprovalsReviewer={handleReviewerChange}
            />
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/30 flex items-center justify-between sm:justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
              {modelProvider} : {model} ({reasoningEffort})
            </span>
            {onSwitchProvider && (
              <Button type="button" variant="outline" size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onSwitchProvider(modelProvider);
                }}
                className="border-zinc-700 bg-zinc-900 text-zinc-200 text-xs h-8 gap-1.5 cursor-pointer hover:bg-zinc-800"
              >
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span>重启并验证登录</span>
              </Button>
            )}
          </div>
          <Button type="button" size="sm" onClick={() => onOpenChange(false)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 h-8 cursor-pointer gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply & Close</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
