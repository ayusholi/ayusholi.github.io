"use client";

import { Challenge } from "@/components/ui/Challenge";
import { reducedMotion, useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useKubernetes } from "./KubernetesProvider";
import { eventTable, LOOP, LOOP_LINES, podTable } from "./kubernetes-content";
import { converge, failNode, lastState, live, reportedReady, serving, setImage, tick } from "./kubernetes-engine";
import { steady } from "./kubernetes-scenarios";

const watch = (run: () => void) => () => {
  run();
  document.getElementById("bench")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
};

// The reconcile loop follows the simulation: the part acting now is lit.
export const KubernetesLoop = () => {
  const { timeline } = useKubernetes();
  const frame = useTimelineFrame(timeline);
  const lines = LOOP_LINES[frame.type] ?? [];
  return (
    <pre className="code" id="loop" tabIndex={0} aria-label="The reconcile loop. The highlighted line follows the simulation.">
      <code>{LOOP.map((text, i) => <span key={i} className={`ln${lines.includes(i + 1) ? " is-now" : ""}${text.startsWith("//") ? " ln--note" : ""}`}>{text}</span>)}</code>
    </pre>
  );
};

export const KubernetesCli = () => {
  const { timeline } = useKubernetes();
  const { state } = useTimelineFrame(timeline);
  const { head, rows } = podTable(state);
  return (
    <pre className="cli" id="cli" tabIndex={0} aria-label="Pods and recent events">
      <span className="dim">$ kubectl get pods -o wide</span>{`\n${head}\n${rows.join("\n")}\n\n`}
      <span className="dim">$ kubectl get events</span>{`\n${eventTable(state).join("\n") || "(none)"}`}
    </pre>
  );
};

// Answers are computed by running the question through the engine.
export const KubernetesChallenges = () => {
  const { runScenario } = useKubernetes();
  return (
    <>
      <Challenge
        id="challenge"
        question="A Deployment runs three replicas. You update it to an image tag that doesn't exist. What do users see?"
        options={["Errors, as each old pod is replaced by one that can't start.", "Nothing. The old pods keep serving and the rollout stalls.", "Kubernetes rejects the change before it's applied."]}
        answer={1}
        verdict={() => {
          const s = converge(lastState(setImage(steady(), "v3"), steady()));
          const old = live(s).filter((p) => p.version === "v1").length;
          return `In the simulation the cluster settles with ${old} v1 pods still running, ${reportedReady(s)} ready, and one v3 pod stuck in ImagePullBackOff. With maxUnavailable 0, an old pod only goes after a new one is ready, which never happens. The API server accepted the change happily: it checks the shape of a spec, not whether the image exists.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("broken")) }}
      />
      <Challenge
        id="challenge-2"
        className="mt-11"
        question="A node's power is cut. How soon are its pods replaced on other nodes?"
        options={["Immediately. The node reports that it's shutting down.", "Only after a timeout, because a dead node can't report anything.", "Never. Pods stay bound to the node they were scheduled on."]}
        answer={1}
        verdict={() => {
          let s = lastState(failNode(steady(), "node2"), steady());
          let n = 0;
          while (serving(s) < s.desired && n < 50) { s = lastState(tick(s) ?? [], s); n++; }
          return `It took ${n} ticks in the simulation before every replica ran on a live node. Silence first makes the node NotReady, which stops traffic to its pods. Only after a longer timeout are they evicted and recreated. In a real cluster those timeouts add up to around five minutes by default, and a crashed machine can't shorten them.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("node")) }}
      />
    </>
  );
};
