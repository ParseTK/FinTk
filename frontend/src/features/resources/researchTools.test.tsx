import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { ResearchTools } from "./ResearchTools";

const tool = (name: string) => screen.getByRole("region", { name });

describe("Research tools page", () => {
  it("has one h1 and one heading per calculator, with no a11y violations", async () => {
    const { container } = render(<ResearchTools />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Percentage change",
      "Gain or loss",
      "Rise needed after a fall",
    ]);
    await expectNoA11yViolations(container);
  });

  it("works out a percentage change", async () => {
    const user = userEvent.setup();
    render(<ResearchTools />);
    const box = tool("Percentage change");
    await user.type(within(box).getByLabelText("Starting value"), "80");
    await user.type(within(box).getByLabelText("Ending value"), "100");
    await user.click(within(box).getByRole("button", { name: "Calculate" }));
    expect(within(box).getByText("+25.00%")).toBeInTheDocument();
    expect(within(box).getByText("+20")).toBeInTheDocument();
  });

  it("works out a gain or loss", async () => {
    const user = userEvent.setup();
    render(<ResearchTools />);
    const box = tool("Gain or loss");
    await user.type(within(box).getByLabelText(/Amount you hold/), "5");
    await user.type(within(box).getByLabelText(/Total you paid/), "1,000");
    await user.type(within(box).getByLabelText(/Price of one coin now/), "250");
    await user.click(within(box).getByRole("button", { name: "Calculate" }));
    expect(within(box).getByText("$1,250.00")).toBeInTheDocument();
    expect(within(box).getByText("+$250.00")).toBeInTheDocument();
    expect(within(box).getByText("+25.00%")).toBeInTheDocument();
  });

  it("works out the rise needed after a fall, and says it is not a forecast", async () => {
    const user = userEvent.setup();
    render(<ResearchTools />);
    const box = tool("Rise needed after a fall");
    await user.type(within(box).getByLabelText(/Fall, in percent/), "50");
    await user.click(within(box).getByRole("button", { name: "Calculate" }));
    expect(within(box).getByText("+100.00%")).toBeInTheDocument();
    expect(within(box).getByText(/not a forecast/)).toBeInTheDocument();
  });

  it("lists every problem, marks the fields and moves focus to the first one", async () => {
    const user = userEvent.setup();
    render(<ResearchTools />);
    const box = tool("Gain or loss");
    await user.type(within(box).getByLabelText(/Total you paid/), "abc");
    await user.click(within(box).getByRole("button", { name: "Calculate" }));
    const amount = within(box).getByLabelText(/Amount you hold/);
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(within(box).getByLabelText(/Total you paid/)).toHaveAttribute("aria-invalid", "true");
    expect(within(box).getByLabelText(/Price of one coin now/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(amount).toHaveFocus();
    expect(within(box).getAllByText("Enter a number.")).toHaveLength(2);
    expect(within(box).getByText("Enter a number such as 1250 or 0.5.")).toBeInTheDocument();
  });

  it("refuses a fall of 100 percent and explains why", async () => {
    const user = userEvent.setup();
    render(<ResearchTools />);
    const box = tool("Rise needed after a fall");
    await user.type(within(box).getByLabelText(/Fall, in percent/), "100");
    await user.click(within(box).getByRole("button", { name: "Calculate" }));
    expect(within(box).getByText(/nothing is left to recover/)).toBeInTheDocument();
  });

  it("clears an old answer when a number is edited, and with Clear", async () => {
    const user = userEvent.setup();
    render(<ResearchTools />);
    const box = tool("Percentage change");
    await user.type(within(box).getByLabelText("Starting value"), "80");
    await user.type(within(box).getByLabelText("Ending value"), "100");
    await user.click(within(box).getByRole("button", { name: "Calculate" }));
    expect(within(box).getByText("+25.00%")).toBeInTheDocument();
    await user.type(within(box).getByLabelText("Ending value"), "0");
    expect(within(box).queryByText("+25.00%")).not.toBeInTheDocument();
    await user.click(within(box).getByRole("button", { name: "Clear" }));
    expect(within(box).getByLabelText("Starting value")).toHaveValue("");
  });
});
