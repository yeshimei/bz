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

// src/main.ts
var main_exports = {};
__export(main_exports, {
  DiaryNotebookSettingTab: () => DiaryNotebookSettingTab,
  applySettingsToRuntime: () => applySettingsToRuntime,
  default: () => DiaryNotebookPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian8 = require("obsidian");

// src/core/esc-manager.ts
var escManager = (() => {
  const layers = [];
  const onKeydown = (e) => {
    if (e.key !== "Escape") return;
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      try {
        if (L.isVisible()) {
          L.close();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      } catch (err) {
        layers.splice(i, 1);
      }
    }
  };
  document.addEventListener("keydown", onKeydown);
  return {
    register(id, layer) {
      for (let i = layers.length - 1; i >= 0; i--) {
        if (layers[i].id === id && !layers[i].isVisible()) layers.splice(i, 1);
      }
      const rec = Object.assign({ id }, layer);
      layers.push(rec);
      return {
        unregister: () => {
          const i = layers.indexOf(rec);
          if (i !== -1) layers.splice(i, 1);
        }
      };
    },
    /** 插件卸载时移除全局监听 */
    destroy() {
      document.removeEventListener("keydown", onKeydown);
    }
  };
})();

// src/diary/app.ts
var app = null;
function setApp(a) {
  app = a;
}
function getApp() {
  if (!app) throw new Error("app \u5C1A\u672A\u6CE8\u5165\uFF08\u63D2\u4EF6\u672A\u52A0\u8F7D\u6216\u6D4B\u8BD5\u672A setApp\uFF09");
  return app;
}

// src/diary/config.ts
var DIARY_DIRECTORY = "\u6211\u7684/\u65E5\u8BB0";
var MOVIE_DIRECTORY = "\u6211\u7684/\u5F71\u89C6";
var LETTER_DIRECTORY = "\u6211\u7684/\u4FE1";
var BATCH_SIZE = 20;
var LONG_PRESS_DURATION = 800;
function applyDirectories(settings) {
  DIARY_DIRECTORY = settings.diaryDirectory || "\u6211\u7684/\u65E5\u8BB0";
  MOVIE_DIRECTORY = settings.movieDirectory || "\u6211\u7684/\u5F71\u89C6";
  LETTER_DIRECTORY = settings.letterDirectory || "\u6211\u7684/\u4FE1";
  BATCH_SIZE = parseInt(settings.batchSize || "") || 20;
  LONG_PRESS_DURATION = parseInt(settings.longPressDuration || "") || 800;
}
function getPrimaryTagsConfig() {
  return PRIMARY_TAGS_CONFIG;
}
var DEFAULT_TAGS_CONFIG = {
  \u65E5\u8BB0: { emoji: "\u{1F4D6}" },
  \u5FF5\u5FF5\u788E: { emoji: "\u{1F636}" },
  \u5BF9\u8C08: { emoji: "\u{1F91D}" },
  \u968F\u7B14: { emoji: "\u270D\uFE0F" },
  \u68A6: { emoji: "\u{1F319}" },
  \u8BD7: { emoji: "\u{1F31F}" },
  \u4E66: { emoji: "\u{1F4D5}" },
  \u4FE1: { emoji: "\u2709\uFE0F" },
  \u6458\u6284: { emoji: "\u{1F4CC}" },
  \u6444\u5F71: { emoji: "\u{1F4F8}" },
  \u9A91\u884C: { emoji: "\u{1F6B4}" },
  \u4EE3\u7801: { emoji: "\u2699\uFE0F" },
  \u505A\u996D: { emoji: "\u{1F958}" },
  \u6E38\u620F: { emoji: "\u{1F3AE}" },
  \u97F3\u4E50: { emoji: "\u{1F3A7}" },
  \u7535\u5F71: { emoji: "\u{1F4FD}" },
  \u7535\u89C6\u5267: { emoji: "\u{1F4FA}" },
  \u52A8\u6F2B: { emoji: "\u{1F3A8}" },
  \u7EAA\u5F55\u7247: { emoji: "\u{1F39E}" },
  \u732B: { emoji: "\u{1F431}" },
  \u72D7: { emoji: "\u{1F436}" },
  \u4ED3\u9F20: { emoji: "\u{1F439}" },
  \u718A\u732B: { emoji: "\u{1F43C}" },
  \u535A\u7269\u9986: { emoji: "\u{1F3DB}\uFE0F" },
  \u7F8E\u98DF: { emoji: "\u{1F354}" },
  \u65C5\u6E38: {
    emoji: "\u2708\uFE0F",
    subTags: [
      { tag: "\u56DB\u5DDD", emoji: "\u{1F004}" },
      { tag: "\u5927\u7406", emoji: "\u{1F6F6}" }
    ]
  },
  \u6536\u85CF: {
    emoji: "\u2B50",
    subTags: [
      { tag: "\u54AA\u54AA", emoji: "\u{1F408}" },
      { tag: "\u5E7F\u544A", emoji: "\u{1F4E2}" },
      { tag: "\u795E\u8BC4", emoji: "\u{1F923}" },
      { tag: "\u51B7\u7B11\u8BDD", emoji: "\u{1F605}" },
      { tag: "\u62BD\u8C61", emoji: "\u{1F300}" },
      { tag: "AI", emoji: "\u{1F916}" },
      { tag: "\u611A\u4EBA\u8282", emoji: "\u{1F92A}" },
      { tag: "\u821E\u8E48", emoji: "\u{1F57A}" },
      { tag: "\u8FBE\u4EBA\u79C0", emoji: "\u{1F939}" },
      { tag: "\u827A\u672F", emoji: "\u{1F9D1}\u200D\u{1F3A8}" },
      { tag: "\u6444\u5F71\u96C6", emoji: "\u{1F4F7}" },
      { tag: "\u690D\u7269", emoji: "\u{1F333}" },
      { tag: "\u521B\u610F", emoji: "\u{1F9E9}" }
    ]
  }
};
var PRIMARY_TAGS_CONFIG = JSON.parse(JSON.stringify(DEFAULT_TAGS_CONFIG));
var tagToEmojiMap = {};
var emojiToTagMap = {};
function buildTagMaps() {
  for (const key of Object.keys(tagToEmojiMap)) delete tagToEmojiMap[key];
  for (const key of Object.keys(emojiToTagMap)) delete emojiToTagMap[key];
  for (const [tag, config] of Object.entries(PRIMARY_TAGS_CONFIG)) {
    tagToEmojiMap[tag] = config.emoji;
    emojiToTagMap[config.emoji] = tag;
    if (config.subTags) {
      for (const sub of config.subTags) {
        tagToEmojiMap[sub.tag] = sub.emoji;
        emojiToTagMap[sub.emoji] = sub.tag;
      }
    }
  }
}
function getTagEmoji(tag) {
  return tagToEmojiMap[tag] || "\u{1F4D6}";
}
function getAllAvailableTags() {
  const tags = [];
  for (const [tag, config] of Object.entries(PRIMARY_TAGS_CONFIG)) {
    tags.push(tag);
    if (config.subTags) {
      for (const sub of config.subTags) {
        tags.push(sub.tag);
      }
    }
  }
  return tags;
}
function getSubTagsOfPrimary(primaryTag) {
  const config = PRIMARY_TAGS_CONFIG[primaryTag];
  return config && config.subTags ? config.subTags : null;
}
function isSubTag(tag) {
  for (const [, config] of Object.entries(PRIMARY_TAGS_CONFIG)) {
    if (config.subTags && config.subTags.some((sub) => sub.tag === tag)) {
      return true;
    }
  }
  return false;
}
function getParentPrimaryTag(subTag) {
  for (const [primary, config] of Object.entries(PRIMARY_TAGS_CONFIG)) {
    if (config.subTags && config.subTags.some((sub) => sub.tag === subTag)) {
      return primary;
    }
  }
  return null;
}
function parseTagConfig(text) {
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  const config = {};
  for (const line of lines) {
    if (line.includes(">")) {
      const parts = line.split(">").map((s) => s.trim());
      const mainPart = parts[0];
      const subPart = parts.slice(1).join(">").trim();
      const mainMatch = mainPart.match(/^(.+?)\s+(\S+)$/);
      if (!mainMatch) continue;
      const mainTag = mainMatch[1].trim();
      const mainEmoji = mainMatch[2].trim();
      const subItems = subPart.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      const subTags = [];
      for (const item of subItems) {
        const subMatch = item.match(/^(.+?)\s+(\S+)$/);
        if (subMatch) {
          subTags.push({ tag: subMatch[1].trim(), emoji: subMatch[2].trim() });
        }
      }
      config[mainTag] = { emoji: mainEmoji, subTags };
    } else {
      const match = line.match(/^(.+?)\s+(\S+)$/);
      if (match) {
        const tag = match[1].trim();
        const emoji = match[2].trim();
        config[tag] = { emoji };
      }
    }
  }
  return config;
}
function applyTagsConfig(rawConfig) {
  if (rawConfig && rawConfig.trim()) {
    const trimmed = rawConfig.trim();
    if (trimmed.startsWith("{")) {
      try {
        PRIMARY_TAGS_CONFIG = JSON.parse(trimmed);
      } catch (e) {
        console.warn("JSON \u89E3\u6790\u5931\u8D25\uFF0C\u5C1D\u8BD5\u6587\u672C\u683C\u5F0F");
        PRIMARY_TAGS_CONFIG = parseTagConfig(trimmed);
      }
    } else {
      PRIMARY_TAGS_CONFIG = parseTagConfig(trimmed);
    }
  }
  buildTagMaps();
}
function getSortedTagsForAddDialog() {
  const result = [];
  for (const [primary, config] of Object.entries(PRIMARY_TAGS_CONFIG)) {
    if (config.subTags && config.subTags.length > 0) {
      for (const sub of config.subTags) {
        result.push(sub.tag);
      }
    } else {
      result.push(primary);
    }
  }
  return result;
}

// src/diary/store.ts
var import_obsidian2 = require("obsidian");

// src/diary/parser.ts
var import_obsidian = require("obsidian");
function isEncryptedEntry(entry) {
  return typeof entry.content === "string" && entry.content.includes("\u{1F510}");
}
function parseFile(content, dateStr) {
  const entries = [];
  const lines = content.split("\n");
  let currentEntry = null;
  let contentLines = [];
  const headingRegex = /^#\s*((?:\S+)+)\s+(\d{2}:\d{2})/u;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(headingRegex);
    if (headingMatch) {
      if (currentEntry) {
        currentEntry.content = contentLines.join("\n").trim();
        entries.push(currentEntry);
        contentLines = [];
      }
      const emojiSequence = headingMatch[1];
      const time = headingMatch[2];
      const [hours, minutes] = time.split(":").map(Number);
      if (isNaN(hours) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) continue;
      const timeValue = hours * 100 + minutes;
      const segmenter = new Intl.Segmenter(void 0, { granularity: "grapheme" });
      const segments = segmenter.segment(emojiSequence);
      const tags = [];
      for (const seg of segments) {
        const ch = seg.segment;
        const mappedTag = emojiToTagMap[ch];
        if (mappedTag) {
          tags.push(mappedTag);
        }
      }
      if (tags.length === 0) {
        tags.push("\u65E5\u8BB0");
      }
      currentEntry = {
        date: dateStr,
        time,
        timeValue,
        tags,
        emoji: emojiSequence,
        content: "",
        filename: dateStr,
        lineNumber: i + 1
      };
    } else if (currentEntry) {
      if (line.trim() === "" && i + 1 < lines.length && lines[i + 1].match(/^#\s/)) {
        currentEntry.content = contentLines.join("\n").trim();
        entries.push(currentEntry);
        currentEntry = null;
        contentLines = [];
      } else {
        contentLines.push(line);
      }
    }
  }
  if (currentEntry) {
    currentEntry.content = contentLines.join("\n").trim();
    entries.push(currentEntry);
  }
  for (const entry of entries) {
    if (entry.type !== void 0) {
      entry.tags = [entry.type];
      delete entry.type;
    }
    if (!entry.tags || entry.tags.length === 0) {
      entry.tags = ["\u65E5\u8BB0"];
    }
    entry.emoji = entry.tags.map((tag) => getTagEmoji(tag)).join("");
  }
  return entries;
}
function getFileFrontmatter(file) {
  const cache = getApp().metadataCache.getFileCache(file);
  return cache && cache.frontmatter ? cache.frontmatter : null;
}
async function getFileTimeParts(file) {
  const stat = await file.stat;
  const createTime = stat.ctime || stat.birthtime;
  const m = (0, import_obsidian.moment)(createTime);
  return { timeStr: m.format("HH:mm"), timeValue: parseInt(m.format("HHmm")) };
}
function makeEntryId(prefix, file, dateStr) {
  return `${prefix}-${file.path.replace(/\//g, "-")}-${dateStr}`;
}
async function parseMovieFile(file) {
  try {
    const fm = getFileFrontmatter(file);
    if (!fm) return null;
    let review = fm["\u5F71\u8BC4"];
    if (!review || review.trim() === "") return null;
    let dateStr = fm["\u89C2\u5F71\u65E5\u671F"];
    if (!dateStr || !(0, import_obsidian.moment)(dateStr, "YYYY-MM-DD", true).isValid()) return null;
    dateStr = (0, import_obsidian.moment)(dateStr).format("YYYY-MM-DD");
    let poster = fm["\u6D77\u62A5"];
    const { timeStr, timeValue } = await getFileTimeParts(file);
    let rawTag = "";
    if (fm.tags && Array.isArray(fm.tags) && fm.tags.length > 0) {
      rawTag = fm.tags[0];
    } else if (fm.tags && typeof fm.tags === "string") {
      rawTag = fm.tags;
    }
    let mainTag = "\u65E5\u8BB0";
    if (rawTag === "\u7535\u5F71") mainTag = "\u7535\u5F71";
    else if (rawTag === "\u7EAA\u5F55\u7247") mainTag = "\u7EAA\u5F55\u7247";
    else if (rawTag.endsWith("\u5267")) mainTag = "\u7535\u89C6\u5267";
    else if (rawTag.endsWith("\u6F2B")) mainTag = "\u52A8\u6F2B";
    else if (rawTag === "\u7535\u89C6\u5267") mainTag = "\u7535\u89C6\u5267";
    else if (rawTag === "\u52A8\u6F2B") mainTag = "\u52A8\u6F2B";
    const fileNameWithoutExt = file.basename;
    const content = `${review.trim()}

![[${poster}]]

#${fileNameWithoutExt}`;
    return {
      date: dateStr,
      time: timeStr,
      timeValue,
      tags: [mainTag],
      emoji: getTagEmoji(mainTag),
      content,
      filename: file.path,
      lineNumber: 0,
      id: makeEntryId("movie", file, dateStr)
    };
  } catch (err) {
    console.error(`\u89E3\u6790\u5F71\u89C6\u6587\u4EF6\u5931\u8D25 ${file.path}:`, err);
    return null;
  }
}
async function parseLetterFile(file) {
  try {
    const fm = getFileFrontmatter(file);
    if (!fm) return null;
    if (fm.readonly === true) return null;
    let dateStr = fm.date;
    if (!dateStr) return null;
    let parsed = (0, import_obsidian.moment)(dateStr, ["YYYY-MM-DD", "YYYY-MM-DD HH:mm"], true);
    if (!parsed.isValid()) {
      parsed = (0, import_obsidian.moment)(dateStr);
      if (!parsed.isValid()) return null;
    }
    const dateFormatted = parsed.format("YYYY-MM-DD");
    const fullContent = await getApp().vault.read(file);
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
    const match = fullContent.match(frontmatterRegex);
    let body = fullContent;
    if (match) {
      body = fullContent.slice(match[0].length);
    }
    body = body.trim();
    const title = file.basename;
    const entryContent = `**${title}**

${body}`.trim();
    const { timeStr, timeValue } = await getFileTimeParts(file);
    return {
      date: dateFormatted,
      time: timeStr,
      timeValue,
      tags: ["\u4FE1"],
      emoji: getTagEmoji("\u4FE1"),
      content: entryContent,
      filename: file.path,
      lineNumber: 0,
      id: makeEntryId("letter", file, dateFormatted)
    };
  } catch (err) {
    console.error(`\u89E3\u6790\u4FE1\u6587\u4EF6\u5931\u8D25 ${file.path}:`, err);
    return null;
  }
}
function parseNaturalTime(input) {
  if (!input) return null;
  const now = (0, import_obsidian.moment)();
  const lower = input.toLowerCase().trim();
  const relMatch = lower.match(/^(\d+)\s*(分钟?|小时?|天|秒)前$/);
  if (relMatch) {
    const num = parseInt(relMatch[1], 10);
    const unit = relMatch[2];
    if (unit.startsWith("\u5206")) return now.clone().subtract(num, "minutes");
    if (unit.startsWith("\u5C0F")) return now.clone().subtract(num, "hours");
    if (unit === "\u5929") return now.clone().subtract(num, "days");
    if (unit === "\u79D2") return now.clone().subtract(num, "seconds");
  }
  const yesterdayMatch = lower.match(/^昨天\s*(\d{1,2}:\d{2})$/);
  if (yesterdayMatch) {
    const time = yesterdayMatch[1];
    const yesterday = now.clone().subtract(1, "days");
    return (0, import_obsidian.moment)(`${yesterday.format("YYYY-MM-DD")} ${time}`, "YYYY-MM-DD HH:mm", true);
  }
  const beforeYesterdayMatch = lower.match(/^前天\s*(\d{1,2}:\d{2})$/);
  if (beforeYesterdayMatch) {
    const time = beforeYesterdayMatch[1];
    const before = now.clone().subtract(2, "days");
    return (0, import_obsidian.moment)(`${before.format("YYYY-MM-DD")} ${time}`, "YYYY-MM-DD HH:mm", true);
  }
  const std = (0, import_obsidian.moment)(input, "YYYY-MM-DD HH:mm", true);
  if (std.isValid()) return std;
  return null;
}

// src/diary/state.ts
var state = {
  ui: {
    tagFilterPopup: null,
    maskLayer: null,
    entriesContainer: null,
    scrollContainer: null,
    isTouchDevice: false,
    editingEntryId: null,
    isPopupShown: false,
    singleSelectedTagForDisplay: null
  },
  data: {
    selectedTags: /* @__PURE__ */ new Set(),
    originalDiaryEntries: [],
    currentFilteredEntries: [],
    currentDisplayCount: 0,
    isLoadingMore: false,
    currentDateFilter: null,
    currentSearchKeyword: "",
    searchDebounceTimer: null,
    isLoadingData: false
  },
  events: {
    fileModifyHandler: null,
    isInternalUpdate: false,
    fileListenerAttached: false
  }
};
var diaryDataMap = null;
function setDiaryDataMap(map) {
  diaryDataMap = map;
}
var currentActiveParentForSub = null;
function setCurrentActiveParentForSub(tag) {
  currentActiveParentForSub = tag;
}
function getCurrentActiveParentForSub() {
  return currentActiveParentForSub;
}

// src/diary/store.ts
var fullRefreshCallbacks = [];
var lightRefreshCallbacks = [];
var progressCallbacks = [];
var loadingCallbacks = [];
function onFullRefresh(cb) {
  fullRefreshCallbacks.push(cb);
}
function onLightRefresh(cb) {
  lightRefreshCallbacks.push(cb);
}
function onProgress(cb) {
  progressCallbacks.push(cb);
}
function onLoadingChange(cb) {
  loadingCallbacks.push(cb);
}
function emitFullRefresh() {
  fullRefreshCallbacks.forEach((cb) => cb());
}
function emitLightRefresh() {
  lightRefreshCallbacks.forEach((cb) => cb());
}
function emitProgress(loaded, total) {
  progressCallbacks.forEach((cb) => cb(loaded, total));
}
function emitLoading(loading) {
  loadingCallbacks.forEach((cb) => cb(loading));
}
var fileChangeDelay = 100;
function setFileChangeDelay(v) {
  fileChangeDelay = v;
}
var isProcessingRemainingFiles = false;
function getIsProcessingRemainingFiles() {
  return isProcessingRemainingFiles;
}
function sortEntries(entries) {
  entries.sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    return dateCmp !== 0 ? dateCmp : b.timeValue - a.timeValue;
  });
}
function assignIds(entries) {
  entries.forEach((entry, idx) => {
    if (!entry.id) {
      const safeTime = entry.time.replace(/:/g, "-");
      entry.id = `${entry.date}-${safeTime}-${idx}`;
    }
  });
}
async function loadAll() {
  if (state.data.isLoadingData) return;
  state.data.isLoadingData = true;
  emitLoading(true);
  try {
    const app2 = getApp();
    const diaryDir = app2.vault.getAbstractFileByPath(DIARY_DIRECTORY);
    if (!diaryDir || !diaryDir.children) {
      state.data.originalDiaryEntries = [];
      state.data.currentFilteredEntries = [];
      return;
    }
    const mdFiles = diaryDir.children.filter((f) => f.extension === "md").sort((a, b) => b.name.localeCompare(a.name));
    const totalDiaryFiles = mdFiles.length;
    let movieFiles = [];
    let letterFiles = [];
    emitProgress(0, totalDiaryFiles || 1);
    const BATCH_CONCURRENCY = 10;
    const results = [];
    if (totalDiaryFiles > 0) {
      for (let i = 0; i < mdFiles.length; i += BATCH_CONCURRENCY) {
        const batch = mdFiles.slice(i, i + BATCH_CONCURRENCY);
        const batchResults = await Promise.all(
          batch.map(async (file, idx) => {
            const content = await app2.vault.read(file);
            const entries = parseFile(content, file.basename);
            emitProgress(i + idx + 1, totalDiaryFiles);
            return { date: file.basename, entries };
          })
        );
        results.push(...batchResults);
      }
    }
    state.data.originalDiaryEntries = [];
    const map = /* @__PURE__ */ new Map();
    for (const { date, entries } of results) {
      if (entries.length) {
        map.set(date, entries);
        state.data.originalDiaryEntries.push(...entries.filter((e) => !isEncryptedEntry(e)));
      }
    }
    setDiaryDataMap(map);
    const movieDir = app2.vault.getAbstractFileByPath(MOVIE_DIRECTORY);
    if (movieDir && movieDir.children) {
      movieFiles = movieDir.children.filter((f) => f.extension === "md");
    }
    const letterDir = app2.vault.getAbstractFileByPath(LETTER_DIRECTORY);
    if (letterDir && letterDir.children) {
      letterFiles = letterDir.children.filter((f) => f.extension === "md");
    }
    const totalFiles = totalDiaryFiles + movieFiles.length + letterFiles.length;
    if (totalFiles === 0) {
      state.data.currentDisplayCount = 0;
      emitFullRefresh();
      emitProgress(0, 0);
      state.data.isLoadingData = false;
      emitLoading(false);
      return;
    }
    const loadedDiary = totalDiaryFiles;
    emitProgress(loadedDiary, totalFiles);
    for (let i = 0; i < movieFiles.length; i++) {
      const movieEntry = await parseMovieFile(movieFiles[i]);
      if (movieEntry) {
        state.data.originalDiaryEntries.push(movieEntry);
      }
      emitProgress(loadedDiary + i + 1, totalFiles);
    }
    const offset = loadedDiary + movieFiles.length;
    for (let i = 0; i < letterFiles.length; i++) {
      const letterEntry = await parseLetterFile(letterFiles[i]);
      if (letterEntry) {
        state.data.originalDiaryEntries.push(letterEntry);
      }
      emitProgress(offset + i + 1, totalFiles);
    }
    sortEntries(state.data.originalDiaryEntries);
    assignIds(state.data.originalDiaryEntries);
    state.data.currentDisplayCount = 0;
    emitFullRefresh();
    emitProgress(0, 0);
  } catch (err) {
    console.error("[\u65E5\u8BB0\u672C] \u6570\u636E\u52A0\u8F7D\u5931\u8D25:", err);
    try {
      new import_obsidian2.Notice("[\u65E5\u8BB0\u672C] \u6570\u636E\u52A0\u8F7D\u5931\u8D25: " + (err?.message || err));
    } catch (e) {
    }
  } finally {
    state.data.isLoadingData = false;
    emitLoading(false);
  }
}
async function writeFile(dateStr) {
  if (!diaryDataMap || !diaryDataMap.has(dateStr)) return;
  state.events.isInternalUpdate = true;
  const entries = diaryDataMap.get(dateStr);
  if (entries.length === 0) {
    const filePath2 = `${DIARY_DIRECTORY}/${dateStr}.md`;
    const file2 = getApp().vault.getAbstractFileByPath(filePath2);
    if (file2) await getApp().vault.delete(file2);
    state.events.isInternalUpdate = false;
    return;
  }
  entries.sort((a, b) => a.timeValue - b.timeValue);
  const fileLines = entries.map((entry) => {
    const emojiSeq = entry.tags.map((tag) => getTagEmoji(tag)).join("");
    const lines = [`# ${emojiSeq} ${entry.time}`, ""];
    if (entry.content.trim()) lines.push(entry.content.trim());
    lines.push("");
    return lines;
  }).flat().slice(0, -1);
  const finalContent = fileLines.join("\n");
  const filePath = `${DIARY_DIRECTORY}/${dateStr}.md`;
  const file = getApp().vault.getAbstractFileByPath(filePath);
  try {
    if (file) await getApp().vault.modify(file, finalContent);
    else await getApp().vault.create(filePath, finalContent);
  } catch (error) {
    console.error(`\u91CD\u65B0\u751F\u6210\u6587\u4EF6 ${dateStr}.md \u5931\u8D25:`, error);
    throw error;
  } finally {
    state.events.isInternalUpdate = false;
  }
}
async function addEntry(dateStr, timeStr, tagsArray, content) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const timeValue = hours * 100 + minutes;
  const newEntry = {
    date: dateStr,
    time: timeStr,
    timeValue,
    tags: tagsArray,
    emoji: "",
    content: content.trim(),
    filename: dateStr,
    lineNumber: 0
  };
  newEntry.emoji = tagsArray.map((tag) => getTagEmoji(tag)).join("");
  if (!diaryDataMap) setDiaryDataMap(/* @__PURE__ */ new Map());
  if (!diaryDataMap.has(dateStr)) diaryDataMap.set(dateStr, []);
  const entries = diaryDataMap.get(dateStr);
  let insertIndex = entries.findIndex((e) => e.timeValue > timeValue);
  if (insertIndex === -1) insertIndex = entries.length;
  entries.splice(insertIndex, 0, newEntry);
  await writeFile(dateStr);
  const filePath = `${DIARY_DIRECTORY}/${dateStr}.md`;
  const file = getApp().vault.getAbstractFileByPath(filePath);
  if (file) {
    const fileContent = await getApp().vault.read(file);
    const parsedEntries = parseFile(fileContent, dateStr);
    const matched = parsedEntries.find(
      (e) => e.time === timeStr && e.tags.join(",") === tagsArray.join(",")
    );
    if (matched) {
      newEntry.lineNumber = matched.lineNumber;
    }
  }
  const finalEntry = { ...newEntry };
  finalEntry.id = `${dateStr}-${timeStr.replace(/:/g, "-")}-${Date.now()}`;
  state.data.originalDiaryEntries.push(finalEntry);
  sortEntries(state.data.originalDiaryEntries);
  emitLightRefresh();
  return finalEntry;
}
async function deleteEntry(entryId) {
  const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
  if (!entry) throw new Error("\u672A\u627E\u5230\u65E5\u8BB0\u6761\u76EE");
  const dateStr = entry.date;
  const entries = diaryDataMap.get(dateStr);
  if (!entries) throw new Error("\u672A\u627E\u5230\u65E5\u671F\u5BF9\u5E94\u7684\u65E5\u8BB0\u6570\u636E");
  const entryIndex = entries.findIndex((e) => e.time === entry.time);
  if (entryIndex === -1) throw new Error("\u672A\u627E\u5230\u65E5\u8BB0\u6761\u76EE\u5728\u6570\u636E\u4E2D\u7684\u7D22\u5F15");
  entries.splice(entryIndex, 1);
  const flatEntryIndex = state.data.originalDiaryEntries.findIndex((e) => e.id === entryId);
  if (flatEntryIndex !== -1) state.data.originalDiaryEntries.splice(flatEntryIndex, 1);
  const filteredIndex = state.data.currentFilteredEntries.findIndex((e) => e.id === entryId);
  if (filteredIndex !== -1) state.data.currentFilteredEntries.splice(filteredIndex, 1);
  if (entries.length === 0) {
    const filePath = `${DIARY_DIRECTORY}/${dateStr}.md`;
    const file = getApp().vault.getAbstractFileByPath(filePath);
    if (file) {
      state.events.isInternalUpdate = true;
      try {
        await getApp().vault.delete(file);
      } finally {
        state.events.isInternalUpdate = false;
      }
    }
    if (diaryDataMap) diaryDataMap.delete(dateStr);
  } else {
    await writeFile(dateStr);
  }
  emitFullRefresh();
}
async function refreshFile(filePath) {
  const file = getApp().vault.getAbstractFileByPath(filePath);
  if (!file) return;
  const dateStr = file.basename;
  const content = await getApp().vault.read(file);
  const newEntries = parseFile(content, dateStr);
  if (!diaryDataMap) setDiaryDataMap(/* @__PURE__ */ new Map());
  if (newEntries.length === 0) {
    diaryDataMap.delete(dateStr);
  } else {
    diaryDataMap.set(dateStr, newEntries);
  }
  const otherEntries = state.data.originalDiaryEntries.filter((e) => e.date !== dateStr);
  newEntries.forEach((entry) => {
    entry.filename = dateStr;
  });
  const visibleEntries = newEntries.filter((e) => !isEncryptedEntry(e));
  state.data.originalDiaryEntries = [...otherEntries, ...visibleEntries];
  sortEntries(state.data.originalDiaryEntries);
  assignIds(state.data.originalDiaryEntries);
  emitFullRefresh();
}
async function refreshSpecialFile(filePath, parseFn, prefix) {
  const file = getApp().vault.getAbstractFileByPath(filePath);
  if (!file) return;
  const newEntry = await parseFn(file);
  const oldEntryIndex = state.data.originalDiaryEntries.findIndex(
    (e) => e.id && e.id.startsWith(`${prefix}-${filePath.replace(/\//g, "-")}`)
  );
  if (oldEntryIndex !== -1) {
    if (newEntry) {
      state.data.originalDiaryEntries[oldEntryIndex] = newEntry;
    } else {
      state.data.originalDiaryEntries.splice(oldEntryIndex, 1);
    }
  } else if (newEntry) {
    state.data.originalDiaryEntries.push(newEntry);
  }
  sortEntries(state.data.originalDiaryEntries);
  emitFullRefresh();
}
var refreshTimer = null;
async function onFileChange(file) {
  if (state.events.isInternalUpdate) return;
  const filePath = file.path;
  const inDir = (p, dir) => p === dir || p.startsWith(dir + "/");
  const isDiaryFile = inDir(filePath, DIARY_DIRECTORY) && file.extension === "md";
  const isMovieFile = inDir(filePath, MOVIE_DIRECTORY) && file.extension === "md";
  const isLetterFile = inDir(filePath, LETTER_DIRECTORY) && file.extension === "md";
  if (!isDiaryFile && !isMovieFile && !isLetterFile) return;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    if (isDiaryFile) {
      await refreshFile(filePath);
    } else if (isMovieFile) {
      await refreshSpecialFile(filePath, parseMovieFile, "movie");
    } else if (isLetterFile) {
      await refreshSpecialFile(filePath, parseLetterFile, "letter");
    }
    refreshTimer = null;
  }, fileChangeDelay);
}

