import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

interface ServerThread {
  id: string;
  preview: string;
  modelProvider: string;
  createdAt: number;
  updatedAt: number;
  recencyAt: number;
  status: { type: "idle" | "active" | "notLoaded"; activeFlags?: string[] };
  model: string;
  reasoningEffort: string;
  ephemeral: boolean;
  path: string | null;
  archived: boolean;
  turns: any[];
}

const threads = new Map<string, ServerThread>();

function initDefaultThreads() {
  if (threads.size === 0) {
    const t1: ServerThread = {
      id: "thr_welcome_codex_01",
      preview: "WebSocket Client & Full-Stack Engine Setup",
      modelProvider: "openai",
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 3600000,
      recencyAt: Date.now() - 3600000,
      status: { type: "idle" },
      model: "gpt-5.4-codex",
      reasoningEffort: "medium",
      ephemeral: false,
      path: "/workspace/projects/codex-client",
      archived: false,
      turns: [
        {
          id: "turn_init_01",
          status: "completed",
          items: [
            {
              type: "userMessage",
              id: "msg_user_01",
              content: [{ type: "text", text: "Hello! Show me the capabilities of the Codex App Server protocol." }]
            },
            {
              type: "reasoning",
              id: "rsn_01",
              summary: "Analyzing project context and JSON-RPC 2.0 streaming requirements...",
              content: "Inspecting transports: stdio, websocket, unix socket.\nLoaded skills and dynamic tools."
            },
            {
              type: "commandExecution",
              id: "cmd_01",
              command: "codex app-server --listen ws://127.0.0.1:4500",
              cwd: "/workspace/projects/codex-client",
              status: "completed",
              aggregatedOutput: "[info] Codex app-server listening on ws://127.0.0.1:4500\n[info] Ready to accept JSON-RPC 2.0 frames",
              exitCode: 0,
              durationMs: 42
            },
            {
              type: "agentMessage",
              id: "msg_agent_01",
              text: "Welcome to the **Codex Web Chat Client**! Connected via JSON-RPC 2.0 bidirectional WebSocket protocol.\n\nKey features available in this session:\n- **Streaming agent tokens** & live thought reasoning deltas\n- **Interactive Command & File Change approvals**\n- **Live diff viewers** and terminal execution feeds\n- **Turn steering** & instant interrupt controls\n- **Full Protocol Inspector** for debugging JSON-RPC frames in real time"
            }
          ]
        }
      ]
    };
    threads.set(t1.id, t1);
  }
}

initDefaultThreads();

const MODELS = [
  {
    id: "gpt-5.4-codex",
    displayName: "GPT-5.4 Codex (Default)",
    description: "Most capable agentic model for deep software engineering and complex reasoning",
    supportedReasoningEfforts: ["low", "medium", "high", "ultra"],
    defaultReasoningEffort: "medium"
  },
  {
    id: "gpt-5.1-codex",
    displayName: "GPT-5.1 Codex",
    description: "High-performance coding model with versatile tool execution",
    supportedReasoningEfforts: ["low", "medium", "high"],
    defaultReasoningEffort: "medium"
  },
  {
    id: "codex-fast",
    displayName: "Codex Fast (Low Latency)",
    description: "Optimized for rapid iterative edits and code completions",
    supportedReasoningEfforts: ["low", "medium"],
    defaultReasoningEffort: "low"
  }
];

const SKILLS = [
  {
    name: "skill-creator",
    description: "Create or update custom reusable Codex skills",
    enabled: true,
    pluginId: null,
    interface: {
      displayName: "Skill Creator",
      shortDescription: "Interactive skill generator",
      brandColor: "#10b981",
      defaultPrompt: "$skill-creator Create a new test runner skill"
    }
  },
  {
    name: "git-workflow",
    description: "Inspect branches, create commits, resolve merge conflicts",
    enabled: true,
    pluginId: null,
    interface: {
      displayName: "Git Workflow",
      shortDescription: "Git VCS automated actions",
      brandColor: "#f59e0b",
      defaultPrompt: "$git-workflow Review uncommitted changes"
    }
  },
  {
    name: "security-audit",
    description: "Scan source code for vulnerabilities and policy leaks",
    enabled: true,
    pluginId: null,
    interface: {
      displayName: "Security Auditor",
      shortDescription: "Static security analyzer",
      brandColor: "#ef4444",
      defaultPrompt: "$security-audit Audit all dependencies and network calls"
    }
  }
];

