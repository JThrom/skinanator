"""
Generate standard example skins for the Skinanator catalog.

These are simple, clean starting-point skins painted directly onto the
Bedrock UV layout using the same region maps the editor uses. Run this once
(or any time you want to regenerate the presets):

    .venv/bin/python generate_presets.py

Output: presets/*.png  +  presets/presets.json manifest.
"""

import json
import os

from PIL import Image

from app import skin_png_bytes  # maximally-compatible PNG encoder

BASE = os.path.dirname(os.path.abspath(__file__))
PRESETS_DIR = os.path.join(BASE, "presets")
os.makedirs(PRESETS_DIR, exist_ok=True)

# --- UV region maps (mirror of static/uvmap.js, base layers only) -----------
# Each face rect is [x, y, w, h] in texture pixels.
FACES_64 = {
    "Head":      [[8, 0, 8, 8], [16, 0, 8, 8], [0, 8, 8, 8], [8, 8, 8, 8], [16, 8, 8, 8], [24, 8, 8, 8]],
    "Body":      [[20, 16, 8, 4], [28, 16, 8, 4], [16, 20, 4, 12], [20, 20, 8, 12], [28, 20, 4, 12], [32, 20, 8, 12]],
    "RightArm":  [[44, 16, 4, 4], [48, 16, 4, 4], [40, 20, 4, 12], [44, 20, 4, 12], [48, 20, 4, 12], [52, 20, 4, 12]],
    "LeftArm":   [[36, 48, 4, 4], [40, 48, 4, 4], [32, 52, 4, 12], [36, 52, 4, 12], [40, 52, 4, 12], [44, 52, 4, 12]],
    "RightLeg":  [[4, 16, 4, 4], [8, 16, 4, 4], [0, 20, 4, 12], [4, 20, 4, 12], [8, 20, 4, 12], [12, 20, 4, 12]],
    "LeftLeg":   [[20, 48, 4, 4], [24, 48, 4, 4], [16, 52, 4, 12], [20, 52, 4, 12], [24, 52, 4, 12], [28, 52, 4, 12]],
}

# Overlay ("2nd layer") regions: Hat, Jacket, Sleeves, Pants. Same face order.
OVERLAY_64 = {
    "Hat":         [[40, 0, 8, 8], [48, 0, 8, 8], [32, 8, 8, 8], [40, 8, 8, 8], [48, 8, 8, 8], [56, 8, 8, 8]],
    "Jacket":      [[20, 32, 8, 4], [28, 32, 8, 4], [16, 36, 4, 12], [20, 36, 8, 12], [28, 36, 4, 12], [32, 36, 8, 12]],
    "RightSleeve": [[44, 32, 4, 4], [48, 32, 4, 4], [40, 36, 4, 12], [44, 36, 4, 12], [48, 36, 4, 12], [52, 36, 4, 12]],
    "LeftSleeve":  [[52, 48, 4, 4], [56, 48, 4, 4], [48, 52, 4, 12], [52, 52, 4, 12], [56, 52, 4, 12], [60, 52, 4, 12]],
    "RightPant":   [[4, 32, 4, 4], [8, 32, 4, 4], [0, 36, 4, 12], [4, 36, 4, 12], [8, 36, 4, 12], [12, 36, 4, 12]],
    "LeftPant":    [[4, 48, 4, 4], [8, 48, 4, 4], [0, 52, 4, 12], [4, 52, 4, 12], [8, 52, 4, 12], [12, 52, 4, 12]],
}

# Face order for each part: top, bottom, right, front, left, back.
FACE_ORDER = ["top", "bottom", "right", "front", "left", "back"]

# Head "front" face rect for placing simple facial features.
HEAD_FRONT = [8, 8, 8, 8]


def fill_rects(img, rects, color):
    px = img.load()
    for (x0, y0, w, h) in rects:
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                px[x, y] = color


def dot(img, x, y, color):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.load()[x, y] = color


