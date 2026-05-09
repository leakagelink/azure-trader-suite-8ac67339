// Economic Calendar - High Impact events for current week using Trading Economics guest API
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const parseNumeric = (v: string | null | undefined): number | null => {
  if (!v) return null;
  const cleaned = String(v).replace(/[%$,]/g, '').trim();
  if (cleaned === '' || cleaned === '-') return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
};

const extractUnit = (v: string | null | undefined): string => {
  if (!v) return '';
  if (v.includes('%')) return '%';
  if (v.includes('$')) return '$';
  return '';
};

// Country name → ISO code mapping
const countryToCode: Record<string, string> = {
  'United States': 'US',
  'Euro Area': 'EU',
  'European Union': 'EU',
  'Germany': 'DE',
  'France': 'FR',
  'Italy': 'IT',
  'United Kingdom': 'UK',
  'Japan': 'JP',
  'China': 'CN',
  'India': 'IN',
  'Canada': 'CA',
  'Australia': 'AU',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Calculate this week's date range (Monday to Sunday, UTC)
    const now = new Date();
    const day = now.getUTCDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + diffToMon);
    monday.setUTCHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    sunday.setUTCHours(23, 59, 59, 999);

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const fromDate = fmt(monday);
    const toDate = fmt(sunday);

    // Trading Economics guest API - free, no key needed
    // importance=3 means high impact only
    const url = `https://api.tradingeconomics.com/calendar/country/all/${fromDate}/${toDate}?c=guest:guest&importance=3&format=json`;
    
    console.log(`Fetching TE calendar ${fromDate} to ${toDate}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Trading Economics API failed [${response.status}]: ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      console.error('Unexpected response shape:', JSON.stringify(data).slice(0, 200));
      throw new Error('Invalid response from Trading Economics');
    }

    // Top economies whitelist
    const topCountryNames = new Set([
      'United States', 'Euro Area', 'European Union', 'United Kingdom',
      'Japan', 'China', 'India', 'Germany', 'France', 'Canada', 'Australia', 'Italy'
    ]);

    const events = data
      .filter((ev: any) => {
        return ev.Importance === 3 && 
               topCountryNames.has(ev.Country) && 
               ev.Event &&
               ev.Date;
      })
      .map((ev: any) => {
        const unit = ev.Unit || extractUnit(ev.Actual) || extractUnit(ev.Previous) || extractUnit(ev.Forecast);
        return {
          date: ev.Date,
          country: countryToCode[ev.Country] || ev.Country,
          countryName: ev.Country,
          event: ev.Event,
          currency: ev.Currency || '',
          impact: 'high',
          actual: parseNumeric(ev.Actual),
          previous: parseNumeric(ev.Previous),
          estimate: parseNumeric(ev.Forecast) ?? parseNumeric(ev.TEForecast),
          unit,
        };
      })
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log(`Returning ${events.length} high-impact events`);

    return new Response(
      JSON.stringify({ events, weekStart: fromDate, weekEnd: toDate }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error fetching economic calendar:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg, events: [] }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
