// The LLM's words, kept apart from its logic. `describe` narrates a frame from
// the state that frame holds, so the caption can't disagree with the simulation.
import { END, MAX_NEW, PROMPTS, show, text } from "./llm-engine";
import type { LlmEventType, LlmFrame, LlmNodeId, LlmState } from "./llm-types";

export const ROLES: Record<LlmNodeId, { name: string; sub: string; role: string }> = {
  prompt: { name: "Prompt", sub: "Plain text", role: "What you type, plus everything a chat app adds around it: the system prompt and the conversation so far. To the model it's all one long piece of text." },
  tokenizer: { name: "Tokenizer", sub: "Text → tokens", role: "Splits text into tokens: whole common words, and pieces of rarer ones. “Pokhara” becomes three tokens. Models count, price and limit everything in tokens, not words." },
  context: { name: "Context window", sub: "What it can see", role: "The fixed number of tokens the model reads on each pass. Generated tokens are added here too. When it's full, the oldest tokens are dropped, and the model has no other memory." },
  model: { name: "Model", sub: "One forward pass", role: "A fixed function learned in training. It reads the whole context and returns a score for every token in its vocabulary. It doesn't change while you use it, and it doesn't look anything up." },
  sampler: { name: "Sampler", sub: "Picks one", role: "Turns scores into a choice. Temperature 0 always takes the top token. Higher temperatures flatten the odds so less likely tokens get drawn. This is the only random step." },
  output: { name: "Output", sub: "Streamed out", role: "Each picked token is shown to you and appended to the context for the next pass. Generation stops at an end token, or when max_tokens runs out." },
};

type Note = [title: string, text: string];

const pct = (p: number) => `${Math.round(p * 100)}%`;
const top = (s: LlmState) => s.candidates[0];

const NOTES: Record<LlmEventType, (f: LlmFrame) => Note> = {
  ready: () => ["Ready", "Pick a prompt and watch it become one token at a time."],
  "prompt.sent": (f) => ["A prompt arrives", `“${f.state.prompt ? PROMPTS[f.state.prompt] : ""}”. A new conversation: nothing from before carries over.`],
  tokenized: (f) => [`${f.state.stats.promptTokens} tokens`, `${f.state.context.map(show).join(" · ")}. Words it doesn't know whole are split into pieces.`],
  "context.trimmed": (f) => [`${f.trimmed} tokens fall out`, `The context holds ${f.state.windowSize} tokens. The oldest tokens are dropped before the model sees anything: “${f.state.dropped.join("").trim()}”.`],
  forward: (f) => [`Forward pass ${f.state.stats.generated + 1}`, `The model reads all ${f.state.context.length} tokens it can see, every time, to produce one token.`],
  scored: (f) => {
    const t = top(f.state);
    if (!t) return ["Scored", ""];
    if (f.copied) return [`${show(t.token)} scores ${pct(t.p)}`, "The last two tokens appeared earlier in the context. The model copies what followed them: this is how it “remembers”."];
    return t.p < 0.5
      ? [`No clear favourite: ${show(t.token)} at ${pct(t.p)}`, "Nothing it learned settles this. The options are close, and one will be picked regardless."]
      : [`${show(t.token)} scores ${pct(t.p)}`, `The most likely next token. ${f.state.candidates.length - 1} others share the rest.`];
  },
  sampled: (f) => {
    const s = f.state, t = top(s);
    if (s.picked === END) return ["The model picks <end>", "Stopping is a token like any other."];
    if (t && s.picked !== t.token) return [`Drew ${show(s.picked ?? "")}, not ${show(t.token)}`, `At temperature ${s.temperature}, a ${pct(s.candidates.find((c) => c.token === s.picked)?.p ?? 0)} token was drawn. There's no going back: the next pass builds on it.`];
    return [`Picked ${show(s.picked ?? "")}`, s.temperature === "0" ? "Temperature 0: always the top token, so the same prompt always gives the same answer." : "The draw landed on the favourite this time."];
  },
  appended: (f) => [`“${text(f.state).trim()}”`, f.trimmed ? `Appended, and ${f.trimmed} old token${f.trimmed === 1 ? "" : "s"} dropped to make room.` : "Appended to the context. The next pass reads it like any other token."],
  finished: (f) => (f.state.done === "length"
    ? [`Stopped at ${MAX_NEW} tokens`, "max_tokens ran out, mid-sentence or not."]
    : [`Done: “${text(f.state).trim()}”`, `${f.state.stats.generated} forward passes for ${f.state.output.length} tokens of text.`]),
  "config.changed": ({ patch = {}, trimmed }) => (patch.temperature
    ? [`Temperature ${patch.temperature}`, patch.temperature === "0" ? "Greedy: always the top token." : "The sampler now draws, weighted by flattened probabilities."]
    : [`Context size: ${patch.windowSize} tokens`, trimmed ? `${trimmed} tokens fell out right away.` : "Applies to the next prompt."]),
};

export const describe = (frame: LlmFrame): Note => NOTES[frame.type](frame);
