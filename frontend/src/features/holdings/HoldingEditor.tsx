"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { LinkButton } from "@/components/ui/LinkButton";
import { LiveMessage } from "@/components/ui/LiveMessage";
import { sendJson } from "@/lib/apiRequest";
import { useFocusFirstInvalid } from "@/lib/useFocusFirstInvalid";
import { RemoveButton } from "./RemoveButton";

export interface HoldingEditorProps {
  slug: string;
  name: string;
  symbol: string;
  /** Present when signed in. */
  csrfToken?: string;
  /** Where to come back to after signing in. */
  signInNext: string;
  /** What is saved now, if anything. */
  current?: { amount: string; cost: string | null };
}

/**
 * "Your holding" on a coin's page: how many coins, and optionally what was paid in total. Saving
 * replaces any earlier entry for the coin. The cost is optional on purpose: without it the page
 * shows the value but no gain or loss, rather than guessing. Validation is the server's; the form
 * only maps its answer to messages next to the fields.
 */
export function HoldingEditor({
  slug,
  name,
  symbol,
  csrfToken,
  signInNext,
  current,
}: HoldingEditorProps) {
  const router = useRouter();
  const [amount, setAmount] = useState(current?.amount ?? "");
  const [cost, setCost] = useState(current?.cost ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const focusInvalid = useFocusFirstInvalid(form);

  if (!csrfToken) {
    return (
      <LinkButton
        href={`/sign-in?next=${encodeURIComponent(signInNext)}`}
        variant="secondary"
        size="sm"
      >
        Sign in to track your {name}
      </LinkButton>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    setProblem("");
    setSaved("");
    const body = { amount: amount.trim(), ...(cost.trim() ? { cost: cost.trim() } : {}) };
    const result = await sendJson(
      "PUT",
      `/api/v1/portfolio/${encodeURIComponent(slug)}`,
      csrfToken!,
      {
        body,
      },
    );
    setBusy(false);
    if (!result.ok) {
      setErrors(result.fields);
      if (Object.keys(result.fields).length > 0) focusInvalid();
      else setProblem(result.message);
      return;
    }
    setSaved(`Saved ${body.amount} ${symbol}.`);
    router.refresh();
  }

  return (
    <form
      ref={form}
      onSubmit={submit}
      noValidate
      aria-labelledby={`holding-${slug}`}
      className="space-y-4"
    >
      <h3 id={`holding-${slug}`} className="text-lg font-semibold">
        Your holding
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={`Amount of ${symbol}`}
          hint="Up to 18 decimals."
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={errors.amount}
          inputMode="decimal"
          autoComplete="off"
          required
        />
        <TextField
          label="Total paid in US dollars (optional)"
          hint="Leave empty if you do not know. Then no gain or loss is shown."
          value={cost}
          onChange={(event) => setCost(event.target.value)}
          error={errors.cost}
          inputMode="decimal"
          autoComplete="off"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy}>
          {current ? "Save changes" : "Save holding"}
        </Button>
        {current && (
          <RemoveButton
            what={`${name} from your portfolio`}
            path={`/api/v1/portfolio/${encodeURIComponent(slug)}`}
            csrfToken={csrfToken}
          />
        )}
        <LiveMessage tone="success">{saved}</LiveMessage>
        <LiveMessage>{problem}</LiveMessage>
      </div>
    </form>
  );
}
