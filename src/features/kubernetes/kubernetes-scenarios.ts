import * as engine from "./kubernetes-engine";
import type { K8sAction, K8sFrame, K8sState, Version, WorkerId } from "./kubernetes-types";

// The named moves a visitor or scenario can make. Each one only changes what
// the API server holds; the control loops do the rest on later ticks.
export const ACTIONS = {
  scale: (n: number): K8sAction => (s) => engine.scale(s, n),
  scaleBy: (d: number): K8sAction => (s) => engine.scale(s, s.desired + d),
  image: (v: Version): K8sAction => (s) => engine.setImage(s, v),
  undo: (): K8sAction => engine.undo,
  deletePod: (name?: string): K8sAction => (s) => engine.deletePod(s, name),
  fail: (id: WorkerId): K8sAction => (s) => engine.failNode(s, id),
  restore: (id: WorkerId): K8sAction => (s) => engine.restoreNode(s, id),
};

type Scenario = {
  label: string;
  title: string;
  lesson: string;
  replicas: number;
  play: K8sAction;   // what you watch; the control loops take it from there
};

export const SCENARIOS = {
  heal: {
    label: "1", title: "Self-healing",
    lesson: "Three replicas are running and a pod is deleted. Nobody tells Kubernetes to replace it. The Deployment controller just sees two where the spec says three.",
    replicas: 3, play: ACTIONS.deletePod(),
  },
  node: {
    label: "2", title: "Node failure",
    lesson: "node2 loses power. It can't report that, so at first nothing happens, and its pod still counts as ready while serving nothing. Watch the gap between “Ready” and “Serving”.",
    replicas: 3, play: ACTIONS.fail("node2"),
  },
  scale: {
    label: "3", title: "Out of room",
    lesson: "Ten replicas are asked for, and the three nodes hold three pods each. The scheduler places nine. The tenth stays Pending until there's room: add room, or ask for less.",
    replicas: 3, play: ACTIONS.scale(10),
  },
  rollout: {
    label: "4", title: "Rolling update",
    lesson: "The image changes from v1 to v2. One new pod at a time, and an old one goes only once a new one is ready. Ready never drops below three.",
    replicas: 3, play: ACTIONS.image("v2"),
  },
  broken: {
    label: "5", title: "Bad rollout",
    lesson: "v3 points at an image that doesn't exist. The first new pod can't start, so no old pod is removed and the rollout just stops. Users never notice. Roll back to clean up.",
    replicas: 3, play: ACTIONS.image("v3"),
  },
} satisfies Record<string, Scenario>;

export type ScenarioId = keyof typeof SCENARIOS;

export const readyFrame = (state: K8sState): K8sFrame => ({ type: "ready", state, packets: [], dur: 1 });

// Every scenario starts from a cluster that has already converged.
export const steady = (replicas = 3) => engine.converge(engine.createState({ desired: replicas }));

export const buildScenario = (id: ScenarioId) => {
  const sc: Scenario = SCENARIOS[id];
  const state = steady(sc.replicas);
  return { state, frames: sc.play(state) ?? [] };
};
