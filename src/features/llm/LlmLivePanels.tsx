"use client";

import { Challenge } from "@/components/ui/Challenge";
import { reducedMotion, useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useLlm } from "./LlmProvider";
import { createState, runAll, show, text } from "./llm-engine";
import { ACTIONS } from "./llm-scenarios";

const watch = (run: () => void) => () => {
  run();
  document.getElementById("bench")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
};

// The window as the model sees it: dropped tokens are struck through and dim.
export const LlmWindow = () => {
  const { timeline } = useLlm();
  const { state } = useTimelineFrame(timeline);
  const generated = state.output.length;
  const seen = state.context.length - Math.min(generated, state.context.length);
  return (
    <pre className="cli" id="window-view" tabIndex={0} aria-label="The context window, token by token">
      <span className="dim">{`$ context --window ${state.windowSize}  (${state.context.length} in, ${state.dropped.length} dropped)`}</span>
      {"\n"}
      {state.dropped.length > 0 && <s className="dim">{state.dropped.map(show).join("|")}</s>}
      {state.dropped.length > 0 && "\n"}
      {state.context.slice(0, seen).map(show).join("|")}
      {generated > 0 && <b>{`|${state.context.slice(seen).map(show).join("|")}`}</b>}
      {!state.context.length && <span className="dim">(empty)</span>}
    </pre>
  );
};

// Answers are computed by running the question through the engine.
export const LlmChallenges = () => {
  const { runScenario } = useLlm();
  return (
    <>
      <Challenge
        id="challenge"
        question="The conversation starts with “My name is Barry Allen” and ends with “What is my name?”. The window holds 16 tokens and the conversation is 29. What does the model answer?"
        options={["Barry Allen. It remembers what was said earlier in the chat.", "A plausible name, but not Barry Allen.", "“I don't know”, because the name is missing."]}
        answer={1}
        verdict={() => {
          const s = runAll(createState({ windowSize: "16" }), ACTIONS.submit("name"), ACTIONS.complete()).state;
          return `In the simulation it answers “${text(s).trim()}”. The first ${s.stats.promptTokens - Number(s.windowSize)} tokens, including the name, were dropped before the first pass, so there was nothing to copy. A model has no memory except its context, and nothing tells it something is missing, so it answers with the most likely name instead.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("forget")) }}
      />
      <Challenge
        id="challenge-2"
        className="mt-11"
        question="Temperature 0. You send “The capital of France is” twice, with a different random seed each time. Do the answers differ?"
        options={["Yes. Language models are random, so every answer is different.", "No. Temperature 0 always takes the top token, so the seed is never used.", "Only sometimes, when two tokens score the same."]}
        answer={1}
        verdict={() => {
          const a = runAll(createState({ seed: 1 }), ACTIONS.submit("capital"), ACTIONS.complete()).state;
          const b = runAll(createState({ seed: 99 }), ACTIONS.submit("capital"), ACTIONS.complete()).state;
          const hot = runAll(createState({ temperature: "1.5", seed: 4 }), ACTIONS.submit("capital"), ACTIONS.complete()).state;
          return `Both runs give “${text(a).trim()}” and “${text(b).trim()}”. The model itself is a fixed function, and greedy decoding never reads the seed. Randomness lives only in the sampler: at 1.5 the same prompt gave “${text(hot).trim()}”. (Real services can still vary a little at temperature 0, because of how numbers are batched on GPUs.)`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("temperature")) }}
      />
    </>
  );
};
