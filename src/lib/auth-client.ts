/**
 * Codex App-Server Account Authentication Client
 * Pure WebSocket JSON-RPC 2.0 implementation adhering strictly to official specifications:
 * 1. 建立连接 + initialize
 * 2. 检查已有登录状态 (account/read)
 * 3. 发起登录 (account/login/start)
 * 4. 打开浏览器完成 OAuth (window.open)
 * 5. 监听通知 (account/login/completed, account/updated)
 * 6. 支持取消登录 (account/login/cancel)
 * 7. 登出功能 (account/logout)
 */

import { CodexWebSocketClient } from "@/src/lib/websocket-client";
import { AccountReadResponse, AccountLoginStartParams, AccountLoginStartResponse, AccountLoginCompletedParams, AccountLoginCancelParams, AccountStatusResult, StartLoginOptions } from "@/src/types";

export type { AccountStatusResult, StartLoginOptions };

export class CodexAuthClient {

  public static async ensureInitialized(wsClient: CodexWebSocketClient): Promise<void> {
    if (wsClient.status !== "connected" || !wsClient.initialized) {
      await wsClient.connect();
    }
  }

  public static async checkAccountStatus(wsClient: CodexWebSocketClient): Promise<AccountStatusResult> {
    await this.ensureInitialized(wsClient);

    try {
      const res = (await wsClient.request("account/read", {
        refreshToken: false
      })) as AccountReadResponse;

      if (!res) {
        return {
          isLoggedIn: false,
          account: null,
          requiresOpenaiAuth: true,
          authMode: null
        };
      }

      // 判定是否已登录：
      // 如果 account.type === "chatgpt" 或 !requiresOpenaiAuth (且存在 account)
      const hasChatgptAccount = res.account && (res.account.type === "chatgpt" || res.authMode === "chatgpt");
      const isSatisfied = hasChatgptAccount || (res.account && res.requiresOpenaiAuth === false);

      return {
        isLoggedIn: !!isSatisfied,
        account: res.account || null,
        requiresOpenaiAuth: res.requiresOpenaiAuth ?? true,
        authMode: (res.account?.type as string) || (res.authMode as string) || null,
        providerId: (res as any).providerId || null,
        authDotJson: res.authDotJson || null
      };
    } catch (err: any) {
      console.warn("[CodexAuthClient] account/read failed:", err);
      return {
        isLoggedIn: false,
        account: null,
        requiresOpenaiAuth: true,
        authMode: null,
        providerId: null,
        authDotJson: null
      };
    }
  }

  public static async startLogin(
    wsClient: CodexWebSocketClient,
    options?: StartLoginOptions
  ): Promise<AccountLoginStartResponse> {
    await this.ensureInitialized(wsClient);

    const params: AccountLoginStartParams = {
      type: options?.type || "chatgpt",
      appBrand: options?.appBrand || "codex",
      codexStreamlinedLogin: options?.codexStreamlinedLogin !== undefined ? options.codexStreamlinedLogin : true,
      useHostedLoginSuccessPage: options?.useHostedLoginSuccessPage !== undefined ? options.useHostedLoginSuccessPage : true
    };

    const res = (await wsClient.request("account/login/start", params)) as AccountLoginStartResponse;

    if (!res || !res.authUrl) {
      throw new Error("Server returned invalid account/login/start response without authUrl");
    }

    return res;
  }

  public static openAuthInBrowser(authUrl: string): boolean {
    if (!authUrl || typeof window === "undefined") return false;
    try {
      const win = window.open(authUrl, "_blank", "noopener,noreferrer");
      return !!win;
    } catch {
      return false;
    }
  }

  public static listenAuthNotifications(
    wsClient: CodexWebSocketClient,
    onCompleted: (params: AccountLoginCompletedParams) => void,
    onUpdated?: (params: { authMode?: string | null; planType?: string | null; account?: any }) => void
  ): () => void {
    const unsubCompleted = wsClient.on("account/login/completed", onCompleted);
    const unsubUpdated = onUpdated ? wsClient.on("account/updated", onUpdated) : undefined;

    return () => {
      unsubCompleted();
      if (unsubUpdated) unsubUpdated();
    };
  }

  public static async cancelLogin(wsClient: CodexWebSocketClient, loginId: string): Promise<boolean> {
    if (!loginId) return false;
    try {
      const params: AccountLoginCancelParams = { loginId };
      const res = await wsClient.request("account/login/cancel", params);
      return res?.status === "canceled" || res?.success === true;
    } catch (err) {
      console.warn("[CodexAuthClient] account/login/cancel failed:", err);
      return false;
    }
  }

  public static async logout(wsClient: CodexWebSocketClient): Promise<boolean> {
    await this.ensureInitialized(wsClient);
    try {
      await wsClient.request("account/logout", {});
      return true;
    } catch (err) {
      console.error("[CodexAuthClient] account/logout failed:", err);
      throw err;
    }
  }
}
