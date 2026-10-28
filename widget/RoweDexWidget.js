// Pokémon R.O.W.E. "Pokémon of the Day" widget for iPhone.
// Runs in the free Scriptable app (https://scriptable.app). See widget/README.md.
// Supports small, medium and large home-screen widgets.

// ---------- Settings ----------
const MAX_DEX = 898;            // R.O.W.E. includes Pokémon up to Gen 8
const SHINY_ODDS = 16;          // 1 in N days shows the shiny sprite
const TAP_URL = "https://www.pokecommunity.com/threads/pokemon-r-o-w-e-an-open-world-version-of-pok%C3%A9mon-emerald-gen-8-following-pok%C3%A9mon-costumes-and-much-more.442592/";

const TYPE_COLORS = {
  normal: "#A8A77A", fire: "#EE8130", water: "#6390F0", electric: "#F7D02C",
  grass: "#7AC74C", ice: "#96D9D6", fighting: "#C22E28", poison: "#A33EA1",
  ground: "#E2BF65", flying: "#A98FF3", psychic: "#F95587", bug: "#A6B91A",
  rock: "#B6A136", ghost: "#735797", dragon: "#6F35FC", dark: "#705746",
  steel: "#B7B7CE", fairy: "#D685AD",
};

const STAT_LABELS = {
  hp: "HP", attack: "ATK", defense: "DEF",
  "special-attack": "SPA", "special-defense": "SPD", speed: "SPE",
};

// ---------- Pick today's Pokémon ----------
// Deterministic per calendar day, so the widget shows the same Pokémon all day.
function dailySeed(date) {
  const key = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  // Small integer hash so consecutive days don't give consecutive dex numbers.
  let h = key ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}

const seed = dailySeed(new Date());
const dexNum = (seed % MAX_DEX) + 1;
const isShiny = (Math.floor(seed / MAX_DEX) % SHINY_ODDS) === 0;

// ---------- Fetch with offline cache ----------
const fm = FileManager.local();
const cacheDir = fm.joinPath(fm.cacheDirectory(), "rowe-dex-widget");
if (!fm.fileExists(cacheDir)) fm.createDirectory(cacheDir);
const dataPath = fm.joinPath(cacheDir, "data.json");
const imgPath = fm.joinPath(cacheDir, "sprite.png");

async function fetchPokemon() {
  const mon = await new Request(`https://pokeapi.co/api/v2/pokemon/${dexNum}`).loadJSON();
  const species = await new Request(`https://pokeapi.co/api/v2/pokemon-species/${dexNum}`).loadJSON();

  const englishName = species.names.find((n) => n.language.name === "en");
  const genus = species.genera.find((g) => g.language.name === "en");
  const flavors = species.flavor_text_entries.filter((f) => f.language.name === "en");
  const flavor = flavors.find((f) => f.version.name === "emerald") || flavors[flavors.length - 1];

  const sprites = mon.sprites;
  const spriteUrl = (isShiny && sprites.front_shiny) || sprites.front_default;

  return {
    dex: dexNum,
    shiny: isShiny && !!sprites.front_shiny,
    name: englishName ? englishName.name : mon.name,
    genus: genus ? genus.genus : "",
    types: mon.types.map((t) => t.type.name),
    stats: mon.stats.map((s) => ({ name: s.stat.name, value: s.base_stat })),
    flavor: flavor ? flavor.flavor_text.replace(/[\n\f\r]+/g, " ") : "",
    spriteUrl,
  };
}

async function loadData() {
  try {
    const data = await fetchPokemon();
    const sprite = await new Request(data.spriteUrl).loadImage();
    fm.writeString(dataPath, JSON.stringify(data));
    fm.writeImage(imgPath, sprite);
    return { data, sprite };
  } catch (e) {
    // Offline: fall back to the last Pokémon we successfully loaded.
    if (fm.fileExists(dataPath) && fm.fileExists(imgPath)) {
      return { data: JSON.parse(fm.readString(dataPath)), sprite: fm.readImage(imgPath) };
    }
    return null;
  }
}

// ---------- Drawing helpers ----------
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pad3 = (n) => String(n).padStart(3, "0");

function applyBackground(widget, types) {
  const primary = new Color(TYPE_COLORS[types[0]] || "#4A4A4A");
  const g = new LinearGradient();
  g.colors = [new Color("#1B1F3B"), new Color(primary.hex, 0.85)];
  g.locations = [0.15, 1];
  g.startPoint = new Point(0, 0);
  g.endPoint = new Point(1, 1);
  widget.backgroundGradient = g;
}

function addTypeBadges(stack, types, fontSize) {
  const row = stack.addStack();
  row.spacing = 4;
  for (const t of types) {
    const badge = row.addStack();
    badge.backgroundColor = new Color(TYPE_COLORS[t] || "#777777");
    badge.cornerRadius = 6;
    badge.setPadding(2, 6, 2, 6);
    const txt = badge.addText(t.toUpperCase());
    txt.font = Font.heavySystemFont(fontSize);
    txt.textColor = Color.white();
  }
}

function addHeader(stack, data, nameSize) {
  const num = stack.addText(`#${pad3(data.dex)}${data.shiny ? "  ✨" : ""}`);
  num.font = Font.boldMonospacedSystemFont(nameSize * 0.6);
  num.textColor = new Color("#FFFFFF", 0.7);

  const name = stack.addText(data.name);
  name.font = Font.heavyRoundedSystemFont(nameSize);
  name.textColor = Color.white();
  name.minimumScaleFactor = 0.6;
  name.lineLimit = 1;
}