// src/diary/ui/panel.ts
var import_obsidian7 = require("obsidian");

// src/diary/ui/entries.ts
var import_obsidian5 = require("obsidian");

// src/core/confirm.ts
function confirm(opts) {
  const t = opts.title || "\u786E\u8BA4";
  const m = opts.message || "";
  const onOk = opts.onConfirm;
  const onNo = opts.onCancel;
  const okTxt = opts.confirmText || "\u786E\u5B9A";
  const noTxt = opts.cancelText || "\u53D6\u6D88";
  const old = document.getElementById("__shared_confirm_mask__");
  if (old) old.remove();
  const mask = document.createElement("div");
  mask.id = "__shared_confirm_mask__";
  mask.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:10003;display:flex;align-items:center;justify-content:center;";
  mask.onclick = (e) => {
    if (e.target === mask) close(false);
  };
  const popup = document.createElement("div");
  popup.style.cssText = "position:relative;background:var(--background-primary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:24px;max-width:400px;width:90%;display:flex;flex-direction:column;align-items:center;text-align:center;";
  popup.innerHTML = '<h4 style="margin:0 0 12px 0;font-size:18px;font-weight:600;color:var(--text-normal);">' + t + '</h4><p style="margin:0 0 20px 0;font-size:15px;color:var(--text-muted);line-height:1.5;word-wrap:break-word;max-width:100%;">' + m + '</p><div style="display:flex;gap:12px;justify-content:center;width:100%;"><button id="__shared_confirm_cancel__" style="padding:8px 24px;border-radius:6px;border:none;background:var(--background-secondary);cursor:pointer;font-size:14px;box-shadow:none;flex:1;">' + noTxt + '</button><button id="__shared_confirm_ok__" style="padding:8px 24px;border-radius:6px;border:none;background:var(--interactive-accent);color:var(--text-on-accent);cursor:pointer;font-size:14px;font-weight:500;box-shadow:none;flex:1;">' + okTxt + "</button></div>";
  mask.appendChild(popup);
  document.body.appendChild(mask);
  escManager.register("q3-confirm", { isVisible: () => mask.isConnected, close: () => close(false) });
  function close(ok) {
    mask.remove();
    if (ok && typeof onOk === "function") onOk();
    if (!ok && typeof onNo === "function") onNo();
  }
  document.getElementById("__shared_confirm_ok__").onclick = () => close(true);
  document.getElementById("__shared_confirm_cancel__").onclick = () => close(false);
}

// src/diary/ui/ui-settings.ts
var showTagCountSetting = true;
var enableLongPressSetting = true;
var defaultTagSetting = "\u65E5\u8BB0";
var useFileDateTimeSetting = false;
function applyUiSettings(s) {
  if (s.showTagCount !== void 0) showTagCountSetting = s.showTagCount;
  if (s.enableLongPress !== void 0) enableLongPressSetting = s.enableLongPress;
  if (s.defaultTag !== void 0) defaultTagSetting = s.defaultTag;
  if (s.useFileDateTime !== void 0) useFileDateTimeSetting = s.useFileDateTime;
}
function getShowTagCountSetting() {
  return showTagCountSetting;
}
function getEnableLongPressSetting() {
  return enableLongPressSetting;
}
function getDefaultTagSetting() {
  return defaultTagSetting;
}
function getUseFileDateTimeSetting() {
  return useFileDateTimeSetting;
}

