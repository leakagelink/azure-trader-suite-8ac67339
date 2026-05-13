// Lot validation & helpers — delegates to symbolRegistry for specs.
// All contract sizes flow from src/lib/symbolRegistry.ts (single source of truth).

import { resolveSymbolSpec, type SymbolSpec } from "./symbolRegistry";

export type LotSpec = SymbolSpec & { known: boolean };

export function getLotSpec(symbol: string): LotSpec {
  const s = resolveSymbolSpec(symbol);
  // `known` stays true when we have an explicit registry entry; inferred ones
  // are also usable but flagged so the UI can warn.
  return { ...s, known: !s.inferred };
}

export function getContractSize(symbol: string): number {
  return resolveSymbolSpec(symbol).contractSize;
}

export function getContractUnit(symbol: string): string {
  return resolveSymbolSpec(symbol).unit;
}

export function getLotLabel(symbol: string): string {
  const { contractSize, unit } = resolveSymbolSpec(symbol);
  if (contractSize === 1) return `1 lot = 1 ${unit}`;
  return `1 lot = ${contractSize.toLocaleString()} ${unit}`;
}

export type LotValidationResult = { ok: boolean; error?: string };

export function validateLotInput(symbol: string, lotValue: string | number): LotValidationResult {
  const spec = resolveSymbolSpec(symbol);
  if (spec.inferred) {
    return {
      ok: false,
      error: `Contract size for "${spec.symbol}" is not configured in the symbol registry. Trading is blocked to prevent incorrect lot sizing — please contact support to add this symbol.`,
    };
  }
  const lots = typeof lotValue === "number" ? lotValue : parseFloat(lotValue);
  if (isNaN(lots) || lots <= 0) {
    return { ok: false, error: "Please enter a valid lot size greater than 0." };
  }
  if (lots < spec.minLot) {
    return { ok: false, error: `Minimum lot size for ${spec.symbol} is ${spec.minLot}.` };
  }
  if (lots > spec.maxLot) {
    return { ok: false, error: `Maximum lot size for ${spec.symbol} is ${spec.maxLot}.` };
  }
  const ratio = lots / spec.step;
  if (Math.abs(ratio - Math.round(ratio)) > 1e-6) {
    return { ok: false, error: `Lot size must be in steps of ${spec.step} for ${spec.symbol}.` };
  }
  return { ok: true };
}
