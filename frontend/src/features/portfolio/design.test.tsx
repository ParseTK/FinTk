import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { computeAllocation } from "./allocation";
import type { Holding, Lot, Portfolio } from "./types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/apiRequest", () => ({ sendJson: vi.fn() }));

const { GainChip } = await import("./GainChip");
const { AllocationBar } = await import("./AllocationBar");
const { PortfolioOverview } = await import("./PortfolioOverview");
const { ExpandableHoldingsTable } = await import("./ExpandableHoldingsTable");

const valuation = (value: string, gain: string, percent: string) => ({
  price: "10.000000",
  as_of: "2026-10-31",
  market_value: value,
  gain,
  gain_percent: percent,
});

const holding = (
  symbol: string,
  cost: string,
  v: ReturnType<typeof valuation> | null,
): Holding => ({
  symbol,
  name: `${symbol} Inc.`,
  shares: "10.000000",
  average_cost: "10.000000",
  cost_basis: cost,
  lots: 1,
  valuation: v,
});

const portfolio = (overrides: Partial<Portfolio> = {}): Portfolio => ({
  holdings: [
    holding("AAPL", "1000.00", valuation("3000.00", "2000.00", "200.00")),
    holding("KO", "500.00", valuation("1000.00", "500.00", "100.00")),
  ],
  total_cost_basis: "1500.00",
  valuation: {
    market_value: "4000.00",
    gain: "2500.00",
    gain_percent: "166.67",
    holdings_valued: 2,
    as_of: "2026-10-31",
    source: "Twelve Data",
  },
  currency: "USD",
  ...overrides,
});

const lot = (id: string, symbol: string): Lot => ({
  id,
  symbol,
  shares: "10.000000",
  unit_cost: "100.000000",
  cost: "1000.00",
  acquired_on: "2024-03-15",
  created_at: "2026-05-01T10:00:00Z",
  updated_at: "2026-05-01T10:00:00Z",
});

describe("GainChip", () => {
  it("tints a gain and a loss with their own colors, with one arrow and the percentage in parentheses", () => {
    const { container, rerender } = render(<GainChip gain="12.30" percent="4.50" />);
    const chip = container.firstElementChild as HTMLElement;
    expect(chip.style.backgroundColor).toContain("var(--gain)");
    expect(chip.textContent).toBe("▲+$12.30(+4.50%)");
    rerender(<GainChip gain="-8.00" percent="-2.00" />);
    const loss = container.firstElementChild as HTMLElement;
    expect(loss.style.backgroundColor).toContain("var(--loss)");
    expect(loss.textContent).toBe("▼-$8.00(-2.00%)");
  });

  it("has no tint and no arrow for a flat result", () => {
    const { container } = render(<GainChip gain="0.00" percent="0.00" />);
    expect((container.firstElementChild as HTMLElement).style.backgroundColor).toBe("");
    expect(container.textContent).not.toMatch(/[▲▼]/);
  });
});

describe("AllocationBar", () => {
  const allocation = computeAllocation(portfolio().holdings)!;

  it("draws one proportional segment per slice, hidden from assistive technology", () => {
    const { container } = render(<AllocationBar allocation={allocation} />);
    const bar = container.querySelector("[aria-hidden='true'].flex") as HTMLElement;
    const segments = [...bar.children] as HTMLElement[];
    expect(segments).toHaveLength(2);
    expect(segments[0]!.style.flex).toContain("0.75");
    expect(segments[0]!.style.background).toContain("var(--chart-1)");
    expect(segments[1]!.style.background).toContain("var(--chart-2)");
  });

  it("carries the same information as text, largest first, with a swatch per row", () => {
    render(<AllocationBar allocation={allocation} />);
    expect(
      screen.getByRole("heading", { name: "Allocation by current value" }),
    ).toBeInTheDocument();
    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("AAPL");
    expect(rows[0]).toHaveTextContent("75.0%");
    expect(rows[0]).toHaveTextContent("$3,000.00");
    expect(rows[1]).toHaveTextContent("25.0%");
  });

  it("links companies but not the grouped Other", () => {
    const many = Array.from({ length: 8 }, (_, i) => holding(`S${i}`, `${100 - i}.00`, null));
    render(<AllocationBar allocation={computeAllocation(many)!} />);
    expect(screen.getByRole("link", { name: "S0" })).toHaveAttribute("href", "/company/S0");
    expect(screen.getByText("Other (3)")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Other/ })).not.toBeInTheDocument();
  });

  it("grows in with an animation the Motion setting controls", () => {
    const { container } = render(<AllocationBar allocation={allocation} />);
    expect(container.querySelector("[aria-hidden='true'].flex")).toHaveClass(
      "motion-safe:animate-grow-x",
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<AllocationBar allocation={allocation} />);
    await expectNoA11yViolations(container);
  });
});

