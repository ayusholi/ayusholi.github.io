"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { SystemDiagram, type DiagramHandle, type DiagramLayout, type DiagramNode } from "@/components/simulation/SystemDiagram";
import type { Timeline } from "@/lib/simulation/timeline";
import { ROLES } from "./redis-content";
import { isLive } from "./redis-engine";
import type { RedisFrame, RedisNodeId } from "./redis-types";

// The cache-aside diagram. Draws frames and owns no logic. Used by the Redis
// topic and the publication homepage.
const CELLS = 2;   // one slot per demo key

const LAYOUTS: Record<"plain" | "edge", DiagramLayout> = {
  plain: (w) => (w < 620
    ? { height: 470, at: { client: [0.5, 62], app: [0.5, 214], redis: [0.26, 376], db: [0.74, 376] } }
    : { height: 400, at: { client: [0.13, 200], app: [0.47, 200], redis: [0.84, 86], db: [0.84, 314] } }),
  edge: (w) => (w < 620
    ? { height: 560, at: { client: [0.5, 56], edge: [0.5, 180], app: [0.5, 306], redis: [0.26, 466], db: [0.74, 466] } }
    : { height: 330, at: { client: [0.1, 165], edge: [0.335, 165], app: [0.575, 165], redis: [0.875, 68], db: [0.875, 262] } }),
};
const HEIGHTS = { plain: { wide: 400, narrow: 470 }, edge: { wide: 330, narrow: 560 } };

const EDGES: Record<"plain" | "edge", [RedisNodeId, RedisNodeId][]> = {
  plain: [["client", "app"], ["app", "redis"], ["app", "db"]],
  edge: [["client", "edge"], ["edge", "app"], ["app", "redis"], ["app", "db"]],
};

type Props = {
  timeline: Timeline<RedisFrame>;
  frame: RedisFrame;
  edge?: boolean;
  selected: RedisNodeId | null;
  onSelect: (id: RedisNodeId | null) => void;
};

export const RedisSchematic = ({ timeline, frame, edge = false, selected, onSelect }: Props) => {
  const diagram = useRef<DiagramHandle>(null);
  const variant = edge ? "edge" : "plain";
  const instant = timeline.instant;
  const s = frame.state;

  useLayoutEffect(() => {
    diagram.current?.setPackets(instant ? [] : frame.packets);
  }, [frame, instant]);
  useEffect(() => timeline.onProgress((t) => diagram.current?.progress(t)), [timeline]);

  const keys = Object.values(s.cache);
  const live = keys.filter((k) => isLive(k, s.now)).length;
  // A hit should visibly leave the database out of it.
  const done = frame.type === "request.done" ? s.history[s.history.length - 1] : null;
  const avoided = s.req?.reason === "hit" || done?.status === "hit" || done?.status === "stale";

  const ids: RedisNodeId[] = edge ? ["client", "edge", "app", "redis", "db"] : ["client", "app", "redis", "db"];
  const nodes: DiagramNode[] = ids.map((id) => {
    const role = ROLES[id];
    const node: DiagramNode = {
      id, name: role.name, sub: role.sub, ariaLabel: `${role.name}: ${role.sub}. Inspect`,
      active: frame.at === id && !instant, selected: selected === id,
    };
    if (id === "redis") {
      node.down = !s.redisUp;
      node.sub = s.redisUp ? role.sub : "✕ Unavailable";
      node.tag = s.redisUp ? `${live} live` : "down";
      node.cells = Array.from({ length: CELLS }, (_, i) => {
        const entry = keys[i];
        return entry ? (isLive(entry, s.now) ? "on" : "ghost") : "off";
      });
    }
    if (id === "db") {
      node.rested = avoided;
      node.sub = avoided ? "Not queried" : role.sub;
      node.tag = `${s.stats.dbQueries} ${s.stats.dbQueries === 1 ? "query" : "queries"}`;
    }
    return node;
  });

  return (
    <SystemDiagram
      ref={diagram}
      nodes={nodes}
      edges={EDGES[variant]}
      layout={LAYOUTS[variant]}
      heights={HEIGHTS[variant]}
      onSelect={(id) => onSelect(selected === id ? null : id as RedisNodeId)}
    />
  );
};
