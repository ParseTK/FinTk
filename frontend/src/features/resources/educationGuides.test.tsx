import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { EducationGuides } from "./EducationGuides";
import { GUIDE_GROUPS } from "./education";

describe("Education page", () => {
  it("has one h1, a heading per group and per guide, with no a11y violations", async () => {
    const { container } = render(<EducationGuides />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(
      GUIDE_GROUPS.map((group) => group.title),
    );
    const guideTitles = GUIDE_GROUPS.flatMap((group) => group.guides.map((guide) => guide.title));
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(
      guideTitles,
    );
    await expectNoA11yViolations(container);
  });

  it("links every in-page entry to a heading that exists", () => {
    render(<EducationGuides />);
    const nav = screen.getByRole("navigation", { name: "On this page" });
    for (const link of within(nav).getAllByRole("link")) {
      expect(document.getElementById(link.getAttribute("href")!.slice(1))).not.toBeNull();
    }
  });

  it("has unique ids, so every guide can be linked to", () => {
    const ids = GUIDE_GROUPS.flatMap((group) => [group.id, ...group.guides.map((g) => g.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never gives advice or predictions", () => {
    const text = GUIDE_GROUPS.flatMap((group) =>
      group.guides.flatMap((guide) => guide.paragraphs),
    ).join(" ");
    expect(text).not.toMatch(
      /\b(you should (buy|sell|invest)|will (rise|fall|go up|go down)|guaranteed)\b/i,
    );
  });

  it("states that it is not investment advice", () => {
    render(<EducationGuides />);
    expect(screen.getByText(/not investment advice/i)).toBeInTheDocument();
  });
});
