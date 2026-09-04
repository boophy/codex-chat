import { ConfigToml, SandboxMode, WebSearchMode, ReasoningEffort, AutoCompactTokenLimitScope } from "@/server/types-config-toml";
import { Sliders, RefreshCw, Code2, Plus, Trash2, Edit2, Check, Cpu, Layers, Shield, Bot, AlertCircle } from "lucide-react";
import { useState, useEffect, FC, useMemo } from "react";
import { wsClient } from "@/src/lib/websocket-client";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

export interface ConfigTomlEditorProps {
  config: Partial<ConfigToml>;
  onChange: (updated: Partial<ConfigToml>) => void;
  modelProvider?: string;
  className?: string;
}

type JsonValueType = "string" | "number" | "boolean" | "json";

interface CustomKeyValueEntry {
  key: string;
  type: JsonValueType;
  value: any;
}

// Known standard keys in ConfigToml to distinguish from custom dynamic key: JsonValue entries
const STANDARD_CONFIG_KEYS = new Set([
  "model",
  "review_model",
  "model_provider",
  "model_context_window",
  "model_auto_compact_token_limit",
  "model_auto_compact_token_limit_scope",
  "approval_policy",
  "approvals_reviewer",
  "allow_login_shell",
  "sandbox_mode",
  "default_permissions",
  "instructions",
  "developer_instructions",
  "compact_prompt",
  "model_providers",
  "project_doc_max_bytes",
  "tool_output_token_limit",
  "model_reasoning_effort",
  "personality",
  "service_tier",
  "openai_base_url",
  "web_search",
  "tools",
  "agents",
  "features",
  "oss_provider",
  "check_for_update_on_startup",
  "disable_paste_burst"
]);

