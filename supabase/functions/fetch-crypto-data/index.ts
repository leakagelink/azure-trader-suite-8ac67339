import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type CryptoItem = {
  name: string;
  symbol: string;
  price: string;
  change: string;
  isPositive: boolean;
  logo: string;
  currencySymbol: string;
  high24h: string;
  low24h: string;
  id: string | number;
};

const LISTINGS_CACHE_DURATION_MS = 60000;
const QUOTES_CACHE_DURATION_MS = 3000;
const cacheStore = new Map<string, { data: { cryptoData: CryptoItem[] }; timestamp: number }>();

const STATIC_FALLBACK_DATA = {
  cryptoData: [
    { name: "Bitcoin", symbol: "BTC", price: "95000.00", change: "+2.50%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png", currencySymbol: "$", high24h: "96000.00", low24h: "93000.00", id: 1 },
    { name: "Ethereum", symbol: "ETH", price: "3200.00", change: "+3.20%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png", currencySymbol: "$", high24h: "3300.00", low24h: "3100.00", id: 1027 },
    { name: "Tether USDt", symbol: "USDT", price: "1.00", change: "+0.01%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png", currencySymbol: "$", high24h: "1.00", low24h: "1.00", id: 825 },
    { name: "XRP", symbol: "XRP", price: "2.30", change: "+5.00%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/52.png", currencySymbol: "$", high24h: "2.40", low24h: "2.20", id: 52 },
    { name: "BNB", symbol: "BNB", price: "650.00", change: "+1.80%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png", currencySymbol: "$", high24h: "660.00", low24h: "640.00", id: 1839 },
    { name: "Solana", symbol: "SOL", price: "180.00", change: "+4.50%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png", currencySymbol: "$", high24h: "185.00", low24h: "175.00", id: 5426 },
    { name: "USDC", symbol: "USDC", price: "1.00", change: "0.00%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png", currencySymbol: "$", high24h: "1.00", low24h: "1.00", id: 3408 },
    { name: "Dogecoin", symbol: "DOGE", price: "0.15", change: "+8.00%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/74.png", currencySymbol: "$", high24h: "0.16", low24h: "0.14", id: 74 },
    { name: "Cardano", symbol: "ADA", price: "0.50", change: "+6.00%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/2010.png", currencySymbol: "$", high24h: "0.52", low24h: "0.48", id: 2010 },
    { name: "Chainlink", symbol: "LINK", price: "15.00", change: "+4.00%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1975.png", currencySymbol: "$", high24h: "15.50", low24h: "14.50", id: 1975 },
  ]
};

const rateLimitedKeys: Map<string, number> = new Map();
const RATE_LIMIT_COOLDOWN_MS = 60000;

