import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];

export type Seasonality = Schemas["SeasonalityResponse"];
export type SeasonalityYear = Schemas["SeasonalityYear"];
export type SeasonalityMonth = Schemas["SeasonalityMonth"];
