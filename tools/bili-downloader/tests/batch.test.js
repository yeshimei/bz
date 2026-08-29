// ================================================================
// B站下载器 - 无头批处理（runBatch）测试（node:test，零依赖）
// ticket 136：AI/文献笔记已回迁 bz 插件，批处理只产出「转录临时文件 + 视频交付」。
// 注入手法与 core.test.js 一致：mockFetch 覆盖 parse 网络链路；runPythonImpl 打桩；
// 缓存预置绕开真实下载；剪辑/压缩路径用真实 ffmpeg（无二进制环境自动跳过）。
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
      pages: [
        { cid: 1001, page: 1, part: '开篇', duration: 120 },
        { cid: 1002, page: 2, part: '中段', duration: 120 },
        { cid: 1003, page: 3, part: '收尾', duration: 120 },
      ],
    },
  }
}
function viewOk3() {
  return {
    code: 0,
    data: {
      title: '批处理测试视频', owner: { name: 'UP主' }, duration: 3, pic: 'https://i0.hdslb.com/bfs/archive/cover.jpg', cid: 1001,
      pages: [{ cid: 1001, page: 1, part: '开篇', duration: 3 }],
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
  fs.mkdirSync(outDir, { recursive: true })
  const cacheDir = path.join(tmp, 'cache-' + Math.random().toString(36).slice(2))
  fs.mkdirSync(cacheDir, { recursive: true })
  const env = {
    conf: {
      vaultPath: vault, outputDir: outDir,
      cacheDir, cacheRetentionDays: 7,
      ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe',
      pythonPath: 'py-stub', whisperModel: 'small',
    },
    vault, outDir,
    deps: {
      fetchJson,
      runPythonImpl: stubRunPython('模拟转录文本。这是要交给插件的内容。'),
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

// 清理转录临时文件（测试自产自清）
function cleanTranscript(r) {
  if (r && r.transcript) { try { fs.unlinkSync(r.transcript) } catch {} }
}

// ---------- 用例 ----------

test('runBatch：整片全流程（compress=false）→ 转录临时文件 + 交付，无剪辑无压缩不写笔记', async () => {
  const env = makeEnv()
  env.seedCache('FAKE-VIDEO-BYTES')
  const steps = []
  const r = await core.runBatch({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', start: null, end: null, options: { compress: false } }, {
    ...env.deps, conf: env.conf, onStep: s => steps.push(s),
  })
  assert.deepEqual(steps, ['解析中', '下载中', '转文字中', '交付中'])
  // 交付：vault 相对路径 + 文件落盘
  assert.equal(r.video, 'CONFIG/APPENDIX/批处理测试视频_BV1GJ411x7h7.mp4')
  assert.ok(fs.existsSync(path.join(env.outDir, '批处理测试视频_BV1GJ411x7h7.mp4')))
  // 转录临时文件：绝对路径、存在、UTF-8 全文
  assert.ok(path.isAbsolute(r.transcript), r.transcript)
  assert.equal(r.transcriptPath, r.transcript)
  assert.equal(fs.readFileSync(r.transcript, 'utf8'), '模拟转录文本。这是要交给插件的内容。')
  // 不写文献笔记（AI/笔记回迁 bz）
  assert.equal(r.note, undefined)
  assert.ok(!fs.existsSync(path.join(env.vault, '文献盒')))
  cleanTranscript(r)
})

test('runBatch：压缩默认开 → 步骤含「压缩中」，交付文件名带 _crf23', { skip: !hasFfmpeg }, async () => {
  const src = path.join(tmp, 'batch-compress-src-' + Date.now() + '.mp4')
  const r0 = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=64x64:rate=10', '-t', '3', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', src], { encoding: 'utf8' })
  assert.equal(r0.status, 0, r0.stderr || 'ffmpeg 生成源失败')
  const env = makeEnv()
  env.seedCache(fs.readFileSync(src))
  // 真实源只有 3s：用 duration=3 的 view mock，使压缩校验（expectedSec=源时长）通过
  const deps = { ...env.deps, fetchJson: mockFetch([[/nav$/, navOk], [/view\?/, viewOk3], [/playurl/, playOk]]) }
  const steps = []
  const r = await core.runBatch({ url: 'BV1GJ411x7h7', start: null, end: null }, { ...deps, conf: env.conf, onStep: s => steps.push(s) })
  assert.ok(steps.includes('压缩中'), JSON.stringify(steps))
  assert.ok(steps.includes('转文字中'), JSON.stringify(steps))
  assert.ok(r.video.includes('_crf23'), r.video)
  cleanTranscript(r)
})

test('runBatch：compress=false → 无「压缩中」步骤', async () => {
  const env = makeEnv()
  env.seedCache('FAKE')
  const steps = []
  const r = await core.runBatch({ url: 'BV1GJ411x7h7', start: null, end: null, options: { compress: false } }, { ...env.deps, conf: env.conf, onStep: s => steps.push(s) })
  assert.ok(!steps.includes('压缩中'), JSON.stringify(steps))
  cleanTranscript(r)
})

test('runBatch：起止有值 → 剪辑（剪辑中 + _clip_ 文件名 + 时长正确），compress=false', { skip: !hasFfmpeg }, async () => {
  const src = path.join(tmp, 'batch-clip-src-' + Date.now() + '.mp4')
  const r0 = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=64x64:rate=10', '-t', '3', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', src], { encoding: 'utf8' })
  assert.equal(r0.status, 0, r0.stderr || 'ffmpeg 生成源失败')
  const env = makeEnv()
  env.seedCache(fs.readFileSync(src))
  const steps = []
  const r = await core.runBatch({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', start: '0:01', end: '0:02', options: { compress: false } }, {
    ...env.deps, conf: env.conf, onStep: s => steps.push(s),
  })
  assert.ok(steps.includes('剪辑中'), JSON.stringify(steps))
  assert.ok(r.video.includes('_clip_00-00-01-00-00-02'), r.video)
  const dur = await core.probeDuration(path.join(env.outDir, path.basename(r.video)))
  assert.ok(dur !== null && Math.abs(dur - 1) <= 0.5, `dur=${dur}`)
  cleanTranscript(r)
})

test('runBatch：剪辑 + 压缩同时开 → 步骤含 剪辑中+压缩中，文件名 _clip_..._crf23', { skip: !hasFfmpeg }, async () => {
  const src = path.join(tmp, 'batch-clip-cmp-src-' + Date.now() + '.mp4')
  const r0 = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=64x64:rate=10', '-t', '3', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', src], { encoding: 'utf8' })
  assert.equal(r0.status, 0, r0.stderr || 'ffmpeg 生成源失败')
  const env = makeEnv()
  env.seedCache(fs.readFileSync(src))
  const steps = []
  const r = await core.runBatch({ url: 'BV1GJ411x7h7', start: '0:01', end: '0:02' }, { ...env.deps, conf: env.conf, onStep: s => steps.push(s) })
  assert.ok(steps.includes('剪辑中'), JSON.stringify(steps))
  assert.ok(steps.includes('压缩中'), JSON.stringify(steps))
  assert.ok(r.video.includes('_clip_') && r.video.includes('_crf23'), r.video)
  cleanTranscript(r)
})

