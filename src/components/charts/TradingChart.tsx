import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import DrawingOverlay from "./DrawingOverlay";
import { useChartDrawings, type DrawingMode } from "@/hooks/useChartDrawings";
import {
  bb as calcBB,
  ema as calcEMA,
  macd as calcMACD,
  rsi as calcRSI,
  sma as calcSMA,
  type IndicatorConfig,
  DEFAULTS,
} from "@/lib/indicators";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface Props {
  symbol: string;
  candles: Candle[];
  mode: DrawingMode;
  color: string;
  magnet?: boolean;
  indicators?: IndicatorConfig[];
}

export default function TradingChart({ symbol, candles, mode, color, magnet, indicators = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<IChartApi | null>(null);
  const [series, setSeries] = useState<ISeriesApi<"Candlestick"> | null>(null);
  const [volSeries, setVolSeries] = useState<ISeriesApi<"Histogram"> | null>(null);
  const indSeriesRef = useRef<ISeriesApi<any>[]>([]);
  const { drawings, setDrawings } = useChartDrawings(symbol);

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
    const cs = c.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    const vs = c.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: "rgba(148,163,184,0.4)",
    });
    vs.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    setChart(c);
    setSeries(cs);
    setVolSeries(vs);
    return () => {
      c.remove();
      setChart(null);
      setSeries(null);
      setVolSeries(null);
      indSeriesRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!series || !volSeries || !candles.length) return;
    const data = candles.map((k) => ({
      time: k.time as any,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
    }));
    series.setData(data);
    volSeries.setData(
      candles.map((k) => ({
        time: k.time as any,
        value: k.volume ?? 0,
        color: k.close >= k.open ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)",
      })),
    );
  }, [candles, series, volSeries]);

  // Indicators
  useEffect(() => {
    if (!chart || !candles.length) return;
    // tear down previous
    for (const s of indSeriesRef.current) {
      try { chart.removeSeries(s); } catch {}
    }
    indSeriesRef.current = [];

    let nextPane = 1; // pane 0 = price

    const addLine = (
      points: { time: number; value: number }[],
      color: string,
      pane = 0,
      lineWidth: 1 | 2 = 2,
    ) => {
      const s = chart.addSeries(
        LineSeries,
        { color, lineWidth, priceLineVisible: false, lastValueVisible: false },
        pane,
      );
      s.setData(points.map((p) => ({ time: p.time as any, value: p.value })));
      indSeriesRef.current.push(s);
    };

    for (const ind of indicators) {
      const def = DEFAULTS[ind.kind] || {};
      const color = ind.color || def.color || "#888";
      if (ind.kind === "sma") {
        addLine(calcSMA(candles, ind.period ?? def.period ?? 20), color);
      } else if (ind.kind === "ema") {
        addLine(calcEMA(candles, ind.period ?? def.period ?? 21), color);
      } else if (ind.kind === "bb") {
        const r = calcBB(candles, ind.period ?? 20, ind.stdDev ?? 2);
        addLine(r.mid, color, 0, 1);
        addLine(r.upper, color, 0, 1);
        addLine(r.lower, color, 0, 1);
      } else if (ind.kind === "rsi") {
        const pane = nextPane++;
        addLine(calcRSI(candles, ind.period ?? 14), color, pane);
        // 30 / 70 reference lines
        const t0 = candles[0].time, tN = candles[candles.length - 1].time;
        addLine([{ time: t0, value: 70 }, { time: tN, value: 70 }], "rgba(239,68,68,0.5)", pane, 1);
        addLine([{ time: t0, value: 30 }, { time: tN, value: 30 }], "rgba(16,185,129,0.5)", pane, 1);
      } else if (ind.kind === "macd") {
        const pane = nextPane++;
        const r = calcMACD(candles, ind.fast ?? 12, ind.slow ?? 26, ind.signal ?? 9);
        addLine(r.macdLine, color, pane);
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
    chart.timeScale().fitContent();
  }, [chart, candles, indicators]);

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] ?? last;
  const change = last && prev ? ((last.close - prev.close) / prev.close) * 100 : 0;

  return (
    <div className="relative h-full w-full" style={{ overscrollBehavior: "contain" }}>
      <div ref={containerRef} className="absolute inset-0" />
      <DrawingOverlay
        chart={chart}
        series={series}
        containerRef={containerRef}
        mode={mode}
        color={color}
        drawings={drawings}
        setDrawings={setDrawings}
        candles={candles}
        magnet={magnet}
      />
      {last && (
        <div className="absolute left-3 top-3 z-10 rounded-lg border border-border/40 bg-background/70 px-3 py-1.5 text-xs backdrop-blur-md">
          <span className="font-semibold">{symbol}</span>
          <span className="ml-3 text-muted-foreground">O</span> {last.open.toFixed(2)}
          <span className="ml-2 text-muted-foreground">H</span> {last.high.toFixed(2)}
          <span className="ml-2 text-muted-foreground">L</span> {last.low.toFixed(2)}
          <span className="ml-2 text-muted-foreground">C</span> {last.close.toFixed(2)}
          <span className={`ml-3 font-semibold ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
}
