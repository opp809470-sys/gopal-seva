"""Generates default Gopal Seva puja assets with Gemini (Nano Banana),
chroma-keys the transparent overlay items, and uploads them to object storage.
"""
import base64
import io
import os

import numpy as np
from PIL import Image

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from storage_client import put_object, APP_NAME

MODEL = "gemini-3.1-flash-image-preview"


def _api_key():
    return os.environ.get("EMERGENT_LLM_KEY")

STYLE = (
    "beautiful traditional Indian devotional art, soft divine lighting, vibrant colors, "
    "highly detailed, clean edges, single centered subject, no text, no watermark"
)

# Overlay items are generated on a pure green chroma screen so we can cut them out.
GREEN_BG = (
    "The subject is centered and fully visible with generous margin, placed on a "
    "completely flat solid pure chroma green background color #00FF00, no shadows on the background, "
    "no gradient, the background must be one uniform green color."
)

# slot -> prompt. chroma=True means green-screen cutout to transparent PNG.
PROMPTS = {
    "background": {
        "chroma": False,
        "prompt": (
            "A bright ornate Hindu temple interior sanctum, vertical portrait orientation, "
            "golden decorated pillars, marigold and rose garland decorations on top, warm glowing "
            "diya lamps, soft morning sunlight, a raised empty altar platform in the lower center, "
            "no deity, no people, " + STYLE
        ),
    },
    "idol": {
        "chroma": True,
        "prompt": (
            "Adorable baby Krishna (child Gopal) standing figure, chubby cheeks, dark blue skin, "
            "big loving eyes, holding a small flute, wearing a simple plain golden-yellow silk dhoti, "
            "bare head with no crown, no jewellery, no garland, front facing, full body from head to feet, "
            + GREEN_BG + " " + STYLE
        ),
    },
    "crown": {
        "chroma": True,
        "prompt": (
            "A small ornate golden peacock-feather crown (mukut) for a child deity, decorated with "
            "jewels and a single peacock feather, front view, " + GREEN_BG + " " + STYLE
        ),
    },
    "garland": {
        "chroma": True,
        "prompt": (
            "A vertical U-shaped fresh flower garland (mala) made of orange marigold and white "
            "flowers, hanging necklace shape, " + GREEN_BG + " " + STYLE
        ),
    },
    "diya": {
        "chroma": True,
        "prompt": (
            "A single lit brass oil diya lamp with a bright glowing golden flame, side view, "
            + GREEN_BG + " " + STYLE
        ),
    },
    "bell": {
        "chroma": True,
        "prompt": (
            "A hanging golden brass temple bell (ghanti) with a decorative handle on top, front view, "
            + GREEN_BG + " " + STYLE
        ),
    },
    "bed": {
        "chroma": True,
        "prompt": (
            "A tiny ornate decorated swing cradle bed for baby Krishna with a soft pillow and silk "
            "blanket, front view, " + GREEN_BG + " " + STYLE
        ),
    },
    "plate": {
        "chroma": True,
        "prompt": (
            "An empty round silver puja offering thali plate, viewed slightly from above, "
            + GREEN_BG + " " + STYLE
        ),
    },
    "flower": {
        "chroma": True,
        "prompt": (
            "A single fresh orange marigold flower blossom, top view, " + GREEN_BG + " " + STYLE
        ),
    },
    "makhan": {
        "chroma": True,
        "prompt": (
            "A small clay pot filled with white butter (makhan), " + GREEN_BG + " " + STYLE
        ),
    },
    "laddu": {
        "chroma": True,
        "prompt": ("A few round yellow motichoor laddu sweets stacked, " + GREEN_BG + " " + STYLE),
    },
    "mishri": {
        "chroma": True,
        "prompt": ("A small heap of crystal rock sugar mishri, " + GREEN_BG + " " + STYLE),
    },
    "fruits": {
        "chroma": True,
        "prompt": (
            "A small assortment of fresh fruits banana apple and grapes, " + GREEN_BG + " " + STYLE
        ),
    },
}

# Dress variants are produced by editing the base idol so the pose stays identical.
DRESS_EDITS = {
    "idol_blue": "Change ONLY the dhoti/dress color to a royal blue silk dhoti with golden border. Keep the pose, face, body, bare head and the solid green background EXACTLY identical.",
    "idol_pink": "Change ONLY the dhoti/dress color to a bright pink and red silk dhoti with golden border. Keep the pose, face, body, bare head and the solid green background EXACTLY identical.",
}


def _chroma_key(png_bytes: bytes) -> bytes:
    """Remove pure-green background, then crop tight to the subject -> transparent PNG."""
    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    arr = np.array(img).astype(np.int32)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    # green screen: green clearly dominates red and blue
    mask = (g > 90) & (g - r > 40) & (g - b > 40)
    arr[mask, 3] = 0
    # de-spill: reduce green tint on edge pixels
    edge = (~mask) & (g > r) & (g > b)
    arr[edge, 1] = np.minimum(arr[edge, 1], (arr[edge, 0] + arr[edge, 2]) // 2 + 10)
    out = Image.fromarray(arr.astype(np.uint8), "RGBA")
    # crop tight to the subject's alpha bounding box (a little padding)
    bbox = out.getbbox()
    if bbox:
        pad = 6
        left = max(0, bbox[0] - pad)
        top = max(0, bbox[1] - pad)
        right = min(out.width, bbox[2] + pad)
        bottom = min(out.height, bbox[3] + pad)
        out = out.crop((left, top, right, bottom))
    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()


async def _generate(prompt: str, ref_bytes: bytes | None = None) -> bytes:
    chat = LlmChat(api_key=_api_key(), session_id="gopal-seed", system_message="You are an expert devotional artist.")
    chat.with_model("gemini", MODEL).with_params(modalities=["image", "text"])
    if ref_bytes is not None:
        ref_b64 = base64.b64encode(ref_bytes).decode("utf-8")
        msg = UserMessage(text=prompt, file_contents=[ImageContent(ref_b64)])
    else:
        msg = UserMessage(text=prompt)
    _, images = await chat.send_message_multimodal_response(msg)
    if not images:
        raise RuntimeError("no image returned")
    return base64.b64decode(images[0]["data"])


def _upload(slot: str, png_bytes: bytes) -> str:
    path = f"{APP_NAME}/assets/{slot}.png"
    put_object(path, png_bytes, "image/png")
    return f"/api/files/{path}"


async def generate_all(progress_cb):
    """Generate every default asset. progress_cb(current, total, slot) reports status.
    Returns dict of slot -> served path."""
    result = {}
    base_idol_raw = None
    total = len(PROMPTS) + len(DRESS_EDITS)
    i = 0

    for slot, cfg in PROMPTS.items():
        i += 1
        progress_cb(i, total, slot)
        raw = await _generate(cfg["prompt"])
        if slot == "idol":
            base_idol_raw = raw
        png = _chroma_key(raw) if cfg["chroma"] else raw
        result[slot] = _upload(slot, png)

    for slot, edit in DRESS_EDITS.items():
        i += 1
        progress_cb(i, total, slot)
        raw = await _generate(edit, ref_bytes=base_idol_raw)
        png = _chroma_key(raw)
        result[slot] = _upload(slot, png)

    return result
