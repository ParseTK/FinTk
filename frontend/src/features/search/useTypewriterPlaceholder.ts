"use client";

import { useEffect, useState } from "react";
import { isMotionOff } from "@/lib/motion";

export const PLACEHOLDER_PREFIX = "Search companies like ";
/** Shown whenever nothing is animating: before it starts, while typing in the field, reduced motion. */
export const PLACEHOLDER_FALLBACK = "Search companies or tickers";
/** Short, well-known names so the typed text still fits a narrow field. */
export const PLACEHOLDER_WORDS = [
  "Apple",
  "Tesla",
  "NVIDIA",
  "Amazon",
  "Disney",
  "Netflix",
  "Nike",
  "Visa",
  "Costco",
  "Ford",
  "Intel",
  "Adobe",
] as const;

const START_DELAY_MS = 1200;
const TYPE_MS = 80;
const HOLD_MS = 1700;
const DELETE_MS = 40;
const GAP_MS = 400;

/** A random word index that is never the same as the previous one. */
export function pickWordIndex(previous: number, random: () => number = Math.random): number {
  const choices = PLACEHOLDER_WORDS.map((_, index) => index).filter((index) => index !== previous);
  return choices[Math.floor(random() * choices.length)]!;
}

/**
 * A typewriter for the search placeholder: it types "Search companies like " once, then types a
 * random company name, holds it, deletes it, and loops with another.
 *
 * It only runs while the field is idle. It stops (and shows the plain hint) while the field is
 * focused or has text, and the Motion setting (or a device reduced-motion preference) turns it off,
 * including while it is running. A placeholder is not read aloud and the field keeps a constant
 * visible-to-assistive-technology label, so nothing important changes.
 */
export function useTypewriterPlaceholder(paused: boolean): string {
  const [text, setText] = useState(PLACEHOLDER_FALLBACK);
  const [wasPaused, setWasPaused] = useState(paused);

  // Adjusting state during render (React's recommended way to reset state when an input changes):
  // whenever the field becomes active or inactive, start again from the plain hint.
  if (paused !== wasPaused) {
    setWasPaused(paused);
    setText(PLACEHOLDER_FALLBACK);
  }

  useEffect(() => {
    if (paused || isMotionOff()) return; // the text is already the plain hint

    let timer: ReturnType<typeof setTimeout>;
    let phase: "typing" | "deleting" = "typing";
    let previous = -1;
    let word = "";
    let count = 0;

    const chooseWord = () => {
      previous = pickWordIndex(previous);
      word = PLACEHOLDER_WORDS[previous]!;
      count = 0;
    };

    const tick = () => {
      if (isMotionOff()) {
        setText(PLACEHOLDER_FALLBACK);
        return;
      }
      if (phase === "typing") {
        count += 1;
        setText(PLACEHOLDER_PREFIX + word.slice(0, count));
        if (count >= word.length) {
          phase = "deleting";
          timer = setTimeout(tick, HOLD_MS);
        } else {
          timer = setTimeout(tick, TYPE_MS);
        }
      } else {
        count -= 1;
        setText(PLACEHOLDER_PREFIX + word.slice(0, Math.max(count, 0)));
        if (count <= 0) {
          chooseWord();
          phase = "typing";
          timer = setTimeout(tick, GAP_MS);
        } else {
          timer = setTimeout(tick, DELETE_MS);
        }
      }
    };

    chooseWord();
    timer = setTimeout(() => {
      setText(PLACEHOLDER_PREFIX);
      timer = setTimeout(tick, GAP_MS);
    }, START_DELAY_MS);

    return () => clearTimeout(timer);
  }, [paused]);

  return paused ? PLACEHOLDER_FALLBACK : text;
}