export const ConfigTomlEditor: FC<ConfigTomlEditorProps> = ({ config, onChange, modelProvider, className }) => {
  const [viewMode, setViewMode] = useState<"form" | "raw">("form");
  const [isLoadingOnlineConfig, setIsLoadingOnlineConfig] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [activeSection, setActiveSection] = useState<"models" | "limits" | "env" | "agents" | "custom">("models");
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyType, setNewKeyType] = useState<JsonValueType>("string");
  const [newKeyValue, setNewKeyValue] = useState<string>("");
  const [customError, setCustomError] = useState<string | null>(null);

  useEffect(() => {
    setRawText(JSON.stringify(config, null, 2));
  }, [config]);

  const fetchOnlineConfig = async () => {
    setIsLoadingOnlineConfig(true);
    setFetchError(null);
    try {
      let fetchedConfig: Partial<ConfigToml> | null = null;
      if (wsClient.status === "connected") {
        try {
          const res = await wsClient.request("config/read", {});
          fetchedConfig = res?.config || res;
        } catch {
          // fallback
        }
      }

      if (!fetchedConfig) {
        const url = modelProvider
          ? `/api/codex/config/read?provider=${encodeURIComponent(modelProvider)}`
          : "/api/codex/config/read";
        const resp = await fetch(url);
        if (resp.ok) {
          const data = await resp.json();
          fetchedConfig = data.config;
        }
      }

      if (fetchedConfig) {
        onChange({ ...config, ...fetchedConfig });
      } else {
        setFetchError("Could not retrieve active config from app-server. Using local values.");
      }
    } catch (e: any) {
      setFetchError(e.message || "Failed to fetch online config");
    } finally {
      setIsLoadingOnlineConfig(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    onChange({
      ...config,
      [field]: value
    });
  };

  const handleNestedFieldChange = (parent: "tools" | "agents" | "features", key: string, value: any) => {
    const parentObj = (config[parent] as any) || {};
    onChange({
      ...config,
      [parent]: {
        ...parentObj,
        [key]: value
      }
    });
  };

  // Find all custom dynamic keys present in config
  const customEntries = useMemo<CustomKeyValueEntry[]>(() => {
    const entries: CustomKeyValueEntry[] = [];
    Object.keys(config).forEach((k) => {
      if (!STANDARD_CONFIG_KEYS.has(k)) {
        const val = config[k];
        let t: JsonValueType = "string";
        if (typeof val === "number") t = "number";
        else if (typeof val === "boolean") t = "boolean";
        else if (typeof val === "object" && val !== null) t = "json";
        entries.push({ key: k, type: t, value: val });
      }
    });
    return entries;
  }, [config]);

  const handleSaveCustomEntry = (e: SubmitEvent) => {
    e.preventDefault();
    setCustomError(null);
    const key = newKeyName.trim();
    if (!key) {
      setCustomError("Key name cannot be empty");
      return;
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(key)) {
      setCustomError("Key should contain alphanumeric characters, underscores, dashes, or dots");
      return;
    }

    let parsedVal: any = newKeyValue;
    if (newKeyType === "number") {
      const num = Number(newKeyValue);
      if (isNaN(num)) {
        setCustomError("Invalid number value");
        return;
      }
      parsedVal = num;
    } else if (newKeyType === "boolean") {
      parsedVal = newKeyValue.toLowerCase() === "true" || newKeyValue === "1";
    } else if (newKeyType === "json") {
      try {
        parsedVal = JSON.parse(newKeyValue || "{}");
      } catch (err: any) {
        setCustomError("Invalid JSON syntax: " + err.message);
        return;
      }
    }

    onChange({
      ...config,
      [key]: parsedVal
    });

    setNewKeyName("");
    setNewKeyValue("");
    setIsAddingCustom(false);
  };

  const handleDeleteCustomEntry = (keyToDelete: string) => {
    const next = { ...config };
    delete next[keyToDelete];
    onChange(next);
  };

  return (
    <div className={cn("rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-4 text-xs shadow-md", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-600/40 flex items-center justify-center text-emerald-400">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-semibold text-zinc-100 flex items-center gap-2">
              <span>Codex ConfigToml Parameters</span>
              <span className="text-[10px] text-zinc-500 font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                config_toml.rs
              </span>
            </div>
            <div className="text-[11px] text-zinc-400">
              Fine-tune models, review agents, token limits, execution environment & dynamic JsonValues
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={fetchOnlineConfig}
            disabled={isLoadingOnlineConfig}
            className="text-indigo-300 hover:text-indigo-200 hover:bg-indigo-950/50 gap-1 text-[11px] h-7"
            title="Read active configuration from running Codex app-server"
          >
            <RefreshCw className={cn("w-3 h-3", isLoadingOnlineConfig && "animate-spin")} />
            <span>Sync from app-server</span>
          </Button>

          <div className="flex border border-zinc-800 rounded p-0.5 bg-zinc-900">
            <button type="button" onClick={() => setViewMode("form")}
              className={cn(
                "px-2.5 py-1 rounded text-xs transition-colors cursor-pointer",
                viewMode === "form" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              Form View
            </button>
            <button type="button" onClick={() => setViewMode("raw")}
              className={cn(
                "px-2.5 py-1 rounded text-xs transition-colors cursor-pointer flex items-center gap-1",
                viewMode === "raw" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Code2 className="w-3 h-3" />
              <span>JSON View</span>
            </button>
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="text-xs text-amber-400 bg-amber-950/20 border border-amber-800/40 p-2.5 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {viewMode === "raw" ? (
        <div className="space-y-2">
          <div className="text-[11px] text-zinc-400 font-mono flex items-center justify-between">
            <span>Direct JSON representation applied to Codex server thread:</span>
            <span className="text-zinc-500">{Object.keys(config).length} active fields</span>
          </div>
          <textarea rows={14} value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(parsed);
              } catch {}
            }}
            className="w-full font-mono text-[11px] bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
          />
        </div>
      ) : (
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-800/80 pb-2">
            {[
              { id: "models", label: "Models & Providers", icon: Cpu },
              { id: "limits", label: "Token & Context Limits", icon: Layers },
              { id: "env", label: "Environment & Sandbox", icon: Shield },
              { id: "agents", label: "Tools & Multi-Agent", icon: Bot },
              {
                id: "custom",
                label: `Dynamic Keys (${customEntries.length})`,
                icon: Plus,
                highlight: customEntries.length > 0
              }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSection === tab.id;
              return (
                <button key={tab.id} type="button" onClick={() => setActiveSection(tab.id as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer border",
                    isActive
                      ? "bg-zinc-800 border-zinc-700 text-zinc-100 shadow-xs"
                      : "border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200",
                    tab.highlight && !isActive && "text-emerald-400/90"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", isActive ? "text-emerald-400" : "text-zinc-500")} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          {activeSection === "models" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-300 flex items-center justify-between">
                    <span>Model Provider (model_provider)</span>
                    <span className="text-zinc-500 text-[10px] font-mono">codex-aws / openai</span>
                  </label>
                  <input type="text" placeholder="codex-aws"
                    value={config.model_provider ?? modelProvider ?? "codex-aws"}
                    onChange={(e) => handleFieldChange("model_provider", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono focus:border-zinc-700 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-300 flex items-center justify-between">
                    <span>Primary Model (model)</span>
                    <span className="text-zinc-500 text-[10px] font-mono">gpt-5 / gpt-4o</span>
                  </label>
                  <input type="text" placeholder="gpt-5" value={config.model ?? "gpt-5"}
                    onChange={(e) => handleFieldChange("model", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono focus:border-zinc-700 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-300 flex items-center justify-between">
                    <span>Review Model (review_model)</span>
                    <span className="text-zinc-500 text-[10px] font-mono">Code reviewer subagent</span>
                  </label>
                  <input type="text" placeholder="gpt-4o" value={config.review_model ?? "gpt-4o"}
                    onChange={(e) => handleFieldChange("review_model", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono focus:border-zinc-700 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-300">
                    Reasoning Effort (model_reasoning_effort)
                  </label>
                  <select value={config.model_reasoning_effort ?? "medium"}
                    onChange={(e) => handleFieldChange("model_reasoning_effort", e.target.value as ReasoningEffort)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none"
                  >
                    <option value="none">none (Immediate, no CoT)</option>
                    <option value="low">low (Concise CoT)</option>
                    <option value="medium">medium (Standard CoT)</option>
                    <option value="high">high (In-depth CoT)</option>
                    <option value="xhigh">xhigh (Maximum reasoning budget)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-300">Service Tier (service_tier)</label>
                  <select value={config.service_tier ?? "default"}
                    onChange={(e) => handleFieldChange("service_tier", e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none"
                  >
                    <option value="default">default</option>
                    <option value="scale">scale (Higher concurrency)</option>
                    <option value="priority">priority (Dedicated VIP)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-300 flex items-center justify-between">
                    <span>OpenAI Base URL (openai_base_url)</span>
                    <span className="text-zinc-500 text-[10px]">Optional custom gateway</span>
                  </label>
                  <input type="text" value={config.openai_base_url ?? ""}
                    onChange={(e) => handleFieldChange("openai_base_url", e.target.value || null)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono focus:border-zinc-700 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === "limits" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-300 flex items-center justify-between">
                    <span>Context Window (model_context_window)</span>
                    <span className="text-zinc-500 text-[10px] font-mono">tokens</span>
                  </label>
                  <input type="number" value={config.model_context_window ?? 128000}
                    onChange={(e) => handleFieldChange("model_context_window", parseInt(e.target.value, 10))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono focus:border-zinc-700 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-300 flex items-center justify-between">
                    <span>Auto Compact Limit (model_auto_compact_token_limit)</span>
                    <span className="text-zinc-500 text-[10px] font-mono">tokens</span>
                  </label>
                  <input type="number"
                    value={config.model_auto_compact_token_limit ?? 80000}
                    onChange={(e) => handleFieldChange("model_auto_compact_token_limit", parseInt(e.target.value, 10))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono focus:border-zinc-700 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-300">
                    Compaction Scope (model_auto_compact_token_limit_scope)
                  </label>
                  <select value={config.model_auto_compact_token_limit_scope ?? "full_context"}
                    onChange={(e) => handleFieldChange("model_auto_compact_token_limit_scope", e.target.value as AutoCompactTokenLimitScope)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none"
                  >
                    <option value="full_context">full_context (Compress across entire thread)</option>
                    <option value="after_prefix">after_prefix (Preserve initial system prefix)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-300 flex items-center justify-between">
                    <span>Tool Output Limit (tool_output_token_limit)</span>
                    <span className="text-zinc-500 text-[10px] font-mono">tokens</span>
                  </label>
                  <input type="number" value={config.tool_output_token_limit ?? 16000}
                    onChange={(e) => handleFieldChange("tool_output_token_limit", parseInt(e.target.value, 10))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono focus:border-zinc-700 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[11px] font-medium text-zinc-300 flex items-center justify-between">
                    <span>Project Documentation Ingestion Cap (project_doc_max_bytes)</span>
                    <span className="text-zinc-500 text-[10px] font-mono">bytes (default: 65536)</span>
                  </label>
                  <input type="number" value={config.project_doc_max_bytes ?? 65536}
                    onChange={(e) => handleFieldChange("project_doc_max_bytes", parseInt(e.target.value, 10))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono focus:border-zinc-700 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === "env" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-300">Sandbox Mode (sandbox_mode)</label>
                  <select value={config.sandbox_mode ?? "workspace_write"}
                    onChange={(e) => handleFieldChange("sandbox_mode", e.target.value as SandboxMode)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none"
                  >
                    <option value="workspace_write">workspace_write (Standard container sandbox)</option>
                    <option value="read_only">read_only (Strict read-only filesystem)</option>
                    <option value="danger_full_access">danger_full_access (Full machine access)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-300">Web Search Mode (web_search)</label>
                  <select value={config.web_search ?? "live"}
                    onChange={(e) => handleFieldChange("web_search", e.target.value as WebSearchMode)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none"
                  >
                    <option value="live">live (Live Web Search)</option>
                    <option value="cached">cached (Cached snapshots)</option>
                    <option value="indexed">indexed (Local index)</option>
                    <option value="disabled">disabled (Offline)</option>
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[11px] font-medium text-zinc-300">Default Permissions (default_permissions)</label>
                  <input type="text" value={config.default_permissions ?? ""}
                    onChange={(e) => handleFieldChange("default_permissions", e.target.value || null)}
                    placeholder="e.g., read,write,network"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono focus:border-zinc-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {[
                  { key: "allow_login_shell", label: "Allow Login Shell", desc: "allow_login_shell", defaultVal: true },
                  { key: "check_for_update_on_startup", label: "Check Updates on Boot", desc: "check_for_update_on_startup", defaultVal: false },
                  { key: "disable_paste_burst", label: "Disable Paste Burst", desc: "disable_paste_burst", defaultVal: false }
                ].map((item) => {
                  const val = config[item.key] !== undefined ? Boolean(config[item.key]) : item.defaultVal;
                  return (
                    <div key={item.key} onClick={() => handleFieldChange(item.key, !val)}
                      className={cn(
                        "p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-colors select-none",
                        val ? "bg-zinc-900/90 border-emerald-600/50 text-zinc-100" : "bg-zinc-900/40 border-zinc-800 text-zinc-400"
                      )}
                    >
                      <div>
                        <div className="font-medium text-[11px]">{item.label}</div>
                        <div className="text-[9px] text-zinc-500 font-mono">{item.desc}</div>
                      </div>
                      <div className={cn("w-3.5 h-3.5 rounded flex items-center justify-center border", val ? "bg-emerald-500 border-emerald-400 text-zinc-950" : "border-zinc-700")}>
                        {val && <Check className="w-2.5 h-2.5 stroke-3" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {activeSection === "agents" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div onClick={() => handleNestedFieldChange("agents", "enabled", !(config.agents?.enabled ?? true))}
                  className={cn(
                    "p-3 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-colors select-none",
                    config.agents?.enabled ?? true ? "bg-zinc-900/90 border-emerald-600/50 text-zinc-100" : "bg-zinc-900/40 border-zinc-800 text-zinc-400"
                  )}
                >
                  <div>
                    <div className="font-semibold text-xs text-zinc-200">Multi-Agent Subsystem (agents.enabled)</div>
                    <div className="text-[11px] text-zinc-500">Allow master agent to spawn specialized subagents</div>
                  </div>
                  <div className={cn("w-4 h-4 rounded flex items-center justify-center border", (config.agents?.enabled ?? true) ? "bg-emerald-500 border-emerald-400 text-zinc-950" : "border-zinc-700")}>
                    {(config.agents?.enabled ?? true) && <Check className="w-3 h-3 stroke-3" />}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300">Agent Max Depth (agents.max_depth)</label>
                  <input type="number" value={config.agents?.max_depth ?? 3}
                    onChange={(e) => handleNestedFieldChange("agents", "max_depth", parseInt(e.target.value, 10))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono focus:border-zinc-700 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300">Default Subagent Model</label>
                  <input type="text" value={config.agents?.default_subagent_model ?? "gpt-5"}
                    onChange={(e) => handleNestedFieldChange("agents", "default_subagent_model", e.target.value)}
                    placeholder="gpt-5"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono focus:border-zinc-700 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300">Web Search Max Results</label>
                  <input type="number" value={config.tools?.web_search?.maxResults ?? 8}
                    onChange={(e) => {
                      const prevWeb = config.tools?.web_search || {};
                      handleNestedFieldChange("tools", "web_search", { ...prevWeb, maxResults: parseInt(e.target.value, 10) });
                    }}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono focus:border-zinc-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <div className="text-[11px] font-medium text-zinc-400">Codex Rust Engine Feature Toggles (features.*)</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { key: "multi_agent_v2", label: "Multi-Agent V2", defaultVal: true },
                    { key: "unified_exec", label: "Unified Exec Tool", defaultVal: true },
                    { key: "memories", label: "Memories Subsystem", defaultVal: true }
                  ].map((feat) => {
                    const active = config.features?.[feat.key] !== undefined ? Boolean(config.features[feat.key]) : feat.defaultVal;
                    return (
                      <div key={feat.key}
                        onClick={() => handleNestedFieldChange("features", feat.key, !active)}
                        className={cn(
                          "p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-colors select-none",
                          active ? "bg-zinc-900 border-zinc-700 text-zinc-200" : "bg-zinc-950 border-zinc-800 text-zinc-500"
                        )}
                      >
                        <span className="font-mono text-[11px]">{feat.label}</span>
                        <div className={cn("w-3.5 h-3.5 rounded flex items-center justify-center border", active ? "bg-emerald-500 border-emerald-400 text-zinc-950" : "border-zinc-800")}>
                          {active && <Check className="w-2.5 h-2.5 stroke-3" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {activeSection === "custom" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                <div>
                  <div className="font-semibold text-xs text-zinc-200 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Dynamic Custom Properties (Key: JsonValue)</span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Add arbitrary custom flags, plugin parameters, or vendor extensions to ConfigToml
                  </div>
                </div>

                <Button type="button" size="sm"
                  onClick={() => setIsAddingCustom(!isAddingCustom)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingCustom ? "Cancel" : "Add Key: JsonValue"}</span>
                </Button>
              </div>

              {isAddingCustom && (
                <form onSubmit={handleSaveCustomEntry} className="p-3 rounded-lg border border-emerald-600/40 bg-emerald-950/20 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
                    <span>New Key-Value Definition</span>
                    <span className="text-[10px] text-emerald-400/80 font-mono">Arbitrary JsonValue</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-zinc-300">Property Key</label>
                      <input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="e.g. custom_header_flag"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-zinc-300">Value Type</label>
                      <select value={newKeyType}
                        onChange={(e) => setNewKeyType(e.target.value as JsonValueType)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="string">String (Text)</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean (true / false)</option>
                        <option value="json">JSON (Object or Array)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-zinc-300">Property Value</label>
                      {newKeyType === "boolean" ? (
                        <select value={newKeyValue || "true"} onChange={(e) => setNewKeyValue(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : newKeyType === "json" ? (
                        <input type="text" value={newKeyValue}
                          onChange={(e) => setNewKeyValue(e.target.value)}
                          placeholder='{"enabled": true, "tags": ["v1"]}'
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
                        />
                      ) : (
                        <input type={newKeyType === "number" ? "number" : "text"} value={newKeyValue}
                          onChange={(e) => setNewKeyValue(e.target.value)}
                          placeholder={newKeyType === "number" ? "100" : "value..."}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
                        />
                      )}
                    </div>
                  </div>

                  {customError && (
                    <div className="text-[11px] text-red-400 bg-red-950/40 p-2 rounded border border-red-800/50">
                      {customError}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" size="sm" variant="ghost"
                      onClick={() => setIsAddingCustom(false)}
                      className="text-zinc-400 hover:text-zinc-200"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Key-Value</span>
                    </Button>
                  </div>
                </form>
              )}

              {customEntries.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-zinc-800 rounded-lg text-zinc-500 text-xs">
                  No dynamic key: JsonValue entries added yet. Click &quot;Add Key: JsonValue&quot; above to append custom settings.
                </div>
              ) : (
                <div className="border border-zinc-800 rounded-lg divide-y divide-zinc-800 bg-zinc-900/30 overflow-hidden">
                  {customEntries.map((entry) => (
                    <div key={entry.key} className="p-2.5 flex items-center justify-between hover:bg-zinc-900/60 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-200 font-mono">{entry.key}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-400 font-mono uppercase">
                              {entry.type}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono truncate mt-0.5 max-w-md">
                            {typeof entry.value === "object" ? JSON.stringify(entry.value) : String(entry.value)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button"
                          onClick={() => {
                            setNewKeyName(entry.key);
                            setNewKeyType(entry.type);
                            setNewKeyValue(typeof entry.value === "object" ? JSON.stringify(entry.value) : String(entry.value));
                            setIsAddingCustom(true);
                          }}
                          className="p-1 text-zinc-400 hover:text-indigo-300 transition-colors"
                          title="Edit Entry"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button type="button"
                          onClick={() => handleDeleteCustomEntry(entry.key)}
                          className="p-1 text-zinc-400 hover:text-red-400 transition-colors"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
