from scripts.export_openapi import CONTRACT_PATH, render


def test_the_committed_contract_matches_the_code() -> None:
    # If this fails, run `uv run python -m scripts.export_openapi` and commit openapi.json.
    assert CONTRACT_PATH.read_text(encoding="utf-8") == render()


def test_the_contract_hides_test_only_routes() -> None:
    assert "/__test" not in render()
