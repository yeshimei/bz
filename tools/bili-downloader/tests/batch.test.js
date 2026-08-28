// ================================================================
// B站下载器 - 无头批处理（runBatch）测试（node:test，零依赖）
// 注入手法与 core.test.js 一致：mockFetch 覆盖 parse 网络链路；
// runPythonImpl / aiJsonImpl / aiChatImpl 打桩；缓存预置绕开真实下载
// （与 server.test.js 的缓存命中用例同思路）；剪辑路径用真实 ffmpeg
// （无二进制环境自动跳过）。
// ================================================================
const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const core = require('../core')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-batch-test-'))

// 真实 ffmpeg 集成测试条件（无 ffmpeg 时跳过，保证 CI/无二进制环境可跑）
const hasFfmpeg = (() => { try { return spawnSync('ffmpeg', ['-version']).status === 0 } catch { return false } })()

// ---------- 网络 mock（parse 链路：nav / view / playurl）----------

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
      title: '批处理测试视频', owner: { name: 'UP主' }, duration: 120, pic: 'https://i0.hdslb.com/bfs/archive/cover.jpg', cid: 1001,
      pages: [{ cid: 1001, page: 1, part: '', duration: 120 }],
    },
  }
}
function playOk() {
  return {
    code: 0,
    data: {
      dash: {
        video: [{ height: 1080, codecs: 'avc1.640028', frameRate: 30000 / 1001, baseUrl: 'https://cdn1/v.m4s', backupUrl: [], size: 1000000 }],
        audio: [{ baseUrl: 'https://cdn1/a.m4s', backupUrl: [], size: 300000 }],
      },
    },
  }
}
const fetchJson = mockFetch([[/nav$/, navOk], [/view\?/, viewOk], [/playurl/, playOk]])

// 打桩 runPython：按逐段协议吐文本 + 完成哨兵（\x1e<file>\x1f<text>\x1f / \x1e<file>\x1f\x1f）
function stubRunPython(text) {
  return async ({ args, onChunk }) => {
    onChunk(`\x1e${args[1]}\x1f${text}\x1f\n\x1e${args[1]}\x1f\x1f\n`)
  }
}

// ---------- 临时 vault + 配置环境 ----------

function makeEnv(over = {}) {
  const vault = path.join(tmp, 'vault-' + Math.random().toString(36).slice(2))
  const outDir = path.join(vault, 'CONFIG', 'APPENDIX')
  const bzDir = path.join(vault, '.obsidian', 'plugins', 'bz')
  fs.mkdirSync(bzDir, { recursive: true })
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(bzDir, 'data.json'), JSON.stringify({ aiProvider: 'opencode-go', opencodeGoApiKey: 'test-key' }))
  const cacheDir = path.join(tmp, 'cache-' + Math.random().toString(36).slice(2))
  fs.mkdirSync(cacheDir, { recursive: true })
  const env = {
    conf: {
      vaultPath: vault, outputDir: outDir, literatureFolder: '文献盒',
      cacheDir, cacheRetentionDays: 7,
      ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe',
      pythonPath: 'py-stub', whisperModel: 'small',
    },
    vault, outDir,
    deps: {
      fetchJson,
      runPythonImpl: stubRunPython('模拟转录文本。这是要润色的内容。'),
      aiJsonImpl: async () => ({ title: '批处理文献', tags: ['科技', 'AI'], summary: '一句话简介' }),
      aiChatImpl: async () => '润色后的正文。',
    },
    seedCache(content) {
      const cached = core.cachePath(env.conf, core.cacheKey('BV1GJ411x7h7', 1001, 1080))
      fs.mkdirSync(path.dirname(cached), { recursive: true })
      fs.writeFileSync(cached, content)
    },
  }
  Object.assign(env.conf, over.conf || {})
  Object.assign(env.deps, over.deps || {})
  return env
}

// ---------- 用例 ----------

test('runBatch：整片全流程（start/end 为 null）→ 交付 + 文献笔记 + vault 相对路径，无「剪辑中」', async () => {
  const env = makeEnv()
  env.seedCache('FAKE-VIDEO-BYTES')
  const steps = []
  const r = await core.runBatch({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', start: null, end: null }, {
    ...env.deps, conf: env.conf, onStep: s => steps.push(s),
  })
  // 步骤行：无剪辑
  assert.deepEqual(steps, ['解析中', '下载中', '转文字中', 'AI 生成文献笔记中'])
  // 结果字段：vault 相对路径
  assert.equal(r.note, '文献盒/批处理文献.md')
  assert.equal(r.video, 'CONFIG/APPENDIX/批处理测试视频_BV1GJ411x7h7.mp4')
  // 交付文件落盘
  assert.ok(fs.existsSync(path.join(env.outDir, '批处理测试视频_BV1GJ411x7h7.mp4')))
  // 笔记：frontmatter 七键 + 润色正文 + 视频双链
  const md = fs.readFileSync(path.join(env.vault, r.note), 'utf8')
  assert.ok(md.startsWith('---\n'))
  assert.ok(md.includes('title: "批处理文献"'))
  assert.ok(md.includes('  - "科技"\n  - "AI"'))
  assert.ok(md.includes('summary: "一句话简介"'))
  assert.ok(md.includes('url: "https://www.bilibili.com/video/BV1GJ411x7h7"'))
  assert.ok(md.includes('author: "UP主"'))
  assert.ok(md.includes('videoTitle: "批处理测试视频"'))
  assert.ok(md.includes('润色后的正文。\n\n![[CONFIG/APPENDIX/批处理测试视频_BV1GJ411x7h7.mp4]]'))
})

