import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";

const push = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: vi.fn(() => "/"),
  useRouter: () => ({ push }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const GET = vi.fn();
vi.mock("@/lib/api/client", () => ({
  privateApi: { GET: (...args: unknown[]) => GET(...args) },
  publicApi: { GET: vi.fn() },
}));

const { CoinPage, CoinSearch, SearchResults, getCoin } = await import("./index");
const { findCoins } = await import("./actions");

const attribution = {
  text: "Data provided by CoinMarketCap.com",
  url: "https://coinmarketcap.com/",
};
const hit = (rank: number, name: string, symbol: string, slug: string) => ({
  rank,
  name,
  symbol,
  slug,
});
const found = (...results: ReturnType<typeof hit>[]) => ({
  data: { attribution, as_of: "2026-11-05T01:00:00Z", results },
});
const BTC = hit(1, "Bitcoin", "BTC", "bitcoin");
const BCH = hit(17, "Bitcoin Cash", "BCH", "bitcoin-cash");

const detail = (overrides: Record<string, unknown> = {}) => ({
  attribution,
  as_of: "2026-11-05T01:00:00Z",
  rank: 1,
  name: "Bitcoin",
  symbol: "BTC",
  slug: "bitcoin",
  price: "80500.24",
  change_1h: "-0.35",
  change_24h: "5.23",
  change_7d: "0.83",
  change_30d: "-5.91",
  change_90d: "25.00",
  market_cap: "1618486807934.99",
  fully_diluted_market_cap: "1690505144603.69",
  volume_24h: "39816175996.12",
  circulating_supply: "20105365.0000",
  total_supply: "20105365.0000",
  max_supply: "21000000.0000",
  ...overrides,
});

beforeEach(() => {
  GET.mockReset();
  push.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("findCoins (the search box's server action)", () => {
  it("returns only a name, a symbol and a slug", async () => {
    GET.mockResolvedValue(found(BTC));
    expect(await findCoins("bit")).toEqual([{ name: "Bitcoin", symbol: "BTC", slug: "bitcoin" }]);
  });

  it.each([undefined, null, 5, {}, ["a"], "", "   "])("ignores input that is %j", async (input) => {
    expect(await findCoins(input)).toEqual([]);
    expect(GET).not.toHaveBeenCalled();
  });

  it("caps the query and asks for a handful of suggestions", async () => {
    GET.mockResolvedValue(found());
    await findCoins("x".repeat(500));
    const { query } = GET.mock.calls[0]![1].params;
    expect(query.q).toHaveLength(40);
    expect(query.limit).toBe(8);
  });

  it("is empty, not an error, when the API is down", async () => {
    GET.mockRejectedValue(new Error("down"));
    expect(await findCoins("bit")).toEqual([]);
  });
});

describe("CoinSearch", () => {
  const setup = () => {
    const user = userEvent.setup();
    const view = render(<CoinSearch />);
    return {
      user,
      input: screen.getByRole("combobox", { name: "Search coins by name or symbol" }),
      ...view,
    };
  };

  it("is a labelled search landmark with a combobox that starts collapsed", async () => {
    const { container, input } = setup();
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    await expectNoA11yViolations(container);
  });

  it("without JavaScript submits to the search page", () => {
    setup();
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("action", "/crypto/search");
    expect(form).toHaveAttribute("method", "get");
    expect(within(form).getByRole("combobox")).toHaveAttribute("name", "q");
  });

  it("shows suggestions after typing and announces how many", async () => {
    GET.mockResolvedValue(found(BTC, BCH));
    const { user, input } = setup();
    await user.type(input, "bit");
    const list = await screen.findByRole("listbox", { name: "Coin suggestions" });
    expect(within(list).getAllByRole("option")).toHaveLength(2);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("status")).toHaveTextContent(/2 suggestions/);
  });

  it("moves with the arrow keys, wraps, and opens the highlighted coin with Enter", async () => {
    GET.mockResolvedValue(found(BTC, BCH));
    const { user, input } = setup();
    await user.type(input, "bit");
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", options[0]!.id);
    await user.keyboard("{ArrowDown}{ArrowDown}"); // past the end wraps to the first
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}"); // before the first wraps to the last
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/crypto/coins/bitcoin-cash");
    expect(input).toHaveValue("");
  });

  it("opens a coin when its suggestion is clicked", async () => {
    GET.mockResolvedValue(found(BTC, BCH));
    const { user } = setup();
    await user.type(screen.getByRole("combobox"), "bit");
    await user.click(await screen.findByRole("option", { name: "Bitcoin BTC" }));
    expect(push).toHaveBeenCalledWith("/crypto/coins/bitcoin");
  });

  it("closes on Escape but keeps what was typed, and Enter with nothing highlighted is left to the form", async () => {
    GET.mockResolvedValue(found(BTC));
    const { user, input } = setup();
    await user.type(input, "bit");
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveValue("bit");
    await user.keyboard("{Enter}");
    expect(push).not.toHaveBeenCalled();
  });

  it("says so when nothing matches, and offers the full search", async () => {
    GET.mockResolvedValue(found());
    const { user, input } = setup();
    await user.type(input, "zzzz");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/No coins found/));
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("asks once after a pause, not for every keystroke", async () => {
    GET.mockResolvedValue(found(BTC));
    const { user, input } = setup();
    await user.type(input, "bitcoin");
    await screen.findByRole("listbox");
    expect(GET.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("ignores an answer that arrives after a newer one", async () => {
    let finishSlow: (value: unknown) => void = () => {};
    GET.mockImplementationOnce(() => new Promise((resolve) => (finishSlow = resolve)));
    GET.mockResolvedValueOnce(found(BCH));
    const { user, input } = setup();
    await user.type(input, "b");
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)));
    await user.type(input, "c");
    const list = await screen.findByRole("listbox");
    expect(within(list).getByRole("option")).toHaveTextContent("Bitcoin Cash");
    await act(async () => finishSlow(found(BTC))); // the slow, older answer
    expect(within(screen.getByRole("listbox")).getByRole("option")).toHaveTextContent(
      "Bitcoin Cash",
    );
  });

  it("clearing the box hides the list", async () => {
    GET.mockResolvedValue(found(BTC));
    const { user, input } = setup();
    await user.type(input, "bit");
    await screen.findByRole("listbox");
    await user.clear(input);
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("shows hostile names as text", async () => {
    GET.mockResolvedValue(found(hit(1, "<img src=x onerror=alert(1)>", "X", "x")));
    const { user, input } = setup();
    await user.type(input, "img");
    await screen.findByRole("option");
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("SearchResults", () => {
  it("lists the matches as links to each coin with the credit", async () => {
    GET.mockResolvedValue(found(BTC, BCH));
    const { container } = render(await SearchResults({ query: "bit" }));
    expect(screen.getByRole("heading", { level: 1, name: "Search coins" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("2 matches for “bit”");
    expect(screen.getByRole("link", { name: /Bitcoin Cash/ })).toHaveAttribute(
      "href",
      "/crypto/coins/bitcoin-cash",
    );
    expect(screen.getByRole("link", { name: "CoinMarketCap.com" })).toHaveAttribute(
      "href",
      "https://coinmarketcap.com/",
    );
    await expectNoA11yViolations(container);
  });

  it("asks for nothing and shows only the heading when there is no query", async () => {
    render(await SearchResults({ query: undefined }));
    expect(GET).not.toHaveBeenCalled();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("says plainly when nothing matches", async () => {
    GET.mockResolvedValue(found());
    render(await SearchResults({ query: "zzzz" }));
    expect(screen.getByText(/No coins match "zzzz"/)).toBeInTheDocument();
  });

  it("says so when the search cannot be reached, instead of claiming no matches", async () => {
    GET.mockRejectedValue(new Error("down"));
    render(await SearchResults({ query: "bit" }));
    expect(screen.getByText("Search is not available right now")).toBeInTheDocument();
  });

  it("caps a long query", async () => {
    GET.mockResolvedValue(found());
    await SearchResults({ query: "y".repeat(200) });
    expect(GET.mock.calls[0]![1].params.query.q).toHaveLength(40);
  });
});

describe("getCoin", () => {
  it("tells a coin we do not cover from a service that is down", async () => {
    GET.mockResolvedValue({ data: undefined, response: { status: 404 } });
    expect(await getCoin("nope")).toEqual({ status: "not_found" });
    GET.mockResolvedValue({ data: undefined, response: { status: 502 } });
    expect(await getCoin("bitcoin")).toEqual({ status: "unavailable" });
    GET.mockRejectedValue(new Error("down"));
    expect(await getCoin("bitcoin")).toEqual({ status: "unavailable" });
  });
});

describe("CoinPage", () => {
  const page = async (body: unknown) => {
    GET.mockResolvedValue(body);
    return render(await CoinPage({ slug: "bitcoin" }));
  };

  it("shows the name, the price, a signed change per period, the key figures and the credit", async () => {
    const { container } = await page({ data: detail() });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bitcoin BTC");
    expect(screen.getByText("Ranked number 1 by market value.")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /Bitcoin price change over each period/ });
    expect(within(table).getByRole("row", { name: /1 hour.*-0\.35%/ })).toBeInTheDocument();
    expect(within(table).queryByRole("row", { name: /Year to date/ })).not.toBeInTheDocument();
    const stats = screen.getByRole("region", { name: "Key figures" });
    expect(stats).toHaveTextContent(/Market cap\s*\$1\.6T/);
    expect(stats).toHaveTextContent(/Circulating supply\s*20,105,365 BTC/);
    expect(stats).toHaveTextContent(/Maximum supply\s*21,000,000 BTC/);
    expect(screen.getAllByRole("link", { name: "CoinMarketCap.com" })).toHaveLength(1);
    expect(screen.getByText(/not investment advice/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("says a missing figure is not available, and that no maximum was reported, never zero", async () => {
    await page({ data: detail({ max_supply: null, market_cap: null, total_supply: null }) });
    const stats = screen.getByRole("region", { name: "Key figures" });
    expect(stats).toHaveTextContent(/Maximum supply\s*No fixed maximum reported/);
    expect(stats).toHaveTextContent(/Market cap\s*Not available/);
    expect(stats).toHaveTextContent(/Total supply\s*Not available/);
  });

  it("is a 404 for a coin the site does not cover", async () => {
    GET.mockResolvedValue({ data: undefined, response: { status: 404 } });
    await expect(CoinPage({ slug: "nope" })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows a plain message, not a 404, while the service is down", async () => {
    await page({ data: undefined, response: { status: 502 } });
    expect(screen.getByText("This coin's figures are not available right now")).toBeInTheDocument();
  });

  it("shows hostile names as text", async () => {
    await page({ data: detail({ name: "<img src=x onerror=alert(1)>" }) });
    expect(document.querySelector("img")).toBeNull();
  });
});
