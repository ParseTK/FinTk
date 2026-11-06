import { useCallback, useRef, useState } from "react";
import type { JsonResult } from "@/lib/apiRequest";

/**
 * The bookkeeping every "change something on the server" control repeats: is a request running,
 * and what went wrong. A component calls `run` with its request and decides what success looks
 * like (refresh the page, flip a button); this keeps the rest in one place.
 *
 * - `busy` is true from the moment `run` starts until the answer arrives.
 * - A second `run` while one is in flight does nothing and returns null, so a double press cannot
 *   send two requests (a ref, because state would only update after the next render).
 * - `problem` is the friendly message for a failure with no field to blame. A failure that names
 *   fields leaves `problem` empty: the form shows those next to the fields instead.
 * - The result is returned, so a form can read `fields` from a failure.
 */
export function useMutation() {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const running = useRef(false);

  const run = useCallback(
    async <T>(request: () => Promise<JsonResult<T>>): Promise<JsonResult<T> | null> => {
      if (running.current) return null;
      running.current = true;
      setBusy(true);
      setProblem("");
      try {
        const result = await request();
        if (!result.ok && Object.keys(result.fields).length === 0) setProblem(result.message);
        return result;
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [],
  );

  return { busy, problem, run };
}
