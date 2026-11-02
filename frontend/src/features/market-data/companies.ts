import "server-only";
import { api } from "./api/client";
import type { CompanyProfile, CompanySummary, Filing, Financials } from "./api/types";

const TICKER_PATTERN = /^[A-Za-z]{1,6}([.-][A-Za-z]{1,2})?$/;

/** The API could not be reached or answered with an error. Pages show their error screen. */
export class UpstreamError extends Error {}

export const isValidTicker = (value: string) => TICKER_PATTERN.test(value);

/** Unwraps an openapi-fetch result: data, null for a 404, otherwise an UpstreamError. */
async function unwrap<T>(
  call: Promise<{ data?: T; response: Response }>,
  { missingIsNull }: { missingIsNull: boolean },
): Promise<T | null> {
  let result;
  try {
    result = await call;
  } catch {
    throw new UpstreamError("Market data service is unreachable");
  }
  if (result.response.status === 404 && missingIsNull) return null;
  if (result.data === undefined)
    throw new UpstreamError(`Market data request failed (${result.response.status})`);
  return result.data;
}

export async function searchCompanies(query: string): Promise<CompanySummary[]> {
  const trimmed = query.trim().slice(0, 60);
  if (!trimmed) return [];
  const data = await unwrap(
    api.GET("/api/v1/companies/search", { params: { query: { q: trimmed, limit: 20 } } }),
    {
      missingIsNull: false,
    },
  );
  return data?.results ?? [];
}

export async function getCompanyProfile(ticker: string): Promise<CompanyProfile | null> {
  if (!isValidTicker(ticker)) return null;
  return unwrap(api.GET("/api/v1/companies/{ticker}", { params: { path: { ticker } } }), {
    missingIsNull: true,
  });
}

export async function getFinancials(ticker: string, years = 5): Promise<Financials | null> {
  if (!isValidTicker(ticker)) return null;
  return unwrap(
    api.GET("/api/v1/companies/{ticker}/financials", {
      params: { path: { ticker }, query: { years } },
    }),
    { missingIsNull: true },
  );
}

export async function getFilings(ticker: string, form?: string, limit = 8): Promise<Filing[]> {
  if (!isValidTicker(ticker)) return [];
  const data = await unwrap(
    api.GET("/api/v1/companies/{ticker}/filings", {
      params: { path: { ticker }, query: { form, limit } },
    }),
    { missingIsNull: true },
  );
  return data?.filings ?? [];
}

/** The filings people read: annual and quarterly reports and current reports, newest first. */
const KEY_FORMS = ["10-K", "10-Q", "8-K"];

export async function getKeyFilings(ticker: string, limit = 8): Promise<Filing[]> {
  const perForm = await Promise.all(KEY_FORMS.map((form) => getFilings(ticker, form, limit)));
  return perForm
    .flat()
    .sort((a, b) => b.filed.localeCompare(a.filed))
    .slice(0, limit);
}
