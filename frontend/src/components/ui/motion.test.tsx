import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";

describe("micro-interaction styles", () => {
  it("only applies press and lift transforms when motion is allowed", () => {
    render(<Button>Go</Button>);
    const classes = screen.getByRole("button", { name: "Go" }).className;
    expect(classes).toContain("motion-safe:enabled:active:scale-");
    expect(classes).toContain("motion-safe:enabled:hover:-translate-y-px");
    expect(classes).not.toMatch(/(^|\s)(active|hover):(scale|-translate)/);
  });

  it("shimmers skeletons and hides them from assistive tech", () => {
    const { container } = render(<Skeleton className="h-4" />);
    expect(container.firstChild).toHaveClass("animate-shimmer");
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});
