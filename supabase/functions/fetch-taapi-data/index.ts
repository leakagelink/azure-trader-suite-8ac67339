import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateFallbackCandles(symbol: string, interval: string, count: number = 20) {
  console.log(`Generating fallback data for ${symbol}`);
  
  const now = Date.now();
  const intervalMs = getIntervalMilliseconds(interval);
  const basePrice = getBasePrice(symbol);
  
  const candles = [];
  let prevClose = basePrice;
  
  for (let i = count - 1; i >= 0; i--) {
    const timestamp = now - (i * intervalMs);
    const volatility = prevClose * 0.02;
    
    const open = prevClose;
    const close = open + (Math.random() - 0.5) * volatility * 2;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    const volume = Math.random() * 1000000;
    
    candles.push({
      timestamp: Math.floor(timestamp / 1000),
      timestampHuman: new Date(timestamp).toISOString(),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: parseFloat(volume.toFixed(2))
    });
    
    prevClose = close;
  }
  
  return candles;
}

function getIntervalMilliseconds(interval: string): number {
  const map: Record<string, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  };
  return map[interval] || 60 * 60 * 1000;
}

function getBasePrice(symbol: string): number {
  const prices: Record<string, number> = {
    'BTC': 102000,
    'ETH': 3350,
    'BNB': 970,
    'SOL': 158,
    'XRP': 2.23,
    'ADA': 0.55,
    'DOGE': 0.17,
    'TRX': 0.29,
    'DOT': 4.50,
    'MATIC': 0.40,
  };
  return prices[symbol.toUpperCase()] || 100;
}

async function getActiveApiKey(serviceName: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase.rpc('get_active_api_key', {
    p_service_name: serviceName
  });
  
  if (error) {
    console.error('Error fetching API key:', error);
    return null;
  }
  
  return data;
}

async function markKeyAsInactive(serviceName: string, apiKey: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('service_name', serviceName)
    .eq('api_key', apiKey);
  
  if (error) {
    console.error('Error marking key as inactive:', error);
  } else {
    console.log(`Marked ${serviceName} key as inactive due to rate limit`);
  }
}

async function fetchTaapiData(apiKey: string, symbol: string, interval: string) {
  const candleResponse = await fetch(
    `https://api.taapi.io/candles?secret=${apiKey}&exchange=binance&symbol=${symbol}/USDT&interval=${interval}&backtracks=10`,
    { signal: AbortSignal.timeout(5000) }
  );
  return candleResponse;
}

async function fetchTaapiPrice(apiKey: string, symbol: string) {
  const priceResponse = await fetch(
    `https://api.taapi.io/price?secret=${apiKey}&exchange=binance&symbol=${symbol}/USDT`,
    { signal: AbortSignal.timeout(3000) }
  );
  return priceResponse;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, interval = '1h' } = await req.json();
    
    let attempts = 0;
    const MAX_ATTEMPTS = 10;
    let lastError: any = null;

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      const apiKey = await getActiveApiKey('taapi');
      
      if (!apiKey) {
        console.log('No active TAAPI API key available, using fallback data');
        const fallbackCandles = generateFallbackCandles(symbol, interval);
        const currentPrice = fallbackCandles[fallbackCandles.length - 1].close;
        
        return new Response(
          JSON.stringify({ 
            candles: fallbackCandles,
            currentPrice,
            symbol,
            source: 'fallback'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Attempt ${attempts}: Fetching TAAPI data for ${symbol} with interval ${interval}`);

      try {
        const candleResponse = await fetchTaapiData(apiKey, symbol, interval);

        if (candleResponse.ok) {
          const candles = await candleResponse.json();

          // Try to fetch current price
          let currentPrice = candles[candles.length - 1]?.close || 0;
          try {
            const priceResponse = await fetchTaapiPrice(apiKey, symbol);
            if (priceResponse.ok) {
              const priceData = await priceResponse.json();
              currentPrice = priceData.value || currentPrice;
            }
          } catch {
            console.log('Could not fetch current price, using last candle close');
          }

          console.log(`Successfully fetched ${candles.length} candles from TAAPI for ${symbol}`);

          return new Response(
            JSON.stringify({ 
              candles: candles.reverse(),
              currentPrice,
              symbol,
              source: 'taapi'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if rate limit error
        if (candleResponse.status === 429) {
          const errorText = await candleResponse.text();
          console.error(`TAAPI rate limit hit for key, status ${candleResponse.status}:`, errorText);
          
          // Mark this key as inactive
          await markKeyAsInactive('taapi', apiKey);
          
          // Try next key
          console.log('Trying next available TAAPI API key...');
          continue;
        }

        // Check authentication error
        if (candleResponse.status === 401) {
          console.log('TAAPI authentication failed');
          await markKeyAsInactive('taapi', apiKey);
          continue;
        }

        // Other errors
        const errorText = await candleResponse.text();
        lastError = `TAAPI error ${candleResponse.status}: ${errorText}`;
        console.error(lastError);
        break;

      } catch (error) {
        lastError = error;
        console.error(`Error with TAAPI key attempt ${attempts}:`, error);
        
        // If it's a timeout or network error, try next key
        if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('network'))) {
          console.log('Network/timeout error, trying next key...');
          continue;
        }
        break;
      }
    }

    // If all attempts failed, use fallback
    console.log(`All TAAPI attempts failed, using fallback data`);
    const fallbackCandles = generateFallbackCandles(symbol, interval);
    const currentPrice = fallbackCandles[fallbackCandles.length - 1].close;
    
    return new Response(
      JSON.stringify({ 
        candles: fallbackCandles,
        currentPrice,
        symbol,
        source: 'fallback',
        reason: lastError instanceof Error ? lastError.message : 'UNKNOWN'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    
    // Even on unexpected errors, return fallback data
    const fallbackCandles = generateFallbackCandles('BTC', '1h');
    return new Response(
      JSON.stringify({ 
        candles: fallbackCandles,
        currentPrice: fallbackCandles[fallbackCandles.length - 1].close,
        symbol: 'BTC',
        source: 'fallback',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
