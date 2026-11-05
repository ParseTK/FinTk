"""Pure functions that turn SEC EDGAR JSON into domain models.

No I/O, so they are tested directly against recorded fixtures.
"""

from collections.abc import Mapping, Sequence
from datetime import date
from typing import Any, cast

from app.domain.models import CompanyRef, Filing

type Json = Mapping[str, Any]


def pad_cik(cik: int | str) -> str:
    return str(cik).zfill(10)


def _text(value: object) -> str | None:
    return value.strip() or None if isinstance(value, str) else None


def _date(value: object) -> date | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def parse_directory(payload: Json) -> list[CompanyRef]:
    """Read ``company_tickers_exchange.json``: a ``fields`` header plus ``data`` rows."""
    fields: Sequence[str] = payload.get("fields", [])
    index = {name: position for position, name in enumerate(fields)}
    if not {"cik", "name", "ticker"} <= index.keys():
        msg = "unexpected company directory shape"
        raise ValueError(msg)
    companies: list[CompanyRef] = []
    for row in payload.get("data", []):
        ticker = _text(row[index["ticker"]])
        name = _text(row[index["name"]])
        if ticker is None or name is None:
            continue
        exchange = _text(row[index["exchange"]]) if "exchange" in index else None
        companies.append(
            CompanyRef(
                cik=pad_cik(row[index["cik"]]),
                ticker=ticker.upper(),
                name=name,
                exchange=exchange,
            )
        )
    return companies


def _column(recent: Json, name: str, index: int) -> object:
    """One cell of a ``filings.recent`` column, or None if the column is absent or short."""
    column = recent.get(name)
    if isinstance(column, list) and index < len(cast(list[object], column)):
        return cast(list[object], column)[index]
    return None


def _items(value: object) -> tuple[str, ...]:
    """Form 8-K item numbers from the comma separated column, e.g. "2.02,9.01"."""
    if not isinstance(value, str):
        return ()
    return tuple(part for part in (piece.strip() for piece in value.split(",")) if part)


def filing_url(cik: str, accession_number: str, primary_document: str) -> str:
    folder = accession_number.replace("-", "")
    return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{folder}/{primary_document}"


MAX_FILINGS_PER_FORM = 50  # matches the largest `limit` a caller asks for


def parse_recent_filings(payload: Json, cik: str) -> tuple[Filing, ...]:
    """The newest filings, keeping at most ``MAX_FILINGS_PER_FORM`` of each form, newest first.

    A company's "recent" list can run to a thousand rows, mostly insider Form 4s. Capping per form
    bounds what we keep in memory while still answering "the last N 8-Ks" for any form.
    """
    recent: Json = payload.get("filings", {}).get("recent", {})
    kept: list[Filing] = []
    per_form: dict[str, int] = {}
    for i, accession in enumerate(recent.get("accessionNumber", [])):
        form = recent["form"][i]
        if per_form.get(form, 0) >= MAX_FILINGS_PER_FORM:
            continue
        filed = _date(recent["filingDate"][i])
        primary = recent["primaryDocument"][i]
        if filed is None or not primary:
            continue
        per_form[form] = per_form.get(form, 0) + 1
        kept.append(
            Filing(
                accession_number=accession,
                form=form,
                filed=filed,
                report_date=_date(recent["reportDate"][i]),
                description=_text(recent["primaryDocDescription"][i]),
                url=filing_url(cik, accession, primary),
                items=_items(_column(recent, "items", i)),
            )
        )
    return tuple(kept)