def add_face(img, skin_tone, eye=(40, 40, 60, 255), eye_white=(240, 240, 240, 255),
             mouth=(90, 50, 50, 255), brow=None):
    """Paint eyes + mouth onto the head front face (8x8 region at 8,8)."""
    fx, fy = HEAD_FRONT[0], HEAD_FRONT[1]
    # Eyes on row 3 of the face (fy+3). Whites at cols 1-2 and 5-6, pupils inner.
    for ex in (1, 5):
        dot(img, fx + ex, fy + 3, eye_white)
        dot(img, fx + ex + 1, fy + 3, eye_white)
    dot(img, fx + 2, fy + 3, eye)
    dot(img, fx + 5, fy + 3, eye)
    # Nose hint (slightly darker tone) center row 4.
    darker = tuple(max(0, c - 25) for c in skin_tone[:3]) + (255,)
    dot(img, fx + 3, fy + 4, darker)
    dot(img, fx + 4, fy + 4, darker)
    # Mouth row 5.
    for mx in (2, 3, 4, 5):
        dot(img, fx + mx, fy + 5, mouth)
    if brow:
        for bx in (1, 2, 5, 6):
            dot(img, fx + bx, fy + 2, brow)


def new_canvas():
    return Image.new("RGBA", (64, 64), (0, 0, 0, 0))


def build_humanoid(skin_tone, shirt, pants, hair=None, shoes=None, face=True,
                   brow=None):
    """Build a full 64x64 humanoid skin from simple flat colors."""
    img = new_canvas()
    # Skin on all limbs + head + (arms).
    fill_rects(img, FACES_64["Head"], skin_tone)
    fill_rects(img, FACES_64["RightArm"], skin_tone)
    fill_rects(img, FACES_64["LeftArm"], skin_tone)
    # Shirt on body.
    fill_rects(img, FACES_64["Body"], shirt)
    # Sleeves: recolor the arm faces except the hand (bottom) to shirt color.
    for part in ("RightArm", "LeftArm"):
        rects = FACES_64[part]
        # top, right, front, left, back = sleeve; bottom stays skin (hand).
        sleeve_rects = [rects[i] for i in (0, 2, 3, 4, 5)]
        # only upper ~8px of the 12px-tall side faces = sleeve, rest skin.
        px = img.load()
        for (x0, y0, w, h) in sleeve_rects:
            hh = h if h <= 4 else 8  # top face short; side faces upper 8px
            for y in range(y0, y0 + hh):
                for x in range(x0, x0 + w):
                    px[x, y] = shirt
    # Pants on legs.
    for part in ("RightLeg", "LeftLeg"):
        fill_rects(img, [FACES_64[part][i] for i in (2, 3, 4, 5)], pants)
        fill_rects(img, [FACES_64[part][0]], pants)  # top = waist
    # Shoes: bottom of legs.
    if shoes:
        px = img.load()
        for part in ("RightLeg", "LeftLeg"):
            for (x0, y0, w, h) in [FACES_64[part][i] for i in (2, 3, 4, 5)]:
                for y in range(y0 + h - 3, y0 + h):
                    for x in range(x0, x0 + w):
                        px[x, y] = shoes
            # bottom face = sole
            fill_rects(img, [FACES_64[part][1]], shoes)
    # Hair: recolor top of head + upper front/back/sides.
    if hair:
        px = img.load()
        # top face fully hair
        fill_rects(img, [FACES_64["Head"][0]], hair)
        # upper 2 rows of the four side faces
        for i in (2, 3, 4, 5):
            x0, y0, w, h = FACES_64["Head"][i]
            for y in range(y0, y0 + 2):
                for x in range(x0, x0 + w):
                    px[x, y] = hair
    if face:
        add_face(img, skin_tone, brow=brow)
    return img


def build_solid(color):
    """A flat single-color skin (useful blank starting point)."""
    img = new_canvas()
    for rects in FACES_64.values():
        fill_rects(img, rects, color)
    return img


