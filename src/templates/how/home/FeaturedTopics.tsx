import Link from "next/link";
import type { Collection, Topic } from "@/lib/content/content-types";
import { Section } from "@/components/layout/Section";
import { TopicPreview } from "@/components/topics/TopicPreview";
import { topicUrl } from "@/lib/site";

const Plate = ({ topic, index, collection }: { topic: Topic; index: number; collection: string }) => {
  const live = topic.status === "published";
  const className = `plate plate--${topic.plate.size} stock-${topic.plate.stock}${live ? " plate--live" : ""}`;
  const find = `${topic.title} ${topic.question} ${collection}`.toLowerCase();
  return (
    <Link className={className} href={topicUrl(topic.slug)} data-find={find}>
      <div className="plate__top label"><span>Nº {String(index + 1).padStart(2, "0")}</span><span>{collection}</span></div>
      <div className="plate__art"><TopicPreview slug={topic.slug} /></div>
      <div>
        <h3 className="plate__title">{topic.title}</h3>
        <p className="plate__q">{topic.question}</p>
        <div className="plate__meta label">
          <span className={live ? "plate__live" : ""}>{live ? "Interactive" : "On the drawing board"}</span>
          <span>{live ? "" : "≈ "}{topic.estimatedMinutes} min</span>
        </div>
      </div>
    </Link>
  );
};

export const FeaturedTopics = ({ topics, collections }: { topics: Topic[]; collections: Collection[] }) => (
  <Section id="plates-h" anchor="plates" label="The plates" title="Pick a system and take it apart">
    <div className="find">
      <label className="label" htmlFor="find">Find a technology</label>
      <input type="search" id="find" placeholder="kafka, caching, agents…" autoComplete="off" />
    </div>
    <div className="plates">
      {topics.map((t, i) => (
        <Plate key={t.slug} topic={t} index={i} collection={collections.find((c) => c.id === t.collection)?.title ?? ""} />
      ))}
    </div>
    <p className="find__none" id="find-none" role="status" hidden />
  </Section>
);
