import { afterEach, describe, expect, it, vi } from "vitest";
import { visibleSections } from "./sections";
import { sectionFor, type SectionView } from "./sectionView";

afterEach(() => vi.unstubAllEnvs());

const hrefs = (sections: SectionView[], id: string) =>
  sections.find((section) => section.id === id)?.links.map((link) => link.href);

describe("visibleSections", () => {
  it("is empty while the app shell is off, whatever else is on", () => {
    vi.stubEnv("FEATURE_AUTH", "true");
    vi.stubEnv("FEATURE_CRYPTO", "true");
    vi.stubEnv("FEATURE_CRYPTO_NEWS", "true");
    expect(visibleSections()).toEqual([]);
  });

  it("lists Holdings pages once sign-in is on", () => {
    vi.stubEnv("FEATURE_APP_SHELL", "true");
    expect(visibleSections()).toEqual([]);
    vi.stubEnv("FEATURE_AUTH", "true");
    expect(hrefs(visibleSections(), "holdings")).toEqual(["/portfolio", "/watchlist", "/account"]);
  });

  it("needs two visible pages for a sidebar: one link on its own is not a section", () => {
    vi.stubEnv("FEATURE_APP_SHELL", "true");
    vi.stubEnv("FEATURE_CRYPTO", "true");
    expect(visibleSections()).toEqual([]);
    vi.stubEnv("FEATURE_CRYPTO_NEWS", "true");
    expect(hrefs(visibleSections(), "crypto")).toEqual(["/crypto", "/crypto/news"]);
  });

  it("never lists a crypto subpage while the crypto page itself is off (it would be a dead link)", () => {
    vi.stubEnv("FEATURE_APP_SHELL", "true");
    vi.stubEnv("FEATURE_CRYPTO_NEWS", "true");
    vi.stubEnv("FEATURE_CRYPTO_MARKETS", "true");
    expect(visibleSections()).toEqual([]);
  });

  it("narrows to the mode when the switch is on", () => {
    vi.stubEnv("FEATURE_APP_SHELL", "true");
    vi.stubEnv("FEATURE_AUTH", "true");
    vi.stubEnv("FEATURE_CRYPTO", "true");
    vi.stubEnv("FEATURE_CRYPTO_NEWS", "true");
    vi.stubEnv("FEATURE_MARKETS", "true");
    vi.stubEnv("FEATURE_NEWS", "true");
    expect(visibleSections("crypto").map((s) => s.id)).toEqual(["holdings", "crypto"]);
    expect(visibleSections("stocks").map((s) => s.id)).toEqual(["holdings", "markets"]);
    expect(visibleSections(null).map((s) => s.id)).toEqual(["holdings", "crypto", "markets"]);
  });
});

describe("sectionFor", () => {
  const sections: SectionView[] = [
    {
      id: "crypto",
      label: "Crypto",
      links: [
        { href: "/crypto", label: "Overview", exact: true },
        { href: "/crypto/news", label: "News" },
      ],
    },
    {
      id: "holdings",
      label: "Holdings",
      links: [
        { href: "/portfolio", label: "Portfolio" },
        { href: "/watchlist", label: "Watchlist" },
      ],
    },
  ];

  it("finds the section by any of its pages, including pages beneath them", () => {
    expect(sectionFor(sections, "/crypto")?.id).toBe("crypto");
    expect(sectionFor(sections, "/crypto/news")?.id).toBe("crypto");
    expect(sectionFor(sections, "/watchlist")?.id).toBe("holdings");
  });

  it("finds nothing for pages outside every section", () => {
    expect(sectionFor(sections, "/")).toBeUndefined();
    expect(sectionFor(sections, "/company/AAPL")).toBeUndefined();
    expect(sectionFor(sections, "/search")).toBeUndefined();
    expect(sectionFor(sections, "/crypto/unknown")).toBeUndefined();
  });
});
