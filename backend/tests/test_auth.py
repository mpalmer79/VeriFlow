def test_login_success(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@veriflow.demo", "password": "VeriFlow!2025"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["expires_in"] > 0


def test_login_wrong_password(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@veriflow.demo", "password": "wrong-password"},
    )
    assert response.status_code == 401


def test_login_unknown_user(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "nobody@veriflow.demo", "password": "VeriFlow!2025"},
    )
    assert response.status_code == 401


def test_me_requires_token(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_returns_current_user(client, auth_headers):
    response = client.get("/api/auth/me", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "admin@veriflow.demo"
    assert body["role"] == "admin"
    assert body["is_active"] is True
