import { ArrowLeft, Play, FolderOpen, FileText, Sparkles, Layers, Settings, ShieldCheck, Cpu, Info, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import { AskForApproval, ApprovalsReviewer, ConfigToml, Personality, SessionStartSource, NewThreadPageProps } from "@/src/types";
import { ReasoningEffortSelector } from "./ReasoningEffortSelector";
import { DirectoryPickerDialog } from "./DirectoryPickerDialog";
import { ApprovalSettings } from "./ApprovalSettings";
import { ConfigTomlEditor } from "./ConfigTomlEditor";
import { Button } from "@/src/components/ui/button";
import { ModelSelector } from "./ModelSelector";
import { FC, useEffect, useState } from "react";
import { cn } from "@/src/lib/utils";
import { useCodex } from "@/src/lib/ctx";

export type { SessionStartSource, NewThreadPageProps };

const LOCAL_STORAGE_KEY = "codex_thread_config_v2";

export const NewThreadPage: FC<NewThreadPageProps> = ({
  models,
  currentModel,
  currentEffort,
  currentApprovalPolicy,
  currentProvider = "shengsuanyun",
  onBack,
  onStartThread,
  onOpenProviderModal
}) => {
  const { dispatch } = useCodex();
  const [modelProvider, setModelProvider] = useState<string>(currentProvider || "shengsuanyun");
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
    model_provider: "shengsuanyun",
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
    if (!cwd) {
      fetch("/api/fs/directories")
        .then((res) => res.json())
        .then((data) => {
          if (data.currentPath) {
            setCwd(data.currentPath);
          }
        })
        .catch(() => {});
    }
  }, [cwd]);

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
      // ignore
    }
  }, []);

  const handleProviderChange = (newProvider: string) => {
    const cleanProvider = newProvider.trim() || "shengsuanyun";
    setModelProvider(cleanProvider);
    setConfigToml((prev) => ({ ...prev, model_provider: cleanProvider }));

    if (onOpenProviderModal && cleanProvider !== modelProvider) {
      onOpenProviderModal(cleanProvider);
    }
  };

  const handleResetDefaults = () => {
    setModelProvider("shengsuanyun");
    setModel(currentModel || "gpt-5");
    setReasoningEffort(currentEffort || "medium");
    setApprovalPolicy("on-request");
    setApprovalsReviewer("user");
    setServiceName("");
    setBaseInstructions("");
    setDeveloperInstructions("");
    setPersonality("pragmatic");
    setEphemeral(false);
    setSessionStartSource("startup");
    setConfigToml({
      model_provider: "shengsuanyun",
      model: "gpt-5",
      sandbox_mode: "workspace_write",
      web_search: "live",
      personality: "pragmatic"
    });
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  const handlePickDirectory = async () => {
    try {
      if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
        const dirHandle = await (window as any).showDirectoryPicker();
        if (dirHandle && dirHandle.name) {
          // Check if direct full path is available (e.g. in desktop/Electron runtimes)
          if ((dirHandle as any).path && typeof (dirHandle as any).path === "string") {
            const full = (dirHandle as any).path;
            setCwd(full);
            setStatusMessage({
              text: `Selected directory: ${full}`,
              type: "success"
            });
            return;
          }

          // Resolve complete full path via server filesystem
          try {
            const resp = await fetch("/api/fs/resolve-folder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                folderName: dirHandle.name,
                currentPath: cwd
              })
            });
            if (resp.ok) {
              const data = await resp.json();
              if (data.fullPath) {
                setCwd(data.fullPath);
                setStatusMessage({
                  text: `Selected directory: ${data.fullPath}`,
                  type: "success"
                });
                return;
              }
            }
          } catch (e) {
            console.error("Failed to resolve full path from server", e);
          }

          // Fallback to absolute path constructed from base
          const base = (cwd && cwd.startsWith("/")) ? cwd : "/workspace";
          const fallbackFullPath = base.endsWith("/") ? `${base}${dirHandle.name}` : `${base}/${dirHandle.name}`;
          setCwd(fallbackFullPath);
          setStatusMessage({
            text: `Selected directory: ${fallbackFullPath}`,
            type: "success"
          });
        }
      } else {
        setShowDirPicker(true);
        setStatusMessage({
          text: "File System Access API is not supported in this browser. Opened server directory picker.",
          type: "info"
        });
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error(err);
        setStatusMessage({
          text: err.message || "Failed to select directory via File System Access API",
          type: "error"
        });
      }
    }
  };

  const handleSubmit = async (e?: SubmitEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage({ text: "Ensuring Codex backend app-server and saving configuration...", type: "info" });

    const effectiveProvider = (modelProvider && modelProvider.trim()) || "shengsuanyun";
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
    dispatch({ type: "UPDATE_THREAD", payload });
    try {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
        localStorage.setItem("codex_last_provider", modelProvider);
      } catch {
        // ignore
      }

      setStatusMessage({ text: "Initializing thread via WebSocket...", type: "success" });

      // 3. Trigger onStartThread with full hydrated payload
      await onStartThread(payload);

      // Return to chat view
      onBack();
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ text: err.message || "Failed to start thread", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-y-auto select-text">
      <header className="sticky top-0 z-10 px-6 py-4 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button type="button" variant="ghost" size="sm" onClick={onBack}
            className="text-zinc-400 hover:text-zinc-100 gap-1.5 h-8 px-2.5 text-xs border border-zinc-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Chat</span>
          </Button>

          <div className="h-4 w-px bg-zinc-800" />

          <div className="min-w-0">
            <h1 className="text-base font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
              <span>New Thread Configuration</span>
            </h1>
            <p className="text-xs text-zinc-400 truncate">
              Set execution parameters, directory workspace, ConfigToml options, and dynamic custom JsonValues
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={handleResetDefaults}
            className="text-zinc-400 hover:text-zinc-200 border-zinc-800 text-xs h-8 gap-1.5"
            title="Reset form fields to standard defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </Button>

          <Button type="button" size="sm" onClick={() => handleSubmit()} disabled={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-8 gap-1.5 shadow-sm cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isSubmitting ? "Starting Thread..." : "Start Thread with Config"}</span>
          </Button>
        </div>
      </header>
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {statusMessage && (
            <div className={cn(
                "p-3 rounded-lg border text-xs flex items-center gap-2.5",
                statusMessage.type === "info" && "bg-indigo-950/40 border-indigo-700/50 text-indigo-200",
                statusMessage.type === "error" && "bg-red-950/40 border-red-700/50 text-red-200",
                statusMessage.type === "success" && "bg-emerald-950/40 border-emerald-700/50 text-emerald-200"
              )}
            >
              {statusMessage.type === "info" && <Info className="w-4 h-4 shrink-0 text-indigo-400" />}
              {statusMessage.type === "error" && <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />}
              {statusMessage.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
              <span>{statusMessage.text}</span>
            </div>
          )}
          <div className="flex border-b border-zinc-800 gap-6 text-xs">
            <button type="button" onClick={() => setActiveTab("general")}
              className={cn(
                "pb-2.5 font-medium transition-colors border-b-2 flex items-center gap-2 cursor-pointer",
                activeTab === "general"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Cpu className="w-4 h-4" />
              <span>General & Workspace</span>
            </button>

            <button type="button" onClick={() => setActiveTab("config")}
              className={cn(
                "pb-2.5 font-medium transition-colors border-b-2 flex items-center gap-2 cursor-pointer",
                activeTab === "config"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Layers className="w-4 h-4" />
              <span>Codex ConfigToml & Custom Keys</span>
            </button>

            <button type="button" onClick={() => setActiveTab("instructions")}
              className={cn(
                "pb-2.5 font-medium transition-colors border-b-2 flex items-center gap-2 cursor-pointer",
                activeTab === "instructions"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              <FileText className="w-4 h-4" />
              <span>Instructions & Personality</span>
            </button>
          </div>

          {activeTab === "general" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-emerald-400" />
                    <span>Working Directory (cwd)</span>
                  </label>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    File System Access API
                  </span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input type="text" value={cwd} onChange={(e) => setCwd(e.target.value)}
                      placeholder="/workspace or project path"
                      className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono transition-colors"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={handlePickDirectory}
                    className="border-zinc-800 text-zinc-300 hover:text-zinc-100 gap-1.5 text-xs h-9 px-3 cursor-pointer"
                    title="Select folder via File System Access API without uploading files"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Pick Directory</span>
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowDirPicker(true)}
                    className="text-zinc-400 hover:text-zinc-200 text-xs h-9 px-2.5"
                    title="Browse server directories"
                  >
                    Server Dir
                  </Button>
                </div>
                <p className="text-[11px] text-zinc-500">
                  The working directory where tool executions and bash commands will take effect. Uses the browser&apos;s File System Access API to select directory handles without reading or uploading any files.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                <div className="font-semibold text-xs text-zinc-200 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>Model Selection & Reasoning Budget</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ModelSelector models={models} selectedModel={model} selectedProvider={modelProvider}
                    onSelectModel={(m) => {
                      setModel(m);
                      setConfigToml((prev) => ({ ...prev, model: m }));
                    }}
                    onSelectProvider={handleProviderChange}
                  />

                  <ReasoningEffortSelector
                    selectedEffort={reasoningEffort}
                    onSelectEffort={(eff) => {
                      setReasoningEffort(eff);
                      setConfigToml((prev) => ({ ...prev, model_reasoning_effort: eff as any }));
                    }}
                    variant="form"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                <div className="font-semibold text-xs text-zinc-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Security & Command Approval Policy</span>
                </div>

                <ApprovalSettings
                  approvalPolicy={approvalPolicy}
                  approvalsReviewer={approvalsReviewer}
                  onSelectApprovalPolicy={(p) => setApprovalPolicy(p)}
                  onSelectApprovalsReviewer={(r) => setApprovalsReviewer(r)}
                />
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div onClick={() => setEphemeral(!ephemeral)}
                    className={cn(
                      "p-3 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-colors select-none",
                      ephemeral ? "bg-zinc-900 border-indigo-500/50 text-zinc-100" : "bg-zinc-900/40 border-zinc-800 text-zinc-400"
                    )}
                  >
                    <div>
                      <div className="font-semibold text-zinc-200">Ephemeral Session</div>
                      <div className="text-[11px] text-zinc-500">Do not persist history to disk upon close</div>
                    </div>
                    <div className={cn("w-4 h-4 rounded flex items-center justify-center border", ephemeral ? "bg-indigo-500 border-indigo-400 text-zinc-950" : "border-zinc-700")}>
                      {ephemeral && <CheckCircle2 className="w-3 h-3 stroke-3" />}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-zinc-400">Session Start Source</label>
                    <select value={sessionStartSource}
                      onChange={(e) => setSessionStartSource(e.target.value as SessionStartSource)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200"
                    >
                      <option value="startup">startup (Standard initial launch)</option>
                      <option value="clear">clear (Explicit thread reset / clean context)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "config" && (
            <div className="space-y-4">
              <ConfigTomlEditor config={configToml} onChange={setConfigToml} modelProvider={modelProvider}/>
            </div>
          )}

          {activeTab === "instructions" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Agent Personality Preset</span>
                  </span>
                  <span className="text-[11px] text-zinc-500">Codex agent conversational tone</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(["pragmatic", "friendly", "thoughtful", "concise", "none"] as const).map((p) => {
                    const isSelected = personality === p;
                    return (
                      <button key={p} type="button"
                        onClick={() => {
                          setPersonality(p);
                          setConfigToml((prev) => ({ ...prev, personality: p }));
                        }}
                        className={cn(
                          "py-2 px-3 rounded-lg border text-center text-xs capitalize cursor-pointer transition-all",
                          isSelected
                            ? "border-emerald-500 bg-emerald-950/40 text-emerald-300 font-semibold shadow-xs"
                            : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2">
                <label className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
                  <span>Base Instructions (System Prompt)</span>
                  <span className="text-[10px] text-zinc-500 font-mono">base_instructions</span>
                </label>
                <textarea rows={4} value={baseInstructions}
                  onChange={(e) => setBaseInstructions(e.target.value)}
                  placeholder="Optional custom base instructions overriding default system prompts..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 font-mono focus:border-zinc-700 focus:outline-none"
                />
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2">
                <label className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
                  <span>Developer Instructions (Runtime Overlay)</span>
                  <span className="text-[10px] text-zinc-500 font-mono">developer_instructions</span>
                </label>
                <textarea rows={4} value={developerInstructions}
                  onChange={(e) => setDeveloperInstructions(e.target.value)}
                  placeholder="Optional developer instructions for specialized debugging or guidelines..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 font-mono focus:border-zinc-700 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-4 sticky top-24">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="font-semibold text-xs text-zinc-200 flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-emerald-400" />
                <span>Configuration Summary</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-500">Live Hydration</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Model Provider:</span>
                <span className="font-mono text-zinc-200 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                  {modelProvider || "shengsuanyun"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Target Model:</span>
                <span className="font-mono text-zinc-200 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                  {model || "gpt-5"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Reasoning Budget:</span>
                <span className="font-mono text-emerald-400 capitalize">{reasoningEffort}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Approval Policy:</span>
                <span className="font-mono text-amber-400 capitalize">
                  {typeof approvalPolicy === "string" ? approvalPolicy : "granular"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Personality:</span>
                <span className="font-mono text-zinc-300 capitalize">{personality}</span>
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-zinc-500">
                  <span>Working Directory:</span>
                  <button type="button" onClick={handlePickDirectory}
                    className="text-emerald-400 hover:underline text-[11px] cursor-pointer"
                  >
                    Change
                  </button>
                </div>
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 break-all">
                  {cwd || "(Current default)"}
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800 space-y-1 text-[11px] text-zinc-500">
                <div className="flex justify-between">
                  <span>Backend Server Mapping:</span>
                  <span className="font-mono text-zinc-400">~/.{modelProvider || "shengsuanyun"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Session Mode:</span>
                  <span className="font-mono text-zinc-400">{ephemeral ? "Ephemeral" : "Persistent SQLite"}</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button type="button" size="default" onClick={() => handleSubmit()} disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-10 gap-2 shadow-md cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{isSubmitting ? "Launching..." : "Launch Thread with Config"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
      <DirectoryPickerDialog
        open={showDirPicker}
        onOpenChange={setShowDirPicker}
        initialPath={cwd}
        onSelectPath={(selected) => setCwd(selected)}
      />
    </div>
  );
};
