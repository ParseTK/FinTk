"""What counts as crypto news. Both rules are printed on the page, so a reader can see why an item
is there and why another is not. Pure functions, no I/O.

Two kinds of item qualify, and nothing else does:

- an official announcement (SEC, CFTC, Department of Justice) whose own headline contains one of
  ``CRYPTO_TERMS`` as a whole word;
- a Form 8-K from one of the companies in ``CRYPTO_COMPANIES``, filed within the last
  ``FILING_DAYS`` days.

The headline is the source's own; this module never rewrites, scores or ranks anything.
"""

import re
from datetime import date, timedelta

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

_PATTERN = re.compile(
    r"\b(?:" + "|".join(re.escape(term) for term in CRYPTO_TERMS) + r")\b", re.IGNORECASE
)


def is_crypto_related(title: str) -> bool:
    """Whether an official headline mentions one of the printed crypto terms."""
    return _PATTERN.search(title) is not None


def filing_cutoff(today: date) -> date:
    """The oldest filing date still shown."""
    return today - timedelta(days=FILING_DAYS)
