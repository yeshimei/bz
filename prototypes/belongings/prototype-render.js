/* 源指纹 e5855de1c1570d18 · 仓内输入 5 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["src/belongings/emoji-icon-map.ts","src/belongings/layouts/poster/render.ts","src/belongings/render.ts","src/belongings/shared.ts","src/core/ui/str.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/belongings/render.ts → window.BZR_belongings（评审壳预览包，ADR-0104） */
var BZR_belongings = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/belongings/render.ts
  var render_exports = {};
  __export(render_exports, {
    ICON: () => ICON,
    SORT_OPTS: () => SORT_OPTS,
    STATUS: () => STATUS,
    STATUS_LABELS: () => STATUS_LABELS,
    STATUS_ORDER: () => STATUS_ORDER,
    actionSpecs: () => actionSpecs,
    avgDailyCost: () => avgDailyCost,
    belDetailHtml: () => belDetailHtml,
    belFormHtml: () => belFormHtml,
    belFormInit: () => belFormInit,
    catEmHtml: () => catEmHtml,
    catEmoji: () => catEmoji,
    catIconOf: () => catIconOf,
    catNameOf: () => catNameOf,
    cellHtml: () => cellHtml,
    chipsHtml: () => chipsHtml,
    dailyCostOf: () => dailyCostOf,
    daysUsed: () => daysUsed,
    emptyHtml: () => emptyHtml,
    esc: () => esc,
    exitDateOf: () => exitDateOf,
    exitedStatus: () => exitedStatus,
    filtered: () => filtered,
    flowBtnsHtml: () => flowBtnsHtml,
    gridHtml: () => gridHtml,
    heroSubText: () => heroSubText,
    heroTitleText: () => heroTitleText,
    iconSpan: () => iconSpan,
    inStock: () => inStock,
    isExited: () => isExited,
    itemEmHtml: () => itemEmHtml,
    itemIconOf: () => itemIconOf,
    kpisHtml: () => kpisHtml,
    mobChipsHtml: () => mobChipsHtml,
    mobStatsText: () => mobStatsText,
    money: () => money,
    moneyShort: () => moneyShort,
    panelHtml: () => panelHtml,
    renderPanelView: () => renderPanelView,
    resolveYear: () => resolveYear,
    segmentedHtml: () => segmentedHtml,
    sheetHeadHtml: () => sheetHeadHtml,
    sortOptionsHtml: () => sortOptionsHtml,
    splitEmojiCategory: () => splitEmojiCategory,
    stampCount: () => stampCount,
    statusCount: () => statusCount,
    statusKeyOf: () => statusKeyOf,
    statusOf: () => statusOf,
    statusPickHtml: () => statusPickHtml,
    stockCount: () => stockCount,
    todayStr: () => todayStr,
    totalAssets: () => totalAssets,
    yearsAvailable: () => yearsAvailable,
    yearsOptionsHtml: () => yearsOptionsHtml
  });

  // src/core/ui/str.ts
  var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }
  function esc(s) {
    return escapeHtml(String(s != null ? s : ""));
  }
  function iconSpan(name, extra = "") {
    return `<i data-lucide="${name}" class="bz-ic${extra ? " " + extra : ""}"></i>`;
  }

  // src/belongings/emoji-icon-map.ts
  var EMOJI_ICON = {
    /* ---- 数码影音 ---- */
    "📱": "smartphone",
    "💻": "laptop",
    "🖥": "monitor",
    "⌚": "watch",
    "🎧": "headphones",
    "🔊": "speaker",
    "🖨": "printer",
    "📷": "camera",
    "🔍": "aperture",
    "📹": "video",
    "🪞": "focus",
    "📽": "projector",
    "🎮": "gamepad-2",
    "⌨": "keyboard",
    "💾": "hard-drive",
    "📀": "disc",
    "🔌": "plug",
    "🔋": "battery-charging",
    "💡": "lightbulb",
    "📺": "tv",
    "📡": "router",
    "📶": "signal",
    "📞": "phone",
    /* ---- 衣服饰品 ---- */
    "👕": "shirt",
    "👔": "shirt",
    "🧥": "shirt",
    "👖": "shirt",
    "👗": "shirt",
    "👘": "shirt",
    "🩳": "shirt",
    "🧦": "footprints",
    "👙": "shirt",
    "👠": "footprints",
    "👞": "footprints",
    "👟": "footprints",
    "👜": "handbag",
    "🎒": "backpack",
    "🧣": "shirt",
    "🧤": "hand",
    "👒": "hard-hat",
    "🕶": "glasses",
    "👓": "glasses",
    "💍": "gem",
    "📿": "gem",
    "💎": "gem",
    "🧢": "hard-hat",
    "🎩": "hard-hat",
    "💄": "sparkles",
    "💋": "heart",
    "👁": "eye",
    "📏": "ruler",
    "👀": "eye",
    "💅": "hand",
    "🧴": "droplets",
    "🧼": "droplets",
    "💧": "glass-water",
    "🛡": "shield",
    "🎭": "smile",
    "💆": "hand",
    "✂": "scissors",
    "🧽": "droplets",
    "🪒": "zap",
    "🚿": "shower-head",
    "💇": "scissors",
    /* ---- 家居 ---- */
    "🛏": "bed",
    "🛋": "sofa",
    "🪑": "armchair",
    "🗄": "archive",
    "📚": "library",
    "🪟": "align-justify",
    "🧹": "brush-cleaning",
    "🚽": "droplets",
    "🪥": "sparkles",
    "🧻": "scroll",
    "🪣": "droplets",
    "🗑": "trash-2",
    "🔑": "key-round",
    /* ---- 厨房餐茶 ---- */
    "🍳": "cooking-pot",
    "🔪": "slice",
    "🍽": "utensils",
    "☕": "coffee",
    "🍶": "coffee",
    "🍵": "coffee",
    "🥄": "utensils",
    "🍴": "utensils",
    "🥢": "utensils",
    "🧂": "soup",
    "🍯": "droplets",
    "🍚": "wheat",
    "🧊": "refrigerator",
    "🔥": "flame",
    "🍞": "croissant",
    "🥛": "milk",
    "🍹": "cup-soda",
    "❄": "snowflake",
    "🥘": "cooking-pot",
    "🛀": "bath",
    "💨": "fan",
    "🌫": "cloud-fog",
    "📖": "book-open",
    /* ---- 文具乐玩 ---- */
    "✏": "pencil",
    "🖊": "pen",
    "📒": "notebook",
    "🎨": "palette",
    "🎸": "guitar",
    "🎹": "piano",
    "🥁": "drum",
    "🎤": "mic",
    "🧩": "puzzle",
    "🎲": "dices",
    /* ---- 运动户外 ---- */
    "🏸": "volleyball",
    "⚽": "volleyball",
    "🏃": "footprints",
    "🧘": "person-standing",
    "🏊": "waves",
    "🎣": "fish",
    "🔧": "wrench",
    "🔨": "hammer",
    "🪛": "wrench",
    "🔩": "cog",
    "🛠": "hammer",
    "🪚": "axe",
    "🧰": "briefcase",
    "🪓": "axe",
    "⛏": "shovel",
    "🖼": "image",
    "🏺": "amphora",
    "🧸": "baby",
    "🔮": "sparkles",
    "🎞": "film",
    "🪙": "coins",
    "🏆": "trophy",
    "🎖": "medal",
    "📜": "scroll",
    "📸": "camera",
    /* ---- 医药健康 ---- */
    "💊": "pill",
    "🌡": "thermometer",
    "🩹": "bandage",
    "🩺": "stethoscope",
    "💉": "syringe",
    "🦷": "sparkles",
    "🩸": "droplet",
    "⚖": "scale",
    /* ---- 礼节节庆 ---- */
    "🧳": "luggage",
    "🎁": "gift",
    "🕯": "flame",
    "🧨": "bomb",
    "🌂": "umbrella",
    "☂": "umbrella",
    "⛱": "umbrella",
    "🧭": "compass",
    "🔭": "telescope",
    "💐": "flower",
    "🌿": "leaf",
    "🐠": "fish",
    "🐶": "dog",
    "🚗": "car",
    "🚲": "bike",
    "🛴": "bike",
    "⛺": "tent",
    "📦": "package",
    /* ---- 办公纸媒 ---- */
    "📎": "paperclip",
    "📌": "pin",
    "🖇": "paperclip",
    "📋": "clipboard-list",
    "📁": "folder",
    "🗂": "folder",
    "📊": "chart-bar",
    "📐": "ruler",
    "🧮": "calculator",
    "📇": "contact",
    "🖍": "highlighter",
    "🖌": "paintbrush",
    "📫": "mail",
    "📮": "mail",
    "✉": "mail",
    "🏷": "tag",
    "📑": "bookmark",
    "🔖": "bookmark",
    "📰": "newspaper",
    "🗞": "newspaper",
    "📓": "notebook",
    "📔": "notebook-pen",
    "📕": "book",
    "📗": "book",
    "📘": "book",
    "📙": "book",
    "🧷": "paperclip",
    "🔒": "lock",
    "💼": "briefcase",
    "🗳": "vote",
    "🖋": "pen-tool",
    "✒": "pen-tool",
    "📝": "pen-line",
    "💵": "banknote",
    "💳": "credit-card",
    "🧾": "receipt",
    "📄": "file-text",
    "📃": "file-text",
    "🗒": "notebook-pen",
    "📅": "calendar",
    "🕐": "alarm-clock",
    "🗓": "calendar-days",
    "📆": "calendar",
    "📈": "trending-up",
    "📉": "trending-down",
    "🖱": "mouse",
    "🗃": "archive",
    "🔗": "link",
    /* ---- 球类冰雪水上 ---- */
    "🏀": "volleyball",
    "🏈": "volleyball",
    "⚾": "volleyball",
    "🎾": "volleyball",
    "🏐": "volleyball",
    "🏉": "volleyball",
    "🎱": "volleyball",
    "🏓": "volleyball",
    "🥅": "target",
    "🏑": "volleyball",
    "🏒": "volleyball",
    "🥍": "volleyball",
    "🏏": "volleyball",
    "🎿": "snowflake",
    "⛷": "snowflake",
    "🏂": "snowflake",
    "🪂": "umbrella",
    "🏄": "waves",
    "🛹": "bike",
    "🛼": "footprints",
    "🚴": "bike",
    "🛶": "sailboat",
    "🤿": "waves",
    "⛸": "snowflake",
    "🎯": "target",
    "🪀": "circle-dot",
    "🏹": "crosshair",
    "🪁": "wind",
    "🥊": "hand",
    "🥋": "shirt",
    "⚔": "swords",
    "🤺": "swords",
    "🥌": "circle-dot",
    "🎳": "volleyball",
    "🏌": "flag",
    "⛳": "flag",
    "🤸": "person-standing",
    "🤽": "waves",
    "🤾": "person-standing",
    "🧗": "mountain",
    "🏇": "paw-print",
    "🤹": "orbit",
    "🎪": "tent",
    "🤼": "users",
    "🥏": "disc",
    /* ---- 奖章票庆 ---- */
    "🥇": "medal",
    "🥈": "medal",
    "🥉": "medal",
    "🏅": "medal",
    "🎗": "ribbon",
    "🏵": "flower",
    "🤡": "smile",
    "🎟": "ticket",
    "🎫": "ticket",
    "🎀": "ribbon",
    "🎈": "party-popper",
    "🎉": "party-popper",
    "🎊": "sparkles",
    "🎋": "sprout",
    "🎍": "sprout",
    "🎎": "baby",
    "🎏": "flag",
    "🎐": "bell",
    "🎑": "moon",
    "🧧": "wallet",
    /* ---- 服饰鞋靴二批 ---- */
    "🥽": "glasses",
    "🥼": "shirt",
    "🦺": "shield",
    "🥾": "footprints",
    "🥿": "footprints",
    "🩰": "footprints",
    "👢": "footprints",
    "👡": "footprints",
    "🩴": "footprints",
    /* ---- 车船航空 ---- */
    "🚙": "car",
    "🚐": "bus",
    "🚚": "truck",
    "🚛": "truck",
    "🚜": "tractor",
    "🏎": "car",
    "🚓": "car",
    "🚑": "ambulance",
    "🚒": "truck",
    "🚨": "siren",
    "🚔": "car",
    "🚍": "bus",
    "🚋": "tram-front",
    "🚃": "train-front",
    "🚝": "train-front",
    "🚄": "train-front",
    "🚅": "train-front",
    "🚈": "tram-front",
    "🚊": "tram-front",
    "🚞": "train-front",
    "🚟": "cable-car",
    "🚠": "cable-car",
    "🚡": "cable-car",
    "🚢": "ship",
    "🛳": "ship",
    "⛴": "ship",
    "🚤": "ship",
    "🛥": "ship",
    "⛵": "sailboat",
    "🚣": "ship",
    "🛷": "snowflake",
    "🚁": "helicopter",
    "✈": "plane",
    "🛩": "plane",
    "🛫": "plane-takeoff",
    "🛬": "plane-landing",
    "💺": "armchair",
    "🚀": "rocket",
    "🛸": "disc",
    "🛰": "satellite",
    "🚏": "bus",
    "⛽": "fuel",
    "🛞": "circle-dot",
    "🛢": "database",
    "🧪": "flask-conical",
    "🧯": "flame",
    "🔦": "flashlight",
    "🎵": "music",
    /* ---- 动物（lucide 无种别图的落 paw-print / 鸟禽落 bird / 海洋落 fish） ---- */
    "🐱": "cat",
    "🐭": "rat",
    "🐹": "rat",
    "🐰": "rabbit",
    "🦊": "paw-print",
    "🐻": "paw-print",
    "🐼": "paw-print",
    "🐨": "paw-print",
    "🐯": "paw-print",
    "🦁": "paw-print",
    "🐮": "paw-print",
    "🐷": "piggy-bank",
    "🐸": "paw-print",
    "🐙": "fish",
    "🐵": "paw-print",
    "🐔": "egg",
    "🐧": "bird",
    "🐦": "bird",
    "🐤": "bird",
    "🦆": "bird",
    "🦅": "bird",
    "🦉": "bird",
    "🦇": "bird",
    "🐺": "paw-print",
    "🐗": "paw-print",
    "🐴": "paw-print",
    "🦄": "sparkles",
    "🐝": "bug",
    "🐛": "bug",
    "🦋": "flower",
    "🐌": "snail",
    "🐞": "bug",
    "🐜": "bug",
    "🦗": "bug",
    "🕷": "bug",
    "🦂": "bug",
    "🦀": "shell",
    "🐟": "fish",
    "🐡": "fish",
    "🐬": "fish",
    "🐳": "fish",
    "🐋": "fish",
    "🦈": "fish",
    "🐊": "paw-print",
    "🐅": "paw-print",
    "🐆": "paw-print",
    "🦓": "paw-print",
    "🦍": "paw-print",
    "🦧": "paw-print",
    "🐘": "paw-print",
    "🦛": "paw-print",
    "🦏": "paw-print",
    "🐫": "paw-print",
    "🦒": "paw-print",
    "🐃": "paw-print",
    "🐂": "paw-print",
    "🐄": "paw-print",
    "🐪": "paw-print",
    /* ---- 草木 ---- */
    "🌱": "sprout",
    "🌲": "tree-pine",
    "🌳": "tree-deciduous",
    "🌴": "tree-palm",
    "🌵": "sprout",
    "🌷": "flower",
    "🌸": "flower",
    "🌹": "flower",
    "🌺": "flower-2",
    "🌻": "flower-2",
    "🌼": "flower",
    "🌾": "wheat",
    "🍀": "leaf",
    "🍁": "leaf",
    "🍂": "leaf",
    "🍃": "leaf",
    "🌰": "nut",
    "🎄": "tree-pine",
    /* ---- 虚构/宠物玩偶 ---- */
    "🤖": "bot",
    "👾": "ghost",
    "🐲": "baby",
    "🦖": "baby",
    "🦕": "baby",
    "🐉": "baby",
    "🦐": "shrimp",
    "🦞": "shrimp",
    "🐢": "turtle",
    "🐍": "worm",
    "🦎": "paw-print",
    "🐖": "piggy-bank",
    "🐑": "paw-print",
    "🐐": "paw-print",
    "🐎": "paw-print",
    /* ---- 乐器声响 ---- */
    "🎺": "megaphone",
    "🎷": "megaphone",
    "🪕": "guitar",
    "🎻": "guitar",
    "🎼": "music",
    "🎶": "music",
    "📻": "radio",
    "🎚": "audio-lines",
    "🎛": "sliders-horizontal",
    "📢": "megaphone",
    "📯": "megaphone",
    "🔔": "bell",
    "🪗": "audio-lines",
    "🪘": "drum",
    "🪈": "wind",
    "🎥": "film",
    "💿": "disc",
    "📼": "videotape",
    "🗺": "map",
    "🦟": "bug",
    "🪢": "cable",
    "🪜": "waves-ladder",
    "👑": "crown"
  };
  function splitEmojiCategory(cat) {
    var _a;
    const s = String(cat || "");
    const m = s.match(/^(\p{Extended_Pictographic})\uFE0F?/u);
    if (!m) return { emoji: null, name: s, icon: null };
    return { emoji: m[1], name: s.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, ""), icon: (_a = EMOJI_ICON[m[1]]) != null ? _a : null };
  }

  // src/belongings/shared.ts
  var ICON = {
    add: "plus",
    search: "search",
    close: "x",
    del: "trash-2",
    empty: "package",
    chevD: "chevron-down"
  };
  var STATUS = {
    using: { label: "使用中", key: "using", ic: "check-circle" },
    idle: { label: "闲置", key: "idle", ic: "package" },
    sold: { label: "已转卖", key: "sold", ic: "banknote" },
    discard: { label: "已丢弃", key: "discard", ic: "archive" }
  };
  var STATUS_ORDER = [
    { key: "using", label: "使用中" },
    { key: "idle", label: "闲置" },
    { key: "sold", label: "已转卖" },
    { key: "discard", label: "已丢弃" }
  ];
  var STATUS_LABELS = STATUS_ORDER.map((s) => s.label);
  var SORT_OPTS = [
    { v: "recent", label: "最近购入" },
    { v: "price", label: "投入最高" },
    { v: "daily", label: "日均最高" }
  ];
  function money(n) {
    return "￥" + (Number(n) || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function moneyShort(n) {
    return "￥" + (Number(n) || 0).toLocaleString("zh-CN", { maximumFractionDigits: 0 });
  }
  function todayStr() {
    const d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function catEmoji(cat) {
    const m = String(cat || "").match(/^(\p{Extended_Pictographic})/u);
    return m ? m[1] : String(cat || "")[0] || "📦";
  }
  function catNameOf(cat) {
    return String(cat || "").replace(/^\p{Extended_Pictographic}\s*/u, "");
  }
  function catIconOf(cat) {
    var _a;
    const m = String(cat || "").match(/^(\p{Extended_Pictographic})/u);
    return m ? (_a = EMOJI_ICON[m[1]]) != null ? _a : null : null;
  }
  function catEmHtml(cat) {
    var _a;
    const em = catEmoji(cat);
    const name = catIconOf(cat) || ((_a = EMOJI_ICON[em]) != null ? _a : null);
    return name ? iconSpan(name) : esc(em);
  }
  function itemIconOf(it) {
    var _a;
    const raw = String(it.icon || "").trim();
    if (raw && /^[a-z0-9-]+$/i.test(raw)) return raw;
    return catIconOf(it.category) || ((_a = EMOJI_ICON[catEmoji(it.category)]) != null ? _a : null);
  }
  function itemEmHtml(it) {
    const name = itemIconOf(it);
    return name ? iconSpan(name) : catEmHtml(it.category);
  }
  function statusKeyOf(label) {
    var _a, _b;
    return (_b = (_a = STATUS_ORDER.find((s) => s.label === label)) == null ? void 0 : _a.key) != null ? _b : label;
  }
  function statusOf(keyOrLabel) {
    const byKey = STATUS_ORDER.find((s) => s.key === keyOrLabel);
    if (byKey) return byKey;
    const byLabel = STATUS_ORDER.find((s) => s.label === keyOrLabel);
    return byLabel || { key: "using", label: "使用中" };
  }
  function exitedStatus(st) {
    return st === "已转卖" || st === "已丢弃";
  }
  function isExited(it) {
    return exitedStatus(it.current_status);
  }
  function exitDateOf(it) {
    return isExited(it) ? it.exit_date || null : null;
  }
  function parseLocalDay(raw) {
    const parts = String(raw || "").slice(0, 10).split("-").map(Number);
    const [y, m, d] = parts;
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }
  function daysUsed(it) {
    const start = parseLocalDay(it.purchase_date);
    if (!start) return 0;
    const ex = exitDateOf(it);
    let end = /* @__PURE__ */ new Date();
    if (ex) {
      const parsed = parseLocalDay(ex);
      if (parsed) end = parsed;
    }
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 864e5));
  }
  function dailyCostOf(it) {
    const days = daysUsed(it);
    const price = Number(it.purchase_price) || 0;
    return days > 0 ? price / days : price;
  }
  function inStock(it) {
    return it.current_status === "使用中" || it.current_status === "闲置";
  }
  function stockCount(items) {
    return items.filter(inStock).length;
  }
  function totalAssets(items) {
    return items.filter(inStock).reduce((s, i) => s + (Number(i.purchase_price) || 0), 0);
  }
  function avgDailyCost(items) {
    let cost = 0;
    let days = 0;
    for (const it of items) {
      cost += Number(it.purchase_price) || 0;
      if (it.current_status === "已转卖" && Number(it.sold_price) > 0) cost -= Number(it.sold_price);
      days += daysUsed(it);
    }
    return days ? cost / days : 0;
  }
  function statusCount(items, label) {
    return items.filter((i) => i.current_status === label).length;
  }
  function filtered(items, view) {
    return items.filter((i) => {
      if (!view.status) return true;
      if (view.status === "asset") return inStock(i);
      return i.current_status === statusOf(view.status).label;
    }).filter((i) => view.year ? String(i.purchase_date || "").startsWith(view.year) : true).filter((i) => {
      if (!view.q) return true;
      const q = view.q.toLowerCase();
      return [i.name, i.category, i.description].join(" ").toLowerCase().includes(q);
    }).sort((a, b) => {
      if (view.sort === "price") return (Number(b.purchase_price) || 0) - (Number(a.purchase_price) || 0);
      if (view.sort === "daily") return dailyCostOf(b) - dailyCostOf(a);
      return String(b.purchase_date || "").localeCompare(String(a.purchase_date || "")) || String(a.name || "").localeCompare(String(b.name || ""), "zh");
    });
  }
  function yearsAvailable(items) {
    const set = /* @__PURE__ */ new Set();
    items.forEach((i) => {
      const y = String(i.purchase_date || "").slice(0, 4);
      if (y) set.add(y);
    });
    return [...set].sort().reverse();
  }
  function resolveYear(items, year) {
    return year && yearsAvailable(items).includes(year) ? year : "";
  }
  function heroTitleText(view) {
    if (!view.status) return "全部";
    if (view.status === "asset") return "资产";
    return statusOf(view.status).label;
  }
  function heroSubText(items, view) {
    return view.status ? `归物本 — ${filtered(items, view).length} 件在列 · FILTERED VIEW` : "归物本 — NOTHING MORE, NOTHING LESS";
  }
  function belDetailHtml(it) {
    var _a;
    const gone = isExited(it);
    const key = statusKeyOf(it.current_status);
    return `<div class="bz-bel-detail">
    <div class="bz-bel-detail-head">
      <div class="bz-bel-detail-title">${esc(it.name)}</div>
      <button class="bz-icon-btn" data-bd-close title="关闭">${iconSpan(ICON.close)}</button>
    </div>
    <div class="bz-bel-detail-idrow">
      <span class="bz-bel-cell-em">${itemEmHtml(it)}</span>
      <div class="bz-bel-detail-idinfo">
        <div class="bz-bel-detail-cat">${esc(catNameOf(it.category) || "未分类")}</div>
        <div class="bz-bel-detail-desc">${esc(it.description || "无备注")}</div>
      </div>
      <span class="bz-bel-tag bz-bel-tag--${key}">${iconSpan(((_a = STATUS[key]) == null ? void 0 : _a.ic) || "box", "bz-ic--sm")}${esc(it.current_status)}</span>
    </div>
    <div class="bz-bel-detail-fields">
      <div class="bz-bel-dfield"><span>购买价</span><b>${money(Number(it.purchase_price) || 0)}</b></div>
      <div class="bz-bel-dfield"><span>购买日期</span><b>${esc(String(it.purchase_date || "").slice(0, 10) || "—")} · ${daysUsed(it)} 天</b></div>
      <div class="bz-bel-dfield"><span>日均成本</span><b>￥${dailyCostOf(it).toFixed(2)}${gone ? "（已封口）" : "/天 · 越用越便宜"}</b></div>
      ${gone ? `<div class="bz-bel-dfield"><span>出离日期</span><b>${esc(it.exit_date || "—")}${it.current_status === "已转卖" && Number(it.sold_price) > 0 ? " · 售出 " + money(Number(it.sold_price)) : ""}</b></div>` : ""}
      <div class="bz-bel-dfield"><span>录入 / 更新</span><b>${esc(String(it.created_date || "").slice(0, 10))} / ${esc(String(it.last_updated || "").slice(0, 10))}</b></div>
    </div>
    <div class="bz-bel-detail-acts" data-bd-acts></div>
    <div class="bz-btn-row bz-bel-detail-btns">
      <div class="bz-bel-form-spacer"></div>
      <button type="button" class="bz-btn bz-btn--ghost" data-bd-edit>${iconSpan("pencil", "bz-ic--sm")} 编辑</button>
      <button type="button" class="bz-btn bz-btn--primary bz-bel-delbtn" data-bd-del>${iconSpan(ICON.del, "bz-ic--sm")} 删除</button>
    </div>
  </div>`;
  }
  function flowBtnsHtml(curStatus) {
    return STATUS_LABELS.map(
      (s) => `<button type="button" class="bz-bel-flowbtn${s === curStatus ? " is-cur" : ""}${s === "闲置" ? " bz-bel-c2" : ""}" data-bd-flow="${esc(s)}">${esc(s)}</button>`
    ).join("");
  }
  function belFormInit(it) {
    var _a, _b, _c;
    return {
      priceVal: it ? String((_a = it.purchase_price) != null ? _a : "") : "",
      dateVal: it ? String(it.purchase_date || "").slice(0, 10) : todayStr(),
      catVal: (_b = it == null ? void 0 : it.category) != null ? _b : "",
      // 新记不回填默认分类（issue 202），留空待选
      descVal: (_c = it == null ? void 0 : it.description) != null ? _c : "",
      // 出离字段初值（ADR-0089）：编辑回填 exit_date；新记 = 今天
      exitDateVal: (it == null ? void 0 : it.exit_date) ? String(it.exit_date).slice(0, 10) : todayStr(),
      soldPriceVal: (it == null ? void 0 : it.sold_price) != null && Number.isFinite(Number(it.sold_price)) ? String(it.sold_price) : "",
      exitedInit: !!it && isExited(it)
    };
  }
  function belFormHtml(it) {
    var _a;
    const editing = !!it;
    const { priceVal, dateVal, catVal, descVal, exitDateVal, soldPriceVal, exitedInit } = belFormInit(it);
    return `
  <div class="bz-bel-form">
    <div class="bz-bel-form-title">${editing ? "编辑物品" : "记一笔"}</div>
    <div class="bz-bel-form-body">
      <div class="bz-field"><span class="bz-field-label">名称</span><input class="bz-input" id="bm-name" value="${esc((_a = it == null ? void 0 : it.name) != null ? _a : "")}" placeholder="如：iPhone 15 Pro"></div>
      <div class="bz-field"><span class="bz-field-label">分类</span><span class="bz-bel-catrow"><span class="bz-bel-form-icon" id="bm-icon" title="分类图标（AI 归类或选历史分类自动带上）"></span><input class="bz-input" id="bm-cat" value="${esc(catVal)}" placeholder="输入或从历史分类选择" autocomplete="off"><button type="button" class="bz-icon-btn bz-bel-aibtn" id="bm-ai" title="AI 归类：按名称建议分类与图标">${iconSpan("sparkles", "bz-ic--sm")}</button></span></div>
      <div class="bz-bel-form-row">
        <div class="bz-field"><span class="bz-field-label">购买价格（元）</span><input class="bz-input" id="bm-price" type="number" min="0" step="0.01" value="${esc(priceVal)}" placeholder="0.00"></div>
        <div class="bz-field"><span class="bz-field-label">购买日期</span><input class="bz-input" id="bm-date" type="date" value="${esc(dateVal)}"></div>
      </div>
      <div class="bz-field"><span class="bz-field-label">状态</span><span class="bz-bel-statuspick" id="bm-status"></span></div>
      <div class="bz-bel-form-row" id="bm-exit"${exitedInit ? "" : " hidden"}>
        <div class="bz-field"><span class="bz-field-label">出离日期</span><input class="bz-input" id="bm-exitdate" type="date" value="${esc(exitDateVal)}"></div>
        <div class="bz-field" id="bm-soldfield"${(it == null ? void 0 : it.current_status) === "已转卖" ? "" : " hidden"}><span class="bz-field-label">转卖售价（可选）</span><input class="bz-input" id="bm-soldprice" type="number" min="0" step="0.01" value="${esc(soldPriceVal)}" placeholder="留空不记售价"></div>
      </div>
      <div class="bz-field"><span class="bz-field-label">描述（可选）</span><textarea class="bz-input" id="bm-desc" placeholder="规格、颜色、购买原因等…">${esc(descVal)}</textarea></div>
      <div class="bz-bel-form-err" id="bm-err"></div>
      <div class="bz-btn-row bz-bel-form-actions">
        <div class="bz-bel-form-spacer"></div>
        <button type="button" class="bz-btn bz-btn--ghost" data-bm-cancel>取消</button>
        <button type="button" class="bz-btn bz-btn--primary" id="bm-save">${editing ? "更新" : "保存"}</button>
      </div>
    </div>
  </div>`;
  }
  function statusPickHtml(curStatus) {
    return STATUS_LABELS.map(
      (s) => {
        var _a;
        return `<button type="button" class="bz-choice-btn${s === curStatus ? " is-on" : ""}${s === "闲置" ? " bz-bel-c2" : ""}" data-status="${esc(s)}">${iconSpan(((_a = STATUS[statusKeyOf(s)]) == null ? void 0 : _a.ic) || "box", "bz-ic--sm")}${esc(s)}</button>`;
      }
    ).join("");
  }
  function sheetHeadHtml(it) {
    const catName = catNameOf(it.category);
    const days = daysUsed(it);
    return `<div class="bz-item-sheet-entry"><div class="bz-bel-sheet-head">
      <span class="bz-item-sheet-emoji">${itemEmHtml(it)}</span>
      <div class="bz-bel-sheet-info"><div class="bz-item-sheet-title">${esc(it.name)}</div>
      <div class="bz-item-sheet-sub">${esc(catName)} · ${money(Number(it.purchase_price) || 0)} · 已用 ${days} 天</div></div></div></div>`;
  }
  function actionSpecs(it) {
    const specs = [];
    STATUS_LABELS.forEach((s) => {
      var _a;
      if (s === it.current_status) return;
      specs.push({ icon: ((_a = STATUS[statusKeyOf(s)]) == null ? void 0 : _a.ic) || "box", label: `标记为${s}`, act: "flow", status: s, keepOpen: true });
    });
    specs.push({ icon: "pencil", label: "编辑", act: "edit", keepOpen: true });
    specs.push({ icon: "trash-2", label: "删除", act: "del", danger: true });
    return specs;
  }

  // src/belongings/layouts/poster/render.ts
  function panelHtml() {
    return `<div class="bz-bel-panel bz-panel-frame bz-panel-mtop bz-bel--poster">
  <div class="bz-bel-body">
    <div class="bz-bel-hero">
      <div class="bz-bel-hero-text">
        <div class="bz-bel-hero-title" data-bel-herotitle>全部</div>
        <div class="bz-bel-hero-sub" data-bel-herosub>归物本 — NOTHING MORE, NOTHING LESS</div>
      </div>
      <div class="bz-bel-kpis" data-bel-kpis></div>
      <div class="bz-bel-mobhead">
        <div class="bz-bel-stamp"><b data-bel-stampn>0</b><span>在库</span></div>
        <div class="bz-bel-mobhead-tx">
          <div class="bz-bel-mobhead-t">归物本</div>
          <div class="bz-bel-mobhead-sub" data-bel-mobstats></div>
        </div>
        <button class="bz-icon-btn bz-icon-btn--lg bz-touch-target bz-bel-mob-only" data-bel-close title="关闭">${iconSpan(ICON.close)}</button>
      </div>
    </div>
    <div class="bz-bel-chips" data-bel-chips></div>
    <div class="bz-toolrow bz-bel-toolrow">
      <div class="bz-search">${iconSpan(ICON.search)}<input class="bz-input" type="text" data-bel-search placeholder="搜索名称 / 分类…"></div>
      <div class="bz-bel-yearsel">
        <div class="bz-bel-select" data-bel-year role="button" tabindex="0" aria-haspopup="listbox"><span class="bz-bel-select-label">全部年份</span>${iconSpan(ICON.chevD, "bz-bel-select-chev")}</div>
        <div class="bz-bel-dropmenu" data-bel-yearmenu role="listbox"></div>
      </div>
      <div class="bz-bel-yearsel bz-bel-mobsortsel-wrap">
        <div class="bz-bel-select" data-bel-mobsortsel role="button" tabindex="0" aria-haspopup="listbox"><span class="bz-bel-select-label">最近购入</span>${iconSpan(ICON.chevD, "bz-bel-select-chev")}</div>
        <div class="bz-bel-dropmenu" data-bel-mobsortmenu role="listbox"></div>
      </div>
      <div class="bz-bel-sort" data-bel-sort></div>
      <button class="bz-btn bz-btn--md bz-bel-addbtn" data-bel-add>${iconSpan(ICON.add, "bz-ic--sm")} 记一笔</button>
    </div>
    <div class="bz-mobstrip" data-bel-mobstatus></div>
    <div class="bz-bel-content" data-bel-content></div>
    <button class="bz-btn bz-btn--md bz-bel-mobadd" data-bel-add>${iconSpan(ICON.add, "bz-ic--sm")} 记一笔</button>
  </div>
</div>`;
  }
  function chipsHtml(items, view) {
    const defs = [
      { key: "__all", label: "全部", cnt: items.length },
      { key: "asset", label: "资产", cnt: stockCount(items) },
      ...STATUS_ORDER.map((s) => ({ key: s.key, label: s.label, cnt: statusCount(items, s.label) }))
    ];
    return defs.map((d) => {
      const active = d.key === "__all" ? view.status === null : view.status === d.key;
      return `<button type="button" class="bz-chip${active ? " bz-chip--on" : ""}" data-bel-st="${d.key}"><span>${esc(d.label)}</span><span class="bz-chip-cnt">${d.cnt}</span></button>`;
    }).join("");
  }
  function mobChipsHtml(items, view) {
    const defs = [
      { key: "__all", label: "全部", cnt: items.length },
      ...STATUS_ORDER.map((s) => ({ key: s.key, label: s.label, cnt: statusCount(items, s.label) }))
    ];
    return defs.map((d) => {
      const active = d.key === "__all" ? view.status === null : view.status === d.key;
      return `<button class="bz-mobstrip-chip${active ? " is-on" : ""}" data-bel-st="${d.key}"><span>${esc(d.label)}</span><span class="bz-chip-cnt">${d.cnt}</span></button>`;
    }).join("");
  }
  function yearsOptionsHtml(items, cur) {
    return '<div class="bz-bel-dropopt' + (cur === "" ? " is-cur" : "") + '" data-v="" role="option">全部年份</div>' + yearsAvailable(items).map((y) => `<div class="bz-bel-dropopt${cur === y ? " is-cur" : ""}" data-v="${y}" role="option">${y}</div>`).join("");
  }
  function sortOptionsHtml(cur) {
    return SORT_OPTS.map((o) => `<div class="bz-bel-dropopt${cur === o.v ? " is-cur" : ""}" data-v="${o.v}" role="option">${o.label}</div>`).join("");
  }
  function segmentedHtml(sort) {
    return `<div class="bz-segmented" role="radiogroup" aria-label="排序">${SORT_OPTS.map((o) => `<button type="button" class="bz-segmented-btn${sort === o.v ? " is-on" : ""}" data-k="${o.v}" role="radio" aria-checked="${sort === o.v}">${o.label}</button>`).join("")}</div>`;
  }
  function kpisHtml(items) {
    const gone = items.filter(isExited);
    const recover = gone.reduce((s, i) => s + (Number(i.sold_price) || 0), 0);
    const kpi = (num, label, opts = {}) => `<div class="bz-bel-kpi${opts.hero ? " bz-bel-kpi--hero" : ""}${opts.click ? " bz-bel-kpi--click" : ""}"${opts.click ? ' data-bel-statclick="asset" title="只看在库（使用中与闲置）"' : ""}><b>${num}</b><span>${esc(label)}</span></div>`;
    return kpi(String(stockCount(items)), "在库件数", { hero: true, click: true }) + kpi(moneyShort(totalAssets(items)), "在库投入", { click: true }) + kpi("￥" + avgDailyCost(items).toFixed(2), "日均成本") + kpi(`${gone.length} 件 · ${moneyShort(recover)}`, "已离场 · 回收");
  }
  function stampCount(items) {
    return String(stockCount(items));
  }
  function mobStatsText(items) {
    return `投入 ${moneyShort(totalAssets(items))} · 日均 ${avgDailyCost(items).toFixed(2)}`;
  }
  function emptyHtml(noMatch) {
    return `<div class="bz-empty">${iconSpan(ICON.empty, "bz-empty-ic")}<div class="bz-empty-title">${noMatch ? "没有符合条件的物品" : "这里还没有物品"}</div><div class="bz-empty-desc">${noMatch ? "换个筛选条件，或清除搜索" : "点「记一笔」登记第一个物品"}</div></div>`;
  }
  function cellHtml(it, idx) {
    var _a;
    const gone = isExited(it);
    const idle = it.current_status === "闲置";
    const days = daysUsed(it);
    const daily = dailyCostOf(it);
    const key = statusKeyOf(it.current_status);
    const exitNote = gone ? `${it.exit_date ? " → " + esc(String(it.exit_date).slice(0, 10)) : ""}${it.current_status === "已转卖" && Number(it.sold_price) > 0 ? " · 售出 " + moneyShort(Number(it.sold_price)) : ""}` : "";
    const dailyStr = daily < 0.01 ? daily.toFixed(4) : daily.toFixed(2).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    const mut = gone ? `${esc(String(it.purchase_date || "").slice(0, 10) || "日期未知")} 起 · 陪伴 ${days || "—"} 天${exitNote}` : `${esc(String(it.purchase_date || "").slice(0, 10) || "日期未知")} 起 · ${days || "—"} 天 · 日均 ￥${dailyStr}`;
    return `<div class="bz-bel-cell${gone ? " bz-bel-cell--gone" : ""}${idle ? " bz-bel-cell--idle" : ""}" data-bel-id="${esc(it.id)}">
    <span class="bz-bel-cell-idx">NO.${String(idx + 1).padStart(2, "0")} — ${esc(catNameOf(it.category) || "未分类")}</span>
    <span class="bz-bel-tag bz-bel-tag--${key}">${iconSpan(((_a = STATUS[key]) == null ? void 0 : _a.ic) || "box", "bz-ic--sm")}${esc(it.current_status)}</span>
    <span class="bz-bel-cell-em">${itemEmHtml(it)}</span>
    <span class="bz-bel-name">${esc(it.name)}</span>
    <span class="bz-bel-price">${moneyShort(Number(it.purchase_price) || 0)}</span>
    <span class="bz-bel-mut">${mut}</span>
  </div>`;
  }
  function gridHtml(items, view) {
    return `<div class="bz-bel-grid" data-bel-grid>${filtered(items, view).map((it, idx) => cellHtml(it, idx)).join("")}</div>`;
  }
  function renderPanelView(root, items, view, hooks) {
    var _a;
    const q = (sel) => root.querySelector(sel);
    const title = q("[data-bel-herotitle]");
    if (title) title.textContent = heroTitleText(view);
    const sub = q("[data-bel-herosub]");
    if (sub) sub.textContent = heroSubText(items, view);
    const chips = q("[data-bel-chips]");
    if (chips) chips.innerHTML = chipsHtml(items, view);
    const mob = q("[data-bel-mobstatus]");
    if (mob) mob.innerHTML = mobChipsHtml(items, view);
    view.year = resolveYear(items, view.year);
    const yearSel = q("[data-bel-year]");
    if (yearSel) {
      yearSel.querySelector(".bz-bel-select-label").textContent = view.year || "全部年份";
      const menu = q("[data-bel-yearmenu]");
      if (menu) menu.innerHTML = yearsOptionsHtml(items, view.year);
    }
    const wrap = q("[data-bel-kpis]");
    if (wrap) wrap.innerHTML = kpisHtml(items);
    const stampN = q("[data-bel-stampn]");
    if (stampN) stampN.textContent = stampCount(items);
    const mobStats = q("[data-bel-mobstats]");
    if (mobStats) mobStats.textContent = mobStatsText(items);
    const sortHost = q("[data-bel-sort]");
    if (sortHost) sortHost.innerHTML = segmentedHtml(view.sort);
    const mobSortSel = q("[data-bel-mobsortsel]");
    if (mobSortSel) {
      mobSortSel.querySelector(".bz-bel-select-label").textContent = ((_a = SORT_OPTS.find((o) => o.v === view.sort)) != null ? _a : SORT_OPTS[0]).label;
      const menu = q("[data-bel-mobsortmenu]");
      if (menu) menu.innerHTML = sortOptionsHtml(view.sort);
    }
    const content = q("[data-bel-content]");
    if (!content) return;
    const list = filtered(items, view);
    if (!list.length) {
      const noMatch = !!view.q || view.status !== null || view.year !== "";
      content.innerHTML = emptyHtml(noMatch);
    } else {
      content.innerHTML = gridHtml(items, view);
      const gridEl = content.querySelector("[data-bel-grid]");
      const cols = (getComputedStyle(gridEl).gridTemplateColumns || "").split(" ").filter(Boolean).length || 1;
      const rem = list.length % cols;
      if (rem) gridEl.insertAdjacentHTML("beforeend", `<div class="bz-bel-filler" style="grid-column:span ${cols - rem}"></div>`);
    }
    hooks.mountIcons(content);
  }
  return __toCommonJS(render_exports);
})();
