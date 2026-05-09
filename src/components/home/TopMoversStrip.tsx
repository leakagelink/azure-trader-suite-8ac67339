import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Mover {
  symbol: string;
  name: string;
  price: number;
  change: number;
}

interface TopMoversStripProps {
  compact?: boolean;
}

export const TopMoversStrip = ({ compact = false }: TopMoversStripProps) => {
  const [gainers, setGainers] = useState<Mover[]>([]);
  const [losers, setLosers] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"gainers" | "losers">("gainers");

  useEffect(() => {
    const fetchMovers = async () => {
      try {
        const { data } = await supabase.functions.invoke("fetch-crypto-data");
        const list = (data?.cryptoData || data?.data || []).map((c: any) => {
          const changeStr = String(c.change ?? c.change_24h ?? c.percent_change_24h ?? "0");
          const change = parseFloat(changeStr.replace(/[+%]/g, "")) || 0;
          const price = typeof c.price === "string" ? parseFloat(c.price) : (c.price ?? 0);
          return {
            symbol: c.symbol,
            name: c.name,
            price,
            change,
          };
        });
        const sorted = [...list].sort((a, b) => b.change - a.change);
        setGainers(sorted.slice(0, 5));
        setLosers(sorted.slice(-5).reverse());
      } catch (e) {
        console.error("Movers fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchMovers();
    const i = setInterval(fetchMovers, 60000);
    return () => clearInterval(i);
  }, []);

  const formatPrice = (p: number) => {
    if (p < 1) return p.toFixed(4);
    if (p < 100) return p.toFixed(2);
    return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const renderCard = (m: Mover, isGainer: boolean) => (
    <div
      key={m.symbol}
      className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-card/60 hover:bg-card/90 transition-all border min-w-[150px] sm:min-w-[180px] flex-shrink-0 ${
        isGainer ? "border-green-500/20 hover:border-green-500/40" : "border-red-500/20 hover:border-red-500/40"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="font-bold text-xs sm:text-sm truncate">{m.symbol.replace("USDT", "")}</div>
        <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{m.name}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-mono text-xs sm:text-sm font-semibold tabular-nums">
          ${formatPrice(m.price)}
        </div>
        <div
          className={`text-[10px] sm:text-xs font-bold flex items-center gap-0.5 justify-end ${
            isGainer ? "text-green-500" : "text-red-500"
          }`}
        >
          {isGainer ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {m.change >= 0 ? "+" : ""}
          {m.change.toFixed(2)}%
        </div>
      </div>
    </div>
  );

  // ============ COMPACT VARIANT (for Dashboard, mobile-optimized) ============
  if (compact) {
    const list = activeTab === "gainers" ? gainers : losers;
    const isGainer = activeTab === "gainers";

    return (
      <div className="relative rounded-2xl bg-card/50 backdrop-blur-xl border border-border/60 p-3 sm:p-4 shadow-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />

        {/* Header with toggle */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 border border-accent/30 flex-shrink-0">
              <Flame className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="font-bold text-sm sm:text-base bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent truncate">
              Hot Markets
            </h3>
          </div>

          {/* Segmented toggle */}
          <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/40 flex-shrink-0">
            <button
              onClick={() => setActiveTab("gainers")}
              className={`px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-semibold transition-all flex items-center gap-1 ${
                activeTab === "gainers"
                  ? "bg-green-500/15 text-green-500 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingUp className="h-3 w-3" />
              Gainers
            </button>
            <button
              onClick={() => setActiveTab("losers")}
              className={`px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-semibold transition-all flex items-center gap-1 ${
                activeTab === "losers"
                  ? "bg-red-500/15 text-red-500 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingDown className="h-3 w-3" />
              Losers
            </button>
          </div>
        </div>

        {/* Horizontal scrolling list */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1 snap-x snap-mandatory">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="min-w-[150px] h-14 rounded-lg bg-muted/40 animate-pulse flex-shrink-0" />
              ))
            : list.map((m) => (
                <div key={m.symbol} className="snap-start">
                  {renderCard(m, isGainer)}
                </div>
              ))}
        </div>
      </div>
    );
  }

  // ============ FULL VARIANT (for Home page) ============
  return (
    <section className="py-10 sm:py-16 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-6 sm:mb-10">
          <Badge variant="outline" className="mb-3 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/30">
            <Flame className="h-3 w-3 mr-1" /> Top Movers
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-black mb-2">
            Today's <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Hot Markets</span>
          </h2>
          <p className="text-sm text-muted-foreground">Live gainers & losers updated every minute</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          <Card className="p-4 sm:p-6 bg-card/60 backdrop-blur border-green-500/20">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <h3 className="font-bold">Top Gainers</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="min-w-[200px] h-16 rounded-lg bg-muted/40 animate-pulse" />
                  ))
                : gainers.map((m) => renderCard(m, true))}
            </div>
          </Card>

          <Card className="p-4 sm:p-6 bg-card/60 backdrop-blur border-red-500/20">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <TrendingDown className="h-4 w-4 text-red-500" />
              </div>
              <h3 className="font-bold">Top Losers</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="min-w-[200px] h-16 rounded-lg bg-muted/40 animate-pulse" />
                  ))
                : losers.map((m) => renderCard(m, false))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};
