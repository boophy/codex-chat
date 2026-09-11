import { AccountInfo } from "./auth";
import { Model } from "./protocol";

export type ProviderID = "shengsuanyun" | "chatgpt" | "openai" | "shengsuanyun" | "ollama";
export interface ProviderOption {
  id: ProviderID;
  name: string;
  home?: string;
  desc?: string;
  recommended?: boolean;
  requiresAuth?: boolean;
  authenticated?: boolean;
  requiresOpenaiAuth?: boolean;
  iconBg?: string;
  port?: number;
  codexHome?: string;
  defaultModel?: string;
  badge?: string;
  account?: AccountInfo;
  authType?: "chatgpt" | "openai" | "bedrock" | "shengSuanYunAccessKeys" | string;
  providerId?: string;
}

export type SwitchStage =
  | "idle"
  | "restarting"
  | "checking_auth"
  | "login_required"
  | "authenticating"
  | "restoring_thread"
  | "completed"
  | "error";


export const SUPPORTED_PROVIDERS: ProviderOption[] = [
  {
    id: "shengsuanyun",
    name: "胜算云 (ShengSuanYun)",
    home: "~/.codex-shengsuanyun",
    desc: "专为 Codex 架构优化的云端大模型服务",
    recommended: true
  },
  {
    id: "chatgpt",
    name: "OpenAI ChatGPT",
    desc: "官方 ChatGPT Plus/Pro 订阅账号认证",
    recommended: false
  },
  {
    id: "openai",
    name: "OpenAI API",
    home: "~/.codex-openai",
    desc: "OpenAI 官方开发者 API 访问凭证",
    recommended: false
  },
  {
    id: "shengsuanyun",
    name: "Codex AWS (Bedrock)",
    home: "~/.codex-aws",
    desc: "AWS 云端安全托管运行环境",
    recommended: false
  },
  {
    id: "ollama",
    name: "Ollama (Local OSS)",
    home: "~/.codex-ollama",
    desc: "本地开源私有化大模型运行环境",
    recommended: false
  }
];

export const DEFAULT_MODELS: Model[] = [
  { id: "openai/gpt-6-astra", displayName: "GPT-6-Astra", modelProvider: "openai", tag: "Flagship", 
    "context_window": 400000, "input_price": 70, "output_price": 350,
    description: "GPT‑6 Astra是OpenAI面向高要求端到端工作的旗舰模型。它适用于高级分析、软件工程、深度研究、科研工作以及文档创作，在涉及计算机与浏览器操作的长周期智能代理任务方面具备突出优势。" 
  } as unknown as Model,
  { id: "openai/gpt-5.6-sol", displayName: "GPT-5.6-Sol", modelProvider: "openai", tag: "Flagship", 
    "context_window": 400000, "input_price": 35, "output_price": 210,
    description: "GPT-5.6 Sol是OpenAl公司GPT-5.6系列中的旗舰模型。它适用于复杂的推理、编码及代理式工作流程，\n尤其在命令行和多步骤编码任务以及长期目标问题解决方面表现尤为出色。" 
  } as unknown as Model,
  { id: "openai/gpt-5.6-terra", displayName: "GPT-5.6-Terra", modelProvider: "openai", tag: "Frontier", 
    "context_window": 400000, "input_price": 14, "output_price": 84,
    description: "GPT-5.6 Terra是OpenAl旗下GPT-5.6系列中的一款均衡模型，介于旗舰级Sol层级与高性价比Luna层级之间。它适用于日常编码、推理及代理任务场景，在这些场景中需要兼顾性能与成本，且能够以大致相当于Sol成本一半的价格提供强大的性能表现。" 
  } as unknown as Model,
  { id: "openai/gpt-5.6-luna", displayName: "GPT-5.6-Luna", modelProvider: "openai", tag: "Fast", 
    "context_window": 400000, "input_price": 1.4, "output_price": 8.4,
    description: "GPT-5.6 Luna是OpenAl公司GPT-5.6系列中的一款快速且成本效益高的模型。它适用于高容量、对时延敏感的任务，如聊天、分类以及轻量级代理式工作流程，并以其在价格定位范围内的出色推理能力而著称。" 
  } as unknown as Model
];

