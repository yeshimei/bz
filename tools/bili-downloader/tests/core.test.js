// ================================================================
// B站下载器 - 核心逻辑测试（node:test，零依赖）
// 纯函数 + mock 网络（wbi 签名、解析、CDN 节点切换）
// ================================================================
const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { EventEmitter } = require('events')
const { spawnSync } = require('child_process')
const core = require('../core')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-core-test-'))

// 真实 ffmpeg 集成测试条件（无 ffmpeg 时跳过，保证 CI/无二进制环境可跑）
const hasFfmpeg = (() => { try { return spawnSync('ffmpeg', ['-version']).status === 0 } catch { return false } })()

// ---------- 纯函数 ----------

test('extractBv：从各种链接提取 BV 号', () => {
  assert.equal(core.extractBv('https://www.bilibili.com/video/BV1GJ411x7h7/?spm_id_from=333.999'), 'BV1GJ411x7h7')
  assert.equal(core.extractBv('BV1GJ411x7h7'), 'BV1GJ411x7h7')
  assert.equal(core.extractBv('b23.tv/BV1GJ411x7h7'), 'BV1GJ411x7h7')
  assert.equal(core.extractBv('https://example.com/no-bv-here'), '')
})

test('sanitizeName：非法字符替换 + 长度截断', () => {
  assert.equal(core.sanitizeName('a/b\\c:d*e?f"g<h>i|j'), 'a_b_c_d_e_f_g_h_i_j')
  assert.equal(core.sanitizeName('  多个   空格  '), '多个 空格')
  assert.equal(core.sanitizeName('x'.repeat(200)).length, 80)
  assert.equal(core.sanitizeName('   '), '视频')
})

test('buildFileName：裁切/压缩标记组合（时间恒显小时位）', () => {
  const base = { title: '测试视频', bv: 'BV1GJ411x7h7', trimmed: false, compressed: false, start: 0, end: 120, duration: 120, crf: null }
  assert.equal(core.buildFileName(base), '测试视频_BV1GJ411x7h7.mp4')
  assert.equal(core.buildFileName({ ...base, compressed: true, crf: 23 }), '测试视频_BV1GJ411x7h7_crf23.mp4')
  assert.equal(core.buildFileName({ ...base, trimmed: true, start: 10, end: 80 }), '测试视频_BV1GJ411x7h7_clip_00-00-10-00-01-20.mp4')
  assert.equal(core.buildFileName({ ...base, trimmed: true, start: 10, end: 80, compressed: true, crf: 18 }), '测试视频_BV1GJ411x7h7_clip_00-00-10-00-01-20_crf18.mp4')
  // 全片范围不算裁切
  assert.equal(core.buildFileName({ ...base, trimmed: true, start: 0, end: 120 }), '测试视频_BV1GJ411x7h7.mp4')
  // 分P 文件名带 P 标记
  assert.equal(core.buildFileName({ ...base, page: 'P2', trimmed: true, start: 10, end: 80 }), '测试视频_BV1GJ411x7h7_P2_clip_00-00-10-00-01-20.mp4')
})

test('uniquePath：重名自动加序号', () => {
  const f = path.join(tmp, '重名.mp4')
  fs.writeFileSync(f, 'x')
  const f2 = core.uniquePath(f)
  assert.notEqual(f2, f)
  fs.writeFileSync(f2, 'x')
  const f3 = core.uniquePath(f)
  assert.equal(f3, path.join(tmp, '重名_3.mp4'))
})

test('fmtDuration / fmtTime / fmtSec / fmtEta 格式化（恒显小时位）', () => {
  assert.equal(core.fmtDuration(65), '00:01:05')
  assert.equal(core.fmtDuration(3600), '01:00:00')
  assert.equal(core.fmtDuration(6000), '01:40:00')
  assert.equal(core.fmtTime(65), '00-01-05')
  assert.equal(core.fmtTime(3600), '01-00-00')
  assert.equal(core.fmtSec(65.26), '65.3')
  assert.equal(core.fmtSec(3600), '3600')
  assert.equal(core.fmtEta(125), '02:05')
  assert.equal(core.fmtEta(-1), '?')
  assert.equal(core.fmtEta(NaN), '?')
})

