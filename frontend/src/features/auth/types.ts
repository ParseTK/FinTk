import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];

export type User = Schemas["UserResponse"];

/** Everything a page needs to know about the visitor, from one request to the API. */
export interface SessionInfo {
  user: User | null;
  /** Sent back as X-CSRF-Token on state-changing requests. Null when signed out. */
  csrfToken: string | null;
  /** Sign-in methods the server has configured. */
  providers: string[];
  /** False when the API could not be reached, so pages can say so instead of pretending. */
  reachable: boolean;
}

export const SIGNED_OUT: SessionInfo = {
  user: null,
  csrfToken: null,
  providers: [],
  reachable: true,
};