test('runBatch：起止非法格式报错（parseTimeInput 拒绝）', async () => {
  const env = makeEnv()
  env.seedCache('FAKE')
  await assert.rejects(
    core.runBatch({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', start: 'abc', end: '0:02', options: { compress: false } }, { ...env.deps, conf: env.conf }),
    /起止时间格式错误/
  )
})

test('runBatch：whisper 失败 → 报错含 faster-whisper 环境引导', async () => {
  const env = makeEnv()
  env.seedCache('FAKE')
  await assert.rejects(
    core.runBatch({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', start: null, end: null, options: { compress: false } }, {
      ...env.deps, conf: env.conf,
      runPythonImpl: async () => { throw new Error('模拟 python 启动失败') },
    }),
    /转文字失败：模拟 python 启动失败（请确认 faster-whisper 环境已安装/
  )
})

test('runBatch：Python 找不到（ENOENT）→ 报错引导填 python / where python（不误导成 faster-whisper 未装）', async () => {
  const env = makeEnv()
  env.seedCache('FAKE')
  await assert.rejects(
    core.runBatch({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', start: null, end: null, options: { compress: false } }, {
      ...env.deps, conf: env.conf,
      runPythonImpl: async () => { throw new Error('无法启动 Python：spawn python ENOENT') },
    }),
    /转文字失败：找不到 Python（.*where python 可查/
  )
})

test('runBatch：pythonPath 未配置 → 报错引导填写方式（填 python 或 where python 查绝对路径）', async () => {
  const env = makeEnv()
  env.seedCache('FAKE')
  await assert.rejects(
    core.runBatch({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', start: null, end: null, options: { compress: false } }, {
      ...env.deps, conf: { ...env.conf, pythonPath: '' },   // 空串 = 未配置
    }),
    /未配置 pythonPath——.*where python 可查/
  )
})

test('runBatch：重名不覆盖（交付视频加序号，原文件不动）', async () => {
  const env = makeEnv()
  env.seedCache('FAKE')
  const deps = { ...env.deps, conf: env.conf }
  const r1 = await core.runBatch({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', start: null, end: null, options: { compress: false } }, deps)
  const r2 = await core.runBatch({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', start: null, end: null, options: { compress: false } }, deps)
  assert.equal(r1.video, 'CONFIG/APPENDIX/批处理测试视频_BV1GJ411x7h7.mp4')
  assert.equal(r2.video, 'CONFIG/APPENDIX/批处理测试视频_BV1GJ411x7h7_2.mp4')
  assert.ok(fs.existsSync(path.join(env.outDir, '批处理测试视频_BV1GJ411x7h7.mp4')))
  cleanTranscript(r1); cleanTranscript(r2)
})

test('runBatch：交付目录不在 vault 下 → video 退化为绝对路径', async () => {
  const env = makeEnv()
  env.seedCache('FAKE')
  const outside = path.join(tmp, 'outside-' + Math.random().toString(36).slice(2))
  fs.mkdirSync(outside, { recursive: true })
  const r = await core.runBatch({ url: 'BV1GJ411x7h7', start: null, end: null, options: { compress: false } }, {
    ...env.deps, conf: { ...env.conf, outputDir: outside },
  })
  assert.equal(r.video, path.resolve(outside, '批处理测试视频_BV1GJ411x7h7.mp4'))
  assert.ok(path.isAbsolute(r.transcript))
  cleanTranscript(r)
})

test('runBatch：进度行 [bz-p]——转写哨兵 100%、无 ai 阶段、pct 契约（0-100 或 null）', async () => {
  const env = makeEnv()
  env.seedCache('FAKE')
  const pgs = []
  const steps = []
  const r = await core.runBatch({ url: 'BV1GJ411x7h7', start: null, end: null, options: { compress: false } }, {
    ...env.deps, conf: env.conf, onStep: s => steps.push(s), onProgress: p => pgs.push(p),
  })
  assert.ok(steps.includes('交付中'))
  assert.ok(!steps.includes('笔记落盘中'))
  assert.ok(!steps.includes('AI 生成文献笔记中'))
  assert.ok(pgs.some(p => p.phase === 'transcribe' && p.pct === 100), JSON.stringify(pgs))
  assert.ok(!pgs.some(p => p.phase === 'ai'), JSON.stringify(pgs))
  for (const p of pgs) assert.ok(p.pct === null || (Number.isFinite(p.pct) && p.pct >= 0 && p.pct <= 100), JSON.stringify(p))
  cleanTranscript(r)
})

test('runBatch：options.keepVideo=false → 跳过交付（video=null、不落文件），转录仍产出', async () => {
  const env = makeEnv()
  env.seedCache('FAKE')
  const steps = []
  const r = await core.runBatch({ url: 'BV1GJ411x7h7', start: null, end: null, options: { keepVideo: false, compress: false } }, {
    ...env.deps, conf: env.conf, onStep: s => steps.push(s),
  })
  assert.equal(r.video, null)
  assert.equal(r.videoPath, null)
  assert.ok(!steps.includes('交付中'), JSON.stringify(steps))
  assert.equal(fs.readdirSync(env.outDir).length, 0)
  assert.ok(fs.existsSync(r.transcript), '转录临时文件仍应产出')
  cleanTranscript(r)
})

test('runBatch：options.quality=720 → 命中 720 缓存键（清晰度档生效）', async () => {
  const env = makeEnv()
  const cached = core.cachePath(env.conf, core.cacheKey('BV1GJ411x7h7', 1001, 720))
  fs.mkdirSync(path.dirname(cached), { recursive: true })
  fs.writeFileSync(cached, 'FAKE-720')
  const r = await core.runBatch({ url: 'BV1GJ411x7h7', start: null, end: null, options: { quality: '720', compress: false } }, { ...env.deps, conf: env.conf })
  assert.equal(r.video, 'CONFIG/APPENDIX/批处理测试视频_BV1GJ411x7h7.mp4')
  cleanTranscript(r)
})

test('runBatch：options.outputDir 覆盖交付目录（vault 外绝对路径，默认目录不落产物）', async () => {
  const env = makeEnv()
  env.seedCache('FAKE')
  const outside = path.join(tmp, 'override-' + Math.random().toString(36).slice(2))
  const r = await core.runBatch({ url: 'BV1GJ411x7h7', start: null, end: null, options: { outputDir: outside, compress: false } }, { ...env.deps, conf: env.conf })
  assert.equal(r.video, path.resolve(outside, '批处理测试视频_BV1GJ411x7h7.mp4'))
  assert.ok(fs.existsSync(path.join(outside, '批处理测试视频_BV1GJ411x7h7.mp4')))
  assert.equal(fs.readdirSync(env.outDir).length, 0)
  cleanTranscript(r)
})

test('runBatch：[bz-info] 解析信息回传（标题/UP主/规范化 url，ADR-0067）', async () => {
  const env = makeEnv()
  env.seedCache('FAKE')
  const infos = []
  const r = await core.runBatch({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', start: null, end: null, options: { compress: false } }, {
    ...env.deps, conf: env.conf, onInfo: i => infos.push(i),
  })
  assert.equal(infos.length, 1)
  assert.equal(infos[0].title, '批处理测试视频')
  assert.equal(infos[0].uploader, 'UP主')
  assert.equal(infos[0].bvid, 'BV1GJ411x7h7')
  assert.equal(infos[0].url, 'https://www.bilibili.com/video/BV1GJ411x7h7')
  assert.ok(infos[0].duration > 0)
  cleanTranscript(r)
})

test('runBatch：task.page=2 → 命中第 2 P（cid=1002）独立缓存键，文件名带 _2（ADR-0067）', async () => {
  const env = makeEnv()
  const cached = core.cachePath(env.conf, core.cacheKey('BV1GJ411x7h7', 1002, 1080))
  fs.mkdirSync(path.dirname(cached), { recursive: true })
  fs.writeFileSync(cached, 'FAKE-P2')
  const r = await core.runBatch({ url: 'BV1GJ411x7h7', start: null, end: null, page: 2, options: { compress: false } }, { ...env.deps, conf: env.conf })
  assert.ok(r.video.includes('批处理测试视频_BV1GJ411x7h7_2.mp4'), r.video)
  cleanTranscript(r)
})

test('runBatch：task.page 越界/非法 → 回落第 1 P（cid=1001 缓存命中）', async () => {
  const env = makeEnv()
  env.seedCache('FAKE')
  const r = await core.runBatch({ url: 'BV1GJ411x7h7', start: null, end: null, page: 99, options: { compress: false } }, { ...env.deps, conf: env.conf })
  assert.ok(r.video.includes('批处理测试视频_BV1GJ411x7h7.mp4'), r.video)
  cleanTranscript(r)
})

test('runBatch：断点续跑——转写稿复用，失败重跑不重复转录；无 AI 产物缓存（ADR-0067/ticket 136）', async () => {
  const env = makeEnv()
  env.seedCache('FAKE')
  let pythonCalls = 0
  const deps = {
    ...env.deps,
    runPythonImpl: async (o) => {
      pythonCalls++
      o.onChunk(`\x1e${o.args[1]}\x1f模拟转录文本。\x1f\n\x1e${o.args[1]}\x1f\x1f\n`)
    },
  }
  const runTask = d => core.runBatch({ url: 'BV1GJ411x7h7', start: null, end: null, options: { compress: false } }, { ...d, conf: env.conf })
  const r1 = await runTask(deps)
  const r2 = await runTask(deps)
  assert.equal(pythonCalls, 1)   // 第二次复用转写稿
  const dir = env.conf.cacheDir
  assert.ok(fs.readdirSync(dir).some(f => f.startsWith('resume-transcript-')))
  assert.ok(!fs.readdirSync(dir).some(f => f.startsWith('resume-meta-')), 'AI 元数据缓存应移除')
  assert.ok(!fs.readdirSync(dir).some(f => f.startsWith('resume-polish-')), '润色分块缓存应移除')
  cleanTranscript(r1); cleanTranscript(r2)
})

test('runBatch：断点续跑——剪辑件复用（命中缓存跳过 ffmpeg，ADR-0067）', { skip: !hasFfmpeg }, async () => {
  const src = path.join(tmp, 'batch-resume-src-' + Date.now() + '.mp4')
  const r0 = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=64x64:rate=10', '-t', '3', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', src], { encoding: 'utf8' })
  assert.equal(r0.status, 0, r0.stderr || 'ffmpeg 生成源失败')
  const env = makeEnv()
  env.seedCache(fs.readFileSync(src))
  await core.runBatch({ url: 'BV1GJ411x7h7', start: '0:01', end: '0:02', options: { compress: false } }, { ...env.deps, conf: env.conf })
  const clips = fs.readdirSync(env.conf.cacheDir).filter(f => f.startsWith('resume-clip-'))
  assert.equal(clips.length, 1)
  const r = await core.runBatch({ url: 'BV1GJ411x7h7', start: '0:01', end: '0:02', options: { compress: false } }, { ...env.deps, conf: env.conf, ffmpeg: 'definitely-not-ffmpeg' })
  assert.ok(r.video.includes('_clip_'), r.video)
  cleanTranscript(r)
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
    core.runBatch({ url: 'https://www.bilibili.com/video/BV1GJ411x7h7', start: null, end: null, options: { compress: false } }, {
      ...env.deps, conf: env.conf, get,
    }),
    /所有 CDN 节点均失败/
  )
})
