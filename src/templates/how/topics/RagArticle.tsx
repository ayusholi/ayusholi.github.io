import { notFound } from "next/navigation";
import { Section } from "@/components/layout/Section";
import { PageContainer } from "@/components/layout/PageContainer";
import { TopicHeader } from "@/components/topics/TopicHeader";
import { getTopic } from "@/lib/content";
import { RagBench } from "@/features/rag/RagBench";
import { RagChallenges, RagPrompt } from "@/features/rag/RagLivePanels";
import { RagProvider } from "@/features/rag/RagProvider";

// Prose renders on the server. The live panels between it are small client
// components sharing one simulation through RagProvider.
export default async function RagArticle() {
  const topic = await getTopic("rag");
  if (!topic) notFound();
  return (
    <RagProvider>
      <TopicHeader
        topic={topic}
        mechanism={9}
        headline="How does a model answer from documents it was never trained on?"
        lede="Nobody teaches it the documents. Before it answers, a search finds the few passages that matter and pastes them into the prompt. The model reads them like any other text, and cites them."
        note="Embeddings here have nine named dimensions instead of hundreds of learned ones, and each chunk is one sentence."
      />

      <PageContainer aria-label="RAG simulation">
        <RagBench />
        <noscript><p className="prose">This simulation needs JavaScript. The explanations below still work without it.</p></noscript>
      </PageContainer>

      <Section id="ideas" label="The model" title="Three ideas explain most of it">
        <div className="breaks">
          <article className="break">
            <span className="label">Idea 1 · embeddings</span>
            <h3>Meaning becomes a direction</h3>
            <p>An embedding model turns text into a list of numbers. Texts about the same thing point the same way, even when they share no words.</p>
          </article>
          <article className="break">
            <span className="label">Idea 2 · retrieval</span>
            <h3>Search first, then ask</h3>
            <p>The question is embedded the same way and the nearest chunks are fetched. Only those few go to the model, so the documents can be far bigger than its context window.</p>
          </article>
          <article className="break">
            <span className="label">Idea 3 · grounding</span>
            <h3>The prompt does the teaching</h3>
            <p>The model gets an instruction to answer only from the passages it was given, and to say so when they don&apos;t cover the question. Nothing about the model itself changes.</p>
          </article>
        </div>
      </Section>

      <Section id="hood" label="Under the hood" title="RAG is a prompt, assembled by a search">
        <div className="split">
          <div>
            <p className="readout__h label"><span>Live: the prompt for the last question</span></p>
            <RagPrompt />
          </div>
          <div className="prose">
            <p>Everything the model knows about this shop arrives in that prompt. Ask a question and watch it fill: the chunks above, the question below, and an instruction that makes “I don&apos;t know” an acceptable answer.</p>
            <p>That&apos;s why RAG beats retraining for this job. Change a document and re-index it, and the next answer changes, with a citation someone can check.</p>
            <p>It&apos;s also why retrieval quality is the whole game. The model can only be as right as the passages it was handed. A wrong chunk gives a confident wrong answer; a missing chunk gives a guess, or, if the prompt allows it, an honest refusal.</p>
          </div>
        </div>
      </Section>

      <Section id="breaks" label="When it breaks" title="Most failures are search failures">
        <div className="breaks">
          <article className="break">
            <span className="label">Scenario D · stale index</span>
            <h3>The copy falls behind the source</h3>
            <p>The index is a snapshot. If documents change and it isn&apos;t rebuilt, answers stay confidently cited and quietly wrong.</p>
          </article>
          <article className="break">
            <span className="label">Scenario C · words vs meaning</span>
            <h3>The right passage, never found</h3>
            <p>Keyword search misses paraphrases. Vector search can miss exact names, codes and numbers. Many systems combine both and re-rank the results.</p>
          </article>
          <article className="break">
            <span className="label">The quiet failure</span>
            <h3>Chunks cut in the wrong place</h3>
            <p>Split a table from its heading, or a rule from its exception, and each chunk is true on its own but misleading alone. How you chunk decides what can be found.</p>
          </article>
        </div>
      </Section>

      <Section id="test" label="Test yourself" title="Two predictions">
        <RagChallenges />
      </Section>

      <Section id="simplified" label="Fine print" title="What this model leaves out">
        <div className="notes">
          <details>
            <summary>Real embeddings</summary>
            <div><p>Real embedding models produce hundreds or thousands of dimensions, none of which has a name. They&apos;re learned from huge amounts of text, which is how “money back” ends up near “refund” without anyone listing synonyms.</p></div>
          </details>
          <details>
            <summary>Approximate search</summary>
            <div><p>Comparing a question with every chunk is fine for eight chunks, not eight million. Vector databases use approximate indexes such as HNSW that check a small fraction of them and are almost always right.</p></div>
          </details>
          <details>
            <summary>Chunk size and overlap</summary>
            <div><p>Chunks are usually a few hundred tokens, often overlapping so a sentence near a boundary appears in both. Here each sentence is one chunk, to keep scores readable.</p></div>
          </details>
          <details>
            <summary>Writing the answer</summary>
            <div><p>Here the model quotes its best chunk. A real one writes a fresh answer from all the chunks it was given, and can still misread them, so citations matter.</p></div>
          </details>
        </div>
      </Section>
    </RagProvider>
  );
}
