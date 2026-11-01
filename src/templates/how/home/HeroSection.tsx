import { PageContainer } from "@/components/layout/PageContainer";
import { PUBLICATION } from "@/lib/site";
import { RedisHero } from "@/features/redis/RedisHero";

export const HeroSection = () => (
  <PageContainer className="open" aria-labelledby="title">
    <div className="open__row">
      <h1 className="display" id="title">{PUBLICATION.tagline}</h1>
      <p className="lede">Explore what happens beneath the interfaces, APIs and systems we use every day. No walls of documentation. Just ideas brought to life.</p>
    </div>
    <RedisHero />
  </PageContainer>
);
