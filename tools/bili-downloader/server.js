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
const { spawn } = require('child_process')
const core = require('./core')
const cfg = require('./config')

const PUBLIC_DIR = path.join(__dirname, 'public')
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' }

// ---- 任务状态（单任务语义；一个任务可有多个「段落」）----
const T = {
  phase: 'idle',           // idle | parsing | downloading | trimming | compressing | transcribing | generating | ready | done
  url: '', info: null, quality: null,
  cid: null, part: 1, pageCount: 1, partTitle: '',   // 分P：当前选中 P 的 cid/序号/总数/标题
  originalPath: null,      // 下载原件（剪辑的源；始终保留，「返回原视频」可重建段落）
  curPath: null, curDur: 0, // /media/current 预览（默认即原件，保证时间轴坐标 = 原件时长）
  crf: 23,
  segments: [],            // [{id, start, end}] 段落列表，顺序即交付顺序
  mode: 'split',           // split（分开交付，每段一个） | merge（合并成一个视频）
  prepared: [],            // [{id, start, end, mode, tempPath}] 已校验段落临时产物缓存（交付复用）
  transcript: '',
  transcriptSig: '',       // 转录覆盖范围签名（段落 id+起止 / 'full'）：不符则重转，防陈旧稿跨段落复用（1.2.7 审查修复）
  segmentTranscripts: {},  // 分段转录 {segId: text}（多段落交付时笔记按片段挂正文）
  polishedNote: null,      // AI 润色产物 {meta, body}（/api/note-prepare 缓存，生成笔记直接复用）
  lastFiles: [],           // 本次交付的文件 [{finalName, wiki, segId}]（文献笔记 embed 与历史 note 字段用）
}
function resetTask() {
  core.resetAbort()
  for (const p of T.prepared) { try { fs.unlinkSync(p.tempPath) } catch {} }   // 清残留预编码临时产物
  T.url = ''; T.info = null; T.quality = null
  T.cid = null; T.part = 1; T.pageCount = 1; T.partTitle = ''
  T.originalPath = null; T.curPath = null; T.curDur = 0
  T.crf = 23; T.segments = []; T.mode = 'split'; T.prepared = []
  T.transcript = ''
  T.transcriptSig = ''
  T.segmentTranscripts = {}
  T.polishedNote = null
  T.lastFiles = []
  T.phase = 'idle'
}

// 段落钳制：必须落在原件时长内且 start < end，否则按整片处理
function clampSeg(seg, duration) {
  let start = Math.max(0, Number(seg.start) || 0)
  let end = Math.min(duration, Number(seg.end) || duration)
  if (end - start < 0.1) { start = 0; end = duration }
  return { id: String(seg.id != null ? seg.id : Math.random()), start, end }
}

