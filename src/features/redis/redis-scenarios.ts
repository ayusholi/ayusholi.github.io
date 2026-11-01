import type { RedisAction, RedisConfig, RedisFrame, RedisState } from "./redis-types";
import * as engine from "./redis-engine";

// The named moves a visitor or scenario can make.
export const ACTIONS = {
  get: (key: string): RedisAction => (s) => engine.get(s, key),
  clock: (seconds: number): RedisAction => (s) => engine.advanceClock(s, seconds),
  update: (key: string): RedisAction => (s) => engine.updateRecord(s, key, { plan: s.db[key]?.plan === "free" ? "pro" : "free" }),
  setUp: (up: boolean): RedisAction => (s) => engine.setRedisUp(s, up),
};

const KEY = "user:42";

type Scenario = {
  label: string;
  title: string;
  lesson: string;
  options: RedisConfig;
  setup: RedisAction[];   // runs off-screen
  play: RedisAction[];    // what you watch
};

export const SCENARIOS = {
  miss: {
    label: "A", title: "Cache miss",
    lesson: "The cache starts empty, so the first request takes the long way round and leaves a copy behind.",
    options: {}, setup: [], play: [ACTIONS.get(KEY)],
  },
  hit: {
    label: "B", title: "Cache hit",
    lesson: "The same request again. This time the database isn't involved at all.",
    options: {}, setup: [ACTIONS.get(KEY)], play: [ACTIONS.get(KEY)],
  },
  expiry: {
    label: "C", title: "Expiration",
    lesson: "A TTL limits how long a copy can be trusted. Move the clock past it and the next read is a miss. Try a different TTL.",
    options: { ttl: 30 }, setup: [ACTIONS.get(KEY)], play: [ACTIONS.clock(31), ACTIONS.get(KEY)],
  },
  invalidation: {
    label: "D", title: "Invalidation",
    lesson: "Here the update doesn't touch the cache, so a fast read returns old data. Switch invalidation to “Delete on write” and try again.",
    options: { invalidation: "none" }, setup: [ACTIONS.get(KEY)], play: [ACTIONS.update(KEY), ACTIONS.get(KEY)],
  },
  failure: {
    label: "E", title: "Redis fails",
    lesson: "The behaviour here is a design decision. Switch the failure policy to compare staying up with protecting the database.",
    options: {}, setup: [ACTIONS.get(KEY)], play: [ACTIONS.setUp(false), ACTIONS.get(KEY)],
  },
} satisfies Record<string, Scenario>;

export type ScenarioId = keyof typeof SCENARIOS;

export const readyFrame = (state: RedisState): RedisFrame => ({ type: "ready", state, packets: [], dur: 1 });

export const buildScenario = (id: ScenarioId) => {
  const sc: Scenario = SCENARIOS[id];
  const { state } = engine.run(engine.createState(sc.options), ...sc.setup);
  return { state, frames: engine.run(state, ...sc.play).frames };
};
