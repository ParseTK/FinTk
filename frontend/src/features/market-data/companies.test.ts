import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getCompanyProfile,
  getFilings,
  getFinancials,
  getKeyFilings,
  isValidTicker,
  searchCompanies,
  UpstreamError,
} = await import("./companies");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const requestedUrls = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.map((call: unknown[]) => new URL((call[0] as Request).url));

afterEach(() => vi.restoreAllMocks());

describe("isValidTicker", () => {
  it.each(["AAPL", "BRK.B", "BF-B", "t"])("accepts %s", (ticker) => {
    expect(isValidTicker(ticker)).toBe(true);
  });

  it.each(["", "../etc/passwd", "AAPL?x=1", "a b", "WAYTOOLONGTICKER1", "^GSPC", "A1"])(
    "rejects %j",
    (ticker) => {
      expect(isValidTicker(ticker)).toBe(false);
    },
  );
});

describe("searchCompanies", () => {
  it("returns nothing for a blank query without calling the API", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    expect(await searchCompanies("   ")).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("sends the trimmed query and returns the results", async () => {
    const results = [{ ticker: "AAPL", name: "Apple Inc.", exchange: "Nasdaq", cik: "0000320193" }];
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ results }));

    expect(await searchCompanies("  apple ")).toEqual(results);

    const [url] = requestedUrls(spy);
    expect(url.pathname).toBe("/api/v1/companies/search");
    expect(url.searchParams.get("q")).toBe("apple");
  });
});

describe("getCompanyProfile", () => {
  it("returns null for an invalid ticker without calling the network", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    expect(await getCompanyProfile("../x")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns null when the API says there is no such company", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ error: { code: "not_found", message: "No company with that ticker." } }, 404),
    );
    expect(await getCompanyProfile("ZZZZ")).toBeNull();
  });

  it("raises an UpstreamError when the API fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ error: { code: "upstream_error", message: "x" } }, 502),
    );
    await expect(getCompanyProfile("AAPL")).rejects.toBeInstanceOf(UpstreamError);
  });

  it("raises an UpstreamError when the API cannot be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    await expect(getCompanyProfile("AAPL")).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe("getFinancials and getFilings", () => {
  it("asks for the requested number of years", async () => {
    const body = { ticker: "AAPL", source: "SEC EDGAR", metrics: [] };
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(body));

    expect(await getFinancials("AAPL", 3)).toEqual(body);

    const [url] = requestedUrls(spy);
    expect(url.pathname).toBe("/api/v1/companies/AAPL/financials");
    expect(url.searchParams.get("years")).toBe("3");
  });

  it("returns an empty list for filings of an unknown company", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ error: {} }, 404));
    expect(await getFilings("ZZZZ")).toEqual([]);
  });

  it("merges 10-K, 10-Q and 8-K filings newest first and trims to the limit", async () => {
    const filing = (form: string, filed: string) => ({
      accession_number: `${form}-${filed}`,
      form,
      filed,
      report_date: null,
      description: null,
      url: "https://www.sec.gov/x",
    });
    const byForm: Record<string, ReturnType<typeof filing>[]> = {
      "10-K": [filing("10-K", "2025-10-31")],
      "10-Q": [filing("10-Q", "2026-05-01"), filing("10-Q", "2026-02-01")],
      "8-K": [filing("8-K", "2026-07-30")],
    };
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const form = new URL((input as Request).url).searchParams.get("form") ?? "";
      return json({ filings: byForm[form] ?? [] });
    });

    const merged = await getKeyFilings("AAPL", 3);

    expect(merged.map((f) => f.filed)).toEqual(["2026-07-30", "2026-05-01", "2026-02-01"]);
    expect(spy).toHaveBeenCalledTimes(3);
  });
});
