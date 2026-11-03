import "server-only";
import { authHeaders } from "@/lib/api/authHeaders";
import { privateApi } from "@/lib/api/client";
import type { Lot, Portfolio } from "./types";

/** The visitor's holdings, or null if they could not be read (so the page can say so). */
export async function getPortfolio(): Promise<Portfolio | null> {
  try {
    const { data } = await privateApi.GET("/api/v1/portfolio", { headers: await authHeaders() });
    return data ?? null;
  } catch {
    return null;
  }
}

/** Every purchase the visitor has recorded (the API caps this at a few hundred). */
export async function getLots(): Promise<Lot[] | null> {
  try {
    const { data } = await privateApi.GET("/api/v1/portfolio/lots", {
      headers: await authHeaders(),
    });
    return data?.lots ?? null;
  } catch {
    return null;
  }
}
