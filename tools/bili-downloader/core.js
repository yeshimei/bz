// ================================================================
// B站下载器 - 核心逻辑（零 DOM 依赖，可 headless 测试）
// 由 QuickAdd 脚本《B站下载.js》抽取：wbi 签名、view + playurl、
// 官方 CDN 多节点切换（150ms 节流平滑进度条 + EMA 速度）、
// 流复制裁切 + CRF 重编码压缩、faster-whisper 转文字（python -c）。
// 网络函数（fetchJson / https.get）可注入，便于测试。
// ================================================================
const { spawn } = require('child_process')
const crypto = require('crypto')
const https = require('https')
const fs = require('fs')
const os = require('os')
const path = require('path')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ---- B站 web API（wbi 签名）----
const MIXIN_KEY_ENC_TAB = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52]

function getMixinKey(orig) {
  return MIXIN_KEY_ENC_TAB.map(n => orig[n]).join('').slice(0, 32)
}

async function fetchJsonImpl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA, ...headers } }, res => {
      let d = ''
      res.on('data', c => (d += c))
      res.on('end', () => {
        try { resolve(JSON.parse(d)) } catch { reject(new Error('API 响应解析失败')) }
      })
    }).on('error', e => reject(new Error(`网络请求失败：${e.message}`)))
  })
}

async function getWbiKeys(cookie, fetchJson) {
  const j = await fetchJson('https://api.bilibili.com/x/web-interface/nav', cookie ? { Cookie: cookie } : {})
  const w = j && j.data && j.data.wbi_img
  if (!w) throw new Error('获取 wbi keys 失败')
  return {
    imgKey: w.img_url.slice(w.img_url.lastIndexOf('/') + 1, w.img_url.lastIndexOf('.')),
    subKey: w.sub_url.slice(w.sub_url.lastIndexOf('/') + 1, w.sub_url.lastIndexOf('.')),
  }
}

function wbiSign(params, imgKey, subKey) {
  const mixinKey = getMixinKey(imgKey + subKey)
  params.wts = Math.round(Date.now() / 1000)
  const qs = Object.keys(params).sort().map(k => `${k}=${encodeURIComponent(params[k])}`).join('&')
  return qs + '&w_rid=' + crypto.createHash('md5').update(qs + mixinKey).digest('hex')
}

async function getViewInfo({ bvid, cookie, fetchJson }) {
  const j = await fetchJson(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, cookie ? { Cookie: cookie } : {})
  if (j.code !== 0) throw new Error(`视频信息获取失败：${j.message || j.code}`)
  const d = j.data
  const pages = Array.isArray(d.pages) && d.pages.length
    ? d.pages.map((p, i) => ({ cid: p.cid, page: p.page != null ? p.page : i + 1, title: p.part || '', duration: p.duration != null ? p.duration : d.duration }))
    : [{ cid: d.cid, page: 1, title: '', duration: d.duration }]
  return {
    title: d.title, uploader: d.owner.name, duration: d.duration,
    thumbnail: d.pic, cid: d.cid, pages,
  }
}

async function getPlayUrls({ bvid, cid, cookie, fetchJson }) {
  const keys = await getWbiKeys(cookie, fetchJson)
  const qs = wbiSign({ bvid, cid, fnval: 4048, fourk: 1, qn: 127, platform: 'pc' }, keys.imgKey, keys.subKey)
  const j = await fetchJson(`https://api.bilibili.com/x/player/wbi/playurl?${qs}`, cookie ? { Cookie: cookie } : {})
  if (j.code !== 0) throw new Error(`播放地址获取失败：${j.message || j.code}`)
  return j.data.dash
}

function lastLine(s) {
  const lines = s.trim().split(/\r?\n/)
  return lines[lines.length - 1] || ''
}

function qualityLabel(f) {
  const h = f.height
  const base = h >= 2160 ? '4K' : h >= 1440 ? '2K' : `${h}P`
  return (f.fps || 0) > 30 ? `${base} ${f.fps}帧` : base
}

