import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];

export type CompanySummary = Schemas["CompanySummary"];
export type CompanyProfile = Schemas["CompanyProfileResponse"];
export type Filing = Schemas["FilingResponse"];
export type MetricSeries = Schemas["MetricSeriesResponse"];
export type Financials = Schemas["FinancialsResponse"];
export type RatioSeries = Schemas["RatioSeriesResponse"];
