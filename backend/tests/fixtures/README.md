# SEC fixtures

Real responses from SEC EDGAR (public data), trimmed to keep the repository small. They let the tests
run the real parsing code against genuine data instead of invented JSON.

| File | Source endpoint | Trimmed to |
|---|---|---|
| `company_tickers_exchange.json` | `www.sec.gov/files/company_tickers_exchange.json` | a dozen well-known companies plus a few "Apple" names |
| `submissions_aapl.json` | `data.sec.gov/submissions/CIK0000320193.json` | the profile and a mix of recent filing forms |
| `companyfacts_aapl.json` | `data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json` | the concepts the API reads; 10-K, 10-K/A and 10-Q rows from 2018 on |

Captured 2026-11-02. Apple's published results are the check: FY2024 revenue is 391,035 million USD.
