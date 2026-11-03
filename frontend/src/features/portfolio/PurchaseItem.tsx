"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { TextField } from "@/components/ui/Field";
import { sendJson } from "@/lib/apiRequest";
import { useFocusFirstInvalid } from "@/lib/useFocusFirstInvalid";
import { formatDate, formatMoney, formatPrice, formatShares } from "@/lib/format";
import type { Lot } from "./types";

type Mode = "viewing" | "editing" | "confirming-delete";

export function PurchaseItem({ lot, csrfToken }: { lot: Lot; csrfToken: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("viewing");
  const [shares, setShares] = useState(trimZeros(lot.shares));
  const [unitCost, setUnitCost] = useState(trimZeros(lot.unit_cost));
  const [acquiredOn, setAcquiredOn] = useState(lot.acquired_on ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const focusInvalid = useFocusFirstInvalid(form);

  const path = `/api/v1/portfolio/lots/${encodeURIComponent(lot.id)}`;
  const label = `${formatShares(lot.shares)} ${lot.symbol}`;

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setProblem("");
    const result = await sendJson("PUT", path, csrfToken, {
      body: { shares: shares.trim(), unit_cost: unitCost.trim(), acquired_on: acquiredOn || null },
    });
    setBusy(false);
    if (result.ok) {
      setMode("viewing");
      router.refresh();
      return;
    }
    setErrors(result.fields);
    if (result.kind !== "invalid" || Object.keys(result.fields).length === 0)
      setProblem(result.message);
    if (Object.keys(result.fields).length > 0) focusInvalid();
  }

  async function remove() {
    setBusy(true);
    setProblem("");
    const result = await sendJson("DELETE", path, csrfToken);
    // "not found" means it is already gone, which is what was asked for.
    if (result.ok || result.kind === "not-found") {
      router.refresh();
      return;
    }
    setBusy(false);
    setProblem(result.message);
  }

  if (mode === "editing") {
    return (
      <li className="py-4">
        <form
          ref={form}
          onSubmit={save}
          noValidate
          aria-label={`Edit purchase of ${label}`}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField
              label="Shares"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              error={errors.shares}
              inputMode="decimal"
              autoComplete="off"
              required
            />
            <TextField
              label="Price per share (USD)"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              error={errors.unit_cost}
              inputMode="decimal"
              autoComplete="off"
              required
            />
            <TextField
              label="Purchase date"
              type="date"
              value={acquiredOn}
              onChange={(e) => setAcquiredOn(e.target.value)}
              error={errors.acquired_on}
            />
          </div>
          <div className="flex gap-3">
            <Button type="submit" size="sm" loading={busy}>
              Save
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => setMode("viewing")}
            >
              Cancel
            </Button>
          </div>
          <LiveMessage>{problem}</LiveMessage>
        </form>
      </li>
    );
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="tabular-nums">
          <span className="font-semibold">{formatShares(lot.shares)} shares</span> at{" "}
          {formatPrice(lot.unit_cost)}
          <span className="text-fg-muted"> = {formatMoney(lot.cost)}</span>
        </p>
        <p className="text-fg-muted text-sm">
          {lot.acquired_on ? formatDate(lot.acquired_on) : "No date"}
        </p>
      </div>

      {mode === "viewing" ? (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setMode("editing")}>
            Edit <span className="sr-only">purchase of {label}</span>
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setMode("confirming-delete")}>
            Delete <span className="sr-only">purchase of {label}</span>
          </Button>
        </div>
      ) : (
        <div
          role="group"
          aria-label={`Confirm deleting the purchase of ${label}`}
          className="space-y-2"
        >
          <p className="text-sm font-semibold">Delete this purchase?</p>
          <div className="flex gap-2">
            <Button size="sm" variant="danger" loading={busy} onClick={remove}>
              Yes, delete
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => setMode("viewing")}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      <LiveMessage>{problem}</LiveMessage>
    </li>
  );
}

/** "12.500000" -> "12.5", so the edit field shows what the person would have typed. */
function trimZeros(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}
