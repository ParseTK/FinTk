import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const sendJson = vi.fn();
vi.mock("@/lib/apiRequest", () => ({ sendJson: (...args: unknown[]) => sendJson(...args) }));

const getSession = vi.fn();
vi.mock("@/features/auth", () => ({ getSession: () => getSession() }));

const GET = vi.fn();
vi.mock("@/lib/api/client", () => ({ privateApi: { GET: (...args: unknown[]) => GET(...args) } }));
vi.mock("@/lib/api/authHeaders", () => ({
  authHeaders: async () => ({ cookie: "virello_session=t" }),
}));

const { getWatchlist, getWatchlistState, WatchlistTable, WatchlistToggle } =
  await import("./index");
const { RemoveFromWatchlist } = await import("./RemoveFromWatchlist");

const failure = (kind: string, message: string) => ({ ok: false, kind, message, fields: {} });
const item = (symbol: string, name: string | null = null) => ({
  symbol,
  name,
  added_at: "2026-05-01T10:00:00Z",
});

beforeEach(() => {
  refresh.mockReset();
  sendJson.mockReset();
  getSession.mockReset();
  GET.mockReset();
});

describe("WatchlistToggle", () => {
  it("keeps one stable name and shows the state with aria-pressed", async () => {
    const { container, rerender } = render(
      <WatchlistToggle symbol="AAPL" watched={false} csrfToken="c" />,
    );
    const button = screen.getByRole("button", { name: "Watch AAPL" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await expectNoA11yViolations(container);

    rerender(<WatchlistToggle symbol="AAPL" watched csrfToken="c" />);
    // Same accessible name; only the pressed state differs (a changed label as well would announce twice).
    expect(screen.getByRole("button", { name: "Watch AAPL" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("adds, with the CSRF token, and only shows it pressed after the server agrees", async () => {
    sendJson.mockResolvedValue({ ok: true, data: {}, created: true });
    render(<WatchlistToggle symbol="AAPL" watched={false} csrfToken="csrf-1" />);

    await userEvent.click(screen.getByRole("button", { name: "Watch AAPL" }));

    expect(sendJson).toHaveBeenCalledWith("PUT", "/api/v1/watchlist/AAPL", "csrf-1");
    expect(screen.getByRole("button", { name: "Watch AAPL" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("removes when it is already watched", async () => {
    sendJson.mockResolvedValue({ ok: true, data: undefined, created: false });
    render(<WatchlistToggle symbol="BRK-B" watched csrfToken="csrf-1" />);

    await userEvent.click(screen.getByRole("button", { name: "Watch BRK-B" }));

    expect(sendJson).toHaveBeenCalledWith("DELETE", "/api/v1/watchlist/BRK-B", "csrf-1");
    expect(screen.getByRole("button", { name: "Watch BRK-B" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("stays as it was and says why when the server refuses", async () => {
    sendJson.mockResolvedValue(failure("limit", "Your watchlist is full (200 companies)."));
    render(<WatchlistToggle symbol="AAPL" watched={false} csrfToken="c" />);

    await userEvent.click(screen.getByRole("button", { name: "Watch AAPL" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your watchlist is full");
    expect(screen.getByRole("button", { name: "Watch AAPL" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("clears an old message on the next try", async () => {
    sendJson.mockResolvedValueOnce(failure("failed", "Something went wrong."));
    sendJson.mockResolvedValueOnce({ ok: true, data: {}, created: true });
    render(<WatchlistToggle symbol="AAPL" watched={false} csrfToken="c" />);

    await userEvent.click(screen.getByRole("button", { name: "Watch AAPL" }));
    await screen.findByText("Something went wrong.");
    await userEvent.click(screen.getByRole("button", { name: "Watch AAPL" }));

    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
  });

  it("offers sign-in to visitors, coming back to the same page", () => {
    render(<WatchlistToggle symbol="AAPL" watched={false} signInNext="/search?q=apple&x=1" />);
    expect(screen.getByRole("link", { name: "Sign in to watch AAPL" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fsearch%3Fq%3Dapple%26x%3D1",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("encodes a symbol that could break out of the URL path", async () => {
    sendJson.mockResolvedValue({ ok: true, data: {}, created: true });
    render(<WatchlistToggle symbol="A/../B" watched={false} csrfToken="c" />);
    await userEvent.click(screen.getByRole("button"));
    expect(sendJson).toHaveBeenCalledWith("PUT", "/api/v1/watchlist/A%2F..%2FB", "c");
  });
});

describe("RemoveFromWatchlist", () => {
  it("removes, then asks the server for the new list", async () => {
    sendJson.mockResolvedValue({ ok: true, data: undefined, created: false });
    render(<RemoveFromWatchlist symbol="MSFT" csrfToken="c" />);

    await userEvent.click(screen.getByRole("button", { name: "Remove MSFT from watchlist" }));

    expect(sendJson).toHaveBeenCalledWith("DELETE", "/api/v1/watchlist/MSFT", "c");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps the row and explains when it fails", async () => {
    sendJson.mockResolvedValue(
      failure("stale", "This page is out of date. Reload it and try again."),
    );
    render(<RemoveFromWatchlist symbol="MSFT" csrfToken="c" />);

    await userEvent.click(screen.getByRole("button", { name: /Remove MSFT/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("out of date");
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Remove MSFT/ })).toBeEnabled();
  });
});

describe("WatchlistTable", () => {
  it("lists companies with names, links and a labelled remove button each", async () => {
    const { container } = render(
      <WatchlistTable items={[item("AAPL", "Apple Inc."), item("KO")]} csrfToken="c" />,
    );

    expect(screen.getByRole("table", { name: /watchlist/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "AAPL" })).toHaveAttribute("href", "/company/AAPL");
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove AAPL from watchlist" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove KO from watchlist" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe("watchlist data", () => {
  it("returns the visitor's items, calling the API as them", async () => {
    GET.mockResolvedValue({ data: { items: [item("AAPL")] } });
    expect(await getWatchlist()).toEqual([item("AAPL")]);
    expect(GET).toHaveBeenCalledWith("/api/v1/watchlist", {
      headers: { cookie: "virello_session=t" },
    });
  });

  it.each([{ data: undefined }, "throw"])(
    "returns null instead of crashing (%j)",
    async (outcome) => {
      if (outcome === "throw") GET.mockRejectedValue(new TypeError("fetch failed"));
      else GET.mockResolvedValue(outcome);
      expect(await getWatchlist()).toBeNull();
    },
  );

  it("describes a visitor who is not signed in without calling the API", async () => {
    getSession.mockResolvedValue({ user: null, csrfToken: null, providers: [], reachable: true });
    expect(await getWatchlistState()).toEqual({ signedIn: false });
    expect(GET).not.toHaveBeenCalled();
  });

  it("gives a signed-in visitor their token and the symbols they watch", async () => {
    getSession.mockResolvedValue({
      user: { id: "u" },
      csrfToken: "tok",
      providers: [],
      reachable: true,
    });
    GET.mockResolvedValue({ data: { items: [item("AAPL"), item("KO")] } });
    expect(await getWatchlistState()).toEqual({
      signedIn: true,
      csrfToken: "tok",
      symbols: ["AAPL", "KO"],
    });
  });

  it("still gives a working state when the list cannot be read", async () => {
    getSession.mockResolvedValue({
      user: { id: "u" },
      csrfToken: "tok",
      providers: [],
      reachable: true,
    });
    GET.mockRejectedValue(new TypeError("fetch failed"));
    expect(await getWatchlistState()).toEqual({ signedIn: true, csrfToken: "tok", symbols: [] });
  });
});
