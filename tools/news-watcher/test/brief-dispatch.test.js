// ================================================================
// News Watcher - 每日简报调度测试（node:test，零依赖，issue 263 / ADR-0119）
// 覆盖：bili-dl 入口解析 / 本地时间串 / 名单空不 spawn / 条目登记 / 失败条目 / 去重 / 无协议行不崩。
// NEWS_PATH 必须在 require 之前设好（resolveNewsPath 在模块加载时执行一次）。
// ================================================================
const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { EventEmitter } = require('events')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'news-brief-test-'))
const NEWS = path.join(tmp, 'news.json')
process.env.NEWS_PATH = NEWS

const w = require('../watcher.js')

function writeNews(obj) { fs.writeFileSync(NEWS, JSON.stringify(obj, null, 2), 'utf-8') }
function readNews() { return JSON.parse(fs.readFileSync(NEWS, 'utf-8')) }

/** 假子进程：记录调用参数，setImmediate 吐 stdout 后 close（不发真进程） */
function fakeSpawn(stdout, code = 0) {
  const calls = []
  const impl = (cmd, args) => {
    calls.push({ cmd, args })
    const ch = new EventEmitter()
    ch.stdout = new EventEmitter()
    ch.stderr = new EventEmitter()
    ch.kill = () => {}
    setImmediate(() => {
      if (stdout) ch.stdout.emit('data', stdout)
      ch.emit('close', code)
    })
    return ch
  }
  impl.calls = calls
  return impl
}
const RESULT = (obj) => '[bz-step] 字幕中\n[bz-result] ' + JSON.stringify(obj) + '\n'

/** 解析 fakeSpawn 收到的 --brief 参数（b64: 前缀） */
function briefArgOf(spawnImpl) {
  const args = spawnImpl.calls[0].args
  const raw = args[args.indexOf('--brief') + 1]
  return JSON.parse(Buffer.from(raw.slice(4), 'base64').toString('utf8'))
}

test('resolveBiliDl：缺省用仓库内同级 bili-downloader/cli.js（当前 node 执行）', () => {
  delete process.env.BILI_DL_BIN
  const r = w.resolveBiliDl()
  assert.equal(r.cmd, process.execPath)
  assert.equal(r.shell, false)
  assert.match(r.pre[0].replace(/\\/g, '/'), /tools\/bili-downloader\/cli\.js$/)
})

test('resolveBiliDl：BILI_DL_BIN 环境变量优先', () => {
  process.env.BILI_DL_BIN = 'C:/custom/bili-dl.cmd'
  const r = w.resolveBiliDl()
  assert.equal(r.cmd, 'C:/custom/bili-dl.cmd')
  assert.deepEqual(r.pre, [])
  delete process.env.BILI_DL_BIN
})

test('localDatetime：本地时间串 YYYY-MM-DD HH:mm:ss（零填充）', () => {
  const s = w.localDatetime(new Date(2026, 8, 10, 9, 5, 3).getTime())   // 2026-09-10 09:05:03 本地
  assert.equal(s, '2026-09-10 09:05:03')
})

test('dispatchBrief：名单为空 → 不 spawn、不写盘', async () => {
  writeNews({ articles: [], briefUps: [], briefs: [] })
  const sp = fakeSpawn(RESULT({ ok: [], fail: [] }))
  const r = await w.dispatchBrief(w.readNewsData(), { spawnImpl: sp, bin: { cmd: 'x', pre: [], shell: false } })
  assert.deepEqual(r, { spawned: false, added: 0 })
  assert.equal(sp.calls.length, 0)
})

