# Virello

> The product is called **Virello**. The repository and package names stay **FinTk**.

A fact-first place to research public companies. Work in progress.

## Stack

- Frontend: Next.js (App Router), React, TypeScript, Tailwind CSS
- Backend: FastAPI and Postgres (planned)

## Develop

Requires Node 24 (see `.nvmrc`).

```bash
cd frontend
cp .env.example .env     # add any keys you have; never commit .env
npm ci
npm run dev
```

Checks run in CI and locally: `npm run format:check`, `lint`, `typecheck`, `test`, `build`.

## Project structure

The frontend is organized by feature, with one-way dependencies that ESLint enforces:

```
src/
  app/             routes only (thin pages that compose features)
  components/ui/   generic building blocks, one folder per component (Button/, Card/, Field/ ...)
  features/        one folder per feature, each with a public index.ts
    appearance/    palette picker and preferences
    home/          hero, chart, ticker, feature cards
    market-data/   the data provider (the seam a backend client replaces)
    portfolio/     portfolio state and UI
    search/        search field and result cards
    shell/         navbar, footer, logo, nav links
  lib/             framework-free helpers (formatting, flags, contrast)
```

Dependencies point one way: `app` -> `features` -> `components/ui` -> `lib`. Features reach each
other only through a feature's `index.ts`, and nothing imports from `app`. Tests live next to the
code they cover.

To add a UI component, run `npm run new:component -- Name` (in `frontend/`). It creates
`components/ui/Name/` with the component, a test that includes an accessibility check, and the
`index.ts` that other code imports from.

## Workflow

Work happens on short-lived branches that merge into `dev`; `dev` merges into `main`. `main` is always deployable. Unfinished features are hidden behind server-side feature flags (`FEATURE_<NAME>=true`).

## Security

See [SECURITY.md](SECURITY.md).
