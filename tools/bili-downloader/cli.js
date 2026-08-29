#!/usr/bin/env node
// ================================================================
// B站下载器 - CLI 入口（ticket 136 起仅无头批处理，网页版已移除）
// 用法:
//   bili-dl --batch '<json>'   无头批处理（Obsidian 插件「文献盒」面板后台引擎）
//       json = {"url":"…","start":"mm:ss|hh:mm:ss(.S)|null","end":"…","options":{...}}；start/end 都 null = 整片不剪辑
//       options（bz「文献盒」设置全量下发，全部可选）：quality、keepVideo、outputDir、compress（缺省开）、
//       crf（缺省 23，范围 18-28）、vaultPath、ffmpegPath、ffprobePath、pythonPath、whisperModel、cacheDir、cacheRetentionDays
//       stdout 逐步打 [bz-step] 行（解析中 → 下载中 → 剪辑中(有起止才跑) → 压缩中(缺省开) → 转文字中
//       → 交付中(keepVideo=false 时跳过)）；
//       进度打 [bz-p] 行（{"phase":"download|trim|compress|transcribe","pct":0-100|null}，300ms 节流，pct=null 为不确定）；
//       成功末尾一行 [bz-result] {"transcript":"<转录临时文件绝对路径>","video":"CONFIG/APPENDIX/xxx.mp4"|null}
//       （transcript = UTF-8 转录全文临时文件，插件读取后自删；video 为 vault 相对/绝对路径，null = 未交付）并 exit 0；
//       任一步失败 stderr 给中文原因（含缺失前置引导，如 whisper 环境）并 exit 1，不写 [bz-result]。
//       断点续跑（ADR-0067，ticket 136 机械产物）：成功步骤产物（剪辑件/压缩件/转写稿）留存缓存目录，
//       同一任务重跑自动从出错步骤继续，不重跑已成功步骤。
//       --batch 模式不打印横幅、不起服务，避免污染协议。
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
    task = JSON.parse(rawJson)
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

const batchIdx = args.indexOf('--batch')
if (batchIdx >= 0) runBatchMode(args[batchIdx + 1])
else {
  console.error('用法：bili-dl --batch \'{"url":"BV…","start":null,"end":null}\'（ticket 136 起仅无头批处理，网页版已移除）')
  process.exit(1)
}
