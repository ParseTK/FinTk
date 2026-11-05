import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { AccessibilityStatement, LEGAL_UPDATED, PrivacyPolicy, TermsOfUse } from "./index";

const pages = [
  ["Privacy policy", PrivacyPolicy],
  ["Terms of use", TermsOfUse],
  ["Accessibility statement", AccessibilityStatement],
] as const;

describe.each(pages)("%s", (title, Page) => {
  it("has one main heading, the update date and no accessibility violations", async () => {
    const { container } = render(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText(`Last updated ${LEGAL_UPDATED}`)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("lists every section in the in-page navigation and each link finds its heading", () => {
    const { container } = render(<Page />);
    const nav = screen.getByRole("navigation", { name: "On this page" });
    const links = within(nav).getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(4);
    for (const link of links) {
      const id = link.getAttribute("href")!.slice(1);
      const heading = container.querySelector(`#${id}`);
      expect(heading, link.textContent ?? "").not.toBeNull();
      expect(heading!.tagName).toBe("H2");
      expect(heading!.textContent).toBe(link.textContent);
    }
  });

  it("opens links to other sites in a new tab safely and says so", () => {
    render(<Page />);
    for (const link of screen.queryAllByRole("link", { name: /opens in a new tab/ })) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
  });
});

describe("what the pages promise", () => {
  it("privacy policy says how to delete the account and what the button is called", () => {
    render(<PrivacyPolicy />);
    expect(screen.getByText(/choose Delete my account/)).toBeInTheDocument();
    expect(screen.getByText(/no advertising, no tracking and no analytics/)).toBeInTheDocument();
  });

  it("terms state personal, non-commercial use and that it is not advice", () => {
    render(<TermsOfUse />);
    expect(screen.getByText(/personal,\s+non-commercial use only/)).toBeInTheDocument();
    expect(
      screen.getByText(/not\s+investment, financial, tax or legal advice/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^CoinMarketCap\.com\s*\(opens in a new tab\)$/ }),
    ).toHaveAttribute("href", "https://coinmarketcap.com/");
  });

  it("the privacy contact is a private route, not an email address", () => {
    const { container } = render(<PrivacyPolicy />);
    expect(container.textContent).not.toMatch(/\S+@\S+\.\S+/);
    expect(screen.getByRole("link", { name: /GitHub private reporting/ })).toHaveAttribute(
      "href",
      expect.stringContaining("/security/advisories/new"),
    );
  });
});
