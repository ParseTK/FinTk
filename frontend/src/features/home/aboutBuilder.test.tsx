import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { AboutBuilder } from "./AboutBuilder";

describe("AboutBuilder", () => {
  it("introduces the builder by first name and links to the public code", async () => {
    const { container } = render(<AboutBuilder />);
    expect(screen.getByRole("region", { name: "Hi, I'm Tyler." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View the source on GitHub/ })).toHaveAttribute(
      "href",
      "https://github.com/ParseTK/FinTk",
    );
    expect(screen.getByRole("link", { name: /My portfolio/ })).toHaveAttribute(
      "href",
      "https://parsetk.github.io",
    );
    await expectNoA11yViolations(container);
  });
});
