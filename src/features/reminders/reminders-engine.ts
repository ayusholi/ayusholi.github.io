// =========================================================
// An AI reminder bot on WhatsApp, as a pure state model. No DOM, no timers.
//
// Models the path a message like "remind me to pay rent tomorrow at 9"
// takes: a webhook from the WhatsApp Business Platform, one model call
// that turns the sentence into a task and a time, a row in a database,
// and a scheduler that sends the reminder when it's due. Also models
// the timezone the model is told, a request with no time in it, and
// WhatsApp's 24-hour customer service window, outside which only
// pre-approved template messages are delivered.
// See reminders-engine.test.ts.
//
// Simplified on purpose: one user in Kathmandu, a simulated clock that
// jumps straight to the next due reminder, and fixed model replies.
// =========================================================

import type { Packet } from "@/lib/simulation/simulation-types";
import type { MessageId, Parsed, RemConfig, RemEventType, RemFrame, RemNodeId, RemState, Reminder } from "./reminders-types";

export const DAY = 1440;
export const WINDOW = 24 * 60;            // the customer service window, in minutes
export const OFFSET = 5 * 60 + 45;        // Asia/Kathmandu is UTC+05:45
export const START = 18 * 60 + 30;        // Monday 3 November 2026, 18:30 in Kathmandu
export const USER = "+977 98XXXXXXXX";
export const TEMPLATE = "reminder_due";
// The approved template's body, with {{1}} filled in.
export const templateText = (task: string) => `Reminder: ${task}. Reply here to change or stop your reminders.`;

export const MESSAGES: Record<MessageId, string> = {
  rent: "Remind me to pay rent tomorrow at 9am",
  pills: "Remind me to take my medicine every day at 8pm",
  later: "Remind me about the meeting later",
};

// What the model is asked to return for each message: a task, a local time it
// means, and whether it repeats. `at` is minutes since Monday 00:00, read in
// whichever timezone the prompt gave the model.
const INTENT: Record<MessageId, { task: string; at: number | null; repeat: "daily" | null }> = {
  rent: { task: "Pay rent", at: DAY + 9 * 60, repeat: null },
  pills: { task: "Take medicine", at: 20 * 60, repeat: "daily" },
  later: { task: "The meeting", at: null, repeat: null },
};

const DAYS = ["Mon 3 Nov", "Tue 4 Nov", "Wed 5 Nov", "Thu 6 Nov", "Fri 7 Nov", "Sat 8 Nov", "Sun 9 Nov"];
const pad = (v: number) => String(v).padStart(2, "0");
export const clock = (min: number) => `${pad(Math.floor((((min % DAY) + DAY) % DAY) / 60))}:${pad(((min % 60) + 60) % 60)}`;
export const when = (min: number) => `${DAYS[Math.floor(min / DAY)] ?? `day ${Math.floor(min / DAY) + 1}`} ${clock(min)}`;
const iso = (min: number) => `2026-11-${pad(3 + Math.floor(min / DAY))}T${clock(min)}`;

// The prompt's first line: the model can only resolve "tomorrow at 9" against the time and zone it's given.
export const promptClock = (s: Pick<RemState, "now" | "tz">) => (s.tz === "user"
  ? `Now: ${iso(s.now)} Asia/Kathmandu.`
  : `Now: ${iso(s.now - OFFSET)} UTC.`);

export const inWindow = (s: Pick<RemState, "lastIn">, at: number) => s.lastIn !== null && at - s.lastIn < WINDOW;

export const createState = (patch: RemConfig = {}): RemState => ({
  now: START,
  lastIn: null,
  tz: "user",
  template: "off",
  reminders: [],
  chat: [],
  parsed: null,
  api: null,
  firing: null,
  next: 1,
  stats: { messagesIn: 0, aiCalls: 0, saved: 0, delivered: 0, rejected: 0, questions: 0 },
  ...patch,
});

const packet = (from: RemNodeId, to: RemNodeId, label: string, kind: Packet["kind"] = "request"): Packet<RemNodeId> => ({ from, to, label, kind });

const chain = (state: RemState) => {
  let s = state;
  const frames: RemFrame[] = [];
  const step = (type: RemEventType, at: RemNodeId, packets: Packet<RemNodeId>[], patch: (st: RemState) => RemState = (st) => st, meta: Partial<RemFrame> = {}) => {
    s = patch(s);
    frames.push({ type, state: s, packets, at, dur: 700, ...meta });
  };
  return { step, get state() { return s; }, frames };
};