// src/diary/ui/dialogs.ts
var import_obsidian4 = require("obsidian");

// src/diary/ui/filter-shared.ts
function updateTitleSuffix() {
  const titleElement = document.querySelector("#diary-tag-filter .diary-popup-header h3");
  if (!titleElement) return;
  const existingSuffix = titleElement.querySelector(".date-filter-suffix");
  if (existingSuffix) existingSuffix.remove();
  if (state.data.currentDateFilter) {
    const suffixSpan = document.createElement("span");
    suffixSpan.className = "date-filter-suffix";
    suffixSpan.style.cssText = "margin-left: 8px; font-size: 14px; font-weight: normal; color: var(--text-muted);";
    if (state.data.currentDateFilter.month) {
      suffixSpan.textContent = `${state.data.currentDateFilter.year}-${state.data.currentDateFilter.month}`;
    } else {
      suffixSpan.textContent = state.data.currentDateFilter.year;
    }
    titleElement.appendChild(suffixSpan);
  }
}
function refreshSubTagsBar() {
  const subContainer = document.getElementById("diary-subtags-container");
  if (!subContainer) return;
  let activeParent = null;
  for (const tag of state.data.selectedTags) {
    const subTags2 = getSubTagsOfPrimary(tag);
    if (subTags2 && subTags2.length > 0) {
      activeParent = tag;
      break;
    }
  }
  if (!activeParent) {
    for (const tag of state.data.selectedTags) {
      if (isSubTag(tag)) {
        activeParent = getParentPrimaryTag(tag);
        break;
      }
    }
  }
  setCurrentActiveParentForSub(activeParent);
  if (!activeParent) {
    subContainer.style.display = "none";
    subContainer.innerHTML = "";
    return;
  }
  subContainer.style.display = "flex";
  subContainer.innerHTML = "";
  const subTags = getSubTagsOfPrimary(activeParent);
  if (!subTags) return;
  const countMap = /* @__PURE__ */ new Map();
  state.data.originalDiaryEntries.forEach((entry) => {
    entry.tags.forEach((tag) => {
      if (isSubTag(tag) && getParentPrimaryTag(tag) === activeParent) {
        countMap.set(tag, (countMap.get(tag) || 0) + 1);
      }
    });
  });
  for (const sub of subTags) {
    const btn = document.createElement("button");
    btn.className = "diary-tag-btn diary-sub-tag-btn";
    btn.dataset.tag = sub.tag;
    const count = countMap.get(sub.tag) || 0;
    btn.innerHTML = `${sub.emoji} ${sub.tag} <span style="margin-left:4px; font-size:10px; opacity:0.8;">(${count})</span>`;
    btn.style.cssText = "border-radius:10px;background:var(--background-secondary);cursor:pointer;font-size:10px;color:var(--text-normal);transition:all 0.2s;display:flex;align-items:center;flex-shrink:0;box-shadow:none;";
    if (state.data.selectedTags.has(sub.tag)) {
      btn.style.background = "var(--interactive-accent)";
      btn.style.color = "var(--background-primary)";
    }
    btn.onmouseenter = () => !state.data.selectedTags.has(sub.tag) && (btn.style.backgroundColor = "var(--background-modifier-hover)");
    btn.onmouseleave = () => !state.data.selectedTags.has(sub.tag) && (btn.style.backgroundColor = "var(--background-secondary)");
    btn.onclick = (e) => {
      e.stopPropagation();
      if (!state.data.selectedTags.has(sub.tag)) {
        state.data.selectedTags.clear();
        state.data.selectedTags.add(sub.tag);
        document.querySelectorAll(".diary-tag-btn:not(.diary-sub-tag-btn)").forEach((btn2) => {
          btn2.style.background = "var(--background-secondary)";
          btn2.style.color = "var(--text-normal)";
        });
        document.querySelectorAll(".diary-sub-tag-btn").forEach((btn2) => {
          const el = btn2;
          if (el.dataset.tag === sub.tag) {
            el.style.background = "var(--interactive-accent)";
            el.style.color = "var(--background-primary)";
          } else {
            el.style.background = "var(--background-secondary)";
            el.style.color = "var(--text-normal)";
          }
        });
      } else {
        state.data.selectedTags.clear();
        document.querySelectorAll(".diary-tag-btn").forEach((btn2) => {
          btn2.style.background = "var(--background-secondary)";
          btn2.style.color = "var(--text-normal)";
        });
      }
      applyFilter({ skipTagCountUpdate: true });
    };
    subContainer.appendChild(btn);
  }
}
function rebuildTags() {
  const tagsContainer = document.getElementById("diary-tag-container");
  if (!tagsContainer) return;
  const currentSelectedTags = new Set(state.data.selectedTags);
  const tagsScrollContainer = document.createElement("div");
  tagsScrollContainer.className = "diary-tags-scroll-container";
  for (const tag of Object.keys(getPrimaryTagsConfig())) {
    const count = getTagCountForPrimary(tag);
    const emoji = getTagEmoji(tag);
    const btn = createTag(tag, emoji, count);
    if (currentSelectedTags.has(tag)) {
      btn.style.background = "var(--interactive-accent)";
      btn.style.color = "var(--background-primary)";
    }
    tagsScrollContainer.appendChild(btn);
  }
  const oldContainer = tagsContainer.querySelector(".diary-tags-scroll-container");
  if (oldContainer) oldContainer.remove();
  tagsContainer.appendChild(tagsScrollContainer);
  refreshSubTagsBar();
}
function getTagCountForPrimary(primaryTag) {
  let count = 0;
  const subTags = getSubTagsOfPrimary(primaryTag);
  for (const entry of state.data.originalDiaryEntries) {
    if (entry.tags.includes(primaryTag)) {
      count++;
    } else if (subTags) {
      if (entry.tags.some((t) => subTags.some((sub) => sub.tag === t))) {
        count++;
      }
    }
  }
  return count;
}
function createTag(tag, emoji, count) {
  const showCount = getShowTagCountSetting();
  const button = document.createElement("button");
  button.className = "diary-tag-btn";
  button.dataset.tag = tag;
  let countHtml = "";
  if (showCount && count !== null && count !== void 0) {
    countHtml = `<span style="margin-left:4px; font-size:10px; opacity:0.8;">(${count})</span>`;
  }
  button.innerHTML = `${emoji} ${tag} ${countHtml}`;
  button.style.cssText = "border-radius:10px;background:var(--background-secondary);cursor:pointer;font-size:10px;color:var(--text-normal);transition:all 0.2s;display:flex;align-items:center;flex-shrink:0;box-shadow:none;";
  const subTags = getSubTagsOfPrimary(tag);
  if (subTags && subTags.length > 0) {
    button.style.border = "1px solid var(--background-modifier-hover)";
    button.style.padding = "0 8px";
  }
  button.onmouseenter = () => !state.data.selectedTags.has(tag) && (button.style.backgroundColor = "var(--background-modifier-hover)");
  button.onmouseleave = () => !state.data.selectedTags.has(tag) && (button.style.backgroundColor = "var(--background-secondary)");
  button.onclick = (e) => {
    e.stopPropagation();
    if (!state.data.selectedTags.has(tag)) {
      state.data.selectedTags.clear();
      state.data.selectedTags.add(tag);
      document.querySelectorAll(".diary-tag-btn").forEach((btn) => {
        btn.style.background = "var(--background-secondary)";
        btn.style.color = "var(--text-normal)";
      });
      button.style.background = "var(--interactive-accent)";
      button.style.color = "var(--background-primary)";
    } else {
      state.data.selectedTags.delete(tag);
      button.style.background = "var(--background-secondary)";
      button.style.color = "var(--text-normal)";
    }
    applyFilter({ skipTagCountUpdate: true });
  };
  return button;
}
function updateSubTagsCounts() {
  if (!getCurrentActiveParentForSub()) return;
  refreshSubTagsBar();
}
function updateTagCounts() {
  if (!getShowTagCountSetting()) return;
  const tagButtons = document.querySelectorAll(".diary-tag-btn:not(.diary-sub-tag-btn)");
  if (!tagButtons.length) return;
  const countMap = /* @__PURE__ */ new Map();
  for (const tag of Object.keys(getPrimaryTagsConfig())) {
    countMap.set(tag, 0);
  }
  for (const entry of state.data.originalDiaryEntries) {
    for (const [tag, config] of Object.entries(getPrimaryTagsConfig())) {
      if (entry.tags.includes(tag)) {
        countMap.set(tag, countMap.get(tag) + 1);
      } else if (config.subTags && config.subTags.length) {
        const hasSub = entry.tags.some((t) => config.subTags.some((sub) => sub.tag === t));
        if (hasSub) {
          countMap.set(tag, countMap.get(tag) + 1);
        }
      }
    }
  }
  for (const btn of tagButtons) {
    const tag = btn.dataset.tag;
    const count = countMap.get(tag) || 0;
    const emoji = getTagEmoji(tag);
    btn.innerHTML = `${emoji} ${tag} <span style="margin-left:4px; font-size:10px; opacity:0.8;">(${count})</span>`;
  }
  updateSubTagsCounts();
}

