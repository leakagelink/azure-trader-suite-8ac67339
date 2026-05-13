// Centralized contract-size mapping per symbol.
// 1 lot = contractSize units of the underlying asset.
//
// Sources / industry standards:
//  - Forex: 1 standard lot = 100,000 base currency units
//  - Gold (XAU): 100 oz, Silver (XAG): 5,000 oz
//  - Platinum/Palladium (XPT/XPD): 100 oz
//  - Crude Oil (WTI/BRENT): 1,000 barrels
//  - Natural Gas (NG): 10,000 mmBtu
//  - Copper (HG/XCU): 25,000 lbs
//  - Crypto: 1 unit (BTC, ETH, etc.)

import { isCommoditySymbol, isForexSymbol } from "./marketSymbols";

const COMMODITY_CONTRACTS: Record<string, number> = {
  XAU: 100,
  XAG: 5_000,
  XPT: 100,
  XPD: 100,
  WTI: 1_000,
  BRENT: 1_000,
  NG: 10_000,
  HG: 25_000,
  XCU: 25_000,
};

const COMMODITY_UNITS: Record<string, string> = {
  XAU: "oz",
  XAG: "oz",
  XPT: "oz",
  XPD: "oz",
  WTI: "barrels",
  BRENT: "barrels",
  NG: "mmBtu",
  HG: "lbs",
  XCU: "lbs",
};

const FOREX_LOT = 100_000;

export function getContractSize(symbol: string): number {
  const s = (symbol || "").toUpperCase().split("/")[0];
  if (isForexSymbol(s)) return FOREX_LOT;
  if (COMMODITY_CONTRACTS[s] !== undefined) return COMMODITY_CONTRACTS[s];
  if (isCommoditySymbol(s)) return 100;
  return 1; // Crypto / default
}

export function getContractUnit(symbol: string): string {
  const s = (symbol || "").toUpperCase().split("/")[0];
  if (isForexSymbol(s)) return "units";
  if (COMMODITY_UNITS[s]) return COMMODITY_UNITS[s];
  return s || "unit";
}

export function getLotLabel(symbol: string): string {
  const s = (symbol || "").toUpperCase().split("/")[0];
  const cs = getContractSize(s);
  const unit = getContractUnit(s);
  if (cs === 1) return `1 lot = 1 ${unit}`;
  return `1 lot = ${cs.toLocaleString()} ${unit}`;
}
