import { useEffect, useRef, useState } from "react";

export type DrawingMode =
  | "cursor"
  | "select"
  | "trendline"
  | "hline"
  | "vline"
  | "rectangle"
  | "fib"
  | "text"
  | "brush"
  | "eraser";

export interface DrawingLine {
  id: string;
  type: DrawingMode;
  points: { time: number; price: number }[];
  color: string;
  lineWidth: number;
  text?: string;
}

const KEY = (symbol: string) => `chart-drawings::${symbol}`;

export function useChartDrawings(symbol: string) {
  const [drawings, setDrawings] = useState<DrawingLine[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    loaded.current = false;
    try {
      const raw = localStorage.getItem(KEY(symbol));
      setDrawings(raw ? JSON.parse(raw) : []);
    } catch {
      setDrawings([]);
    }
    loaded.current = true;
  }, [symbol]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(KEY(symbol), JSON.stringify(drawings));
    } catch {
      // ignore
    }
  }, [drawings, symbol]);

  return { drawings, setDrawings };
}