test('parseTimeInput：HH:MM:SS.S / MM:SS / 裸秒 解析', () => {
  assert.equal(core.parseTimeInput('01:23:45'), 5025)
  assert.equal(core.parseTimeInput('01:23:45.6'), 5025.6)
  assert.equal(core.parseTimeInput('02:05'), 125)
  assert.equal(core.parseTimeInput('125'), 125)
  assert.equal(core.parseTimeInput(' 30.5 '), 30.5)
  assert.equal(core.parseTimeInput(''), null)
  assert.equal(core.parseTimeInput('abc'), null)
  assert.equal(core.parseTimeInput('1:2:3:4'), null)
  assert.equal(core.parseTimeInput('12:99'), 819)
})

test('qualityLabel：高度与帧率标签', () => {
  assert.equal(core.qualityLabel({ height: 2160, fps: 60 }), '4K 60帧')
  assert.equal(core.qualityLabel({ height: 1440 }), '2K')
  assert.equal(core.qualityLabel({ height: 1080, fps: 30 }), '1080P')
  assert.equal(core.qualityLabel({ height: 720, fps: 120 }), '720P 120帧')
})

test('wbi 签名：mixin key 与 w_rid 结构', () => {
  const mixin = core.getMixinKey('abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz')
  assert.equal(mixin.length, 32)
  const before = Date.now() / 1000
  const qs = core.wbiSign({ bvid: 'BV1GJ411x7h7', cid: 1 }, 'imgkey', 'subkey')
  const after = Date.now() / 1000
  assert.ok(qs.includes('w_rid='))
  const wts = parseInt(qs.match(/wts=(\d+)/)[1])
  assert.ok(wts >= Math.floor(before) && wts <= Math.ceil(after))
  assert.match(qs, /^bvid=/)
})

// ---------- JSON / Cookie 文件 ----------

test('readJson / writeJson：容错与写回', () => {
  const f = path.join(tmp, 'data.json')
  assert.deepEqual(core.readJson(f, { def: 1 }), { def: 1 })   // 不存在 → 默认
  core.writeJson(f, { a: 1 })
  assert.deepEqual(core.readJson(f, {}), { a: 1 })
  fs.writeFileSync(f, 'not json{{{')
  assert.deepEqual(core.readJson(f, 'fallback'), 'fallback')   // 损坏 → 默认
})

test('loadCookies / saveCookies：格式与容错', () => {
  const f = path.join(tmp, 'cookies.json')
  assert.equal(core.loadCookies(f), null)
  core.saveCookies(f, '  SESSDATA=abc; bili_jct=def  ')
  const saved = JSON.parse(fs.readFileSync(f, 'utf8'))
  assert.equal(saved.cookie, 'SESSDATA=abc; bili_jct=def')
  assert.ok(saved.savedAt)
  assert.equal(core.loadCookies(f), 'SESSDATA=abc; bili_jct=def')
})

// ---------- parseVideo（mock 网络）----------

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
function viewOk() {
  return {
    code: 0,
    data: {
      title: '测试视频', owner: { name: 'UP主' }, duration: 120, pic: 'https://i0.hdslb.com/bfs/archive/cover.jpg', cid: 1001,
      pages: [
        { cid: 1001, page: 1, part: 'P1 引子', duration: 120 },
        { cid: 1002, page: 2, part: 'P2 正片', duration: 90 },
      ],
    },
  }
}
function playOk() {
  return {
    code: 0,
    data: {
      dash: {
        video: [
          { height: 1080, codecs: 'avc1.640028', frameRate: 30000 / 1001, baseUrl: 'https://cdn1/v1080.m4s', backupUrl: [], size: 1000000 },
          { height: 1080, codecs: 'hevc', frameRate: 30000 / 1001, baseUrl: 'https://cdn1/v1080h.m4s', backupUrl: [], size: 800000 },
          { height: 720, codecs: 'avc1.64001f', frameRate: 30000 / 1001, baseUrl: 'https://cdn1/v720.m4s', backupUrl: [], size: 500000 },
        ],
        audio: [{ baseUrl: 'https://cdn1/a.m4s', backupUrl: [], size: 300000 }],
      },
    },
  }
}

