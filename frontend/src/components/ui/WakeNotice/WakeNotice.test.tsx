import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { WakeNotice } from "./WakeNotice";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("WakeNotice", () => {
  it("says nothing at first, but the live region is already in the page", () => {
    render(<WakeNotice delayMs={1000} />);
    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();
    expect(region).toHaveClass("sr-only");
  });

  it("explains the wait once it has gone on long enough", () => {
    render(<WakeNotice delayMs={1000} />);
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("status")).toHaveTextContent(/taking longer than usual/i);
    expect(screen.getByRole("status")).not.toHaveClass("sr-only");
  });

  it("never shows if the page loads first", () => {
    const { unmount } = render(<WakeNotice delayMs={1000} />);
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("has no accessibility violations before or after the message", async () => {
    vi.useRealTimers();
    const { container } = render(<WakeNotice delayMs={0} />);
    await expectNoA11yViolations(container);
  });
});
