// =========================================================
// A language model generating text, as a pure state model. No DOM, no timers.
//
// Models tokenisation into subword pieces, a context window that
// forgets its oldest tokens, one forward pass per token producing a
// probability for each candidate, temperature reshaping those
// probabilities, and a seeded sampler choosing one. Copying from
// earlier in the context stands in for attention.
// See llm-engine.test.ts.
//
// Simplified on purpose: the "weights" are a small table of
// continuations rather than billions of numbers, the vocabulary is
// tiny, and only the top few candidates exist.
// =========================================================

import type { Packet } from "@/lib/simulation/simulation-types";
import type { Candidate, LlmConfig, LlmEventType, LlmFrame, LlmNodeId, LlmState, PromptId } from "./llm-types";

export const END = "<end>";
export const MAX_NEW = 8;       // max_tokens: generation stops here even mid-sentence
const COPY = 0.9;               // how strongly a match earlier in the context is copied

export const PROMPTS: Record<PromptId, string> = {
  capital: "The capital of France is",
  name: "My name is Barry Allen. I live in Oxford and I like trains. Q: What is my name? A: Your name is",
  unknown: "The 1987 Pokhara chess champion was",
};

// Words the tokenizer knows whole. Anything else is split into pieces.
const VOCAB = new Set("the capital of france is my name i live in and like trains q a what your was chess champion".split(" "));

export const tokenize = (text: string) =>
  (text.match(/\s?[A-Za-z]+|\s?\d+|[^\s\w]/g) ?? []).flatMap((w) => {
    const body = w.trim();
    if (!/\w/.test(body) || VOCAB.has(body.toLowerCase())) return [w];
    const lead = w.startsWith(" ") ? " " : "";
    return (body.match(/.{1,3}/g) ?? []).map((piece, i) => (i === 0 ? lead + piece : piece));
  });

// ---------- The "weights" ----------
type Dist = [token: string, p: number][];
const STOP: Dist = [[".", 0.8], [" and", 0.2]];
const each = (words: string[], next: Dist) => words.map((w): [string, Dist] => [w, next]);

// Longest matching ending wins, so specific knowledge beats general habit.
const RULES = new Map<string, Dist>([
  [" capital of France is", [[" Paris", 0.86], [" a", 0.05], [" located", 0.04], [" the", 0.03], [" not", 0.02]]],
  [" Paris", [[".", 0.72], [",", 0.18], [" and", 0.1]]],
  [" a", [[" city", 0.5], [" country", 0.3], [" beautiful", 0.2]]],
  [" a city", [[" of", 0.45], [".", 0.35], [" in", 0.2]]],
  [" city of", [[" lights", 0.55], [" love", 0.45]]],
  [" located", [[" in", 0.95], [" near", 0.05]]],
  [" in", [[" Europe", 0.6], [" the", 0.4]]],
  [" near", [[" Europe", 0.7], [" the", 0.3]]],
  [" the", [[" north", 0.4], [" heart", 0.35], [" city", 0.25]]],
  [" heart", [[" of", 0.9], [".", 0.1]]],
  [" heart of", [[" Europe", 0.7], [" France", 0.3]]],
  [" not", [[" Lyon", 0.6], [" Nice", 0.4]]],
  [",", [[" the", 0.5], [" a", 0.5]]],
  [" and", [[" the", 0.5], [" a", 0.5]]],
  [" beautiful", [[" city", 0.7], [".", 0.3]]],
  [".", [[END, 0.93], [" It", 0.07]]],
  [" It", [[" is", 0.9], [" has", 0.1]]],
  [" is", [[" a", 0.6], [" the", 0.4]]],
  [" has", [[" a", 1]]],
  ...each([" city", " country", " Europe", " lights", " love", " Lyon", " Nice", " north", " France"], STOP),
  // Nothing in the table is about this champion. It still has to put something next.
  [" champion was", [[" Ram", 0.24], [" Hari", 0.22], [" Sita", 0.2], [" Gopal", 0.18], [" Bikash", 0.16]]],
  ...each([" Ram", " Hari", " Sita", " Gopal", " Bikash"], [[" Thapa", 0.4], [" Gurung", 0.35], [" Shrestha", 0.25]]),
  ...each([" Thapa", " Gurung", " Shrestha"], [[".", 0.85], [",", 0.15]]),
  [" name is", [[" Sam", 0.22], [" Alex", 0.21], [" Maya", 0.2], [" John", 0.19], [" Priya", 0.18]]],
  ...each([" Sam", " Alex", " Maya", " John", " Priya"], [[".", 0.9], ["!", 0.1]]),
  ["!", [[END, 1]]],
]);
const FALLBACK: Dist = [[".", 0.4], [" and", 0.3], [" the", 0.3]];

