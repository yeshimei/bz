#!/usr/bin/env node
// ================================================================
// B站下载器 - CLI 入口
// 用法:
//   bili-dl             启动本地服务 + 自动打开浏览器
//   bili-dl --port 8080 指定端口（默认随机空闲端口）
//   bili-dl --no-open   只打印地址，不自动开浏览器
// 实例复用（ticket 117）: 未指定 --port 时，若端口文件 ~/.bilibili-dl-port
//   记的旧实例仍存活，则直接复用其地址（打印同格式「地址:」行 + 开浏览器后退出），
//   不再起第二个服务/第二个临时目录——插件连点命令不再叠标签页。
// ================================================================
const { execSync } = require('child_process')
const http = require('http')
const os = require('os')
const path = require('path')
const fs = require('fs')
const { createServer, TMP_DIR, startValidate } = require('./server')

const PORT_FILE = path.join(os.homedir(), '.bilibili-dl-port')

const args = process.argv.slice(2)
const portIdx = args.indexOf('--port')
const port = portIdx >= 0 ? Number(args[portIdx + 1]) || 0 : 0
const noOpen = args.includes('--no-open')

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

function cleanup() {
  try { fs.rmSync(TMP_DIR, { recursive: true, force: true }) } catch {}
  // 注意：不删 PORT_FILE——复用路径退出时旧实例仍存活，文件必须保留；
  // 实例真的死了，下次启动探测失败自会覆盖（stale 文件由探测兜底）。
}

process.on('SIGINT', () => { console.log('\n[B站下载器] 正在退出…'); cleanup(); process.exit(0) })
process.on('SIGTERM', () => { cleanup(); process.exit(0) })
process.on('exit', cleanup)

async function main() {
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

main()
