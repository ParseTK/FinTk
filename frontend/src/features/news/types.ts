import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];

export type MarketNews = Schemas["MarketNewsResponse"];
export type CompanyNews = Schemas["CompanyNewsResponse"];
export type NewsItem = Schemas["NewsItemResponse"];