const count = (s: RemState, key: keyof RemState["stats"]): RemState => ({ ...s, stats: { ...s.stats, [key]: s.stats[key] + 1 } });
const say = (s: RemState, line: RemState["chat"][number]): RemState => ({ ...s, chat: [...s.chat, line].slice(-10) });
const update = (s: RemState, id: number, patch: Partial<Reminder>): RemState => ({ ...s, reminders: s.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

// ---------- A message arrives ----------
export const send = (state: RemState, message: MessageId): RemFrame[] => {
  const c = chain(state);
  const text = MESSAGES[message];
  const intent = INTENT[message];
  c.step("message.in", "whatsapp", [packet("phone", "whatsapp", "message")], (s) => count(say({ ...s, lastIn: s.now }, { from: "you", text, at: s.now }), "messagesIn"));
  c.step("webhook", "server", [packet("whatsapp", "server", "POST /webhook")], (s) => ({ ...s, parsed: null, api: null }));

  // The model reads the time in the zone it was given. Told UTC, "9am" is 09:00 UTC: 14:45 in Kathmandu.
  const shift = c.state.tz === "server" ? OFFSET : 0;
  const parsed: Parsed = { task: intent.task, at: intent.at === null ? null : iso(intent.at), timezone: c.state.tz === "user" ? "Asia/Kathmandu" : "UTC", repeat: intent.repeat };
  c.step("ai.parsed", "ai", [packet("server", "ai", "text + now")], (s) => count({ ...s, parsed }, "aiCalls"));

  if (intent.at === null) {
    c.step("ai.unclear", "server", [packet("ai", "server", "at: null", "stale")]);
    const ask = `When should I remind you about ${intent.task.toLowerCase()}?`;
    c.step("asked", "phone", [packet("server", "whatsapp", "reply"), packet("whatsapp", "phone", "question", "value")], (s) => count(say(s, { from: "bot", text: ask, at: s.now }), "questions"));
    return c.frames;
  }

  const due = intent.at + shift;
  const reminder: Reminder = { id: c.state.next, task: intent.task, due, intended: intent.at, repeat: intent.repeat, status: "scheduled", delivered: 0, rejected: 0, last: null };
  c.step("saved", "db", [packet("ai", "server", "JSON", "value"), packet("server", "db", "INSERT", "command")], (s) => count({ ...s, next: s.next + 1, reminders: [...s.reminders, reminder].slice(-6) }, "saved"));
  const confirm = `Got it. I'll remind you to ${intent.task.toLowerCase()} ${intent.repeat ? `every day at ${clock(due)}` : `on ${when(due)}`}.`;
  c.step("confirmed", "phone", [packet("server", "whatsapp", "reply"), packet("whatsapp", "phone", "✓ saved", "value")], (s) => say(s, { from: "bot", text: confirm, at: s.now }));
  return c.frames;
};

// ---------- The scheduler ----------
// The clock moves on to the next due reminder, and the scheduler sends it. No model is involved.
export const advance = (state: RemState): RemFrame[] | null => {
  const due = state.reminders.filter((r) => r.status === "scheduled").sort((a, b) => a.due - b.due || a.id - b.id)[0];
  if (!due) return null;
  const c = chain(state);
  c.step("clock", "scheduler", [], (s) => ({ ...s, now: due.due, firing: due.id, api: null }), { dur: 900 });
  c.step("due", "db", [packet("scheduler", "db", "SELECT due"), packet("db", "scheduler", due.task, "value")]);

  const open = inWindow(c.state, due.due);
  const template = !open && c.state.template === "on";
  c.step(open ? "window.open" : "window.closed", "scheduler", []);
  const text = template ? templateText(due.task) : `Time to ${due.task.toLowerCase()}!`;
  const after = (s: RemState): RemState => (due.repeat ? update(s, due.id, { due: due.due + DAY }) : update(s, due.id, { status: "done" }));

  if (open || template) {
    c.step("delivered", "phone", [packet("scheduler", "whatsapp", template ? "template" : "text", "command"), packet("whatsapp", "phone", "reminder", "value")], (s) => count(say(update({ ...s, api: { type: template ? "template" : "text", to: USER, task: due.task, text, status: "sent" } }, due.id, { delivered: due.delivered + 1, last: "delivered" }), { from: "bot", text, at: s.now, template }), "delivered"));
  } else {
    c.step("rejected", "scheduler", [packet("scheduler", "whatsapp", "text", "command"), packet("whatsapp", "scheduler", "131047", "error")], (s) => count(say(update({ ...s, api: { type: "text", to: USER, task: due.task, text, status: "failed" } }, due.id, { rejected: due.rejected + 1, last: "rejected" }), { from: "bot", text, at: s.now, failed: true }), "rejected"));
  }
  c.step("rescheduled", "db", due.repeat ? [packet("scheduler", "db", "+1 day", "command")] : [packet("scheduler", "db", "done", "command")], after);
  return c.frames;
};

export const configure = (state: RemState, patch: RemConfig): RemFrame[] => [{ type: "config.changed", state: { ...state, ...patch }, packets: [], dur: 1, patch }];

export const runAll = (state: RemState, ...actions: ((s: RemState) => RemFrame[] | null)[]) => {
  let s = state;
  const frames: RemFrame[] = [];
  for (const action of actions) {
    const out = action(s) ?? [];
    frames.push(...out);
    s = out[out.length - 1]?.state ?? s;
  }
  return { state: s, frames };
};
