// ================================================================
// B站下载器 - 服务冒烟测试（node:test，零依赖）
// 用环境变量把配置/历史/Cookie 隔离到临时目录，不碰真实用户文件
// ================================================================
const { test, before, after } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-server-test-'))
process.env.BILI_DL_CONFIG = path.join(tmp, 'config.json')
process.env.BILI_DL_COOKIES = path.join(tmp, 'cookies.json')
process.env.BILI_DL_HISTORY = path.join(tmp, 'history.json')

// 端到端交付测试需要真实 ffmpeg；无二进制环境自动跳过
const hasFfmpeg = (() => { try { return spawnSync('ffmpeg', ['-version']).status === 0 } catch { return false } })()

const { createServer, T, resetTask } = require('../server')
const core = require('../core')
const cfg = require('../config')

let server, base
before(async () => {
  server = createServer()
  await new Promise(res => server.listen(0, '127.0.0.1', res))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => new Promise(res => server.close(res)))

async function req(method, p, body) {
  const res = await fetch(base + p, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  return res
}

test('GET / 返回前端页面', async () => {
  const res = await req('GET', '/')
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.ok(html.includes('B站下载器'))
  assert.ok(html.includes('app.js'))
})

test('GET /style.css 与 /app.js 可访问', async () => {
  assert.equal((await req('GET', '/style.css')).status, 200)
  assert.equal((await req('GET', '/app.js')).status, 200)
})

test('GET /api/config 返回默认配置（不回显 Cookie 明文）', async () => {
  const j = await (await req('GET', '/api/config')).json()
  assert.equal(j.ok, true)
  assert.ok(j.config.outputDir)
  assert.ok(j.config.ffmpegPath)
  assert.equal(j.cookieConfigured, false)
  assert.ok(!('cookie' in j.config))
})

test('POST /api/config 保存并回读', async () => {
  const j = await (await req('POST', '/api/config', { outputDir: 'D:/测试输出' })).json()
  assert.equal(j.ok, true)
  const j2 = await (await req('GET', '/api/config')).json()
  assert.equal(j2.config.outputDir, 'D:/测试输出')
})

test('POST /api/parse：空链接报错，无 BV 报错（不触发网络）', async () => {
  const j1 = await (await req('POST', '/api/parse', {})).json()
  assert.equal(j1.ok, false)
  assert.match(j1.error, /请输入/)
  const j2 = await (await req('POST', '/api/parse', { url: 'https://example.com/x' })).json()
  assert.equal(j2.ok, false)
  assert.match(j2.error, /BV 号/)
})

test('POST /api/download：未解析时报错', async () => {
  const j = await (await req('POST', '/api/download', { height: 1080 })).json()
  assert.equal(j.ok, false)
  assert.match(j.error, /先解析/)
})

test('POST /api/done：未下载时报错', async () => {
  const j = await (await req('POST', '/api/done', {})).json()
  assert.equal(j.ok, false)
  assert.match(j.error, /先下载/)
})

test('GET /api/history 初始为空，DELETE 清空可用', async () => {
  const j = await (await req('GET', '/api/history')).json()
  assert.deepEqual(j.history, [])
  assert.equal((await req('DELETE', '/api/history')).status, 200)
})

test('POST /api/cancel：空闲时取消也安全（重置任务）', async () => {
  const j = await (await req('POST', '/api/cancel', {})).json()
  assert.equal(j.ok, true)
})

test('POST /api/revert：无下载原件时报错', async () => {
  const j = await (await req('POST', '/api/revert', {})).json()
  assert.equal(j.ok, false)
  assert.match(j.error, /下载原件/)
})

test('POST /api/revert：返回原视频并清空段落/预编码缓存', async () => {
  const orig = path.join(tmp, 'orig2.mp4')
  const clip = path.join(tmp, 'clip2.mp4')
  fs.writeFileSync(orig, 'orig')
  fs.writeFileSync(clip, 'clip')
  T.originalPath = orig
  T.curPath = clip
  T.curDur = 30
  T.crf = 23
  T.mode = 'split'
  T.segments = [{ id: 'a', start: 5, end: 30 }]
  T.prepared = [{ id: 'a', start: 5, end: 30, mode: 'copy', tempPath: clip }]
  T.info = { title: '测试', duration: 120 }
  const j = await (await req('POST', '/api/revert', {})).json()
  assert.equal(j.ok, true)
  assert.equal(j.duration, 120)
  assert.equal(T.curPath, orig)        // 预览恢复为下载原件
  assert.equal(T.curDur, 120)
  assert.deepEqual(T.segments, [])     // 段落清空
  assert.deepEqual(T.prepared, [])
  resetTask()   // 恢复任务状态，避免影响后续测试（media/current 等）
})

test('GET /media/current：无产物时 404', async () => {
  assert.equal((await req('GET', '/media/current')).status, 404)
})

test('GET /events：SSE 端点返回 event-stream 并推送 cookie 状态', async () => {
  const ac = new AbortController()
  const res = await fetch(base + '/events', { signal: ac.signal })
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /text\/event-stream/)
  const reader = res.body.getReader()
  const { value } = await reader.read()
  const text = new TextDecoder().decode(value)
  assert.match(text, /data: \{"type":"cookie-status"/)
  ac.abort()
})

test('POST /api/cookie：空 Cookie 报错', async () => {
  const j = await (await req('POST', '/api/cookie', { cookie: '  ' })).json()
  assert.equal(j.ok, false)
  assert.match(j.error, /Cookie 为空/)
})

// ---------- 多段交付端到端（需真实 ffmpeg）----------

function makeSrc() {
  const src = path.join(tmp, 'tc-src-' + Date.now() + '.mp4')
  const r = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=64x64:rate=10', '-t', '3', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', src], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr || 'ffmpeg 生成源失败')
  return src
}