def build_checker(a, b):
    """A 2-color checkerboard across the whole 64x64 texture (fun template)."""
    img = new_canvas()
    px = img.load()
    for rects in FACES_64.values():
        for (x0, y0, w, h) in rects:
            for y in range(y0, y0 + h):
                for x in range(x0, x0 + w):
                    px[x, y] = a if (x + y) % 2 == 0 else b
    return img


# --- helpers for full-coverage skins ----------------------------------------
def fill_base_all(img, color):
    """Fill every BASE face region with a color (fully-clothed body)."""
    for rects in FACES_64.values():
        fill_rects(img, rects, color)


def fill_overlay(img, part, color):
    """Fill an OVERLAY part's faces with a solid color."""
    fill_rects(img, OVERLAY_64[part], color)


def outline_overlay(img, part, color):
    """Draw just a 1px border around each overlay face (trim/edging look)."""
    px = img.load()
    for (x0, y0, w, h) in OVERLAY_64[part]:
        for x in range(x0, x0 + w):
            px[x, y0] = color
            px[x, y0 + h - 1] = color
        for y in range(y0, y0 + h):
            px[x0, y] = color
            px[x0 + w - 1, y] = color


def build_overalls(skin_tone, shirt, denim, denim_dark, hair, shoes, boot,
                   button=(230, 200, 90, 255)):
    """
    A denim-overalls character that uses EVERY skinnable area:
      - base: skin on head, full shirt sleeves on arms, shirt torso, legs
      - overlay (2nd layer): hat=hair fringe, jacket=overalls bib, sleeves=cuffs,
        pants=overall legs, all fully painted.
    """
    img = new_canvas()

    # --- BASE layer ---
    # Head skin + face.
    fill_rects(img, FACES_64["Head"], skin_tone)
    # Arms: shirt sleeves down to wrist, hands skin.
    for part in ("RightArm", "LeftArm"):
        fill_rects(img, FACES_64[part], shirt)
        # hand = bottom face + lowest 2px of side faces stays skin
        fill_rects(img, [FACES_64[part][1]], skin_tone)
        px = img.load()
        for (x0, y0, w, h) in [FACES_64[part][i] for i in (2, 3, 4, 5)]:
            for y in range(y0 + h - 2, y0 + h):
                for x in range(x0, x0 + w):
                    px[x, y] = skin_tone
    # Torso shirt.
    fill_rects(img, FACES_64["Body"], shirt)
    # Legs: denim base, boots at bottom.
    for part in ("RightLeg", "LeftLeg"):
        fill_rects(img, FACES_64[part], denim)
        fill_rects(img, [FACES_64[part][1]], boot)  # sole
        px = img.load()
        for (x0, y0, w, h) in [FACES_64[part][i] for i in (2, 3, 4, 5)]:
            for y in range(y0 + h - 3, y0 + h):
                for x in range(x0, x0 + w):
                    px[x, y] = boot
    add_face(img, skin_tone, brow=hair)

    # --- OVERLAY layer (this is what "uses all the areas") ---
    # Hat: hair on top + fringe around head.
    fill_overlay(img, "Hat", (0, 0, 0, 0))
    px = img.load()
    fill_rects(img, [OVERLAY_64["Hat"][0]], hair)  # top
    for i in (2, 3, 4, 5):  # sides: upper 3 rows hair fringe
        x0, y0, w, h = OVERLAY_64["Hat"][i]
        for y in range(y0, y0 + 3):
            for x in range(x0, x0 + w):
                px[x, y] = hair
    # Jacket = overalls bib (denim) covering torso; leave a shirt gap at top.
    fill_overlay(img, "Jacket", denim)
    # carve a small neckline on the jacket FRONT (index 3) top-center
    jf = OVERLAY_64["Jacket"][3]
    for x in range(jf[0] + 3, jf[0] + 5):
        px[x, jf[1]] = (0, 0, 0, 0)
    # bib buttons
    px[jf[0] + 1, jf[1] + 1] = button
    px[jf[0] + 6, jf[1] + 1] = button
    # Sleeves = rolled denim cuffs (only lower part), rest transparent so shirt shows.
    for part in ("RightSleeve", "LeftSleeve"):
        fill_overlay(img, part, (0, 0, 0, 0))
        for (x0, y0, w, h) in [OVERLAY_64[part][i] for i in (2, 3, 4, 5)]:
            for y in range(y0 + h - 4, y0 + h):
                for x in range(x0, x0 + w):
                    px[x, y] = denim_dark
    # Pants = overall legs (denim) fully covering leg overlay.
    for part in ("RightPant", "LeftPant"):
        fill_overlay(img, part, denim)
    return img


