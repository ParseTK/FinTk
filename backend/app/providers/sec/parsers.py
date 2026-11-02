"""Pure functions that turn SEC EDGAR JSON into domain models.

No I/O, so they are tested directly against recorded fixtures.
"""

from collections.abc import Mapping, Sequence
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from app.domain.models import (
    AnnualValue,
    CompanyProfile,
    CompanyRef,
    Filing,
    MetricSeries,
)

type Json = Mapping[str, Any]

ANNUAL_FORMS = frozenset({"10-K", "10-K/A"})
MIN_ANNUAL_DAYS = 350
MAX_ANNUAL_DAYS = 380


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


def parse_profile(payload: Json, company: CompanyRef) -> CompanyProfile:
    return CompanyProfile(
        cik=company.cik,
        ticker=company.ticker,
        name=_text(payload.get("name")) or company.name,
        exchange=company.exchange,
        sic=_text(payload.get("sic")),
        industry=_text(payload.get("sicDescription")),
        fiscal_year_end=_text(payload.get("fiscalYearEnd")),
        category=_text(payload.get("category")),
        website=_text(payload.get("website")),
    )


def filing_url(cik: str, accession_number: str, primary_document: str) -> str:
    folder = accession_number.replace("-", "")
    return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{folder}/{primary_document}"


def parse_filings(payload: Json, cik: str, form: str | None, limit: int) -> list[Filing]:
    """Read the ``filings.recent`` columns (parallel arrays), newest first, optionally one form."""
    recent: Json = payload.get("filings", {}).get("recent", {})
    accessions: Sequence[str] = recent.get("accessionNumber", [])
    results: list[Filing] = []
    for i, accession in enumerate(accessions):
        row_form = recent["form"][i]
        if form is not None and row_form != form:
            continue
        filed = _date(recent["filingDate"][i])
        primary = recent["primaryDocument"][i]
        if filed is None or not primary:
            continue
        results.append(
            Filing(
                accession_number=accession,
                form=row_form,
                filed=filed,
                report_date=_date(recent["reportDate"][i]),
                description=_text(recent["primaryDocDescription"][i]),
                url=filing_url(cik, accession, primary),
            )
        )
        if len(results) >= limit:
            break
    return results


MAX_FILINGS_PER_FORM = 50  # matches the largest `limit` the API accepts


def parse_recent_filings(payload: Json, cik: str) -> tuple[Filing, ...]:
    """The newest filings, keeping at most ``MAX_FILINGS_PER_FORM`` of each form, newest first.

    A company's "recent" list can run to a thousand rows, mostly insider Form 4s. Capping per form
    bounds what we keep in memory while still answering "the last N 10-Ks" for any form.
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
            )
        )
    return tuple(kept)


# metric name -> (unit, us-gaap tags in priority order). Companies change tags over the years
# (Apple moved from SalesRevenueNet to RevenueFromContractWithCustomer...), so all are merged.
METRIC_TAGS: Mapping[str, tuple[str, tuple[str, ...]]] = {
    "revenue": (
        "USD",
        ("Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"),
    ),
    "gross_profit": ("USD", ("GrossProfit",)),
    "operating_income": ("USD", ("OperatingIncomeLoss",)),
    "net_income": ("USD", ("NetIncomeLoss",)),
    "assets": ("USD", ("Assets",)),
    "liabilities": ("USD", ("Liabilities",)),
    "equity": ("USD", ("StockholdersEquity",)),
    "eps_diluted": ("USD/shares", ("EarningsPerShareDiluted",)),
    "operating_cash_flow": ("USD", ("NetCashProvidedByUsedInOperatingActivities",)),
    "cash": ("USD", ("CashAndCashEquivalentsAtCarryingValue",)),
}


def _to_decimal(raw: object) -> Decimal | None:
    if isinstance(raw, bool) or not isinstance(raw, int | float | str):
        return None
    try:
        return Decimal(str(raw))
    except InvalidOperation:
        return None


def _annual_candidates(entries: Sequence[Json]) -> dict[date, AnnualValue]:
    """Pick one value per fiscal period end.

    Grouped by the period ``end`` date, not ``fy``: ``fy`` labels the *filing*, so a 10-K repeats
    its two prior years under the same ``fy``. Flow items (revenue, income) must span about a year;
    instant items (assets) have no ``start``. The latest ``filed`` wins, so restatements replace
    the original number.
    """
    best: dict[date, AnnualValue] = {}
    for entry in entries:
        if entry.get("form") not in ANNUAL_FORMS:
            continue
        end, filed = _date(entry.get("end")), _date(entry.get("filed"))
        value = _to_decimal(entry.get("val"))
        if end is None or filed is None or value is None:
            continue
        start = _date(entry.get("start"))
        if start is not None and not MIN_ANNUAL_DAYS <= (end - start).days <= MAX_ANNUAL_DAYS:
            continue
        current = best.get(end)
        if current is None or filed > current.filed:
            best[end] = AnnualValue(period_end=end, value=value, filed=filed, form=entry["form"])
    return best


def parse_annual_metrics(payload: Json, years: int) -> list[MetricSeries]:
    gaap: Json = payload.get("facts", {}).get("us-gaap", {})
    series: list[MetricSeries] = []
    for metric, (unit, tags) in METRIC_TAGS.items():
        merged: dict[date, AnnualValue] = {}
        for tag in tags:  # earlier tags win ties on the same period end
            entries: Sequence[Json] = gaap.get(tag, {}).get("units", {}).get(unit, [])
            for end, value in _annual_candidates(entries).items():
                merged.setdefault(end, value)
        if not merged:
            continue
        newest_first = sorted(merged.values(), key=lambda v: v.period_end, reverse=True)
        series.append(MetricSeries(metric=metric, unit=unit, values=tuple(newest_first[:years])))
    return series
