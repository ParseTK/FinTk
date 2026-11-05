"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { useFocusFirstInvalid } from "@/lib/useFocusFirstInvalid";
import type { CalcError } from "./toolMath";

export interface ToolField {
  name: string;
  label: string;
  hint?: string;
  placeholder?: string;
}

export interface ResultLine {
  label: string;
  value: ReactNode;
}

export type Outcome =
  { ok: true; lines: ResultLine[]; note?: string } | { ok: false; errors: CalcError[] };

/** What to tell a person about one problem. Kept plain: say what to enter, not what went wrong. */
function messageFor({ kind }: CalcError): string {
  switch (kind) {
    case "missing":
      return "Enter a number.";
    case "invalid":
      return "Enter a number such as 1250 or 0.5.";
    case "negative":
      return "Enter a number that is zero or more.";
    case "zero":
      return "Enter a number greater than zero.";
    case "range":
      return "Enter a number below 100. After a fall of 100 percent nothing is left to recover.";
  }
}

/**
 * A small calculator: labelled number fields, a Calculate button, and the answer in a live region.
 * Every problem is listed at once beside its field and focus moves to the first one, so a keyboard
 * or screen-reader user is not left searching. Editing a field clears the old answer, so what is
 * shown always matches the numbers on screen. Nothing typed here leaves the browser.
 */
export function ToolForm({
  title,
  description,
  fields,
  compute,
}: {
  title: string;
  description: string;
  fields: readonly ToolField[];
  compute: (values: Record<string, string>) => Outcome;
}) {
  const headingId = useId();
  const form = useRef<HTMLFormElement>(null);
  const focusInvalid = useFocusFirstInvalid(form);
  const empty = Object.fromEntries(fields.map((field) => [field.name, ""]));
  const [values, setValues] = useState<Record<string, string>>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [answer, setAnswer] = useState<Extract<Outcome, { ok: true }> | null>(null);

  const edit = (name: string, text: string) => {
    setValues((current) => ({ ...current, [name]: text }));
    setAnswer(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const outcome = compute(values);
    if (outcome.ok) {
      setErrors({});
      setAnswer(outcome);
      return;
    }
    setAnswer(null);
    setErrors(Object.fromEntries(outcome.errors.map((error) => [error.field, messageFor(error)])));
    focusInvalid();
  };

  const clear = () => {
    setValues(empty);
    setErrors({});
    setAnswer(null);
  };

  return (
    <section
      aria-labelledby={headingId}
      className="border-border bg-surface space-y-4 rounded-2xl border p-5 sm:p-6"
    >
      <div className="space-y-1">
        <h2 id={headingId} className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-fg-muted text-sm">{description}</p>
      </div>
      <form ref={form} onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <TextField
              key={field.name}
              label={field.label}
              hint={field.hint}
              placeholder={field.placeholder}
              value={values[field.name]}
              error={errors[field.name]}
              onChange={(event) => edit(field.name, event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              maxLength={24}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit">Calculate</Button>
          <Button type="button" variant="secondary" onClick={clear}>
            Clear
          </Button>
        </div>
      </form>
      {/* Always present, so the answer is announced when it appears. */}
      <div aria-live="polite" aria-atomic="true">
        {answer && (
          <div className="border-border bg-surface-raised space-y-2 rounded-xl border p-4">
            <h3 className="text-sm font-semibold">Result</h3>
            <dl className="space-y-1">
              {answer.lines.map((line) => (
                <div key={line.label} className="flex flex-wrap justify-between gap-x-4">
                  <dt className="text-fg-muted">{line.label}</dt>
                  <dd className="font-semibold tabular-nums">{line.value}</dd>
                </div>
              ))}
            </dl>
            {answer.note && <p className="text-fg-muted text-sm">{answer.note}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
