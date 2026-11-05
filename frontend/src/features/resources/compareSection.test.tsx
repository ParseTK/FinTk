import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

const getCoin = vi.fn();
vi.mock("@/features/crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/crypto")>()),
  getCoin: (...args: unknown[]) => getCoin(...args),
}));

const { CompareSection } = await import("./CompareSection");

const attribution = {
  text: "Data provided by CoinMarketCap.com",
  url: "https://coinmarketcap.com/",
};
const coin = (slug: string, name: string, symbol: string, extra: Record<string, unknown> = {}) => ({
  status: "ok" as const,
  coin: {
    slug,
    name,
    symbol,
    rank: 1,
    price: "76992.19",
    market_cap: "1500000000000",
    volume_24h: "35200000000",
    change_1h: "0.10",
    change_24h: "-4.29",
    change_7d: "-5.31",
    change_30d: "-11.09",
    change_90d: "18.63",
    as_of: "2026-11-05T15:13:00Z",
    attribution,
    ...extra,
  },
});

const show = async (slugs: string[]) => render(await CompareSection({ slugs }));

beforeEach(() => {
  getCoin.mockReset();
  vi.stubEnv("FEATURE_CRYPTO_SEARCH", "true");
});
afterEach(() => vi.unstubAllEnvs());

describe("CompareSection", () => {
  it("shows a side-by-side table for two coins, with credit and no a11y violations", async () => {
    getCoin.mockImplementation(async (slug: string) =>
      slug === "bitcoin"
        ? coin("bitcoin", "Bitcoin", "BTC")
        : coin("ethereum", "Ethereum", "ETH", {
            price: "2286.5",
            market_cap: "279400000000",
            change_24h: "-5.80",
          }),
    );
    const { container } = await show(["bitcoin", "ethereum"]);
    const table = screen.getByRole("table");
    expect(within(table).getByRole("link", { name: "Bitcoin" })).toHaveAttribute(
      "href",
      "/crypto/coins/bitcoin",
    );
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Figure", "Bitcoin BTC", "Ethereum ETH"]);
    expect(within(table).getByText("$76,992.19")).toBeInTheDocument();
    expect(within(table).getByText("$1.5T")).toBeInTheDocument();
    expect(within(table).getByText("-5.80%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CoinMarketCap.com" })).toBeInTheDocument();
    expect(screen.getByText(/not investment advice/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("says a missing figure is not available, never zero", async () => {
    getCoin.mockImplementation(async (slug: string) =>
      slug === "a"
        ? coin("a", "Alpha", "ALP", { change_90d: null, market_cap: null })
        : coin("b", "Beta", "BET"),
    );
    await show(["a", "b"]);
    expect(within(screen.getByRole("table")).getAllByText("Not available")).toHaveLength(2);
  });

  it("asks for more coins when there are fewer than two", async () => {
    await show([]);
    expect(screen.getByText("Choose at least two coins to see them compared.")).toBeInTheDocument();
  });

  it("asks for one more coin when there is only one", async () => {
    getCoin.mockResolvedValue(coin("bitcoin", "Bitcoin", "BTC"));
    await show(["bitcoin"]);
    expect(screen.getByText("Add one more coin to compare.")).toBeInTheDocument();
  });

  it("names a coin that is not covered, keeps it removable, and still shows the rest", async () => {
    getCoin.mockImplementation(async (slug: string) =>
      slug === "nope" ? { status: "not_found" } : coin(slug, slug.toUpperCase(), "X"),
    );
    await show(["bitcoin", "nope", "ethereum"]);
    expect(screen.getByText(/Virello does not cover: nope/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove nope" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("explains an outage without hiding the coins that loaded", async () => {
    getCoin.mockImplementation(async (slug: string) =>
      slug === "down" ? { status: "unavailable" } : coin(slug, slug.toUpperCase(), "X"),
    );
    await show(["bitcoin", "down", "ethereum"]);
    expect(screen.getByText("Prices are unavailable right now")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("does not link coin names when the coin pages are off", async () => {
    vi.stubEnv("FEATURE_CRYPTO_SEARCH", "false");
    getCoin.mockImplementation(async (slug: string) => coin(slug, slug.toUpperCase(), "X"));
    await show(["a1", "b2"]);
    expect(within(screen.getByRole("table")).queryByRole("link")).not.toBeInTheDocument();
  });
});
