import type { Packet, SimFrame } from "@/lib/simulation/simulation-types";

export type LlmNodeId = "prompt" | "tokenizer" | "context" | "model" | "sampler" | "output";
export type PromptId = "capital" | "name" | "unknown";
export type Temperature = "0" | "0.8" | "1.5";
export type WindowSize = "16" | "64";

// One next-token option: what the model scored, and what the sampler draws from.
export type Candidate = { token: string; p: number; q: number };

export type LlmStats = { promptTokens: number; generated: number; dropped: number; offTop: number; unsure: number };

export type LlmState = {
  prompt: PromptId | null;
  context: string[];         // the tokens the model can see, oldest first
  dropped: string[];         // fell out of the window: the model will never see them again
  output: string[];
  candidates: Candidate[];   // the last forward pass, most likely first
  picked: string | null;
  temperature: Temperature;
  windowSize: WindowSize;
  seed: number;              // the sampler's random state
  done: "stop" | "length" | null;
  stats: LlmStats;
};

export type LlmEventType =
  | "ready" | "prompt.sent" | "tokenized" | "context.trimmed" | "forward" | "scored" | "sampled" | "appended" | "finished" | "config.changed";

export type LlmConfig = Partial<Pick<LlmState, "temperature" | "windowSize" | "seed">>;

export type LlmFrame = SimFrame<LlmState> & {
  type: LlmEventType;
  packets: Packet<LlmNodeId>[];
  at?: LlmNodeId;
  trimmed?: number;
  copied?: boolean;          // the top candidate came from earlier in the context
  patch?: LlmConfig;
};

export type LlmAction = (state: LlmState) => LlmFrame[] | null;
