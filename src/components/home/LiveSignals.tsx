import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, TrendingUp, TrendingDown, Target, Zap, ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

type Signal = {
  id: string;
  pair: string;
  signal_type: "long" | "short";
  entry_price: string;
  take_profit: string;
  stop_loss: string;
  confidence: number;
  created_at: string;
};

export const LiveSignals = ({ authenticated = false }: { authenticated?: boolean }) => {
  const navigate = useNavigate();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("trading_signals")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(authenticated ? 3 : 6);
      setSignals((data as Signal[]) || []);
      setLoading(false);
    };
    load();

    // Realtime updates so changes from broker reflect instantly
    const channel = supabase
      .channel("trading_signals_home")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trading_signals" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authenticated]);

  if (!loading && signals.length === 0) return null;

  return (
    <section className="py-12 sm:py-20 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8 sm:mb-12">
          <Badge variant="outline" className="mb-3 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/30">
            <Zap className="h-3 w-3 mr-1" /> Premium Signals
          </Badge>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mb-3">
            Today's <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Live Trading Signals</span>
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Expert-curated entries with TP/SL — sign up to unlock all signals.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="relative max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {signals.map((s, i) => (
                <Card
                  key={s.id}
                  className={`p-5 bg-card/60 backdrop-blur border-border/40 relative overflow-hidden ${
                    !authenticated && i >= 2 ? "blur-[3px] pointer-events-none select-none" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${s.signal_type === "long" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                        {s.signal_type === "long" ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                      </div>
                      <div>
                        <div className="font-bold">{s.pair}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">
                          {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={s.signal_type === "long" ? "text-green-500 border-green-500/40" : "text-red-500 border-red-500/40"}>
                      {s.signal_type === "long" ? "BUY" : "SELL"}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Entry</span>
                      <span className="font-mono font-bold">{s.entry_price}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Target className="h-3 w-3 text-green-500" /> TP
                      </span>
                      <span className="font-mono font-bold text-green-500">{s.take_profit}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">SL</span>
                      <span className="font-mono font-bold text-red-500">{s.stop_loss}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Confidence</span>
                      <span className="text-xs font-bold">{s.confidence}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent"
                        style={{ width: `${s.confidence}%` }}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Unlock overlay — only for unauthenticated users with blurred signals */}
            {!authenticated && signals.length > 2 && (
              <div className="absolute inset-0 flex items-end justify-center pb-8 pointer-events-none">
                <div className="bg-background/80 backdrop-blur-xl border border-primary/30 rounded-2xl p-6 text-center shadow-2xl pointer-events-auto max-w-md">
                  <Lock className="h-8 w-8 text-primary mx-auto mb-2" />
                  <h3 className="font-bold text-lg mb-1">Unlock All Signals</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get unlimited access to premium trading signals
                  </p>
                  <Button
                    onClick={() => navigate("/auth")}
                    className="bg-gradient-to-r from-primary to-accent text-primary-foreground"
                  >
                    Sign Up Free <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
