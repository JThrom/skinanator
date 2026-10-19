# Skinanator

A local, browser-based pixel editor for creating **Minecraft Bedrock** character
skins. Paint directly onto the flattened skin texture with UV guides for every
body part, then export a valid PNG you can import straight into a Bedrock profile.

- Python backend (Flask + Pillow) validates and exports skins.
- Browser front-end provides the pixel canvas, tools, and a rotating 3D preview.
- Supports both skin layouts:
  - **64 x 64** (modern) — includes overlay/2nd layer + separate left/right limbs.
  - **64 x 32** (legacy) — single layer; left limbs mirror the right in-game.

## Requirements

- **Docker + Docker Compose** (recommended), or Python 3.8+ for the local mode.
- A modern web browser.

## Run (Docker, exposed on your LAN)

```bash
./run.sh
```

This builds the image and starts the app in a container, published on all
interfaces so any device on your local network can reach it. The script prints
the URLs, e.g.:

```
  On this machine:      http://localhost:5000
  On your LAN (name):   http://<machine-name>:5000
  On your LAN (IP):     http://192.168.1.220:5000
```

Open the machine-name (or IP) URL from any device on the same network.

Useful commands:

```bash
PORT=8080 ./run.sh          # use a different host port
docker compose logs -f      # follow logs
docker compose down         # stop
```

Saved skins and your custom catalog are stored in the mounted `./skins` and
`./catalog` folders, so they persist across container rebuilds. Inside the
container the app is served by gunicorn (a real WSGI server), not the Flask dev
server.

> Note: this binds the app to your LAN with no authentication. Only run it on a
> network you trust.

## Run (local, without Docker)

```bash
./run-local.sh                 # localhost only
HOST=0.0.0.0 ./run-local.sh    # expose on the LAN without Docker
PORT=8080 ./run-local.sh       # different port
```

On first run this creates a `.venv`, installs dependencies, and generates the
example presets. Then open `http://127.0.0.1:5000`.

