import { describe, it, expect } from "vitest";
import { getContractSize, getLotLabel, getContractUnit, getLotSpec, validateLotInput } from "@/lib/contractSize";

describe("getContractSize — commodities", () => {
  it.each([
    ["XAU", 100],
    ["XAG", 5_000],
    ["XPT", 100],
    ["XPD", 100],
    ["WTI", 1_000],
    ["BRENT", 1_000],
    ["NG", 10_000],
    ["HG", 25_000],
    ["XCU", 25_000],
  ])("%s → %d", (symbol, expected) => {
    expect(getContractSize(symbol)).toBe(expected);
    expect(getLotSpec(symbol).known).toBe(true);
  });
});

describe("getContractSize — forex pairs", () => {
  const FOREX = ["EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "INR", "CNY", "SGD", "HKD", "ZAR", "MXN", "TRY"];
  it.each(FOREX)("%s → 100,000", (sym) => {
    expect(getContractSize(sym)).toBe(100_000);
    expect(getLotSpec(sym).known).toBe(true);
  });

  it("handles 'EUR/USD' style by stripping quote", () => {
    expect(getContractSize("EUR/USD")).toBe(100_000);
  });
});

describe("getLotLabel", () => {
  it.each([
    ["XAU", "1 lot = 100 oz"],
    ["XAG", "1 lot = 5,000 oz"],
    ["WTI", "1 lot = 1,000 barrels"],
    ["NG", "1 lot = 10,000 mmBtu"],
    ["HG", "1 lot = 25,000 lbs"],
    ["EUR", "1 lot = 100,000 units"],
    ["GBP", "1 lot = 100,000 units"],
  ])("%s → %s", (symbol, expected) => {
    expect(getLotLabel(symbol)).toBe(expected);
  });

  it("crypto returns '1 lot = 1 unit'", () => {
    expect(getLotLabel("BTC")).toBe("1 lot = 1 unit");
  });
});

describe("getContractUnit", () => {
  it.each([
    ["XAU", "oz"],
    ["WTI", "barrels"],
    ["NG", "mmBtu"],
    ["HG", "lbs"],
    ["EUR", "units"],
  ])("%s → %s", (sym, unit) => {
    expect(getContractUnit(sym)).toBe(unit);
  });
});

describe("validateLotInput", () => {
  it("rejects unknown / inferred symbol", () => {
    const r = validateLotInput("ZZZ_NOT_REAL", 1);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not configured/i);
  });

  it("accepts valid lot for XAU", () => {
    expect(validateLotInput("XAU", 0.1).ok).toBe(true);
  });

  it("rejects below minimum", () => {
    const r = validateLotInput("XAU", 0.001);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Minimum/);
  });

  it("rejects above maximum", () => {
    const r = validateLotInput("EUR", 500);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Maximum/);
  });

  it("rejects bad step", () => {
    const r = validateLotInput("EUR", 0.013);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/steps/);
  });
});