const APPS = [
  {
    id: "github-connector",
    name: "GitHub",
    description: "Browse PRs, issues, commits and repository metadata",
    logoUrl: "https://api.iconify.design/lucide:github.svg",
    isAccessible: true,
    isEnabled: true
  },
  {
    id: "postgres-db",
    name: "PostgreSQL Database",
    description: "Query schema and execute read-only SQL queries",
    logoUrl: "https://api.iconify.design/lucide:database.svg",
    isAccessible: true,
    isEnabled: true
  },
  {
    id: "jira-tracker",
    name: "Jira Software",
    description: "Manage sprint tickets and user stories",
    logoUrl: "https://api.iconify.design/lucide:kanban.svg",
    isAccessible: true,
    isEnabled: true
  }
];

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  app.use(express.json());

  app.get("/readyz", (req, res) => {
    res.status(200).send("OK");
  });

  app.get("/healthz", (req, res) => {
    res.status(200).send("OK");
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", activeThreads: threads.size });
  });

  wss.on("connection", (ws: WebSocket) => {
    let activeTurnAbort = false;
    let currentTurnId: string | null = null;
    let pendingApprovalResolver: ((decision: any) => void) | null = null;

    const send = (data: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    };

    const sendNotification = (method: string, params: any) => {
      send({ method, params, jsonrpc: "2.0" });
    };

    const sendRequest = (method: string, params: any): Promise<any> => {
      const id = "srv_req_" + Math.random().toString(36).substring(2, 9);
      send({ id, method, params, jsonrpc: "2.0" });
      return new Promise((resolve) => {
        pendingApprovalResolver = resolve;
      });
    };

    ws.on("message", async (raw: string) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.id !== undefined && !msg.method) {
          if (pendingApprovalResolver) {
            pendingApprovalResolver(msg.result || msg);
            pendingApprovalResolver = null;
          }
          return;
        }

        const { id, method, params } = msg;

        if (!method) return;

        if (method === "initialize") {
          const result = {
            userAgent: "CodexAppServer/1.4.0 (x86_64-linux)",
            codexHome: "/home/codex/.codex",
            platformFamily: "unix",
            platformOs: "linux"
          };
          send({ id, result, jsonrpc: "2.0" });
          return;
        }

        if (method === "initialized") {
          return;
        }

        if (method === "server/diagnostics") {
          const mem = process.memoryUsage();
          send({
            id,
            result: {
              process: {
                id: process.pid,
                residentMemoryBytes: mem.rss,
                physicalFootprintBytes: mem.heapUsed
              },
              gauges: [
                { name: "app.requests.in_flight", value: 1 },
                { name: "core.threads.live", value: threads.size },
                { name: "core.mailbox.pending", value: 0 }
              ]
            },
            jsonrpc: "2.0"
          });
          return;
        }

        if (method === "model/list") {
          send({ id, result: { data: MODELS }, jsonrpc: "2.0" });
          return;
        }

        if (method === "skills/list") {
          send({
            id,
            result: {
              data: [
                {
                  cwd: params?.cwds?.[0] || "/workspace",
                  skills: SKILLS,
                  errors: []
                }
              ]
            },
            jsonrpc: "2.0"
          });
          return;
        }

        if (method === "app/list") {
          send({ id, result: { data: APPS, nextCursor: null }, jsonrpc: "2.0" });
          return;
        }

        if (method === "account/read") {
          send({
            id,
            result: {
              account: {
                type: "chatgpt",
                email: "developer@codex.internal",
                planType: "enterprise"
              },
              requiresOpenaiAuth: false
            },
            jsonrpc: "2.0"
          });
          return;
        }

        if (method === "account/rateLimits/read") {
          send({
            id,
            result: {
              rateLimits: {
                primary: {
                  usedPercent: 18,
                  windowDurationMins: 15,
                  resetsAt: Math.floor(Date.now() / 1000) + 720
                }
              },
              rateLimitResetCredits: {
                availableCount: 3
              }
            },
            jsonrpc: "2.0"
          });
          return;
        }

        if (method === "thread/list") {
          const list = Array.from(threads.values())
            .filter((t) => (params?.archived ? t.archived : !t.archived))
            .sort((a, b) => (b.recencyAt || b.createdAt) - (a.recencyAt || a.createdAt));

          send({
            id,
            result: {
              data: list,
              nextCursor: null,
              backwardsCursor: null
            },
            jsonrpc: "2.0"
          });
          return;
        }

        if (method === "thread/read") {
          const thread = threads.get(params?.threadId);
          if (!thread) {
            send({ id, error: { code: -32602, message: "Thread not found" }, jsonrpc: "2.0" });
            return;
          }
          send({ id, result: { thread }, jsonrpc: "2.0" });
          return;
        }

        if (method === "thread/start") {
          const newId = "thr_" + Math.random().toString(36).substring(2, 10);
          const newThread: ServerThread = {
            id: newId,
            preview: "New Conversation",
            modelProvider: "openai",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            recencyAt: Date.now(),
            status: { type: "idle" },
            model: params?.model || "gpt-5.4-codex",
            reasoningEffort: params?.effort || "medium",
            ephemeral: !!params?.ephemeral,
            path: params?.cwd || "/workspace",
            archived: false,
            turns: []
          };
          threads.set(newId, newThread);

          send({ id, result: { thread: newThread }, jsonrpc: "2.0" });
          sendNotification("thread/started", { thread: newThread });
          return;
        }

        if (method === "thread/resume") {
          const thread = threads.get(params?.threadId);
          if (!thread) {
            send({ id, error: { code: -32602, message: "Thread not found" }, jsonrpc: "2.0" });
            return;
          }
          send({ id, result: { thread }, jsonrpc: "2.0" });
          return;
        }

        if (method === "thread/fork") {
          const source = threads.get(params?.threadId);
          const newId = "thr_fork_" + Math.random().toString(36).substring(2, 8);
          const forked: ServerThread = {
            id: newId,
            preview: (source ? source.preview : "Forked Session") + " (Fork)",
            modelProvider: "openai",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            recencyAt: Date.now(),
            status: { type: "idle" },
            model: source?.model || "gpt-5.4-codex",
            reasoningEffort: source?.reasoningEffort || "medium",
            ephemeral: !!params?.ephemeral,
            path: source?.path || "/workspace",
            archived: false,
            turns: source ? JSON.parse(JSON.stringify(source.turns)) : []
          };
          threads.set(newId, forked);

          send({ id, result: { thread: forked }, jsonrpc: "2.0" });
          sendNotification("thread/started", { thread: forked });
          return;
        }

        if (method === "thread/archive") {
          const thread = threads.get(params?.threadId);
          if (thread) {
            thread.archived = true;
            sendNotification("thread/archived", { threadId: thread.id });
          }
          send({ id, result: {}, jsonrpc: "2.0" });
          return;
        }

        if (method === "thread/delete") {
          const tId = params?.threadId;
          if (tId) {
            threads.delete(tId);
            sendNotification("thread/deleted", { threadId: tId });
          }
          send({ id, result: {}, jsonrpc: "2.0" });
          return;
        }

        if (method === "turn/interrupt") {
          activeTurnAbort = true;
          if (params?.threadId) {
            const thread = threads.get(params.threadId);
            if (thread) {
              thread.status = { type: "idle" };
              sendNotification("thread/status/changed", { threadId: thread.id, status: thread.status });
            }
          }
          send({ id, result: {}, jsonrpc: "2.0" });
          return;
        }

        if (method === "turn/steer") {
          send({ id, result: { turnId: currentTurnId || params?.expectedTurnId }, jsonrpc: "2.0" });
          return;
        }

        if (method === "turn/start") {
          const thread = threads.get(params?.threadId);
          if (!thread) {
            send({ id, error: { code: -32602, message: "Thread not found" }, jsonrpc: "2.0" });
            return;
          }

          const turnId = "turn_" + Math.random().toString(36).substring(2, 9);
          currentTurnId = turnId;
          activeTurnAbort = false;

          const userText = params?.input?.find((i: any) => i.type === "text")?.text || "Execute task";

          if (thread.turns.length === 0 || thread.preview === "New Conversation") {
            thread.preview = userText.slice(0, 45) + (userText.length > 45 ? "..." : "");
          }

          const userMessageItem = {
            type: "userMessage",
            id: "msg_" + Math.random().toString(36).substring(2, 8),
            clientId: params?.clientUserMessageId,
            content: params?.input || [{ type: "text", text: userText }]
          };

          const newTurn: { id: string; status: string; items: any[]; error?: any } = {
            id: turnId,
            status: "inProgress",
            items: [userMessageItem]
          };

          thread.turns.push(newTurn);
          thread.status = { type: "active", activeFlags: [] };
          thread.recencyAt = Date.now();
          thread.updatedAt = Date.now();

          send({ id, result: { turn: newTurn }, jsonrpc: "2.0" });
          sendNotification("turn/started", { turn: newTurn });
          sendNotification("thread/status/changed", { threadId: thread.id, status: thread.status });
          sendNotification("item/started", { item: userMessageItem });
          sendNotification("item/completed", { item: userMessageItem });

          const isShellRequest =
            userText.toLowerCase().includes("run") ||
            userText.toLowerCase().includes("build") ||
            userText.toLowerCase().includes("test") ||
            userText.toLowerCase().includes("exec") ||
            userText.startsWith("!");

          const isFileEditRequest =
            userText.toLowerCase().includes("edit") ||
            userText.toLowerCase().includes("modify") ||
            userText.toLowerCase().includes("patch") ||
            userText.toLowerCase().includes("file") ||
            userText.toLowerCase().includes("create");

          const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

          (async () => {
            await sleep(250);
            if (activeTurnAbort) {
              newTurn.status = "interrupted";
              thread.status = { type: "idle" };
              sendNotification("turn/completed", { turn: newTurn });
              sendNotification("thread/status/changed", { threadId: thread.id, status: thread.status });
              return;
            }

            const reasoningItem = {
              type: "reasoning",
              id: "rsn_" + Math.random().toString(36).substring(2, 8),
              summary: "Analyzing prompt intent and dependencies...",
              content: ""
            };
            newTurn.items.push(reasoningItem);
            sendNotification("item/started", { item: reasoningItem });

            const thoughts = [
              "Formulating plan...",
              "Evaluating safety boundary...",
              "Determining optimal toolchain...",
              "Generating code diff..."
            ];

            for (let i = 0; i < thoughts.length; i++) {
              if (activeTurnAbort) break;
              await sleep(200);
              sendNotification("item/reasoning/summaryTextDelta", {
                itemId: reasoningItem.id,
                summaryIndex: 0,
                delta: " " + thoughts[i]
              });
            }

            sendNotification("item/completed", { item: reasoningItem });

            if (activeTurnAbort) {
              newTurn.status = "interrupted";
              thread.status = { type: "idle" };
              sendNotification("turn/completed", { turn: newTurn });
              sendNotification("thread/status/changed", { threadId: thread.id, status: thread.status });
              return;
            }

            sendNotification("turn/plan/updated", {
              turnId,
              plan: [
                { step: "Analyze project context", status: "completed" },
                { step: "Execute required actions and verify code", status: "inProgress" },
                { step: "Finalize response and stream output", status: "pending" }
              ]
            });

            if (isShellRequest) {
              const cmdItem = {
                type: "commandExecution",
                id: "cmd_" + Math.random().toString(36).substring(2, 8),
                command: "npm test -- --coverage",
                cwd: thread.path || "/workspace",
                status: "inProgress",
                aggregatedOutput: ""
              };
              newTurn.items.push(cmdItem);
              sendNotification("item/started", { item: cmdItem });

              if (params?.approvalPolicy !== "never") {
                const approvalRes = await sendRequest("item/commandExecution/requestApproval", {
                  itemId: cmdItem.id,
                  threadId: thread.id,
                  turnId,
                  command: cmdItem.command,
                  cwd: cmdItem.cwd,
                  reason: "Execute test runner in sandbox environment",
                  availableDecisions: ["accept", "acceptForSession", "decline", "cancel"]
                });

                sendNotification("serverRequest/resolved", { threadId: thread.id, requestId: "srv_req_approval" });

                if (approvalRes?.decision === "decline" || approvalRes?.decision === "cancel") {
                  cmdItem.status = "declined";
                  cmdItem.aggregatedOutput = "[approval declined by user]";
                  sendNotification("item/completed", { item: cmdItem });
                } else {
                  const deltas = [
                    "> jest --coverage\n",
                    " PASS  src/protocol.test.ts\n",
                    "  ✓ handles JSON-RPC 2.0 requests (12ms)\n",
                    "  ✓ streams agentMessage deltas smoothly (8ms)\n",
                    "  ✓ handles user approval flows (15ms)\n\n",
                    "Test Suites: 1 passed, 1 total\nTests:       3 passed, 3 total\nSnapshots:   0 total\nTime:        0.842 s\n"
                  ];
                  for (const d of deltas) {
                    if (activeTurnAbort) break;
                    await sleep(150);
                    cmdItem.aggregatedOutput += d;
                    sendNotification("item/commandExecution/outputDelta", {
                      itemId: cmdItem.id,
                      stream: "stdout",
                      deltaBase64: Buffer.from(d).toString("base64")
                    });
                  }
                  cmdItem.status = "completed";
                  sendNotification("item/completed", { item: cmdItem });
                }
              } else {
                cmdItem.aggregatedOutput = "PASS 3 tests passed successfully.";
                cmdItem.status = "completed";
                sendNotification("item/completed", { item: cmdItem });
              }
            }

            if (isFileEditRequest && !activeTurnAbort) {
              const fileItem: { type: string; id: string; changes: any[]; status: string } = {
                type: "fileChange",
                id: "file_" + Math.random().toString(36).substring(2, 8),
                changes: [
                  {
                    path: "src/services/chatEngine.ts",
                    kind: "modify",
                    diff: `--- a/src/services/chatEngine.ts\n+++ b/src/services/chatEngine.ts\n@@ -12,4 +12,6 @@\n export function handleMessage(msg: string) {\n-  return parseInput(msg);\n+  const sanitized = sanitize(msg);\n+  return dispatchJsonRpc(sanitized);\n }\n`
                  }
                ],
                status: "inProgress"
              };
              newTurn.items.push(fileItem);
              sendNotification("item/started", { item: fileItem });
              await sleep(300);
              fileItem.status = "completed";
              sendNotification("item/completed", { item: fileItem });
              sendNotification("turn/diff/updated", {
                threadId: thread.id,
                turnId,
                diff: fileItem.changes[0].diff
              });
            }

            if (activeTurnAbort) {
              newTurn.status = "interrupted";
              thread.status = { type: "idle" };
              sendNotification("turn/completed", { turn: newTurn });
              sendNotification("thread/status/changed", { threadId: thread.id, status: thread.status });
              return;
            }

            const agentItem = {
              type: "agentMessage",
              id: "msg_ag_" + Math.random().toString(36).substring(2, 8),
              text: ""
            };
            newTurn.items.push(agentItem);
            sendNotification("item/started", { item: agentItem });

            const sampleResponse =
              `Task executed successfully.\n\n` +
              `### Execution Summary\n` +
              `- **Protocol**: JSON-RPC 2.0 streaming via WebSocket\n` +
              `- **Thread**: \`${thread.id}\`\n` +
              `- **Model**: \`${thread.model}\` (${thread.reasoningEffort} reasoning)\n\n` +
              `\`\`\`typescript\n` +
              `// JSON-RPC 2.0 message envelope\n` +
              `const response = await wsClient.request("turn/start", {\n` +
              `  threadId: "${thread.id}",\n` +
              `  input: [{ type: "text", text: "${userText.slice(0, 30)}" }]\n` +
              `});\n` +
              `\`\`\`\n\n` +
              `The active turn is now complete and ready for your next prompt.`;

            const chunks = sampleResponse.match(/.{1,12}/gs) || [sampleResponse];
            for (const chunk of chunks) {
              if (activeTurnAbort) break;
              await sleep(35);
              agentItem.text += chunk;
              sendNotification("item/agentMessage/delta", {
                itemId: agentItem.id,
                delta: chunk
              });
            }

            sendNotification("item/completed", { item: agentItem });

            sendNotification("thread/tokenUsage/updated", {
              threadId: thread.id,
              tokenUsage: {
                totalTokens: 1420,
                inputTokens: 680,
                outputTokens: 740,
                reasoningTokens: 210
              }
            });

            newTurn.status = activeTurnAbort ? "interrupted" : "completed";
            thread.status = { type: "idle" };

            sendNotification("turn/completed", { turn: newTurn });
            sendNotification("thread/status/changed", { threadId: thread.id, status: thread.status });
          })();

          return;
        }

        send({ id, error: { code: -32601, message: `Method '${method}' not implemented in mock engine` }, jsonrpc: "2.0" });
      } catch (err: any) {
        send({ error: { code: -32700, message: "Parse error: " + err.message }, jsonrpc: "2.0" });
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
