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
