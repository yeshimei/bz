#!/usr/bin/env node
// ================================================================
// B站下载器 - CLI 入口（ticket 136 起仅无头批处理，网页版已移除）
// 用法:
//   bili-dl --batch '<json>'   无头批处理（Obsidian 插件「文献盒」面板后台引擎）
//       json = {"url":"…","start":"mm:ss|hh:mm:ss(.S)|null","end":"…","options":{...}}；start/end 都 null = 整片不剪辑
//       或 --batch 'b64:<base64>'（插件经 shell 启动时用——JSON 引号/空格会被 shell 对消，base64 安全，P2-5）
//       options（bz「文献盒」设置全量下发，全部可选）：quality、keepVideo、outputDir、compress（缺省开）、
//       crf（缺省 23，范围 18-28）、vaultPath、ffmpegPath、ffprobePath、pythonPath、whisperModel、cacheDir、cacheRetentionDays
//       stdout 逐步打 [bz-step] 行（解析中 → 下载中 → 剪辑中(有起止才跑) → 压缩中(缺省开) → 转文字中
//       → 交付中(keepVideo=false 时跳过)）；压缩中若压缩件比原文件还大自动回退用原文件（ticket 145）；
//       进度打 [bz-p] 行（{"phase":"download|trim|compress|transcribe","pct":0-100|null}，300ms 节流，pct=null 为不确定）；
//       成功末尾一行 [bz-result] {"transcript":"<转录临时文件绝对路径>","video":"CONFIG/APPENDIX/xxx.mp4"|null}
//       （transcript = UTF-8 转录全文临时文件，插件读取后自删；video 为 vault 相对/绝对路径，null = 未交付）并 exit 0；
//       任一步失败 stderr 给中文原因（含缺失前置引导，如 whisper 环境）并 exit 1，不写 [bz-result]。
//       断点续跑（ADR-0067，ticket 136 机械产物）：成功步骤产物（剪辑件/压缩件/转写稿）留存缓存目录，
//       同一任务重跑自动从出错步骤继续，不重跑已成功步骤。
//       --batch 模式不打印横幅、不起服务，避免污染协议。
//   bili-dl --brief '<json>'  每日简报批处理（issue 263，ADR-0119；守护进程 spawn，插件读转录后产要点）
//       json = {"ups":["3706929260006322"],"known":["BV..."],"backfill":10,"limit":3,"options":{...}}
//           ups = 深度名单（uid 或 {mid,name}）：本工具自行拉投稿列表发现新视频（bili-dl 已有 wbi 签名与 Cookie）
//           known = 已知 bvid（来自 news.json briefs），命中则跳过，不重复转写
//       json = {"items":[{"bvid","title","pubdate","duration"}]}  直传模式（手动/调试，不做发现）
//       或 --brief 'b64:<base64>'（同 --batch 的 shell 安全约定）
//       逐条「字幕优先、无字幕下载转写」；字幕可信度校验不过同样回退转写；单条失败不阻断整批；
//       stdout 行协议同 --batch，末尾 [bz-result] {"ok":[{bvid,title,source,transcriptPath,duration,pubdate,upMid,upName}],
//       "fail":[{bvid,reason}]}（source = 'subtitle' | 'transcript'；transcriptPath 为 UTF-8 转录全文临时文件，
//       插件读取后自删）并 exit 0。
// ================================================================
const os = require('os')
const path = require('path')
const fs = require('fs')
const core = require('./core')
const cfg = require('./config')

const args = process.argv.slice(2)

