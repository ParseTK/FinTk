import { describe, expect, it, vi } from "vitest";
import { fetchWithWake, isHostError, type WakeOptions } from "./wake";

const json = (status: number) =>
  new Response("{}", { status, headers: { "content-type": "application/json" } });
const html = (status: number) =>
  new Response("starting", { status, headers: { "content-type": "text/html" } });

/** A clock the fake sleep advances, so a "minute" of waiting takes no real time. */
function clock(overrides: Partial<WakeOptions> = {}) {
  let time = 0;
  const sleep = vi.fn(async (ms: number) => {
    time += ms;
  });
  const options: WakeOptions = {
    budgetMs: 60_000,
    attemptMs: 10_000,
    pauseMs: 2_000,
    sleep,
    now: () => time,
    ...overrides,
  };
  return { options, sleep, advance: (ms: number) => (time += ms) };
}

const get = () => new Request("https://api.test/x");

describe("isHostError", () => {
  it("is true for a gateway error that is not our JSON error", () => {
    expect(isHostError(html(502))).toBe(true);
    expect(isHostError(html(503))).toBe(true);
  });
  it("is false for our own JSON errors and for other statuses", () => {
    expect(isHostError(json(503))).toBe(false);
    expect(isHostError(json(502))).toBe(false);
    expect(isHostError(html(500))).toBe(false);
    expect(isHostError(html(200))).toBe(false);
  });
});

describe("fetchWithWake", () => {
  it("returns an ordinary answer at once, without waiting", async () => {
    const { options, sleep } = clock();
    const send = vi.fn(async () => json(200));
    const response = await fetchWithWake(get(), send, options);
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("returns our own API's errors at once: they are answers, not a sleeping host", async () => {
    const { options } = clock();
    const send = vi.fn(async () => json(503));
    expect((await fetchWithWake(get(), send, options)).status).toBe(503);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps trying while the host is starting, then returns the real answer", async () => {
    const { options } = clock();
    const send = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValueOnce(new Error("timed out"))
      .mockResolvedValueOnce(html(502))
      .mockResolvedValueOnce(json(200));
    const response = await fetchWithWake(get(), send, options);
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("gives up after the budget and reports the last failure", async () => {
    const { options, advance } = clock();
    const send = vi.fn(async () => {
      advance(10_000); // each attempt runs into its timeout
      throw new Error("timed out");
    });
    await expect(fetchWithWake(get(), send, options)).rejects.toThrow("timed out");
    expect(send.mock.calls.length).toBeGreaterThan(2);
    expect(send.mock.calls.length).toBeLessThan(8);
  });

  it("returns the host's error response when that is the last thing it got", async () => {
    const { options, advance } = clock({ budgetMs: 5_000 });
    const send = vi.fn(async () => {
      advance(3_000);
      return html(503);
    });
    expect((await fetchWithWake(get(), send, options)).status).toBe(503);
  });

  it("makes one attempt only when the budget is zero", async () => {
    const { options } = clock({ budgetMs: 0 });
    const send = vi.fn(async () => {
      throw new Error("down");
    });
    await expect(fetchWithWake(get(), send, options)).rejects.toThrow("down");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("never repeats a write", async () => {
    const { options } = clock();
    const send = vi.fn(async () => html(502));
    const post = new Request("https://api.test/x", { method: "POST", body: "{}" });
    expect((await fetchWithWake(post, send, options)).status).toBe(502);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("gives each attempt its own copy of the request", async () => {
    const { options } = clock();
    const seen: Request[] = [];
    const send = vi.fn(async (request: Request) => {
      seen.push(request);
      return seen.length < 2 ? html(502) : json(200);
    });
    await fetchWithWake(get(), send, options);
    expect(seen[0]).not.toBe(seen[1]);
  });
});
