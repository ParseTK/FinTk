import clsx from "clsx";
import { Container } from "@/components/ui/Container";
import { Feature } from "@/components/ui/Feature";
import { SearchBox } from "@/features/search";
import { isEnabled } from "@/lib/flags";
import { HeroChart } from "./HeroChart";
import { TickerChips } from "./TickerChips";

/** Entrance stagger: headline, copy, search, then the chart. Each step is a CSS delay. */
const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

export function Hero() {
  // With the chart switched off, the text column is centered and takes the full width.
  const withChart = isEnabled("hero_chart");
  const centered = !withChart;
  // Layers lag behind the page as you scroll away from the top (scroll_motion flag, Motion setting).
  const drift = isEnabled("scroll_motion");

  return (
    // overflow-clip, not overflow-hidden: hidden would make this a scroll container and capture the
    // scroll-driven animations inside it.
    <section aria-labelledby="hero-heading" className="bg-surface relative isolate overflow-clip">
      {/* Decorative depth: an accent glow and a faint grid that fades out. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black_60%,transparent)]"
      >
        <div
          className={clsx(
            "absolute -top-32 right-[-8rem]",
            drift && "parallax-page [--parallax-from:0px] [--parallax-to:150px]",
          )}
        >
          <div className="animate-fade-in bg-brand/20 size-[34rem] rounded-full blur-3xl" />
        </div>
        <div
          className={clsx(
            "absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] opacity-70",
            drift && "parallax-page [--parallax-from:0px] [--parallax-to:50px]",
          )}
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>

      {/* A centered, width-limited pair of columns, so text and chart stay close at any window size. */}
      <Container
        className={clsx(
          "grid items-center gap-12 py-14 lg:py-20",
          centered ? "justify-items-center" : "md:grid-cols-2 md:gap-10 lg:gap-16",
        )}
      >
        <div className={clsx("space-y-8 text-center", centered ? "max-w-3xl" : "md:text-left")}>
          <h1
            id="hero-heading"
            className="animate-fade-up text-4xl leading-[1.05] font-bold tracking-tight lg:text-6xl"
          >
            Financial data without the{" "}
            <span className="from-brand bg-gradient-to-r to-[color-mix(in_oklab,var(--brand),var(--fg)_40%)] bg-clip-text text-transparent">
              hype
            </span>
            .
          </h1>
          <p
            className={clsx(
              "animate-fade-up text-fg-muted text-xl",
              centered ? "mx-auto max-w-xl" : "md:max-w-md",
            )}
            style={delay(120)}
          >
            Research public companies from primary filings and financials, without the noise.
          </p>
          <div className="animate-fade-up space-y-4" style={delay(240)}>
            <div className={clsx("flex justify-center", !centered && "md:justify-start")}>
              <SearchBox size="lg" />
            </div>
            <div className={clsx("flex justify-center", !centered && "md:justify-start")}>
              <TickerChips />
            </div>
          </div>
        </div>
        <Feature flag="hero_chart">
          {/* Outer element drifts with the page; the inner one plays the entrance. They cannot be
              the same element because both use the CSS animation property. */}
          <div
            className={clsx(
              "w-full max-w-xl justify-self-center md:justify-self-end",
              drift && "parallax-page [--parallax-from:0px] [--parallax-to:70px]",
            )}
          >
            <div className="animate-fade-up" style={delay(200)}>
              <HeroChart />
            </div>
          </div>
        </Feature>
      </Container>
    </section>
  );
}
