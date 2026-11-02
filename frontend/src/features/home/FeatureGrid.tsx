import clsx from "clsx";
import type { ComponentType, CSSProperties } from "react";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/LinkButton";
import { isEnabled } from "@/lib/flags";
import {
  ResearchIllustration,
  TrackIllustration,
  UnderstandIllustration,
} from "./FeatureIllustrations";

interface Feature {
  title: string;
  body: string;
  Illustration: ComponentType<{ animated: boolean }>;
  /** Features that are not built yet say so in text; nothing here promises more than exists. */
  status: "available" | "soon";
}

const FEATURES: readonly Feature[] = [
  {
    title: "Research",
    body: "Search any public company and read its profile, straight from primary sources.",
    Illustration: ResearchIllustration,
    status: "available",
  },
  {
    title: "Track",
    body: "Keep a watchlist and a portfolio with your own shares and cost basis.",
    Illustration: TrackIllustration,
    status: "soon",
  },
  {
    title: "Understand",
    body: "See how a stock behaves month by month across the years, and build your own reports.",
    Illustration: UnderstandIllustration,
    status: "soon",
  },
];

/**
 * With the scroll_motion flag on, the section reveals as it scrolls into view: cards rise in a
 * stagger, three layers (glow, illustration, text) drift at different speeds for depth, and each
 * illustration draws itself. All of it is scroll-driven CSS: no JavaScript, and a plain static
 * section in browsers without support, with the flag off, or with Motion set to Reduced.
 */
export function FeatureGrid() {
  const animated = isEnabled("scroll_motion");

  return (
    <section
      aria-labelledby="features-heading"
      className="relative isolate overflow-hidden py-16 lg:py-24"
    >
      {/* Back layer: a soft glow that drifts slower than the page. Decorative. */}
      <div
        aria-hidden="true"
        className={clsx(
          "bg-brand/10 pointer-events-none absolute inset-x-0 top-1/4 -z-10 mx-auto h-80 max-w-3xl rounded-full blur-3xl",
          animated && "parallax [--parallax-from:-70px] [--parallax-to:70px]",
        )}
      />
      <Container>
        <h2
          id="features-heading"
          className={clsx(
            "mb-10 text-center text-3xl font-bold tracking-tight lg:text-4xl",
            animated && "reveal",
          )}
        >
          Built for looking deeper
        </h2>
        <ul className="grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ title, body, Illustration, status }, index) => (
            // The reveal lives on the li; the hover lift lives on the card inside it, because a
            // finished animation would otherwise hold its transform and block the lift.
            <li
              key={title}
              className={clsx(animated && "reveal")}
              style={{ "--i": index } as CSSProperties}
            >
              <Card
                as="article"
                className="hover:border-brand/50 flex h-full flex-col gap-4 overflow-hidden transition duration-300 hover:shadow-xl motion-safe:hover:-translate-y-1"
              >
                {/* Middle layer: the illustration moves faster than the card. */}
                <div className="bg-brand/10 relative h-28 overflow-hidden rounded-xl p-2">
                  <div
                    className={clsx(
                      "h-full",
                      animated && "parallax [--parallax-from:22px] [--parallax-to:-14px]",
                    )}
                  >
                    <Illustration animated={animated} />
                  </div>
                </div>
                {/* Front layer: text drifts a little less. */}
                <div
                  className={clsx(
                    "flex flex-1 flex-col gap-3",
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
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
