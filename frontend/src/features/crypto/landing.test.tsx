import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import type { CryptoMarketsData, MajorCoin } from "./index";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/client", () => ({
  privateApi: { GET: vi.fn() },
  publicApi: { GET: vi.fn() },
}));

const { BitcoinChanges, changeRows, CryptoTicker } = await import("./index");

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

describe("changeRows", () => {
  it("lists every period that has a change, in order, as the API sent it", () => {
    const rows = changeRows(coin());
    expect(rows.map((row) => row.label)).toEqual([
      "24 hours",
      "7 days",
      "30 days",
      "90 days",
      "Year to date",
      "Past year",
    ]);
    expect(rows[5]!.change).toBe("100.00");
  });

  it.each([null, "", "  ", "abc"])(
    "leaves out a change that is %j, never showing it as zero",
    (bad) => {
      const rows = changeRows(coin({ change_7d: bad }));
      expect(rows.map((row) => row.label)).not.toContain("7 days");
    },
  );
});

describe("BitcoinChanges", () => {
  it("shows the price, a signed change per period, a text alternative, and the credit", async () => {
    const { container } = render(<BitcoinChanges markets={markets()} />);
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /Bitcoin price change over each period/ });
    expect(within(table).getByRole("row", { name: /Past year.*\+100\.00%/ })).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(7); // header + six periods
    expect(screen.getByText(/no price history between these dates/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CoinMarketCap.com" })).toHaveAttribute(
      "href",
      "https://coinmarketcap.com/",
    );
    await expectNoA11yViolations(container);
  });

  it("states a fall as a fall, with a minus sign", () => {
    render(<BitcoinChanges markets={markets([coin({ change_past_year: "-20.00" })])} />);
    expect(screen.getByRole("row", { name: /Past year.*-20\.00%/ })).toBeInTheDocument();
  });

  it("can leave out the credit where the page already shows it", () => {
    render(<BitcoinChanges markets={markets()} credit={false} />);
    expect(screen.queryByRole("link", { name: "CoinMarketCap.com" })).not.toBeInTheDocument();
  });

  it("shows nothing, never invented numbers, without the figures", () => {
    expect(render(<BitcoinChanges markets={null} />).container).toBeEmptyDOMElement();
    expect(
      render(<BitcoinChanges markets={markets([coin({ symbol: "ETH" })])} />).container,
    ).toBeEmptyDOMElement();
    const none = coin({
      change_24h: null,
      change_7d: null,
      change_30d: null,
      change_90d: null,
      change_year_to_date: null,
      change_past_year: null,
    });
    expect(render(<BitcoinChanges markets={markets([none])} />).container).toBeEmptyDOMElement();
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
