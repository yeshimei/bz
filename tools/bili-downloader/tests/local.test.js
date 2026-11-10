// ================================================================
// B站下载器 - 本机音视频（runLocal / runBatch.local 分流）测试（node:test，零依赖）
// ADR-0296：本机文件不下载、不分P、不压缩；流程 = 读取中 → 提取音轨中 → 转文字中 → 交付中。
// 全程打桩：probeDurationImpl（时长）/ extractAudioImpl（抽音轨，顺手写一个假 wav）/
// runPythonImpl（转写输出）；只有 fs 与路径是真操作（临时目录）。
// ================================================================
const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const core = require('../core')

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-local-test-'))
const vault = path.join(tmpRoot, 'vault')
const outDir = path.join(vault, 'CONFIG/APPENDIX')
fs.mkdirSync(outDir, { recursive: true })

/** 造一个「本机文件」：内容无所谓，只看扩展名与是否存在 */
function makeMedia(name = '播客 第 3 期.m4a') {
  const p = path.join(tmpRoot, name)
  fs.writeFileSync(p, 'fake-media-bytes')
  return p
}

/** 打桩环境：时长固定 120s；抽音轨写一个空 wav；转写输出给定文本 */
function makeDeps(opts = {}) {
  const steps = []
  const infos = []
  const progress = []
  const extractCalls = []
  return {
    steps,
    infos,
    progress,
    extractCalls,
    deps: {
      conf: {
        vaultPath: vault,
        outputDir: outDir,
        ffmpegPath: 'ffmpeg',
        ffprobePath: 'ffprobe',
        pythonPath: 'python',
      },
      onStep: (n) => steps.push(n),
      onInfo: (i) => infos.push(i),
      onProgress: (p) => progress.push(p),
      probeDurationImpl: async () => (opts.duration === undefined ? 120 : opts.duration),
      extractAudioImpl: async (cfg) => {
        extractCalls.push({ start: cfg.start, end: cfg.end, totalMs: cfg.totalMs })
        fs.writeFileSync(cfg.outPath, 'wav')
      },
      runPythonImpl: async () => { /* 默认不吐文本；withTranscript 包一层补上 */ },
      tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'bili-local-run-')),
    },
  }
}

/** runPythonImpl 需要把文本「吐」给 onChunk；这里单独包一层，避免每个用例重复 */
function withTranscript(deps, text = '你好，这是本机音轨的转写。') {
  deps.runPythonImpl = async ({ args, onChunk }) => {
    const wav = args[args.length - 1]
    onChunk(`\x1e${wav}\x1f${text}\x1f\n`)
    onChunk(`\x1e${wav}\x1f\x1f\n`) // 完成哨兵
  }
  return deps
}

test('runBatch 带 local → 走本机分支：不碰 network/BV，步骤顺序正确', async () => {
  const media = makeMedia('录屏.mp4')
  const { deps, steps, infos } = makeDeps()
  withTranscript(deps, '这是录屏里的讲解。')
  const r = await core.runBatch(
    { local: { path: media, kind: 'video' }, start: null, end: null, options: { keepVideo: false } },
    deps,
  )
  assert.deepStrictEqual(steps, ['读取中', '提取音轨中', '转文字中']) // keepVideo=false → 无「交付中」
  assert.equal(infos.length, 1)
  assert.equal(infos[0].title, '录屏')
  assert.equal(infos[0].duration, 120)
  assert.equal(infos[0].kind, 'video')
  assert.equal(r.duration, 120)
  assert.equal(r.video, null) // keepVideo=false
  assert.ok(fs.existsSync(r.transcript))
  assert.equal(fs.readFileSync(r.transcript, 'utf8'), '这是录屏里的讲解。')
  fs.unlinkSync(r.transcript)
})

test('交付：保留原件 = 复制进交付目录（重名加 _2），video 回传 vault 相对路径', async () => {
  const media = makeMedia('播客 第 3 期.m4a')
  const { deps, steps } = makeDeps()
  withTranscript(deps)
  const r1 = await core.runBatch({ local: { path: media, kind: 'audio' }, options: {} }, deps)
  assert.equal(steps[steps.length - 1], '交付中')
  assert.equal(r1.video, 'CONFIG/APPENDIX/播客 第 3 期.m4a')
  assert.ok(fs.existsSync(path.join(outDir, '播客 第 3 期.m4a')))
  const r2 = await core.runBatch({ local: { path: media, kind: 'audio' }, options: {} }, deps)
  assert.equal(r2.video, 'CONFIG/APPENDIX/播客 第 3 期_2.m4a') // 不覆盖
  fs.unlinkSync(r1.transcript)
  fs.unlinkSync(r2.transcript)
})

test('起止：两端有值才切（传给抽音轨的 start/end/totalMs 是钳制后的秒）', async () => {
  const media = makeMedia('切片.mp4')
  const { deps, extractCalls } = makeDeps()
  withTranscript(deps)
  const r = await core.runBatch({ local: { path: media, kind: 'video' }, start: '0:10', end: '0:40', options: { keepVideo: false } }, deps)
  assert.equal(extractCalls.length, 1)
  assert.equal(extractCalls[0].start, 10)
  assert.equal(extractCalls[0].end, 40)
  assert.equal(extractCalls[0].totalMs, 30000)
  fs.unlinkSync(r.transcript)
})

test('整片：start/end 两端都有值才算切片，单端有值按整片', async () => {
  const media = makeMedia('单端.mp4')
  const { deps, extractCalls } = makeDeps()
  withTranscript(deps)
  const r = await core.runBatch({ local: { path: media, kind: 'video' }, start: '0:10', end: '', options: { keepVideo: false } }, deps)
  assert.deepStrictEqual(extractCalls[0], { start: 0, end: 120, totalMs: 120000 })
  fs.unlinkSync(r.transcript)
})

