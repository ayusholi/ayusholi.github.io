import type { Packet, SimFrame } from "@/lib/simulation/simulation-types";

export type AutoNodeId = "trigger" | "ai" | "router" | "sheet" | "chat" | "reply";
export type EmailId = "order" | "complaint" | "spam" | "messy";
export type Category = "order" | "complaint" | "spam";
export type OnError = "stop" | "retry";
export type Dedupe = "off" | "on";

// The JSON item each node receives, adds to and passes on.
export type Item = {
  messageId: string;
  from: string;
  subject: string;
  category?: Category;
  orderId?: string | null;
  urgent?: boolean;
};

export type Execution = { n: number; email: EmailId; messageId: string; status: "running" | "success" | "error" | "skipped"; path: AutoNodeId[] };

export type AutoStats = { executions: number; failed: number; aiCalls: number; rows: number; replies: number; alerts: number };

export type AutoState = {
  item: Item | null;
  raw: string | null;                // the AI node's last reply, before parsing
  executions: Execution[];
  seen: string[];                    // message ids already handled, for dedupe
  rows: { orderId: string; from: string }[];
  replies: string[];                 // addresses that got an auto-reply
  last: { email: EmailId; messageId: string } | null;
  onError: OnError;
  dedupe: Dedupe;
  next: number;
  stats: AutoStats;
};

export type AutoEventType =
  | "ready" | "triggered" | "duplicate.skipped" | "ai.called" | "ai.output" | "ai.invalid" | "ai.retried"
  | "routed" | "dropped" | "row.added" | "alert.posted" | "reply.sent" | "execution.done" | "execution.failed" | "config.changed";

export type AutoConfig = Partial<Pick<AutoState, "onError" | "dedupe">>;

export type AutoFrame = SimFrame<AutoState> & {
  type: AutoEventType;
  packets: Packet<AutoNodeId>[];
  at?: AutoNodeId;
  patch?: AutoConfig;
};

export type AutoAction = (state: AutoState) => AutoFrame[] | null;
