import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders a heading, description and action", () => {
    render(
      <EmptyState
        title="Nothing saved yet"
        description="Search for a company to add it."
        action={<a href="/search">Search</a>}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Nothing saved yet" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Search for a company to add it.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search" })).toBeInTheDocument();
  });

  it("supports other heading levels", () => {
    render(<EmptyState title="Empty" headingLevel={1} />);
    expect(screen.getByRole("heading", { level: 1, name: "Empty" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <EmptyState title="Empty" description="Nothing here" icon={<svg />} />,
    );
    await expectNoA11yViolations(container);
  });
});
