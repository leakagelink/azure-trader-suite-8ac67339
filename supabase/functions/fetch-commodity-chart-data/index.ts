import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYMBOL_TO_YAHOO: Record<string, string> = {
  XAU: 'GC=F',     // Gold
  XAG: 'SI=F',     // Silver
  XPT: 'PL=F',     // Platinum
  XPD: 'PA=F',     // Palladium
  XCU: 'HG=F',     // Copper
  WTI: 'CL=F',     // Crude Oil WTI
  BRENT: 'BZ=F',   // Brent
  NG: 'NG=F',      // Natural Gas
};

function mapInterval(tf: string): { yInterval: string; yRange: string } {
  switch (tf) {
    case '1m':  return { yInterval: '1m',  yRange: '1d'  };
    case '5m':  return { yInterval: '5m',  yRange: '5d'  };
    case '15m': return { yInterval: '15m', yRange: '5d'  };
    case '30m': return { yInterval: '30m', yRange: '1mo' };
    case '1h':  return { yInterval: '60m', yRange: '1mo' };
    case '2h':  return { yInterval: '60m', yRange: '3mo' };
    case '4h':  return { yInterval: '60m', yRange: '3mo' };
    case '1d':  return { yInterval: '1d',  yRange: '6mo' };
    case '1w':  return { yInterval: '1wk', yRange: '2y'  };
    default:    return { yInterval: '60m', yRange: '1mo' };
  }
}

function aggregateCandles(candles: any[], factor: number) {
  if (factor <= 1) return candles;
  const out: any[] = [];
  for (let i = 0; i < candles.length; i += factor) {
    const chunk = candles.slice(i, i + factor);
    if (chunk.length === 0) continue;
    let high = chunk[0].high, low = chunk[0].low, vol = 0;
    for (const c of chunk) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      vol += c.volume || 0;
    }
    out.push({
      timestamp: chunk[0].timestamp,
      open: chunk[0].open,
      high, low,
      close: chunk[chunk.length - 1].close,
      volume: vol,
    });
  }
  return out;
}

async function fetchYahooCandles(yahooSymbol: string, interval: string) {
  const { yInterval, yRange } = mapInterval(interval);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${yInterval}&range=${yRange}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    console.error('Yahoo chart HTTP error', res.status, yahooSymbol);
    return null;
  }
  const data = await res.json();
  const r = data?.chart?.result?.[0];
  if (!r) return null;
  const ts: number[] = r.timestamp || [];
  const q = r.indicators?.quote?.[0];
  const meta = r.meta;
  if (!q || ts.length === 0) return null;

  const candles: any[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({
      timestamp: ts[i],
      open: +(+o).toFixed(4),
      high: +(+h).toFixed(4),
      low: +(+l).toFixed(4),
      close: +(+c).toFixed(4),
      volume: Math.floor(+(v ?? 0)),
    });
  }
  if (candles.length === 0) return null;

  let out = candles;
  if (interval === '2h') out = aggregateCandles(candles, 2);
  if (interval === '4h') out = aggregateCandles(candles, 4);
  if (out.length > 100) out = out.slice(out.length - 100);

  const livePrice = meta?.regularMarketPrice;
  if (typeof livePrice === 'number' && out.length > 0) {
    const last = out[out.length - 1];
    last.close = livePrice;
    if (livePrice > last.high) last.high = livePrice;
    if (livePrice < last.low) last.low = livePrice;
  }
  return { candles: out, currentPrice: livePrice ?? out[out.length - 1].close };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { symbol, interval } = await req.json();
    if (!symbol) throw new Error('Symbol is required');
    const upper = symbol.toUpperCase();
    const yahooSymbol = SYMBOL_TO_YAHOO[upper];
    if (!yahooSymbol) {
      return new Response(
        JSON.stringify({ success: false, error: `Unsupported commodity symbol: ${upper}`, candles: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const result = await fetchYahooCandles(yahooSymbol, interval || '1h');
    if (!result) {
      return new Response(
        JSON.stringify({ success: false, error: 'No chart data available', candles: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ success: true, candles: result.candles, currentPrice: result.currentPrice, source: 'yahoo' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-commodity-chart-data:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg, candles: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