Manual alternative:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python app.py        # set HOST=0.0.0.0 to expose on the LAN
```

## Using the editor

- **Layout** — switch between 64x64 and 64x32.
- **Tools** — Pencil (`B`), Eraser (`E`), Fill (`G`), Picker/eyedropper (`I`).
- **Color** — color picker + palette swatches.
- **Mirror X** — paint both sides simultaneously (handy for symmetric skins).
- **UV guides / labels** — colored boxes and names show where each body part
  face lives on the texture (Head, Body, arms, legs, and their overlays).
- **Fill** — flood-fills only within the single UV face under your click (e.g.
  the sleeve front, sleeve back, head top, etc.). It respects that face's
  boundaries and never bleeds across the seams into adjacent faces.
- **Fill Base** — flood the base (non-overlay) regions with the current color to
  get a quick starting body.
- **Zoom** — scale the working canvas.

Erased/transparent pixels stay transparent in the export — required for the
overlay (hat/jacket/sleeve/pant) regions on the 64x64 layout.

## 3D preview

The right-hand panel shows a live **rotating 3D preview** of your skin, built by
a small dependency-free software renderer (`static/preview3d.js`):

- **Auto-rotate** spins the model; toggle it off to hold a pose.
- **Drag** on the preview to orbit manually (pitch/yaw).
- **Show overlay layers** toggles the 2nd layer (hat, jacket, sleeves, pants)
  which is rendered slightly enlarged over the base body, exactly like in game.

The preview reflects edits immediately, so you can see how head, body, arms,
legs and their overlays wrap onto the model as you paint.

## Export & import

Pick an export **Format** in the File panel:

- **.mcpack (default)** — a Bedrock **skin pack**. On most devices you just open
  the downloaded file and Minecraft imports the skin into your **Owned** skins —
  no manual Dressing Room import needed. Choose the **Model** (Classic 4px arms
  or Slim/Alex 3px arms); this sets the pack's geometry
  (`geometry.humanoid.custom` vs `geometry.humanoid.customSlim`). The pack
  contains a `manifest.json` (with unique header/module UUIDs), `skins.json`,
  `texts/` localization, and the skin PNG.
- **.png (texture only)** — the bare skin texture. Import it manually via
  **Dressing Room → Skins → Owned → Import**, then pick classic/slim.

Both formats embed a **maximally-compatible PNG** (IHDR/IDAT/IEND only, 8-bit
RGBA, non-interlaced, filter type 0) so strict importers — notably the **Amazon
Fire tablet / Android edition** — accept them. Stricter decoders can fail to
decode an optimized PNG and report a misleading "must be 64x64" error even when
the image really is 64x64. Every export is also saved into `skins/`.

- **Import PNG** — load an existing Bedrock skin PNG to keep editing it. The
  layout is detected automatically.

## Skin catalog

The catalog (bottom of the page) is a browsable gallery of skins you can load as
starting points.

- **Examples** — a set of read-only preset skins generated by
  `generate_presets.py`. Click any card (or its **Load** button) to load it into
  the editor and start modifying. Included examples:
  - Simple bases: Steve, Alex, Explorer, Hero (Red)
  - Templates: Blank (Skin Tone), Blank (White), Checkerboard
  - **Full-coverage examples that use every skinnable area including the overlay
    layers (hat, jacket, sleeves, pants):** Denim Overalls, Hoodie, and Mech
    Robot (the Robot paints 100% of both the base and overlay for reference).
- **My Skins** — your own saved skins. Click **Save to Catalog** in the File
  panel to store the current canvas (with a name + optional description). Saved
  skins can be loaded, edited, re-saved as new entries, or deleted.
- Use the **All / Examples / My Skins** filters to switch views, and **Refresh**
  to reload the list.

Storage layout:

- Presets live in `presets/` with a `presets/presets.json` manifest.
- Custom skins live in `catalog/` with a `catalog/catalog.json` index.

To regenerate or extend the example presets, edit the `PRESETS` list in
`generate_presets.py` and run:

```bash
.venv/bin/python generate_presets.py
```

## Loading the skin into Minecraft Bedrock

### Easiest: .mcpack (default)

1. In the File panel choose **Format: .mcpack** (the default) and the **Model**
   (Classic or Slim), then click **Export & Download .mcpack**.
2. Get the `.mcpack` onto the device (USB stick, download, cloud, etc.).
3. Open/tap the `.mcpack` file. Minecraft launches and imports it, adding the
   skin to your **Owned** skins.
4. Open the **Dressing Room → Skins → Owned** and select it.

### Alternative: .png texture

1. Choose **Format: .png** and export.
2. In Minecraft Bedrock open the **Dressing Room** (character/hanger icon).
3. Go to **Skins → Owned → Import** (the "+" / Import slot) and select the file.
4. Choose the model type (**Classic** 4px arms or **Slim/Alex** 3px arms).
5. Confirm to apply.

The UV map in this editor targets the classic model; slim works too but note the
3px arm width.

## Project layout

```
app.py                 Flask server: validate / export / import / catalog endpoints
generate_presets.py    Generates the example preset skins into presets/
run.sh                 Docker launcher (build + run, exposed on the LAN)
run-local.sh           Non-Docker launcher (venv + Flask dev server)
Dockerfile             Container image (gunicorn WSGI server)
docker-compose.yml     Service definition: port publishing + persisted volumes
requirements.txt       Python dependencies
templates/index.html   Editor UI
static/style.css       Styling
static/uvmap.js        UV region maps for both skin layouts
static/preview3d.js    Dependency-free rotating 3D preview renderer
static/editor.js       Canvas editor logic (tools, IO, catalog, preview)
presets/               Read-only example skins + presets.json manifest
catalog/               Saved custom skins + catalog.json index
skins/                 Exported skins are saved here
```

## Notes / limitations

- The 3D preview is a lightweight software renderer (affine-textured cuboids with
  painter's-algorithm sorting). It approximates the in-game look but isn't a
  pixel-perfect GPU render.
- The `.mcpack` export uses the standard humanoid geometry (classic/slim).
  Custom (non-humanoid) geometry models are out of scope.
- For slim (Alex) arms the arm width is 3px instead of 4px; the current guides
  use the classic 4px layout. Painting still works, but keep slim arm columns in
  mind if targeting the Alex model.
