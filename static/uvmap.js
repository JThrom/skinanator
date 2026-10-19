/*
 * UV region maps for Minecraft Bedrock skin layouts.
 *
 * Each region is [x, y, w, h] in texture pixels. These describe where each
 * cube face lives on the flattened skin texture. We group them into "parts"
 * so the editor can draw guide boxes + labels.
 *
 * Coordinates follow the standard Minecraft skin UV layout used by both
 * Java and Bedrock (Bedrock's default humanoid geometry uses this same map).
 */

// --- 64x64 (modern) --------------------------------------------------------
// Includes second/overlay layer and separate left arm/leg regions.
const LAYOUT_64x64 = {
  width: 64,
  height: 64,
  parts: [
    // Head (base)
    { name: "Head", color: "#ff6b6b", faces: [
      { face: "top",    rect: [8, 0, 8, 8] },
      { face: "bottom", rect: [16, 0, 8, 8] },
      { face: "right",  rect: [0, 8, 8, 8] },
      { face: "front",  rect: [8, 8, 8, 8] },
      { face: "left",   rect: [16, 8, 8, 8] },
      { face: "back",   rect: [24, 8, 8, 8] },
    ]},
    // Hat / head overlay
    { name: "Hat", color: "#ffa94d", overlay: true, faces: [
      { face: "top",    rect: [40, 0, 8, 8] },
      { face: "bottom", rect: [48, 0, 8, 8] },
      { face: "right",  rect: [32, 8, 8, 8] },
      { face: "front",  rect: [40, 8, 8, 8] },
      { face: "left",   rect: [48, 8, 8, 8] },
      { face: "back",   rect: [56, 8, 8, 8] },
    ]},
    // Body (base)
    { name: "Body", color: "#4dabf7", faces: [
      { face: "top",    rect: [20, 16, 8, 4] },
      { face: "bottom", rect: [28, 16, 8, 4] },
      { face: "right",  rect: [16, 20, 4, 12] },
      { face: "front",  rect: [20, 20, 8, 12] },
      { face: "left",   rect: [28, 20, 4, 12] },
      { face: "back",   rect: [32, 20, 8, 12] },
    ]},
    // Jacket / body overlay
    { name: "Jacket", color: "#74c0fc", overlay: true, faces: [
      { face: "top",    rect: [20, 32, 8, 4] },
      { face: "bottom", rect: [28, 32, 8, 4] },
      { face: "right",  rect: [16, 36, 4, 12] },
      { face: "front",  rect: [20, 36, 8, 12] },
      { face: "left",   rect: [28, 36, 4, 12] },
      { face: "back",   rect: [32, 36, 8, 12] },
    ]},
    // Right arm (base)
    { name: "Right Arm", color: "#38d9a9", faces: [
      { face: "top",    rect: [44, 16, 4, 4] },
      { face: "bottom", rect: [48, 16, 4, 4] },
      { face: "right",  rect: [40, 20, 4, 12] },
      { face: "front",  rect: [44, 20, 4, 12] },
      { face: "left",   rect: [48, 20, 4, 12] },
      { face: "back",   rect: [52, 20, 4, 12] },
    ]},
    // Right sleeve (overlay)
    { name: "Right Sleeve", color: "#63e6be", overlay: true, faces: [
      { face: "top",    rect: [44, 32, 4, 4] },
      { face: "bottom", rect: [48, 32, 4, 4] },
      { face: "right",  rect: [40, 36, 4, 12] },
      { face: "front",  rect: [44, 36, 4, 12] },
      { face: "left",   rect: [48, 36, 4, 12] },
      { face: "back",   rect: [52, 36, 4, 12] },
    ]},
    // Left arm (base)
    { name: "Left Arm", color: "#da77f2", faces: [
      { face: "top",    rect: [36, 48, 4, 4] },
      { face: "bottom", rect: [40, 48, 4, 4] },
      { face: "right",  rect: [32, 52, 4, 12] },
      { face: "front",  rect: [36, 52, 4, 12] },
      { face: "left",   rect: [40, 52, 4, 12] },
      { face: "back",   rect: [44, 52, 4, 12] },
    ]},
    // Left sleeve (overlay)
    { name: "Left Sleeve", color: "#eebefa", overlay: true, faces: [
      { face: "top",    rect: [52, 48, 4, 4] },
      { face: "bottom", rect: [56, 48, 4, 4] },
      { face: "right",  rect: [48, 52, 4, 12] },
      { face: "front",  rect: [52, 52, 4, 12] },
      { face: "left",   rect: [56, 52, 4, 12] },
      { face: "back",   rect: [60, 52, 4, 12] },
    ]},
    // Right leg (base)
    { name: "Right Leg", color: "#ffd43b", faces: [
      { face: "top",    rect: [4, 16, 4, 4] },
      { face: "bottom", rect: [8, 16, 4, 4] },
      { face: "right",  rect: [0, 20, 4, 12] },
      { face: "front",  rect: [4, 20, 4, 12] },
      { face: "left",   rect: [8, 20, 4, 12] },
      { face: "back",   rect: [12, 20, 4, 12] },
    ]},
    // Right pant (overlay)
    { name: "Right Pant", color: "#ffe066", overlay: true, faces: [
      { face: "top",    rect: [4, 32, 4, 4] },
      { face: "bottom", rect: [8, 32, 4, 4] },
      { face: "right",  rect: [0, 36, 4, 12] },
      { face: "front",  rect: [4, 36, 4, 12] },
      { face: "left",   rect: [8, 36, 4, 12] },
      { face: "back",   rect: [12, 36, 4, 12] },
    ]},
    // Left leg (base)
    { name: "Left Leg", color: "#ff922b", faces: [
      { face: "top",    rect: [20, 48, 4, 4] },
      { face: "bottom", rect: [24, 48, 4, 4] },
      { face: "right",  rect: [16, 52, 4, 12] },
      { face: "front",  rect: [20, 52, 4, 12] },
      { face: "left",   rect: [24, 52, 4, 12] },
      { face: "back",   rect: [28, 52, 4, 12] },
    ]},
    // Left pant (overlay)
    { name: "Left Pant", color: "#ffc078", overlay: true, faces: [
      { face: "top",    rect: [4, 48, 4, 4] },
      { face: "bottom", rect: [8, 48, 4, 4] },
      { face: "right",  rect: [0, 52, 4, 12] },
      { face: "front",  rect: [4, 52, 4, 12] },
      { face: "left",   rect: [8, 52, 4, 12] },
      { face: "back",   rect: [12, 52, 4, 12] },
    ]},
  ],
};

