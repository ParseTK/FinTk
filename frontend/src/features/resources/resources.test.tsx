import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { AREAS } from "./areas";
import { ResourcePlaceholder } from "./ResourcePlaceholder";
import { ResourcesOverview } from "./ResourcesOverview";

describe("ResourcesOverview", () => {
  it("has one h1, the four areas as links to their own pages, and the questions", async () => {
    const { container } = render(<ResourcesOverview />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "A clearer route to your research.",
    );
    const cards = screen
      .getByRole("heading", { level: 2, name: "Four places to start." })
      .closest("section")!;
    for (const area of AREAS) {
      expect(
        within(cards).getByRole("heading", { level: 3, name: area.title }),
      ).toBeInTheDocument();
      expect(within(cards).getByRole("link", { name: area.action })).toHaveAttribute(
        "href",
        area.href,
      );
    }
    const questions = screen.getByRole("heading", { name: /Not sure where/ }).closest("section")!;
    expect(within(questions).getAllByRole("link")).toHaveLength(3);
    expect(
      within(questions).getByRole("link", { name: /Where can I find the original document/ }),
    ).toHaveAttribute("href", "/resources/sources");
    await expectNoA11yViolations(container);
  });
});

describe("ResourcePlaceholder", () => {
  it("says plainly that the page is not written yet and links back", async () => {
    const { container } = render(<ResourcePlaceholder area="tools" />);
    expect(screen.getByRole("heading", { level: 1, name: "Research tools" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Coming soon" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the overview" })).toHaveAttribute(
      "href",
      "/resources",
    );
    await expectNoA11yViolations(container);
  });
});
