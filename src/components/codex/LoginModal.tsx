import { KeyRound, ExternalLink, Copy, Check, LogOut, RefreshCw, AlertCircle, Clock, ShieldCheck, Server, CheckCircle2, XCircle, Terminal, ArrowRight, FileCode, ChevronDown, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/src/components/ui/dialog";
import { LoginModalProps, AuthStepState, AccountStatusResult, SUPPORTED_PROVIDERS } from "@/src/types";
import { CodexAuthClient } from "@/src/lib/auth-client";
import { FC, useState, useEffect, useRef } from "react";
import { wsClient } from "@/src/lib/websocket-client";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { cn } from "@/src/lib/utils";

export type { LoginModalProps };
export const LoginModal: FC<LoginModalProps> = ({
  open,
  onOpenChange,
  currentProvider = "shengsuanyun",
  onProviderChange,
  onLoginSuccess,
  onLogoutSuccess
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string>(currentProvider);
  const [step, setStep] = useState<AuthStepState>("checking");
  const [accountStatus, setAccountStatus] = useState<AccountStatusResult | null>(null);
  const [loginId, setLoginId] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [countdown, setCountdown] = useState<number>(600);
  const [showAuthJson, setShowAuthJson] = useState<boolean>(false);
  const cleanupListenerRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<any>(null);
  const clearTimerAndListeners = () => {
    if (cleanupListenerRef.current) {
      cleanupListenerRef.current();
      cleanupListenerRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const getCodexHomePath = (provider: string) => {
    const clean = provider.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    return `~/.codex-${clean || "shengsuanyun"}`;
  };

  const switchProviderAndInspect = async (provider: string) => {
    clearTimerAndListeners();
    setSelectedProvider(provider);
    setStep("switching_server");
    setErrorMessage(null);

    const codexHome = getCodexHomePath(provider);
    try {
      if (wsClient.status !== "connected") {
        await wsClient.connect();
      }

      // Step 1: restart app-server with the new CODEX_HOME
      await wsClient.request("server/restart", {
        modelProvider: provider,
        codexHome,
        forceRestart: true
      });

      // Step 2: reconnect and handshake
      wsClient.disconnect();
      await wsClient.connect();
      await CodexAuthClient.ensureInitialized(wsClient);

      // Step 3: check account/read from that CODEX_HOME
      setStep("checking");
      const status = await CodexAuthClient.checkAccountStatus(wsClient);
      setAccountStatus(status);

      if (status.isLoggedIn && status.account) {
        onProviderChange?.(provider);
      }
      setStep("idle");
    } catch (err: any) {
      console.error("[LoginModal] switchProviderAndInspect error:", err);
      setErrorMessage(err.message || "Failed to switch provider server");
      setStep("error");
    }
  };

  useEffect(() => {
    if (open) {
      const initialProv = currentProvider || "shengsuanyun";
      setSelectedProvider(initialProv);
      switchProviderAndInspect(initialProv);
    } else {
      clearTimerAndListeners();
      setLoginId(null);
      setAuthUrl(null);
      setStep("idle");
    }
    return () => {
      clearTimerAndListeners();
    };
  }, [open]);

  // Start OAuth Login for the selected provider
  const handleStartLogin = async () => {
    clearTimerAndListeners();
    setStep("starting");
    setErrorMessage(null);
    const codexHome = getCodexHomePath(selectedProvider);

    try {
      const resp = await CodexAuthClient.startLogin(wsClient, {
        type: "chatgpt",
        appBrand: "codex",
        codexStreamlinedLogin: true,
        useHostedLoginSuccessPage: true
      });

      const id = resp.loginId;
      const url = resp.authUrl;
      setLoginId(id);
      setAuthUrl(url);
      setStep("waiting_browser");
      setCountdown(600);

      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearTimerAndListeners();
            setStep("error");
            setErrorMessage("Authorization session timed out after 10 minutes.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      cleanupListenerRef.current = CodexAuthClient.listenAuthNotifications(
        wsClient,
        async (completedParams) => {
          clearTimerAndListeners();

          if (completedParams.success) {
            setStep("success");
            const updated = await CodexAuthClient.checkAccountStatus(wsClient);
            setAccountStatus(updated);
            onLoginSuccess?.(updated.account);
            onProviderChange?.(selectedProvider);
          } else {
            const errText = completedParams.error || "Authorization was cancelled by user.";
            setErrorMessage(errText);
            setStep("error");
          }
        },
        (updatedParams) => {
          if (updatedParams.authMode === "chatgpt" || updatedParams.account) {
            setAccountStatus({
              isLoggedIn: true,
              account: updatedParams.account || {
                type: "chatgpt",
                email: `user.${selectedProvider}@openai.com`,
                name: `${selectedProvider.toUpperCase()} User`,
                planType: updatedParams.planType || "plus"
              },
              requiresOpenaiAuth: false,
              authMode: "chatgpt",
              providerId: selectedProvider
            });
          }
        }
      );
    } catch (err: any) {
      console.error("[LoginModal] Login start failed:", err);
      clearTimerAndListeners();
      setErrorMessage(err.message || "Failed to start login");
      setStep("error");
    }
  };

  // Cancel login
  const handleCancelLogin = async () => {
    clearTimerAndListeners();
    if (loginId) {
      await CodexAuthClient.cancelLogin(wsClient, loginId);
    }
    setLoginId(null);
    setAuthUrl(null);
    setStep("idle");
  };

  // Logout and clear credentials in this CODEX_HOME
  const handleLogout = async () => {
    const codexHome = getCodexHomePath(selectedProvider);
    try {
      await CodexAuthClient.logout(wsClient);
      setAccountStatus({
        isLoggedIn: false,
        account: null,
        requiresOpenaiAuth: true,
        authMode: null,
        providerId: selectedProvider
      });
      onLogoutSuccess?.();
    } catch (err: any) {
      console.error(`Logout error: ${err.message}`);
    }
  };

  const handleCopyUrl = () => {
    if (authUrl) {
      navigator.clipboard.writeText(authUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const activeCodexHome = getCodexHomePath(selectedProvider);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-100 p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-zinc-100">
                  Model Provider 与账号认证
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">
                  <div className="flex items-center gap-2 text-zinc-400 text-[10px] bg-zinc-950/80 p-1.5 rounded border border-zinc-800/80 overflow-x-auto">
                    <Terminal className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>CODEX_HOME={activeCodexHome} app-server --listen ws://127.0.0.1:8080</span>
                  </div>
                </DialogDescription>
              </div>
            </div>

            {accountStatus?.isLoggedIn ? (
              <Badge variant="success" className="gap-1 text-[11px] px-2 py-0.5">
                <ShieldCheck className="w-3 h-3" />
                凭据已就绪
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-[11px] border-amber-800 text-amber-400 bg-amber-950/20 px-2 py-0.5">
                <AlertCircle className="w-3 h-3" />
                未认证凭证
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5 text-xs">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span>选择 Model Provider (服务商)</span>
              </label>
              <span className="text-[11px] text-zinc-500">点击切换将自动重启 app-server</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUPPORTED_PROVIDERS.map((p) => {
                const isSelected = selectedProvider === p.id;
                return (
                  <button key={p.id} type="button" onClick={() => switchProviderAndInspect(p.id)}
                    disabled={step === "switching_server" || step === "starting" || step === "waiting_browser"}
                    className={cn(
                      "p-2.5 rounded-lg border text-left transition-all cursor-pointer relative flex flex-col gap-1",
                      isSelected
                        ? "border-indigo-500 bg-indigo-950/30 shadow-sm shadow-indigo-950/50"
                        : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/60 hover:border-zinc-700",
                      (step === "switching_server" || step === "starting") && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-100 flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full", isSelected ? "bg-indigo-400 animate-pulse" : "bg-zinc-600")} />
                        {p.name}
                      </span>
                      {p.recommended && (
                        <Badge variant="purple" className="text-[9px] px-1 py-0 font-medium">推荐</Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 line-clamp-1">{p.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {step === "switching_server" ? (
            <div className="p-4 rounded-xl border border-indigo-900/40 bg-indigo-950/20 text-center py-6 space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-400 mx-auto" />
              <div className="text-xs text-indigo-200 font-medium">
                正在重启 app-server 并加载 {activeCodexHome}...
              </div>
              <div className="text-[10px] text-zinc-400">
                切换环境变量 CODEX_HOME 后将自动读取 account/read 凭证
              </div>
            </div>
          ) : accountStatus?.isLoggedIn && accountStatus.account ? (
            <div className="p-4 rounded-xl border border-emerald-900/50 bg-emerald-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                      <span>{accountStatus.account.email || accountStatus.account.name || "Authorized User"}</span>
                      <Badge variant="success" className="text-[9px] px-1 py-0 uppercase">
                        {accountStatus.account.planType || "Active"}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1.5 mt-0.5">
                      <span>Provider: <span className="text-zinc-200">{selectedProvider}</span></span>
                      <span>•</span>
                      <span>凭据已保存于 <span className="text-emerald-400">{activeCodexHome}/auth.json</span></span>
                    </div>
                  </div>
                </div>

                <Button size="sm" variant="outline" onClick={handleLogout}
                  className="h-7 text-xs border-rose-900/60 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                  <span>清除凭证</span>
                </Button>
              </div>
              <p className="text-[11px] text-emerald-300/80 leading-relaxed">
                当前 CODEX_HOME 环境凭据有效，可直接开始发起推理会话。
              </p>

              {accountStatus.authDotJson && (
                <div className="pt-1 border-t border-emerald-900/40">
                  <button type="button" onClick={() => setShowAuthJson((v) => !v)}
                    className="flex items-center gap-1.5 text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer font-mono"
                  >
                    {showAuthJson ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <FileCode className="w-3.5 h-3.5" />
                    <span>查看 auth.json (Rust AuthDotJson 结构)</span>
                  </button>

                  {showAuthJson && (
                    <div className="mt-2 space-y-1">
                      <div className="text-[10px] text-zinc-400 font-mono flex items-center justify-between">
                        <span>Path: {activeCodexHome}/auth.json</span>
                        <span className="text-zinc-500">Struct: AuthDotJson</span>
                      </div>
                      <pre className="p-2.5 bg-zinc-950/90 rounded border border-zinc-800 text-[10px] font-mono text-zinc-300 overflow-x-auto max-h-52 leading-relaxed">
                        {JSON.stringify(accountStatus.authDotJson, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-amber-900/50 bg-amber-950/20 space-y-2.5">
              <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>未在 {activeCodexHome} 检测到登录凭证</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                该 Model Provider (<code>{selectedProvider}</code>) 尚未在对应 <code>CODEX_HOME</code> 中保存登录凭据，
                <code>account/read</code> 读取不到有效账号。请点击下方按钮启动认证流程。
              </p>
            </div>
          )}

          {step === "waiting_browser" && authUrl && (
            <div className="p-4 rounded-xl border border-indigo-900/60 bg-indigo-950/30 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>等待浏览器完成 OAuth 认证...</span>
                </div>
                <div className="flex items-center gap-1 text-amber-400 font-mono text-[11px]">
                  <Clock className="w-3 h-3" />
                  <span>{formatCountdown(countdown)}</span>
                </div>
              </div>

              <p className="text-[11px] text-zinc-300">
                请在浏览器弹出的授权窗口中完成认证。若窗口未自动弹出，可手动打开：
              </p>

              <div className="flex items-center gap-2 pt-1">
                <Button size="sm"
                  onClick={() => CodexAuthClient.openAuthInBrowser(authUrl)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium h-8 text-xs gap-1.5 cursor-pointer shadow-md"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>打开授权页 (Open Auth)</span>
                </Button>

                <Button size="sm" variant="outline" onClick={handleCopyUrl}
                  className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white h-8 text-xs gap-1.5 cursor-pointer"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? "已复制链接" : "复制链接"}</span>
                </Button>

                <Button size="sm" variant="ghost" onClick={handleCancelLogin}
                  className="ml-auto text-zinc-400 hover:text-rose-400 h-8 text-xs gap-1 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>取消</span>
                </Button>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="p-3.5 rounded-xl border border-emerald-900/60 bg-emerald-950/40 text-emerald-200 flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>登录授权成功！凭证已写入 {activeCodexHome}/auth.json 并就绪。</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl border border-rose-900/60 bg-rose-950/40 text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-xs">认证出错</div>
                <div className="text-[11px] text-rose-300/90">{errorMessage}</div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3.5 border-t border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
          <div className="text-[11px] text-zinc-500 font-mono">
            Provider: <span className="text-zinc-200 font-semibold">{selectedProvider}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}
              className="border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs h-8"
            >
              关闭
            </Button>

            {step === "waiting_browser" ? (
              <Button variant="destructive" size="sm" onClick={handleCancelLogin}
                className="text-xs h-8 gap-1.5 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>取消认证</span>
              </Button>
            ) : accountStatus?.isLoggedIn ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleStartLogin}
                  disabled={step === "starting" || step === "checking" || step === "switching_server"}
                  className="border-amber-700/60 bg-amber-950/20 text-amber-300 hover:bg-amber-950/40 text-xs h-8 gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={cn("w-3 h-3", step === "starting" && "animate-spin")} />
                  <span>重新授权</span>
                </Button>
                <Button size="sm"
                  onClick={() => onOpenChange(false)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-8 gap-1.5 cursor-pointer shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>使用此服务商继续</span>
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={handleStartLogin}
                disabled={step === "starting" || step === "checking" || step === "switching_server"}
                className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs h-8 gap-1.5 cursor-pointer shadow-sm"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>开始登录认证 (account/login/start)</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
