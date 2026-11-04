import clsx from "clsx";
import { MODE_LABELS, MODES, type Mode } from "@/lib/mode";
import { setMode } from "./actions";

/**
 * Crypto | Stocks, a pair of toggle buttons. Each is its own small form posting to a Server Action,
 * so it works without client JavaScript. The pressed one says which mode is showing; choosing a mode
 * remembers it and goes to that mode's home page.
 */
export function ModeSwitch({ mode }: { mode: Mode }) {
  return (
    <div
      role="group"
      aria-label="Show"
      className="border-border-strong bg-surface inline-flex rounded-full border p-0.5"
    >
      {MODES.map((option) => {
        const pressed = option === mode;
        return (
          <form key={option} action={setMode}>
            <input type="hidden" name="mode" value={option} />
            <button
              type="submit"
              aria-pressed={pressed}
              className={clsx(
                "rounded-full px-3 py-1 text-sm font-semibold transition-colors",
                pressed ? "bg-brand text-on-accent" : "text-fg hover:bg-surface-raised",
              )}
            >
              {MODE_LABELS[option]}
            </button>
          </form>
        );
      })}
    </div>
  );
}