function sanitizeName(s) {
  return String(s).replace(/[\\/:*?"<>|#^[\]]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || '视频'
}

function extractBv(url) {
  const m = String(url).match(/BV[0-9A-Za-z]{10}/)
  return m ? m[0] : ''
}

const pad2 = n => String(n).padStart(2, '0')

// 恒显小时位：文件名用 `-` 分隔（HH-MM-SS），显示用 `:` 分隔（HH:MM:SS）
function fmtTime(t) {
  const s = Math.max(0, Math.round(t))
  return `${pad2(Math.floor(s / 3600))}-${pad2(Math.floor(s % 3600 / 60))}-${pad2(s % 60)}`
}

function fmtDuration(t) {
  const s = Math.max(0, Math.round(t))
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor(s % 3600 / 60))}:${pad2(s % 60)}`
}

// 保留 1 位小数的秒字符串（ffmpeg 传参用，避免浮点尾巴）
function fmtSec(t) {
  const x = Math.max(0, Math.round((Number(t) || 0) * 10) / 10)
  return String(x)
}

// 解析用户输入的时间：HH:MM:SS.S / MM:SS.S / SS.S / 裸秒 → 秒（1 位小数）；失败返回 null
function parseTimeInput(str) {
  const s = String(str).trim()
  if (!s || !/^-?[\d:.]+$/.test(s)) return null
  const parts = String(s).split(':').map(p => p.trim())
  if (parts.length > 3) return null
  const nums = parts.map(p => { const n = Number(p); return isFinite(n) && n >= 0 ? n : NaN })
  if (nums.some(Number.isNaN)) return null
  let sec
  if (nums.length === 1) sec = nums[0]
  else if (nums.length === 2) sec = nums[0] * 60 + nums[1]
  else sec = nums[0] * 3600 + nums[1] * 60 + nums[2]
  return Math.max(0, Math.round(sec * 10) / 10)
}

function buildFileName({ title, bv, page, trimmed, start, end, duration, compressed, crf }) {
  let name = `${sanitizeName(title)}_${bv}`
  if (page) name += `_${page}`
  if (trimmed && (start > 0 || end < duration)) name += `_clip_${fmtTime(start)}-${fmtTime(end)}`
  if (compressed && crf !== null && crf !== undefined) name += `_crf${crf}`
  return `${name}.mp4`
}

// 解析：view API（标题/封面）+ playurl API（清晰度列表，官方 CDN baseUrl）
async function parseVideo({ url, cookie, fetchJson = fetchJsonImpl }) {
  const bvid = extractBv(url)
  if (!bvid) throw new Error('无法从链接中识别 BV 号')
  const view = await getViewInfo({ bvid, cookie, fetchJson })
  const dash = await getPlayUrls({ bvid, cid: view.cid, cookie, fetchJson })
  const vids = (dash.video || []).filter(v => v.height)
  if (!vids.length) throw new Error('未找到可下载的视频流')
  const best = new Map() // 每个高度保留一个代表格式（avc > hevc > av01）
  for (const v of vids) {
    const score = f => (f.codecs.startsWith('avc') ? 2 : f.codecs.startsWith('hev') ? 1 : 0) * 100 + (f.frameRate || 0)
    if (!best.has(v.height) || score(v) > score(best.get(v.height))) best.set(v.height, v)
  }
  const formats = [...best.values()]
    .sort((a, b) => b.height - a.height)
    .map(f => ({ height: f.height, fps: Math.round(f.frameRate || 0), label: qualityLabel(f) }))
  return {
    title: view.title, uploader: view.uploader, duration: view.duration,
    thumbnail: view.thumbnail, formats, maxHeight: formats[0] ? formats[0].height : 0,
    bvid, cid: view.cid, pages: view.pages,
  }
}

// 下载：自研 playurl + 多 CDN 节点切换（baseUrl → backupUrl 逐个尝试，慢节点自动跳过）
function fmtEta(sec) {
  if (!isFinite(sec) || sec < 0) return '?'
  sec = Math.round(sec)
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

// 下载单个流：顺序尝试候选 URL；切换条件 = 连接失败 / 非 2xx / 长时间零字节(stall)。
// 慢速但持续有数据的节点不切换（慢 ≠ 失败，只要在动就让它下完）。
// 进度：总大小优先取传入 size，其次取响应 Content-Length；都没有时 percent 为 null（前端显示不确定进度 + 已下载字节）。
function downloadStream({ urls, outPath, referer, size, stallMs = 12000, onProgress, onDiag, get = https.get }) {
  return new Promise((resolve, reject) => {
    const cands = [...urls]
    let idx = 0
    // 跨节点累计的下载量（进度平滑，换节点不回跳；文件本身每次整下用一个节点）
    let received = 0, speed = 0, lastT = Date.now(), lastB = 0, totalBytes = size > 0 ? size : 0
    const tryNext = () => {
      if (ABORTED) return reject(new Error('已中止'))
      if (idx >= cands.length) return reject(new Error('所有 CDN 节点均失败（可能网络受限）'))
      const url = cands[idx++]
      const host = new URL(url).hostname
      onDiag && onDiag(`节点 ${host}`)
      const t0 = Date.now()
      let lastDataAt = 0, settled = false, lastReportAt = 0, contentLength = 0
      const ws = fs.createWriteStream(outPath)
      const h = { req: null, ws }
      trackDownload(h)
      const report = () => {
        const now = Date.now()
        const dt = (now - lastT) / 1000
        const inst = dt > 0 ? (received - lastB) / 1048576 / dt : 0
        speed = speed ? speed * 0.6 + inst * 0.4 : inst   // EMA 平滑瞬时速度，避免数字跳动
        lastT = now; lastB = received
        const known = totalBytes > 0
        onProgress && onProgress({
          phase: 'download',
          percent: known ? Math.min(100, (received / totalBytes) * 100) : null,
          received, total: known ? totalBytes : 0,
          speed: `${speed.toFixed(1)}MiB/s`,
          eta: known ? fmtEta((totalBytes - received) / 1048576 / (speed || 0.01)) : '',
        })
      }
      const stallTimer = setInterval(() => {
        if (settled) return clearInterval(stallTimer)
        report()   // 兜底更新（即使零字节也让前端看到速度在动，慢 ≠ 卡死）
        const idleFor = Date.now() - (lastDataAt || t0)
        if (idleFor > stallMs) {   // 长时间没有任何字节 → 判定死节点，再换一个
          settled = true
          req.destroy()
          ws.destroy()
          onDiag && onDiag(`节点 ${host} 长时间无数据，切换…`)
          tryNext()
        }
      }, 1000)
      const req = get(url, { headers: { 'User-Agent': UA, Referer: referer } }, res => {
        if (res.statusCode !== 200 && res.statusCode !== 206) {
          res.resume()
          settled = true
          clearInterval(stallTimer)
          ws.destroy()
          return tryNext()
        }
        // size 缺失时用 Content-Length 当总大小（真实，不再用 received*4 的 25% 假进度）
        if (totalBytes <= 0 && res.headers) {
          const cl = parseInt(res.headers['content-length'], 10)
          if (cl > 0) totalBytes = cl
        }
        res.on('data', c => {
          received += c.length
          lastDataAt = Date.now()
          ws.write(c)
          const now = Date.now()
          if (now - lastReportAt >= 150) { lastReportAt = now; report() }   // 150ms 节流高频更新，进度条流畅
        })
        res.on('end', () => {
          if (settled) return
          settled = true
          clearInterval(stallTimer)
          DOWNLOADS.delete(h)
          const known = totalBytes > 0
          // end 回调：等数据全部 flush 落盘后再 resolve（否则调用方立即读文件会读到不完整内容）
          ws.end(() => {
            onProgress && onProgress({ phase: 'download', percent: known ? Math.min(100, (received / totalBytes) * 100) : null, received, total: known ? totalBytes : received, speed: '✅', eta: '' })
            resolve()
          })
        })
        res.on('error', () => {
          if (settled) return
          settled = true
          clearInterval(stallTimer)
          ws.destroy()
          tryNext()
        })
      })
      h.req = req   // 注册请求句柄，取消任务时可 destroy 中止
      req.on('error', () => {
        if (settled) return
        settled = true
        clearInterval(stallTimer)
        ws.destroy()
        onDiag && onDiag(`节点 ${host} 连接失败，切换…`)
        tryNext()
      })
    }
    tryNext()
  })
}

// 合并音视频（-c copy 秒级）
function mergeStreams({ videoPath, audioPath, outPath, ffmpeg = 'ffmpeg' }) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, ['-y', '-i', videoPath, '-i', audioPath, '-c', 'copy', '-movflags', '+faststart', outPath], { windowsHide: true })
    trackProc(p)
    let err = ''
    p.stderr.on('data', d => (err += d))
    p.on('error', e => reject(new Error(`无法启动 ffmpeg：${e.message}`)))
    p.on('close', code => {
      if (code !== 0) reject(new Error(lastLine(err) || `ffmpeg 退出码 ${code}`))
      else resolve()
    })
  })
}

async function downloadVideo({ url, cookie, height, outPath, cid, onProgress, onDiag, ffmpeg = 'ffmpeg', fetchJson = fetchJsonImpl, get = https.get }) {
  const bvid = extractBv(url)
  // 支持分P下载：给 cid 则直接取该 P 播放地址，省一次 view 请求
  const playCid = cid || (await getViewInfo({ bvid, cookie, fetchJson })).cid
  const dash = await getPlayUrls({ bvid, cid: playCid, cookie, fetchJson })
  const vids = (dash.video || []).filter(v => v.height)
  if (!vids.length) throw new Error('未找到可下载的视频流')
  // 目标清晰度：<= height 的最高，avc 优先；找不到则用已有最低
  let v = vids.filter(f => f.height <= height && f.codecs.startsWith('avc')).sort((a, b) => b.height - a.height)[0]
  if (!v) v = vids.filter(f => f.height <= height).sort((a, b) => b.height - a.height)[0]
  if (!v) v = vids.sort((a, b) => b.height - a.height)[0]
  const a = (dash.audio || [])[0]
  if (!a) throw new Error('未找到音频流')
  const tmpV = outPath + '.v.part'
  const tmpA = outPath + '.a.part'
  const referer = `https://www.bilibili.com/video/${bvid}`
  // 音视频总进度聚合：两流累计字节相加；总大小 = API size 或响应 Content-Length（实时补全）。
  // 都拿不到时 percent=null，前端显示不确定进度 + 已下载字节（绝不假报固定百分比）。
  const vMeta = { recv: 0, total: 0 }, aMeta = { recv: 0, total: 0 }
  const agg = key => p => {
    const m = key === 'v' ? vMeta : aMeta
    if (p.received !== undefined) m.recv = p.received
    if (p.total > 0) m.total = p.total
    const got = vMeta.recv + aMeta.recv
    const tot = (vMeta.total || vMeta.recv) + (aMeta.total || aMeta.recv)
    onProgress && onProgress({ phase: 'download', percent: tot > 0 ? Math.min(100, (got / tot) * 100) : null, received: got, total: tot, speed: p.speed, eta: p.eta })
  }
  onDiag && onDiag(`视频流 ${v.height}P（${v.codecs}）`)
  await downloadStream({ urls: [v.baseUrl, ...(v.backupUrl || [])], outPath: tmpV, referer, size: v.size, onProgress: agg('v'), onDiag, get })
  onDiag && onDiag(`音频流 ${a.size ? (a.size / 1048576).toFixed(1) + 'MB' : ''}`)
  await downloadStream({ urls: [a.baseUrl, ...(a.backupUrl || [])], outPath: tmpA, referer, size: a.size, onProgress: agg('a'), onDiag, get })
  onDiag && onDiag('合并音视频…')
  onProgress && onProgress({ phase: 'merge' })
  await mergeStreams({ videoPath: tmpV, audioPath: tmpA, outPath, ffmpeg })
  try { fs.unlinkSync(tmpV) } catch {}
  try { fs.unlinkSync(tmpA) } catch {}
}

