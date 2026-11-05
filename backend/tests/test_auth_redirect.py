# pyright: reportPrivateUsage=false
# White-box on purpose: this is the last guard before the post-login redirect.
import pytest

from app.api.v1.auth import _local_target


@pytest.mark.parametrize("value", ["/", "/portfolio", "/company/AAPL", "/search?q=apple"])
def test_local_paths_are_followed_unchanged(value: str) -> None:
    assert _local_target(value) == value


@pytest.mark.parametrize(
    "value",
    [
        None,
        42,
        "",
        "https://evil.example",
        "//evil.example",
        "/\\evil.example",
        "javascript:alert(1)",
        "evil.example",
        "http:evil.example",
    ],
)
def test_anything_with_a_host_a_scheme_or_the_wrong_type_goes_home(value: object) -> None:
    assert _local_target(value) == "/"
