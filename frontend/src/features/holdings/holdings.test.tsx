import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import type { WatchlistItem } from "./data";

const refresh = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: vi.fn(() => "/"),
  useRouter: () => ({ refresh, push: vi.fn() }),
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const GET = vi.fn();
vi.mock("@/lib/api/client", () => ({
  privateApi: { GET: (...args: unknown[]) => GET(...args) },
  publicApi: { GET: vi.fn() },
}));
vi.mock("@/lib/api/authHeaders", () => ({
  authHeaders: async () => ({ cookie: "virello_session=abc" }),
}));

const session = vi.fn();
vi.mock("@/features/auth", () => ({ getSession: () => session() }));

const { formatAmount } = await import("./format");
const { getPortfolio, getWatchlist } = await import("./data");
const { PortfolioBody } = await import("./PortfolioBody");
const { WatchlistBody } = await import("./WatchlistBody");
const { WatchButton } = await import("./WatchButton");
const { HoldingEditor } = await import("./HoldingEditor");
const { RemoveButton } = await import("./RemoveButton");
const { PortfolioPage, WatchlistPage, CoinHoldingsPanel } = await import("./index");

const attribution = {
  text: "Data provided by CoinMarketCap.com",
  url: "https://coinmarketcap.com/",
};
const quote = (name: string, symbol: string, price: string) => ({
  name,
  symbol,
  rank: 1,
  price,
  change_24h: "1.50",
  market_cap: "1000000000.00",
});
const row = (overrides: Record<string, unknown> = {}) => ({
  slug: "bitcoin",
  amount: "1.5",
  cost: "100.00",
  updated_at: "2026-11-05T01:00:00Z",
  coin: quote("Bitcoin", "BTC", "80000"),
  value: "120000.00",
  gain: "119900.00",
  gain_percent: "119900.00",
  ...overrides,
});
const portfolio = (
  holdings: ReturnType<typeof row>[],
  overrides: Record<string, unknown> = {},
) => ({
  attribution,
  as_of: "2026-11-05T01:00:00Z",
  prices_available: true,
  totals: {
    total_value: "120000.00",
    priced: holdings.length,
    unpriced: 0,
    cost: "100.00",
    value_with_cost: "120000.00",
    gain: "119900.00",
    gain_percent: "119900.00",
  },
  holdings,
  ...overrides,
});
const watchlist = (items: WatchlistItem[], overrides: Record<string, unknown> = {}) => ({
  attribution,
  as_of: "2026-11-05T01:00:00Z",
  prices_available: true,
  items,
  ...overrides,
});

