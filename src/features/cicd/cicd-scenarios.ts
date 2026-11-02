import * as engine from "./cicd-engine";
import type { CicdAction, CicdConfig, CicdFrame, CicdState, Change } from "./cicd-types";

// The named moves a visitor or scenario can make.
export const ACTIONS = {
  commit: (change: Change): CicdAction => (s) => engine.commit(s, change),
  approve: (): CicdAction => engine.approve,
  rollback: (): CicdAction => engine.rollback,
};

type Scenario = {
  label: string;
  title: string;
  lesson: string;
  options: CicdConfig;
  play: CicdAction[];
};

export const SCENARIOS = {
  green: {
    label: "A", title: "Green path",
    lesson: "A good change. It's built once, tested, published as an artifact, and that exact artifact goes to staging and then production. Nobody copies files to a server.",
    options: {}, play: [ACTIONS.commit("good")],
  },
  red: {
    label: "B", title: "Red build",
    lesson: "This change breaks a unit test. The pipeline stops at the test stage: nothing is published and production never hears about it. That's the cheapest place to fail.",
    options: {}, play: [ACTIONS.commit("breaks-test")],
  },
  escape: {
    label: "C", title: "Bug escapes",
    lesson: "This bug only shows up under real traffic, so every check passes. Deployed to everyone at once, every request fails. Press “Roll back”: the previous artifact is still in the registry.",
    options: {}, play: [ACTIONS.commit("hidden-bug")],
  },
  canary: {
    label: "D", title: "Canary",
    lesson: "The same bug, released to 10% of traffic first. The error rate there gives it away, the release is aborted, and 90% of users never saw it.",
    options: { strategy: "canary" }, play: [ACTIONS.commit("hidden-bug")],
  },
  gate: {
    label: "E", title: "Approval",
    lesson: "Continuous delivery: everything up to production is automatic, and a person decides when to release. The run waits at the gate until you approve it.",
    options: { gate: "manual" }, play: [ACTIONS.commit("good")],
  },
} satisfies Record<string, Scenario>;

export type ScenarioId = keyof typeof SCENARIOS;

export const readyFrame = (state: CicdState): CicdFrame => ({ type: "ready", state, packets: [], dur: 1 });

// Production already runs a good release, so there's something to roll back to.
export const baseline = (options: CicdConfig = {}) => ({ ...engine.runAll(engine.createState(), ACTIONS.commit("good")).state, ...options });

export const buildScenario = (id: ScenarioId) => {
  const sc: Scenario = SCENARIOS[id];
  const state = baseline(sc.options);
  return { state, frames: engine.runAll(state, ...sc.play).frames };
};
