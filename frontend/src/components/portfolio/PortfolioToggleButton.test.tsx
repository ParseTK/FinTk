import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PortfolioList } from "./PortfolioList";
import { PortfolioProvider } from "./PortfolioProvider";
import { PortfolioToggleButton } from "./PortfolioToggleButton";

function setup() {
  render(
    <PortfolioProvider>
      <PortfolioToggleButton symbol="AAPL" />
      <PortfolioList />
    </PortfolioProvider>,
  );
}

describe("portfolio", () => {
  it("starts empty", () => {
    setup();
    expect(screen.getByText("Your portfolio is empty.")).toBeInTheDocument();
  });

  it("adds a symbol once and exposes pressed state", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: "Add AAPL to portfolio" }));

    const toggle = screen.getByRole("button", {
      name: "Remove AAPL from portfolio",
      pressed: true,
    });
    expect(toggle).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "AAPL" })).toHaveLength(1);
  });

  it("removes a symbol from the list", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: "Add AAPL to portfolio" }));
    const removeButtons = screen.getAllByRole("button", { name: "Remove AAPL from portfolio" });
    await user.click(removeButtons[removeButtons.length - 1]!);

    expect(screen.getByText("Your portfolio is empty.")).toBeInTheDocument();
  });
});
