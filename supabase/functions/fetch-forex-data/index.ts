import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXCHANGERATE_HOST_KEY = '9a730bf18b3dbe6bceedb04fea11c39f';

const currencyInfo: Record<string, { symbol: string; flag: string; name: string }> = {
  'EUR': { symbol: '€', flag: '🇪🇺', name: 'Euro' },
  'GBP': { symbol: '£', flag: '🇬🇧', name: 'British Pound' },
  'JPY': { symbol: '¥', flag: '🇯🇵', name: 'Japanese Yen' },
  'AUD': { symbol: 'A$', flag: '🇦🇺', name: 'Australian Dollar' },
  'CAD': { symbol: 'C$', flag: '🇨🇦', name: 'Canadian Dollar' },
  'CHF': { symbol: 'CHF', flag: '🇨🇭', name: 'Swiss Franc' },
  'CNY': { symbol: '¥', flag: '🇨🇳', name: 'Chinese Yuan' },
  'INR': { symbol: '₹', flag: '🇮🇳', name: 'Indian Rupee' },
  'NZD': { symbol: 'NZ$', flag: '🇳🇿', name: 'New Zealand Dollar' },
  'SGD': { symbol: 'S$', flag: '🇸🇬', name: 'Singapore Dollar' },
};

const FALLBACK_RATES: Record<string, number> = {
  EUR: 0.92, GBP: 0.79, JPY: 157.5, AUD: 1.61, CAD: 1.44,
  CHF: 0.90, CNY: 7.30, INR: 85.5, NZD: 1.78, SGD: 1.36,
};

async function fetchFromExchangerateHost(currencies: string[]): Promise<Record<string, number> | null> {
  try {
    const url = `https://api.exchangerate.host/live?access_key=${EXCHANGERATE_HOST_KEY}&source=USD&currencies=${currencies.join(',')}`;
    console.log('Fetching from exchangerate.host:', url.replace(EXCHANGERATE_HOST_KEY, '***'));
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
    // quotes are like USDEUR, USDGBP -> normalize to EUR, GBP
    const rates: Record<string, number> = {};
    for (const [key, value] of Object.entries(data.quotes)) {
      const cur = key.replace('USD', '');
      rates[cur] = typeof value === 'number' ? value : parseFloat(value as string);
    }
    return rates;
  } catch (e) {
    console.error('exchangerate.host fetch error:', e);
    return null;
  }
}

async function fetchFromFrankfurter(currencies: string[]): Promise<Record<string, number> | null> {
  try {
    const url = `https://api.frankfurter.app/latest?from=USD&to=${currencies.join(',')}`;
    console.log('Fetching from Frankfurter:', url);
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Frankfurter HTTP error:', response.status);
      return null;
    }
    const data = await response.json();
    if (!data.rates) return null;
    return data.rates;
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
    const BASE_CURRENCY = 'USD';
    const currencies = ['EUR','GBP','JPY','AUD','CAD','CHF','CNY','INR','NZD','SGD'];

    let rates: Record<string, number> | null = null;
    let source = 'fallback';

    // Try exchangerate.host first
    rates = await fetchFromExchangerateHost(currencies);
    if (rates) {
      source = 'exchangerate.host';
      console.log('Got rates from exchangerate.host');
    } else {
      // Fallback to Frankfurter (free, no key)
      rates = await fetchFromFrankfurter(currencies);
      if (rates) {
        source = 'frankfurter';
        console.log('Got rates from Frankfurter');
      }
    }

    // Final fallback: static rates
    if (!rates) {
      rates = FALLBACK_RATES;
      source = 'fallback';
      console.log('Using fallback static rates');
    }

    const forexData = currencies.map((currency) => {
      const info = currencyInfo[currency] || { symbol: currency, flag: '💱', name: currency };
      const rateNum = rates![currency] ?? FALLBACK_RATES[currency] ?? 1.0;
      const changePercent = (Math.random() - 0.5) * 2;
      return {
        name: `${currency}/${BASE_CURRENCY}`,
        symbol: currency,
        price: rateNum.toFixed(4),
        change: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
        isPositive: changePercent >= 0,
        icon: info.flag,
        currencySymbol: info.symbol,
        fullName: info.name,
      };
    });

    return new Response(
      JSON.stringify({ forexData, source }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-forex-data function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
