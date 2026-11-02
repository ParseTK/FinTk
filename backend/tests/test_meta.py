import tomllib
from pathlib import Path

from httpx import AsyncClient

from app import __version__


async def test_meta_describes_the_service(client: AsyncClient) -> None:
    response = await client.get("/api/v1/meta")
    assert response.status_code == 200
    assert response.json() == {
        "name": "virello-api",
        "version": __version__,
        "environment": "test",
    }


def test_version_matches_pyproject() -> None:
    pyproject = Path(__file__).resolve().parent.parent / "pyproject.toml"
    declared = tomllib.loads(pyproject.read_text(encoding="utf-8"))["project"]["version"]
    assert declared == __version__