test('runBatch：起止有值 → 剪辑（剪辑中 step + _clip_ 文件名 + X 秒产物）', { skip: !hasFfmpeg }, async () => {
  // 真实 ffmpeg 造 3s 源，塞进缓存充当「下载原件」
  const src = path.join(tmp, 'batch-src-' + Date.now() + '.mp4')
  const r0 = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=64x64:rate=10', '-t', '3', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', src], { encoding: 'utf8' })
  assert.equal(r0.status, 0, r0.stderr || 'ffmpeg 生成源失败')
  const env = makeEnv()
  env.seedCache(fs.readFileSync(src))
  const steps = []
  const r = await core.runBatch({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', start: '0:01', end: '0:02' }, {
    ...env.deps, conf: env.conf, onStep: s => steps.push(s),
  })
  assert.ok(steps.includes('剪辑中'), JSON.stringify(steps))
  assert.ok(r.video.includes('_clip_00-00-01-00-00-02'), r.video)
  // 交付件可被 ffprobe 读出时长（copy 校验通过）
  const dur = await core.probeDuration(path.join(env.outDir, path.basename(r.video)))
  assert.ok(dur !== null && Math.abs(dur - 1) <= 0.5, `dur=${dur}`)
})

test('runBatch：起止非法格式报错（parseTimeInput 拒绝）', async () => {
  const env = makeEnv()
  env.seedCache('FAKE')
  await assert.rejects(
    core.runBatch({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', start: 'abc', end: '0:02' }, { ...env.deps, conf: env.conf }),
    /起止时间格式错误/
  )
})

test('runBatch：whisper 失败 → 报错含 faster-whisper 环境引导', async () => {
  const env = makeEnv()
  env.seedCache('FAKE')
  await assert.rejects(
    core.runBatch({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', start: null, end: null }, {
      ...env.deps, conf: env.conf,
      runPythonImpl: async () => { throw new Error('模拟 python 启动失败') },
    }),
    /转文字失败：模拟 python 启动失败（请确认 faster-whisper 环境已安装/
  )
})

test('runBatch：AI 缺 key → loadBzAiConfig 既有报错引导到 bz 设置', async () => {
  const vault = path.join(tmp, 'vault-nokey-' + Math.random().toString(36).slice(2))
  const bzDir = path.join(vault, '.obsidian', 'plugins', 'bz')
  fs.mkdirSync(bzDir, { recursive: true })
  fs.writeFileSync(path.join(bzDir, 'data.json'), JSON.stringify({ aiProvider: 'opencode-go' }))   // 无 opencodeGoApiKey
  const cacheDir = path.join(tmp, 'cache-nokey-' + Math.random().toString(36).slice(2))
  fs.mkdirSync(cacheDir, { recursive: true })
  const conf = {
    vaultPath: vault, outputDir: path.join(vault, 'CONFIG', 'APPENDIX'), literatureFolder: '文献盒',
    cacheDir, ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe', pythonPath: 'py', whisperModel: 'small',
  }
  fs.mkdirSync(conf.outputDir, { recursive: true })
  const cached = core.cachePath(conf, core.cacheKey('BV1GJ411x7h7', 1001, 1080))
  fs.mkdirSync(path.dirname(cached), { recursive: true })
  fs.writeFileSync(cached, 'FAKE')
  await assert.rejects(
    core.runBatch({ url: 'BV1GJ411x7h7', start: null, end: null }, {
      conf, fetchJson,
      runPythonImpl: stubRunPython('文本。'), aiJsonImpl: async () => ({}), aiChatImpl: async () => 'x',
    }),
    /AI 密钥缺失/
  )
})

test('runBatch：重名不覆盖（笔记与视频都加序号，原文件不动）', async () => {
  const env = makeEnv()
  env.seedCache('FAKE')
  const deps = { ...env.deps, conf: env.conf }
  const r1 = await core.runBatch({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', start: null, end: null }, deps)
  const r2 = await core.runBatch({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', start: null, end: null }, deps)
  assert.equal(r1.note, '文献盒/批处理文献.md')
  assert.equal(r2.note, '文献盒/批处理文献_2.md')
  assert.equal(r1.video, 'CONFIG/APPENDIX/批处理测试视频_BV1GJ411x7h7.mp4')
  assert.equal(r2.video, 'CONFIG/APPENDIX/批处理测试视频_BV1GJ411x7h7_2.mp4')
  // 第一份不被覆写
  const md1 = fs.readFileSync(path.join(env.vault, r1.note), 'utf8')
  assert.ok(md1.includes('title: "批处理文献"'))
})

test('runBatch：交付目录不在 vault 下 → video 退化为绝对路径（note 仍相对）', async () => {
  const env = makeEnv()
  env.seedCache('FAKE')
  const outside = path.join(tmp, 'outside-' + Math.random().toString(36).slice(2))
  fs.mkdirSync(outside, { recursive: true })
  const r = await core.runBatch({ url: 'BV1GJ411x7h7', start: null, end: null }, {
    ...env.deps, conf: { ...env.conf, outputDir: outside },
  })
  assert.equal(r.video, path.resolve(outside, '批处理测试视频_BV1GJ411x7h7.mp4'))
  assert.equal(r.note, '文献盒/批处理文献.md')
})

test('runBatch：缓存未命中且下载失败 → 报错（get 注入连接失败）', async () => {
  const env = makeEnv()   // 不预置缓存
  const { EventEmitter } = require('events')
  const get = () => {
    const req = new EventEmitter()
    req.destroy = () => {}
    process.nextTick(() => req.emit('error', new Error('ECONNREFUSED')))
    return req
  }
  await assert.rejects(
    core.runBatch({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', start: null, end: null }, {
      ...env.deps, conf: env.conf, get,
    }),
    /所有 CDN 节点均失败/
  )
})