test('POST /api/done：分开交付多段 → N 文件 + 多行 wikilink + 历史逐条', { skip: !hasFfmpeg }, async () => {
  const src = makeSrc()
  const outDir = path.join(tmp, 'deliver-split')
  fs.mkdirSync(outDir, { recursive: true })
  assert.equal((await (await req('POST', '/api/config', { outputDir: outDir, vaultPath: '' })).json()).ok, true)
  T.originalPath = src; T.curPath = src; T.curDur = 3
  T.info = { title: '多段测试', duration: 3 }; T.url = 'https://www.bilibili.com/video/BV1GJ411x7h7'; T.quality = 1080
  const j = await (await req('POST', '/api/done', { segments: [{ id: 'a', start: 0, end: 1 }, { id: 'b', start: 1, end: 3 }], mode: 'split', crf: null })).json()
  assert.equal(j.ok, true, j.error)
  assert.equal(j.mode, 'split')
  assert.equal(j.files.length, 2)
  assert.ok(j.clipboard.includes('\n'), '分开交付应为多行 wikilink')
  assert.ok(j.failures.length === 0, JSON.stringify(j.failures))
  for (const f of j.files) assert.ok(fs.existsSync(f.finalPath), f.finalPath)
  const hist = (await (await req('GET', '/api/history')).json()).history
  assert.equal(hist.length, 2)
  resetTask()
})

test('POST /api/done：合并交付多段 → 单文件 + 单条 wikilink', { skip: !hasFfmpeg }, async () => {
  const src = makeSrc()
  const outDir = path.join(tmp, 'deliver-merge')
  fs.mkdirSync(outDir, { recursive: true })
  await (await req('POST', '/api/config', { outputDir: outDir, vaultPath: '' })).json()
  T.originalPath = src; T.curPath = src; T.curDur = 3
  T.info = { title: '合并测试', duration: 3 }; T.url = 'https://www.bilibili.com/video/BV1GJ411x7h7'; T.quality = 720
  const j = await (await req('POST', '/api/done', { segments: [{ id: 'a', start: 0, end: 1 }, { id: 'b', start: 1, end: 3 }], mode: 'merge', crf: null })).json()
  assert.equal(j.ok, true, j.error)
  assert.equal(j.mode, 'merge')
  assert.equal(j.files.length, 1)
  assert.ok(j.files[0].finalName.includes('_merge_2段'), j.files[0].finalName)
  assert.ok(!j.clipboard.includes('\n'), '合并交付应为单条 wikilink')
  assert.ok(fs.existsSync(j.files[0].finalPath))
  resetTask()
})

