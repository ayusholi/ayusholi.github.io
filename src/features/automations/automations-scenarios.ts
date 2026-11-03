import * as engine from "./automations-engine";
import type { AutoAction, AutoConfig, AutoFrame, AutoState, EmailId } from "./automations-types";

// The named moves a visitor or scenario can make.
export const ACTIONS = {
  receive: (email: EmailId): AutoAction => (s) => engine.receive(s, email),
  redeliver: (): AutoAction => engine.redeliver,
};

type Scenario = {
  label: string;
  title: string;
  lesson: string;
  options: AutoConfig;
  play: AutoAction[];
};

export const SCENARIOS = {
  one: {
    label: "A", title: "One email",
    lesson: "An email arrives and starts an execution. The AI node reads free text and returns fields as JSON. The switch routes on them like any other data: log the order, reply to the customer.",
    options: {}, play: [ACTIONS.receive("order")],
  },
  triage: {
    label: "B", title: "Triage",
    lesson: "Three emails, three executions, three paths. The AI only labels them. Deciding what each label does was written once, as ordinary branches anyone can read.",
    options: {}, play: [ACTIONS.receive("order"), ACTIONS.receive("complaint"), ACTIONS.receive("spam")],
  },
  broken: {
    label: "C", title: "Bad output",
    lesson: "A messy forwarded email, and the model replies with chatty, half-finished JSON. The parser rejects it and, set to stop on error, the execution fails. Nobody logs the order or replies.",
    options: { onError: "stop" }, play: [ACTIONS.receive("messy")],
  },
  retry: {
    label: "D", title: "Auto-fix",
    lesson: "The same email with retry on. The parser's error goes back to the model with a request to fix its output, and the second reply is valid. It costs a second AI call.",
    options: { onError: "retry" }, play: [ACTIONS.receive("messy")],
  },
  duplicate: {
    label: "E", title: "Fired twice",
    lesson: "The trigger delivers the same email twice, as polling and retried webhooks do. Without dedupe, the order is logged twice and the customer gets two replies. Turn dedupe on and press “Trigger fires again”.",
    options: {}, play: [ACTIONS.receive("order"), ACTIONS.redeliver()],
  },
} satisfies Record<string, Scenario>;

export type ScenarioId = keyof typeof SCENARIOS;

export const readyFrame = (state: AutoState): AutoFrame => ({ type: "ready", state, packets: [], dur: 1 });

export const baseline = (options: AutoConfig = {}) => engine.createState(options);

export const buildScenario = (id: ScenarioId) => {
  const sc: Scenario = SCENARIOS[id];
  const state = baseline(sc.options);
  return { state, frames: engine.runAll(state, ...sc.play).frames };
};
