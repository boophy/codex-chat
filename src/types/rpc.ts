export interface JsonRpcRequest {
  id: number | string;
  method: string;
  params?: any;
  jsonrpc?: "2.0";
}

export interface JsonRpcResponse {
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  jsonrpc?: "2.0";
}

export interface JsonRpcNotification {
  method: string;
  params?: any;
  jsonrpc?: "2.0";
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface LogFrame {
  id?: string;
  timestamp: string | number;
  direction: "in" | "out" | "sys";
  type?: "notification" | "request" | "response" | "system" | "error" | string;
  raw?: any;
  method?: string;
  requestId?: number | string;
  payload?: any;
  status?: "ok" | "error";
}

export type NotificationHandler = (params: any) => void;
export type RequestHandler = (params: any, respond: (result?: any, error?: any) => void) => void;
export type StatusListener = (status: ConnectionStatus, error?: string) => void;
export type LogListener = (frame: LogFrame) => void;
