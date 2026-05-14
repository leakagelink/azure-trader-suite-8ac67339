import { useEffect, useRef } from "react";

interface Options {
  symbol: string;
  enabled: boolean;
  onPrice: (price: number, ts: number) => void;
}

/**
 * Subscribes to the `live-price-stream` edge function over Server-Sent
 * Events. The server pushes price ticks (~1.5s) so the client never has
 * to poll. EventSource automatically reconnects on disconnect.
 *
 * Used for Forex and Commodities. Crypto on the Charts page already uses
 * the direct Binance WebSocket via `useBinanceKlineStream`, which streams
 * full candles (not just last price), so we don't double-subscribe there.
 */
export function useLivePriceStream({ symbol, enabled, onPrice }: Options) {
  const esRef = useRef<EventSource | null>(null);
  const cbRef = useRef(onPrice);

  useEffect(() => {
    cbRef.current = onPrice;
  }, [onPrice]);

  useEffect(() => {
    if (!enabled || !symbol) return;

    const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!base) return;
    const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

    // EventSource cannot send custom headers, so the anon key is included
    // as a query param (this is a publishable key — safe for the browser).
    const params = new URLSearchParams({ symbol: symbol.toUpperCase() });
    if (apikey) params.set("apikey", apikey);
    const url = `${base}/functions/v1/live-price-stream?${params.toString()}`;

    let closed = false;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (ev) => {
      try {
        const { price, ts } = JSON.parse(ev.data);
        if (typeof price === "number" && price > 0) cbRef.current(price, ts ?? Date.now());
      } catch {
        // ignore malformed payloads
      }
    };
    es.onerror = () => {
      // EventSource will auto-reconnect; nothing to do here.
      if (closed) return;
    };

    return () => {
      closed = true;
      try { es.close(); } catch {}
      esRef.current = null;
    };
  }, [symbol, enabled]);
}
