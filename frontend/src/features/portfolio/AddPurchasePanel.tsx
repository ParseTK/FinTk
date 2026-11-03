"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { sendJson } from "@/lib/apiRequest";

/** The most rows one Save sends. The API refuses more, so the form stops offering them here. */
export const MAX_ROWS = 10;

interface Row {
  id: string;
  symbol: string;
  shares: string;
  unitCost: string;
  acquiredOn: string;
}

type RowErrors = Record<string, string>;

let rowCounter = 0;
/** A fresh empty row. The id only keys the list and ties errors to a row; it is never shown. */
const newRow = (): Row => blankRow(`row-${++rowCounter}`);
const blankRow = (id: string): Row => ({
  id,
  symbol: "",
  shares: "",
  unitCost: "",
  acquiredOn: "",
});
const isBlank = (row: Row) =>
  !row.symbol.trim() && !row.shares.trim() && !row.unitCost.trim() && !row.acquiredOn;

/** Today in the visitor's calendar, as YYYY-MM-DD, so the date picker cannot pick the future. */
const today = () => new Date().toLocaleDateString("en-CA");

/** What the form can check without asking the server. The server stays the authority. */
function missingFields(row: Row): RowErrors {
  const errors: RowErrors = {};
  if (!row.symbol.trim()) errors.symbol = "Enter a ticker symbol such as AAPL.";
  if (!row.shares.trim()) errors.shares = "Enter a number of shares.";
  if (!row.unitCost.trim()) errors.unit_cost = "Enter the price you paid per share.";
  return errors;
}

const plural = (count: number) => (count === 1 ? "purchase" : "purchases");

/**
 * "Add purchases": a button that opens a panel at the top of the page, where one or several
 * purchases are entered and saved together. After a successful save the panel closes itself,
 * says what was added, and puts keyboard focus back on the button.
 *
 * All rows are saved or none are. Problems come back per row, so the form marks the exact field
 * and keeps everything typed.
 */
