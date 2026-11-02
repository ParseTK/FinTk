import axe from "axe-core";
import { expect } from "vitest";

/**
 * Fails the test if axe finds accessibility violations in `container`.
 * Color contrast is skipped: jsdom cannot compute real colors, and contrast is enforced separately
 * by src/styles/tokens.test.ts.
 */
export async function expectNoA11yViolations(container: HTMLElement) {
  const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}
