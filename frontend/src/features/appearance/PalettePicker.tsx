"use client";

import { useCallback, useId, useMemo, useSyncExternalStore } from "react";
import {
  ACCENTS,
  applyPreferences,
  DEFAULT_PREFERENCES,
  FONTS,
  MODES,
  MOTIONS,
  readPreferences,
  STORAGE_KEYS,
  type Preferences,
} from "./preferences";
import { withViewTransition } from "@/lib/motion";
import { useDisclosure } from "@/lib/useDisclosure";
import { PaletteIcon } from "@/components/ui/icons";

const CHANGE_EVENT = "preferences-change";

function subscribe(onChange: () => void) {
  // Only motion follows the device now (until chosen); the theme is dark unless the visitor picks Light.
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
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
    // Cross-fade the change when the browser supports it and motion is allowed.
    withViewTransition(() => {
      localStorage.setItem(STORAGE_KEYS[key], value);
      applyPreferences(readPreferences());
      window.dispatchEvent(new Event(CHANGE_EVENT));
    });
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
  const { open, toggle, buttonRef, containerProps } = useDisclosure();
  const { prefs, update } = usePreferences();
  const panelId = useId();

  return (
    <div {...containerProps} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Appearance"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="text-fg-muted hover:text-fg hover:bg-surface-raised rounded-full p-1.5"
      >
        <PaletteIcon className="size-7" />
      </button>

      {open && (
        <div
          id={panelId}
          className="border-border bg-surface-raised animate-pop-in absolute right-0 z-20 mt-2 w-72 origin-top-right space-y-4 rounded-2xl border p-4 shadow-lg"
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

          <fieldset>
            <legend className="text-fg-muted mb-1 text-xs font-semibold tracking-wide uppercase">
              Motion
            </legend>
            <p className="text-fg-muted mb-2 text-xs">Reduced stops all animation on the site.</p>
            <div className="grid grid-cols-2 gap-2">
              {MOTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={prefs.motion === id}
                  onClick={() => update("motion", id)}
                  className={optionClass}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
