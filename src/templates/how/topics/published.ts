// Slugs with a built experience. Kept apart from registry.tsx so the catalogue
// test can check them without importing React components.
export const PUBLISHED_EXPERIENCES = ["redis", "apache-kafka"] as const;
export type ExperienceSlug = (typeof PUBLISHED_EXPERIENCES)[number];