// ---- 裁切参数构造（纯函数，可 headless 测试）----
// mode: 'copy'（快速无损：-ss 在 -i 前做输入级 seek + -t 相对时长）
//       | 'reencode'（帧精确：-ss/-to 在 -i 后做输出级切帧）
// 不用输入级 -to（不同 ffmpeg 版本语义有差异，长视频易出短/坏产物 → bug #5）
function buildTrimArgs({ mode, inPath, outPath, start, end, crf = 23, faststartMaxSec = 1800 }) {
  const dur = Math.max(0, end - start)
  const faststart = dur <= faststartMaxSec ? ['-movflags', '+faststart'] : []
  if (mode !== 'reencode') {
    return ['-y', '-ss', fmtSec(start), '-i', inPath, '-t', fmtSec(dur), '-c', 'copy', ...faststart, '-stats_period', '0.2', outPath]
  }
  return ['-y', '-i', inPath, '-ss', fmtSec(start), '-to', fmtSec(end), '-c:v', 'libx264', '-crf', String(crf), '-preset', 'medium', '-c:a', 'aac', ...faststart, '-stats_period', '0.2', outPath]
}

// 执行 ffmpeg：解析 stderr 的 time=HH:MM:SS 做进度；返回 { ok, err }
function runFfmpeg({ args, ffmpeg = 'ffmpeg', totalMs = 0, onProgress }) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, args, { windowsHide: true })
    trackProc(p)
    let err = ''
    p.stderr.on('data', d => {
      err += d
      const re = /time=(\d+):(\d+):([\d.]+)/g
      let m
      while ((m = re.exec(String(d))) !== null) {
        const t = (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3])
        if (totalMs > 0) onProgress && onProgress({ percent: Math.min(100, (t * 1000 / totalMs) * 100) })
      }
    })
    p.on('error', e => reject(new Error(`无法启动 ffmpeg：${e.message}`)))
    p.on('close', code => resolve({ ok: code === 0, err: lastLine(err) || `ffmpeg 退出码 ${code}` }))
  })
}

// ffprobe 读取时长（秒）；失败返回 null
function probeDuration(file, ffprobe = 'ffprobe') {
  return new Promise(resolve => {
    const p = spawn(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { windowsHide: true })
    trackProc(p)
    let out = ''
    p.stdout.on('data', d => (out += d))
    p.on('error', () => resolve(null))
    p.on('close', code => {
      const n = parseFloat(out.trim())
      resolve(code === 0 && isFinite(n) && n > 0 ? n : null)
    })
  })
}

