import { formatDate } from "@/lib/format";
import type { Filing } from "./api/types";

export function FilingsList({ filings }: { filings: Filing[] }) {
  return (
    <ul className="divide-border divide-y">
      {filings.map((filing) => (
        <li
          key={filing.accession_number}
          className="flex flex-wrap items-baseline justify-between gap-2 py-2"
        >
          <a
            href={filing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline-offset-2 hover:underline"
          >
            {filing.form}{" "}
            <span className="sr-only">filed {formatDate(filing.filed)} (opens SEC.gov)</span>
          </a>
          <span aria-hidden="true" className="text-fg-muted text-sm">
            {formatDate(filing.filed)}
          </span>
        </li>
      ))}
    </ul>
  );
}
