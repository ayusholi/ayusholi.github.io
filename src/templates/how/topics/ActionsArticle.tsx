import { notFound } from "next/navigation";
import { Section } from "@/components/layout/Section";
import { PageContainer } from "@/components/layout/PageContainer";
import { TopicHeader } from "@/components/topics/TopicHeader";
import { getTopic } from "@/lib/content";
import { ActionsBench } from "@/features/actions/ActionsBench";
import { ActionsChallenges, ActionsLog, ActionsWorkflow } from "@/features/actions/ActionsLivePanels";
import { ActionsProvider } from "@/features/actions/ActionsProvider";

// Prose renders on the server. The live panels between it are small client
// components sharing one simulation through ActionsProvider.
export default async function ActionsArticle() {
  const topic = await getTopic("github-actions");
  if (!topic) notFound();
  return (
    <ActionsProvider>
      <TopicHeader
        topic={topic}
        mechanism={6}
        headline="What happens in the minutes after you push a commit?"
        lede="GitHub turns the push into an event, finds every workflow that listens for it, and builds a graph of jobs. Each job waits for the ones it needs, then gets a brand-new machine that's thrown away when it finishes."
        note="One workflow file, three runners at most. A tick stands in for roughly a minute of a real job."
      />

      <PageContainer aria-label="GitHub Actions simulation">
        <ActionsBench />
        <noscript><p className="prose">This simulation needs JavaScript. The explanations below still work without it.</p></noscript>
      </PageContainer>

      <Section id="ideas" label="The model" title="Three ideas explain most of it">
        <div className="breaks">
          <article className="break">
            <span className="label">Idea 1</span>
            <h3>Events, matched against files</h3>
            <p>A push, a pull request or a schedule is an event. GitHub reads the workflow files in that commit and starts a run for each one whose <span className="inline-code">on:</span> block matches, filters included.</p>
          </article>
          <article className="break">
            <span className="label">Idea 2</span>
            <h3>Jobs form a graph</h3>
            <p>Jobs run in parallel unless <span className="inline-code">needs:</span> says otherwise. A job starts when everything it needs has succeeded, and is skipped if any of it didn&apos;t, or if its <span className="inline-code">if:</span> is false.</p>
          </article>
          <article className="break">
            <span className="label">Idea 3</span>
            <h3>Every job starts from nothing</h3>
            <p>Each job gets a fresh virtual machine, which is destroyed afterwards. Steps share a disk, jobs don&apos;t. Caches and artifacts are how anything gets from one to another.</p>
          </article>
        </div>
      </Section>

      <Section id="hood" label="Under the hood" title="The workflow file decides everything">
        <div className="split">
          <div>
            <p className="readout__h label"><span>Live: the lines deciding what happens now</span><span>.github/workflows/ci.yml</span></p>
            <ActionsWorkflow />
          </div>
          <div className="prose">
            <p>Read it as a set of rules, not a script. <span className="inline-code">on:</span> decides whether a run happens at all. <span className="inline-code">needs:</span> and <span className="inline-code">if:</span> decide which jobs run and in what order. <span className="inline-code">steps:</span> are the only part that executes in sequence.</p>
            <p>The <span className="inline-code">matrix</span> turns one job definition into one job per value, here one per Node version, each on its own runner. <span className="inline-code">concurrency</span> makes sure only one run per branch is alive, so deploys can&apos;t overtake each other.</p>
            <div>
              <p className="readout__h label mt-5"><span>Live: what GitHub decided</span></p>
              <ActionsLog />
            </div>
          </div>
        </div>
      </Section>

      <Section id="breaks" label="When it breaks" title="Most confusion comes from the clean machine">
        <div className="breaks">
          <article className="break">
            <span className="label">“It works locally”</span>
            <h3>The runner has none of your state</h3>
            <p>No installed packages, no environment variables, no files you forgot to commit. Every job proves the repository builds from scratch, which is the point.</p>
          </article>
          <article className="break">
            <span className="label">Scenario 5 · slow runs</span>
            <h3>Downloading the internet every time</h3>
            <p>Without a cache, every job reinstalls every dependency. Key the cache on the lockfile, so it&apos;s reused until dependencies really change and rebuilt the moment they do.</p>
          </article>
          <article className="break">
            <span className="label">Scenario 4 · races</span>
            <h3>Two deploys, wrong order</h3>
            <p>Push twice quickly and two runs can deploy in either order. A concurrency group with cancel-in-progress keeps only the newest alive.</p>
          </article>
        </div>
      </Section>

      <Section id="test" label="Test yourself" title="Two predictions">
        <ActionsChallenges />
      </Section>

      <Section id="simplified" label="Fine print" title="What this model leaves out">
        <div className="notes">
          <details>
            <summary>Self-hosted runners</summary>
            <div><p>Runners you host yourself are long-lived machines, so files can survive between jobs unless you clean up. Everything here is GitHub-hosted, where each job really does get a new VM.</p></div>
          </details>
          <details>
            <summary>Cache behaviour</summary>
            <div><p>A cache key can&apos;t be overwritten, which is why only the first matrix leg saves. Real caches also fall back on <span className="inline-code">restore-keys</span>, are scoped to branches, and are evicted after seven days unused or when the repository passes its storage limit.</p></div>
          </details>
          <details>
            <summary>Billing and limits</summary>
            <div><p>Hosted runner minutes are billed per job, rounded up to the minute, at different rates per operating system. Public repositories use standard runners free. The concurrency limit depends on the plan.</p></div>
          </details>
          <details>
            <summary>Secrets, environments and permissions</summary>
            <div><p>Real deploy jobs use an <span className="inline-code">environment</span> with protection rules and secrets, and a scoped <span className="inline-code">GITHUB_TOKEN</span>. Pull requests from forks don&apos;t get secrets at all, another reason deploy is limited to main.</p></div>
          </details>
        </div>
      </Section>
    </ActionsProvider>
  );
}
