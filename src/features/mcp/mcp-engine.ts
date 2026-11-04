// =========================================================
// The Model Context Protocol, as a pure state model. No DOM, no timers.
//
// Models how an AI app (the host) gives a model tools it didn't ship
// with: it starts one MCP client per server, each does the initialize
// handshake over stdio or HTTP, and tools/list says what the server
// offers. When the model asks for a tool, the host sends tools/call to
// whichever server owns it and puts the result back in the model's
// context. Also models two servers at once, a tool that returns an
// error the model recovers from, and the host asking the user before
// a tool that changes something.
// See mcp-engine.test.ts.
//
// Simplified on purpose: two small servers, four tools, and the model's
// choices fixed per question so every run is repeatable.
// =========================================================

import type { Packet } from "@/lib/simulation/simulation-types";
import type { Call, McpConfig, McpEventType, McpFrame, McpNodeId, McpState, QuestionId, Rpc, ServerId, ToolDef } from "./mcp-types";

export const PROTOCOL = "2025-06-18";

export const SERVERS: Record<ServerId, { name: string; version: string; command: string; url: string }> = {
  files: { name: "files", version: "0.3.0", command: "npx files-mcp ~/notes", url: "http://localhost:8931/mcp" },
  calendar: { name: "calendar", version: "1.2.0", command: "npx calendar-mcp", url: "https://calendar.example.com/mcp" },
};

export const TOOLS: ToolDef[] = [
  { name: "read_file", server: "files", description: "Read a text file from the notes folder.", write: false, inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "list_files", server: "files", description: "List the files in the notes folder.", write: false, inputSchema: { type: "object", properties: {} } },
  { name: "list_events", server: "calendar", description: "List calendar events on a date (YYYY-MM-DD).", write: false, inputSchema: { type: "object", properties: { date: { type: "string" } }, required: ["date"] } },
  { name: "create_event", server: "calendar", description: "Create a calendar event.", write: true, inputSchema: { type: "object", properties: { title: { type: "string" }, start: { type: "string" } }, required: ["title", "start"] } },
];

// What the model would do with each question, given the tools it needs.
export const QUESTIONS: Record<QuestionId, { text: string; needs: ServerId; calls: Call[]; answer: string; without: string; denied?: string }> = {
  notes: {
    text: "What's in notes.txt?", needs: "files",
    calls: [{ tool: "read_file", args: { path: "notes.txt" }, result: "Buy milk. Call Sita about the trip on Friday." }],
    answer: "notes.txt says: buy milk, and call Sita about the trip on Friday.",
    without: "I can't see your files from here. Nothing I've been given can read them.",
  },
  missing: {
    text: "Summarise todo.txt", needs: "files",
    calls: [
      { tool: "read_file", args: { path: "todo.txt" }, result: "ENOENT: no such file: todo.txt", isError: true },
      { tool: "list_files", args: {}, result: "[\"notes.txt\", \"plan.md\"]" },
    ],
    answer: "There's no todo.txt. I can see notes.txt and plan.md. Shall I summarise one of those?",
    without: "I can't see your files from here. Nothing I've been given can read them.",
  },
  free: {
    text: "Am I free at 3pm tomorrow?", needs: "calendar",
    calls: [{ tool: "list_events", args: { date: "2026-11-04" }, result: "[{\"start\": \"10:00\", \"title\": \"Standup\"}]" }],
    answer: "Yes. Tomorrow you only have standup at 10:00, so 3pm is free.",
    without: "I can't see your calendar, so I can't tell. I'd only be guessing.",
  },
  book: {
    text: "Book a call with Sita at 3pm tomorrow", needs: "calendar",
    calls: [{ tool: "create_event", args: { title: "Call with Sita", start: "2026-11-04T15:00" }, result: "{\"id\": \"evt_381\", \"status\": \"confirmed\"}" }],
    answer: "Done: “Call with Sita” is on your calendar for tomorrow at 15:00.",
    without: "I can't reach your calendar, so I can't book it.",
    denied: "OK, I haven't added it. Your calendar is unchanged.",
  },
};

