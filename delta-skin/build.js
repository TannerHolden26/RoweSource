// Builds "Pikachu Edition GBC.deltaskin", a Game Boy Color controller skin for the
// Delta emulator, styled after the clear-orange Pikachu / Gold & Silver edition GBC.
//
// The artwork is drawn as SVG and rasterized with Playwright's Chromium, and the
// button frames in info.json come from the same layout numbers, so they always match.
//
// Usage: node delta-skin/build.js   (needs `playwright` and the `zip` command)

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SKIN_NAME = "Pikachu Edition GBC";
const OUT_DIR = path.join(__dirname, "build");
const SKIN_FILE = path.join(__dirname, `${SKIN_NAME}.deltaskin`);

// Delta's two iPhone families: "standard" (home-button phones) and "edgeToEdge" (Face ID phones).
const VARIANTS = [
  { device: "standard", orientation: "portrait", W: 375, H: 667 },
  { device: "standard", orientation: "landscape", W: 667, H: 375 },
  { device: "edgeToEdge", orientation: "portrait", W: 414, H: 896 },
  { device: "edgeToEdge", orientation: "landscape", W: 896, H: 414 },
];

// ---------- Palette ----------
const C = {
  shellTop: "#ffb347",
  shellMid: "#fb9a2c",
  shellBot: "#f2831b",
  shellDeep: "#c95f06",
  bezel: "#3c404c",
  bezelEdge: "#2b2e37",
  logoGrey: "#a4abbb",
  dpad: "#3ec3db",
  dpadDark: "#2496ad",
  aBtn: "#3150d6",
  aBtnDark: "#20339a",
  bBtn: "#232326",
  pill: "#2a2a2e",
};

// ---------- Layout ----------
function layout(W, H, device, orientation) {
  const e2e = device === "edgeToEdge";
  const g = { W, H, landscape: orientation === "landscape" };

  if (!g.landscape) {
    const u = W / 414;
    const topSafe = e2e ? 44 : 10;
    const botSafe = e2e ? 30 : 0;
    g.u = u;

    const sw = Math.round(W * 0.65);
    g.screen = { w: sw, h: Math.round(sw * 0.9) };
    g.bezel = { x: W * 0.05, w: W * 0.9, y: topSafe + 18 * u };
    g.screen.x = Math.round(g.bezel.x + (g.bezel.w - sw) / 2 - 14 * u);
    g.screen.y = Math.round(g.bezel.y + 30 * u);
    g.bezel.h = g.screen.y + g.screen.h + 78 * u - g.bezel.y;

    const r0 = g.bezel.y + g.bezel.h;
    const rh = H - botSafe - r0;
    g.nintendo = { cx: W / 2, cy: r0 + Math.max(0.11 * rh, 30 * u), w: 104 * u };
    g.dpad = { cx: W * 0.24, cy: r0 + 0.4 * rh, size: 132 * u };
    g.a = { cx: W * 0.835, cy: g.dpad.cy - 22 * u, r: 30 * u };
    g.b = { cx: W * 0.655, cy: g.dpad.cy + 10 * u, r: 28 * u };
    g.pikaWave = { cx: W * 0.47, cy: g.dpad.cy + 36 * u, size: 84 * u };
    g.pill = { w: 40 * u, h: 13 * u };
    g.select = { cx: W * 0.4, cy: r0 + 0.7 * rh };
    g.start = { cx: W * 0.555, cy: r0 + 0.7 * rh };
    g.grille = { cx: W * 0.83, cy: r0 + 0.8 * rh, r: 56 * u };
    g.pcb = { x: W * 0.06, y: r0 + 0.68 * rh, w: W * 0.25, h: 0.24 * rh };
    g.menu = { cx: W * 0.5, cy: r0 + 0.9 * rh, r: 14 * u };
    g.comm = { x: g.bezel.x + 30 * u, y: g.bezel.y - 6 * u };
  } else {
    const u = H / 414;
    const sideSafe = e2e ? 44 : 0;
    g.u = u;

    const sh = Math.round(H * 0.7);
    g.screen = { h: sh, w: Math.round(sh / 0.9) };
    g.screen.x = Math.round((W - g.screen.w) / 2 - 10 * u);
    g.screen.y = Math.round(H * 0.08);
    g.bezel = { x: g.screen.x - 44 * u, y: H * 0.03, w: g.screen.w + 114 * u };
    g.bezel.h = H * 0.95 - g.bezel.y;

    const leftW = g.bezel.x - sideSafe;
    const rightX = g.bezel.x + g.bezel.w;
    const rightW = W - sideSafe - rightX;
    const dsize = Math.min(132 * u, leftW * 0.8);
    g.dpad = { cx: sideSafe + leftW / 2, cy: H * 0.55, size: dsize };
    g.pikaWave = { cx: g.dpad.cx, cy: H * 0.17, size: Math.min(70 * u, H * 0.26) };
    g.nintendo = { cx: g.dpad.cx, cy: H * 0.9, w: Math.min(96 * u, leftW * 0.8) };
    const br = Math.min(28 * u, rightW * 0.19);
    g.b = { cx: rightX + 0.3 * rightW, cy: H * 0.53, r: br };
    g.a = { cx: rightX + 0.72 * rightW, cy: H * 0.43, r: br * 1.06 };
    g.pill = { w: Math.min(40 * u, rightW * 0.27), h: 13 * u };
    g.select = { cx: rightX + 0.3 * rightW, cy: H * 0.8 };
    g.start = { cx: rightX + 0.66 * rightW, cy: H * 0.8 };
    g.grille = { cx: W - 4 * u, cy: H + 8 * u, r: 62 * u };
    g.menu = { cx: rightX + 0.5 * rightW, cy: H * 0.13, r: 14 * u };
  }
  return g;
}

