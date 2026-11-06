import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { JsonResult } from "./apiRequest";
import { useMutation } from "./useMutation";

const ok = (): JsonResult<string> => ({ ok: true, data: "done", created: false });
const failed = (message: string, fields: Record<string, string> = {}): JsonResult<string> => ({
  ok: false,
  kind: Object.keys(fields).length > 0 ? "invalid" : "failed",
  message,
  fields,
});

/** A request the test finishes by hand, so "while it is running" can be observed. */
function pending() {
  let finish!: (result: JsonResult<string>) => void;
  const promise = new Promise<JsonResult<string>>((resolve) => (finish = resolve));
  return { promise, finish };
}

describe("useMutation", () => {
  it("starts idle with no problem", () => {
    const { result } = renderHook(() => useMutation());
    expect(result.current.busy).toBe(false);
    expect(result.current.problem).toBe("");
  });

  it("is busy while the request runs, then idle, and hands back the result", async () => {
    const { result } = renderHook(() => useMutation());
    const request = pending();
    let returned: Promise<JsonResult<string> | null>;
    act(() => {
      returned = result.current.run(() => request.promise);
    });
    expect(result.current.busy).toBe(true);
    await act(async () => {
      request.finish(ok());
      await returned;
    });
    expect(result.current.busy).toBe(false);
    expect(await returned!).toEqual(ok());
    expect(result.current.problem).toBe("");
  });

  it("shows the friendly message for a failure with nothing to blame", async () => {
    const { result } = renderHook(() => useMutation());
    await act(async () => {
      await result.current.run(async () => failed("Something went wrong. Please try again."));
    });
    expect(result.current.problem).toBe("Something went wrong. Please try again.");
  });

  it("leaves the problem empty when the failure names fields, and still returns them", async () => {
    const { result } = renderHook(() => useMutation());
    let returned: JsonResult<string> | null = null;
    await act(async () => {
      returned = await result.current.run(async () => failed("Check the fields.", { amount: "x" }));
    });
    expect(result.current.problem).toBe("");
    expect(returned).toMatchObject({ ok: false, fields: { amount: "x" } });
  });

  it("clears an earlier problem when the next attempt starts", async () => {
    const { result } = renderHook(() => useMutation());
    await act(async () => {
      await result.current.run(async () => failed("It failed."));
    });
    expect(result.current.problem).toBe("It failed.");
    const request = pending();
    act(() => {
      void result.current.run(() => request.promise);
    });
    expect(result.current.problem).toBe("");
    await act(async () => request.finish(ok()));
  });

  it("ignores a second press while one is running, and sends only one request", async () => {
    const { result } = renderHook(() => useMutation());
    const first = pending();
    const send = vi.fn(() => first.promise);
    let second: JsonResult<string> | null = ok();
    act(() => {
      void result.current.run(send);
    });
    await act(async () => {
      second = await result.current.run(send);
    });
    expect(second).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => first.finish(ok()));
  });

  it("is free to run again once the first has finished", async () => {
    const { result } = renderHook(() => useMutation());
    const send = vi.fn(async () => ok());
    await act(async () => {
      await result.current.run(send);
      await result.current.run(send);
    });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("goes idle again if the request throws, and lets the error through", async () => {
    const { result } = renderHook(() => useMutation());
    await act(async () => {
      await expect(
        result.current.run(async () => {
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
    });
    expect(result.current.busy).toBe(false);
  });
});
