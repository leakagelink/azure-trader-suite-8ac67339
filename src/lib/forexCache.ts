import { supabase } from "@/integrations/supabase/client";
import { resolveSymbolSpec, registerSymbolSpec, type SymbolSpec } from "./symbolRegistry";

/** Auto-register every symbol returned by an API response so contract specs stay in sync. */
function autoRegisterSymbols(payload: any) {
  try {
    const candidates: any[] = [];
    if (Array.isArray(payload)) candidates.push(...payload);
    if (payload && typeof payload === 'object') {
      for (const key of Object.keys(payload)) {
        if (Array.isArray((payload as any)[key])) candidates.push(...(payload as any)[key]);
      }
    }
    for (const item of candidates) {
      const sym: string | undefined = item?.symbol || item?.base || item?.code;
      if (!sym || typeof sym !== 'string') continue;
      const inferred = resolveSymbolSpec(sym);
      const merged: SymbolSpec = {
        symbol: inferred.symbol,
        assetClass: item.assetClass ?? inferred.assetClass,
        contractSize: typeof item.contractSize === 'number' ? item.contractSize : inferred.contractSize,
        unit: item.unit ?? inferred.unit,
        minLot: typeof item.minLot === 'number' ? item.minLot : inferred.minLot,
        maxLot: typeof item.maxLot === 'number' ? item.maxLot : inferred.maxLot,
        step: typeof item.step === 'number' ? item.step : inferred.step,
      };
      registerSymbolSpec(merged);
    }
  } catch (e) {
    console.warn('autoRegisterSymbols failed', e);
  }
}

/**
 * Lightweight in-memory cache + in-flight dedupe for forex edge functions.
 *
 * - Concurrent callers share a single network request per key.
 * - Successful results are returned from cache for `ttlMs` milliseconds.
 * - Throttling: if a fresh value exists, no new fetch is made.
 *
 * Keeps chart refresh smooth and reduces Supabase function invocations.
 */

type Entry<T> = { value: T; expiresAt: number };

const FOREX_DATA_TTL_MS = 4_000; // snapshot prices (kept short so live charts tick smoothly)
const FOREX_CHART_TTL_MS = 25_000; // OHLC candles
const COMMODITIES_DATA_TTL_MS = 4_000; // commodities snapshot (short TTL for live momentum)

const dataCache = new Map<string, Entry<any>>();
const chartCache = new Map<string, Entry<any>>();
const commoditiesCache = new Map<string, Entry<any>>();

const dataInflight = new Map<string, Promise<any>>();
const chartInflight = new Map<string, Promise<any>>();
const commoditiesInflight = new Map<string, Promise<any>>();

function getFresh<T>(cache: Map<string, Entry<T>>, key: string): T | null {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  if (hit) cache.delete(key);
  return null;
}

/** Throttled + cached call to `fetch-forex-data` (snapshot of all currencies). */
export async function getForexData(opts?: { force?: boolean }): Promise<any> {
  const key = "all";
  if (!opts?.force) {
    const cached = getFresh(dataCache, key);
    if (cached) return cached;
  }
  const inflight = dataInflight.get(key);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("fetch-forex-data");
      if (error) throw error;
      autoRegisterSymbols(data);
      dataCache.set(key, { value: data, expiresAt: Date.now() + FOREX_DATA_TTL_MS });
      return data;
    } finally {
      dataInflight.delete(key);
    }
  })();
  dataInflight.set(key, p);
  return p;
}

/** Throttled + cached call to `fetch-forex-chart-data` for a single pair/timeframe. */
export async function getForexChartData(
  symbol: string,
  interval: string,
  opts?: { force?: boolean },
): Promise<any> {
  const key = `${symbol.toUpperCase()}|${interval}`;
  if (!opts?.force) {
    const cached = getFresh(chartCache, key);
    if (cached) return cached;
  }
  const inflight = chartInflight.get(key);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("fetch-forex-chart-data", {
        body: { symbol: symbol.toUpperCase(), interval },
      });
      if (error) throw error;
      chartCache.set(key, { value: data, expiresAt: Date.now() + FOREX_CHART_TTL_MS });
      return data;
    } finally {
      chartInflight.delete(key);
    }
  })();
  chartInflight.set(key, p);
  return p;
}

/** Drop-in replacement for `supabase.functions.invoke('fetch-forex-data')`. */
export async function invokeForexData(): Promise<{ data: any; error: any }> {
  try {
    const data = await getForexData();
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/** Drop-in replacement for `supabase.functions.invoke('fetch-forex-chart-data', { body })`. */
export async function invokeForexChartData(
  symbol: string,
  interval: string,
): Promise<{ data: any; error: any }> {
  try {
    const data = await getForexChartData(symbol, interval);
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/** Throttled + cached call to `fetch-commodities-data`. */
export async function getCommoditiesData(opts?: { force?: boolean }): Promise<any> {
  const key = "all";
  if (!opts?.force) {
    const cached = getFresh(commoditiesCache, key);
    if (cached) return cached;
  }
  const inflight = commoditiesInflight.get(key);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("fetch-commodities-data");
      if (error) throw error;
      autoRegisterSymbols(data);
      commoditiesCache.set(key, { value: data, expiresAt: Date.now() + COMMODITIES_DATA_TTL_MS });
      return data;
    } finally {
      commoditiesInflight.delete(key);
    }
  })();
  commoditiesInflight.set(key, p);
  return p;
}

/** Drop-in replacement for `supabase.functions.invoke('fetch-commodities-data')`. */
export async function invokeCommoditiesData(): Promise<{ data: any; error: any }> {
  try {
    const data = await getCommoditiesData();
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/** Manually invalidate caches (e.g. after a Broker action). */
export function invalidateForexCaches() {
  dataCache.clear();
  chartCache.clear();
  commoditiesCache.clear();
}
