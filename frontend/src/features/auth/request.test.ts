import { describe, expect, it, vi } from "vitest";
import { sendWithCsrf } from "./request";

const respond = (status: number) => vi.fn().mockResolvedValue(new Response(null, { status }));

describe("sendWithCsrf", () => {
  it("sends the method, the CSRF token and the cookie to our own origin", async () => {
    const fetcher = respond(204);

    await sendWithCsrf("POST", "/api/v1/auth/logout", "tok-1", fetcher);

    expect(fetcher).toHaveBeenCalledWith("/api/v1/auth/logout", {
      method: "POST",
      headers: { "X-CSRF-Token": "tok-1" },
      credentials: "same-origin",
    });
  });

  it.each([
    [204, "ok"],
    [200, "ok"],
    [401, "signed-out"],
    [403, "stale"],
    [404, "failed"],
    [429, "failed"],
    [500, "failed"],
    [503, "failed"],
  ] as const)("maps status %i to %s", async (status, expected) => {
    expect(await sendWithCsrf("DELETE", "/api/v1/me", "t", respond(status))).toBe(expected);
  });

  it("reports a dropped connection as a failure that is safe to retry", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await sendWithCsrf("POST", "/x", "t", fetcher)).toBe("failed");
  });
});
