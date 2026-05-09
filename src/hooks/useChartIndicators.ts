import { useEffect, useRef, useState } from "react";
import type { IndicatorConfig } from "@/lib/indicators";

const KEY = (s: string) => `chart-indicators::${s}`;

export function useChartIndicators(symbol: string) {
  const [indicators, setIndicators] = useState<IndicatorConfig[]>([]);
  const loaded = useRef(false);
  useEffect(() => {
    loaded.current = false;
    try {
      const raw = localStorage.getItem(KEY(symbol));
      setIndicators(raw ? JSON.parse(raw) : []);
    } catch {
      setIndicators([]);
    }
    loaded.current = true;
  }, [symbol]);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(KEY(symbol), JSON.stringify(indicators)); } catch {}
  }, [indicators, symbol]);
  return { indicators, setIndicators };
}
