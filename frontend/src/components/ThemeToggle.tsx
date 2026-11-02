"use client";

import { useSyncExternalStore } from "react";
import {
  parseTheme,
  resolveDark,
  THEME_CHOICES,
  THEME_STORAGE_KEY,
  type ThemeChoice,
} from "@/lib/theme";

const CHANGE_EVENT = "theme-change";
const LABELS: Record<ThemeChoice, string> = { system: "System", light: "Light", dark: "Dark" };

function applyTheme(choice: ThemeChoice) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", resolveDark(choice, systemDark));
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    applyTheme(parseTheme(localStorage.getItem(THEME_STORAGE_KEY)));
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

const getSnapshot = () => parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
const getServerSnapshot = (): ThemeChoice => "system";

export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const select = (next: ThemeChoice) => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return (
    <div
      role="group"
      aria-label="Theme"
      className="border-border-strong inline-flex rounded-lg border p-0.5"
    >
      {THEME_CHOICES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={choice === option}
          onClick={() => select(option)}
          className="text-fg-muted aria-pressed:bg-brand aria-pressed:text-on-accent rounded-md px-3 py-1 text-sm font-medium"
        >
          {LABELS[option]}
        </button>
      ))}
    </div>
  );
}
