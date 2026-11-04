import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// The visitor's cookies, set per test. The home page reads the mode cookie through next/headers.
let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "virello_mode" && cookieValue !== undefined ? { value: cookieValue } : undefined,
  }),
}));

// Crypto mode shows the crypto overview, which asks the API. Not what these tests are about.
const GET = vi.fn();
vi.mock("@/lib/api/client", () => ({ privateApi: { GET: (...args: unknown[]) => GET(...args) } }));

const { default: HomePage } = await import("./page");

beforeEach(() => {
  cookieValue = undefined;
  GET.mockReset(); // braces: a returned function would be run by vitest as a cleanup hook
  GET.mockResolvedValue({ data: undefined });
});
afterEach(() => vi.unstubAllEnvs());

describe("home page with the switch off (the usual company-research landing page)", () => {
  it("shows the hero, the sample ticker and the feature cards", async () => {
    render(await HomePage());
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /sample market snapshot/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Built for looking deeper" }),
    ).toBeInTheDocument();
  });

  it("places the sample ticker above the hero", async () => {
    render(await HomePage());
    const ticker = screen.getByRole("region", { name: /sample market snapshot/i });
    const hero = screen.getByRole("heading", { level: 1 });
    // DOCUMENT_POSITION_FOLLOWING (4): the hero comes after the ticker in the document.
    expect(ticker.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("removes only the ticker when the market_ticker flag is off", async () => {
    vi.stubEnv("FEATURE_MARKET_TICKER", "false");
    render(await HomePage());
    expect(
      screen.queryByRole("region", { name: /sample market snapshot/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Built for looking deeper" }),
    ).toBeInTheDocument();
  });

  it("ignores a stored mode while the switch is off", async () => {
    cookieValue = "crypto";
    render(await HomePage());
    expect(
      screen.getByRole("heading", { level: 2, name: "Built for looking deeper" }),
    ).toBeVisible();
  });
});

describe("home page with the Crypto | Stocks switch on", () => {
  beforeEach(() => {
    vi.stubEnv("FEATURE_MODE_SWITCH", "true");
    vi.stubEnv("FEATURE_CRYPTO", "true");
  });

  it("is the crypto overview for a first-time visitor: crypto is the default", async () => {
    render(await HomePage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Crypto data without the hype." }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Built for looking deeper" }),
    ).not.toBeInTheDocument();
    expect(GET).toHaveBeenCalledWith("/api/v1/crypto/overview");
  });

  it("is the usual landing page in Stocks mode", async () => {
    cookieValue = "stocks";
    render(await HomePage());
    expect(
      screen.getByRole("heading", { level: 2, name: "Built for looking deeper" }),
    ).toBeVisible();
    expect(GET).not.toHaveBeenCalled();
  });

  it("treats a tampered cookie as the default, crypto", async () => {
    cookieValue = "<script>alert(1)</script>";
    render(await HomePage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Crypto data without the hype." }),
    ).toBeVisible();
  });

  it("falls back to the usual page when the crypto page itself is off, so there is no empty room", async () => {
    vi.stubEnv("FEATURE_CRYPTO", "false");
    render(await HomePage());
    expect(
      screen.getByRole("heading", { level: 2, name: "Built for looking deeper" }),
    ).toBeVisible();
  });
});
