/** Comparing coins: how the chosen coins travel in the address (`?compare=bitcoin,ethereum`). */

export const MAX_COMPARED = 4;
export const COMPARE_PARAM = "compare";
export const COMPARE_PATH = "/resources/tools";
export const COMPARE_HASH = "compare";

// The address can be edited by anyone, so only plain coin addresses (lowercase letters, digits and
// hyphens) are accepted, and at most four. Anything else is dropped rather than passed on.
const SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/;

export function parseCompare(value: string | string[] | undefined): string[] {
  const text = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  const slugs: string[] = [];
  for (const part of text.split(",")) {
    const slug = part.trim().toLowerCase();
    if (SLUG.test(slug) && !slugs.includes(slug)) slugs.push(slug);
    if (slugs.length === MAX_COMPARED) break;
  }
  return slugs;
}
