import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from "react";
import { SUPPORTED_PROVIDERS, type Model, type ProviderOption, type ThreadConfig } from "../types";
const THREAD_CONFIG_KEY = "codex_thread_config_v2";
const LAST_PROVIDER_KEY = "codex_last_provider";
const DEFAULT_PROVIDER_ID = "shengsuanyun";

export interface CcState {
  provider: ProviderOption;
  thread: ThreadConfig;
  models: Model[];
}

export type CcAction =
  | { type: "SET_PROVIDER"; payload: ProviderOption }
  | { type: "SET_MODELS"; payload: Model[] }
  | { type: "UPDATE_THREAD"; payload: ThreadConfig }
  | { type: "CLEAR_THREAD" }
  | { type: "RESET" };

const CcContext = createContext<CcState | null>(null);
const CcDispatchContext = createContext<Dispatch<CcAction> | null>(null);

export function resolveProvider(id?: string | null): ProviderOption {
  const clean = (id || "").trim() || DEFAULT_PROVIDER_ID;
  const match = SUPPORTED_PROVIDERS.find((p) => p.id === clean);
  if (match) return match;
  return {
    id: clean as ProviderOption["id"],
    name: clean,
    home: clean ? `~/.codex-${clean}` : undefined,
  };
}

function readStoredProvider(): ProviderOption {
  if (typeof window === "undefined") return resolveProvider(DEFAULT_PROVIDER_ID);
  try {
    const config = localStorage.getItem(THREAD_CONFIG_KEY);
    if (config) {
      const parsed = JSON.parse(config);
      if (parsed?.modelProvider) return resolveProvider(parsed.modelProvider);
    }
    const last = localStorage.getItem(LAST_PROVIDER_KEY);
    if (last) return resolveProvider(last);
  } catch {}
  return resolveProvider(DEFAULT_PROVIDER_ID);
}

function readStoredThread(): ThreadConfig {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(THREAD_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as ThreadConfig;
    }
  } catch {}
  return {};
}

function createInitialState(): CcState {
  return {
    provider: readStoredProvider(),
    thread: readStoredThread(),
    models: [],
  };
}

function ccReducer(state: CcState, action: CcAction): CcState {
  switch (action.type) {
    case "SET_PROVIDER":
      return { ...state, provider: action.payload };
    case "SET_MODELS":
      return { ...state, models: action.payload };
    case "UPDATE_THREAD":
      return { ...state, thread: { ...state.thread, ...action.payload } };
    case "CLEAR_THREAD":
      return { ...state, thread: {} };
    case "RESET":
      return {
        provider: resolveProvider(DEFAULT_PROVIDER_ID),
        thread: {},
        models: [],
      };
    default:
      throw new Error(`Unhandled action type: ${(action as any).type}`);
  }
}

export function CcProvider({ children }: { children: ReactNode }) {
  const [cc, dispatch] = useReducer(ccReducer, undefined, createInitialState);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(LAST_PROVIDER_KEY, cc.provider.id);
      const raw = localStorage.getItem(THREAD_CONFIG_KEY);
      const base = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        THREAD_CONFIG_KEY,
        JSON.stringify({ ...base, modelProvider: cc.provider.id })
      );
    } catch {}
  }, [cc.provider]);

  return (
    <CcContext.Provider value={cc}>
      <CcDispatchContext.Provider value={dispatch}>
        {children}
      </CcDispatchContext.Provider>
    </CcContext.Provider>
  );
}

export function useCc(): CcState {
  const context = useContext(CcContext);
  if (!context) {
    throw new Error("useCc must be used within a CcProvider");
  }
  return context;
}

export function useCcDispatch(): Dispatch<CcAction> {
  const context = useContext(CcDispatchContext);
  if (!context) {
    throw new Error("useCcDispatch must be used within a CcProvider");
  }
  return context;
}

export function useCodex() {
  return { ...useCc(), dispatch: useCcDispatch() };
}