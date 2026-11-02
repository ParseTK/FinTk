/** Shapes of the FMP `/stable` responses we consume. Replaced by generated types once FastAPI owns this. */
export interface CompanySearchResult {
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
  exchangeFullName: string;
}

export interface CompanyProfile {
  symbol: string;
  companyName: string;
  price: number;
  marketCap: number;
  beta: number;
  lastDividend: number;
  range: string;
  change: number;
  changePercentage: number;
  volume: number;
  averageVolume: number;
  currency: string;
  exchangeFullName: string;
  exchange: string;
  industry: string;
  sector: string;
  website: string;
  description: string;
  ceo: string;
  country: string;
  fullTimeEmployees: string;
  image: string;
  ipoDate: string;
  isEtf: boolean;
  isActivelyTrading: boolean;
}
