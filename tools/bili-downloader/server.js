// ================================================================
// B站下载器 - 本地 HTTP 服务（零依赖 node:http + SSE）
//   仅绑定 127.0.0.1 + 随机端口，无鉴权（本地工具）
//   静态前端由本服务伺服；/events SSE 推送进度；
//   /media/current 以 Range 流式伺服当前产物（视频预览拖动）
// 任务模型：单任务。下载/裁切/压缩/转文字互斥（busy），
//   cancel 随时可用 = kill 子进程 + 中断下载流 + 删除全部产物。
// ================================================================
const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')
const core = require('./core')
const cfg = require('./config')

const PUBLIC_DIR = path.join(__dirname, 'public')
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' }

// ---- 任务状态（单任务语义）----
const T = {
  phase: 'idle',           // idle | parsing | downloading | trimming | compressing | transcribing | done
  url: '', info: null, quality: null,
  originalPath: null,      // 下载原件（裁切/压缩后仍保留，可「返回原视频」重新裁切）
  curPath: null, curDur: 0,
  trimmed: false, compressed: false, crf: 23, start: 0, end: 0,
  transcript: '', finalPath: null, finalName: '', saved: false,
}
function resetTask() {
  core.resetAbort()
  T.url = ''; T.info = null; T.quality = null; T.originalPath = null; T.curPath = null; T.curDur = 0
  T.trimmed = false; T.compressed = false; T.crf = 23; T.start = 0; T.end = 0
  T.transcript = ''; T.finalPath = null; T.finalName = ''; T.saved = false
  T.phase = 'idle'
}

// ---- SSE 客户端 ----
const clients = new Set()
function broadcast(obj) {
  const s = `data: ${JSON.stringify(obj)}\n\n`
  for (const res of clients) { try { res.write(s) } catch {} }
}

// ---- busy 互斥（单任务）----
let busy = false
function setBusy(b) { busy = b; broadcast({ type: 'busy', busy: b }) }

// ---- Cookie 状态（服务器端持有，不回显明文）----
let cookieValid = null   // null=未验证
async function validateCookie() {
  const cookie = cfg.loadCookie()
  if (!cookie) { cookieValid = false; broadcast({ type: 'cookie-status', valid: false }); return }
  try {
    const j = await core.fetchJsonImpl('https://api.bilibili.com/x/web-interface/nav', { Cookie: cookie })
    cookieValid = !!(j && j.code === 0 && j.data && j.data.isLogin === true)
  } catch { cookieValid = false }
  broadcast({ type: 'cookie-status', valid: cookieValid })
}

// ---- 交付：wikilink 生成（vault 内用相对路径，vault 外退化绝对路径）----
function makeWiki(finalName, conf) {
  const outAbs = path.resolve(conf.outputDir)
  if (conf.vaultPath) {
    const vaultAbs = path.resolve(conf.vaultPath)
    const rel = path.relative(vaultAbs, outAbs)
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
      return `![[${rel.replace(/\\/g, '/')}/${finalName}]]`
    }
  }
  return path.join(outAbs, finalName)
}
// 剪贴板内容：未转文字 = 仅 wikilink；已转文字 = wikilink + 空行 + 转录全文
function buildClipboard(finalName) {
  const conf = cfg.loadConfig()
  const wiki = makeWiki(finalName, conf)
  if (!T.transcript) return { wiki, text: wiki }
  return { wiki, text: `${wiki}\n\n${T.transcript}` }
}

// ---- 交付：移入交付目录 + 历史 ----
async function doDone() {
  if (!T.curPath) throw new Error('请先下载视频')
  const conf = cfg.loadConfig()
  const outDirAbs = path.resolve(conf.outputDir)
  fs.mkdirSync(outDirAbs, { recursive: true })
  const en = T.end > 0 ? T.end : T.info.duration
  T.finalName = core.buildFileName({ title: T.info.title, bv: core.extractBv(T.url), trimmed: T.trimmed, start: T.start, end: en, duration: T.info.duration, compressed: T.compressed, crf: T.crf })
  const finalPath = core.uniquePath(path.join(outDirAbs, T.finalName))
  fs.copyFileSync(T.curPath, finalPath)
  try { fs.unlinkSync(T.curPath) } catch {}
  T.finalPath = finalPath
  T.finalName = path.basename(finalPath)
  T.saved = true
  T.phase = 'done'
  const clip = buildClipboard(T.finalName)
  cfg.pushHistory({ time: new Date().toLocaleString('zh-CN', { hour12: false }), title: T.info.title, bv: core.extractBv(T.url), quality: `${T.quality}P`, file: T.finalName, wiki: clip.wiki })
  return { ok: true, finalName: T.finalName, finalPath: T.finalPath, clipboard: clip.text, wiki: clip.wiki }
}

