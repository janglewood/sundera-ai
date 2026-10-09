#!/usr/bin/env python3
"""Pinterest publishing via Playwright browser automation (Anton's own personal account,
max a few pins/day) — NOT the official Pinterest API. See the "Pinterest publishing"
section of CLAUDE.md for why: Standard API access (needed for public pins) has a
days-to-weeks review lead time, so this reverses the repo's earlier "API only, no
browser automation" decision. Confirmed 2026-10-07, low volume, Anton's own account.

Entry points:
  - login_interactive(): run ONCE by hand (`./.venv/bin/python pinterest_publish.py login`)
    to open a real, visible browser, log in yourself, and save the session to
    SESSION_PATH. Never done by bot.py — it requires your credentials, which must never be
    typed anywhere but Pinterest's own page. **Doesn't work for Google-OAuth accounts** —
    see import_cookies() below.
  - import_cookies(): Google blocks sign-in from a Playwright-controlled (CDP-automated)
    Chromium outright ("This browser or app may not be secure") — a deliberate anti-bot
    measure on Google's side, not something to route around. For a Pinterest account that
    only has "Continue with Google" (no Pinterest-native password), the workaround is:
    log into Pinterest normally in a real, non-automated browser, export its cookies
    (Cookie-Editor extension, JSON format), and convert that export into the same
    storage_state.json shape login_interactive() would have produced. Run via
    `./.venv/bin/python pinterest_publish.py import-cookies --file <exported.json>`.
  - publish_pin(): called by bot.py (via asyncio.to_thread) for each scheduled publish,
    reusing the saved session — no login step at run time.

Selectors target Pinterest's own `id`/`data-test-id` attributes (e.g. #storyboard-selector-title,
#WebsiteField) rather than visible text — this account's Pinterest UI renders in Russian, so
placeholder-text matching (the original approach) failed outright; id/data-test-id attributes stay
in English regardless of display language. Verified end-to-end against live Pinterest 2026-10-08
(see CLAUDE.md) via `pinterest_publish.py test ... --headed`. If Pinterest redesigns this page again,
re-run `test --headed`, and if it breaks, dump the live HTML (_debug_dump already does this on any
step failure — see output/pinterest_debug/*.html) rather than guessing at new selectors blind.
"""
import argparse
import json
import os
import re
import sys
import time

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SESSION_PATH = os.environ.get("PINTEREST_SESSION_PATH", os.path.join(HERE, "pinterest_session.json"))
DEBUG_DIR = os.path.join(HERE, "output", "pinterest_debug")
CREATE_PIN_URL = "https://www.pinterest.com/pin-creation-tool/"


class PublishError(Exception):
    pass


def login_interactive():
    """Opens a real, visible Chromium window. Log in by hand (solve any 2FA/captcha
    yourself), then come back to this terminal and press Enter. Saves the session so
    publish_pin() never has to log in again."""
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        page.goto("https://www.pinterest.com/login/")
        print(
            "Browser window opened — log into Pinterest there (including any 2FA/captcha).\n"
            "Once you're on your home feed, come back here and press Enter."
        )
        input()
        # Light sanity check rather than a hard assertion — Pinterest's own UI is the
        # source of truth for "logged in", this just avoids saving an obviously-bad session.
        if "login" in page.url:
            print(f"Warning: still on {page.url} — this looks like login didn't complete. Saving anyway.")
        context.storage_state(path=SESSION_PATH)
        browser.close()
    print(f"Session saved to {SESSION_PATH}")


_SAME_SITE_MAP = {
    "no_restriction": "None",
    "unspecified": "Lax",
    "lax": "Lax",
    "strict": "Strict",
    "none": "None",
}


