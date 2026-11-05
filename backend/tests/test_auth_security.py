import pytest

from app.auth.security import (
    hash_token,
    new_csrf_token,
    new_pkce_pair,
    new_session_token,
    new_state,
    pkce_challenge,
    safe_equals,
    safe_redirect_path,
    sign,
    verify,
)

SECRET = b"s" * 48


def test_session_tokens_are_long_unique_and_stored_only_as_a_hash() -> None:
    token, stored = new_session_token()
    other, other_stored = new_session_token()

    assert len(token) >= 43  # 256 random bits, base64url
    assert token != other
    assert stored != other_stored
    assert len(stored) == 32
    assert stored == hash_token(token)
    assert token.encode() not in stored  # the hash does not contain the token


def test_csrf_tokens_and_states_are_random() -> None:
    assert new_csrf_token() != new_csrf_token()
    assert new_state() != new_state()


def test_pkce_matches_the_rfc_7636_test_vector() -> None:
    # RFC 7636 appendix B.
    verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    assert pkce_challenge(verifier) == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"


def test_a_generated_pkce_pair_is_consistent_and_within_rfc_length() -> None:
    verifier, challenge = new_pkce_pair()
    assert 43 <= len(verifier) <= 128
    assert challenge == pkce_challenge(verifier)
    assert "=" not in challenge


def test_safe_equals_compares_values() -> None:
    assert safe_equals("abc", "abc")
    assert not safe_equals("abc", "abd")
    assert not safe_equals("abc", "abcd")
    assert not safe_equals("", "x")


class Clock:
    def __init__(self, now: float = 1_000_000.0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now


def test_a_signed_value_round_trips() -> None:
    clock = Clock()
    value = sign({"s": "state", "n": "/portfolio"}, SECRET, clock=clock)
    payload = verify(value, SECRET, max_age_seconds=600, clock=clock)
    assert payload is not None
    assert payload["s"] == "state"
    assert payload["n"] == "/portfolio"


def test_a_value_signed_with_another_secret_is_rejected() -> None:
    clock = Clock()
    value = sign({"s": "x"}, SECRET, clock=clock)
    assert verify(value, b"o" * 48, max_age_seconds=600, clock=clock) is None


def test_tampering_with_the_payload_or_signature_is_rejected() -> None:
    clock = Clock()
    body, signature = sign({"s": "x"}, SECRET, clock=clock).split(".")
    forged_body = sign({"s": "attacker"}, SECRET, clock=clock).split(".")[0]
    assert verify(f"{forged_body}.{signature}", SECRET, max_age_seconds=600, clock=clock) is None
    assert verify(f"{body}.{signature[:-2]}AA", SECRET, max_age_seconds=600, clock=clock) is None


def test_a_signed_value_expires() -> None:
    clock = Clock()
    value = sign({"s": "x"}, SECRET, clock=clock)
    clock.now += 601
    assert verify(value, SECRET, max_age_seconds=600, clock=clock) is None
    clock.now -= 700  # a clock that went backwards is not trusted either
    assert verify(value, SECRET, max_age_seconds=600, clock=clock) is None


@pytest.mark.parametrize(
    "garbage",
    ["", ".", "no-dot", "a.b", "....", "é.é", "e30.e30", "!!!.???", "x" * 5000, "\x00.\x00"],
)
def test_garbage_never_raises_and_is_never_accepted(garbage: str) -> None:
    assert verify(garbage, SECRET, max_age_seconds=600) is None


@pytest.mark.parametrize(
    "value",
    ["/", "/portfolio", "/company/AAPL", "/search?q=apple", "/a/b/c#section"],
)
def test_same_site_paths_are_kept(value: str) -> None:
    assert safe_redirect_path(value) == value


@pytest.mark.parametrize(
    "value",
    [
        None,
        "",
        "https://evil.example",
        "http://evil.example/x",
        "//evil.example",
        "///evil.example",
        "/\\evil.example",
        "\\\\evil.example",
        "/ok\\..\\evil",
        "javascript:alert(1)",
        "evil.example",
        "relative/path",
        "/ok\r\nSet-Cookie: x=y",
        "/ok\x00",
        "/" + "a" * 300,
    ],
)
def test_anything_that_could_leave_the_site_becomes_the_default(value: str | None) -> None:
    assert safe_redirect_path(value) == "/"
    assert safe_redirect_path(value, default="/home") == "/home"