// --- 64x32 (legacy) --------------------------------------------------------
// Single layer only. Left limbs are mirrored from the right at render time,
// so only the head, body, right arm and right leg exist on the texture,
// plus the hat overlay on the head.
const LAYOUT_64x32 = {
  width: 64,
  height: 32,
  parts: [
    { name: "Head", color: "#ff6b6b", faces: [
      { face: "top",    rect: [8, 0, 8, 8] },
      { face: "bottom", rect: [16, 0, 8, 8] },
      { face: "right",  rect: [0, 8, 8, 8] },
      { face: "front",  rect: [8, 8, 8, 8] },
      { face: "left",   rect: [16, 8, 8, 8] },
      { face: "back",   rect: [24, 8, 8, 8] },
    ]},
    { name: "Hat", color: "#ffa94d", overlay: true, faces: [
      { face: "top",    rect: [40, 0, 8, 8] },
      { face: "bottom", rect: [48, 0, 8, 8] },
      { face: "right",  rect: [32, 8, 8, 8] },
      { face: "front",  rect: [40, 8, 8, 8] },
      { face: "left",   rect: [48, 8, 8, 8] },
      { face: "back",   rect: [56, 8, 8, 8] },
    ]},
    { name: "Body", color: "#4dabf7", faces: [
      { face: "top",    rect: [20, 16, 8, 4] },
      { face: "bottom", rect: [28, 16, 8, 4] },
      { face: "right",  rect: [16, 20, 4, 12] },
      { face: "front",  rect: [20, 20, 8, 12] },
      { face: "left",   rect: [28, 20, 4, 12] },
      { face: "back",   rect: [32, 20, 8, 12] },
    ]},
    { name: "Arm", color: "#38d9a9", faces: [
      { face: "top",    rect: [44, 16, 4, 4] },
      { face: "bottom", rect: [48, 16, 4, 4] },
      { face: "right",  rect: [40, 20, 4, 12] },
      { face: "front",  rect: [44, 20, 4, 12] },
      { face: "left",   rect: [48, 20, 4, 12] },
      { face: "back",   rect: [52, 20, 4, 12] },
    ]},
    { name: "Leg", color: "#ffd43b", faces: [
      { face: "top",    rect: [4, 16, 4, 4] },
      { face: "bottom", rect: [8, 16, 4, 4] },
      { face: "right",  rect: [0, 20, 4, 12] },
      { face: "front",  rect: [4, 20, 4, 12] },
      { face: "left",   rect: [8, 20, 4, 12] },
      { face: "back",   rect: [12, 20, 4, 12] },
    ]},
  ],
};

const LAYOUTS = {
  "64x64": LAYOUT_64x64,
  "64x32": LAYOUT_64x32,
};
