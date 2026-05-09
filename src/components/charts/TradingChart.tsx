import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, HistogramSeries, type IChartApi, type ISeriesApi } from "lightweight-charts";
import DrawingOverlay from "./DrawingOverlay";
import { useChartDrawings, type DrawingMode } from "@/hooks/useChartDrawings";

export interface Candle {
  time: number; // unix seconds
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
}

export default function TradingChart({ symbol, candles, mode, color, magnet }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<IChartApi | null>(null);
  const [series, setSeries] = useState<ISeriesApi<"Candlestick"> | null>(null);
  const [volSeries, setVolSeries] = useState<ISeriesApi<"Histogram"> | null>(null);
  const { drawings, setDrawings } = useChartDrawings(symbol);

  useEffect(() => {
    if (!containerRef.current) return;
    const c = createChart(containerRef.current, {
      layout: {
        background: { color: "#0B0F1A" },
        textColor: "#cbd5e1",
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
    chart?.timeScale().fitContent();
  }, [candles, series, volSeries, chart]);

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
