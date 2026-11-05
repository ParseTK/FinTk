import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";

/** The frame the holdings pages share: a heading, one line of context, then the body. */
export function HoldingsShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <Container className="space-y-6 py-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-fg-muted">{intro}</p>
      </header>
      {children}
    </Container>
  );
}
