import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];

export type CryptoOverview = Schemas["CryptoOverviewResponse"];
export type CryptoAsset = Schemas["CryptoAssetResponse"];
export type MarketTotals = Schemas["MarketTotalsResponse"];
export type FearGreed = Schemas["FearGreedResponse"];

export type CryptoMarkets = Schemas["CryptoMarketsResponse"];
export type MajorCoin = Schemas["MajorCoinResponse"];
export type Composition = Schemas["CompositionResponse"];
export type CompositionRow = Schemas["CompositionRowResponse"];

export type CryptoNews = Schemas["CryptoNewsResponse"];

export type NewsItem = Schemas["NewsItemResponse"];

export type CoinDetail = Schemas["CoinDetailResponse"];
export type CoinHit = Schemas["CoinHitResponse"];
export type CoinSearch = Schemas["CoinSearchResponse"];
