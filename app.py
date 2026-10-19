"""
Skinanator - local Minecraft Bedrock skin editor.

Flask backend:
  - serves the web-based pixel editor
  - validates & exports skin PNGs using Pillow
  - lets you import existing skins and load blank/default templates

Bedrock skins are plain PNG textures. Supported layouts:
  - 64 x 32  (legacy single-layer)
  - 64 x 64  (modern, includes overlay/2nd layer + full arms/legs)
Textures must be RGBA PNG. Transparency is allowed (and required for
overlay regions in the 64x64 layout).
"""

import base64
import io
import json
import os
import re
import struct
import uuid
import zlib
from datetime import datetime

from flask import Flask, jsonify, render_template, request, send_file
from PIL import Image

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SKINS_DIR = os.path.join(BASE_DIR, "skins")
PRESETS_DIR = os.path.join(BASE_DIR, "presets")
CATALOG_DIR = os.path.join(BASE_DIR, "catalog")
CATALOG_INDEX = os.path.join(CATALOG_DIR, "catalog.json")
PRESETS_INDEX = os.path.join(PRESETS_DIR, "presets.json")

for _d in (SKINS_DIR, PRESETS_DIR, CATALOG_DIR):
    os.makedirs(_d, exist_ok=True)

VALID_SIZES = {(64, 32), (64, 64)}
_DATA_URL_RE = re.compile(r"^data:image/png;base64,")


def _decode_data_url(data_url: str) -> bytes:
    """Turn a `data:image/png;base64,...` string into raw PNG bytes."""
    if not data_url or not _DATA_URL_RE.match(data_url):
        raise ValueError("Expected a base64-encoded PNG data URL.")
    b64 = _DATA_URL_RE.sub("", data_url, count=1)
    return base64.b64decode(b64)


def _validate_skin_bytes(png_bytes: bytes) -> Image.Image:
    """
    Validate that bytes are a Bedrock-compatible skin PNG.
    Returns a normalized RGBA Pillow image or raises ValueError.
    """
    try:
        img = Image.open(io.BytesIO(png_bytes))
        img.load()
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Not a readable image: {exc}") from exc

    if img.format != "PNG":
        raise ValueError(f"Skin must be a PNG (got {img.format}).")

    if img.size not in VALID_SIZES:
        raise ValueError(
            f"Invalid dimensions {img.size[0]}x{img.size[1]}. "
            "Bedrock skins must be 64x32 or 64x64."
        )

    # Bedrock expects RGBA; normalize so transparency is preserved.
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    return img


