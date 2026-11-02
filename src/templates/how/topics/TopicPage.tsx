import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { RelatedTopics } from "@/components/topics/RelatedTopics";
import { TopicPreview } from "@/components/topics/TopicPreview";
import { getCollection, getTopic } from "@/lib/content";
import { HOW_URL } from "@/lib/site";
import type { Topic } from "@/lib/content/content-types";
import { renderExperience } from "./registry";

// Listed in the catalogue but not built yet. Says so, and fakes nothing.
const ComingSoon = async ({ topic }: { topic: Topic }) => {
  const collection = await getCollection(topic.collection);
  return (
    <section className="topic-open wrap max-w-3xl!">
      <p className="topic-open__meta label"><span>{collection?.title}</span><span>On the drawing board</span></p>
      <h1 className="display display--q">{topic.title}</h1>
      <p className="lede mt-3">{topic.question}</p>
      <div className="next__art my-6 max-w-sm!"><TopicPreview slug={topic.slug} /></div>
      <p className="mb-6">This mechanism hasn&apos;t been built yet, so there&apos;s nothing to run here.</p>
      <Link className="btn btn--solid" href={HOW_URL}>See what&apos;s ready</Link>
    </section>
  );
};

export const TopicPage = async ({ slug }: { slug: string }) => {
  const topic = await getTopic(slug);
  if (!topic) notFound();
  const experience = renderExperience(topic.slug);
  return (
    <div className={`min-h-screen ${topic.plate.stock === "ink" && experience ? "stock-ink" : ""}`}>
      <a className="skip" href="#main">Skip to content</a>
      <SiteHeader />
      <main id="main">
        {experience ?? <ComingSoon topic={topic} />}
        {experience && <RelatedTopics topic={topic} />}
      </main>
      <SiteFooter />
    </div>
  );
};
