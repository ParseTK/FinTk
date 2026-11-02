"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ACCENTS,
  applyPreferences,
  DEFAULT_PREFERENCES,
  FONTS,
  MODES,
  readPreferences,
  STORAGE_KEYS,
  type Preferences,
} from "@/lib/preferences";
import { PaletteIcon } from "./icons";

const CHANGE_EVENT = "preferences-change";

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    applyPreferences(readPreferences());
    onChange();
  };
  media.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    media.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

// A string snapshot keeps useSyncExternalStore's identity check stable between renders.
const getSnapshot = () => JSON.stringify(readPreferences());
const getServerSnapshot = () => JSON.stringify(DEFAULT_PREFERENCES);

function usePreferences() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const prefs = useMemo(() => JSON.parse(snapshot) as Preferences, [snapshot]);

  const update = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    localStorage.setItem(STORAGE_KEYS[key], value);
    applyPreferences(readPreferences());
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { prefs, update };
}

const optionClass =
  "border-border-strong text-fg not-aria-pressed:hover:bg-surface flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-on-accent aria-pressed:font-semibold";

function Check() {
  return (
    <span aria-hidden="true" className="font-bold">
      ✓
    </span>
  );
}

export function PalettePicker() {
  const [open, setOpen] = useState(false);
  const { prefs, update } = usePreferences();
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          close(true);
        }
      }}
      onBlur={(event) => {
        if (open && !containerRef.current?.contains(event.relatedTarget as Node | null)) {
          close(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label="Appearance"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="text-fg-muted hover:text-fg hover:bg-surface-raised rounded-full p-2"
      >
        <PaletteIcon />
      </button>

      {open && (
        <div
          id={panelId}
          className="border-border bg-surface-raised absolute right-0 z-20 mt-2 w-72 space-y-4 rounded-2xl border p-4 shadow-lg"
        >
          <fieldset>
            <legend className="text-fg-muted mb-2 text-xs font-semibold tracking-wide uppercase">
              Mode
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={prefs.mode === id}
                  onClick={() => update("mode", id)}
                  className={optionClass}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-fg-muted mb-2 text-xs font-semibold tracking-wide uppercase">
              Accent
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {ACCENTS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={prefs.accent === id}
                  onClick={() => update("accent", id)}
                  className={optionClass}
                >
                  <span className="flex items-center gap-2">
                    {/* The swatch carries data-accent so it reuses that accent's tokens. */}
                    <span
                      aria-hidden="true"
                      data-accent={id}
                      className="bg-brand ring-on-accent inline-block size-4 rounded-full ring-2"
                    />
                    {label}
                  </span>
                  {prefs.accent === id && <Check />}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-fg-muted mb-2 text-xs font-semibold tracking-wide uppercase">
              Typeface
            </legend>
            <div className="grid gap-2">
              {FONTS.map(({ id, label, cssVar }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={prefs.font === id}
                  onClick={() => update("font", id)}
                  className={optionClass}
                  style={{ fontFamily: `var(${cssVar}), sans-serif` }}
                >
                  {label}
                  {prefs.font === id && <Check />}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
