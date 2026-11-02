"use client";

import { Challenge } from "@/components/ui/Challenge";
import { reducedMotion, useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useActions } from "./ActionsProvider";
import { WORKFLOW, workflowLines } from "./actions-content";
import { createState, jobOf, lastState, latest, settle, trigger } from "./actions-engine";

const watch = (run: () => void) => () => {
  run();
  document.getElementById("bench")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
};

// The workflow file follows the simulation: the lines deciding what happens now are lit.
export const ActionsWorkflow = () => {
  const { timeline } = useActions();
  const frame = useTimelineFrame(timeline);
  const lines = workflowLines(frame);
  return (
    <pre className="code" id="workflow" tabIndex={0} aria-label=".github/workflows/ci.yml. The highlighted lines follow the simulation.">
      <code>{WORKFLOW.map((text, i) => <span key={i} className={`ln${lines.includes(i + 1) ? " is-now" : ""}`}>{text}</span>)}</code>
    </pre>
  );
};

export const ActionsLog = () => {
  const { timeline } = useActions();
  const { state } = useTimelineFrame(timeline);
  return (
    <ul className="wirelog mono" id="runlog">
      {state.log.length ? state.log.slice(-9).map((l, i) => <li key={i}>{l}</li>) : <li>(no events yet)</li>}
    </ul>
  );
};

// Answers are computed by running the question through the engine.
export const ActionsChallenges = () => {
  const { runScenario } = useActions();
  return (
    <>
      <Challenge
        id="challenge"
        question="The build job runs npm run build, and the deploy job needs its output in dist/. Without an upload and download step, what does deploy find?"
        options={["dist/, because both jobs belong to the same run.", "An empty checkout: deploy runs on a different, fresh machine.", "dist/ from the previous successful run."]}
        answer={1}
        verdict={() => "Every job gets its own fresh runner, and each one is destroyed when its job ends. Steps within a job share a disk; jobs don't share anything. That's why the workflow uploads dist/ as an artifact in build and downloads it in deploy, and why build runs npm ci again even though the tests just did."}
      />
      <Challenge
        id="challenge-2"
        className="mt-11"
        question="A pull request's tests pass. What happens to the deploy job, which has if: github.ref == 'refs/heads/main'?"
        options={["It fails, so the pull request shows a red cross.", "It's skipped, and the run still succeeds.", "It runs, because the tests passed."]}
        answer={1}
        verdict={() => {
          const s = settle(lastState(trigger(createState(), { event: "pull_request", ref: "feature/search" }), createState()));
          const run = latest(s);
          return `In the simulation, run #${run?.id} ends as “${run?.status}” with deploy ${jobOf(run, "deploy")?.status}. A false if: skips a job without failing it, and anything that needs a skipped job is skipped too. It's how one workflow can test every branch and deploy only one.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("pr")) }}
      />
    </>
  );
};
