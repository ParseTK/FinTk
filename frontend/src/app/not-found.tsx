import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="text-fg-muted">We could not find that page or company.</p>
      <Link href="/search" className="text-brand underline">
        Back to search
      </Link>
    </div>
  );
}
