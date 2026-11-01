"use client";

import { AnimatePresence, m } from "motion/react";
import { useState } from "react";

// A small "predict what happens" check. `verdict` runs when a choice is made,
// so a topic can compute the explanation from its engine.
type Props = {
  id?: string;
  className?: string;
  question: string;
  options: string[];
  answer: number;
  verdict: (index: number) => string;
  watch?: { label: string; run: () => void };
};

export const Challenge = ({ id, className = "", question, options, answer, verdict, watch }: Props) => {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className={`challenge ${className}`} id={id}>
      <p className="challenge__q">{question}</p>
      <div className="challenge__opts" role="group" aria-label="Choose an answer">
        {options.map((option, i) => {
          const right = picked !== null && i === answer;
          const wrong = picked === i && i !== answer;
          return (
            <button key={option} type="button" className={`opt${right ? " is-right" : ""}${wrong ? " is-wrong" : ""}`} onClick={() => setPicked(i)}>
              <span className="opt__key" aria-hidden="true">{"ABCD"[i]}</span>
              <span>{option}</span>
              <span className="opt__mark" aria-hidden="true">{right ? "✓ correct" : wrong ? "✕ your pick" : ""}</span>
            </button>
          );
        })}
      </div>
      <div role="status">
        <AnimatePresence>
          {picked !== null && (
            <m.div className="challenge__out" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <p><strong>{picked === answer ? "Yes." : "Not quite."}</strong> {verdict(picked)}</p>
              {watch && <button type="button" className="btn" onClick={watch.run}>{watch.label}</button>}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
