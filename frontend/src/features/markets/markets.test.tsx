import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import type { MarketFigures, MarketOverview, MarketRow } from "./types";

const GET = vi.fn();
vi.mock("@/lib/api/client", () => ({ privateApi: { GET: (...args: unknown[]) => GET(...args) } }));

const { getMarketOverview, MarketsOverview } = await import("./index");
const { asOfLabel, largestMove, rankByYearToDate } = await import("./markets");

const figures = (ytd: string | null, overrides: Partial<MarketFigures> = {}): MarketFigures => ({
  as_of_year: 2026,
  as_of_month: 10,
  last_month: "1.20",
  year_to_date: ytd,
  trailing_12_months: "12.30",
  annualized: "10.10",
  since_year: 1993,
  ...overrides,
});

const row = (
  symbol: string,
  name: string,
  group: "index" | "sector",
  withFigures: MarketFigures | null,
): MarketRow => ({ symbol, name, group, figures: withFigures });

const rows: MarketRow[] = [
  row("SPY", "S&P 500", "index", figures("15.00")),
  row("XLK", "Technology", "sector", figures("25.00")),
  row("XLE", "Energy", "sector", figures("-8.50")),
  row("XLU", "Utilities", "sector", figures("3.00")),
  row("XLC", "Communication Services", "sector", null),
];

const overview = (overrides: Partial<MarketOverview> = {}): MarketOverview => ({
  source: "Twelve Data",
  basis: "Month-to-month change in the closing price, split-adjusted, dividends not included.",
  rows,
  ...overrides,
});

beforeEach(() => {
  GET.mockReset(); // braces: a returned function would be run by vitest as a cleanup hook
});

describe("helpers", () => {
  it("ranks best first and puts rows without a figure last", () => {
    expect(rankByYearToDate(rows.slice(1)).map((r) => r.symbol)).toEqual([
      "XLK",
      "XLU",
      "XLE",
      "XLC",
    ]);
  });

  it("does not change the list it was given", () => {
    const before = rows.map((r) => r.symbol);
    rankByYearToDate(rows);
    expect(rows.map((r) => r.symbol)).toEqual(before);
  });

  it("scales bars by the largest move, in either direction", () => {
    expect(largestMove(rows)).toBe(25);
    expect(largestMove([row("A", "A", "sector", figures("-40.00"))])).toBe(40);
    expect(largestMove([])).toBe(0);
  });

  it("labels the month the figures run to", () => {
    expect(asOfLabel(rows[0]!)).toBe("Oct 2026");
    expect(asOfLabel(rows[4]!)).toBeNull();
  });
});

describe("getMarketOverview", () => {
  it("returns the data", async () => {
    GET.mockResolvedValue({ data: overview() });
    expect((await getMarketOverview())?.rows).toHaveLength(5);
  });

  it("is null when the request fails or throws, never an error", async () => {
    GET.mockResolvedValue({ data: undefined, error: {} });
    expect(await getMarketOverview()).toBeNull();
    GET.mockRejectedValue(new Error("down"));
    expect(await getMarketOverview()).toBeNull();
  });
});

describe("MarketsOverview", () => {
  async function renderPage(data: MarketOverview | null) {
    GET.mockResolvedValue({ data: data ?? undefined });
    return render(await MarketsOverview());
  }

  it("shows the indices and the sectors with signed figures", async () => {
    await renderPage(overview());
    expect(screen.getByRole("heading", { name: "Major indices" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sectors" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Major indices" });
    expect(within(table).getByText("S&P 500")).toBeInTheDocument();
    expect(within(table).getByText("+15.00%")).toBeInTheDocument();
    expect(within(table).getByText("since 1993")).toBeInTheDocument();
  });

  it("lists the sectors best to worst with a loss shown as a negative number", async () => {
    await renderPage(overview());
    const list = screen.getByRole("list", { name: /Sectors by year to date, best first/ });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining("Technology"),
      expect.stringContaining("Utilities"),
      expect.stringContaining("Energy"),
    ]);
    expect(items[2]).toHaveTextContent("-8.50%");
  });

  it("states what the figures are: month-end, ETF proxies, no dividends", async () => {
    await renderPage(overview());
    expect(screen.getByText(/dividends not included/)).toBeInTheDocument();
    expect(screen.getByText(/trail the market by up to a month/)).toBeInTheDocument();
    expect(screen.getByText(/latest Oct 2026/)).toBeInTheDocument();
    expect(screen.getByText(/not the index itself/)).toBeInTheDocument();
  });

  it("says plainly when some history has not loaded yet, and shows what it has", async () => {
    await renderPage(overview());
    expect(screen.getByText(/1 of 5 funds have no figures yet/)).toBeInTheDocument();
    expect(screen.getAllByText("Not loaded yet").length).toBeGreaterThan(0);
  });

  it("labels sample data as sample data", async () => {
    await renderPage(overview({ source: "sample", rows: rows.slice(0, 4) }));
    expect(screen.getByText("Sample data")).toBeInTheDocument();
    expect(screen.queryByText(/have no figures yet/)).not.toBeInTheDocument();
  });

  it("shows a plain message, not an error screen, when the API is down", async () => {
    await renderPage(null);
    expect(screen.getByText("Market figures are not available right now")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderPage(overview());
    await expectNoA11yViolations(container);
  });
});
