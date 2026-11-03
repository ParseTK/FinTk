"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { TextField } from "@/components/ui/Field";
import { sendJson } from "@/lib/apiRequest";
import { useFocusFirstInvalid } from "@/lib/useFocusFirstInvalid";

interface Fields {
  symbol: string;
  shares: string;
  unitCost: string;
  acquiredOn: string;
}

const EMPTY: Fields = { symbol: "", shares: "", unitCost: "", acquiredOn: "" };

/** Today in the visitor's calendar, as YYYY-MM-DD, so the date picker cannot pick the future. */
const today = () => new Date().toLocaleDateString("en-CA");

export function AddPurchaseForm({ csrfToken }: { csrfToken: string }) {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState("");
  const [added, setAdded] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const focusInvalid = useFocusFirstInvalid(form);

  // One key per distinct request. Submitting the same content again (a double click, a retry after
  // a dropped connection) reuses the key, so the server returns the first purchase instead of
  // adding a second. Changing anything makes it a different request, so it gets a new key: the
  // server rejects a reused key with different content.
  const key = useRef({ value: "", signature: "" });

  const set = (name: keyof Fields) => (event: { target: { value: string } }) =>
    setFields((current) => ({ ...current, [name]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const body = {
      symbol: fields.symbol.trim().toUpperCase(),
      shares: fields.shares.trim(),
      unit_cost: fields.unitCost.trim(),
      ...(fields.acquiredOn ? { acquired_on: fields.acquiredOn } : {}),
    };
    const signature = JSON.stringify(body);
    if (key.current.signature !== signature) {
      key.current = { value: crypto.randomUUID(), signature };
    }

    setBusy(true);
    setErrors({});
    setProblem("");
    setAdded("");
    const result = await sendJson("POST", "/api/v1/portfolio/lots", csrfToken, {
      body,
      idempotencyKey: key.current.value,
    });
    setBusy(false);

    if (!result.ok) {
      setErrors(result.fields);
      if (result.kind !== "invalid" || Object.keys(result.fields).length === 0) {
        setProblem(
          result.kind === "not-found"
            ? "We could not find a company with that ticker."
            : result.message,
        );
      }
      if (Object.keys(result.fields).length > 0) focusInvalid();
      return;
    }
    setAdded(`Added ${body.shares} shares of ${body.symbol}.`);
    setFields(EMPTY);
    key.current = { value: "", signature: "" };
    router.refresh();
  }

  return (
    <form
      ref={form}
      onSubmit={submit}
      noValidate
      aria-labelledby="add-purchase-heading"
      className="space-y-4"
    >
      <h2 id="add-purchase-heading" className="text-xl font-semibold">
        Add a purchase
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Ticker symbol"
          value={fields.symbol}
          onChange={set("symbol")}
          error={errors.symbol}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={10}
          required
        />
        <TextField
          label="Shares"
          hint="Fractions are fine, up to 6 decimals."
          value={fields.shares}
          onChange={set("shares")}
          error={errors.shares}
          inputMode="decimal"
          autoComplete="off"
          required
        />
        <TextField
          label="Price per share (USD)"
          value={fields.unitCost}
          onChange={set("unitCost")}
          error={errors.unit_cost}
          inputMode="decimal"
          autoComplete="off"
          required
        />
        <TextField
          label="Purchase date (optional)"
          type="date"
          max={today()}
          value={fields.acquiredOn}
          onChange={set("acquiredOn")}
          error={errors.acquired_on}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={busy}>
          Add purchase
        </Button>
        <LiveMessage tone="success">{added}</LiveMessage>
      </div>
      <LiveMessage>{problem}</LiveMessage>
    </form>
  );
}
