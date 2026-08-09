// ================================================================
// B站下载器 - 服务冒烟测试（node:test，零依赖）
// 用环境变量把配置/历史/Cookie 隔离到临时目录，不碰真实用户文件
// ================================================================
const { test, before, after } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-server-test-'))
process.env.BILI_DL_CONFIG = path.join(tmp, 'config.json')
process.env.BILI_DL_COOKIES = path.join(tmp, 'cookies.json')
process.env.BILI_DL_HISTORY = path.join(tmp, 'history.json')

const { createServer } = require('../server')

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
