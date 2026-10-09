"""Local, free watermark cleanup via rapid-mlx (https://github.com/raullenchai/Rapid-MLX)
serving flux2-klein-4b — confirmed this session to clean up Kufar's watermark (and
third-party sellers'/agencies' own logo overlays) noticeably better than kufar_collect.py's
cv2.inpaint fixed-box approach, at the cost of ~110s/photo on this machine (Apple M4) vs <1s
for cv2.inpaint. See marketing/pinterest/CLAUDE.md and the memory note on this comparison —
do not suggest switching the *redesign* generation step (pipeline.edit_image, OpenRouter/Nano
Banana) to FLUX, that was tested and is clearly worse for that step specifically.

Used by refill_pool.py to clean up whatever's left in photos/watermark/ after
classify_photos.py's pass. Not used for anything else (redesign generation stays on
OpenRouter, see pipeline.py).
"""
import os
import subprocess
import sys
import time

import requests

PORT = 8123
BASE_URL = f"http://localhost:{PORT}"
MODEL = "flux2-klein-4b"
PROMPT = (
    "remove any logo, text, or watermark overlay visible anywhere in this photo; "
    "keep everything else in the photo exactly unchanged"
)


def _is_up():
    try:
        return requests.get(f"{BASE_URL}/v1/models", timeout=3).status_code == 200
    except requests.RequestException:
        return False


def ensure_server(timeout=900):
    """Returns the Popen handle if this call started the server (caller should stop_server()
    it when done), or None if a server was already running (leave it alone)."""
    if _is_up():
        return None
    # rapid-mlx lives in the venv's bin/ alongside the running interpreter — not
    # necessarily on PATH (Popen doesn't inherit venv activation, unlike an interactive
    # shell), so resolve it relative to sys.executable instead of relying on PATH lookup.
    rapid_mlx_bin = os.path.join(os.path.dirname(sys.executable), "rapid-mlx")
    proc = subprocess.Popen(
        [rapid_mlx_bin, "serve", MODEL, "--port", str(PORT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    deadline = time.time() + timeout
    while time.time() < deadline:
        if _is_up():
            return proc
        if proc.poll() is not None:
            raise RuntimeError(f"rapid-mlx serve exited early (code {proc.returncode})")
        time.sleep(3)
    proc.terminate()
    raise TimeoutError(f"rapid-mlx serve did not become ready within {timeout}s")


def stop_server(proc):
    if proc is not None:
        proc.terminate()
        try:
            proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            proc.kill()


def clean_watermark(path):
    """Returns cleaned image bytes (PNG, per rapid-mlx's response_format=b64_json)."""
    import base64

    with open(path, "rb") as f:
        resp = requests.post(
            f"{BASE_URL}/v1/images/edits",
            files={"image": f},
            data={"model": MODEL, "prompt": PROMPT, "response_format": "b64_json"},
            timeout=300,
        )
    resp.raise_for_status()
    return base64.b64decode(resp.json()["data"][0]["b64_json"])
