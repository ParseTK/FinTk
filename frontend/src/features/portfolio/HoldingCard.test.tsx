import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import type { Holding, Lot } from "./types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/apiRequest", () => ({ sendJson: vi.fn() }));

const { HoldingCard } = await import("./HoldingCard");
const { HoldingsCards } = await import("./HoldingsCards");

const valuation = {
  price: "94.080002",
  as_of: "2026-10-31",
  market_value: "940.80",
  gain: "-59.20",
  gain_percent: "-5.92",
};

const holding = (overrides: Partial<Holding> = {}): Holding => ({
  symbol: "KO",
  name: "COCA COLA CO",
  shares: "10.000000",
  average_cost: "100.000000",
  cost_basis: "1000.00",
  lots: 2,
  valuation,
  ...overrides,
});

const lot = (id: string, symbol = "KO", shares = "4.000000"): Lot => ({
  id,
  symbol,
  shares,
  unit_cost: "100.000000",
  cost: "400.00",
  acquired_on: "2024-03-15",
  created_at: "2026-05-01T10:00:00Z",
  updated_at: "2026-05-01T10:00:00Z",
});

const lots = [
  lot("11111111-1111-4111-8111-111111111111"),
  lot("22222222-2222-4222-8222-222222222222", "KO", "6.000000"),
];

// The card's own header button (its purchases have buttons of their own, named after the symbol).
const header = () => within(screen.getByRole("heading", { level: 3 })).getByRole("button");
const renderCard = (props: { holding?: Holding; showValue?: boolean } = {}) =>
  render(
    <HoldingCard
      holding={props.holding ?? holding()}
      lots={lots}
      csrfToken="c"
      showValue={props.showValue ?? true}
    />,
  );

beforeEach(() => vi.clearAllMocks());

describe("HoldingCard", () => {
  it("is collapsed by default and shows what it is worth and the gain in the header", () => {
    renderCard();
    expect(header()).toHaveAttribute("aria-expanded", "false");
    expect(header()).toHaveTextContent("COCA COLA CO");
    expect(header()).toHaveTextContent("$940.80");
    expect(header()).toHaveTextContent("-$59.20");
    expect(header()).toHaveTextContent("(-5.92%)");
    expect(document.getElementById(header().getAttribute("aria-controls")!)).toHaveAttribute(
      "inert",
    );
  });

  it("shows one arrow for the gain, not one per figure", () => {
    renderCard();
    expect(header().textContent?.match(/[▲▼]/g)).toHaveLength(1);
  });

  it("opens to the figures behind it and its own purchases", async () => {
    renderCard();
    await userEvent.click(header());

    expect(header()).toHaveAttribute("aria-expanded", "true");
    const body = document.getElementById(header().getAttribute("aria-controls")!)!;
    expect(body).not.toHaveAttribute("inert");
    expect(within(body).getByText("Shares").nextElementSibling).toHaveTextContent("10");
    expect(within(body).getByText("Average cost").nextElementSibling).toHaveTextContent("$100.00");
    expect(within(body).getByText("Total paid").nextElementSibling).toHaveTextContent("$1,000.00");
    expect(within(body).getByText("Latest price").nextElementSibling).toHaveTextContent("$94.08");
    expect(within(body).getByRole("heading", { name: "Purchases (2)" })).toBeInTheDocument();
    expect(within(body).getAllByRole("listitem")).toHaveLength(2);
    expect(within(body).getByRole("link", { name: "View KO company page" })).toHaveAttribute(
      "href",
      "/company/KO",
    );
  });

  it("closes again", async () => {
    renderCard();
    await userEvent.click(header());
    await userEvent.click(header());
    expect(header()).toHaveAttribute("aria-expanded", "false");
  });

  it("can be operated from the keyboard", async () => {
    renderCard();
    header().focus();
    await userEvent.keyboard("{Enter}");
    expect(header()).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard(" ");
    expect(header()).toHaveAttribute("aria-expanded", "false");
  });

  it("shows what was paid when there is no price", () => {
    renderCard({ holding: holding({ valuation: null }) });
    expect(header()).toHaveTextContent("$1,000.00");
    expect(header()).toHaveTextContent("paid");
    expect(header().textContent).not.toMatch(/[▲▼]/);
  });

  it("shows what was paid when values are switched off, even if the API sent them", () => {
    renderCard({ showValue: false });
    expect(header()).toHaveTextContent("paid");
    expect(header()).not.toHaveTextContent("$940.80");
  });

  it("says plainly that a single purchase is one purchase", async () => {
    render(
      <HoldingCard holding={holding({ lots: 1 })} lots={[lots[0]!]} csrfToken="c" showValue />,
    );
    await userEvent.click(header());
    expect(screen.getByRole("heading", { name: "Purchase" })).toBeInTheDocument();
  });

  it("has no accessibility violations, closed or open", async () => {
    const { container } = renderCard();
    await expectNoA11yViolations(container);
    await userEvent.click(header());
    await expectNoA11yViolations(container);
  });
});

describe("HoldingsCards", () => {
  const portfolio = {
    holdings: [holding(), holding({ symbol: "AAPL", name: "Apple Inc.", valuation: null })],
    total_cost_basis: "2000.00",
    valuation: null,
    currency: "USD",
  };
  const all = [...lots, lot("33333333-3333-4333-8333-333333333333", "AAPL", "1.000000")];

  it("lists a collapsed card per holding and gives each only its own purchases", async () => {
    render(<HoldingsCards portfolio={portfolio} lots={all} csrfToken="c" showValue />);
    const list = screen.getByRole("list", { name: "Your holdings" });
    expect(within(list).getAllByRole("article")).toHaveLength(2);

    const apple = within(screen.getByRole("heading", { level: 3, name: /AAPL/ })).getByRole(
      "button",
    );
    await userEvent.click(apple);
    const body = document.getElementById(apple.getAttribute("aria-controls")!)!;
    expect(within(body).getByRole("heading", { name: "Purchase" })).toBeInTheDocument();
    expect(within(body).getAllByRole("listitem")).toHaveLength(1);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <HoldingsCards portfolio={portfolio} lots={all} csrfToken="c" showValue />,
    );
    await expectNoA11yViolations(container);
  });
});
