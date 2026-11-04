import type { Packet, SimFrame } from "@/lib/simulation/simulation-types";

export type McpNodeId = "user" | "host" | "model" | "files" | "calendar";
export type ServerId = "files" | "calendar";
export type ToolName = "read_file" | "list_files" | "list_events" | "create_event";
export type QuestionId = "notes" | "missing" | "free" | "book";
export type Transport = "stdio" | "http";
export type Approval = "ask" | "auto";

export type ToolDef = { name: ToolName; server: ServerId; description: string; write: boolean; inputSchema: Record<string, unknown> };

export type Call = { tool: ToolName; args: Record<string, string>; result: string; isError?: boolean };

// One JSON-RPC message on the wire, as the host's log would show it.
export type Rpc = { dir: "→" | "←"; server: ServerId; json: string };

export type ChatLine = { role: "user" | "assistant" | "tool"; text: string; tool?: ToolName; isError?: boolean };

export type McpStats = { servers: number; tools: number; messages: number; toolCalls: number; toolErrors: number; approvals: number };

export type McpState = {
  transport: Transport;
  approval: Approval;
  connected: ServerId[];
  tools: ToolDef[];          // what tools/list returned, across every server
  rpc: Rpc[];
  rpcId: number;
  chat: ChatLine[];
  question: QuestionId | null;
  pending: { question: QuestionId; index: number } | null;
  stats: McpStats;
};

export type McpEventType =
  | "ready" | "spawned" | "initialize" | "initialized" | "listed" | "tools.received" | "disconnected"
  | "asked" | "model.called" | "tool.chosen" | "approval.waiting" | "approved" | "denied"
  | "call.sent" | "call.result" | "answered" | "config.changed";

export type McpConfig = Partial<Pick<McpState, "transport" | "approval">>;

export type McpFrame = SimFrame<McpState> & {
  type: McpEventType;
  packets: Packet<McpNodeId>[];
  at?: McpNodeId;
  patch?: McpConfig;
  server?: ServerId;
  tool?: ToolName;
};

export type McpAction = (state: McpState) => McpFrame[] | null;