// src/diary/ui/datetime-picker.ts
var import_obsidian3 = require("obsidian");
function createWheelColumn(field, colIndex, picker) {
  const column = document.createElement("div");
  column.style.cssText = `
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  `;
  const label = document.createElement("div");
  label.textContent = field.name;
  label.style.cssText = `
    text-align: center;
    font-size: 13px;
    color: var(--text-muted);
    padding: 8px 4px;
    font-weight: 500;
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
  `;
  column.appendChild(label);
  const wheelScrollContainer = document.createElement("div");
  wheelScrollContainer.className = "diary-datetime-scroll-container";
  wheelScrollContainer.style.cssText = `
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    scrollbar-width: none;
    -ms-overflow-style: none;
  `;
  column.appendChild(wheelScrollContainer);
  const numbersContainer = document.createElement("div");
  numbersContainer.className = "datetime-numbers-container";
  numbersContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 120px 0;
  `;
  wheelScrollContainer.appendChild(numbersContainer);
  const items = [];
  let min = typeof field.min === "function" ? field.min() : field.min;
  let max = typeof field.max === "function" ? field.max() : field.max;
  for (let i = min; i <= max; i++) {
    const item = document.createElement("div");
    item.className = "datetime-number-item";
    item.dataset.value = String(i);
    item.textContent = i < 10 ? `0${i}` : String(i);
    item.style.cssText = `
      padding: 12px 8px;
      font-size: 18px;
      font-weight: 400;
      color: var(--text-muted);
      cursor: pointer;
      user-select: none;
      width: 100%;
      text-align: center;
      border-radius: 8px;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    `;
    items.push(item);
    numbersContainer.appendChild(item);
  }
  picker.numberItems[colIndex] = items;
  const updateSelection = () => {
    const currentVal = field.get(picker.tempMoment);
    items.forEach((item) => {
      const val = parseInt(item.dataset.value);
      if (val === currentVal) {
        item.style.color = "var(--text-on-accent)";
        item.style.fontWeight = "900";
        item.style.background = "var(--text-muted)";
      } else {
        item.style.color = "var(--text-muted)";
        item.style.fontWeight = "400";
        item.style.background = "transparent";
      }
    });
  };
  const scrollToSelected = () => {
    const currentVal = field.get(picker.tempMoment);
    const index = currentVal - min;
    if (items[index]) {
      const itemHeight = items[index].offsetHeight || 44;
      const containerHeight = wheelScrollContainer.clientHeight;
      const targetScrollTop = index * itemHeight - containerHeight / 2 + itemHeight / 2;
      wheelScrollContainer.scrollTop = targetScrollTop;
    }
  };
  items.forEach((item) => {
    item.addEventListener("click", () => {
      const newVal = parseInt(item.dataset.value);
      if (newVal !== field.get(picker.tempMoment)) {
        field.set(picker.tempMoment, newVal);
        if (field.unit === "year" || field.unit === "month") {
          const dayField = picker.fields.find((f) => f.unit === "day");
          if (dayField) {
            const dayMax = picker.tempMoment.daysInMonth();
            const currentDay = dayField.get(picker.tempMoment);
            if (currentDay > dayMax) {
              dayField.set(picker.tempMoment, dayMax);
            }
            regenerateDayNumbers(picker);
          }
        }
        updateSelection();
      }
    });
  });
  wheelScrollContainer.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      wheelScrollContainer.scrollTop += e.deltaY * 0.5;
    },
    { passive: false }
  );
  let touchStartY = 0;
  let scrollStartTop = 0;
  let isScrolling = false;
  wheelScrollContainer.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      touchStartY = e.touches[0].clientY;
      scrollStartTop = wheelScrollContainer.scrollTop;
      isScrolling = true;
    },
    { passive: true }
  );
  wheelScrollContainer.addEventListener(
    "touchmove",
    (e) => {
      if (!isScrolling || e.touches.length !== 1) return;
      e.preventDefault();
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      wheelScrollContainer.scrollTop = scrollStartTop + deltaY;
    },
    { passive: false }
  );
  wheelScrollContainer.addEventListener(
    "touchend",
    () => {
      isScrolling = false;
    },
    { passive: true }
  );
  column.updateSelection = updateSelection;
  column.scrollToSelected = scrollToSelected;
  return column;
}
function regenerateDayNumbers(picker) {
  const dayField = picker.fields.find((f) => f.unit === "day");
  const dayColIndex = picker.fields.findIndex((f) => f.unit === "day");
  const dayItems = picker.numberItems[dayColIndex];
  const dayMin = 1;
  const dayMax = picker.tempMoment.daysInMonth();
  const currentCount = dayItems.length;
  const targetCount = dayMax;
  if (targetCount < currentCount) {
    for (let i = currentCount - 1; i >= targetCount; i--) {
      dayItems[i].remove();
      dayItems.pop();
    }
  } else if (targetCount > currentCount) {
    const container = dayItems[0].parentElement;
    for (let i = currentCount + 1; i <= targetCount; i++) {
      const item = document.createElement("div");
      item.className = "datetime-number-item";
      item.dataset.value = String(i);
      item.textContent = i < 10 ? `0${i}` : String(i);
      item.style.cssText = `
        padding: 12px 8px;
        font-size: 18px;
        font-weight: 400;
        color: var(--text-muted);
        cursor: pointer;
        user-select: none;
        transition: all 0.15s;
        width: 100%;
        text-align: center;
        border-radius: 8px;
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      `;
      item.addEventListener("click", () => {
        const newVal = parseInt(item.dataset.value);
        if (newVal !== dayField.get(picker.tempMoment)) {
          dayField.set(picker.tempMoment, newVal);
          picker.columns[dayColIndex].updateSelection();
        }
      });
      container.appendChild(item);
      dayItems.push(item);
    }
  }
  dayItems.forEach((item, index) => {
    const value = index + 1;
    item.dataset.value = String(value);
    item.textContent = value < 10 ? `0${value}` : String(value);
  });
  const currentDay = dayField.get(picker.tempMoment);
  if (currentDay > dayMax) {
    dayField.set(picker.tempMoment, dayMax);
  }
  picker.columns[dayColIndex].updateSelection();
}
function updateAllColumns(picker, shouldScroll = false) {
  picker.columns.forEach((col) => {
    if (col.updateSelection) {
      col.updateSelection();
      if (shouldScroll && col.scrollToSelected) {
        col.scrollToSelected();
      }
    }
  });
}
function showDateTimePicker(initialMoment, onConfirm) {
  const existing = document.getElementById("unified-datetime-picker-mask");
  if (existing) existing.remove();
  const picker = {
    tempMoment: initialMoment.clone(),
    fields: [
      {
        name: "\u5E74",
        unit: "year",
        min: 2e3,
        max: 2030,
        get: (m) => m.year(),
        set: (m, v) => m.year(v)
      },
      {
        name: "\u6708",
        unit: "month",
        min: 1,
        max: 12,
        get: (m) => m.month() + 1,
        set: (m, v) => m.month(v - 1)
      },
      {
        name: "\u65E5",
        unit: "day",
        min: 1,
        max: () => picker.tempMoment.daysInMonth(),
        get: (m) => m.date(),
        set: (m, v) => m.date(v)
      },
      {
        name: "\u65F6",
        unit: "hour",
        min: 0,
        max: 23,
        get: (m) => m.hour(),
        set: (m, v) => m.hour(v)
      },
      {
        name: "\u5206",
        unit: "minute",
        min: 0,
        max: 59,
        get: (m) => m.minute(),
        set: (m, v) => m.minute(v)
      }
    ],
    columns: [],
    numberItems: []
  };
  const mask = document.createElement("div");
  mask.id = "unified-datetime-picker-mask";
  mask.style.cssText = `
    position: fixed; top:0; left:0; right:0; bottom:0;
    background: var(--background-modifier-cover);
    z-index: 10010;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  const popup = document.createElement("div");
  popup.style.cssText = `
    background: var(--background-primary);
    border-radius: 16px;
    padding: 20px 24px 24px 24px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    font-family: system-ui, -apple-system, sans-serif;
    display: flex;
    flex-direction: column;
  `;
  const title = document.createElement("h4");
  title.textContent = "\u9009\u62E9\u65E5\u671F\u65F6\u95F4";
  title.style.cssText = `
    margin:0 0 20px 0;
    font-size:18px;
    font-weight:600;
    color:var(--text-normal);
    text-align:center;
  `;
  popup.appendChild(title);
  const columnsContainer = document.createElement("div");
  columnsContainer.style.cssText = `
    display: flex;
    flex: 1;
    gap: 8px;
    min-height: 320px;
    overflow: hidden;
  `;
  picker.fields.forEach((field, colIndex) => {
    const col = createWheelColumn(field, colIndex, picker);
    columnsContainer.appendChild(col);
    picker.columns.push(col);
  });
  popup.appendChild(columnsContainer);
  const btnContainer = document.createElement("div");
  btnContainer.style.cssText = `
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--background-modifier-border);
  `;
  const todayBtn = document.createElement("button");
  todayBtn.textContent = "\u6B64\u523B";
  todayBtn.style.cssText = `
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    flex: 1;
  `;
  todayBtn.onclick = () => {
    picker.tempMoment = (0, import_obsidian3.moment)();
    regenerateDayNumbers(picker);
    updateAllColumns(picker, true);
  };
  const okBtn = document.createElement("button");
  okBtn.textContent = "\u786E\u5B9A";
  okBtn.style.cssText = `
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    flex: 1;
  `;
  okBtn.onclick = () => {
    if (onConfirm) onConfirm(picker.tempMoment.clone());
    mask.remove();
  };
  btnContainer.appendChild(todayBtn);
  btnContainer.appendChild(okBtn);
  popup.appendChild(btnContainer);
  mask.appendChild(popup);
  document.body.appendChild(mask);
  updateAllColumns(picker, true);
  mask.addEventListener("click", (e) => {
    if (e.target === mask) mask.remove();
  });
  escManager.register("diary-datetime", { isVisible: () => mask.isConnected, close: () => mask.remove() });
  return mask;
}
function createDateTimeControl() {
  const container = document.createElement("div");
  container.style.cssText = "margin-bottom:16px;";
  container.classList.add("datetime-picker-container");
  const label = document.createElement("label");
  label.textContent = "\u65E5\u671F";
  label.style.cssText = "display:block;margin-bottom:6px;font-size:14px;color:var(--text-muted);font-weight:500;";
  container.appendChild(label);
  const displayArea = document.createElement("div");
  displayArea.id = "datetime-display-area";
  displayArea.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 8px 12px;
    background: var(--background-primary);
    cursor: pointer;
    flex-wrap: wrap;
  `;
  const yearSpan = document.createElement("span");
  yearSpan.className = "dt-part";
  yearSpan.setAttribute("data-part", "year");
  yearSpan.style.cssText = "padding:2px 6px; border-radius:4px;";
  yearSpan.textContent = "----";
  const monthSpan = document.createElement("span");
  monthSpan.className = "dt-part";
  monthSpan.setAttribute("data-part", "month");
  monthSpan.style.cssText = "padding:2px 6px; border-radius:4px;";
  monthSpan.textContent = "--";
  const daySpan = document.createElement("span");
  daySpan.className = "dt-part";
  daySpan.setAttribute("data-part", "day");
  daySpan.style.cssText = "padding:2px 6px; border-radius:4px;";
  daySpan.textContent = "--";
  const hourSpan = document.createElement("span");
  hourSpan.className = "dt-part";
  hourSpan.setAttribute("data-part", "hour");
  hourSpan.style.cssText = "padding:2px 6px; border-radius:4px;";
  hourSpan.textContent = "--";
  const minuteSpan = document.createElement("span");
  minuteSpan.className = "dt-part";
  minuteSpan.setAttribute("data-part", "minute");
  minuteSpan.style.cssText = "padding:2px 6px; border-radius:4px;";
  minuteSpan.textContent = "--";
  const sep1 = document.createTextNode("-");
  const sep2 = document.createTextNode("-");
  const space = document.createTextNode(" ");
  const colon = document.createTextNode(":");
  displayArea.appendChild(yearSpan);
  displayArea.appendChild(sep1);
  displayArea.appendChild(monthSpan);
  displayArea.appendChild(sep2);
  displayArea.appendChild(daySpan);
  displayArea.appendChild(space);
  displayArea.appendChild(hourSpan);
  displayArea.appendChild(colon);
  displayArea.appendChild(minuteSpan);
  const hiddenInput = document.createElement("input");
  hiddenInput.type = "text";
  hiddenInput.id = "add-diary-datetime";
  hiddenInput.style.display = "none";
  const manualInput = document.createElement("input");
  manualInput.type = "text";
  manualInput.placeholder = "YYYY-MM-DD HH:mm \u6216 1\u5206\u949F\u524D";
  manualInput.style.cssText = `
    width: 100%;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    font-size: 14px;
    box-sizing: border-box;
    padding: 8px 12px;
    display: none;
  `;
  let currentMoment = (0, import_obsidian3.moment)();
  let isManualMode = false;
  let clickTimer = null;
  function updateDisplay(momentObj) {
    if (!momentObj || !momentObj.isValid()) {
      yearSpan.textContent = "----";
      monthSpan.textContent = "--";
      daySpan.textContent = "--";
      hourSpan.textContent = "--";
      minuteSpan.textContent = "--";
      hiddenInput.value = "";
      return;
    }
    yearSpan.textContent = momentObj.format("YYYY");
    monthSpan.textContent = momentObj.format("MM");
    daySpan.textContent = momentObj.format("DD");
    hourSpan.textContent = momentObj.format("HH");
    minuteSpan.textContent = momentObj.format("mm");
    hiddenInput.value = momentObj.format("YYYY-MM-DD HH:mm");
  }
  updateDisplay(currentMoment);
  function openUnifiedPicker() {
    if (isManualMode) return;
    showDateTimePicker(currentMoment, (newMoment) => {
      if (newMoment && newMoment.isValid()) {
        currentMoment = newMoment;
        updateDisplay(currentMoment);
      }
    });
  }
  function onSingleClick() {
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      clickTimer = null;
      openUnifiedPicker();
    }, 200);
  }
  function onDoubleClick() {
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }
    if (isManualMode) return;
    isManualMode = true;
    displayArea.style.display = "none";
    manualInput.style.display = "block";
    manualInput.value = hiddenInput.value;
    manualInput.focus();
    manualInput.select();
  }
  displayArea.addEventListener("click", onSingleClick);
  displayArea.addEventListener("dblclick", onDoubleClick);
  function commitManualEdit() {
    const raw = manualInput.value.trim();
    let newMoment = parseNaturalTime(raw);
    if (!newMoment || !newMoment.isValid()) {
      newMoment = (0, import_obsidian3.moment)(raw, "YYYY-MM-DD HH:mm", true);
    }
    if (newMoment && newMoment.isValid()) {
      currentMoment = newMoment;
      updateDisplay(currentMoment);
    } else {
      manualInput.value = hiddenInput.value;
      new import_obsidian3.Notice("\u65E5\u671F\u65F6\u95F4\u683C\u5F0F\u65E0\u6548\uFF0C\u5DF2\u6062\u590D");
    }
    isManualMode = false;
    manualInput.style.display = "none";
    displayArea.style.display = "flex";
  }
  manualInput.addEventListener("blur", commitManualEdit);
  manualInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitManualEdit();
    }
  });
  container.appendChild(displayArea);
  container.appendChild(manualInput);
  container.appendChild(hiddenInput);
  return container;
}
function syncDateTime() {
  const hidden = document.getElementById("add-diary-datetime");
  if (!hidden) return;
  const val = hidden.value;
  const m = (0, import_obsidian3.moment)(val, "YYYY-MM-DD HH:mm", true);
  if (!m.isValid()) return;
  const container = hidden.closest("#add-diary-popup");
  if (!container) return;
  const yearSpan = container.querySelector('[data-part="year"]');
  const monthSpan = container.querySelector('[data-part="month"]');
  const daySpan = container.querySelector('[data-part="day"]');
  const hourSpan = container.querySelector('[data-part="hour"]');
  const minuteSpan = container.querySelector('[data-part="minute"]');
  if (yearSpan) yearSpan.textContent = m.format("YYYY");
  if (monthSpan) monthSpan.textContent = m.format("MM");
  if (daySpan) daySpan.textContent = m.format("DD");
  if (hourSpan) hourSpan.textContent = m.format("HH");
  if (minuteSpan) minuteSpan.textContent = m.format("mm");
}

// src/diary/ui/dialogs.ts
function createDatePicker() {
  const existingMask = document.getElementById("diary-date-filter-mask");
  const existingPopup = document.getElementById("diary-date-filter-popup");
  if (existingMask) existingMask.remove();
  if (existingPopup) existingPopup.remove();
  const mask = document.createElement("div");
  mask.id = "diary-date-filter-mask";
  mask.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:var(--background-modifier-cover);z-index:10003;display:none;";
  mask.onclick = (e) => {
    if (e.target === mask) mask.style.display = "none";
  };
  const popup = document.createElement("div");
  popup.id = "diary-date-filter-popup";
  popup.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);z-index:10004;width:90%;max-width:480px;display:flex;flex-direction:column;overflow:hidden;";
  const header = document.createElement("div");
  header.style.cssText = "padding:16px 20px;border-bottom:1px solid var(--background-modifier-border);display:flex;justify-content:space-between;align-items:center;";
  const headerTitle = document.createElement("h4");
  headerTitle.textContent = "\u6309\u65E5\u671F\u7B5B\u9009";
  headerTitle.style.cssText = "margin:0;font-size:16px;font-weight:600;color:var(--text-normal);";
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "\u5168\u90E8";
  resetBtn.style.cssText = "background:var(--background-secondary);border:none;border-radius:20px;padding:4px 12px;font-size:13px;cursor:pointer;color:var(--text-normal);";
  resetBtn.onclick = () => {
    state.data.currentDateFilter = null;
    applyFilter();
    mask.style.display = "none";
  };
  header.appendChild(headerTitle);
  header.appendChild(resetBtn);
  const content = document.createElement("div");
  content.id = "date-filter-content";
  content.style.cssText = "flex:1;overflow-y:auto;padding:20px;";
  popup.appendChild(header);
  popup.appendChild(content);
  mask.appendChild(popup);
  document.body.appendChild(mask);
}
function getYears() {
  const years = /* @__PURE__ */ new Set();
  state.data.originalDiaryEntries.forEach((entry) => {
    const year = entry.date.split("-")[0];
    years.add(year);
  });
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}
function showDatePicker() {
  const mask = document.getElementById("diary-date-filter-mask");
  const content = document.getElementById("date-filter-content");
  if (!mask || !content) return;
  const years = getYears();
  let selectedYear = years.length ? years[0] : null;
  if (state.data.currentDateFilter) {
    if (state.data.currentDateFilter.month) {
      selectedYear = state.data.currentDateFilter.year;
    } else if (state.data.currentDateFilter.year) {
      selectedYear = state.data.currentDateFilter.year;
    }
  }
  renderDatePicker(content, years, selectedYear);
  mask.style.display = "block";
}
function renderDatePicker(container, years, currentYear) {
  container.innerHTML = "";
  if (!years.length) {
    const emptyMsg = document.createElement("div");
    emptyMsg.textContent = "\u6682\u65E0\u65E5\u8BB0\u6570\u636E";
    emptyMsg.style.cssText = "text-align:center;padding:40px;color:var(--text-muted);";
    container.appendChild(emptyMsg);
    return;
  }
  const navBar = document.createElement("div");
  navBar.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;background:var(--background-secondary);border-radius:40px;padding:4px;";
  const prevBtn = document.createElement("button");
  prevBtn.textContent = "\u2039";
  prevBtn.style.cssText = "width:36px;height:36px;border-radius:50%;border:none;background:var(--background-primary);cursor:pointer;font-size:20px;color:var(--text-normal);display:flex;align-items:center;justify-content:center;";
  prevBtn.onclick = () => {
    const idx = years.indexOf(currentYear);
    if (idx < years.length - 1) {
      renderDatePicker(container, years, years[idx + 1]);
    }
  };
  const yearDisplay = document.createElement("div");
  yearDisplay.textContent = currentYear;
  yearDisplay.style.cssText = "font-weight:600;font-size:18px;color:var(--text-normal);padding:0 12px;cursor:pointer;";
  yearDisplay.onclick = () => {
    state.data.currentDateFilter = { year: currentYear };
    applyFilter();
    document.getElementById("diary-date-filter-mask").style.display = "none";
  };
  const nextBtn = document.createElement("button");
  nextBtn.textContent = "\u203A";
  nextBtn.style.cssText = "width:36px;height:36px;border-radius:50%;border:none;background:var(--background-primary);cursor:pointer;font-size:20px;color:var(--text-normal);display:flex;align-items:center;justify-content:center;";
  nextBtn.onclick = () => {
    const idx = years.indexOf(currentYear);
    if (idx > 0) {
      renderDatePicker(container, years, years[idx - 1]);
    }
  };
  navBar.appendChild(prevBtn);
  navBar.appendChild(yearDisplay);
  navBar.appendChild(nextBtn);
  container.appendChild(navBar);
  const monthStats = /* @__PURE__ */ new Map();
  state.data.originalDiaryEntries.forEach((entry) => {
    const [year, month] = entry.date.split("-");
    if (year === currentYear) {
      monthStats.set(month, (monthStats.get(month) || 0) + 1);
    }
  });
  const monthGrid = document.createElement("div");
  monthGrid.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:12px;";
  for (let i = 1; i <= 12; i++) {
    const monthStr = i.toString().padStart(2, "0");
    const count = monthStats.get(monthStr) || 0;
    const monthCard = document.createElement("div");
    monthCard.className = "diary-date-filter-month-card";
    monthCard.style.cssText = "background:var(--background-secondary);border-radius:12px;padding:12px 8px;text-align:center;cursor:pointer;transition:all 0.2s;border:1px solid transparent;";
    if (count === 0) {
      monthCard.style.opacity = "0.5";
      monthCard.style.cursor = "not-allowed";
    } else {
      monthCard.onclick = () => {
        state.data.currentDateFilter = { year: currentYear, month: monthStr };
        applyFilter();
        document.getElementById("diary-date-filter-mask").style.display = "none";
      };
      monthCard.onmouseenter = () => {
        if (count > 0) monthCard.style.background = "var(--background-modifier-hover)";
      };
      monthCard.onmouseleave = () => {
        monthCard.style.background = "var(--background-secondary)";
      };
    }
    const monthName = document.createElement("div");
    monthName.textContent = `${i}\u6708`;
    monthName.style.cssText = "font-size:15px;font-weight:500;color:var(--text-normal);margin-bottom:4px;";
    const countSpan = document.createElement("div");
    countSpan.textContent = `${count}\u7BC7`;
    countSpan.style.cssText = "font-size:12px;color:var(--text-muted);";
    monthCard.appendChild(monthName);
    monthCard.appendChild(countSpan);
    monthGrid.appendChild(monthCard);
  }
  container.appendChild(monthGrid);
  if (monthStats.size === 0) {
    const noDataMsg = document.createElement("div");
    noDataMsg.textContent = "\u8BE5\u5E74\u4EFD\u65E0\u65E5\u8BB0\u8BB0\u5F55";
    noDataMsg.style.cssText = "text-align:center;padding:20px;color:var(--text-muted);margin-top:16px;";
    container.appendChild(noDataMsg);
  }
}
function createTagPicker() {
  const existingPopup = document.getElementById("diary-tag-selector-popup");
  const existingMask = document.getElementById("diary-tag-selector-mask");
  if (existingPopup) existingPopup.remove();
  if (existingMask) existingMask.remove();
  const mask = document.createElement("div");
  mask.id = "diary-tag-selector-mask";
  mask.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:9999;display:none;";
  mask.onclick = (e) => e.target === mask && (mask.style.display = "none");
  const popup = document.createElement("div");
  popup.id = "diary-tag-selector-popup";
  popup.className = "diary-tag-selector-popup";
  popup.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);z-index:10000;padding:20px;max-width:300px;width:90%;max-height:80vh;overflow-y:auto;display:none;";
  const title = document.createElement("h4");
  title.className = "diary-tag-selector-title";
  title.textContent = "\u9009\u62E9\u7C7B\u578B";
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "diary-tag-selector-buttons";
  const actionsContainer = document.createElement("div");
  actionsContainer.className = "diary-tag-selector-actions";
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "diary-action-btn diary-delete-btn";
  deleteBtn.textContent = "\u5220\u9664";
  deleteBtn.style.cssText = "background:var(--background-modifier-error);color:var(--background-primary);margin-right:auto;";
  deleteBtn.onclick = () => {
    const entryId = popup.dataset.entryId;
    if (entryId) showConfirm(entryId);
  };
  const saveBtn = document.createElement("button");
  saveBtn.className = "diary-action-btn diary-save-btn";
  saveBtn.textContent = "\u4FDD\u5B58";
  saveBtn.onclick = () => {
    const selTagNames = [];
    buttonsContainer.querySelectorAll(".diary-tag-selector-btn.diary-active").forEach((btn) => {
      selTagNames.push(btn.dataset.tag);
    });
    const entryId = popup.dataset.entryId;
    if (selTagNames.length === 0) {
      new import_obsidian4.Notice("\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u6807\u7B7E");
      return;
    }
    if (entryId) updateTags(entryId, selTagNames);
    mask.style.display = "none";
    popup.style.display = "none";
  };
  actionsContainer.appendChild(deleteBtn);
  actionsContainer.appendChild(saveBtn);
  popup.appendChild(title);
  popup.appendChild(buttonsContainer);
  popup.appendChild(actionsContainer);
  mask.appendChild(popup);
  document.body.appendChild(mask);
}
function showTagPicker(entryId) {
  const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
  if (!entry) return;
  const mask = document.getElementById("diary-tag-selector-mask");
  const popup = document.getElementById("diary-tag-selector-popup");
  if (!mask || !popup) return;
  popup.dataset.entryId = entryId;
  const buttonsContainer = popup.querySelector(".diary-tag-selector-buttons");
  if (!buttonsContainer) return;
  buttonsContainer.innerHTML = "";
  const sortedTags = getSortedTagsForAddDialog();
  const currentTagsSet = new Set(entry.tags);
  for (const tag of sortedTags) {
    const button = document.createElement("button");
    button.className = "diary-tag-selector-btn";
    button.dataset.tag = tag;
    const emoji = getTagEmoji(tag);
    let buttonText = `${emoji} ${tag}`;
    if (isSubTag(tag)) {
      const parentTag = getParentPrimaryTag(tag);
      if (parentTag) {
        const parentEmoji = getTagEmoji(parentTag);
        buttonText += ` <span style="font-size: 12px;margin-left:4px;position: absolute;top: 0;right: 0;translate: 5px -5px;">${parentEmoji}</span>`;
      }
    }
    button.innerHTML = buttonText;
    button.style.cssText = "padding:6px 12px;border-radius:20px;background:var(--background-secondary);border:none;cursor:pointer;font-size:14px;color:var(--text-normal);position: relative;";
    if (currentTagsSet.has(tag)) {
      button.classList.add("diary-active");
      button.style.background = "var(--interactive-accent)";
      button.style.color = "var(--background-primary)";
    } else {
      button.style.background = "var(--background-secondary)";
      button.style.color = "var(--text-normal)";
    }
    button.onclick = (e) => {
      e.stopPropagation();
      button.classList.toggle("diary-active");
      if (button.classList.contains("diary-active")) {
        button.style.background = "var(--interactive-accent)";
        button.style.color = "var(--background-primary)";
      } else {
        button.style.background = "var(--background-secondary)";
        button.style.color = "var(--text-normal)";
      }
    };
    buttonsContainer.appendChild(button);
  }
  mask.style.display = "block";
  popup.style.display = "block";
}
async function updateTags(entryId, newTags) {
  const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
  if (!entry) return;
  const oldTags = [...entry.tags];
  if (oldTags.length === newTags.length && oldTags.every((t) => newTags.includes(t))) {
    return;
  }
  entry.tags = newTags;
  entry.emoji = newTags.map((tag) => getTagEmoji(tag)).join("");
  const dateStr = entry.date;
  const entries = diaryDataMap?.get(dateStr) ?? null;
  const targetEntry = entries?.find((e) => e.time === entry.time);
  if (targetEntry) {
    targetEntry.tags = newTags;
    targetEntry.emoji = entry.emoji;
  }
  await writeFile(dateStr);
  const emojiElement = document.querySelector(`#diary-entry-${CSS.escape(entryId)} .diary-emoji`);
  if (emojiElement) {
    let displayEmojiSeq = "";
    if (state.ui.singleSelectedTagForDisplay && entry.tags.includes(state.ui.singleSelectedTagForDisplay)) {
      displayEmojiSeq = getTagEmoji(state.ui.singleSelectedTagForDisplay);
    } else {
      displayEmojiSeq = entry.tags.map((tag) => getTagEmoji(tag)).join("");
    }
    emojiElement.textContent = displayEmojiSeq;
  }
  if (state.data.selectedTags.size > 0) {
    const stillMatches = entry.tags.some((tag) => state.data.selectedTags.has(tag));
    if (!stillMatches) {
      removeCard(entryId);
      const idx = state.data.currentFilteredEntries.findIndex((e) => e.id === entryId);
      if (idx !== -1) state.data.currentFilteredEntries.splice(idx, 1);
    } else {
      const idx = state.data.currentFilteredEntries.findIndex((e) => e.id === entryId);
      if (idx === -1) {
        state.data.currentFilteredEntries.push(entry);
        state.data.currentFilteredEntries.sort((a, b) => {
          const dateCmp = b.date.localeCompare(a.date);
          return dateCmp !== 0 ? dateCmp : b.timeValue - a.timeValue;
        });
        insertCard(entry);
      }
    }
  }
  rebuildTags();
  updateTitleSuffix();
}
function createAddDialog() {
  const existingMask = document.getElementById("add-diary-mask");
  const existingPopup = document.getElementById("add-diary-popup");
  if (existingMask) existingMask.remove();
  if (existingPopup) existingPopup.remove();
  const mask = document.createElement("div");
  mask.id = "add-diary-mask";
  mask.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:10001;display:none;";
  mask.onclick = (e) => e.target === mask && (mask.style.display = "none");
  const popup = document.createElement("div");
  popup.id = "add-diary-popup";
  popup.className = "add-diary-popup";
  popup.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);z-index:10002;padding:24px;max-width:400px;width:90%;max-height:80vh;overflow-y:auto;display:none;";
  const title = document.createElement("h4");
  title.className = "add-diary-title";
  title.textContent = "\u5199\u65E5\u8BB0";
  title.style.cssText = "margin:0 0 20px 0;font-size:18px;font-weight:600;color:var(--text-normal);";
  const dateTimePicker = createDateTimeControl();
  const typeLabel = document.createElement("label");
  typeLabel.textContent = "\u7C7B\u578B";
  typeLabel.style.cssText = "display:block;margin-bottom:6px;font-size:14px;color:var(--text-muted);font-weight:500;";
  const typeContainer = document.createElement("div");
  typeContainer.id = "add-diary-type-container";
  typeContainer.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;";
  const allTags = getAllAvailableTags();
  for (const tag of allTags) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "diary-tag-selector-btn";
    btn.dataset.tag = tag;
    const emoji = getTagEmoji(tag);
    let buttonText = `${emoji} ${tag}`;
    if (isSubTag(tag)) {
      const parentTag = getParentPrimaryTag(tag);
      if (parentTag) {
        const parentEmoji = getTagEmoji(parentTag);
        buttonText += ` <span style="font-size: 12px;margin-left:4px;position: absolute;top: 0;right: 0;translate: 5px -5px;">${parentEmoji}</span>`;
      }
    }
    btn.innerHTML = buttonText;
    btn.style.cssText = "padding:6px 12px;border-radius:20px;background:var(--background-secondary);border:none;cursor:pointer;font-size:14px;color:var(--text-normal);position: relative;";
    btn.onclick = (e) => {
      e.preventDefault();
      btn.classList.toggle("diary-active");
    };
    typeContainer.appendChild(btn);
  }
  const defaultBtn = typeContainer.querySelector('[data-tag="\u65E5\u8BB0"]');
  if (defaultBtn) defaultBtn.classList.add("diary-active");
  const buttonsContainer = document.createElement("div");
  buttonsContainer.style.cssText = "display:flex;gap:12px;justify-content:flex-end;";
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "\u4FDD\u5B58";
  saveBtn.style.cssText = "padding:8px 16px;border-radius:6px;border:none;background:var(--interactive-accent);color:var(--background-primary);cursor:pointer;font-size:14px;font-weight:500;";
  saveBtn.onclick = async () => await saveNewEntry();
  buttonsContainer.appendChild(saveBtn);
  popup.appendChild(title);
  popup.appendChild(dateTimePicker);
  popup.appendChild(typeLabel);
  popup.appendChild(typeContainer);
  popup.appendChild(buttonsContainer);
  mask.appendChild(popup);
  document.body.appendChild(mask);
}
function openAddDialog() {
  const mask = document.getElementById("add-diary-mask");
  const popup = document.getElementById("add-diary-popup");
  if (!mask || !popup) return;
  const typeContainer = document.getElementById("add-diary-type-container");
  if (typeContainer) {
    typeContainer.innerHTML = "";
    const sortedTags = getSortedTagsForAddDialog();
    for (const tag of sortedTags) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "diary-tag-selector-btn";
      btn.dataset.tag = tag;
      const emoji = getTagEmoji(tag);
      let buttonText = `${emoji} ${tag}`;
      if (isSubTag(tag)) {
        const parentTag = getParentPrimaryTag(tag);
        if (parentTag) {
          const parentEmoji = getTagEmoji(parentTag);
          buttonText += ` <span style="font-size: 12px;margin-left:4px;position: absolute;top: 0;right: 0;translate: 5px -5px;">${parentEmoji}</span>`;
        }
      }
      btn.innerHTML = buttonText;
      btn.style.cssText = "padding:6px 12px;border-radius:20px;background:var(--background-secondary);border:none;cursor:pointer;font-size:14px;color:var(--text-normal);position: relative;";
      btn.onclick = (e) => {
        e.preventDefault();
        btn.classList.toggle("diary-active");
      };
      typeContainer.appendChild(btn);
    }
    const defaultTag = getDefaultTagSetting();
    const defaultBtn = typeContainer.querySelector(`[data-tag="${defaultTag}"]`);
    if (defaultBtn) {
      defaultBtn.classList.add("diary-active");
      popup.dataset.selectedTag = defaultTag;
    } else {
      const firstBtn = typeContainer.querySelector(".diary-tag-selector-btn");
      if (firstBtn) {
        firstBtn.classList.add("diary-active");
        popup.dataset.selectedTag = firstBtn.dataset.tag;
      }
    }
  }
  let defaultDateStr = (0, import_obsidian4.moment)().format("YYYY-MM-DD");
  let defaultTimeStr = (0, import_obsidian4.moment)().format("HH:mm");
  if (getUseFileDateTimeSetting()) {
    const activeView = getApp().workspace.getActiveViewOfType(import_obsidian4.MarkdownView);
    if (activeView && activeView.file) {
      const file = activeView.file;
      if (file.path.startsWith(DIARY_DIRECTORY)) {
        const fileName = file.basename;
        if (/^\d{4}-\d{2}-\d{2}$/.test(fileName)) {
          defaultDateStr = fileName;
        }
      }
    }
  }
  const defaultDateTime = `${defaultDateStr} ${defaultTimeStr}`;
  const datetimeInput = document.getElementById("add-diary-datetime");
  if (datetimeInput) {
    datetimeInput.value = defaultDateTime;
    syncDateTime();
  }
  mask.style.display = "block";
  popup.style.display = "block";
  setTimeout(() => datetimeInput && datetimeInput.focus(), 100);
}
async function saveNewEntry() {
  const datetimeInput = document.getElementById("add-diary-datetime");
  const mask = document.getElementById("add-diary-mask");
  const popup = document.getElementById("add-diary-popup");
  if (!datetimeInput || !mask || !popup) return;
  const userInput = datetimeInput.value.trim();
  const typeContainer = document.getElementById("add-diary-type-container");
  const selTagNames = [];
  typeContainer.querySelectorAll(".diary-tag-selector-btn.diary-active").forEach((btn) => {
    selTagNames.push(btn.dataset.tag);
  });
  if (selTagNames.length === 0) {
    new import_obsidian4.Notice("\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u7C7B\u578B");
    return;
  }
  let targetMoment = parseNaturalTime(userInput);
  if (!targetMoment || !targetMoment.isValid()) {
    targetMoment = (0, import_obsidian4.moment)(userInput, "YYYY-MM-DD HH:mm", true);
    if (!targetMoment.isValid()) {
      new import_obsidian4.Notice("\u9519\u8BEF\uFF1A\u65E5\u671F\u65F6\u95F4\u683C\u5F0F\u4E0D\u6B63\u786E");
      return;
    }
  }
  const dateStr = targetMoment.format("YYYY-MM-DD");
  const timeStr = targetMoment.format("HH:mm");
  try {
    const newEntry = await addEntry(dateStr, timeStr, selTagNames, "");
    mask.style.display = "none";
    popup.style.display = "none";
    if (newEntry) {
      jumpToEntry(newEntry, "edit");
    }
    if (newEntry && (!selTagNames.length || newEntry.tags.some((tag) => selTagNames.includes(tag))) && (!state.data.currentDateFilter || (state.data.currentDateFilter.month ? newEntry.date.startsWith(`${state.data.currentDateFilter.year}-${state.data.currentDateFilter.month}`) : newEntry.date.startsWith(state.data.currentDateFilter.year)))) {
      state.data.currentFilteredEntries.push(newEntry);
      state.data.currentFilteredEntries.sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        return dateCmp !== 0 ? dateCmp : b.timeValue - a.timeValue;
      });
      insertCard(newEntry);
    }
  } catch (error) {
    console.error("\u4FDD\u5B58\u65E5\u8BB0\u5931\u8D25:", error);
    new import_obsidian4.Notice("\u4FDD\u5B58\u65E5\u8BB0\u5931\u8D25: " + error.message);
  }
}