// 转录覆盖范围签名：整片（含整片单段）= 'full'，分段 = id+起止(0.1s 粒度)串。
// 前端 flowSig 与此同构；两侧任一不一致即触发重转，杜绝陈旧转录跨段落复用（1.2.7 审查修复）
function transSig(segs, duration) {
  if (!segs.length) return 'full'
  if (segs.length === 1 && segs[0].start === 0 && segs[0].end === duration) return 'full'
  const r = v => Math.round(Number(v) * 10) / 10
  return segs.map(s => `${s.id}:${r(s.start)}-${r(s.end)}`).join('|')
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

// ---- 打开所在文件夹（ticket 117）：win32 explorer /select，spawn 免 shell 免引号坑 ----
// revealApi.impl 挂对象上而非 let 变量，测试可整体替换打桩（server.test.js 用）
const revealApi = {
  impl(p) {
    return new Promise(resolve => {
      if (process.platform !== 'win32') return resolve({ ok: false, error: '仅支持 Windows 打开资源管理器' })
      const ex = spawn('explorer', ['/select,' + p], { windowsHide: true, stdio: 'ignore' })
      ex.on('error', () => resolve({ ok: false, error: '无法启动资源管理器' }))
      ex.on('close', code => resolve(code === 0 ? { ok: true } : { ok: false, error: `资源管理器退出码 ${code}` }))
    })
  },
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
  let segs = (body.segments || []).filter(Boolean).map(s => clampSeg(s, T.info.duration))
  if (!segs.length) segs = [{ id: 'full', start: 0, end: T.info.duration }]   // 空段落 = 整片交付
  T.segments = segs
  T.mode = body.mode === 'merge' ? 'merge' : 'split'
  const crf = body.crf === null || body.crf === undefined ? null : Number(body.crf)
  T.crf = isFinite(crf) ? crf : 23
  const conf = cfg.loadConfig()
  const outDirAbs = path.resolve(conf.outputDir)
  fs.mkdirSync(outDirAbs, { recursive: true })
  const title = T.info.title, bv = core.extractBv(T.url), duration = T.info.duration
  const pageLabel = T.pageCount > 1 ? 'P' + T.part : ''   // 分P 视频文件名带 P 序号，避免同名碰撞
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
      // 1.2.7 双重压缩修复：全部段落已在快捷命令第②步按该 CRF 编码过（prepared mode=reencode）→ 不再二次压缩
      const allPreEncoded = crf !== null && segs.every(s => { const p = T.prepared.find(x => x.id === s.id); return p && p.mode === 'reencode' })
      if (crf !== null && !allPreEncoded) {
        const before = fs.statSync(merged).size
        const enc = path.join(TMP_DIR, `bili_${Date.now()}_crf${crf}.mp4`)
        await core.trimVideo({ inPath: merged, outPath: enc, ffmpeg: conf.ffmpegPath, ffprobe: conf.ffprobePath, start: 0, end: expected, crf, totalMs: expected * 1000, onProgress: ({ percent }) => broadcast({ type: 'trim-progress', percent }) })
        const after = fs.statSync(enc).size
        if (after < before) { finalTemp = enc; compressed = true; usedCrf = crf }
        else { try { fs.unlinkSync(enc) } catch {} }   // 压缩回退：保留合并件
      }
      const name = `${core.sanitizeName(title)}_${bv}${pageLabel ? `_${pageLabel}` : ''}_merge_${segs.length}段${compressed ? `_crf${usedCrf}` : ''}.mp4`
      const finalPath = core.uniquePath(path.join(outDirAbs, name))
      fs.copyFileSync(finalTemp, finalPath)
      try { fs.unlinkSync(finalTemp) } catch {}
      const finalName = path.basename(finalPath)
      history(finalName, makeWiki(finalName, conf))
      files.push({ finalName, finalPath, wiki: makeWiki(finalName, conf), segId: null })   // 合并 = 单文件对应整段转录
    } catch (e) {
      failures.push(`合并：${e.message}`)
    }
  } else {
    for (const seg of segs) {
      try {
        const tmp = await prepareSegment(seg, duration)
        let finalTemp = tmp, compressed = false, usedCrf = null
        // 1.2.7 双重压缩修复：该段已预编码（快捷命令第②步 / 手动压缩，mode=reencode）→ 交付直接复用
        const pre = T.prepared.find(p => p.id === seg.id)
        if (crf !== null && !(pre && pre.mode === 'reencode')) {
          const before = fs.statSync(tmp).size
          const enc = path.join(TMP_DIR, `bili_${Date.now()}_${seg.id}_crf${crf}.mp4`)
          await core.trimVideo({ inPath: tmp, outPath: enc, ffmpeg: conf.ffmpegPath, ffprobe: conf.ffprobePath, start: 0, end: seg.end - seg.start, crf, totalMs: (seg.end - seg.start) * 1000, onProgress: ({ percent }) => broadcast({ type: 'trim-progress', percent }) })
          const after = fs.statSync(enc).size
          if (after < before) { finalTemp = enc; compressed = true; usedCrf = crf }
          else { try { fs.unlinkSync(enc) } catch {} }
        }
        const full = !(seg.start > 0 || seg.end < duration)          // 全片 = 不裁切
        const finalName = core.buildFileName({ title, bv, page: pageLabel, trimmed: !full, start: seg.start, end: seg.end, duration, compressed, crf: usedCrf })
        const finalPath = core.uniquePath(path.join(outDirAbs, finalName))
        fs.copyFileSync(finalTemp, finalPath)
        try { if (finalTemp !== tmp) fs.unlinkSync(finalTemp) } catch {}
        history(finalName, makeWiki(finalName, conf))
        files.push({ finalName, finalPath, wiki: makeWiki(finalName, conf), segId: seg.id })   // 分开交付 = 每文件对应自身段落转录
      } catch (e) {
        failures.push(`段落 ${seg.id}：${e.message}`)
      }
    }
  }
  if (!files.length) throw new Error(failures.join('\n') || '交付失败')
  T.phase = 'done'
  T.lastFiles = files.map(f => ({ finalName: f.finalName, wiki: f.wiki, segId: f.segId, finalPath: f.finalPath }))   // 记录本次交付文件（文献笔记 embed + 分段转录引用 + 刷新恢复后「打开所在文件夹」）
  const clip = buildClipboard(files.map(f => f.finalName))   // 传裸文件名，由 buildClipboard 统一包一层 ![[ ]]，避免双重嵌套
  return { ok: true, mode: T.mode, files, failures, clipboard: clip.text, wiki: clip.wiki }
}

