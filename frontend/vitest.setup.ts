import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// "server-only" throws outside a Server Component; tests render those components directly.
vi.mock("server-only", () => ({}));

// Components that read the current route get "/" by default; tests override with
// vi.mocked(usePathname).mockReturnValue("/search").
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: vi.fn(() => "/"),
}));

// jsdom does not implement matchMedia; default to "light, no preference".
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
