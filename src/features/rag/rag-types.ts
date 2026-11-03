import type { Packet, SimFrame } from "@/lib/simulation/simulation-types";

export type RagNodeId = "docs" | "chunker" | "index" | "user" | "retriever" | "model";
export type QuestionId = "return" | "refund" | "ship" | "kayak";
export type SearchMode = "vector" | "keyword";
export type Retrieval = "on" | "off";

export type Doc = { id: string; version: number; sentences: string[] };

// One searchable piece of one version of a document.
export type Chunk = { id: string; doc: string; version: number; text: string; vector: number[] };
export type Hit = { chunk: Chunk; score: number; used: boolean };

export type Answer = { text: string; cites: string[]; kind: "grounded" | "not-found" | "unsupported"; stale: boolean };

export type RagStats = { questions: number; grounded: number; notFound: number; unsupported: number; stale: number };

export type RagState = {
  docs: Doc[];
  index: Chunk[];
  question: QuestionId | null;
  hits: Hit[];               // the nearest chunks, best first
  answer: Answer | null;
  mode: SearchMode;
  retrieval: Retrieval;
  stats: RagStats;
};

export type RagEventType =
  | "ready" | "docs.chunked" | "chunks.indexed" | "policy.updated" | "question.asked" | "question.embedded"
  | "index.searched" | "chunks.found" | "prompt.built" | "answered" | "config.changed";

export type RagConfig = Partial<Pick<RagState, "mode" | "retrieval">>;

export type RagFrame = SimFrame<RagState> & {
  type: RagEventType;
  packets: Packet<RagNodeId>[];
  at?: RagNodeId;
  count?: number;
  patch?: RagConfig;
};

export type RagAction = (state: RagState) => RagFrame[] | null;
