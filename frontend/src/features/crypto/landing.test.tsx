import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { priceSeries, spanLabel } from "./bitcoinSeries";
import type { CryptoMarketsData, MajorCoin } from "./index";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/client", () => ({
  privateApi: { GET: vi.fn() },
  publicApi: { GET: vi.fn() },
}));

const { BitcoinChart, CryptoTicker } = await import("./index");

const coin = (overrides: Partial<MajorCoin> = {}): MajorCoin => ({
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
  ...overrides,
});

const dates = { yearStart: "2026-01-01", pastYearStart: "2025-11-12" };
const AS_OF = "2026-11-04T01:00:00Z";

const markets = (majors: MajorCoin[] = [coin()]): CryptoMarketsData => ({
  attribution: { text: "Data provided by CoinMarketCap.com", url: "https://coinmarketcap.com/" },
  as_of: AS_OF,
  composition: null,
  majors,
  past_year_start: dates.pastYearStart,
  unavailable: [],
  year_start: dates.yearStart,
});

describe("priceSeries", () => {
  it("works the price then out from the price now and each change, oldest first, ending now", () => {
    const series = priceSeries(coin(), dates, AS_OF)!;
    const days = series.points.map((point) => point.daysAgo);
    expect(days).toEqual([...days].sort((a, b) => b - a));
    expect(days.at(-1)).toBe(0);
    expect(series.points.at(-1)!.price).toBe(100);
    // 100 now after +100% over the past year means 50 then; +1% over a day means 99.0099 then.
    expect(series.points[0]!.price).toBeCloseTo(50, 6);
    expect(series.points.find((point) => point.daysAgo === 1)!.price).toBeCloseTo(100 / 1.01, 6);
    expect(series.spanChange).toBe("100.00");
    expect(series.spanDays).toBe(series.points[0]!.daysAgo);
  });

  it("skips a missing change instead of guessing it", () => {
    const series = priceSeries(coin({ change_30d: null, change_90d: null }), dates, AS_OF)!;
    expect(series.points.map((point) => point.daysAgo)).not.toContain(30);
    expect(series.points.map((point) => point.daysAgo)).not.toContain(90);
  });

  it("is null when fewer than three periods can be worked out", () => {
    const bare = coin({
      change_24h: "1",
      change_7d: null,
      change_30d: null,
      change_90d: null,
      change_year_to_date: null,
      change_past_year: null,
    });
    expect(priceSeries(bare, dates, AS_OF)).toBeNull();
  });

  it.each(["", "abc", "-100", "-250"])("ignores an impossible change (%j)", (bad) => {
    const series = priceSeries(coin({ change_7d: bad }), dates, AS_OF)!;
    expect(series.points.map((point) => point.daysAgo)).not.toContain(7);
    expect(series.points.every((point) => Number.isFinite(point.price))).toBe(true);
  });

  it.each(["0", "-1", "abc", ""])("is null for a price that cannot be drawn (%j)", (price) => {
    expect(priceSeries(coin({ price }), dates, AS_OF)).toBeNull();
  });

  it("keeps one point when two periods end on the same day", () => {
    const series = priceSeries(coin(), { yearStart: "2026-10-28", pastYearStart: null }, AS_OF)!;
    const days = series.points.map((point) => point.daysAgo);
    expect(new Set(days).size).toBe(days.length);
  });

  it("names the span", () => {
    expect(spanLabel(358)).toBe("past year");
    expect(spanLabel(90)).toBe("past 90 days");
  });
});

describe("BitcoinChart", () => {
  it("draws a line chart with the price, the change, a text alternative, and the credit", async () => {
    const { container } = render(<BitcoinChart markets={markets()} />);
    const chart = screen.getByRole("img", { name: /Bitcoin price over the past year/ });
    expect(chart).toHaveAccessibleName(/now \$100\.00, up 100\.00 percent/);
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText(/\+100\.00%/)).toBeInTheDocument();
    expect(screen.getByText(/not a full price history/i)).toBeInTheDocument();
    const credit = screen.getByRole("link", { name: "CoinMarketCap.com" });
    expect(credit).toHaveAttribute("href", "https://coinmarketcap.com/");
    expect(container.querySelectorAll("path").length).toBe(2); // the soft fill and the line
    await expectNoA11yViolations(container);
  });

  it("states a fall as a fall", () => {
    render(
      <BitcoinChart
        markets={markets([coin({ change_past_year: "-20.00", change_year_to_date: "-10.00" })])}
      />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(/down 20\.00 percent/);
  });

  it("draws nothing, never invented numbers, without the figures", () => {
    expect(render(<BitcoinChart markets={null} />).container).toBeEmptyDOMElement();
    expect(
      render(<BitcoinChart markets={markets([coin({ symbol: "ETH" })])} />).container,
    ).toBeEmptyDOMElement();
    expect(
      render(<BitcoinChart markets={markets([coin({ price: "0" })])} />).container,
    ).toBeEmptyDOMElement();
  });

  it("stays inside its drawing for a flat price", () => {
    const flat = coin({
      change_24h: "0",
      change_7d: "0",
      change_30d: "0",
      change_90d: "0",
      change_year_to_date: "0",
      change_past_year: "0",
    });
    const { container } = render(<BitcoinChart markets={markets([flat])} />);
    const line = container.querySelectorAll("path")[1]!.getAttribute("d")!;
    expect(line).not.toMatch(/NaN|Infinity/);
  });
});

describe("CryptoTicker", () => {
  it("shows the coins with a sign and the provider's credit", async () => {
    const eth = coin({ symbol: "ETH", name: "Ethereum", price: "3000.00", change_24h: "-2.00" });
    const { container } = render(<CryptoTicker markets={markets([coin(), eth])} />);
    const region = screen.getByRole("region", { name: /largest cryptocurrencies/i });
    const list = within(region).getByRole("list");
    expect(within(list).getByText("BTC")).toBeInTheDocument();
    expect(within(list).getByText(/-2\.00%/)).toBeInTheDocument();
    expect(within(region).getByRole("link", { name: "CoinMarketCap.com" })).toBeInTheDocument();
    expect(screen.queryByText(/sample/i)).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("shows nothing without figures", () => {
    expect(render(<CryptoTicker markets={null} />).container).toBeEmptyDOMElement();
    expect(render(<CryptoTicker markets={markets([])} />).container).toBeEmptyDOMElement();
  });
});
