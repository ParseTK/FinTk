import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { Footer } from "./Footer";
import { MobileMenu } from "./MobileMenu";
import { NavLink } from "./NavLink";

const ITEMS = [
  { href: "/search", label: "Search" },
  { href: "/markets", label: "Markets" },
  { href: "/watchlist", label: "Watchlist" },
] as const;

beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue("/");
});

describe("Footer", () => {
  it("is a contentinfo landmark with the disclaimer", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByText(/not investment advice/i)).toBeInTheDocument();
  });

  it("opens the repository in a new tab safely and says so", () => {
    render(<Footer />);
    const link = screen.getByRole("link", { name: /view the source on github/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAccessibleName(/opens in a new tab/i);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Footer />);
    await expectNoA11yViolations(container);
  });
});

describe("Footer sections", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("lists each section with its pages underneath, like the header and sidebar", () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    vi.stubEnv("FEATURE_CRYPTO_MARKETS", "true");
    render(<Footer />);
    const nav = screen.getByRole("navigation", { name: "Footer" });
    expect(within(nav).getByRole("heading", { name: "Crypto" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/crypto");
    expect(within(nav).getByRole("link", { name: "Markets" })).toHaveAttribute(
      "href",
      "/crypto/markets",
    );
    expect(within(nav).queryByRole("link", { name: "News" })).not.toBeInTheDocument();
  });

  it("has no navigation at all while every page is off", () => {
    render(<Footer />);
    expect(screen.queryByRole("navigation", { name: "Footer" })).not.toBeInTheDocument();
  });
});

describe("NavLink", () => {
  it("marks the current page with aria-current", () => {
    vi.mocked(usePathname).mockReturnValue("/search");
    render(<NavLink href="/search">Search</NavLink>);
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("aria-current", "page");
  });

  it("marks parent sections as current on child pages", () => {
    vi.mocked(usePathname).mockReturnValue("/search/results");
    render(<NavLink href="/search">Search</NavLink>);
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("aria-current", "page");
  });

  it("does not mark other pages", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<NavLink href="/search">Search</NavLink>);
    expect(screen.getByRole("link", { name: "Search" })).not.toHaveAttribute("aria-current");
  });

  it("with exact, is not current on a page beneath it, so two links are never both current", () => {
    vi.mocked(usePathname).mockReturnValue("/crypto/markets");
    render(
      <>
        <NavLink href="/crypto" exact>
          Crypto
        </NavLink>
        <NavLink href="/crypto/markets">Crypto markets</NavLink>
      </>,
    );
    expect(screen.getByRole("link", { name: "Crypto" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Crypto markets" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("with exact, is still current on its own page", () => {
    vi.mocked(usePathname).mockReturnValue("/crypto");
    render(
      <NavLink href="/crypto" exact>
        Crypto
      </NavLink>,
    );
    expect(screen.getByRole("link", { name: "Crypto" })).toHaveAttribute("aria-current", "page");
  });

  it("shows the current page with an underline, not only a color", () => {
    vi.mocked(usePathname).mockReturnValue("/search");
    render(<NavLink href="/search">Search</NavLink>);
    expect(screen.getByRole("link", { name: "Search" })).toHaveClass("underline");
  });
});

describe("MobileMenu", () => {
  const menuButton = () => screen.getByRole("button", { name: "Menu" });

  it("starts closed and reports its state", async () => {
    const user = userEvent.setup();
    render(<MobileMenu items={ITEMS} />);
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Markets" })).not.toBeInTheDocument();

    await user.click(menuButton());

    expect(menuButton()).toHaveAttribute("aria-expanded", "true");
    for (const { label } of ITEMS) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("closes on Escape and returns focus to the button", async () => {
    const user = userEvent.setup();
    render(<MobileMenu items={ITEMS} />);
    await user.click(menuButton());
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("link", { name: "Markets" })).not.toBeInTheDocument();
    expect(menuButton()).toHaveFocus();
  });

  it("closes after choosing a link", async () => {
    const user = userEvent.setup();
    render(<MobileMenu items={ITEMS} />);
    await user.click(menuButton());
    await user.click(screen.getByRole("link", { name: "Markets" }));

    expect(screen.queryByRole("link", { name: "Watchlist" })).not.toBeInTheDocument();
  });

  it("closes when clicking outside", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">elsewhere</button>
        <MobileMenu items={ITEMS} />
      </>,
    );
    await user.click(menuButton());
    await user.click(screen.getByRole("button", { name: "elsewhere" }));

    expect(screen.queryByRole("link", { name: "Markets" })).not.toBeInTheDocument();
  });

  it("has no accessibility violations while open", async () => {
    const user = userEvent.setup();
    const { container } = render(<MobileMenu items={ITEMS} />);
    await user.click(menuButton());
    await expectNoA11yViolations(container);
  });
});

describe("Footer quick links", () => {
  it("lists external sources that open in a new tab and say so", () => {
    render(<Footer />);
    const nav = screen.getByRole("navigation", { name: "Quick links" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(5);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveTextContent("(opens in a new tab)");
    }
    expect(within(nav).getByRole("link", { name: /CoinMarketCap methodology/ })).toHaveAttribute(
      "href",
      "https://coinmarketcap.com/methodology/",
    );
  });
});