// ---- 文献笔记（F3-F5）：AI 元数据 + 分块润色 + 落盘文献盒 + 历史 note 字段 ----
// 前置：已「完成」交付（embed 引用真实交付文件名）+ 已转文字（转录全文在内存 T.transcript）
// AI 润色独立成步（POST /api/note-prepare，1.2.4 起）：润色结果存 T.polishedNote，note 落盘直接复用；
// 未走 prepare（旧前端/直连）时 note 内部内联执行 AI（向后兼容）。
// 1.2.7：按段落分别润色（sources=[{segId,text}]；段内超长仍切块），逐块广播 note-progress 进度；
// 产物 = { meta, bodies:[{segId,text}], whole }（whole=各段润色稿拼接，供合并交付与前端回填）。
async function runNoteAi(ai, videoTitle, sources) {
  if (T.polishedNote) return T.polishedNote
  const srcs = (Array.isArray(sources) && sources.length)
    ? sources.filter(s => s && s.text && String(s.text).trim())
    : [{ segId: null, text: T.transcript }]
  if (!srcs.length) srcs.push({ segId: null, text: T.transcript })
  // 进度分母先行：全部切块总数（元数据一步 + 逐块润色）；phase: meta | polish（ticket 117 前端进度条）
  const plan = srcs.map(s => ({ segId: s.segId, chunks: core.chunkTranscript(s.text) }))
  const total = plan.reduce((a, p) => a + p.chunks.length, 0)
  broadcast({ type: 'note-progress', phase: 'meta', done: 0, total, text: '生成标题/标签/简介…' })
  // 元数据：基于第一段开头片段
  const firstChunks = core.chunkTranscript(srcs[0].text)
  const metaRaw = await core.aiJson({
    ...ai,
    messages: [{ role: 'user', content: core.literatureMetaPrompt(videoTitle, firstChunks[0] || '') }],
    maxTokens: 600,
  })
  const tags = Array.isArray(metaRaw.tags) ? metaRaw.tags.map(String).filter(Boolean).slice(0, 6) : []
  const meta = {
    title: String(metaRaw.title || '').trim() || videoTitle || '未命名',
    tags,
    summary: String(metaRaw.summary || '').trim(),
  }
  // 正文：逐段润色；进度按全部切块总数推进
  let done = 0
  const bodies = []
  for (const p of plan) {
    const polished = []
    for (const c of p.chunks) {
      done++
      broadcast({ type: 'note-progress', phase: 'polish', done, total, text: `AI 润色（第 ${done}/${total} 块）…` })
      polished.push(await core.aiChat({
        ...ai,
        messages: [{ role: 'user', content: core.literaturePolishPrompt(c) }],
        maxTokens: 4096,
      }))
    }
    bodies.push({ segId: p.segId, text: polished.join('') })
  }
  const out = { meta, bodies, whole: bodies.map(b => b.text).join('\n\n') }
  T.polishedNote = out
  return out
}

// 笔记 frontmatter 附加字段：url（BV 规范链接，分P 追加 ?p=N）/ date / author / videoTitle
function noteExtras() {
  const bv = core.extractBv(T.url)
  const url = bv ? `https://www.bilibili.com/video/${bv}${T.part > 1 ? `?p=${T.part}` : ''}` : (T.url || '')
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  return { url, date, author: (T.info && T.info.uploader) || '', videoTitle: (T.info && T.info.title) || '' }
}

