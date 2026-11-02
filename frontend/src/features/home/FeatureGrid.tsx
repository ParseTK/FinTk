import type { ComponentType } from "react";
import { BookmarkIcon, DocumentIcon, TrendIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";

interface Feature {
  title: string;
  body: string;
  Icon: ComponentType<{ className?: string }>;
  /** Features that are not built yet say so in text; nothing here promises more than exists. */
  status: "available" | "soon";
}

const FEATURES: readonly Feature[] = [
  {
    title: "Research",
    body: "Search any public company and read its profile, straight from primary sources.",
    Icon: DocumentIcon,
    status: "available",
  },
  {
    title: "Track",
    body: "Keep a watchlist and a portfolio with your own shares and cost basis.",
    Icon: BookmarkIcon,
    status: "soon",
  },
  {
    title: "Understand",
    body: "See how a stock behaves month by month across the years, and build your own reports.",
    Icon: TrendIcon,
    status: "soon",
  },
];

export function FeatureGrid() {
  return (
    <section aria-labelledby="features-heading" className="py-16 lg:py-24">
      <Container>
        <h2
          id="features-heading"
          className="reveal mb-10 text-center text-3xl font-bold tracking-tight lg:text-4xl"
        >
          Built for looking deeper
        </h2>
        <ul className="grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ title, body, Icon, status }) => (
            // The reveal animation lives on the li; the hover lift lives on the card inside it,
            // because a finished animation would otherwise hold its transform and block the lift.
            <li key={title} className="reveal">
              <Card
                as="article"
                className="hover:border-brand/50 flex h-full flex-col gap-4 transition duration-300 hover:shadow-xl motion-safe:hover:-translate-y-1"
              >
                <span className="bg-brand/15 text-brand flex size-12 items-center justify-center rounded-xl">
                  <Icon />
                </span>
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
              </Card>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
