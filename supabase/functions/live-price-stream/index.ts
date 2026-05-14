// SSE (Server-Sent Events) live price stream.
//
// Why: client-side polling forces every viewer to hit our edge function
// every few seconds and pulls cached values that often haven't moved.
// This endpoint pushes price ticks from the server, so the chart can
// keep its last candle moving without any client-side timers.
//
// Usage from the client:
//   const es = new EventSource(`${SUPABASE_URL}/functions/v1/live-price-stream?symbol=XAU`);
//   es.onmessage = (e) => { const { price, ts } = JSON.parse(e.data); ... };
//
// Notes:
// - For crypto we just open a Binance trade websocket server-side and forward
//   the last trade price. For forex/commodities we fetch Yahoo Finance every
//   ~1.5s server-side (Yahoo needs no API key).
// - The connection auto-closes after STREAM_MAX_MS to stay under edge limits.
//   Clients reconnect automatically (EventSource does this by default).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STREAM_MAX_MS = 110_000; // < 2 min so clients reconnect cleanly
const TICK_MS = 800; // Yahoo poll cadence (forex/commodities)
const FORCE_EMIT_MS = 4_000; // emit at least this often even if price didn't change
const BINANCE_MIN_EMIT_MS = 120; // upper bound on Binance trade emits (~8/s)

// ----------------------------------------------------------------- symbol maps
const COMMODITY_TO_YAHOO: Record<string, string> = {
  XAU: "GC=F",
  XAG: "SI=F",
  XPT: "PL=F",
  XPD: "PA=F",
  XCU: "HG=F",
  WTI: "CL=F",
  BRENT: "BZ=F",
  NG: "NG=F",
};

const FOREX_BASES = new Set([
  "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "INR", "CNY", "SGD",
]);

const CRYPTO_BINANCE: Record<string, string> = {
  BTC: "btcusdt", ETH: "ethusdt", BNB: "bnbusdt", SOL: "solusdt",
  XRP: "xrpusdt", ADA: "adausdt", DOGE: "dogeusdt", DOT: "dotusdt",
  MATIC: "maticusdt", AVAX: "avaxusdt", LINK: "linkusdt", LTC: "ltcusdt",
  TRX: "trxusdt", SHIB: "shibusdt", UNI: "uniusdt", ATOM: "atomusdt",
};

function classify(symbol: string): "crypto" | "forex" | "commodity" | null {
  const s = symbol.toUpperCase();
  if (COMMODITY_TO_YAHOO[s]) return "commodity";
  if (FOREX_BASES.has(s) || s.includes("/")) return "forex";
  if (CRYPTO_BINANCE[s] || /^[A-Z0-9]{2,10}$/.test(s)) return "crypto";
  return null;
}

function yahooSymbolFor(asset: string, symbol: string): string | null {
  const s = symbol.toUpperCase();
  if (asset === "commodity") return COMMODITY_TO_YAHOO[s] ?? null;
  if (asset === "forex") {
    // Accept "EUR" or "EUR/USD" or "EURUSD"
    let base = s.replace("/", "").replace("USD", "");
    if (!base) base = "EUR";
    return `USD${base}=X`;
  }
  return null;
}

// ----------------------------------------------------------------- yahoo poll
async function fetchYahooPrice(yahooSymbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yahooSymbol,
    )}?interval=1m&range=1d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const p = meta?.regularMarketPrice;
    return typeof p === "number" && p > 0 ? p : null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------- handlers
function buildPollingStream(
  fetchPrice: () => Promise<number | null>,
): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(enc.encode(chunk)); } catch { closed = true; }
      };

      // Tell the browser to retry quickly on disconnect
      safeEnqueue("retry: 1500\n\n");

      const tick = async () => {
        const p = await fetchPrice();
        if (p == null) return;
        safeEnqueue(`data: ${JSON.stringify({ price: p, ts: Date.now() })}\n\n`);
      };

      // Heartbeat keeps the connection from being killed by intermediaries
      const heartbeat = () => safeEnqueue(`: hb ${Date.now()}\n\n`);

      await tick();
      const tickId = setInterval(tick, TICK_MS);
      const hbId = setInterval(heartbeat, 15_000);
      const stopId = setTimeout(() => {
        closed = true;
        clearInterval(tickId);
        clearInterval(hbId);
        try { controller.close(); } catch {}
      }, STREAM_MAX_MS);

      const cleanup = () => {
        closed = true;
        clearInterval(tickId);
        clearInterval(hbId);
        clearTimeout(stopId);
        try { controller.close(); } catch {}
      };
      // Close handler is wired below via cancel()
      (controller as any)._cleanup = cleanup;
    },
    cancel() {
      // Browser closed the EventSource
      try { (this as any)._cleanup?.(); } catch {}
    },
  });
}

function buildBinanceStream(symbol: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const pair = (CRYPTO_BINANCE[symbol.toUpperCase()] ??
    `${symbol.toLowerCase()}usdt`);
  const url = `wss://stream.binance.com:9443/ws/${pair}@trade`;

  return new ReadableStream({
    async start(controller) {
      let closed = false;
      let ws: WebSocket | null = null;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(enc.encode(chunk)); } catch { closed = true; }
      };
      safeEnqueue("retry: 1500\n\n");

      try {
        ws = new WebSocket(url);
        ws.onmessage = (ev) => {
          try {
            const m = JSON.parse(ev.data);
            const p = parseFloat(m.p);
            if (!isFinite(p) || p <= 0) return;
            safeEnqueue(`data: ${JSON.stringify({ price: p, ts: Date.now() })}\n\n`);
          } catch {}
        };
        ws.onerror = () => { /* noop, will be retried by client */ };
      } catch {}

      const hbId = setInterval(() => safeEnqueue(`: hb ${Date.now()}\n\n`), 15_000);
      const stopId = setTimeout(() => {
        closed = true;
        clearInterval(hbId);
        try { ws?.close(); } catch {}
        try { controller.close(); } catch {}
      }, STREAM_MAX_MS);

      const cleanup = () => {
        closed = true;
        clearInterval(hbId);
        clearTimeout(stopId);
        try { ws?.close(); } catch {}
        try { controller.close(); } catch {}
      };
      (controller as any)._cleanup = cleanup;
    },
    cancel() {
      try { (this as any)._cleanup?.(); } catch {}
    },
  });
}

// ----------------------------------------------------------------- entrypoint
serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const symbolParam = url.searchParams.get("symbol")?.trim();
    if (!symbolParam) {
      return new Response(JSON.stringify({ error: "symbol required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const asset = classify(symbolParam);
    if (!asset) {
      return new Response(JSON.stringify({ error: "unknown symbol" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let stream: ReadableStream<Uint8Array>;
    if (asset === "crypto") {
      stream = buildBinanceStream(symbolParam);
    } else {
      const yahoo = yahooSymbolFor(asset, symbolParam);
      if (!yahoo) {
        return new Response(JSON.stringify({ error: "unsupported symbol" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      stream = buildPollingStream(() => fetchYahooPrice(yahoo));
    }

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