test('文件不存在 → 中文报错（说明可能已被移动或删除），不进入抽音轨', async () => {
  const { deps, extractCalls } = makeDeps()
  await assert.rejects(
    () => core.runBatch({ local: { path: path.join(tmpRoot, '不存在.mp3') }, options: {} }, deps),
    /找不到文件/,
  )
  assert.equal(extractCalls.length, 0)
})

test('读不出时长 → 明确报错（不是音视频 / ffprobe 不可用）', async () => {
  const media = makeMedia('坏文件.wav')
  const { deps } = makeDeps({ duration: null })
  await assert.rejects(
    () => core.runBatch({ local: { path: media, kind: 'audio' }, options: {} }, deps),
    /读不出这个文件的时长/,
  )
})

test('转写无文本 → 报错（空转写不生成笔记）', async () => {
  const media = makeMedia('无声.mp3')
  const { deps } = makeDeps()
  deps.runPythonImpl = async () => { /* 什么都不吐 */ }
  await assert.rejects(
    () => core.runBatch({ local: { path: media, kind: 'audio' }, options: {} }, deps),
    /转文字未产出文本/,
  )
})

test('未配置 pythonPath → 起跑即报「未配置 pythonPath」', async () => {
  const media = makeMedia('要转写.wav')
  const { deps } = makeDeps()
  deps.conf.pythonPath = ''
  await assert.rejects(
    () => core.runBatch({ local: { path: media, kind: 'audio' }, options: {} }, deps),
    /未配置 pythonPath/,
  )
})

test('交付目录为空且 options 没给 → 保留原件时明确报目录未配置', async () => {
  const media = makeMedia('要交付.mp4')
  const { deps } = makeDeps()
  withTranscript(deps)
  deps.conf.outputDir = ''
  await assert.rejects(
    () => core.runBatch({ local: { path: media, kind: 'video' }, options: {} }, deps),
    /交付目录未配置/,
  )
})

test('runLocal 直接调用：返回 shape 与 runBatch 一致（transcript/video/transcriptPath/videoPath/title/duration）', async () => {
  const media = makeMedia('直调.m4a')
  const { deps } = makeDeps()
  withTranscript(deps, '直调路径。')
  const r = await core.runLocal({ local: { path: media, kind: 'audio' }, options: { keepVideo: false } }, deps)
  assert.equal(typeof r.transcript, 'string')
  assert.equal(r.transcript, r.transcriptPath)
  assert.equal(r.video, null)
  assert.equal(r.videoPath, null)
  assert.equal(r.title, '直调')
  assert.equal(r.kind, 'audio')
  fs.unlinkSync(r.transcript)
})

test('带范围 + 保留媒体：交付的是裁切片段，不是整片（发版 review #3）', async () => {
  const media = makeMedia('讲座-切片.mp4')
  const { deps } = makeDeps()
  withTranscript(deps)
  const trimCalls = []
  deps.trimImpl = async (cfg) => {
    trimCalls.push({ start: cfg.start, end: cfg.end, crf: cfg.crf })
    fs.writeFileSync(cfg.outPath, 'TRIMMED-SEGMENT')
  }
  const r = await core.runBatch(
    { local: { path: media, kind: 'video' }, start: '0:10', end: '0:40', options: { keepVideo: true } },
    deps,
  )
  assert.equal(trimCalls.length, 1)
  assert.equal(trimCalls[0].start, 10)
  assert.equal(trimCalls[0].end, 40)
  assert.equal(trimCalls[0].crf, null)
  assert.equal(fs.readFileSync(path.join(vault, r.video), 'utf8'), 'TRIMMED-SEGMENT')
  fs.unlinkSync(r.transcript)
})

test('整片 + 保留媒体：不调裁切，仍旧复制原件', async () => {
  const media = makeMedia('整片-原件.mp4')
  const { deps } = makeDeps()
  withTranscript(deps)
  let trimmed = false
  deps.trimImpl = async () => { trimmed = true }
  const r = await core.runBatch({ local: { path: media, kind: 'video' }, options: { keepVideo: true } }, deps)
  assert.equal(trimmed, false)
  assert.equal(fs.readFileSync(path.join(vault, r.video), 'utf8'), 'fake-media-bytes')
  fs.unlinkSync(r.transcript)
})

test('本机音声没传 kind：按扩展名判成音声，不记成影像（发版 review #5）', async () => {
  const media = makeMedia('播客-无kind.m4a')
  const { deps, infos } = makeDeps()
  withTranscript(deps)
  const r = await core.runBatch({ local: { path: media }, options: { keepVideo: false } }, deps)
  assert.equal(r.kind, 'audio')
  assert.equal(infos[0].kind, 'audio')
  fs.unlinkSync(r.transcript)
})

test('本机视频没传 kind：仍是影像；显式 kind 优先', async () => {
  const video = makeMedia('录屏-无kind.mp4')
  const { deps } = makeDeps()
  withTranscript(deps)
  const r1 = await core.runBatch({ local: { path: video }, options: { keepVideo: false } }, deps)
  assert.equal(r1.kind, 'video')

  const audio = makeMedia('曲子-显式.mp3')
  const { deps: deps2 } = makeDeps()
  withTranscript(deps2)
  const r2 = await core.runBatch({ local: { path: audio, kind: 'video' }, options: { keepVideo: false } }, deps2)
  assert.equal(r2.kind, 'video')
  fs.unlinkSync(r1.transcript)
  fs.unlinkSync(r2.transcript)
})
