import clsx from "clsx";
import { isEnabled } from "@/lib/flags";
import { Feature } from "@/components/ui/Feature";
import { HeroChart } from "./HeroChart";
import { TickerChips } from "./TickerChips";
import { SearchBox } from "@/features/search";

/** Entrance stagger: headline, copy, search, then the chart. Each step is a CSS delay. */
const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

export function Hero() {
  // With the chart switched off, the text column is centered and takes the full width.
  const withChart = isEnabled("hero_chart");
  const centered = !withChart;

  return (
    <section aria-labelledby="hero-heading" className="bg-surface relative isolate overflow-hidden">
      {/* Decorative depth: an accent glow and a faint grid that fades out. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="animate-fade-in bg-brand/20 absolute -top-32 right-[-8rem] size-[34rem] rounded-full blur-3xl" />
        <div
          className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>

      <div className="flex flex-col-reverse items-center gap-12 px-6 py-16 md:flex-row lg:gap-20 lg:px-24 lg:py-24">
        <div
          className={clsx(
            "flex-1 space-y-8 text-center",
            centered ? "mx-auto max-w-3xl" : "md:text-left",
          )}
        >
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
              centered ? "mx-auto max-w-xl" : "lg:max-w-md",
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
          <div
            className="animate-fade-up w-full max-w-lg flex-1 md:max-w-md lg:max-w-xl"
            style={delay(200)}
          >
            <HeroChart />
          </div>
        </Feature>
      </div>
    </section>
  );
}
