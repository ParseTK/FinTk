import clsx from "clsx";
import type { ComponentType, CSSProperties } from "react";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/LinkButton";
import { isEnabled } from "@/lib/flags";
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
 * How far each column starts below its final spot. The middle card lags most, so as the section
 * scrolls in the three cards visibly converge into one row at different speeds. They always come to
 * rest exactly aligned. (Literal strings, so Tailwind can see them.)
 */
const COLUMN_OFFSET = [
  "[--parallax-from:48px]",
  "[--parallax-from:104px]",
  "[--parallax-from:48px]",
] as const;

/**
 * With the scroll_motion flag on, the section reveals as it scrolls into view: cards fade up in a
 * stagger, converge at different speeds, three layers (glow, illustration, text) drift for depth,
 * and each icon acts out its name when you hover it. All of it is scroll-driven CSS: no JavaScript, and
 * a plain static section in browsers without support, with the flag off, or with Motion Reduced.
 *
 * Note: overflow-clip, never overflow-hidden, on anything that contains these animations. Hidden
 * makes an element a scroll container, which captures the scroll timeline so nothing moves.
 */
export function FeatureGrid() {
  const animated = isEnabled("scroll_motion");

  return (
    <section
      aria-labelledby="features-heading"
      className="relative isolate overflow-clip py-16 lg:py-24"
    >
      {/* Back layer: a soft glow that drifts against the page. Decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)]"
      >
        <div
          className={clsx(
            "absolute inset-x-0 top-1/4 mx-auto h-96 max-w-4xl rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--brand)_24%,transparent),transparent)]",
            animated && "parallax [--parallax-from:-120px] [--parallax-to:120px]",
          )}
        />
      </div>
      <Container>
        <h2
          id="features-heading"
          className={clsx(
            "mb-12 text-center text-3xl font-bold tracking-tight lg:text-4xl",
            animated && "reveal",
          )}
        >
          Built for looking deeper
        </h2>
        <ul className="grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ title, body, Icon, status }, index) => (
            // Three nested elements, because each animation owns the CSS animation property:
            // li fades up, the wrapper converges, and the card (hover lift) stays free to transform.
            <li
              key={title}
              className={clsx(animated && "reveal")}
              style={{ "--i": index } as CSSProperties}
            >
              <div
                className={clsx(
                  "h-full",
                  animated && ["parallax-enter [--parallax-to:0px]", COLUMN_OFFSET[index]],
                )}
              >
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
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xl font-semibold">{title}</h3>
                      <span
                        aria-hidden="true"
                        className="text-brand text-sm font-semibold tabular-nums"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
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
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
