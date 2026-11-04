import { test } from "vitest";
import assert from "node:assert/strict";
import { createState, runAll } from "./mcp-engine";
import { ACTIONS } from "./mcp-scenarios";

const methods = (rpc: { json: string }[]) => rpc.map((r) => (JSON.parse(r.json) as { method?: string }).method ?? "result");

test("connecting runs the handshake, then lists tools", () => {
  const { state } = runAll(createState(), ACTIONS.connect("files"));
  assert.deepEqual(methods(state.rpc), ["initialize", "result", "notifications/initialized", "tools/list", "result"]);
  assert.equal(state.stats.tools, 2);
  assert.equal(JSON.parse(state.rpc[2]!.json).id, undefined, "a notification has no id");
  assert.equal(JSON.parse(state.rpc[0]!.json).id, JSON.parse(state.rpc[1]!.json).id, "a reply carries its request's id");
});

test("without the right server, the model can't use the tool", () => {
  const { state } = runAll(createState(), ACTIONS.ask("notes"));
  assert.equal(state.stats.toolCalls, 0);
  assert.match(state.chat[state.chat.length - 1]!.text, /can't see your files/);
});

test("a tool call is routed to the server that listed the tool", () => {
  const { state } = runAll(createState(), ACTIONS.connect("files"), ACTIONS.connect("calendar"), ACTIONS.ask("free"), ACTIONS.ask("notes"));
  const calls = state.rpc.filter((r) => r.json.includes("tools/call"));
  assert.deepEqual(calls.map((c) => c.server), ["calendar", "files"]);
  assert.equal(state.stats.tools, 4);
});

test("a tool error is a result the model recovers from", () => {
  const { state } = runAll(createState(), ACTIONS.connect("files"), ACTIONS.ask("missing"));
  assert.equal(state.stats.toolCalls, 2);
  assert.equal(state.stats.toolErrors, 1);
  assert.match(state.chat[state.chat.length - 1]!.text, /notes\.txt and plan\.md/);
});

test("a write waits for approval; denying it never sends the call", () => {
  const setup = runAll(createState({ approval: "ask" }), ACTIONS.connect("calendar"), ACTIONS.ask("book")).state;
  assert.ok(setup.pending);
  assert.equal(setup.stats.toolCalls, 0);
  assert.equal(ACTIONS.ask("notes")(setup), null, "one question at a time");
  const denied = runAll(setup, ACTIONS.deny()).state;
  assert.equal(denied.stats.toolCalls, 0);
  assert.equal(denied.pending, null);
  const allowed = runAll(setup, ACTIONS.approve()).state;
  assert.equal(allowed.stats.toolCalls, 1);
  const auto = runAll(createState({ approval: "auto" }), ACTIONS.connect("calendar"), ACTIONS.ask("book")).state;
  assert.equal(auto.stats.approvals, 0);
  assert.equal(auto.stats.toolCalls, 1);
});

test("disconnecting removes a server's tools", () => {
  const { state } = runAll(createState(), ACTIONS.connect("files"), ACTIONS.connect("calendar"), ACTIONS.connect("files"));
  assert.deepEqual(state.connected, ["calendar"]);
  assert.deepEqual(state.tools.map((t) => t.name), ["list_events", "create_event"]);
});
