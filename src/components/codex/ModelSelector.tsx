import { FC, useEffect, useMemo, useRef, useState } from "react";
import { Cpu, Server, Check, ChevronsUpDown, Sparkles, Search, X } from "lucide-react";
import { Model } from "@/src/types/protocol";
import { Badge } from "@/src/components/ui/badge";
import { cn } from "@/src/lib/utils";

export interface ModelSelectorProps {
  models?: Model[];
  selectedModel: string;
  selectedProvider?: string;
  onSelectModel: (model: string) => void;
  onSelectProvider?: (provider: string) => void;
  variant?: "dropdown" | "form" | "compact";
  className?: string;
}

interface ProviderOption {
  id: string;
  name: string;
  home: string;
  desc: string;
}

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  tag?: string;
  desc?: string;
}

const DEFAULT_PROVIDERS: ProviderOption[] = [
  { id: "codex-aws", name: "AWS Bedrock (codex-aws)", home: "~/.codex-aws", desc: "Anthropic Claude, DeepSeek & Meta on AWS Bedrock" },
  { id: "openai", name: "OpenAI Official", home: "~/.codex-openai", desc: "GPT-5, o3-mini, o1 via OpenAI API keys" },
  { id: "chatgpt", name: "ChatGPT Subscription", home: "~/.codex-chatgpt", desc: "Direct ChatGPT Plus/Team subscription proxy" },
  { id: "anthropic", name: "Anthropic Direct", home: "~/.codex-anthropic", desc: "Claude 3.7 Sonnet & 3.5 Sonnet direct API" },
  { id: "ollama", name: "Ollama (Local OSS)", home: "~/.codex-ollama", desc: "Local models via localhost:11434" },
  { id: "lmstudio", name: "LM Studio (Local)", home: "~/.codex-lmstudio", desc: "Local OpenAI-compatible endpoint" },
  { id: "azure", name: "Azure OpenAI", home: "~/.codex-azure", desc: "Enterprise Azure OpenAI Deployments" },
  { id: "deepseek", name: "DeepSeek Official", home: "~/.codex-deepseek", desc: "DeepSeek V3 & R1 official API" }
];

