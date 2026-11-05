"""Authorization helpers: may this user touch this object?

Authentication proves who someone is; it says nothing about which rows they may use. Without an
object-level check, any signed-in user can read or change another user's data by guessing an id
(an IDOR, the top item on OWASP's API list). Every endpoint that takes an object id must call
``require_owner`` (or filter its query by the user id) before returning or changing anything.
"""

import uuid

from app.core.errors import NotFoundError


def require_owner(owner_id: uuid.UUID | None, user_id: uuid.UUID) -> None:
    """Raise unless the object belongs to the user.

    The answer is 404, not 403, on purpose: a 403 would confirm that someone else's object exists.
    A missing object (``owner_id`` is None) and a foreign one look identical to the caller.
    """
    if owner_id is None or owner_id != user_id:
        msg = "That does not exist."
        raise NotFoundError(msg)
