"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { goTo } from "./navigate";
import { sendWithCsrf } from "./request";

type Step = "idle" | "confirming" | "deleting" | "failed";

/** Deleting an account cannot be undone, so it takes two deliberate steps. */
export function DeleteAccount({ csrfToken }: { csrfToken: string }) {
  const [step, setStep] = useState<Step>("idle");
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Land on the safe choice when the question appears.
  useEffect(() => {
    if (step === "confirming") cancelRef.current?.focus();
  }, [step]);

  async function confirm() {
    setStep("deleting");
    const result = await sendWithCsrf("DELETE", "/api/v1/me", csrfToken);
    if (result === "ok" || result === "signed-out") {
      goTo("/");
      return;
    }
    setStep("failed");
  }

  return (
    <section aria-labelledby="delete-heading" className="space-y-3">
      <h2 id="delete-heading" className="text-xl font-semibold">
        Delete your account
      </h2>
      <p className="text-fg-muted">
        This removes your account, the sign-in links to Google and GitHub, and every session on
        every device. It cannot be undone.
      </p>

      {step === "idle" && (
        <Button variant="secondary" onClick={() => setStep("confirming")}>
          Delete my account
        </Button>
      )}

      {(step === "confirming" || step === "deleting" || step === "failed") && (
        <div role="group" aria-label="Confirm account deletion" className="space-y-3">
          <p className="font-semibold">Are you sure you want to delete your account?</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="danger" loading={step === "deleting"} onClick={confirm}>
              Yes, delete my account
            </Button>
            <Button
              ref={cancelRef}
              variant="secondary"
              disabled={step === "deleting"}
              onClick={() => setStep("idle")}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <p role="alert" className="text-loss text-sm" hidden={step !== "failed"}>
        {step === "failed"
          ? "We could not delete your account. Reload the page and try again."
          : ""}
      </p>
    </section>
  );
}