function normalizeRequestedSymbols(symbols: unknown): string[] {
  if (!Array.isArray(symbols)) return [];
  return Array.from(
    new Set(
      symbols
        .map((value) => String(value || '').trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function getCacheKey(symbols: string[]) {
  return symbols.length > 0 ? `quotes:${symbols.slice().sort().join(',')}` : 'listings:top20';
}

function getCachedPayload(cacheKey: string, ttl: number) {
  const cached = cacheStore.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > ttl) return null;
  return cached.data;
}

function setCachedPayload(cacheKey: string, data: { cryptoData: CryptoItem[] }) {
  cacheStore.set(cacheKey, { data, timestamp: Date.now() });
}

function transformCoinMarketCapCoin(coin: any): CryptoItem {
  const quote = coin?.quote?.USD;
  const currentPrice = Number(quote?.price || 0);
  const percentChange24h = Number(quote?.percent_change_24h || 0);
  const high24h = Number(quote?.high_24h || 0);
  const low24h = Number(quote?.low_24h || 0);

  return {
    name: coin?.name || coin?.symbol || 'Unknown',
    symbol: String(coin?.symbol || '').toUpperCase(),
    price: currentPrice.toFixed(8).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'),
    change: `${percentChange24h >= 0 ? '+' : ''}${percentChange24h.toFixed(2)}%`,
    isPositive: percentChange24h >= 0,
    logo: coin?.id ? `https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png` : '',
    currencySymbol: '$',
    high24h: (high24h || currentPrice).toFixed(8).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'),
    low24h: (low24h || currentPrice).toFixed(8).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'),
    id: coin?.id || coin?.symbol || crypto.randomUUID(),
  };
}

async function getActiveApiKey(serviceName: string, excludeKeys: string[] = []) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  await reEnableExpiredKeys(serviceName);

  const { data: allKeys, error } = await supabase
    .from('api_keys')
    .select('api_key, is_active, priority, last_used_at')
    .eq('service_name', serviceName)
    .order('priority', { ascending: true });

  if (error || !allKeys || allKeys.length === 0) {
    return null;
  }

  const now = Date.now();
  for (const key of allKeys) {
    if (!key.api_key) continue;
    if (excludeKeys.includes(key.api_key)) continue;

    const cooldownExpiry = rateLimitedKeys.get(key.api_key);
    if (cooldownExpiry && now < cooldownExpiry) continue;
    if (cooldownExpiry) rateLimitedKeys.delete(key.api_key);

    if (key.is_active) {
      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('service_name', serviceName)
        .eq('api_key', key.api_key);
      return key.api_key;
    }
  }

  for (const key of allKeys) {
    if (!key.api_key) continue;
    if (excludeKeys.includes(key.api_key)) continue;

    const cooldownExpiry = rateLimitedKeys.get(key.api_key);
    if (cooldownExpiry && now < cooldownExpiry) continue;

    const { error: updateError } = await supabase
      .from('api_keys')
      .update({ is_active: true, last_used_at: new Date().toISOString() })
      .eq('service_name', serviceName)
      .eq('api_key', key.api_key);

    if (!updateError) return key.api_key;
  }

  return null;
}

async function reEnableExpiredKeys(serviceName: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const now = Date.now();

  const { data: inactiveKeys, error } = await supabase
    .from('api_keys')
    .select('api_key, last_used_at')
    .eq('service_name', serviceName)
    .eq('is_active', false);

  if (error || !inactiveKeys) return;

  for (const key of inactiveKeys) {
    const cooldownExpiry = rateLimitedKeys.get(key.api_key);
    if (!cooldownExpiry || now >= cooldownExpiry) {
      if (key.last_used_at && new Date(key.last_used_at).getTime() < now - RATE_LIMIT_COOLDOWN_MS) {
        await supabase
          .from('api_keys')
          .update({ is_active: true })
          .eq('service_name', serviceName)
          .eq('api_key', key.api_key);
        rateLimitedKeys.delete(key.api_key);
      }
    }
  }
}

async function markKeyAsRateLimited(serviceName: string, apiKey: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  rateLimitedKeys.set(apiKey, Date.now() + RATE_LIMIT_COOLDOWN_MS);

  await supabase
    .from('api_keys')
    .update({ is_active: false, last_used_at: new Date().toISOString() })
    .eq('service_name', serviceName)
    .eq('api_key', apiKey);
}

async function fetchCoinMarketCapListings(apiKey: string) {
  return await fetch('https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=20&convert=USD', {
    headers: {
      'X-CMC_PRO_API_KEY': apiKey,
      'Accept': 'application/json',
    },
  });
}

async function fetchCoinMarketCapQuotes(apiKey: string, symbols: string[]) {
  return await fetch(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(symbols.join(','))}&convert=USD`, {
    headers: {
      'X-CMC_PRO_API_KEY': apiKey,
      'Accept': 'application/json',
    },
  });
}

async function fetchCryptoDataFromCoinGecko(symbols: string[] = []) {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${symbols.length > 0 ? 250 : 20}&page=1&sparkline=false&price_change_percentage=24h`
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  const data = await response.json();
  const requested = new Set(symbols);
  const filtered = symbols.length > 0
    ? data.filter((coin: any) => requested.has(String(coin.symbol || '').toUpperCase()))
    : data;

  return {
    cryptoData: filtered.map((coin: any) => ({
      name: coin.name,
      symbol: String(coin.symbol || '').toUpperCase(),
      price: Number(coin.current_price || 0).toFixed(8).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'),
      change: `${(coin.price_change_percentage_24h || 0) >= 0 ? '+' : ''}${Number(coin.price_change_percentage_24h || 0).toFixed(2)}%`,
      isPositive: Number(coin.price_change_percentage_24h || 0) >= 0,
      logo: coin.image,
      currencySymbol: '$',
      high24h: Number(coin.high_24h || coin.current_price || 0).toFixed(8).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'),
      low24h: Number(coin.low_24h || coin.current_price || 0).toFixed(8).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'),
      id: coin.id,
    })),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let requestBody: any = {};
    if (req.method !== 'GET') {
      try {
        requestBody = await req.json();
      } catch {
        requestBody = {};
      }
    }

    const requestedSymbols = normalizeRequestedSymbols(requestBody?.symbols);
    const cacheKey = getCacheKey(requestedSymbols);
    const cacheTtl = requestedSymbols.length > 0 ? QUOTES_CACHE_DURATION_MS : LISTINGS_CACHE_DURATION_MS;

    const cachedPayload = getCachedPayload(cacheKey, cacheTtl);
    if (cachedPayload) {
      return new Response(JSON.stringify(cachedPayload), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let attempts = 0;
    const maxAttempts = 10;
    let apiKey: string | null = null;
    const usedKeys: string[] = [];

    while (attempts < maxAttempts) {
      attempts++;
      apiKey = await getActiveApiKey('coinmarketcap', usedKeys);

      if (!apiKey) {
        apiKey = Deno.env.get('COINMARKETCAP_API_KEY');
        if (!apiKey) break;
      } else {
        usedKeys.push(apiKey);
      }

      const response = requestedSymbols.length > 0
        ? await fetchCoinMarketCapQuotes(apiKey, requestedSymbols)
        : await fetchCoinMarketCapListings(apiKey);

      if (response.ok) {
        const data = await response.json();
        const cryptoData = requestedSymbols.length > 0
          ? requestedSymbols.flatMap((symbol) => {
              const quoteEntry = data?.data?.[symbol];
              if (!quoteEntry || !Array.isArray(quoteEntry) || quoteEntry.length === 0) return [];
              return [transformCoinMarketCapCoin(quoteEntry[0])];
            })
          : (data?.data || []).map(transformCoinMarketCapCoin);

        const payload = { cryptoData };
        setCachedPayload(cacheKey, payload);

        return new Response(JSON.stringify(payload), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      if (response.status === 429) {
        if (apiKey) await markKeyAsRateLimited('coinmarketcap', apiKey);
        continue;
      }

      break;
    }

    try {
      const coinGeckoData = await fetchCryptoDataFromCoinGecko(requestedSymbols);
      if (coinGeckoData.cryptoData.length > 0 || requestedSymbols.length === 0) {
        setCachedPayload(cacheKey, coinGeckoData);
        return new Response(JSON.stringify(coinGeckoData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    } catch (error) {
      console.error('CoinGecko fallback failed:', error);
    }

    const staleCache = cacheStore.get(cacheKey)?.data;
    if (staleCache) {
      return new Response(JSON.stringify(staleCache), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const safeFallback = requestedSymbols.length > 0
      ? { cryptoData: [] }
      : STATIC_FALLBACK_DATA;

    return new Response(JSON.stringify(safeFallback), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in fetch-crypto-data function:', error);
    return new Response(JSON.stringify({ cryptoData: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});