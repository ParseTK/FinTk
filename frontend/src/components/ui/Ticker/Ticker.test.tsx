import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { Ticker, type TickerItem } from "./Ticker";

const items: TickerItem[] = [
  { symbol: "BTC", price: "$98,120", change: "1.24" },
  { symbol: "ETH", price: "$3,420", change: "-0.62" },
  { symbol: "XYZ", price: "$0.50", change: null },
];

const ticker = () => (
  <Ticker
    label="Prices of the largest coins"
    lead="Live prices"
    items={items}
    pauseLabel="Pause prices"
    playLabel="Play prices"
  />
);

describe("Ticker", () => {
  it("is a named region with the lead-in and every quote", () => {
    render(ticker());
    const region = screen.getByRole("region", { name: "Prices of the largest coins" });
    expect(within(region).getByText("Live prices")).toBeInTheDocument();
    // The second copy (for the seamless loop) is hidden from assistive technology.
    const quotes = within(region).getByRole("list");
    expect(within(quotes).getByText("BTC")).toBeInTheDocument();
    expect(within(quotes).getByText("$98,120")).toBeInTheDocument();
  });

  it("shows direction with a sign and an arrow, and nothing for an unknown change", () => {
    render(ticker());
    const quotes = within(screen.getByRole("list"));
    expect(quotes.getByText(/\+1\.24%/)).toBeInTheDocument();
    expect(quotes.getByText(/-0\.62%/)).toBeInTheDocument();
    const unknown = quotes.getByText("XYZ").closest("li")!;
    expect(unknown).not.toHaveTextContent("%");
  });

  it("can be paused and resumed with the keyboard", async () => {
    const user = userEvent.setup();
    render(ticker());
    await user.tab();
    const pause = screen.getByRole("button", { name: "Pause prices" });
    expect(pause).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Play prices" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(ticker());
    await expectNoA11yViolations(container);
  });
});
