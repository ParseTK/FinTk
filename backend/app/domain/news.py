"""News, restricted to what an official source published about itself or its own actions.

Nothing here writes, summarises, scores or ranks. A news item is the source's own headline with
its date and a link back. For companies the "headline" is built only from the item numbers of a
Form 8-K, whose titles are fixed by the SEC's form instructions, so no one's opinion is involved.
Pure functions, no I/O.
"""

from dataclasses import dataclass
from datetime import date
from typing import Literal

from app.domain.models import Filing

NewsKind = Literal["filing", "press_release"]

# Form 8-K item titles, as named in the SEC's Form 8-K instructions.
EIGHT_K_ITEMS: dict[str, str] = {
    "1.01": "Entry into a Material Definitive Agreement",
    "1.02": "Termination of a Material Definitive Agreement",
    "1.03": "Bankruptcy or Receivership",
    "1.04": "Mine Safety - Reporting of Shutdowns and Patterns of Violations",
    "1.05": "Material Cybersecurity Incidents",
    "2.01": "Completion of Acquisition or Disposition of Assets",
    "2.02": "Results of Operations and Financial Condition",
    "2.03": "Creation of a Direct Financial Obligation or an Obligation under an "
    "Off-Balance Sheet Arrangement of a Registrant",
    "2.04": "Triggering Events That Accelerate or Increase a Direct Financial Obligation or an "
    "Obligation under an Off-Balance Sheet Arrangement",
    "2.05": "Costs Associated with Exit or Disposal Activities",
    "2.06": "Material Impairments",
    "3.01": "Notice of Delisting or Failure to Satisfy a Continued Listing Rule or Standard; "
    "Transfer of Listing",
    "3.02": "Unregistered Sales of Equity Securities",
    "3.03": "Material Modification to Rights of Security Holders",
    "4.01": "Changes in Registrant's Certifying Accountant",
    "4.02": "Non-Reliance on Previously Issued Financial Statements or a Related Audit Report "
    "or Completed Interim Review",
    "5.01": "Changes in Control of Registrant",
    "5.02": "Departure of Directors or Certain Officers; Election of Directors; Appointment of "
    "Certain Officers; Compensatory Arrangements of Certain Officers",
    "5.03": "Amendments to Articles of Incorporation or Bylaws; Change in Fiscal Year",
    "5.04": "Temporary Suspension of Trading Under Registrant's Employee Benefit Plans",
    "5.05": "Amendments to the Registrant's Code of Ethics, or Waiver of a Provision of the "
    "Code of Ethics",
    "5.06": "Change in Shell Company Status",
    "5.07": "Submission of Matters to a Vote of Security Holders",
    "5.08": "Shareholder Director Nominations",
    "7.01": "Regulation FD Disclosure",
    "8.01": "Other Events",
    "9.01": "Financial Statements and Exhibits",
}

EXHIBITS_ITEM = "9.01"
MAX_TITLE = 300


@dataclass(frozen=True, slots=True)
class NewsItem:
    source: str  # who published it, e.g. "Federal Reserve" or "SEC filing"
    kind: NewsKind
    title: str
    published: date
    url: str
    detail: str | None = None  # for a filing: the item numbers, e.g. "Items 2.02, 9.01"


def eight_k_title(items: tuple[str, ...]) -> str:
    """The SEC's own names for the items in a Form 8-K, joined. Unknown numbers stay as numbers.

    Item 9.01 only lists attached exhibits, so it is left out unless it is the only item.
    """
    meaningful = [item for item in items if item != EXHIBITS_ITEM] or list(items)
    if not meaningful:
        return "Current report"
    return "; ".join(EIGHT_K_ITEMS.get(item, f"Item {item}") for item in meaningful)


def filing_news(filing: Filing, company_name: str) -> NewsItem | None:
    """A company event from its Form 8-K. Other forms are not events and give None."""
    if filing.form != "8-K":
        return None
    return NewsItem(
        source=f"{company_name} (SEC filing)",
        kind="filing",
        title=eight_k_title(filing.items),
        published=filing.filed,
        url=filing.url,
        detail="Items " + ", ".join(filing.items) if filing.items else None,
    )


def latest_first(items: list[NewsItem]) -> list[NewsItem]:
    """Newest first; ties keep a stable order by source then title."""
    return sorted(items, key=lambda item: (item.published, item.source, item.title), reverse=True)
