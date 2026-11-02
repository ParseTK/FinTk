import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Reveal } from "./Reveal";

type ObserverCallback = (entries: Array<Partial<IntersectionObserverEntry>>) => void;

let trigger: (isIntersecting: boolean) => void;
let disconnect: ReturnType<typeof vi.fn>;
let animate: ReturnType<typeof vi.fn>;

function stubBrowser({ top }: { top: number }) {
  disconnect = vi.fn();
  animate = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: ObserverCallback) {
        trigger = (isIntersecting) => callback([{ isIntersecting }]);
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  HTMLElement.prototype.animate = animate as never;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top,
    bottom: top + 100,
    left: 0,
    right: 100,
    width: 100,
    height: 100,
    x: 0,
    y: top,
    toJSON: () => ({}),
  });
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // @ts-expect-error: remove the animate stub installed by stubBrowser
  delete HTMLElement.prototype.animate;
  delete document.documentElement.dataset.motion;
});

const box = () => screen.getByText("content");

describe("Reveal", () => {
  it("renders its children and the chosen element", () => {
    render(
      <ul>
        <Reveal as="li">content</Reveal>
      </ul>,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("content");
  });

  it("leaves an element that is already on screen alone", () => {
    stubBrowser({ top: 100 });
    render(<Reveal>content</Reveal>);
    expect(box().style.opacity).toBe("");
    expect(box().style.visibility).toBe("");
    expect(animate).not.toHaveBeenCalled();
  });

  it("hides an element below the fold before it is ever painted, and keeps it out of the a11y tree", () => {
    stubBrowser({ top: 2000 });
    render(<Reveal>content</Reveal>);
    expect(box().style.opacity).toBe("0");
    expect(box().style.visibility).toBe("hidden");
  });

  it("plays one entrance when it scrolls into view, then stops observing", () => {
    stubBrowser({ top: 2000 });
    render(<Reveal>content</Reveal>);

    trigger(true);

    expect(animate).toHaveBeenCalledTimes(1);
    const [keyframes, options] = animate.mock.calls[0]!;
    expect(keyframes[0]).toMatchObject({ opacity: 0 });
    expect(keyframes[1]).toMatchObject({ opacity: 1, transform: "none" });
    expect(options).toMatchObject({ duration: 750, delay: 0, fill: "backwards" });
    expect(box().style.opacity).toBe("");
    expect(box().style.visibility).toBe("");
    expect(disconnect).toHaveBeenCalled();
  });

  it("does nothing while the element is still out of view", () => {
    stubBrowser({ top: 2000 });
    render(<Reveal>content</Reveal>);
    trigger(false);
    expect(animate).not.toHaveBeenCalled();
    expect(box().style.visibility).toBe("hidden");
  });

  it("staggers siblings left to right by index", () => {
    stubBrowser({ top: 2000 });
    render(
      <Reveal index={2} stagger={100}>
        content
      </Reveal>,
    );
    trigger(true);
    expect(animate.mock.calls[0]![1]).toMatchObject({ delay: 200 });
  });

  it("does nothing when Motion is set to Reduced", () => {
    stubBrowser({ top: 2000 });
    document.documentElement.dataset.motion = "reduced";
    render(<Reveal>content</Reveal>);
    expect(box().style.opacity).toBe("");
    expect(box().style.visibility).toBe("");
    expect(animate).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", () => {
    stubBrowser({ top: 2000 });
    render(<Reveal disabled>content</Reveal>);
    expect(box().style.opacity).toBe("");
    expect(animate).not.toHaveBeenCalled();
  });

  it("stays visible where IntersectionObserver is unavailable", () => {
    stubBrowser({ top: 2000 });
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Reveal>content</Reveal>);
    expect(box().style.visibility).toBe("");
  });

  it("restores the element if it unmounts before revealing", () => {
    stubBrowser({ top: 2000 });
    const { unmount } = render(<Reveal>content</Reveal>);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