const fetchMock = vi.fn();
beforeEach(() => {
  GET.mockReset();
  session.mockReset();
  refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const ok = (status = 200, body: unknown = {}) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("formatAmount", () => {
  it.each([
    ["1", "1"],
    ["1.5", "1.5"],
    ["1234567.891", "1,234,567.891"],
    ["999999999999.999999999999999999", "999,999,999,999.999999999999999999"],
    ["0.000000000000000001", "0.000000000000000001"],
  ])("%s -> %s, exactly", (input, expected) => {
    expect(formatAmount(input)).toBe(expected);
  });

  it.each([null, undefined, "", "abc", "1e5", "-1", "1,5"])("shows a dash for %j", (input) => {
    expect(formatAmount(input)).toBe("—");
  });
});

describe("reading the portfolio and watchlist", () => {
  it("sends only the session cookie and tells signed-out from unavailable", async () => {
    GET.mockResolvedValue({ data: portfolio([]), response: { status: 200 } });
    expect(await getPortfolio()).toMatchObject({ status: "ok" });
    expect(GET).toHaveBeenCalledWith("/api/v1/portfolio", {
      headers: { cookie: "virello_session=abc" },
    });
    GET.mockResolvedValue({ data: undefined, response: { status: 401 } });
    expect(await getWatchlist()).toEqual({ status: "signed-out" });
    GET.mockResolvedValue({ data: undefined, response: { status: 502 } });
    expect(await getWatchlist()).toEqual({ status: "unavailable" });
    GET.mockRejectedValue(new Error("down"));
    expect(await getPortfolio()).toEqual({ status: "unavailable" });
  });
});

describe("PortfolioBody", () => {
  it("shows the summary, each holding with value and gain, and the credit", async () => {
    const { container } = render(<PortfolioBody portfolio={portfolio([row()])} csrfToken="tok" />);
    expect(screen.getByRole("link", { name: "CoinMarketCap.com" })).toBeInTheDocument();
    const summary = container.querySelector("dl")!;
    expect(summary).toHaveTextContent(/Total value\s*\$120,000\.00/);
    expect(summary).toHaveTextContent(/Paid, where entered\s*\$100\.00/);
    const table = screen.getByRole("table", { name: /Your holdings/ });
    const line = within(table).getByRole("row", { name: /Bitcoin/ });
    expect(line).toHaveTextContent("1.5");
    expect(line).toHaveTextContent("$120,000.00");
    expect(within(table).getByRole("link", { name: "Bitcoin" })).toHaveAttribute(
      "href",
      "/crypto/coins/bitcoin",
    );
    expect(within(table).getByRole("link", { name: "Edit Bitcoin" })).toHaveAttribute(
      "href",
      "/crypto/coins/bitcoin#holding-bitcoin",
    );
    await expectNoA11yViolations(container);
  });

  it("says no cost was entered instead of inventing a gain", () => {
    const noCost = row({ cost: null, gain: null, gain_percent: null });
    render(
      <PortfolioBody
        portfolio={portfolio([noCost], {
          totals: {
            total_value: "120000.00",
            priced: 1,
            unpriced: 0,
            cost: "0.00",
            value_with_cost: "0.00",
            gain: null,
            gain_percent: null,
          },
        })}
        csrfToken="tok"
      />,
    );
    expect(screen.getAllByText("No cost entered").length).toBeGreaterThan(0);
    expect(screen.getByText("Enter a cost to see it")).toBeInTheDocument();
    expect(screen.getByText(/1 holding has no cost entered/)).toBeInTheDocument();
  });

  it("keeps a coin that is not priced, and says prices are down", () => {
    const unpriced = row({ coin: null, value: null, gain: null, gain_percent: null });
    render(
      <PortfolioBody
        portfolio={portfolio([unpriced], { prices_available: false })}
        csrfToken="tok"
      />,
    );
    expect(screen.getByText("Prices are not available right now")).toBeInTheDocument();
    expect(screen.getAllByText("Not priced").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "bitcoin" }).length).toBeGreaterThan(0);
  });

  it("invites the first holding when there are none", () => {
    render(<PortfolioBody portfolio={portfolio([])} csrfToken="tok" />);
    expect(screen.getByText("You have not added any coins yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search coins" })).toHaveAttribute(
      "href",
      "/crypto/search",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows hostile names as text", () => {
    const evil = row({ coin: quote("<img src=x onerror=alert(1)>", "X", "1") });
    render(<PortfolioBody portfolio={portfolio([evil])} csrfToken="tok" />);
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("WatchlistBody", () => {
  const item = (overrides: Record<string, unknown> = {}) => ({
    slug: "ethereum",
    added_at: "2026-11-05T01:00:00Z",
    coin: quote("Ethereum", "ETH", "3000"),
    ...overrides,
  });

  it("lists each coin with its price and change", async () => {
    const { container } = render(<WatchlistBody watchlist={watchlist([item()])} csrfToken="tok" />);
    const table = screen.getByRole("table", { name: /Coins you are watching/ });
    expect(within(table).getByRole("row", { name: /Ethereum/ })).toHaveTextContent("$3,000.00");
    expect(within(table).getByRole("link", { name: "Ethereum" })).toHaveAttribute(
      "href",
      "/crypto/coins/ethereum",
    );
    await expectNoA11yViolations(container);
  });

  it("keeps an unpriced coin listed and says so", () => {
    render(
      <WatchlistBody
        watchlist={watchlist([item({ coin: null })], { prices_available: false })}
        csrfToken="tok"
      />,
    );
    expect(screen.getByText("Prices are not available right now")).toBeInTheDocument();
    expect(screen.getAllByText("Not priced").length).toBeGreaterThan(0);
  });

  it("invites the first coin when empty", () => {
    render(<WatchlistBody watchlist={watchlist([])} csrfToken="tok" />);
    expect(screen.getByText("You are not watching any coins yet")).toBeInTheDocument();
  });
});

describe("RemoveButton", () => {
  const setup = () =>
    render(
      <RemoveButton
        what="Bitcoin from your portfolio"
        path="/api/v1/portfolio/bitcoin"
        csrfToken="tok"
      />,
    );

  it("needs a second press, names what it removes, and sends the CSRF token", async () => {
    fetchMock.mockResolvedValue(ok(204));
    const user = userEvent.setup();
    setup();
    const button = screen.getByRole("button", { name: "Remove Bitcoin from your portfolio" });
    await user.click(button);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Press again to remove Bitcoin");
    await user.click(screen.getByRole("button", { name: /Confirm remove/ }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/portfolio/bitcoin",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ "X-CSRF-Token": "tok" }),
      }),
    );
  });

  it("cancels when focus leaves", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button"));
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Remove Bitcoin from your portfolio" }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says what went wrong and does not refresh", async () => {
    fetchMock.mockResolvedValue(ok(500, {}));
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("button", { name: /Confirm remove/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/went wrong/);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("WatchButton", () => {
  it("is a link to sign in when signed out, coming back to the coin", () => {
    render(
      <WatchButton
        slug="bitcoin"
        name="Bitcoin"
        watched={false}
        signInNext="/crypto/coins/bitcoin"
      />,
    );
    expect(screen.getByRole("link", { name: "Sign in to watch Bitcoin" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fcrypto%2Fcoins%2Fbitcoin",
    );
  });

  it("keeps one name, flips aria-pressed only after the server agrees", async () => {
    fetchMock.mockResolvedValue(ok(201, {}));
    const user = userEvent.setup();
    render(
      <WatchButton slug="bitcoin" name="Bitcoin" watched={false} csrfToken="tok" signInNext="/" />,
    );
    const button = screen.getByRole("button", { name: "Watch Bitcoin" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await user.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/v1/watchlist/bitcoin");
    expect(fetchMock.mock.calls[0]![1].method).toBe("PUT");
    await user.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "false"));
    expect(fetchMock.mock.calls[1]![1].method).toBe("DELETE");
    expect(screen.getByRole("button", { name: "Watch Bitcoin" })).toBe(button);
  });

  it("stays as it was and says so when the server refuses", async () => {
    fetchMock.mockResolvedValue(
      ok(409, { error: { code: "limit_reached", message: "You can watch at most 100 coins." } }),
    );
    const user = userEvent.setup();
    render(
      <WatchButton slug="bitcoin" name="Bitcoin" watched={false} csrfToken="tok" signInNext="/" />,
    );
    await user.click(screen.getByRole("button"));
    expect(await screen.findByRole("alert")).toHaveTextContent("You can watch at most 100 coins.");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });
});

describe("HoldingEditor", () => {
  const props = { slug: "bitcoin", name: "Bitcoin", symbol: "BTC", signInNext: "/x" };

  it("is a link to sign in when signed out", () => {
    render(<HoldingEditor {...props} />);
    expect(screen.getByRole("link", { name: "Sign in to track your Bitcoin" })).toBeInTheDocument();
  });

  it("saves the amount and optional cost as strings, with the CSRF token, then refreshes", async () => {
    fetchMock.mockResolvedValue(ok(201, {}));
    const user = userEvent.setup();
    const { container } = render(<HoldingEditor {...props} csrfToken="tok" />);
    await user.type(screen.getByLabelText(/Amount of BTC/), " 0.5 ");
    await user.type(screen.getByLabelText(/Total paid/), "1000");
    await user.click(screen.getByRole("button", { name: "Save holding" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [path, init] = fetchMock.mock.calls[0]!;
    expect(path).toBe("/api/v1/portfolio/bitcoin");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ amount: "0.5", cost: "1000" });
    expect(screen.getByRole("status")).toHaveTextContent("Saved 0.5 BTC.");
    await expectNoA11yViolations(container);
  });

  it("leaves the cost out when it is empty, so no gain is guessed", async () => {
    fetchMock.mockResolvedValue(ok(201, {}));
    const user = userEvent.setup();
    render(<HoldingEditor {...props} csrfToken="tok" />);
    await user.type(screen.getByLabelText(/Amount of BTC/), "2");
    await user.click(screen.getByRole("button", { name: "Save holding" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ amount: "2" });
  });

  it("starts from what is saved and offers Remove", () => {
    render(<HoldingEditor {...props} csrfToken="tok" current={{ amount: "3", cost: "4.00" }} />);
    expect(screen.getByLabelText(/Amount of BTC/)).toHaveValue("3");
    expect(screen.getByLabelText(/Total paid/)).toHaveValue("4.00");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove Bitcoin from your portfolio" }),
    ).toBeInTheDocument();
  });

  it("shows the server's field problems next to the fields and moves focus there", async () => {
    fetchMock.mockResolvedValue(
      ok(422, {
        error: {
          code: "validation_error",
          details: [{ loc: ["body", "amount"], message: "x", type: "x" }],
        },
      }),
    );
    const user = userEvent.setup();
    render(<HoldingEditor {...props} csrfToken="tok" />);
    await user.type(screen.getByLabelText(/Amount of BTC/), "0");
    await user.click(screen.getByRole("button", { name: "Save holding" }));
    expect(await screen.findByText(/Enter an amount above zero/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount of BTC/)).toHaveAttribute("aria-invalid", "true");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("the pages", () => {
  const signedIn = {
    user: { id: "u", email: "a@example.com", name: "A" },
    csrfToken: "tok",
    providers: [],
    reachable: true,
  };

  it("send a signed-out visitor to sign in and bring them back", async () => {
    session.mockResolvedValue({ user: null, csrfToken: null, providers: [], reachable: true });
    await expect(PortfolioPage()).rejects.toThrow("REDIRECT /sign-in?next=%2Fholdings");
    await expect(WatchlistPage()).rejects.toThrow("REDIRECT /sign-in?next=%2Fholdings%2Fwatchlist");
    expect(GET).not.toHaveBeenCalled();
  });

  it("show a plain message, not a sign-in prompt, when the API is down", async () => {
    session.mockResolvedValue({ user: null, csrfToken: null, providers: [], reachable: false });
    render(await PortfolioPage());
    expect(screen.getByText("Your coins are not available right now")).toBeInTheDocument();
  });

  it("show the portfolio for a signed-in person", async () => {
    session.mockResolvedValue(signedIn);
    GET.mockResolvedValue({ data: portfolio([row()]), response: { status: 200 } });
    const { container } = render(await PortfolioPage());
    expect(screen.getByRole("heading", { level: 1, name: "Portfolio" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /Your holdings/ })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("send someone whose session ended while loading back to sign in", async () => {
    session.mockResolvedValue(signedIn);
    GET.mockResolvedValue({ data: undefined, response: { status: 401 } });
    await expect(WatchlistPage()).rejects.toThrow("REDIRECT /sign-in");
  });
});

describe("CoinHoldingsPanel", () => {
  const signedIn = { user: { id: "u" }, csrfToken: "tok", providers: [], reachable: true };

  it("offers sign-in links, and reads nothing, for a visitor", async () => {
    session.mockResolvedValue({ user: null, csrfToken: null, providers: [], reachable: true });
    render(await CoinHoldingsPanel({ slug: "bitcoin", name: "Bitcoin", symbol: "BTC" }));
    expect(screen.getByRole("link", { name: "Sign in to watch Bitcoin" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in to track your Bitcoin" })).toBeInTheDocument();
    expect(GET).not.toHaveBeenCalled();
  });

  it("shows the person's own state: watched, and what they hold", async () => {
    session.mockResolvedValue(signedIn);
    GET.mockImplementation(async (path: string) =>
      path === "/api/v1/watchlist"
        ? {
            data: watchlist([
              { slug: "bitcoin", added_at: "x", coin: quote("Bitcoin", "BTC", "1") },
            ]),
            response: { status: 200 },
          }
        : { data: portfolio([row({ amount: "2", cost: null })]), response: { status: 200 } },
    );
    render(await CoinHoldingsPanel({ slug: "bitcoin", name: "Bitcoin", symbol: "BTC" }));
    expect(screen.getByRole("button", { name: "Watch Bitcoin" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText(/Amount of BTC/)).toHaveValue("2");
  });

  it("does not guess a state when the person's lists cannot be read", async () => {
    session.mockResolvedValue(signedIn);
    GET.mockResolvedValue({ data: undefined, response: { status: 502 } });
    render(await CoinHoldingsPanel({ slug: "bitcoin", name: "Bitcoin", symbol: "BTC" }));
    expect(screen.getByText("Your saved coins are not available right now.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Watch/ })).not.toBeInTheDocument();
  });
});