def _convert_cookie_editor_entry(raw):
    """Cookie-Editor's JSON export field names/values -> Playwright storage_state's cookie
    shape. Tolerant of the couple of schema variants different extension versions use
    (e.g. expirationDate vs expires) rather than assuming one exact shape."""
    domain = raw.get("domain", "")
    same_site_raw = str(raw.get("sameSite", "unspecified")).lower()
    expires = raw.get("expirationDate", raw.get("expires"))
    is_session = raw.get("session", expires is None)
    return {
        "name": raw["name"],
        "value": raw["value"],
        "domain": domain,
        "path": raw.get("path", "/"),
        "expires": -1 if is_session or expires is None else float(expires),
        "httpOnly": bool(raw.get("httpOnly", False)),
        "secure": bool(raw.get("secure", True)),
        "sameSite": _SAME_SITE_MAP.get(same_site_raw, "Lax"),
    }


def import_cookies(export_path, verify=True, headless=True):
    """Converts a Cookie-Editor-style JSON cookie export into SESSION_PATH's
    storage_state format — the workaround for Google-OAuth-only Pinterest accounts, where
    login_interactive() can't work (Google blocks sign-in from an automated browser; see
    the module docstring). export_path's cookies must come from a real, non-automated
    browser logged into Pinterest normally. Only pinterest.com-domain cookies are kept,
    in case the export was taken from "all cookies" rather than scoped to the one site."""
    with open(export_path) as f:
        data = json.load(f)
    raw_cookies = data["cookies"] if isinstance(data, dict) and "cookies" in data else data
    if not isinstance(raw_cookies, list):
        raise ValueError(f"{export_path} doesn't look like a Cookie-Editor JSON export (expected a list)")

    cookies = [
        _convert_cookie_editor_entry(c) for c in raw_cookies
        if "pinterest.com" in c.get("domain", "")
    ]
    if not cookies:
        raise ValueError(
            f"No pinterest.com cookies found in {export_path} — export cookies while on a "
            "pinterest.com tab, not the full cookie jar."
        )

    with open(SESSION_PATH, "w") as f:
        json.dump({"cookies": cookies, "origins": []}, f, indent=2)
    print(f"Converted {len(cookies)} pinterest.com cookie(s) -> {SESSION_PATH}")

    if not verify:
        return
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless)
        context = browser.new_context(storage_state=SESSION_PATH)
        page = context.new_page()
        page.goto("https://www.pinterest.com/", wait_until="domcontentloaded")
        page.wait_for_timeout(2000)
        if "login" in page.url:
            print(f"Warning: landed on {page.url} — the imported session does not look logged in.")
        else:
            print(f"Looks logged in (landed on {page.url}).")
        browser.close()


