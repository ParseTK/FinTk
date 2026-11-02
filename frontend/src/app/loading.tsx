import { Container } from "@/components/ui/Container";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <Container className="space-y-6 py-12">
      <p role="status" className="sr-only">
        Loading
      </p>
      <Skeleton className="h-10 w-1/2" />
      <SkeletonText lines={4} />
    </Container>
  );
}
