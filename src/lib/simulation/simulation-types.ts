// What every simulation hands to the Timeline: the complete state after one
// transition, and how long that transition should take to show.
export type SimFrame<State> = {
  state: State;
  dur: number;
};

// One unit of data moving along a wire in a system diagram.
export type PacketKind = "request" | "command" | "value" | "miss" | "stale" | "error";

export type Packet<NodeId extends string = string> = {
  from: NodeId;
  to: NodeId;
  label: string;
  kind: PacketKind;
};
