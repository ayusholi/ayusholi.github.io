"use client";

import { Challenge } from "@/components/ui/Challenge";
import { reducedMotion, useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useRag } from "./RagProvider";
import { promptLines, runAll } from "./rag-engine";
import { ACTIONS, baseline } from "./rag-scenarios";

const watch = (run: () => void) => () => {
  run();
  document.getElementById("bench")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
};

// Exactly what the model is sent for the latest question.
export const RagPrompt = () => {
  const { timeline } = useRag();
  const { state } = useTimelineFrame(timeline);
  return (
    <pre className="cli" id="prompt" tabIndex={0} aria-label="The prompt the model receives">
      <span className="dim">$ cat prompt.txt</span>{`\n${promptLines(state).join("\n")}`}
    </pre>
  );
};

// Answers are computed by running the question through the engine.
export const RagChallenges = () => {
  const { runScenario } = useRag();
  return (
    <>
      <Challenge
        id="challenge"
        question="The returns policy changes from 30 days to 14 in the document. Nobody re-indexes. A customer asks how long they have. What do they hear?"
        options={["14 days. The model reads the document when it answers.", "30 days, with a citation to the returns page.", "That the document has changed."]}
        answer={1}
        verdict={() => {
          const s = runAll(baseline(), ACTIONS.updatePolicy(), ACTIONS.ask("return")).state;
          return `The simulation answers “${s.answer?.text}”. Retrieval searches the index, not the documents, and the index still holds the old chunk. The citation even looks trustworthy. Keeping the index in step with its sources, on every edit or on a schedule, is most of the work of running RAG.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("stale")) }}
      />
      <Challenge
        id="challenge-2"
        className="mt-11"
        question="Someone asks “When will I get my money back?”. The document says “Refunds reach your card in 5 to 7 working days.” Which search finds it?"
        options={["Keyword search, because the question is about refunds.", "Vector search, because “money back” and “refunds” mean similar things.", "Both. The answer is right there."]}
        answer={1}
        verdict={() => {
          const kw = runAll(baseline({ mode: "keyword" }), ACTIONS.ask("refund")).state;
          const vec = runAll(baseline(), ACTIONS.ask("refund")).state;
          return `Keywords score ${kw.hits[0]?.score ?? 0} at best: the question and the chunk share no words. Vectors score ${vec.hits[0]?.chunk.id} at ${vec.hits[0]?.score}, because both are about refunds and time. Real systems often run both and merge the results, since keywords win on exact names and codes.`;
        }}
        watch={{ label: "Watch it happen ↑", run: watch(() => runScenario("meaning")) }}
      />
    </>
  );
};
