import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { AllocationChart } from "./AllocationChart";
import type { Holding } from "./types";

const holding = (symbol: string, cost: string, value?: string): Holding => ({
  symbol,
  name: null,
  shares: "1.000000",
  average_cost: cost,
  cost_basis: cost,
  lots: 1,
  valuation: value
    ? { price: value, as_of: "2026-10-31", market_value: value, gain: "0.00", gain_percent: "0.00" }
    : null,
});

const priced = [holding("AAPL", "100.00", "750.00"), holding("KO", "100.00", "250.00")];

describe("AllocationChart", () => {
  it("lists every slice with its company, share and amount, largest first", () => {
    render(<AllocationChart holdings={priced} />);
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("AAPL");
    expect(items[0]).toHaveTextContent("75.0%");
    expect(items[0]).toHaveTextContent("$750.00");
    expect(items[1]).toHaveTextContent("KO");
    expect(items[1]).toHaveTextContent("25.0%");
  });

  it("says what the split is by", () => {
    const { rerender } = render(<AllocationChart holdings={priced} />);
    expect(
      screen.getByRole("heading", { name: "Allocation by current value" }),
    ).toBeInTheDocument();
    rerender(<AllocationChart holdings={[holding("AAPL", "100.00"), holding("KO", "300.00")]} />);
    expect(screen.getByRole("heading", { name: "Allocation by amount paid" })).toBeInTheDocument();
  });

  it("links companies to their pages but not the grouped Other", () => {
    const many = Array.from({ length: 8 }, (_, i) => holding(`S${i}`, `${100 - i}.00`));
    render(<AllocationChart holdings={many} />);
    expect(screen.getByRole("link", { name: "S0" })).toHaveAttribute("href", "/company/S0");
    expect(screen.getByText("Other (3)")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Other/ })).not.toBeInTheDocument();
  });

  it("hides the drawing from assistive technology and keeps the information in the list", () => {
    const { container } = render(<AllocationChart holdings={priced} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("svg path")).toHaveLength(2);
  });

  it("draws slices with the shared draw animation, which the Motion setting controls", () => {
    const { container } = render(<AllocationChart holdings={priced} />);
    for (const path of container.querySelectorAll("svg path")) {
      expect(path).toHaveClass("motion-safe:animate-draw");
    }
  });

  it("shows nothing for a single holding or an empty portfolio", () => {
    const { container, rerender } = render(<AllocationChart holdings={[priced[0]!]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AllocationChart holdings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("draws a full ring when only one holding has any weight", () => {
    const { container } = render(
      <AllocationChart holdings={[holding("A", "0.00"), holding("B", "5.00")]} />,
    );
    expect(container.querySelector("svg circle")).not.toBeNull();
    expect(container.querySelector("svg path")).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<AllocationChart holdings={priced} />);
    await expectNoA11yViolations(container);
  });
});
