// Single source of truth for every tradable symbol's contract specs.
// Add a new symbol here and lot size / margin math auto-flows everywhere.
//
// asset_class  → defaults if a symbol-specific entry is missing:
//   forex       → 100,000 units, 0.01 step, 0.01–100 lots
//   metals      → 100 oz, 0.01 step, 0.01–100 lots
//   energy      → 1,000 barrels, 0.01 step, 0.01–100 lots
//   gas         → 10,000 mmBtu, 0.01 step, 0.01–100 lots
//   industrial  → 25,000 lbs, 0.01 step, 0.01–100 lots
//   crypto      → 1 unit, 0.0001 step, 0.0001–1000 lots
//
// To override a default for one symbol, list it explicitly below.

export type AssetClass = 'forex' | 'metals' | 'energy' | 'gas' | 'industrial' | 'crypto';

export type SymbolSpec = {
  symbol: string;          // e.g. "XAU", "EUR", "BTC"
  assetClass: AssetClass;
  contractSize: number;    // units per 1 lot
  unit: string;            // 'units' | 'oz' | 'barrels' | 'mmBtu' | 'lbs' | base symbol
  minLot: number;
  maxLot: number;
  step: number;
};

const CLASS_DEFAULTS: Record<AssetClass, Omit<SymbolSpec, 'symbol'>> = {
  forex:      { assetClass: 'forex',      contractSize: 100_000, unit: 'units',   minLot: 0.01,   maxLot: 100,  step: 0.01 },
  metals:     { assetClass: 'metals',     contractSize: 100,     unit: 'oz',      minLot: 0.01,   maxLot: 100,  step: 0.01 },
  energy:     { assetClass: 'energy',     contractSize: 1_000,   unit: 'barrels', minLot: 0.01,   maxLot: 100,  step: 0.01 },
  gas:        { assetClass: 'gas',        contractSize: 10_000,  unit: 'mmBtu',   minLot: 0.01,   maxLot: 100,  step: 0.01 },
  industrial: { assetClass: 'industrial', contractSize: 25_000,  unit: 'lbs',     minLot: 0.01,   maxLot: 100,  step: 0.01 },
  crypto:     { assetClass: 'crypto',     contractSize: 1,       unit: 'unit',    minLot: 0.0001, maxLot: 1000, step: 0.0001 },
};

// Explicit symbol entries — only override when different from class defaults
// (Silver has 5,000 oz contracts, etc.)
const SYMBOL_REGISTRY: SymbolSpec[] = [
  // Forex (any other 3-letter currency falls through to forex defaults)
  ...['EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'INR', 'CNY', 'SGD', 'HKD', 'ZAR', 'MXN', 'TRY']
    .map<SymbolSpec>((s) => ({ symbol: s, ...CLASS_DEFAULTS.forex })),

  // Metals
  { symbol: 'XAU', ...CLASS_DEFAULTS.metals },                                  // Gold 100 oz
  { symbol: 'XAG', ...CLASS_DEFAULTS.metals, contractSize: 5_000 },             // Silver 5000 oz
  { symbol: 'XPT', ...CLASS_DEFAULTS.metals },                                  // Platinum 100 oz
  { symbol: 'XPD', ...CLASS_DEFAULTS.metals },                                  // Palladium 100 oz

  // Energy
  { symbol: 'WTI',   ...CLASS_DEFAULTS.energy },
  { symbol: 'BRENT', ...CLASS_DEFAULTS.energy },

  // Gas
  { symbol: 'NG', ...CLASS_DEFAULTS.gas },

  // Industrial metals
  { symbol: 'HG',  ...CLASS_DEFAULTS.industrial },
  { symbol: 'XCU', ...CLASS_DEFAULTS.industrial },
];

const REGISTRY_MAP = new Map<string, SymbolSpec>(
  SYMBOL_REGISTRY.map((entry) => [entry.symbol.toUpperCase(), entry]),
);

// Optional runtime overrides loaded from API/DB (e.g. broker-managed table)
const RUNTIME_OVERRIDES = new Map<string, SymbolSpec>();

/** Register/override a symbol spec at runtime (called after API fetch). */
export function registerSymbolSpec(spec: SymbolSpec) {
  RUNTIME_OVERRIDES.set(spec.symbol.toUpperCase(), spec);
}

/** Bulk register from API response array. */
export function registerSymbolSpecs(specs: SymbolSpec[]) {
  for (const s of specs) registerSymbolSpec(s);
}

const FOREX_BASES = new Set(['EUR','GBP','JPY','AUD','CAD','CHF','NZD','INR','CNY','SGD','HKD','ZAR','MXN','TRY','USD']);
const COMMODITY_PREFIX_TO_CLASS: Array<[RegExp, AssetClass]> = [
  [/^XA[UGPD]$/, 'metals'],     // XAU/XAG/XAP/XAD style
  [/^XPT$|^XPD$/, 'metals'],
  [/^X[CN]U$|^HG$/, 'industrial'],
  [/^WTI$|^BRENT$|^OIL/, 'energy'],
  [/^NG$|^GAS/, 'gas'],
];

function inferSpec(symbol: string): SymbolSpec {
  const s = symbol.toUpperCase();
  // Forex pair (e.g. "EUR/USD" or just "EUR")
  const base = s.split('/')[0];
  if (FOREX_BASES.has(base) && base !== 'USD') {
    return { symbol: base, ...CLASS_DEFAULTS.forex };
  }
  for (const [re, cls] of COMMODITY_PREFIX_TO_CLASS) {
    if (re.test(base)) return { symbol: base, ...CLASS_DEFAULTS[cls] };
  }
  // Default: treat as crypto (1 lot = 1 unit)
  return { symbol: base, ...CLASS_DEFAULTS.crypto };
}

/** Always returns a usable spec. `inferred=true` when not explicitly registered. */
export function resolveSymbolSpec(symbol: string): SymbolSpec & { inferred: boolean } {
  const key = (symbol || '').toUpperCase().split('/')[0];
  const override = RUNTIME_OVERRIDES.get(key);
  if (override) return { ...override, inferred: false };
  const explicit = REGISTRY_MAP.get(key);
  if (explicit) return { ...explicit, inferred: false };
  return { ...inferSpec(key), inferred: true };
}
