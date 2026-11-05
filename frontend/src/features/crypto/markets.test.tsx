import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import type { Composition, CryptoMarketsData, CryptoOverviewData, MajorCoin } from "./index";

const GET = vi.fn();
vi.mock("@/lib/api/client", () => ({ privateApi: { GET: (...args: unknown[]) => GET(...args) } }));

const { CompositionPanel, CryptoMarkets, getCryptoMarkets, MajorsTable } = await import("./index");

const composition = (overrides: Partial<Composition> = {}): Composition => ({
  total_market_cap: "2577000000000.00",
  total_change_24h: "-0.32",
  rows: [
    {
      key: "bitcoin",
      label: "Bitcoin",
      share: "59.92",
      market_cap: "1543900000000.00",
      share_change: "-0.05",
      overlaps: false,
    },
    {
      key: "ethereum",
      label: "Ethereum",
      share: "10.72",
      market_cap: "276200000000.00",
      share_change: "0.05",
      overlaps: false,
    },
    {
      key: "other",
      label: "All other coins",
      share: "29.36",
      market_cap: "756500000000.00",
      share_change: "0.00",
      overlaps: false,
    },
    {
      key: "stablecoins",
      label: "Stablecoins",
      share: "10.65",
      market_cap: "274400000000.00",
      share_change: null,
      overlaps: true,
    },
    {
      key: "defi",
      label: "DeFi tokens",
      share: "3.01",
      market_cap: "77500000000.00",
      share_change: null,
      overlaps: true,
    },
  ],
  ...overrides,
});

const coin = (overrides: Partial<MajorCoin> = {}): MajorCoin => ({
  rank: 1,
  name: "Bitcoin",
  symbol: "BTC",
  slug: "bitcoin",
  price: "76759.10",
  change_24h: "1.33",
  change_7d: "-3.70",
  change_30d: "-11.37",
  change_90d: "18.96",
  change_year_to_date: "-12.29",
  change_past_year: "-27.58",
  ...overrides,
});

const markets = (overrides: Partial<CryptoMarketsData> = {}): CryptoMarketsData => ({
  attribution: { text: "Data provided by CoinMarketCap.com", url: "https://coinmarketcap.com/" },
  as_of: "2026-11-04T01:00:00Z",
  composition: composition(),
  majors: [
    coin(),
    coin({
      rank: 2,
      name: "Ethereum",
      symbol: "ETH",
      slug: "ethereum",
      price: "2259.53",
      change_year_to_date: null,
    }),
    coin({
      rank: 3,
      name: "Tiny",
      symbol: "TNY",
      slug: "tiny",
      price: "0.0000001234",
      change_30d: null,
      change_90d: null,
      change_year_to_date: null,
      change_past_year: null,
    }),
  ],
  year_start: "2026-01-01",
  past_year_start: "2025-11-11",
  unavailable: [],
  ...overrides,
});

beforeEach(() => {
  GET.mockReset(); // braces: a returned function would be run by vitest as a cleanup hook
});

