import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import type { CryptoNewsData } from "./index";

const GET = vi.fn();
vi.mock("@/lib/api/client", () => ({
  privateApi: { GET: vi.fn() },
  publicApi: { GET: (...args: unknown[]) => GET(...args) },
}));

const { CryptoNews, getCryptoNews } = await import("./index");

const news = (overrides: Partial<CryptoNewsData> = {}): CryptoNewsData => ({
  basis: "Only what official sources published themselves. No opinions, summaries or forecasts.",
  terms: ["crypto", "bitcoin", "digital asset"],
  companies: ["COIN", "MSTR"],
  filing_days: 90,
  per_company_limit: 3,
  unavailable: [],
  items: [
    {
      source: "SEC",
      kind: "press_release",
      title: "SEC charges a crypto platform",
      published: "2026-11-03",
      url: "https://www.sec.gov/newsroom/press-releases/example",
      detail: null,
    },
    {
      source: "Example Corp (SEC filing)",
      kind: "filing",
      title: "Other Events",
      published: "2026-11-02",
      url: "https://www.sec.gov/Archives/example",
      detail: "Items 8.01",
    },
  ],
  ...overrides,
});

beforeEach(() => {
  GET.mockReset();
});

describe("getCryptoNews", () => {
  it("asks for the crypto news with a limit", async () => {
    GET.mockResolvedValue({ data: news() });
    await getCryptoNews(5);
    expect(GET).toHaveBeenCalledWith("/api/v1/news/crypto", { params: { query: { limit: 5 } } });
  });

  it("is null when the API fails or throws", async () => {
    GET.mockResolvedValue({ error: {} });
    expect(await getCryptoNews()).toBeNull();
    GET.mockRejectedValue(new Error("down"));
    expect(await getCryptoNews()).toBeNull();
  });
});

describe("CryptoNews", () => {
  it("features the newest story and lists the rest as links to the source", async () => {
    GET.mockResolvedValue({ data: news() });
    const { container } = render(await CryptoNews());
    const featured = screen.getByRole("article");
    expect(within(featured).getByRole("link")).toHaveAttribute(
      "href",
      "https://www.sec.gov/newsroom/press-releases/example",
    );
    const list = screen.getByRole("list", { name: /official crypto announcements/i });
    expect(within(list).getByRole("link")).toHaveAttribute(
      "href",
      "https://www.sec.gov/Archives/example",
    );
    expect(screen.getByRole("heading", { level: 2, name: "Further reading" })).toBeInTheDocument();
    expect(screen.getByText(/No opinions/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("features the newest by date even when the API sends it last", async () => {
    const data = news();
    GET.mockResolvedValue({ data: { ...data, items: [...data.items].reverse() } });
    render(await CryptoNews());
    expect(within(screen.getByRole("article")).getByRole("link")).toHaveTextContent(
      "SEC charges a crypto platform",
    );
  });

  it("filters by category with toggle buttons, keeps the counts, and announces the result", async () => {
    GET.mockResolvedValue({ data: news() });
    const { container } = render(await CryptoNews());
    const user = userEvent.setup();
    const group = screen.getByRole("group", { name: "Story type" });
    // Only categories that have stories get a tab.
    expect(within(group).queryByRole("button", { name: /CFTC/ })).not.toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "All stories (2)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(group).getByRole("button", { name: "Company filings (1)" }));
    expect(within(group).getByRole("button", { name: /Company filings/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(screen.getByRole("article")).getByRole("link")).toHaveTextContent("Other Events");
    expect(screen.queryByRole("heading", { name: "Further reading" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 story: Company filings");
    await expectNoA11yViolations(container);
  });

  it("prints the rules that choose the items", async () => {
    GET.mockResolvedValue({ data: news() });
    render(await CryptoNews());
    const rules = screen.getByText("How items are chosen").closest("details");
    expect(rules).not.toBeNull();
    expect(rules).toHaveTextContent("crypto, bitcoin, digital asset");
    expect(rules).toHaveTextContent("COIN, MSTR");
    expect(rules).toHaveTextContent("last 90 days, at most the newest 3 of each");
  });

  it("says plainly when nothing matches, rather than showing an error", async () => {
    GET.mockResolvedValue({ data: news({ items: [] }) });
    const { container } = render(await CryptoNews());
    expect(screen.getByText("Nothing to show right now")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("names a source that could not be read, so the list is not taken as complete", async () => {
    GET.mockResolvedValue({ data: news({ unavailable: ["CFTC", "RIOT"] }) });
    render(await CryptoNews());
    expect(screen.getByText(/Could not reach: CFTC, RIOT/)).toBeInTheDocument();
  });

  it("shows a plain message when the API cannot be reached", async () => {
    GET.mockRejectedValue(new Error("down"));
    const { container } = render(await CryptoNews());
    expect(screen.getByText("Crypto news is not available right now")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