test('POST /api/done：vault 内交付 → wikilink 单层不嵌套（分P 命名）', { skip: !hasFfmpeg }, async () => {
  const src = makeSrc()
  const vault = path.join(tmp, 'deliver-vault')
  const outDir = path.join(vault, 'CONFIG', 'APPENDIX')
  fs.mkdirSync(outDir, { recursive: true })
  await (await req('POST', '/api/config', { outputDir: outDir, vaultPath: vault })).json()
  T.originalPath = src; T.curPath = src; T.curDur = 3
  T.info = { title: '嵌套测试', duration: 3 }; T.url = 'https://www.bilibili.com/video/BV1GJ411x7h7'; T.quality = 1080
  T.pageCount = 2; T.part = 2; T.cid = 1002

  // 分开交付：多行，每行应为标准单层 ![[…]]，不得双重嵌套
  const split = await (await req('POST', '/api/done', { segments: [{ id: 'a', start: 0, end: 1 }, { id: 'b', start: 1, end: 3 }], mode: 'split', crf: null })).json()
  assert.equal(split.ok, true, split.error)
  const lines = split.clipboard.split('\n')
  assert.equal(lines.length, 2)
  for (const ln of lines) assert.match(ln, /^!\[\[CONFIG\/APPENDIX\/[^\]]+\]\]$/, ln)
  assert.ok(!split.clipboard.includes('![[CONFIG/APPENDIX/![[CONFIG'), '不得双重嵌套')
  assert.ok(split.files.every(f => f.finalName.includes('_P2_')), split.files.map(f => f.finalName).join(','))

  // 合并交付：单行标准 ![[…]]，文件名带 P 与 merge
  T.prepared = []; T.segments = []
  const merge = await (await req('POST', '/api/done', { segments: [{ id: 'a', start: 0, end: 1 }, { id: 'b', start: 1, end: 3 }], mode: 'merge', crf: null })).json()
  assert.equal(merge.ok, true, merge.error)
  assert.equal(merge.files.length, 1)
  assert.match(merge.clipboard, /^!\[\[CONFIG\/APPENDIX\/[^\]]+\]\]$/, merge.clipboard)
  assert.ok(!merge.clipboard.includes('![[CONFIG/APPENDIX/![[CONFIG'))
  assert.ok(merge.files[0].finalName.includes('_P2_merge_2段'), merge.files[0].finalName)
  resetTask()
})

// ---------- 视频缓存 + 文献笔记（F1-F6）----------

test('POST /api/config：新增三键可保存并回读，既有键不受影响', async () => {
  await (await req('POST', '/api/config', { cacheDir: 'D:/cache-x', cacheRetentionDays: 3, literatureFolder: '文献' })).json()
  const j = await (await req('GET', '/api/config')).json()
  assert.equal(j.config.cacheDir, 'D:/cache-x')
  assert.equal(j.config.cacheRetentionDays, 3)
  assert.equal(j.config.literatureFolder, '文献')
  assert.ok(j.config.outputDir)
  assert.ok(j.config.ffmpegPath)
})

test('POST /api/download：缓存命中跳过下载（零网络/ffmpeg），原件为缓存副本', async () => {
  const cacheDir = path.join(tmp, 'dl-cache')
  fs.mkdirSync(cacheDir, { recursive: true })
  await (await req('POST', '/api/config', { cacheDir, cacheRetentionDays: 7 })).json()
  fs.writeFileSync(path.join(cacheDir, 'BV1GJ411x7h7_1001_1080.mp4'), 'FAKE-VIDEO')
  T.url = 'https://www.bilibili.com/video/BV1GJ411x7h7'
  T.info = { title: '缓存测试', duration: 120 }
  T.cid = 1001
  const j = await (await req('POST', '/api/download', { height: 1080 })).json()
  assert.equal(j.ok, true, j.error)
  assert.equal(j.cached, true)
  assert.ok(T.originalPath && fs.existsSync(T.originalPath))
  assert.equal(fs.readFileSync(T.originalPath, 'utf8'), 'FAKE-VIDEO')
  resetTask()
})

test('POST /api/note：未交付 / 未转文字 前置报错', async () => {
  const j1 = await (await req('POST', '/api/note', {})).json()
  assert.equal(j1.ok, false)
  assert.match(j1.error, /完成/)
  T.phase = 'done'
  const j2 = await (await req('POST', '/api/note', {})).json()
  assert.equal(j2.ok, false)
  assert.match(j2.error, /转文字/)
  resetTask()
})

