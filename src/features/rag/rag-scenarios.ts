import * as engine from "./rag-engine";
import type { QuestionId, RagAction, RagConfig, RagFrame, RagState } from "./rag-types";

// The named moves a visitor or scenario can make.
export const ACTIONS = {
  ask: (question: QuestionId): RagAction => (s) => engine.ask(s, question),
  reindex: (): RagAction => engine.reindex,
  updatePolicy: (): RagAction => engine.updatePolicy,
};

type Scenario = {
  label: string;
  title: string;
  lesson: string;
  options: RagConfig;
  empty?: boolean;           // start before anything is indexed
  play: RagAction[];
};

export const SCENARIOS = {
  grounded: {
    label: "A", title: "Grounded answer",
    lesson: "First the shop's documents are split into chunks and each becomes a vector. A question becomes a vector too, the closest chunks are pasted into the prompt, and the model answers from them, with a source.",
    options: {}, empty: true, play: [ACTIONS.reindex(), ACTIONS.ask("return")],
  },
  bare: {
    label: "B", title: "No retrieval",
    lesson: "The same question with retrieval off. The model has never seen this shop's policy, so it answers with what's typical. It sounds right, has no source, and isn't this shop's answer.",
    options: { retrieval: "off" }, play: [ACTIONS.ask("return")],
  },
  meaning: {
    label: "C", title: "Words vs meaning",
    lesson: "“Money back” and “refunds reach your card” share no words, so keyword search finds nothing. Switch search to vectors and ask again: the meanings sit close together.",
    options: { mode: "keyword" }, play: [ACTIONS.ask("refund")],
  },
  stale: {
    label: "D", title: "Stale index",
    lesson: "The returns window just changed to 14 days, but nobody re-indexed. The search still finds the old chunk, and the model faithfully quotes an outdated policy. Press “Re-index”, then ask again.",
    options: {}, play: [ACTIONS.updatePolicy(), ACTIONS.ask("return")],
  },
  missing: {
    label: "E", title: "Not in the docs",
    lesson: "Nothing in the documents is about kayaks, so nothing passes the relevance threshold, and the prompt tells the model to say so. Turn retrieval off and ask again to see what it says instead.",
    options: {}, play: [ACTIONS.ask("kayak")],
  },
} satisfies Record<string, Scenario>;

export type ScenarioId = keyof typeof SCENARIOS;

export const readyFrame = (state: RagState): RagFrame => ({ type: "ready", state, packets: [], dur: 1 });

// The shop's documents, already indexed.
export const baseline = (options: RagConfig = {}) => ({ ...engine.runAll(engine.createState(), ACTIONS.reindex()).state, ...options });

export const buildScenario = (id: ScenarioId) => {
  const sc: Scenario = SCENARIOS[id];
  const state = sc.empty ? engine.createState(sc.options) : baseline(sc.options);
  return { state, frames: engine.runAll(state, ...sc.play).frames };
};
