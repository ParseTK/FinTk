import { Alert } from "@/components/ui/Alert";
import { buttonStyles } from "@/components/ui/Button";
import { PROVIDER_LABELS, signInErrorMessage } from "./messages";

export interface SignInPanelProps {
  /** Providers the server has configured. */
  providers: string[];
  /** Where to send the person afterwards. Must already be a safe same-site path. */
  next: string;
  /** The `error` code from the URL, if any. Only known codes produce a message. */
  error?: string | string[];
  /** False when the API could not be reached. */
  reachable?: boolean;
}

export function SignInPanel({ providers, next, error, reachable = true }: SignInPanelProps) {
  const message = signInErrorMessage(error);
  const known = providers.filter((provider) => Object.hasOwn(PROVIDER_LABELS, provider));

  return (
    <section aria-labelledby="sign-in-heading" className="space-y-6">
      <div className="space-y-2">
        <h1 id="sign-in-heading" className="text-3xl font-bold">
          Sign in to FinTk
        </h1>
        <p className="text-fg-muted">
          There are no passwords here. You sign in with an account you already have, and we only
          keep your email address and name.
        </p>
      </div>

      {message && (
        <Alert variant="error" title="We could not sign you in">
          {message}
        </Alert>
      )}

      {!reachable ? (
        <Alert variant="info" title="Sign-in is unavailable">
          We could not reach the service that handles sign-in. Please try again in a moment.
        </Alert>
      ) : known.length === 0 ? (
        <Alert variant="info" title="Sign-in is not available yet">
          No sign-in methods are switched on for this site.
        </Alert>
      ) : (
        <ul className="space-y-3">
          {known.map((provider) => (
            <li key={provider}>
              {/* A plain link: signing in is a full navigation to the provider, not a page change. */}
              <a
                href={`/api/v1/auth/${provider}/login?next=${encodeURIComponent(next)}`}
                className={buttonStyles({ variant: "secondary", size: "lg", fullWidth: true })}
              >
                Continue with {PROVIDER_LABELS[provider]}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