// src/diary/ui/entries.ts
async function renderMarkdown(content, container, filePath) {
  if (!content) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = "";
  if (!filePath) {
    container.innerHTML = content;
    return;
  }
  const file = getApp().vault.getAbstractFileByPath(filePath);
  if (!file) {
    container.innerHTML = content;
    return;
  }
  await import_obsidian5.MarkdownRenderer.render(getApp(), content, container, file.path, new import_obsidian5.Component());
}
function applyFilter(options = {}) {
  const { skipTagCountUpdate = false } = options;
  let filtered = [...state.data.originalDiaryEntries];
  if (state.data.selectedTags.size > 0) {
    filtered = filtered.filter((entry) => {
      for (const tag of state.data.selectedTags) {
        const subTags = getSubTagsOfPrimary(tag);
        if (subTags && subTags.length > 0) {
          if (entry.tags.includes(tag) || entry.tags.some((t) => subTags.some((sub) => sub.tag === t))) {
            return true;
          }
        } else {
          if (entry.tags.includes(tag)) {
            return true;
          }
        }
      }
      return false;
    });
  }
  if (state.data.currentDateFilter) {
    filtered = filtered.filter((entry) => {
      const [year, month] = entry.date.split("-");
      if (state.data.currentDateFilter.month) {
        return year === state.data.currentDateFilter.year && month === state.data.currentDateFilter.month;
      }
      return year === state.data.currentDateFilter.year;
    });
  }
  if (state.data.currentSearchKeyword) {
    const lowerKeyword = state.data.currentSearchKeyword.toLowerCase();
    filtered = filtered.filter((entry) => {
      return entry.content.toLowerCase().includes(lowerKeyword) || entry.tags.some((tag) => tag.toLowerCase().includes(lowerKeyword)) || entry.time.toLowerCase().includes(lowerKeyword) || entry.date.includes(state.data.currentSearchKeyword);
    });
  }
  state.ui.singleSelectedTagForDisplay = state.data.selectedTags.size === 1 ? [...state.data.selectedTags][0] : null;
  state.data.currentFilteredEntries = filtered;
  state.data.currentDisplayCount = 0;
  if (state.ui.entriesContainer) {
    state.ui.entriesContainer.innerHTML = "";
    state.ui.scrollContainer = null;
  }
  renderEntries();
  updateTitleSuffix();
  refreshSubTagsBar();
  if (!skipTagCountUpdate) {
    updateTagCounts();
  }
}
function renderEntries() {
  if (!state.ui.entriesContainer) {
    state.ui.entriesContainer = document.getElementById("__diary-entries-container__");
    if (!state.ui.entriesContainer) return;
  }
  if (state.data.currentDisplayCount === 0) state.ui.entriesContainer.innerHTML = "";
  if (!state.data.currentFilteredEntries || state.data.currentFilteredEntries.length === 0) {
    if (state.data.currentDisplayCount === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.textContent = state.data.selectedTags.size > 0 ? "\u6CA1\u6709\u627E\u5230\u5339\u914D\u6807\u7B7E\u7684\u65E5\u8BB0\u5185\u5BB9" : "\u6CA1\u6709\u627E\u5230\u65E5\u8BB0\u5185\u5BB9";
      emptyMessage.style.cssText = "padding:40px;text-align:center;color:var(--text-faint);font-size:16px;";
      state.ui.entriesContainer.appendChild(emptyMessage);
    }
    return;
  }
  const startIndex = state.data.currentDisplayCount;
  const endIndex = Math.min(startIndex + BATCH_SIZE, state.data.currentFilteredEntries.length);
  const batchToShow = state.data.currentFilteredEntries.slice(startIndex, endIndex);
  if (batchToShow.length === 0) return;
  if (!state.ui.scrollContainer) {
    state.ui.scrollContainer = document.createElement("div");
    state.ui.scrollContainer.className = "diary-scroll-container";
    state.ui.scrollContainer.style.cssText = "padding:0 20px;";
    state.ui.entriesContainer.appendChild(state.ui.scrollContainer);
  }
  let lastDate = null;
  let dateSection = null;
  batchToShow.forEach((entry) => {
    if (entry.date !== lastDate) {
      dateSection = document.createElement("div");
      dateSection.className = "date-section";
      dateSection.style.cssText = "position:relative;";
      const dateSeparator = document.createElement("div");
      dateSeparator.className = "diary-date-separator";
      dateSeparator.dataset.date = entry.date;
      dateSeparator.style.cssText = "position:sticky;top:0;z-index:10;12px 12px 0px 0px;background:var(--background-primary);color:var(--text-normal);font-weight:600;font-size:18px;";
      dateSeparator.textContent = entry.date;
      dateSection.appendChild(dateSeparator);
      state.ui.scrollContainer.appendChild(dateSection);
      lastDate = entry.date;
    }
    const entryCard = createEntryCard(entry);
    if (dateSection) dateSection.appendChild(entryCard);
    else state.ui.scrollContainer.appendChild(entryCard);
  });
  state.data.currentDisplayCount = endIndex;
  if (getIsProcessingRemainingFiles()) {
    const loadingHint = document.createElement("div");
    loadingHint.className = "loading-hint";
    loadingHint.id = "loading-hint";
    loadingHint.textContent = "\u540E\u53F0\u52A0\u8F7D\u4E2D\uFF0C\u8BF7\u7A0D\u5019...";
    loadingHint.style.cssText = "text-align:center;color:var(--text-faint);padding:20px;font-size:14px;";
    state.ui.scrollContainer.appendChild(loadingHint);
  } else if (state.data.currentDisplayCount >= state.data.currentFilteredEntries.length) {
    const allLoaded = document.createElement("div");
    allLoaded.className = "all-loaded-hint";
    allLoaded.textContent = "\u5DF2\u663E\u793A\u6240\u6709\u65E5\u8BB0";
    allLoaded.style.cssText = "text-align:center;color:var(--text-faint);padding:20px;font-size:14px;";
    state.ui.scrollContainer.appendChild(allLoaded);
  }
  state.data.isLoadingMore = false;
}
function createEntryCard(entry) {
  const entryCard = document.createElement("div");
  entryCard.className = "diary-entry-card";
  entryCard.id = `diary-entry-${entry.id}`;
  entryCard.style.cssText = "border:1px solid var(--background-modifier-border);border-radius:12px;padding:20px;background:var(--background-primary);margin:20px 0;";
  const header = document.createElement("div");
  header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;";
  const timeInfo = document.createElement("div");
  timeInfo.style.cssText = "display:flex;align-items:center;gap:8px;";
  let displayEmojiSeq = "";
  if (state.ui.singleSelectedTagForDisplay && entry.tags.includes(state.ui.singleSelectedTagForDisplay)) {
    displayEmojiSeq = getTagEmoji(state.ui.singleSelectedTagForDisplay);
  } else {
    displayEmojiSeq = entry.tags.map((tag) => getTagEmoji(tag)).join("");
  }
  const emojiSpan = document.createElement("span");
  emojiSpan.className = "diary-emoji";
  emojiSpan.dataset.entryId = entry.id;
  emojiSpan.textContent = displayEmojiSeq;
  emojiSpan.style.cssText = "font-size:20px;cursor:pointer;user-select:none;";
  emojiSpan.addEventListener("click", (e) => {
    e.stopPropagation();
    showTagPicker(entry.id);
  });
  const timeSpan = document.createElement("span");
  timeSpan.style.cssText = "font-weight:600;color:var(--text-normal);font-size:16px;";
  timeSpan.textContent = entry.time;
  timeInfo.appendChild(emojiSpan);
  timeInfo.appendChild(timeSpan);
  header.appendChild(timeInfo);
  const content = document.createElement("div");
  content.className = "diary-entry-content";
  content.dataset.entryId = entry.id;
  content.style.cssText = "color:var(--text-normal);line-height:1.6;white-space:normal;font-size:15px;margin-bottom:12px;padding:8px;border-radius:4px;min-height:50px;cursor:text;user-select:text;";
  addLongPress(content, "content", entry.id);
  fixMobileSelect(content);
  let lastClickTime = 0;
  content.addEventListener("click", async (e) => {
    const currentTime = (/* @__PURE__ */ new Date()).getTime();
    const timeDiff = currentTime - lastClickTime;
    if (timeDiff < 300 && timeDiff > 0) {
      e.stopPropagation();
      e.preventDefault();
      await jumpToEntry(entry);
    }
    lastClickTime = currentTime;
  });
  const contentText = entry.content.trim();
  let filePath = entry.filename.includes("/") ? entry.filename : `${DIARY_DIRECTORY}/${entry.filename}.md`;
  renderMarkdown(contentText, content, filePath);
  entryCard.appendChild(header);
  entryCard.appendChild(content);
  return entryCard;
}
async function jumpToEntry(entry, mode = "select") {
  const isMovieEntry = entry.id && entry.id.startsWith("movie-") || entry.filename && entry.filename.startsWith(MOVIE_DIRECTORY);
  if (isMovieEntry) {
    const file2 = getApp().vault.getAbstractFileByPath(entry.filename);
    if (!file2) {
      new import_obsidian5.Notice("\u627E\u4E0D\u5230\u5F71\u89C6\u6587\u4EF6");
      return;
    }
    await getApp().workspace.openLinkText(file2.path, "", false, { active: true });
    if (state.ui.maskLayer) state.ui.maskLayer.style.visibility = "hidden";
    if (state.ui.tagFilterPopup) state.ui.tagFilterPopup.style.visibility = "hidden";
    return;
  }
  const fileName = entry.filename;
  const filePath = `${DIARY_DIRECTORY}/${fileName}.md`;
  const anchor = `${entry.emoji} ${entry.time}`;
  const link = `${DIARY_DIRECTORY}/${fileName}#${anchor}`;
  const file = getApp().vault.getAbstractFileByPath(filePath);
  if (!file) {
    new import_obsidian5.Notice("\u627E\u4E0D\u5230\u65E5\u8BB0\u6587\u4EF6");
    return;
  }
  await getApp().workspace.openLinkText(link, "", false, { active: true });
  if (state.ui.maskLayer) state.ui.maskLayer.style.visibility = "hidden";
  if (state.ui.tagFilterPopup) state.ui.tagFilterPopup.style.visibility = "hidden";
}
function addLongPress(element, type, entryId) {
  if (!getEnableLongPressSetting()) return;
  let pressTimer = null;
  let isLongPress = false;
  let touchStartX = 0;
  let touchStartY = 0;
  const MOVE_THRESHOLD = 10;
  const duration = LONG_PRESS_DURATION;
  const longPressHandler = () => {
    if (type === "content") {
      copyLink(entryId);
    } else if (type === "emoji") {
      showTagPicker(entryId);
    }
  };
  element.addEventListener(
    "touchstart",
    (e) => {
      if (state.ui.editingEntryId === entryId) return;
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      isLongPress = false;
      pressTimer = setTimeout(() => {
        isLongPress = true;
        longPressHandler();
      }, duration);
    },
    { passive: true }
  );
  element.addEventListener(
    "touchmove",
    (e) => {
      if (!pressTimer) return;
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartX);
      const deltaY = Math.abs(touch.clientY - touchStartY);
      if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    },
    { passive: true }
  );
  element.addEventListener("touchend", (e) => {
    if (pressTimer) clearTimeout(pressTimer);
    if (isLongPress) {
      e.preventDefault();
      isLongPress = false;
    }
  });
  element.addEventListener("mousedown", (e) => {
    if (state.ui.editingEntryId === entryId) return;
    pressTimer = setTimeout(longPressHandler, duration);
  });
  element.addEventListener("mouseup", () => {
    if (pressTimer) clearTimeout(pressTimer);
  });
  element.addEventListener("mouseleave", () => {
    if (pressTimer) clearTimeout(pressTimer);
  });
}
async function copyLink(entryId) {
  const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
  if (!entry) return;
  const link = `[[${entry.filename}#${entry.emoji} ${entry.time}]]`;
  await navigator.clipboard.writeText(link);
  new import_obsidian5.Notice(`\u5DF2\u590D\u5236\u53CC\u94FE\u5F15\u7528: ${link}`);
}
function cancelEdit(entryId, originalHTML) {
  const contentElement = document.querySelector(
    `.diary-entry-content[data-entry-id="${entryId}"]`
  );
  if (!contentElement) return;
  contentElement.contentEditable = "false";
  contentElement.classList.remove("diary-editing");
  contentElement.style.touchAction = "";
  if (originalHTML) contentElement.innerHTML = originalHTML;
  else {
    const entry = state.data.originalDiaryEntries.find((e) => e.id === entryId);
    if (entry) {
      const filePath = `${DIARY_DIRECTORY}/${entry.filename}.md`;
      renderMarkdown(entry.content.trim(), contentElement, filePath);
    }
  }
  if (contentElement._editHandlers) {
    contentElement.removeEventListener("keydown", contentElement._editHandlers.keydown);
    delete contentElement._editHandlers;
  }
  const actionsContainer = contentElement.nextElementSibling;
  if (actionsContainer && actionsContainer.classList.contains("diary-edit-actions")) actionsContainer.remove();
  if (state.ui.editingEntryId === entryId) state.ui.editingEntryId = null;
}
function showConfirm(entryId) {
  confirm({
    title: "\u786E\u8BA4\u5220\u9664",
    message: "\u786E\u5B9A\u8981\u5220\u9664\u8FD9\u7BC7\u65E5\u8BB0\u5417\uFF1F\n\n\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\uFF0C\u65E5\u8BB0\u5C06\u4ECE\u7B14\u8BB0\u4E2D\u6C38\u4E45\u5220\u9664\u3002",
    confirmText: "\u5220\u9664\u65E5\u8BB0",
    onConfirm: async () => {
      await deleteEntry(entryId);
      const tagSelectorMask = document.getElementById("diary-tag-selector-mask");
      const tagSelectorPopup = document.getElementById("diary-tag-selector-popup");
      if (tagSelectorMask) tagSelectorMask.style.display = "none";
      if (tagSelectorPopup) tagSelectorPopup.style.display = "none";
    }
  });
}
function removeCard(entryId) {
  const card = document.getElementById(`diary-entry-${entryId}`);
  if (card) card.remove();
}
function insertCard(entry) {
  if (!state.ui.scrollContainer) return;
  const entryCard = createEntryCard(entry);
  const dateSections = state.ui.scrollContainer.querySelectorAll(".date-section");
  let targetSection = null;
  for (const section of dateSections) {
    const sep = section.querySelector(".diary-date-separator");
    if (sep && sep.dataset.date === entry.date) {
      targetSection = section;
      break;
    }
  }
  if (targetSection) {
    const cards = targetSection.querySelectorAll(".diary-entry-card");
    let inserted = false;
    for (let i = 0; i < cards.length; i++) {
      const cardTime = cards[i].querySelector(".diary-entry-content")?.getAttribute("data-entry-id")?.split("-").slice(1, -1).join("-") ?? "";
      if (entry.time > cardTime) {
        targetSection.insertBefore(entryCard, cards[i]);
        inserted = true;
        break;
      }
    }
    if (!inserted) targetSection.appendChild(entryCard);
  } else {
    const newSection = document.createElement("div");
    newSection.className = "date-section";
    newSection.style.cssText = "position:relative;margin-top:20px;";
    const dateSeparator = document.createElement("div");
    dateSeparator.className = "diary-date-separator";
    dateSeparator.dataset.date = entry.date;
    dateSeparator.style.cssText = "position:sticky;top:0;z-index:10;padding:12px 0;background:var(--background-primary);color:var(--text-normal);font-weight:600;font-size:18px;";
    dateSeparator.textContent = entry.date;
    newSection.appendChild(dateSeparator);
    newSection.appendChild(entryCard);
    let inserted = false;
    const sections = state.ui.scrollContainer.querySelectorAll(".date-section");
    for (let i = 0; i < sections.length; i++) {
      const sep = sections[i].querySelector(".diary-date-separator");
      if (sep && (sep.dataset.date ?? "") < entry.date) {
        state.ui.scrollContainer.insertBefore(newSection, sections[i]);
        inserted = true;
        break;
      }
    }
    if (!inserted) state.ui.scrollContainer.appendChild(newSection);
  }
}
function initScroll() {
  if (!state.ui.entriesContainer)
    state.ui.entriesContainer = document.getElementById("__diary-entries-container__");
  state.ui.entriesContainer.addEventListener("scroll", () => {
    if (state.data.isLoadingMore) return;
    const scrollTop = state.ui.entriesContainer.scrollTop;
    const scrollHeight = state.ui.entriesContainer.scrollHeight;
    const clientHeight = state.ui.entriesContainer.clientHeight;
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      state.data.isLoadingMore = true;
      renderEntries();
    }
    updateSticky();
  });
  setTimeout(updateSticky, 100);
}
function updateSticky() {
  if (!state.ui.entriesContainer || !state.ui.scrollContainer) return;
  const dateSeparators = state.ui.scrollContainer.querySelectorAll(".diary-date-separator");
  if (dateSeparators.length === 0) return;
  const containerRect = state.ui.entriesContainer.getBoundingClientRect();
  const scrollTop = state.ui.entriesContainer.scrollTop;
  let currentStickyDate = null;
  for (let i = dateSeparators.length - 1; i >= 0; i--) {
    const separator = dateSeparators[i];
    const separatorRect = separator.getBoundingClientRect();
    const separatorTop = separatorRect.top - containerRect.top + scrollTop;
    if (separatorTop <= scrollTop + 5) {
      currentStickyDate = separator;
      break;
    }
  }
  dateSeparators.forEach((separator) => {
    const el = separator;
    el.style.position = "sticky";
    el.style.top = "0";
    el.style.zIndex = "10";
    el.style.background = "var(--background-primary)";
  });
  if (currentStickyDate) currentStickyDate.style.zIndex = "20";
}
function fixMobileSelect(element) {
  if (!state.ui.isTouchDevice) return;
  element.addEventListener(
    "touchstart",
    function mobileCursorFix(e) {
      if (document.activeElement !== this) {
        this.focus();
        setTimeout(() => {
          if (window.getSelection && window.getSelection().rangeCount === 0) {
            const range = document.createRange();
            range.selectNodeContents(this);
            range.collapse(false);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }, 50);
      }
    },
    { passive: true }
  );
  element.addEventListener(
    "touchmove",
    function preventScroll(e) {
      if (state.ui.editingEntryId) e.stopPropagation();
    },
    { passive: false }
  );
}

// src/diary/ui/quote.ts
var import_obsidian6 = require("obsidian");

// src/core/utils.ts
function escapeHtml(str) {
  return str.replace(/[&<>]/g, (m) => {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return m;
  });
}
function generateBlockId() {
  return Math.random().toString(36).substr(2, 6);
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// src/diary/ui/quote.ts
var diaryCommandRegistered = false;
async function registerOpenDialogCommand() {
  if (!diaryCommandRegistered) {
    getApp().commands.addCommand({
      id: "diary-open-add-dialog",
      name: "\u6253\u5F00\u5199\u65E5\u8BB0\u5F39\u7A97",
      callback: () => {
        openAddDialog();
      }
    });
    diaryCommandRegistered = true;
  }
}
async function getSelectedTextAndBlockId() {
  const activeView = getApp().workspace.getActiveViewOfType(import_obsidian6.MarkdownView);
  if (!activeView || !activeView.editor) {
    new import_obsidian6.Notice("\u8BF7\u5148\u6253\u5F00\u4E00\u4E2A\u7B14\u8BB0\u6587\u4EF6");
    return null;
  }
  const editor = activeView.editor;
  const file = activeView.file;
  if (!file) {
    new import_obsidian6.Notice("\u8BF7\u5148\u6253\u5F00\u4E00\u4E2A\u7B14\u8BB0\u6587\u4EF6");
    return null;
  }
  let rawSelectedText = "";
  let targetLine = -1;
  let dateFromSpan = null;
  let cleanSpanContent = "";
  if (editor.somethingSelected()) {
    rawSelectedText = editor.getSelection();
    const selection = editor.listSelections()[0];
    if (selection) targetLine = selection.anchor.line;
  } else {
    const cursor = editor.getCursor();
    targetLine = cursor.line;
    rawSelectedText = editor.getLine(targetLine).trim();
    if (!rawSelectedText) {
      new import_obsidian6.Notice("\u5F53\u524D\u884C\u6CA1\u6709\u6587\u5B57\u5185\u5BB9");
      return null;
    }
  }
  if (!rawSelectedText) {
    new import_obsidian6.Notice("\u672A\u83B7\u53D6\u5230\u6587\u5B57\u5185\u5BB9");
    return null;
  }
  const spanRegex = /<span[^>]*>([\s\S]*?)<\/span>/i;
  const match = rawSelectedText.match(spanRegex);
  let commentValue = null;
  if (match) {
    const spanContent = match[1];
    cleanSpanContent = spanContent.replace(/<[^>]*>/g, "").trim();
    const dateMatch = rawSelectedText.match(/data-date\s*=\s*["']([^"']+)["']/i);
    if (dateMatch) {
      dateFromSpan = dateMatch[1];
    } else {
      const fileCache = getApp().metadataCache.getFileCache(file);
      if (fileCache && fileCache.frontmatter && fileCache.frontmatter.readingDate) {
        const readingDate = fileCache.frontmatter.readingDate;
        const readingMoment = (0, import_obsidian6.moment)(readingDate);
        if (readingMoment.isValid()) {
          dateFromSpan = readingMoment.format("YYYY-MM-DD HH:mm:ss");
        } else {
          dateFromSpan = (0, import_obsidian6.moment)().format("YYYY-MM-DD HH:mm:ss");
        }
      } else {
        dateFromSpan = (0, import_obsidian6.moment)().format("YYYY-MM-DD HH:mm:ss");
      }
    }
    const commentMatch = rawSelectedText.match(/data-comment\s*=\s*["']([^"']*)["']/i);
    commentValue = commentMatch ? commentMatch[1] : null;
  }
  const cleanSelectedText = rawSelectedText.replace(/\s+\^[a-zA-Z0-9\-_]+$/, "");
  const lineText = editor.getLine(targetLine);
  const blockIdMatch = lineText.match(/\^([a-zA-Z0-9\-_]+)$/);
  let blockId;
  if (blockIdMatch) {
    blockId = blockIdMatch[1];
  } else {
    blockId = generateBlockId();
    const newLine = lineText + " ^" + blockId;
    editor.setLine(targetLine, newLine);
    await getApp().vault.modify(file, editor.getValue());
    await sleep(100);
  }
  const displayText = cleanSpanContent || cleanSelectedText;
  const wikiLink = `[[${file.path.replace(/\.md$/, "")}#^${blockId}|${displayText}]]`;
  return {
    wikiLink,
    selectedText: displayText,
    // 用于预览
    originalRawText: rawSelectedText,
    // 原始文本
    filePath: file.path,
    blockId,
    dateFromSpan,
    // 从span中提取的日期
    hasSpan: !!match,
    // 标记是否有span
    commentValue
  };
}
function addPreviewToDialog(popup, text, q) {
  if (q.previewElement) q.previewElement.remove();
  const previewElement = document.createElement("div");
  previewElement.style.cssText = `
      margin: 0 0 16px 0;
      padding: 0;
  `;
  const label = document.createElement("label");
  label.textContent = "\u6458\u6284\u5185\u5BB9";
  label.style.cssText = `
      display: block;
      margin-bottom: 6px;
      font-size: 14px;
      color: var(--text-muted);
      font-weight: 500;
  `;
  const contentDiv = document.createElement("div");
  contentDiv.style.cssText = `
      padding: 12px;
      background: var(--background-secondary);
      border-radius: 8px;
      font-size: 14px;
      color: var(--text-normal);
      max-height: 150px;
      overflow-y: auto;
      ;white-space: pre-wrap
      word-break: break-word;
  `;
  contentDiv.innerHTML = escapeHtml(text);
  previewElement.appendChild(label);
  previewElement.appendChild(contentDiv);
  const dateTimeControl = popup.querySelector(".datetime-picker-container");
  if (dateTimeControl) {
    dateTimeControl.parentNode.insertBefore(previewElement, dateTimeControl);
  } else {
    const title = popup.querySelector(".add-diary-title");
    if (title) title.insertAdjacentElement("afterend", previewElement);
    else popup.insertBefore(previewElement, popup.firstChild);
  }
  return previewElement;
}
function cleanupDialogOverrides(popup, mask, q) {
  if (q.previewElement) {
    q.previewElement.remove();
    q.previewElement = null;
  }
  if (q.originalSaveHandler && popup) {
    const saveBtn = Array.from(popup.querySelectorAll("button")).find((btn) => btn.textContent === "\u4FDD\u5B58");
    if (saveBtn) saveBtn.onclick = q.originalSaveHandler;
  }
  if (q.originalCancelHandler && popup) {
    const cancelBtn = Array.from(popup.querySelectorAll("button")).find((btn) => btn.textContent === "\u53D6\u6D88");
    if (cancelBtn) cancelBtn.onclick = q.originalCancelHandler;
  }
  if (q.originalMaskHandler && mask) mask.onclick = q.originalMaskHandler;
  q.pendingQuoteData = null;
}
function createQuoteSaveHandler(popup, mask, quoteData, q) {
  return async function() {
    const datetimeInput = document.getElementById("add-diary-datetime");
    if (!datetimeInput) {
      new import_obsidian6.Notice("\u65E0\u6CD5\u83B7\u53D6\u65E5\u671F\u65F6\u95F4");
      return;
    }
    if (!quoteData.wikiLink || quoteData.wikiLink.trim() === "") {
      new import_obsidian6.Notice("\u6458\u6284\u5185\u5BB9\u4E3A\u7A7A\uFF0C\u65E0\u6CD5\u4FDD\u5B58");
      return;
    }
    const typeContainer = document.getElementById("add-diary-type-container");
    const selTagNames = [];
    typeContainer.querySelectorAll(".diary-tag-selector-btn.diary-active").forEach((btn) => {
      selTagNames.push(btn.dataset.tag);
    });
    if (selTagNames.length === 0) {
      new import_obsidian6.Notice("\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u6807\u7B7E");
      return;
    }
    const userInput = datetimeInput.value.trim();
    let targetMoment = parseNaturalTime(userInput);
    if (!targetMoment || !targetMoment.isValid()) {
      targetMoment = (0, import_obsidian6.moment)(userInput, "YYYY-MM-DD HH:mm", true);
      if (!targetMoment.isValid()) {
        new import_obsidian6.Notice("\u65E5\u671F\u65F6\u95F4\u683C\u5F0F\u4E0D\u6B63\u786E");
        return;
      }
    }
    const dateStr = targetMoment.format("YYYY-MM-DD");
    const timeStr = targetMoment.format("HH:mm");
    try {
      let finalContent = quoteData.wikiLink;
      if (quoteData.commentValue) {
        finalContent += quoteData.commentValue;
      }
      if (quoteData.filePath && quoteData.filePath.startsWith("\u4E66\u5E93/")) {
        const fileName = quoteData.filePath.split("/").pop().replace(/\.md$/, "");
        finalContent += `

#\u300A${fileName}\u300B`;
      }
      const newEntry = await addEntry(dateStr, timeStr, selTagNames, finalContent);
      if (!newEntry) throw new Error("addEntry \u8FD4\u56DE\u7A7A");
      new import_obsidian6.Notice("\u6458\u6284\u5DF2\u4FDD\u5B58");
      mask.style.display = "none";
      popup.style.display = "none";
      cleanupDialogOverrides(popup, mask, q);
      await jumpToEntry(newEntry, "edit");
    } catch (error) {
      console.error("\u4FDD\u5B58\u6458\u6284\u5931\u8D25:", error);
      new import_obsidian6.Notice("\u4FDD\u5B58\u6458\u6284\u5931\u8D25: " + error.message);
    }
  };
}
async function registerQuoteCommand() {
  const q = {
    pendingQuoteData: null,
    originalSaveHandler: null,
    originalCancelHandler: null,
    originalMaskHandler: null,
    previewElement: null
  };
  getApp().commands.addCommand({
    id: "diary-create-quote",
    name: "\u5199\u6458\u6284",
    callback: async () => {
      console.log("\u{1F4DD} \u5199\u6458\u6284\u547D\u4EE4\u88AB\u89E6\u53D1");
      const quoteData = await getSelectedTextAndBlockId();
      if (!quoteData) return;
      q.pendingQuoteData = quoteData;
      if (!document.getElementById("add-diary-mask")) {
        new import_obsidian6.Notice("\u65E5\u8BB0\u5F39\u7A97\u672A\u521D\u59CB\u5316\uFF0C\u8BF7\u5148\u6253\u5F00\u65E5\u8BB0\u672C");
        return;
      }
      openAddDialog();
      await sleep(150);
      const mask = document.getElementById("add-diary-mask");
      const popup = document.getElementById("add-diary-popup");
      if (!mask || !popup) {
        new import_obsidian6.Notice("\u65E0\u6CD5\u6253\u5F00\u65E5\u8BB0\u5F39\u7A97");
        q.pendingQuoteData = null;
        return;
      }
      q.previewElement = addPreviewToDialog(
        popup,
        quoteData.selectedText + (quoteData.commentValue ? `\uFF08${quoteData.commentValue}\uFF09` : ""),
        q
      );
      const typeContainer = document.getElementById("add-diary-type-container");
      if (typeContainer) {
        typeContainer.querySelectorAll(".diary-tag-selector-btn").forEach((btn) => {
          btn.classList.remove("diary-active");
        });
        const quoteBtn = typeContainer.querySelector('[data-tag="\u6458\u6284"]');
        if (quoteBtn) quoteBtn.classList.add("diary-active");
      }
      const datetimeInput = document.getElementById("add-diary-datetime");
      if (datetimeInput) {
        datetimeInput.value = (0, import_obsidian6.moment)().format("YYYY-MM-DD HH:mm");
        if (quoteData.dateFromSpan) {
          const dateMatch = quoteData.dateFromSpan.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):\d{2}$/);
          if (dateMatch) {
            datetimeInput.value = `${dateMatch[1]} ${dateMatch[2]}`;
          } else {
            const m = (0, import_obsidian6.moment)(quoteData.dateFromSpan, ["YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm"], true);
            if (m.isValid()) {
              datetimeInput.value = m.format("YYYY-MM-DD HH:mm");
            }
          }
        }
        syncDateTime();
      }
      const allBtns = Array.from(popup.querySelectorAll("button"));
      const originalSaveBtn = allBtns.find((btn) => btn.textContent === "\u4FDD\u5B58");
      if (originalSaveBtn) {
        q.originalSaveHandler = originalSaveBtn.onclick;
        const newSaveBtn = originalSaveBtn.cloneNode(true);
        newSaveBtn.onclick = null;
        originalSaveBtn.parentNode.replaceChild(newSaveBtn, originalSaveBtn);
        newSaveBtn.onclick = createQuoteSaveHandler(popup, mask, quoteData, q);
        console.log("\u2705 \u4FDD\u5B58\u6309\u94AE\u5DF2\u66FF\u6362");
      } else {
        console.warn("\u274C \u672A\u627E\u5230\u6587\u672C\u4E3A'\u4FDD\u5B58'\u7684\u6309\u94AE");
      }
      q.originalMaskHandler = mask.onclick;
      mask.onclick = (e) => {
        if (e.target === mask) cleanupDialogOverrides(popup, mask, q);
        if (q.originalMaskHandler) q.originalMaskHandler.call(mask, e);
      };
    }
  });
}

