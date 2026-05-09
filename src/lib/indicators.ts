import type { Candle } from "@/components/charts/TradingChart";

export type IndicatorKind = "sma" | "ema" | "bb" | "rsi" | "macd" | "vwap" | "stoch" | "atr";

export interface IndicatorConfig {
  id: string;
  kind: IndicatorKind;
  period?: number;
  stdDev?: number;
  fast?: number;
  slow?: number;
  signal?: number;
  smoothK?: number;
  smoothD?: number;
  color?: string;
}

export const DEFAULTS: Record<IndicatorKind, Partial<IndicatorConfig>> = {
  sma: { period: 20, color: "#f59e0b" },
  ema: { period: 21, color: "#3b82f6" },
  bb: { period: 20, stdDev: 2, color: "#a855f7" },
  rsi: { period: 14, color: "#06b6d4" },
  macd: { fast: 12, slow: 26, signal: 9, color: "#10b981" },
  vwap: { color: "#facc15" },
  stoch: { period: 14, smoothK: 3, smoothD: 3, color: "#06b6d4" },
  atr: { period: 14, color: "#f97316" },
};

export const LABEL: Record<IndicatorKind, string> = {
  sma: "SMA",
  ema: "EMA",
  bb: "Bollinger Bands",
  rsi: "RSI",
  macd: "MACD",
  vwap: "VWAP",
  stoch: "Stochastic",
  atr: "ATR",
};

export type SeriesPoint = { time: number; value: number };

export function sma(candles: Candle[], period: number): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out.push({ time: candles[i].time, value: sum / period });
  }
  return out;
}

export function ema(candles: Candle[], period: number): SeriesPoint[] {
  if (!candles.length) return [];
  const k = 2 / (period + 1);
  const out: SeriesPoint[] = [];
  let prev = candles[0].close;
  for (let i = 0; i < candles.length; i++) {
    const v = i === 0 ? candles[0].close : candles[i].close * k + prev * (1 - k);
    prev = v;
    if (i >= period - 1) out.push({ time: candles[i].time, value: v });
  }
  return out;
}

export function bb(candles: Candle[], period: number, mult: number) {
  const mid: SeriesPoint[] = [];
  const upper: SeriesPoint[] = [];
  const lower: SeriesPoint[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
    const m = sum / period;
    let v = 0;
    for (let j = i - period + 1; j <= i; j++) v += (candles[j].close - m) ** 2;
    const sd = Math.sqrt(v / period);
    const t = candles[i].time;
    mid.push({ time: t, value: m });
    upper.push({ time: t, value: m + mult * sd });
    lower.push({ time: t, value: m - mult * sd });
  }
  return { mid, upper, lower };
}

export function rsi(candles: Candle[], period: number): SeriesPoint[] {
  if (candles.length < period + 1) return [];
  const out: SeriesPoint[] = [];
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = candles[i].close - candles[i - 1].close;
    if (d > 0) gain += d; else loss -= d;
  }
  gain /= period; loss /= period;
  out.push({ time: candles[period].time, value: 100 - 100 / (1 + (loss === 0 ? 100 : gain / loss)) });
  for (let i = period + 1; i < candles.length; i++) {
    const d = candles[i].close - candles[i - 1].close;
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    const rs = loss === 0 ? 100 : gain / loss;
    out.push({ time: candles[i].time, value: 100 - 100 / (1 + rs) });
  }
  return out;
}

function emaArr(values: number[], period: number): number[] {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    const v = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    prev = v;
    out.push(v);
  }
  return out;
}

export function macd(candles: Candle[], fast: number, slow: number, signalP: number) {
  const closes = candles.map((c) => c.close);
  const eFast = emaArr(closes, fast);
  const eSlow = emaArr(closes, slow);
  const macdLine: SeriesPoint[] = [];
  const macdVals: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const v = eFast[i] - eSlow[i];
    macdVals.push(v);
    if (i >= slow - 1) macdLine.push({ time: candles[i].time, value: v });
  }
  const sig = emaArr(macdVals, signalP);
  const signal: SeriesPoint[] = [];
  const hist: { time: number; value: number; color: string }[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i >= slow - 1) {
      signal.push({ time: candles[i].time, value: sig[i] });
      const h = macdVals[i] - sig[i];
      hist.push({
        time: candles[i].time,
        value: h,
        color: h >= 0 ? "rgba(16,185,129,0.6)" : "rgba(239,68,68,0.6)",
      });
    }
  }
  return { macdLine, signal, hist };
}

export function vwap(candles: Candle[]): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  let cumPV = 0, cumV = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    const v = c.volume ?? 0;
    cumPV += tp * v;
    cumV += v;
    out.push({ time: c.time, value: cumV ? cumPV / cumV : tp });
  }
  return out;
}

export function stochastic(candles: Candle[], period: number, smoothK: number, smoothD: number) {
  const raw: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) { raw.push(NaN); continue; }
    let hh = -Infinity, ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hh = Math.max(hh, candles[j].high);
      ll = Math.min(ll, candles[j].low);
    }
    const c = candles[i].close;
    raw.push(hh === ll ? 50 : ((c - ll) / (hh - ll)) * 100);
  }
  const smooth = (arr: number[], p: number) => {
    const o: number[] = [];
    for (let i = 0; i < arr.length; i++) {
      if (i < p - 1) { o.push(NaN); continue; }
      let s = 0, n = 0;
      for (let j = i - p + 1; j <= i; j++) {
        if (!isNaN(arr[j])) { s += arr[j]; n++; }
      }
      o.push(n ? s / n : NaN);
    }
    return o;
  };
  const k = smooth(raw, smoothK);
  const d = smooth(k, smoothD);
  const kPts: SeriesPoint[] = [], dPts: SeriesPoint[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (!isNaN(k[i])) kPts.push({ time: candles[i].time, value: k[i] });
    if (!isNaN(d[i])) dPts.push({ time: candles[i].time, value: d[i] });
  }
  return { k: kPts, d: dPts };
}

export function atr(candles: Candle[], period: number): SeriesPoint[] {
  if (candles.length < 2) return [];
  const tr: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
  }
  const out: SeriesPoint[] = [];
  let prev = 0;
  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      if (i === period - 1) {
        let s = 0;
        for (let j = 0; j < period; j++) s += tr[j];
        prev = s / period;
        out.push({ time: candles[i].time, value: prev });
      }
      continue;
    }
    prev = (prev * (period - 1) + tr[i]) / period;
    out.push({ time: candles[i].time, value: prev });
  }
  return out;
}

export function heikinAshi(candles: Candle[]): Candle[] {
  if (!candles.length) return [];
  const out: Candle[] = [];
  let prevOpen = candles[0].open;
  let prevClose = candles[0].close;
  for (const c of candles) {
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = out.length === 0 ? (c.open + c.close) / 2 : (prevOpen + prevClose) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    out.push({ time: c.time, open: haOpen, high: haHigh, low: haLow, close: haClose, volume: c.volume });
    prevOpen = haOpen;
    prevClose = haClose;
  }
  return out;
}