function drawStatBars(stats, width) {
  const rowH = 16;
  const labelW = 34;
  const valueW = 30;
  const barW = width - labelW - valueW;
  const ctx = new DrawContext();
  ctx.size = new Size(width, rowH * stats.length);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  ctx.setFont(Font.boldMonospacedSystemFont(10));

  stats.forEach((s, i) => {
    const y = i * rowH;
    ctx.setTextColor(new Color("#FFFFFF", 0.75));
    ctx.drawTextInRect(STAT_LABELS[s.name] || s.name, new Rect(0, y + 1, labelW, rowH));

    const track = new Path();
    track.addRoundedRect(new Rect(labelW, y + 4, barW, 8), 4, 4);
    ctx.addPath(track);
    ctx.setFillColor(new Color("#FFFFFF", 0.15));
    ctx.fillPath();

    const fillW = Math.max(8, Math.min(1, s.value / 180) * barW);
    const fill = new Path();
    fill.addRoundedRect(new Rect(labelW, y + 4, fillW, 8), 4, 4);
    ctx.addPath(fill);
    ctx.setFillColor(new Color(s.value >= 100 ? "#7CFC9A" : s.value >= 60 ? "#F7D02C" : "#FF7A6B"));
    ctx.fillPath();

    ctx.setTextColor(Color.white());
    ctx.drawTextInRect(String(s.value), new Rect(labelW + barW + 4, y + 1, valueW, rowH));
  });
  return ctx.getImage();
}

// ---------- Layouts ----------
function buildSmall(widget, data, sprite) {
  widget.setPadding(10, 12, 10, 12);
  const top = widget.addStack();
  top.addSpacer();
  const img = top.addImage(sprite);
  img.imageSize = new Size(76, 76);
  top.addSpacer();

  widget.addSpacer();
  addHeader(widget, data, 18);
  widget.addSpacer(4);
  addTypeBadges(widget, data.types, 8);
}

function buildMedium(widget, data, sprite) {
  widget.setPadding(12, 12, 12, 14);
  const row = widget.addStack();
  row.centerAlignContent();

  const img = row.addImage(sprite);
  img.imageSize = new Size(110, 110);
  row.addSpacer(8);

  const info = row.addStack();
  info.layoutVertically();
  addHeader(info, data, 20);
  if (data.genus) {
    const genus = info.addText(data.genus);
    genus.font = Font.mediumSystemFont(11);
    genus.textColor = new Color("#FFFFFF", 0.7);
  }
  info.addSpacer(6);
  addTypeBadges(info, data.types, 9);
  info.addSpacer(6);
  const flavor = info.addText(data.flavor);
  flavor.font = Font.systemFont(10);
  flavor.textColor = new Color("#FFFFFF", 0.9);
  flavor.lineLimit = 3;
  flavor.minimumScaleFactor = 0.8;
}

function buildLarge(widget, data, sprite) {
  widget.setPadding(16, 16, 16, 16);

  const title = widget.addText("R.O.W.E. · POKÉMON OF THE DAY");
  title.font = Font.heavySystemFont(10);
  title.textColor = new Color("#FFFFFF", 0.6);
  widget.addSpacer(6);

  const row = widget.addStack();
  row.centerAlignContent();
  const img = row.addImage(sprite);
  img.imageSize = new Size(120, 120);
  row.addSpacer(10);
  const info = row.addStack();
  info.layoutVertically();
  addHeader(info, data, 24);
  if (data.genus) {
    const genus = info.addText(data.genus);
    genus.font = Font.mediumSystemFont(12);
    genus.textColor = new Color("#FFFFFF", 0.7);
  }
  info.addSpacer(6);
  addTypeBadges(info, data.types, 10);

  widget.addSpacer(8);
  const flavor = widget.addText(data.flavor);
  flavor.font = Font.systemFont(12);
  flavor.textColor = new Color("#FFFFFF", 0.9);
  flavor.lineLimit = 3;
  flavor.minimumScaleFactor = 0.8;

  widget.addSpacer(10);
  widget.addImage(drawStatBars(data.stats, 290));

  const total = data.stats.reduce((sum, s) => sum + s.value, 0);
  widget.addSpacer(4);
  const bst = widget.addText(`Base stat total: ${total}`);
  bst.font = Font.boldSystemFont(10);
  bst.textColor = new Color("#FFFFFF", 0.7);
  bst.rightAlignText();
}

function buildError(widget) {
  widget.backgroundColor = new Color("#1B1F3B");
  const t = widget.addText("Couldn't reach PokéAPI.\nCheck your connection.");
  t.font = Font.mediumSystemFont(12);
  t.textColor = Color.white();
}

// ---------- Main ----------
const family = config.widgetFamily || "medium"; // "medium" preview when run inside the app
const widget = new ListWidget();
widget.url = TAP_URL;

const result = await loadData();
if (!result) {
  buildError(widget);
} else {
  const { data, sprite } = result;
  applyBackground(widget, data.types);
  if (family === "small") buildSmall(widget, data, sprite);
  else if (family === "large" || family === "extraLarge") buildLarge(widget, data, sprite);
  else buildMedium(widget, data, sprite);
}

// Refresh shortly after midnight so the new Pokémon of the day shows up.
const tomorrow = new Date();
tomorrow.setHours(24, 5, 0, 0);
widget.refreshAfterDate = tomorrow;

if (config.runsInWidget) {
  Script.setWidget(widget);
} else if (family === "small") {
  await widget.presentSmall();
} else if (family === "large") {
  await widget.presentLarge();
} else {
  await widget.presentMedium();
}
Script.complete();
