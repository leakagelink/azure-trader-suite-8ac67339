// Centralized contract-size & lot validation per symbol.
// 1 lot = contractSize units of the underlying asset.
//
// Industry standards:
//  - Forex: 1 standard lot = 100,000 base units (min 0.01 = micro lot)
//  - Gold (XAU): 100 oz, Silver (XAG): 5,000 oz
//  - Platinum/Palladium (XPT/XPD): 100 oz
//  - Crude Oil (WTI/BRENT): 1,000 barrels
//  - Natural Gas (NG): 10,000 mmBtu
//  - Copper (HG/XCU): 25,000 lbs
//  - Crypto: 1 unit (BTC, ETH, etc.)

import { isCommoditySymbol, isForexSymbol } from "./marketSymbols";

type SpecEntry = {
  contractSize: number;
  unit: string;
  minLot: number;
  maxLot: number;
  step: number;
};

const FOREX_SPEC: SpecEntry = { contractSize: 100_000, unit: "units", minLot: 0.01, maxLot: 100, step: 0.01 };
const CRYPTO_SPEC: SpecEntry = { contractSize: 1, unit: "unit", minLot: 0.0001, maxLot: 1000, step: 0.0001 };

const COMMODITY_SPECS: Record<string, SpecEntry> = {
  XAU:   { contractSize: 100,    unit: "oz",      minLot: 0.01, maxLot: 100, step: 0.01 },
  XAG:   { contractSize: 5_000,  unit: "oz",      minLot: 0.01, maxLot: 100, step: 0.01 },
  XPT:   { contractSize: 100,    unit: "oz",      minLot: 0.01, maxLot: 100, step: 0.01 },
  XPD:   { contractSize: 100,    unit: "oz",      minLot: 0.01, maxLot: 100, step: 0.01 },
  WTI:   { contractSize: 1_000,  unit: "barrels", minLot: 0.01, maxLot: 100, step: 0.01 },
  BRENT: { contractSize: 1_000,  unit: "barrels", minLot: 0.01, maxLot: 100, step: 0.01 },
  NG:    { contractSize: 10_000, unit: "mmBtu",   minLot: 0.01, maxLot: 100, step: 0.01 },
  HG:    { contractSize: 25_000, unit: "lbs",     minLot: 0.01, maxLot: 100, step: 0.01 },
  XCU:   { contractSize: 25_000, unit: "lbs",     minLot: 0.01, maxLot: 100, step: 0.01 },
};

const baseSym = (symbol: string) => (symbol || "").toUpperCase().split("/")[0];

export function getLotSpec(symbol: string): SpecEntry & { known: boolean } {
  const s = baseSym(symbol);
  if (isForexSymbol(s)) return { ...FOREX_SPEC, known: true };
  if (COMMODITY_SPECS[s]) return { ...COMMODITY_SPECS[s], known: true };
  if (isCommoditySymbol(s)) {
    // Listed as commodity but no explicit spec — treat as unknown
    return { ...CRYPTO_SPEC, known: false };
  }
  // Default: crypto / unknown asset → behave like crypto (1 lot = 1 unit)
  return { ...CRYPTO_SPEC, known: true };
}

export function getContractSize(symbol: string): number {
  return getLotSpec(symbol).contractSize;
}

export function getContractUnit(symbol: string): string {
  return getLotSpec(symbol).unit;
}

export function getLotLabel(symbol: string): string {
  const { contractSize, unit } = getLotSpec(symbol);
  if (contractSize === 1) return `1 lot = 1 ${unit}`;
  return `1 lot = ${contractSize.toLocaleString()} ${unit}`;
}

export type LotValidationResult = { ok: boolean; error?: string };

export function validateLotInput(symbol: string, lotValue: string | number): LotValidationResult {
  const spec = getLotSpec(symbol);
  if (!spec.known) {
    return {
      ok: false,
      error: `Contract size for "${baseSym(symbol)}" is not configured. Please contact support before trading this symbol.`,
    };
  }
  const lots = typeof lotValue === "number" ? lotValue : parseFloat(lotValue);
  if (isNaN(lots) || lots <= 0) {
    return { ok: false, error: "Please enter a valid lot size greater than 0." };
  }
  if (lots < spec.minLot) {
    return { ok: false, error: `Minimum lot size for ${baseSym(symbol)} is ${spec.minLot}.` };
  }
  if (lots > spec.maxLot) {
    return { ok: false, error: `Maximum lot size for ${baseSym(symbol)} is ${spec.maxLot}.` };
  }
  // Step check (avoid float drift)
  const ratio = lots / spec.step;
  if (Math.abs(ratio - Math.round(ratio)) > 1e-6) {
    return { ok: false, error: `Lot size must be in steps of ${spec.step} for ${baseSym(symbol)}.` };
  }
  return { ok: true };
}