test('parseVideo：成功解析（avc 优先，1080P 只留一个代表）', async () => {
  const fetchJson = mockFetch([
    [/nav$/, navOk],
    [/view\?/, viewOk],
    [/playurl/, playOk],
  ])
  const info = await core.parseVideo({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', fetchJson })
  assert.equal(info.title, '测试视频')
  assert.equal(info.uploader, 'UP主')
  assert.equal(info.duration, 120)
  assert.equal(info.bvid, 'BV1GJ411x7h7')
  assert.equal(info.cid, 1001)
  assert.equal(info.maxHeight, 1080)
  assert.equal(info.pages.length, 2)      // 分P 列表透出
  assert.equal(info.pages[0].cid, 1001)
  assert.equal(info.pages[1].cid, 1002)
  assert.equal(info.pages[1].title, 'P2 正片')
  assert.equal(info.pages[1].duration, 90)
  // 1080P 只保留 avc 代表
  assert.deepEqual(info.formats.map(f => f.height), [1080, 720])
})

test('parseVideo：无 BV 号直接报错（不触发网络）', async () => {
  let called = false
  const fetchJson = async () => { called = true }
  await assert.rejects(core.parseVideo({ url: 'https://example.com/x', fetchJson }), /无法从链接中识别 BV 号/)
  assert.equal(called, false)
})

test('parseVideo：view API 错误码抛出', async () => {
  const fetchJson = mockFetch([
    [/nav$/, navOk],
    [/view\?/, () => ({ code: -404, message: '啥都木有' })],
  ])
  await assert.rejects(core.parseVideo({ url: 'BV1GJ411x7h7', fetchJson }), /视频信息获取失败/)
})

test('parseVideo：无视频流报错', async () => {
  const fetchJson = mockFetch([
    [/nav$/, navOk],
    [/view\?/, viewOk],
    [/playurl/, () => ({ code: 0, data: { dash: { video: [], audio: [] } } })],
  ])
  await assert.rejects(core.parseVideo({ url: 'BV1GJ411x7h7', fetchJson }), /未找到可下载的视频流/)
})

// ---------- downloadStream（mock https.get：CDN 节点切换）----------

// mock get：behavior(url) => {status, headers?, chunks?, noEnd?} 或 Error（连接失败）
function mockGet(behavior) {
  return (url, opts, cb) => {
    const req = new EventEmitter()
    req.destroy = () => { req._destroyed = true }
    setTimeout(() => {
      try {
        const b = behavior(url, opts)
        if (b instanceof Error) return req.emit('error', b)
        const res = new EventEmitter()
        res.statusCode = b.status || 200
        res.headers = b.headers || {}
        res.resume = () => {}   // 真实 IncomingMessage 有此方法，非 2xx 分支会调用
        cb(res)
        if (b.status && b.status !== 200 && b.status !== 206) return res.emit('end')   // 非 2xx：resume 后尝试下一节点
        for (const c of b.chunks) res.emit('data', c)
        if (!b.noEnd) res.emit('end')   // noEnd=true 模拟死节点（连接着但永不结束）
      } catch (e) { req.emit('error', e) }
    }, 0)
    return req
  }
}

test('downloadStream：首节点失败自动切换备用节点', async () => {
  const out = path.join(tmp, 'dl1.m4s')
  const get = mockGet(url => {
    if (url.includes('cdn1')) return { status: 500 }
    return { status: 200, chunks: [Buffer.from('hello'), Buffer.from(' world')] }
  })
  const diag = []
  await core.downloadStream({
    urls: ['https://cdn1/v.m4s', 'https://cdn2/v.m4s'], outPath: out, referer: 'https://www.bilibili.com',
    onDiag: t => diag.push(t), get,
  })
  assert.equal(fs.readFileSync(out, 'utf8'), 'hello world')
  assert.ok(diag.some(t => t.includes('cdn1')))
  assert.ok(diag.some(t => t.includes('cdn2')))
})

test('downloadStream：连接失败切换节点', async () => {
  const out = path.join(tmp, 'dl2.m4s')
  const get = mockGet(url => {
    if (url.includes('cdn1')) return new Error('ECONNREFUSED')
    return { status: 206, chunks: [Buffer.from('ok')] }
  })
  await core.downloadStream({ urls: ['https://cdn1/v.m4s', 'https://cdn2/v.m4s'], outPath: out, referer: 'x', get })
  assert.equal(fs.readFileSync(out, 'utf8'), 'ok')
})

test('downloadStream：全部节点失败抛出', async () => {
  const out = path.join(tmp, 'dl3.m4s')
  const get = mockGet(() => ({ status: 500 }))
  await assert.rejects(
    core.downloadStream({ urls: ['https://cdn1/v.m4s', 'https://cdn2/v.m4s'], outPath: out, referer: 'x', get }),
    /所有 CDN 节点均失败/
  )
})

test('downloadStream：取消后立即中止（ABORTED 标志）', async () => {
  const out = path.join(tmp, 'dl4.m4s')
  core.resetAbort()
  core.abortAll()
  await assert.rejects(
    core.downloadStream({ urls: ['https://cdn1/v.m4s'], outPath: out, referer: 'x', get: mockGet(() => ({ status: 200, chunks: [] })) }),
    /已中止/
  )
  core.resetAbort()
})

test('downloadStream：拿不到总大小时 percent 为 null（不再假报固定 25%）', async () => {
  const out = path.join(tmp, 'dl-size.mp4')
  const progs = []
  await core.downloadStream({
    urls: ['https://cdn1/v.m4s'], outPath: out, referer: 'x',
    onProgress: p => progs.push(p),
    get: mockGet(() => ({ status: 200, chunks: [Buffer.from('hello'), Buffer.from(' world')] })),
  })
  assert.equal(fs.readFileSync(out, 'utf8'), 'hello world')
  assert.ok(progs.length > 0)
  for (const p of progs) assert.ok(p.percent === null, `percent 应 null（无总大小），实际 ${p.percent}`)
})

test('downloadStream：Content-Length 提供总大小 → 真进度到 100%', async () => {
  const out = path.join(tmp, 'dl-cl.mp4')
  const progs = []
  const data = Buffer.from('hello world')
  await core.downloadStream({
    urls: ['https://cdn1/v.m4s'], outPath: out, referer: 'x',
    onProgress: p => progs.push(p),
    get: mockGet(() => ({ status: 200, headers: { 'content-length': String(data.length) }, chunks: [data] })),
  })
  const last = progs[progs.length - 1]
  assert.ok(last != null)
  assert.equal(last.percent, 100)
  assert.equal(last.total, data.length)
})

test('downloadStream：长时间零字节(stall)才切换节点（慢速不再触发切换）', async () => {
  const out = path.join(tmp, 'dl-stall.mp4')
  const diag = []
  const get = mockGet(url => {
    if (url.includes('cdn1')) return { status: 200, chunks: [], noEnd: true }   // 假死节点：连接着但零字节
    return { status: 200, chunks: [Buffer.from('ok from cdn2')] }
  })
  await core.downloadStream({ urls: ['https://cdn1/v.m4s', 'https://cdn2/v.m4s'], outPath: out, referer: 'x', stallMs: 60, onDiag: t => diag.push(t), get })
  assert.equal(fs.readFileSync(out, 'utf8'), 'ok from cdn2')
  assert.ok(diag.some(t => t.includes('长时间无数据')), JSON.stringify(diag))
})

// ---------- 裁切/合并参数构造（bug #5 修复的关键：无输入级 -to）----------

test('buildTrimArgs：copy 用 -ss -t 且无输入级 -to；reencode 帧精确；faststart 按时长门控', () => {
  const copy = core.buildTrimArgs({ mode: 'copy', inPath: 'in.mp4', outPath: 'out.mp4', start: 10, end: 80 })
  assert.deepEqual(copy.slice(0, 7), ['-y', '-ss', '10', '-i', 'in.mp4', '-t', '70'])
  assert.ok(!copy.includes('-to'), 'copy 路径不得有 -to（输入级 -to 是长视频 bug 温床）')
  assert.ok(copy.includes('-c') && copy.includes('copy'))
  assert.ok(copy.includes('+faststart'), '短片段保留 +faststart')

  const re = core.buildTrimArgs({ mode: 'reencode', inPath: 'in.mp4', outPath: 'out.mp4', start: 10, end: 80, crf: 23 })
  assert.deepEqual(re.slice(0, 7), ['-y', '-i', 'in.mp4', '-ss', '10', '-to', '80'])
  assert.ok(re.includes('-c:v') && re.includes('libx264') && re.includes('-crf'))

  const big = core.buildTrimArgs({ mode: 'copy', inPath: 'in.mp4', outPath: 'out.mp4', start: 0, end: 4000, faststartMaxSec: 1800 })
  assert.ok(!big.includes('+faststart'), '超长片段省略 +faststart（避免超大 copy 输出 moov 回写失败）')
})

test('buildMergeArgs：copy 拼接与重编码拼接', () => {
  const c = core.buildMergeArgs({ mode: 'copy', listPath: 'l.txt', outPath: 'm.mp4', faststart: true })
  assert.deepEqual(c, ['-y', '-f', 'concat', '-safe', '0', '-i', 'l.txt', '-c', 'copy', '-movflags', '+faststart', 'm.mp4'])
  const r = core.buildMergeArgs({ mode: 'reencode', listPath: 'l.txt', outPath: 'm.mp4', crf: 28 })
  assert.ok(r.includes('libx264') && r.includes('28'))
  assert.deepEqual(r.slice(0, 6), ['-y', '-f', 'concat', '-safe', '0', '-i'])
})

// ---------- 真实 ffmpeg 集成（无 ffmpeg 环境自动跳过）----------

test('trimVideo：真实 ffmpeg 裁切（copy 优先 + 校验），时长正确', { skip: !hasFfmpeg }, async () => {
  const src = path.join(tmp, 'src.mp4')
  const r = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=64x64:rate=10', '-t', '3', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', src], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr || 'ffmpeg 生成源失败')
  const out = path.join(tmp, 'clip.mp4')
  const res = await core.trimVideo({ inPath: src, outPath: out, start: 0.5, end: 2.5, crf: null, totalMs: 2000 })
  assert.ok(res.mode === 'copy' || res.mode === 'reencode', `mode=${res.mode}`)
  const dur = await core.probeDuration(out)
  assert.ok(dur !== null && Math.abs(dur - 2) <= 0.5, `dur=${dur}`)
})

