import pytest

from app.auth.jwt import create_token, verify_token


def test_create_and_verify_roundtrip():
    token = create_token({"sub": "alice", "role": "ops", "name": "Alice"})
    payload = verify_token(token)
    assert payload["sub"] == "alice"
    assert payload["role"] == "ops"
    assert payload["name"] == "Alice"


def test_verify_invalid_token_raises():
    with pytest.raises(Exception):
        verify_token("not.a.valid.token")
