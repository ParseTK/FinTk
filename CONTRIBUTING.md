# Contributing

Virello is a personal project and the code is not licensed for reuse (see [LICENSE](LICENSE)), so
code contributions are not being accepted. Bug reports, accessibility problems and questions are
welcome.

- **Something is broken or hard to use** (including with a keyboard or a screen reader): open an
  [issue](https://github.com/ParseTK/FinTk/issues) describing the page and what happened. Please do not put
  personal information in it.
- **A security problem:** do not open an issue. Use GitHub's private reporting (Security tab,
  "Report a vulnerability"). See [SECURITY.md](SECURITY.md).

## How the work is organised

For anyone reading the code: changes go on a short-lived branch, into `dev` by pull request, and `dev`
is released to `main`. A pull request must pass the checks in `.github/workflows/ci.yml` (formatting,
lint, types, tests with a coverage floor, the backend layering contracts, dependency audit and
licence checks, secret scanning, a container build with a vulnerability scan). To run the same checks
locally, see the `justfile` and `backend/README.md`.