// ---- 取消：中止 + 删除全部产物 + 重置任务 ----
async function doCancel() {
  core.abortAll()
  try { if (T.curPath) fs.unlinkSync(T.curPath) } catch {}
  try { fs.rmSync(TMP_DIR, { recursive: true, force: true }) } catch {}
  fs.mkdirSync(TMP_DIR, { recursive: true })
  resetTask()
  setBusy(false)
  return { ok: true }
}

// ---- 临时目录（系统临时目录，退出清理）----
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-dl-'))

// ---- 请求体收集 ----
function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = ''
    req.on('data', c => { d += c; if (d.length > 2 * 1024 * 1024) { reject(new Error('请求体过大')); req.destroy() } })
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}) } catch { reject(new Error('JSON 解析失败')) } })
    req.on('error', reject)
  })
}

function sendJson(res, code, obj) {
  const s = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(s)
}

// ---- Range 流式伺服（视频预览）----
function serveMedia(req, res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); return res.end('not found') }
    const total = stat.size
    const range = req.headers.range
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range)
      let start = m && m[1] !== '' ? parseInt(m[1]) : 0
      let end = m && m[2] !== '' ? parseInt(m[2]) : total - 1
      if (isNaN(start)) start = 0
      if (isNaN(end) || end >= total) end = total - 1
      if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${total}` }); return res.end() }
      res.writeHead(206, { 'Content-Type': 'video/mp4', 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${total}`, 'Accept-Ranges': 'bytes' })
      fs.createReadStream(filePath, { start, end }).pipe(res)
    } else {
      res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': total, 'Accept-Ranges': 'bytes' })
      fs.createReadStream(filePath).pipe(res)
    }
  })
}

// ---- API 处理 ----
const handlers = {
  async 'GET /api/config'() {
    const conf = cfg.loadConfig()
    return { ok: true, config: conf, cookieConfigured: !!cfg.loadCookie(), cookieValid }
  },
  async 'POST /api/config'(body) {
    cfg.saveConfig(body)
    return { ok: true }
  },
  async 'POST /api/cookie'(body) {
    if (!body.cookie || !String(body.cookie).trim()) throw new Error('Cookie 为空')
    cfg.saveCookie(String(body.cookie))
    const j = await core.fetchJsonImpl('https://api.bilibili.com/x/web-interface/nav', { Cookie: cfg.loadCookie() })
    cookieValid = !!(j && j.code === 0 && j.data && j.data.isLogin === true)
    broadcast({ type: 'cookie-status', valid: cookieValid })
    if (!cookieValid) throw new Error('Cookie 无效或已过期')
    return { ok: true, valid: true }
  },
  async 'POST /api/parse'(body) {
    if (!body.url || !String(body.url).trim()) throw new Error('请输入 B站链接')
    if (busy) throw new Error('任务进行中，请先完成或取消')
    T.phase = 'parsing'
    const info = await core.parseVideo({ url: String(body.url).trim(), cookie: cfg.loadCookie() })
    resetTask()   // 清掉上次任务残留（含中止标志）
    T.url = String(body.url).trim()
    T.info = info
    T.quality = info.maxHeight
    T.phase = 'ready'
    return { ok: true, info }
  },
  async 'POST /api/download'(body) {
    if (!T.info) throw new Error('请先解析视频')
    if (busy) throw new Error('任务进行中')
    const height = Number(body.height) || T.info.maxHeight
    setBusy(true)
    T.phase = 'downloading'
    try {
      const outPath = path.join(TMP_DIR, `bili_${Date.now()}.mp4`)
      await core.downloadVideo({
        url: T.url, cookie: cfg.loadCookie(), height, outPath, ffmpeg: cfg.loadConfig().ffmpegPath,
        onDiag: text => broadcast({ type: 'diag', text }),
        onProgress: p => broadcast({ type: 'download-progress', ...p }),
      })
      T.curPath = outPath
      T.originalPath = outPath   // 下载原件：裁切/压缩后可「返回原视频」重新裁切
      T.curDur = T.info.duration
      T.trimmed = false; T.compressed = false
      T.phase = 'ready'
      return { ok: true, path: outPath }
    } finally { setBusy(false) }
  },
  async 'POST /api/trim'(body) {
    if (!T.curPath) throw new Error('请先下载视频')
    if (busy) throw new Error('任务进行中')
    const start = Number(body.start) || 0
    const end = Number(body.end) || T.info.duration
    if (!(start > 0 || end < T.info.duration)) throw new Error('未选择裁切范围')
    setBusy(true)
    T.phase = 'trimming'
    try {
      const outPath = path.join(TMP_DIR, `bili_${Date.now()}_clip.mp4`)
      await core.trimVideo({
        inPath: T.curPath, outPath, ffmpeg: cfg.loadConfig().ffmpegPath,
        start, end, crf: null, totalMs: (end - start) * 1000,
        onProgress: ({ percent }) => broadcast({ type: 'trim-progress', percent }),
      })
      T.curPath = outPath
      T.curDur = end - start
      T.trimmed = true
      T.start = start; T.end = end
      T.phase = 'ready'
      return { ok: true, path: outPath }
    } finally { setBusy(false) }
  },
  async 'POST /api/compress'(body) {
    if (!T.curPath) throw new Error('请先下载视频')
    if (busy) throw new Error('任务进行中')
    const crf = body.crf === null || body.crf === undefined ? null : Number(body.crf)
    if (crf === null) throw new Error('已选择不压缩')
    setBusy(true)
    T.phase = 'compressing'
    try {
      const before = fs.statSync(T.curPath).size
      const outPath = path.join(TMP_DIR, `bili_${Date.now()}_crf${crf}.mp4`)
      await core.trimVideo({
        inPath: T.curPath, outPath, ffmpeg: cfg.loadConfig().ffmpegPath,
        start: 0, end: T.curDur, crf, totalMs: T.curDur * 1000,
        onProgress: ({ percent }) => broadcast({ type: 'trim-progress', percent }),
      })
      const after = fs.statSync(outPath).size
      // 压缩无收益（产物 >= 原件）：丢弃压缩件、保留原件并提醒（kept:'original'）
      if (after >= before) {
        try { fs.unlinkSync(outPath) } catch {}
        T.phase = 'ready'
        return { ok: true, kept: 'original', before, after, pct: (1 - after / before) * 100 }
      }
      T.curPath = outPath
      T.compressed = true
      T.crf = crf
      T.phase = 'ready'
      return { ok: true, before, after, pct: (1 - after / before) * 100 }
    } finally { setBusy(false) }
  },
  async 'POST /api/transcribe'() {
    if (!T.curPath) throw new Error('请先下载视频')
    if (busy) throw new Error('任务进行中')
    if (T.transcript) return { ok: true, transcript: T.transcript }
    const conf = cfg.loadConfig()
    setBusy(true)
    T.phase = 'transcribing'
    try {
      let text = ''
      await core.runPython({
        py: conf.pythonPath, args: [conf.whisperModel, T.curPath],
        onChunk: s => { text += s; broadcast({ type: 'transcript-chunk', text: s }) },
      })
      T.transcript = text.replace(/\s+/g, ' ').trim()
      T.phase = 'ready'
      return { ok: true, transcript: T.transcript }
    } finally { setBusy(false) }
  },
  async 'POST /api/done'() {
    if (busy) throw new Error('任务进行中')
    return doDone()
  },
  async 'POST /api/revert'() {
    // 返回原视频：恢复下载原件，重置裁切/压缩状态（可重新裁切）
    if (!T.originalPath || !T.curPath) throw new Error('暂无下载原件')
    if (busy) throw new Error('任务进行中')
    T.curPath = T.originalPath
    T.curDur = T.info.duration
    T.trimmed = false
    T.compressed = false
    T.start = 0
    T.end = T.info.duration
    T.phase = 'ready'
    return { ok: true, duration: T.info.duration }
  },
  async 'POST /api/cancel'() {
    return doCancel()
  },
  async 'POST /api/newtask'() {
    if (busy) throw new Error('任务进行中，请先完成或取消')
    resetTask()
    return { ok: true }
  },
  async 'GET /api/history'() {
    return { ok: true, history: cfg.loadHistory() }
  },
  async 'DELETE /api/history'() {
    cfg.clearHistory()
    return { ok: true }
  },
}

