// ================================================================
// B站下载器 - 每日简报（runBrief）测试（node:test，零依赖，issue 263）
// 覆盖：UP 投稿列表映射 / cid 两形态 / 字幕优先与可信度校验 / 不可信回退转写 /
//       单条失败不阻断整批 / limit 分轮上限。
// 注入手法与 batch.test.js 一致：mockFetch 覆盖网络；缓存预置绕开真实下载；runPythonImpl 打桩。
// ================================================================
const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const core = require('../core')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-brief-test-'))

function mockFetch(handlers) {
  return async (url, headers) => {
    for (const [pat, fn] of handlers) {
      if (pat.test(url)) return fn(url, headers)
    }
    throw new Error(`无 mock 路由: ${url}`)
  }
}
function navOk() {
  return { code: 0, data: { wbi_img: { img_url: 'https://i0.hdslb.com/bfs/wbi/abc123456789.png', sub_url: 'https://i0.hdslb.com/bfs/wbi/def987654321.png' } } }
}
function viewOk(duration = 120) {
  return {
    code: 0,
    data: {
      title: '批处理测试视频', owner: { name: 'UP主' }, duration, pic: 'https://i0.hdslb.com/bfs/archive/cover.jpg', cid: 1001,
      pages: [{ cid: 1001, page: 1, part: '开篇', duration }],
    },
  }
}
function playOk() {
  return {
    code: 0,
    data: {
      dash: {
        video: [{ height: 1080, codecs: 'avc1.640028', frameRate: 30, baseUrl: 'https://cdn1/v.m4s', backupUrl: [], size: 1000000 }],
        audio: [{ baseUrl: 'https://cdn1/a.m4s', backupUrl: [], size: 300000 }],
      },
    },
  }
}
function stubRunPython(text) {
  return async ({ args, onChunk }) => {
    onChunk(`\x1e${args[1]}\x1f${text}\x1f\n\x1e${args[1]}\x1f\x1f\n`)
  }
}

/** 简报测试环境：固定 conf + 缓存目录 + 可 seed 的 720P 缓存（runBrief 内层固定 quality:'720'） */
function makeEnv(over = {}) {
  const vault = path.join(tmp, 'vault-' + Math.random().toString(36).slice(2))
  fs.mkdirSync(path.join(vault, 'CONFIG', 'APPENDIX'), { recursive: true })
  const cacheDir = path.join(tmp, 'cache-' + Math.random().toString(36).slice(2))
  fs.mkdirSync(cacheDir, { recursive: true })
  const env = {
    conf: {
      vaultPath: vault, outputDir: path.join(vault, 'CONFIG', 'APPENDIX'),
      cacheDir, cacheRetentionDays: 7,
      ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe',
      pythonPath: 'py-stub', whisperModel: 'small',
    },
    deps: { runPythonImpl: stubRunPython('模拟转录文本。') },
    seedCache(bvid, cid, content) {
      const p = core.cachePath(env.conf, core.cacheKey(bvid, cid, 720))
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, content)
    },
  }
  Object.assign(env.conf, over.conf || {})
  Object.assign(env.deps, over.deps || {})
  return env
}

/** 字幕轨 mock（lan/内容/to） */
function subTrack({ lan = 'ai-zh', lanDoc = '中文', text = '字幕文本', url = '//aisubtitle.hdslb.com/bfs/x.json' } = {}) {
  return { code: 0, data: { subtitle: { subtitles: [{ lan, lan_doc: lanDoc, subtitle_url: url }] } } }
}
function subBody(items) {
  return { body: items.map((it, i) => ({ from: i * 2, to: it.to != null ? it.to : i * 2 + 2, content: it.content })) }
}

function cleanupTranscripts(r) {
  for (const o of (r && r.ok) || []) { try { fs.unlinkSync(o.transcriptPath) } catch {} }
}

// ---------- 纯函数 ----------

test('parseLenStr：MM:SS / HH:MM:SS / 非法', () => {
  assert.equal(core.parseLenStr('02:53'), 173)
  assert.equal(core.parseLenStr('1:02:03'), 3723)
  assert.equal(core.parseLenStr('05'), 5)
  assert.equal(core.parseLenStr(''), 0)
  assert.equal(core.parseLenStr(null), 0)
  assert.equal(core.parseLenStr('abc'), 0)
})