def _debug_dump(page, step_name):
    os.makedirs(DEBUG_DIR, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    path = os.path.join(DEBUG_DIR, f"{stamp}_{step_name}.png")
    try:
        page.screenshot(path=path, full_page=True)
    except Exception:
        path = None
    try:
        html_path = os.path.join(DEBUG_DIR, f"{stamp}_{step_name}.html")
        with open(html_path, "w") as f:
            f.write(page.content())
    except Exception:
        pass
    return path


def _step(page, name, fn):
    try:
        return fn()
    except Exception as e:
        shot = _debug_dump(page, name)
        hint = f" (screenshot: {shot})" if shot else ""
        raise PublishError(f"step '{name}' failed: {e}{hint}") from e


def publish_pin(image_path, title, description, link, board_name=None, headless=True):
    """Posts one pin using the saved session. board_name is optional — falsy skips the
    board picker entirely and the pin lands directly on the profile (this account has no
    boards set up, confirmed 2026-10-08), if truthy it must exactly match an existing
    board's visible name. Raises PublishError (with a debug screenshot path where
    available) on anything unexpected — callers should treat that as "needs a human to
    look," not retry blindly. Returns the resulting page URL (best-effort — Pinterest's
    post-publish redirect isn't guaranteed to be the pin's permalink, treat it as
    informational, not authoritative)."""
    if not os.path.exists(SESSION_PATH):
        raise PublishError(f"no saved session at {SESSION_PATH} — run: python pinterest_publish.py login")
    if not os.path.exists(image_path):
        raise PublishError(f"image not found: {image_path}")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless)
        context = browser.new_context(storage_state=SESSION_PATH)
        page = context.new_page()

        _step(page, "goto_create", lambda: page.goto(CREATE_PIN_URL, wait_until="domcontentloaded"))

        if "login" in page.url:
            browser.close()
            raise PublishError("redirected to login — saved session expired, re-run `login` interactively")

        def upload():
            page.locator('input[type="file"]').first.set_input_files(image_path)
            page.wait_for_timeout(2000)  # let the upload preview render before the next field exists

        _step(page, "upload_image", upload)

        # Selectors below use Pinterest's own `id`/`data-test-id` attributes, confirmed
        # 2026-10-08 against the live create-pin page's HTML (saved via a failed run's
        # debug dump) — these stay in English regardless of the account's display
        # language. The original placeholder-text-regex selectors failed outright because
        # this account's Pinterest UI is in Russian; never go back to text-based matching
        # for this page.

        def fill_title():
            page.locator("#storyboard-selector-title").fill(title)

        _step(page, "fill_title", fill_title)

        def fill_description():
            page.locator('[data-test-id="storyboard-description-field-container"] [contenteditable="true"]').first.fill(description)

        _step(page, "fill_description", fill_description)

        def fill_link():
            page.locator("#WebsiteField").fill(link)

        _step(page, "fill_link", fill_link)

        def blur_last_field():
            # Publish stays disabled while the last-filled field still has focus — confirmed
            # 2026-10-08 by Anton manually clicking outside the field and watching Publish
            # light up. Not a validation/content/account issue, just a missing blur.
            page.locator("#WebsiteField").press("Tab")
            page.wait_for_timeout(300)

        _step(page, "blur_last_field", blur_last_field)

        if board_name:
            def pick_board():
                page.locator('[data-test-id="board-dropdown-select-button"]').first.click()
                page.wait_for_timeout(500)
                page.get_by_text(board_name, exact=False).first.click()

            _step(page, "pick_board", pick_board)
        # else: no board selected — pin publishes straight to the profile (Pinterest allows
        # this; confirmed 2026-10-08, this account has no boards set up).

        def click_publish():
            page.locator('[data-test-id="storyboard-creation-nav-done"] button').first.click()
            page.wait_for_timeout(3000)

        _step(page, "click_publish", click_publish)

        result_url = page.url
        browser.close()
        return result_url


def _cli():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("login", help="one-time interactive login, saves the session")
    imp = sub.add_parser(
        "import-cookies",
        help="convert a Cookie-Editor JSON export into the saved session (for Google-OAuth-only accounts)",
    )
    imp.add_argument("--file", required=True, help="path to the Cookie-Editor JSON export")
    imp.add_argument("--no-verify", action="store_true", help="skip the post-import logged-in check")
    imp.add_argument("--headed", action="store_true", help="show the browser during verification")
    test = sub.add_parser("test", help="publish one pin by hand, for verifying selectors")
    test.add_argument("--image", required=True)
    test.add_argument("--title", required=True)
    test.add_argument("--description", required=True)
    test.add_argument("--link", required=True)
    test.add_argument("--board", default="", help="omit to publish without a board (straight to profile)")
    test.add_argument("--headed", action="store_true", help="show the browser (recommended for the first run)")
    args = parser.parse_args()

    if args.cmd == "login":
        login_interactive()
        return
    if args.cmd == "import-cookies":
        import_cookies(args.file, verify=not args.no_verify, headless=not args.headed)
        return
    try:
        url = publish_pin(
            args.image, args.title, args.description, args.link, args.board,
            headless=not args.headed,
        )
        print(f"Published. Landed on: {url}")
    except PublishError as e:
        sys.exit(f"Publish failed: {e}")


if __name__ == "__main__":
    _cli()
