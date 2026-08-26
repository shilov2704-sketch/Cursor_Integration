#!/usr/bin/env python3
"""Open HubEx DEV web (HOST_URL). Login via TEST_USER / TEST_PASS. Do not print secrets."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"
OUT = ROOT / "tmp" / "repro-web.png"


def load_env() -> dict[str, str]:
    data: dict[str, str] = {}
    if ENV_PATH.exists():
        for raw in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            data[key.strip()] = value.strip().strip('"').strip("'")
    for key, value in os.environ.items():
        if value:
            data[key] = value
    return data


def try_login(page, env: dict[str, str]) -> None:
    user = env.get("TEST_USER") or ""
    password = env.get("TEST_PASS") or ""
    if not user or not password:
        return
    password_box = page.locator('input[type="password"]').first
    if password_box.count() == 0:
        return
    user_box = page.locator(
        'input[type="email"], input[name="email"], input[name="login"], input[type="text"]'
    ).first
    if user_box.count():
        user_box.fill(user)
    password_box.fill(password)
    tenant = env.get("TEST_TENANT") or ""
    if tenant:
        tenant_box = page.locator(
            'input[name="tenant"], input[placeholder*="tenant" i], input[placeholder*="тенант" i]'
        ).first
        if tenant_box.count():
            tenant_box.fill(tenant)
    submit = page.locator('button[type="submit"], button:has-text("Войти"), button:has-text("Login")').first
    if submit.count():
        submit.click()
        page.wait_for_load_state("domcontentloaded", timeout=30000)


def main() -> int:
    env = load_env()
    base = (env.get("HOST_URL") or "").rstrip("/")
    path = sys.argv[1] if len(sys.argv) > 1 else "/"
    if not base:
        print("HOST_URL is empty. Fill Frontend env / Cloud Agents Secrets.", file=sys.stderr)
        return 1
    if not (env.get("TEST_USER") and env.get("TEST_PASS")):
        print("TEST_USER or TEST_PASS is empty. Fill Frontend env, do not paste values.", file=sys.stderr)
        return 1

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "Playwright is not installed. pip install playwright && python -m playwright install chromium",
            file=sys.stderr,
        )
        return 1

    url = path if path.startswith("http") else f"{base}{path if path.startswith('/') else '/' + path}"
    headers = {}
    token = env.get("API_USER_TOKEN") or env.get("POWER_USER_TOKEN") or ""
    tenant = env.get("TEST_TENANT") or env.get("TENANT_ID") or "5"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if tenant:
        headers["TenantId"] = tenant

    OUT.parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(extra_http_headers=headers or None, ignore_https_errors=True)
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        try_login(page, env)
        page.screenshot(path=str(OUT), full_page=True)
        title = page.title()
        browser.close()

    print(f"opened tenant={tenant} title={title!r} screenshot={OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
