import * as engine from "./mcp-engine";
import type { McpAction, McpConfig, McpFrame, McpState, QuestionId, ServerId } from "./mcp-types";

// The named moves a visitor or scenario can make.
export const ACTIONS = {
  connect: (server: ServerId): McpAction => (s) => engine.connect(s, server),
  ask: (question: QuestionId): McpAction => (s) => engine.ask(s, question),
  approve: (): McpAction => engine.approve,
  deny: (): McpAction => engine.deny,
};

type Scenario = {
  label: string;
  title: string;
  lesson: string;
  options: McpConfig;
  setup?: McpAction[];
  play: McpAction[];
};

export const SCENARIOS = {
  handshake: {
    label: "A", title: "Handshake",
    lesson: "The host starts a files server and its MCP client says hello: initialize, the server's capabilities, initialized. Then tools/list. The model knows nothing about this server until those tool descriptions are put in its prompt.",
    options: {}, play: [ACTIONS.connect("files")],
  },
  call: {
    label: "B", title: "A tool call",
    lesson: "With the files server connected, a question that needs a file. The model can't run anything: it asks for read_file, the host sends tools/call to the server that owns it, and the result goes back into the model's context.",
    options: {}, setup: [ACTIONS.connect("files")], play: [ACTIONS.ask("notes")],
  },
  two: {
    label: "C", title: "Two servers",
    lesson: "A calendar server joins over the same protocol. The host now holds two clients and four tools, and routes each call to the server that listed it. Neither server knows the other exists.",
    options: {}, setup: [ACTIONS.connect("files")], play: [ACTIONS.connect("calendar"), ACTIONS.ask("free")],
  },
  error: {
    label: "D", title: "Tool error",
    lesson: "The file doesn't exist. The server doesn't crash the call: it returns a result with isError: true, which the model reads like any other result. It lists the folder and offers what's there.",
    options: {}, setup: [ACTIONS.connect("files")], play: [ACTIONS.ask("missing")],
  },
  approval: {
    label: "E", title: "Approval",
    lesson: "create_event changes something, so the host stops and asks before sending tools/call. That check lives in the host, not the server or the model. Allow or deny it on the right.",
    options: { approval: "ask" }, setup: [ACTIONS.connect("files"), ACTIONS.connect("calendar")], play: [ACTIONS.ask("book")],
  },
} satisfies Record<string, Scenario>;

export type ScenarioId = keyof typeof SCENARIOS;

export const readyFrame = (state: McpState): McpFrame => ({ type: "ready", state, packets: [], dur: 1 });

export const baseline = (options: McpConfig = {}) => engine.createState(options);

export const buildScenario = (id: ScenarioId) => {
  const sc: Scenario = SCENARIOS[id];
  const state = engine.runAll(baseline(sc.options), ...(sc.setup ?? [])).state;
  return { state, frames: engine.runAll(state, ...sc.play).frames };
};
