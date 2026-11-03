/** WCAG 2.x contrast helpers. Used by the design-token test; no runtime use. */

export function hexToRgb(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`Expected a 6-digit hex color, got "${hex}"`);
  const value = parseInt(match[1]!, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/** `foreground` laid over `background` at `alpha` (0 to 1), as hex: what a translucent tint really looks like. */
export function blend(foreground: string, background: string, alpha: number): string {
  const [f, b] = [hexToRgb(foreground), hexToRgb(background)];
  const mixed = f.map((value, i) => Math.round(value * alpha + b[i]! * (1 - alpha)));
  return "#" + mixed.map((value) => value.toString(16).padStart(2, "0")).join("");
}
