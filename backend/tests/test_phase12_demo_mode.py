"""Phase 12 — demo mode wiring tests.

Demo mode is a build-time switch for portfolio deployments: the frontend
auto-signs-in as the admin demo account on first visit and exposes a
`/roles` page for walking through role-based access. Production deploys
leave `NEXT_PUBLIC_DEMO_MODE` unset and the normal sign-in flow remains.

These tests are static assertions against the frontend source so the
demo-mode story cannot silently regress.
"""

from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND = REPO_ROOT / "frontend"


def test_next_config_drops_localhost_fallback_in_production_builds():
    text = (FRONTEND / "next.config.js").read_text(encoding="utf-8")
    # We no longer fall back to `http://localhost:8000/api` in prod
    # builds — that string should only appear as the dev fallback.
    assert 'isProd ? "" : "http://localhost:8000/api"' in text
    # NEXT_PUBLIC_DEMO_MODE is plumbed through so the client sees it.
    assert "NEXT_PUBLIC_DEMO_MODE" in text


def test_demo_helper_module_exposes_roles_and_autosignin():
    text = (FRONTEND / "lib" / "demo.ts").read_text(encoding="utf-8")
    assert "export const DEMO_ROLES" in text
    assert "export function isDemoMode" in text
    assert "export async function demoSignInAs" in text
    # All four seeded roles must be represented so the role-picker is
    # not a lie.
    for email in (
        "admin@veriflow.demo",
        "intake@veriflow.demo",
        "reviewer@veriflow.demo",
        "manager@veriflow.demo",
    ):
        assert email in text


def test_root_page_autosignin_path():
    text = (FRONTEND / "app" / "page.tsx").read_text(encoding="utf-8")
    assert "isDemoMode" in text
    assert 'demoSignInAs("admin")' in text
    # If auto-sign-in fails, the UI surfaces the error rather than
    # silently looping.
    assert "Demo sign-in failed" in text


def test_login_page_redirects_away_in_demo_mode():
    text = (FRONTEND / "app" / "login" / "page.tsx").read_text(encoding="utf-8")
    assert "isDemoMode" in text
    assert 'router.replace("/")' in text


def test_roles_page_exists_and_covers_four_roles():
    path = FRONTEND / "app" / "(app)" / "roles" / "page.tsx"
    assert path.is_file()
    text = path.read_text(encoding="utf-8")
    assert "DEMO_ROLES" in text
    assert "demoSignInAs" in text
    # Non-demo deploys see an empty state, not a role switcher.
    assert "Role switcher not available" in text


def test_appshell_nav_includes_roles_for_demo_and_relabels_signout():
    text = (FRONTEND / "components" / "AppShell.tsx").read_text(encoding="utf-8")
    assert "demoOnly" in text
    assert '"/roles"' in text
    assert 'demo ? "Reset demo" : "Sign out"' in text


def test_api_client_fails_loudly_when_base_url_missing():
    text = (FRONTEND / "lib" / "api.ts").read_text(encoding="utf-8")
    assert "NEXT_PUBLIC_API_BASE_URL is empty" in text
    # The previous localhost default is gone so prod builds cannot
    # silently bake in a private-network URL.
    assert '"http://localhost:8000/api"' not in text
