// =========================================================
// An AI workflow automation, as a pure state model. No DOM, no timers.
//
// Models the shape tools like n8n and Flowise share: a trigger starts
// an execution, a JSON item passes from node to node, an AI node turns
// free text into structured fields, and a switch routes on them. Also
// models an AI reply that isn't valid JSON, stopping versus retrying
// with the parser's error, and a trigger that fires twice for one email.
// See automations-engine.test.ts.
//
// Simplified on purpose: one email per execution, one fixed workflow,
// and the AI's replies are fixed per email so every run is repeatable.
// =========================================================

import type { Packet } from "@/lib/simulation/simulation-types";
import type { AutoConfig, AutoEventType, AutoFrame, AutoNodeId, AutoState, Category, EmailId, Execution, Item } from "./automations-types";

export const EMAILS: Record<EmailId, { from: string; subject: string; body: string }> = {
  order: { from: "priya@example.com", subject: "Where is my order #4471?", body: "Hi, I ordered a tent a week ago and it still hasn't arrived." },
  complaint: { from: "dev@example.com", subject: "Your tent leaked on our trek", body: "It leaked on the first night and my kid got soaked. I want a refund now." },
  spam: { from: "prizes@example.biz", subject: "You've won a free cruise!!!", body: "Click here to claim your prize before midnight." },
  messy: { from: "ram@example.com", subject: "fwd: fwd: re: order", body: "see below… order 5120 never came?? pls sort asap thx" },
};

type Parsed = { category: Category; orderId: string | null; urgent: boolean };
const PARSED: Record<EmailId, Parsed> = {
  order: { category: "order", orderId: "4471", urgent: false },
  complaint: { category: "complaint", orderId: null, urgent: true },
  spam: { category: "spam", orderId: null, urgent: false },
  messy: { category: "order", orderId: "5120", urgent: false },
};
// A messy email gets a chatty, half-formed reply the first time.
const INVALID = "Sure! Here's the JSON: {category: order, orderId: 5120";

// Like JSON.parse with a schema: anything else is an error the workflow must handle.
export const parse = (raw: string): Parsed | null => {
  try {
    const v = JSON.parse(raw) as Partial<Parsed>;
    return v && ["order", "complaint", "spam"].includes(v.category as string) && typeof v.urgent === "boolean" ? (v as Parsed) : null;
  } catch {
    return null;
  }
};

export const createState = (patch: AutoConfig = {}): AutoState => ({
  item: null,
  raw: null,
  executions: [],
  seen: [],
  rows: [],
  replies: [],
  last: null,
  onError: "stop",
  dedupe: "off",
  next: 1,
  stats: { executions: 0, failed: 0, aiCalls: 0, rows: 0, replies: 0, alerts: 0 },
  ...patch,
});

const packet = (from: AutoNodeId, to: AutoNodeId, label: string, kind: Packet["kind"] = "request"): Packet<AutoNodeId> => ({ from, to, label, kind });

const chain = (state: AutoState) => {
  let s = state;
  const frames: AutoFrame[] = [];
  const step = (type: AutoEventType, at: AutoNodeId, packets: Packet<AutoNodeId>[], patch: (st: AutoState) => AutoState = (st) => st, meta: Partial<AutoFrame> = {}) => {
    s = patch(s);
    frames.push({ type, state: s, packets, at, dur: 700, ...meta });
  };
  return { step, get state() { return s; }, frames };
};

const count = (s: AutoState, key: keyof AutoState["stats"], by = 1): AutoState => ({ ...s, stats: { ...s.stats, [key]: s.stats[key] + by } });
// Updates the running execution: its status, and the nodes it has passed through.
const visit = (s: AutoState, node: AutoNodeId, status: Execution["status"] = "running"): AutoState => ({
  ...s, executions: s.executions.map((e, i) => (i === s.executions.length - 1 ? { ...e, status, path: e.path.includes(node) ? e.path : [...e.path, node] } : e)),
});

