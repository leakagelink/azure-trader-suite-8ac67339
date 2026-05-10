import { useCallback, useEffect, useMemo, useState } from "react";
import { useBinanceKlineStream } from "@/hooks/useBinanceKlineStream";
import {
  ArrowLeft,
  ChevronDown,
  Maximize2,
  Minimize2,
  MousePointer2,
  MousePointerClick,
  Magnet,
  Minus,
  MoveUpRight,
  Ruler,
  TrendingUp,
  TrendingDown,
  AlignHorizontalDistributeCenter,
  AlignVerticalJustifyCenter,
  Square,
  Sigma,
  Type as TypeIcon,
  Brush,
  Eraser,
  Undo2,
  Trash2,
  Search,
  CandlestickChart,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeForexChartData } from "@/lib/forexCache";
import { isForexSymbol, isCommoditySymbol } from "@/lib/marketSymbols";
import TradingChart, { type Candle, type ChartType } from "@/components/charts/TradingChart";
import { useChartDrawings, type DrawingMode } from "@/hooks/useChartDrawings";
import { useChartIndicators } from "@/hooks/useChartIndicators";
import IndicatorsMenu from "@/components/charts/IndicatorsMenu";
import AlertsMenu from "@/components/charts/AlertsMenu";
import { usePriceAlerts } from "@/hooks/usePriceAlerts";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"] as const;
type Tf = (typeof TIMEFRAMES)[number];

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "candles", label: "Candles" },
  { value: "heikin", label: "Heikin Ashi" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "bars", label: "Bars" },
];

const TOOLS: { mode: DrawingMode; label: string; Icon: any }[] = [
  { mode: "cursor", label: "Cursor", Icon: MousePointer2 },
  { mode: "select", label: "Select / Move", Icon: MousePointerClick },
  { mode: "trendline", label: "Trend Line", Icon: Minus },
  { mode: "ray", label: "Ray", Icon: MoveUpRight },
  { mode: "hline", label: "Horizontal", Icon: AlignHorizontalDistributeCenter },
  { mode: "vline", label: "Vertical", Icon: AlignVerticalJustifyCenter },
  { mode: "rectangle", label: "Rectangle", Icon: Square },
  { mode: "fib", label: "Fib Retr.", Icon: Sigma },
  { mode: "measure", label: "Measure", Icon: Ruler },
  { mode: "long", label: "Long Position", Icon: TrendingUp },
  { mode: "short", label: "Short Position", Icon: TrendingDown },
  { mode: "text", label: "Text", Icon: TypeIcon },
  { mode: "brush", label: "Brush", Icon: Brush },
  { mode: "eraser", label: "Eraser", Icon: Eraser },
];

const POPULAR = [
  { symbol: "BTC", name: "Bitcoin", market: "Crypto" },
  { symbol: "ETH", name: "Ethereum", market: "Crypto" },
  { symbol: "BNB", name: "BNB", market: "Crypto" },
  { symbol: "SOL", name: "Solana", market: "Crypto" },
  { symbol: "XRP", name: "Ripple", market: "Crypto" },
  { symbol: "ADA", name: "Cardano", market: "Crypto" },
  { symbol: "DOGE", name: "Dogecoin", market: "Crypto" },
  { symbol: "EUR/USD", name: "Euro / US Dollar", market: "Forex" },
  { symbol: "GBP/USD", name: "Pound / Dollar", market: "Forex" },
  { symbol: "USD/JPY", name: "Dollar / Yen", market: "Forex" },
  { symbol: "XAU", name: "Gold", market: "Commodity" },
  { symbol: "XAG", name: "Silver", market: "Commodity" },
  { symbol: "WTI", name: "Crude Oil", market: "Commodity" },
];

