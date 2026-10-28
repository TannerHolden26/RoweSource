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
  lcd: "#a9b2a4",
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
    g.pikaWave = { cx: W * 0.47, cy: g.dpad.cy + 34 * u, size: 70 * u };
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
    g.pikaWave = { cx: g.dpad.cx, cy: H * 0.17, size: 62 * u };
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

// ---------- Artwork: Pokémon (drawn in a 100×100 box unless noted) ----------
const INK = "#2d2116";

// Front-facing Pikachu, waving.
const PIKA_WAVE = `
  <g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
    <path d="M32 80 L14 68 L21 61 L5 47 L12 43 L3 30 L22 44 L16 49 L31 60 L26 65 L39 74 Z" fill="#ffd83a"/>
    <path d="M39 74 L32 80 L27 72 Z" fill="#9a5b2a"/>
    <path d="M33 30 C22 18 16 8 14 1 C24 4 34 14 41 24 Z" fill="#ffd83a"/>
    <path d="M14 1 C17 4 20 7 22 10 C20 12 18 13 16.5 13 C15.5 9 14.5 5 14 1 Z" fill="${INK}"/>
    <path d="M60 23 C64 12 72 4 82 0 C82 9 76 20 68 29 Z" fill="#ffd83a"/>
    <path d="M82 0 C81 5 79 10 77 13 C75 12 73 10 72 8 C75 4 78 2 82 0 Z" fill="${INK}"/>
    <ellipse cx="48" cy="77" rx="19" ry="18" fill="#ffd83a"/>
    <path d="M33 74 C27 80 27 88 34 89" fill="#ffd83a"/>
    <ellipse cx="39" cy="95" rx="7" ry="3.6" fill="#ffd83a"/>
    <ellipse cx="57" cy="95" rx="7" ry="3.6" fill="#ffd83a"/>
    <ellipse cx="47" cy="42" rx="26" ry="22" fill="#ffd83a"/>
    <path d="M62 72 C70 66 76 56 79 46" fill="none" stroke-width="8.5"/>
    <path d="M62 72 C70 66 76 56 79 46" fill="none" stroke="#ffd83a" stroke-width="3.8"/>
    <circle cx="80" cy="43" r="5.2" fill="#ffd83a"/>
  </g>
  <path d="M84 30 Q90 34 88 41 M90 26 Q98 32 95 42" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" opacity=".6"/>
  <ellipse cx="37.5" cy="38" rx="4" ry="4.6" fill="${INK}"/>
  <circle cx="36.3" cy="36.3" r="1.6" fill="#fff"/>
  <ellipse cx="57.5" cy="38" rx="4" ry="4.6" fill="${INK}"/>
  <circle cx="56.3" cy="36.3" r="1.6" fill="#fff"/>
  <circle cx="27" cy="49" r="6" fill="#ee4b3a"/>
  <circle cx="68" cy="49" r="6" fill="#ee4b3a"/>
  <path d="M42 48 Q47 58 53 48 Z" fill="#c8323a" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M44.5 53 Q47.5 56 50.5 53" fill="#ff8f8a"/>
  <path d="M46.5 45 L48.5 45" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>
`;