test('mergeSegments：真实 ffmpeg 拼接两段，总时长正确', { skip: !hasFfmpeg }, async () => {
  const src = path.join(tmp, 'src2.mp4')
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=64x64:rate=10', '-t', '3', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', src], { encoding: 'utf8' })
  const p1 = path.join(tmp, 'a.mp4'), p2 = path.join(tmp, 'b.mp4')
  await core.trimVideo({ inPath: src, outPath: p1, start: 0, end: 1, crf: null })
  await core.trimVideo({ inPath: src, outPath: p2, start: 1, end: 2, crf: null })
  const out = path.join(tmp, 'merged.mp4')
  const res = await core.mergeSegments({ files: [p1, p2], outPath: out, expectedSec: 2 })
  assert.ok(res.mode === 'copy' || res.mode === 'reencode', `mode=${res.mode}`)
  const dur = await core.probeDuration(out)
  assert.ok(dur !== null && Math.abs(dur - 2) <= 0.5, `dur=${dur}`)
})

// ---------- 视频缓存 / 文献笔记 / AI 直读（F1-F4 纯函数）----------

test('cacheKey：BV + cid + 清晰度 组合键', () => {
  assert.equal(core.cacheKey('BV1GJ411x7h7', 1001, 1080), 'BV1GJ411x7h7_1001_1080')
})

