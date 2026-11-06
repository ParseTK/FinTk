"""What counts as crypto news. Both rules are printed on the page, so a reader can see why an item
is there and why another is not. Pure functions, no I/O.

Two kinds of item qualify, and nothing else does:

- an official announcement (SEC, CFTC, Department of Justice) whose own headline contains one of
  ``CRYPTO_TERMS`` as a whole word;
- a Form 8-K from one of the companies in ``CRYPTO_COMPANIES``, filed within the last
  ``FILING_DAYS`` days, at most the newest ``PER_COMPANY_LIMIT`` of each company (one company can
  file almost weekly and would otherwise fill the page).

The headline is the source's own; this module never rewrites, scores or ranks anything.
"""

import re
from collections.abc import Sequence
from datetime import date, timedelta

from app.domain.news import NewsItem, latest_first

# Whole words or phrases, matched case-insensitively ("crypto" does not match "cryptography").
CRYPTO_TERMS: tuple[str, ...] = (
    "crypto",
    "cryptocurrency",
    "cryptocurrencies",
    "digital asset",
    "digital assets",
    "digital currency",
    "digital currencies",
    "virtual currency",
    "virtual currencies",
    "bitcoin",
    "ethereum",
    "stablecoin",
    "stablecoins",
    "blockchain",
    "decentralized finance",
)

# Public companies whose business is mainly crypto. A short, fixed list on purpose: adding a name is
# a code change that is reviewed, so the page never quietly widens. Tickers are looked up in the
# SEC's own directory.
CRYPTO_COMPANIES: tuple[str, ...] = (
    "COIN",  # Coinbase
    "MSTR",  # Strategy
    "MARA",  # Marathon Digital
    "RIOT",  # Riot Platforms
    "CLSK",  # CleanSpark
    "GLXY",  # Galaxy Digital
    "CRCL",  # Circle
    "BLSH",  # Bullish
)

FILING_DAYS = 90
PER_COMPANY_LIMIT = 3

_PATTERN = re.compile(
    r"\b(?:" + "|".join(re.escape(term) for term in CRYPTO_TERMS) + r")\b", re.IGNORECASE
)


def is_crypto_related(title: str) -> bool:
    """Whether an official headline mentions one of the printed crypto terms."""
    return _PATTERN.search(title) is not None


def filing_cutoff(today: date) -> date:
    """The oldest filing date still shown."""
    return today - timedelta(days=FILING_DAYS)


# One source and what it returned: its name, and its items (None when it could not be read).
SourceItems = tuple[str, list[NewsItem] | None]


def assemble_crypto_news(
    announcements: Sequence[SourceItems], filings: Sequence[SourceItems], cutoff: date
) -> tuple[list[NewsItem], list[str]]:
    """The crypto news page's items, newest first, and the names of the sources that were down.

    Announcements are kept when their own headline mentions a crypto term. Each company's filings
    are cut to those on or after cutoff and then to the newest PER_COMPANY_LIMIT. An item that
    several sources carry (the two CFTC feeds can repeat one) appears once, by its link.
    """
    items: list[NewsItem] = []
    down: list[str] = []
    for name, found in announcements:
        if found is None:
            down.append(name)
        else:
            items.extend(item for item in found if is_crypto_related(item.title))
    for name, found in filings:
        if found is None:
            down.append(name)
        else:
            recent = [item for item in found if item.published >= cutoff]
            items.extend(latest_first(recent)[:PER_COMPANY_LIMIT])
    unique = {item.url: item for item in items}
    return latest_first(list(unique.values())), down
