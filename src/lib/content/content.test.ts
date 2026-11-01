import { test } from "vitest";
import assert from "node:assert/strict";
import { validateCatalogue } from "./index";
import { COLLECTIONS } from "./collections";
import { TOPICS } from "./topics";

test("the real catalogue is valid", () => {
  assert.doesNotThrow(() => validateCatalogue(TOPICS, COLLECTIONS));
});

test("a broken reference is reported by name", () => {
  const bad = TOPICS.map((t) => (t.slug === "redis" ? { ...t, relatedTopics: ["nope"] } : t));
  assert.throws(() => validateCatalogue(bad, COLLECTIONS), /redis: unknown related topic "nope"/);
});

test("plate rows fill the twelve-column grid", () => {
  const span = { hero: 7, tall: 5, wide: 7, medium: 5, small: 4 };
  let row = 0;
  for (const t of TOPICS) {
    row += span[t.plate.size];
    assert.ok(row <= 12, `${t.slug} overflows its row`);
    if (row === 12) row = 0;
  }
  assert.equal(row, 0);
});
