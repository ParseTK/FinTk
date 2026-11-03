import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { HoldingsTable } from "./HoldingsTable";
import { PortfolioSummary } from "./PortfolioSummary";
import type { Portfolio } from "./types";

const valued = {
  price: "125.500000",
  as_of: "2026-10-31",
  market_value: "1882.50",
  gain: "232.50",
  gain_percent: "14.09",
};

function portfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    holdings: [
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        shares: "15.000000",
        average_cost: "110.000000",
        cost_basis: "1650.00",
        lots: 2,
        valuation: valued,
      },
      {
        symbol: "KO",
        name: null,
        shares: "10.000000",
        average_cost: "50.000000",
        cost_basis: "500.00",
        lots: 1,
        valuation: null,
      },
    ],
    total_cost_basis: "2150.00",
    valuation: {
      market_value: "1882.50",
      gain: "232.50",
      gain_percent: "14.09",
      holdings_valued: 1,
      as_of: "2026-10-31",
      source: "Twelve Data",
    },
    currency: "USD",
    ...overrides,
  };
}

describe("HoldingsTable with values", () => {
  it("adds price, value and gain columns when asked and a price exists", async () => {
    const { container } = render(<HoldingsTable portfolio={portfolio()} showValue />);

    expect(screen.getByRole("columnheader", { name: "Latest price" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Value" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Gain or loss" })).toBeInTheDocument();
    const apple = screen.getByRole("row", { name: /AAPL/ });
    expect(within(apple).getByText("$125.50")).toBeInTheDocument();
    expect(within(apple).getByText("$1,882.50")).toBeInTheDocument();
    expect(within(apple).getByText("+$232.50")).toBeInTheDocument();
    expect(within(apple).getByText("+14.09%")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("shows dashes, not a guess, for a holding that has no price", () => {
    render(<HoldingsTable portfolio={portfolio()} showValue />);
    const ko = screen.getByRole("row", { name: /KO/ });
    expect(within(ko).getAllByText("—")).toHaveLength(3);
  });

  it("shows a loss with a minus sign and an arrow, not only a color", () => {
    const loss = portfolio();
    loss.holdings[0]!.valuation = { ...valued, gain: "-120.00", gain_percent: "-6.00" };
    render(<HoldingsTable portfolio={loss} showValue />);
    const apple = screen.getByRole("row", { name: /AAPL/ });
    expect(within(apple).getByText("-$120.00")).toBeInTheDocument();
    expect(within(apple).getByText("-6.00%")).toBeInTheDocument();
    expect(within(apple).getAllByText("▼").length).toBeGreaterThan(0);
  });

  it("is unchanged when the flag is off, even if the API sent values", () => {
    render(<HoldingsTable portfolio={portfolio()} />);
    expect(screen.queryByRole("columnheader", { name: "Value" })).not.toBeInTheDocument();
    expect(screen.queryByText("$1,882.50")).not.toBeInTheDocument();
  });

  it("adds no columns when nothing has a price", () => {
    const none = portfolio();
    none.holdings.forEach((h) => (h.valuation = null));
    render(<HoldingsTable portfolio={none} showValue />);
    expect(screen.queryByRole("columnheader", { name: "Value" })).not.toBeInTheDocument();
  });
});

describe("PortfolioSummary", () => {
  it("states the value, the gain, what was paid and how recent the prices are", async () => {
    const { container } = render(<PortfolioSummary portfolio={portfolio()} />);

    expect(screen.getByText("Value").nextElementSibling).toHaveTextContent("$1,882.50");
    expect(screen.getByText("Gain or loss").nextElementSibling).toHaveTextContent("+$232.50");
    expect(screen.getByText("Paid").nextElementSibling).toHaveTextContent("$2,150.00");
    expect(screen.getByText(/Twelve Data/)).toBeInTheDocument();
    expect(screen.getByText(/Oct 2026/)).toBeInTheDocument();
    expect(screen.getByText(/do not include dividends/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("says which holdings are covered when some have no price", () => {
    render(<PortfolioSummary portfolio={portfolio()} />);
    expect(screen.getByText(/cover 1 of your 2 holdings/)).toBeInTheDocument();
  });

  it("does not mention coverage when every holding has a price", () => {
    const all = portfolio();
    all.holdings[1]!.valuation = valued;
    all.valuation!.holdings_valued = 2;
    render(<PortfolioSummary portfolio={all} />);
    expect(screen.queryByText(/cover 2 of/)).not.toBeInTheDocument();
    expect(screen.queryByText(/no price yet/)).not.toBeInTheDocument();
  });

  it("renders nothing without a valuation", () => {
    const { container } = render(<PortfolioSummary portfolio={portfolio({ valuation: null })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
