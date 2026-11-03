import { describe, expect, it, vi } from "vitest";
import { sendWithCsrf } from "./apiRequest";

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

// ------------------------------------------------------------------------------------------------

import { sendJson } from "./apiRequest";

const json = (status: number, body?: unknown) =>
  vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

describe("sendJson requests", () => {
  it("sends the token, the cookie scope, the JSON body and the idempotency key", async () => {
    const fetcher = json(201, { id: "1" });

    await sendJson("POST", "/api/v1/portfolio/lots", "tok", {
      body: { symbol: "AAPL" },
      idempotencyKey: "key-12345678",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith("/api/v1/portfolio/lots", {
      method: "POST",
      headers: {
        "X-CSRF-Token": "tok",
        "Content-Type": "application/json",
        "Idempotency-Key": "key-12345678",
      },
      credentials: "same-origin",
      body: JSON.stringify({ symbol: "AAPL" }),
    });
  });

  it("sends no body and no content type when there is none", async () => {
    const fetcher = json(204);
    await sendJson("DELETE", "/api/v1/watchlist/AAPL", "tok", { fetcher });
    expect(fetcher).toHaveBeenCalledWith("/api/v1/watchlist/AAPL", {
      method: "DELETE",
      headers: { "X-CSRF-Token": "tok" },
      credentials: "same-origin",
      body: undefined,
    });
  });
});

describe("sendJson results", () => {
  it("returns the data, and says whether the server created something", async () => {
    const created = await sendJson("POST", "/x", "t", { fetcher: json(201, { id: "a" }) });
    const repeat = await sendJson("POST", "/x", "t", { fetcher: json(200, { id: "a" }) });
    expect(created).toEqual({ ok: true, data: { id: "a" }, created: true });
    expect(repeat).toEqual({ ok: true, data: { id: "a" }, created: false });
  });

  it("treats 204 as success with no data", async () => {
    expect(await sendJson("DELETE", "/x", "t", { fetcher: json(204) })).toMatchObject({
      ok: true,
      created: false,
    });
  });

  it.each([
    [401, "signed-out"],
    [403, "stale"],
    [404, "not-found"],
    [429, "rate-limited"],
    [500, "failed"],
    [502, "failed"],
    [503, "failed"],
  ] as const)("maps status %i to %s with a safe sentence", async (status, kind) => {
    const result = await sendJson("POST", "/x", "t", {
      fetcher: json(status, { error: { code: "whatever", message: "<script>alert(1)</script>" } }),
    });
    expect(result).toMatchObject({ ok: false, kind });
    expect(result.ok === false && result.message).not.toContain("<script>");
    expect(result.ok === false && result.message.length).toBeGreaterThan(10);
  });

  it("shows the API's own message only for the codes whose text it authors", async () => {
    const limit = await sendJson("POST", "/x", "t", {
      fetcher: json(409, {
        error: { code: "limit_reached", message: "Your watchlist is full (200)." },
      }),
    });
    const key = await sendJson("POST", "/x", "t", {
      fetcher: json(409, {
        error: { code: "conflict", message: "That Idempotency-Key was reused." },
      }),
    });
    const date = await sendJson("POST", "/x", "t", {
      fetcher: json(400, {
        error: { code: "bad_request", message: "The date cannot be in the future." },
      }),
    });

    expect(limit).toMatchObject({ kind: "limit", message: "Your watchlist is full (200)." });
    expect(key).toMatchObject({ kind: "conflict", message: "That Idempotency-Key was reused." });
    expect(date).toMatchObject({ kind: "invalid", message: "The date cannot be in the future." });
  });

  it("never shows a server message under an unexpected code", async () => {
    const result = await sendJson("POST", "/x", "t", {
      fetcher: json(409, { error: { code: "something_else", message: "<b>injected</b>" } }),
    });
    expect(result).toMatchObject({ ok: false, kind: "conflict" });
    expect(result.ok === false && result.message).not.toContain("injected");
  });

  it("turns validation details into per-field messages, ignoring unknown fields", async () => {
    const result = await sendJson("POST", "/x", "t", {
      fetcher: json(422, {
        error: {
          code: "validation_error",
          details: [
            { loc: ["body", "shares"], message: "String should match pattern", type: "x" },
            { loc: ["body", "unit_cost"], message: "Value error", type: "x" },
            { loc: ["body", "evil<script>"], message: "x", type: "x" },
          ],
        },
      }),
    });

    expect(result).toMatchObject({ ok: false, kind: "invalid" });
    if (!result.ok) {
      expect(Object.keys(result.fields).sort()).toEqual(["shares", "unit_cost"]);
      expect(result.fields.shares).toMatch(/shares above zero/);
      expect(JSON.stringify(result.fields)).not.toContain("pattern");
    }
  });

  it("survives an error response that is not JSON", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("<html>boom</html>", { status: 502 }));
    expect(await sendJson("POST", "/x", "t", { fetcher })).toMatchObject({
      ok: false,
      kind: "failed",
    });
  });

  it("reports a dropped connection as a failure that is safe to retry", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await sendJson("POST", "/x", "t", { fetcher })).toMatchObject({
      ok: false,
      kind: "failed",
    });
  });
});
