import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];

export type Holding = Schemas["HoldingResponse"];
export type Lot = Schemas["LotResponse"];
export type Portfolio = Schemas["PortfolioResponse"];
