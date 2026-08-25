// ================================================================
// B站下载器 - 配置存取（rc 惯例，与 ~/.douban-posterrc 等一致）
//   ~/.bilibili-dl.json        网页设置图标背后的存储（交付目录等）
//   ~/.bilibili-cookies.json   Cookie 凭据（服务器端持有，不进浏览器）
//   ~/.bilibili-history.json   下载历史（最新在前，上限 50）
// ================================================================
const os = require('os')
const path = require('path')
const fs = require('fs')
const core = require('./core')

// 路径可用环境变量覆盖（测试隔离/多配置）：BILI_DL_CONFIG / BILI_DL_COOKIES / BILI_DL_HISTORY
const CONFIG_PATH = process.env.BILI_DL_CONFIG || path.join(os.homedir(), '.bilibili-dl.json')
const COOKIES_PATH = process.env.BILI_DL_COOKIES || path.join(os.homedir(), '.bilibili-cookies.json')
const HISTORY_PATH = process.env.BILI_DL_HISTORY || path.join(os.homedir(), '.bilibili-history.json')
const HISTORY_LIMIT = 50

const DEFAULTS = {
  outputDir: 'E:/Obsidian/叫我包仔/CONFIG/APPENDIX',   // 交付目录：视频最终放的位置（设置图标可改）
  vaultPath: 'E:/Obsidian/叫我包仔',                   // Obsidian vault 根：交付目录在其下时生成 wikilink
  ffmpegPath: 'ffmpeg',
  ffprobePath: 'ffprobe',                              // 产物校验（时长/可播放性）用
  pythonPath: 'C:/Users/PC/AppData/Local/Programs/Python/Python312/python.exe',
  whisperModel: 'small',
  // 视频缓存 + 文献笔记（新增三键，可选；既有六键与结构原样保留）
  cacheDir: '',                                        // 视频缓存目录（留空 = 系统临时目录/bili-dl-cache）
  cacheRetentionDays: 7,                               // 下载原件缓存保留天数
  literatureFolder: '文献盒',                           // 文献笔记存放目录（相对 vault 根）
}

function loadConfig() {
  return { ...DEFAULTS, ...core.readJson(CONFIG_PATH, {}) }
}

function saveConfig(patch) {
  const cur = core.readJson(CONFIG_PATH, {})
  core.writeJson(CONFIG_PATH, { ...cur, ...patch })
}

function loadCookie() {
  return core.loadCookies(COOKIES_PATH)
}

function saveCookie(str) {
  core.saveCookies(COOKIES_PATH, str)
}

function loadHistory() {
  return core.readJson(HISTORY_PATH, [])
}

// 写入历史：最新在前，上限 HISTORY_LIMIT
function pushHistory(item) {
  const h = loadHistory()
  h.unshift(item)
  core.writeJson(HISTORY_PATH, h.slice(0, HISTORY_LIMIT))
}

function clearHistory() {
  core.writeJson(HISTORY_PATH, [])
}

module.exports = {
  CONFIG_PATH, COOKIES_PATH, HISTORY_PATH, HISTORY_LIMIT, DEFAULTS,
  loadConfig, saveConfig, loadCookie, saveCookie, loadHistory, pushHistory, clearHistory,
}
