import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("gives each scroll animation its own element, with the hover lift on the card", () => {
    const { container } = render(<FeatureGrid />);
    const item = container.querySelector("ul > li");
    expect(item).toHaveClass("reveal");
    const wrapper = item?.firstElementChild;
    expect(wrapper).toHaveClass("parallax-enter");
    const card = wrapper?.firstElementChild;
    expect(card?.tagName).toBe("ARTICLE");
    expect(card?.className).toContain("hover:-translate-y-1.5");
    expect(item?.className).not.toContain("hover:");
  });

  it("never puts two scroll animations on one element (they would fight over animation)", () => {
    const { container } = render(<FeatureGrid />);
    const animations = ["reveal", "parallax", "parallax-enter"];
    for (const element of container.querySelectorAll("*")) {
      const used = animations.filter((name) => element.classList.contains(name));
      expect(used.length, element.outerHTML.slice(0, 80)).toBeLessThanOrEqual(1);
    }
  });

  it("never uses overflow-hidden, which would capture the scroll timeline", () => {
    const { container } = render(<FeatureGrid />);
    expect(container.innerHTML).not.toContain("overflow-hidden");
  });

  it("staggers the cards by index, with the middle card lagging most", () => {
    const { container } = render(<FeatureGrid />);
    const items = [...container.querySelectorAll("ul > li")] as HTMLElement[];
    expect(items.map((item) => item.style.getPropertyValue("--i"))).toEqual(["0", "1", "2"]);
    const wrappers = [...container.querySelectorAll(".parallax-enter")];
    expect(wrappers).toHaveLength(3);
    expect(wrappers.map((el) => /--parallax-from:(\d+)px/.exec(el.className)?.[1])).toEqual([
      "48",
      "104",
      "48",
    ]);
  });

  it("layers depth: a background glow plus the icon and the text of every card", () => {
    const { container } = render(<FeatureGrid />);
    expect(container.querySelectorAll(".parallax").length).toBe(1 + 3 * 2);
  });

  describe("icons", () => {
    const iconOf = (container: HTMLElement, index: number) =>
      container.querySelectorAll("ul > li")[index]!.querySelector("svg")!;

    it("are decorative, one per card", () => {
      const { container } = render(<FeatureGrid />);
      for (let index = 0; index < 3; index++) {
        expect(iconOf(container, index)).toHaveAttribute("aria-hidden", "true");
      }
    });

    it("writes every hover animation class out in full so Tailwind generates its CSS", () => {
      // Tailwind only generates classes it can read verbatim in the source. A class assembled at
      // runtime renders in the HTML but has no CSS, so the animation silently never plays.
      const source = readFileSync(
        resolve(process.cwd(), "src/features/home/FeatureIcons.tsx"),
        "utf8",
      );
      const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
      for (const name of ["lens-scan", "pin", "redraw", "ping-dot", "ray", "bulb"]) {
        expect(source, name).toContain("motion-safe:group-hover:animate-" + name);
        expect(source, name).toContain("motion-safe:group-focus-within:animate-" + name);
        expect(css, name).toContain("--animate-" + name + ":");
      }
      expect(source).not.toContain("group-hover:${");
    });

    it("act out their names on hover or keyboard focus, and only when motion is allowed", () => {
      const { container } = render(<FeatureGrid />);
      const expected = ["animate-lens-scan", "animate-pin", "animate-bulb"];
      expected.forEach((animation, index) => {
        const html = iconOf(container, index).outerHTML;
        expect(html).toContain("motion-safe:group-hover:" + animation);
        expect(html).toContain("motion-safe:group-focus-within:" + animation);
      });
      // Never an ungated hover animation: the Motion setting must always be able to stop them.
      for (const element of container.querySelectorAll("svg *")) {
        const classes = element.getAttribute("class") ?? "";
        expect(classes).not.toMatch(/(^|s)group-hover:animate-/);
      }
    });

    it("Research lights each line up in sequence as the magnifier reaches it", () => {
      const { container } = render(<FeatureGrid />);
      const lines = [...iconOf(container, 0).querySelectorAll("path")].filter((p) =>
        (p.getAttribute("class") ?? "").includes("group-hover:stroke-brand"),
      );
      expect(lines).toHaveLength(3);
      const delays = lines.map((p) => /delay-\[(\d+)ms\]/.exec(p.getAttribute("class") ?? "")?.[1]);
      expect(delays).toEqual(["350", "1100", "1800"]);
    });

    it("Understand fans out seven rays, staggered", () => {
      const { container } = render(<FeatureGrid />);
      const rays = [...iconOf(container, 2).querySelectorAll("path")].filter((p) =>
        (p.getAttribute("class") ?? "").includes("animate-ray"),
      );
      expect(rays).toHaveLength(7);
      expect(rays.map((p) => (p as SVGElement).style.animationDelay)).toEqual([
        "0ms",
        "70ms",
        "140ms",
        "210ms",
        "280ms",
        "350ms",
        "420ms",
      ]);
    });
  });

  it("is a plain static section when the scroll_motion flag is off", async () => {
    vi.stubEnv("FEATURE_SCROLL_MOTION", "false");
    const { container } = render(<FeatureGrid />);
    for (const name of [".reveal", ".parallax", ".parallax-enter"]) {
      expect(container.querySelector(name), name).not.toBeInTheDocument();
    }
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