export const createState = (patch: McpConfig = {}): McpState => ({
  transport: "stdio",
  approval: "ask",
  connected: [],
  tools: [],
  rpc: [],
  rpcId: 1,
  chat: [],
  question: null,
  pending: null,
  stats: { servers: 0, tools: 0, messages: 0, toolCalls: 0, toolErrors: 0, approvals: 0 },
  ...patch,
});

const packet = (from: McpNodeId, to: McpNodeId, label: string, kind: Packet["kind"] = "request"): Packet<McpNodeId> => ({ from, to, label, kind });

const chain = (state: McpState) => {
  let s = state;
  const frames: McpFrame[] = [];
  const step = (type: McpEventType, at: McpNodeId, packets: Packet<McpNodeId>[], patch: (st: McpState) => McpState = (st) => st, meta: Partial<McpFrame> = {}) => {
    s = patch(s);
    frames.push({ type, state: s, packets, at, dur: 700, ...meta });
  };
  return { step, get state() { return s; }, frames };
};

const add = (s: McpState, patch: Partial<McpState["stats"]>): McpState => ({
  ...s, stats: Object.fromEntries(Object.entries(s.stats).map(([k, v]) => [k, v + (patch[k as keyof McpState["stats"]] ?? 0)])) as McpState["stats"],
});
// Logs one JSON-RPC message. Requests take the next id; notifications have none.
const wire = (s: McpState, server: ServerId, dir: Rpc["dir"], body: Record<string, unknown>): McpState =>
  add({ ...s, rpc: [...s.rpc, { dir, server, json: JSON.stringify({ jsonrpc: "2.0", ...body }) }].slice(-8) }, { messages: 1 });
const say = (s: McpState, line: McpState["chat"][number]): McpState => ({ ...s, chat: [...s.chat, line].slice(-8) });
const synced = (s: McpState): McpState => ({ ...s, stats: { ...s.stats, servers: s.connected.length, tools: s.tools.length } });

export const ownerOf = (s: Pick<McpState, "tools">, name: string) => s.tools.find((t) => t.name === name);

// ---------- Connecting a server ----------
export const connect = (state: McpState, server: ServerId): McpFrame[] => {
  if (state.connected.includes(server)) {
    return [{ type: "disconnected", state: synced({ ...state, connected: state.connected.filter((x) => x !== server), tools: state.tools.filter((t) => t.server !== server) }), packets: [], at: server, server, dur: 600 }];
  }
  const c = chain(state);
  const id = state.rpcId;
  const info = SERVERS[server];
  const own = TOOLS.filter((t) => t.server === server);
  c.step("spawned", server, [packet("host", server, state.transport === "stdio" ? "spawn" : "connect", "command")], (s) => s, { server });
  c.step("initialize", server, [packet("host", server, "initialize")], (s) => wire({ ...s, rpcId: id + 2 }, server, "→", { id, method: "initialize", params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "host", version: "1.0" } } }), { server });
  c.step("initialized", "host", [packet(server, "host", "capabilities", "value")], (s) => {
    const reply = wire(s, server, "←", { id, result: { protocolVersion: PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: info.name, version: info.version } } });
    return wire(reply, server, "→", { method: "notifications/initialized" });
  }, { server });
  c.step("listed", server, [packet("host", server, "tools/list")], (s) => wire(s, server, "→", { id: id + 1, method: "tools/list" }), { server });
  c.step("tools.received", "host", [packet(server, "host", `${own.length} tools`, "value")], (s) => synced(wire({ ...s, connected: [...s.connected, server], tools: [...s.tools, ...own] }, server, "←", {
    id: id + 1, result: { tools: own.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) },
  })), { server });
  return c.frames;
};

