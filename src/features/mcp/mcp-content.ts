// The protocol's words, kept apart from its logic. `describe` narrates a frame from
// the state that frame holds, so the caption can't disagree with the simulation.
import { PROTOCOL, QUESTIONS, SERVERS } from "./mcp-engine";
import type { McpEventType, McpFrame, McpNodeId, McpState } from "./mcp-types";

export const ROLES: Record<McpNodeId, { name: string; sub: string; role: string }> = {
  user: { name: "You", sub: "Ask in plain words", role: "Types a question, and approves or refuses anything that would change something on their behalf." },
  host: { name: "Host app", sub: "Chat app or IDE", role: "The AI application: a desktop chat app, an IDE, an agent. It runs one MCP client per server, collects their tools, gives them to the model, and carries out the calls the model asks for. Permissions and approvals are its job." },
  model: { name: "Model", sub: "Picks tools, writes text", role: "Sees the tool names, descriptions and input schemas in its prompt, and can reply with a request to call one. It never talks to a server itself and doesn't know MCP is involved." },
  files: { name: "Files server", sub: "MCP server", role: "A small program that exposes a notes folder as two tools. It speaks JSON-RPC 2.0 over stdio when the host starts it as a local process, or over HTTP when it runs elsewhere." },
  calendar: { name: "Calendar server", sub: "MCP server", role: "A separate server, maybe from a different company, exposing a calendar as tools. The same protocol, so any MCP host can use it without custom code." },
};

type Note = [title: string, text: string];

const last = (f: McpFrame) => f.state.rpc[f.state.rpc.length - 1]?.json ?? "";
const q = (f: McpFrame) => (f.state.question ? QUESTIONS[f.state.question] : null);

const NOTES: Record<McpEventType, (f: McpFrame) => Note> = {
  ready: () => ["Ready", "A host with a model and no servers. The model has no tools at all."],
  spawned: (f) => (f.state.transport === "stdio"
    ? [`Starting ${f.server}`, `The host runs “${SERVERS[f.server ?? "files"].command}” as a child process. Messages go over its stdin and stdout, one JSON object per line.`]
    : [`Connecting to ${f.server}`, `The host POSTs JSON-RPC messages to ${SERVERS[f.server ?? "files"].url}. Same messages, different pipe.`]),
  initialize: () => ["initialize", `The client opens with the protocol version it speaks, ${PROTOCOL}, and its own capabilities. It's a request: it has an id, and the reply will carry the same one.`],
  initialized: (f) => [`${f.server} replies, and the client confirms`, "The server says what it offers (here, tools) and its name and version. The client answers with notifications/initialized: a notification, so it has no id and expects no reply."],
  listed: () => ["tools/list", "The client asks what tools the server has."],
  "tools.received": (f) => [`${f.state.tools.filter((t) => t.server === f.server).length} tools from ${f.server}`, `Each with a name, a description and a JSON Schema for its input. The model now has ${f.state.tools.length} tool${f.state.tools.length === 1 ? "" : "s"} in total.`],
  disconnected: (f) => [`${f.server} disconnected`, "Its tools are gone from the model's prompt. The model can't call what it isn't shown."],
  asked: (f) => ["A question", `“${q(f)?.text}”`],
  "model.called": (f) => (f.tool
    ? ["The result goes back to the model", `It reads what ${f.tool} returned, as text in its context, and decides what to do next.`]
    : ["The model is called", f.state.tools.length ? `The prompt includes ${f.state.tools.length} tool definition${f.state.tools.length === 1 ? "" : "s"}: ${f.state.tools.map((t) => t.name).join(", ")}.` : "No tools in the prompt. It can only answer from what it already knows."]),
  "tool.chosen": (f) => [`The model asks for ${f.tool}`, `Its reply isn't text for you: it's a structured request to call ${f.tool}. The host looks up which server listed it: ${f.server}.`],
  "approval.waiting": (f) => ["Allow this?", `${f.tool} changes something, so the host asks you before anything is sent to ${f.server}. Nothing has happened yet.`],
  approved: () => ["Allowed", "Now the host sends the call."],
  denied: () => ["Denied", "The call is never sent. The model is told you declined, and answers accordingly."],
  "call.sent": (f) => [`tools/call → ${f.server}`, last(f)],
  "call.result": (f) => (f.state.chat[f.state.chat.length - 1]?.isError
    ? ["A result with isError: true", "The tool ran and failed. That's reported as a normal result the model can read and work around, not as a protocol error."]
    : [`${f.server} returns a result`, `content: “${f.state.chat[f.state.chat.length - 1]?.text}”`]),
  answered: (f) => ["The answer", f.state.chat[f.state.chat.length - 1]?.text ?? ""],
  "config.changed": ({ patch = {} }) => (patch.transport
    ? [patch.transport === "stdio" ? "Transport: stdio" : "Transport: Streamable HTTP", patch.transport === "stdio" ? "New servers start as local processes." : "New servers are reached over HTTP."]
    : [patch.approval === "ask" ? "Ask before writes" : "Allow every call", patch.approval === "ask" ? "Tools that change things wait for you." : "The host sends every call the model asks for."]),
};

export const describe = (frame: McpFrame): Note => NOTES[frame.type](frame);

// The tools section of the model's prompt, as the host assembles it.
export const toolPrompt = (s: McpState): string[] => (s.tools.length
  ? s.tools.flatMap((t) => [`${t.name}  (${t.server}${t.write ? ", changes data" : ""})`, `  ${t.description}`, `  input: ${JSON.stringify((t.inputSchema as { properties: object }).properties)}`])
  : ["(no tools: no servers connected)"]);
