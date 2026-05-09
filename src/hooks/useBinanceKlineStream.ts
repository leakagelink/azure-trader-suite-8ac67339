import { useEffect, useRef } from "react";
import type { Candle } from "@/components/charts/TradingChart";

const BINANCE_INTERVALS = new Set([
  "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M",
]);

interface Options {
  symbol: string;
  interval: string;
  enabled: boolean;
  onCandle: (c: Candle, isFinal: boolean) => void;
}

/**
 * Subscribes to Binance kline websocket and emits live candle updates.
 * Only enabled for crypto symbols. Auto-reconnects on disconnect.
 */
export function useBinanceKlineStream({ symbol, interval, enabled, onCandle }: Options) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const cbRef = useRef(onCandle);

  useEffect(() => {
    cbRef.current = onCandle;
  }, [onCandle]);

  useEffect(() => {
    if (!enabled || !symbol || !BINANCE_INTERVALS.has(interval)) return;

    let closed = false;
    const pair = `${symbol.toUpperCase()}USDT`.toLowerCase();
    const url = `wss://stream.binance.com:9443/ws/${pair}@kline_${interval}`;

    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const k = msg.k;
          if (!k) return;
          const candle: Candle = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
          };
          cbRef.current(candle, !!k.x);
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (closed) return;
        reconnectRef.current = window.setTimeout(connect, 2000);
      };
      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      try { wsRef.current?.close(); } catch {}
      wsRef.current = null;
    };
  }, [symbol, interval, enabled]);
}