test('checkSubtitlePlausible：时间轴越界 / 字速不可能 / 正常', () => {
  assert.equal(core.checkSubtitlePlausible({ text: '一二三四五', maxTo: 10, duration: 10 }).ok, true)
  const over = core.checkSubtitlePlausible({ text: '短', maxTo: 756, duration: 39 })
  assert.equal(over.ok, false)
  assert.match(over.reason, /超出视频时长/)
  const fast = core.checkSubtitlePlausible({ text: '字'.repeat(900), maxTo: 39, duration: 39 })
  assert.equal(fast.ok, false)
  assert.match(fast.reason, /字\/秒/)
  // duration 未知 → 跳过时长项，只查字速
  assert.equal(core.checkSubtitlePlausible({ text: '一二三', maxTo: 5, duration: 0 }).ok, true)
})

// ---------- UP 投稿列表 ----------

test('getUpVideos：映射 vlist（length 字符串转秒）+ 过滤空 bvid + 错误码抛错', async () => {
  const fetchJson = mockFetch([
    [/nav$/, navOk],
    [/arc\/search/, () => ({
      code: 0,
      data: { list: { vlist: [
        { bvid: 'BV1rHYx6fEzy', title: '走向灭亡', created: 1788951454, length: '02:53', pic: 'p1', description: 'desc1', author: '黑鸦Heya' },
        { bvid: '', title: '坏条目', created: 1, length: '00:10' },
      ] } },
    })],
  ])
  const list = await core.getUpVideos({ mid: '3706929260006322', cookie: 'c', fetchJson })
  assert.equal(list.length, 1)
  assert.deepEqual(list[0], { bvid: 'BV1rHYx6fEzy', title: '走向灭亡', pubdate: 1788951454, duration: 173, pic: 'p1', description: 'desc1', author: '黑鸦Heya' })

  const bad = mockFetch([[/nav$/, navOk], [/arc\/search/, () => ({ code: -352, message: '风控' })]])
  await assert.rejects(() => core.getUpVideos({ mid: '1', cookie: 'c', fetchJson: bad }), /投稿列表获取失败.*风控/)
})

// ---------- cid ----------

test('getCid：裸数组与 data.pages 两形态', async () => {
  const bare = mockFetch([[/pagelist/, () => ({ code: 0, data: [{ page: 1, cid: 41690009264 }] })]])
  assert.equal(await core.getCid({ bvid: 'BV1', cookie: 'c', fetchJson: bare }), 41690009264)
  const wrapped = mockFetch([[/pagelist/, () => ({ code: 0, data: { pages: [{ page: 1, cid: 777 }] } })]])
  assert.equal(await core.getCid({ bvid: 'BV1', cookie: 'c', fetchJson: wrapped }), 777)
  const empty = mockFetch([[/pagelist/, () => ({ code: 0, data: [] })]])
  assert.equal(await core.getCid({ bvid: 'BV1', cookie: 'c', fetchJson: empty }), null)
})

// ---------- 字幕 ----------

test('getSubtitle：无轨 / 接口错误 / 空文本 → null', async () => {
  const none = mockFetch([[/player\/v2/, () => ({ code: 0, data: { subtitle: { subtitles: [] } } })]])
  assert.equal(await core.getSubtitle({ bvid: 'BV1', cid: 1, fetchJson: none }), null)
  const err = mockFetch([[/player\/v2/, () => ({ code: -101, message: '未登录' })]])
  assert.equal(await core.getSubtitle({ bvid: 'BV1', cid: 1, fetchJson: err }), null)
  const blank = mockFetch([
    [/player\/v2/, () => subTrack()],
    [/aisubtitle/, () => ({ body: [] })],
  ])
  assert.equal(await core.getSubtitle({ bvid: 'BV1', cid: 1, fetchJson: blank }), null)
})

