import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calculator, TrendingUp, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const TradingCalculator = () => {
  const navigate = useNavigate();
  const [entry, setEntry] = useState("100");
  const [exit, setExit] = useState("110");
  const [lotSize, setLotSize] = useState("1");
  const [leverage, setLeverage] = useState("100");
  const [direction, setDirection] = useState<"long" | "short">("long");

  const result = useMemo(() => {
    const e = parseFloat(entry) || 0;
    const x = parseFloat(exit) || 0;
    const l = parseFloat(lotSize) || 0;
    const lev = parseFloat(leverage) || 1;
    const units = l * 100; // 1 lot = 100 units (simplified)
    const diff = direction === "long" ? x - e : e - x;
    const profit = diff * units;
    const margin = (e * units) / lev;
    const pips = Math.abs(diff) * (e > 100 ? 1 : 10000);
    const roi = margin > 0 ? (profit / margin) * 100 : 0;
    return { profit, margin, pips, roi };
  }, [entry, exit, lotSize, leverage, direction]);

  return (
    <section className="py-12 sm:py-20 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8 sm:mb-12">
          <Badge variant="outline" className="mb-3 bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/30">
            <Calculator className="h-3 w-3 mr-1" /> Trading Calculator
          </Badge>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mb-3">
            Calculate Your <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Profit & Margin</span>
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Plan trades like a pro. See profit, pips, margin & ROI before you enter.
          </p>
        </div>

        <Card className="max-w-4xl mx-auto p-6 sm:p-8 bg-card/60 backdrop-blur border-border/40">
          <Tabs value={direction} onValueChange={(v) => setDirection(v as "long" | "short")}>
            <TabsList className="grid grid-cols-2 w-full max-w-xs mx-auto mb-6">
              <TabsTrigger value="long" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-500">
                <TrendingUp className="h-4 w-4 mr-1" /> BUY
              </TabsTrigger>
              <TabsTrigger value="short" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-500">
                <TrendingUp className="h-4 w-4 mr-1 rotate-180" /> SELL
              </TabsTrigger>
            </TabsList>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="entry">Entry Price ($)</Label>
                  <Input id="entry" type="number" value={entry} onChange={(e) => setEntry(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="exit">Exit Price ($)</Label>
                  <Input id="exit" type="number" value={exit} onChange={(e) => setExit(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="lot">Lot Size</Label>
                  <Input id="lot" type="number" value={lotSize} onChange={(e) => setLotSize(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="lev">Leverage (1:X)</Label>
                  <Input id="lev" type="number" value={leverage} onChange={(e) => setLeverage(e.target.value)} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20">
                  <div className="text-xs text-muted-foreground mb-1">Estimated Profit/Loss</div>
                  <div className={`text-3xl font-black ${result.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {result.profit >= 0 ? "+" : ""}${result.profit.toFixed(2)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                    <div className="text-xs text-muted-foreground">Pips</div>
                    <div className="text-lg font-bold font-mono">{result.pips.toFixed(1)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                    <div className="text-xs text-muted-foreground">ROI</div>
                    <div className={`text-lg font-bold font-mono ${result.roi >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {result.roi >= 0 ? "+" : ""}{result.roi.toFixed(2)}%
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40 col-span-2">
                    <div className="text-xs text-muted-foreground">Required Margin</div>
                    <div className="text-lg font-bold font-mono">${result.margin.toFixed(2)}</div>
                  </div>
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground"
                  onClick={() => navigate("/auth")}
                >
                  Start Trading Now <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </Tabs>
        </Card>
      </div>
    </section>
  );
};
