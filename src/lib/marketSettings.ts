import { supabase } from "@/integrations/supabase/client";

export type MarketCategory = "crypto" | "forex" | "commodities";

export interface MarketConfig {
  enabled: boolean;
  hoursEnabled: boolean;
  hoursStart: string; // "HH:MM"
  hoursEnd: string;   // "HH:MM"
}

export interface MarketSettings {
  crypto: MarketConfig;
  forex: MarketConfig;
  commodities: MarketConfig;
}

const defaultConfig: MarketConfig = {
  enabled: true,
  hoursEnabled: false,
  hoursStart: "00:00",
  hoursEnd: "23:59",
};

export const defaultMarketSettings: MarketSettings = {
  crypto: { ...defaultConfig },
  forex: { ...defaultConfig },
  commodities: { ...defaultConfig },
};

const MARKET_KEYS = [
  "crypto_enabled", "crypto_hours_enabled", "crypto_hours_start", "crypto_hours_end",
  "forex_enabled", "forex_hours_enabled", "forex_hours_start", "forex_hours_end",
  "commodities_enabled", "commodities_hours_enabled", "commodities_hours_start", "commodities_hours_end",
];

export async function fetchMarketSettings(): Promise<MarketSettings> {
  const { data } = await supabase
    .from("payment_settings")
    .select("setting_key, setting_value")
    .in("setting_key", MARKET_KEYS);

  const map = new Map<string, string>();
  (data || []).forEach((r: any) => map.set(r.setting_key, r.setting_value));

  const buildConfig = (prefix: MarketCategory): MarketConfig => ({
    enabled: (map.get(`${prefix}_enabled`) ?? "true") !== "false",
    hoursEnabled: (map.get(`${prefix}_hours_enabled`) ?? "false") === "true",
    hoursStart: map.get(`${prefix}_hours_start`) || "00:00",
    hoursEnd: map.get(`${prefix}_hours_end`) || "23:59",
  });

  return {
    crypto: buildConfig("crypto"),
    forex: buildConfig("forex"),
    commodities: buildConfig("commodities"),
  };
}

/** Returns true if market is currently tradable (toggle on AND within hours window if enforced) */
export function isMarketOpen(cfg: MarketConfig, now: Date = new Date()): boolean {
  if (!cfg.enabled) return false;
  if (!cfg.hoursEnabled) return true;
  const toMins = (hm: string) => {
    const [h, m] = hm.split(":").map((x) => parseInt(x, 10) || 0);
    return h * 60 + m;
  };
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = toMins(cfg.hoursStart);
  const end = toMins(cfg.hoursEnd);
  if (start <= end) return cur >= start && cur <= end;
  // Window crosses midnight (e.g. 22:00 - 04:00)
  return cur >= start || cur <= end;
}

export type MarketStatus = {
  open: boolean;
  reason: "disabled" | "out_of_hours" | "open";
  /** ms until the market opens next (null when already open or fully disabled) */
  opensInMs: number | null;
  /** ms until the market closes (null when closed or 24/7) */
  closesInMs: number | null;
};

/** Rich status object for UI banners & countdowns. */
export function getMarketStatus(cfg: MarketConfig, now: Date = new Date()): MarketStatus {
  if (!cfg.enabled) {
    return { open: false, reason: "disabled", opensInMs: null, closesInMs: null };
  }
  if (!cfg.hoursEnabled) {
    return { open: true, reason: "open", opensInMs: null, closesInMs: null };
  }
  const toMins = (hm: string) => {
    const [h, m] = hm.split(":").map((x) => parseInt(x, 10) || 0);
    return h * 60 + m;
  };
  const startMins = toMins(cfg.hoursStart);
  const endMins = toMins(cfg.hoursEnd);
  const open = isMarketOpen(cfg, now);

  const buildToday = (mins: number) => {
    const d = new Date(now);
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    return d;
  };

  if (open) {
    let close = buildToday(endMins);
    if (close.getTime() <= now.getTime()) close = new Date(close.getTime() + 24 * 3600 * 1000);
    return { open: true, reason: "open", opensInMs: null, closesInMs: close.getTime() - now.getTime() };
  }

  let openAt = buildToday(startMins);
  if (openAt.getTime() <= now.getTime()) openAt = new Date(openAt.getTime() + 24 * 3600 * 1000);
  return {
    open: false,
    reason: "out_of_hours",
    opensInMs: openAt.getTime() - now.getTime(),
    closesInMs: null,
  };
}

/** Format a duration in ms as "2h 35m" / "45m" / "30s". */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