test('getSubtitle：中文轨优先 + // 补 https + 采纳可信字幕', async () => {
  const seen = []
  const fetchJson = async (url) => {
    seen.push(url)
    if (/player\/v2/.test(url)) {
      return { code: 0, data: { subtitle: { subtitles: [
        { lan: 'en-US', lan_doc: 'English', subtitle_url: '//aisubtitle.hdslb.com/en.json' },
        { lan: 'ai-zh', lan_doc: '中文', subtitle_url: '//aisubtitle.hdslb.com/zh.json' },
      ] } } }
    }
    return subBody([{ content: '大家晚上好', to: 3 }, { content: '欢迎收看今天的AI日报', to: 6 }])
  }
  const sub = await core.getSubtitle({ bvid: 'BV1', cid: 1, duration: 6, fetchJson })
  assert.equal(sub.rejected, undefined)
  assert.equal(sub.lang, '中文')
  assert.equal(sub.text, '大家晚上好 欢迎收看今天的AI日报')
  // 协议相对 URL 必须补 https:（否则 https.get 报 Invalid URL）
  assert.ok(seen.some(u => u === 'https://aisubtitle.hdslb.com/zh.json'), JSON.stringify(seen))
})

test('getSubtitle：时间轴远超视频时长 → 判不可信并给出原因', async () => {
  const fetchJson = mockFetch([
    [/player\/v2/, () => subTrack()],
    [/aisubtitle/, () => subBody([{ content: '又重生了', to: 756 }])],
  ])
  const sub = await core.getSubtitle({ bvid: 'BV1', cid: 1, duration: 39, fetchJson })
  assert.ok(sub.rejected, '应判不可信')
  assert.match(sub.rejected, /超出视频时长/)
})

// ---------- runBrief ----------

test('runBrief：字幕命中 → 采纳，不跑 python', async () => {
  const env = makeEnv()
  let pyCalled = 0
  const fetchJson = mockFetch([
    [/nav$/, navOk], [/view\?/, () => viewOk(15)], [/playurl/, playOk],
    [/pagelist/, () => ({ code: 0, data: [{ page: 1, cid: 1001 }] })],
    [/player\/v2/, () => subTrack()],
    [/aisubtitle/, () => subBody([{ content: '今天聊聊模型发布', to: 5 }])],
  ])
  const steps = []
  const r = await core.runBrief(
    { items: [{ bvid: 'BV1GJ411x7h7', title: '标题', duration: 15, upName: '黑鸦Heya' }], limit: 3 },
    { ...env.deps, fetchJson, conf: env.conf, runPythonImpl: async () => { pyCalled++; }, onStep: s => steps.push(s) },
  )
  assert.equal(r.fail.length, 0, JSON.stringify(r.fail))
  assert.equal(r.ok.length, 1)
  assert.equal(r.ok[0].source, 'subtitle')
  assert.equal(pyCalled, 0, '字幕命中不应触发转写')
  assert.ok(!steps.includes('转文字中'), JSON.stringify(steps))
  assert.equal(fs.readFileSync(r.ok[0].transcriptPath, 'utf8'), '今天聊聊模型发布')
  cleanupTranscripts(r)
})

test('runBrief：无字幕 → 回退转写（走 runBatch 缓存 + 打桩 python）', async () => {
  const env = makeEnv()
  env.seedCache('BV1GJ411x7h7', 1001, 'FAKE-VIDEO-BYTES')
  const fetchJson = mockFetch([
    [/nav$/, navOk], [/view\?/, () => viewOk(120)], [/playurl/, playOk],
    [/pagelist/, () => ({ code: 0, data: [{ page: 1, cid: 1001 }] })],
    [/player\/v2/, () => ({ code: 0, data: { subtitle: { subtitles: [] } } })],
  ])
  const steps = []
  const r = await core.runBrief(
    { items: [{ bvid: 'BV1GJ411x7h7', title: '标题', duration: 120 }], limit: 3 },
    {
      ...env.deps, fetchJson, conf: env.conf,
      runPythonImpl: stubRunPython('转录出来的正文。'),
      onStep: s => steps.push(s),
    },
  )
  assert.equal(r.ok.length, 1, JSON.stringify(r.fail))
  assert.equal(r.ok[0].source, 'transcript')
  assert.ok(steps.includes('转文字中'), JSON.stringify(steps))
  assert.equal(fs.readFileSync(r.ok[0].transcriptPath, 'utf8'), '转录出来的正文。')
  cleanupTranscripts(r)
})

