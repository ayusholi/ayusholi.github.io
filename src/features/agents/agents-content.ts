// The agent's words, kept apart from its logic. `describe` narrates a frame from
// the state that frame holds, so the caption can't disagree with the simulation.
import { messageText, TASKS, tokensOf } from "./agents-engine";
import type { AgentsEventType, AgentsFrame, AgentsNodeId, Message, ToolId } from "./agents-types";

export const ROLES: Record<AgentsNodeId, { name: string; sub: string; role: string }> = {
  user: { name: "You", sub: "Gives the task", role: "Sets the goal, and approves anything the runtime is configured to hold. Sees the final answer, and only the steps the app chooses to show." },
  runtime: { name: "Agent runtime", sub: "The loop", role: "Ordinary code around the model: it keeps the transcript, sends it to the model, runs whatever tool the model asks for, and decides when to stop. Every safety rule lives here, not in the model." },
  model: { name: "LLM", sub: "Decides the next step", role: "Reads the whole transcript and replies with either a final answer or a tool call: a tool name and arguments, as structured text. It can't run anything itself." },
  weather: { name: "get_weather", sub: "Read-only", role: "A tool: a function with a name, a description and typed arguments that the model was shown. It returns data and changes nothing, so it's safe to run without asking." },
  web: { name: "fetch_page · search", sub: "Read-only, untrusted", role: "Returns text from the internet. Whatever it brings back goes into the model's context, including text written by strangers to look like instructions." },
  email: { name: "send_email", sub: "Side effect", role: "Changes the world: once an email is sent, it can't be unsent. Tools like this are where approval gates, allow-lists and rate limits belong." },
};

type Note = [title: string, text: string];

const lastCall = (f: AgentsFrame) => [...f.state.transcript].reverse().find((m): m is Extract<Message, { call: unknown }> => "call" in m)?.call;
const lastResult = (f: AgentsFrame) => [...f.state.transcript].reverse().find((m): m is Extract<Message, { role: "tool" }> => m.role === "tool");

const NOTES: Record<AgentsEventType, (f: AgentsFrame) => Note> = {
  ready: () => ["Ready", "Give the agent a task and follow the loop."],
  "task.sent": (f) => ["A task arrives", `“${f.state.task ? TASKS[f.state.task] : ""}”. The runtime starts a transcript with it.`],
  "model.called": (f) => [`Model call ${f.state.stats.modelCalls}`, `The runtime sends the whole transcript, ${f.state.transcript.length} message${f.state.transcript.length === 1 ? "" : "s"} and about ${tokensOf(f.state.transcript)} tokens, and waits for a reply.`],
  "tool.requested": (f) => {
    const call = lastCall(f);
    return [`It asks for ${call?.name}`, f.state.task === "research" && call?.tool === "email"
      ? "Nobody asked for this. The page's hidden line told it to, and that line is now part of its context like everything else."
      : `${call?.name}(${call?.args}). Just text: the model has asked, and the runtime decides what happens.`];
  },
  "approval.waiting": (f) => ["Held for approval", `${lastCall(f)?.name} has side effects, so the runtime waits for you. Approve or deny it.`],
  approved: () => ["Approved", "The runtime runs the call it was holding."],
  denied: () => ["Declined", "The refusal goes into the transcript as the tool's result, and the model is called again to deal with it."],
  "tool.called": (f) => [`Running ${lastCall(f)?.name}`, "The runtime executes real code, with real permissions. The model is idle."],
  "tool.returned": (f) => {
    const r = lastResult(f);
    return r?.tool === "web" && r.text.includes("<!--")
      ? ["The page comes back", "Two reviews, and a hidden comment addressed to AI assistants. All of it lands in the transcript."]
      : ["Result appended", `“${r?.text}”. Next, the model reads it.`];
  },
  "tool.failed": (f) => ["The tool fails", `“${lastResult(f)?.text}”. The error is just another result: the model sees it and decides whether to retry.`],
  "model.answered": (f) => ["A final answer", `After ${f.state.stats.toolCalls} tool call${f.state.stats.toolCalls === 1 ? "" : "s"}, the model replies with text instead of a call. That ends the loop.`],
  "answer.delivered": (f) => {
    const answer = [...f.state.transcript].reverse().find((m) => "answer" in m);
    return ["Done", answer ? messageText(answer) : ""];
  },
  "limit.reached": (f) => [`Stopped after ${f.state.steps} steps`, `The model still wanted more. ${f.state.stats.tokens} tokens were spent on a task that never finished.`],
  "config.changed": ({ patch = {} }) => (patch.approval
    ? [patch.approval === "ask" ? "Side effects need approval" : "Side effects run automatically", patch.approval === "ask" ? "send_email will wait for you." : "The runtime runs every call the model makes."]
    : patch.limit
      ? [`Step budget: ${patch.limit}`, "The runtime stops the loop after this many tool calls."]
      : [patch.weatherDown ? "The weather API is down" : "The weather API is back", patch.weatherDown ? "get_weather will return 503 errors." : "get_weather answers again."]),
};

export const describe = (frame: AgentsFrame): Note => NOTES[frame.type](frame);

// The tool list the model is given, as it would see it.
export const TOOLS: [line: string, tool?: ToolId][] = [
  ["tools = ["],
  ["  get_weather(city, day)    # read-only", "weather"],
  ["  fetch_page(url)           # returns untrusted text", "web"],
  ["  web_search(query)         # returns untrusted text", "web"],
  ["  send_email(to, subject)   # side effect", "email"],
  ["]"],
  ["loop: call model → run tool → append → repeat"],
];
