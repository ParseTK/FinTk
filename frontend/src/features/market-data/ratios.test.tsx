import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import type { Financials, RatioSeries } from "./types";

vi.mock("server-only", () => ({}));

const { RatiosSection, RatiosTable } = await import("./index");

const ratio = (overrides: Partial<RatioSeries> = {}): RatioSeries => ({
  ratio: "gross_margin",
  label: "Gross margin",
  formula: "gross profit / revenue",
  unit: "percent",
  values: [
    { period_end: "2025-09-27", value: "46.91" },
    { period_end: "2024-09-28", value: "46.21" },
    { period_end: "2023-09-30", value: null },
  ],
  ...overrides,
});

const times = ratio({
  ratio: "liabilities_to_equity",
  label: "Liabilities to equity",
  formula: "total liabilities / shareholders' equity (all liabilities, not just debt)",
  unit: "times",
  values: [
    { period_end: "2025-09-27", value: "3.87" },
    { period_end: "2024-09-28", value: "5.41" },
    { period_end: "2023-09-30", value: "4.67" },
  ],
});

const financials = (ratios: RatioSeries[]): Financials => ({
  ticker: "AAPL",
  source: "SEC EDGAR",
  metrics: [],
  ratios,
});

afterEach(() => vi.unstubAllEnvs());

describe("RatiosTable", () => {
  it("shows a column per fiscal year, newest first, and a row per ratio", () => {
    render(<RatiosTable ratios={[ratio(), times]} />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers.slice(1)).toEqual(["Sep 2025", "Sep 2024", "Sep 2023"]);
    expect(screen.getByRole("rowheader", { name: "Gross margin" })).toBeInTheDocument();
  });

  it("writes percentages with one decimal and multiples as plain numbers labelled as times", () => {
    render(<RatiosTable ratios={[ratio(), times]} />);
    const margin = screen.getByRole("row", { name: /Gross margin/ });
    expect(margin).toHaveTextContent("46.9%");
    expect(margin).toHaveTextContent("46.2%");
    const leverage = screen.getByRole("row", { name: /Liabilities to equity/ });
    expect(screen.getByRole("rowheader", { name: "Liabilities to equity (times)" })).toBeVisible();
    expect(leverage).toHaveTextContent("3.87");
    expect(leverage).not.toHaveTextContent("%");
  });

  it("says Not available to a screen reader where a figure could not be worked out", () => {
    render(<RatiosTable ratios={[ratio()]} />);
    const cell = within(screen.getByRole("row", { name: /Gross margin/ })).getAllByRole("cell")[2]!;
    expect(cell).toHaveTextContent("Not available");
    expect(within(cell).getByText("—")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows a missing year as not available too", () => {
    const short = ratio({ values: [{ period_end: "2025-09-27", value: "10.00" }] });
    render(<RatiosTable ratios={[short, ratio()]} />);
    expect(screen.getAllByText("Not available").length).toBeGreaterThan(0);
  });

  it("shows negative figures with a minus sign and no colour", () => {
    const loss = ratio({ values: [{ period_end: "2025-09-27", value: "-12.34" }] });
    const { container } = render(<RatiosTable ratios={[loss]} />);
    expect(screen.getByRole("row", { name: /Gross margin/ })).toHaveTextContent("-12.3%");
    // A ratio is arithmetic, not a verdict: nothing is coloured as good or bad.
    expect(container.innerHTML).not.toMatch(/text-gain|text-loss/);
  });

  it("shows only the five newest fiscal years", () => {
    const six = ratio({
      values: [2026, 2025, 2024, 2023, 2022, 2021].map((year) => ({
        period_end: `${year}-09-30`,
        value: "1.00",
      })),
    });
    render(<RatiosTable ratios={[six]} />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers.slice(1)).toHaveLength(5);
    expect(headers).not.toContain("Sep 2021");
  });

  it("explains how each ratio is worked out, collapsed until asked", () => {
    render(<RatiosTable ratios={[ratio(), times]} />);
    const details = screen.getByText("How each ratio is worked out").closest("details")!;
    expect(details).not.toHaveAttribute("open");
    expect(within(details).getByText("gross profit / revenue")).toBeInTheDocument();
    expect(within(details).getByText(/not just debt/)).toBeInTheDocument();
  });

  it("renders nothing when there are no ratios", () => {
    const { container } = render(<RatiosTable ratios={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows text in a label as text", () => {
    render(<RatiosTable ratios={[ratio({ label: "<img src=x onerror=alert(1)>" })]} />);
    expect(document.querySelector("img")).toBeNull();
  });

  it("positions its scroll box, so hidden text in a far cell cannot widen the page on a phone", () => {
    const { container } = render(<RatiosTable ratios={[ratio(), times]} />);
    for (const box of container.querySelectorAll(".overflow-x-auto"))
      expect(box).toHaveClass("relative");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<RatiosTable ratios={[ratio(), times]} />);
    await expectNoA11yViolations(container);
  });
});

describe("RatiosSection", () => {
  it("is off by default: nothing is shown without the flag", () => {
    const { container } = render(<RatiosSection financials={financials([ratio()])} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a labelled Ratios card with the plain-language note when the flag is on", () => {
    vi.stubEnv("FEATURE_RATIOS", "true");
    render(<RatiosSection financials={financials([ratio()])} />);
    const card = screen.getByRole("region", { name: "Ratios" });
    expect(within(card).getByText(/not a rating, score or forecast/)).toBeInTheDocument();
    expect(within(card).getByRole("table")).toBeInTheDocument();
  });

  it("leaves the card out entirely when there are no ratios, so it is never empty", () => {
    vi.stubEnv("FEATURE_RATIOS", "true");
    const { container } = render(<RatiosSection financials={financials([])} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("leaves it out when the financials could not be loaded", () => {
    vi.stubEnv("FEATURE_RATIOS", "true");
    const { container } = render(<RatiosSection financials={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("has no accessibility violations", async () => {
    vi.stubEnv("FEATURE_RATIOS", "true");
    const { container } = render(<RatiosSection financials={financials([ratio(), times])} />);
    await expectNoA11yViolations(container);
  });
});
