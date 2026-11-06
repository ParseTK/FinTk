"""The sign-in flow contract: what the callback accepts and everything it must refuse."""

from app.auth.flow import SignInFlow, encode_flow, read_flow, start_flow
from app.auth.security import pkce_challenge, sign

SECRET = b"s" * 32
NOW = 1_800_000_000.0


def cookie_for(flow: SignInFlow, *, clock: float = NOW) -> str:
    return sign(
        {"s": flow.state, "v": flow.verifier, "p": flow.provider, "n": flow.next_path},
        SECRET,
        clock=lambda: clock,
    )


def read(cookie: str | None, flow: SignInFlow, **overrides: object) -> SignInFlow | None:
    args: dict[str, object] = {"provider": flow.provider, "state": flow.state, "clock": lambda: NOW}
    args.update(overrides)
    return read_flow(cookie, SECRET, **args)  # type: ignore[arg-type]


def test_start_makes_a_fresh_flow_and_the_challenge_that_matches_its_verifier() -> None:
    first, challenge = start_flow("github", "/holdings")
    second, _ = start_flow("github", "/holdings")
    assert first.state != second.state
    assert first.verifier != second.verifier
    assert challenge == pkce_challenge(first.verifier)
    assert (first.provider, first.next_path) == ("github", "/holdings")


def test_start_refuses_an_off_site_destination() -> None:
    flow, _ = start_flow("github", "https://evil.example/steal")
    assert flow.next_path == "/"


def test_the_returning_browser_is_accepted_and_gets_its_values_back() -> None:
    flow, _ = start_flow("google", "/account")
    assert read(cookie_for(flow), flow) == flow


def test_a_cookie_made_by_encode_flow_reads_back_through_read_flow() -> None:
    flow, _ = start_flow("google", "/account")
    cookie = encode_flow(flow, SECRET)
    assert read_flow(cookie, SECRET, provider="google", state=flow.state) == flow


def test_a_different_state_is_refused() -> None:
    """Someone else's authorization code fed into this browser carries a state this cookie lacks."""
    flow, _ = start_flow("github", None)
    assert read(cookie_for(flow), flow, state="someone-elses-state") is None


def test_a_missing_or_empty_state_or_cookie_is_refused() -> None:
    flow, _ = start_flow("github", None)
    assert read(cookie_for(flow), flow, state=None) is None
    assert read(cookie_for(flow), flow, state="") is None
    assert read(None, flow) is None
    assert read("", flow) is None


def test_a_cookie_for_another_provider_is_refused() -> None:
    flow, _ = start_flow("github", None)
    assert read(cookie_for(flow), flow, provider="google") is None


def test_a_forged_or_tampered_cookie_is_refused() -> None:
    flow, _ = start_flow("github", None)
    good = cookie_for(flow)
    assert read(good[:-2] + "xx", flow) is None
    assert read("not-a-cookie", flow) is None
    forged = sign({"s": flow.state, "v": "x", "p": "github", "n": "/"}, b"other-secret" * 3)
    assert read(forged, flow) is None


def test_an_expired_cookie_is_refused() -> None:
    flow, _ = start_flow("github", None)
    old = cookie_for(flow, clock=NOW - 10_000)
    assert read(old, flow, max_age_seconds=600) is None
    assert read(cookie_for(flow, clock=NOW - 100), flow, max_age_seconds=600) == flow


def test_a_cookie_missing_a_value_or_holding_the_wrong_type_is_refused() -> None:
    flow, _ = start_flow("github", None)
    no_verifier = sign({"s": flow.state, "p": "github", "n": "/"}, SECRET, clock=lambda: NOW)
    number_state = sign({"s": 123, "v": "v", "p": "github", "n": "/"}, SECRET, clock=lambda: NOW)
    assert read(no_verifier, flow) is None
    assert read(number_state, flow) is None


def test_a_destination_that_is_not_a_same_site_path_falls_back_to_home() -> None:
    flow, _ = start_flow("github", None)
    cookie = sign(
        {"s": flow.state, "v": "v", "p": "github", "n": "//evil.example"},
        SECRET,
        clock=lambda: NOW,
    )
    read_back = read(cookie, flow)
    assert read_back is not None
    assert read_back.next_path == "/"
