import dynamic from "next/dynamic";
import { createElement, type ComponentType, type ReactNode } from "react";
import type { ExperienceSlug } from "./published";

// Maps a topic slug to its page template. Each topic brings its own body. Dynamic imports keep one topic's
// simulation out of every other topic's bundle, while still rendering on the server.
export const EXPERIENCES: Record<ExperienceSlug, ComponentType> = {
  redis: dynamic(() => import("./RedisArticle")),
  "apache-kafka": dynamic(() => import("./KafkaArticle")),
  docker: dynamic(() => import("./DockerArticle")),
  kubernetes: dynamic(() => import("./KubernetesArticle")),
  "ci-cd": dynamic(() => import("./CicdArticle")),
  "github-actions": dynamic(() => import("./ActionsArticle")),
  llms: dynamic(() => import("./LlmArticle")),
  "ai-agents": dynamic(() => import("./AgentsArticle")),
  rag: dynamic(() => import("./RagArticle")),
  "ai-automations": dynamic(() => import("./AutomationsArticle")),
  nginx: dynamic(() => import("./NginxArticle")),
  databases: dynamic(() => import("./DatabasesArticle")),
  mcp: dynamic(() => import("./McpArticle")),
  "whatsapp-reminders": dynamic(() => import("./RemindersArticle")),
};

export const renderExperience = (slug: string): ReactNode => {
  const component = EXPERIENCES[slug as ExperienceSlug];
  return component ? createElement(component) : null;
};
