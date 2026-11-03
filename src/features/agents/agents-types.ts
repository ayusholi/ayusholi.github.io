import type { Packet, SimFrame } from "@/lib/simulation/simulation-types";

export type AgentsNodeId = "user" | "runtime" | "model" | "weather" | "web" | "email";
export type ToolId = "weather" | "web" | "email";
export type TaskId = "weather" | "hike" | "research" | "loop";
export type Approval = "auto" | "ask";
export type Limit = "4" | "10";

export type Call = { tool: ToolId; name: string; args: string; to?: number };

// What the model sees: every turn so far, sent again on every call.
export type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; call: Call }
  | { role: "assistant"; answer: string }
  | { role: "tool"; tool: ToolId; status: "ok" | "error" | "denied"; text: string };

export type AgentsStats = { modelCalls: number; toolCalls: number; toolErrors: number; recipients: number; tokens: number };

export type AgentsState = {
  task: TaskId | null;
  transcript: Message[];
  steps: number;               // tool calls made on this task
  approval: Approval;          // side-effecting tools wait for a person
  limit: Limit;                // the runtime's step budget
  weatherDown: boolean;
  pending: Call | null;
  outbox: { to: number; subject: string }[];
  done: "answered" | "limit" | null;
  stats: AgentsStats;
};

export type AgentsEventType =
  | "ready" | "task.sent" | "model.called" | "tool.requested" | "approval.waiting" | "approved" | "denied"
  | "tool.called" | "tool.returned" | "tool.failed" | "model.answered" | "answer.delivered" | "limit.reached" | "config.changed";

export type AgentsConfig = Partial<Pick<AgentsState, "approval" | "limit" | "weatherDown">>;

export type AgentsFrame = SimFrame<AgentsState> & {
  type: AgentsEventType;
  packets: Packet<AgentsNodeId>[];
  at?: AgentsNodeId;
  tool?: ToolId;
  patch?: AgentsConfig;
};

export type AgentsAction = (state: AgentsState) => AgentsFrame[] | null;
