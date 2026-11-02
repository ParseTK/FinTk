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

## Workflow

Work happens on short-lived branches that merge into `dev`; `dev` merges into `main`. `main` is always deployable. Unfinished features are hidden behind server-side feature flags (`FEATURE_<NAME>=true`).

## Security

See [SECURITY.md](SECURITY.md).
