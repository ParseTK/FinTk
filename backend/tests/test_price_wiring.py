from app.main import create_app
from app.providers.sample_prices import SamplePriceProvider
from app.services.prices import StoredPriceProvider
from tests.conftest import make_settings


async def test_without_a_key_the_app_serves_labelled_sample_prices() -> None:
    app = create_app(make_settings())
    async with app.router.lifespan_context(app):
        assert isinstance(app.state.company_service._prices, SamplePriceProvider)  # pyright: ignore[reportPrivateUsage]


async def test_with_a_key_prices_come_from_twelve_data_through_the_store() -> None:
    app = create_app(make_settings(twelve_data_api_key="placeholder-key"))
    async with app.router.lifespan_context(app):
        prices = app.state.company_service._prices  # pyright: ignore[reportPrivateUsage]
        assert isinstance(prices, StoredPriceProvider)
        assert prices.source == "Twelve Data"


def test_the_key_never_appears_in_the_settings_repr() -> None:
    settings = make_settings(twelve_data_api_key="placeholder-key")
    assert "placeholder-key" not in repr(settings)
    assert "placeholder-key" not in str(settings.model_dump())
