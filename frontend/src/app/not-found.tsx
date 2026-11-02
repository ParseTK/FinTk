import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";

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
