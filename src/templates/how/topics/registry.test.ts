import { test } from "vitest";
import assert from "node:assert/strict";
import { TOPICS } from "@/lib/content/topics";
import { PUBLISHED_EXPERIENCES } from "./published";

test("every published topic has a page template, and only those do", () => {
  const published = TOPICS.filter((t) => t.status === "published").map((t) => t.slug).sort();
  assert.deepEqual([...PUBLISHED_EXPERIENCES].sort(), published);
});
