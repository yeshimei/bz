// ================================================================
// B站下载器 - 配置存取（rc 惯例，与 ~/.douban-posterrc 等一致）
//   ~/.bilibili-dl.json        批处理配置（交付目录、ffmpeg/whisper 路径、缓存等；ticket 136 起网页版已移除）
//   ~/.bilibili-cookies.json   Cookie 凭据（B站 API 风控用）
// ================================================================
const os = require('os')
const path = require('path')
const fs = require('fs')
const core = require('./core')

// 路径可用环境变量覆盖（测试隔离/多配置）：BILI_DL_CONFIG / BILI_DL_COOKIES
const CONFIG_PATH = process.env.BILI_DL_CONFIG || path.join(os.homedir(), '.bilibili-dl.json')
const COOKIES_PATH = process.env.BILI_DL_COOKIES || path.join(os.homedir(), '.bilibili-cookies.json')

const DEFAULTS = {
  outputDir: 'E:/Obsidian/叫我包仔/CONFIG/APPENDIX',   // 交付目录：视频最终放的位置
  vaultPath: 'E:/Obsidian/叫我包仔',                   // Obsidian vault 根：交付目录在其下时生成相对路径
  ffmpegPath: 'ffmpeg',
  ffprobePath: 'ffprobe',                              // 产物校验（时长/可播放性）用
  // pythonPath 通用默认 = 'python'（spawn 走系统 PATH）。两种转写引擎共用（装了 Python 后按引擎
  // pip install funasr torch torchaudio 或 faster-whisper 即可）；Windows 可用 `where python`
  // 查绝对路径后填入（如 C:/Users/<你>/AppData/Local/Programs/Python/Python311/python.exe）
  pythonPath: 'python',
  engine: '',                                          // 转写引擎（issue 444）：'' = 缺省 sensevoice；插件 --batch 恒下发覆盖，本键只服务手动 CLI
  whisperModel: 'small',                               // faster-whisper 档位（仅 engine=faster-whisper 消费；SenseVoice 模型固定无档位）
  cacheDir: '',                                        // 视频/断点续跑缓存目录（留空 = 系统临时目录/bili-dl-cache）
  cacheRetentionDays: 7,                               // 缓存保留天数
}

function loadConfig() {
  return { ...DEFAULTS, ...core.readJson(CONFIG_PATH, {}) }
}

function loadCookie() {
  return core.loadCookies(COOKIES_PATH)
}

module.exports = {
  CONFIG_PATH, COOKIES_PATH, DEFAULTS,
  loadConfig, loadCookie,
}
