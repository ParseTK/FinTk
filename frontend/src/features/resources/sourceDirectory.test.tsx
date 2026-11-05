import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { SourceDirectory } from "./SourceDirectory";
import { FILING_TYPES, SOURCE_GROUPS } from "./sources";

const escapeForRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("Source directory page", () => {
  it("has one h1, a heading per group and one for filing types, with no a11y violations", async () => {
    const { container } = render(<SourceDirectory />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([...SOURCE_GROUPS.map((g) => g.title), "Filing types you will meet"]);
    await expectNoA11yViolations(container);
  });

  it("lists every source as a link that opens in a new tab and says so", () => {
    render(<SourceDirectory />);
    for (const group of SOURCE_GROUPS) {
      for (const entry of group.entries) {
        const name = new RegExp(`^${escapeForRegExp(entry.name)}\\s*\\(opens in a new tab\\)$`);
        const link = screen.getByRole("link", { name });
        expect(link).toHaveAttribute("href", entry.href);
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
      }
    }
  });

  it("only links to https addresses", () => {
    for (const group of SOURCE_GROUPS) {
      for (const entry of group.entries) expect(entry.href.startsWith("https://")).toBe(true);
    }
  });

  it("explains each filing type", () => {
    render(<SourceDirectory />);
    const forms = screen
      .getByRole("heading", { name: "Filing types you will meet" })
      .closest("section")!;
    for (const filing of FILING_TYPES) {
      expect(within(forms).getByText(`Form ${filing.form}`)).toBeInTheDocument();
    }
  });
});
