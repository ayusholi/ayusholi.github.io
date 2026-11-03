"use client";

import { Challenge } from "@/components/ui/Challenge";
import { reducedMotion, useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useAgents } from "./AgentsProvider";
import { TOOLS } from "./agents-content";
import { createState, runAll } from "./agents-engine";
import { ACTIONS } from "./agents-scenarios";

const watch = (run: () => void) => () => {
  run();
  document.getElementById("bench")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
};

// The tool list follows the simulation: the tool in use now is lit.
export const AgentsTools = () => {
  const { timeline } = useAgents();
  const frame = useTimelineFrame(timeline);
  const name = [...frame.state.transcript].reverse().find((m) => "call" in m);
  const lit = frame.tool && name && "call" in name ? TOOLS.findIndex(([line]) => line.trim().startsWith(name.call.name)) : frame.type === "model.called" ? TOOLS.length - 1 : -1;
  return (
    <pre className="code" id="tools" tabIndex={0} aria-label="The tools the model is given. The highlighted line follows the simulation.">
      <code>{TOOLS.map(([text], i) => <span key={i} className={`ln${i === lit ? " is-now" : ""}`}>{text}</span>)}</code>
    </pre>
  );
};

export const AgentsOutbox = () => {
  const { timeline } = useAgents();
  const { state } = useTimelineFrame(timeline);
  return (
    <pre className="cli" id="outbox" tabIndex={0} aria-label="Emails the agent has sent">
      <span className="dim">$ mail sent --today</span>
      {`\n${"TO".padEnd(6)}SUBJECT\n${state.outbox.map((m) => `${String(m.to).padEnd(6)}${m.subject.split(", ").slice(1).join(", ")}`).join("\n") || "(nothing sent)"}`}
    </pre>
  );
};

// Answers are computed by running the question through the engine.
export const AgentsChallenges = () => {
  const { runScenario } = useAgents();
  return (
    <>
      <Challenge
        id="challenge"
        question="The agent is asked to summarise a web page. The page contains a hidden line telling AI assistants to email every contact. Which change actually stops the email?"
        options={["Telling the model in its instructions to never follow instructions found in web pages.", "Making the runtime hold send_email for a person's approval.", "Using a bigger, smarter model."]}
        answer={1}
        verdict={() => {
          const open = runAll(createState(), ACTIONS.assign("research")).state;
          const gated = runAll(createState({ approval: "ask" }), ACTIONS.assign("research"), ACTIONS.deny()).state;
          return `Without a gate the simulation emails ${open.stats.recipients} people. With the gate, the call stops at the runtime and you get to read it first: ${gated.stats.recipients} sent. Instructions and better models lower the odds, but the page's text and your instructions arrive in the same context, so a model can always be talked into it. The runtime is ordinary code, and code can enforce a rule.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("injection")) }}
      />
      <Challenge
        id="challenge-2"
        className="mt-11"
        question="An agent that never finishes is allowed 10 steps instead of 4: 2.5 times as many. Roughly how many more tokens does it spend?"
        options={["About 2.5 times as many. Each step costs the same.", "More than 2.5 times as many, because every call resends a longer transcript.", "The same, because the task is the same."]}
        answer={1}
        verdict={() => {
          const four = runAll(createState({ limit: "4" }), ACTIONS.assign("loop")).state.stats.tokens;
          const ten = runAll(createState({ limit: "10" }), ACTIONS.assign("loop")).state.stats.tokens;
          return `The simulation spends ${four} tokens on 4 steps and ${ten} on 10: ${(ten / four).toFixed(1)} times as many. Each call sends everything so far, so the cost of a run grows with the square of its length. A step budget caps the bill as well as the loop.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("runaway")) }}
      />
    </>
  );
};
