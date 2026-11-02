// The publication's name lives here. Its path deliberately doesn't use it.
export const PUBLICATION = {
  name: "How Things Work",
  tagline: "Everything has a mechanism.",
  url: "https://www.ayusholi.com.np/scrapebook/how-things-works/",
};

// The portfolio has its own root layout, so this is a plain link, not a <Link>.
export const PORTFOLIO_URL = "/";

// Every link to these sections comes from here. Old URLs are stubs in public/.
export const JOURNEY_URL = "/scrapebook/my-journey/";
export const HOW_URL = "/scrapebook/how-things-works/";
export const topicUrl = (slug: string) => `${HOW_URL}topics/${slug}/`;
