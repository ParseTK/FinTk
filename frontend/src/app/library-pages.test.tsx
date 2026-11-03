import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";

class Redirected extends Error {
  constructor(public readonly to: string) {
    super(`redirect:${to}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));

const getSession = vi.fn();
vi.mock("@/features/auth/session", () => ({ getSession: () => getSession() }));

const GET = vi.fn();
vi.mock("@/lib/api/client", () => ({ privateApi: { GET: (...args: unknown[]) => GET(...args) } }));
vi.mock("@/lib/api/authHeaders", () => ({ authHeaders: async () => ({}) }));

const { default: WatchlistPage } = await import("./watchlist/page");
const { default: PortfolioPage } = await import("./portfolio/page");

const signedIn = {
  user: { id: "u1", email: "a@b.co", name: "A" },
  csrfToken: "csrf-1",
  providers: [],
  reachable: true,
};
const signedOut = { user: null, csrfToken: null, providers: [], reachable: true };

const watchItem = (symbol: string, name: string | null) => ({
  symbol,
  name,
  added_at: "2026-05-01T10:00:00Z",
});

beforeEach(() => {
  getSession.mockReset();
  GET.mockReset();
});

describe("/watchlist", () => {
  it("sends a visitor to sign in and then back", async () => {
    getSession.mockResolvedValue(signedOut);
    await expect(WatchlistPage()).rejects.toMatchObject({ to: "/sign-in?next=%2Fwatchlist" });
    expect(GET).not.toHaveBeenCalled(); // nothing is fetched for someone who is not signed in
  });

  it("lists the companies being watched", async () => {
    getSession.mockResolvedValue(signedIn);
    GET.mockResolvedValue({
      data: { items: [watchItem("AAPL", "Apple Inc."), watchItem("KO", null)] },
    });

    const { container } = render(await WatchlistPage());

    expect(screen.getByRole("heading", { level: 1, name: "Watchlist" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "AAPL" })).toHaveAttribute("href", "/company/AAPL");
    expect(screen.getByRole("button", { name: "Remove KO from watchlist" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("invites a first search when the list is empty", async () => {
    getSession.mockResolvedValue(signedIn);
    GET.mockResolvedValue({ data: { items: [] } });

    const { container } = render(await WatchlistPage());

    expect(screen.getByText("Nothing on your watchlist yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search companies" })).toHaveAttribute(
      "href",
      "/search",
    );
    await expectNoA11yViolations(container);
  });

  it("says so when the list cannot be loaded, instead of showing it as empty", async () => {
    getSession.mockResolvedValue(signedIn);
    GET.mockRejectedValue(new TypeError("fetch failed"));

    render(await WatchlistPage());

    expect(screen.getByRole("alert")).toHaveTextContent("We could not load your watchlist");
    expect(screen.queryByText("Nothing on your watchlist yet")).not.toBeInTheDocument();
  });
});

describe("/portfolio", () => {
  const holdings = {
    holdings: [
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        shares: "15.000000",
        average_cost: "110.000000",
        cost_basis: "1650.00",
        lots: 2,
      },
    ],
    total_cost_basis: "1650.00",
    currency: "USD",
  };
  const lots = {
    lots: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        symbol: "AAPL",
        shares: "10.000000",
        unit_cost: "100.000000",
        cost: "1000.00",
        acquired_on: "2024-03-15",
        created_at: "2026-05-01T10:00:00Z",
        updated_at: "2026-05-01T10:00:00Z",
      },
    ],
  };

  function respondWith(portfolio: unknown, lotList: unknown) {
    GET.mockImplementation(async (path: string) =>
      path === "/api/v1/portfolio" ? portfolio : lotList,
    );
  }

  it("sends a visitor to sign in and then back", async () => {
    getSession.mockResolvedValue(signedOut);
    await expect(PortfolioPage()).rejects.toMatchObject({ to: "/sign-in?next=%2Fportfolio" });
    expect(GET).not.toHaveBeenCalled();
  });

  it("shows holdings, the add form and the purchases", async () => {
    getSession.mockResolvedValue(signedIn);
    respondWith({ data: holdings }, { data: lots });

    const { container } = render(await PortfolioPage());

    expect(screen.getByRole("heading", { level: 1, name: "Portfolio" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /holdings/i })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Add a purchase" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /AAPL/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit purchase of 10 AAPL" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("is honest that these are costs, not current values", async () => {
    getSession.mockResolvedValue(signedIn);
    respondWith({ data: holdings }, { data: lots });
    render(await PortfolioPage());
    expect(screen.getByText(/show what you paid/i)).toBeInTheDocument();
  });

  it("shows just the add form to someone with no purchases yet", async () => {
    getSession.mockResolvedValue(signedIn);
    respondWith(
      { data: { holdings: [], total_cost_basis: "0.00", currency: "USD" } },
      { data: { lots: [] } },
    );

    render(await PortfolioPage());

    expect(screen.getByRole("form", { name: "Add a purchase" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Your purchases")).not.toBeInTheDocument();
  });

  it("says so when it cannot be loaded, instead of showing an empty portfolio", async () => {
    getSession.mockResolvedValue(signedIn);
    GET.mockRejectedValue(new TypeError("fetch failed"));

    render(await PortfolioPage());

    expect(screen.getByRole("alert")).toHaveTextContent("We could not load your portfolio");
    expect(screen.queryByRole("form", { name: "Add a purchase" })).not.toBeInTheDocument();
  });
});