test('getCacheDir / cachePath：默认临时目录，设置覆盖', () => {
  assert.ok(core.getCacheDir({}).includes('bili-dl-cache'))
  assert.equal(core.getCacheDir({ cacheDir: 'D:/my-cache' }), 'D:/my-cache')
  assert.equal(core.cachePath({ cacheDir: 'D:/my-cache' }, 'k1'), path.join('D:/my-cache', 'k1.mp4'))
})

test('cleanupCache：只删超期原件，保留新文件；目录不存在返回 0', () => {
  const dir = path.join(tmp, 'cache')
  fs.mkdirSync(dir, { recursive: true })
  const oldF = path.join(dir, 'old.mp4'), fresh = path.join(dir, 'fresh.mp4')
  fs.writeFileSync(oldF, 'x'); fs.writeFileSync(fresh, 'x')
  const now = Date.now()
  fs.utimesSync(oldF, new Date(now - 8 * 86400000), new Date(now - 8 * 86400000))
  fs.utimesSync(fresh, new Date(now), new Date(now))
  assert.equal(core.cleanupCache({ cacheDir: dir, cacheRetentionDays: 7 }, now), 1)
  assert.ok(!fs.existsSync(oldF))
  assert.ok(fs.existsSync(fresh))
  assert.equal(core.cleanupCache({ cacheDir: path.join(tmp, 'no-such-dir') }), 0)
})

