"use server";

import { cookies } from "next/headers";
import { isMode, MODE_COOKIE, MODE_MAX_AGE } from "@/lib/mode";
import { modeSwitchActive } from "./mode";

/**
 * Remembers the visitor's mode and stays on the current page, which then shows that mode's links.
 * (A redirect here made the browser rebuild the whole document, which wiped the theme and palette
 * that the init script sets on <html>.) A Server Action, so it works without client JavaScript and
 * Next checks the request's origin for us. The submitted value is never trusted: anything that is
 * not a known mode is ignored, and nothing happens while the switch is off. The cookie holds a
 * harmless preference, so it needs no secrecy, but it is HttpOnly anyway because only the server
 * reads it.
 */
export async function setMode(formData: FormData): Promise<void> {
  const mode = formData.get("mode");
  if (!modeSwitchActive() || !isMode(mode)) return;
  const jar = await cookies();
  jar.set(MODE_COOKIE, mode, {
    path: "/",
    maxAge: MODE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