test('runBrief：字幕存疑 → 回退转写并回报原因', async () => {
  const env = makeEnv()
  env.seedCache('BV1GJ411x7h7', 1001, 'FAKE')
  const fetchJson = mockFetch([
    [/nav$/, navOk], [/view\?/, () => viewOk(39)], [/playurl/, playOk],
    [/pagelist/, () => ({ code: 0, data: [{ page: 1, cid: 1001 }] })],
    [/player\/v2/, () => subTrack()],
    [/aisubtitle/, () => subBody([{ content: '错配字幕', to: 756 }])],
  ])
  const steps = []
  const r = await core.runBrief(
    { items: [{ bvid: 'BV1GJ411x7h7', title: '标题', duration: 39 }], limit: 3 },
    { ...env.deps, fetchJson, conf: env.conf, runPythonImpl: stubRunPython('真身正文。'), onStep: s => steps.push(s) },
  )
  assert.equal(r.ok.length, 1, JSON.stringify(r.fail))
  assert.equal(r.ok[0].source, 'transcript')
  assert.match(r.ok[0].subtitleRejected, /超出视频时长/)
  assert.ok(steps.includes('字幕存疑，改转写'), JSON.stringify(steps))
  assert.equal(fs.readFileSync(r.ok[0].transcriptPath, 'utf8'), '真身正文。')
  cleanupTranscripts(r)
})

test('runBrief：单条失败不阻断整批（风控条目入 fail，后续条目照跑）', async () => {
  const env = makeEnv()
  const fetchJson = mockFetch([
    [/nav$/, navOk],
    [/pagelist\?bvid=BVBAD/, () => ({ code: -352, message: '风控校验失败' })],
    [/pagelist/, () => ({ code: 0, data: [{ page: 1, cid: 1001 }] })],
    [/player\/v2/, () => subTrack()],
    [/aisubtitle/, () => subBody([{ content: '第二条正文', to: 4 }])],
  ])
  const r = await core.runBrief(
    { items: [
      { bvid: 'BVBAD', title: '坏的', duration: 30 },
      { bvid: 'BV1GJ411x7h7', title: '好的', duration: 12 },
    ], limit: 3 },
    { ...env.deps, fetchJson, conf: env.conf },
  )
  assert.equal(r.fail.length, 1)
  assert.equal(r.fail[0].bvid, 'BVBAD')
  assert.match(r.fail[0].reason, /分P信息获取失败/)
  assert.equal(r.ok.length, 1)
  assert.equal(r.ok[0].bvid, 'BV1GJ411x7h7')
  cleanupTranscripts(r)
})

test('runBrief：limit 生效（单轮只处理前 N 条）', async () => {
  const env = makeEnv()
  const fetchJson = mockFetch([
    [/nav$/, navOk],
    [/pagelist/, () => ({ code: 0, data: [{ page: 1, cid: 1001 }] })],
    [/player\/v2/, () => subTrack()],
    [/aisubtitle/, () => subBody([{ content: '正文', to: 3 }])],
  ])
  const items = ['BV1', 'BV2', 'BV3', 'BV4', 'BV5'].map((bvid, i) => ({ bvid, title: 't' + i, duration: 10 }))
  const r = await core.runBrief({ items, limit: 2 }, { ...env.deps, fetchJson, conf: env.conf })
  assert.equal(r.ok.length + r.fail.length, 2)
  cleanupTranscripts(r)
})

test('runBrief：items 为空 → 不抛错，返回空结果', async () => {
  const env = makeEnv()
  const r = await core.runBrief({ items: [] }, { ...env.deps, conf: env.conf })
  assert.deepEqual(r, { ok: [], fail: [] })
  const r2 = await core.runBrief({}, { ...env.deps, conf: env.conf })
  assert.deepEqual(r2, { ok: [], fail: [] })
})

// ---------- ups 发现模式（ADR-0119：发现也归本工具）----------