// src/diary/ui/panel.ts
function ensureProgressBar() {
  const tagContainer = document.getElementById("diary-tag-container");
  if (!tagContainer) return null;
  let progressBar = tagContainer.querySelector(".diary-github-progress-bar");
  if (!progressBar) {
    progressBar = document.createElement("div");
    progressBar.className = "diary-github-progress-bar";
    tagContainer.insertBefore(progressBar, tagContainer.querySelector(".diary-tags-scroll-container"));
  }
  progressBar.style.width = "0%";
  progressBar.style.opacity = "1";
  progressBar.style.height = "2px";
  return progressBar;
}
function updateProgress(loadedCount, totalCount) {
  const bar = ensureProgressBar();
  if (!bar) return;
  if (totalCount === 0) {
    bar.style.opacity = "0";
    return;
  }
  const percent = loadedCount / totalCount * 100;
  bar.style.width = `${percent}%`;
  if (loadedCount >= totalCount) {
    bar.style.opacity = "0";
  }
}
function createMaskAndPopup() {
  const existingMask = document.getElementById("diary-filter-mask");
  const existingPopup = document.getElementById("diary-tag-filter");
  if (existingMask) existingMask.remove();
  if (existingPopup) existingPopup.remove();
  state.ui.maskLayer = document.createElement("div");
  state.ui.maskLayer.id = "diary-filter-mask";
  state.ui.maskLayer.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:var(--background-modifier-cover);z-index:9998;visibility:hidden;";
  state.ui.maskLayer.onclick = () => {
    state.ui.maskLayer.style.visibility = "hidden";
    state.ui.tagFilterPopup.style.visibility = "hidden";
  };
  state.ui.tagFilterPopup = document.createElement("div");
  state.ui.tagFilterPopup.id = "diary-tag-filter";
  state.ui.tagFilterPopup.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.2);z-index:9999;width:90%;max-width:800px;max-height:80vh;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif;visibility:hidden;";
  const header = createHeader();
  const tagsContainer = createTagBar();
  state.ui.entriesContainer = document.createElement("div");
  state.ui.entriesContainer.id = "__diary-entries-container__";
  state.ui.entriesContainer.style.cssText = "flex:1;overflow-y:auto;padding:0;position:relative;min-height:300px;";
  const searchContainer = document.createElement("div");
  searchContainer.id = "diary-search-container";
  searchContainer.style.cssText = "padding: 0 24px 12px 24px;";
  const searchInput = document.createElement("input");
  searchInput.id = "diary-search-input";
  searchInput.type = "text";
  searchInput.placeholder = "\u{1F50D} \u641C\u7D22\u65E5\u8BB0\uFF08\u6B63\u6587\u3001\u7C7B\u578B\u3001\u65F6\u95F4\uFF09...";
  searchInput.style.cssText = `
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  background: var(--background-primary);
  color: var(--text-normal);
  outline: none;
  box-sizing: border-box;
`;
  searchInput.addEventListener("input", (e) => {
    const keyword = e.target.value.trim();
    if (state.data.searchDebounceTimer) clearTimeout(state.data.searchDebounceTimer);
    state.data.searchDebounceTimer = setTimeout(() => {
      state.data.currentSearchKeyword = keyword;
      applyFilter();
    }, 300);
  });
  searchContainer.appendChild(searchInput);
  state.ui.tagFilterPopup.appendChild(header);
  state.ui.tagFilterPopup.appendChild(tagsContainer);
  state.ui.tagFilterPopup.appendChild(searchContainer);
  state.ui.tagFilterPopup.appendChild(state.ui.entriesContainer);
  const subTagsContainer = document.createElement("div");
  subTagsContainer.id = "diary-subtags-container";
  subTagsContainer.style.cssText = "padding: 0 24px 12px 24px; display: none; flex-wrap: wrap; gap: 8px;  margin-top: 12px;";
  const tagContainer = document.getElementById("diary-tag-container");
  if (tagContainer && tagContainer.parentNode) {
    tagContainer.insertAdjacentElement("afterend", subTagsContainer);
  } else {
    state.ui.tagFilterPopup.insertBefore(subTagsContainer, searchContainer);
  }
  document.body.appendChild(state.ui.maskLayer);
  document.body.appendChild(state.ui.tagFilterPopup);
  createTagPicker();
}
function createHeader() {
  const header = document.createElement("div");
  header.className = "diary-popup-header";
  header.style.cssText = "padding:20px 24px 12px 24px;display:flex;justify-content:space-between;align-items:center;";
  const titleContainer = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = "\u65E5\u8BB0\u672C";
  title.style.cssText = "margin:0;font-size:18px;font-weight:600;color:var(--text-normal);cursor:pointer;display:flex;align-items:center;";
  title.onclick = (e) => {
    e.stopPropagation();
    showDatePicker();
  };
  titleContainer.appendChild(title);
  const buttonContainer = document.createElement("div");
  buttonContainer.style.cssText = "display:flex;align-items:center;gap:12px;";
  const searchButton = createButton("\u{1F50D}", "\u641C\u7D22\u65E5\u8BB0", () => toggleSearch());
  searchButton.style.fontSize = "15px";
  searchButton.style.marginTop = "4px";
  searchButton.style.opacity = "0";
  searchButton.style.pointerEvents = "none";
  const addButton = createButton("\u270F\uFE0F", "\u5199\u65E5\u8BB0", () => openAddDialog());
  addButton.style.fontSize = "15px";
  addButton.style.marginTop = "4px";
  const closeButton = createButton("\u274C", "\u5173\u95ED", () => {
    state.ui.maskLayer.style.visibility = "hidden";
    state.ui.tagFilterPopup.style.visibility = "hidden";
  });
  closeButton.style.fontSize = "13px";
  closeButton.style.marginTop = "5px";
  buttonContainer.appendChild(addButton);
  buttonContainer.appendChild(searchButton);
  buttonContainer.appendChild(closeButton);
  header.appendChild(titleContainer);
  header.appendChild(buttonContainer);
  return header;
}
function createButton(text, title, onClick) {
  const button = document.createElement("button");
  button.textContent = text;
  button.title = title;
  button.style.cssText = "background:none;border:none;font-size:28px;cursor:pointer;color:var(--text-muted);padding:0;width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;box-shadow:none;transition:background 0.2s;margin-top:0px;";
  button.onmouseover = () => button.style.background = "var(--background-secondary)";
  button.onmouseout = () => button.style.background = "none";
  button.onclick = onClick;
  return button;
}
function createTagBar() {
  const tagsContainer = document.createElement("div");
  tagsContainer.id = "diary-tag-container";
  tagsContainer.style.cssText = "padding:10px 24px;";
  const tagsScrollContainer = document.createElement("div");
  tagsScrollContainer.className = "diary-tags-scroll-container";
  for (const [tag, config] of Object.entries(getPrimaryTagsConfig())) {
    tagsScrollContainer.appendChild(createTag(tag, config.emoji, null));
  }
  tagsContainer.appendChild(tagsScrollContainer);
  return tagsContainer;
}
function setLoadingState(loading) {
  const searchBtn = document.querySelector('.diary-popup-header button[title="\u641C\u7D22\u65E5\u8BB0"]');
  const searchContainer = document.getElementById("diary-search-container");
  const searchInput = document.getElementById("diary-search-input");
  if (searchBtn) {
    searchBtn.disabled = loading;
    searchBtn.style.opacity = loading ? "0.5" : "1";
    searchBtn.style.pointerEvents = loading ? "none" : "auto";
  }
  if (loading) {
    if (searchContainer && searchContainer.style.display !== "none") {
      searchContainer.style.display = "none";
    }
    if (searchInput) {
      searchInput.value = "";
    }
    if (state.data.searchDebounceTimer) clearTimeout(state.data.searchDebounceTimer);
    state.data.currentSearchKeyword = "";
  }
}
function toggleSearch() {
  const searchContainer = document.getElementById("diary-search-container");
  const searchInput = document.getElementById("diary-search-input");
  if (!searchContainer) return;
  if (searchContainer.style.display === "none" || getComputedStyle(searchContainer).display === "none") {
    searchContainer.style.display = "block";
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  } else {
    searchContainer.style.display = "none";
    if (searchInput) {
      searchInput.value = "";
    }
    state.data.currentSearchKeyword = "";
    if (state.data.searchDebounceTimer) clearTimeout(state.data.searchDebounceTimer);
    applyFilter();
  }
}
var diaryEscHandle = null;
var refreshCallbacksRegistered = false;
async function init(plugin) {
  try {
    if (document.getElementById("diary-tag-filter")) {
      document.getElementById("diary-tag-filter").style.visibility = "visible";
      const mask = document.getElementById("diary-filter-mask");
      if (mask) mask.style.visibility = "visible";
      if (state.ui.scrollContainer) setTimeout(updateSticky, 100);
      return;
    }
    state.ui.isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!refreshCallbacksRegistered) {
      onFullRefresh(() => {
        if (state.ui.editingEntryId) cancelEdit(state.ui.editingEntryId, null);
        applyFilter();
        rebuildTags();
      });
      onLightRefresh(() => {
        rebuildTags();
      });
      onProgress(updateProgress);
      onLoadingChange(setLoadingState);
      refreshCallbacksRegistered = true;
    }
    await registerOpenDialogCommand();
    await registerQuoteCommand();
    createMaskAndPopup();
    createAddDialog();
    createDatePicker();
    registerEscapeListener();
    state.ui.isPopupShown = true;
    state.ui.maskLayer.style.visibility = "visible";
    state.ui.tagFilterPopup.style.visibility = "visible";
    initScroll();
    await loadAll();
    if (!state.events.fileListenerAttached) {
      state.events.fileModifyHandler = onFileChange;
      if (plugin) {
        plugin.registerEvent(getApp().vault.on("modify", state.events.fileModifyHandler));
      } else {
        getApp().vault.on("modify", state.events.fileModifyHandler);
      }
      state.events.fileListenerAttached = true;
    }
  } catch (err) {
    console.error("[\u65E5\u8BB0\u672C] \u521D\u59CB\u5316\u5931\u8D25:", err);
    try {
      new import_obsidian7.Notice("[\u65E5\u8BB0\u672C] \u521D\u59CB\u5316\u5931\u8D25: " + (err?.message || err));
    } catch (e) {
    }
  }
}
async function showDiaryPanel(plugin) {
  await init(plugin);
}
function registerEscapeListener() {
  diaryEscHandle = escManager.register("diary", {
    isVisible: () => {
      const byId = (id) => document.getElementById(id);
      const dt = byId("unified-datetime-picker-mask");
      if (dt && dt.isConnected) return true;
      const conf = byId("delete-confirm-mask");
      if (conf && conf.style.display === "block") return true;
      const tag = byId("diary-tag-selector-mask");
      if (tag && tag.style.display === "block") return true;
      const add = byId("add-diary-mask");
      if (add && add.style.display === "block") return true;
      const date = byId("diary-date-filter-mask");
      if (date && date.style.display === "block") return true;
      const main = byId("diary-filter-mask");
      return main ? main.style.visibility === "visible" : false;
    },
    close: () => {
      const byId = (id) => document.getElementById(id);
      const conf = byId("delete-confirm-mask");
      if (conf && conf.style.display === "block") {
        conf.style.display = "none";
        return;
      }
      const tag = byId("diary-tag-selector-mask");
      if (tag && tag.style.display === "block") {
        tag.style.display = "none";
        return;
      }
      const add = byId("add-diary-mask");
      if (add && add.style.display === "block") {
        add.style.display = "none";
        const ap = byId("add-diary-popup");
        if (ap) ap.style.display = "none";
        return;
      }
      const date = byId("diary-date-filter-mask");
      if (date && date.style.display === "block") {
        date.style.display = "none";
        return;
      }
      const main = byId("diary-filter-mask");
      if (main && main.style.visibility === "visible") {
        main.style.visibility = "hidden";
        const popup = byId("diary-tag-filter");
        if (popup) popup.style.visibility = "hidden";
      }
    }
  });
}
function unregisterEscLayer() {
  if (diaryEscHandle) {
    diaryEscHandle.unregister();
    diaryEscHandle = null;
  }
}

