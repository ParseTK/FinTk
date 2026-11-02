# Virello API

FastAPI service that will own company data, caching, accounts and portfolios, so the web app never
holds a data-provider key. Python 3.13, managed with [uv](https://docs.astral.sh/uv/).

## Run it

```bash
cd backend
uv sync                                   # installs Python 3.13 and the locked dependencies
cp .env.example .env                      # optional; every setting has a safe default
uv run uvicorn app.main:app --reload --no-server-header
```

Then open <http://localhost:8000/docs> (interactive docs, off in production).

| Endpoint | Purpose |
|---|---|
| `GET /healthz` | Liveness: is the process up. Never touches dependencies. |
| `GET /readyz` | Readiness: runs the registered dependency checks, 503 with the failing names if one fails. |
| `GET /api/v1/meta` | Service name, version and environment. |

## Quality gates

CI runs exactly these, and so should you before opening a PR:

```bash
uv run ruff format --check
uv run ruff check
uv run pyright          # strict mode
uv run pytest
```

## How it is organised

```
app/
  main.py          application factory (create_app) and the app uvicorn serves
  core/            config, errors, logging, middleware, request context (no business logic)
  api/             routers: health at the root, everything else under /api/v1
tests/             pytest, httpx AsyncClient; test-only routes exercise every error path
```

Conventions:

- **One error shape** for every failure: `{"error": {"code", "message", "request_id", "details?"}}`.
  Unexpected errors return a generic message and are logged with the request id, never leaked.
- **Request ids** on every response (`X-Request-ID`), accepted from the caller if plain and short.
- **Logs** are JSON, carry the request id, and never include bodies, headers, cookies or query strings.
- **CORS** is an explicit allowlist (`VIRELLO_CORS_ORIGINS`); `*` is rejected at startup.
- **API versioning:** `/api/v1` only changes additively; a rename or removal is a new version.
- **Configuration** comes from `VIRELLO_*` environment variables and is validated at startup.
