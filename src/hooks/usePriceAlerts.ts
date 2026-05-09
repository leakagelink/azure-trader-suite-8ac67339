import { useEffect, useRef, useState } from "react";

export interface PriceAlert {
  id: string;
  symbol: string;
  price: number;
  direction: "above" | "below";
  triggered: boolean;
  createdAt: number;
}

const KEY = (s: string) => `chart-alerts::${s}`;

export function usePriceAlerts(symbol: string) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    loaded.current = false;
    try {
      const raw = localStorage.getItem(KEY(symbol));
      setAlerts(raw ? JSON.parse(raw) : []);
    } catch { setAlerts([]); }
    loaded.current = true;
  }, [symbol]);

  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(KEY(symbol), JSON.stringify(alerts)); } catch {}
  }, [alerts, symbol]);

  return { alerts, setAlerts };
}
