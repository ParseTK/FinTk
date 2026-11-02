"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-xl space-y-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-fg-muted">We could not load market data. Please try again.</p>
      <button
        type="button"
        onClick={reset}
        className="bg-brand text-on-accent rounded-lg px-6 py-2 hover:opacity-80"
      >
        Try again
      </button>
    </div>
  );
}
