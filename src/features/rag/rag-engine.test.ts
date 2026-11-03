import { test } from "vitest";
import assert from "node:assert/strict";
import { createState, DOCS, embed, runAll, search } from "./rag-engine";
import { ACTIONS, baseline } from "./rag-scenarios";

test("indexing turns every sentence of every document into a vector", () => {
  const s = baseline();
  assert.equal(s.index.length, DOCS.reduce((n, d) => n + d.sentences.length, 0));
  assert.equal(ACTIONS.reindex()(s), null, "nothing to do when the index is current");
});

test("a grounded answer quotes the closest chunk and cites it", () => {
  const { state } = runAll(baseline(), ACTIONS.ask("return"));
  assert.equal(state.hits[0]?.chunk.id, "returns.md#1");
  assert.equal(state.answer?.kind, "grounded");
  assert.ok(state.answer?.cites.includes("returns.md"));
  assert.match(state.answer?.text ?? "", /30 days/);
});

test("vectors match meaning where keywords find nothing", () => {
  const vector = runAll(baseline(), ACTIONS.ask("refund")).state;
  const keyword = runAll(baseline({ mode: "keyword" }), ACTIONS.ask("refund")).state;
  assert.equal(vector.hits[0]?.chunk.id, "returns.md#2");
  assert.equal(keyword.answer?.kind, "not-found");
  assert.ok(keyword.hits.every((h) => h.score === 0));
});

test("an index that isn't rebuilt keeps serving the old version", () => {
  const stale = runAll(baseline(), ACTIONS.updatePolicy(), ACTIONS.ask("return")).state;
  assert.equal(stale.answer?.stale, true);
  assert.match(stale.answer?.text ?? "", /30 days/);
  const fresh = runAll(stale, ACTIONS.reindex(), ACTIONS.ask("return")).state;
  assert.equal(fresh.answer?.stale, false);
  assert.match(fresh.answer?.text ?? "", /14 days/);
  assert.equal(fresh.index.length, stale.index.length, "only the changed document is replaced");
});

test("below the threshold the model says it can't answer, and without retrieval it guesses", () => {
  const grounded = runAll(baseline(), ACTIONS.ask("kayak")).state;
  assert.equal(grounded.answer?.kind, "not-found");
  assert.ok(grounded.hits.every((h) => !h.used));
  const bare = runAll(baseline({ retrieval: "off" }), ACTIONS.ask("kayak")).state;
  assert.equal(bare.answer?.kind, "unsupported");
  assert.equal(bare.stats.unsupported, 1);
});

test("an empty index retrieves nothing", () => {
  assert.deepEqual(search(createState(), "return"), []);
  assert.ok(embed("Is delivery free?").some((x) => x > 0));
});
