import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { PAGE_SIZE } from "./holdingsView";
import type { Holding, Portfolio } from "./types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/apiRequest", () => ({ sendJson: vi.fn() }));

const { HoldingsExplorer } = await import("./HoldingsExplorer");

const holding = (index: number): Holding => ({
  symbol: `T${String(index).padStart(3, "0")}`,
  name: index === 7 ? "Coca Cola Company" : `Company number ${index}`,
  shares: "1.000000",
  average_cost: "10.000000",
  cost_basis: "10.00",
  lots: 1,
  // Bigger index, bigger value, so the default order (largest first) is the reverse of the ticker order.
  valuation: {
    price: "1.00",
    as_of: "2026-10-31",
    market_value: `${100 + index}.00`,
    gain: "1.00",
    gain_percent: "1.00",
  },
});

const portfolioOf = (count: number): Portfolio => ({
  holdings: Array.from({ length: count }, (_, i) => holding(i + 1)),
  total_cost_basis: "0.00",
  valuation: null,
  currency: "USD",
});

const renderExplorer = (count: number, showValue = true) =>
  render(
    <HoldingsExplorer
      portfolio={portfolioOf(count)}
      lots={[]}
      csrfToken="c"
      showValue={showValue}
      colors={{}}
    />,
  );

const shownSymbols = () =>
  screen.getAllByRole("article").map((card) => /T\d{3}/.exec(card.textContent ?? "")![0]);
const search = () => screen.getByRole("searchbox", { name: /Search your holdings/ });
const status = () => screen.getByRole("status");

describe("a small portfolio", () => {
  it("has no toolbar and shows everything", () => {
    renderExplorer(5);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Sort by")).not.toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /Show \d+ more/ })).not.toBeInTheDocument();
  });
});

// Each test renders dozens of holdings in both layouts, so give a busy machine room.
describe("a large portfolio", { timeout: 30_000 }, () => {
  it("shows one page, largest value first, and says how many there are", () => {
    renderExplorer(120);
    expect(screen.getAllByRole("article")).toHaveLength(PAGE_SIZE);
    expect(shownSymbols()[0]).toBe("T120"); // the largest value
    expect(status()).toHaveTextContent(`Showing ${PAGE_SIZE} of 120 holdings.`);
  });

  it("adds a page at a time with Show more, and stops when there is no more", async () => {
    renderExplorer(60);
    await userEvent.click(screen.getByRole("button", { name: `Show ${PAGE_SIZE} more` }));
    expect(screen.getAllByRole("article")).toHaveLength(PAGE_SIZE * 2);
    expect(status()).toHaveTextContent(`Showing ${PAGE_SIZE * 2} of 60 holdings.`);
    await userEvent.click(screen.getByRole("button", { name: "Show 10 more" }));
    expect(screen.getAllByRole("article")).toHaveLength(60);
    expect(screen.queryByRole("button", { name: /Show \d+ more/ })).not.toBeInTheDocument();
    expect(status()).toHaveTextContent("60 holdings.");
  });

  it("finds a holding by name or by ticker, case-insensitively, and says how many matched", async () => {
    renderExplorer(120);
    await userEvent.type(search(), "coca");
    expect(shownSymbols()).toEqual(["T007"]);
    expect(status()).toHaveTextContent('1 of 120 holdings match "coca".');

    await userEvent.clear(search());
    await userEvent.type(search(), "t05");
    expect(screen.getAllByRole("article")).toHaveLength(10); // T050 to T059
    expect(status()).toHaveTextContent('10 of 120 holdings match "t05".');
  });

  it("starts from the first page again when the search changes", async () => {
    renderExplorer(120);
    await userEvent.click(screen.getByRole("button", { name: `Show ${PAGE_SIZE} more` }));
    expect(screen.getAllByRole("article")).toHaveLength(PAGE_SIZE * 2);
    await userEvent.type(search(), "company");
    expect(screen.getAllByRole("article")).toHaveLength(PAGE_SIZE);
  });

  it("says plainly when nothing matches, and Clear search brings everything back", async () => {
    renderExplorer(120);
    await userEvent.type(search(), "zzzzzz");
    expect(screen.getByText("Nothing matches that search.")).toBeInTheDocument();
    expect(status()).toHaveTextContent('No holdings match "zzzzzz".');
    expect(screen.queryAllByRole("article")).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(search()).toHaveValue("");
    expect(screen.getAllByRole("article")).toHaveLength(PAGE_SIZE);
  });

  it("re-orders when the sort changes, and offers only orders that make sense", async () => {
    renderExplorer(120);
    const sort = screen.getByLabelText("Sort by");
    await userEvent.selectOptions(sort, "symbol");
    expect(shownSymbols()[0]).toBe("T001");
    await userEvent.selectOptions(sort, "value");
    expect(shownSymbols()[0]).toBe("T120");
    expect(within(sort).getAllByRole("option").length).toBeGreaterThan(2);
  });

  it("offers only what was paid and the ticker when there are no prices", () => {
    renderExplorer(20, false);
    const options = within(screen.getByLabelText("Sort by")).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Most paid", "Ticker A to Z"]);
  });

  it("has no accessibility violations", async () => {
    const { container } = renderExplorer(40);
    await expectNoA11yViolations(container);
    await userEvent.type(search(), "company");
    await expectNoA11yViolations(container);
  });
});
