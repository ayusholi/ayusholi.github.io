// =========================================================
// Retrieval-augmented generation, as a pure state model. No DOM, no timers.
//
// Models documents split into chunks, each chunk embedded as a vector,
// a question embedded the same way and compared by cosine similarity,
// the closest chunks pasted into the prompt, and a model told to
// answer only from them. Also models keyword search for comparison,
// a relevance threshold, and an index that falls behind its documents.
// See rag-engine.test.ts.
//
// Simplified on purpose: embeddings have nine hand-named dimensions
// instead of hundreds of learned ones, chunks are single sentences,
// and the model's answer quotes the best chunk.
// =========================================================

import type { Packet } from "@/lib/simulation/simulation-types";
import type { Answer, Chunk, Doc, Hit, QuestionId, RagConfig, RagEventType, RagFrame, RagNodeId, RagState } from "./rag-types";

export const K = 3;              // chunks retrieved per question
export const THRESHOLD = 0.3;    // below this, a chunk isn't relevant enough to use

export const QUESTIONS: Record<QuestionId, string> = {
  return: "How long do I have to send a jacket back?",
  refund: "When will I get my money back?",
  ship: "Is delivery free?",
  kayak: "Do you sell kayaks?",
};

// What the model says from training alone. It has never seen this shop's documents.
const GUESSES: Record<QuestionId, string> = {
  return: "Most outdoor shops accept returns within 14 to 30 days. Check your receipt.",
  refund: "Refunds usually take 3 to 10 business days.",
  ship: "Many shops offer free delivery on larger orders.",
  kayak: "Yes, Himal Gear stocks a range of kayaks and paddles.",
};

export const DOCS: Doc[] = [
  { id: "returns.md", version: 1, sentences: ["You can return unworn items within 30 days for a full refund.", "Refunds reach your card in 5 to 7 working days."] },
  { id: "shipping.md", version: 1, sentences: ["We ship anywhere in Nepal in 2 to 4 days.", "Shipping is free on orders over Rs 5,000.", "International orders take 7 to 14 days."] },
  { id: "warranty.md", version: 1, sentences: ["Tents and jackets have a two-year warranty against manufacturing faults.", "Send faulty gear with a photo of the problem."] },
];
const NEW_POLICY = "You can return unworn items within 14 days for a full refund.";

// ---------- Embeddings: text → a direction in "meaning space" ----------
export const DIMENSIONS = ["return", "refund", "time", "shipping", "price", "product", "warranty", "water", "place"] as const;
const CONCEPTS: Record<string, (typeof DIMENSIONS)[number]> = {
  return: "return", returns: "return", send: "return",
  refund: "refund", refunds: "refund", money: "refund", card: "refund",
  days: "time", long: "time", when: "time", within: "time", take: "time",
  ship: "shipping", shipping: "shipping", delivery: "shipping", orders: "shipping", international: "shipping",
  free: "price", rs: "price", cost: "price", price: "price",
  items: "product", jacket: "product", jackets: "product", tents: "product", gear: "product",
  warranty: "warranty", faults: "warranty", faulty: "warranty", problem: "warranty",
  kayak: "water", kayaks: "water", paddles: "water",
  nepal: "place", anywhere: "place",
};
const STOP = new Set("you can i do have to a the for in on of is are we my will get your how when with what over any and".split(" "));

const words = (text: string) => text.toLowerCase().match(/[a-z]+/g) ?? [];

export const embed = (text: string) => {
  const v = DIMENSIONS.map(() => 0);
  for (const w of words(text)) {
    const dim = CONCEPTS[w];
    if (dim) v[DIMENSIONS.indexOf(dim)]! += 1;
  }
  return v;
};

const cosine = (a: number[], b: number[]) => {
  const dot = a.reduce((n, x, i) => n + x * (b[i] ?? 0), 0);
  const mag = Math.hypot(...a) * Math.hypot(...b);
  return mag ? dot / mag : 0;
};

// Shared words only, the way a plain text search would score it.
const keywordScore = (q: string, text: string) => {
  const a = new Set(words(q).filter((w) => !STOP.has(w))), b = new Set(words(text).filter((w) => !STOP.has(w)));
  const shared = [...a].filter((w) => b.has(w)).length;
  return a.size && b.size ? shared / Math.sqrt(a.size * b.size) : 0;
};

