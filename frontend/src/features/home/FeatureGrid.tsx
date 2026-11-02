import clsx from "clsx";
import type { ComponentType } from "react";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/LinkButton";
import { Reveal } from "@/components/ui/Reveal";
import { isEnabled } from "@/lib/flags";
import { FeatureBackdrop } from "./FeatureBackdrop";
import { ResearchIcon, TrackIcon, UnderstandIcon } from "./FeatureIcons";

interface Feature {
  title: string;
  body: string;
  Icon: ComponentType;
  /** Features that are not built yet say so in text; nothing here promises more than exists. */
  status: "available" | "soon";
}

const FEATURES: readonly Feature[] = [
  {
    title: "Research",
    body: "Search any public company and read its profile, straight from primary sources.",
    Icon: ResearchIcon,
    status: "available",
  },
  {
    title: "Track",
    body: "Keep a watchlist and a portfolio with your own shares and cost basis.",
    Icon: TrackIcon,
    status: "soon",
  },
  {
    title: "Understand",
    body: "See how a stock behaves month by month across the years, and build your own reports.",
    Icon: UnderstandIcon,
    status: "soon",
  },
];

/**
 * With the scroll_motion flag on, the section has two kinds of motion, each with its own job:
 *
 *  - an entrance: the heading and then the cards play a short, choreographed reveal (left to right)
 *    as they arrive, once, and land exactly aligned (Reveal);
 *  - depth: the background art, and the icon and text inside each card, drift at different speeds
 *    while you scroll (scroll-driven CSS parallax, no JavaScript).
 *
 * Both stop with Motion set to Reduced, and the section is plain and static with the flag off.
 *
 * Note: overflow-clip, never overflow-hidden, on anything that contains the parallax. Hidden makes
 * an element a scroll container, which captures the scroll timeline so nothing moves.
 */
export function FeatureGrid() {
  const animated = isEnabled("scroll_motion");

  return (
    <section
      aria-labelledby="features-heading"
      className="relative isolate overflow-clip py-16 lg:py-24"
    >
      {/* Layered background art with real depth: three layers drifting at different speeds. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]"
      >
        <FeatureBackdrop animated={animated} />
      </div>
      <Container>
        <Reveal disabled={!animated} className="mb-12">
          <h2
            id="features-heading"
            className="text-center text-3xl font-bold tracking-tight lg:text-4xl"
          >
            Built for looking deeper
          </h2>
        </Reveal>
        <ul className="grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ title, body, Icon, status }, index) => (
            <Reveal as="li" key={title} index={index} disabled={!animated}>
              <Card
                as="article"
                className="group hover:border-brand/60 relative flex h-full flex-col gap-5 overflow-clip rounded-2xl p-5 transition duration-300 hover:shadow-[0_24px_60px_-24px_color-mix(in_oklab,var(--brand)_60%,transparent)] motion-safe:hover:-translate-y-1.5"
              >
                {/* A soft accent glow in the corner that brightens on hover. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,color-mix(in_oklab,var(--brand)_16%,transparent),transparent_65%)] opacity-70 transition-opacity duration-500 group-hover:opacity-100"
                />

                {/* Illustration panel: gradient, dot grid, and a drifting scene. */}
                <div className="border-brand/20 from-brand/25 via-brand/10 relative h-36 overflow-clip rounded-xl border bg-gradient-to-br to-transparent">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 [background-image:radial-gradient(color-mix(in_oklab,var(--fg)_20%,transparent)_1px,transparent_1.5px)] [mask-image:linear-gradient(to_bottom,black,transparent)] [background-size:14px_14px] opacity-70"
                  />
                  <div
                    className={clsx(
                      "relative h-full p-3",
                      animated && "parallax [--parallax-from:18px] [--parallax-to:-14px]",
                    )}
                  >
                    <div className="mx-auto h-full w-28">
                      <Icon />
                    </div>
                  </div>
                </div>

                <div
                  className={clsx(
                    "relative flex flex-1 flex-col gap-3",
                    animated && "parallax [--parallax-from:10px] [--parallax-to:-6px]",
                  )}
                >
                  <h3 className="text-xl font-semibold">{title}</h3>
                  <p className="text-fg-muted flex-1">{body}</p>
                  {status === "available" ? (
                    <div>
                      <LinkButton href="/search" variant="secondary" size="sm">
                        Start searching
                      </LinkButton>
                    </div>
                  ) : (
                    <p>
                      <span className="border-border-strong text-fg-muted rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                        Coming soon
                      </span>
                    </p>
                  )}
                </div>
              </Card>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
