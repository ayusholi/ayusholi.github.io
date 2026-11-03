import * as engine from "./agents-engine";
import type { AgentsAction, AgentsConfig, AgentsFrame, AgentsState, TaskId } from "./agents-types";

// The named moves a visitor or scenario can make.
export const ACTIONS = {
  assign: (task: TaskId): AgentsAction => (s) => engine.assign(s, task),
  approve: (): AgentsAction => engine.approve,
  deny: (): AgentsAction => engine.deny,
};

type Scenario = {
  label: string;
  title: string;
  lesson: string;
  options: AgentsConfig;
  play: AgentsAction[];
};

export const SCENARIOS = {
  tool: {
    label: "A", title: "One tool call",
    lesson: "The model can't check the weather. It can ask for a tool by name, and the runtime runs it and pastes the result into the transcript. Then the model is called again, with that result in front of it.",
    options: {}, play: [ACTIONS.assign("weather")],
  },
  chain: {
    label: "B", title: "Chained steps",
    lesson: "Each result decides the next step. The forecast says rain, so the model asks for an email. Nobody wrote “if rain then email” anywhere: the model chose it from the task.",
    options: {}, play: [ACTIONS.assign("hike")],
  },
  approval: {
    label: "C", title: "Approval",
    lesson: "Reading the weather is harmless. Sending email isn't, so the runtime holds that call until a person approves it. Approve or deny it on the right: either way, the model is told and carries on.",
    options: { approval: "ask" }, play: [ACTIONS.assign("hike")],
  },
  injection: {
    label: "D", title: "Prompt injection",
    lesson: "The review page hides a line addressed to AI assistants. To the model it's just more text in its context, so it follows it and emails 214 people. Switch on “Ask first” and run the task again.",
    options: {}, play: [ACTIONS.assign("research")],
  },
  runaway: {
    label: "E", title: "Runaway loop",
    lesson: "“The cheapest possible” is never satisfied, so the model keeps searching. Each step resends the whole growing transcript. The runtime's step budget is the only thing that stops it.",
    options: { limit: "4" }, play: [ACTIONS.assign("loop")],
  },
} satisfies Record<string, Scenario>;

export type ScenarioId = keyof typeof SCENARIOS;

export const readyFrame = (state: AgentsState): AgentsFrame => ({ type: "ready", state, packets: [], dur: 1 });

export const baseline = (options: AgentsConfig = {}) => engine.createState(options);

export const buildScenario = (id: ScenarioId) => {
  const sc: Scenario = SCENARIOS[id];
  const state = baseline(sc.options);
  return { state, frames: engine.runAll(state, ...sc.play).frames };
};