// ---------- Asking ----------
// Runs the question's tool calls from `index` on, stopping to ask before any write.
const proceed = (c: ReturnType<typeof chain>, question: QuestionId, index: number, approved = false) => {
  const q = QUESTIONS[question];
  for (let i = index; i < q.calls.length; i++) {
    const call = q.calls[i] as Call;
    const def = ownerOf(c.state, call.tool) as ToolDef;
    if (!(approved && i === index)) {
      c.step("tool.chosen", "host", [packet("model", "host", call.tool, "command")], (s) => s, { tool: call.tool, server: def.server });
      if (def.write && c.state.approval === "ask") {
        c.step("approval.waiting", "user", [packet("host", "user", "allow?", "stale")], (s) => add({ ...s, pending: { question, index: i } }, { approvals: 1 }), { tool: call.tool, server: def.server });
        return;
      }
    }
    const id = c.state.rpcId;
    c.step("call.sent", def.server, [packet("host", def.server, "tools/call", "command")], (s) => add(wire({ ...s, rpcId: id + 1 }, def.server, "→", { id, method: "tools/call", params: { name: call.tool, arguments: call.args } }), { toolCalls: 1 }), { tool: call.tool, server: def.server });
    c.step("call.result", "host", [packet(def.server, "host", call.isError ? "isError" : "result", call.isError ? "error" : "value")], (s) => add(say(wire(s, def.server, "←", { id, result: { content: [{ type: "text", text: call.result }], isError: !!call.isError } }), { role: "tool", tool: call.tool, text: call.result, isError: call.isError }), { toolErrors: call.isError ? 1 : 0 }), { tool: call.tool, server: def.server });
    c.step("model.called", "model", [packet("host", "model", "tool result")], (s) => s, { tool: call.tool });
  }
  c.step("answered", "user", [packet("model", "host", "answer", "value"), packet("host", "user", "answer", "value")], (s) => say(s, { role: "assistant", text: q.answer }));
};

export const ask = (state: McpState, question: QuestionId): McpFrame[] | null => {
  if (state.pending) return null;
  const c = chain(state);
  const q = QUESTIONS[question];
  c.step("asked", "host", [packet("user", "host", "question")], (s) => say({ ...s, question, chat: [] }, { role: "user", text: q.text }));
  c.step("model.called", "model", [packet("host", "model", `prompt + ${c.state.tools.length} tools`)]);
  if (!c.state.connected.includes(q.needs)) {
    c.step("answered", "user", [packet("model", "host", "answer", "value"), packet("host", "user", "answer", "value")], (s) => say(s, { role: "assistant", text: q.without }));
    return c.frames;
  }
  proceed(c, question, 0);
  return c.frames;
};

export const approve = (state: McpState): McpFrame[] | null => {
  const p = state.pending;
  if (!p) return null;
  const c = chain(state);
  c.step("approved", "host", [packet("user", "host", "allow", "value")], (s) => ({ ...s, pending: null }));
  proceed(c, p.question, p.index, true);
  return c.frames;
};

export const deny = (state: McpState): McpFrame[] | null => {
  const p = state.pending;
  if (!p) return null;
  const c = chain(state);
  const q = QUESTIONS[p.question];
  const call = q.calls[p.index] as Call;
  c.step("denied", "model", [packet("user", "host", "deny", "error"), packet("host", "model", "declined")], (s) => say({ ...s, pending: null }, { role: "tool", tool: call.tool, text: "The user declined this tool call.", isError: true }), { tool: call.tool });
  c.step("answered", "user", [packet("model", "host", "answer", "value"), packet("host", "user", "answer", "value")], (s) => say(s, { role: "assistant", text: q.denied ?? q.without }));
  return c.frames;
};

export const configure = (state: McpState, patch: McpConfig): McpFrame[] => [{ type: "config.changed", state: { ...state, ...patch }, packets: [], dur: 1, patch }];

export const runAll = (state: McpState, ...actions: ((s: McpState) => McpFrame[] | null)[]) => {
  let s = state;
  const frames: McpFrame[] = [];
  for (const action of actions) {
    const out = action(s) ?? [];
    frames.push(...out);
    s = out[out.length - 1]?.state ?? s;
  }
  return { state: s, frames };
};
