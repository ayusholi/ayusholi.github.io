"use client";

import { Challenge } from "@/components/ui/Challenge";
import { reducedMotion, useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useMcp } from "./McpProvider";
import { toolPrompt } from "./mcp-content";
import { createState, runAll } from "./mcp-engine";
import { ACTIONS } from "./mcp-scenarios";

const watch = (run: () => void) => () => {
  run();
  document.getElementById("bench")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
};

// The latest JSON-RPC message, exactly as it went over the wire.
export const McpMessage = () => {
  const { timeline } = useMcp();
  const { state } = useTimelineFrame(timeline);
  const last = state.rpc[state.rpc.length - 1];
  return (
    <pre className="cli" id="message" tabIndex={0} aria-label="The latest JSON-RPC message">
      <span className="dim">{last ? `${last.dir === "→" ? "host → " : "host ← "}${last.server}` : "$ (no messages yet)"}</span>
      {last ? `\n${JSON.stringify(JSON.parse(last.json), null, 2)}` : ""}
    </pre>
  );
};

// What the model is told about its tools: only what tools/list returned.
export const McpToolPrompt = () => {
  const { timeline } = useMcp();
  const { state } = useTimelineFrame(timeline);
  return (
    <pre className="cli" id="tool-prompt" tabIndex={0} aria-label="The tools section of the model's prompt">
      <span className="dim">$ prompt --tools</span>{`\n${toolPrompt(state).join("\n")}`}
    </pre>
  );
};

// The conversation, including the tool results the user never sees.
export const McpChat = () => {
  const { timeline } = useMcp();
  const { state } = useTimelineFrame(timeline);
  const lines = state.chat.length ? state.chat.map((l) => (l.role === "tool" ? `  [${l.tool}${l.isError ? ", isError" : ""}] ${l.text}` : `${l.role === "user" ? "You" : "Assistant"}: ${l.text}`)) : ["(no question yet)"];
  return (
    <pre className="cli" id="chat" tabIndex={0} aria-label="The conversation, with tool results">
      <span className="dim">$ conversation</span>{`\n${lines.join("\n")}`}
    </pre>
  );
};

// Answers are computed by running the question through the engine.
export const McpChallenges = () => {
  const { runScenario } = useMcp();
  return (
    <>
      <Challenge
        id="challenge"
        question="A host connects a files server and a calendar server. The model asks to call list_events. Who sends the request to the calendar server?"
        options={["The model, using the server's URL.", "The host, through the MCP client it opened for that server.", "The files server forwards it."]}
        answer={1}
        verdict={() => {
          const s = runAll(createState(), ACTIONS.connect("files"), ACTIONS.connect("calendar"), ACTIONS.ask("free")).state;
          const call = s.rpc.find((r) => r.json.includes("tools/call"));
          return `The simulation's tools/call goes to ${call?.server ?? "?"}, sent by the host. The model only ever produces a request naming the tool: it holds no connections, credentials or URLs. The host keeps ${s.stats.servers} clients, one per server, and knows which listed which of the ${s.stats.tools} tools.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("two")) }}
      />
      <Challenge
        id="challenge-2"
        className="mt-11"
        question="The model asks for read_file on a file that doesn't exist. What does it get back?"
        options={["Nothing: the call throws and the conversation ends.", "A normal result marked isError: true, which it can read and react to.", "An empty string, as if the file were blank."]}
        answer={1}
        verdict={() => {
          const s = runAll(createState(), ACTIONS.connect("files"), ACTIONS.ask("missing")).state;
          return `The server returns a result with isError: true and the message “ENOENT: no such file”. The model reads it like any other text and tries something else: ${s.stats.toolCalls} tool calls, ${s.stats.toolErrors} of them an error, and then a useful answer. Tool failures are information for the model; protocol errors are for the host.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("error")) }}
      />
    </>
  );
};