const DEFAULT_POPULAR_MODELS: ModelOption[] = [
  { id: "gpt-5", name: "GPT-5", provider: "openai", tag: "Flagship", desc: "Next-gen reasoning and frontier coding capabilities" },
  { id: "gpt-5-mini", name: "GPT-5 Mini", provider: "openai", tag: "Fast & Smart", desc: "High-speed reasoning with ultra-low latency" },
  { id: "gpt-4.1", name: "GPT-4.1", provider: "openai", tag: "Reliable", desc: "High instruction following and reliable code edits" },
  { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", provider: "codex-aws", tag: "Hybrid Reasoning", desc: "State-of-the-art software engineering and hybrid thinking" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "codex-aws", tag: "Coding", desc: "High precision coding, patches, and workspace analysis" },
  { id: "deepseek-r1", name: "DeepSeek R1", provider: "codex-aws", tag: "Open Reasoning", desc: "Pure open reasoning model for algorithms and STEM" },
  { id: "o3-mini", name: "o3-mini", provider: "openai", tag: "High Speed", desc: "Fast reasoning for competitive coding and STEM tasks" },
  { id: "o1", name: "o1", provider: "openai", tag: "Deep Reasoning", desc: "Deep chain-of-thought reasoning for complex architecture" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "codex-aws", tag: "Multimodal", desc: "Large context window and multimodal reasoning" },
  { id: "llama-3.3-70b", name: "Llama 3.3 70B", provider: "ollama", tag: "Open Weights", desc: "Open weight foundation model via local Ollama" }
];

export const ModelSelector: FC<ModelSelectorProps> = ({
  models = [],
  selectedModel,
  selectedProvider = "codex-aws",
  onSelectModel,
  onSelectProvider,
  variant = "form",
  className
}) => {
  const [providerInput, setProviderInput] = useState(selectedProvider);
  const [isProviderOpen, setIsProviderOpen] = useState(false);
  const providerRef = useRef<HTMLDivElement>(null);
  const [modelInput, setModelInput] = useState(selectedModel);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setProviderInput(selectedProvider || "codex-aws");
  }, [selectedProvider]);

  useEffect(() => {
    setModelInput(selectedModel || "gpt-5");
  }, [selectedModel]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setIsProviderOpen(false);
      }
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setIsModelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered providers
  const filteredProviders = useMemo(() => {
    const q = (providerInput || "").toLowerCase().trim();
    if (!q) return DEFAULT_PROVIDERS;
    return DEFAULT_PROVIDERS.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.home.toLowerCase().includes(q)
    );
  }, [providerInput]);

  const hasExactProviderMatch = useMemo(() => {
    const q = (providerInput || "").toLowerCase().trim();
    return DEFAULT_PROVIDERS.some((p) => p.id.toLowerCase() === q);
  }, [providerInput]);

  // Build merged model list
  const allModelOptions = useMemo<ModelOption[]>(() => {
    const list: ModelOption[] = [];
    const seen = new Set<string>();

    // From protocol models
    if (models && models.length > 0) {
      for (const m of models) {
        const id = m.model || m.id;
        if (id && !seen.has(id)) {
          seen.add(id);
          list.push({
            id,
            name: m.displayName || id,
            provider: m.modelProvider || selectedProvider || "codex-aws",
            desc: m.description
          });
        }
      }
    }

    for (const d of DEFAULT_POPULAR_MODELS) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        list.push(d);
      }
    }

    return list;
  }, [models, selectedProvider]);

  // Filtered models
  const filteredModels = useMemo(() => {
    const q = (modelInput || "").toLowerCase().trim();
    if (!q) return allModelOptions;
    return allModelOptions.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        (m.provider && m.provider.toLowerCase().includes(q)) ||
        (m.desc && m.desc.toLowerCase().includes(q)) ||
        (m.tag && m.tag.toLowerCase().includes(q))
    );
  }, [modelInput, allModelOptions]);

  const hasExactModelMatch = useMemo(() => {
    const q = (modelInput || "").toLowerCase().trim();
    return allModelOptions.some((m) => m.id.toLowerCase() === q);
  }, [modelInput, allModelOptions]);

  const currentProviderObj = DEFAULT_PROVIDERS.find((p) => p.id === selectedProvider);
  const currentModelObj = allModelOptions.find((m) => m.id === selectedModel);

  const handleSelectProvider = (provId: string) => {
    setProviderInput(provId);
    onSelectProvider?.(provId);
    setIsProviderOpen(false);
  };

  const handleSelectModel = (modelId: string) => {
    setModelInput(modelId);
    onSelectModel(modelId);
    setIsModelOpen(false);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {onSelectProvider && (
        <div className={cn("space-y-1.5 relative", isProviderOpen ? "z-30" : "z-20")} ref={providerRef}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span>Model Provider (model_provider / CODEX_HOME)</span>
            </label>
            {currentProviderObj && (
              <span className="text-[10px] text-zinc-500 font-mono">
                {currentProviderObj.home}
              </span>
            )}
          </div>

          <div className="relative">
            <div className="relative flex items-center">
              <div className="absolute left-2.5 flex items-center pointer-events-none text-zinc-400">
                <Search className="w-3.5 h-3.5 text-zinc-500" />
              </div>
              <input type="text" value={providerInput}
                placeholder="Search or enter provider (e.g. codex-aws, openai, ollama)..."
                onFocus={() => setIsProviderOpen(true)}
                onChange={(e) => {
                  setProviderInput(e.target.value);
                  setIsProviderOpen(true);
                  if (e.target.value.trim()) {
                    onSelectProvider(e.target.value.trim());
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && providerInput.trim()) {
                    handleSelectProvider(providerInput.trim());
                  } else if (e.key === "Escape") {
                    setIsProviderOpen(false);
                  }
                }}
                className="w-full bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 rounded-lg pl-8 pr-16 py-2 text-xs text-zinc-100 placeholder-zinc-500 font-mono transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-text"
              />
              <div className="absolute right-1.5 flex items-center gap-1">
                {providerInput && (
                  <button type="button" title="Clear input"
                    onClick={() => {
                      setProviderInput("");
                      setIsProviderOpen(true);
                    }}
                    className="p-1 text-zinc-400 hover:text-zinc-200 rounded cursor-pointer transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <button type="button" title="Toggle providers list"
                  onClick={() => setIsProviderOpen(!isProviderOpen)}
                  className="p-1 text-zinc-400 hover:text-indigo-400 rounded cursor-pointer transition-colors"
                >
                  <ChevronsUpDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {isProviderOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl max-h-64 overflow-y-auto backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-150 divide-y divide-zinc-900">
                {providerInput.trim() && !hasExactProviderMatch && (
                  <button type="button"
                    onClick={() => handleSelectProvider(providerInput.trim())}
                    className="w-full flex items-center justify-between p-2.5 text-left text-xs bg-indigo-950/30 hover:bg-indigo-900/40 text-indigo-300 border-b border-indigo-900/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <div className="truncate">
                        <span className="font-semibold">Use custom provider: </span>
                        <span className="font-mono text-indigo-200">"{providerInput.trim()}"</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-indigo-400/80 font-mono shrink-0 ml-2">
                      ~/.codex-{providerInput.trim()}
                    </span>
                  </button>
                )}

                <div className="p-1 space-y-0.5">
                  {filteredProviders.length === 0 && hasExactProviderMatch ? null : filteredProviders.length === 0 ? (
                    <div className="p-3 text-center text-xs text-zinc-500">
                      No matching providers. Press Enter or click above to use "{providerInput}".
                    </div>
                  ) : (
                    filteredProviders.map((prov) => {
                      const isSelected = selectedProvider === prov.id;
                      return (
                        <button key={prov.id} type="button" onClick={() => handleSelectProvider(prov.id)}
                          className={cn(
                            "w-full flex items-center justify-between p-2 rounded-md text-left text-xs transition-colors cursor-pointer group",
                            isSelected
                              ? "bg-indigo-950/60 border border-indigo-500/50 text-indigo-200"
                              : "hover:bg-zinc-900 text-zinc-300 border border-transparent"
                          )}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-zinc-100 group-hover:text-indigo-300">
                                {prov.name}
                              </span>
                              <span className="text-[10px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                                {prov.id}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                              {prov.desc}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">
                              {prov.home}
                            </span>
                            {isSelected ? (
                              <Check className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <div className="w-4 h-4" />
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={cn("space-y-1.5 relative", isModelOpen ? "z-30" : "z-10")} ref={modelRef}>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>Model Target (LLM Engine)</span>
          </label>
          {currentModelObj?.tag && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-800/60 text-emerald-400 bg-emerald-950/30">
              {currentModelObj.tag}
            </Badge>
          )}
        </div>

        <div className="relative">
          <div className="relative flex items-center">
            <div className="absolute left-2.5 flex items-center pointer-events-none text-zinc-400">
              <Search className="w-3.5 h-3.5 text-zinc-500" />
            </div>
            <input type="text" value={modelInput}
              placeholder="Search or enter model (e.g. gpt-5, claude-3-7-sonnet, deepseek-r1)..."
              onFocus={() => setIsModelOpen(true)}
              onChange={(e) => {
                setModelInput(e.target.value);
                setIsModelOpen(true);
                if (e.target.value.trim()) {
                  onSelectModel(e.target.value.trim());
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && modelInput.trim()) {
                  handleSelectModel(modelInput.trim());
                } else if (e.key === "Escape") {
                  setIsModelOpen(false);
                }
              }}
              className="w-full bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500 rounded-lg pl-8 pr-16 py-2 text-xs text-zinc-100 placeholder-zinc-500 font-mono transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-text"
            />
            <div className="absolute right-1.5 flex items-center gap-1">
              {modelInput && (
                <button type="button" title="Clear input"
                  onClick={() => {
                    setModelInput("");
                    setIsModelOpen(true);
                  }}
                  className="p-1 text-zinc-400 hover:text-zinc-200 rounded cursor-pointer transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <button type="button" title="Toggle models list"
                onClick={() => setIsModelOpen(!isModelOpen)}
                className="p-1 text-zinc-400 hover:text-emerald-400 rounded cursor-pointer transition-colors"
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isModelOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl max-h-72 overflow-y-auto backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-150 divide-y divide-zinc-900">
              {modelInput.trim() && !hasExactModelMatch && (
                <button type="button"
                  onClick={() => handleSelectModel(modelInput.trim())}
                  className="w-full flex items-center justify-between p-2.5 text-left text-xs bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 border-b border-emerald-900/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <span className="font-semibold">Use custom model: </span>
                      <span className="font-mono text-emerald-200">"{modelInput.trim()}"</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-400/80 shrink-0 ml-2 font-mono">
                    Custom LLM Target
                  </span>
                </button>
              )}
              <div className="p-1 space-y-0.5">
                {filteredModels.length === 0 && hasExactModelMatch ? null : filteredModels.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-500">
                    No models found matching "{modelInput}". Press Enter or click above to use as custom model.
                  </div>
                ) : (
                  filteredModels.map((m) => {
                    const isSelected = selectedModel === m.id;
                    return (
                      <button key={m.id} type="button" onClick={() => handleSelectModel(m.id)}
                        className={cn(
                          "w-full flex items-center justify-between p-2 rounded-md text-left text-xs transition-colors cursor-pointer group",
                          isSelected
                            ? "bg-emerald-950/60 border border-emerald-500/50 text-emerald-200"
                            : "hover:bg-zinc-900 text-zinc-300 border border-transparent"
                        )}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-zinc-100 group-hover:text-emerald-300">
                              {m.name}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono px-1 py-0.2 bg-zinc-900 rounded border border-zinc-800">
                              {m.id}
                            </span>
                            {m.tag && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                                {m.tag}
                              </span>
                            )}
                          </div>
                          {m.desc && (
                            <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                              {m.desc}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {m.provider && (
                            <span className="text-[10px] text-zinc-500 font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 hidden sm:inline">
                              {m.provider}
                            </span>
                          )}
                          {isSelected ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <div className="w-4 h-4" />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
