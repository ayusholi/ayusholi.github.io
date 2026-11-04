// The bot's words, kept apart from its logic. `describe` narrates a frame from
// the state that frame holds, so the caption can't disagree with the simulation.
import { clock, inWindow, OFFSET, promptClock, TEMPLATE, when } from "./reminders-engine";
import type { RemEventType, RemFrame, RemNodeId, RemState } from "./reminders-types";

export const ROLES: Record<RemNodeId, { name: string; sub: string; role: string }> = {
  phone: { name: "Your phone", sub: "WhatsApp chat", role: "An ordinary WhatsApp chat with a business number. The user never installs anything: they just write in plain words." },
  whatsapp: { name: "WhatsApp API", sub: "Business Platform", role: "Meta's Cloud API. It delivers incoming messages to your webhook as JSON, and sends yours when you POST to /messages. It enforces the rules: free-form messages only within 24 hours of the user's last message, approved templates otherwise." },
  server: { name: "Your server", sub: "Webhook endpoint", role: "Receives the webhook, checks its signature, answers 200 quickly, then does the work: asks the model to read the message, saves the result and replies." },
  ai: { name: "AI: read it", sub: "Text → task + time", role: "One model call with a schema: return task, an ISO time and repeat, or at: null if there's no time. It resolves words like “tomorrow” against the current time in the prompt, so the prompt has to say which timezone that is." },
  db: { name: "Reminders table", sub: "One row each", role: "The reminder as data: task, due time stored unambiguously, repeat rule, status. Once it's here, the AI's job is over." },
  scheduler: { name: "Scheduler", sub: "Runs every minute", role: "A cron job or a delayed-job queue. Every minute it asks for reminders that are due, sends each one, then marks it done or moves it to the next day. Plain code, so it never misreads anything." },
};

type Note = [title: string, text: string];

const firing = (s: RemState) => s.reminders.find((r) => r.id === s.firing);

const NOTES: Record<RemEventType, (f: RemFrame) => Note> = {
  ready: (f) => ["Ready", `It's ${when(f.state.now)} in Kathmandu. Send the bot a message.`],
  "message.in": (f) => ["A message arrives", `“${f.state.chat.filter((l) => l.from === "you").slice(-1)[0]?.text}”. ` + "It also opens the 24-hour window, until " + when(f.state.now + 24 * 60) + "."],
  webhook: () => ["Webhook", "WhatsApp POSTs the message to your server as JSON. The server checks the X-Hub-Signature-256 header, answers 200 at once, and carries on."],
  "ai.parsed": (f) => ["The model reads it", `${promptClock(f.state)} Return {task, at, repeat}. The model resolves the words against that clock.`],
  "ai.unclear": () => ["No time in it", "The model returns at: null rather than guessing. The schema allowed it to, and the prompt asked it to."],
  asked: () => ["The bot asks", "A short question back. Still within the window, so a free-form reply is fine."],
  saved: (f) => {
    const r = f.state.reminders[f.state.reminders.length - 1];
    if (!r) return ["Saved", ""];
    return r.due !== r.intended
      ? [`Saved for ${when(r.due)}`, `The model returned ${f.state.parsed?.at} in UTC, which is ${clock(r.due)} in Kathmandu. The user said ${clock(r.intended)}. The row is wrong, and nothing will notice until it fires.`]
      : [`Saved for ${when(r.due)}`, `A row: “${r.task}”${r.repeat ? ", every day" : ""}. From here on it's data.`];
  },
  confirmed: (f) => ["Confirmed", `“${f.state.chat[f.state.chat.length - 1]?.text}” Repeating the time back is the user's only chance to catch a mistake.`],
  clock: (f) => [`${when(f.state.now)}`, "Time passes. The scheduler wakes, as it does every minute."],
  due: (f) => [`Due: ${firing(f.state)?.task}`, "One row is due. Note that no model is called: the decision was made when the reminder was saved."],
  "window.open": (f) => ["Inside the 24-hour window", `The user last wrote ${Math.round(((f.state.now - (f.state.lastIn ?? 0)) / 60) * 10) / 10} hours ago, so a free-form message is allowed.`],
  "window.closed": (f) => ["Outside the 24-hour window", `The user last wrote ${Math.round(((f.state.now - (f.state.lastIn ?? 0)) / 60) * 10) / 10} hours ago. Only a pre-approved template message can be sent now. ${f.state.template === "on" ? `The bot uses ${TEMPLATE}.` : "The bot has none."}`],
  delivered: (f) => (f.state.api?.type === "template"
    ? ["Delivered as a template", `${TEMPLATE}, with the task filled in. WhatsApp reviewed this wording in advance, so it may start a conversation.`]
    : ["Delivered", (() => { const r = firing(f.state); return r && r.due !== r.intended ? `At ${clock(r.due)}. The user wanted ${clock(r.intended)}: the timezone was decided hours ago, in the prompt.` : `“${f.state.api?.text}” arrives on time.`; })()]),
  rejected: () => ["Not delivered: error 131047", "WhatsApp reports the message as failed: more than 24 hours since the user last replied. The phone shows nothing. Unless the server checks status webhooks, nobody knows."],
  rescheduled: (f) => {
    const r = firing(f.state);
    return r?.repeat ? ["Next: tomorrow", `The row moves to ${when(r.due)}. Same time, no new AI call.`] : ["Done", "The row is marked done, so it never fires twice."];
  },
  "config.changed": ({ patch = {} }) => (patch.tz
    ? [patch.tz === "user" ? "The prompt says Asia/Kathmandu" : "The prompt says UTC", patch.tz === "user" ? "Times are read in the user's zone." : `The server's clock: ${OFFSET / 60} hours behind the user, as most servers are.`]
    : [patch.template === "on" ? "Template approved" : "No template", patch.template === "on" ? "Outside the window, the bot sends " + TEMPLATE + "." : "Outside the window, the bot can only try free text."]),
};

export const describe = (frame: RemFrame): Note => NOTES[frame.type](frame);

// The latest call to the WhatsApp API, as the server would make it.
export const apiCall = (s: RemState): string[] => {
  if (!s.api) return ["(nothing sent yet)"];
  const body = s.api.type === "template"
    ? { messaging_product: "whatsapp", to: s.api.to, type: "template", template: { name: TEMPLATE, language: { code: "en" }, components: [{ type: "body", parameters: [{ type: "text", text: s.api.task }] }] } }
    : { messaging_product: "whatsapp", to: s.api.to, type: "text", text: { body: s.api.text } };
  const lines = ["POST /{version}/{phone-number-id}/messages", ...JSON.stringify(body, null, 2).split("\n")];
  return s.api.status === "failed" ? [...lines, "", "status webhook: failed", "  error 131047: more than 24 hours since the customer last replied"] : [...lines, "", "status webhook: sent → delivered"];
};

export const windowLine = (s: RemState) => (s.lastIn === null ? "Window: closed (the user hasn't written yet)" : inWindow(s, s.now) ? `Window: open until ${when(s.lastIn + 24 * 60)}` : `Window: closed since ${when(s.lastIn + 24 * 60)}`);
