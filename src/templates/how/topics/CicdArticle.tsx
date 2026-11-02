import { notFound } from "next/navigation";
import { Section } from "@/components/layout/Section";
import { PageContainer } from "@/components/layout/PageContainer";
import { TopicHeader } from "@/components/topics/TopicHeader";
import { getTopic } from "@/lib/content";
import { CicdBench } from "@/features/cicd/CicdBench";
import { CicdChallenges, CicdHistory, CicdPipeline } from "@/features/cicd/CicdLivePanels";
import { CicdProvider } from "@/features/cicd/CicdProvider";

// Prose renders on the server. The live panels between it are small client
// components sharing one simulation through CicdProvider.
export default async function CicdArticle() {
  const topic = await getTopic("ci-cd");
  if (!topic) notFound();
  return (
    <CicdProvider>
      <TopicHeader
        topic={topic}
        mechanism={5}
        headline="How does code travel from a laptop to production without anyone copying files?"
        lede="Through a pipeline that turns a commit into one artifact, tests it, and then promotes those exact bytes from environment to environment. Every stage is a gate that can stop the line."
        note="One branch, one pipeline at a time. Error counts are per 100 requests: they show the size of the damage, not real traffic."
      />

      <PageContainer aria-label="CI/CD simulation">
        <CicdBench />
        <noscript><p className="prose">This simulation needs JavaScript. The explanations below still work without it.</p></noscript>
      </PageContainer>

      <Section id="ideas" label="The model" title="Three ideas explain most of it">
        <div className="breaks">
          <article className="break">
            <span className="label">Idea 1 · CI</span>
            <h3>Integrate constantly, and check every time</h3>
            <p>Continuous integration means every push is built and tested automatically, so a broken change is found within minutes, by the person who just made it.</p>
          </article>
          <article className="break">
            <span className="label">Idea 2 · build once</span>
            <h3>An artifact is promoted, never rebuilt</h3>
            <p>The pipeline publishes one immutable artifact per commit. Staging and production pull that same digest. What was tested is exactly what ships.</p>
          </article>
          <article className="break">
            <span className="label">Idea 3 · CD</span>
            <h3>Releasing becomes a decision</h3>
            <p>Continuous delivery keeps every green commit ready to release, with a person pressing the button. Continuous deployment removes the button.</p>
          </article>
        </div>
      </Section>

      <Section id="hood" label="Under the hood" title="A pipeline is a list of gates">
        <div className="split">
          <div>
            <p className="readout__h label"><span>Live: the stage running now</span></p>
            <CicdPipeline />
            <p className="readout__h label mt-5"><span>Live: this reads the simulation above</span></p>
            <CicdHistory />
          </div>
          <div className="prose">
            <p>Each stage costs more than the one before and catches what the earlier ones can&apos;t. A unit test runs in seconds. A smoke test needs a deployed environment. Only real traffic exercises everything at once.</p>
            <p>So the order is chosen to fail cheaply: the earlier a problem is caught, the fewer people it touches. A red test inconveniences one developer. A bad release inconveniences everyone.</p>
            <p>Look at the history: a <strong>rollback</strong> is a deploy of an artifact the registry already holds. That&apos;s only possible because artifacts are kept and nothing is built on the way to production.</p>
          </div>
        </div>
      </Section>

      <Section id="breaks" label="When it breaks" title="Some bugs can only be found in production">
        <div className="breaks">
          <article className="break">
            <span className="label">Scenario C · all at once</span>
            <h3>The blast radius is everyone</h3>
            <p>Some failures depend on real data, real load or real users. No pre-production check finds them reliably, so plan for how much damage one can do.</p>
          </article>
          <article className="break">
            <span className="label">Scenario D · canary</span>
            <h3>Make the first exposure small</h3>
            <p>Send a slice of traffic first, compare its error rate with the old release, and stop automatically if it&apos;s worse. Blue-green and feature flags limit exposure in other ways.</p>
          </article>
          <article className="break">
            <span className="label">The quiet failure</span>
            <h3>Tests nobody trusts</h3>
            <p>Flaky tests get re-run until green, then ignored. A pipeline is only as strong as its weakest gate, and a gate everyone bypasses isn&apos;t one.</p>
          </article>
        </div>
      </Section>

      <Section id="test" label="Test yourself" title="Two predictions">
        <CicdChallenges />
      </Section>

      <Section id="simplified" label="Fine print" title="What this model leaves out">
        <div className="notes">
          <details>
            <summary>Branches and pull requests</summary>
            <div><p>Most teams run the same build and tests on every pull request, before merging, so main stays green. Only the merge to main continues to publishing and deployment. The GitHub Actions topic shows that split.</p></div>
          </details>
          <details>
            <summary>Database migrations</summary>
            <div><p>Rolling back code is easy because artifacts are immutable. Rolling back a database schema isn&apos;t. Migrations are usually written to be compatible with both the old and the new release, so the code can be rolled back on its own.</p></div>
          </details>
          <details>
            <summary>Canary analysis</summary>
            <div><p>Here the canary fails on a clear signal. Real canaries compare error rates and latency between two groups, need enough traffic to tell the difference, and run for minutes or hours.</p></div>
          </details>
          <details>
            <summary>Concurrent pipelines</summary>
            <div><p>One run at a time keeps this readable. Real pipelines overlap, so release stages are usually serialised, and a newer approved release can supersede an older one.</p></div>
          </details>
        </div>
      </Section>
    </CicdProvider>
  );
}
