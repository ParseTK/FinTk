# Security policy

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting:
**Security tab -> Report a vulnerability**.

## Handling secrets

- Never commit secrets. `.env*` files are git-ignored; only `.env.example` (no values) is tracked.
- Server-only keys (for example `VIRELLO_CMC_API_KEY`) must never use the `NEXT_PUBLIC_` prefix, which ships
  the value to the browser.
- Production secrets live in the hosting platform's secret store and GitHub Actions secrets.
- If a secret is ever committed, treat it as compromised: rotate it first, then clean history.

## Automated checks

Dependabot (dependency updates), CodeQL (static analysis), Gitleaks (secret scanning), and GitHub
secret scanning with push protection run on this repository.