// The two latest tokens seen earlier in the context: predict what followed them.
const copyFrom = (context: string[]) => {
  const n = context.length;
  if (n < 3 || context[n - 1] === ".") return null;
  for (let i = n - 3; i >= 0; i--) {
    if (context[i] === context[n - 2] && context[i + 1] === context[n - 1]) return context[i + 2] ?? null;
  }
  return null;
};

export const predict = (context: string[]): { dist: Dist; copied: boolean } => {
  const text = context.join("");
  let best: Dist = FALLBACK, len = 0;
  for (const [after, dist] of RULES) if (after.length > len && text.endsWith(after)) [best, len] = [dist, after.length];
  const copy = copyFrom(context);
  if (!copy) return { dist: best, copied: false };
  const rest = best.filter(([t]) => t !== copy).map(([t, p]): [string, number] => [t, p * (1 - COPY)]);
  return { dist: [[copy, COPY], ...rest], copied: true };
};

// Temperature 0 means always the top choice. Higher flattens the odds.
export const reshape = (dist: Dist, temperature: number): Candidate[] => {
  const sorted = [...dist].sort((a, b) => b[1] - a[1]);
  if (temperature === 0) return sorted.map(([token, p], i) => ({ token, p, q: i === 0 ? 1 : 0 }));
  const w = sorted.map(([, p]) => p ** (1 / temperature));
  const sum = w.reduce((a, b) => a + b, 0);
  return sorted.map(([token, p], i) => ({ token, p, q: (w[i] as number) / sum }));
};