export function AddPurchasePanel({
  csrfToken,
  heading,
}: {
  csrfToken: string;
  /** The page title and intro, shown to the left of the button. */
  heading: ReactNode;
}) {
  const router = useRouter();
  const panelId = useId();
  const titleId = `${panelId}-title`;

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => [newRow()]);
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({});
  const [problem, setProblem] = useState("");
  const [added, setAdded] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = useRef<HTMLButtonElement>(null);
  const form = useRef<HTMLFormElement>(null);

  // One key per distinct batch: submitting identical content again (a double click, a retry after
  // a dropped connection) reuses the key so the server returns the first result instead of adding
  // the rows twice. Any change makes a different request and gets a new key.
  const key = useRef({ value: "", signature: "" });

  useEffect(() => {
    if (open) form.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    toggle.current?.focus();
  }

  function update(id: string, name: keyof Omit<Row, "id">, value: string) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [name]: value } : row)));
  }

  function removeRow(id: string) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
    setRowErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)),
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setAdded("");
    setProblem("");

    const filled = rows.filter((row) => !isBlank(row));
    if (filled.length === 0) {
      setProblem("Add at least one purchase.");
      return;
    }
    const local: Record<string, RowErrors> = {};
    for (const row of filled) {
      const errors = missingFields(row);
      if (Object.keys(errors).length > 0) local[row.id] = errors;
    }
    setRowErrors(local);
    if (Object.keys(local).length > 0) {
      setProblem("Fill in the highlighted fields. Nothing was saved.");
      return;
    }

    const body = {
      lots: filled.map((row) => ({
        symbol: row.symbol.trim().toUpperCase(),
        shares: row.shares.trim(),
        unit_cost: row.unitCost.trim(),
        ...(row.acquiredOn ? { acquired_on: row.acquiredOn } : {}),
      })),
    };
    const signature = JSON.stringify(body);
    if (key.current.signature !== signature) {
      key.current = { value: crypto.randomUUID(), signature };
    }

    setBusy(true);
    const result = await sendJson("POST", "/api/v1/portfolio/lots/batch", csrfToken, {
      body,
      idempotencyKey: key.current.value,
    });
    setBusy(false);

    if (!result.ok) {
      const byId: Record<string, RowErrors> = {};
      filled.forEach((row, index) => {
        if (result.rows[index]) byId[row.id] = result.rows[index];
      });
      setRowErrors(byId);
      setProblem(
        result.kind === "invalid"
          ? Object.keys(byId).length > 0
            ? "Fix the highlighted fields. Nothing was saved."
            : result.message
          : result.message,
      );
      return;
    }

    setAdded(`Added ${filled.length} ${plural(filled.length)}.`);
    setRows([newRow()]);
    setRowErrors({});
    key.current = { value: "", signature: "" };
    close();
    router.refresh();
  }

  const filledCount = rows.filter((row) => !isBlank(row)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">{heading}</div>
        <Button
          ref={toggle}
          aria-expanded={open}
          aria-controls={panelId}
          variant={open ? "secondary" : "primary"}
          onClick={() => (open ? close() : setOpen(true))}
        >
          {open ? <CloseIcon /> : <PlusIcon />}
          {open ? "Close" : "Add purchases"}
        </Button>
      </div>

      <LiveMessage tone="success">{added}</LiveMessage>

      {/* Collapses by animating the row height from 0fr to 1fr. While closed it is inert: not
          focusable and not read out, so its fields cannot be reached by accident. */}
      <div
        id={panelId}
        inert={!open}
        className={clsx(
          "grid motion-safe:transition-[grid-template-rows] motion-safe:duration-300",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <Card as="section" aria-labelledby={titleId} className="space-y-4">
            <div className="space-y-1">
              <h2 id={titleId} className="text-xl font-semibold">
                Record what you bought
              </h2>
              <p className="text-fg-muted text-sm">
                Add one or several purchases. They are saved together, or not at all.
              </p>
            </div>
            <form
              ref={form}
              onSubmit={submit}
              onKeyDown={(event) => event.key === "Escape" && close()}
              noValidate
              className="space-y-4"
            >
              {rows.map((row, index) => (
                <fieldset
                  key={row.id}
                  className="border-border space-y-3 rounded-lg border p-3 sm:p-4"
                >
                  <legend className="px-1 text-sm font-semibold">
                    <VisuallyHidden>Purchase</VisuallyHidden> <span aria-hidden="true">#</span>
                    {index + 1}
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <TextField
                      label="Ticker symbol"
                      value={row.symbol}
                      onChange={(e) => update(row.id, "symbol", e.target.value)}
                      error={rowErrors[row.id]?.symbol}
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={10}
                      required
                    />
                    <TextField
                      label="Shares"
                      value={row.shares}
                      onChange={(e) => update(row.id, "shares", e.target.value)}
                      error={rowErrors[row.id]?.shares}
                      inputMode="decimal"
                      autoComplete="off"
                      required
                    />
                    <TextField
                      label="Price per share (USD)"
                      value={row.unitCost}
                      onChange={(e) => update(row.id, "unitCost", e.target.value)}
                      error={rowErrors[row.id]?.unit_cost}
                      inputMode="decimal"
                      autoComplete="off"
                      required
                    />
                    <TextField
                      label="Purchase date (optional)"
                      type="date"
                      max={today()}
                      value={row.acquiredOn}
                      onChange={(e) => update(row.id, "acquiredOn", e.target.value)}
                      error={rowErrors[row.id]?.acquired_on}
                    />
                  </div>
                  {rows.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeRow(row.id)}>
                      <CloseIcon />
                      Remove <VisuallyHidden>purchase {index + 1}</VisuallyHidden>
                    </Button>
                  )}
                </fieldset>
              ))}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setRows((current) => [...current, newRow()])}
                  disabled={rows.length >= MAX_ROWS}
                >
                  <PlusIcon />
                  Add another row
                </Button>
                {rows.length >= MAX_ROWS && (
                  <span className="text-fg-muted text-sm">Up to {MAX_ROWS} at once.</span>
                )}
              </div>

              <LiveMessage>{problem}</LiveMessage>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" loading={busy}>
                  {filledCount > 1 ? `Save ${filledCount} purchases` : "Save purchase"}
                </Button>
                <Button variant="ghost" onClick={close}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
