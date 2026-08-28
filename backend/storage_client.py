"""Emergent Managed Object Storage client (sync helpers).

All calls go through the backend; the app never talks to storage directly.
"""
import os
import time
import requests

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"

APP_NAME = "gopal-seva"

_storage_key = None


def init_storage():
    """Init once. Idempotent — returns a reusable storage_key."""
    global _storage_key
    if _storage_key:
        return _storage_key
    emergent_key = os.environ.get("EMERGENT_LLM_KEY")
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": emergent_key}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _reset_and_init():
    global _storage_key
    _storage_key = None
    return init_storage()


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Upload (overwrites silently if path exists). Returns {path,size,etag}."""
    last = None
    for attempt in range(4):
        key = init_storage()
        url = f"{STORAGE_URL}/objects/{path}"
        resp = requests.put(url, headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
        if resp.status_code in (500, 503):
            last = resp
            _reset()
            time.sleep(0.8 * (attempt + 1))
            continue
        resp.raise_for_status()
        return resp.json()
    last.raise_for_status()


def get_object(path: str):
    """Download. Returns (content_bytes, content_type)."""
    last = None
    for attempt in range(3):
        key = init_storage()
        url = f"{STORAGE_URL}/objects/{path}"
        resp = requests.get(url, headers={"X-Storage-Key": key}, timeout=60)
        if resp.status_code == 503:
            last = resp
            _reset()
            time.sleep(0.6 * (attempt + 1))
            continue
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
    last.raise_for_status()


def _reset():
    global _storage_key
    _storage_key = None