describe("CompositionPanel", () => {
  it("states the total and its change over 24 hours", () => {
    render(<CompositionPanel composition={composition()} />);
    expect(screen.getByText("$2.6T")).toBeInTheDocument();
    expect(screen.getByText("-0.32%")).toBeInTheDocument();
    expect(screen.getByText(/in 24 hours/)).toBeInTheDocument();
  });

  it("shows Bitcoin, Ethereum and the rest as shares with what they are worth", () => {
    render(<CompositionPanel composition={composition()} />);
    const table = screen.getByRole("table", { name: "Share of the total market capitalization" });
    const btc = within(table).getByRole("row", { name: /Bitcoin/ });
    expect(btc).toHaveTextContent("59.9%");
    expect(btc).toHaveTextContent("$1.5T");
    expect(within(table).getByRole("row", { name: /All other coins/ })).toHaveTextContent("29.4%");
  });

  it("writes the change in a share in percentage points, signed and for screen readers in words", () => {
    render(<CompositionPanel composition={composition()} />);
    const table = screen.getByRole("table", { name: "Share of the total market capitalization" });
    const btc = within(table).getByRole("row", { name: /Bitcoin/ });
    expect(btc).toHaveTextContent("-0.05");
    expect(within(btc).getByText("percentage points")).toHaveClass("sr-only");
    expect(within(table).getByRole("row", { name: /Ethereum/ })).toHaveTextContent("+0.05");
    // no change at all carries no sign
    const other = within(table).getByRole("row", { name: /All other coins/ });
    expect(other).toHaveTextContent("0.00");
    expect(other).not.toHaveTextContent("+0.00");
    expect(other).not.toHaveTextContent("-0.00");
  });

  it("does not colour a change in share as a gain or a loss", () => {
    const { container } = render(<CompositionPanel composition={composition()} />);
    const table = container.querySelectorAll("table")[0]!;
    expect(table.innerHTML).not.toMatch(/text-gain|text-loss/);
  });

  it("says the overlapping groups overlap, and gives them no change column", () => {
    render(<CompositionPanel composition={composition()} />);
    expect(
      screen.getByRole("heading", { level: 3, name: "Groups inside those slices" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Do not add them up/)).toBeInTheDocument();
    const groups = screen.getByRole("table", { name: "Groups that overlap the slices above" });
    expect(
      within(groups).queryByRole("columnheader", { name: "Since yesterday" }),
    ).not.toBeInTheDocument();
    expect(within(groups).getByRole("row", { name: /Stablecoins/ })).toHaveTextContent("10.7%");
    expect(within(groups).getByRole("row", { name: /DeFi tokens/ })).toHaveTextContent("$77.5B");
  });

  it("draws the bar as a picture only: hidden from assistive technology, proportional to the shares", () => {
    const { container } = render(<CompositionPanel composition={composition()} />);
    const bar = container.querySelector("div[aria-hidden='true'].flex")!;
    expect(bar).not.toBeNull();
    const widths = [...bar.children].map((c) => (c as HTMLElement).style.width);
    expect(widths).toEqual(["59.92%", "10.72%", "29.36%"]);
  });

  it("keeps a bad share inside the bar", () => {
    const rows = composition().rows.map((row) =>
      row.key === "bitcoin"
        ? { ...row, share: "400" }
        : row.key === "other"
          ? { ...row, share: "-20" }
          : row,
    );
    const { container } = render(<CompositionPanel composition={composition({ rows })} />);
    const bar = container.querySelector("div[aria-hidden='true'].flex")!;
    const widths = [...bar.children].map((c) => (c as HTMLElement).style.width);
    expect(widths[0]).toBe("100%");
    expect(widths[2]).toBe("0%");
  });

  it("says Not available for a missing figure and leaves its slice out of the bar", () => {
    const rows = composition().rows.map((row) =>
      row.key === "ethereum" ? { ...row, share: null, market_cap: null, share_change: null } : row,
    );
    const { container } = render(<CompositionPanel composition={composition({ rows })} />);
    const eth = screen.getAllByRole("row", { name: /Ethereum/ })[0]!;
    expect(within(eth).getAllByText("Not available")).toHaveLength(3);
    expect(container.querySelector("div[aria-hidden='true'].flex")!.children).toHaveLength(2);
  });

  it("handles a missing total and 24 hour change", () => {
    render(
      <CompositionPanel
        composition={composition({ total_market_cap: null, total_change_24h: null })}
      />,
    );
    expect(screen.getAllByText("Not available").length).toBeGreaterThan(0);
    expect(screen.queryByText(/in 24 hours/)).not.toBeInTheDocument();
  });

  it("positions its scroll box, so hidden text in a far cell cannot widen the page on a phone", () => {
    const { container } = render(<CompositionPanel composition={composition()} />);
    for (const box of container.querySelectorAll(".overflow-x-auto"))
      expect(box).toHaveClass("relative");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<CompositionPanel composition={composition()} />);
    await expectNoA11yViolations(container);
  });
});

