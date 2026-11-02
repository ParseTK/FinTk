import type { components } from "./schema";

type Schemas = components["schemas"];

export type CompanySummary = Schemas["CompanySummary"];
export type CompanyProfile = Schemas["CompanyProfileResponse"];
export type Filing = Schemas["FilingResponse"];
export type MetricSeries = Schemas["MetricSeriesResponse"];
export type Financials = Schemas["FinancialsResponse"];
