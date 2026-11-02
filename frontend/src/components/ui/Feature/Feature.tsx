import type { ReactNode } from "react";
import { isEnabled, type FlagName } from "@/lib/flags";

/** Server component: renders its children only when the flag is on. */
export function Feature({
  flag,
  children,
  fallback = null,
}: {
  flag: FlagName;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return isEnabled(flag) ? children : fallback;
}