// 产物校验：能读出时长且在容差内（copy 路径容忍关键帧吸附偏长）
async function validateClip(file, { expectedSec, toleranceSec = 2, ffprobe = 'ffprobe' }) {
  const dur = await probeDuration(file, ffprobe)
  if (dur === null) return { ok: false, dur: null, reason: '无法读取产物' }
  return { ok: Math.abs(dur - expectedSec) <= toleranceSec, dur, reason: `时长 ${dur.toFixed(1)}s 与期望 ${expectedSec.toFixed(1)}s 偏差超限` }
}

// 裁切+压缩：crf 为 null 用流复制（快速无损），否则 libx264 重编码。
// 可靠性保障（bug #5）：copy 产物 ffprobe 校验，失败/时长不符自动重编码重试，保证可播。
// 返回 { mode: 'copy'|'reencode', reencoded }；失败抛错。
async function trimVideo({ inPath, outPath, ffmpeg = 'ffmpeg', ffprobe = 'ffprobe', start, end, crf, totalMs, onProgress, faststartMaxSec = 1800 }) {
  const dur = Math.max(0, end - start)
  if (crf === null || crf === undefined) {
    let r = await runFfmpeg({ args: buildTrimArgs({ mode: 'copy', inPath, outPath, start, end, faststartMaxSec }), ffmpeg, totalMs, onProgress })
    if (r.ok && (await validateClip(outPath, { expectedSec: dur, toleranceSec: 2, ffprobe })).ok) return { mode: 'copy', reencoded: false }
    // copy 产物失效/时长不对 → 自动重编码（帧精确，默认 CRF 23）
    try { fs.unlinkSync(outPath) } catch {}
    const r2 = await runFfmpeg({ args: buildTrimArgs({ mode: 'reencode', inPath, outPath, start, end, crf: 23, faststartMaxSec }), ffmpeg, totalMs, onProgress })
    if (r2.ok && (await validateClip(outPath, { expectedSec: dur, toleranceSec: 0.5, ffprobe })).ok) return { mode: 'reencode', reencoded: true }
    throw new Error(`裁切失败:${[r.err, r2.err].filter(Boolean).join('；') || '产物校验未通过'}`)
  }
  const r3 = await runFfmpeg({ args: buildTrimArgs({ mode: 'reencode', inPath, outPath, start, end, crf, faststartMaxSec }), ffmpeg, totalMs, onProgress })
  if (r3.ok && (await validateClip(outPath, { expectedSec: dur, toleranceSec: 0.5, ffprobe })).ok) return { mode: 'reencode', reencoded: false }
  throw new Error(`压缩失败:${r3.err || '产物校验未通过'}`)
}

// 压缩回退判定：压缩件体积严格大于压缩输入 → 压缩无收益，回退沿用输入（stat 异常保守采纳压缩件）
function needsCompressFallback(inPath, outPath) {
  try { return fs.statSync(outPath).size > fs.statSync(inPath).size } catch { return false }
}

// ---- 合并参数构造（纯函数）----
function buildMergeArgs({ mode, listPath, outPath, crf = 23, faststart = false }) {
  const header = ['-y', '-f', 'concat', '-safe', '0', '-i', listPath]
  const fsOpts = faststart ? ['-movflags', '+faststart'] : []
  if (mode !== 'reencode') return [...header, '-c', 'copy', ...fsOpts, outPath]
  return [...header, '-c:v', 'libx264', '-crf', String(crf), '-preset', 'medium', '-c:a', 'aac', ...fsOpts, outPath]
}

// concat 列表（ffmpeg concat demuxer 语法，转义单引号）
function writeConcatList(listPath, files) {
  const body = files.map(f => `file '${String(f).replace(/'/g, "'\\''")}'`).join('\n') + '\n'
  fs.writeFileSync(listPath, body)
}

// 合并多段：-c copy 拼接优先，产物校验不过 → 重编码拼接（帧精确、兼容异源）。
// 返回 { mode: 'copy'|'reencode' }；失败抛错。
async function mergeSegments({ files, outPath, ffmpeg = 'ffmpeg', ffprobe = 'ffprobe', expectedSec, crf, onProgress, faststartMaxSec = 1800 }) {
  const listPath = outPath + '.concat'
  writeConcatList(listPath, files)
  const faststart = expectedSec <= faststartMaxSec
  let r = await runFfmpeg({ args: buildMergeArgs({ mode: 'copy', listPath, outPath, faststart }), ffmpeg, totalMs: expectedSec * 1000, onProgress })
  if (r.ok && (await validateClip(outPath, { expectedSec, toleranceSec: 2, ffprobe })).ok) { try { fs.unlinkSync(listPath) } catch {}; return { mode: 'copy' } }
  try { fs.unlinkSync(outPath) } catch {}
  const r2 = await runFfmpeg({ args: buildMergeArgs({ mode: 'reencode', listPath, outPath, crf: crf ?? 23, faststart }), ffmpeg, totalMs: expectedSec * 1000, onProgress })
  try { fs.unlinkSync(listPath) } catch {}
  if (r2.ok && (await validateClip(outPath, { expectedSec, toleranceSec: 0.5, ffprobe })).ok) return { mode: 'reencode' }
  throw new Error(`合并失败:${[r.err, r2.err].filter(Boolean).join('；') || '产物校验未通过'}`)
}

// ---- 任务中止追踪（取消时 kill 子进程 + 中断下载流）----
const PROCS = new Set()        // 进行中的 ffmpeg / python 子进程
const DOWNLOADS = new Set()    // 进行中的下载请求 { req, ws }
let ABORTED = false            // 全局中止标志（downloadStream 的 tryNext 检查）
function trackProc(p) { PROCS.add(p); p.on('close', () => PROCS.delete(p)) }
function trackDownload(h) { DOWNLOADS.add(h) }
function abortAll() {
  ABORTED = true
  PROCS.forEach(p => { try { p.kill() } catch {} })
  DOWNLOADS.forEach(h => {
    try { h.req && h.req.destroy() } catch {}
    try { h.ws && h.ws.destroy() } catch {}
  })
  PROCS.clear(); DOWNLOADS.clear()
}
function resetAbort() { ABORTED = false }

// ---- 通用 JSON / 文件工具 ----
function loadCookies(file) {
  try {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'))
    return typeof c.cookie === 'string' && c.cookie.trim() ? c.cookie.trim() : null
  } catch { return null }
}

