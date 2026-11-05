# Everyday commands. Install `just` (https://github.com/casey/just), then run `just` to list them.
# Each recipe runs in the folder it belongs to, so no shell-specific `cd ... &&` is needed and the
# same file works on Windows, macOS and Linux.

set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

default:
    @just --list

# --- Run -------------------------------------------------------------------------------------

# Start the local Postgres (see .env.example for the password it needs).
db-up:
    docker compose up -d postgres

db-down:
    docker compose down

# Apply database migrations.
[working-directory: 'backend']
migrate:
    uv run alembic upgrade head

# The API on http://localhost:8000 (needs a database for sign-in, watchlist, portfolio and prices).
[working-directory: 'backend']
api:
    uv run uvicorn app.main:app --reload --port 8000

# The website on http://localhost:3000.
[working-directory: 'frontend']
web:
    npm run dev

# --- Check (what CI runs) ------------------------------------------------------------------------

[working-directory: 'backend']
test-api:
    uv run pytest

[working-directory: 'frontend']
test-web:
    npm test

test: test-api test-web

[working-directory: 'backend']
lint-api:
    uv run ruff format --check .
    uv run ruff check .
    uv run pyright

[working-directory: 'frontend']
lint-web:
    npm run format:check
    npm run lint
    npm run typecheck

lint: lint-api lint-web

# Format everything in place.
[working-directory: 'backend']
fmt-api:
    uv run ruff format .

[working-directory: 'frontend']
fmt-web:
    npm run format

fmt: fmt-api fmt-web

# --- API contract --------------------------------------------------------------------------------

# Regenerate backend/openapi.json and the frontend's typed client from it. Commit both: CI fails
# when either is stale.
[working-directory: 'backend']
export-openapi:
    uv run python -m scripts.export_openapi

[working-directory: 'frontend']
gen-types:
    npm run gen:api

gen-api: export-openapi gen-types
