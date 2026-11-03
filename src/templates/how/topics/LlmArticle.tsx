import { notFound } from "next/navigation";
import { Section } from "@/components/layout/Section";
import { PageContainer } from "@/components/layout/PageContainer";
import { TopicHeader } from "@/components/topics/TopicHeader";
import { getTopic } from "@/lib/content";
import { LlmBench } from "@/features/llm/LlmBench";
import { LlmChallenges, LlmWindow } from "@/features/llm/LlmLivePanels";
import { LlmProvider } from "@/features/llm/LlmProvider";

// Prose renders on the server. The live panels between it are small client
// components sharing one simulation through LlmProvider.
export default async function LlmArticle() {
  const topic = await getTopic("llms");
  if (!topic) notFound();
  return (
    <LlmProvider>
      <TopicHeader
        topic={topic}
        mechanism={7}
        headline="How does a language model write a sentence it has never seen?"
        lede="It doesn't write sentences. It reads everything so far, scores every possible next token, picks one, and starts again. Everything else, from memory to mistakes, follows from that loop."
        note="A toy model: a small table of continuations stands in for billions of weights, and only the top few candidates exist."
      />

      <PageContainer aria-label="LLM simulation">
        <LlmBench />
        <noscript><p className="prose">This simulation needs JavaScript. The explanations below still work without it.</p></noscript>
      </PageContainer>

      <Section id="ideas" label="The model" title="Three ideas explain most of it">
        <div className="breaks">
          <article className="break">
            <span className="label">Idea 1 · tokens</span>
            <h3>Text goes in as numbered pieces</h3>
            <p>A tokenizer splits text into common words and fragments of rare ones. Context limits, prices and speeds are all measured in tokens, and a word can cost several.</p>
          </article>
          <article className="break">
            <span className="label">Idea 2 · one at a time</span>
            <h3>Every token is a full pass</h3>
            <p>The model reads the whole context and returns a probability for every token in its vocabulary. One is picked and appended, and the model runs again from the start.</p>
          </article>
          <article className="break">
            <span className="label">Idea 3 · sampling</span>
            <h3>Randomness is added afterwards</h3>
            <p>The model is a fixed function: the same context always gives the same scores. Variety comes from the sampler, which temperature makes bolder or more cautious.</p>
          </article>
        </div>
      </Section>

      <Section id="hood" label="Under the hood" title="The context window is the only memory">
        <div className="split">
          <div>
            <p className="readout__h label"><span>Live: the window, token by token</span></p>
            <LlmWindow />
          </div>
          <div className="prose">
            <p>A chat feels like a conversation, but the model keeps nothing between calls. The app sends the whole conversation again every time, and the model reads it from the first token.</p>
            <p>The window has a fixed size. When a conversation outgrows it, something has to go, usually the oldest messages. Apps hide this by summarising, or by retrieving the relevant parts again: that&apos;s what RAG is for.</p>
            <p>“Remembering” within the window is attention: the model can look back at any token it can see. In the recall scenario it finds “ name is” earlier on and copies what came after it.</p>
          </div>
        </div>
      </Section>

      <Section id="breaks" label="When it breaks" title="Fluent is not the same as correct">
        <div className="breaks">
          <article className="break">
            <span className="label">Scenario D · forgetting</span>
            <h3>Missing context, confident answer</h3>
            <p>The model can&apos;t tell that something fell out of its window. It sees a question about a name and gives the most likely one.</p>
          </article>
          <article className="break">
            <span className="label">Scenario E · making it up</span>
            <h3>Low confidence, written plainly</h3>
            <p>When nothing it learned fits, the probabilities are flat, but a token is still picked. The text reads as sure as any other. This is what people call hallucination.</p>
          </article>
          <article className="break">
            <span className="label">Scenario B · temperature</span>
            <h3>One unlucky draw steers the rest</h3>
            <p>Each token is conditioned on the ones before it. An unlikely early pick isn&apos;t corrected later: the model carries on, consistently, from where it landed.</p>
          </article>
        </div>
      </Section>

      <Section id="test" label="Test yourself" title="Two predictions">
        <LlmChallenges />
      </Section>

      <Section id="simplified" label="Fine print" title="What this model leaves out">
        <div className="notes">
          <details>
            <summary>Real weights and vocabularies</summary>
            <div><p>A real model computes its scores with billions of learned numbers, over a vocabulary of 50,000 to 200,000 tokens, every one of which gets a probability on every pass. Here a small table of continuations plays that part.</p></div>
          </details>
          <details>
            <summary>Attention</summary>
            <div><p>Copying the token that followed an earlier match is one thing attention learns to do. Real attention weighs every token against every other in many layers at once, and does far more than copy.</p></div>
          </details>
          <details>
            <summary>Top-p, top-k and caching</summary>
            <div><p>Real samplers also cut off the long tail of unlikely tokens before drawing. And servers cache the work done on earlier tokens, so each new pass is cheaper than reading the whole context from scratch.</p></div>
          </details>
          <details>
            <summary>Training and chat tuning</summary>
            <div><p>This page shows inference only. Saying “I don&apos;t know”, following instructions and refusing come from training after pre-training. They change the probabilities, not the loop.</p></div>
          </details>
        </div>
      </Section>
    </LlmProvider>
  );
}
