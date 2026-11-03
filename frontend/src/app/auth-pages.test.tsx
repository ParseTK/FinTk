import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";

vi.mock("server-only", () => ({}));

class Redirected extends Error {
  constructor(public readonly to: string) {
    super(`redirect:${to}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
}));

const getSession = vi.fn();
vi.mock("@/features/auth/session", () => ({ getSession: () => getSession() }));

const { default: SignInPage } = await import("./sign-in/page");
const { default: AccountPage } = await import("./account/page");

const user = { id: "u1", email: "octo@example.com", name: "Octo Cat", avatar_url: null };
const signedOut = { user: null, csrfToken: null, providers: ["github", "google"], reachable: true };
const signedIn = { user, csrfToken: "csrf-1", providers: ["github"], reachable: true };

const params = (value: Record<string, string | string[]>) => Promise.resolve(value);

beforeEach(() => getSession.mockReset());

describe("/sign-in", () => {
  it("shows the sign-in options to a visitor, with the page they wanted next", async () => {
    getSession.mockResolvedValue(signedOut);

    const { container } = render(await SignInPage({ searchParams: params({ next: "/search" }) }));

    expect(screen.getByRole("link", { name: "Continue with GitHub" })).toHaveAttribute(
      "href",
      "/api/v1/auth/github/login?next=%2Fsearch",
    );
    await expectNoA11yViolations(container);
  });

  it("shows why the last attempt failed", async () => {
    getSession.mockResolvedValue(signedOut);
    render(await SignInPage({ searchParams: params({ error: "unverified" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("verified email");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"])(
    "replaces the unsafe destination %s with the home page",
    async (next) => {
      getSession.mockResolvedValue(signedOut);
      render(await SignInPage({ searchParams: params({ next }) }));
      expect(screen.getByRole("link", { name: "Continue with GitHub" })).toHaveAttribute(
        "href",
        "/api/v1/auth/github/login?next=%2F",
      );
    },
  );

  it("sends someone who is already signed in straight on to where they were going", async () => {
    getSession.mockResolvedValue(signedIn);
    await expect(SignInPage({ searchParams: params({ next: "/account" }) })).rejects.toMatchObject({
      to: "/account",
    });
  });

  it("never redirects a signed-in person off the site", async () => {
    getSession.mockResolvedValue(signedIn);
    await expect(
      SignInPage({ searchParams: params({ next: "https://evil.example" }) }),
    ).rejects.toMatchObject({ to: "/" });
  });

  it("tells the visitor when sign-in cannot be reached", async () => {
    getSession.mockResolvedValue({ ...signedOut, providers: [], reachable: false });
    render(await SignInPage({ searchParams: params({}) }));
    expect(screen.getByRole("status")).toHaveTextContent("Sign-in is unavailable");
  });
});

describe("/account", () => {
  it("sends a visitor to sign in and then back to the account", async () => {
    getSession.mockResolvedValue(signedOut);
    await expect(AccountPage()).rejects.toMatchObject({ to: "/sign-in?next=%2Faccount" });
  });

  it("shows the profile and the delete option to a signed-in person", async () => {
    getSession.mockResolvedValue(signedIn);

    const { container } = render(await AccountPage());

    expect(screen.getByRole("heading", { level: 1, name: "Your account" })).toBeInTheDocument();
    expect(screen.getByText("octo@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete my account" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
