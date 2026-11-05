import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { DataMethodology } from "./DataMethodology";
import { FIGURES, LIMITS, SOURCES } from "./methodology";

describe("Data & methodology page", () => {
  it("has one h1 and a heading for each section", async () => {
    const { container } = render(<DataMethodology />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      "Where the figures come from",
      "What each figure means",
      "How news is chosen",
      "Coverage and limits",
      "Credits",
    ]);
    await expectNoA11yViolations(container);
  });

  it("links every in-page entry to a heading that exists", () => {
    render(<DataMethodology />);
    const nav = screen.getByRole("navigation", { name: "On this page" });
    for (const link of within(nav).getAllByRole("link")) {
      const id = link.getAttribute("href")!.slice(1);
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("lists every source with how old its data can be", () => {
    render(<DataMethodology />);
    const table = screen.getByRole("table");
    for (const source of SOURCES) {
      expect(within(table).getByRole("link", { name: new RegExp(source.name) })).toHaveAttribute(
        "href",
        source.href,
      );
    }
    expect(within(table).getByText(/Prices and totals up to 10 minutes/)).toBeInTheDocument();
  });

  it("opens every outside link in a new tab and says so", () => {
    render(<DataMethodology />);
    const outside = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("https://"));
    expect(outside.length).toBeGreaterThan(4);
    for (const link of outside) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
      expect(link).toHaveTextContent("(opens in a new tab)");
    }
  });

  it("shows every figure definition and every limit", () => {
    render(<DataMethodology />);
    for (const figure of FIGURES) expect(screen.getByText(figure.name)).toBeInTheDocument();
    for (const limit of LIMITS) expect(screen.getByText(limit.title)).toBeInTheDocument();
  });

  it("makes the wide table reachable by keyboard", () => {
    render(<DataMethodology />);
    const region = screen.getByRole("region", { name: "Data sources" });
    expect(region).toHaveAttribute("tabindex", "0");
  });
});
