import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, ExternalLink, Clock, RefreshCw, TrendingUp } from "lucide-react";

interface NewsArticle {
  uuid: string;
  title: string;
  description?: string;
  snippet?: string;
  url: string;
  image_url?: string;
  source: string;
  published_at: string;
  entities?: Array<{ symbol?: string; name?: string; type?: string }>;
}

interface MarketNewsFeedProps {
  variant?: "landing" | "dashboard";
  defaultCategory?: "all" | "crypto" | "forex" | "commodities";
  limit?: number;
}

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "crypto", label: "Crypto" },
  { key: "forex", label: "Forex" },
  { key: "commodities", label: "Commodities" },
] as const;

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const MarketNewsFeed = ({
  variant = "landing",
  defaultCategory = "all",
  limit = 12,
}: MarketNewsFeedProps) => {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>(defaultCategory);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNews = async (cat: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `${projectUrl}/functions/v1/fetch-market-news?category=${cat}&limit=${limit}`,
        { headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey } }
      );
      const json = await res.json();
      const all: NewsArticle[] = json.data || [];
      // Keep only last 24h, sorted newest first
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const filtered = all
        .filter((a) => {
          const t = new Date(a.published_at).getTime();
          return !isNaN(t) && t >= cutoff;
        })
        .sort(
          (a, b) =>
            new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
        );
      setNews(filtered);
    } catch (e) {
      console.error("News fetch error:", e);
      setNews([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNews(category);
    const interval = setInterval(() => fetchNews(category, true), 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [category]);

  const isDashboard = variant === "dashboard";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <Newspaper className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              Live Market News
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Real-time updates from global financial markets
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchNews(category, true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Tabs value={category} onValueChange={setCategory}>
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.key} value={c.key}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className={`grid gap-4 ${isDashboard ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-3">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </Card>
          ))}
        </div>
      ) : news.length === 0 ? (
        <Card className="p-8 text-center">
          <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No news available right now</p>
        </Card>
      ) : (
        <div className={`grid gap-4 ${isDashboard ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
          {news.map((article) => (
            <a
              key={article.uuid}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <Card className="overflow-hidden h-full transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:border-primary/40 border-border/50 bg-card/80 backdrop-blur">
                {article.image_url && (
                  <div className="relative h-40 overflow-hidden">
                    <img
                      src={article.image_url}
                      alt={article.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                    <Badge className="absolute top-2 left-2 bg-background/80 backdrop-blur text-foreground border-primary/30">
                      {article.source}
                    </Badge>
                  </div>
                )}
                <div className="p-4 space-y-2">
                  {!article.image_url && (
                    <Badge variant="outline" className="mb-2">
                      {article.source}
                    </Badge>
                  )}
                  <h4 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                    {article.title}
                  </h4>
                  {(article.snippet || article.description) && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {article.snippet || article.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {timeAgo(article.published_at)}
                    </div>
                    {article.entities && article.entities.length > 0 && (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        <span className="text-xs font-medium text-green-500">
                          {article.entities[0].symbol || article.entities[0].name}
                        </span>
                      </div>
                    )}
                    <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                  </div>
                </div>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
