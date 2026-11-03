import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import type { CompanyNews, MarketNews, NewsItem } from "./types";

const GET = vi.fn();
vi.mock("@/lib/api/client", () => ({ publicApi: { GET: (...args: unknown[]) => GET(...args) } }));

const { CompanyEventsSection, getCompanyNews, getMarketNews, MarketNewsSection, NewsList } =
  await import("./index");

const BASIS = "Only what official sources published themselves. No opinions.";

const item = (overrides: Partial<NewsItem> = {}): NewsItem => ({
  source: "Federal Reserve",
  kind: "press_release",
  title: "Federal Reserve issues FOMC statement",
  published: "2026-10-28",
  url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm",
  detail: null,
  ...overrides,
});

const market = (overrides: Partial<MarketNews> = {}): MarketNews => ({
  basis: BASIS,
  items: [item(), item({ source: "SEC", title: "SEC charges a firm", published: "2026-10-29" })],
  unavailable: [],
  ...overrides,
});

const filing = (): NewsItem =>
  item({
    source: "Apple Inc. (SEC filing)",
    kind: "filing",
    title: "Results of Operations and Financial Condition",
    url: "https://www.sec.gov/Archives/edgar/data/320193/x/aapl-20261102.htm",
    detail: "Items 2.02, 9.01",
  });

beforeEach(() => {
  GET.mockReset(); // braces: a returned function would be run by vitest as a cleanup hook
});

describe("NewsList", () => {
  it("shows the headline as a link out, with who published it and when", () => {
    render(<NewsList items={[item()]} label="Announcements" />);
    const link = screen.getByRole("link", { name: /Federal Reserve issues FOMC statement/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("federalreserve.gov"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAccessibleName("Federal Reserve issues FOMC statement (opens in a new tab)");
    expect(screen.getByText(/Federal Reserve ·/)).toBeInTheDocument();
    expect(screen.getByText("Oct 28, 2026")).toHaveAttribute("datetime", "2026-10-28");
  });

  it("shows the 8-K item numbers for a filing", () => {
    render(<NewsList items={[filing()]} label="Events" />);
    expect(screen.getByText(/Items 2\.02, 9\.01/)).toBeInTheDocument();
  });

  it("never renders a link that is not https, whatever the API sent", () => {
    render(
      <NewsList
        items={[
          item({ url: "javascript:alert(1)", title: "bad one" }),
          item({ url: "http://www.federalreserve.gov/x", title: "plain http" }),
        ]}
        label="Announcements"
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("bad one")).toBeInTheDocument();
  });

  it("shows markup in a title as text, not as markup", () => {
    render(<NewsList items={[item({ title: "<img src=x onerror=alert(1)>" })]} label="A" />);
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("data", () => {
  it("returns the news, and null rather than throwing when the API fails", async () => {
    GET.mockResolvedValue({ data: market() });
    expect((await getMarketNews())?.items).toHaveLength(2);
    GET.mockRejectedValue(new Error("down"));
    expect(await getMarketNews()).toBeNull();
    expect(await getCompanyNews("AAPL")).toBeNull();
  });

  it("does not call the API for a ticker that cannot be valid", async () => {
    expect(await getCompanyNews("../etc")).toBeNull();
    expect(GET).not.toHaveBeenCalled();
  });
});

describe("MarketNewsSection", () => {
  async function renderPage(data: MarketNews | null) {
    GET.mockResolvedValue({ data: data ?? undefined });
    return render(await MarketNewsSection());
  }

  it("states its basis and lists the announcements", async () => {
    await renderPage(market());
    expect(screen.getByText(BASIS)).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Official announcements, newest first" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("says which source could not be read instead of looking complete", async () => {
    await renderPage(market({ unavailable: ["SEC"] }));
    expect(screen.getByText("Some sources are unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Could not reach: SEC/)).toBeInTheDocument();
  });

  it("says plainly when there is nothing", async () => {
    await renderPage(market({ items: [] }));
    expect(screen.getByText("No announcements yet")).toBeInTheDocument();
  });

  it("shows a plain message, not an error screen, when the API is down", async () => {
    await renderPage(null);
    expect(screen.getByText("News is not available right now")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderPage(market({ unavailable: ["SEC"] }));
    await expectNoA11yViolations(container);
  });
});

describe("CompanyEventsSection", () => {
  const company = (items: NewsItem[]): CompanyNews => ({ ticker: "AAPL", basis: BASIS, items });
  async function renderPage(data: CompanyNews | null) {
    GET.mockResolvedValue({ data: data ?? undefined });
    return render(await CompanyEventsSection({ symbol: "AAPL" }));
  }

  it("lists the company's own 8-K events and says where they come from", async () => {
    await renderPage(company([filing()]));
    expect(screen.getByRole("heading", { name: "Recent company events" })).toBeInTheDocument();
    expect(screen.getByText(/Reported by the company itself to the SEC/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Results of Operations and Financial Condition/ }),
    ).toBeInTheDocument();
  });

  it("says plainly when there are no events", async () => {
    await renderPage(company([]));
    expect(screen.getByText(/No recent events were reported/)).toBeInTheDocument();
  });

  it("shows a plain message when the API is unavailable", async () => {
    await renderPage(null);
    expect(screen.getByText(/not available right now/)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderPage(company([filing()]));
    await expectNoA11yViolations(container);
  });
});
