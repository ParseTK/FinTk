import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];

export type CryptoOverview = Schemas["CryptoOverviewResponse"];
export type CryptoAsset = Schemas["CryptoAssetResponse"];
export type MarketTotals = Schemas["MarketTotalsResponse"];
export type FearGreed = Schemas["FearGreedResponse"];
