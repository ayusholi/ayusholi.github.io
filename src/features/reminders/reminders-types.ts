import type { Packet, SimFrame } from "@/lib/simulation/simulation-types";

export type RemNodeId = "phone" | "whatsapp" | "server" | "ai" | "db" | "scheduler";
export type MessageId = "rent" | "pills" | "later";
export type Tz = "user" | "server";
export type Template = "off" | "on";

// Times are minutes since midnight at the start of Monday, Kathmandu time.
export type Reminder = {
  id: number;
  task: string;
  due: number;
  intended: number;        // when the user meant
  repeat: "daily" | null;
  status: "scheduled" | "done";
  delivered: number;
  rejected: number;
  last: "delivered" | "rejected" | null;
};

export type ChatLine = { from: "you" | "bot"; text: string; at: number; template?: boolean; failed?: boolean };

export type Parsed = { task: string; at: string | null; timezone: string; repeat: "daily" | null };

export type ApiCall = { type: "text" | "template"; to: string; task: string; text: string; status: "sent" | "failed" };

export type RemStats = { messagesIn: number; aiCalls: number; saved: number; delivered: number; rejected: number; questions: number };

export type RemState = {
  now: number;
  lastIn: number | null;     // when the user last messaged: opens the 24-hour window
  tz: Tz;
  template: Template;
  reminders: Reminder[];
  chat: ChatLine[];
  parsed: Parsed | null;
  api: ApiCall | null;
  firing: number | null;     // the reminder the scheduler handled last
  next: number;
  stats: RemStats;
};

export type RemEventType =
  | "ready" | "message.in" | "webhook" | "ai.parsed" | "ai.unclear" | "saved" | "confirmed" | "asked"
  | "clock" | "due" | "window.open" | "window.closed" | "delivered" | "rejected" | "rescheduled" | "config.changed";

export type RemConfig = Partial<Pick<RemState, "tz" | "template">>;

export type RemFrame = SimFrame<RemState> & {
  type: RemEventType;
  packets: Packet<RemNodeId>[];
  at?: RemNodeId;
  patch?: RemConfig;
};

export type RemAction = (state: RemState) => RemFrame[] | null;
