import { afterEach, describe, expect, it, vi } from "vitest";
import { footerColumns, headerItems, visibleSections } from "./sections";
import { sectionFor, type SectionView } from "./sectionView";

afterEach(() => vi.unstubAllEnvs());

const hrefs = (sections: SectionView[], id: string) =>
  sections.find((section) => section.id === id)?.links.map((link) => link.href);

describe("visibleSections", () => {
  it("is empty while the crypto pages are off", () => {
    expect(visibleSections()).toEqual([]);
  });

  it("needs two visible pages for a sidebar: one link on its own is not a section", () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    expect(visibleSections()).toEqual([]);
    vi.stubEnv("FEATURE_CRYPTO_NEWS", "true");
    expect(hrefs(visibleSections(), "crypto")).toEqual(["/crypto", "/crypto/news"]);
    vi.stubEnv("FEATURE_CRYPTO_MARKETS", "true");
    expect(hrefs(visibleSections(), "crypto")).toEqual([
      "/crypto",
      "/crypto/markets",
      "/crypto/news",
    ]);
  });

  it("never lists a crypto subpage while the crypto page itself is off (it would be a dead link)", () => {
    vi.stubEnv("FEATURE_CRYPTO_NEWS", "true");
    vi.stubEnv("FEATURE_CRYPTO_MARKETS", "true");
    expect(visibleSections()).toEqual([]);
  });
});

describe("headerItems", () => {
  it("is empty while the crypto pages are off, so there is never a dead link", () => {
    expect(headerItems()).toEqual([]);
  });

  it("is one link to the section's first page, current on all of its pages", () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    vi.stubEnv("FEATURE_CRYPTO_MARKETS", "true");
    vi.stubEnv("FEATURE_CRYPTO_NEWS", "true");
    const items = headerItems();
    expect(items.map((item) => item.label)).toEqual(["Crypto"]);
    expect(items[0]?.href).toBe("/crypto");
    expect(items[0]?.alsoActive).toEqual(["/crypto", "/crypto/markets", "/crypto/news"]);
  });

  it("keeps a section with one page in the header, though it has no sidebar", () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    expect(headerItems().map((item) => item.label)).toEqual(["Crypto"]);
    expect(visibleSections()).toEqual([]);
  });

  it("never lists a section's other pages (those are the sidebar's)", () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    vi.stubEnv("FEATURE_CRYPTO_NEWS", "true");
    const otherPages = visibleSections().flatMap((s) => s.links.slice(1).map((l) => l.href));
    const hrefs = headerItems().map((item) => item.href);
    expect(hrefs.filter((href) => otherPages.includes(href))).toEqual([]);
  });
});

describe("footerColumns", () => {
  it("is empty while the crypto pages are off", () => {
    expect(footerColumns()).toEqual([]);
  });

  it("lists a section with even one page, with every visible page under it", () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    expect(hrefs(footerColumns(), "crypto")).toEqual(["/crypto"]);
    vi.stubEnv("FEATURE_CRYPTO_NEWS", "true");
    vi.stubEnv("FEATURE_CRYPTO_MARKETS", "true");
    expect(hrefs(footerColumns(), "crypto")).toEqual([
      "/crypto",
      "/crypto/markets",
      "/crypto/news",
    ]);
  });
});

describe("the search section", () => {
  it("is in the footer but not the header (the header has the search box) or the sidebar", () => {
    vi.stubEnv("FEATURE_CRYPTO", "true");
    vi.stubEnv("FEATURE_CRYPTO_SEARCH", "true");
    expect(hrefs(footerColumns(), "search")).toEqual(["/crypto/search"]);
    expect(headerItems().map((item) => item.label)).toEqual(["Crypto"]);
    expect(visibleSections()).toEqual([]);
  });

  it("needs both the crypto and the search flag", () => {
    vi.stubEnv("FEATURE_CRYPTO_SEARCH", "true");
    expect(footerColumns()).toEqual([]);
    vi.stubEnv("FEATURE_CRYPTO", "true");
    vi.stubEnv("FEATURE_CRYPTO_SEARCH", "false");
    expect(hrefs(footerColumns(), "search")).toBeUndefined();
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
      id: "other",
      label: "Other",
      links: [
        { href: "/a", label: "A" },
        { href: "/b", label: "B" },
      ],
    },
  ];

  it("finds the section by any of its pages, including pages beneath them", () => {
    expect(sectionFor(sections, "/crypto")?.id).toBe("crypto");
    expect(sectionFor(sections, "/crypto/news")?.id).toBe("crypto");
    expect(sectionFor(sections, "/b")?.id).toBe("other");
  });

  it("finds nothing for pages outside every section", () => {
    expect(sectionFor(sections, "/")).toBeUndefined();
    expect(sectionFor(sections, "/account")).toBeUndefined();
    expect(sectionFor(sections, "/crypto/unknown")).toBeUndefined();
  });
});
