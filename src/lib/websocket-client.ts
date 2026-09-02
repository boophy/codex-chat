import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  InitializeParams,
  InitializeResult
} from "@/src/types/protocol";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface LogFrame {
  id: string;
  timestamp: number;
  direction: "in" | "out";
  type: "request" | "response" | "notification" | "error";
  method?: string;
  requestId?: number | string;
  payload: any;
  status?: "ok" | "error";
}

type NotificationHandler = (params: any) => void;
type RequestHandler = (params: any, respond: (result?: any, error?: any) => void) => void;
type StatusListener = (status: ConnectionStatus, error?: string) => void;
type LogListener = (frame: LogFrame) => void;

export class CodexWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string = "";
  private nextId = 1;
  private pendingRequests = new Map<
    number | string,
    { resolve: (val: any) => void; reject: (err: any) => void; timeout: any; method: string }
  >();
  private notificationListeners = new Map<string, Set<NotificationHandler>>();
  private requestHandlers = new Map<string, RequestHandler>();
  private statusListeners = new Set<StatusListener>();
  private logListeners = new Set<LogListener>();
  private logs: LogFrame[] = [];
  public status: ConnectionStatus = "disconnected";
  public initialized = false;
  public initData: InitializeResult | null = null;

  constructor(defaultUrl?: string) {
    if (defaultUrl) {
      this.url = defaultUrl;
    } else {
      const loc = window.location;
      const proto = loc.protocol === "https:" ? "wss:" : "ws:";
      this.url = `${proto}//${loc.host}/ws`;
    }
  }

  public getUrl(): string {
    return this.url;
  }

  public setUrl(newUrl: string) {
    this.url = newUrl;
  }

  public getLogs(): LogFrame[] {
    return this.logs;
  }

  public clearLogs() {
    this.logs = [];
  }

  public onStatusChange(listener: StatusListener) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public onLog(listener: LogListener) {
    this.logListeners.add(listener);
    return () => {
      this.logListeners.delete(listener);
    };
  }

  private setStatus(status: ConnectionStatus, error?: string) {
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status, error));
  }

  private addLog(frame: Omit<LogFrame, "id">) {
    const fullFrame: LogFrame = {
      ...frame,
      id: Math.random().toString(36).substring(2, 9)
    };
    this.logs.unshift(fullFrame);
    if (this.logs.length > 300) {
      this.logs.pop();
    }
    this.logListeners.forEach((fn) => fn(fullFrame));
  }

  public connect(): Promise<InitializeResult> {
    return new Promise((resolve, reject) => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        if (this.initialized && this.initData) {
          return resolve(this.initData);
        }
      }

      this.disconnect();
      this.setStatus("connecting");

      try {
        this.ws = new WebSocket(this.url);
      } catch (err: any) {
        this.setStatus("error", err?.message || "Failed to create WebSocket");
        return reject(err);
      }

      this.ws.onopen = async () => {
        try {
          const initRes = await this.performHandshake();
          this.setStatus("connected");
          resolve(initRes);
        } catch (err: any) {
          this.setStatus("error", err?.message || "Initialization failed");
          reject(err);
        }
      };

      this.ws.onmessage = (event) => {
        this.handleRawMessage(event.data);
      };

      this.ws.onerror = () => {
        this.setStatus("error", "WebSocket connection error");
      };

      this.ws.onclose = () => {
        this.initialized = false;
        this.setStatus("disconnected");
        this.rejectAllPending("WebSocket connection closed");
      };
    });
  }

  public disconnect() {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.initialized = false;
    this.setStatus("disconnected");
    this.rejectAllPending("Disconnected");
  }

  private async performHandshake(): Promise<InitializeResult> {
    const params: InitializeParams = {
      clientInfo: {
        name: "codex_web_chat",
        title: "Codex Web Chat Client",
        version: "1.0.0"
      },
      capabilities: {
        experimentalApi: true,
        optOutNotificationMethods: []
      }
    };

    const res: InitializeResult = await this.request("initialize", params);
    this.initialized = true;
    this.initData = res;
    this.notify("initialized", {});
    return res;
  }

  public request<T = any>(method: string, params?: any, timeoutMs = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error("WebSocket is not connected"));
      }

      const id = this.nextId++;
      const req: JsonRpcRequest = {
        id,
        method,
        params,
        jsonrpc: "2.0"
      };

      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          this.addLog({
            timestamp: Date.now(),
            direction: "in",
            type: "error",
            method,
            requestId: id,
            payload: { message: `Request timeout (${timeoutMs}ms)` },
            status: "error"
          });
          reject(new Error(`Request ${method} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout, method });

      this.addLog({
        timestamp: Date.now(),
        direction: "out",
        type: "request",
        method,
        requestId: id,
        payload: req
      });

      this.ws.send(JSON.stringify(req));
    });
  }

  public notify(method: string, params?: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const notif: JsonRpcNotification = {
      method,
      params,
      jsonrpc: "2.0"
    };

    this.addLog({
      timestamp: Date.now(),
      direction: "out",
      type: "notification",
      method,
      payload: notif
    });

    this.ws.send(JSON.stringify(notif));
  }

  public on(method: string, handler: NotificationHandler) {
    if (!this.notificationListeners.has(method)) {
      this.notificationListeners.set(method, new Set());
    }
    this.notificationListeners.get(method)!.add(handler);
    return () => {
      this.notificationListeners.get(method)?.delete(handler);
    };
  }

  public onRequest(method: string, handler: RequestHandler) {
    this.requestHandlers.set(method, handler);
    return () => {
      this.requestHandlers.delete(method);
    };
  }

  private handleRawMessage(raw: string) {
    try {
      const msg = JSON.parse(raw);

      if (msg.id !== undefined && msg.method) {
        this.addLog({
          timestamp: Date.now(),
          direction: "in",
          type: "request",
          method: msg.method,
          requestId: msg.id,
          payload: msg
        });

        const handler = this.requestHandlers.get(msg.method);
        const respond = (result?: any, error?: any) => {
          const resp: JsonRpcResponse = {
            id: msg.id,
            jsonrpc: "2.0"
          };
          if (error) {
            resp.error = typeof error === "string" ? { code: -32000, message: error } : error;
          } else {
            resp.result = result !== undefined ? result : {};
          }

          this.addLog({
            timestamp: Date.now(),
            direction: "out",
            type: error ? "error" : "response",
            requestId: msg.id,
            payload: resp,
            status: error ? "error" : "ok"
          });

          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(resp));
          }
        };

        if (handler) {
          handler(msg.params, respond);
        } else {
          respond(null, { code: -32601, message: `Method not found: ${msg.method}` });
        }
        return;
      }

      if (msg.id !== undefined) {
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(msg.id);

          if (msg.error) {
            this.addLog({
              timestamp: Date.now(),
              direction: "in",
              type: "error",
              method: pending.method,
              requestId: msg.id,
              payload: msg,
              status: "error"
            });
            pending.reject(msg.error);
          } else {
            this.addLog({
              timestamp: Date.now(),
              direction: "in",
              type: "response",
              method: pending.method,
              requestId: msg.id,
              payload: msg,
              status: "ok"
            });
            pending.resolve(msg.result);
          }
        }
        return;
      }

      if (msg.method) {
        this.addLog({
          timestamp: Date.now(),
          direction: "in",
          type: "notification",
          method: msg.method,
          payload: msg
        });

        const listeners = this.notificationListeners.get(msg.method);
        if (listeners) {
          listeners.forEach((fn) => {
            try {
              fn(msg.params);
            } catch (err) {
              console.error(err);
            }
          });
        }

        const wildcardListeners = this.notificationListeners.get("*");
        if (wildcardListeners) {
          wildcardListeners.forEach((fn) => {
            try {
              fn({ method: msg.method, params: msg.params });
            } catch (err) {
              console.error(err);
            }
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  private rejectAllPending(reason: string) {
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error(reason));
    });
    this.pendingRequests.clear();
  }
}

export const wsClient = new CodexWebSocketClient();
