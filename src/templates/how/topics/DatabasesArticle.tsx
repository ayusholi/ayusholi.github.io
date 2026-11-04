import { notFound } from "next/navigation";
import { Section } from "@/components/layout/Section";
import { PageContainer } from "@/components/layout/PageContainer";
import { TopicHeader } from "@/components/topics/TopicHeader";
import { getTopic } from "@/lib/content";
import { DatabasesBench } from "@/features/databases/DatabasesBench";
import { DatabasesChallenges, DatabasesExplain, DatabasesWal } from "@/features/databases/DatabasesLivePanels";
import { DatabasesProvider } from "@/features/databases/DatabasesProvider";

// Prose renders on the server. The live panels between it are small client
// components sharing one simulation through DatabasesProvider.
export default async function DatabasesArticle() {
  const topic = await getTopic("databases");
  if (!topic) notFound();
  return (
    <DatabasesProvider>
      <TopicHeader
        topic={topic}
        mechanism={12}
        headline="What happens between sending a query and getting rows back?"
        lede="The database turns your SQL into a plan, runs it against pages in memory, and goes to disk only for the pages it doesn't have. Writes go to a log first, which is how a crash loses nothing that was committed."
        note="Modelled on PostgreSQL: one orders table of a million rows, one optional index, one statement at a time. Costs per page are round numbers."
      />

      <PageContainer aria-label="Database simulation">
        <DatabasesBench />
        <noscript><p className="prose">This simulation needs JavaScript. The explanations below still work without it.</p></noscript>
      </PageContainer>

      <Section id="ideas" label="The model" title="Three ideas explain most of it">
        <div className="breaks">
          <article className="break">
            <span className="label">Idea 1 · the planner</span>
            <h3>You say what, it decides how</h3>
            <p>SQL describes the rows you want. The planner estimates the cost of every way to find them and picks one. The same query can be fast or slow depending on what it has to work with.</p>
          </article>
          <article className="break">
            <span className="label">Idea 2 · pages</span>
            <h3>Everything is 8 KB pages</h3>
            <p>Tables and indexes are files of pages, and a query&apos;s cost is mostly how many it touches and whether they&apos;re already in memory. An index exists to touch fewer.</p>
          </article>
          <article className="break">
            <span className="label">Idea 3 · the log</span>
            <h3>Log first, tidy up later</h3>
            <p>A change is appended to the write-ahead log before it counts. Updating the table files can wait, because after a crash the log can redo it.</p>
          </article>
        </div>
      </Section>

      <Section id="hood" label="Under the hood" title="Ask the database what it did">
        <div className="split">
          <div>
            <p className="readout__h label"><span>Live: EXPLAIN for the latest statement</span></p>
            <DatabasesExplain />
            <p className="readout__h label mt-5"><span>Live: the write-ahead log</span></p>
            <DatabasesWal />
          </div>
          <div className="prose">
            <p><code>EXPLAIN (ANALYZE, BUFFERS)</code> runs a query and reports the plan it chose. <code>shared hit</code> counts pages found in memory and <code>read</code> counts pages fetched from disk. <code>Rows Removed by Filter</code> is the work that went nowhere.</p>
            <p>An index is a B-tree: a sorted copy of one column with pointers back to the table. Finding customer 42 means following three pages from the root to a leaf, then fetching each matching row. A million rows or a billion, it&apos;s still only a few levels deep.</p>
            <p>A commit is a promise that the change will survive a crash. PostgreSQL keeps it by flushing the log, not the table, which is why a commit costs one fsync rather than one write for every page it changed. A checkpoint writes the dirty pages out later, in bulk.</p>
          </div>
        </div>
      </Section>

      <Section id="breaks" label="When it breaks" title="Fast until it isn't">
        <div className="breaks">
          <article className="break">
            <span className="label">Scenario A · full scan</span>
            <h3>Fine on a laptop</h3>
            <p>A missing index is invisible with a thousand rows and painful with a million. And while the table fits in memory a scan seems fast, until the day it doesn&apos;t fit.</p>
          </article>
          <article className="break">
            <span className="label">Scenario C · unused index</span>
            <h3>The index that isn&apos;t used</h3>
            <p>Wrap a column in a function, cast it, or search with a leading wildcard, and an ordinary index can&apos;t help. Check with <code>EXPLAIN</code> instead of assuming.</p>
          </article>
          <article className="break">
            <span className="label">Scenario E · fast commit</span>
            <h3>Saved, then not</h3>
            <p>Turning off synchronous commits, or running on a disk that lies about fsync, makes writes faster by making &ldquo;committed&rdquo; mean &ldquo;probably&rdquo;.</p>
          </article>
        </div>
      </Section>

      <Section id="test" label="Test yourself" title="Two predictions">
        <DatabasesChallenges />
      </Section>

      <Section id="simplified" label="Fine print" title="What this model leaves out">
        <div className="notes">
          <details>
            <summary>Many queries at once</summary>
            <div><p>Real databases run many transactions at the same time. PostgreSQL keeps several versions of a row (MVCC), so readers never wait for writers, and locks only where two writes collide.</p></div>
          </details>
          <details>
            <summary>Statistics and estimates</summary>
            <div><p>The planner&apos;s choice is only as good as its statistics, gathered by <code>ANALYZE</code>. Stale estimates are a common reason a query suddenly picks a bad plan.</p></div>
          </details>
          <details>
            <summary>The operating system&apos;s cache</summary>
            <div><p>Below the buffer pool, the OS caches file pages too, so a &ldquo;read&rdquo; may never touch the disk. Here there&apos;s one layer of memory to keep the picture clear.</p></div>
          </details>
          <details>
            <summary>Replication</summary>
            <div><p>The same log that powers recovery can be streamed to other servers, which replay it to stay in sync. That&apos;s how replicas and point-in-time backups work.</p></div>
          </details>
        </div>
      </Section>
    </DatabasesProvider>
  );
}