describe("MajorsTable", () => {
  const props = {
    coins: markets().majors,
    yearStart: "2026-01-01",
    pastYearStart: "2025-11-11",
    caption: "The largest coins",
  };

  it("shows a real table with a caption, column headers and a row header per coin", () => {
    render(<MajorsTable {...props} />);
    const table = screen.getByRole("table", { name: "The largest coins" });
    for (const name of [
      "Rank",
      "Name",
      "Price",
      "30 days",
      "90 days",
      /Year to date/,
      /Past year/,
    ]) {
      expect(within(table).getByRole("columnheader", { name })).toBeInTheDocument();
    }
    expect(within(table).getByRole("rowheader", { name: /Bitcoin/ })).toBeInTheDocument();
  });

  it("labels the two long changes with the day each is measured from", () => {
    render(<MajorsTable {...props} />);
    const table = screen.getByRole("table", { name: "The largest coins" });
    expect(within(table).getByRole("columnheader", { name: /Year to date/ })).toHaveTextContent(
      "since Jan 1, 2026",
    );
    expect(within(table).getByRole("columnheader", { name: /Past year/ })).toHaveTextContent(
      "since Nov 11, 2025",
    );
  });

  it("shows each change with a sign and an arrow, not only colour", () => {
    render(<MajorsTable {...props} />);
    const row = within(screen.getByRole("table", { name: "The largest coins" })).getByRole("row", {
      name: /Bitcoin/,
    });
    expect(row).toHaveTextContent("-11.37%");
    expect(row).toHaveTextContent("+18.96%");
    expect(row).toHaveTextContent("▼");
    expect(row).toHaveTextContent("▲");
  });

  it("says Not available for a change that could not be worked out, never zero", () => {
    render(<MajorsTable {...props} />);
    const tiny = within(screen.getByRole("table", { name: "The largest coins" })).getByRole("row", {
      name: /Tiny/,
    });
    expect(within(tiny).getAllByText("Not available")).toHaveLength(4);
    expect(tiny).not.toHaveTextContent("0.00%");
  });

  it("never shows a real tiny price as zero", () => {
    render(<MajorsTable {...props} />);
    expect(screen.getAllByText("$0.0000001234").length).toBeGreaterThan(0);
  });

  it("leaves the day out of the label, not the column, when it is unknown", () => {
    render(<MajorsTable {...props} yearStart={null} />);
    const header = screen.getByRole("columnheader", { name: /Year to date/ });
    expect(header).not.toHaveTextContent("since");
  });

  it("also offers one labelled card per coin for smaller screens, with the same dates", () => {
    render(<MajorsTable {...props} />);
    const list = screen.getByRole("list", { name: "The largest coins" });
    const card = within(list).getAllByRole("article")[0]!;
    expect(within(card).getByText("Year to date")).toBeInTheDocument();
    expect(card).toHaveTextContent("since Jan 1, 2026");
    expect(within(card).getByText("Rank")).toBeInTheDocument();
  });

  it("shows text in a name as text", () => {
    render(<MajorsTable {...props} coins={[coin({ name: "<img src=x onerror=alert(1)>" })]} />);
    expect(document.querySelector("img")).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<MajorsTable {...props} />);
    await expectNoA11yViolations(container);
  });
});

describe("getCryptoMarkets", () => {
  it("returns the markets, and null rather than throwing when the API fails", async () => {
    GET.mockResolvedValue({ data: markets() });
    expect((await getCryptoMarkets())?.majors).toHaveLength(3);
    GET.mockResolvedValue({ data: undefined, error: { error: { code: "upstream_error" } } });
    expect(await getCryptoMarkets()).toBeNull();
    GET.mockRejectedValue(new Error("down"));
    expect(await getCryptoMarkets()).toBeNull();
  });

  it("asks for the markets route only", async () => {
    GET.mockResolvedValue({ data: markets() });
    await getCryptoMarkets();
    expect(GET).toHaveBeenCalledWith("/api/v1/crypto/markets");
  });
});

