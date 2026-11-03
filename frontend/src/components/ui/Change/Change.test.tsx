import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { Change } from "./Change";

describe("Change", () => {
  it("shows a gain with a plus sign, an up arrow and the gain color", () => {
    const { container } = render(<Change value="5.76" />);
    expect(screen.getByText("+5.76%")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-gain");
    expect(container.textContent).toContain("▲");
  });

  it("shows a loss with a minus sign, a down arrow and the loss color", () => {
    const { container } = render(<Change value={-3.84} />);
    expect(screen.getByText("-3.84%")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-loss");
    expect(container.textContent).toContain("▼");
  });

  it("keeps the direction readable without color or the arrow", () => {
    render(<Change value="-3.84" />);
    expect(screen.getByText("-3.84%").textContent).toMatch(/^-/);
  });

  it("is neutral for zero and has no arrow", () => {
    const { container } = render(<Change value="0" />);
    expect(screen.getByText("0.00%")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-fg-muted");
    expect(container.textContent).not.toMatch(/[▲▼]/);
  });

  it("can hide the arrow when a neighbouring figure already shows it", () => {
    const { container } = render(<Change value="5.76" arrow={false} />);
    expect(screen.getByText("+5.76%")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-gain");
    expect(container.textContent).not.toMatch(/[▲▼]/);
  });

  it("is neutral for missing values", () => {
    const { container } = render(<Change value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-fg-muted");
  });

  it("formats money changes", () => {
    render(<Change kind="money" value="12.3" />);
    expect(screen.getByText("+$12.30")).toBeInTheDocument();
  });

  it("hides the decorative arrow from assistive technology", () => {
    const { container } = render(<Change value="1" />);
    expect(container.querySelector("[aria-hidden='true']")).toHaveTextContent("▲");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <div>
        <Change value="1.5" />
        <Change value="-2" />
        <Change value="0" />
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
