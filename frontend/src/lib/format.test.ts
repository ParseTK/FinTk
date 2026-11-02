import { describe, expect, it } from "vitest";
import {
  formatCompact,
  formatDate,
  formatFiscalYearEnd,
  formatMoney,
  formatNumber,
  formatPercent,
  isNegative,
  isPositive,
  PLACEHOLDER,
} from "./format";

describe("formatMoney", () => {
  it("formats strings and numbers as currency", () => {
    expect(formatMoney("1234.5")).toBe("$1,234.50");
    expect(formatMoney(1234.5)).toBe("$1,234.50");
    expect(formatMoney("0")).toBe("$0.00");
  });

  it("does not lose precision on long decimal strings", () => {
    expect(formatMoney("12345678901234567.89")).toBe("$12,345,678,901,234,567.89");
  });

  it("supports other currencies", () => {
    expect(formatMoney("10", { currency: "EUR" })).toBe("€10.00");
  });

  it("shows an explicit sign only when asked", () => {
    expect(formatMoney("5", { signed: true })).toBe("+$5.00");
    expect(formatMoney("-5", { signed: true })).toBe("-$5.00");
    expect(formatMoney("0", { signed: true })).toBe("$0.00");
    expect(formatMoney("5")).toBe("$5.00");
  });

  it.each([null, undefined, "", "  ", "abc", "NaN", Infinity])("renders %j as a dash", (value) => {
    expect(formatMoney(value as string)).toBe(PLACEHOLDER);
  });
});

describe("formatPercent", () => {
  it("treats the value as percent points", () => {
    expect(formatPercent(5.76)).toBe("5.76%");
    expect(formatPercent("-3.84")).toBe("-3.84%");
  });

  it("supports signs and digits", () => {
    expect(formatPercent(5.76, { signed: true })).toBe("+5.76%");
    expect(formatPercent(-3.84, { signed: true })).toBe("-3.84%");
    expect(formatPercent(0, { signed: true })).toBe("0.00%");
    expect(formatPercent(12.3456, { digits: 1 })).toBe("12.3%");
    expect(formatPercent(7, { digits: 0 })).toBe("7%");
  });

  it("renders missing values as a dash", () => {
    expect(formatPercent(null)).toBe(PLACEHOLDER);
    expect(formatPercent("x")).toBe(PLACEHOLDER);
  });
});

describe("formatCompact and formatNumber", () => {
  it("abbreviates large numbers", () => {
    expect(formatCompact(1_234_567)).toBe("1.2M");
    expect(formatCompact("2500000000000")).toBe("2.5T");
    expect(formatCompact(950)).toBe("950");
    expect(formatCompact(undefined)).toBe(PLACEHOLDER);
  });

  it("formats plain numbers with fixed digits", () => {
    expect(formatNumber(1234.5)).toBe("1,234.50");
    expect(formatNumber("3.14159", 3)).toBe("3.142");
    expect(formatNumber("abc")).toBe(PLACEHOLDER);
  });
});

describe("formatDate", () => {
  it("formats date-only strings without shifting the day", () => {
    expect(formatDate("2024-08-01")).toBe("Aug 1, 2024");
    expect(formatDate("2024-08-01", "long")).toBe("August 1, 2024");
    expect(formatDate("2024-08-01", "month-year")).toBe("Aug 2024");
    expect(formatDate("2024-08-01", "short")).toBe("8/1/24");
  });

  it("accepts Date objects and ISO date-times", () => {
    expect(formatDate(new Date("2024-12-31T23:59:59Z"))).toBe("Dec 31, 2024");
    expect(formatDate("2024-12-31T23:59:59Z")).toBe("Dec 31, 2024");
  });

  it("renders missing or invalid dates as a dash", () => {
    expect(formatDate(null)).toBe(PLACEHOLDER);
    expect(formatDate("not a date")).toBe(PLACEHOLDER);
  });
});

describe("sign helpers", () => {
  it("classify values", () => {
    expect(isPositive("1.5")).toBe(true);
    expect(isPositive(0)).toBe(false);
    expect(isNegative("-0.01")).toBe(true);
    expect(isNegative("abc")).toBe(false);
    expect(isPositive(null)).toBe(false);
  });
});

describe("formatFiscalYearEnd", () => {
  it("turns MMDD into a month and day", () => {
    expect(formatFiscalYearEnd("0926")).toBe("September 26");
    expect(formatFiscalYearEnd("1231")).toBe("December 31");
  });

  it.each([null, undefined, "", "926", "1326", "0132x", "0000"])("returns null for %j", (value) => {
    expect(formatFiscalYearEnd(value)).toBeNull();
  });
});
