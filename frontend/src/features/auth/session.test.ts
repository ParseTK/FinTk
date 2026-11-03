import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
}));

const GET = vi.fn();
vi.mock("@/lib/api/client", () => ({ privateApi: { GET: (...args: unknown[]) => GET(...args) } }));

const { getSession } = await import("./session");

const signedIn = {
  user: { id: "u1", email: "octo@example.com", name: "Octo Cat", avatar_url: null },
  csrf_token: "csrf-123",
  providers: ["github", "google"],
};

beforeEach(() => {
  jar.clear();
  GET.mockReset();
});

describe("getSession", () => {
  it("asks the API who is signed in and maps the answer", async () => {
    GET.mockResolvedValue({ data: signedIn });
    jar.set("virello_session", "token-abc");

    expect(await getSession()).toEqual({
      user: signedIn.user,
      csrfToken: "csrf-123",
      providers: ["github", "google"],
      reachable: true,
    });
    expect(GET).toHaveBeenCalledWith("/api/v1/auth/session", {
      headers: { cookie: "virello_session=token-abc" },
    });
  });

  it("forwards only our own session cookie, never the other cookies the browser sent", async () => {
    GET.mockResolvedValue({ data: signedIn });
    jar.set("__Host-virello_session", "prod-token");
    jar.set("theme", "dark");
    jar.set("analytics_id", "tracking-value");

    await getSession();

    const { headers } = GET.mock.calls[0]![1] as { headers: { cookie: string } };
    expect(headers.cookie).toBe("__Host-virello_session=prod-token");
    expect(headers.cookie).not.toContain("tracking-value");
  });

  it("sends no cookie header at all for an anonymous visitor", async () => {
    GET.mockResolvedValue({ data: { user: null, csrf_token: null, providers: ["github"] } });

    const session = await getSession();

    expect(GET.mock.calls[0]![1]).toEqual({ headers: {} });
    expect(session).toEqual({
      user: null,
      csrfToken: null,
      providers: ["github"],
      reachable: true,
    });
  });

  it("treats an unreachable API as signed out, flagged, instead of failing the page", async () => {
    GET.mockRejectedValue(new TypeError("fetch failed"));
    expect(await getSession()).toEqual({
      user: null,
      csrfToken: null,
      providers: [],
      reachable: false,
    });
  });

  it("treats an error response the same way", async () => {
    GET.mockResolvedValue({ data: undefined, error: { error: { code: "unavailable" } } });
    expect((await getSession()).reachable).toBe(false);
  });
});