def build_hoodie(skin_tone, hoodie, hoodie_dark, jeans, hair, shoes):
    """Hooded sweatshirt character - fully uses base + overlay everywhere."""
    img = new_canvas()
    # BASE
    fill_rects(img, FACES_64["Head"], skin_tone)
    for part in ("RightArm", "LeftArm"):
        fill_rects(img, FACES_64[part], hoodie)
        fill_rects(img, [FACES_64[part][1]], skin_tone)  # hands
    fill_rects(img, FACES_64["Body"], hoodie)
    for part in ("RightLeg", "LeftLeg"):
        fill_rects(img, FACES_64[part], jeans)
        fill_rects(img, [FACES_64[part][1]], shoes)
    add_face(img, skin_tone, brow=hair)
    # OVERLAY - hood + drawstrings + jacket zipper + cuffs + shoe tops
    px = img.load()
    fill_overlay(img, "Hat", hoodie)          # the hood over the head
    fill_overlay(img, "Jacket", hoodie_dark)  # darker hoodie shading layer
    # zipper line down jacket front
    jf = OVERLAY_64["Jacket"][3]
    for y in range(jf[1], jf[1] + jf[3]):
        px[jf[0] + 3, y] = (60, 60, 60, 255)
    for part in ("RightSleeve", "LeftSleeve"):
        fill_overlay(img, part, hoodie_dark)
    for part in ("RightPant", "LeftPant"):
        fill_overlay(img, part, (0, 0, 0, 0))
        # cuffed jeans: lower 3px
        for (x0, y0, w, h) in [OVERLAY_64[part][i] for i in (2, 3, 4, 5)]:
            for y in range(y0 + h - 3, y0 + h):
                for x in range(x0, x0 + w):
                    px[x, y] = shoes
    return img


def build_robot(body, trim, glow, joint):
    """A mech/robot that paints EVERY base and overlay face (armor plating)."""
    img = new_canvas()
    fill_base_all(img, body)
    # glowing "eyes" on head front
    hf = HEAD_FRONT
    px = img.load()
    for ex in (2, 5):
        px[hf[0] + ex, hf[1] + 3] = glow
        px[hf[0] + ex, hf[1] + 4] = glow
    # overlay = armor plating on every part
    for part in ("Hat", "Jacket", "RightSleeve", "LeftSleeve", "RightPant", "LeftPant"):
        fill_overlay(img, part, trim)
        outline_overlay(img, part, joint)
    return img


