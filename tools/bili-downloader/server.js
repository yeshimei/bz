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

// ---- 任务状态（单任务语义；一个任务可有多个「段落」）----
const T = {
  phase: 'idle',           // idle | parsing | downloading | trimming | compressing | transcribing | done
  url: '', info: null, quality: null,
  originalPath: null,      // 下载原件（剪辑的源；始终保留，「返回原视频」可重建段落）
  curPath: null, curDur: 0, // /media/current 预览（默认即原件，保证时间轴坐标 = 原件时长）
  crf: 23,
  segments: [],            // [{id, start, end}] 段落列表，顺序即交付顺序
  mode: 'split',           // split（分开交付，每段一个） | merge（合并成一个视频）
  prepared: [],            // [{id, start, end, mode, tempPath}] 已校验段落临时产物缓存（交付复用）
  transcript: '',
}
function resetTask() {
  core.resetAbort()
  for (const p of T.prepared) { try { fs.unlinkSync(p.tempPath) } catch {} }   // 清残留预编码临时产物
  T.url = ''; T.info = null; T.quality = null; T.originalPath = null; T.curPath = null; T.curDur = 0
  T.crf = 23; T.segments = []; T.mode = 'split'; T.prepared = []
  T.transcript = ''
  T.phase = 'idle'
}