describe("CryptoMarkets", () => {
  const overviewData: CryptoOverviewData = {
    attribution: { text: "Data provided by CoinMarketCap.com", url: "https://coinmarketcap.com/" },
    as_of: "2026-11-04T01:00:00Z",
    unavailable: [],
    totals: {
      total_market_cap: "2577000000000.00",
      total_volume_24h: "94300000000.00",
      btc_dominance: "60.2",
      eth_dominance: "11.0",
    },
    fear_greed: { value: 42, label: "Neutral" },
    assets: [
      ["Bitcoin", "BTC", "4.52"],
      ["Ethereum", "ETH", "6.77"],
      ["Solana", "SOL", "-5.10"],
    ].map(([name, symbol, change], i) => ({
      rank: i + 1,
      name: name!,
      symbol: symbol!,
      slug: name!.toLowerCase(),
      price: "100.00",
      change_24h: change!,
      change_7d: "1.00",
      market_cap: "1000000000.00",
      volume_24h: "1000000.00",
    })),
  };

  async function renderPage(
    data: CryptoMarketsData | null,
    overview: CryptoOverviewData | null = overviewData,
  ) {
    GET.mockImplementation(async (path: string) =>
      path.endsWith("/overview") ? { data: overview ?? undefined } : { data: data ?? undefined },
    );
    return render(await CryptoMarkets());
  }

  it("shows the provider's credit as a real link, above the data", async () => {
    await renderPage(markets());
    const link = screen.getByRole("link", { name: "CoinMarketCap.com" });
    expect(link).toHaveAttribute("href", "https://coinmarketcap.com/");
    expect(link.closest("p")).toHaveTextContent("Data provided by CoinMarketCap.com");
  });

  it("states the update time, the use limit and that it is not advice", async () => {
    await renderPage(markets());
    expect(screen.getByText(/updated Nov 4, 2026, 1:00 AM UTC/)).toBeInTheDocument();
    expect(screen.getByText(/personal, non-commercial use/)).toBeInTheDocument();
    expect(screen.getByText(/not investment advice/)).toBeInTheDocument();
  });

  it("shows the headline figures, the day's largest gain and decline, and the coins", async () => {
    await renderPage(markets());
    expect(screen.getAllByText("$2.6T")).not.toHaveLength(0);
    expect(screen.getByText("$94.3B")).toBeInTheDocument();
    const focus = screen.getByRole("region", { name: "In focus" });
    expect(focus).toHaveTextContent(/Largest gains*Ethereum ETH/);
    expect(focus).toHaveTextContent(/Largest declines*Solana SOL/);
    expect(focus).toHaveTextContent("2 advancing");
    expect(focus).toHaveTextContent("1 declining");
    expect(screen.getByRole("table", { name: /Largest coins/ })).toBeInTheDocument();
  });

  it("has the make-up section then the coins section, with headings in order", async () => {
    await renderPage(markets());
    const levels = screen.getAllByRole("heading").map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(2);
    for (let i = 1; i < levels.length; i++)
      expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
    expect(screen.getByRole("heading", { level: 2, name: "Market make-up" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "The ten largest coins over time" }),
    ).toBeInTheDocument();
  });

  it("names every part that could not be loaded instead of looking complete", async () => {
    await renderPage(
      markets({
        unavailable: ["year-to-date change", "past-year change"],
        year_start: null,
        past_year_start: null,
      }),
    );
    expect(screen.getByText("Some figures are unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(/Could not load: year-to-date change, past-year change/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "How the ten largest coins have done" }),
    ).toBeInTheDocument();
  });

  it("leaves out the make-up section, and says why, when the totals are missing", async () => {
    await renderPage(markets({ composition: null, unavailable: ["market totals"] }));
    expect(screen.queryByRole("heading", { name: "Market make-up" })).not.toBeInTheDocument();
    expect(screen.getByText(/Could not load: market totals/)).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "How the ten largest coins have done" }),
    ).toBeInTheDocument();
  });

  it("shows a plain message, not an error screen, when the API is down", async () => {
    await renderPage(null, null);
    expect(screen.getByText("Crypto markets are not available right now")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows what it has and names what is missing when only one response loaded", async () => {
    await renderPage(null);
    expect(
      screen.getByText(/Could not load: Bitcoin's price and the market make-up/),
    ).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /Largest coins/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Market make-up" })).not.toBeInTheDocument();
  });

  it("does not link an attribution address that is not https, but still shows the credit", async () => {
    const { container } = await renderPage(
      markets({
        attribution: { text: "Data provided by CoinMarketCap.com", url: "http://x.test/" },
      }),
    );
    expect(screen.queryByRole("link", { name: "CoinMarketCap.com" })).not.toBeInTheDocument();
    expect(container).toHaveTextContent("Data provided by CoinMarketCap.com");
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderPage(markets({ unavailable: ["fear and greed"] }));
    await expectNoA11yViolations(container);
  });
});