function saveCookies(file, str) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify({ cookie: str.trim(), savedAt: new Date().toISOString() }, null, 2))
}

function readJson(file, def) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return def }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(obj, null, 2))
}

// 重名加序号：xxx.mp4 已存在 → xxx_2.mp4
function uniquePath(file) {
  if (!fs.existsSync(file)) return file
  const ext = path.extname(file)
  const base = file.slice(0, -ext.length)
  for (let i = 2; ; i++) {
    const cand = `${base}_${i}${ext}`
    if (!fs.existsSync(cand)) return cand
  }
}

// 内嵌转录 Python 代码（faster-whisper，python -c 执行，无需独立脚本文件）
// 用法: python -c "此代码" <模型> <文件1> [<文件2>...]
// 单进程单次加载模型，依次转录多个文件；**逐段输出**（每段识别完立即 flush）：
//   \x1e<文件路径>\x1f<该段文本>\x1f\n（\x1e/\x1f 为单元分隔符，服务端解析聚合）
//   同一文件多行 = 该文件的多个片段；文件末尾输出空文本行作为**完成哨兵**：
//   \x1e<文件路径>\x1f\x1f\n（不产生文本，服务端据此报「第 i/N 个文件完成」）
// 逐段 flush 的意义：长视频不再等整片识别完才蹦出全部文本，前端可实时看到文字在动（ticket 117）。
const PY_TRANSCRIBE = `
import sys
from faster_whisper import WhisperModel
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8')
    except Exception:
        pass
model = WhisperModel(sys.argv[1], device='cpu', compute_type='int8')
for f in sys.argv[2:]:
    # 本机 faster-whisper 的 vad_filter=True(Silero VAD) 会死锁卡死，禁用之（实测 3s 音频 3.6s 完成、无 VAD 亦正常）
    segments, _ = model.transcribe(f, language='zh', vad_filter=False)
    for seg in segments:
        t = (seg.text or '').strip()
        if t:
            sys.stdout.write('\\x1e' + f + '\\x1f' + t + '\\x1f\\n')
            sys.stdout.flush()
    sys.stdout.write('\\x1e' + f + '\\x1f' + '\\x1f\\n')
    sys.stdout.flush()
`

// 解析逐文件转录输出（行格式 \x1e<file>\x1f<text>\x1f）；同文件多行聚合为一条；
// 文件结束空行哨兵（\x1e<file>\x1f\x1f）只标记完成、不贡献文本。按输出序返回 [{file, text}]
function parseTranscriptUnits(raw) {
  const out = []
  const byFile = new Map()
  for (const line of String(raw || '').split(/\r?\n/)) {
    if (!line.startsWith('\x1e')) continue
    const rest = line.slice(1)
    const sep = rest.indexOf('\x1f')
    if (sep < 0) continue
    const file = rest.slice(0, sep)
    let text = rest.slice(sep + 1)
    if (text.endsWith('\x1f')) text = text.slice(0, -1)
    if (!file) continue
    text = text.trim()
    if (!text) continue   // 完成哨兵：不计文本
    const prev = byFile.get(file)
    if (prev) prev.text = prev.text ? prev.text + ' ' + text : text
    else { const u = { file, text }; byFile.set(file, u); out.push(u) }
  }
  return out
}

// 转文字：python -c 执行内嵌代码；stdout 逐块回调（修复原版双监听导致的文本双写）
function runPython({ py, args, onChunk }) {
  return new Promise((resolve, reject) => {
    const p = spawn(py, ['-c', PY_TRANSCRIBE, ...args], { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } })
    trackProc(p)   // 取消任务时可 kill 中止转录
    let err = ''
    p.stdout.on('data', d => { const s = String(d); onChunk && onChunk(s) })
    p.stderr.on('data', d => { err += d })
    p.on('error', e => reject(new Error(`无法启动 Python：${e.message}`)))
    p.on('close', code => { if (code !== 0) reject(new Error(lastLine(err) || `Python 退出码 ${code}`)); else resolve() })
  })
}

// ---- 视频缓存（F1）：只缓存「下载原件」，键 = BV + cid(分P) + 清晰度 ----
function cacheKey(bv, cid, quality) {
  return `${bv}_${cid}_${quality}`
}

// 缓存目录：rc cacheDir 可选，缺省系统临时目录下 bili-dl-cache
function getCacheDir(conf) {
  return (conf && conf.cacheDir) ? conf.cacheDir : path.join(os.tmpdir(), 'bili-dl-cache')
}

function cachePath(conf, key) {
  return path.join(getCacheDir(conf), `${key}.mp4`)
}

// 启动清扫：删除超过 cacheRetentionDays（默认 7）天的缓存原件与断点续跑产物；返回删除数
function cleanupCache(conf, now = Date.now()) {
  const dir = getCacheDir(conf)
  let files = []
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.mp4') || f.startsWith('resume-')) } catch { return 0 }
  if (!files.length) return 0
  const maxAge = Math.max(0, Number((conf && conf.cacheRetentionDays) || 7)) * 86400000
  let removed = 0
  for (const f of files) {
    const p = path.join(dir, f)
    try { if (now - fs.statSync(p).mtimeMs > maxAge) { fs.unlinkSync(p); removed++ } } catch {}
  }
  return removed
}

// ---- 断点续跑产物缓存（ADR-0067 用户拍板：重试从出错步骤继续，成功步骤产物留存复用）----
// ticket 136 起只留机械产物（剪辑件/压缩件/转写稿），AI 元数据/润色分块缓存随 AI 回迁 bz 插件而移除。
// 键 = BV + cid(分P) + 起止范围（0.1s 精度，整片 = 0-duration）；文件放 cacheDir（cleanupCache 同保留期回收）。
function resumeKey(bv, cid, s, e) {
  const bit = n => String(Math.round((Number(n) || 0) * 10))
  return `${bv}_${cid}_${bit(s)}-${bit(e)}`
}
function resumeClipPath(conf, bv, cid, height, s, e) {
  return path.join(getCacheDir(conf), `resume-clip-${resumeKey(bv, cid, s, e)}-${height}.mp4`)
}
function resumeCompressedPath(conf, bv, cid, crf, s, e) {
  return path.join(getCacheDir(conf), `resume-compress-${resumeKey(bv, cid, s, e)}-crf${crf}.mp4`)
}
function resumeTranscriptPath(conf, bv, cid, s, e) {
  return path.join(getCacheDir(conf), `resume-transcript-${resumeKey(bv, cid, s, e)}.txt`)
}