def skin_png_bytes(img: Image.Image) -> bytes:
    """
    Encode a skin as a maximally-compatible PNG for Minecraft Bedrock.

    Some Bedrock skin importers (notably the Fire tablet / Android edition) are
    much stricter than desktop and will reject an otherwise-valid 64x64 PNG with
    a generic "must be 64x64" error when they fail to *decode* it. To avoid that
    we hand-write the simplest possible PNG:

      - IHDR / IDAT / IEND only (no ancillary chunks: no sRGB, gAMA, pHYs,
        tEXt, etc. that Pillow/optimizers may add)
      - 8-bit, color type 6 (RGBA), non-interlaced
      - every scanline uses filter type 0 (None)

    This is the format real-world downloaded skins most resemble and is the
    safest for strict decoders.
    """
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    w, h = img.size
    px = img.tobytes()  # row-major RGBA
    stride = w * 4

    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter: None
        raw += px[y * stride:(y + 1) * stride]
    comp = zlib.compress(bytes(raw), 9)

    def _chunk(typ: bytes, body: bytes) -> bytes:
        payload = typ + body
        return (
            struct.pack(">I", len(body))
            + payload
            + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    return sig + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", comp) + _chunk(b"IEND", b"")


def _safe_name(name: str) -> str:
    name = (name or "").strip() or "skin"
    name = re.sub(r"[^A-Za-z0-9_\-]", "_", name)
    return name[:64]


def _png_to_data_url(png_bytes: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")


def _thumbnail_data_url(img: Image.Image, scale: int = 4) -> str:
    """Nearest-neighbor upscaled thumbnail for catalog display."""
    thumb = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    buf = io.BytesIO()
    thumb.save(buf, format="PNG")
    return _png_to_data_url(buf.getvalue())


def _load_json(path: str, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError):
        return default


def _read_presets():
    """Return preset catalog entries (read-only examples)."""
    manifest = _load_json(PRESETS_INDEX, [])
    entries = []
    for item in manifest:
        path = os.path.join(PRESETS_DIR, item.get("file", ""))
        if not os.path.exists(path):
            continue
        entries.append(
            {
                "id": item["id"],
                "name": item.get("name", item["id"]),
                "description": item.get("description", ""),
                "layout": item.get("layout", "64x64"),
                "source": "preset",
                "file": item["file"],
            }
        )
    return entries


def _read_catalog():
    """Return user custom catalog entries."""
    return _load_json(CATALOG_INDEX, [])


def _write_catalog(entries):
    with open(CATALOG_INDEX, "w") as fh:
        json.dump(entries, fh, indent=2)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/validate", methods=["POST"])
def validate():
    """Validate a data-URL PNG without saving it."""
    payload = request.get_json(silent=True) or {}
    try:
        img = _validate_skin_bytes(_decode_data_url(payload.get("image", "")))
        return jsonify(
            {
                "ok": True,
                "width": img.width,
                "height": img.height,
                "mode": img.mode,
                "layout": f"{img.width}x{img.height}",
            }
        )
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400


@app.route("/api/export", methods=["POST"])
def export():
    """
    Validate + save a skin to disk and return it as a downloadable PNG.
    The saved file is a valid Bedrock skin ready to import into a profile.
    """
    payload = request.get_json(silent=True) or {}
    try:
        img = _validate_skin_bytes(_decode_data_url(payload.get("image", "")))
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400

    name = _safe_name(payload.get("name", ""))
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    filename = f"{name}-{stamp}.png"
    path = os.path.join(SKINS_DIR, filename)

    # Write a maximally-compatible PNG so strict importers (Fire/Android) accept it.
    png = skin_png_bytes(img)
    with open(path, "wb") as fh:
        fh.write(png)

    resp = send_file(
        io.BytesIO(png),
        mimetype="image/png",
        as_attachment=True,
        download_name=filename,
    )
    resp.headers["X-Saved-Path"] = path
    return resp


@app.route("/api/import", methods=["POST"])
def import_skin():
    """Accept an uploaded PNG file and return it as a validated data URL."""
    if "file" not in request.files:
        return jsonify({"ok": False, "error": "No file uploaded."}), 400
    file = request.files["file"]
    raw = file.read()
    try:
        img = _validate_skin_bytes(raw)
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return jsonify(
        {
            "ok": True,
            "image": f"data:image/png;base64,{b64}",
            "width": img.width,
            "height": img.height,
        }
    )


@app.route("/api/catalog", methods=["GET"])
def catalog_list():
    """
    List all catalog entries: built-in presets first, then user custom skins.
    Each entry includes a thumbnail data URL for display.
    """
    entries = []

    for p in _read_presets():
        path = os.path.join(PRESETS_DIR, p["file"])
        try:
            img = Image.open(path).convert("RGBA")
            p = {**p, "thumb": _thumbnail_data_url(img)}
        except OSError:
            continue
        entries.append(p)

    for c in _read_catalog():
        path = os.path.join(CATALOG_DIR, c.get("file", ""))
        if not os.path.exists(path):
            continue
        try:
            img = Image.open(path).convert("RGBA")
        except OSError:
            continue
        entries.append(
            {
                "id": c["id"],
                "name": c.get("name", c["id"]),
                "description": c.get("description", ""),
                "layout": c.get("layout", f"{img.width}x{img.height}"),
                "source": "custom",
                "file": c["file"],
                "created": c.get("created", ""),
                "thumb": _thumbnail_data_url(img),
            }
        )

    return jsonify({"ok": True, "entries": entries})


@app.route("/api/catalog/<source>/<entry_id>", methods=["GET"])
def catalog_get(source, entry_id):
    """Return the full-resolution skin image for a catalog entry as a data URL."""
    if source == "preset":
        entry = next((p for p in _read_presets() if p["id"] == entry_id), None)
        directory = PRESETS_DIR
    elif source == "custom":
        entry = next((c for c in _read_catalog() if c["id"] == entry_id), None)
        directory = CATALOG_DIR
    else:
        return jsonify({"ok": False, "error": "Unknown source."}), 400

    if not entry:
        return jsonify({"ok": False, "error": "Entry not found."}), 404

    path = os.path.join(directory, entry["file"])
    try:
        img = _validate_skin_bytes(open(path, "rb").read())
    except (OSError, ValueError) as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return jsonify(
        {
            "ok": True,
            "image": _png_to_data_url(buf.getvalue()),
            "name": entry.get("name", entry_id),
            "layout": f"{img.width}x{img.height}",
            "width": img.width,
            "height": img.height,
        }
    )


@app.route("/api/catalog", methods=["POST"])
def catalog_save():
    """Save the current skin into the user custom catalog."""
    payload = request.get_json(silent=True) or {}
    try:
        img = _validate_skin_bytes(_decode_data_url(payload.get("image", "")))
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400

    name = (payload.get("name") or "").strip() or "Untitled Skin"
    description = (payload.get("description") or "").strip()
    entry_id = uuid.uuid4().hex[:12]
    filename = f"{_safe_name(name)}-{entry_id}.png"
    path = os.path.join(CATALOG_DIR, filename)

    with open(path, "wb") as fh:
        fh.write(skin_png_bytes(img))

    entries = _read_catalog()
    entry = {
        "id": entry_id,
        "name": name,
        "description": description,
        "layout": f"{img.width}x{img.height}",
        "file": filename,
        "created": datetime.now().isoformat(timespec="seconds"),
    }
    entries.append(entry)
    _write_catalog(entries)

    return jsonify({"ok": True, "entry": {**entry, "source": "custom"}})


@app.route("/api/catalog/custom/<entry_id>", methods=["DELETE"])
def catalog_delete(entry_id):
    """Delete a user custom catalog entry (presets cannot be deleted)."""
    entries = _read_catalog()
    entry = next((c for c in entries if c["id"] == entry_id), None)
    if not entry:
        return jsonify({"ok": False, "error": "Entry not found."}), 404

    path = os.path.join(CATALOG_DIR, entry["file"])
    if os.path.exists(path):
        try:
            os.remove(path)
        except OSError as exc:
            return jsonify({"ok": False, "error": str(exc)}), 500

    entries = [c for c in entries if c["id"] != entry_id]
    _write_catalog(entries)
    return jsonify({"ok": True})


if __name__ == "__main__":
    # HOST defaults to loopback for local dev; set HOST=0.0.0.0 (as the Docker
    # image does) to expose the app on the LAN. When run under gunicorn (in the
    # container) this block is not used - gunicorn imports `app:app` directly.
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    print(f"\n  Skinanator running at http://{host}:{port}\n")
    app.run(host=host, port=port, debug=debug)