describe("PortfolioOverview", () => {
  it("leads with the value, the gain beside it, and what was paid", async () => {
    const { container } = render(<PortfolioOverview portfolio={portfolio()} showValue />);
    expect(screen.getByText("Portfolio value").nextElementSibling).toHaveTextContent("$4,000.00");
    expect(screen.getByText(/\+\$2,500\.00/)).toBeInTheDocument();
    expect(screen.getByText("Paid").nextElementSibling).toHaveTextContent("$1,500.00");
    expect(screen.getByText("Companies").nextElementSibling).toHaveTextContent("2");
    expect(screen.getByText(/Twelve Data, the latest being Oct 2026/)).toBeInTheDocument();
    expect(screen.getByText(/do not include dividends/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("uses a proportional figure for the big number, not tabular digits", () => {
    render(<PortfolioOverview portfolio={portfolio()} showValue />);
    expect(screen.getByText("$4,000.00")).not.toHaveClass("tabular-nums");
  });

  it("lights the card in the gain or loss color", () => {
    const { container, rerender } = render(<PortfolioOverview portfolio={portfolio()} showValue />);
    const glow = () => (container.querySelector("section > div[aria-hidden]") as HTMLElement).style;
    expect(glow().backgroundImage).toContain("var(--gain)");
    rerender(
      <PortfolioOverview
        portfolio={portfolio({
          valuation: { ...portfolio().valuation!, gain: "-50.00", gain_percent: "-3.00" },
        })}
        showValue
      />,
    );
    expect(glow().backgroundImage).toContain("var(--loss)");
  });

  it("leads with what was paid, and says so, when there are no prices", () => {
    render(<PortfolioOverview portfolio={portfolio({ valuation: null })} showValue />);
    expect(screen.getByText("Total paid").nextElementSibling).toHaveTextContent("$1,500.00");
    expect(
      screen.getByText(/Values will appear here once prices are available/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Portfolio value")).not.toBeInTheDocument();
  });

  it("shows paid figures when values are switched off, even if the API sent them", () => {
    render(<PortfolioOverview portfolio={portfolio()} showValue={false} />);
    expect(screen.getByText("Total paid")).toBeInTheDocument();
    expect(screen.queryByText("$4,000.00")).not.toBeInTheDocument();
  });

  it("says how many holdings the value covers when some have no price", () => {
    const partial = portfolio();
    partial.valuation!.holdings_valued = 1;
    render(<PortfolioOverview portfolio={partial} showValue />);
    expect(screen.getByText(/cover 1 of your 2 holdings/)).toBeInTheDocument();
  });

  it("shows no allocation for a single company", () => {
    const one = portfolio({ holdings: [portfolio().holdings[0]!] });
    render(<PortfolioOverview portfolio={one} showValue />);
    expect(screen.queryByRole("heading", { name: /^Allocation by/ })).not.toBeInTheDocument();
  });
});

describe("ExpandableHoldingsTable", () => {
  const lots = [
    lot("11111111-1111-4111-8111-111111111111", "AAPL"),
    lot("22222222-2222-4222-8222-222222222222", "KO"),
  ];
  const renderTable = (showValue = true) =>
    render(
      <ExpandableHoldingsTable
        portfolio={portfolio()}
        lots={lots}
        csrfToken="c"
        showValue={showValue}
        colors={{ AAPL: "var(--chart-1)", KO: "var(--chart-2)" }}
      />,
    );
  const rowButton = (symbol: string) =>
    screen.getByRole("button", { name: new RegExp(`^${symbol}`) });

  it("shows price, value and a gain chip per company, with its color dot", () => {
    renderTable();
    const row = rowButton("AAPL").closest("tr")!; // the company's own row, not its hidden detail row
    expect(within(row).getByText("$3,000.00")).toBeInTheDocument();
    expect(within(row).getByText(/\+\$2,000\.00/)).toBeInTheDocument();
    const dot = row.querySelector("[aria-hidden='true'].rounded-full") as HTMLElement;
    expect(dot.style.background).toContain("var(--chart-1)");
    expect(screen.getByRole("columnheader", { name: "Gain or loss" })).toBeInTheDocument();
  });

  it("drops the value columns when values are off", () => {
    renderTable(false);
    expect(screen.queryByRole("columnheader", { name: "Value" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Paid" })).toBeInTheDocument();
  });

  it("starts with every row closed and their records out of reach", () => {
    renderTable();
    expect(rowButton("AAPL")).toHaveAttribute("aria-expanded", "false");
    const detail = document.getElementById(rowButton("AAPL").getAttribute("aria-controls")!)!;
    expect(detail).toHaveAttribute("inert");
  });

  it("opens to that company's own records, with a link to its page", async () => {
    renderTable();
    await userEvent.click(rowButton("AAPL"));
    expect(rowButton("AAPL")).toHaveAttribute("aria-expanded", "true");
    const detail = document.getElementById(rowButton("AAPL").getAttribute("aria-controls")!)!;
    expect(within(detail).getByRole("heading", { name: "Record" })).toBeInTheDocument();
    expect(within(detail).getAllByRole("listitem")).toHaveLength(1);
    expect(within(detail).getByRole("link", { name: "View AAPL company page" })).toHaveAttribute(
      "href",
      "/company/AAPL",
    );
    expect(rowButton("KO")).toHaveAttribute("aria-expanded", "false");
  });

  it("also opens when the row itself is clicked, but a click on a button inside does not toggle twice", async () => {
    renderTable();
    await userEvent.click(rowButton("KO").closest("tr")!.querySelector("td")!);
    expect(rowButton("KO")).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(rowButton("KO")); // the button toggles once, not twice (row + button)
    expect(rowButton("KO")).toHaveAttribute("aria-expanded", "false");
  });

  it("works from the keyboard", async () => {
    renderTable();
    rowButton("AAPL").focus();
    await userEvent.keyboard("{Enter}");
    expect(rowButton("AAPL")).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard(" ");
    expect(rowButton("AAPL")).toHaveAttribute("aria-expanded", "false");
  });

  it("has no accessibility violations, closed or open", async () => {
    const { container } = renderTable();
    await expectNoA11yViolations(container);
    await userEvent.click(rowButton("AAPL"));
    await expectNoA11yViolations(container);
  });
});
