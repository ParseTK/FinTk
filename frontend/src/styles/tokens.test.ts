import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { blend, contrastRatio } from "@/lib/contrast";
import { ACCENTS } from "@/features/appearance";

// Vitest and CI both run from the frontend/ directory.
const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Collects the hex custom properties of the first rule whose selector list includes `selector`. */
function readTokens(selector: string): Record<string, string> {
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // Drop any preceding at-rule statements (e.g. `@import ...;`) that share the match.
    const list = selectors!
      .split(";")
      .pop()!
      .split(",")
      .map((s) => s.trim());
    if (!list.includes(selector)) continue;
    const tokens: Record<string, string> = {};
    for (const [, name, value] of body!.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
      tokens[name!] = value!;
    }
    return tokens;
  }
  throw new Error(`No rule for "${selector}" in globals.css`);
}

const BASE = { light: readTokens(":root"), dark: readTokens(".dark") } as const;

const combos = ACCENTS.flatMap(({ id }) => [
  { name: `${id} / light`, tokens: { ...BASE.light, ...readTokens(`[data-accent="${id}"]`) } },
  { name: `${id} / dark`, tokens: { ...BASE.dark, ...readTokens(`.dark[data-accent="${id}"]`) } },
]);

const BACKGROUNDS = ["surface", "surface-raised"] as const;
// Text needs 4.5:1 (WCAG 1.4.3). UI boundaries and focus rings need 3:1 (WCAG 1.4.11).
const TEXT_ON_BACKGROUND = ["fg", "fg-muted", "brand", "gain", "loss"] as const;
const NON_TEXT_ON_BACKGROUND = ["border-strong", "focus"] as const;
const TEXT_ON_ACCENT_FILL = ["brand", "gain", "loss", "fg-muted"] as const;

// GainChip and the "Added" confirmation tint a gain or loss colour at 6% behind its own text. That
// is lower contrast than the same text on the plain surface, and only a real browser (axe) caught it
// the first time: gain text was 4.43:1 on its tint.
const TINT = 0.06;

describe("accent coverage", () => {
  it("has a light and a dark rule for every accent", () => {
    expect(combos).toHaveLength(ACCENTS.length * 2);
  });
});

describe.each(combos)("$name", ({ tokens }) => {
  it("defines every token used by the tests", () => {
    const required = [
      ...BACKGROUNDS,
      ...TEXT_ON_BACKGROUND,
      ...NON_TEXT_ON_BACKGROUND,
      "on-accent",
      "border",
    ];
    for (const token of required) expect(tokens, token).toHaveProperty(token);
  });

  it.each(BACKGROUNDS.flatMap((bg) => TEXT_ON_BACKGROUND.map((fg) => [fg, bg] as const)))(
    "text %s on %s has at least 4.5:1",
    (fg, bg) => {
      expect(contrastRatio(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(BACKGROUNDS.flatMap((bg) => (["gain", "loss"] as const).map((fg) => [fg, bg] as const)))(
    "%s text on its own tint (6 percent) over %s has at least 4.5:1",
    (fg, bg) => {
      const tinted = blend(tokens[fg]!, tokens[bg]!, TINT);
      expect(contrastRatio(tokens[fg]!, tinted)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(BACKGROUNDS.flatMap((bg) => NON_TEXT_ON_BACKGROUND.map((fg) => [fg, bg] as const)))(
    "%s on %s has at least 3:1",
    (fg, bg) => {
      expect(contrastRatio(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(TEXT_ON_ACCENT_FILL)("on-accent text on a %s fill has at least 4.5:1", (fill) => {
    expect(contrastRatio(tokens["on-accent"]!, tokens[fill]!)).toBeGreaterThanOrEqual(4.5);
  });
});
