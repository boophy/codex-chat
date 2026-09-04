import { FC, useEffect, useState } from "react";
import { PlusCircle, Play, FolderOpen, FileText, ToggleLeft, ToggleRight, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Model, AskForApproval, ApprovalsReviewer } from "@/src/types/protocol";
import { ConfigToml, Personality } from "@/server/types-config-toml";

export type SessionStartSource = "startup" | "clear";
import { ModelSelector } from "./ModelSelector";
import { ReasoningEffortSelector } from "./ReasoningEffortSelector";
import { ApprovalSettings } from "./ApprovalSettings";
import { ConfigTomlEditor } from "./ConfigTomlEditor";
import { DirectoryPickerDialog } from "./DirectoryPickerDialog";
import { cn } from "@/src/lib/utils";

export interface NewThreadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: Model[];
  currentModel: string;
  currentEffort: string;
  currentApprovalPolicy: AskForApproval;
  onStartThread: (params: any) => Promise<void> | void;
  onOpenPageMode?: () => void;
}

const LOCAL_STORAGE_KEY = "codex_thread_config_v2";

export const NewThreadModal: FC<NewThreadModalProps> = ({
  open,
  onOpenChange,
  models,
  currentModel,
  currentEffort,
  currentApprovalPolicy,
  onStartThread,
  onOpenPageMode
}) => {
  const [modelProvider, setModelProvider] = useState<string>("codex-aws");
  const [model, setModel] = useState<string>(currentModel || "gpt-5");
  const [reasoningEffort, setReasoningEffort] = useState<string>(currentEffort || "medium");
  const [cwd, setCwd] = useState<string>("");
  const [approvalPolicy, setApprovalPolicy] = useState<AskForApproval>(currentApprovalPolicy || "on-request");
  const [approvalsReviewer, setApprovalsReviewer] = useState<ApprovalsReviewer>("user");
  const [serviceName, setServiceName] = useState<string>("");
  const [baseInstructions, setBaseInstructions] = useState<string>("");
  const [developerInstructions, setDeveloperInstructions] = useState<string>("");
  const [personality, setPersonality] = useState<Personality>("pragmatic");
  const [ephemeral, setEphemeral] = useState<boolean>(false);
  const [sessionStartSource, setSessionStartSource] = useState<SessionStartSource>("startup");
  const [configToml, setConfigToml] = useState<Partial<ConfigToml>>({
    model_provider: "codex-aws",
    model: "gpt-5",
    sandbox_mode: "workspace_write",
    web_search: "live",
    personality: "pragmatic"
  });

  const [activeTab, setActiveTab] = useState<"general" | "config" | "instructions">("general");
  const [showDirPicker, setShowDirPicker] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "info" | "error" | "success" } | null>(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.modelProvider) setModelProvider(parsed.modelProvider);
        if (parsed.model) setModel(parsed.model);
        if (parsed.cwd) setCwd(parsed.cwd);
        if (parsed.approvalPolicy) setApprovalPolicy(parsed.approvalPolicy);
        if (parsed.approvalsReviewer) setApprovalsReviewer(parsed.approvalsReviewer);
        if (parsed.serviceName) setServiceName(parsed.serviceName);
        if (parsed.baseInstructions) setBaseInstructions(parsed.baseInstructions);
        if (parsed.developerInstructions) setDeveloperInstructions(parsed.developerInstructions);
        if (parsed.personality) setPersonality(parsed.personality);
        if (parsed.ephemeral !== undefined) setEphemeral(Boolean(parsed.ephemeral));
        if (parsed.sessionStartSource) setSessionStartSource(parsed.sessionStartSource);
        if (parsed.config) setConfigToml(parsed.config);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const handleProviderChange = (newProvider: string) => {
    const cleanProvider = newProvider.trim() || "codex-aws";
    setModelProvider(cleanProvider);
    setConfigToml((prev) => ({ ...prev, model_provider: cleanProvider }));
  };

  const handleSubmit = async (e?: SubmitEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage({ text: "Checking bridge & starting backend app-server if needed...", type: "info" });

    // Fallback if not specified: codex-aws with CODEX_HOME=~/.codex-aws
    const effectiveProvider = (modelProvider && modelProvider.trim()) || "codex-aws";
    const effectiveCwd = (cwd && cwd.trim()) || "";

    const payload = {
      modelProvider: effectiveProvider,
      codexHome: `~/.${effectiveProvider}`,
      model: model || "gpt-5",
      cwd: effectiveCwd,
      approvalPolicy,
      approvalsReviewer,
      config: {
        ...configToml,
        model_provider: effectiveProvider,
        model: model || "gpt-5",
        model_reasoning_effort: reasoningEffort as any,
        personality
      },
      serviceName: serviceName || undefined,
      baseInstructions: baseInstructions || undefined,
      developerInstructions: developerInstructions || undefined,
      personality,
      ephemeral,
      sessionStartSource
    };

    try {
      const resp = await fetch("/api/codex/threads/ensure-and-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || `Bridge returned status ${resp.status}`);
      }

      const bridgeResult = await resp.json();
      const hydratedConfig = bridgeResult.hydratedConfig || payload;
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(hydratedConfig));
        localStorage.setItem("codex_last_provider", effectiveProvider);
      } catch {}

      setStatusMessage({ text: "Server ready! Initializing thread...", type: "success" });
      await onStartThread({
        ...hydratedConfig,
        model: hydratedConfig.model || "gpt-5"
      });

      onOpenChange(false);
    } catch (err: any) {
      console.error("[NewThreadModal] Failed to ensure and start thread:", err);
      setStatusMessage({ text: `Failed: ${err.message}`, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <PlusCircle className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-zinc-100">
                  New Thread Configuration
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">
                  Configure model provider, runtime server, approval policies, and Rust ConfigToml
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md p-0.5 text-xs">
              <button type="button" onClick={() => setActiveTab("general")}
                className={cn(
                  "px-3 py-1 rounded transition-colors cursor-pointer",
                  activeTab === "general" ? "bg-zinc-800 text-emerald-300 font-medium" : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                General
              </button>
              <button type="button" onClick={() => setActiveTab("config")}
                className={cn(
                  "px-3 py-1 rounded transition-colors cursor-pointer",
                  activeTab === "config" ? "bg-zinc-800 text-emerald-300 font-medium" : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                ConfigToml
              </button>
              <button type="button" onClick={() => setActiveTab("instructions")}
                className={cn(
                  "px-3 py-1 rounded transition-colors cursor-pointer",
                  activeTab === "instructions" ? "bg-zinc-800 text-emerald-300 font-medium" : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Instructions
              </button>
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

          {activeTab === "general" && (
            <div className="space-y-4">
              <ModelSelector
                models={models}
                selectedModel={model}
                selectedProvider={modelProvider}
                onSelectModel={setModel}
                onSelectProvider={handleProviderChange}
                variant="form"
              />

              <ReasoningEffortSelector
                selectedEffort={reasoningEffort}
                onSelectEffort={setReasoningEffort}
                variant="form"
              />

              <ApprovalSettings
                approvalPolicy={approvalPolicy}
                approvalsReviewer={approvalsReviewer}
                onSelectApprovalPolicy={setApprovalPolicy}
                onSelectApprovalsReviewer={setApprovalsReviewer}
              />

              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                    <span>Working Directory (cwd)</span>
                  </label>
                  <button type="button" onClick={() => setShowDirPicker(true)}
                    className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                  >
                    Browse...
                  </button>
                </div>
                <input type="text" placeholder="e.g. /workspace (focus to browse directories)" value={cwd}
                  onFocus={() => setShowDirPicker(true)}
                  onChange={(e) => setCwd(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="flex items-center justify-between p-2.5 rounded-md border border-zinc-800 bg-zinc-900/50">
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">Ephemeral Session</div>
                    <div className="text-[10px] text-zinc-500">Do not persist thread into permanent history</div>
                  </div>
                  <button type="button"
                    onClick={() => setEphemeral(!ephemeral)}
                    className="cursor-pointer text-zinc-400 hover:text-zinc-200"
                  >
                    {ephemeral ? (
                      <ToggleRight className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-zinc-600" />
                    )}
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Session Start Source</label>
                  <select value={sessionStartSource}
                    onChange={(e) => setSessionStartSource(e.target.value as SessionStartSource)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200"
                  >
                    <option value="startup">startup (Standard New Session)</option>
                    <option value="clear">clear (Reset Clean Slate)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === "config" && (
            <div className="space-y-3">
              <ConfigTomlEditor config={configToml} onChange={setConfigToml} modelProvider={modelProvider} />
            </div>
          )}

          {activeTab === "instructions" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Base Instructions (base_instructions)</span>
                </label>
                <textarea rows={4} value={baseInstructions}
                  placeholder="System role guidance for the Codex agent..."
                  onChange={(e) => setBaseInstructions(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Developer Instructions (developer_instructions)</span>
                </label>
                <textarea rows={4} value={developerInstructions}
                  placeholder="Developer-level guidelines, style conventions, or workspace constraints..."
                  onChange={(e) => setDeveloperInstructions(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Service Name (optional)</label>
                <input type="text" value={serviceName}
                  placeholder="e.g. backend-api, data-pipeline"
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between sm:justify-between">
          <div className="text-[11px] text-zinc-500 font-mono">
            CODEX_HOME: <span className="text-zinc-400">~/.{modelProvider || "codex-aws"}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={() => handleSubmit()} disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isSubmitting ? "Starting Server..." : "Start Thread"}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <DirectoryPickerDialog
        open={showDirPicker}
        onOpenChange={setShowDirPicker}
        initialPath={cwd}
        onSelectPath={(selected) => setCwd(selected)}
      />
    </Dialog>
  );
};
