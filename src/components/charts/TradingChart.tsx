import { memo, useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries,
  BarSeries,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
} from "lightweight-charts";
import DrawingOverlay from "./DrawingOverlay";
import { useChartDrawings, type DrawingMode } from "@/hooks/useChartDrawings";
import {
  bb as calcBB,
  ema as calcEMA,
  macd as calcMACD,
  rsi as calcRSI,
  sma as calcSMA,
  vwap as calcVWAP,
  stochastic as calcStoch,
  atr as calcATR,
  heikinAshi,
  type IndicatorConfig,
  DEFAULTS,
} from "@/lib/indicators";
import type { PriceAlert } from "@/hooks/usePriceAlerts";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type ChartType = "candles" | "heikin" | "line" | "area" | "bars";

interface Props {
  symbol: string;
  candles: Candle[];
  mode: DrawingMode;
  color: string;
  magnet?: boolean;
  indicators?: IndicatorConfig[];
  chartType?: ChartType;
  alerts?: PriceAlert[];
}

function TradingChart({
  symbol,
  candles,
  mode,
  color,
  magnet,
  indicators = [],
  chartType = "candles",
  alerts = [],
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const [mainSeries, setMainSeries] = useState<ISeriesApi<any> | null>(null);
  const [volSeries, setVolSeries] = useState<ISeriesApi<"Histogram"> | null>(null);
  const indSeriesRef = useRef<ISeriesApi<any>[]>([]);
  const alertLinesRef = useRef<IPriceLine[]>([]);
  const disposedRef = useRef(false);
  // Animation/throttling refs for smooth live tick rendering
  const prevCandlesRef = useRef<Candle[] | null>(null);
  const prevChartTypeRef = useRef<ChartType | null>(null);
  const pendingCandleRef = useRef<Candle | null>(null);
  const rafRef = useRef<number | null>(null);
  const tweenStateRef = useRef<{ from: number; to: number; t0: number } | null>(null);
  const { drawings, setDrawings } = useChartDrawings(symbol);

  // create chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const c = createChart(containerRef.current, {
      layout: {
        background: { color: "#0B0F1A" },
        textColor: "#cbd5e1",
        panes: { separatorColor: "rgba(255,255,255,0.08)", separatorHoverColor: "rgba(59,130,246,0.4)" },
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
      autoSize: true,
    });
    const vs = c.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: "rgba(148,163,184,0.4)",
    });
    vs.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    setChart(c);
    setVolSeries(vs);
    return () => {
      disposedRef.current = true;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      try { c.remove(); } catch {}
      setChart(null);
      setMainSeries(null);
      mainSeriesRef.current = null;
      setVolSeries(null);
      indSeriesRef.current = [];
      alertLinesRef.current = [];
      prevCandlesRef.current = null;
      prevChartTypeRef.current = null;
      pendingCandleRef.current = null;
      tweenStateRef.current = null;
    };
  }, []);

  // (re)create main series whenever chartType changes
  useEffect(() => {
    if (!chart) return;
    if (mainSeriesRef.current) {
      try { chart.removeSeries(mainSeriesRef.current); } catch {}
      mainSeriesRef.current = null;
    }
    let s: ISeriesApi<any>;
    if (chartType === "line") {
      s = chart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 2 });
    } else if (chartType === "area") {
      s = chart.addSeries(AreaSeries, {
        lineColor: "#3b82f6",
        topColor: "rgba(59,130,246,0.4)",
        bottomColor: "rgba(59,130,246,0.02)",
        lineWidth: 2,
      });
    } else if (chartType === "bars") {
      s = chart.addSeries(BarSeries, { upColor: "#10b981", downColor: "#ef4444" });
    } else {
      s = chart.addSeries(CandlestickSeries, {
        upColor: "#10b981",
        downColor: "#ef4444",
        borderUpColor: "#10b981",
        borderDownColor: "#ef4444",
        wickUpColor: "#10b981",
        wickDownColor: "#ef4444",
      });
    }
    mainSeriesRef.current = s;
    setMainSeries(s);
  }, [chart, chartType]);

  // Feed data — incremental updates + rAF batching + close-price tween
  // for buttery-smooth live ticks. Full setData() is only used on the
  // first paint, when symbol/chartType changes, or when history grows
  // by more than one bar (e.g. a backfill). Live ticks fall through to
  // mainSeries.update() inside an animation frame, so we coalesce many
  // ws ticks per frame and let the browser repaint at ~60fps.
  useEffect(() => {
    if (!mainSeries || !volSeries || !candles.length) return;
    if (disposedRef.current) return;

    const VISIBLE_BARS = 80;
    const lockVisibleRange = () => {
      if (disposedRef.current) return;
      try {
        const len = candles.length;
        const from = Math.max(0, len - VISIBLE_BARS);
        chart?.timeScale().setVisibleLogicalRange({ from, to: len - 1 });
      } catch {}
    };

    const toMain = (k: Candle) =>
      chartType === "line" || chartType === "area"
        ? { time: k.time as any, value: k.close }
        : { time: k.time as any, open: k.open, high: k.high, low: k.low, close: k.close };

    const toVol = (k: Candle) => ({
      time: k.time as any,
      value: k.volume ?? 0,
      color: k.close >= k.open ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)",
    });

    const prev = prevCandlesRef.current;
    const prevType = prevChartTypeRef.current;
    const fullReload =
      !prev ||
      prevType !== chartType ||
      Math.abs(candles.length - prev.length) > 1 ||
      (prev.length > 0 && candles[0]?.time !== prev[0]?.time);

    const src = chartType === "heikin" ? heikinAshi(candles) : candles;

    if (fullReload) {
      try {
        mainSeries.setData(src.map(toMain));
        volSeries.setData(candles.map(toVol));
      } catch {}
      lockVisibleRange();
      tweenStateRef.current = null;
      pendingCandleRef.current = null;
    } else {
      // Either the last bar updated in place, or one new bar appended.
      const lastSrc = src[src.length - 1];
      const lastVol = candles[candles.length - 1];
      pendingCandleRef.current = lastSrc;

      // Set up a tween from the previous close to the new close so the
      // candle "morphs" instead of jumping. Heikin/area/line all benefit.
      const prevLast = (chartType === "heikin" ? heikinAshi(prev!) : prev!)[prev!.length - 1];
      if (prevLast && prevLast.time === lastSrc.time && prevLast.close !== lastSrc.close) {
        tweenStateRef.current = { from: prevLast.close, to: lastSrc.close, t0: performance.now() };
      } else {
        tweenStateRef.current = null;
      }

      const flush = () => {
        rafRef.current = null;
        if (disposedRef.current || !mainSeriesRef.current) return;
        const target = pendingCandleRef.current;
        if (!target) return;

        const tw = tweenStateRef.current;
        const TWEEN_MS = 140;
        let renderClose = target.close;
        let stillTweening = false;
        if (tw) {
          const t = (performance.now() - tw.t0) / TWEEN_MS;
          if (t >= 1) {
            renderClose = tw.to;
          } else {
            // easeOutCubic for natural settle
            const e = 1 - Math.pow(1 - t, 3);
            renderClose = tw.from + (tw.to - tw.from) * e;
            stillTweening = true;
          }
        }

        try {
          if (chartType === "line" || chartType === "area") {
            mainSeriesRef.current.update({ time: target.time as any, value: renderClose });
          } else {
            const high = Math.max(target.high, renderClose);
            const low = Math.min(target.low, renderClose);
            mainSeriesRef.current.update({
              time: target.time as any,
              open: target.open,
              high,
              low,
              close: renderClose,
            });
          }
          volSeries.update(toVol(lastVol));
        } catch {}

        // If a new bar was appended (not just an in-place update), make
        // sure the visible window slides forward by one bar.
        if (prev && candles.length === prev.length + 1) {
          lockVisibleRange();
        }

        if (stillTweening && !disposedRef.current) {
          rafRef.current = requestAnimationFrame(flush);
        }
      };

      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flush);
      }
    }

    prevCandlesRef.current = candles;
    prevChartTypeRef.current = chartType;
  }, [candles, mainSeries, volSeries, chartType, chart]);


  // Indicators
  useEffect(() => {
    if (!chart || !candles.length) return;
    for (const s of indSeriesRef.current) { try { chart.removeSeries(s); } catch {} }
    indSeriesRef.current = [];
    let nextPane = 1;
    const addLine = (pts: { time: number; value: number }[], col: string, pane = 0, lw: 1 | 2 = 2) => {
      const s = chart.addSeries(
        LineSeries,
        { color: col, lineWidth: lw, priceLineVisible: false, lastValueVisible: false },
        pane,
      );
      s.setData(pts.map((p) => ({ time: p.time as any, value: p.value })));
      indSeriesRef.current.push(s);
    };
    for (const ind of indicators) {
      const def = DEFAULTS[ind.kind] || {};
      const col = ind.color || def.color || "#888";
      if (ind.kind === "sma") addLine(calcSMA(candles, ind.period ?? 20), col);
      else if (ind.kind === "ema") addLine(calcEMA(candles, ind.period ?? 21), col);
      else if (ind.kind === "bb") {
        const r = calcBB(candles, ind.period ?? 20, ind.stdDev ?? 2);
        addLine(r.mid, col, 0, 1); addLine(r.upper, col, 0, 1); addLine(r.lower, col, 0, 1);
      } else if (ind.kind === "vwap") {
        addLine(calcVWAP(candles), col);
      } else if (ind.kind === "rsi") {
        const pane = nextPane++;
        addLine(calcRSI(candles, ind.period ?? 14), col, pane);
        const t0 = candles[0].time, tN = candles[candles.length - 1].time;
        addLine([{ time: t0, value: 70 }, { time: tN, value: 70 }], "rgba(239,68,68,0.5)", pane, 1);
        addLine([{ time: t0, value: 30 }, { time: tN, value: 30 }], "rgba(16,185,129,0.5)", pane, 1);
      } else if (ind.kind === "stoch") {
        const pane = nextPane++;
        const r = calcStoch(candles, ind.period ?? 14, ind.smoothK ?? 3, ind.smoothD ?? 3);
        addLine(r.k, col, pane);
        addLine(r.d, "#f97316", pane, 1);
        const t0 = candles[0].time, tN = candles[candles.length - 1].time;
        addLine([{ time: t0, value: 80 }, { time: tN, value: 80 }], "rgba(239,68,68,0.4)", pane, 1);
        addLine([{ time: t0, value: 20 }, { time: tN, value: 20 }], "rgba(16,185,129,0.4)", pane, 1);
      } else if (ind.kind === "atr") {
        addLine(calcATR(candles, ind.period ?? 14), col, nextPane++);
      } else if (ind.kind === "macd") {
        const pane = nextPane++;
        const r = calcMACD(candles, ind.fast ?? 12, ind.slow ?? 26, ind.signal ?? 9);
        addLine(r.macdLine, col, pane);
        addLine(r.signal, "#f97316", pane, 1);
        const hs = chart.addSeries(
          HistogramSeries,
          { priceLineVisible: false, lastValueVisible: false },
          pane,
        );
        hs.setData(r.hist.map((h) => ({ time: h.time as any, value: h.value, color: h.color })));
        indSeriesRef.current.push(hs);
      }
    }
    // Keep the same fixed window after indicator changes
    try {
      const VISIBLE_BARS = 80;
      const len = candles.length;
      const from = Math.max(0, len - VISIBLE_BARS);
      chart.timeScale().setVisibleLogicalRange({ from, to: len - 1 });
    } catch {}
  }, [chart, candles, indicators]);

  // Alert price lines
  useEffect(() => {
    if (!mainSeries) return;
    for (const pl of alertLinesRef.current) { try { mainSeries.removePriceLine(pl); } catch {} }
    alertLinesRef.current = [];
    for (const a of alerts) {
      if (a.triggered) continue;
      const pl = mainSeries.createPriceLine({
        price: a.price,
        color: a.direction === "above" ? "#10b981" : "#ef4444",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: a.direction === "above" ? "▲ alert" : "▼ alert",
      });
      alertLinesRef.current.push(pl);
    }
  }, [mainSeries, alerts]);

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] ?? last;
  const change = last && prev ? ((last.close - prev.close) / prev.close) * 100 : 0;

  // ----- Debug overlay: live OHLC + last-tick timestamps to verify lag/freeze
  const [debug, setDebug] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("tradingChartDebug") === "1";
  });
  const [debugStats, setDebugStats] = useState({
    tickCount: 0,
    barCount: 0,
    lastTickAt: 0,
    lastBarOpenedAt: 0,
    msSinceTick: 0,
  });
  const debugStatsRef = useRef(debugStats);
  debugStatsRef.current = debugStats;
  const lastSeenRef = useRef<{ time: number; close: number } | null>(null);

  // Count ticks/bar transitions whenever candles update.
  useEffect(() => {
    if (!candles.length) return;
    const lc = candles[candles.length - 1];
    const seen = lastSeenRef.current;
    const now = Date.now();
    const isNewBar = !seen || lc.time !== seen.time;
    const isTick = !seen || lc.close !== seen.close || isNewBar;
    if (!isTick) return;
    lastSeenRef.current = { time: lc.time, close: lc.close };
    setDebugStats((s) => ({
      tickCount: s.tickCount + 1,
      barCount: s.barCount + (isNewBar ? 1 : 0),
      lastTickAt: now,
      lastBarOpenedAt: isNewBar ? now : s.lastBarOpenedAt,
      msSinceTick: 0,
    }));
  }, [candles]);

  // Tick the "ms since last update" counter while debug is on.
  useEffect(() => {
    if (!debug) return;
    const id = setInterval(() => {
      setDebugStats((s) => ({ ...s, msSinceTick: Date.now() - (s.lastTickAt || Date.now()) }));
    }, 250);
    return () => clearInterval(id);
  }, [debug]);

  const toggleDebug = () => {
    setDebug((v) => {
      const next = !v;
      try { localStorage.setItem("tradingChartDebug", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const fmtTs = (ms: number) => {
    if (!ms) return "—";
    const d = new Date(ms);
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  };
  const fmtBarTime = (sec: number) => {
    if (!sec) return "—";
    const d = new Date(sec * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  // Color the "ms since" badge so a freeze is obvious at a glance.
  const stale = debugStats.msSinceTick;
  const staleClass =
    stale > 5000 ? "text-red-500" : stale > 2000 ? "text-amber-500" : "text-emerald-500";

  return (
    <div className="relative h-full w-full" style={{ overscrollBehavior: "contain" }}>
      <div ref={containerRef} className="absolute inset-0" />
      <DrawingOverlay
        chart={chart}
        series={mainSeries as any}
        containerRef={containerRef}
        mode={mode}
        color={color}
        drawings={drawings}
        setDrawings={setDrawings}
        candles={candles}
        magnet={magnet}
      />
      {last && (
        <div className="pointer-events-none absolute left-2 right-2 top-2 z-10 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border/40 bg-background/70 px-2.5 py-1.5 text-[10px] backdrop-blur-md sm:text-xs">
          <span className="font-semibold">{symbol}</span>
          <span className="text-muted-foreground">O <span className="text-foreground">{last.open.toFixed(2)}</span></span>
          <span className="text-muted-foreground">H <span className="text-foreground">{last.high.toFixed(2)}</span></span>
          <span className="text-muted-foreground">L <span className="text-foreground">{last.low.toFixed(2)}</span></span>
          <span className="text-muted-foreground">C <span className="text-foreground">{last.close.toFixed(2)}</span></span>
          <span className={`font-semibold ${change >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)}%
          </span>
        </div>
      )}

      {/* Debug toggle (always visible, very small) */}
      <button
        type="button"
        onClick={toggleDebug}
        title={debug ? "Hide debug overlay" : "Show debug overlay"}
        className={`absolute right-2 top-12 z-20 rounded-md border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider backdrop-blur-md transition-colors ${
          debug
            ? "border-primary/60 bg-primary/15 text-primary"
            : "border-border/40 bg-background/60 text-muted-foreground hover:text-foreground"
        }`}
      >
        dbg
      </button>

      {/* Debug overlay panel */}
      {debug && last && (
        <div className="pointer-events-none absolute bottom-2 left-2 z-20 max-w-[260px] rounded-lg border border-border/60 bg-background/85 p-2 font-mono text-[10px] leading-tight backdrop-blur-md shadow-sm">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-bold tracking-wider text-primary">DEBUG · {symbol}</span>
            <span className={`font-bold ${staleClass}`}>
              {stale}ms
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span className="text-muted-foreground">O</span><span>{last.open}</span>
            <span className="text-muted-foreground">H</span><span>{last.high}</span>
            <span className="text-muted-foreground">L</span><span>{last.low}</span>
            <span className="text-muted-foreground">C</span><span>{last.close}</span>
            <span className="text-muted-foreground">vol</span><span>{(last.volume ?? 0).toLocaleString()}</span>
          </div>
          <div className="mt-1 border-t border-border/40 pt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            <span className="text-muted-foreground">bar t</span><span>{fmtBarTime(last.time)}</span>
            <span className="text-muted-foreground">last tick</span><span>{fmtTs(debugStats.lastTickAt)}</span>
            <span className="text-muted-foreground">bar opened</span><span>{fmtTs(debugStats.lastBarOpenedAt)}</span>
            <span className="text-muted-foreground">ticks</span><span>{debugStats.tickCount}</span>
            <span className="text-muted-foreground">bars</span><span>{debugStats.barCount}</span>
            <span className="text-muted-foreground">candles</span><span>{candles.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(TradingChart, (prev, next) => {
  if (prev.symbol !== next.symbol) return false;
  if (prev.mode !== next.mode) return false;
  if (prev.color !== next.color) return false;
  if (prev.magnet !== next.magnet) return false;
  if (prev.chartType !== next.chartType) return false;
  if (prev.indicators !== next.indicators) return false;
  if (prev.alerts !== next.alerts) return false;
  if (prev.candles === next.candles) return true;
  if (prev.candles.length !== next.candles.length) return false;
  const a = prev.candles[prev.candles.length - 1];
  const b = next.candles[next.candles.length - 1];
  return (
    !!a && !!b &&
    a.time === b.time &&
    a.open === b.open &&
    a.high === b.high &&
    a.low === b.low &&
    a.close === b.close
  );
});
