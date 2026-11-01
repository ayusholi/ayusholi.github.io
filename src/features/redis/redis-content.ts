// Redis's words, kept apart from its logic. `describe` narrates a frame from
// the state that frame holds, so the caption can't disagree with the simulation.
import type { RedisEventType, RedisFrame, RedisNodeId, RedisState, RequestStatus } from "./redis-types";

export const ROLES: Record<RedisNodeId, { name: string; sub: string; role: string }> = {
  client: { name: "Client", sub: "Browser or app", role: "Asks for a user profile. It can't tell where the answer came from, only how long it took." },
  edge: { name: "Nginx", sub: "Reverse proxy", role: "Takes the connection, then forwards the request to the application. Here it only passes traffic along, though it can also terminate TLS and balance load." },
  app: { name: "Application", sub: "Cache-aside logic", role: "Owns the decision. Redis doesn't fetch anything by itself: this code checks the cache, falls through to Postgres, and fills the cache afterwards." },
  redis: { name: "Redis", sub: "In memory", role: "A key-value store held in RAM. Lookups are fast because no disk or query planning is involved. Entries can carry an expiry." },
  db: { name: "PostgreSQL", sub: "Source of truth", role: "Holds the durable record. Slower here because the illustrative query does real work. It stays correct when the cache is wrong or gone." },
};

const ms = (s: RedisState) => (s.req ? `${s.req.elapsed} ms so far` : "");

type Note = [title: string, text: string];

const NOTES: Record<RedisEventType, (f: RedisFrame) => Note> = {
  ready: () => ["Ready", "Send a request and watch the path it takes."],
  "request.start": (f) => ["Request starts", `The client asks for the profile behind ${f.key}.`],
  "request.received": () => ["Reaches the application", "The application decides where to look first."],
  "edge.received": () => ["Reaches Nginx", "The proxy accepts the connection."],
  "edge.forwarded": () => ["Forwarded to the application", "Nginx passes the request upstream."],
  "cache.lookup": (f) => ["Checks Redis first", `GET ${f.key}. The application asks before doing anything expensive.`],
  "cache.hit": (f) => ["Cache hit", `The value is in memory, so Postgres is never asked. ${ms(f.state)}.`],
  "cache.miss": (f) => ["Cache miss", `No entry for ${f.key}. Redis replies (nil) and the application has to go to the database.`],
  "cache.expired": (f) => ["Miss: the entry expired", `${f.key} had outlived its TTL. To the caller that's the same as never being cached.`],
  "cache.error": (f) => ["Redis isn't answering", `The application waits out a ${f.state.latency.redisTimeout} ms timeout. An outage is often slower than a miss.`],
  "db.query": () => ["Queries PostgreSQL", "This is the slow part of the path."],
  "db.result": (f) => ["PostgreSQL returns the row", `${ms(f.state)}. This row is the truth.`],
  "cache.write": (f) => ["Stores it in Redis", `SET with a TTL of ${f.state.ttl} s, so the next read is fast and the entry can't live forever.`],
  "response.sent": () => ["Response returns", "The client gets its answer."],
  "response.stale": (f) => ["This value is stale", `The cache says plan “${f.value?.plan}”. Postgres has moved on, and nothing told Redis.`],
  "edge.response": () => ["Back through Nginx", "The response heads to the client."],
  "request.rejected": () => ["Fails the request", "The strict policy treats Redis as mandatory, so the application gives up and protects Postgres."],
  "request.done": (f) => doneNote(f),
  "clock.advanced": (f) => ["Clock moves forward", `${f.seconds} simulated seconds pass. Nothing happens by itself. Entries past their TTL just stop being readable.`],
  "db.update": (f) => ["Postgres is updated", `${f.key} is now plan “${f.value?.plan}”. Any cached copy is out of date from this moment.`],
  "invalidate.deleted": (f) => ["Cache entry deleted", `DEL ${f.key}. The next read misses and fetches the new row.`],
  "invalidate.skipped": (f) => ["Nothing told Redis", `The old copy of ${f.key} stays until its TTL runs out. Reads will now disagree with Postgres.`],
  "invalidate.failed": (f) => ["Couldn't delete the entry", `Redis is down, so DEL ${f.key} failed. With persistence, that stale value could come back on restart.`],
  "redis.down": () => ["Redis goes down", "Connections fail. What happens next depends on how the application was written."],
  "redis.restored": () => ["Redis is back, empty", "This simulated restart has no persistence, so every key is gone and the first reads all miss."],
  "cache.flushed": () => ["Keyspace cleared", "FLUSHALL. Every following request misses until the cache warms up again."],
  "config.changed": (f) => configNote(f),
  "stampede.arrive": (f) => ["The crowd arrives", `${f.count} requests want the same key at the same moment.`],
  "stampede.lookup": (f) => ["All of them miss", `All ${f.count} check Redis and find nothing.`],
  "stampede.query": (f) => (f.singleFlight
    ? ["One query, the rest wait", "A short lock lets one request rebuild the entry. The others wait for its result."]
    : ["Every request hits Postgres", `${f.count} identical queries land at once, which is the load the cache was hiding.`]),
  "stampede.write": () => ["The entry is rebuilt", "Redis is warm again."],
  "stampede.done": (f) => ["Everyone is answered", `${f.count} responses go out.`],
};

const DONE: Record<RequestStatus, Note> = {
  hit: ["Done: served from memory", "Postgres wasn't touched."],
  miss: ["Done: served from Postgres", "Redis now holds a copy, so the next request can be a hit."],
  stale: ["Done, and wrong", "A fast answer, from a copy that no longer matches the database."],
  bypass: ["Done, the slow way", "The application bypassed Redis. It stayed up, and Postgres took every read."],
  failed: ["Request failed", "The client got a 503. Postgres was protected from extra load."],
};

const doneNote = (f: RedisFrame): Note => {
  const r = f.state.history[f.state.history.length - 1];
  const [title, text] = DONE[f.status as RequestStatus];
  return [title, `${r?.elapsed} ms (illustrative). ${text}`];
};

const configNote = ({ patch = {} }: RedisFrame): Note => {
  if (patch.ttl !== undefined) return ["TTL changed", `New writes will expire after ${patch.ttl} s. Entries already stored keep their expiry.`];
  if (patch.invalidation) return ["Invalidation changed", patch.invalidation === "delete" ? "Writes will delete the cached copy." : "Writes will leave the cached copy alone."];
  return ["Failure policy changed", patch.policy === "fallback" ? "If Redis fails, requests go straight to Postgres." : "If Redis fails, requests fail."];
};

export const describe = (frame: RedisFrame): Note => NOTES[frame.type](frame);

// The code panel highlights the line each transition corresponds to.
export const CODE_LINES: Partial<Record<RedisEventType, number>> = {
  "request.received": 1, "edge.forwarded": 1, "cache.lookup": 4, "cache.hit": 5, "cache.miss": 5, "cache.expired": 5,
  "cache.error": 7, "request.rejected": 7, "db.query": 9, "db.result": 9, "cache.write": 10, "response.sent": 11,
  "db.update": 15, "invalidate.deleted": 16, "invalidate.skipped": 16, "invalidate.failed": 16,
};

// Guided starting points. `setup` runs off-screen, `play` is what you watch.
