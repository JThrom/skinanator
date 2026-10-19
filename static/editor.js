/*
 * Skinanator editor - pixel canvas for Minecraft Bedrock skins.
 *
 * Model:
 *   - `pixels` : Uint8ClampedArray via an offscreen ImageData at native
 *                texture resolution (64x32 or 64x64). This is the source of
 *                truth and exactly what gets exported.
 *   - `#skin`  : scaled-up visible canvas rendered with nearest-neighbor.
 *   - `#overlay`: guide boxes + labels drawn on top (not exported).
 */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // ---- state --------------------------------------------------------------
  const state = {
    layoutKey: "64x64",
    scale: 12,
    tool: "pencil",
    color: "#8b5a2b",
    mirror: false,
    showGuides: true,
    showLabels: true,
    drawing: false,
  };

  // Offscreen buffer at native resolution.
  let buf = document.createElement("canvas");
  let bctx = buf.getContext("2d", { willReadFrequently: true });

  const skin = $("skin");
  const sctx = skin.getContext("2d");
  const overlay = $("overlay");
  const octx = overlay.getContext("2d");
  const preview = $("preview");
  const preview3d = Preview3D.create(preview);

  function layout() { return LAYOUTS[state.layoutKey]; }

  // ---- buffer setup -------------------------------------------------------
  function resizeBuffer(preserve) {
    const L = layout();
    const old = preserve ? bctx.getImageData(0, 0, buf.width, buf.height) : null;
    buf.width = L.width;
    buf.height = L.height;
    bctx = buf.getContext("2d", { willReadFrequently: true });
    bctx.clearRect(0, 0, L.width, L.height);
    if (old) bctx.putImageData(old, 0, 0);
    layoutCanvases();
    render();
  }

  function layoutCanvases() {
    const L = layout();
    const w = L.width * state.scale;
    const h = L.height * state.scale;
    for (const c of [skin, overlay]) {
      c.width = w;
      c.height = h;
      c.style.width = w + "px";
      c.style.height = h + "px";
    }
    $("stack").style.width = w + "px";
    $("stack").style.height = h + "px";
  }

  // ---- rendering ----------------------------------------------------------
  function render() {
    sctx.imageSmoothingEnabled = false;
    sctx.clearRect(0, 0, skin.width, skin.height);
    sctx.drawImage(buf, 0, 0, buf.width, buf.height, 0, 0, skin.width, skin.height);
    renderOverlay();
    renderPreview();
  }

  function renderOverlay() {
    octx.clearRect(0, 0, overlay.width, overlay.height);
    if (!state.showGuides && !state.showLabels) return;
    const L = layout();
    const s = state.scale;

    for (const part of L.parts) {
      // Bounding box across all faces of the part.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const f of part.faces) {
        const [x, y, w, h] = f.rect;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
        if (state.showGuides) {
          octx.strokeStyle = part.color + (part.overlay ? "77" : "cc");
          octx.lineWidth = 1;
          octx.strokeRect(x * s + 0.5, y * s + 0.5, w * s - 1, h * s - 1);
        }
      }
      if (state.showLabels) {
        octx.fillStyle = part.color;
        octx.font = "600 10px system-ui, sans-serif";
        octx.textBaseline = "top";
        octx.fillText(part.name, minX * s + 2, minY * s + 1);
      }
    }
  }

  // Feed the current texture into the 3D preview renderer.
  function renderPreview() {
    const data = bctx.getImageData(0, 0, buf.width, buf.height);
    preview3d.setTexture(data, buf.width, buf.height, state.layoutKey);
    if (!preview3d.isDragging()) preview3d.draw();
  }

  // ---- pixel ops ----------------------------------------------------------
  function hexToRgba(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }

  function getPx(x, y) {
    return bctx.getImageData(x, y, 1, 1).data;
  }

  function setPx(x, y, rgba) {
    const id = bctx.createImageData(1, 1);
    id.data.set(rgba);
    bctx.putImageData(id, x, y);
  }

  function eventToPixel(e) {
    const r = skin.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / state.scale);
    const y = Math.floor((e.clientY - r.top) / state.scale);
    return { x, y };
  }

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < buf.width && y < buf.height;
  }

  function mirrorX(x) {
    // Mirror across the vertical center of the texture.
    return buf.width - 1 - x;
  }

  function applyTool(x, y) {
    if (!inBounds(x, y)) return;
    switch (state.tool) {
      case "pencil":
        paint(x, y, hexToRgba(state.color));
        break;
      case "eraser":
        paint(x, y, [0, 0, 0, 0]);
        break;
      case "fill":
        floodFill(x, y, hexToRgba(state.color));
        break;
      case "picker": {
        const p = getPx(x, y);
        if (p[3] === 0) return;
        const hex = "#" + [p[0], p[1], p[2]]
          .map((v) => v.toString(16).padStart(2, "0")).join("");
        state.color = hex;
        $("color").value = hex;
        break;
      }
    }
  }

  function paint(x, y, rgba) {
    setPx(x, y, rgba);
    if (state.mirror) {
      const mx = mirrorX(x);
      if (inBounds(mx, y)) setPx(mx, y, rgba);
    }
  }

  // Find the UV face rectangle [x, y, w, h] that contains texel (px, py),
  // so the fill can be clamped to a single face (e.g. sleeve front) and never
  // bleed across the seams into neighbouring faces. Returns null if the pixel
  // isn't inside any mapped face.
  function faceRectAt(px, py) {
    const L = layout();
    for (const part of L.parts) {
      for (const f of part.faces) {
        const [x, y, w, h] = f.rect;
        if (px >= x && px < x + w && py >= y && py < y + h) {
          return [x, y, w, h];
        }
      }
    }
    return null;
  }

  function floodFill(sx, sy, rgba) {
    const img = bctx.getImageData(0, 0, buf.width, buf.height);
    const d = img.data;
    const W = buf.width, H = buf.height;
    const idx = (x, y) => (y * W + x) * 4;
    const start = idx(sx, sy);
    const target = [d[start], d[start + 1], d[start + 2], d[start + 3]];
    const same = (i) =>
      d[i] === target[0] && d[i + 1] === target[1] &&
      d[i + 2] === target[2] && d[i + 3] === target[3];
    if (rgba[0] === target[0] && rgba[1] === target[1] &&
        rgba[2] === target[2] && rgba[3] === target[3]) return;

    // Constrain the fill to the single UV face under the click. If the click
    // is outside any mapped face, fall back to the full-texture bounds.
    const rect = faceRectAt(sx, sy);
    const minX = rect ? rect[0] : 0;
    const minY = rect ? rect[1] : 0;
    const maxX = rect ? rect[0] + rect[2] : W;  // exclusive
    const maxY = rect ? rect[1] + rect[3] : H;  // exclusive

    const stack = [[sx, sy]];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < minX || y < minY || x >= maxX || y >= maxY) continue;
      const i = idx(x, y);
      if (!same(i)) continue;
      d[i] = rgba[0]; d[i + 1] = rgba[1]; d[i + 2] = rgba[2]; d[i + 3] = rgba[3];
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    bctx.putImageData(img, 0, 0);
  }

  // ---- IO -----------------------------------------------------------------
  function dataURL() {
    return buf.toDataURL("image/png");
  }

  function setStatus(msg, kind) {
    const el = $("status");
    el.textContent = msg;
    el.className = "status " + (kind || "");
  }

  // The model (classic/slim) only matters for .mcpack geometry; hide it for PNG.
  function updateExportControls() {
    const fmt = $("exportFormat").value;
    $("modelRow").style.display = fmt === "mcpack" ? "" : "none";
    $("export").textContent =
      fmt === "mcpack" ? "Export & Download .mcpack" : "Export & Download PNG";
  }

  async function exportSkin() {
    try {
      const format = $("exportFormat").value;   // "mcpack" | "png"
      const model = $("exportModel").value;     // "classic" | "slim"
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: dataURL(),
          name: $("name").value,
          format,
          model,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setStatus("Export failed: " + err.error, "err");
        return;
      }
      const blob = await res.blob();
      const saved = res.headers.get("X-Saved-Path");
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="?([^"]+)"?/);
      const fname = m ? m[1] : (format === "png" ? "skin.png" : "skin.mcpack");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fname; a.click();
      URL.revokeObjectURL(url);
      setStatus("Exported " + fname + ". Saved to " + (saved || "skins/"), "ok");
    } catch (e) {
      setStatus("Export error: " + e.message, "err");
    }
  }

  function importSkin(file) {
    const fd = new FormData();
    fd.append("file", file);
    fetch("/api/import", { method: "POST", body: fd })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) { setStatus("Import failed: " + data.error, "err"); return; }
        loadImageDataUrl(data.image, data.width, data.height, () =>
          setStatus("Imported " + data.width + "x" + data.height + " skin.", "ok"));
      })
      .catch((e) => setStatus("Import error: " + e.message, "err"));
  }

  // Load a PNG data URL into the buffer, switching layout to match its size.
  function loadImageDataUrl(dataUrl, width, height, done) {
    const layoutKey = width + "x" + height;
    if (LAYOUTS[layoutKey]) {
      state.layoutKey = layoutKey;
      $("layout").value = layoutKey;
    }
    const img = new Image();
    img.onload = () => {
      resizeBuffer(false);
      bctx.clearRect(0, 0, buf.width, buf.height);
      bctx.drawImage(img, 0, 0);
      render();
      if (done) done();
    };
    img.src = dataUrl;
  }

  // ---- catalog ------------------------------------------------------------
  const catalog = { entries: [], filter: "all" };

  function loadCatalog() {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) { setStatus("Catalog load failed.", "err"); return; }
        catalog.entries = data.entries;
        renderCatalog();
      })
      .catch((e) => setStatus("Catalog error: " + e.message, "err"));
  }

  function renderCatalog() {
    const grid = $("catalogGrid");
    grid.innerHTML = "";
    const items = catalog.entries.filter(
      (e) => catalog.filter === "all" || e.source === catalog.filter
    );

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "catalog-empty";
      empty.textContent =
        catalog.filter === "custom"
          ? "No saved skins yet. Design one and click \"Save to Catalog\"."
          : "No skins in this view.";
      grid.appendChild(empty);
      return;
    }

    for (const entry of items) {
      grid.appendChild(makeCard(entry));
    }
  }

  function makeCard(entry) {
    const card = document.createElement("div");
    card.className = "card";

    const thumbWrap = document.createElement("div");
    thumbWrap.className = "thumb-wrap";
    thumbWrap.title = "Load into editor";
    const img = document.createElement("img");
    img.className = "thumb";
    img.src = entry.thumb;
    img.alt = entry.name;
    thumbWrap.appendChild(img);
    thumbWrap.addEventListener("click", () => loadFromCatalog(entry));
    card.appendChild(thumbWrap);

    const name = document.createElement("div");
    name.className = "card-name";
    name.textContent = entry.name;
    name.title = entry.name;
    card.appendChild(name);

    const desc = document.createElement("div");
    desc.className = "card-desc";
    desc.textContent = entry.description || "";
    card.appendChild(desc);

    const meta = document.createElement("div");
    meta.className = "card-meta";
    const badge = document.createElement("span");
    badge.className = "badge " + entry.source;
    badge.textContent = entry.source === "preset" ? "Example" : "My Skin";
    meta.appendChild(badge);
    const layout = document.createElement("span");
    layout.textContent = entry.layout;
    meta.appendChild(layout);
    card.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const loadBtn = document.createElement("button");
    loadBtn.textContent = "Load";
    loadBtn.addEventListener("click", () => loadFromCatalog(entry));
    actions.appendChild(loadBtn);
    if (entry.source === "custom") {
      const delBtn = document.createElement("button");
      delBtn.className = "del";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => deleteFromCatalog(entry));
      actions.appendChild(delBtn);
    }
    card.appendChild(actions);

    return card;
  }

  function loadFromCatalog(entry) {
    fetch(`/api/catalog/${entry.source}/${entry.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) { setStatus("Load failed: " + data.error, "err"); return; }
        // Set the name synchronously (before the async image decode) so it can
        // never clobber a name the user types after loading.
        $("name").value = entry.name;
        loadImageDataUrl(data.image, data.width, data.height, () => {
          setStatus('Loaded "' + entry.name + '" into editor.', "ok");
        });
      })
      .catch((e) => setStatus("Load error: " + e.message, "err"));
  }

  function saveToCatalog() {
    // Always confirm the name at save time so what you enter is exactly what
    // gets saved (defaulting to the current name field).
    const current = ($("name").value || "").trim();
    const name = (window.prompt("Name for this skin:", current) || "").trim();
    if (!name) return; // cancelled or empty
    $("name").value = name; // reflect the confirmed name back into the field
    const description =
      (window.prompt('Optional description for "' + name + '":', "") || "").trim();
    fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataURL(), name, description }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) { setStatus("Save failed: " + data.error, "err"); return; }
        catalog.filter = "custom";
        document.querySelectorAll(".filter").forEach((b) =>
          b.classList.toggle("active", b.dataset.filter === "custom"));
        loadCatalog();
        setStatus('Saved "' + data.entry.name + '" to catalog.', "ok");
      })
      .catch((e) => setStatus("Save error: " + e.message, "err"));
  }

  function deleteFromCatalog(entry) {
    if (!window.confirm('Delete "' + entry.name + '" from your catalog?')) return;
    fetch(`/api/catalog/custom/${entry.id}`, { method: "DELETE" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) { setStatus("Delete failed: " + data.error, "err"); return; }
        loadCatalog();
        setStatus('Deleted "' + entry.name + '".', "ok");
      })
      .catch((e) => setStatus("Delete error: " + e.message, "err"));
  }

  // ---- swatches -----------------------------------------------------------
  const PALETTE = [
    "#000000", "#ffffff", "#8b5a2b", "#c68642", "#e0ac69", "#f1c27d",
    "#3b2f2f", "#5c3a21", "#2b2b2b", "#7f8c8d", "#c0392b", "#e74c3c",
    "#e67e22", "#f1c40f", "#27ae60", "#2ecc71", "#2980b9", "#3498db",
    "#8e44ad", "#9b59b6", "#16a085", "#1abc9c", "#d35400", "#ecf0f1",
  ];
  function buildSwatches() {
    const box = $("swatches");
    box.innerHTML = "";
    for (const c of PALETTE) {
      const sw = document.createElement("div");
      sw.className = "sw";
      sw.style.background = c;
      sw.title = c;
      sw.addEventListener("click", () => {
        state.color = c;
        $("color").value = c;
      });
      box.appendChild(sw);
    }
  }

  function fillBase() {
    // Fill only the non-overlay parts' regions with current color.
    const L = layout();
    const rgba = hexToRgba(state.color);
    const img = bctx.getImageData(0, 0, buf.width, buf.height);
    const d = img.data;
    for (const part of L.parts) {
      if (part.overlay) continue;
      for (const f of part.faces) {
        const [x0, y0, w, h] = f.rect;
        for (let y = y0; y < y0 + h; y++) {
          for (let x = x0; x < x0 + w; x++) {
            const i = (y * buf.width + x) * 4;
            d[i] = rgba[0]; d[i + 1] = rgba[1]; d[i + 2] = rgba[2]; d[i + 3] = 255;
          }
        }
      }
    }
    bctx.putImageData(img, 0, 0);
    render();
  }

  // ---- events -------------------------------------------------------------
  function bind() {
    $("layout").addEventListener("change", (e) => {
      state.layoutKey = e.target.value;
      resizeBuffer(false);
      bctx.clearRect(0, 0, buf.width, buf.height);
      render();
    });

    document.querySelectorAll(".tool").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tool").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.tool = btn.dataset.tool;
      });
    });

    $("color").addEventListener("input", (e) => (state.color = e.target.value));
    $("mirror").addEventListener("change", (e) => (state.mirror = e.target.checked));
    $("guides").addEventListener("change", (e) => { state.showGuides = e.target.checked; renderOverlay(); });
    $("labels").addEventListener("change", (e) => { state.showLabels = e.target.checked; renderOverlay(); });
    $("autoRotate").addEventListener("change", (e) => preview3d.setAutoRotate(e.target.checked));
    $("showOverlay3d").addEventListener("change", (e) => preview3d.setShowOverlay(e.target.checked));
    $("zoom").addEventListener("input", (e) => {
      state.scale = parseInt(e.target.value, 10);
      layoutCanvases();
      render();
    });

    $("clear").addEventListener("click", () => {
      bctx.clearRect(0, 0, buf.width, buf.height);
      render();
    });
    $("fillBase").addEventListener("click", fillBase);
    $("export").addEventListener("click", exportSkin);
    $("exportFormat").addEventListener("change", updateExportControls);
    $("saveCatalog").addEventListener("click", saveToCatalog);
    $("import").addEventListener("change", (e) => {
      if (e.target.files[0]) importSkin(e.target.files[0]);
      e.target.value = "";
    });

    // Catalog filters + refresh.
    document.querySelectorAll(".filter").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".filter").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        catalog.filter = btn.dataset.filter;
        renderCatalog();
      });
    });
    $("refreshCatalog").addEventListener("click", loadCatalog);

    // Canvas painting.
    const start = (e) => { state.drawing = true; const { x, y } = eventToPixel(e); applyTool(x, y); render(); };
    const move = (e) => {
      const { x, y } = eventToPixel(e);
      $("hover").textContent = inBounds(x, y) ? `x:${x} y:${y}` : " ";
      if (state.drawing && (state.tool === "pencil" || state.tool === "eraser")) {
        applyTool(x, y); render();
      }
    };
    const end = () => { state.drawing = false; };

    skin.addEventListener("mousedown", start);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    skin.addEventListener("contextmenu", (e) => e.preventDefault());

    // Keyboard shortcuts.
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT") return;
      const map = { b: "pencil", e: "eraser", g: "fill", i: "picker" };
      const t = map[e.key.toLowerCase()];
      if (t) {
        state.tool = t;
        document.querySelectorAll(".tool").forEach((btn) =>
          btn.classList.toggle("active", btn.dataset.tool === t));
      }
    });
  }

  // ---- init ---------------------------------------------------------------
  buildSwatches();
  bind();
  updateExportControls();
  resizeBuffer(false);
  loadCatalog();
  setStatus("Ready. Paint a skin, load an example, or import a PNG.", "");
})();
