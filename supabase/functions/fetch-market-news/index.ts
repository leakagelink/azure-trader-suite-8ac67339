// Marketaux news fetcher for Crypto, Forex, Commodities
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

let cache: { data: any; timestamp: number; category: string } | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const FALLBACK_NEWS = [
  {
    uuid: "fb-1",
    title: "Bitcoin Holds Strong Above Key Support Level",
    description: "BTC continues to show resilience as institutional demand grows.",
    snippet: "Bitcoin maintains its position above critical support amid global market uncertainty.",
    url: "https://www.coindesk.com",
    image_url: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800",
    source: "CoinDesk",
    published_at: new Date().toISOString(),
    entities: [{ symbol: "BTC", name: "Bitcoin", type: "crypto" }],
  },
  {
    uuid: "fb-2",
    title: "Gold Prices Surge as Dollar Weakens",
    description: "Spot gold rallies on safe-haven demand and Fed rate cut expectations.",
    snippet: "Precious metals gain ground as investors seek refuge from market volatility.",
    url: "https://www.reuters.com",
    image_url: "https://images.unsplash.com/photo-1610375461246-83df859d849d?w=800",
    source: "Reuters",
    published_at: new Date(Date.now() - 3600000).toISOString(),
    entities: [{ symbol: "XAU", name: "Gold", type: "commodity" }],
  },
  {
    uuid: "fb-3",
    title: "EUR/USD Rebounds on ECB Policy Outlook",
    description: "Euro strengthens against dollar as ECB signals hawkish stance.",
    snippet: "Forex markets react to central bank communications across major economies.",
    url: "https://www.fxstreet.com",
    image_url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800",
    source: "FXStreet",
    published_at: new Date(Date.now() - 7200000).toISOString(),
    entities: [{ symbol: "EUR/USD", name: "Euro Dollar", type: "forex" }],
  },
  {
    uuid: "fb-4",
    title: "Ethereum Network Activity Hits New High",
    description: "ETH on-chain metrics signal growing adoption and network strength.",
    snippet: "Layer-2 solutions and DeFi continue to drive Ethereum's expansion.",
    url: "https://cointelegraph.com",
    image_url: "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=800",
    source: "Cointelegraph",
    published_at: new Date(Date.now() - 10800000).toISOString(),
    entities: [{ symbol: "ETH", name: "Ethereum", type: "crypto" }],
  },
  {
    uuid: "fb-5",
    title: "Crude Oil Prices Climb on Supply Concerns",
    description: "WTI and Brent crude rise as geopolitical tensions impact supply chains.",
    snippet: "Energy markets remain volatile amid OPEC+ production decisions.",
    url: "https://www.bloomberg.com",
    image_url: "https://images.unsplash.com/photo-1582486225644-088c0a3ff908?w=800",
    source: "Bloomberg",
    published_at: new Date(Date.now() - 14400000).toISOString(),
    entities: [{ symbol: "WTI", name: "Crude Oil", type: "commodity" }],
  },
  {
    uuid: "fb-6",
    title: "USD/JPY Tests Multi-Year Highs",
    description: "Dollar-Yen pair extends gains on diverging monetary policy expectations.",
    snippet: "BoJ intervention concerns mount as the yen weakens further.",
    url: "https://www.dailyfx.com",
    image_url: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800",
    source: "DailyFX",
    published_at: new Date(Date.now() - 18000000).toISOString(),
    entities: [{ symbol: "USD/JPY", name: "Dollar Yen", type: "forex" }],
  },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category') || 'all'; // all | crypto | forex | commodities
    const limit = parseInt(url.searchParams.get('limit') || '12');

    // Serve cache if valid
    if (cache && cache.category === category && Date.now() - cache.timestamp < CACHE_DURATION_MS) {
      console.log(`[News] Serving cached ${category} news`);
      return new Response(JSON.stringify({ data: cache.data, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('MARKETAUX_API_KEY');
    if (!apiKey) {
      console.error('[News] MARKETAUX_API_KEY not set, returning fallback');
      return new Response(JSON.stringify({ data: FALLBACK_NEWS, fallback: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build Marketaux query based on category
    // Only fetch news from the last 24 hours
    const publishedAfter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const params = new URLSearchParams({
      api_token: apiKey,
      language: 'en',
      limit: String(Math.min(limit, 50)),
      filter_entities: 'true',
      published_after: publishedAfter,
      sort: 'published_desc',
    });

    if (category === 'crypto') {
      params.set('industries', 'Cryptocurrency');
    } else if (category === 'forex') {
      params.set('search', 'forex OR currency OR EUR OR USD OR JPY OR GBP');
    } else if (category === 'commodities') {
      params.set('search', 'gold OR silver OR oil OR commodities OR crude');
    } else {
      params.set('search', 'crypto OR forex OR gold OR oil OR bitcoin');
    }

    const apiUrl = `https://api.marketaux.com/v1/news/all?${params.toString()}`;
    console.log(`[News] Fetching ${category} from Marketaux`);

    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.error(`[News] Marketaux error: ${response.status}`);
      return new Response(JSON.stringify({ data: FALLBACK_NEWS, fallback: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await response.json();
    const allArticles = json.data || [];

    // Safety filter: keep only articles from the last 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const articles = allArticles.filter((a: any) => {
      const t = new Date(a.published_at).getTime();
      return !isNaN(t) && t >= cutoff;
    });

    if (articles.length === 0) {
      return new Response(JSON.stringify({ data: FALLBACK_NEWS, fallback: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    cache = { data: articles, timestamp: Date.now(), category };

    return new Response(JSON.stringify({ data: articles, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[News] Error:', error);
    return new Response(JSON.stringify({ data: FALLBACK_NEWS, fallback: true, error: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
