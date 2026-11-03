"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { goTo } from "./navigate";
import { sendWithCsrf } from "./request";

export function SignOutButton({ csrfToken }: { csrfToken: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setBusy(true);
    setFailed(false);
    const result = await sendWithCsrf("POST", "/api/v1/auth/logout", csrfToken);
    if (result === "ok" || result === "signed-out") {
      goTo("/");
      return;
    }
    // "stale": the page is out of date; a retry after a reload gets a fresh token.
    setBusy(false);
    setFailed(true);
  }

  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        size="sm"
        fullWidth
        className="justify-start"
        loading={busy}
        onClick={signOut}
      >
        Sign out
      </Button>
      <p role="alert" className="text-loss text-sm" hidden={!failed}>
        {failed ? "Could not sign you out. Reload the page and try again." : ""}
      </p>
    </div>
  );
}
