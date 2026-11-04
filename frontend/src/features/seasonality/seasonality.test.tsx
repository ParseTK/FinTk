import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import type { Seasonality } from "./types";

const GET = vi.fn();
vi.mock("@/lib/api/client", () => ({ publicApi: { GET: (...args: unknown[]) => GET(...args) } }));

const { getSeasonality, SeasonalityGrid, SeasonalitySection } = await import("./index");
const { tintFor } = await import("./SeasonalityGrid");

const months = (...values: (string | null)[]): (string | null)[] =>
  Array.from({ length: 12 }, (_, i) => values[i] ?? null);

function data(overrides: Partial<Seasonality> = {}): Seasonality {
  return {
    symbol: "AAPL",
    source: "Example Prices",
    basis: "Month-to-month change in the closing price, split-adjusted, dividends not included.",
    start: { year: 1970, month: 7 },
    end: { year: 1971, month: 12 },
    years: [
      { year: 1970, returns: months(null, null, null, null, null, null, null, "-3.84", "1.50") },
      { year: 1971, returns: months("2.00", "0.00", null, null, null, null, null, "5.76") },
    ],
    months: [
      {
        month: 8,
        count: 2,
        average: "0.96",
        median: "0.96",
        positive: 1,
        win_rate: "50.00",
        best: { year: 1971, percent: "5.76" },
        worst: { year: 1970, percent: "-3.84" },
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  GET.mockReset(); // braces: a returned function would be run by vitest as a cleanup hook
});

describe("SeasonalityGrid", () => {
  it("shows each return with its sign and a dash where there is none", () => {
    render(<SeasonalityGrid data={data()} />);
    const row = screen.getByRole("row", { name: /1970/ });
    expect(within(row).getByText("-3.84%")).toBeInTheDocument();
    expect(within(row).getByText("+1.50%")).toBeInTheDocument();
    expect(within(row).getAllByText("—").length).toBeGreaterThan(5);
  });

  it("lists the newest year first and puts the monthly statistics above the years", () => {
    render(<SeasonalityGrid data={data()} />);
    const names = screen.getAllByRole("rowheader").map((cell) => cell.textContent);
    expect(names).toEqual(["Average", "Median", "Years up", "1971", "1970"]);
  });

  it("gives every month column its full name to assistive technology", () => {
    render(<SeasonalityGrid data={data()} />);
    expect(screen.getByRole("columnheader", { name: "August" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Year" })).toBeInTheDocument();
  });

  it("shows the average, median and share of years up for a month", () => {
    render(<SeasonalityGrid data={data()} />);
    const average = screen.getByRole("row", { name: /Average/ });
    expect(within(average).getAllByText("+0.96%")).toHaveLength(1);
    expect(within(screen.getByRole("row", { name: /Years up/ })).getByText("50%")).toBeVisible();
  });

  it("is a labelled, keyboard-focusable scroll region", () => {
    render(<SeasonalityGrid data={data()} />);
    const region = screen.getByRole("region", { name: /Monthly returns for AAPL/ });
    expect(region).toHaveAttribute("tabindex", "0");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<SeasonalityGrid data={data()} />);
    await expectNoA11yViolations(container);
  });
});

describe("tintFor", () => {
  it("tints gains and losses with their theme tokens and leaves zero and missing alone", () => {
    expect(tintFor("5")?.backgroundColor).toContain("var(--gain)");
    expect(tintFor("-5")?.backgroundColor).toContain("var(--loss)");
    expect(tintFor("0.00")).toBeUndefined();
    expect(tintFor(null)).toBeUndefined();
    expect(tintFor("not a number")).toBeUndefined();
  });

  it("grows with the size of the move but never past the cap", () => {
    const strength = (value: string) =>
      Number(/(\d+(\.\d+)?)%/.exec(tintFor(value)?.backgroundColor ?? "")?.[1]);
    expect(strength("2")).toBeLessThan(strength("6"));
    expect(strength("10")).toBe(strength("80"));
    expect(strength("80")).toBeLessThanOrEqual(30);
  });
});

describe("getSeasonality", () => {
  it("returns the data", async () => {
    GET.mockResolvedValue({ data: data() });
    expect((await getSeasonality("AAPL"))?.symbol).toBe("AAPL");
  });

  it("never calls the API for a malformed ticker", async () => {
    expect(await getSeasonality("../etc")).toBeNull();
    expect(GET).not.toHaveBeenCalled();
  });

  it("is null, not a crash, when the API fails or answers with an error", async () => {
    GET.mockRejectedValueOnce(new Error("down"));
    expect(await getSeasonality("AAPL")).toBeNull();
    GET.mockResolvedValueOnce({ data: undefined, error: { error: {} } });
    expect(await getSeasonality("AAPL")).toBeNull();
  });
});

describe("SeasonalitySection", () => {
  async function renderSection(symbol = "AAPL") {
    return render(await SeasonalitySection({ symbol }));
  }

  it("names where the data starts and what the numbers mean", async () => {
    GET.mockResolvedValue({ data: data() });
    await renderSection();
    expect(screen.getByRole("heading", { name: "Seasonality" })).toBeInTheDocument();
    expect(screen.getByText(/Price data starts Jul 1970/)).toBeInTheDocument();
    expect(screen.getByText(/dividends not included/)).toBeInTheDocument();
    expect(screen.getByText(/Source: Example Prices/)).toBeInTheDocument();
    expect(screen.queryByText("Sample data")).not.toBeInTheDocument();
  });

  it("says plainly when the numbers are generated sample data", async () => {
    GET.mockResolvedValue({ data: data({ source: "sample" }) });
    await renderSection();
    expect(screen.getByText("Sample data")).toBeInTheDocument();
    expect(screen.getByText(/not this company.s real price history/)).toBeInTheDocument();
  });

  it("explains an unavailable price service without breaking the page", async () => {
    GET.mockRejectedValue(new Error("down"));
    await renderSection();
    expect(screen.getByText(/not available right now/)).toBeInTheDocument();
  });

  it("explains a company with no price history", async () => {
    GET.mockResolvedValue({ data: data({ years: [], months: [], start: null, end: null }) });
    await renderSection();
    expect(screen.getByText(/No price history is available/)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    GET.mockResolvedValue({ data: data({ source: "sample" }) });
    const { container } = await renderSection();
    await expectNoA11yViolations(container);
  });
});
