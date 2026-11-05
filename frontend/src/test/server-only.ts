// Under vitest the "server-only" guard must not throw: unit tests render server components in a
// jsdom environment. The real package still guards the real bundles.
export {};
