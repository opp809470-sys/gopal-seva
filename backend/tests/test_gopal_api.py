"""Backend tests for Gopal Seva API."""
import io
import os
from datetime import datetime

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://daily-seva-ritual.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
PIN = "1234"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    return sess


# --- config ---
def test_config_returns_full_structure(s):
    r = s.get(f"{API}/gopal/config", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "assets" in d and "sounds" in d and "positions" in d
    for slot in ["background", "idol", "idol_blue", "idol_pink", "crown", "garland", "diya",
                 "bell", "bed", "plate", "flower", "makhan", "laddu", "mishri", "fruits"]:
        assert slot in d["assets"], f"missing image slot {slot}"
    for slot in ["bell", "water", "aarti", "lullaby", "bg_music"]:
        assert slot in d["sounds"]
    for k in ["crown", "tilak", "garland", "plate", "bed"]:
        assert k in d["positions"]


# --- new: verify user-idol positions & idol asset serving ---
def test_positions_match_new_idol_tuning(s):
    """Bug-fix verification (iter3): garland shrunk -> {top:24,width:29}. Crown/tilak unchanged."""
    d = s.get(f"{API}/gopal/config", timeout=15).json()
    pos = d["positions"]
    assert pos["crown"] == {"top": -1, "width": 32}, pos["crown"]
    assert pos["tilak"] == {"top": 13, "width": 5}, pos["tilak"]
    assert pos["garland"] == {"top": 24, "width": 29}, pos["garland"]


def test_idol_variants_all_present(s):
    d = s.get(f"{API}/gopal/config", timeout=15).json()
    for slot in ["idol", "idol_blue", "idol_pink"]:
        assert d["assets"].get(slot), f"{slot} is null"


@pytest.mark.parametrize("fname", ["idol.png", "idol_blue.png", "idol_pink.png"])
def test_serve_idol_variants(s, fname):
    r = s.get(f"{BASE_URL}/api/files/gopal-seva/assets/{fname}", timeout=30)
    assert r.status_code == 200, f"{fname} -> {r.status_code}"
    assert r.headers.get("content-type", "").startswith("image/")
    assert len(r.content) > 1000, f"{fname} body too small ({len(r.content)} bytes)"


# --- admin verify ---
def test_admin_verify_ok(s):
    r = s.post(f"{API}/gopal/admin/verify", json={"pin": PIN}, timeout=15)
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_admin_verify_wrong(s):
    r = s.post(f"{API}/gopal/admin/verify", json={"pin": "0000"}, timeout=15)
    assert r.status_code == 401


# --- serve file (seeded idol.png should exist) ---
def test_serve_seeded_asset(s):
    # find any non-null asset from config
    cfg = s.get(f"{API}/gopal/config", timeout=15).json()
    path = None
    for slot, p in cfg["assets"].items():
        if p:
            path = p
            break
    assert path, "no seeded assets in config"
    r = s.get(f"{BASE_URL}{path}", timeout=30)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/")


def test_serve_missing_file_404(s):
    r = s.get(f"{API}/files/gopal-seva/assets/does-not-exist-xyz.png", timeout=15)
    assert r.status_code == 404


# --- upload ---
def _tiny_png_bytes():
    # 1x1 transparent PNG
    import base64
    return base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    )


def test_upload_without_pin_rejected(s):
    files = {"file": ("t.png", io.BytesIO(_tiny_png_bytes()), "image/png")}
    r = s.post(f"{API}/gopal/upload", data={"kind": "image", "slot": "flower"}, files=files, timeout=30)
    assert r.status_code == 401


def test_upload_with_wrong_pin_rejected(s):
    files = {"file": ("t.png", io.BytesIO(_tiny_png_bytes()), "image/png")}
    r = s.post(
        f"{API}/gopal/upload",
        data={"kind": "image", "slot": "flower"},
        files=files,
        headers={"X-Admin-Pin": "0000"},
        timeout=30,
    )
    assert r.status_code == 401


def test_upload_with_pin_updates_config(s):
    files = {"file": ("t.png", io.BytesIO(_tiny_png_bytes()), "image/png")}
    r = s.post(
        f"{API}/gopal/upload",
        data={"kind": "image", "slot": "flower"},
        files=files,
        headers={"X-Admin-Pin": PIN},
        timeout=60,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True and body["slot"] == "flower"
    served = body["path"]
    # Confirm config reflects new path
    cfg = s.get(f"{API}/gopal/config", timeout=15).json()
    assert cfg["assets"]["flower"] == served
    # File is retrievable
    r2 = s.get(f"{BASE_URL}{served}", timeout=30)
    assert r2.status_code == 200
    assert r2.headers.get("content-type", "").startswith("image/")


def test_upload_invalid_slot(s):
    files = {"file": ("t.png", io.BytesIO(_tiny_png_bytes()), "image/png")}
    r = s.post(
        f"{API}/gopal/upload",
        data={"kind": "image", "slot": "not_a_slot"},
        files=files,
        headers={"X-Admin-Pin": PIN},
        timeout=30,
    )
    assert r.status_code == 400


# --- progress ---
def test_progress_save_and_read(s):
    today = f"TEST-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    steps = ["snan", "chandan", "dress", "crown", "garland", "flower", "bhog", "aarti", "sleep"]
    r = s.post(
        f"{API}/gopal/progress",
        json={"date": today, "steps": steps, "completed": True},
        timeout=15,
    )
    assert r.status_code == 200
    g = s.get(f"{API}/gopal/progress", params={"date": today}, timeout=15)
    assert g.status_code == 200
    d = g.json()
    assert d["date"] == today
    assert d["steps"] == steps
    assert d["completed"] is True


def test_progress_missing_date_default(s):
    r = s.get(f"{API}/gopal/progress", params={"date": "1999-01-01"}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["steps"] == [] and d["completed"] is False


# --- seed status ---
def test_seed_status(s):
    r = s.get(f"{API}/gopal/seed/status", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") in {"idle", "running", "done", "error"}
