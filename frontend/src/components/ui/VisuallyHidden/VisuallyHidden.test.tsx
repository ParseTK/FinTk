import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VisuallyHidden } from "./VisuallyHidden";

describe("VisuallyHidden", () => {
  it("keeps text in the accessibility tree but hides it visually", () => {
    render(<VisuallyHidden>Screen reader only</VisuallyHidden>);
    expect(screen.getByText("Screen reader only")).toHaveClass("sr-only");
  });
});