// mulberry32: a small, repeatable source of randomness.
const draw = (seed: number) => {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { seed: t, r: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
};

export const createState = (patch: LlmConfig = {}): LlmState => ({
  prompt: null,
  context: [],
  dropped: [],
  output: [],
  candidates: [],
  picked: null,
  temperature: "0",
  windowSize: "64",
  seed: 7,
  done: null,
  stats: { promptTokens: 0, generated: 0, dropped: 0, offTop: 0, unsure: 0 },
  ...patch,
});

const packet = (from: LlmNodeId, to: LlmNodeId, label: string, kind: Packet["kind"] = "request"): Packet<LlmNodeId> => ({ from, to, label, kind });
export const show = (token: string) => (token === END ? END : token.replace(/^ /, "␣"));

// Keeps the newest `windowSize` tokens. Whatever falls off is gone for good.
const trim = (s: LlmState): [LlmState, number] => {
  const over = s.context.length - Number(s.windowSize);
  if (over <= 0) return [s, 0];
  return [{ ...s, context: s.context.slice(over), dropped: [...s.dropped, ...s.context.slice(0, over)], stats: { ...s.stats, dropped: s.stats.dropped + over } }, over];
};

const frame = (type: LlmEventType, state: LlmState, at: LlmNodeId, packets: Packet<LlmNodeId>[], meta: Partial<LlmFrame> = {}): LlmFrame =>
  ({ type, state, packets, at, dur: 750, ...meta });

// ---------- A prompt starts a new conversation ----------
export const submit = (state: LlmState, prompt: PromptId): LlmFrame[] => {
  const tokens = tokenize(PROMPTS[prompt]);
  const sent: LlmState = { ...state, prompt, context: [], dropped: [], output: [], candidates: [], picked: null, done: null,
    stats: { promptTokens: 0, generated: 0, dropped: 0, offTop: 0, unsure: 0 } };
  const frames = [frame("prompt.sent", sent, "tokenizer", [packet("prompt", "tokenizer", `${PROMPTS[prompt].length} chars`)])];
  const loaded = { ...sent, context: tokens, stats: { ...sent.stats, promptTokens: tokens.length } };
  frames.push(frame("tokenized", loaded, "context", [packet("tokenizer", "context", `${tokens.length} tokens`, "value")]));
  const [trimmed, over] = trim(loaded);
  if (over) frames.push(frame("context.trimmed", trimmed, "context", [], { trimmed: over, dur: 900 }));
  return frames;
};

// ---------- One token: a forward pass, a draw, an append ----------
export const step = (state: LlmState): LlmFrame[] | null => {
  if (!state.prompt || state.done) return null;
  const frames: LlmFrame[] = [frame("forward", state, "model", [packet("context", "model", `${state.context.length} tokens`)])];
  const { dist, copied } = predict(state.context);
  const candidates = reshape(dist, Number(state.temperature));
  const top = candidates[0] as Candidate;
  const scored = { ...state, candidates };
  frames.push(frame("scored", scored, "sampler", [packet("model", "sampler", `${show(top.token)} ${Math.round(top.p * 100)}%`, "value")], { copied }));

  let seed = state.seed, r = 0;
  if (state.temperature !== "0") ({ seed, r } = draw(state.seed));
  let acc = 0;
  const pick = candidates.find((c) => (acc += c.q) > r) ?? top;
  const stats = { ...state.stats, generated: state.stats.generated + 1, offTop: state.stats.offTop + (pick === top ? 0 : 1), unsure: state.stats.unsure + (top.p < 0.5 ? 1 : 0) };
  const sampled: LlmState = { ...scored, seed, picked: pick.token, stats };

  if (pick.token === END) {
    frames.push(frame("sampled", sampled, "output", [packet("sampler", "output", END, "value")], { copied }));
    frames.push(frame("finished", { ...sampled, done: "stop" }, "output", []));
    return frames;
  }
  const written = { ...sampled, output: [...sampled.output, pick.token] };
  frames.push(frame("sampled", written, "output", [packet("sampler", "output", show(pick.token), "value")], { copied }));
  const [appended, over] = trim({ ...written, context: [...written.context, pick.token] });
  frames.push(frame("appended", appended, "context", [packet("output", "context", show(pick.token))], { trimmed: over }));
  if (appended.output.length >= MAX_NEW) frames.push(frame("finished", { ...appended, done: "length" }, "output", []));
  return frames;
};

// Generates until the model picks <end> or hits max_tokens.
export const complete = (state: LlmState): LlmFrame[] | null => {
  const frames: LlmFrame[] = [];
  let s = state;
  for (let out = step(s); out; out = step(s)) {
    frames.push(...out);
    s = out[out.length - 1]!.state;
  }
  return frames.length ? frames : null;
};

export const configure = (state: LlmState, patch: LlmConfig): LlmFrame[] => {
  const [s, over] = trim({ ...state, ...patch });
  return [{ type: "config.changed", state: s, packets: [], dur: 1, patch, trimmed: over }];
};

export const text = (s: LlmState) => s.output.join("");

export const runAll = (state: LlmState, ...actions: ((s: LlmState) => LlmFrame[] | null)[]) => {
  let s = state;
  const frames: LlmFrame[] = [];
  for (const action of actions) {
    const out = action(s) ?? [];
    frames.push(...out);
    s = out[out.length - 1]?.state ?? s;
  }
  return { state: s, frames };
};
