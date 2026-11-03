import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";

// Each page has its own title; without one a screen reader announces just the site name.
export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <EmptyState
      headingLevel={1}
      title="Not found"
      description="We could not find that page or company."
      action={<LinkButton href="/search">Back to search</LinkButton>}
    />
  );
}
