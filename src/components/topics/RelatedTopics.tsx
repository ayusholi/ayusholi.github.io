import Link from "next/link";
import type { Topic } from "@/lib/content/content-types";
import { getCollection, getTopic } from "@/lib/content";
import { Section } from "@/components/layout/Section";
import { TopicPreview } from "./TopicPreview";

const Card = async ({ topic }: { topic: Topic }) => {
  const collection = await getCollection(topic.collection);
  const live = topic.status === "published";
  const body = (
    <>
      <span className="next__art"><TopicPreview slug={topic.slug} /></span>
      <span className="label">{collection?.title}</span>
      <strong className="next__title">{topic.title}</strong>
      <span className="next__q">{topic.question}</span>
      <span className="label next__state">{live ? `Interactive · ${topic.estimatedMinutes} min →` : "On the drawing board"}</span>
    </>
  );
  return <Link className={`next${live ? "" : " next--planned"}`} href={`/how/topics/${topic.slug}`}>{body}</Link>;
};

export const RelatedTopics = async ({ topic }: { topic: Topic }) => {
  const related = await Promise.all(topic.relatedTopics.map(getTopic));
  return (
    <Section id="next" label="Keep going" title="Connected mechanisms">
      <div className="nexts">
        {related.flatMap((t) => (t ? [<Card key={t.slug} topic={t} />] : []))}
      </div>
    </Section>
  );
};
