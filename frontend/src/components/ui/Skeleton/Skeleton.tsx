import clsx from "clsx";

/**
 * Decorative loading placeholder. It is hidden from assistive tech, so wherever you show skeletons
 * also render a live status such as <p role="status" className="sr-only">Loading company</p>.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--border),var(--surface-raised),var(--border))] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={clsx("space-y-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={clsx("h-4", index === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
