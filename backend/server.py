import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

import gopal_assets
from storage_client import APP_NAME, get_object, init_storage, put_object

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

ADMIN_PIN = os.environ.get("ADMIN_PIN", "1234")

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
IMAGE_SLOTS = [
    "background", "idol", "idol_blue", "idol_pink", "crown", "garland", "diya",
    "bell", "bed", "plate", "flower", "makhan", "laddu", "mishri", "fruits",
]
SOUND_SLOTS = ["bell", "water", "aarti", "lullaby", "bg_music"]

DEFAULT_POSITIONS = {
    "idol": {"width": 67, "height": 50, "offsetY": 0},
    "crown": {"top": -1, "width": 32},
    "tilak": {"top": 13, "width": 5},
    "garland": {"top": 24, "width": 29},
    "plate": {"top": 82, "width": 38},
    "bed": {"top": 52, "width": 92},
}


def default_config() -> dict:
    return {
        "_id": "config",
        "assets": {s: None for s in IMAGE_SLOTS},
        "sounds": {s: None for s in SOUND_SLOTS},
        "positions": DEFAULT_POSITIONS,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


async def get_config_doc() -> dict:
    doc = await db.gopal_config.find_one({"_id": "config"})
    if not doc:
        doc = default_config()
        await db.gopal_config.insert_one(doc)
    changed = False
    for s in IMAGE_SLOTS:
        if s not in doc.get("assets", {}):
            doc.setdefault("assets", {})[s] = None
            changed = True
    for s in SOUND_SLOTS:
        if s not in doc.get("sounds", {}):
            doc.setdefault("sounds", {})[s] = None
            changed = True
    if "positions" not in doc:
        doc["positions"] = DEFAULT_POSITIONS
        changed = True
    else:
        for k, v in DEFAULT_POSITIONS.items():
            if k not in doc["positions"]:
                doc["positions"][k] = v
                changed = True
    if changed:
        await db.gopal_config.update_one({"_id": "config"}, {"$set": doc})
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# Admin gate (simple PIN)
# ---------------------------------------------------------------------------
async def require_admin(x_admin_pin: Optional[str] = Header(None)):
    if x_admin_pin != ADMIN_PIN:
        raise HTTPException(status_code=401, detail="Invalid admin PIN")
    return True


class PinBody(BaseModel):
    pin: str


@api_router.post("/gopal/admin/verify")
async def admin_verify(body: PinBody):
    if body.pin != ADMIN_PIN:
        raise HTTPException(status_code=401, detail="Invalid PIN")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Public config
# ---------------------------------------------------------------------------
@api_router.get("/gopal/config")
async def read_config():
    return await get_config_doc()


class PositionsBody(BaseModel):
    positions: dict


@api_router.put("/gopal/config/positions")
async def update_positions(body: PositionsBody, _=Depends(require_admin)):
    await db.gopal_config.update_one(
        {"_id": "config"},
        {"$set": {"positions": body.positions, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return await get_config_doc()


# ---------------------------------------------------------------------------
# Asset serving + upload
# ---------------------------------------------------------------------------
@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    try:
        content, ctype = await run_in_threadpool(get_object, path)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found")
    return Response(content=content, media_type=ctype, headers={"Cache-Control": "public, max-age=604800"})


@api_router.post("/gopal/upload")
async def upload_asset(
    kind: str = Form(...),
    slot: str = Form(...),
    file: UploadFile = File(...),
    _=Depends(require_admin),
):
    if kind == "image" and slot not in IMAGE_SLOTS:
        raise HTTPException(status_code=400, detail="Unknown image slot")
    if kind == "sound" and slot not in SOUND_SLOTS:
        raise HTTPException(status_code=400, detail="Unknown sound slot")

    data = await file.read()
    ext = (file.filename or "").split(".")[-1].lower() or ("png" if kind == "image" else "mp3")
    fid = uuid.uuid4().hex
    path = f"{APP_NAME}/uploads/{kind}/{slot}/{fid}.{ext}"
    ctype = file.content_type or ("image/png" if kind == "image" else "audio/mpeg")
    await run_in_threadpool(put_object, path, data, ctype)

    served = f"/api/files/{path}"
    field = "assets" if kind == "image" else "sounds"
    await db.gopal_config.update_one(
        {"_id": "config"},
        {"$set": {f"{field}.{slot}": served, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "slot": slot, "path": served}


# ---------------------------------------------------------------------------
# Seed default assets (AI generation)
# ---------------------------------------------------------------------------
SEED_STATUS = {"status": "idle", "current": 0, "total": 0, "slot": None, "error": None}


def _progress_cb(current, total, slot):
    SEED_STATUS.update({"status": "running", "current": current, "total": total, "slot": slot})


async def _run_seed():
    try:
        SEED_STATUS.update({"status": "running", "current": 0, "total": 0, "slot": None, "error": None})
        assets = await gopal_assets.generate_all(_progress_cb)
        update = {f"assets.{k}": v for k, v in assets.items()}
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.gopal_config.update_one({"_id": "config"}, {"$set": update}, upsert=True)
        SEED_STATUS.update({"status": "done", "slot": None})
    except Exception as e:  # noqa: BLE001
        logger.exception("seed failed")
        SEED_STATUS.update({"status": "error", "error": str(e)})


@api_router.post("/gopal/seed")
async def seed_assets(_=Depends(require_admin)):
    if SEED_STATUS["status"] == "running":
        return {"ok": True, "status": "already_running"}
    asyncio.create_task(_run_seed())
    return {"ok": True, "status": "started"}


@api_router.get("/gopal/seed/status")
async def seed_status():
    return SEED_STATUS


# ---------------------------------------------------------------------------
# Daily seva progress
# ---------------------------------------------------------------------------
class ProgressBody(BaseModel):
    date: str
    steps: list[str]
    completed: bool = False


@api_router.get("/gopal/progress")
async def get_progress(date: str):
    doc = await db.gopal_progress.find_one({"date": date})
    if not doc:
        return {"date": date, "steps": [], "completed": False}
    return {"date": doc["date"], "steps": doc.get("steps", []), "completed": doc.get("completed", False)}


@api_router.post("/gopal/progress")
async def save_progress(body: ProgressBody):
    await db.gopal_progress.update_one(
        {"date": body.date},
        {"$set": {
            "date": body.date,
            "steps": body.steps,
            "completed": body.completed,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"ok": True}


@api_router.get("/")
async def root():
    return {"message": "Gopal Seva API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    try:
        await run_in_threadpool(init_storage)
        logger.info("object storage initialised")
    except Exception as e:  # noqa: BLE001
        logger.warning("storage init failed: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
