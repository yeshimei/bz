#!/usr/bin/env node
// ================================================================
// B站下载器 - CLI 入口
// 用法:
//   bili-dl             启动本地服务 + 自动打开浏览器
//   bili-dl --port 8080 指定端口（默认随机空闲端口）
//   bili-dl --no-open   只打印地址，不自动开浏览器
//   bili-dl --batch '<json>'   无头批处理（Obsidian 插件「文献盒」面板后台引擎）
//       json = {"url":"…","start":"mm:ss|hh:mm:ss(.S)|null","end":"…","options":{...}}；start/end 都 null = 整片不剪辑
//       options（可选，文献盒设置项）：quality="720"|"1080"|"highest"、keepVideo=false（跳过交付只出笔记）、
//       outputDir（覆盖交付目录，空跟随 ~/.bilibili-dl.json）
//       stdout 逐步打 [bz-step] 行（解析中 → 下载中 → 剪辑中(有起止才跑) → 转文字中 → AI 生成文献笔记中
//       → 交付中(keepVideo=false 时跳过) → 笔记落盘中）；
//       进度打 [bz-p] 行（{"phase":"download|trim|transcribe|ai","pct":0-100|null}，300ms 节流，pct=null 为不确定）；
//       成功末尾一行 [bz-result] {"note":"文献盒/标题.md","video":"CONFIG/APPENDIX/xxx.mp4"|null}
//       （note/video 为 vault 相对路径；不在 vault 下为绝对路径；video null = 未交付保留）并 exit 0；
//       任一步失败 stderr 给中文原因（含缺失前置引导，如 whisper 环境 / AI key）并 exit 1，不写 [bz-result]。
//       --batch 模式不打印横幅、不起服务，避免污染协议。
// 实例复用（ticket 117）: 未指定 --port 时，若端口文件 ~/.bilibili-dl-port
//   记的旧实例仍存活，则直接复用其地址（打印同格式「地址:」行 + 开浏览器后退出），
//   不再起第二个服务/第二个临时目录——插件连点命令不再叠标签页。
// ================================================================
const { execSync } = require('child_process')
const http = require('http')
const os = require('os')
const path = require('path')
const fs = require('fs')
const core = require('./core')
const cfg = require('./config')

const PORT_FILE = path.join(os.homedir(), '.bilibili-dl-port')

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
    tmpDir: tmp,
  }).then(r => {
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}
    console.log(`[bz-result] ${JSON.stringify({ note: r.note, video: r.video })}`)
    process.exit(0)
  }).catch(e => {
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}
    console.error((e && e.message) || String(e))
    process.exit(1)
  })
}

// ---- 服务模式 ----
function openBrowser(url) {
  try {
    const plat = process.platform
    if (plat === 'win32') execSync(`start "" "${url}"`, { stdio: 'ignore' })
    else if (plat === 'darwin') execSync(`open "${url}"`, { stdio: 'ignore' })
    else execSync(`xdg-open "${url}"`, { stdio: 'ignore' })
  } catch {
    console.log(`[B站下载器] 自动打开浏览器失败，请手动访问: ${url}`)
  }
}

function printAddr(url) {
  console.log('==============================================')
  console.log('  B站下载器')
  console.log(`  地址: ${url}`)
  console.log('  按 Ctrl+C 退出')
  console.log('==============================================')
}

// 探测端口上的旧实例是否存活（必须是本工具页面，防误认其他应用）
function probeAlive(p) {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port: p, path: '/', timeout: 1500 }, res => {
      let d = ''
      res.on('data', c => { d += c; if (d.length > 65536) req.destroy() })
      res.on('end', () => resolve(res.statusCode === 200 && d.includes('B站下载器')))
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
}

async function main() {
  const { createServer, TMP_DIR, startValidate } = require('./server')   // 服务模式才加载（batch 模式不建服务临时目录）
  const cleanup = () => {
    try { fs.rmSync(TMP_DIR, { recursive: true, force: true }) } catch {}
    // 注意：不删 PORT_FILE——复用路径退出时旧实例仍存活，文件必须保留；
    // 实例真的死了，下次启动探测失败自会覆盖（stale 文件由探测兜底）。
  }
  process.on('SIGINT', () => { console.log('\n[B站下载器] 正在退出…'); cleanup(); process.exit(0) })
  process.on('SIGTERM', () => { cleanup(); process.exit(0) })
  process.on('exit', cleanup)

  const portIdx = args.indexOf('--port')
  const port = portIdx >= 0 ? Number(args[portIdx + 1]) || 0 : 0
  const noOpen = args.includes('--no-open')

  // 实例复用：显式 --port 跳过（用户要的就是指定端口的新实例）
  if (portIdx < 0) {
    let prev = null
    try { prev = Number(String(fs.readFileSync(PORT_FILE, 'utf8')).trim()) } catch { prev = null }
    if (prev && isFinite(prev) && prev > 0 && (await probeAlive(prev))) {
      const url = `http://127.0.0.1:${prev}`
      printAddr(url)
      // 复用旧实例：新进程的临时目录随退出被 cleanup 清掉，旧实例的产物不受影响
      if (!noOpen) openBrowser(url)
      return
    }
  }

  const server = createServer()
  server.listen(port, '127.0.0.1', () => {
    const real = server.address().port
    const url = `http://127.0.0.1:${real}`
    try { fs.writeFileSync(PORT_FILE, String(real)) } catch {}   // 记录端口供下次复用
    printAddr(url)
    startValidate()   // 异步验证 Cookie 状态，推送给页面
    if (!noOpen) openBrowser(url)
  })
  server.on('error', e => {
    console.error(`[B站下载器] 服务启动失败: ${e.message}`)
    process.exit(1)
  })
}

const batchIdx = args.indexOf('--batch')
if (batchIdx >= 0) runBatchMode(args[batchIdx + 1])
else main()