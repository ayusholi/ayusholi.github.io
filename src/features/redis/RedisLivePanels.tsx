"use client";

import { Challenge } from "@/components/ui/Challenge";
import { reducedMotion, useTimelineFrame } from "@/lib/simulation/useTimeline";
import { useRedis } from "./RedisProvider";
import { CODE_LINES } from "./redis-content";
import { createState, run } from "./redis-engine";
import { ACTIONS } from "./redis-scenarios";

const CODE = [
  "async function getProfile(id) {",
  "  const key = `user:${id}`;",
  "  try {",
  "    const cached = await redis.get(key);",
  "    if (cached) return JSON.parse(cached);",
  "  } catch (err) {",
  "    if (STRICT) throw err;   // otherwise carry on without the cache",
  "  }",
  "  const row = await db.getUser(id);",
  "  redis.set(key, JSON.stringify(row), { EX: TTL }).catch(log);",
  "  return row;",
  "}",
  " ",
  "async function updateProfile(id, patch) {",
  "  await db.updateUser(id, patch);",
  "  await redis.del(`user:${id}`);",
  "}",
];

// The code panel follows the simulation: the highlighted line is the one running.
export const RedisCode = () => {
  const { timeline } = useRedis();
  const frame = useTimelineFrame(timeline);
  const line = CODE_LINES[frame.type];
  return (
    <pre className="code" id="code" tabIndex={0} aria-label="Cache-aside example code. The highlighted line follows the simulation.">
      <code>{CODE.map((text, i) => <span key={i} className={`ln${i + 1 === line ? " is-now" : ""}`}>{text}</span>)}</code>
    </pre>
  );
};

export const RedisWireLog = () => {
  const { timeline } = useRedis();
  const { state } = useTimelineFrame(timeline);
  return (
    <ul className="wirelog mono" id="wirelog">
      {state.log.length
        ? state.log.slice(-9).map((l, i) => <li key={i}>{l.cmd}<span>{l.reply}</span></li>)
        : <li>(no commands yet)</li>}
    </ul>
  );
};

// The answer is computed by running the question through the engine.
export const RedisChallenge = () => {
  const { runScenario } = useRedis();
  return (
    <Challenge
      question="user:42 was cached with a 30 s TTL. 31 seconds later, the same key is requested. What happens?"
      options={[
        "A hit. The entry is still in memory until something removes it.",
        "A miss. Postgres is queried and the key is cached again with a new TTL.",
        "An error. Redis reports that the key has expired.",
      ]}
      answer={1}
      verdict={() => {
        const { state } = run(createState({ ttl: 30 }), ACTIONS.get("user:42"), ACTIONS.clock(31), ACTIONS.get("user:42"));
        const last = state.history[state.history.length - 1];
        return `The simulation gives ${state.stats.misses} misses, ${state.stats.hits} hits and ${state.stats.dbQueries} database queries, and that request took ${last?.elapsed} ms. An expired key may linger in memory briefly, but Redis never returns it: reading it looks exactly like reading a key that was never there.`;
      }}
      watch={{
        label: "Watch it happen ↑",
        run: () => {
          runScenario("expiry");
          document.getElementById("bench")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
        },
      }}
    />
  );
};
