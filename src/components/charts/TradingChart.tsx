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
      c.remove();
      setChart(null);
      setMainSeries(null);
      mainSeriesRef.current = null;
      setVolSeries(null);
      indSeriesRef.current = [];
      alertLinesRef.current = [];
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

  // feed data
  useEffect(() => {
    if (!mainSeries || !volSeries || !candles.length) return;
    const src = chartType === "heikin" ? heikinAshi(candles) : candles;
    if (chartType === "line" || chartType === "area") {
      mainSeries.setData(src.map((k) => ({ time: k.time as any, value: k.close })));
    } else {
      mainSeries.setData(
        src.map((k) => ({ time: k.time as any, open: k.open, high: k.high, low: k.low, close: k.close })),
      );
    }
    volSeries.setData(
      candles.map((k) => ({
        time: k.time as any,
        value: k.volume ?? 0,
        color: k.close >= k.open ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)",
      })),
    );
    // Lock the visible window to the last N bars so the chart looks the
    // same on every device (phones, tablets, desktops). Without this,
    // lightweight-charts auto-fits bar spacing to container width, so
    // wider screens show more bars than narrow ones.
    try {
      const VISIBLE_BARS = 80;
      const len = candles.length;
      const from = Math.max(0, len - VISIBLE_BARS);
      chart?.timeScale().setVisibleLogicalRange({ from, to: len - 1 });
    } catch {}
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
  return !!a && !!b && a.time === b.time && a.close === b.close;
});