// ---- 无头批处理（--batch）：runBatch ----
// 契约（与 Obsidian 插件「文献盒」面板对齐，cli.js --batch 调用；ticket 136 起 AI/文献笔记回迁 bz）：
// 插件经 shell 启动（.cmd shim 需 shell:true）时 JSON 的引号/空格会被 cmd 对消破坏，故传 `b64:<base64>`；
// 手动命令行 `--batch '<json>'` 直传 JSON 照常支持（decodeBatchArg 二者皆收，P2-5）。
//   task = { url, start, end, page, options }；start/end 为 'HH:MM:SS(.S)'/'MM:SS'/秒 或 null；都 null = 整片不剪辑。
//   task.page（可选，ADR-0067 添加界面分P选择）：1 起的分P 序号，越界/缺省 = 第 1 P（按 P 独立缓存键）。
//   task.options（bz「文献盒」设置全量下发，全部可选）：quality='720'|'1080'|'highest'（缺省最高）、
//     keepVideo=false 跳过交付（video 结果 null）、outputDir 覆盖交付目录（空跟随 conf.outputDir）、
//     compress=false 关闭压缩（缺省开，用户拍板）、crf=18-28（缺省 23）、vaultPath/ffmpegPath/ffprobePath/
//     pythonPath/whisperModel/cacheDir/cacheRetentionDays（缺省跟随 conf / rc 兜底）。
//   deps（全部可注入，防循环依赖——core 不 require config.js，conf 由调用方读入传入）：
//     conf（必需：vaultPath/outputDir/cacheDir/ffmpegPath/ffprobePath/pythonPath/whisperModel）、
//     cookie、fetchJson/get（网络注入，测试打桩）、ffmpeg、ffprobe、py、
//     runPythonImpl（转录打桩）、onStep(名称)、onProgress(进度)、onInfo(解析信息 {title,uploader,bvid,url,duration})、tmpDir。
// 步骤时序：resetAbort → 解析 → 下载（缓存命中检测与回写）→ 剪辑（起止有值才跑）→ 压缩（缺省开，crf 重编码）
//   → 转文字（runPython + PY_TRANSCRIBE，parseTranscriptUnits 收文本）→ 写转录临时文件 → 交付（keepVideo 才跑）。
//   **不再写文献笔记**（AI 与笔记落盘由 bz 插件完成）。
// 进度：onProgress({phase:'download'|'trim'|'compress'|'transcribe', pct})，pct 为 0-100 或 null（不确定，绝不假报）；
//   300ms 节流聚合高频事件。步骤行 onStep 覆盖：解析中/下载中/剪辑中/压缩中/转文字中/交付中。
// 断点续跑（ADR-0067，ticket 136 缩减为机械产物）：剪辑件/压缩件/转写稿留存 cacheDir（resume-*），
//   重跑自动跳过已完成步骤；AI 元数据/润色分块缓存已随 AI 回迁移除。cleanupCache 同保留期回收。
// 返回 { transcript, video, transcriptPath, videoPath, title, bvid, duration }：
//   transcript = 转录临时文件**绝对路径**（UTF-8 全文，插件读取后自删）；video = vault 相对/绝对 或 null（未交付）。
//   任一步失败抛错（中文文案带缺失前置引导）。
/**
 * 解析 --batch 参数（P2-5）：`b64:` 前缀 = base64 编码的 JSON（插件经 shell（.cmd shim）启动时
 * JSON 引号/空格被 shell 对消破坏——Windows cmd 实测 argv 变 `{\"…` 报 position 1 JSON 错；
 * base64 无引号无空格，shell 全程安全）；否则按 JSON 直解析（手动命令行）。
 * 抛错沿用 JSON.parse 原生错误（cli.js 包中文前缀）。
 */
function decodeBatchArg(raw) {
  if (typeof raw === 'string' && raw.indexOf('b64:') === 0) {
    return JSON.parse(Buffer.from(raw.slice(4), 'base64').toString('utf8'))
  }
  return JSON.parse(raw)
}

function vaultRel(absPath, vaultPath) {
  if (!vaultPath) return absPath
  const vaultAbs = path.resolve(vaultPath)
  const rel = path.relative(vaultAbs, absPath)
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return rel.replace(/\\/g, '/')
  return absPath
}

