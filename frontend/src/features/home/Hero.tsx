import clsx from "clsx";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { isEnabled } from "@/lib/flags";

/** Entrance stagger: headline, copy, actions, then the chart. Each step is a CSS delay. */
const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

export interface HeroProps {
  /** The headline. It is the page's h1. */
  headline: ReactNode;
  body: string;
  /** Links or buttons under the text. */
  actions?: ReactNode;
  /** Shown beside the text. Null (or left out) means no chart: the text is then centered. */
  chart?: ReactNode | null;
}

export function Hero({ headline, body, actions, chart = null }: HeroProps) {
  const centered = chart === null;
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
          <div className="animate-fade-in size-[34rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--brand)_34%,transparent),transparent)]" />
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
        size="wide"
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
            {headline}
          </h1>
          <p
            className={clsx(
              "animate-fade-up text-fg-muted text-xl",
              centered ? "mx-auto max-w-xl" : "md:max-w-md",
            )}
            style={delay(120)}
          >
            {body}
          </p>
          {actions && (
            <div
              className={clsx(
                "animate-fade-up flex flex-wrap justify-center gap-3",
                !centered && "md:justify-start",
              )}
              style={delay(240)}
            >
              {actions}
            </div>
          )}
        </div>
        {chart !== null && (
          // Outer element drifts with the page; the inner one plays the entrance. They cannot be the
          // same element because both use the CSS animation property.
          <div
            className={clsx(
              "w-full max-w-xl justify-self-center md:justify-self-end",
              drift && "parallax-page [--parallax-from:0px] [--parallax-to:70px]",
            )}
          >
            <div className="animate-fade-up" style={delay(200)}>
              {chart}
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}
