import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { ExternalLink } from "./ExternalLink";

describe("ExternalLink", () => {
  it("opens in a new tab safely and says so to screen readers", async () => {
    const { container } = render(
      <p>
        Read <ExternalLink href="https://example.org/page">the source</ExternalLink> first.
      </p>,
    );
    const link = screen.getByRole("link", { name: /^the source\s*\(opens in a new tab\)$/ });
    expect(link).toHaveAttribute("href", "https://example.org/page");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expectNoA11yViolations(container);
  });

  it("accepts a different style", () => {
    render(
      <ExternalLink href="https://example.org/" className="custom">
        x
      </ExternalLink>,
    );
    expect(screen.getByRole("link")).toHaveClass("custom");
  });
});