test('dispatchBrief：正常出稿 → 条目落 briefs（待出稿 / 未读）+ 传 ups/known/limit/backfill', async () => {
  writeNews({ articles: [], briefUps: ['3706929260006322'], briefs: [{ bvid: 'BVOLD', read: true, state: 'read' }] })
  const sp = fakeSpawn(RESULT({
    ok: [{
      bvid: 'BVNEW', title: '新片标题', source: 'transcript', transcriptPath: 'C:/cache/resume-brief-BVNEW.txt',
      duration: 173, pubdate: 1788951454, upMid: '3706929260006322', upName: '黑鸦Heya',
    }],
    fail: [],
  }))
  const r = await w.dispatchBrief(w.readNewsData(), { spawnImpl: sp, bin: { cmd: 'x', pre: [], shell: false } })
  assert.equal(r.added, 1)

  // 传给 bili-dl 的任务载荷
  const arg = briefArgOf(sp)
  assert.deepEqual(arg.ups, [{ mid: '3706929260006322' }])
  assert.deepEqual(arg.known, ['BVOLD'])
  assert.equal(arg.limit, w.BRIEF_LIMIT_PER_ROUND)
  assert.equal(arg.backfill, w.BRIEF_BACKFILL)
  assert.equal(arg.cookie, undefined, 'news.json 无 bilibiliCookie 时不下发')

  // 落盘条目
  const b = readNews().briefs.find((x) => x.bvid === 'BVNEW')
  assert.ok(b, '新条目应写入 briefs')
  assert.equal(b.title, '新片标题')
  assert.equal(b.url, 'https://www.bilibili.com/video/BVNEW')
  assert.equal(b.upName, '黑鸦Heya')
  assert.equal(b.src, 'transcript')
  assert.equal(b.transcriptPath, 'C:/cache/resume-brief-BVNEW.txt')
  assert.equal(b.duration, 173)
  assert.equal(b.read, false)
  assert.equal(b.state, 'unread')
  assert.equal(b.body, undefined, '要点由插件补，守护不写 body')
  assert.match(b.date, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  assert.match(b.fetchedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  // 既有条目保留
  assert.ok(readNews().briefs.some((x) => x.bvid === 'BVOLD'))
})

test('dispatchBrief：下发 bilibiliCookie（插件配的优先，与普通 B 站源同源）', async () => {
  writeNews({ articles: [], briefUps: ['1'], briefs: [], bilibiliCookie: 'SESSDATA=abc' })
  const sp = fakeSpawn(RESULT({ ok: [], fail: [] }))
  await w.dispatchBrief(w.readNewsData(), { spawnImpl: sp, bin: { cmd: 'x', pre: [], shell: false } })
  assert.equal(briefArgOf(sp).cookie, 'SESSDATA=abc')
})

test('dispatchBrief：失败条目分两类——有 bvid 落可见错误条目，UP 级（bvid 空）只记日志', async () => {
  writeNews({ articles: [], briefUps: ['1'], briefs: [] })
  const sp = fakeSpawn(RESULT({
    ok: [],
    fail: [
      { bvid: 'BVBAD', reason: '转文字失败：未配置 pythonPath' },
      { bvid: '', reason: 'UP 1 投稿列表拉取失败：风控校验失败' },
    ],
  }))
  const r = await w.dispatchBrief(w.readNewsData(), { spawnImpl: sp, bin: { cmd: 'x', pre: [], shell: false } })
  assert.equal(r.added, 1)
  const briefs = readNews().briefs
  assert.equal(briefs.length, 1)
  assert.equal(briefs[0].bvid, 'BVBAD')
  assert.match(briefs[0].error, /未配置 pythonPath/)
  assert.equal(briefs[0].read, false)
})

test('dispatchBrief：已存在的 bvid 不重复落条目（幂等）', async () => {
  writeNews({ articles: [], briefUps: ['1'], briefs: [{ bvid: 'BVNEW', read: false, state: 'unread' }] })
  const sp = fakeSpawn(RESULT({ ok: [{ bvid: 'BVNEW', title: 'x', source: 'subtitle' }], fail: [] }))
  const r = await w.dispatchBrief(w.readNewsData(), { spawnImpl: sp, bin: { cmd: 'x', pre: [], shell: false } })
  assert.equal(r.added, 0)
  assert.equal(readNews().briefs.length, 1)
})

test('dispatchBrief：bili-dl 无 [bz-result] 行 → 不崩、不加条目', async () => {
  writeNews({ articles: [], briefUps: ['1'], briefs: [] })
  const sp = fakeSpawn('[bz-step] 字幕中\n', 1)
  const r = await w.dispatchBrief(w.readNewsData(), { spawnImpl: sp, bin: { cmd: 'x', pre: [], shell: false } })
  assert.equal(r.added, 0)
  assert.deepEqual(readNews().briefs, [])
})

test('dispatchBrief：子进程启动失败 → 收敛为 fail 且不抛', async () => {
  writeNews({ articles: [], briefUps: ['1'], briefs: [] })
  const boom = () => { throw new Error('ENOENT') }
  const r = await w.dispatchBrief(w.readNewsData(), { spawnImpl: boom, bin: { cmd: 'x', pre: [], shell: false } })
  assert.equal(r.added, 0)
  assert.deepEqual(readNews().briefs, [])
})

test('readNewsData：保留 briefUps/briefs 两段（防守护写回时抹掉插件数据）', () => {
  writeNews({ articles: [], briefUps: ['99'], briefs: [{ bvid: 'BV1', read: false, state: 'unread' }] })
  const d = w.readNewsData()
  assert.deepEqual(d.briefUps, ['99'])
  assert.equal(d.briefs.length, 1)
})
