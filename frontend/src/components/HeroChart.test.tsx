import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { HeroChart } from "./HeroChart";

const slider = () => screen.getByRole("slider");

describe("HeroChart", () => {
  it("starts on the latest point and says the data is a sample", () => {
    render(<HeroChart />);
    expect(slider()).toHaveAttribute("aria-valuenow", "11");
    expect(screen.getByText(/sample data/i)).toBeInTheDocument();
    expect(screen.getByText("$163.40")).toBeInTheDocument();
  });

  it("describes the current point in words for assistive technology", () => {
    render(<HeroChart />);
    expect(slider()).toHaveAttribute(
      "aria-valuetext",
      expect.stringMatching(/^Dec: \$163\.40, \+38\.24% since January$/),
    );
  });

  it("moves with the arrow keys and clamps at the ends", async () => {
    const user = userEvent.setup();
    render(<HeroChart />);
    slider().focus();

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(slider()).toHaveAttribute("aria-valuenow", "9");
    expect(screen.getByText("$151.30")).toBeInTheDocument();

    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(slider()).toHaveAttribute("aria-valuenow", "11");

    await user.keyboard("{Home}");
    expect(slider()).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("$118.20")).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(slider()).toHaveAttribute("aria-valuenow", "0");

    await user.keyboard("{End}");
    expect(slider()).toHaveAttribute("aria-valuenow", "11");
  });

  it("shows a neutral zero change at the first point", async () => {
    const user = userEvent.setup();
    render(<HeroChart />);
    slider().focus();
    await user.keyboard("{Home}");
    expect(screen.getByText("0.00%")).toBeInTheDocument();
  });

  it("scrubs with the pointer", () => {
    render(<HeroChart />);
    const el = slider();
    el.getBoundingClientRect = () =>
      ({
        left: 0,
        width: 460,
        top: 0,
        height: 300,
        right: 460,
        bottom: 300,
        x: 0,
        y: 0,
      }) as DOMRect;

    fireEvent.pointerMove(el, { clientX: 28 }); // left edge of the plot
    expect(el).toHaveAttribute("aria-valuenow", "0");

    fireEvent.pointerMove(el, { clientX: 460 }); // far right, clamps to the last point
    expect(el).toHaveAttribute("aria-valuenow", "11");
  });

  it("returns to the latest point when the pointer leaves", () => {
    render(<HeroChart />);
    const el = slider();
    el.getBoundingClientRect = () =>
      ({
        left: 0,
        width: 460,
        top: 0,
        height: 300,
        right: 460,
        bottom: 300,
        x: 0,
        y: 0,
      }) as DOMRect;
    fireEvent.pointerMove(el, { clientX: 28 });
    expect(el).toHaveAttribute("aria-valuenow", "0");

    fireEvent.pointerLeave(el);

    expect(el).toHaveAttribute("aria-valuenow", "11");
  });

  it("blinks the end marker only while idle", async () => {
    const user = userEvent.setup();
    const { container } = render(<HeroChart />);
    expect(container.querySelector(".animate-blink")).toBeInTheDocument();
    expect(container.querySelector(".animate-ring")).toBeInTheDocument();

    slider().focus();
    await user.keyboard("{ArrowLeft}");

    expect(container.querySelector(".animate-blink")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-ring")).not.toBeInTheDocument();
  });

  it("is reachable by keyboard", async () => {
    const user = userEvent.setup();
    render(<HeroChart />);
    await user.tab();
    expect(slider()).toHaveFocus();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<HeroChart />);
    await expectNoA11yViolations(container);
  });
});
