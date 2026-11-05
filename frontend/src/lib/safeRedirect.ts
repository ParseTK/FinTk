const MAX_LENGTH = 200;

/**
 * Only same-site paths are allowed as a post-sign-in destination. Anything that could leave the
 * site (another host, a scheme, "//host", backslashes, control characters) becomes the fallback.
 * The API applies the same rule again; this copy keeps bad values out of the links we render.
 */
export function safeNextPath(value: string | string[] | undefined, fallback = "/"): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    !candidate ||
    candidate.length > MAX_LENGTH ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }
  return candidate;
}
