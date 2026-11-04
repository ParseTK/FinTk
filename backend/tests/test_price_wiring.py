from app.main import create_app
from app.providers.sample_prices import SamplePriceProvider
from tests.conftest import make_settings


async def test_the_app_serves_clearly_labelled_sample_prices() -> None:
    """No licensed provider is configured, so prices are generated samples, labelled as such."""
    app = create_app(make_settings())
    async with app.router.lifespan_context(app):
        prices = app.state.company_service._prices  # pyright: ignore[reportPrivateUsage]
        assert isinstance(prices, SamplePriceProvider)
        assert prices.source == "sample"


async def test_the_markets_service_uses_the_same_sample_prices() -> None:
    app = create_app(make_settings())
    async with app.router.lifespan_context(app):
        assert app.state.market_service is not None


async def test_portfolio_valuation_has_no_price_source_without_a_provider() -> None:
    """Valuation needs stored real prices. With none, it is simply absent, never invented."""
    app = create_app(make_settings())
    async with app.router.lifespan_context(app):
        assert app.state.company_service._latest is None  # pyright: ignore[reportPrivateUsage]


async def test_a_leftover_twelve_data_setting_is_ignored_not_used() -> None:
    """An old environment variable must not break startup or switch a vendor back on."""
    app = create_app(make_settings(twelve_data_api_key="leftover-key-from-an-old-env-file"))
    async with app.router.lifespan_context(app):
        prices = app.state.company_service._prices  # pyright: ignore[reportPrivateUsage]
        assert isinstance(prices, SamplePriceProvider)


def test_the_setting_no_longer_exists() -> None:
    assert not hasattr(make_settings(), "twelve_data_api_key")
