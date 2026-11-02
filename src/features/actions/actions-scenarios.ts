import * as engine from "./actions-engine";
import type { ActionsAction, ActionsFrame, ActionsState, Trigger } from "./actions-types";

// The named moves a visitor or scenario can make. Each one is an event; the
// runners and the scheduler take it from there on later ticks.
export const ACTIONS = {
  push: (t: Partial<Trigger> = {}): ActionsAction => (s) => engine.trigger(s, { event: "push", ref: "main", ...t }),
  pr: (t: Partial<Trigger> = {}): ActionsAction => (s) => engine.trigger(s, { event: "pull_request", ref: "feature/search", ...t }),
  capacity: (n: number): ActionsAction => (s) => engine.configure(s, n),
};

type Scenario = {
  label: string;
  title: string;
  lesson: string;
  setup?: (s: ActionsState) => ActionsState;   // runs off-screen
  play: ActionsAction;
};

export const SCENARIOS = {
  push: {
    label: "1", title: "Push to main",
    lesson: "One push, one run, four jobs. The two test jobs are a matrix and run side by side. build waits for both, deploy waits for build, and every job starts on a fresh machine.",
    play: ACTIONS.push(),
  },
  pr: {
    label: "2", title: "Pull request",
    lesson: "The same workflow runs on a pull request, but deploy has an if: that only allows main. It's skipped, not failed, and the checks on the PR still go green.",
    play: ACTIONS.pr(),
  },
  fail: {
    label: "3", title: "Failing test",
    lesson: "npm test fails on one leg of the matrix. fail-fast cancels the other, and build and deploy are skipped because a job they need didn't succeed.",
    play: ACTIONS.push({ failing: true }),
  },
  concurrency: {
    label: "4", title: "Two pushes",
    lesson: "A run is in progress when another push lands on main. The concurrency group cancels the older run. Without it, both would deploy, possibly in the wrong order.",
    setup: (s) => engine.ticks(engine.lastState(engine.trigger(s), s), 4),
    play: ACTIONS.push(),
  },
  cache: {
    label: "5", title: "New dependency",
    lesson: "This commit changes package-lock.json, so the cache key changes and both test jobs miss. npm ci takes three times as long, then the cache is saved, and build, which starts later, hits. Push again: everything hits.",
    play: ACTIONS.push({ deps: true }),
  },
} satisfies Record<string, Scenario>;

export type ScenarioId = keyof typeof SCENARIOS;

export const readyFrame = (state: ActionsState): ActionsFrame => ({ type: "ready", state, packets: [], dur: 1 });

export const buildScenario = (id: ScenarioId) => {
  const sc: Scenario = SCENARIOS[id];
  const state = sc.setup ? sc.setup(engine.createState()) : engine.createState();
  return { state, frames: sc.play(state) ?? [] };
};
