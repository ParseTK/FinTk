# Operations runbook

What to do when something about the data or the database needs attention. It contains no secrets: use
the host's secret store for credentials, never this file. The host has not been chosen yet, so
the provider-specific facts are marked *confirm at deploy*.

## What is stored (and what is not)

Postgres holds accounts (`user_account`, `oauth_identity`), sessions (`user_session`, hashed tokens
only), and the two things a person enters: `crypto_watch` and `crypto_holding`. **No vendor price
data is stored**: the data provider's licence allows only short-lived caching, which lives in
process memory. Losing the cache costs a few vendor calls, not data.

So the only data worth backing up is people's accounts, watchlists and holdings.

## Backup

A logical backup of the whole database (works against any Postgres 17 host):

```bash
pg_dump --format=custom --no-owner --file=virello-$(date +%F).dump "$DATABASE_URL"
```

`DATABASE_URL` here is the plain `postgresql://` form (the app's `postgresql+asyncpg://` prefix is not
understood by `pg_dump`). Keep dumps somewhere private: they contain email addresses. Delete old ones;
a deleted account must not linger in backups longer than the retention you choose.

*Confirm at deploy:* whether the host keeps automatic backups or point-in-time recovery on its free
tier, and for how long. Do not assume it does.

## Restore

Restore into a **new, empty** database first, check it, then switch the app to it:

```bash
createdb virello_restore
pg_restore --no-owner --dbname=virello_restore virello-2026-11-05.dump
psql virello_restore -c "select count(*) from user_account;"
```

Then point `VIRELLO_DATABASE_URL` at the restored database and restart the API. `GET /readyz` should
report the database as healthy. Existing sessions in the dump stay valid until they expire; to force
everyone to sign in again, run `delete from user_session;`.

## Migrations

Alembic owns the schema and nothing creates tables at start-up. Run migrations as a release step,
before the new API version starts:

```bash
docker run --rm --env-file .env virello-api alembic upgrade head
```

Migrations are **backward compatible** (expand, then contract): a new column or table ships first and
the old one is removed in a later release, so the previous API version keeps working while a migration
runs and a failed deploy can be rolled back to it.

To undo the most recent migration (read it first, and take a backup):

```bash
uv run alembic downgrade -1
```

A migration that drops data cannot be undone by `downgrade`; restore from a backup instead.

## Deleting a person's data

The account page has **Delete my account**, which removes the account and, by foreign key cascade,
every sign-in, session, watchlist entry and holding. To do it by hand for a given account:

```sql
delete from user_account where email = lower('person@example.com');
```

Backups taken before the deletion still contain the person until they expire (see Backup).

## Rotating a secret

If a secret may have been exposed (it was pasted somewhere, committed, or logged): rotate first,
clean up after.

| Secret | Where it is used | After rotating |
|---|---|---|
| `VIRELLO_CMC_API_KEY` | API, data provider calls | Restart the API. |
| `VIRELLO_INTERNAL_API_TOKEN` / `INTERNAL_API_TOKEN` | API and website, must match | Change both together, restart both. |
| `VIRELLO_SECRET_KEY` | Signs the short sign-in step cookie | Restart the API. People mid sign-in start over; sessions are unaffected. |
| OAuth client secrets | Google / GitHub sign-in | Create a new secret at the provider, update the env, restart the API, delete the old one. |
| Database password | API | Change it at the host, update `VIRELLO_DATABASE_URL`, restart the API. |

If a secret reached git history, also see `SECURITY.md`.

## When the site looks down

1. `GET /healthz` on the API: does the process answer? (No: look at the host's logs and restart.)
2. `GET /readyz`: does it list a failing dependency? (`database`: check the database host and the URL.)
3. Market pages say figures are unavailable: the data provider or its budget is the usual cause.
   The API logs the reason with a request id, never the key.
4. Every response carries an `x-request-id`; quote it when looking up a request in the logs.

## Migrating the production database

Production migrations run from GitHub, not from a laptop: **Actions > Migrate production database >
Run workflow** (from `main`). The run waits for the required reviewer on the `production`
environment, checks that the target is a remote, encrypted database (it prints the host, never the
URL), shows the current revision, runs `alembic upgrade`, and shows the revision after. The connection
string is the environment secret `VIRELLO_DATABASE_URL`. Run it before deploying an API version that
needs a new migration (expand, then contract, so the running version keeps working meanwhile).
