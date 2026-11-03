// RAG's words, kept apart from its logic. `describe` narrates a frame from
// the state that frame holds, so the caption can't disagree with the simulation.
import { DIMENSIONS, embed, K, QUESTIONS, THRESHOLD } from "./rag-engine";
import type { RagEventType, RagFrame, RagNodeId } from "./rag-types";

export const ROLES: Record<RagNodeId, { name: string; sub: string; role: string }> = {
  docs: { name: "Documents", sub: "The source of truth", role: "The shop's own pages: returns, shipping, warranty. They change whenever the business does, and the model has never seen any of them." },
  chunker: { name: "Chunk + embed", sub: "Ingestion", role: "Splits each document into chunks small enough to be specific, then turns each chunk into a vector with an embedding model. Runs ahead of time, not when you ask." },
  index: { name: "Vector index", sub: "Nearest neighbours", role: "Stores every chunk's vector and finds the ones pointing in a similar direction to a query. It's a copy of the documents, so it's only as fresh as the last indexing run." },
  user: { name: "Question", sub: "From a customer", role: "Asks in their own words, which rarely match the words in the documents." },
  retriever: { name: "Retriever", sub: "Search + prompt", role: "Embeds the question with the same model, fetches the nearest chunks, drops the ones below the relevance threshold, and pastes the rest into the prompt." },
  model: { name: "LLM", sub: "Reads, then answers", role: "Gets the question with the chunks above it and an instruction to use only them. It can quote and cite what it was handed. It can't know what it wasn't." },
};

type Note = [title: string, text: string];

const vectorOf = (text: string) => {
  const v = embed(text);
  return DIMENSIONS.flatMap((d, i) => (v[i] ? [`${d} ${v[i]}`] : [])).join(", ") || "nothing it recognises";
};

const NOTES: Record<RagEventType, (f: RagFrame) => Note> = {
  ready: (f) => [f.state.index.length ? "Ready" : "Nothing indexed yet", f.state.index.length ? `${f.state.index.length} chunks indexed. Ask a question.` : "The documents exist, but nothing can search them yet."],
  "docs.chunked": (f) => ["Chunking", `Each sentence becomes one chunk: ${f.count} in all. Small chunks are specific, big ones carry more context.`],
  "chunks.indexed": (f) => [`${f.count} vectors stored`, "Each chunk is now a list of numbers describing what it's about. Similar meanings point in similar directions."],
  "policy.updated": () => ["The returns policy changes", "returns.md now says 14 days. The index still holds the old chunk, and nothing has told it."],
  "question.asked": (f) => [`“${f.state.question ? QUESTIONS[f.state.question] : ""}”`, f.state.retrieval === "off" ? "Retrieval is off, so the question goes straight to the model." : "First, find what's relevant."],
  "question.embedded": (f) => ["The question becomes a vector", f.state.mode === "vector" ? `Using the same model as the chunks: ${f.state.question ? vectorOf(QUESTIONS[f.state.question]) : ""}.` : "Keyword mode: it will match on shared words instead."],
  "index.searched": (f) => [`Looking for the nearest ${K}`, f.state.mode === "vector" ? "Cosine similarity: how closely each chunk's vector points the same way as the question's." : "Counting the words each chunk shares with the question."],
  "chunks.found": (f) => {
    const best = f.state.hits[0];
    return f.count
      ? [`${f.count} chunk${f.count === 1 ? "" : "s"} pass the threshold`, `Best: ${best?.chunk.id} at ${best?.score}. Anything under ${THRESHOLD} is left out of the prompt.`]
      : ["Nothing is close enough", `The best match scores ${best?.score ?? 0}, under the ${THRESHOLD} threshold. Better to send nothing than something irrelevant.`];
  },
  "prompt.built": (f) => (f.state.retrieval === "off"
    ? ["Just the question", "No context. The model has only what it learned in training."]
    : [f.count ? "The prompt is assembled" : "A prompt with no context", f.count ? "The chunks go above the question, with an instruction to answer only from them." : "The instruction still says: if the answer isn't in the context, say so."]),
  answered: (f) => {
    const a = f.state.answer;
    if (!a) return ["Answered", ""];
    if (a.kind === "unsupported") return ["An answer without a source", `“${a.text}” Plausible, general, and not from this shop's documents.`];
    if (a.kind === "not-found") return ["“The documents don't cover that”", "No relevant chunk, so no answer. That refusal is RAG working."];
    return a.stale
      ? ["A cited answer, and out of date", `“${a.text}” returns.md says 14 days now. The citation is real; the index is old.`]
      : ["A grounded answer", `“${a.text}” Specific, and you can check it.`];
  },
  "config.changed": ({ patch = {} }) => (patch.mode
    ? [patch.mode === "vector" ? "Search: vectors" : "Search: keywords", patch.mode === "vector" ? "Matches by meaning." : "Matches by shared words."]
    : [patch.retrieval === "on" ? "Retrieval on" : "Retrieval off", patch.retrieval === "on" ? "Questions go through the index first." : "Questions go straight to the model."]),
};

export const describe = (frame: RagFrame): Note => NOTES[frame.type](frame);
