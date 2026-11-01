import { z } from "zod";

export const TopicSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  question: z.string().min(1),      // the plate's headline question
  description: z.string().min(1),
  collection: z.string().min(1),
  estimatedMinutes: z.number().int().positive(),
  status: z.enum(["published", "coming-soon"]),
  learningObjectives: z.array(z.string().min(1)),
  relatedTopics: z.array(z.string()),
  plate: z.object({
    size: z.enum(["hero", "tall", "wide", "medium", "small"]),
    stock: z.enum(["paper", "ink", "ochre", "clay", "film"]),
  }),
});

export const CollectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  line: z.string().min(1),
  concepts: z.array(z.object({ name: z.string().min(1), topic: z.string().optional() })).min(1),
});

export type Topic = z.infer<typeof TopicSchema>;
export type TopicStatus = Topic["status"];
export type Collection = z.infer<typeof CollectionSchema>;