export default function Charts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSymbol = (searchParams.get("symbol") || "BTC").toUpperCase();
  const [symbol, setSymbol] = useState<string>(initialSymbol);

  // Sync symbol changes back to URL
  useEffect(() => {
    const current = (searchParams.get("symbol") || "").toUpperCase();
    if (current !== symbol) {
      setSearchParams({ symbol }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // React to URL symbol changes (e.g., back/forward)
  useEffect(() => {
    const urlSym = (searchParams.get("symbol") || "").toUpperCase();
    if (urlSym && urlSym !== symbol) setSymbol(urlSym);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [tf, setTf] = useState<Tf>("1h");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<DrawingMode>("cursor");
  const [color, setColor] = useState("#3b82f6");
  const [magnet, setMagnet] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [chartTypeOpen, setChartTypeOpen] = useState(false);
  const { drawings, setDrawings } = useChartDrawings(symbol);
  const { indicators, setIndicators } = useChartIndicators(symbol);
  const { alerts, setAlerts } = usePriceAlerts(symbol);
  const lastPrice = candles[candles.length - 1]?.close;

  // Fire alert toasts
  useEffect(() => {
    if (lastPrice == null) return;
    let changed = false;
    const next = alerts.map((a) => {
      if (a.triggered) return a;
      const hit =
        (a.direction === "above" && lastPrice >= a.price) ||
        (a.direction === "below" && lastPrice <= a.price);
      if (hit) {
        changed = true;
        toast.success(`${symbol} ${a.direction} ${a.price.toFixed(2)} — now ${lastPrice.toFixed(2)}`);
        return { ...a, triggered: true };
      }
      return a;
    });
    if (changed) setAlerts(next);
  }, [lastPrice, alerts, symbol, setAlerts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return POPULAR;
    return POPULAR.filter(
      (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    ).slice(0, 60);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const isForex = isForexSymbol(symbol);
        const { data, error } = isForex
          ? await invokeForexChartData(symbol.toUpperCase(), tf)
          : await supabase.functions.invoke("fetch-taapi-data", {
              body: { symbol: symbol.toUpperCase(), interval: tf },
            });
        if (error) throw error;
        if (cancelled) return;
        const raw = (data?.candles || []) as any[];
        const mapped: Candle[] = raw.map((k: any) => ({
          time: Math.floor((k.timestamp ?? k.time ?? 0) / (k.timestamp > 1e12 ? 1000 : 1)),
          open: Number(k.open),
          high: Number(k.high),
          low: Number(k.low),
          close: Number(k.close),
          volume: Number(k.volume ?? 0),
        })).filter((k) => Number.isFinite(k.open) && k.time > 0);
        // dedupe & sort
        const map = new Map<number, Candle>();
        mapped.forEach((c) => map.set(c.time, c));
        setCandles(Array.from(map.values()).sort((a, b) => a.time - b.time));
      } catch (e: any) {
        console.error(e);
        toast.error("Failed to load chart data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol, tf]);

  const isCrypto = !isForexSymbol(symbol) && !isCommoditySymbol(symbol);
  const [live, setLive] = useState(false);

  const handleLiveCandle = useCallback((c: Candle, _final: boolean) => {
    setLive(true);
    setCandles((prev) => {
      if (!prev.length) return [c];
      const last = prev[prev.length - 1];
      if (c.time === last.time) {
        const next = prev.slice(0, -1);
        next.push(c);
        return next;
      }
      if (c.time > last.time) {
        return [...prev, c];
      }
      return prev;
    });
  }, []);

  useBinanceKlineStream({
    symbol,
    interval: tf,
    enabled: isCrypto,
    onCandle: handleLiveCandle,
  });

  useEffect(() => {
    setLive(false);
  }, [symbol, tf]);

  const undo = () => setDrawings((prev) => prev.slice(0, -1));
  const clearAll = () => setDrawings([]);

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      {/* Header */}
      {!fullscreen && (
        <header className="flex h-14 items-center gap-2 border-b border-border/40 bg-background/80 px-3 backdrop-blur-md">
          <button
            onClick={() => navigate("/dashboard")}
            className="rounded-md p-2 hover:bg-muted/40"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-sm font-semibold hover:bg-muted/40"
            >
              {symbol}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>
            {searchOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSearchOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border/60 bg-popover shadow-2xl">
                  <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
                    <Search className="h-4 w-4 opacity-50" />
                    <input
                      autoFocus
                      placeholder="Search symbols..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full bg-transparent text-sm outline-none"
                    />
                  </div>
                  <div className="max-h-80 overflow-y-auto p-1">
                    {filtered.map((s) => (
                      <button
                        key={s.symbol}
                        onClick={() => {
                          setSymbol(s.symbol);
                          setSearchOpen(false);
                          setQuery("");
                        }}
                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted/50"
                      >
                        <div>
                          <div className="font-semibold">{s.symbol}</div>
                          <div className="text-xs text-muted-foreground">{s.name}</div>
                        </div>
                        <span className="rounded-md bg-muted/50 px-2 py-0.5 text-[10px] uppercase">
                          {s.market}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setChartTypeOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-xs font-semibold hover:bg-muted/40"
                title="Chart type"
              >
                <CandlestickChart className="h-3.5 w-3.5" />
                {CHART_TYPES.find((t) => t.value === chartType)?.label}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
              {chartTypeOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setChartTypeOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-xl border border-border/60 bg-popover p-1 shadow-2xl">
                    {CHART_TYPES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => { setChartType(t.value); setChartTypeOpen(false); }}
                        className={`block w-full rounded-md px-3 py-1.5 text-left text-xs hover:bg-muted/50 ${
                          chartType === t.value ? "bg-muted/40 font-semibold text-primary" : ""
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <IndicatorsMenu indicators={indicators} setIndicators={setIndicators} />
            <AlertsMenu symbol={symbol} currentPrice={lastPrice} alerts={alerts} setAlerts={setAlerts} />
            <button
              onClick={() => setFullscreen(true)}
              className="rounded-md p-2 hover:bg-muted/40"
              aria-label="Fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </header>
      )}

      {/* Timeframes */}
      {!fullscreen && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border/30 px-3 py-1.5">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={`shrink-0 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                tf === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
          {loading && <span className="ml-2 text-xs text-muted-foreground">loading…</span>}
          {isCrypto && live && !loading && (
            <span className="ml-2 flex items-center gap-1 text-[10px] font-semibold uppercase text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Live
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="relative flex-1 overflow-hidden">
        <TradingChart symbol={symbol} candles={candles} mode={mode} color={color} magnet={magnet} indicators={indicators} chartType={chartType} alerts={alerts} />

        {fullscreen && (
          <button
            onClick={() => setFullscreen(false)}
            className="absolute right-3 top-3 z-20 rounded-lg border border-border/50 bg-background/80 p-2 backdrop-blur-md"
            aria-label="Exit fullscreen"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        )}

        {/* Bottom tool dock */}
        <div
          className="absolute left-1/2 z-20 -translate-x-1/2 rounded-2xl border border-border/50 bg-background/80 p-1.5 shadow-2xl backdrop-blur-xl"
          style={{ bottom: `calc(${fullscreen ? "12px" : "76px"} + env(safe-area-inset-bottom))` }}
        >
          <div className="flex items-center gap-0.5">
            {TOOLS.map((t) => {
              const active = mode === t.mode;
              return (
                <button
                  key={t.mode}
                  onClick={() => setMode(t.mode)}
                  title={t.label}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <t.Icon className="h-4 w-4" />
                </button>
              );
            })}
            <div className="mx-1 h-6 w-px bg-border/50" />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              title="Color"
              className="h-7 w-7 cursor-pointer rounded-md border border-border/40 bg-transparent"
            />
            <button
              onClick={() => setMagnet((v) => !v)}
              title={magnet ? "Magnet: ON (snap to OHLC)" : "Magnet: OFF"}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                magnet
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Magnet className="h-4 w-4" />
            </button>
            <button
              onClick={undo}
              title="Undo"
              disabled={!drawings.length}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              onClick={clearAll}
              title="Delete all"
              disabled={!drawings.length}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {!fullscreen && <BottomNav />}
    </div>
  );
}