// ---------- One execution ----------
const execute = (state: AutoState, email: EmailId, messageId: string): AutoFrame[] => {
  const c = chain(state);
  const mail = EMAILS[email];
  const item: Item = { messageId, from: mail.from, subject: mail.subject };
  const run: Execution = { n: state.stats.executions + 1, email, messageId, status: "running", path: ["trigger"] };

  if (state.dedupe === "on" && state.seen.includes(messageId)) {
    c.step("duplicate.skipped", "trigger", [], (s) => ({ ...count(s, "executions"), item, raw: null, last: { email, messageId }, executions: [...s.executions, { ...run, status: "skipped" as const }].slice(-8) }));
    return c.frames;
  }

  c.step("triggered", "trigger", [], (s) => ({ ...count(s, "executions"), item, raw: null, last: { email, messageId }, seen: [...s.seen, messageId], executions: [...s.executions, run].slice(-8) }));
  c.step("ai.called", "ai", [packet("trigger", "ai", "{ item }")], (s) => count(visit(s, "ai"), "aiCalls"));

  let raw = email === "messy" ? INVALID : JSON.stringify(PARSED[email]);
  if (!parse(raw)) {
    c.step("ai.invalid", "ai", [], (s) => ({ ...s, raw }), { dur: 900 });
    if (c.state.onError === "stop") {
      c.step("execution.failed", "ai", [], (s) => count(visit(s, "ai", "error"), "failed"));
      return c.frames;
    }
    // Auto-fix: send the parser's complaint back to the model and ask again.
    raw = JSON.stringify(PARSED[email]);
    c.step("ai.retried", "ai", [], (s) => count({ ...s, raw }, "aiCalls"));
  }
  const parsed = parse(raw) as Parsed;
  c.step("ai.output", "router", [packet("ai", "router", parsed.category, "value")], (s) => ({ ...visit(s, "router"), raw, item: { ...item, ...parsed } }));

  if (parsed.category === "spam") {
    c.step("dropped", "router", [], (s) => s);
  } else if (parsed.category === "complaint") {
    c.step("routed", "chat", [packet("router", "chat", "complaint", "command")], (s) => visit(s, "chat"));
    c.step("alert.posted", "chat", [], (s) => count(s, "alerts"));
  } else {
    c.step("routed", "sheet", [packet("router", "sheet", "order", "command")], (s) => visit(s, "sheet"));
    c.step("row.added", "sheet", [], (s) => count({ ...s, rows: [...s.rows, { orderId: parsed.orderId ?? "?", from: mail.from }] }, "rows"));
    c.step("reply.sent", "reply", [packet("sheet", "reply", mail.from.split("@")[0] as string, "value")], (s) => count({ ...visit(s, "reply"), replies: [...s.replies, mail.from] }, "replies"));
  }
  const path = c.state.executions[c.state.executions.length - 1]?.path ?? [];
  c.step("execution.done", path[path.length - 1] ?? "router", [], (s) => visit(s, "router", "success"));
  return c.frames;
};

// A new email: a new message id.
export const receive = (state: AutoState, email: EmailId): AutoFrame[] =>
  execute({ ...state, next: state.next + 1 }, email, `msg-${String(state.next).padStart(3, "0")}`);

// Polling overlaps, or a webhook is retried: the same email arrives again.
export const redeliver = (state: AutoState): AutoFrame[] | null => (state.last ? execute(state, state.last.email, state.last.messageId) : null);

export const configure = (state: AutoState, patch: AutoConfig): AutoFrame[] => [{ type: "config.changed", state: { ...state, ...patch }, packets: [], dur: 1, patch }];

export const runAll = (state: AutoState, ...actions: ((s: AutoState) => AutoFrame[] | null)[]) => {
  let s = state;
  const frames: AutoFrame[] = [];
  for (const action of actions) {
    const out = action(s) ?? [];
    frames.push(...out);
    s = out[out.length - 1]?.state ?? s;
  }
  return { state: s, frames };
};
