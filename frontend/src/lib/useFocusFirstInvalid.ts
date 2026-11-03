import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * After a failed submit, move keyboard focus to the first field marked `aria-invalid`.
 *
 * The error message is announced by a live region, but without this focus stays on the Save button
 * (or is lost), and a keyboard or screen-reader user has to hunt for the field that needs fixing.
 * Call the returned function right after setting the field errors: the focus move waits for the
 * render that marks the fields, so it never runs against the old, error-free form.
 */
export function useFocusFirstInvalid(form: RefObject<HTMLElement | null>): () => void {
  const [requests, setRequests] = useState(0);

  useEffect(() => {
    if (requests > 0) form.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [requests, form]);

  return useCallback(() => setRequests((count) => count + 1), []);
}
