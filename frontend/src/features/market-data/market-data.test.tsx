import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import type { Financials } from "./types";

vi.mock("server-only", () => ({}));

const { FilingsList, FinancialsTable } = await import("./index");

const financials: Financials = {
  ticker: "AAPL",
  source: "SEC EDGAR",
  ratios: [],
  metrics: [
    {
      metric: "revenue",
      unit: "USD",
      values: [
        { period_end: "2025-09-27", value: "416161000000", filed: "2025-10-31", form: "10-K" },
        { period_end: "2024-09-28", value: "391035000000", filed: "2024-11-01", form: "10-K" },
      ],
    },
    {
      metric: "net_income",
      unit: "USD",
      values: [{ period_end: "2025-09-27", value: "-5000000", filed: "2025-10-31", form: "10-K" }],
    },
    {
      metric: "eps_diluted",
      unit: "USD/shares",
      values: [{ period_end: "2025-09-27", value: "7.46", filed: "2025-10-31", form: "10-K" }],
    },
  ],
};

describe("FinancialsTable", () => {
  it("shows one column per fiscal year, newest first, with compact money and cent-level EPS", async () => {
    const { container } = render(<FinancialsTable financials={financials} />);

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers.slice(1)).toEqual(["Sep 2025", "Sep 2024"]);

    const revenue = screen.getByRole("row", { name: /Revenue/ });
    expect(
      within(revenue)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["$416.2B", "$391B"]);
    const eps = screen.getByRole("row", { name: /Diluted EPS/ });
    expect(within(eps).getAllByRole("cell")[0]).toHaveTextContent("$7.46");
    await expectNoA11yViolations(container);
  });

  it("marks negative values and fills gaps with a dash", () => {
    render(<FinancialsTable financials={financials} />);
    const income = screen.getByRole("row", { name: /Net income/ });
    expect(
      within(income)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["-$5M", "—"]);
  });

  it("renders nothing when there are no known metrics", () => {
    const { container } = render(<FinancialsTable financials={{ ...financials, metrics: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("FilingsList", () => {
  const filings = [
    {
      accession_number: "0000320193-25-000079",
      form: "10-K",
      filed: "2025-10-31",
      report_date: "2025-09-27",
      description: "10-K",
      url: "https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm",
    },
  ];

  it("links to the filing on sec.gov and says so for assistive tech", async () => {
    const { container } = render(<FilingsList filings={filings} />);
    const link = screen.getByRole("link", { name: /10-K filed Oct 31, 2025 \(opens SEC.gov\)/ });
    expect(link).toHaveAttribute("href", filings[0]!.url);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expectNoA11yViolations(container);
  });
});
