import { describe, expect, it } from "vitest";
import { MAX_COMPARED, parseCompare } from "./compare";

describe("parseCompare", () => {
  it("reads a list of coin addresses", () => {
    expect(parseCompare("bitcoin,ethereum")).toEqual(["bitcoin", "ethereum"]);
    expect(parseCompare(" Bitcoin , ETHEREUM ")).toEqual(["bitcoin", "ethereum"]);
  });

  it("returns nothing for a missing value", () => {
    expect(parseCompare(undefined)).toEqual([]);
    expect(parseCompare("")).toEqual([]);
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseCompare(["bitcoin", "ethereum"])).toEqual(["bitcoin"]);
  });

  it("drops duplicates and anything that is not a plain coin address", () => {
    expect(parseCompare("bitcoin,bitcoin,../etc,<script>,a b,ethereum,-bad")).toEqual([
      "bitcoin",
      "ethereum",
    ]);
  });

  it("keeps at most four", () => {
    expect(MAX_COMPARED).toBe(4);
    expect(parseCompare("a1,b2,c3,d4,e5,f6")).toEqual(["a1", "b2", "c3", "d4"]);
  });

  it("rejects an over-long address", () => {
    expect(parseCompare("a".repeat(61))).toEqual([]);
    expect(parseCompare("a".repeat(60))).toHaveLength(1);
  });
});
