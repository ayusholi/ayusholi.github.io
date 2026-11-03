import { test } from "vitest";
import assert from "node:assert/strict";
import { createState, END, MAX_NEW, predict, reshape, runAll, text, tokenize } from "./llm-engine";
import { ACTIONS } from "./llm-scenarios";
import type { LlmConfig, PromptId } from "./llm-types";

const run = (prompt: PromptId, options: LlmConfig = {}) => runAll(createState(options), ACTIONS.submit(prompt), ACTIONS.complete()).state;

test("known words are one token and rare ones are split into pieces", () => {
  assert.deepEqual(tokenize("The capital of France is"), ["The", " capital", " of", " France", " is"]);
  assert.deepEqual(tokenize(" Pokhara"), [" Pok", "har", "a"]);
});

test("the model generates one token per forward pass and stops on <end>", () => {
  const s = run("capital");
  assert.equal(text(s), " Paris.");
  assert.equal(s.stats.generated, s.output.length + 1, "the <end> pick is a pass too");
  assert.equal(s.done, "stop");
});

test("temperature 0 is deterministic and never leaves the top choice", () => {
  for (const prompt of ["capital", "name", "unknown"] as const) assert.equal(text(run(prompt, { seed: 1 })), text(run(prompt, { seed: 99 })));
  assert.equal(run("capital").stats.offTop, 0);
});

test("higher temperature flattens the odds without reordering them", () => {
  const dist = predict(tokenize("The capital of France is")).dist;
  const cold = reshape(dist, 0.8), hot = reshape(dist, 1.5);
  assert.ok((hot[0]?.q ?? 1) < (cold[0]?.q ?? 0));
  assert.deepEqual(hot.map((c) => c.token), cold.map((c) => c.token));
  assert.ok(Math.abs(hot.reduce((a, c) => a + c.q, 0) - 1) < 1e-9);
});

test("a hot sampler can draw an unlikely token, and the text follows it", () => {
  const s = run("capital", { temperature: "1.5", seed: 4 });
  assert.ok(!text(s).includes("Paris"));
  assert.ok(s.stats.offTop >= 1);
});

test("the model can copy a fact that's still in its window", () => {
  assert.equal(text(run("name")), " Ayush.");
});

test("a fact pushed out of the window is gone, and the model guesses", () => {
  const s = run("name", { windowSize: "16" });
  assert.ok(!s.context.includes(" Ayu"));
  assert.ok(s.dropped.includes(" Ayu"));
  assert.ok(!text(s).includes("Ayush"));
  assert.ok(s.context.length <= 16);
});

test("with nothing to go on it still answers, at low confidence", () => {
  const s = run("unknown");
  assert.ok(text(s).trim().length > 0);
  assert.ok(s.stats.unsure >= 1);
});

test("generation stops at max_tokens", () => {
  const s = runAll(createState({ temperature: "1.5", seed: 3 }), ACTIONS.submit("capital"), ...Array(20).fill(ACTIONS.step())).state;
  assert.ok(s.output.length <= MAX_NEW);
  assert.ok(!s.output.includes(END));
  assert.equal(ACTIONS.step()(createState()), null, "nothing to generate without a prompt");
});
