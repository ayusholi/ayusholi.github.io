import type { Packet, SimFrame } from "@/lib/simulation/simulation-types";

export type RedisNodeId = "client" | "edge" | "app" | "redis" | "db";
export type FailurePolicy = "fallback" | "strict";
export type Invalidation = "delete" | "none";
export type RequestStatus = "hit" | "miss" | "stale" | "bypass" | "failed";
export type SegmentKind = "network" | "redis" | "postgres" | "timeout";

export type UserRecord = { name: string; plan: string; version: number };

export type CacheEntry = { value: UserRecord; storedAt: number; expiresAt: number };

export type Latency = { client: number; edge: number; redis: number; db: number; redisTimeout: number };

export type RequestTrace = {
  id: number;
  key: string;
  elapsed: number;
  segments: { node: SegmentKind; ms: number }[];
  status: RequestStatus | null;
  reason: "hit" | "missing" | "expired" | null;
  value?: UserRecord | null;
};

export type RedisStats = { requests: number; hits: number; misses: number; dbQueries: number; failed: number; stale: number };

export type RedisState = {
  now: number;                          // simulated milliseconds, the only clock
  ttl: number;                          // seconds
  policy: FailurePolicy;
  invalidation: Invalidation;
  edge: boolean;                        // route through Nginx (homepage only)
  latency: Latency;
  redisUp: boolean;
  db: Record<string, UserRecord>;
  cache: Record<string, CacheEntry>;
  stats: RedisStats;
  history: RequestTrace[];              // finished requests, newest last
  log: { cmd: string; reply: string }[];// commands as they would appear on the wire
  req: RequestTrace | null;             // the request in flight
};

export type RedisEventType =
  | "ready"
  | "request.start" | "request.received" | "request.rejected" | "request.done"
  | "edge.received" | "edge.forwarded" | "edge.response"
  | "cache.lookup" | "cache.hit" | "cache.miss" | "cache.expired" | "cache.error" | "cache.write" | "cache.flushed"
  | "db.query" | "db.result" | "db.update"
  | "response.sent" | "response.stale"
  | "clock.advanced" | "config.changed"
  | "invalidate.deleted" | "invalidate.skipped" | "invalidate.failed"
  | "redis.down" | "redis.restored"
  | "stampede.arrive" | "stampede.lookup" | "stampede.query" | "stampede.write" | "stampede.done";

export type RedisConfig = Partial<Pick<RedisState, "ttl" | "policy" | "invalidation">>;

export type RedisFrame = SimFrame<RedisState> & {
  type: RedisEventType;
  packets: Packet<RedisNodeId>[];
  at?: RedisNodeId;
  key?: string;
  value?: UserRecord;
  status?: RequestStatus;
  seconds?: number;
  count?: number;
  singleFlight?: boolean;
  patch?: RedisConfig;
};

export type RedisAction = (state: RedisState) => RedisFrame[] | null;
