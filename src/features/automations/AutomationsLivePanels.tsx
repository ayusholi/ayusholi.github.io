"use client";

import { Challenge } from "@/components/ui/Challenge";
import { reducedMotion, useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useAutomations } from "./AutomationsProvider";
import { WORKFLOW, WORKFLOW_LINE } from "./automations-content";
import { createState, runAll } from "./automations-engine";
import { ACTIONS } from "./automations-scenarios";

const watch = (run: () => void) => () => {
  run();
  document.getElementById("bench")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
};

// The workflow follows the simulation: the node running now is lit.
export const AutomationsWorkflow = () => {
  const { timeline } = useAutomations();
  const frame = useTimelineFrame(timeline);
  const line = frame.type === "dropped" ? 5 : frame.at && frame.type !== "ready" && frame.type !== "config.changed" ? WORKFLOW_LINE[frame.at] : undefined;
  return (
    <pre className="code" id="workflow" tabIndex={0} aria-label="The workflow. The highlighted line follows the simulation.">
      <code>{WORKFLOW.map((text, i) => <span key={i} className={`ln${i === line ? " is-now" : ""}`}>{text}</span>)}</code>
    </pre>
  );
};

// The item as the next node will receive it.
export const AutomationsItem = () => {
  const { timeline } = useAutomations();
  const { state } = useTimelineFrame(timeline);
  return (
    <pre className="cli" id="item" tabIndex={0} aria-label="The current item, as JSON">
      <span className="dim">$ execution --item</span>
      {`\n${state.item ? JSON.stringify(state.item, null, 2) : "(no execution yet)"}`}
      {state.raw && !state.raw.startsWith("{") && <span className="dim">{`\n\nAI reply, rejected:\n${state.raw}`}</span>}
    </pre>
  );
};

// Answers are computed by running the question through the engine.
export const AutomationsChallenges = () => {
  const { runScenario } = useAutomations();
  return (
    <>
      <Challenge
        id="challenge"
        question="The email trigger fires twice for the same order email, and the workflow has no dedupe. What does the customer see?"
        options={["One reply. The workflow can tell it's the same email.", "Two identical replies, and the order is logged twice.", "Nothing. The second execution fails."]}
        answer={1}
        verdict={() => {
          const s = runAll(createState(), ACTIONS.receive("order"), ACTIONS.redeliver()).state;
          const d = runAll(createState({ dedupe: "on" }), ACTIONS.receive("order"), ACTIONS.redeliver()).state;
          return `The simulation sends ${s.stats.replies} replies and adds ${s.stats.rows} rows. Each delivery is a fresh execution that knows nothing about the last one. Checking the message id first, the idempotency check, brings it to ${d.stats.replies} reply and ${d.stats.rows} row. Any workflow with side effects needs one.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("duplicate")) }}
      />
      <Challenge
        id="challenge-2"
        className="mt-11"
        question="The AI node returns “Sure! Here's the JSON: {category: order…”. The workflow is set to stop on error. What happens to the customer's email?"
        options={["The switch guesses the category from the text.", "The execution fails, and the email sits unanswered unless someone checks.", "The model is called again automatically."]}
        answer={1}
        verdict={() => {
          const stop = runAll(createState({ onError: "stop" }), ACTIONS.receive("messy")).state;
          const retry = runAll(createState({ onError: "retry" }), ACTIONS.receive("messy")).state;
          return `With stop, the simulation records ${stop.stats.failed} failed execution, ${stop.stats.rows} rows and ${stop.stats.replies} replies. With retry, the parser's error goes back to the model and the order is logged after ${retry.stats.aiCalls} AI calls. Either way, an AI step needs a schema, a parser and a plan for when it fails: an error branch, a retry, or an alert to a person.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("broken")) }}
      />
    </>
  );
};
