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


def test_enter_page_autosignin_path():
    # The UI elevation pass moved the root route's auto-signin logic out
    # of /page.tsx (now the product landing) and into a dedicated /enter
    # route. The demo-signin contract lives there now; the landing just
    # redirects authenticated visitors to /dashboard.
    text = (FRONTEND / "app" / "enter" / "page.tsx").read_text(encoding="utf-8")
    assert "isDemoMode" in text
    assert 'demoSignInAs("admin")' in text
    # If auto-sign-in fails, the UI surfaces the error rather than
    # silently looping.
    assert "Demo sign-in failed" in text


def test_login_page_redirects_away_in_demo_mode():
    text = (FRONTEND / "app" / "login" / "page.tsx").read_text(encoding="utf-8")
    assert "isDemoMode" in text
    # Demo-mode visitors landing on /login are bounced to /enter so the
    # auto-signin flow kicks in, rather than the landing page which is
    # designed for anonymous first-touch traffic.
    assert 'router.replace("/enter")' in text


def test_role_switcher_moves_to_user_menu_dropdown():
    # The standalone /roles route is retired in favour of a dropdown on
    # the top-right user cluster. The dropdown must cover all four demo
    # roles so the walkthrough flow is unchanged; clicking a role runs
    # demoSignInAs under the hood.
    roles_path = FRONTEND / "app" / "(app)" / "roles" / "page.tsx"
    assert not roles_path.exists(), "/roles route should be removed"

    menu = (FRONTEND / "components" / "UserMenu.tsx").read_text(encoding="utf-8")
    assert "DEMO_ROLES" in menu
    assert "Switch role" in menu
    assert "Sign out" in menu


def test_appshell_drops_roles_nav_and_uses_usermenu():
    text = (FRONTEND / "components" / "AppShell.tsx").read_text(encoding="utf-8")
    # Roles no longer lives in the top-level nav.
    assert '"/roles"' not in text
    assert "demoOnly" not in text
    # User cluster routes through the new UserMenu component, not the
    # bare "Reset demo" button.
    assert "UserMenu" in text
    assert '"Reset demo"' not in text


def test_api_client_fails_loudly_when_base_url_missing():
    text = (FRONTEND / "lib" / "api.ts").read_text(encoding="utf-8")
    assert "NEXT_PUBLIC_API_BASE_URL is empty" in text
    # The previous localhost default is gone so prod builds cannot
    # silently bake in a private-network URL.
    assert '"http://localhost:8000/api"' not in text
