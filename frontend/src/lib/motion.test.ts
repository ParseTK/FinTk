import { afterEach, describe, expect, it, vi } from "vitest";
import { isMotionOff, staggerDelay, withViewTransition } from "./motion";

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (document as unknown as Record<string, unknown>).startViewTransition;
});

describe("isMotionOff", () => {
  afterEach(() => delete document.documentElement.dataset.motion);

  it("the palette choice beats the device setting, in both directions", () => {
    stubReducedMotion(true);
    document.documentElement.dataset.motion = "full";
    expect(isMotionOff()).toBe(false);

    stubReducedMotion(false);
    document.documentElement.dataset.motion = "reduced";
    expect(isMotionOff()).toBe(true);
  });

  it("falls back to the media query when nothing is chosen", () => {
    stubReducedMotion(true);
    expect(isMotionOff()).toBe(true);
    stubReducedMotion(false);
    expect(isMotionOff()).toBe(false);
  });
});

describe("withViewTransition", () => {
  it("runs the update immediately when the API is missing", () => {
    stubReducedMotion(false);
    const update = vi.fn();
    withViewTransition(update);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("wraps the update in a view transition when supported", () => {
    stubReducedMotion(false);
    const start = vi.fn((callback: () => void) => callback());
    (document as unknown as Record<string, unknown>).startViewTransition = start;
    const update = vi.fn();

    withViewTransition(update);

    expect(start).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("skips the transition but still updates when reduced motion is requested", () => {
    stubReducedMotion(true);
    const start = vi.fn();
    (document as unknown as Record<string, unknown>).startViewTransition = start;
    const update = vi.fn();

    withViewTransition(update);

    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe("staggerDelay", () => {
  it("steps by index and caps the delay", () => {
    expect(staggerDelay(0)).toBe("0ms");
    expect(staggerDelay(3)).toBe("150ms");
    expect(staggerDelay(100)).toBe("400ms");
    expect(staggerDelay(2, 100, 1000)).toBe("200ms");
  });
});
