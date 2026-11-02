# Virello

> The product is called **Virello**. The repository and package names stay **FinTk**.

A fact-first place to research public companies. Work in progress.

## Stack

- Frontend: Next.js (App Router), React, TypeScript, Tailwind CSS
- Backend: FastAPI (Python 3.13, managed with uv); Postgres is planned. See [backend/README.md](backend/README.md)

## Develop

Requires Node 24 (see `.nvmrc`).

```bash
cd frontend
cp .env.example .env     # add any keys you have; never commit .env
npm ci
npm run dev
```

The API lives in `backend/` (`uv sync`, then `uv run uvicorn app.main:app --reload`); see its README.

### Local database

The API stores data in Postgres 17. A compose file runs one for development:

```bash
cp .env.example .env              # set POSTGRES_PASSWORD (there is deliberately no default)
docker compose up -d --wait       # Postgres on 127.0.0.1:5433, plus an empty virello_test database
cd backend
# put the two URLs from .env.example into backend/.env, then:
uv run alembic upgrade head
uv run pytest                     # the database tests run against it
docker compose down               # stop it; add -v to also delete the data
```

The container listens on localhost only, is memory-capped, and keeps its data in a named volume.
Use `127.0.0.1` rather than `localhost` in the URLs (the port is IPv4 only).

Frontend checks run in CI and locally: `npm run format:check`, `lint`, `typecheck`, `test`, `build`.

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

## Releasing

Releases are a one-click fast-forward, so `main` and `dev` are always the same commit afterwards
(`dev` is never "behind"). In GitHub: **Actions, "Release: fast-forward", Run workflow, action: release**.

The workflow refuses to run unless:

- `main` can be fast-forwarded to `dev` (nothing on `main` would be lost), and
- the required checks (frontend, secrets, CodeQL analysis) have passed on that exact commit.

It adds no merge commit and needs no extra pull request. Use **action: sync** only if something ever
lands on `main` directly, to bring `dev` up to it.

### One-time setup

Moving `main` without a pull request needs an identity that is allowed to, which the built-in workflow
token is not. Create a fine-grained personal access token and store it as a repository secret:

1. GitHub, Settings, Developer settings, Fine-grained tokens, **Generate new token**.
2. Repository access: **only this repository**. Permissions: **Contents: Read and write**,
   **Checks: Read-only** (Metadata is added automatically). Set an expiry (90 days is a good default).
3. Add it as the Actions secret **RELEASE_TOKEN** (Settings, Secrets and variables, Actions).

The token owner must be a repository admin. Because the push uses this token (not the built-in one),
it also starts CI and the container-image build on `main`. Rotate the token before it expires.

## Security

See [SECURITY.md](SECURITY.md).
