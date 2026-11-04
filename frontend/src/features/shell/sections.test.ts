import { afterEach, describe, expect, it, vi } from "vitest";
import { headerItems, visibleSections } from "./sections";
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

  it("does not depend on the mode: a sidebar belongs to the page you are on", () => {
    vi.stubEnv("FEATURE_APP_SHELL", "true");
    vi.stubEnv("FEATURE_MODE_SWITCH", "true");
    vi.stubEnv("FEATURE_AUTH", "true");
    vi.stubEnv("FEATURE_CRYPTO", "true");
    vi.stubEnv("FEATURE_CRYPTO_NEWS", "true");
    vi.stubEnv("FEATURE_MARKETS", "true");
    vi.stubEnv("FEATURE_NEWS", "true");
    expect(visibleSections().map((s) => s.id)).toEqual(["markets", "crypto", "holdings"]);
  });
});

describe("headerItems", () => {
  const allOn = () => {
    vi.stubEnv("FEATURE_APP_SHELL", "true");
    vi.stubEnv("FEATURE_AUTH", "true");
    vi.stubEnv("FEATURE_CRYPTO", "true");
    vi.stubEnv("FEATURE_CRYPTO_MARKETS", "true");
    vi.stubEnv("FEATURE_CRYPTO_NEWS", "true");
    vi.stubEnv("FEATURE_MARKETS", "true");
    vi.stubEnv("FEATURE_NEWS", "true");
  };
  const labels = (mode?: "crypto" | "stocks" | null) => headerItems(mode).map((item) => item.label);

  it("is the usual page links while the app shell is off", () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    vi.stubEnv("FEATURE_CRYPTO_NEWS", "true");
    expect(labels("crypto")).toEqual(["Crypto", "Crypto news"]);
  });

  it("is only the top-level sections with the shell on, per mode", () => {
    allOn();
    expect(labels("crypto")).toEqual(["Crypto", "Holdings"]);
    expect(labels("stocks")).toEqual(["Research", "Markets", "Holdings"]);
    expect(labels(null)).toEqual(["Research", "Markets", "Crypto", "Holdings"]);
  });

  it("holds one link per section and never a section's other pages (those are the sidebar's)", () => {
    allOn();
    const otherPages = visibleSections().flatMap((s) => s.links.slice(1).map((l) => l.href));
    const hrefs = headerItems(null).map((item) => item.href);
    expect(hrefs.filter((href) => otherPages.includes(href))).toEqual([]);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("points each section at its first page and marks it current on all of its pages", () => {
    allOn();
    const crypto = headerItems("crypto").find((item) => item.label === "Crypto");
    expect(crypto?.href).toBe("/crypto");
    expect(crypto?.alsoActive).toEqual(["/crypto", "/crypto/markets", "/crypto/news"]);
    const research = headerItems("stocks").find((item) => item.label === "Research");
    expect(research?.alsoActive).toContain("/company");
  });

  it("drops a section none of whose pages can be shown", () => {
    vi.stubEnv("FEATURE_APP_SHELL", "true");
    expect(labels("crypto")).toEqual([]);
    expect(labels("stocks")).toEqual(["Research"]);
  });

  it("keeps a section with one page in the top bar, though it has no sidebar", () => {
    vi.stubEnv("FEATURE_APP_SHELL", "true");
    vi.stubEnv("FEATURE_CRYPTO", "true");
    expect(labels("crypto")).toEqual(["Crypto"]);
    expect(visibleSections()).toEqual([]);
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