test('POST /api/note：交付后生成文献笔记（AI 打桩）→ 落盘文献盒 + embed + 历史 note 字段', async () => {
  const vault = path.join(tmp, 'vault-note')
  const bzDir = path.join(vault, '.obsidian', 'plugins', 'bz')
  fs.mkdirSync(bzDir, { recursive: true })
  fs.writeFileSync(path.join(bzDir, 'data.json'), JSON.stringify({ aiProvider: 'opencode-go', opencodeGoApiKey: 'k' }))
  const outDir = path.join(vault, 'CONFIG', 'APPENDIX')
  fs.mkdirSync(outDir, { recursive: true })
  await (await req('POST', '/api/config', { vaultPath: vault, outputDir: outDir, literatureFolder: '文献盒' })).json()
  // 预置一次交付历史（attachNote 对照目标：file 命中最近条目）
  cfg.pushHistory({ time: '2026/8/25 10:00:00', title: '测试', bv: 'BV1GJ411x7h7', quality: '1080P', file: '测试_BV1GJ411x7h7.mp4', wiki: '![[CONFIG/APPENDIX/测试_BV1GJ411x7h7.mp4]]' })
  const origJson = core.aiJson, origChat = core.aiChat
  core.aiJson = async () => ({ title: '测试文献', tags: ['科普', 'AI'], summary: '一句话简介' })
  core.aiChat = async () => '润色后的正文。'
  try {
    T.phase = 'done'
    T.transcript = '第一句。第二句。'
    T.lastFiles = [{ finalName: '测试_BV1GJ411x7h7.mp4', wiki: '![[CONFIG/APPENDIX/测试_BV1GJ411x7h7.mp4]]' }]
    T.url = 'https://www.bilibili.com/video/BV1GJ411x7h7'
    T.info = { title: '测试', duration: 120 }
    const j = await (await req('POST', '/api/note', {})).json()
    assert.equal(j.ok, true, j.error)
    assert.ok(j.note.path.endsWith(path.join('文献盒', '测试文献.md')), j.note.path)
    assert.ok(fs.existsSync(j.note.path))
    const md = fs.readFileSync(j.note.path, 'utf8')
    assert.ok(md.includes('title: "测试文献"'))
    assert.ok(md.includes('  - "科普"\n  - "AI"'))
    assert.ok(md.includes('summary: "一句话简介"'))
    assert.ok(md.includes('source: "BV1GJ411x7h7"'))
    assert.ok(md.includes('润色后的正文。'))
    assert.ok(md.includes('![[CONFIG/APPENDIX/测试_BV1GJ411x7h7.mp4]]'))
    assert.ok(j.note.url.startsWith('obsidian://open?vault='))
    assert.ok(j.note.url.includes(encodeURIComponent('文献盒/测试文献.md')))
    // 历史最新条目追加 note 字段
    const hist = (await (await req('GET', '/api/history')).json()).history
    assert.equal(hist[0].note, '文献盒/测试文献.md')
    // 重复生成 → 新文件名（uniquePath 不覆盖）
    const j2 = await (await req('POST', '/api/note', {})).json()
    assert.equal(j2.ok, true, j2.error)
    assert.ok(j2.note.path.endsWith(path.join('文献盒', '测试文献_2.md')), j2.note.path)
    assert.equal((await (await req('GET', '/api/history')).json()).history[0].note, '文献盒/测试文献_2.md')
  } finally {
    core.aiJson = origJson; core.aiChat = origChat
    resetTask()
  }
})

