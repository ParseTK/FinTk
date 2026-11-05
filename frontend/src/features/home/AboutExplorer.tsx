"use client";

import clsx from "clsx";
import { useId, useRef, useState, type KeyboardEvent } from "react";

export interface AboutStep {
  title: string;
  body: string;
  tags: readonly string[];
}

export interface AboutSourceFact {
  label: string;
  value: string;
}

export interface AboutSourcePanel {
  /** The tab's text. */
  tab: string;
  eyebrow: string;
  /** The big name in the panel; a link when `href` is set. */
  name: string;
  href?: string;
  caption: string;
  detail: string;
  facts: readonly AboutSourceFact[];
}

const EYEBROW = "text-brand text-xs font-semibold tracking-[0.14em] uppercase";

/**
 * The interactive half of the landing page's About section: a one-at-a-time accordion of three
 * steps, and a tabbed panel on where the data comes from. Both are plain buttons with ARIA state, so
 * they work by keyboard (tabs: arrow keys, Home and End) and are read out properly. The text is
 * supplied by the server component, which decides what to say from the flags that are on.
 */
export function AboutSteps({ steps }: { steps: readonly AboutStep[] }) {
  const [open, setOpen] = useState(0);
  const id = useId();
  return (
    <ol className="border-border border-t">
      {steps.map((step, index) => {
        const isOpen = open === index;
        return (
          <li key={step.title} className="border-border border-b">
            <h3>
              <button
                type="button"
                id={`${id}-b${index}`}
                aria-expanded={isOpen}
                aria-controls={`${id}-p${index}`}
                onClick={() => setOpen(isOpen ? -1 : index)}
                className="flex w-full items-center gap-4 py-5 text-left"
              >
                <span aria-hidden="true" className="text-brand w-8 text-lg italic">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-xl font-medium tracking-tight">{step.title}</span>
                <span aria-hidden="true" className="text-fg-muted text-xl leading-none">
                  {isOpen ? "−" : "+"}
                </span>
              </button>
            </h3>
            <div
              id={`${id}-p${index}`}
              role="region"
              aria-labelledby={`${id}-b${index}`}
              hidden={!isOpen}
              className="space-y-4 pr-8 pb-6 pl-12"
            >
              <p className="text-fg-muted max-w-md">{step.body}</p>
              <ul aria-label="Topics" className="flex flex-wrap gap-2">
                {step.tags.map((tag) => (
                  <li
                    key={tag}
                    className="border-border bg-surface-raised text-fg-muted rounded-md border px-2 py-0.5 text-xs"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function AboutSources({
  title,
  panels,
}: {
  title: string;
  panels: readonly AboutSourcePanel[];
}) {
  const [active, setActive] = useState(0);
  const id = useId();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent) {
    const last = panels.length - 1;
    const next =
      event.key === "ArrowRight"
        ? (active + 1) % panels.length
        : event.key === "ArrowLeft"
          ? (active + last) % panels.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  const panel = panels[active]!;
  return (
    <div className="border-border bg-surface rounded-2xl border p-6">
      <h3 className="text-lg font-medium">{title}</h3>
      <div
        role="tablist"
        aria-label={title}
        onKeyDown={onKeyDown}
        className="border-border mt-4 flex flex-wrap gap-x-6 border-b"
      >
        {panels.map((item, index) => (
          <button
            key={item.tab}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-t${index}`}
            aria-selected={active === index}
            aria-controls={`${id}-tp`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            className={clsx(
              "-mb-px border-b-2 pb-2 text-sm font-medium transition-colors",
              active === index
                ? "border-brand text-brand"
                : "text-fg-muted hover:text-fg border-transparent",
            )}
          >
            {item.tab}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-tp`}
        aria-labelledby={`${id}-t${active}`}
        className="mt-6 grid gap-6 sm:grid-cols-[1fr_1.2fr]"
      >
        <div className="space-y-2">
          <p className={EYEBROW}>{panel.eyebrow}</p>
          <p className="text-2xl font-semibold tracking-tight">
            {panel.href ? (
              <a
                href={panel.href}
                rel="noopener noreferrer"
                className="underline-offset-4 hover:underline"
              >
                {panel.name}
              </a>
            ) : (
              panel.name
            )}
          </p>
          <p className="text-fg-muted text-sm">{panel.caption}</p>
        </div>
        <div className="space-y-4">
          <p className="text-fg-muted text-sm">{panel.detail}</p>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {panel.facts.map((fact) => (
              <div key={fact.label} className="flex gap-2">
                <dt className="font-medium">{fact.label}</dt>
                <dd className="text-fg-muted">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