# --- preset definitions -----------------------------------------------------
PRESETS = [
    {
        "id": "steve",
        "name": "Steve (Classic)",
        "description": "The classic default look: cyan shirt, blue jeans, brown hair.",
        "layout": "64x64",
        "build": lambda: build_humanoid(
            skin_tone=(198, 134, 66, 255),
            shirt=(0, 175, 175, 255),
            pants=(60, 68, 170, 255),
            hair=(60, 40, 20, 255),
            shoes=(85, 85, 85, 255),
            brow=(60, 40, 20, 255),
        ),
    },
    {
        "id": "alex",
        "name": "Alex (Light)",
        "description": "Lighter skin tone, green shirt, brown pants, ginger hair.",
        "layout": "64x64",
        "build": lambda: build_humanoid(
            skin_tone=(240, 190, 140, 255),
            shirt=(90, 160, 90, 255),
            pants=(120, 90, 60, 255),
            hair=(200, 110, 40, 255),
            shoes=(70, 55, 40, 255),
            brow=(200, 110, 40, 255),
        ),
    },
    {
        "id": "explorer",
        "name": "Explorer",
        "description": "Rugged tan outfit with dark boots - a neutral adventurer base.",
        "layout": "64x64",
        "build": lambda: build_humanoid(
            skin_tone=(210, 160, 120, 255),
            shirt=(150, 130, 90, 255),
            pants=(80, 70, 55, 255),
            hair=(40, 30, 25, 255),
            shoes=(45, 35, 30, 255),
        ),
    },
    {
        "id": "hero-red",
        "name": "Hero (Red)",
        "description": "Bold red-and-grey suit - a clean superhero starting point.",
        "layout": "64x64",
        "build": lambda: build_humanoid(
            skin_tone=(225, 175, 135, 255),
            shirt=(200, 50, 50, 255),
            pants=(60, 60, 70, 255),
            hair=(30, 30, 35, 255),
            shoes=(40, 40, 45, 255),
        ),
    },
    {
        "id": "blank-skin",
        "name": "Blank (Skin Tone)",
        "description": "Solid skin-tone body with no clothes - paint your own outfit.",
        "layout": "64x64",
        "build": lambda: build_solid((210, 160, 120, 255)),
    },
    {
        "id": "blank-white",
        "name": "Blank (White)",
        "description": "Solid white template - maximum contrast for designing.",
        "layout": "64x64",
        "build": lambda: build_solid((235, 235, 235, 255)),
    },
    {
        "id": "checker",
        "name": "Checkerboard",
        "description": "Two-tone checker template - handy for spotting UV regions.",
        "layout": "64x64",
        "build": lambda: build_checker((60, 60, 70, 255), (200, 200, 210, 255)),
    },
    {
        "id": "overalls",
        "name": "Denim Overalls",
        "description": "Farmer in denim overalls - uses every area incl. hat, bib jacket, sleeve cuffs and pant overlays.",
        "layout": "64x64",
        "build": lambda: build_overalls(
            skin_tone=(224, 172, 133, 255),
            shirt=(220, 90, 80, 255),
            denim=(70, 100, 160, 255),
            denim_dark=(50, 74, 122, 255),
            hair=(90, 60, 35, 255),
            shoes=(60, 45, 35, 255),
            boot=(50, 38, 30, 255),
        ),
    },
    {
        "id": "hoodie",
        "name": "Hoodie",
        "description": "Hooded sweatshirt with jeans - full base + overlay coverage (hood, cuffs, zipper, cuffed jeans).",
        "layout": "64x64",
        "build": lambda: build_hoodie(
            skin_tone=(236, 188, 150, 255),
            hoodie=(80, 150, 130, 255),
            hoodie_dark=(58, 116, 100, 255),
            jeans=(60, 66, 90, 255),
            hair=(40, 30, 25, 255),
            shoes=(230, 230, 235, 255),
        ),
    },
    {
        "id": "robot",
        "name": "Mech Robot",
        "description": "Armored mech that paints every base and overlay face - a full-coverage reference skin.",
        "layout": "64x64",
        "build": lambda: build_robot(
            body=(120, 128, 138, 255),
            trim=(90, 98, 110, 255),
            glow=(90, 220, 255, 255),
            joint=(45, 50, 58, 255),
        ),
    },
]


def main():
    manifest = []
    for p in PRESETS:
        img = p["build"]()
        fname = f"{p['id']}.png"
        with open(os.path.join(PRESETS_DIR, fname), "wb") as fh:
            fh.write(skin_png_bytes(img))
        manifest.append(
            {
                "id": p["id"],
                "name": p["name"],
                "description": p["description"],
                "layout": p["layout"],
                "file": fname,
            }
        )
        print(f"  generated {fname}  ({p['name']})")

    with open(os.path.join(PRESETS_DIR, "presets.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)
    print(f"\n  wrote presets.json with {len(manifest)} presets")


if __name__ == "__main__":
    main()