export const search = (s: RagState, question: QuestionId): Hit[] => {
  const q = QUESTIONS[question], qv = embed(q);
  return s.index
    .map((chunk) => ({ chunk, score: s.mode === "vector" ? cosine(qv, chunk.vector) : keywordScore(q, chunk.text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, K)
    .map((h) => ({ ...h, score: Math.round(h.score * 100) / 100, used: h.score >= THRESHOLD }));
};

export const createState = (patch: RagConfig = {}): RagState => ({
  docs: DOCS,
  index: [],
  question: null,
  hits: [],
  answer: null,
  mode: "vector",
  retrieval: "on",
  stats: { questions: 0, grounded: 0, notFound: 0, unsupported: 0, stale: 0 },
  ...patch,
});

const packet = (from: RagNodeId, to: RagNodeId, label: string, kind: Packet["kind"] = "request"): Packet<RagNodeId> => ({ from, to, label, kind });
const frame = (type: RagEventType, state: RagState, at: RagNodeId, packets: Packet<RagNodeId>[], meta: Partial<RagFrame> = {}): RagFrame =>
  ({ type, state, packets, at, dur: 750, ...meta });

// Documents whose current version isn't the one in the index.
export const outdated = (s: RagState) => s.docs.filter((d) => !s.index.some((c) => c.doc === d.id && c.version === d.version));
export const isStale = (s: RagState, chunk: Chunk) => s.docs.find((d) => d.id === chunk.doc)?.version !== chunk.version;

// ---------- Ingestion: chunk, embed, store ----------
export const reindex = (state: RagState): RagFrame[] | null => {
  const changed = outdated(state);
  if (!changed.length) return null;
  const chunks: Chunk[] = changed.flatMap((d) => d.sentences.map((text, i) => ({ id: `${d.id}#${i + 1}`, doc: d.id, version: d.version, text, vector: embed(text) })));
  const ids = new Set(changed.map((d) => d.id));
  const indexed = { ...state, index: [...state.index.filter((c) => !ids.has(c.doc)), ...chunks] };
  return [
    frame("docs.chunked", state, "chunker", [packet("docs", "chunker", `${changed.length} doc${changed.length === 1 ? "" : "s"}`)], { count: chunks.length }),
    frame("chunks.indexed", indexed, "index", [packet("chunker", "index", `${chunks.length} vectors`, "value")], { count: chunks.length }),
  ];
};

// The source changes. Nothing tells the index.
export const updatePolicy = (state: RagState): RagFrame[] | null => {
  const returns = state.docs.find((d) => d.id === "returns.md");
  if (!returns || returns.sentences[0] === NEW_POLICY) return null;
  const docs = state.docs.map((d) => (d.id === "returns.md" ? { ...d, version: d.version + 1, sentences: [NEW_POLICY, ...d.sentences.slice(1)] } : d));
  return [frame("policy.updated", { ...state, docs }, "docs", [], { dur: 900 })];
};

// ---------- A question ----------
const answerFrom = (s: RagState, question: QuestionId, hits: Hit[]): Answer => {
  if (s.retrieval === "off") return { text: GUESSES[question], cites: [], kind: "unsupported", stale: false };
  const used = hits.filter((h) => h.used);
  const best = used[0];
  if (!best) return { text: "The documents I was given don't cover that, so I can't say.", cites: [], kind: "not-found", stale: false };
  return { text: `${best.chunk.text} [${best.chunk.doc}]`, cites: [...new Set(used.map((h) => h.chunk.doc))], kind: "grounded", stale: isStale(s, best.chunk) };
};

const tally = (s: RagState, a: Answer): RagState => ({
  ...s, answer: a, stats: {
    ...s.stats,
    grounded: s.stats.grounded + (a.kind === "grounded" ? 1 : 0),
    notFound: s.stats.notFound + (a.kind === "not-found" ? 1 : 0),
    unsupported: s.stats.unsupported + (a.kind === "unsupported" ? 1 : 0),
    stale: s.stats.stale + (a.stale ? 1 : 0),
  },
});

export const ask = (state: RagState, question: QuestionId): RagFrame[] => {
  const asked: RagState = { ...state, question, hits: [], answer: null, stats: { ...state.stats, questions: state.stats.questions + 1 } };
  const frames = [frame("question.asked", asked, "retriever", [packet("user", "retriever", "question")])];
  if (state.retrieval === "off") {
    frames.push(frame("prompt.built", asked, "model", [packet("retriever", "model", "question only")], { count: 0 }));
    frames.push(frame("answered", tally(asked, answerFrom(asked, question, [])), "user", [packet("model", "user", "answer", "stale")]));
    return frames;
  }
  const hits = search(asked, question);
  const used = hits.filter((h) => h.used).length;
  frames.push(frame("question.embedded", asked, "retriever", []));
  frames.push(frame("index.searched", asked, "index", [packet("retriever", "index", `nearest ${K}`)]));
  const found = { ...asked, hits };
  frames.push(frame("chunks.found", found, "retriever", [packet("index", "retriever", used ? `${used} relevant` : "none close", used ? "value" : "miss")], { count: used }));
  frames.push(frame("prompt.built", found, "model", [packet("retriever", "model", `question + ${used} chunk${used === 1 ? "" : "s"}`)], { count: used }));
  const answer = answerFrom(found, question, hits);
  frames.push(frame("answered", tally(found, answer), "user", [packet("model", "user", answer.kind === "grounded" ? answer.cites.join(", ") : "no source", answer.kind === "grounded" && !answer.stale ? "value" : "stale")]));
  return frames;
};

export const configure = (state: RagState, patch: RagConfig): RagFrame[] => [{ type: "config.changed", state: { ...state, ...patch }, packets: [], dur: 1, patch }];

// The prompt the model actually receives.
export const promptLines = (s: RagState) => {
  if (!s.question) return ["(no question yet)"];
  if (s.retrieval === "off") return [`User: ${QUESTIONS[s.question]}`];
  const used = s.hits.filter((h) => h.used);
  return [
    "Answer using only the context below. If the answer isn't there, say so.",
    "",
    "Context:",
    ...(used.length ? used.map((h, i) => `[${i + 1}] ${h.chunk.doc}: ${h.chunk.text}`) : ["(nothing relevant found)"]),
    "",
    `Question: ${QUESTIONS[s.question]}`,
  ];
};

export const runAll = (state: RagState, ...actions: ((s: RagState) => RagFrame[] | null)[]) => {
  let s = state;
  const frames: RagFrame[] = [];
  for (const action of actions) {
    const out = action(s) ?? [];
    frames.push(...out);
    s = out[out.length - 1]?.state ?? s;
  }
  return { state: s, frames };
};