// Pikachu running to the right (for the bottom-left of the screen bezel).
const PIKA_RUN = `
  <g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
    <path d="M30 70 L10 74 L16 64 L0 62 L10 52 L-2 46 L20 48 L16 56 L32 58 Z" fill="#ffd83a"/>
    <path d="M30 70 L32 58 L36 64 Z" fill="#9a5b2a"/>
    <path d="M42 26 C36 14 28 6 18 2 C20 12 28 24 36 32 Z" fill="#ffd83a"/>
    <path d="M18 2 C20 7 22 10 25 13 C27 11 28 9 28 8 C25 5 22 3 18 2 Z" fill="${INK}"/>
    <path d="M60 22 C66 12 74 6 86 4 C82 14 74 22 66 28 Z" fill="#ffd83a"/>
    <path d="M86 4 C84 8 82 11 79 13 C77 11 76 9 76 8 C79 6 82 5 86 4 Z" fill="${INK}"/>
    <path d="M28 66 C26 52 38 46 52 52 C64 58 66 74 58 84 C50 92 34 90 28 80 Z" fill="#ffd83a"/>
    <path d="M38 86 C34 94 42 98 48 94" fill="#ffd83a"/>
    <path d="M58 82 C64 90 72 90 74 84" fill="#ffd83a"/>
    <path d="M58 62 C66 62 72 66 76 70" fill="none" stroke-width="7"/>
    <path d="M58 62 C66 62 72 66 76 70" fill="none" stroke="#ffd83a" stroke-width="2.4"/>
    <ellipse cx="58" cy="40" rx="25" ry="21" fill="#ffd83a"/>
  </g>
  <ellipse cx="66" cy="36" rx="4" ry="4.8" fill="${INK}"/>
  <circle cx="64.8" cy="34.3" r="1.6" fill="#fff"/>
  <circle cx="72" cy="48" r="5.6" fill="#ee4b3a"/>
  <path d="M78 42 Q81 46 77 48" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
`;

