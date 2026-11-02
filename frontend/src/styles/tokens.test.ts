import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/contrast";

// Vitest and CI both run from the frontend/ directory.
const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

function readTokens(selector: ":root" | ".dark"): Record<string, string> {
  const block = new RegExp(`(?:^|\\n)${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`).exec(css);
  if (!block) throw new Error(`Missing ${selector} block in globals.css`);
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block[1]!.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    tokens[name!] = value!;
  }
  return tokens;
}

const themes = { light: readTokens(":root"), dark: readTokens(".dark") } as const;

const BACKGROUNDS = ["surface", "surface-raised"] as const;
// Text needs 4.5:1 (WCAG 1.4.3). UI boundaries and focus rings need 3:1 (WCAG 1.4.11).
const TEXT_ON_BACKGROUND = ["fg", "fg-muted", "brand", "gain", "loss"] as const;
const NON_TEXT_ON_BACKGROUND = ["border-strong", "focus"] as const;
const TEXT_ON_ACCENT_FILL = ["brand", "gain", "loss", "fg-muted"] as const;

describe.each(Object.entries(themes))("%s theme tokens", (_name, tokens) => {
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