test('sanitizeMdTitle：非法字符清洗 + 截断 50 + 空兜底', () => {
  assert.equal(core.sanitizeMdTitle('a/b\\c:d'), 'a_b_c_d')
  assert.equal(core.sanitizeMdTitle('x'.repeat(200)).length, 50)
  assert.equal(core.sanitizeMdTitle('   '), '文献笔记')
})

test('chunkTranscript：按句边界切块、单块不超上限、内容保序不丢失', () => {
  const t = Array.from({ length: 200 }, (_, i) => `第${i}句。`).join('')
  const chunks = core.chunkTranscript(t, 400)
  assert.ok(chunks.length > 1)
  for (const c of chunks) assert.ok(c.length <= 400, `块长 ${c.length} 超限`)
  assert.equal(chunks.join(''), t)
})

test('chunkTranscript：超长单句硬切 / 空输入', () => {
  const long = '啊'.repeat(600)
  const chunks = core.chunkTranscript(long, 400)
  assert.ok(chunks.length >= 2)
  for (const c of chunks) assert.ok(c.length <= 400)
  assert.equal(chunks.join('').length, 600)
  assert.deepEqual(core.chunkTranscript(''), [])
})

test('buildLiteratureNote：frontmatter 七键 + 引号转义 + 逐段「正文+双链」块连排', () => {
  const md = core.buildLiteratureNote({
    title: '讲"述"', tags: ['科普', 'AI 前沿'], summary: '一句话',
    url: 'https://www.bilibili.com/video/BV1GJ411x7h7', date: '2026-08-25 10:00:00',
    author: 'UP主', videoTitle: '视频原标题',
    blocks: [
      '![[CONFIG/APPENDIX/a.mp4]]',
      { text: '段一润色。', wiki: '![[CONFIG/APPENDIX/b.mp4]]' },
    ],
  })
  assert.ok(md.startsWith('---\n'))
  assert.ok(md.includes('\n---\n'))
  assert.ok(md.includes('title: "讲\\"述\\""'))
  assert.ok(md.includes('  - "科普"\n  - "AI 前沿"'))
  assert.ok(md.includes('summary: "一句话"'))
  assert.ok(md.includes('url: "https://www.bilibili.com/video/BV1GJ411x7h7"'))
  assert.ok(md.includes('date: "2026-08-25 10:00:00"'))
  assert.ok(md.includes('author: "UP主"'))
  assert.ok(md.includes('videoTitle: "视频原标题"'))
  // 字符串块兼容 = 纯双链行；对象块 = 该段正文在上、双链在下
  assert.ok(md.includes('![[CONFIG/APPENDIX/a.mp4]]'))
  assert.ok(md.includes('段一润色。\n\n![[CONFIG/APPENDIX/b.mp4]]'))
})

test('loadBzAiConfig：opencode-go 默认 + 未写 aiProvider 走默认', () => {
  const vault = path.join(tmp, 'vault-ai')
  const dir = path.join(vault, '.obsidian', 'plugins', 'bz')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify({ aiProvider: 'opencode-go', opencodeGoApiKey: 'k1' }))
  const ai = core.loadBzAiConfig({ vaultPath: vault })
  assert.equal(ai.provider, 'opencode-go')
  assert.equal(ai.apiKey, 'k1')
  assert.equal(ai.model, 'deepseek-v4-flash')
  assert.ok(ai.endpoint.includes('opencode.ai'))
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify({ opencodeGoApiKey: 'k1' }))
  assert.equal(core.loadBzAiConfig({ vaultPath: vault }).provider, 'opencode-go')
})

test('loadBzAiConfig：deepseek 走 deepseekApiKey', () => {
  const vault = path.join(tmp, 'vault-ai-ds')
  const dir = path.join(vault, '.obsidian', 'plugins', 'bz')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify({ aiProvider: 'deepseek', deepseekApiKey: 'k2' }))
  const ai = core.loadBzAiConfig({ vaultPath: vault })
  assert.equal(ai.apiKey, 'k2')
  assert.ok(ai.endpoint.includes('api.deepseek.com'))
})