// src/settings.ts
var DEFAULT_SETTINGS = {
  diaryDirectory: "\u6211\u7684/\u65E5\u8BB0",
  movieDirectory: "\u6211\u7684/\u5F71\u89C6",
  letterDirectory: "\u6211\u7684/\u4FE1",
  batchSize: "20",
  longPressDuration: "800",
  fileChangeDelay: "100",
  enableLongPress: true,
  showTagCount: true,
  defaultTag: "\u65E5\u8BB0",
  useFileDateTime: false,
  primaryTagsConfig: `\u65E5\u8BB0 \u{1F4D6}
\u5FF5\u5FF5\u788E \u{1F636}
\u5BF9\u8C08 \u{1F91D}
\u968F\u7B14 \u270D\uFE0F
\u68A6 \u{1F319}
\u8BD7 \u{1F31F}
\u4E66 \u{1F4D5}
\u4FE1 \u2709\uFE0F
\u6458\u6284 \u{1F4CC}
\u6444\u5F71 \u{1F4F8}
\u9A91\u884C \u{1F6B4}
\u4EE3\u7801 \u2699\uFE0F
\u505A\u996D \u{1F958}
\u6E38\u620F \u{1F3AE}
\u97F3\u4E50 \u{1F3A7}
\u7535\u5F71 \u{1F4FD}
\u7535\u89C6\u5267 \u{1F4FA}
\u52A8\u6F2B \u{1F3A8}
\u7EAA\u5F55\u7247 \u{1F39E}
\u732B \u{1F431}
\u72D7 \u{1F436}
\u4ED3\u9F20 \u{1F439}
\u718A\u732B \u{1F43C}
\u535A\u7269\u9986 \u{1F3DB}\uFE0F
\u7F8E\u98DF \u{1F354}
\u65C5\u6E38 \u2708\uFE0F > \u56DB\u5DDD \u{1F004}, \u5927\u7406 \u{1F6F6}
\u6536\u85CF \u2B50 > \u54AA\u54AA \u{1F408}, \u5E7F\u544A \u{1F4E2}, \u795E\u8BC4 \u{1F923}, \u51B7\u7B11\u8BDD \u{1F605}, \u62BD\u8C61 \u{1F300}, AI \u{1F916}, \u611A\u4EBA\u8282 \u{1F92A}, \u821E\u8E48 \u{1F57A}, \u8FBE\u4EBA\u79C0 \u{1F939}, \u827A\u672F \u{1F9D1}\u200D\u{1F3A8}, \u6444\u5F71\u96C6 \u{1F4F7}, \u690D\u7269 \u{1F333}, \u521B\u610F \u{1F9E9}`
};

