/*
 * preview3d.js - a tiny dependency-free 3D preview for Minecraft skins.
 *
 * Renders the humanoid model as textured cuboids sampled from the skin
 * texture. Faces are split into small triangles and rasterized with affine
 * UV interpolation (good enough at preview scale). A painter's algorithm
 * (sort by average depth) handles occlusion.
 *
 * Model dimensions & UV mapping follow the standard Minecraft humanoid:
 *   - Head   : 8x8x8
 *   - Body   : 8x12x4
 *   - Arm    : 4x12x4 (classic)
 *   - Leg    : 4x12x4
 * Overlay ("2nd layer") boxes are the same size, scaled up slightly so they
 * sit just outside the base layer (hat, jacket, sleeves, pants).
 *
 * Exposes: window.Preview3D = { create(canvas) -> controller }
 */

(() => {
  "use strict";

  // Standard skin face UV maps (base layer). Rects are [u, v, w, h] in
  // texture pixels. Face keys: up, down, north(front), south(back),
  // east(right side of the model as viewed), west(left side).
  //
  // NOTE: These match static/uvmap.js. For the 64x64 layout we include the
  // separate left arm/leg regions and every overlay region so all skinnable
  // areas are shown.
  const BASE = {
    head: { size: [8, 8, 8], uv: {
      up:   [8, 0, 8, 8],  down: [16, 0, 8, 8],
      east: [0, 8, 8, 8],  north:[8, 8, 8, 8], west:[16, 8, 8, 8], south:[24, 8, 8, 8] } },
    body: { size: [8, 12, 4], uv: {
      up:   [20, 16, 8, 4], down: [28, 16, 8, 4],
      east: [16, 20, 4, 12],north:[20, 20, 8, 12], west:[28, 20, 4, 12], south:[32, 20, 8, 12] } },
    rarm: { size: [4, 12, 4], uv: {
      up:   [44, 16, 4, 4], down: [48, 16, 4, 4],
      east: [40, 20, 4, 12],north:[44, 20, 4, 12], west:[48, 20, 4, 12], south:[52, 20, 4, 12] } },
    larm: { size: [4, 12, 4], uv: {
      up:   [36, 48, 4, 4], down: [40, 48, 4, 4],
      east: [32, 52, 4, 12],north:[36, 52, 4, 12], west:[40, 52, 4, 12], south:[44, 52, 4, 12] } },
    rleg: { size: [4, 12, 4], uv: {
      up:   [4, 16, 4, 4],  down: [8, 16, 4, 4],
      east: [0, 20, 4, 12], north:[4, 20, 4, 12], west:[8, 20, 4, 12], south:[12, 20, 4, 12] } },
    lleg: { size: [4, 12, 4], uv: {
      up:   [20, 48, 4, 4], down: [24, 48, 4, 4],
      east: [16, 52, 4, 12],north:[20, 52, 4, 12], west:[24, 52, 4, 12], south:[28, 52, 4, 12] } },
  };

  // Overlay layer UV maps (only exist on 64x64).
  const OVERLAY = {
    head: { uv: {
      up:   [40, 0, 8, 8], down: [48, 0, 8, 8],
      east: [32, 8, 8, 8], north:[40, 8, 8, 8], west:[48, 8, 8, 8], south:[56, 8, 8, 8] } },
    body: { uv: {
      up:   [20, 32, 8, 4], down: [28, 32, 8, 4],
      east: [16, 36, 4, 12],north:[20, 36, 8, 12], west:[28, 36, 4, 12], south:[32, 36, 8, 12] } },
    rarm: { uv: {
      up:   [44, 32, 4, 4], down: [48, 32, 4, 4],
      east: [40, 36, 4, 12],north:[44, 36, 4, 12], west:[48, 36, 4, 12], south:[52, 36, 4, 12] } },
    larm: { uv: {
      up:   [52, 48, 4, 4], down: [56, 48, 4, 4],
      east: [48, 52, 4, 12],north:[52, 52, 4, 12], west:[56, 52, 4, 12], south:[60, 52, 4, 12] } },
    rleg: { uv: {
      up:   [4, 32, 4, 4],  down: [8, 32, 4, 4],
      east: [0, 36, 4, 12], north:[4, 36, 4, 12], west:[8, 36, 4, 12], south:[12, 36, 4, 12] } },
    lleg: { uv: {
      up:   [4, 48, 4, 4],  down: [8, 48, 4, 4],
      east: [0, 52, 4, 12], north:[4, 52, 4, 12], west:[8, 52, 4, 12], south:[12, 52, 4, 12] } },
  };

  // Model-space placement of each part's CENTER (units = texture pixels).
  // Y grows downward in our world space; we flip at projection time.
  // Origin ~ mid-torso. Head on top, legs below.
  const PLACEMENT = {
    head: [0, -10, 0],
    body: [0, 2, 0],
    rarm: [-6, 2, 0],
    larm: [6, 2, 0],
    rleg: [-2, 14, 0],
    lleg: [2, 14, 0],
  };

  // Cube face definitions: 8 corners, and per-face the 4 corner indices
  // (CCW when viewed from outside) plus UV corner order.
  // Corner order for a box of size (sx,sy,sz) centered at origin:
  //   0:(-,-,-) 1:(+,-,-) 2:(+,+,-) 3:(-,+,-)
  //   4:(-,-,+) 5:(+,-,+) 6:(+,+,+) 7:(-,+,+)
  // -Y is up (top), +Y is down.
  const FACES = [
    { key: "north", idx: [0, 1, 2, 3], n: [0, 0, -1] }, // front (-Z)
    { key: "south", idx: [5, 4, 7, 6], n: [0, 0, 1] },  // back (+Z)
    { key: "east",  idx: [4, 0, 3, 7], n: [-1, 0, 0] }, // left of model (-X)
    { key: "west",  idx: [1, 5, 6, 2], n: [1, 0, 0] },  // right of model (+X)
    { key: "up",    idx: [4, 5, 1, 0], n: [0, -1, 0] }, // top (-Y)
    { key: "down",  idx: [3, 2, 6, 7], n: [0, 1, 0] },  // bottom (+Y)
  ];

  function corners(cx, cy, cz, sx, sy, sz) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    return [
      [cx - hx, cy - hy, cz - hz],
      [cx + hx, cy - hy, cz - hz],
      [cx + hx, cy + hy, cz - hz],
      [cx - hx, cy + hy, cz - hz],
      [cx - hx, cy - hy, cz + hz],
      [cx + hx, cy - hy, cz + hz],
      [cx + hx, cy + hy, cz + hz],
      [cx - hx, cy + hy, cz + hz],
    ];
  }

  function create(canvas) {
    const ctx = canvas.getContext("2d");
    // Offscreen 1x1 sampler to read texel colors quickly.
    let tex = null;         // ImageData of current skin texture
    let texW = 0, texH = 0;
    let layout = "64x64";
    let showOverlay = true;

    const rot = { x: -0.15, y: 0.6 };   // radians (pitch, yaw)
    let dragging = false, lastX = 0, lastY = 0;

    function setTexture(imageData, w, h, layoutKey) {
      tex = imageData;
      texW = w; texH = h;
      layout = layoutKey;
    }

    function sample(u, v) {
      // u,v in texel coords; clamp + nearest.
      let x = Math.min(texW - 1, Math.max(0, Math.floor(u)));
      let y = Math.min(texH - 1, Math.max(0, Math.floor(v)));
      const i = (y * texW + x) * 4;
      const d = tex.data;
      return [d[i], d[i + 1], d[i + 2], d[i + 3]];
    }

    function rotatePoint(p) {
      // yaw around Y, then pitch around X.
      const cy = Math.cos(rot.y), sy = Math.sin(rot.y);
      const cx = Math.cos(rot.x), sx = Math.sin(rot.x);
      let [x, y, z] = p;
      // yaw
      let x1 = x * cy + z * sy;
      let z1 = -x * sy + z * cy;
      // pitch
      let y1 = y * cx - z1 * sx;
      let z2 = y * sx + z1 * cx;
      return [x1, y1, z2];
    }

    function project(p, cw, ch) {
      const fov = 340;          // focal length in px
      const dist = 46;          // camera distance in model units
      const z = p[2] + dist;
      const s = fov / z;
      return [cw / 2 + p[0] * s, ch / 2 + p[1] * s, z];
    }

    // Rasterize a textured quad (4 world pts + 4 uv pts) as two triangles.
    function drawQuad(pts2d, uvs, shade) {
      drawTri([pts2d[0], pts2d[1], pts2d[2]], [uvs[0], uvs[1], uvs[2]], shade);
      drawTri([pts2d[0], pts2d[2], pts2d[3]], [uvs[0], uvs[2], uvs[3]], shade);
    }

    function drawTri(p, uv, shade) {
      const minX = Math.floor(Math.min(p[0][0], p[1][0], p[2][0]));
      const maxX = Math.ceil(Math.max(p[0][0], p[1][0], p[2][0]));
      const minY = Math.floor(Math.min(p[0][1], p[1][1], p[2][1]));
      const maxY = Math.ceil(Math.max(p[0][1], p[1][1], p[2][1]));
      const area = edge(p[0], p[1], p[2]);
      if (area === 0) return;

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5, py = y + 0.5;
          let w0 = edge(p[1], p[2], [px, py]);
          let w1 = edge(p[2], p[0], [px, py]);
          let w2 = edge(p[0], p[1], [px, py]);
          if ((w0 >= 0 && w1 >= 0 && w2 >= 0) ||
              (w0 <= 0 && w1 <= 0 && w2 <= 0)) {
            const l0 = w0 / area, l1 = w1 / area, l2 = w2 / area;
            const u = l0 * uv[0][0] + l1 * uv[1][0] + l2 * uv[2][0];
            const v = l0 * uv[0][1] + l1 * uv[1][1] + l2 * uv[2][1];
            const c = sample(u, v);
            if (c[3] === 0) continue; // transparent texel
            const r = (c[0] * shade) | 0;
            const g = (c[1] * shade) | 0;
            const b = (c[2] * shade) | 0;
            ctx.fillStyle = `rgba(${r},${g},${b},${c[3] / 255})`;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    function edge(a, b, c) {
      return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    }

    // Shading per face normal (fixed light) for a bit of depth cueing.
    function faceShade(nWorld) {
      const light = [0.3, -0.7, -0.5];
      const len = Math.hypot(...light);
      const d = (nWorld[0] * light[0] + nWorld[1] * light[1] + nWorld[2] * light[2]) / len;
      return 0.65 + 0.35 * Math.max(0, d);
    }

    function collectPart(name, uvmap, scale, quads, cw, ch) {
      const place = PLACEMENT[name];
      const size = BASE[name].size;
      const [sx, sy, sz] = [size[0] * scale, size[1] * scale, size[2] * scale];
      const cs = corners(place[0], place[1], place[2], sx, sy, sz);
      // Rotate corners once.
      const rc = cs.map(rotatePoint);
      const pc = rc.map((p) => project(p, cw, ch));

      for (const f of FACES) {
        const rect = uvmap[f.key];
        if (!rect) continue;
        const [u0, v0, w, h] = rect;
        // UV corner order aligned with FACE idx order (matches MC unwrap).
        const uv = [
          [u0, v0],
          [u0 + w, v0],
          [u0 + w, v0 + h],
          [u0, v0 + h],
        ];
        const p2 = f.idx.map((i) => pc[i]);
        // Back-face cull using the rotated face normal. In view space the
        // camera looks along +Z (into the screen), so a face is visible when
        // its rotated normal points back toward the camera (z < 0).
        const nWorld = rotatePoint(f.n);
        if (nWorld[2] >= -0.02) continue;
        const depth = (p2[0][2] + p2[1][2] + p2[2][2] + p2[3][2]) / 4;
        quads.push({ pts: p2, uv, shade: faceShade(nWorld), depth });
      }
    }

    function draw() {
      const cw = canvas.width, ch = canvas.height;
      ctx.clearRect(0, 0, cw, ch);
      if (!tex) return;

      const parts = layout === "64x64"
        ? ["head", "body", "rarm", "larm", "rleg", "lleg"]
        : ["head", "body", "rarm", "rleg"]; // legacy: mirror arms/legs

      const quads = [];

      // Legacy 64x32: draw right arm/leg, then mirror to left.
      if (layout === "64x32") {
        collectPart("head", BASE.head.uv, 1, quads, cw, ch);
        collectPart("body", BASE.body.uv, 1, quads, cw, ch);
        collectMirrored("rarm", "larm", BASE.rarm.uv, 1, quads, cw, ch);
        collectMirrored("rleg", "lleg", BASE.rleg.uv, 1, quads, cw, ch);
        // hat overlay exists on 64x32 too
        if (showOverlay) collectPart("head", OVERLAY.head.uv, 1.08, quads, cw, ch);
      } else {
        for (const name of parts) {
          collectPart(name, BASE[name].uv, 1, quads, cw, ch);
        }
        if (showOverlay) {
          for (const name of parts) {
            collectPart(name, OVERLAY[name].uv, 1.08, quads, cw, ch);
          }
        }
      }

      // Painter's algorithm: far first.
      quads.sort((a, b) => b.depth - a.depth);
      for (const q of quads) drawQuad(q.pts, q.uv, q.shade);
    }

    // For legacy layout: draw a part and its mirrored twin from the same UV.
    function collectMirrored(baseName, twinName, uvmap, scale, quads, cw, ch) {
      collectPart(baseName, uvmap, scale, quads, cw, ch);
      // Mirror across X by temporarily swapping placement sign.
      const orig = PLACEMENT[twinName];
      const src = PLACEMENT[baseName];
      PLACEMENT[twinName] = [-src[0], src[1], src[2]];
      collectPart(twinName, uvmap, scale, quads, cw, ch);
      PLACEMENT[twinName] = orig;
    }

    // ---- interaction ----
    function onDown(e) {
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
    }
    function onMove(e) {
      if (!dragging) return;
      rot.y += (e.clientX - lastX) * 0.01;
      rot.x += (e.clientY - lastY) * 0.01;
      rot.x = Math.max(-1.2, Math.min(1.2, rot.x));
      lastX = e.clientX; lastY = e.clientY;
      draw();
    }
    function onUp() { dragging = false; }

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    let autoRotate = true;
    let raf = null;
    function loop() {
      if (autoRotate && !dragging) {
        rot.y += 0.012;
        draw();
      }
      raf = requestAnimationFrame(loop);
    }
    loop();

    return {
      setTexture,
      draw,
      setAutoRotate(v) { autoRotate = v; },
      setShowOverlay(v) { showOverlay = v; draw(); },
      isDragging() { return dragging; },
    };
  }

  window.Preview3D = { create };
})();
