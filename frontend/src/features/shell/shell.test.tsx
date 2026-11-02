import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { Container } from "@/components/ui/Container";
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

describe("Container", () => {
  it("centers content and applies the size", () => {
    const { container } = render(<Container size="narrow">Body</Container>);
    expect(container.firstElementChild).toHaveClass("mx-auto", "max-w-3xl");
  });
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
