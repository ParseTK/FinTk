"""Creates a person and a real session in the database and prints the session token.

For browser tests and local checks: it does what a finished Google or GitHub sign-in would, without
the provider. The token goes in the browser's session cookie. Each email is its own account. Never
runs in production.

    uv run python -m scripts.make_session someone@example.test
"""

import asyncio
import sys
from datetime import timedelta

from app.core.config import get_settings
from app.db.engine import Database
from app.domain.accounts import ExternalProfile
from app.repositories.accounts import AccountRepository, SessionRepository
from app.services.auth import AuthService


async def mint(email: str) -> str:
    settings = get_settings()
    if settings.is_production:
        msg = "make_session creates logins without a provider and must never run in production."
        raise SystemExit(msg)
    database = Database.from_settings(settings)
    try:
        async with database.session() as session:
            service = AuthService(
                AccountRepository(session),
                SessionRepository(session),
                idle=timedelta(days=settings.session_idle_days),
                maximum=timedelta(days=settings.session_max_days),
            )
            token, _ = await service.sign_in(
                ExternalProfile("github", email, email, True, "Test Person", None)
            )
            return token
    finally:
        await database.dispose()


def main() -> None:
    email = sys.argv[1] if len(sys.argv) > 1 else "e2e@example.test"
    print(asyncio.run(mint(email)))


if __name__ == "__main__":
    main()
