"""Finding a coin by name or symbol among the listed ones. Pure: no I/O, no provider."""

import re
from collections.abc import Sequence

from app.domain.crypto import CryptoAsset

MAX_QUERY = 40
_SPACES = re.compile(r"\s+")


def normalize(query: str) -> str:
    """The query as it is compared: trimmed, one space between words, case-folded, length-capped."""
    return _SPACES.sub(" ", query).strip().casefold()[:MAX_QUERY]


def _tier(asset: CryptoAsset, query: str) -> int | None:
    """How well a coin matches (lower is better), or None when it does not match at all."""
    symbol = asset.symbol.casefold()
    name = asset.name.casefold()
    slug = asset.slug.casefold()
    if symbol == query:
        return 0
    if name == query or slug == query:
        return 1
    if symbol.startswith(query):
        return 2
    if name.startswith(query) or slug.startswith(query):
        return 3
    # A fragment in the middle of a name is a looser match, so a single letter never gets there.
    if len(query) >= 2 and (query in name or query in slug):
        return 4
    return None


def search_assets(assets: Sequence[CryptoAsset], query: str, limit: int) -> list[CryptoAsset]:
    """Up to ``limit`` coins matching ``query``: exact symbol first, then closeness, then size.

    An empty query matches nothing (the caller never gets "everything" by sending no text).
    """
    needle = normalize(query)
    if not needle or limit < 1:
        return []
    ranked = [
        (tier, asset.rank, asset) for asset in assets if (tier := _tier(asset, needle)) is not None
    ]
    ranked.sort(key=lambda entry: (entry[0], entry[1]))
    return [asset for _, _, asset in ranked[:limit]]
