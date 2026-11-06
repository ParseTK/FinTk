/**
 * The four areas of the Resources section: one source of truth for the overview cards, the
 * "where to begin" questions and the placeholder pages, so a title or address is written once.
 * Plain data (no components) so server and client code can both read it.
 */
export type AreaId = "education" | "sources" | "tools" | "data";

export interface Area {
  id: AreaId;
  href: string;
  /** Short name, also the sidebar label's meaning. */
  title: string;
  /** Page heading and sentence for the placeholder page. */
  summary: string;
  /** What the overview card says. */
  blurb: string;
  tags: readonly string[];
  /** The card's link text. */
  action: string;
  /** Small right-hand label on the card. */
  kind: string;
}

export const AREAS: readonly Area[] = [
  {
    id: "education",
    href: "/resources/education",
    title: "Education",
    summary: "Guides on how markets, portfolios and research work.",
    blurb:
      "Build the knowledge behind your research, from market fundamentals to reading a portfolio.",
    tags: ["Fundamentals", "Portfolio", "Research"],
    action: "Explore the learning library",
    kind: "Guides & frameworks",
  },
  {
    id: "sources",
    href: "/resources/sources",
    title: "Source directory",
    summary: "Where the original documents live and what each publisher covers.",
    blurb:
      "Know where original documents live, what each publisher covers, and how to find the material.",
    tags: ["Agency releases", "Company filings", "Market data"],
    action: "Browse the source directory",
    kind: "Primary references",
  },
  {
    id: "tools",
    href: "/resources/tools",
    title: "Research tools",
    summary: "Simple, transparent utilities for checking figures.",
    blurb:
      "Compare reported period changes and check calculations with simple, transparent utilities.",
    tags: ["Period comparison", "Percentage change"],
    action: "Open the research tools",
    kind: "Interactive utilities",
  },
  {
    id: "data",
    href: "/resources/data",
    title: "Data & methodology",
    summary: "Where the figures come from, how often they update and what is not covered.",
    blurb:
      "Understand where the figures come from, how often they update, and what is outside the coverage.",
    tags: ["Data sources", "Refresh intervals", "Coverage & limits"],
    action: "Understand the data",
    kind: "How FinTk works",
  },
];

/** "Common questions": a question a reader might have, and the area that answers it. */
export const QUESTIONS: ReadonlyArray<{ question: string; area: AreaId; label: string }> = [
  { question: "What does this figure actually represent?", area: "data", label: "Methodology" },
  { question: "Where can I find the original document?", area: "sources", label: "Sources" },
  { question: "I want to understand the foundations.", area: "education", label: "Education" },
];

export const areaById = (id: AreaId): Area => AREAS.find((area) => area.id === id)!;