test('POST /api/note：分开交付多段 → 视频块「链接+对应转文字」依次排布', async () => {
  const vault = path.join(tmp, 'vault-note-multi')
  const bzDir = path.join(vault, '.obsidian', 'plugins', 'bz')
  fs.mkdirSync(bzDir, { recursive: true })
  fs.writeFileSync(path.join(bzDir, 'data.json'), JSON.stringify({ aiProvider: 'opencode-go', opencodeGoApiKey: 'k' }))
  await (await req('POST', '/api/config', { vaultPath: vault, literatureFolder: '文献盒' })).json()
  const origJson = core.aiJson, origChat = core.aiChat
  core.aiJson = async () => ({ title: '多段笔记', tags: ['t'], summary: 's' })
  core.aiChat = async () => '润色正文。'
  try {
    T.phase = 'done'
    T.transcript = '段一文本。 段二文本。'
    T.segmentTranscripts = { a: '段一文本。', b: '段二文本。' }
    T.lastFiles = [
      { finalName: 'x_a.mp4', wiki: '![[CONFIG/APPENDIX/x_a.mp4]]', segId: 'a' },
      { finalName: 'x_b.mp4', wiki: '![[CONFIG/APPENDIX/x_b.mp4]]', segId: 'b' },
    ]
    T.url = 'https://www.bilibili.com/video/BV1GJ411x7h7'
    T.info = { title: 'X', duration: 100 }
    const j = await (await req('POST', '/api/note', {})).json()
    assert.equal(j.ok, true, j.error)
    const md = fs.readFileSync(j.note.path, 'utf8')
    assert.ok(md.includes('![[CONFIG/APPENDIX/x_a.mp4]]\n\n段一文本。'))
    assert.ok(md.includes('![[CONFIG/APPENDIX/x_b.mp4]]\n\n段二文本。'))
    assert.ok(md.indexOf('段一文本。') < md.indexOf('![[CONFIG/APPENDIX/x_b.mp4]]'))
  } finally {
    core.aiJson = origJson; core.aiChat = origChat
    resetTask()
  }
})

test('POST /api/done：空段落 = 整片交付（单文件、无 clip 标记）', { skip: !hasFfmpeg }, async () => {
  const src = makeSrc()
  const outDir = path.join(tmp, 'deliver-empty')
  fs.mkdirSync(outDir, { recursive: true })
  await (await req('POST', '/api/config', { outputDir: outDir, vaultPath: '' })).json()
  T.originalPath = src; T.curPath = src; T.curDur = 3
  T.info = { title: '空段测试', duration: 3 }; T.url = 'https://www.bilibili.com/video/BV1GJ411x7h7'; T.quality = 720
  const j = await (await req('POST', '/api/done', { segments: [], mode: 'split', crf: null })).json()
  assert.equal(j.ok, true, j.error)
  assert.equal(j.files.length, 1)
  assert.ok(j.files[0].finalName.includes('空段测试_BV1GJ411x7h7'), j.files[0].finalName)
  assert.ok(!j.files[0].finalName.includes('_clip_'), j.files[0].finalName)
  resetTask()
})

test('POST /api/note-prepare + /api/note：AI 只跑一次（润色独立成步，生成笔记直接复用）', async () => {
  const vault = path.join(tmp, 'vault-note-prep')
  const bzDir = path.join(vault, '.obsidian', 'plugins', 'bz')
  fs.mkdirSync(bzDir, { recursive: true })
  fs.writeFileSync(path.join(bzDir, 'data.json'), JSON.stringify({ aiProvider: 'opencode-go', opencodeGoApiKey: 'k' }))
  await (await req('POST', '/api/config', { vaultPath: vault, literatureFolder: '文献盒' })).json()
  const origJson = core.aiJson, origChat = core.aiChat
  let aiCalls = 0
  core.aiJson = async () => { aiCalls++; return { title: '预润色笔记', tags: ['a'], summary: 's' } }
  core.aiChat = async () => { aiCalls++; return '润色好的正文。' }
  try {
    T.phase = 'done'
    T.transcript = '第一段。第二段。'
    T.lastFiles = [{ finalName: 'x.mp4', wiki: '![[CONFIG/APPENDIX/x.mp4]]', segId: null }]
    T.url = 'https://www.bilibili.com/video/BV1GJ411x7h7'
    T.info = { title: 'X', duration: 10 }
    const p = await (await req('POST', '/api/note-prepare', {})).json()
    assert.equal(p.ok, true, p.error)
    assert.equal(p.meta.title, '预润色笔记')
    const callsAfterPrepare = aiCalls
    assert.ok(callsAfterPrepare > 0)
    T.phase = 'done'   // 真实链路：prepare 与 note 之间由「完成」交付驱动 phase=done
    const n = await (await req('POST', '/api/note', {})).json()
    assert.equal(n.ok, true, n.error)
    assert.equal(aiCalls, callsAfterPrepare, '生成笔记不得再次调用 AI（复用 T.polishedNote）')
    const md = fs.readFileSync(n.note.path, 'utf8')
    assert.ok(md.includes('润色好的正文。'))
    assert.ok(md.includes('title: "预润色笔记"'))
  } finally {
    core.aiJson = origJson; core.aiChat = origChat
    resetTask()
  }
})
