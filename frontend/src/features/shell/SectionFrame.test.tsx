import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import type { SectionView } from "./sectionView";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const { SectionFrame } = await import("./SectionFrame");

const sections: SectionView[] = [
  {
    id: "holdings",
    label: "Holdings",
    links: [
      { href: "/portfolio", label: "Portfolio" },
      { href: "/watchlist", label: "Watchlist" },
      { href: "/account", label: "Account" },
    ],
  },
];

beforeEach(() => {
  pathname = "/watchlist";
});

describe("SectionFrame", () => {
  it("shows the section's pages beside the page and marks the current one", async () => {
    const { container } = render(
      <SectionFrame sections={sections}>
        <h1>Watchlist</h1>
      </SectionFrame>,
    );
    const nav = screen.getByRole("navigation", { name: "Holdings pages" });
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Portfolio", "Watchlist", "Account"]);
    expect(links.filter((link) => link.getAttribute("aria-current") === "page")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Watchlist" })).toHaveAttribute("aria-current", "page");
    expect(nav).toContainElement(links[0]!);
    expect(screen.getByRole("heading", { name: "Watchlist" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("keeps the tab row relative so hidden text cannot widen the page on phones", () => {
    render(<SectionFrame sections={sections}>x</SectionFrame>);
    expect(screen.getByRole("list").className).toContain("relative");
    expect(screen.getByRole("list").className).not.toContain("overflow-hidden");
  });

  it("leaves a page outside every section completely alone", () => {
    pathname = "/company/AAPL";
    render(
      <SectionFrame sections={sections}>
        <p>company page</p>
      </SectionFrame>,
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByText("company page")).toBeInTheDocument();
  });

  it("does nothing while no sections are passed (the shell is off)", () => {
    render(
      <SectionFrame sections={[]}>
        <p>page</p>
      </SectionFrame>,
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByText("page")).toBeInTheDocument();
  });
});