test('loadBzAiConfig：缺 key / 缺文件 / 缺 vaultPath 报错文案', () => {
  const vault = path.join(tmp, 'vault-ai-nokey')
  const dir = path.join(vault, '.obsidian', 'plugins', 'bz')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify({ aiProvider: 'opencode-go' }))
  assert.throws(() => core.loadBzAiConfig({ vaultPath: vault }), /AI 密钥缺失/)
  assert.throws(() => core.loadBzAiConfig({ vaultPath: path.join(tmp, 'vault-ai-empty') }), /找不到 bz 插件数据文件/)
  assert.throws(() => core.loadBzAiConfig({}), /未配置 vaultPath/)
})

// ---------- aiChat / aiJson（mock https.request，零网络）----------

function mockHttpsRequest(resp, captured) {
  return (url, opts, cb) => {
    const req = new EventEmitter()
    let body = ''
    req.write = c => { body += c; if (captured) captured({ url, opts, body }) }
    req.end = () => setTimeout(() => {
      const res = new EventEmitter()
      res.statusCode = resp.status || 200
      cb(res)
      if (resp.body !== undefined) res.emit('data', Buffer.from(JSON.stringify(resp.body)))
      res.emit('end')
    }, 0)
    return req
  }
}

test('aiChat：POST chat/completions 解析 content，带鉴权头', async () => {
  const calls = []
  const requestImpl = mockHttpsRequest({ status: 200, body: { choices: [{ message: { content: 'ok' } }] } }, c => calls.push(c))
  const out = await core.aiChat({ endpoint: 'https://api.deepseek.com/', apiKey: 'k', model: 'm', messages: [{ role: 'user', content: 'hi' }], requestImpl })
  assert.equal(out, 'ok')
  assert.equal(calls[0].url, 'https://api.deepseek.com/chat/completions')
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer k')
  const sent = JSON.parse(calls[0].body)
  assert.equal(sent.model, 'm')
  assert.equal(sent.messages[0].content, 'hi')
})

test('aiChat：HTTP 4xx/5xx 抛错误文案（OpenAI 与 opencode 嵌套格式）', async () => {
  await assert.rejects(
    core.aiChat({ endpoint: 'https://x', apiKey: 'k', model: 'm', messages: [], requestImpl: mockHttpsRequest({ status: 401, body: { error: { message: 'bad key' } } }) }),
    /AI 请求失败：bad key/
  )
  await assert.rejects(
    core.aiChat({ endpoint: 'https://x', apiKey: 'k', model: 'm', messages: [], requestImpl: mockHttpsRequest({ status: 500, body: { error: { type: 'x', error: { message: 'server down' } } } }) }),
    /AI 请求失败：server down/
  )
})

test('aiChat：超时销毁转错误', async () => {
  const requestImpl = (url, opts, cb) => {
    const req = new EventEmitter()
    req.write = () => {}
    req.end = () => {}
    req.destroy = e => { req.emit('error', e) }
    setTimeout(() => req.emit('timeout'), 5)
    return req
  }
  await assert.rejects(core.aiChat({ endpoint: 'https://x', apiKey: 'k', model: 'm', messages: [], timeoutMs: 5, requestImpl }), /AI 请求超时/)
})

test('aiJson：JSON 模式解析 + 残留文本容错提取', async () => {
  const ok = await core.aiJson({ endpoint: 'https://x', apiKey: 'k', model: 'm', messages: [], requestImpl: mockHttpsRequest({ status: 200, body: { choices: [{ message: { content: '{"title":"标题","tags":["a"]}' } }] } }) })
  assert.deepEqual(ok, { title: '标题', tags: ['a'] })
  const fuzzy = await core.aiJson({ endpoint: 'https://x', apiKey: 'k', model: 'm', messages: [], requestImpl: mockHttpsRequest({ status: 200, body: { choices: [{ message: { content: '好的，结果如下：{"title":"T"}' } }] } }) })
  assert.equal(fuzzy.title, 'T')
})

