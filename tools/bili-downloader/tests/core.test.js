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
const core = require('../core')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-core-test-'))

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

test('buildFileName：裁切/压缩标记组合', () => {
  const base = { title: '测试视频', bv: 'BV1GJ411x7h7', trimmed: false, compressed: false, start: 0, end: 120, duration: 120, crf: null }
  assert.equal(core.buildFileName(base), '测试视频_BV1GJ411x7h7.mp4')
  assert.equal(core.buildFileName({ ...base, compressed: true, crf: 23 }), '测试视频_BV1GJ411x7h7_crf23.mp4')
  assert.equal(core.buildFileName({ ...base, trimmed: true, start: 10, end: 80 }), '测试视频_BV1GJ411x7h7_clip_00-10-01-20.mp4')
  assert.equal(core.buildFileName({ ...base, trimmed: true, start: 10, end: 80, compressed: true, crf: 18 }), '测试视频_BV1GJ411x7h7_clip_00-10-01-20_crf18.mp4')
  // 全片范围不算裁切
  assert.equal(core.buildFileName({ ...base, trimmed: true, start: 0, end: 120 }), '测试视频_BV1GJ411x7h7.mp4')
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

test('fmtDuration / fmtTime / fmtEta 格式化', () => {
  assert.equal(core.fmtDuration(65), '01:05')
  assert.equal(core.fmtDuration(3600), '60:00')
  assert.equal(core.fmtTime(65), '01-05')
  assert.equal(core.fmtEta(125), '02:05')
  assert.equal(core.fmtEta(-1), '?')
  assert.equal(core.fmtEta(NaN), '?')
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
  return { code: 0, data: { title: '测试视频', owner: { name: 'UP主' }, duration: 120, pic: 'https://i0.hdslb.com/bfs/archive/cover.jpg', cid: 1001 } }
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

// mock get：behavior(url) => {status, chunks} 或 Error（连接失败）
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
        res.resume = () => {}   // 真实 IncomingMessage 有此方法，非 2xx 分支会调用
        cb(res)
        if (b.status && b.status !== 200 && b.status !== 206) return res.emit('end')   // 非 2xx：resume 后尝试下一节点
        for (const c of b.chunks) res.emit('data', c)
        res.emit('end')
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