// 段落钳制：必须落在原件时长内且 start < end，否则按整片处理
function clampSeg(seg, duration) {
  let start = Math.max(0, Number(seg.start) || 0)
  let end = Math.min(duration, Number(seg.end) || duration)
  if (end - start < 0.1) { start = 0; end = duration }
  return { id: String(seg.id != null ? seg.id : Math.random()), start, end }
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
// 剪贴板内容：wikilink 可多条（分开交付=每段一行，合并=单条）；已转文字 = 末尾空行 + 转录全文一次
function buildClipboard(wikis) {
  const conf = cfg.loadConfig()
  const list = (Array.isArray(wikis) ? wikis : [wikis]).map(n => makeWiki(n, conf))
  const wiki = list.join('\n')
  if (!T.transcript) return { wiki, text: wiki }
  return { wiki, text: `${wiki}\n\n${T.transcript}` }
}

// 段落截取并校验（缓存复用）；返回临时产物路径。crf 为 null 时用 copy 优先 + 自动重编码兜底。
async function prepareSegment(seg, duration) {
  const hit = T.prepared.find(p => p.id === seg.id && p.start === seg.start && p.end === seg.end && fs.existsSync(p.tempPath))
  if (hit) return hit.tempPath
  const conf = cfg.loadConfig()
  const tmp = path.join(TMP_DIR, `bili_${Date.now()}_${seg.id}.mp4`)
  const r = await core.trimVideo({
    inPath: T.originalPath, outPath: tmp, ffmpeg: conf.ffmpegPath, ffprobe: conf.ffprobePath,
    start: seg.start, end: seg.end, crf: null, totalMs: (seg.end - seg.start) * 1000,
    onProgress: ({ percent }) => broadcast({ type: 'trim-progress', percent }),
  })
  T.prepared = T.prepared.filter(p => p.id !== seg.id)
  T.prepared.push({ id: seg.id, start: seg.start, end: seg.end, mode: r.mode, tempPath: tmp })
  return tmp
}

// 交付：按交付模式批量产出全部交付物（分开=每段一个文件+一条 wikilink；合并=段序拼接一个文件）
async function doDone(body) {
  if (!T.originalPath) throw new Error('请先下载视频')
  const segs = (body.segments || []).filter(Boolean).map(s => clampSeg(s, T.info.duration))
  if (!segs.length) throw new Error('请先添加至少一个段落')
  T.segments = segs
  T.mode = body.mode === 'merge' ? 'merge' : 'split'
  const crf = body.crf === null || body.crf === undefined ? null : Number(body.crf)
  T.crf = isFinite(crf) ? crf : 23
  const conf = cfg.loadConfig()
  const outDirAbs = path.resolve(conf.outputDir)
  fs.mkdirSync(outDirAbs, { recursive: true })
  const title = T.info.title, bv = core.extractBv(T.url), duration = T.info.duration
  const files = [], failures = []
  const history = (finalName, wiki) => cfg.pushHistory({ time: new Date().toLocaleString('zh-CN', { hour12: false }), title, bv, quality: `${T.quality}P`, file: finalName, wiki })

  if (T.mode === 'merge') {
    try {
      const parts = []
      for (const seg of segs) parts.push(await prepareSegment(seg, duration))
      const merged = path.join(TMP_DIR, `bili_${Date.now()}_merge.mp4`)
      const expected = segs.reduce((a, s) => a + (s.end - s.start), 0)
      await core.mergeSegments({ files: parts, outPath: merged, ffmpeg: conf.ffmpegPath, ffprobe: conf.ffprobePath, expectedSec: expected, onProgress: ({ percent }) => broadcast({ type: 'trim-progress', percent }) })
      let finalTemp = merged, compressed = false, usedCrf = null
      if (crf !== null) {
        const before = fs.statSync(merged).size
        const enc = path.join(TMP_DIR, `bili_${Date.now()}_crf${crf}.mp4`)
        await core.trimVideo({ inPath: merged, outPath: enc, ffmpeg: conf.ffmpegPath, ffprobe: conf.ffprobePath, start: 0, end: expected, crf, totalMs: expected * 1000, onProgress: ({ percent }) => broadcast({ type: 'trim-progress', percent }) })
        const after = fs.statSync(enc).size
        if (after < before) { finalTemp = enc; compressed = true; usedCrf = crf }
        else { try { fs.unlinkSync(enc) } catch {} }   // 压缩回退：保留合并件
      }
      const name = `${core.sanitizeName(title)}_${bv}_merge_${segs.length}段${compressed ? `_crf${usedCrf}` : ''}.mp4`
      const finalPath = core.uniquePath(path.join(outDirAbs, name))
      fs.copyFileSync(finalTemp, finalPath)
      try { fs.unlinkSync(finalTemp) } catch {}
      const finalName = path.basename(finalPath)
      history(finalName, makeWiki(finalName, conf))
      files.push({ finalName, finalPath, wiki: makeWiki(finalName, conf) })
    } catch (e) {
      failures.push(`合并：${e.message}`)
    }
  } else {
    for (const seg of segs) {
      try {
        const tmp = await prepareSegment(seg, duration)
        let finalTemp = tmp, compressed = false, usedCrf = null
        if (crf !== null) {
          const before = fs.statSync(tmp).size
          const enc = path.join(TMP_DIR, `bili_${Date.now()}_${seg.id}_crf${crf}.mp4`)
          await core.trimVideo({ inPath: tmp, outPath: enc, ffmpeg: conf.ffmpegPath, ffprobe: conf.ffprobePath, start: 0, end: seg.end - seg.start, crf, totalMs: (seg.end - seg.start) * 1000, onProgress: ({ percent }) => broadcast({ type: 'trim-progress', percent }) })
          const after = fs.statSync(enc).size
          if (after < before) { finalTemp = enc; compressed = true; usedCrf = crf }
          else { try { fs.unlinkSync(enc) } catch {} }
        }
        const full = !(seg.start > 0 || seg.end < duration)          // 全片 = 不裁切
        const finalName = core.buildFileName({ title, bv, trimmed: !full, start: seg.start, end: seg.end, duration, compressed, crf: usedCrf })
        const finalPath = core.uniquePath(path.join(outDirAbs, finalName))
        fs.copyFileSync(finalTemp, finalPath)
        try { if (finalTemp !== tmp) fs.unlinkSync(finalTemp) } catch {}
        history(finalName, makeWiki(finalName, conf))
        files.push({ finalName, finalPath, wiki: makeWiki(finalName, conf) })
      } catch (e) {
        failures.push(`段落 ${seg.id}：${e.message}`)
      }
    }
  }
  if (!files.length) throw new Error(failures.join('\n') || '交付失败')
  T.phase = 'done'
  const clip = buildClipboard(files.map(f => f.wiki))
  return { ok: true, mode: T.mode, files, failures, clipboard: clip.text, wiki: clip.wiki }
}

// ---- 取消：中止 + 删除全部产物 + 重置任务 ----
async function doCancel() {
  core.abortAll()
  for (const p of T.prepared) { try { fs.unlinkSync(p.tempPath) } catch {} }
  try { if (T.curPath && T.curPath !== T.originalPath) fs.unlinkSync(T.curPath) } catch {}
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
      T.curPath = outPath      // 预览即下载原件（时间轴坐标 = 原件时长）
      T.originalPath = outPath // 下载原件：剪辑的源，始终保留
      T.curDur = T.info.duration
      T.segments = []; T.prepared = []; T.mode = 'split'
      T.phase = 'ready'
      return { ok: true, path: outPath }
    } finally { setBusy(false) }
  },
  async 'POST /api/trim'(body) {
    if (!T.originalPath) throw new Error('请先下载视频')
    if (busy) throw new Error('任务进行中')
    const seg = clampSeg({ id: body.segmentId, start: body.start, end: body.end }, T.info.duration)
    if (!seg) throw new Error('请先选择段落')
    setBusy(true)
    T.phase = 'trimming'
    try {
      await prepareSegment(seg, T.info.duration)   // 校验 + 缓存（交付复用）
      const p = T.prepared.find(x => x.id === seg.id)
      return { ok: true, segmentId: seg.id, duration: seg.end - seg.start, mode: p ? p.mode : 'copy' }
    } finally { setBusy(false) }
  },
  async 'POST /api/compress'(body) {
    if (!T.originalPath) throw new Error('请先下载视频')
    if (busy) throw new Error('任务进行中')
    const crf = body.crf === null || body.crf === undefined ? null : Number(body.crf)
    if (crf === null || !isFinite(crf)) throw new Error('请选择压缩档位')
    const seg = clampSeg({ id: body.segmentId, start: body.start, end: body.end }, T.info.duration)
    if (!seg) throw new Error('请先选择段落')
    setBusy(true)
    T.phase = 'compressing'
    try {
      const copyTmp = await prepareSegment(seg, T.info.duration)
      const before = fs.statSync(copyTmp).size
      const enc = path.join(TMP_DIR, `bili_${Date.now()}_${seg.id}_crf${crf}.mp4`)
      await core.trimVideo({
        inPath: copyTmp, outPath: enc, ffmpeg: cfg.loadConfig().ffmpegPath, ffprobe: cfg.loadConfig().ffprobePath,
        start: 0, end: seg.end - seg.start, crf, totalMs: (seg.end - seg.start) * 1000,
        onProgress: ({ percent }) => broadcast({ type: 'trim-progress', percent }),
      })
      const after = fs.statSync(enc).size
      // 压缩无收益（>= 编码前 copy 件）：丢弃编码件、保留 copy，提醒（kept:'original'）
      if (after >= before) {
        try { fs.unlinkSync(enc) } catch {}
        T.phase = 'ready'
        return { ok: true, kept: 'original', before, after, pct: (1 - after / before) * 100 }
      }
      // 编码件替换缓存（交付时直接复用该压好的产物）
      T.prepared = T.prepared.filter(p => p.id !== seg.id)
      T.prepared.push({ id: seg.id, start: seg.start, end: seg.end, mode: 'reencode', tempPath: enc })
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
  async 'POST /api/done'(body) {
    if (busy) throw new Error('任务进行中')
    return doDone(body || {})
  },
  async 'POST /api/revert'() {
    // 返回原视频：清空全部段落 + 关闭压缩 + 恢复下载原件（可重新剪辑）
    if (!T.originalPath) throw new Error('暂无下载原件')
    if (busy) throw new Error('任务进行中')
    for (const p of T.prepared) { try { fs.unlinkSync(p.tempPath) } catch {} }
    T.prepared = []
    T.segments = []
    T.crf = 23
    T.curPath = T.originalPath
    T.curDur = T.info.duration
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
