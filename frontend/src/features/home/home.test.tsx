import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { FeatureGrid } from "./FeatureGrid";
import { MarketTicker } from "./MarketTicker";
import { TickerChips } from "./TickerChips";

afterEach(() => vi.unstubAllEnvs());

describe("TickerChips", () => {
  it("links each example straight to its company page with a readable name", () => {
    render(<TickerChips />);
    const apple = screen.getByRole("link", { name: "Apple (AAPL)" });
    expect(apple).toHaveAttribute("href", "/company/AAPL");
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("is a labelled navigation landmark and passes axe", async () => {
    const { container } = render(<TickerChips />);
    expect(screen.getByRole("navigation", { name: "Example companies" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe("MarketTicker", () => {
  const pauseButton = () => screen.getByRole("button", { name: /sample ticker/i });

  it("says the data is sample data about fictional companies", () => {
    render(<MarketTicker />);
    expect(screen.getByText("Sample data")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /sample market snapshot with fictional companies/i }),
    ).toBeInTheDocument();
  });

  it("exposes each quote once to assistive technology (the loop copy is hidden)", () => {
    render(<MarketTicker />);
    // Role queries skip aria-hidden content, so this is what a screen reader would list.
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    const hidden = document.querySelector("ul[aria-hidden='true']");
    expect(hidden).toBeInTheDocument();
    expect(within(hidden as HTMLElement).getByText("ACME")).toBeInTheDocument();
  });

  it("shows signed changes, never by color alone", () => {
    render(<MarketTicker />);
    // Each value appears twice in the DOM (the looping copy is aria-hidden).
    expect(screen.getAllByText("+1.24%")).toHaveLength(2);
    expect(screen.getAllByText("-0.62%")).toHaveLength(2);
  });

  it("can be paused and played", async () => {
    const user = userEvent.setup();
    const { container } = render(<MarketTicker />);
    const track = container.querySelector(".animate-marquee, [class*='animate-marquee']");
    expect(track).not.toHaveClass("[animation-play-state:paused]");
    expect(pauseButton()).toHaveAccessibleName("Pause sample ticker");

    await user.click(pauseButton());

    expect(pauseButton()).toHaveAccessibleName("Play sample ticker");
    expect(track).toHaveClass("[animation-play-state:paused]");

    await user.click(pauseButton());
    expect(track).not.toHaveClass("[animation-play-state:paused]");
  });

  it("only animates when motion is allowed", () => {
    const { container } = render(<MarketTicker />);
    expect(container.innerHTML).toContain("motion-safe:animate-marquee");
    expect(container.innerHTML).not.toMatch(/(^|[\s"])animate-marquee/);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<MarketTicker />);
    await expectNoA11yViolations(container);
  });
});

describe("FeatureGrid", () => {
  it("lists the three features under a heading", () => {
    render(<FeatureGrid />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Built for looking deeper" }),
    ).toBeInTheDocument();
    for (const title of ["Research", "Track", "Understand"]) {
      expect(screen.getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
    }
  });

  it("is honest about what is not built yet, in text", () => {
    render(<FeatureGrid />);
    expect(screen.getAllByText("Coming soon")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Start searching" })).toHaveAttribute(
      "href",
      "/search",
    );
  });

  it("keeps the reveal animation on the list item and the hover lift on the card", () => {
    const { container } = render(<FeatureGrid />);
    const item = container.querySelector("ul > li");
    expect(item).toHaveClass("reveal");
    expect(item?.firstElementChild?.className).toContain("hover:-translate-y-1");
    expect(item?.className).not.toContain("hover:");
  });

  it("staggers the cards by index and layers depth, when scroll_motion is on", () => {
    const { container } = render(<FeatureGrid />);
    const items = [...container.querySelectorAll("ul > li")] as HTMLElement[];
    expect(items.map((item) => item.style.getPropertyValue("--i"))).toEqual(["0", "1", "2"]);
    // Three depth layers per card section: glow, illustration, text.
    expect(container.querySelectorAll(".parallax").length).toBe(1 + 3 * 2);
    expect(container.querySelectorAll(".draw-on-scroll").length).toBeGreaterThan(10);
  });

  it("draws every illustration stroke fully when nothing is animating", () => {
    vi.stubEnv("FEATURE_SCROLL_MOTION", "false");
    const { container } = render(<FeatureGrid />);
    const strokes = container.querySelectorAll("svg path[pathLength]");
    expect(strokes.length).toBeGreaterThan(10);
    for (const stroke of strokes) {
      expect(stroke.getAttribute("pathLength")).toBe("1");
      expect(stroke.getAttribute("stroke-dasharray")).toBe("1");
      expect(stroke).not.toHaveClass("draw-on-scroll");
    }
  });

  it("is a plain static section when the scroll_motion flag is off", async () => {
    vi.stubEnv("FEATURE_SCROLL_MOTION", "false");
    const { container } = render(<FeatureGrid />);
    expect(container.querySelector(".reveal")).not.toBeInTheDocument();
    expect(container.querySelector(".parallax")).not.toBeInTheDocument();
    expect(container.querySelector(".draw-on-scroll")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    await expectNoA11yViolations(container);
  });

  it("hides the decorative illustrations from assistive technology", () => {
    const { container } = render(<FeatureGrid />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(3);
    for (const svg of svgs) expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<FeatureGrid />);
    await expectNoA11yViolations(container);
  });
});
