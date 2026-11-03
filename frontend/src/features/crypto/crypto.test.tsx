import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import type { CryptoAsset, CryptoOverviewData } from "./index";

const GET = vi.fn();
vi.mock("@/lib/api/client", () => ({ privateApi: { GET: (...args: unknown[]) => GET(...args) } }));

const { CryptoOverview, CryptoTable, getCryptoOverview, MarketMood } = await import("./index");
const { compactUsd, formatCoinPrice, updatedLabel } = await import("./crypto");

const asset = (overrides: Partial<CryptoAsset> = {}): CryptoAsset => ({
  rank: 1,
  name: "Example Gold",
  symbol: "EXG",
  slug: "example-gold",
  price: "65000.1234",
  change_24h: "1.23",
  change_7d: "-2.00",
  market_cap: "1280000000000.00",
  volume_24h: "30000000000.00",
  ...overrides,
});

const overview = (overrides: Partial<CryptoOverviewData> = {}): CryptoOverviewData => ({
  attribution: { text: "Data provided by CoinMarketCap.com", url: "https://coinmarketcap.com/" },
  as_of: "2026-11-03T21:00:00Z",
  assets: [
    asset(),
    asset({
      rank: 2,
      name: "Example Tiny",
      symbol: "EXT",
      slug: "example-tiny",
      price: "0.0000001234",
      change_24h: null,
      change_7d: null,
      market_cap: null,
      volume_24h: null,
    }),
  ],
  totals: {
    total_market_cap: "2450000000000.50",
    total_volume_24h: "98000000000.00",
    btc_dominance: "52.35",
    eth_dominance: "17.80",
  },
  fear_greed: { value: 61, label: "Greed" },
  unavailable: [],
  ...overrides,
});

beforeEach(() => {
  GET.mockReset(); // braces: a returned function would be run by vitest as a cleanup hook
});

describe("helpers", () => {
  it("shortens large dollar amounts and says nothing for missing ones", () => {
    expect(compactUsd("1280000000000.00")).toBe("$1.3T");
    expect(compactUsd("98000000000")).toBe("$98B");
    expect(compactUsd(null)).toBeNull();
    expect(compactUsd("")).toBeNull();
    expect(compactUsd("abc")).toBeNull();
  });

  it("writes the update time in UTC and survives a bad one", () => {
    expect(updatedLabel("2026-11-03T21:00:00Z")).toBe("Nov 3, 2026, 9:00 PM UTC");
    expect(updatedLabel("not a date")).toBeNull();
  });
});

describe("formatCoinPrice", () => {
  it.each([
    ["65000.1234", "$65,000.12"],
    ["2500.5", "$2,500.50"],
    ["1", "$1.00"],
    ["0.5", "$0.50"],
    ["0.012345678", "$0.012346"],
    ["0.01", "$0.01"],
    ["0.0099", "$0.0099"],
    ["0.0000001234", "$0.0000001234"],
    ["0.000000000012345", "$0.00000000001235"],
  ])("writes %s as %s", (value, expected) => {
    expect(formatCoinPrice(value)).toBe(expected);
  });

  it("never shows a real price as zero", () => {
    for (const value of ["0.0000001", "0.00000000001", "0.009"]) {
      expect(formatCoinPrice(value)).not.toMatch(/^$0.0+$/);
    }
  });

  it.each([null, undefined, "", "abc", "NaN"])("shows a dash for %s", (value) => {
    expect(formatCoinPrice(value)).toBe("—");
  });
});

describe("getCryptoOverview", () => {
  it("returns the overview, and null rather than throwing when the API fails", async () => {
    GET.mockResolvedValue({ data: overview() });
    expect((await getCryptoOverview())?.assets).toHaveLength(2);
    GET.mockResolvedValue({ data: undefined, error: { error: { code: "upstream_error" } } });
    expect(await getCryptoOverview()).toBeNull();
    GET.mockRejectedValue(new Error("down"));
    expect(await getCryptoOverview()).toBeNull();
  });

  it("asks for the overview route only", async () => {
    GET.mockResolvedValue({ data: overview() });
    await getCryptoOverview();
    expect(GET).toHaveBeenCalledWith("/api/v1/crypto/overview");
  });
});

describe("CryptoTable", () => {
  it("shows each coin with its price, changes and amounts", () => {
    render(<CryptoTable caption="Coins" assets={[asset()]} />);
    const table = screen.getByRole("table", { name: "Coins" });
    const row = within(table).getByRole("row", { name: /Example Gold/ });
    expect(row).toHaveTextContent("$65,000.12");
    expect(row).toHaveTextContent("+1.23%");
    expect(row).toHaveTextContent("-2.00%");
    expect(row).toHaveTextContent("$1.3T");
    expect(row).toHaveTextContent("$30B");
  });

  it("gives the table real column headers and a row header per coin", () => {
    render(<CryptoTable caption="Coins" assets={[asset()]} />);
    for (const name of ["Rank", "Name", "Price", "24 hours", "7 days", "Market cap"]) {
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("rowheader", { name: /Example Gold/ })).toBeInTheDocument();
  });

  it("says Not available for a missing figure instead of showing zero", () => {
    render(<CryptoTable caption="Coins" assets={[overview().assets[1]!]} />);
    const row = screen.getByRole("row", { name: /Example Tiny/ });
    expect(within(row).getAllByText("Not available")).toHaveLength(4);
    expect(row).not.toHaveTextContent("0.00%");
  });

  it("shows direction with a sign and an arrow, not only colour", () => {
    render(<CryptoTable caption="Coins" assets={[asset()]} />);
    const row = screen.getByRole("row", { name: /Example Gold/ });
    expect(row).toHaveTextContent("▲");
    expect(row).toHaveTextContent("▼");
  });

  it("also offers one labelled card per coin for phones", () => {
    render(<CryptoTable caption="Coins" assets={[asset()]} />);
    const list = screen.getByRole("list", { name: "Coins" });
    const card = within(list).getByRole("article");
    expect(within(card).getByText("Price")).toBeInTheDocument();
    expect(within(card).getByText("Rank")).toBeInTheDocument();
  });

  it("shows markup in a name as text", () => {
    render(
      <CryptoTable caption="Coins" assets={[asset({ name: "<img src=x onerror=alert(1)>" })]} />,
    );
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getAllByText("<img src=x onerror=alert(1)>").length).toBeGreaterThan(0);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<CryptoTable caption="Coins" assets={overview().assets} />);
    await expectNoA11yViolations(container);
  });
});

