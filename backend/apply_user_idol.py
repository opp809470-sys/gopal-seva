import asyncio
import io
import numpy as np
from PIL import Image
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

import gopal_assets
from storage_client import put_object, APP_NAME
from motor.motor_asyncio import AsyncIOMotorClient
import os

USER_IMG = "/tmp/gopal_user.png"


def key_bg_and_trim(png_bytes: bytes) -> bytes:
    im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    arr = np.array(im).astype(np.float32)
    # sample background from the four corners (median)
    h, w = arr.shape[:2]
    corners = np.array([
        arr[0, 0, :3], arr[0, w - 1, :3], arr[h - 1, 0, :3], arr[h - 1, w - 1, :3],
    ])
    bg = np.median(corners, axis=0)
    dist = np.sqrt(((arr[..., :3] - bg) ** 2).sum(axis=2))
    lo, hi = 45.0, 90.0
    alpha = np.clip((dist - lo) / (hi - lo), 0, 1)
    arr[..., 3] = alpha * 255
    out = Image.fromarray(arr.astype("uint8"), "RGBA")
    bbox = out.getbbox()
    if bbox:
        pad = 5
        out = out.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                        min(out.width, bbox[2] + pad), min(out.height, bbox[3] + pad)))
    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()


def upload(slot: str, png: bytes) -> str:
    path = f"{APP_NAME}/assets/{slot}.png"
    put_object(path, png, "image/png")
    return f"/api/files/{path}"


async def main():
    raw_user = open(USER_IMG, "rb").read()

    # 1) base idol from the user's photo
    idol_png = key_bg_and_trim(raw_user)
    idol_url = upload("idol", idol_png)
    print("idol uploaded", len(idol_png))

    # 2) blue + pink variants (edit the user's photo, keep pose + background)
    edits = {
        "idol_blue": "Change ONLY the dhoti/lower garment color to a royal blue silk dhoti with a thin golden border. Keep the face, body, pose, flute, hair and the plain cream background EXACTLY identical. Do not add any crown, jewellery or garland.",
        "idol_pink": "Change ONLY the dhoti/lower garment color to a bright pink-and-red silk dhoti with a thin golden border. Keep the face, body, pose, flute, hair and the plain cream background EXACTLY identical. Do not add any crown, jewellery or garland.",
    }
    urls = {"idol": idol_url}
    for slot, prompt in edits.items():
        raw = await gopal_assets._generate(prompt, ref_bytes=raw_user)
        png = key_bg_and_trim(raw)
        urls[slot] = upload(slot, png)
        print(slot, "uploaded", len(png))

    # 3) update config: assets + positions tuned for this idol
    positions = {
        "crown": {"top": -1, "width": 32},
        "tilak": {"top": 13, "width": 5},
        "garland": {"top": 25, "width": 42},
        "plate": {"top": 82, "width": 38},
        "bed": {"top": 52, "width": 92},
    }
    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = c[os.environ["DB_NAME"]]
    setter = {f"assets.{k}": v for k, v in urls.items()}
    setter["positions"] = positions
    await db.gopal_config.update_one({"_id": "config"}, {"$set": setter})
    print("config updated", urls, positions)
    c.close()


asyncio.run(main())
