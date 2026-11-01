import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getCollections, getTopics } from "@/lib/content";
import { DiscoverySearch } from "./DiscoverySearch";
import { FeaturedTopics } from "./FeaturedTopics";
import { HeroSection } from "./HeroSection";
import { TopicCollections } from "./TopicCollections";

export const HomePage = async () => {
  const [topics, collections] = await Promise.all([getTopics(), getCollections()]);
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <SiteHeader />
      <main id="main">
        <HeroSection />
        <DiscoverySearch>
          <FeaturedTopics topics={topics} collections={collections} />
          <TopicCollections collections={collections} />
        </DiscoverySearch>
      </main>
      <SiteFooter />
    </>
  );
};
