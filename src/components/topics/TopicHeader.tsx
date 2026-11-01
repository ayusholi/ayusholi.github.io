import type { ReactNode } from "react";
import type { Topic } from "@/lib/content/content-types";
import { getCollection } from "@/lib/content";

type Props = { topic: Topic; mechanism: number; headline: string; lede: string; note: string; children?: ReactNode };

export const TopicHeader = async ({ topic, mechanism, headline, lede, note }: Props) => {
  const collection = await getCollection(topic.collection);
  return (
    <section className="topic-open wrap" aria-labelledby="title">
      <p className="topic-open__meta label">
        <span>Mechanism {String(mechanism).padStart(2, "0")}</span>
        <span>{collection?.title}</span>
        <span>Interactive · {topic.estimatedMinutes} min</span>
      </p>
      <h1 className="display display--q" id="title">{headline}</h1>
      <div className="topic-open__foot">
        <p className="lede">{lede}</p>
        <p className="label">{note}</p>
      </div>
    </section>
  );
};