describe("MarketMood", () => {
  it("states the index as a number with the provider's own label", () => {
    render(<MarketMood totals={overview().totals} fearGreed={{ value: 61, label: "Greed" }} />);
    const card = screen.getByRole("region", { name: "Fear and Greed index" });
    expect(card).toHaveTextContent("61");
    expect(card).toHaveTextContent("out of 100");
    expect(card).toHaveTextContent("Greed");
    expect(card).toHaveTextContent("0 is extreme fear and 100 is extreme greed.");
  });

  it("shows the market totals", () => {
    render(<MarketMood totals={overview().totals} fearGreed={null} />);
    const card = screen.getByRole("region", { name: "The whole market" });
    expect(card).toHaveTextContent("$2.5T");
    expect(card).toHaveTextContent("$98B");
    expect(card).toHaveTextContent("52.4%");
    expect(card).toHaveTextContent("17.8%");
  });

  it("keeps an out-of-range index inside the bar", () => {
    render(<MarketMood totals={null} fearGreed={{ value: 400, label: "Greed" }} />);
    expect(screen.getByRole("region", { name: "Fear and Greed index" })).toHaveTextContent("100");
  });

  it("says Not available for a missing total", () => {
    const totals = { ...overview().totals!, eth_dominance: null };
    render(<MarketMood totals={totals} fearGreed={null} />);
    expect(screen.getByText("Not available")).toBeInTheDocument();
  });

  it("renders nothing when both are missing", () => {
    const { container } = render(<MarketMood totals={null} fearGreed={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <MarketMood totals={overview().totals} fearGreed={overview().fear_greed} />,
    );
    await expectNoA11yViolations(container);
  });
});

describe("CryptoOverview", () => {
  async function renderPage(data: CryptoOverviewData | null) {
    GET.mockResolvedValue({ data: data ?? undefined });
    return render(await CryptoOverview());
  }

  it("shows the provider's credit as a real link next to the data", async () => {
    await renderPage(overview());
    const link = screen.getByRole("link", { name: "CoinMarketCap.com" });
    expect(link).toHaveAttribute("href", "https://coinmarketcap.com/");
    expect(link.closest("p")).toHaveTextContent("Data provided by CoinMarketCap.com");
  });

  it("states the update time, the use limit and that it is not advice", async () => {
    await renderPage(overview());
    expect(screen.getByText(/updated Nov 3, 2026, 9:00 PM UTC/)).toBeInTheDocument();
    expect(screen.getByText(/personal, non-commercial use/)).toBeInTheDocument();
    expect(screen.getByText(/not investment advice/)).toBeInTheDocument();
  });

  it("keeps the headings in order: one h1 above, then h2 sections, then h3 cards", async () => {
    await renderPage(overview());
    const levels = screen.getAllByRole("heading").map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(2); // the h1 belongs to the page
    for (let i = 1; i < levels.length; i++)
      expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
    expect(screen.getByRole("heading", { level: 2, name: "Market mood" })).toBeInTheDocument();
  });

  it("leaves out the Market mood section when neither summary loaded", async () => {
    await renderPage(
      overview({
        totals: null,
        fear_greed: null,
        unavailable: ["market totals", "fear and greed"],
      }),
    );
    expect(screen.queryByRole("heading", { name: "Market mood" })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Could not load: market totals and fear and greed/),
    ).toBeInTheDocument();
  });

  it("lists the coins in a labelled section", async () => {
    await renderPage(overview());
    expect(
      screen.getByRole("heading", { name: "Largest coins by market cap" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /Largest coins/ })).toBeInTheDocument();
  });

  it("says which summary is missing instead of looking complete", async () => {
    await renderPage(overview({ totals: null, unavailable: ["market totals"] }));
    expect(screen.getByText("Some figures are unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Could not load: market totals/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "The whole market" })).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: /Largest coins/ })).toBeInTheDocument();
  });

  it("shows a plain message, not an error screen, when the API is down", async () => {
    await renderPage(null);
    expect(screen.getByText("Crypto prices are not available right now")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("does not link an attribution address that is not https", async () => {
    const { container } = await renderPage(
      overview({
        attribution: { text: "Data provided by CoinMarketCap.com", url: "http://x.test/" },
      }),
    );
    expect(screen.queryByRole("link", { name: "CoinMarketCap.com" })).not.toBeInTheDocument();
    // The credit is still shown, as plain text, so the licence line is never dropped.
    expect(container).toHaveTextContent("Data provided by CoinMarketCap.com");
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderPage(overview({ unavailable: ["fear and greed"] }));
    await expectNoA11yViolations(container);
  });
});
