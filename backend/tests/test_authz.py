import uuid

import pytest

from app.core.authz import require_owner
from app.core.errors import NotFoundError

ALICE = uuid.uuid4()
BOB = uuid.uuid4()


def test_the_owner_passes() -> None:
    require_owner(ALICE, ALICE)


def test_someone_elses_object_looks_exactly_like_a_missing_one() -> None:
    with pytest.raises(NotFoundError) as foreign:
        require_owner(BOB, ALICE)
    with pytest.raises(NotFoundError) as missing:
        require_owner(None, ALICE)

    # A 403 would confirm that the object exists. Both must be indistinguishable.
    assert foreign.value.message == missing.value.message
    assert foreign.value.status_code == missing.value.status_code == 404
