# Gopal Seva & Daily Puja — PRD

## Original Problem Statement
Interactive, mobile-friendly "Gopal Seva and Daily Puja" experience inside a Sanatan devotional Expo app. Users tap puja items and see corresponding animations around a child Gopal idol (NOT a pre-rendered video). Layered transparent images + JS animations. Multi-language (Bengali/Hindi/English). Admin panel to upload/replace all assets. Assets from cloud storage.

## Architecture
- **Frontend**: Expo Router (React Native, SDK 54). Reanimated for animations, expo-image (cached) for layered PNGs, expo-audio for sound/music, expo-linear-gradient, expo-haptics.
- **Backend**: FastAPI + MongoDB (motor). Emergent Object Storage for all assets (served via `/api/files/{path}`). Gemini Nano Banana (`gemini-3.1-flash-image-preview`) generates default transparent assets (green-screen chroma-keyed + auto-trimmed via Pillow).
- **State**: Daily seva state persisted locally (`storage` util, keyed by date). Step completion mirrored to backend `gopal_progress`.

## Key Files
- `backend/server.py` — config, admin PIN, file serve/upload, seed, progress endpoints
- `backend/gopal_assets.py` — AI generation + chroma-key + trim + upload
- `backend/storage_client.py` — Emergent Object Storage client (retry on 500/503)
- `frontend/app/index.tsx` — main interactive seva screen
- `frontend/app/admin.tsx` — PIN-gated admin panel
- `frontend/src/AppContext.tsx`, `src/i18n.ts`, `src/audio.ts`, `src/gopalMeta.ts`, `src/components/animations.tsx`

## Implemented (2026-06 — v1 MVP)
- Central Gopal idol on bright temple background; horizontal bottom tray (10 items).
- Interactions: Snan (water sheet + sparkles), Chandan (persistent tilak), Dress (choose + crossfade swap: yellow/blue/pink), Crown (drop-in, persists), Garland (drop-in around neck), Flower (falling petals + pile at feet), Bhog (Makhan/Laddu/Mishri/Fruits on plate), Aarti (clockwise orbiting diya), Bell (swing + sound), Sleep (bed + night dim + lullaby music).
- 9-step ordered progress indicator; bilingual completion card + restart.
- Language toggle (bn/hi/en); sound + background-music toggles (persisted).
- Admin panel (PIN `1234`): upload/replace 15 image slots + 5 sound slots; one-tap AI "Generate Default Images" with live progress.
- 15 default AI assets generated, chroma-keyed transparent, stored in object storage.

## Auth / Credentials
- Admin PIN `1234` (env `ADMIN_PIN`); header `X-Admin-Pin`. No end-user login.

## Backlog / Next
- **P1**: Default sound files (bell/water/aarti/lullaby) — currently admin-upload only; wire realistic temple audio.
- **P1**: Admin position editor (sliders) for crown/tilak/garland/plate/bed per uploaded idol.
- **P2**: Multiple idols/deities selectable; seasonal festival backgrounds.
- **P2**: Streak calendar of completed daily seva; share completed seva image.
- **P2**: Lottie sparkle/aarti flame accents.

## Known Notes
- On web preview, local seva state is per-browser-context (localStorage); native uses AsyncStorage. Completion must be reached in one continuous session on web.
- Audio requires a native build for background/locked-screen playback.
