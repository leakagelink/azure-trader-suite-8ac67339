const COMMODITY_SYMBOLS = new Set(["XAU", "XAG", "WTI", "BRENT", "NG", "XCU", "XPT", "XPD"]);
const FOREX_BASE_SYMBOLS = new Set(["EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "INR", "CNY", "SGD"]);

export const isCommoditySymbol = (symbol: string) =>
  COMMODITY_SYMBOLS.has(symbol.toUpperCase());

export const isForexSymbol = (symbol: string) => {
  const normalizedSymbol = symbol.toUpperCase();
  return normalizedSymbol.includes("/") || FOREX_BASE_SYMBOLS.has(normalizedSymbol);
};