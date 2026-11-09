// The publication's name lives here. Its path deliberately doesn't use it.
export const PUBLICATION = {
  name: "How Things Work",
  tagline: "Everything has a mechanism.",
  url: "https://www.ayusholi.com.np/run-and-debug/how-things-works/",
};

// The portfolio has its own root layout, so this is a plain link, not a <Link>.
export const PORTFOLIO_URL = "/";

// Every link to these sections comes from here. Old URLs are stubs in public/.
export const JOURNEY_URL = "/run-and-debug/my-journey/";
export const HOW_URL = "/run-and-debug/how-things-works/";
export const topicUrl = (slug: string) => `${HOW_URL}topics/${slug}/`;

// The downloadable CV. Replace the file in public/docs/ to update it.
export const CV_URL = "/docs/ayush-oli-cv.pdf";
export const CV_FILENAME = "Ayush-Oli-CV.pdf";
