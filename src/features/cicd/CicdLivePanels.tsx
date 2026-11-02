"use client";

import { Challenge } from "@/components/ui/Challenge";
import { reducedMotion, useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useCicd } from "./CicdProvider";
import { historyLines, PIPELINE, PIPELINE_LINE } from "./cicd-content";
import { runAll } from "./cicd-engine";
import { ACTIONS, baseline } from "./cicd-scenarios";

const watch = (run: () => void) => () => {
  run();
  document.getElementById("bench")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
};

// The pipeline definition follows the simulation: the stage running now is lit.
export const CicdPipeline = () => {
  const { timeline } = useCicd();
  const frame = useTimelineFrame(timeline);
  const line = frame.stage ? PIPELINE_LINE[frame.stage] : frame.type === "push" || frame.type === "ci.triggered" ? 1 : undefined;
  return (
    <pre className="code" id="pipeline" tabIndex={0} aria-label="Pipeline stages. The highlighted line follows the simulation.">
      <code>{PIPELINE.map((text, i) => <span key={i} className={`ln${i + 1 === line ? " is-now" : ""}`}>{text}</span>)}</code>
    </pre>
  );
};

export const CicdHistory = () => {
  const { timeline } = useCicd();
  const { state } = useTimelineFrame(timeline);
  return (
    <pre className="cli" id="history" tabIndex={0} aria-label="Production deploy history">
      <span className="dim">$ deploy history production</span>{`\n${"ACTION".padEnd(10)}${"COMMIT".padEnd(10)}ARTIFACT\n${historyLines(state).join("\n")}`}
    </pre>
  );
};

// Answers are computed by running the question through the engine.
export const CicdChallenges = () => {
  const { runScenario } = useCicd();
  return (
    <>
      <Challenge
        id="challenge"
        question="A release with a bug reaches production and you roll back. What does the pipeline do?"
        options={["Checks out the previous commit, rebuilds it, tests it and deploys it.", "Deploys the previous artifact, which is still in the registry.", "Reverts the commit in Git, which triggers a new run."]}
        answer={1}
        verdict={() => {
          const { state } = runAll(baseline(), ACTIONS.commit("hidden-bug"), ACTIONS.rollback());
          return `In the simulation, after the rollback production runs ${state.prod?.sha}, artifact ${state.prod?.digest.slice(0, 14)}…, the one it ran before. Pipeline runs: ${state.stats.runs}. Nothing was rebuilt, which is why a rollback takes seconds and why it can be trusted: those exact bytes already ran in production. Reverting in Git is the follow-up, so the next release doesn't bring the bug back.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("escape")) }}
      />
      <Challenge
        id="challenge-2"
        className="mt-11"
        question="The same bug, released as a canary taking 10% of traffic. Out of every 100 requests, how many fail before the release is stopped?"
        options={["None. The canary catches it before any user does.", "About 10. Only the canary's share of traffic sees it.", "All 100. A canary only changes how fast it's noticed."]}
        answer={1}
        verdict={() => {
          const all = runAll(baseline(), ACTIONS.commit("hidden-bug")).state.stats.badResponses;
          const canary = runAll(baseline({ strategy: "canary" }), ACTIONS.commit("hidden-bug")).state.stats.badResponses;
          return `The simulation counts ${canary} failed requests with a canary against ${all} all at once. A canary doesn't prevent the bug reaching users, it limits how many. Something has to receive real traffic for the bug to show, so the point is to make that something small and the decision automatic.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("canary")) }}
      />
    </>
  );
};