async function runBatch(task, deps = {}) {
  resetAbort()   // 全局中止标志复位（server resetTask 同规）
  // conf 缺省 = rc（调用方读入），task.options（bz 文献盒设置全量下发）并入 conf——
  // 让 options 里的 vaultPath/ffmpegPath/ffprobePath/pythonPath/whisperModel/cacheDir/cacheRetentionDays/outputDir 覆盖 rc 兜底
  const conf = { ...(deps.conf || {}), ...((task && task.options) || {}) }
  const cookie = deps.cookie || null
  const fetchJson = deps.fetchJson || fetchJsonImpl
  const get = deps.get
  const ffmpeg = deps.ffmpeg || conf.ffmpegPath || 'ffmpeg'
  const ffprobe = deps.ffprobe || conf.ffprobePath || 'ffprobe'
  const py = deps.py || conf.pythonPath
  const model = conf.whisperModel || 'small'
  const runPythonImpl = deps.runPythonImpl || runPython
  const onStep = deps.onStep || (() => {})
  const onProgress = deps.onProgress || (() => {})
  // 进度行节流：各环 150ms 级高频事件聚合为每阶段 ≤300ms 一行（[bz-p] 协议行，插件逐行解析驱动行内进度）。
  // 按 phase 独立计时——快速衔接的阶段（如缓存命中后转写→AI）互不吞行，跨阶段进度不会丢失。
  const lastPgAt = {}
  const pg = p => {
    const now = Date.now()
    if (now - (lastPgAt[p.phase] || 0) < 300) return
    lastPgAt[p.phase] = now
    onProgress(p)
  }
  const tmpDir = deps.tmpDir || fs.mkdtempSync(path.join(os.tmpdir(), 'bili-dl-batch-'))

  const url = String((task && task.url) || '').trim()
  if (!url) throw new Error('缺少 url（B站视频链接或 BV 号）')

  // ① 解析
  onStep('解析中')
  const info = await parseVideo({ url, cookie, fetchJson })

  // ② 下载（缓存命中检测与回写，同 /api/download）
  onStep('下载中')
  const bvid = extractBv(url)
  // 解析信息回传（[bz-info] 行，ADR-0067）：标题/UP主 供插件落库、面板行内以「文字+链接」展示
  const onInfo = deps.onInfo || (() => {})
  try {
    onInfo({
      title: info.title || '', uploader: info.uploader || '',
      bvid, url: bvid ? `https://www.bilibili.com/video/${bvid}` : url, duration: info.duration || 0,
    })
  } catch { /* 信息回传失败不阻断流程 */ }
  // 分P 选择（task.page 1 起，ADR-0067）：越界/缺省/非数字 → 第 1 P；cid 随 P 变 → 按 P 独立缓存键
  const pageNum = Number(task && task.page)
  const selPage = Number.isFinite(pageNum) && pageNum >= 1 ? (info.pages || [])[pageNum - 1] : null
  const playCid = selPage && selPage.cid ? selPage.cid : info.cid
  // 清晰度设置项（task.options.quality）：720/1080 精确档，highest/缺省跟随 parse 最高可用
  const qOpt = task && task.options ? task.options.quality : undefined
  const height = qOpt === '720' ? 720 : qOpt === '1080' ? 1080 : (deps.quality || info.maxHeight)
  const cachedPath = cachePath(conf, cacheKey(bvid, playCid, height))
  const originalPath = path.join(tmpDir, `bili_${Date.now()}.mp4`)
  if (fs.existsSync(cachedPath)) {
    fs.copyFileSync(cachedPath, originalPath)
  } else {
    await downloadVideo({
      url, cookie, height, cid: playCid, outPath: originalPath, ffmpeg, fetchJson, get,
      onProgress: p => pg({ phase: 'download', pct: Number.isFinite(p.percent) ? p.percent : null }),
    })
    // 未命中下载完成后回写缓存（剪辑/压缩件不进缓存）
    try { fs.mkdirSync(path.dirname(cachedPath), { recursive: true }); fs.copyFileSync(originalPath, cachedPath) } catch {}
  }

  // ③ 剪辑（起止都有值才跑；parseTimeInput 转秒；越界/非法区间 clampSeg 同规 → 按整片）
  let seg = null
  let srcForDeliver = originalPath
  let resumeClipUsed = false   // 断点续跑命中剪辑缓存：交付后不得删缓存件
  let resumeCompressUsed = false   // 断点续跑命中压缩缓存：交付后不得删缓存件
  let srcDur = info.duration   // 压缩/转文字用的源时长（剪辑后为段长，整片为全片）
  // 断点续跑区间键（ADR-0067）：无剪辑/整片 → [0, duration]；剪辑 → [start, end]
  let rStart = 0
  let rEnd = info.duration
  const hasRange = task.start != null && task.end != null &&
    String(task.start).trim() !== '' && String(task.end).trim() !== ''
  if (hasRange) {
    const start = parseTimeInput(task.start)
    const end = parseTimeInput(task.end)
    if (start === null || end === null) throw new Error('起止时间格式错误（HH:MM:SS.S / MM:SS / 秒）')
    let s = Math.max(0, start)
    let e = Math.min(info.duration, end)
    if (e - s < 0.1) { s = 0; e = info.duration }
    seg = { start: s, end: e, full: !(s > 0 || e < info.duration) }
    if (!seg.full) {
      rStart = s
      rEnd = e
      srcDur = e - s
      onStep('剪辑中')
      // 断点续跑：剪辑件留存（resume-clip-*.mp4），命中即跳过 ffmpeg，从下一环继续
      const clipCache = resumeClipPath(conf, bvid, playCid, height, s, e)
      if (fs.existsSync(clipCache)) {
        srcForDeliver = clipCache
        resumeClipUsed = true
      } else {
        const clipPath = path.join(tmpDir, `bili_${Date.now()}_clip.mp4`)
        // crf=null：流复制优先，ffprobe 校验不过自动重编码兜底（不压缩）
        await trimVideo({
          inPath: originalPath, outPath: clipPath, ffmpeg, ffprobe, start: s, end: e, crf: null, totalMs: (e - s) * 1000,
          onProgress: p => pg({ phase: 'trim', pct: Number.isFinite(p.percent) ? p.percent : null }),
        })
        srcForDeliver = clipPath
        try { fs.mkdirSync(path.dirname(clipCache), { recursive: true }); fs.copyFileSync(clipPath, clipCache) } catch {}
      }
    }
  }

  // ③.5 压缩（缺省开，用户拍板 ticket 136；crf 默认 23、钳制 18-28；断点续跑：压缩件留存 resume-compress-*.mp4）
  const opts = (task && task.options) || {}
  const compressEnabled = opts.compress !== false
  const crf = Math.min(28, Math.max(18, Number(opts.crf) || 23))
  /** 实际采纳压缩件（压缩回退时为 false——交付文件名不带 _crf 标记；断点续跑命中压缩缓存恒为 true） */
  let compressedAdopted = false
  if (compressEnabled) {
    onStep('压缩中')
    const compressCache = resumeCompressedPath(conf, bvid, playCid, crf, rStart, rEnd)
    if (fs.existsSync(compressCache)) {
      srcForDeliver = compressCache
      resumeCompressUsed = true
      compressedAdopted = true
    } else {
      const prev = srcForDeliver
      const compressPath = path.join(tmpDir, `bili_${Date.now()}_crf${crf}.mp4`)
      await trimVideo({ inPath: srcForDeliver, outPath: compressPath, ffmpeg, ffprobe, start: 0, end: srcDur, crf, totalMs: srcDur * 1000, onProgress: p => pg({ phase: 'compress', pct: Number.isFinite(p.percent) ? p.percent : null }) })
      // 压缩回退（用户拍板；原网页版旧有、CLI 迁移时移除，本次补回）：压缩件体积严格大于压缩输入（原件/剪辑件）
      // → 压缩无收益，丢弃压缩件、沿用输入交付（不写压缩缓存、文件名不带 _crf 标记）；stat 异常保守采纳压缩件。
      if (needsCompressFallback(prev, compressPath)) {
        try { fs.unlinkSync(compressPath) } catch {}
        srcForDeliver = prev
      } else {
        // 压缩消费了中间剪辑临时件（非原件、非缓存件）→ 立即删，避免临时目录泄漏
        if (prev !== originalPath && !resumeClipUsed) { try { fs.unlinkSync(prev) } catch {} }
        srcForDeliver = compressPath
        compressedAdopted = true
        try { fs.mkdirSync(path.dirname(compressCache), { recursive: true }); fs.copyFileSync(compressPath, compressCache) } catch {}
      }
    }
  }

  // ④ 转文字（断点续跑：转写稿留存 resume-transcript-*.txt，命中即跳过 python，从下一环继续）
  onStep('转文字中')
  if (!py) throw new Error('转文字失败：未配置 pythonPath——请在 bz 插件文献盒设置「Python 路径」填 python（一般装了 Python 即可，spawn 走系统 PATH），或填绝对路径（Windows 命令提示符运行 where python 可查）')
  const transPath = resumeTranscriptPath(conf, bvid, playCid, rStart, rEnd)
  let transcript = ''
  if (fs.existsSync(transPath)) {
    transcript = String(fs.readFileSync(transPath, 'utf8') || '').trim()
  } else {
    let raw = ''
    let doneFiles = 0
    try {
      await runPythonImpl({
        py, args: [model, srcForDeliver],
        onChunk: s => {
          raw += s
          // 完成哨兵（\x1e<file>\x1f\x1f）计数 → 文件级进度（当前单文件：0→100 跳变，诚实不假报）
          doneFiles += (String(s).match(/\x1e[^\x1f]*\x1f\x1f/g) || []).length
          pg({ phase: 'transcribe', pct: doneFiles >= 1 ? 100 : null })
        },
      })
    } catch (err) {
      const m = (err && err.message) || err
      // 找不到 Python（可执行名不在 PATH / 绝对路径不存在）→ 引导填写方式，不误导成 faster-whisper 未装
      if (/无法启动 Python|ENOENT/i.test(String(m))) {
        throw new Error(`转文字失败：找不到 Python（${lastLine(String(m))}）——文献盒设置「Python 路径」填 python 即可（走系统 PATH），或填绝对路径（Windows 命令提示符运行 where python 可查）`)
      }
      throw new Error(`转文字失败：${m}（请确认 faster-whisper 环境已安装：目标 Python 已 pip install faster-whisper）`)
    }
    const units = parseTranscriptUnits(raw)
    const byFile = new Map(units.map(u => [path.resolve(u.file), u.text]))
    transcript = (byFile.get(path.resolve(srcForDeliver)) || '').trim()
    if (!transcript) throw new Error('转文字未产出文本（视频可能无语音，或请确认 faster-whisper 环境可用、模型正常加载）')
    try { fs.writeFileSync(transPath, transcript, 'utf8') } catch {}
  }

  // ⑤ 转录临时文件：转录全文 UTF-8 写系统临时目录（非批次临时目录——CLI 退出后插件仍需读取），返回绝对路径
  const transcriptTemp = path.join(os.tmpdir(), `bili-dl-transcript-${resumeKey(bvid, playCid, rStart, rEnd)}-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`)
  fs.writeFileSync(transcriptTemp, transcript, 'utf8')

  // ⑥ 交付：文件移入 outputDir（copyFileSync + unlink，exFAT 兼容；重名 uniquePath 加序号）；
  //    输出目录可被 task.options.outputDir 覆盖；「保留视频原件」关（keepVideo=false）→ 整步跳过，
  //    video 结果 null（转录临时文件仍产出——插件据此生成文献笔记）。
  const keepVideo = !(opts.keepVideo === false)
  let finalPath = null
  if (keepVideo) {
    onStep('交付中')
    const outOverride = String(opts.outputDir || '').trim()
    if (!conf.outputDir && !outOverride) throw new Error('交付目录未配置（rc outputDir 或 options.outputDir），请在 bz 插件文献盒设置中填写')
    const outDirAbs = outOverride ? path.resolve(outOverride) : path.resolve(conf.outputDir)
    fs.mkdirSync(outDirAbs, { recursive: true })
    const name = buildFileName({
      title: info.title, bv: bvid,
      page: selPage && pageNum > 1 ? pageNum : '',   // 第 2 P 起文件名带 _N
      trimmed: seg ? !seg.full : false,
      start: seg ? seg.start : 0, end: seg ? seg.end : info.duration,
      duration: info.duration, compressed: compressedAdopted, crf,
    })
    finalPath = uniquePath(path.join(outDirAbs, name))
    fs.copyFileSync(srcForDeliver, finalPath)
    if (srcForDeliver !== originalPath && !resumeClipUsed && !resumeCompressUsed) { try { fs.unlinkSync(srcForDeliver) } catch {} }   // 剪辑/压缩临时件已交付，删（缓存件不删）
  }

  return {
    transcript: transcriptTemp,
    video: finalPath ? vaultRel(finalPath, conf.vaultPath) : null,
    transcriptPath: transcriptTemp,
    videoPath: finalPath,
    title: info.title, bvid, duration: info.duration,
  }
}

module.exports = {
  UA, MIXIN_KEY_ENC_TAB, getMixinKey, fetchJsonImpl, getWbiKeys, wbiSign, getViewInfo, getPlayUrls,
  lastLine, qualityLabel, sanitizeName, extractBv, fmtTime, fmtDuration, fmtSec, parseTimeInput, buildFileName,
  parseVideo, fmtEta, downloadStream, mergeStreams, downloadVideo,
  buildTrimArgs, runFfmpeg, probeDuration, validateClip, trimVideo, needsCompressFallback,
  buildMergeArgs, writeConcatList, mergeSegments,
  loadCookies, saveCookies, readJson, writeJson, uniquePath,
  abortAll, resetAbort, trackProc, runPython, PY_TRANSCRIBE, parseTranscriptUnits,
  cacheKey, getCacheDir, cachePath, cleanupCache,
  resumeKey, resumeClipPath, resumeCompressedPath, resumeTranscriptPath,
  vaultRel, decodeBatchArg, runBatch,
}
