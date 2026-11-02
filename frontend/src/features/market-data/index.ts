/** Public API of the market-data feature: the one place pages get company data from. */
export { getCompanyProfile, isValidTicker, searchCompanies, UpstreamError } from "./fmp";
export type { CompanyProfile, CompanySearchResult } from "./types";
