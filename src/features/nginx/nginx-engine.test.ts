import { test } from "vitest";
import assert from "node:assert/strict";
import { createState, runAll, THREADS } from "./nginx-engine";
import { ACTIONS } from "./nginx-scenarios";

test("a page is proxied to an app server and a static file is read from disk", () => {
  const { state } = runAll(createState(), ACTIONS.request("page"), ACTIONS.request("static"));
  assert.equal(state.requests[0]?.upstream, "app1");
  assert.equal(state.requests[0]?.status, "200");
  assert.equal(state.requests[1]?.upstream, null);
  assert.equal(state.requests[1]?.ms, 1);
  assert.equal(state.stats.appBusyMs, 40, "the logo costs the apps nothing");
});

test("round robin takes the app servers in turn", () => {
  const { state } = runAll(createState(), ...Array.from({ length: 4 }, () => ACTIONS.request("page")));
  assert.deepEqual(state.requests.map((r) => r.upstream), ["app1", "app2", "app3", "app1"]);
});

test("the event loop holds idle connections cheaply; one thread each runs out", () => {
  const event = runAll(createState({ model: "event" }), ACTIONS.burst(), ACTIONS.request("page")).state;
  assert.equal(event.stats.connections, 10000);
  assert.equal(event.stats.memoryMb, 12.5);
  assert.equal(event.stats.errors, 0);
  const threads = runAll(createState({ model: "threads" }), ACTIONS.burst(), ACTIONS.request("page")).state;
  assert.equal(threads.stats.connections, THREADS);
  assert.equal(threads.stats.waiting, 10000 - THREADS);
  assert.equal(threads.stats.memoryMb, 410);
  assert.equal(threads.requests[0]?.status, "timeout");
});

test("a refused upstream is retried elsewhere, marked down and then skipped", () => {
  const { state } = runAll(createState(), ACTIONS.toggle("app2"), ...Array.from({ length: 4 }, () => ACTIONS.request("page")));
  assert.deepEqual(state.requests.map((r) => r.tried), [["app1"], ["app2", "app3"], ["app1"], ["app3"]]);
  assert.equal(state.stats.retries, 1);
  assert.equal(state.stats.errors, 0);
  assert.equal(state.upstreams.app2.marked, true);
  const back = runAll(state, ACTIONS.toggle("app2"), ACTIONS.request("page"), ACTIONS.request("page")).state;
  assert.ok(back.requests.some((r) => r.upstream === "app2"), "a restarted server rejoins");
});

test("with every upstream down, nginx answers 502", () => {
  const { state } = runAll(createState(), ACTIONS.toggle("app1"), ACTIONS.toggle("app2"), ACTIONS.toggle("app3"), ACTIONS.request("page"), ACTIONS.request("page"));
  assert.deepEqual(state.requests.map((r) => r.status), ["502", "502"]);
  assert.equal(state.stats.retries, 3, "the second request doesn't retry servers already marked down");
});

test("buffering frees the app from a slow client", () => {
  const on = runAll(createState({ buffering: "on" }), ACTIONS.request("slow")).state;
  const off = runAll(createState({ buffering: "off" }), ACTIONS.request("slow")).state;
  assert.equal(on.stats.appBusyMs, 40);
  assert.equal(off.stats.appBusyMs, 3000);
  assert.equal(on.requests[0]?.ms, off.requests[0]?.ms, "the phone waits as long either way");
});
