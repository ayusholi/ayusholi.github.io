// The boundary between content and presentation. Pages only ever call these
// functions, and they're async so an API can replace the local modules later
// without touching a component.
import { z } from "zod";
import { CollectionSchema, TopicSchema, type Collection, type Topic } from "./content-types";
import { COLLECTIONS } from "./collections";
import { TOPICS } from "./topics";

// Fails the build, naming the bad entry, rather than shipping a dead link.
export const validateCatalogue = (topics: Topic[], collections: Collection[]) => {
  const parsedTopics = z.array(TopicSchema).parse(topics);
  const parsedCollections = z.array(CollectionSchema).parse(collections);
  const slugs = new Set(parsedTopics.map((t) => t.slug));
  const ids = new Set(parsedCollections.map((c) => c.id));
  const problems: string[] = [];
  if (slugs.size !== parsedTopics.length) problems.push("duplicate topic slug");
  for (const t of parsedTopics) {
    if (!ids.has(t.collection)) problems.push(`${t.slug}: unknown collection "${t.collection}"`);
    for (const r of t.relatedTopics) if (!slugs.has(r)) problems.push(`${t.slug}: unknown related topic "${r}"`);
    if (t.status === "published" && !t.learningObjectives.length) problems.push(`${t.slug}: published without learning objectives`);
  }
  for (const c of parsedCollections) {
    for (const concept of c.concepts) {
      if (concept.topic && !slugs.has(concept.topic)) problems.push(`${c.id}: unknown topic "${concept.topic}"`);
    }
  }
  if (problems.length) throw new Error(`Invalid content catalogue:\n${problems.join("\n")}`);
  return { topics: parsedTopics, collections: parsedCollections };
};

const catalogue = validateCatalogue(TOPICS, COLLECTIONS);

export const getTopics = async (): Promise<Topic[]> => catalogue.topics;
export const getCollections = async (): Promise<Collection[]> => catalogue.collections;
export const getTopic = async (slug: string) => catalogue.topics.find((t) => t.slug === slug);
export const getCollection = async (id: string) => catalogue.collections.find((c) => c.id === id);
