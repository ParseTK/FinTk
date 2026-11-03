from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Request, Response

from app.core.errors import ErrorResponse, UnavailableError
from app.schemas.companies import (
    CompanyProfileResponse,
    CompanySummary,
    FilingResponse,
    FilingsResponse,
    FinancialsResponse,
    MetricSeriesResponse,
    MonthlyPricesResponse,
    RatioSeriesResponse,
    SearchResponse,
    SeasonalityResponse,
)
from app.services.companies import CompanyService

router = APIRouter(
    prefix="/companies",
    tags=["companies"],
    responses={404: {"model": ErrorResponse, "description": "No such company."}},
)

SEC_SOURCE = "SEC EDGAR"


def get_company_service(request: Request) -> CompanyService:
    service: CompanyService | None = request.app.state.company_service
    if service is None:
        msg = "Company data is not configured on this server."
        raise UnavailableError(msg)
    return service


Service = Annotated[CompanyService, Depends(get_company_service)]
TickerParam = Annotated[
    str,
    Path(min_length=1, max_length=10, description="Ticker symbol, e.g. AAPL or BRK-B."),
]


def _cacheable(response: Response, seconds: int) -> None:
    response.headers["Cache-Control"] = f"public, max-age={seconds}"


@router.get("/search", summary="Search companies by name or ticker")
async def search_companies(
    service: Service,
    response: Response,
    q: Annotated[str, Query(min_length=1, max_length=60)],
    limit: Annotated[int, Query(ge=1, le=25)] = 10,
) -> SearchResponse:
    _cacheable(response, 300)
    results = await service.search(q, limit)
    return SearchResponse(results=[CompanySummary.from_domain(c) for c in results])


@router.get("/{ticker}", summary="Company profile")
async def get_company(
    ticker: TickerParam, service: Service, response: Response
) -> CompanyProfileResponse:
    _cacheable(response, 300)
    return CompanyProfileResponse.from_domain(await service.profile(ticker))


@router.get("/{ticker}/filings", summary="Recent SEC filings")
async def get_filings(
    ticker: TickerParam,
    service: Service,
    response: Response,
    form: Annotated[str | None, Query(pattern=r"^[0-9A-Za-z/-]{1,12}$")] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> FilingsResponse:
    _cacheable(response, 300)
    filings = await service.filings(ticker, form, limit)
    return FilingsResponse(filings=[FilingResponse.from_domain(f) for f in filings])


@router.get("/{ticker}/financials", summary="Annual financial statements")
async def get_financials(
    ticker: TickerParam,
    service: Service,
    response: Response,
    years: Annotated[int, Query(ge=1, le=20)] = 5,
) -> FinancialsResponse:
    _cacheable(response, 3600)
    metrics = await service.financials(ticker, years)
    return FinancialsResponse(
        ticker=ticker.upper(),
        source=SEC_SOURCE,
        metrics=[MetricSeriesResponse.from_domain(m) for m in metrics],
        ratios=[RatioSeriesResponse.from_domain(r) for r in service.ratios(metrics)],
    )


@router.get("/{ticker}/prices/monthly", summary="Monthly closing prices")
async def get_monthly_prices(
    ticker: TickerParam, service: Service, response: Response
) -> MonthlyPricesResponse:
    _cacheable(response, 3600)
    return MonthlyPricesResponse.from_domain(await service.monthly_prices(ticker))


@router.get("/{ticker}/seasonality", summary="Return of each calendar month, year by year")
async def get_seasonality(
    ticker: TickerParam, service: Service, response: Response
) -> SeasonalityResponse:
    _cacheable(response, 3600)
    return SeasonalityResponse.from_domain(await service.seasonality(ticker))
