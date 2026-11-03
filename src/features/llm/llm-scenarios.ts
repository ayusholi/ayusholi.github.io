import * as engine from "./llm-engine";
import type { LlmAction, LlmConfig, LlmFrame, LlmState, PromptId } from "./llm-types";

// The named moves a visitor or scenario can make.
export const ACTIONS = {
  submit: (prompt: PromptId): LlmAction => (s) => engine.submit(s, prompt),
  step: (): LlmAction => engine.step,
  complete: (): LlmAction => engine.complete,
};

type Scenario = {
  label: string;
  title: string;
  lesson: string;
  options: LlmConfig;
  play: LlmAction[];
};

export const SCENARIOS = {
  next: {
    label: "A", title: "Next token",
    lesson: "The model never writes a sentence. It scores every possible next token, one is picked, it's appended, and the whole context goes through again. “Paris.” takes three passes.",
    options: {}, play: [ACTIONS.submit("capital"), ACTIONS.complete()],
  },
  temperature: {
    label: "B", title: "Temperature",
    lesson: "Same prompt, same model, same probabilities. At temperature 1.5 the sampler flattens the odds and draws a less likely token, and every later token follows from that choice.",
    options: { temperature: "1.5", seed: 4 }, play: [ACTIONS.submit("capital"), ACTIONS.complete()],
  },
  recall: {
    label: "C", title: "Recall",
    lesson: "The name was said 26 tokens earlier. It's still inside the window, so the model can copy it: “ name is” appeared before, followed by “Ayu”.",
    options: {}, play: [ACTIONS.submit("name"), ACTIONS.complete()],
  },
  forget: {
    label: "D", title: "Forgetting",
    lesson: "The same conversation with a 16-token window. The start fell off before the model ever ran, so the name isn't there to copy. It answers anyway, with a common name.",
    options: { windowSize: "16" }, play: [ACTIONS.submit("name"), ACTIONS.complete()],
  },
  invent: {
    label: "E", title: "Making it up",
    lesson: "Nothing the model learned covers this champion, so no token stands out: the best scores 24%. It still picks one and carries on fluently. Confidence never shows up in the text.",
    options: {}, play: [ACTIONS.submit("unknown"), ACTIONS.complete()],
  },
} satisfies Record<string, Scenario>;

export type ScenarioId = keyof typeof SCENARIOS;

export const readyFrame = (state: LlmState): LlmFrame => ({ type: "ready", state, packets: [], dur: 1 });

export const baseline = (options: LlmConfig = {}) => engine.createState(options);

export const buildScenario = (id: ScenarioId) => {
  const sc: Scenario = SCENARIOS[id];
  const state = baseline(sc.options);
  return { state, frames: engine.runAll(state, ...sc.play).frames };
};
