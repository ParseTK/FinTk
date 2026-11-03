/** What each sign-in failure code from the API means to a person. Codes outside this list are
 *  ignored, so nothing from the URL is ever echoed into the page. */
export const SIGN_IN_ERRORS = {
  denied: "Sign-in was cancelled. You can try again whenever you like.",
  invalid: "That sign-in link expired or was not started here. Please try again.",
  failed: "Sign-in could not be completed. Please try again.",
  unverified:
    "Your provider did not give us a verified email address, which we need to create your account. Verify it with the provider, then try again.",
  unavailable: "The sign-in provider is not responding right now. Please try again shortly.",
} as const;

export type SignInErrorCode = keyof typeof SIGN_IN_ERRORS;

export function signInErrorMessage(code: string | string[] | undefined): string | null {
  const value = Array.isArray(code) ? code[0] : code;
  return value !== undefined && Object.hasOwn(SIGN_IN_ERRORS, value)
    ? SIGN_IN_ERRORS[value as SignInErrorCode]
    : null;
}

/** Only providers we know get a button, so an unexpected value from the API never becomes a link. */
export const PROVIDER_LABELS: Readonly<Record<string, string>> = {
  github: "GitHub",
  google: "Google",
};
