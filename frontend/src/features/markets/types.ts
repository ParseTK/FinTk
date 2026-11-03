import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];

export type MarketOverview = Schemas["MarketOverviewResponse"];
export type MarketRow = Schemas["MarketRowResponse"];
export type MarketFigures = Schemas["MarketFiguresResponse"];