// ---- 无头批处理（--batch）：core.runBatch 的薄壳 + 协议输出 ----
function runBatchMode(rawJson) {
  if (rawJson === undefined) {
    console.error('缺少 --batch 参数（需要 JSON 字符串，如 --batch \'{"url":"BV…","start":null,"end":null}\'）')
    process.exit(1)
  }
  let task
  try {
    task = core.decodeBatchArg(rawJson)
  } catch (e) {
    console.error(`--batch 参数不是合法 JSON：${e.message}`)
    process.exit(1)
  }
  if (!task || typeof task !== 'object' || Array.isArray(task)) {
    console.error('--batch 参数必须是 JSON 对象（{"url":"…","start":"…|null","end":"…|null"}）')
    process.exit(1)
  }
  if (!task.url || typeof task.url !== 'string' || !String(task.url).trim()) {
    console.error('缺少 url（B站视频链接或 BV 号）')
    process.exit(1)
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-dl-batch-'))
  core.runBatch(task, {
    conf: cfg.loadConfig(),
    cookie: cfg.loadCookie(),
    onStep: name => console.log(`[bz-step] ${name}`),
    // 进度行：phase + 0-100 整数百分比（null = 不确定，绝不假报）
    onProgress: p => console.log(`[bz-p] ${JSON.stringify({ phase: p.phase || 'step', pct: Number.isFinite(p.pct) ? Math.round(p.pct) : null })}`),
    // 解析信息行（ADR-0067）：标题/UP主 落库 → 面板行内「文字+链接」
    onInfo: info => console.log(`[bz-info] ${JSON.stringify(info)}`),
    tmpDir: tmp,
  }).then(r => {
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}
    console.log(`[bz-result] ${JSON.stringify({ transcript: r.transcript, video: r.video })}`)
    process.exit(0)
  }).catch(e => {
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}
    console.error((e && e.message) || String(e))
    process.exit(1)
  })
}

// ---- 每日简报批处理（--brief）：core.runBrief 的薄壳 + 协议输出（issue 263）----
function runBriefMode(rawJson) {
  if (rawJson === undefined) {
    console.error('缺少 --brief 参数（需要 JSON 字符串，如 --brief \'{"items":[{"bvid":"BV…"}]}\'）')
    process.exit(1)
  }
  let task
  try {
    task = core.decodeBatchArg(rawJson)
  } catch (e) {
    console.error(`--brief 参数不是合法 JSON：${e.message}`)
    process.exit(1)
  }
  if (!task || typeof task !== 'object' || Array.isArray(task)) {
    console.error('--brief 参数必须是 JSON 对象（{"items":[{"bvid":"…"}]}）')
    process.exit(1)
  }
  if (!Array.isArray(task.items) && !Array.isArray(task.ups)) {
    console.error('缺少 items 或 ups（items:[{bvid}] 直传，或 ups:[uid] 由本工具拉投稿列表发现新视频）')
    process.exit(1)
  }
  if (Array.isArray(task.items) && !task.items.length && !(Array.isArray(task.ups) && task.ups.length)) {
    console.error('items/ups 均为空（至少给一条）')
    process.exit(1)
  }
  core.runBrief(task, {
    conf: cfg.loadConfig(),
    cookie: cfg.loadCookie(),
    onStep: name => console.log(`[bz-step] ${name}`),
    onItem: (i, n) => console.log(`[bz-step] 第 ${i}/${n} 条`),
    onProgress: p => console.log(`[bz-p] ${JSON.stringify({ phase: p.phase || 'step', pct: Number.isFinite(p.pct) ? Math.round(p.pct) : null })}`),
    onInfo: info => console.log(`[bz-info] ${JSON.stringify(info)}`),
  }).then(r => {
    console.log(`[bz-result] ${JSON.stringify({ ok: r.ok, fail: r.fail })}`)
    process.exit(0)
  }).catch(e => {
    console.error((e && e.message) || String(e))
    process.exit(1)
  })
}

const batchIdx = args.indexOf('--batch')
const briefIdx = args.indexOf('--brief')
if (batchIdx >= 0) runBatchMode(args[batchIdx + 1])
else if (briefIdx >= 0) runBriefMode(args[briefIdx + 1])
else {
  console.error('用法：bili-dl --batch \'{"url":"BV…","start":null,"end":null}\' 或 bili-dl --brief \'{"items":[{"bvid":"BV…"}]}\'（ticket 136 起仅无头批处理，网页版已移除）')
  process.exit(1)
}