test('aiJson：剥 markdown 代码围栏后解析（``````json … ```````，ADR-0067 自愈）', async () => {
  const out = await core.aiJson({
    endpoint: 'https://x', apiKey: 'k', model: 'm', messages: [],
    requestImpl: mockHttpsRequest({ status: 200, body: { choices: [{ message: { content: '```json\n{"title":"围栏标题","tags":["b"]}\n```' } }] } }),
  })
  assert.deepEqual(out, { title: '围栏标题', tags: ['b'] })
})

test('aiJson：非 JSON 自动重试一次；两次失败才抛「AI 返回的不是 JSON」（ADR-0067）', async () => {
  let n = 0
  const requestImpl = (url, opts, cb) => {
    const req = new EventEmitter()
    req.write = () => {}
    req.end = () => setTimeout(() => {
      const res = new EventEmitter()
      res.statusCode = 200
      cb(res)
      n++
      // 第 1 次返回噪音、第 2 次合法 JSON → 自愈
      res.emit('data', Buffer.from(JSON.stringify({ choices: [{ message: { content: n === 1 ? '抱歉我无法理解' : '{"title":"重试成功"}' } }] })))
      res.emit('end')
    }, 0)
    return req
  }
  const ok = await core.aiJson({ endpoint: 'https://x', apiKey: 'k', model: 'm', messages: [], requestImpl })
  assert.equal(ok.title, '重试成功')
  assert.equal(n, 2)
  // 两次都失败 → 报错并带内容片段
  await assert.rejects(
    core.aiJson({ endpoint: 'https://x', apiKey: 'k', model: 'm', messages: [], requestImpl: mockHttpsRequest({ status: 200, body: { choices: [{ message: { content: '纯文本噪音' } }] } }) }),
    /AI 返回的不是 JSON：纯文本噪音/
  )
})

test('buildLiteratureNote：多块「该段正文+该段双链」依次排布（无独立原文段）', () => {
  const md = core.buildLiteratureNote({
    title: 'T', tags: ['a'], summary: 's',
    url: 'u', date: 'd', author: 'a', videoTitle: 'v',
    blocks: [
      { text: '第一段润色', wiki: '![[CONFIG/APPENDIX/a.mp4]]' },
      { text: '第二段润色', wiki: '![[CONFIG/APPENDIX/b.mp4]]' },
    ],
  })
  const iA = md.indexOf('![[CONFIG/APPENDIX/a.mp4]]')
  const iB = md.indexOf('![[CONFIG/APPENDIX/b.mp4]]')
  assert.ok(md.includes('第一段润色\n\n![[CONFIG/APPENDIX/a.mp4]]'))
  assert.ok(md.includes('第二段润色\n\n![[CONFIG/APPENDIX/b.mp4]]'))
  assert.ok(iA > -1 && iB > iA)                       // 段一双链在段二之前
  assert.ok(md.indexOf('第二段润色') > iA && md.indexOf('第二段润色') < iB)   // 段二正文夹在段一双链与段二双链之间
  // 空正文块 → 只落双链
  const md2 = core.buildLiteratureNote({ title: 'T', url: '', blocks: [{ text: '', wiki: '![[x.mp4]]' }] })
  assert.ok(md2.includes('![[x.mp4]]'))
})

test('parseTranscriptUnits：同文件多行聚合 + 文件结束空哨兵（逐段转录协议，ticket 117）', () => {
  const units = core.parseTranscriptUnits([
    '\x1eC:\\a.mp4\x1f第一段文本\x1f',
    '\x1eC:\\a.mp4\x1f第二段文本\x1f',
    '\x1eC:\\a.mp4\x1f\x1f',                  // 完成哨兵：不计文本、不新增条目
    '前导噪声行',
    '',
    '\x1eC:\\b.mp4\x1f第三段文本\x1f',
    '\x1eD:\\c.mp4\x1f\x1f',                  // 仅哨兵（整文件无文本）→ 不产生条目
    '\x1eC:\\b.mp4\x1f\x1f',
  ].join('\n'))
  assert.equal(units.length, 2)
  assert.equal(units[0].file, 'C:\\a.mp4')
  assert.equal(units[0].text, '第一段文本 第二段文本')
  assert.equal(units[1].file, 'C:\\b.mp4')
  assert.equal(units[1].text, '第三段文本')
  assert.deepEqual(core.parseTranscriptUnits(''), [])
  assert.deepEqual(core.parseTranscriptUnits('abc\n'), [])
})
