import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";

vi.mock("server-only", () => ({}));
const GET = vi.fn();
vi.mock("@/lib/api/client", () => ({
  privateApi: { GET: (...args: unknown[]) => GET(...args) },
  publicApi: { GET: vi.fn() },
}));

const { CryptoHome } = await import("./CryptoHome");

const btc = {
  rank: 1,
  name: "Bitcoin",
  symbol: "BTC",
  slug: "bitcoin",
  price: "100.00",
  change_24h: "1.00",
  change_7d: "5.00",
  change_30d: "10.00",
  change_90d: "25.00",
  change_year_to_date: "40.00",
  change_past_year: "100.00",
};
const markets = {
  attribution: { text: "Data provided by CoinMarketCap.com", url: "https://coinmarketcap.com/" },
  as_of: "2026-11-04T01:00:00Z",
  composition: null,
  majors: [btc],
  past_year_start: "2025-11-12",
  unavailable: [],
  year_start: "2026-01-01",
};

beforeEach(() => {
  vi.stubEnv("FEATURE_CRYPTO", "true");
  GET.mockReset(); // braces: a returned function would be run by vitest as a cleanup hook
});
afterEach(() => vi.unstubAllEnvs());

describe("CryptoHome about section", () => {
  it("explains what the site is, what it does, where the data comes from and its limits", async () => {
    GET.mockResolvedValue({ data: markets });
    render(await CryptoHome());
    const about = screen.getByRole("region", { name: "About Virello" });
    for (const title of ["What it does", "Where the data comes from", "Limits", "How to use it"]) {
      expect(within(about).getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
    }
    expect(within(about).getByRole("link", { name: "CoinMarketCap.com" })).toHaveAttribute(
      "href",
      "https://coinmarketcap.com/",
    );
    expect(about).toHaveTextContent(/no full price history/);
    expect(about).toHaveTextContent(/not investment advice/);
  });

  it("only describes the pages that are switched on", async () => {
    GET.mockResolvedValue({ data: markets });
    const { unmount } = render(await CryptoHome());
    expect(screen.queryByText(/Collects official announcements/)).not.toBeInTheDocument();
    unmount();
    vi.stubEnv("FEATURE_CRYPTO_NEWS", "true");
    render(await CryptoHome());
    expect(screen.getByText(/Collects official announcements/)).toBeInTheDocument();
  });
});

describe("CryptoHome", () => {
  it("leads with the crypto headline, the crypto text and links, not a company search", async () => {
    GET.mockResolvedValue({ data: markets });
    const { container } = render(await CryptoHome());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Digital financial data.");
    expect(
      screen.getByText("Research crypto markets, coins and official filings."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore the market" })).toHaveAttribute(
      "href",
      "/crypto",
    );
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/without the (hype|noise)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AAPL|NVIDIA|sample/i)).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("shows live prices and Bitcoin's reported changes, with one request", async () => {
    GET.mockResolvedValue({ data: markets });
    render(await CryptoHome());
    expect(screen.getByRole("region", { name: /largest cryptocurrencies/i })).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: /Bitcoin price change over each period/ }),
    ).toBeInTheDocument();
    expect(GET).toHaveBeenCalledTimes(1);
    expect(GET).toHaveBeenCalledWith("/api/v1/crypto/markets");
  });

  it("shows the Read the news link only while the news page is on", async () => {
    GET.mockResolvedValue({ data: markets });
    render(await CryptoHome());
    expect(screen.queryByRole("link", { name: "Read the news" })).not.toBeInTheDocument();
    vi.stubEnv("FEATURE_CRYPTO_NEWS", "true");
    render(await CryptoHome());
    expect(screen.getByRole("link", { name: "Read the news" })).toHaveAttribute(
      "href",
      "/crypto/news",
    );
  });

  it("without figures, leaves out the prices and the chart and still shows the hero", async () => {
    GET.mockRejectedValue(new Error("down"));
    const { container } = render(await CryptoHome());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Digital financial data.");
    expect(screen.queryByRole("region", { name: /largest cryptocurrencies/i })).toBeNull();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe("CryptoHome with the crypto pages off", () => {
  it("does not ask for any figures, shows no links to pages that are not there, and keeps the hero", async () => {
    vi.stubEnv("FEATURE_CRYPTO", "false");
    const { container } = render(await CryptoHome());
    expect(GET).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Digital financial data.");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