// The three Johto starters stacked, facing left (box 100×300).
const STARTERS = `
  <g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
    <!-- Cyndaquil -->
    <path d="M62 34 L70 4 L76 24 L86 0 L88 24 L100 10 L96 38 Z" fill="#f24a1c"/>
    <path d="M68 34 L74 16 L78 30 L86 14 L88 32 L95 24 L92 40 Z" fill="#ffb21f" stroke="none"/>
    <path d="M10 62 C10 46 30 34 56 34 C84 34 100 46 100 62 L100 96 L24 96 C14 92 10 76 10 62 Z" fill="#2f5d7e"/>
    <path d="M6 66 C2 60 6 52 18 52 C30 52 44 58 52 68 C58 78 56 92 44 96 L22 96 C14 94 8 78 6 66 Z" fill="#f6e4a2"/>
    <path d="M24 60 Q30 57 35 61" fill="none"/>
    <circle cx="9" cy="61" r="1.6" fill="${INK}"/>
    <!-- Totodile -->
    <path d="M70 100 L80 92 L84 104 L94 98 L94 112 L100 112 L100 124 Z" fill="#e2413a"/>
    <path d="M36 104 C52 96 84 98 98 114 C104 122 102 150 96 164 L40 164 C34 150 34 120 36 104 Z" fill="#59b4dd"/>
    <path d="M42 104 C30 104 4 112 2 124 C2 130 12 132 30 130 L44 128 Z" fill="#59b4dd"/>
    <path d="M30 136 C16 136 4 142 6 150 C10 158 32 160 48 156 Z" fill="#59b4dd"/>
    <path d="M44 128 C30 130 12 132 8 134 C10 148 30 152 46 150 Z" fill="#d93d33"/>
    <path d="M12 129 L15 135 L18 129 M22 129 L25 135 L28 129 M14 150 L17 145 L20 150" fill="#fff" stroke-width="1.6"/>
    <ellipse cx="46" cy="114" rx="7" ry="8" fill="#fff"/>
    <path d="M40 166 L56 152 L72 166 L88 152 L96 166 Z" fill="#f2d76b"/>
  </g>
  <ellipse cx="44" cy="115" rx="3.4" ry="4.2" fill="#b0281f"/>
  <circle cx="43" cy="113.5" r="1.2" fill="#fff"/>
  <g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
    <!-- Chikorita -->
    <path d="M62 196 C56 172 72 160 98 164 C92 176 84 190 66 200 Z" fill="#6fbf4a"/>
    <path d="M66 196 C74 184 84 174 96 166" fill="none" stroke-width="1.6"/>
    <path d="M30 226 C30 206 50 194 70 196 C92 198 100 214 100 232 L100 300 L40 300 C30 280 28 250 30 226 Z" fill="#dcefb0"/>
    <circle cx="40" cy="270" r="7" fill="#6fbf4a"/>
    <circle cx="56" cy="274" r="7" fill="#6fbf4a"/>
    <circle cx="72" cy="272" r="7" fill="#6fbf4a"/>
    <circle cx="88" cy="268" r="7" fill="#6fbf4a"/>
    <ellipse cx="46" cy="228" rx="5.6" ry="7" fill="#fff"/>
  </g>
  <ellipse cx="44.5" cy="229" rx="3.6" ry="5" fill="#c8302a"/>
  <circle cx="43.4" cy="227" r="1.3" fill="#fff"/>
  <path d="M34 246 Q38 249 42 246" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
`;

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
  const logoX = s.x + s.w / 2;
  const colors = ["#f0457d", "#7d55d6", "#3fae4c", "#f4c315", "#2d8fe0"];
  const color = "COLOR".split("").map((ch, i) => `<tspan fill="${colors[i]}">${ch}</tspan>`).join("");

  const ledX = x + (s.x - x) / 2, ledY = s.y + s.h * 0.34;
  const pikaSize = (g.landscape ? 64 : 74) * u;
  // The starters sit in the strip between the screen and the bezel's right edge.
  const stripX = s.x + s.w + 4 * u;
  const stW = Math.min((x + w - stripX) * 1.25, (y + h - s.y) / 3);
  const stH = stW * 3;

  return `
    <path d="${bez}" fill="${C.bezelEdge}" transform="translate(0 ${2 * u})"/>
    <path d="${bez}" fill="url(#bezelFill)"/>
    <clipPath id="bezClip"><path d="${bez}"/></clipPath>
    <g clip-path="url(#bezClip)">
      <svg x="${x - pikaSize * 0.12}" y="${y + h - pikaSize * 0.98}" width="${pikaSize}" height="${pikaSize}" viewBox="0 0 100 100" overflow="visible">${PIKA_RUN}</svg>
      <svg x="${stripX}" y="${y + h - stH - 2 * u}" width="${stW}" height="${stH}" viewBox="0 0 100 300" overflow="visible">${STARTERS}</svg>
    </g>
    <rect x="${s.x - 3 * u}" y="${s.y - 3 * u}" width="${s.w + 6 * u}" height="${s.h + 6 * u}" rx="${3 * u}" fill="#23262e"/>
    <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${C.lcd}"/>
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
  <svg x="${g.pikaWave.cx - g.pikaWave.size / 2}" y="${g.pikaWave.cy - g.pikaWave.size / 2}" width="${g.pikaWave.size}" height="${g.pikaWave.size}" viewBox="0 0 100 100" overflow="visible">
    ${PIKA_WAVE}
  </svg>
  ${pill(g.select, g)}
  ${pill(g.start, g)}
  ${emboss(g.select.cx, g.select.cy + 22 * u, "SELECT", 9.5 * u, "middle", 'font-weight="700" letter-spacing="0.5"')}
  ${emboss(g.start.cx, g.start.cy + 22 * u, "START", 9.5 * u, "middle", 'font-weight="700" letter-spacing="0.5"')}
  ${well(g.menu.cx, g.menu.cy, g.menu.r)}
  <path d="M${g.menu.cx - 6 * u} ${g.menu.cy - 4 * u} h${12 * u} M${g.menu.cx - 6 * u} ${g.menu.cy} h${12 * u} M${g.menu.cx - 6 * u} ${g.menu.cy + 4 * u} h${12 * u}"
    stroke="rgba(110,45,0,.55)" stroke-width="${1.8 * u}" stroke-linecap="round"/>
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
      await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
      await page.screenshot({ path: path.join(OUT_DIR, `${base}@${scale}x.png`) });
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
