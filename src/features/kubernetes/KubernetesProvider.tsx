"use client";

import { createBench } from "@/lib/simulation/createBench";
import { tick } from "./kubernetes-engine";
import { buildScenario, readyFrame, SCENARIOS, steady } from "./kubernetes-scenarios";

// The control loops keep running between actions, as they do in a cluster.
export const { Provider: KubernetesProvider, useBench: useKubernetes } = createBench({
  name: "Kubernetes",
  initial: () => steady(),
  ready: readyFrame,
  scenarios: SCENARIOS,
  first: "heal",
  build: buildScenario,
  generate: tick,
  resetLesson: "A converged cluster: three replicas of web:v1 across three nodes. Change something and watch the loops respond.",
});
