import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("is an alert with a default title and no retry button unless asked", () => {
    render(<ErrorState />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onRetry from the retry button", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState description="We could not load data." onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText("We could not load data.")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ErrorState onRetry={() => {}} />);
    await expectNoA11yViolations(container);
  });
});
