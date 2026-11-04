import type { Packet, SimFrame } from "@/lib/simulation/simulation-types";

export type NginxNodeId = "clients" | "nginx" | "disk" | "app1" | "app2" | "app3";
export type Upstream = "app1" | "app2" | "app3";
export type Model = "event" | "threads";
export type Buffering = "on" | "off";
export type RequestKind = "page" | "static" | "slow";

export type Req = {
  n: number;
  kind: RequestKind;
  path: string;
  tried: Upstream[];               // upstreams attempted, in order
  upstream: Upstream | null;       // the one that answered
  status: "running" | "200" | "502" | "timeout";
  ms: number;                      // what the client waited
};

export type UpstreamState = { up: boolean; marked: boolean; served: number };

export type NginxStats = { requests: number; errors: number; retries: number; connections: number; waiting: number; memoryMb: number; appBusyMs: number };

export type NginxState = {
  model: Model;
  buffering: Buffering;
  upstreams: Record<Upstream, UpstreamState>;
  rr: number;                      // where round robin starts next
  idle: number;                    // keep-alive connections the visitor has opened
  requests: Req[];
  next: number;
  stats: NginxStats;
};

export type NginxEventType =
  | "ready" | "burst.arrived" | "burst.held" | "burst.threads" | "accepted" | "queued" | "timed.out"
  | "static.read" | "proxied" | "upstream.ok" | "upstream.refused" | "no.live" | "buffered" | "unbuffered"
  | "responded" | "app.down" | "app.up" | "config.changed";

export type NginxConfig = Partial<Pick<NginxState, "model" | "buffering">>;

export type NginxFrame = SimFrame<NginxState> & {
  type: NginxEventType;
  packets: Packet<NginxNodeId>[];
  at?: NginxNodeId;
  patch?: NginxConfig;
  app?: Upstream;
};

export type NginxAction = (state: NginxState) => NginxFrame[] | null;
