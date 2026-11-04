import { test } from "vitest";
import assert from "node:assert/strict";
import { clock, createState, DAY, inWindow, runAll, when } from "./reminders-engine";
import { ACTIONS } from "./reminders-scenarios";

test("a message becomes one AI call, one row and a reminder at the time asked", () => {
  const { state } = runAll(createState(), ACTIONS.send("rent"), ACTIONS.advance());
  assert.equal(state.stats.aiCalls, 1);
  assert.equal(state.stats.delivered, 1);
  assert.equal(when(state.now), "Tue 4 Nov 09:00");
  assert.equal(state.reminders[0]?.status, "done");
  assert.equal(state.chat.length, 3, "message, confirmation, reminder");
});

test("told UTC, the model's 9am arrives at 14:45 in Kathmandu", () => {
  const { state } = runAll(createState({ tz: "server" }), ACTIONS.send("rent"));
  assert.equal(state.parsed?.timezone, "UTC");
  assert.equal(clock(state.reminders[0]?.due ?? 0), "14:45");
  assert.equal(clock(state.reminders[0]?.intended ?? 0), "09:00");
});

test("no time means a question, not a guess", () => {
  const { state } = runAll(createState(), ACTIONS.send("later"));
  assert.equal(state.parsed?.at, null);
  assert.equal(state.reminders.length, 0);
  assert.equal(state.stats.questions, 1);
  assert.equal(ACTIONS.advance()(state), null);
});

test("a daily reminder is refused once the 24-hour window closes, unless it's a template", () => {
  const off = runAll(createState(), ACTIONS.send("pills"), ACTIONS.advance(), ACTIONS.advance()).state;
  assert.equal(off.stats.delivered, 1);
  assert.equal(off.stats.rejected, 1);
  assert.equal(off.api?.status, "failed");
  const on = runAll(createState({ template: "on" }), ACTIONS.send("pills"), ACTIONS.advance(), ACTIONS.advance()).state;
  assert.equal(on.stats.delivered, 2);
  assert.equal(on.api?.type, "template");
  assert.equal(on.stats.aiCalls, 1);
  assert.equal(on.reminders[0]?.due, 20 * 60 + 2 * DAY, "it moves on a day each time");
});

test("the window lasts 24 hours from the user's latest message, and not a minute more", () => {
  assert.equal(inWindow({ lastIn: 0 }, DAY - 1), true);
  assert.equal(inWindow({ lastIn: 0 }, DAY), false);
  // Writing again at Monday 20:00 reopens it, but Tuesday 20:00 is exactly 24 hours later.
  const { state } = runAll(createState(), ACTIONS.send("pills"), ACTIONS.advance(), ACTIONS.send("rent"), ACTIONS.advance(), ACTIONS.advance());
  assert.equal(state.lastIn, 20 * 60);
  assert.deepEqual([state.stats.delivered, state.stats.rejected], [2, 1]);
});