test('runBrief：ups 模式 → 拉投稿列表、剔除 known、只处理新 bvid', async () => {
  const env = makeEnv()
  const fetchJson = mockFetch([
    [/nav$/, navOk],
    [/arc\/search/, () => ({
      code: 0,
      data: { list: { vlist: [
        { bvid: 'BVNEW1', title: '新片一', created: 1789000000, length: '01:30', author: '黑鸦Heya' },
        { bvid: 'BVOLD1', title: '旧片', created: 1788900000, length: '02:00', author: '黑鸦Heya' },
        { bvid: 'BVNEW2', title: '新片二', created: 1788800000, length: '00:45', author: '黑鸦Heya' },
      ] } },
    })],
    [/pagelist/, () => ({ code: 0, data: [{ page: 1, cid: 1001 }] })],
    [/player\/v2/, () => subTrack()],
    [/aisubtitle/, () => subBody([{ content: '今日要点', to: 5 }])],
  ])
  const steps = []
  const r = await core.runBrief(
    { ups: ['3706929260006322'], known: ['BVOLD1'], backfill: 10, limit: 3 },
    { ...env.deps, fetchJson, conf: env.conf, onStep: s => steps.push(s) },
  )
  assert.equal(r.fail.length, 0, JSON.stringify(r.fail))
  assert.deepEqual(r.ok.map(o => o.bvid), ['BVNEW1', 'BVNEW2'])
  assert.equal(r.ok[0].upMid, '3706929260006322')
  assert.equal(r.ok[0].upName, '黑鸦Heya')
  assert.equal(r.ok[0].duration, 90)
  assert.ok(steps.includes('拉取投稿列表'), JSON.stringify(steps))
  cleanupTranscripts(r)
})

test('runBrief：ups 支持 {mid,name} 形态；投稿列表拉取失败记 fail 且不阻断', async () => {
  const env = makeEnv()
  const fetchJson = mockFetch([
    [/nav$/, navOk],
    [/arc\/search/, (url) => {
      if (url.includes('mid=BAD')) return { code: -352, message: '风控校验失败' }
      return { code: 0, data: { list: { vlist: [{ bvid: 'BVOK', title: '好片', created: 1789000000, length: '00:30', author: '' }] } } }
    }],
    [/pagelist/, () => ({ code: 0, data: [{ page: 1, cid: 1001 }] })],
    [/player\/v2/, () => subTrack()],
    [/aisubtitle/, () => subBody([{ content: '正文', to: 4 }])],
  ])
  const r = await core.runBrief(
    { ups: [{ mid: 'BAD' }, { mid: 'GOOD', name: '备用名' }], backfill: 5, limit: 3 },
    { ...env.deps, fetchJson, conf: env.conf },
  )
  assert.equal(r.fail.length, 1)
  assert.equal(r.fail[0].bvid, '')
  assert.match(r.fail[0].reason, /UP BAD 投稿列表拉取失败.*风控/)
  assert.equal(r.ok.length, 1)
  assert.equal(r.ok[0].upName, '备用名', '投稿列表无 author 时回退 ups 传入的 name')
  cleanupTranscripts(r)
})

test('runBrief：ups 模式 limit 生效（发现多于上限时只处理前 N 条）', async () => {
  const env = makeEnv()
  const vlist = ['BV1', 'BV2', 'BV3', 'BV4'].map((bvid, i) => ({ bvid, title: 't' + i, created: 1789000000 - i, length: '00:20', author: 'U' }))
  const fetchJson = mockFetch([
    [/nav$/, navOk],
    [/arc\/search/, () => ({ code: 0, data: { list: { vlist } } })],
    [/pagelist/, () => ({ code: 0, data: [{ page: 1, cid: 1001 }] })],
    [/player\/v2/, () => subTrack()],
    [/aisubtitle/, () => subBody([{ content: '正文', to: 4 }])],
  ])
  const r = await core.runBrief({ ups: ['1'], limit: 2, backfill: 10 }, { ...env.deps, fetchJson, conf: env.conf })
  assert.equal(r.ok.length + r.fail.length, 2)
  cleanupTranscripts(r)
})
