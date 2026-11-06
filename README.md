# FinTk

A free, accessible place to research crypto markets: live prices and market make-up, coin pages,
official regulatory news, and a personal watchlist and holdings list. Everything shown is labelled
with where it came from, and nothing is a prediction or advice.

Live: https://fin-tk.vercel.app (the free host puts the API to sleep when idle, so the first visit
after a quiet spell can take up to a minute; the site says so while it waits).

## What is in it

- **Crypto**: overview (market mood, Fear and Greed), markets (movers, make-up, ten largest), coin
  search and coin pages with reported price changes.
- **News**: official items only (SEC, CFTC, DOJ and company 8-K filings), filtered by a printed
  keyword rule. Nothing is ranked.
- **Holdings** (signed in): a watchlist and the coins you hold, with the amount and optional cost.
- **Resources**: data and methodology, source directory, education guides, calculators with exact
  decimal maths, and a coin comparison.
- **Accessibility** is a requirement (WCAG 2.1 AA): keyboard use, visible focus, live regions, a
  skip link, a light and a dark theme, and a motion control that stops animation.

## Stack

- Frontend: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4. Server
  components by default.
- Backend: FastAPI, Pydantic v2, async SQLAlchemy and asyncpg, Alembic, Python 3.13 with `uv`.
  See [backend/README.md](backend/README.md) and [backend/RUNBOOK.md](backend/RUNBOOK.md).
- Database: Postgres 17.
- Contract: the API's OpenAPI file (`backend/openapi.json`) is the single source. The frontend
  client types are generated from it, and CI fails if either is stale.
- Hosting: Vercel (website), Render (API, Docker), Neon (Postgres), all on free plans.

## Data and licences

- Crypto prices come from CoinMarketCap's free plan and are shown with attribution, only inside
  this site and only for personal, non-commercial use. The API route that carries them requires an
  internal token, so it is not a public feed.
- News and company filings come from official US sources (SEC EDGAR, CFTC, DOJ).
- The code is all rights reserved (see [LICENSE](LICENSE)).

## Develop

Requires Node 24 (see `.nvmrc`) and [uv](https://docs.astral.sh/uv/).

```bash
# website
cd frontend
cp .env.example .env.local   # add any values you have; never commit it
npm ci
npm run dev

# API (second terminal)
cd backend
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload
```

With [just](https://github.com/casey/just) installed, `just` lists shortcuts: `just api`, `just web`,
`just test`, `just lint`, `just migrate`, `just gen-api`.

Checks that CI also runs:

- frontend: `npm run format:check`, `lint`, `typecheck`, `test`, `build`
- backend: `uv run ruff format --check .`, `ruff check .`, `pyright`, `pytest`

### Environment

Nothing secret goes in git. The website reads `frontend/.env.local`; the API reads `backend/.env`.
Both have an `.env.example` listing every variable.

- Crypto data needs `VIRELLO_CMC_API_KEY` (a free CoinMarketCap key) on the API and the same
  `VIRELLO_INTERNAL_API_TOKEN` on the API and `INTERNAL_API_TOKEN` on the website.
- News needs `VIRELLO_SEC_CONTACT_EMAIL` (SEC requires every client to identify itself).
- The website finds the API through `API_URL` (default `http://localhost:8000`).

### Feature flags

Pages are switched on with server-side flags (`FEATURE_<NAME>=true`), read at request time, so a
change needs a restart but not a rebuild. The registry is `frontend/src/lib/flag-core.ts`; a flag
that needs another says so in a comment there.

| Flag                       | Shows                               | Also needs       |
| -------------------------- | ----------------------------------- | ---------------- |
| `crypto`                   | overview and the crypto pages       |                  |
| `crypto_markets`           | markets page                        | `crypto`         |
| `crypto_news`              | news page                           | `crypto`         |
| `crypto_search`            | search box, coin pages              | `crypto`         |
| `resources`                | resources section                   |                  |
| `auth`                     | sign-in and account                 |                  |
| `holdings`                 | watchlist and holdings              | `crypto`, `auth` |
| `palette`, `scroll_motion` | appearance picker, scroll animation |                  |
| `design`                   | component gallery at `/design`      |                  |

### Sign-in

Sign-in with Google or GitHub is behind the `auth` flag. Register an OAuth app with each provider
(callback `<your address>/api/v1/auth/<github|google>/callback`), set the client ids and secrets,
`VIRELLO_SECRET_KEY` and `VIRELLO_PUBLIC_URL` on the API, and start the website with
`FEATURE_AUTH=true`. See the "Sign-in" section of [backend/README.md](backend/README.md).

Browsers only talk to the website's own address; `frontend/src/proxy.ts` forwards a short allowlist of
paths to the API at request time, which keeps the session cookie same-site. Behind a proxy, set
`VIRELLO_TRUST_PROXY_HOPS` so rate limits see real client addresses.

### Local database

A compose file runs Postgres 17 for development:

```bash
cp .env.example .env              # set POSTGRES_PASSWORD (deliberately no default)
docker compose up -d --wait       # Postgres on 127.0.0.1:5433, plus an empty virello_test database
cd backend
# put the two URLs from .env.example into backend/.env, then:
uv run alembic upgrade head
uv run pytest                     # the database tests run against it
docker compose down               # stop it; add -v to also delete the data
```

It listens on localhost only. Use `127.0.0.1` rather than `localhost` in the URLs (the port is IPv4
only). The `VIRELLO_` prefix and `virello_*` database names are internal and unchanged by the rename.

## Project structure

The frontend is organised by feature, with one-way dependencies that ESLint enforces:

```
frontend/src/
  app/             routes only (thin pages that compose features)
  components/ui/   generic building blocks, one folder per component
  features/        one folder per feature, each with a public index.ts
    appearance/    palette picker and preferences
    auth/          sign-in, session, account menu
    crypto/        overview, markets, news, search, coin pages
    holdings/      watchlist and holdings
    home/          landing page
    legal/         privacy, terms, accessibility
    resources/     methodology, sources, education, tools
    shell/         header, footer, sidebar, logo
  lib/             framework-free helpers (formatting, flags, decimal maths)
```

Dependencies point one way: `app` -> `features` -> `components/ui` -> `lib`. Features reach each
other only through a feature's `index.ts`, and nothing imports from `app`. Tests sit next to the
code. To add a UI component run `npm run new:component -- Name` in `frontend/`.

The backend follows route -> service -> repository or provider, with separate request, response and
database models; `import-linter` enforces the layers.

## Workflow

Work happens on short-lived branches (`feature/*`, `fix/*`, `docs/*`, `chore/*`) that are squash
merged into `dev` through a pull request. `main` is always deployable and is updated by a release
pull request from `dev`, merged with **Create a merge commit**. CI must pass on every pull request:
formatting, lint, types, tests, build, dependency audit, secret scanning, CodeQL, container image
scans and a browser smoke test. Vercel and Render deploy from `main`.

Database changes reach production through the manual **Migrate production database** workflow,
which waits for an approval first (see the runbook).

## Security

See [SECURITY.md](SECURITY.md).
