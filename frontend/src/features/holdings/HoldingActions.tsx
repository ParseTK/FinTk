"use client";

import { useState, type ReactNode } from "react";
import { actionClass } from "./actionStyles";
import { HoldingEditor } from "./HoldingEditor";
import { RemoveButton } from "./RemoveButton";

export interface HoldingActionsProps {
  slug: string;
  name: string;
  symbol: string;
  amount: string;
  cost: string | null;
  csrfToken: string;
  /** Number of table columns, so the open form spans the whole row. Absent in a card. */
  colSpan?: number;
  /** The row's own cells, drawn by the server; shown before the actions cell. */
  children?: ReactNode;
}

/**
 * Edit and Remove for one holding. Edit opens the form right here, under the holding (a full-width
 * row in the table, below the card on phones), so nobody is sent to the coin's page. In a table
 * (`colSpan` given) this renders the row itself, because the form needs a row of its own.
 */
export function HoldingActions({
  slug,
  name,
  symbol,
  amount,
  cost,
  csrfToken,
  colSpan,
  children,
}: HoldingActionsProps) {
  const [editing, setEditing] = useState(false);

  const actions = (
    <span className="flex items-center justify-end gap-3">
      <button
        type="button"
        className={actionClass}
        aria-expanded={editing}
        onClick={() => setEditing((open) => !open)}
      >
        Edit <span className="sr-only">{name}</span>
      </button>
      <RemoveButton
        what={`${name} from your portfolio`}
        path={`/api/v1/portfolio/${encodeURIComponent(slug)}`}
        csrfToken={csrfToken}
      />
    </span>
  );
  const form = editing && (
    <HoldingEditor
      slug={slug}
      name={name}
      symbol={symbol}
      csrfToken={csrfToken}
      signInNext="/holdings"
      current={{ amount, cost }}
      onDone={() => setEditing(false)}
    />
  );

  if (colSpan === undefined) {
    return (
      <>
        {actions}
        {form && <div className="border-border mt-3 border-t pt-4">{form}</div>}
      </>
    );
  }
  return (
    <>
      <tr className="border-border border-t">
        {children}
        <td className="w-48 px-3 py-3 whitespace-nowrap">{actions}</td>
      </tr>
      {form && (
        <tr>
          <td colSpan={colSpan} className="px-3 pb-5">
            {form}
          </td>
        </tr>
      )}
    </>
  );
}
