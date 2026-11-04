import "server-only";
import { cookies } from "next/headers";
import { isEnabled } from "@/lib/flags";
import { MODE_COOKIE, parseMode, type Mode } from "@/lib/mode";

/**
 * Whether the Crypto | Stocks switch is on. It needs the crypto page too: a Crypto mode with no
 * crypto page would be an empty room, so without it the site behaves exactly as it did before.
 */
export function modeSwitchActive(): boolean {
  return isEnabled("mode_switch") && isEnabled("crypto");
}

/**
 * The visitor's mode, or null while the switch is off (callers then show everything). A missing or
 * unknown cookie is the default, crypto.
 */
export async function getMode(): Promise<Mode | null> {
  if (!modeSwitchActive()) return null;
  const jar = await cookies();
  return parseMode(jar.get(MODE_COOKIE)?.value);
}
