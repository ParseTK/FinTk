import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { LiveMessage } from "./LiveMessage";

describe("LiveMessage", () => {
  it("is an alert for errors and a status for success", () => {
    const { rerender } = render(<LiveMessage>Went wrong</LiveMessage>);
    expect(screen.getByRole("alert")).toHaveTextContent("Went wrong");

    rerender(<LiveMessage tone="success">Saved</LiveMessage>);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("stays in the page when empty, so a later message is announced", () => {
    render(<LiveMessage />);
    const region = screen.getByRole("alert");
    expect(region).toBeInTheDocument();
    expect(region).not.toHaveAttribute("hidden"); // not display:none: still in the accessibility tree
    expect(region).toBeEmptyDOMElement();
  });

  it("takes no visible space when empty and is visible when it has text", () => {
    const { rerender } = render(<LiveMessage />);
    expect(screen.getByRole("alert")).toHaveClass("sr-only");

    rerender(<LiveMessage>Problem</LiveMessage>);
    expect(screen.getByRole("alert")).not.toHaveClass("sr-only");
    expect(screen.getByRole("alert")).toHaveClass("text-loss");
  });

  it("announces a message that appears in a region that was already there", () => {
    const { rerender } = render(<LiveMessage />);
    const region = screen.getByRole("alert");

    rerender(<LiveMessage>Could not save</LiveMessage>);

    expect(screen.getByRole("alert")).toBe(region); // the same element, updated, not a new one
    expect(region).toHaveTextContent("Could not save");
  });

  it("has no accessibility violations, empty or full", async () => {
    const { container, rerender } = render(<LiveMessage />);
    await expectNoA11yViolations(container);
    rerender(<LiveMessage>Hello</LiveMessage>);
    await expectNoA11yViolations(container);
  });
});
