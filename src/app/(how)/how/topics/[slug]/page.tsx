import type { Metadata, Viewport } from "next";
import { getTopic, getTopics } from "@/lib/content";
import { TopicPage } from "@/templates/how/topics/TopicPage";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export const generateStaticParams = async () => (await getTopics()).map(({ slug }) => ({ slug }));

export const generateViewport = async ({ params }: Props): Promise<Viewport> => {
  const topic = await getTopic((await params).slug);
  return { themeColor: topic?.plate.stock === "ink" ? "#101a1c" : "#e7eae1" };
};

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const topic = await getTopic((await params).slug);
  if (!topic) return {};
  return {
    title: topic.title,
    description: topic.description,
    alternates: { canonical: `/how/topics/${topic.slug}/` },
    robots: topic.status === "published" ? undefined : { index: false },
  };
};

export default async function Page({ params }: Props) {
  return <TopicPage slug={(await params).slug} />;
}