async function doNote() {
  if (T.phase !== 'done') throw new Error('请先点「完成」交付视频，再生成文献笔记')
  if (!T.transcript) throw new Error('请先转文字（生成文献笔记需要转录文本）')
  const conf = cfg.loadConfig()
  const ai = core.loadBzAiConfig(conf)   // 缺 key / 缺 bz 数据文件 → 报错，无 quickadd 回退
  setBusy(true)
  T.phase = 'generating'
  try {
    // 未走 prepare（直连 /api/note）→ 同样按段落润色（源=lastFiles 的分段转录）；已 prepare → 复用缓存
    const segT0 = T.segmentTranscripts || {}
    const segSources = (T.lastFiles || []).filter(f => f.segId && segT0[f.segId]).map(f => ({ segId: f.segId, text: segT0[f.segId] }))
    const { meta, bodies, whole } = await runNoteAi(ai, (T.info && T.info.title) || '', segSources.length ? segSources : undefined)
    // 逐段块：分开交付 = 每文件「该段润色正文 + 该段双链」依次排；合并/整片 = 单组（整篇润色稿 + 单链）
    // 缺润色稿的段落只落双链（绝不回填原始转录——笔记中不出现「原文」）
    const blocks = (T.lastFiles || []).map(f => ({
      text: f.segId ? ((bodies.find(b => b.segId === f.segId) || {}).text || '') : whole,
      wiki: f.wiki,
    }))
    const md = core.buildLiteratureNote({
      title: meta.title, tags: meta.tags, summary: meta.summary,
      ...noteExtras(),
      blocks,
    })
    const folder = path.join(conf.vaultPath, conf.literatureFolder || '文献盒')
    fs.mkdirSync(folder, { recursive: true })
    const notePath = core.uniquePath(path.join(folder, core.sanitizeMdTitle(meta.title) + '.md'))
    fs.writeFileSync(notePath, md, 'utf8')
    const rel = path.relative(path.resolve(conf.vaultPath), notePath).replace(/\\/g, '/')
    attachNote(rel, (T.lastFiles || []).map(f => f.finalName))
    const url = `obsidian://open?vault=${encodeURIComponent(path.basename(path.resolve(conf.vaultPath)))}&file=${encodeURIComponent(rel)}`
    T.phase = 'done'
    return { ok: true, note: { path: notePath, wiki: `![[${rel}]]`, url } }
  } finally {
    if (T.phase === 'generating') T.phase = 'done'   // 失败也回到 done，可重试
    setBusy(false)
  }
}

// AI 润色独立步骤（快捷命令第 4 步）：按段落润色 → 存 T.polishedNote，供生成笔记复用；
// 返回 body（各段润色稿拼接），前端把「转文字」原文替换为润色稿（1.2.7）
async function doNotePrepare(body = {}) {
  if (!T.transcript) throw new Error('请先转文字（AI 润色需要转录文本）')
  const conf = cfg.loadConfig()
  const ai = core.loadBzAiConfig(conf)
  setBusy(true)
  T.phase = 'generating'
  try {
    // 按段落构建润色源：前端传 segments 则逐段取 segmentTranscripts；缺失/未传 → 整篇单源
    const segT = T.segmentTranscripts || {}
    const reqSegs = (body.segments || []).filter(Boolean).map(s => String(s.id)).filter(id => segT[id])
    const sources = reqSegs.length ? reqSegs.map(id => ({ segId: id, text: segT[id] })) : undefined
    const { meta, whole } = await runNoteAi(ai, (T.info && T.info.title) || '', sources)
    // 服务端转录视图对齐为润色稿：交付剪贴板/后续早退判断与前端文本框一致（简体）
    if (whole) T.transcript = whole
    T.phase = 'ready'
    return { ok: true, meta, body: whole }
  } finally {
    if (T.phase === 'generating') T.phase = 'ready'
    setBusy(false)
  }
}

