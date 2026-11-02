import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Container } from "./Container";

describe("Container", () => {
  it("centers content and applies the size", () => {
    const { container } = render(<Container size="narrow">Body</Container>);
    expect(container.firstElementChild).toHaveClass("mx-auto", "max-w-3xl");
  });

  it("defaults to the standard width", () => {
    const { container } = render(<Container>Body</Container>);
    expect(container.firstElementChild).toHaveClass("max-w-6xl");
  });
});
