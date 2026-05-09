import PageShell from "@/components/PageShell";
import { Newspaper } from "lucide-react";
import { MarketNewsFeed } from "@/components/MarketNewsFeed";

const News = () => {
  return (
    <PageShell
      title="Market News"
      subtitle="Latest financial headlines from across global markets"
      icon={Newspaper}
      maxWidth="6xl"
    >
      <div className="relative rounded-2xl bg-card/50 backdrop-blur-xl border border-border/60 p-4 sm:p-6 shadow-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
        <MarketNewsFeed variant="dashboard" defaultCategory="all" limit={30} />
      </div>
    </PageShell>
  );
};

export default News;