// 给本任务本次交付的历史条目追加可选 note 字段（最新一条；旧历史零迁移，重复生成为新文件则更新）
function attachNote(rel, targetFiles) {
  const h = cfg.loadHistory()
  const i = h.findIndex(it => targetFiles.includes(it.file))
  if (i < 0) return
  h[i] = { ...h[i], note: rel }
  core.writeJson(cfg.HISTORY_PATH, h)
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
    T.pageCount = (info.pages || []).length || 1
    T.part = 1
    T.cid = (info.pages && info.pages[0]) ? info.pages[0].cid : info.cid
    T.partTitle = (info.pages && info.pages[0] && info.pages[0].title) || ''
    T.phase = 'ready'
    return { ok: true, info }
  },
  async 'POST /api/download'(body) {
    if (!T.info) throw new Error('请先解析视频')
    if (busy) throw new Error('任务进行中')
    const height = Number(body.height) || T.info.maxHeight
    // 分P：以用户选中的 P 为准（cid/序号/标题/该 P 时长）
    if (body.cid) T.cid = Number(body.cid)
    if (body.part) T.part = Number(body.part)
    if (body.partTitle != null) T.partTitle = String(body.partTitle)
    if (body.duration != null && isFinite(Number(body.duration))) T.info = { ...T.info, duration: Number(body.duration) }
    const conf = cfg.loadConfig()
    setBusy(true)
    T.phase = 'downloading'
    try {
      const outPath = path.join(TMP_DIR, `bili_${Date.now()}.mp4`)
      // 视频缓存：键 = BV + cid(分P) + 清晰度，全同命中则跳过下载+合并，复用缓存原件
      const key = core.cacheKey(core.extractBv(T.url), T.cid, height)
      const cached = core.cachePath(conf, key)
      const wasCached = fs.existsSync(cached)
      if (wasCached) {
        broadcast({ type: 'diag', text: '⏩ 缓存命中，跳过下载（直接复用下载原件）' })
        fs.copyFileSync(cached, outPath)
      } else {
        await core.downloadVideo({
          url: T.url, cookie: cfg.loadCookie(), height, cid: T.cid, outPath, ffmpeg: conf.ffmpegPath,
          onDiag: text => broadcast({ type: 'diag', text }),
          onProgress: p => broadcast({ type: 'download-progress', ...p }),
        })
        // 未命中下载完成后回写缓存（下载原件；剪辑/压缩件不进缓存）
        try { fs.mkdirSync(path.dirname(cached), { recursive: true }); fs.copyFileSync(outPath, cached) } catch {}
      }
      T.curPath = outPath      // 预览即下载原件（时间轴坐标 = 原件时长）
      T.originalPath = outPath // 下载原件：剪辑的源，始终保留
      T.curDur = T.info.duration
      T.segments = []; T.prepared = []; T.mode = 'split'
      T.phase = 'ready'
      return { ok: true, path: outPath, cached: wasCached }
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
  async 'POST /api/transcribe'(body = {}) {
    if (!T.curPath) throw new Error('请先下载视频')
    if (busy) throw new Error('任务进行中')
    const conf = cfg.loadConfig()
    setBusy(true)
    T.phase = 'transcribing'
    try {
      // 转录跟随剪辑语义：传 segments 则按「所选段落」逐段转录（分开交付时笔记按视频链接、正文依次对应），
      // 不传（或整片单段）则转录当前预览原件。prepareSegment 产物交付复用。
      const segs = (body.segments || []).filter(Boolean).map(s => clampSeg(s, T.info.duration))
      // 覆盖范围签名：与已存转录一致才早退，否则（整片↔分段互切、段落时间改动）重转，绝不复用陈旧稿
      const wantSig = transSig(segs, T.info.duration)
      if (T.transcript && T.transcriptSig === wantSig) return { ok: true, transcript: T.transcript }
      const sources = []
      if (!segs.length) sources.push({ seg: null, file: T.curPath })
      else {
        const fullSingle = segs.length === 1 && segs[0].start === 0 && segs[0].end === T.info.duration
        if (fullSingle) sources.push({ seg: segs[0], file: T.curPath })
        else {
          for (const seg of segs) sources.push({ seg, file: await prepareSegment(seg, T.info.duration) })
        }
      }
      // 单次进程 = 单次模型加载，多文件一次转录（逐段各自重载模型会静默几十秒，多段观感像卡死）
      // ticket 117：逐段文本实时推送 + 文件级完成计数（前端有三态进度与计时）
      broadcast({ type: 'transcribe-phase', phase: 'model', done: 0, total: sources.length })
      let raw = '', lineBuf = '', doneCount = 0
      const completedFiles = new Set()
      await core.runPython({
        py: conf.pythonPath,
        args: [conf.whisperModel, ...sources.map(s => s.file)],
        onChunk: s => {
          raw += s
          lineBuf += String(s)
          const lines = lineBuf.split('\n')
          lineBuf = lines.pop() || ''   // 尾行可能不完整，留到下一块
          let texts = []
          for (const line of lines) {
            if (!line.startsWith('\x1e')) continue
            const rest = line.slice(1)
            const sep = rest.indexOf('\x1f')
            if (sep < 0) continue
            const file = rest.slice(0, sep)
            const t = rest.slice(sep + 1).replace(/\x1f$/, '')
            if (t.trim()) texts.push(t)              // 文本单元：只推文本，文件名不掺进转录框
            else if (file && !completedFiles.has(file)) {   // 完成哨兵：\x1e<file>\x1f\x1f
              completedFiles.add(file)
              doneCount++
              broadcast({ type: 'transcribe-phase', phase: 'work', done: doneCount, total: sources.length })
              broadcast({ type: 'diag', text: `转录 ${doneCount}/${sources.length} 完成` })
            }
          }
          if (texts.length) broadcast({ type: 'transcript-chunk', text: texts.join(' ') })
        },
      })
      if (doneCount < sources.length) {   // 兜底：哨兵缺失（旧协议/异常）时补齐完成广播
        doneCount = sources.length
        broadcast({ type: 'transcribe-phase', phase: 'work', done: doneCount, total: sources.length })
      }
      const units = core.parseTranscriptUnits(raw)
      const byFile = new Map(units.map(u => [path.resolve(u.file), u.text]))
      const segTexts = {}
      const full = []
      sources.forEach((src, i) => {
        const t = byFile.get(path.resolve(src.file)) || ''
        if (src.seg) segTexts[src.seg.id] = t
        full.push(t)
      })
      T.segmentTranscripts = segTexts
      T.transcript = full.join(' ').trim()
      T.transcriptSig = wantSig
      T.phase = 'ready'
      return { ok: true, transcript: T.transcript }
    } finally { setBusy(false) }
  },
  async 'POST /api/done'(body) {
    if (busy) throw new Error('任务进行中')
    return doDone(body || {})
  },
  async 'POST /api/note'() {
    return doNote()
  },
  async 'POST /api/note-prepare'(body = {}) {
    return doNotePrepare(body)
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
  // ---- 任务快照（ticket 117）：页面刷新后恢复 UI（不回传 cookie/originalPath/prepared）----
  async 'GET /api/state'() {
    return {
      ok: true,
      state: {
        phase: T.phase,
        url: T.url,
        info: T.info,
        quality: T.quality,
        cid: T.cid, part: T.part, pageCount: T.pageCount, partTitle: T.partTitle,
        curDur: T.curDur,
        segments: T.segments,
        mode: T.mode,
        crf: T.crf,
        transcript: T.transcript,
        transcriptSig: T.transcriptSig,
        segmentTranscripts: T.segmentTranscripts,
        lastFiles: T.lastFiles,   // [{finalName, wiki, segId, finalPath}]
      },
    }
  },
  // 交付后「打开所在文件夹」（ticket 117）：win32 explorer /select；revealApi.impl 可替换（测试打桩）
  async 'POST /api/reveal'(body) {
    const p = body && body.path
    if (!p || typeof p !== 'string') throw new Error('缺少文件路径')
    const r = await revealApi.impl(p)
    if (!r.ok) throw new Error(r.error || '打开失败')
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

// 启动后：异步验证 Cookie 状态广播给页面 + 视频缓存启动清扫（清理过期下载原件）
function startValidate() {
  validateCookie()
  try { core.cleanupCache(cfg.loadConfig()) } catch {}
}

module.exports = { createServer, T, TMP_DIR, resetTask, startValidate, broadcast, revealApi }
