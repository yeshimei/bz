#!/usr/bin/env node
// ================================================================
// B站下载器 - CLI 入口
// 用法:
//   bili-dl             启动本地服务 + 自动打开浏览器
//   bili-dl --port 8080 指定端口（默认随机空闲端口）
//   bili-dl --no-open   只打印地址，不自动开浏览器
// ================================================================
const { execSync } = require('child_process')
const fs = require('fs')
const { createServer, TMP_DIR, startValidate } = require('./server')

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

function cleanup() {
  try { fs.rmSync(TMP_DIR, { recursive: true, force: true }) } catch {}
}

process.on('SIGINT', () => { console.log('\n[B站下载器] 正在退出…'); cleanup(); process.exit(0) })
process.on('SIGTERM', () => { cleanup(); process.exit(0) })
process.on('exit', cleanup)

const server = createServer()
server.listen(port, '127.0.0.1', () => {
  const real = server.address().port
  const url = `http://127.0.0.1:${real}`
  console.log('==============================================')
  console.log('  B站下载器')
  console.log(`  地址: ${url}`)
  console.log('  按 Ctrl+C 退出')
  console.log('==============================================')
  startValidate()   // 异步验证 Cookie 状态，推送给页面
  if (!noOpen) openBrowser(url)
})
server.on('error', e => {
  console.error(`[B站下载器] 服务启动失败: ${e.message}`)
  process.exit(1)
})
