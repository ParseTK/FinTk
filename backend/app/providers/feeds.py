"""Official RSS feeds as a news source: the Federal Reserve Board and the SEC.

Feed XML is untrusted input, so:

- the feeds we read are a fixed list in this file, never taken from a request;
- a response is read up to ``MAX_BYTES`` and no further;
- a document that declares a DTD or entities is refused outright (the classic "billion laughs"
  and external-entity tricks both need one; real feeds never do);
- an item's link is kept only if it is https and on the feed's own host, so a feed cannot point
  readers anywhere else;
- text is whitespace-collapsed, stripped of control characters and length-capped. React escapes it
  on display, so no markup from a feed is ever interpreted.

Parsing is a pure function and is tested against recorded copies of the real feeds.
"""

import logging
import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse
from xml.etree.ElementTree import ParseError

import httpx
from defusedxml.ElementTree import fromstring

from app.core.errors import UpstreamError
from app.domain.news import MAX_TITLE, NewsItem

logger = logging.getLogger(__name__)

MAX_BYTES = 1_000_000  # the real feeds are about 20 KB
MAX_ITEMS_PER_FEED = 30
TIMEOUT = httpx.Timeout(10.0, connect=5.0)
_DTD = re.compile(rb"<!\s*(DOCTYPE|ENTITY)", re.IGNORECASE)
_SPACES = re.compile(r"\s+")


@dataclass(frozen=True, slots=True)
class Feed:
    name: str  # shown to readers as the source
    url: str
    host: str  # item links must be https on this host


FEEDS: tuple[Feed, ...] = (
    Feed(
        "Federal Reserve",
        "https://www.federalreserve.gov/feeds/press_all.xml",
        "www.federalreserve.gov",
    ),
    Feed("SEC", "https://www.sec.gov/news/pressreleases.rss", "www.sec.gov"),
)

# Read for the crypto news only; the keyword rule in app.domain.crypto_news picks the items.
CRYPTO_FEEDS: tuple[Feed, ...] = (
    Feed("SEC", "https://www.sec.gov/news/pressreleases.rss", "www.sec.gov"),
    Feed("CFTC", "https://www.cftc.gov/RSS/RSSGP/rssgp.xml", "www.cftc.gov"),
    Feed("CFTC enforcement", "https://www.cftc.gov/RSS/RSSENF/rssenf.xml", "www.cftc.gov"),
    Feed(
        "Department of Justice",
        "https://www.justice.gov/news/rss?type=press_release&m=1",
        "www.justice.gov",
    ),
)


def _clean(text: str | None) -> str:
    if not text:
        return ""
    printable = "".join(ch for ch in text if unicodedata.category(ch)[0] != "C" or ch in " \t\n")
    return _SPACES.sub(" ", printable).strip()


def _link(value: str | None, host: str) -> str | None:
    if not value:
        return None
    parsed = urlparse(value.strip())
    if parsed.scheme != "https" or parsed.hostname != host or parsed.username or parsed.password:
        return None
    return parsed.geturl()


def _published(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value.strip())
    except (TypeError, ValueError):
        return None
    return parsed.astimezone(UTC) if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def parse_feed(body: bytes, feed: Feed, limit: int = MAX_ITEMS_PER_FEED) -> list[NewsItem]:
    """Items of an RSS 2.0 document, newest first. Items with no usable title, link or date are
    skipped. Raises ValueError for a document that is not acceptable RSS."""
    if len(body) > MAX_BYTES:
        msg = "feed is too large"
        raise ValueError(msg)
    if _DTD.search(body):
        msg = "feed declares a DTD or entities"
        raise ValueError(msg)
    try:
        root = fromstring(body)
    except ParseError as error:
        msg = "feed is not valid XML"
        raise ValueError(msg) from error
    if root.tag != "rss":
        msg = "feed is not RSS"
        raise ValueError(msg)

    found: list[tuple[datetime, NewsItem]] = []
    for node in root.iter("item"):
        title = _clean(node.findtext("title"))[:MAX_TITLE]
        link = _link(node.findtext("link"), feed.host)
        published = _published(node.findtext("pubDate"))
        if not title or link is None or published is None:
            continue
        found.append(
            (
                published,
                NewsItem(
                    source=feed.name,
                    kind="press_release",
                    title=title,
                    published=published.date(),
                    url=link,
                ),
            )
        )
    found.sort(key=lambda pair: pair[0], reverse=True)
    return [item for _, item in found[:limit]]


class FeedProvider:
    """Downloads the fixed feeds. ``client`` carries the User-Agent."""

    def __init__(self, client: httpx.AsyncClient, feeds: Iterable[Feed] = FEEDS) -> None:
        self._client = client
        self.feeds = tuple(feeds)

    async def fetch(self, feed: Feed) -> list[NewsItem]:
        """The feed's items, or UpstreamError (generic message; details go to the log only)."""
        try:
            async with self._client.stream("GET", feed.url, timeout=TIMEOUT) as response:
                if response.status_code != 200:
                    logger.warning("feed %s answered %s", feed.name, response.status_code)
                    msg = "A news source is unavailable right now."
                    raise UpstreamError(msg)
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > MAX_BYTES:
                        break
            return parse_feed(bytes(body), feed)
        except httpx.HTTPError as error:
            logger.warning("feed %s failed: %s", feed.name, type(error).__name__)
            msg = "A news source is unavailable right now."
            raise UpstreamError(msg) from error
        except ValueError as error:
            logger.warning("feed %s was refused: %s", feed.name, error)
            msg = "A news source is unavailable right now."
            raise UpstreamError(msg) from error
