"""Phase 8A cookie-auth smoke tests.

Covers three contracts from the plan:

- Login sets both the cookie and the body token (rollout window).
- A request that carries only the cookie is authenticated.
- Logout clears the cookie with Max-Age=0.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.api.deps import SESSION_COOKIE_NAME


def _login_body() -> dict:
    return {"email": "admin@veriflow.demo", "password": "VeriFlow!2025"}


def test_login_sets_cookie_and_body_token(client: TestClient):
    response = client.post("/api/auth/login", json=_login_body())
    assert response.status_code == 200, response.text

    body = response.json()
    assert body.get("access_token")

    # Starlette's TestClient surfaces Set-Cookie on the response. The
    # cookie name and the body token must both be present during the
    # rollout window.
    set_cookie = response.headers.get("set-cookie", "")
    assert SESSION_COOKIE_NAME in set_cookie
    assert "HttpOnly" in set_cookie
    assert "SameSite=strict" in set_cookie


def test_cookie_auth_permits_authenticated_request(client: TestClient):
    client.post("/api/auth/login", json=_login_body())
    # TestClient stores the Set-Cookie on its internal cookie jar, so
    # a follow-up call WITHOUT the Authorization header still carries
    # the session cookie and must succeed.
    response = client.get("/api/auth/me")
    assert response.status_code == 200, response.text
    assert response.json()["email"] == "admin@veriflow.demo"


def test_logout_clears_cookie(client: TestClient):
    client.post("/api/auth/login", json=_login_body())
    response = client.post("/api/auth/logout")
    assert response.status_code == 204
    set_cookie = response.headers.get("set-cookie", "")
    assert SESSION_COOKIE_NAME in set_cookie
    # "Max-Age=0" is the server-side signal to the browser that the
    # cookie is dead now. The value is either empty or the literal
    # deletion sentinel.
    assert "Max-Age=0" in set_cookie