// src/main.ts
function applySettingsToRuntime(settings) {
  applyDirectories(settings);
  applyTagsConfig(settings.primaryTagsConfig);
  applyUiSettings(settings);
}
var DiaryNotebookPlugin = class extends import_obsidian8.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
  }
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    setApp(this.app);
    applySettingsToRuntime(this.settings);
    this.addRibbonIcon("notebook-pen", "\u65E5\u8BB0\u672C", () => {
      showDiaryPanel(this);
    });
    this.addCommand({
      id: "open-panel",
      name: "\u6253\u5F00\u65E5\u8BB0\u672C\u9762\u677F",
      callback: () => {
        showDiaryPanel(this);
      }
    });
    this.addSettingTab(new DiaryNotebookSettingTab(this.app, this));
    await init(this);
  }
  async onunload() {
    const ids = [
      "diary-tag-filter",
      "diary-filter-mask",
      "diary-search-container",
      "diary-subtags-container",
      "add-diary-mask",
      "add-diary-popup",
      "diary-tag-selector-mask",
      "diary-tag-selector-popup",
      "unified-datetime-picker-mask",
      "diary-date-filter-mask",
      "diary-date-filter-popup",
      "__shared_confirm_mask__",
      "diary-styles"
    ];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
    unregisterEscLayer();
    escManager.destroy();
    try {
      this.app.commands.removeCommand("diary-open-add-dialog");
      this.app.commands.removeCommand("diary-create-quote");
    } catch (e) {
      console.warn("\u79FB\u9664\u547D\u4EE4\u5931\u8D25", e);
    }
    state.events.fileListenerAttached = false;
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var DiaryNotebookSettingTab = class extends import_obsidian8.PluginSettingTab {
  constructor(app2, plugin) {
    super(app2, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h3", { text: "\u{1F4C2} \u76EE\u5F55\u914D\u7F6E" });
    new import_obsidian8.Setting(containerEl).setName("\u65E5\u8BB0\u76EE\u5F55").setDesc("\u5B58\u653E\u65E5\u8BB0 markdown \u6587\u4EF6\u7684\u6587\u4EF6\u5939\u8DEF\u5F84").addText(
      (text) => text.setValue(this.plugin.settings.diaryDirectory).onChange(async (value) => {
        this.plugin.settings.diaryDirectory = value;
        await this.plugin.saveSettings();
        this.reloadRuntime();
      })
    );
    new import_obsidian8.Setting(containerEl).setName("\u5F71\u89C6\u76EE\u5F55").setDesc("\u5B58\u653E\u5F71\u89C6\u7B14\u8BB0\u7684\u6587\u4EF6\u5939\u8DEF\u5F84").addText(
      (text) => text.setValue(this.plugin.settings.movieDirectory).onChange(async (value) => {
        this.plugin.settings.movieDirectory = value;
        await this.plugin.saveSettings();
        this.reloadRuntime();
      })
    );
    new import_obsidian8.Setting(containerEl).setName("\u4FE1\u76EE\u5F55").setDesc("\u5B58\u653E\u4FE1\u4EF6\u7684\u6587\u4EF6\u5939\u8DEF\u5F84").addText(
      (text) => text.setValue(this.plugin.settings.letterDirectory).onChange(async (value) => {
        this.plugin.settings.letterDirectory = value;
        await this.plugin.saveSettings();
        this.reloadRuntime();
      })
    );
    containerEl.createEl("h3", { text: "\u{1F4C4} \u6027\u80FD\u4E0E\u4EA4\u4E92\u914D\u7F6E" });
    new import_obsidian8.Setting(containerEl).setName("\u6BCF\u6279\u52A0\u8F7D\u6570\u91CF").setDesc("\u6EDA\u52A8\u52A0\u8F7D\u65F6\u6BCF\u6279\u663E\u793A\u7684\u6761\u76EE\u6570").addText(
      (text) => text.setValue(this.plugin.settings.batchSize).onChange(async (value) => {
        this.plugin.settings.batchSize = value;
        await this.plugin.saveSettings();
        this.reloadRuntime();
      })
    );
    new import_obsidian8.Setting(containerEl).setName("\u957F\u6309\u8BC6\u522B\u65F6\u957F(\u6BEB\u79D2)").setDesc("\u89E6\u53D1\u957F\u6309\u624B\u52BF\u7684\u6BEB\u79D2\u6570").addText(
      (text) => text.setValue(this.plugin.settings.longPressDuration).onChange(async (value) => {
        this.plugin.settings.longPressDuration = value;
        await this.plugin.saveSettings();
        this.reloadRuntime();
      })
    );
    new import_obsidian8.Setting(containerEl).setName("\u6587\u4EF6\u53D8\u66F4\u5EF6\u8FDF(ms)").setDesc("\u6587\u4EF6\u4FEE\u6539\u540E\u5EF6\u8FDF\u5237\u65B0\u754C\u9762\u7684\u6BEB\u79D2\u6570\uFF0C\u53EF\u5E73\u8861\u6027\u80FD").addText(
      (text) => text.setValue(this.plugin.settings.fileChangeDelay).onChange(async (value) => {
        this.plugin.settings.fileChangeDelay = value;
        await this.plugin.saveSettings();
        setFileChangeDelay(parseInt(value) || 100);
      })
    );
    new import_obsidian8.Setting(containerEl).setName("\u542F\u7528\u957F\u6309\u624B\u52BF").setDesc("\u5F00\u542F\u540E\u957F\u6309\u5361\u7247\u53EF\u590D\u5236\u94FE\u63A5\u6216\u4FEE\u6539\u6807\u7B7E").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.enableLongPress).onChange(async (value) => {
        this.plugin.settings.enableLongPress = value;
        await this.plugin.saveSettings();
        applyUiSettings({ enableLongPress: value });
      })
    );
    new import_obsidian8.Setting(containerEl).setName("\u663E\u793A\u6807\u7B7E\u8BA1\u6570").setDesc("\u5728\u6807\u7B7E\u6309\u94AE\u4E0A\u663E\u793A\u8BE5\u6807\u7B7E\u5305\u542B\u7684\u6761\u76EE\u6570\u91CF").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showTagCount).onChange(async (value) => {
        this.plugin.settings.showTagCount = value;
        await this.plugin.saveSettings();
        applyUiSettings({ showTagCount: value });
        loadAll();
      })
    );
    containerEl.createEl("h3", { text: "\u{1F4CC} \u9ED8\u8BA4\u503C\u914D\u7F6E" });
    new import_obsidian8.Setting(containerEl).setName("\u9ED8\u8BA4\u6807\u7B7E").setDesc("\u6253\u5F00\u5199\u65E5\u8BB0\u5F39\u7A97\u65F6\u9ED8\u8BA4\u9009\u4E2D\u7684\u6807\u7B7E\u540D\uFF08\u9700\u4E3A\u6709\u6548\u6807\u7B7E\uFF09").addText(
      (text) => text.setValue(this.plugin.settings.defaultTag).onChange(async (value) => {
        this.plugin.settings.defaultTag = value;
        await this.plugin.saveSettings();
        applyUiSettings({ defaultTag: value });
      })
    );
    new import_obsidian8.Setting(containerEl).setName("\u4F7F\u7528\u6587\u4EF6\u65E5\u671F\u4F5C\u4E3A\u9ED8\u8BA4\u65E5\u671F").setDesc("\u5F00\u542F\u540E\uFF0C\u6DFB\u52A0\u65E5\u8BB0\u65F6\u9ED8\u8BA4\u65E5\u671F\u53D6\u81EA\u5F53\u524D\u6253\u5F00\u7684\u65E5\u8BB0\u6587\u4EF6\u7684\u65E5\u671F\uFF08\u82E5\u4E3A\u65E5\u8BB0\u6587\u4EF6\uFF09\uFF1B\u5173\u95ED\u5219\u4F7F\u7528\u5F53\u524D\u65F6\u95F4").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.useFileDateTime).onChange(async (value) => {
        this.plugin.settings.useFileDateTime = value;
        await this.plugin.saveSettings();
        applyUiSettings({ useFileDateTime: value });
      })
    );
    containerEl.createEl("h3", { text: "\u{1F3F7}\uFE0F \u6807\u7B7E\u914D\u7F6E" });
    new import_obsidian8.Setting(containerEl).setName("\u6807\u7B7E\u914D\u7F6E\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF09").setDesc(
      "\u6BCF\u884C\u4E00\u4E2A\u6807\u7B7E\uFF0C\u683C\u5F0F\uFF1A\u6807\u7B7E\u540D emoji\uFF08\u7528\u7A7A\u683C\u5206\u9694\uFF09\uFF1B\u82E5\u9700\u8981\u4E8C\u7EA7\u6807\u7B7E\uFF0C\u5728\u4E3B\u6807\u7B7E\u540E\u52A0 > \u548C\u5B50\u6807\u7B7E\u5217\u8868\uFF0C\u5B50\u6807\u7B7E\u4E4B\u95F4\u7528\u9017\u53F7\u5206\u9694\uFF0C\u4F8B\u5982\uFF1A\u65C5\u6E38 \u2708\uFE0F > \u56DB\u5DDD \u{1F004}, \u5927\u7406 \u{1F6F6}"
    ).addTextArea(
      (text) => text.setValue(this.plugin.settings.primaryTagsConfig).onChange(async (value) => {
        this.plugin.settings.primaryTagsConfig = value;
        await this.plugin.saveSettings();
        this.reloadRuntime();
      })
    );
    containerEl.createEl("h4", { text: "\u9ED8\u8BA4\u6807\u7B7E\u914D\u7F6E\uFF08\u53EF\u590D\u5236\u4FEE\u6539\uFF09" });
    containerEl.createEl("pre", { text: DEFAULT_SETTINGS.primaryTagsConfig });
  }
  /** 应用设置变更到运行时常量/配置并全量刷新 */
  reloadRuntime() {
    applySettingsToRuntime(this.plugin.settings);
    setFileChangeDelay(parseInt(this.plugin.settings.fileChangeDelay) || 100);
    if (document.getElementById("diary-tag-filter")) {
      loadAll();
    } else {
      init(this.plugin);
    }
  }
};
