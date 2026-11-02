"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { Timeline } from "@/lib/simulation/timeline";
import type { Packet, SimFrame } from "@/lib/simulation/simulation-types";
import { SystemDiagram, type DiagramHandle, type DiagramLayout, type DiagramNode } from "./SystemDiagram";

// A SystemDiagram played by a timeline: the current frame's packets travel
// its wires as the frame plays. Draws frames and owns no logic.
type Props<F extends SimFrame<unknown> & { packets: Packet[] }> = {
  timeline: Timeline<F>;
  frame: F;
  nodes: DiagramNode[];
  edges: [string, string][];
  layout: DiagramLayout;
  heights: { wide: number; narrow: number };
  onSelect: (id: string) => void;
};

export const LiveDiagram = <F extends SimFrame<unknown> & { packets: Packet[] }>({ timeline, frame, ...diagram }: Props<F>) => {
  const ref = useRef<DiagramHandle>(null);
  const instant = timeline.instant;
  useLayoutEffect(() => {
    ref.current?.setPackets(instant ? [] : frame.packets);
  }, [frame, instant]);
  useEffect(() => timeline.onProgress((t) => ref.current?.progress(t)), [timeline]);
  return <SystemDiagram ref={ref} {...diagram} />;
};
