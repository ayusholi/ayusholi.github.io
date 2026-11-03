// The workflow's words, kept apart from its logic. `describe` narrates a frame from
// the state that frame holds, so the caption can't disagree with the simulation.
import { EMAILS } from "./automations-engine";
import type { AutoEventType, AutoFrame, AutoNodeId } from "./automations-types";

export const ROLES: Record<AutoNodeId, { name: string; sub: string; role: string }> = {
  trigger: { name: "Email trigger", sub: "Starts an execution", role: "Watches an inbox, by polling or a webhook, and starts one execution per new message, handing the next node an item: the email as JSON. Triggers can fire twice for the same message." },
  ai: { name: "AI: classify", sub: "Text → fields", role: "Sends the email to a model with instructions and a JSON schema, then parses the reply. This is the only node whose output isn't guaranteed: it has to be checked like user input." },
  router: { name: "Switch", sub: "Routes on category", role: "Ordinary branching on a field of the item, like {{ $json.category }}. The AI decides the label; the workflow decides what each label means." },
  sheet: { name: "Sheet", sub: "Append a row", role: "Writes the order to a spreadsheet or database. Writing is a side effect: run it twice and you get two rows." },
  chat: { name: "Team chat", sub: "Alert a person", role: "Posts to a channel so a person handles it. Upset customers and anything with money involved are better routed to people than answered automatically." },
  reply: { name: "Auto-reply", sub: "Email the customer", role: "Sends a templated reply that uses fields from the item. Another side effect: it can't be unsent, and a duplicate execution sends a duplicate email." },
};

type Note = [title: string, text: string];

const email = (f: AutoFrame) => {
  const e = f.state.executions[f.state.executions.length - 1];
  return e ? EMAILS[e.email] : null;
};

const NOTES: Record<AutoEventType, (f: AutoFrame) => Note> = {
  ready: () => ["Ready", "The workflow is active. Send it an email."],
  triggered: (f) => [`Execution ${f.state.stats.executions} starts`, `“${email(f)?.subject}” from ${email(f)?.from}. The trigger turns it into an item: JSON that every later node can read.`],
  "duplicate.skipped": (f) => ["Duplicate, skipped", `${f.state.last?.messageId} was handled already. The workflow checks the message id before doing anything.`],
  "ai.called": () => ["The AI node runs", "The email goes to the model with a prompt and a schema: return category, orderId and urgent, as JSON."],
  "ai.invalid": (f) => ["The reply isn't valid JSON", `“${f.state.raw}”. The parser rejects it, and the workflow has to decide what happens next.`],
  "ai.retried": () => ["Asked again, with the error", "The parser's message goes back to the model: your output didn't match the schema, fix it. The second reply parses."],
  "ai.output": (f) => [`Classified: ${f.state.item?.category}`, `${JSON.stringify({ category: f.state.item?.category, orderId: f.state.item?.orderId, urgent: f.state.item?.urgent })}. From here on it's plain data.`],
  routed: (f) => (f.state.item?.category === "complaint"
    ? ["Routed to a person", "A complaint marked urgent goes to the team channel. No automatic reply: someone should read this one."]
    : [`Routed to the ${f.state.item?.category} branch`, "The switch reads one field. No AI involved in this decision."]),
  dropped: () => ["Spam: nothing happens", "The switch has no branch for it, so the execution ends here. Ending quietly is a valid route."],
  "row.added": (f) => [`Row added for #${f.state.item?.orderId}`, f.state.stats.rows > 1 && f.state.rows.filter((r) => r.orderId === f.state.item?.orderId).length > 1 ? "Again. The sheet now has this order twice." : "The order is logged for the team."],
  "alert.posted": () => ["Alert posted", "A person takes it from here."],
  "reply.sent": (f) => [`Reply sent to ${email(f)?.from}`, f.state.replies.filter((r) => r === email(f)?.from).length > 1 ? "The customer has now had the same reply twice." : "“We've got your message about order #" + (f.state.item?.orderId ?? "") + " and we're on it.”"],
  "execution.done": (f) => [`Execution ${f.state.executions[f.state.executions.length - 1]?.n} succeeded`, `Path: ${f.state.executions[f.state.executions.length - 1]?.path.join(" → ")}.`],
  "execution.failed": () => ["Execution failed", "Set to stop on error, the workflow halts. The email is marked handled, but nothing was logged and nobody replied: unless someone checks failed executions, it's lost."],
  "config.changed": ({ patch = {} }) => (patch.onError
    ? [patch.onError === "retry" ? "On error: retry with the error" : "On error: stop", patch.onError === "retry" ? "Invalid AI output is sent back to be fixed, once." : "Invalid AI output fails the execution."]
    : [patch.dedupe === "on" ? "Dedupe on" : "Dedupe off", patch.dedupe === "on" ? "Message ids already handled are skipped." : "Every delivery runs, even a repeat."]),
};

export const describe = (frame: AutoFrame): Note => NOTES[frame.type](frame);

// The workflow as an editor would show it, top to bottom.
export const WORKFLOW = [
  "Email trigger   on new message         → { from, subject, body }",
  "AI: classify    model + JSON schema    → { category, orderId, urgent }",
  "Switch          {{ $json.category }}",
  "  order       → Sheet: append row → Reply: “We're on it”",
  "  complaint   → Team chat: alert a person",
  "  spam        → (end)",
];

export const WORKFLOW_LINE: Partial<Record<AutoNodeId, number>> = { trigger: 0, ai: 1, router: 2, sheet: 3, reply: 3, chat: 4 };