// ---------- Artwork: stickers cut from photos of the real console (see extract_art.py) ----------
function loadArt(name) {
  const file = path.join(__dirname, "art", name);
  const buf = fs.readFileSync(file);
  // PNG width/height live at bytes 16-23 of the IHDR chunk.
  return { href: `data:image/png;base64,${buf.toString("base64")}`, w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
const ART = {
  wave: loadArt("pikachu-wave.png"),
  run: loadArt("pikachu-run.png"),
  starters: loadArt("starters.png"),
};
const image = (art, x, y, h) =>
  `<image href="${art.href}" x="${x}" y="${y}" width="${(h * art.w) / art.h}" height="${h}" preserveAspectRatio="none"/>`;

// ---------- SVG builders ----------
function emboss(x, y, text, size, anchor = "middle", extra = "") {
  return `
    <text x="${x}" y="${y + size * 0.06}" font-size="${size}" text-anchor="${anchor}" fill="rgba(140,60,0,.35)" ${extra}>${text}</text>
    <text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="rgba(255,236,200,.55)" ${extra}>${text}</text>`;
}

function well(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#well)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(150,70,0,.35)" stroke-width="${r * 0.05}"/>`;
}

function dpad(g) {
  const { cx, cy, size } = g.dpad;
  const arm = size * 0.33, half = size / 2, rr = size * 0.06;
  const x0 = cx - half, y0 = cy - half;
  const cross = `M${cx - arm / 2 + rr} ${y0} H${cx + arm / 2 - rr} Q${cx + arm / 2} ${y0} ${cx + arm / 2} ${y0 + rr}
    V${cy - arm / 2} H${x0 + size - rr} Q${x0 + size} ${cy - arm / 2} ${x0 + size} ${cy - arm / 2 + rr}
    V${cy + arm / 2 - rr} Q${x0 + size} ${cy + arm / 2} ${x0 + size - rr} ${cy + arm / 2}
    H${cx + arm / 2} V${y0 + size - rr} Q${cx + arm / 2} ${y0 + size} ${cx + arm / 2 - rr} ${y0 + size}
    H${cx - arm / 2 + rr} Q${cx - arm / 2} ${y0 + size} ${cx - arm / 2} ${y0 + size - rr}
    V${cy + arm / 2} H${x0 + rr} Q${x0} ${cy + arm / 2} ${x0} ${cy + arm / 2 - rr}
    V${cy - arm / 2 + rr} Q${x0} ${cy - arm / 2} ${x0 + rr} ${cy - arm / 2}
    H${cx - arm / 2} V${y0 + rr} Q${cx - arm / 2} ${y0} ${cx - arm / 2 + rr} ${y0} Z`;
  const t = arm * 0.22;
  const tri = (dx, dy) => {
    const px = cx + dx * half * 0.68, py = cy + dy * half * 0.68;
    const nx = -dy, ny = dx;
    return `M${px + dx * t} ${py + dy * t} L${px - dx * t + nx * t} ${py - dy * t + ny * t} L${px - dx * t - nx * t} ${py - dy * t - ny * t} Z`;
  };
  return `
    ${well(cx, cy, size * 0.6)}
    <path d="${cross}" fill="${C.dpadDark}" transform="translate(0 ${size * 0.03})"/>
    <path d="${cross}" fill="url(#dpadFill)" stroke="${C.dpadDark}" stroke-width="${size * 0.012}"/>
    <path d="${tri(0, -1)} ${tri(0, 1)} ${tri(-1, 0)} ${tri(1, 0)}" fill="rgba(20,110,130,.45)"/>
    <circle cx="${cx}" cy="${cy}" r="${arm * 0.3}" fill="rgba(20,110,130,.25)"/>`;
}

function roundButton(b, fill, dark, label) {
  const { cx, cy, r } = b;
  return `
    ${well(cx, cy, r * 1.32)}
    <circle cx="${cx}" cy="${cy + r * 0.1}" r="${r}" fill="${dark}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>
    <ellipse cx="${cx - r * 0.2}" cy="${cy - r * 0.38}" rx="${r * 0.55}" ry="${r * 0.32}" fill="rgba(255,255,255,.18)"/>
    <text x="${cx}" y="${cy + r * 0.36}" font-size="${r * 1.05}" text-anchor="middle" fill="rgba(0,0,0,.35)" font-weight="500"
      transform="rotate(-12 ${cx} ${cy})">${label}</text>`;
}

function pill(p, g) {
  const { w, h } = g.pill;
  return `<g transform="rotate(-14 ${p.cx} ${p.cy})">
    <rect x="${p.cx - w * 0.72}" y="${p.cy - h * 1.15}" width="${w * 1.44}" height="${h * 2.3}" rx="${h * 1.15}" fill="url(#well)"/>
    <rect x="${p.cx - w / 2}" y="${p.cy - h / 2 + h * 0.15}" width="${w}" height="${h}" rx="${h / 2}" fill="#111"/>
    <rect x="${p.cx - w / 2}" y="${p.cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${C.pill}"/>
    <rect x="${p.cx - w * 0.38}" y="${p.cy - h * 0.34}" width="${w * 0.76}" height="${h * 0.22}" rx="${h * 0.11}" fill="rgba(255,255,255,.12)"/>
  </g>`;
}

function grille(gr, u) {
  const { cx, cy, r } = gr;
  let holes = "";
  const step = 10.5 * u;
  for (let y = -r; y <= r; y += step) {
    for (let x = -r; x <= r; x += step) {
      const ox = (Math.round((y + r) / step) % 2) * step / 2;
      const hx = x + ox;
      if (hx * hx + y * y < (r * 0.86) ** 2) {
        holes += `<circle cx="${cx + hx}" cy="${cy + y}" r="${2.6 * u}" fill="#7a3400"/>`;
      }
    }
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(200,100,10,.35)"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.95}" fill="none" stroke="rgba(255,220,170,.35)" stroke-width="${2 * u}"/>
    ${holes}`;
}

function pcb(p, u) {
  if (!p) return "";
  let traces = "";
  for (let i = 0; i < 7; i++) {
    const y = p.y + p.h * (0.12 + i * 0.12);
    traces += `<path d="M${p.x + p.w * 0.05} ${y} H${p.x + p.w * (0.4 + (i % 3) * 0.15)} l${6 * u} ${6 * u} H${p.x + p.w * 0.95}" fill="none" stroke="rgba(150,70,0,.35)" stroke-width="${1.2 * u}"/>`;
  }
  return `<g>
    <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${8 * u}" fill="rgba(150,70,0,.22)"/>
    ${traces}
    <rect x="${p.x + p.w * 0.12}" y="${p.y + p.h * 0.22}" width="${p.w * 0.32}" height="${p.h * 0.26}" rx="${2 * u}" fill="rgba(90,40,0,.35)"/>
    <rect x="${p.x + p.w * 0.55}" y="${p.y + p.h * 0.55}" width="${p.w * 0.3}" height="${p.h * 0.2}" rx="${2 * u}" fill="rgba(90,40,0,.3)"/>
    <circle cx="${p.x + p.w * 0.75}" cy="${p.y + p.h * 0.25}" r="${5 * u}" fill="rgba(90,40,0,.3)"/>
  </g>`;
}

function insides(g) {
  // Screw posts and ribs that show through the clear shell.
  const u = g.u, { W, H } = g;
  const posts = g.landscape
    ? [[0.06, 0.12], [0.94, 0.12], [0.06, 0.7], [0.97, 0.62]]
    : [[0.1, 0.64], [0.9, 0.64], [0.12, 0.95], [0.6, 0.93]];
  let out = posts.map(([x, y]) => `<circle cx="${x * W}" cy="${y * H}" r="${9 * u}" fill="none" stroke="rgba(170,80,0,.28)" stroke-width="${3 * u}"/>
      <circle cx="${x * W}" cy="${y * H}" r="${3 * u}" fill="rgba(170,80,0,.3)"/>`).join("");
  const ribY = g.landscape ? [0.3, 0.7] : [0.6, 0.86];
  out += ribY.map((y) => `<rect x="${W * 0.02}" y="${y * H}" width="${W * 0.96}" height="${2.5 * u}" fill="rgba(170,80,0,.12)"/>`).join("");
  return out;
}

function bezel(g) {
  const { x, y, w, h } = g.bezel, u = g.u, s = g.screen;
  const r = 14 * u, rb = 46 * u;
  // Rounded rectangle with a bigger bottom-right corner, like the real GBC.
  const bez = `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - rb}
    Q${x + w} ${y + h} ${x + w - rb} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;

  const logoSize = (g.landscape ? 22 : 26) * u;
  const logoY = s.y + s.h + (g.landscape ? 0.62 : 0.6) * (y + h - s.y - s.h) + logoSize * 0.32;
  const colors = ["#f0457d", "#7d55d6", "#3fae4c", "#f4c315", "#2d8fe0"];
  const color = "COLOR".split("").map((ch, i) => `<tspan fill="${colors[i]}">${ch}</tspan>`).join("");

  const ledX = x + (s.x - x) / 2, ledY = s.y + s.h * 0.34;
  // Running Pikachu fills the bottom-left corner below the screen; the bezel edge cuts it off.
  const runH = Math.min(0.19 * w, y + h - (s.y + s.h) - 4 * u);
  // The starters stand in the strip between the screen and the bezel's right edge.
  const stripW = x + w - (s.x + s.w) - 3 * u;
  // Center the logo in the space between the running Pikachu and the screen's right edge.
  const runRight = x - 2 * u + (runH * ART.run.w) / ART.run.h;
  const logoX = Math.max(s.x + s.w / 2, (runRight + s.x + s.w) / 2);
  const stH = Math.min(0.82 * h, stripW / (ART.starters.w / ART.starters.h));
  const stW = stH * ART.starters.w / ART.starters.h;

  return `
    <path d="${bez}" fill="${C.bezelEdge}" transform="translate(0 ${2 * u})"/>
    <path d="${bez}" fill="url(#bezelFill)"/>
    <clipPath id="bezClip"><path d="${bez}"/></clipPath>
    <g clip-path="url(#bezClip)">
      ${image(ART.run, x - 2 * u, y + h + 1 * u - runH, runH)}
      ${image(ART.starters, x + w + 1 * u - stW, y + h + 1 * u - stH, stH)}
    </g>
    <rect x="${s.x - 3 * u}" y="${s.y - 3 * u}" width="${s.w + 6 * u}" height="${s.h + 6 * u}" rx="${3 * u}" fill="#23262e"/>
    <circle cx="${ledX - 9 * u}" cy="${ledY}" r="${4 * u}" fill="#ff3b30"/>
    <circle cx="${ledX - 10 * u}" cy="${ledY - 1.2 * u}" r="${1.4 * u}" fill="#ffb3ad"/>
    ${[0, 1, 2].map((i) => `<path d="M${ledX - 2 * u + i * 5 * u} ${ledY - 4.5 * u} q${3 * u} ${4.5 * u} 0 ${9 * u}" fill="none" stroke="#c9cdd8" stroke-width="${1.6 * u}" stroke-linecap="round"/>`).join("")}
    <text x="${ledX}" y="${ledY + 18 * u}" font-size="${8.5 * u}" text-anchor="middle" fill="#c9cdd8" font-weight="500" letter-spacing="${0.3 * u}">POWER</text>
    <g transform="translate(${logoX} ${logoY}) skewX(-12)">
      <text x="0" y="0" font-size="${logoSize}" text-anchor="middle" font-weight="800" letter-spacing="${-0.6 * u}" fill="${C.logoGrey}"
        font-family="Inter Display, Inter">GAME BOY <tspan font-family="Inter" font-weight="900">${color}</tspan></text>
    </g>`;
}

function buildSVG(g) {
  const { W, H, u } = g;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, sans-serif">
  <defs>
    <linearGradient id="shell" x1="0" y1="0" x2="${g.landscape ? 1 : 0.3}" y2="1">
      <stop offset="0" stop-color="${C.shellTop}"/><stop offset=".55" stop-color="${C.shellMid}"/><stop offset="1" stop-color="${C.shellBot}"/>
    </linearGradient>
    <radialGradient id="glow" cx=".3" cy=".2" r=".9">
      <stop offset="0" stop-color="#fff3d6" stop-opacity=".45"/><stop offset=".5" stop-color="#fff3d6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="well" cx=".5" cy=".42" r=".6">
      <stop offset="0" stop-color="${C.shellDeep}" stop-opacity=".35"/><stop offset=".8" stop-color="${C.shellDeep}" stop-opacity=".22"/>
      <stop offset="1" stop-color="#fff0d0" stop-opacity=".25"/>
    </radialGradient>
    <linearGradient id="bezelFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#454a57"/><stop offset="1" stop-color="${C.bezel}"/>
    </linearGradient>
    <linearGradient id="dpadFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6fd7ea"/><stop offset="1" stop-color="${C.dpad}"/>
    </linearGradient>
  </defs>
  <!-- Delta draws the skin over the game, so the screen area must be see-through. -->
  <mask id="screenHole" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#fff"/>
    <rect x="${g.screen.x}" y="${g.screen.y}" width="${g.screen.w}" height="${g.screen.h}" fill="#000"/>
  </mask>
  <g mask="url(#screenHole)">
  <rect width="${W}" height="${H}" fill="url(#shell)"/>
  ${insides(g)}
  ${pcb(g.pcb, u)}
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${g.comm ? emboss(g.comm.x, g.comm.y, "COMM.", 11 * u, "start", 'font-weight="600" letter-spacing="1"') : ""}
  ${bezel(g)}
  <ellipse cx="${g.nintendo.cx}" cy="${g.nintendo.cy}" rx="${g.nintendo.w / 2}" ry="${g.nintendo.w * 0.16}" fill="none" stroke="rgba(255,236,200,.5)" stroke-width="${2 * u}"/>
  ${emboss(g.nintendo.cx, g.nintendo.cy + g.nintendo.w * 0.07, "Nintendo", g.nintendo.w * 0.2, "middle", 'font-weight="800" letter-spacing="0.5"')}
  ${grille(g.grille, u)}
  ${dpad(g)}
  ${roundButton(g.b, C.bBtn, "#000", "B")}
  ${roundButton(g.a, C.aBtn, C.aBtnDark, "A")}
  ${image(ART.wave, g.pikaWave.cx - (g.pikaWave.size * ART.wave.w) / ART.wave.h / 2, g.pikaWave.cy - g.pikaWave.size / 2, g.pikaWave.size)}
  ${pill(g.select, g)}
  ${pill(g.start, g)}
  ${emboss(g.select.cx, g.select.cy + 22 * u, "SELECT", 9.5 * u, "middle", 'font-weight="700" letter-spacing="0.5"')}
  ${emboss(g.start.cx, g.start.cy + 22 * u, "START", 9.5 * u, "middle", 'font-weight="700" letter-spacing="0.5"')}
  ${well(g.menu.cx, g.menu.cy, g.menu.r)}
  <path d="M${g.menu.cx - 6 * u} ${g.menu.cy - 4 * u} h${12 * u} M${g.menu.cx - 6 * u} ${g.menu.cy} h${12 * u} M${g.menu.cx - 6 * u} ${g.menu.cy + 4 * u} h${12 * u}"
    stroke="rgba(110,45,0,.55)" stroke-width="${1.8 * u}" stroke-linecap="round"/>
  </g>
</svg>`;
}

// ---------- info.json ----------
const rect = (x, y, w, h) => ({ x: +x.toFixed(1), y: +y.toFixed(1), width: +w.toFixed(1), height: +h.toFixed(1) });
const circleFrame = (c, pad = 1) => rect(c.cx - c.r * pad, c.cy - c.r * pad, 2 * c.r * pad, 2 * c.r * pad);

function representation(g, base) {
  const { u } = g;
  const d = g.dpad;
  const pillFrame = (p) => rect(p.cx - g.pill.w * 0.75, p.cy - g.pill.h * 1.4, g.pill.w * 1.5, g.pill.h * 2.8);
  const screen = rect(g.screen.x, g.screen.y, g.screen.w, g.screen.h);
  return {
    assets: { small: `${base}@1x.png`, medium: `${base}@2x.png`, large: `${base}@3x.png` },
    items: [
      { inputs: { up: "up", down: "down", left: "left", right: "right" }, frame: rect(d.cx - d.size / 2, d.cy - d.size / 2, d.size, d.size), extendedEdges: { top: 12, bottom: 12, left: 12, right: 12 } },
      { inputs: ["a"], frame: circleFrame(g.a, 1.15) },
      { inputs: ["b"], frame: circleFrame(g.b, 1.15) },
      { inputs: ["select"], frame: pillFrame(g.select) },
      { inputs: ["start"], frame: pillFrame(g.start) },
      { inputs: ["menu"], frame: circleFrame(g.menu, 1.4) },
    ],
    screens: [{ outputFrame: screen }],
    gameScreenFrame: screen,
    mappingSize: { width: g.W, height: g.H },
    extendedEdges: { top: 7, bottom: 7, left: 7, right: 7 },
  };
}

// ---------- Main ----------
(async () => {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const info = {
    name: SKIN_NAME,
    identifier: "com.tannerholden26.delta.gbc.pikachuedition",
    gameTypeIdentifier: "com.rileytestut.delta.game.gbc",
    debug: false,
    representations: { iphone: { standard: {}, edgeToEdge: {} } },
  };

  const browser = await chromium.launch();
  for (const v of VARIANTS) {
    const g = layout(v.W, v.H, v.device, v.orientation);
    const svg = buildSVG(g);
    const base = `gbc-${v.device}-${v.orientation}`;
    fs.writeFileSync(path.join(OUT_DIR, `${base}.svg`), svg);
    for (const scale of [1, 2, 3]) {
      const page = await browser.newPage({ viewport: { width: v.W, height: v.H }, deviceScaleFactor: scale });
      await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
      await page.screenshot({ path: path.join(OUT_DIR, `${base}@${scale}x.png`), omitBackground: true });
      await page.close();
    }
    info.representations.iphone[v.device][v.orientation] = representation(g, base);
  }
  await browser.close();

  fs.writeFileSync(path.join(OUT_DIR, "info.json"), JSON.stringify(info, null, 2));
  fs.rmSync(SKIN_FILE, { force: true });
  const files = fs.readdirSync(OUT_DIR).filter((f) => f === "info.json" || f.endsWith(".png"));
  execFileSync("zip", ["-q", "-X", SKIN_FILE, ...files], { cwd: OUT_DIR });
  console.log(`Wrote ${SKIN_FILE}`);
})();