// ---- 静态文件 ----
function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '')
  const file = path.join(PUBLIC_DIR, rel)
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('forbidden') }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); return res.end('not found') }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
}

// ---- 路由 ----
function route(req, res) {
  const u = new URL(req.url, 'http://127.0.0.1')
  const key = `${req.method} ${u.pathname}`

  if (key === 'GET /events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
    res.write('retry: 3000\n\n')
    clients.add(res)
    broadcast({ type: 'cookie-status', valid: cookieValid })   // 新连接即推当前状态
    const hb = setInterval(() => { try { res.write(': ping\n\n') } catch {} }, 25000)
    req.on('close', () => { clearInterval(hb); clients.delete(res) })
    return
  }

  if (key === 'GET /media/current') {
    if (!T.curPath) { res.writeHead(404); return res.end('no media') }
    return serveMedia(req, res, T.curPath)
  }

  const fn = handlers[key]
  if (fn) {
    const wrap = async () => {
      try {
        const body = (req.method === 'POST' || req.method === 'DELETE') && req.headers['content-type'] && req.headers['content-type'].includes('application/json')
          ? await readBody(req) : {}
        const r = await fn(body)
        sendJson(res, 200, r)
      } catch (e) {
        sendJson(res, 200, { ok: false, error: e.message || String(e) })
      }
    }
    wrap()
    return
  }

  if (req.method === 'GET') return serveStatic(res, u.pathname)
  res.writeHead(404); res.end('not found')
}

function createServer() {
  return http.createServer(route)
}

// 启动后：异步验证 Cookie 状态广播给页面
function startValidate() { validateCookie() }

module.exports = { createServer, T, TMP_DIR, resetTask, startValidate, broadcast }
