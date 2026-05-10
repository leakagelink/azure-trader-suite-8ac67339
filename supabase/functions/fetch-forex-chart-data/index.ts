import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXCHANGERATE_HOST_KEY = '9a730bf18b3dbe6bceedb04fea11c39f';

async function fetchRateFromYahoo(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/USD${symbol.toUpperCase()}=X?interval=1d&range=2d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      console.error('Yahoo chart HTTP error:', res.status);
      return null;
    }
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' ? price : null;
  } catch (e) {
    console.error('Yahoo chart fetch error:', e);
    return null;
  }
}

async function fetchRateFromExchangerateHost(symbol: string): Promise<number | null> {
  try {
    const url = `https://api.exchangerate.host/live?access_key=${EXCHANGERATE_HOST_KEY}&source=USD&currencies=${symbol}`;
    console.log('Fetching rate from exchangerate.host for', symbol);
    const response = await fetch(url);
    if (!response.ok) {
      console.error('exchangerate.host HTTP error:', response.status);
      return null;
    }
    const data = await response.json();
    if (!data.success || !data.quotes) {
      console.error('exchangerate.host response error:', JSON.stringify(data));
      return null;
    }
    const key = `USD${symbol.toUpperCase()}`;
    const rate = data.quotes[key];
    return typeof rate === 'number' ? rate : (rate ? parseFloat(rate) : null);
  } catch (e) {
    console.error('exchangerate.host fetch error:', e);
    return null;
  }
}

async function fetchRateFromFrankfurter(symbol: string): Promise<number | null> {
  try {
    const url = `https://api.frankfurter.app/latest?from=USD&to=${symbol.toUpperCase()}`;
    console.log('Fetching rate from Frankfurter for', symbol);
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data.rates?.[symbol.toUpperCase()] ?? null;
  } catch (e) {
    console.error('Frankfurter fetch error:', e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, interval } = await req.json();
    
    if (!symbol) {
      throw new Error('Symbol is required');
    }

    const intervalMinutes: Record<string, number> = {
      '1m': 1, '5m': 5, '15m': 15, '1h': 60, '4h': 240, '1d': 1440,
    };

    const minutes = intervalMinutes[interval] || 60;
    const candleCount = 50;
    
    const fallbackRates: Record<string, number> = {
      'EUR': 0.92, 'GBP': 0.79, 'JPY': 157.5, 'CHF': 0.90, 'AUD': 1.61,
      'CAD': 1.44, 'NZD': 1.78, 'INR': 85.5, 'CNY': 7.30, 'SGD': 1.36,
      'HKD': 7.79, 'MXN': 20.5, 'ZAR': 18.5,
    };
    
    let currentRate: number | null = null;
    let source = 'fallback';

    // Try Yahoo Finance first (free, no key, near real-time)
    currentRate = await fetchRateFromYahoo(symbol);
    if (currentRate !== null) {
      source = 'yahoo';
      console.log(`Got ${symbol} rate from Yahoo: ${currentRate}`);
    }

    // Fallback to exchangerate.host
    if (currentRate === null) {
      currentRate = await fetchRateFromExchangerateHost(symbol);
      if (currentRate !== null) {
        source = 'exchangerate.host';
        console.log(`Got ${symbol} rate from exchangerate.host: ${currentRate}`);
      }
    }

    // Fallback to Frankfurter
    if (currentRate === null) {
      currentRate = await fetchRateFromFrankfurter(symbol);
      if (currentRate !== null) {
        source = 'frankfurter';
        console.log(`Got ${symbol} rate from Frankfurter: ${currentRate}`);
      }
    }

    if (currentRate === null) {
      currentRate = fallbackRates[symbol.toUpperCase()] || 1.0;
      source = 'fallback';
      console.log(`Using fallback rate for ${symbol}: ${currentRate}`);
    }

    // Generate realistic OHLC candles based on current price
    const startDate = new Date(Date.now() - (minutes * candleCount * 60000));
    const candles = [];
    const volatilityMap: Record<string, number> = {
      '1m': 0.0001, '5m': 0.0002, '15m': 0.0003,
      '1h': 0.0005, '4h': 0.001, '1d': 0.002,
    };
    
    const volatility = volatilityMap[interval] || 0.0005;
    let price = currentRate * 0.995;
    
    for (let i = 0; i < candleCount; i++) {
      const timestamp = startDate.getTime() + (i * minutes * 60000);
      const timestampHuman = new Date(timestamp).toISOString();
      
      const open = price;
      const change = (Math.random() - 0.48) * volatility * price;
      const close = open + change;
      
      const rangeFactor = Math.random() * 0.5 + 0.5;
      const high = Math.max(open, close) + (Math.abs(change) * rangeFactor);
      const low = Math.min(open, close) - (Math.abs(change) * rangeFactor);
      
      candles.push({
        timestamp: Math.floor(timestamp / 1000),
        timestampHuman,
        open: parseFloat(open.toFixed(6)),
        high: parseFloat(high.toFixed(6)),
        low: parseFloat(low.toFixed(6)),
        close: parseFloat(close.toFixed(6)),
        volume: Math.floor(Math.random() * 1000000) + 500000,
      });
      
      price = close;
    }
    
    const lastCandle = candles[candles.length - 1];
    lastCandle.close = currentRate;
    lastCandle.high = Math.max(lastCandle.high, currentRate);
    lastCandle.low = Math.min(lastCandle.low, currentRate);

    return new Response(
      JSON.stringify({
        success: true,
        candles,
        currentPrice: currentRate,
        source,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-forex-chart-data function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
