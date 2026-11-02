import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton, SkeletonText } from "./Skeleton";

describe("Skeleton", () => {
  it("is hidden from assistive technology", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("shimmers", () => {
    const { container } = render(<Skeleton className="h-4" />);
    expect(container.firstChild).toHaveClass("animate-shimmer");
  });

  it("renders the requested number of text lines", () => {
    const { container } = render(<SkeletonText lines={4} />);
    expect(container.firstChild?.childNodes).toHaveLength(4);
  });
});
