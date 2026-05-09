import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INTERVAL_MAP: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '2h': '2h',
  '4h': '4h',
  '1d': '1d',
  '1w': '1w',
};

function generateFallbackCandles(symbol: string, interval: string, count = 20) {
  const now = Date.now();
  const intervalMs = getIntervalMs(interval);
  const basePrice = getBasePrice(symbol);
  const candles = [];
  let prev = basePrice;
  for (let i = count - 1; i >= 0; i--) {
    const ts = now - i * intervalMs;
    const vol = prev * 0.02;
    const open = prev;
    const close = open + (Math.random() - 0.5) * vol * 2;
    const high = Math.max(open, close) + Math.random() * vol;
    const low = Math.min(open, close) - Math.random() * vol;
    candles.push({
      timestamp: Math.floor(ts / 1000),
      timestampHuman: new Date(ts).toISOString(),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: +(Math.random() * 1000000).toFixed(2),
    });
    prev = close;
  }
  return candles;
}

function getIntervalMs(interval: string): number {
  const map: Record<string, number> = {
    '1m': 60_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000,
    '1h': 3_600_000, '2h': 7_200_000, '4h': 14_400_000,
    '1d': 86_400_000, '1w': 604_800_000,
  };
  return map[interval] || 3_600_000;
}

function getBasePrice(symbol: string): number {
  const prices: Record<string, number> = {
    BTC: 102000, ETH: 3350, BNB: 970, SOL: 158, XRP: 2.23,
    ADA: 0.55, DOGE: 0.17, TRX: 0.29, DOT: 4.5, MATIC: 0.4,
  };
  return prices[symbol.toUpperCase()] || 100;
}

async function fetchBinanceKlines(symbol: string, interval: string, limit = 100) {
  const apiKey = Deno.env.get('BINANCE_API_KEY');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers['X-MBX-APIKEY'] = apiKey;

  const binanceInterval = INTERVAL_MAP[interval] || '1h';
  const pair = `${symbol.toUpperCase()}USDT`;
  const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${binanceInterval}&limit=${limit}`;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Binance klines ${res.status}: ${await res.text()}`);
  const data = await res.json();

  return data.map((k: any[]) => ({
    timestamp: Math.floor(k[0] / 1000),
    timestampHuman: new Date(k[0]).toISOString(),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

async function fetchBinancePrice(symbol: string): Promise<number | null> {
  const apiKey = Deno.env.get('BINANCE_API_KEY');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers['X-MBX-APIKEY'] = apiKey;

  const pair = `${symbol.toUpperCase()}USDT`;
  const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`, {
    headers,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return parseFloat(data.price);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, interval = '1h' } = await req.json();
    console.log(`Fetching Binance klines for ${symbol} ${interval}`);

    try {
      const candles = await fetchBinanceKlines(symbol, interval, 100);
      let currentPrice = candles[candles.length - 1]?.close || 0;
      const livePrice = await fetchBinancePrice(symbol).catch(() => null);
      if (livePrice) currentPrice = livePrice;

      return new Response(
        JSON.stringify({ candles, currentPrice, symbol, source: 'binance' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('Binance failed, using fallback:', err);
      const candles = generateFallbackCandles(symbol, interval);
      return new Response(
        JSON.stringify({
          candles,
          currentPrice: candles[candles.length - 1].close,
          symbol,
          source: 'fallback',
          reason: err instanceof Error ? err.message : 'unknown',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    const candles = generateFallbackCandles('BTC', '1h');
    return new Response(
      JSON.stringify({
        candles,
        currentPrice: candles[candles.length - 1].close,
        symbol: 'BTC',
        source: 'fallback',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
