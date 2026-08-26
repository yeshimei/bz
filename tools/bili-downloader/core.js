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
// 单进程单次加载模型，依次转录多个文件；每文件一行输出：
//   \x1e<文件路径>\x1f<该文件全文>\x1f\n（\x1e/\x1f 为单元分隔符，服务端解析归位）
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
    parts = [seg.text.strip() for seg in segments if seg.text.strip()]
    sys.stdout.write('\\x1e' + f + '\\x1f' + ' '.join(parts) + '\\x1f\\n')
    sys.stdout.flush()
`

// 解析逐文件转录输出（行格式 \x1e<file>\x1f<text>\x1f）；按输出序返回 [{file, text}]
function parseTranscriptUnits(raw) {
  const out = []
  for (const line of String(raw || '').split(/\r?\n/)) {
    if (!line.startsWith('\x1e')) continue
    const rest = line.slice(1)
    const sep = rest.indexOf('\x1f')
    if (sep < 0) continue
    const file = rest.slice(0, sep)
    let text = rest.slice(sep + 1)
    if (text.endsWith('\x1f')) text = text.slice(0, -1)
    if (file) out.push({ file, text: text.trim() })
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

// 启动清扫：删除超过 cacheRetentionDays（默认 7）天的缓存原件；返回删除数
function cleanupCache(conf, now = Date.now()) {
  const dir = getCacheDir(conf)
  let files = []
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.mp4')) } catch { return 0 }
  if (!files.length) return 0
  const maxAge = Math.max(0, Number((conf && conf.cacheRetentionDays) || 7)) * 86400000
  let removed = 0
  for (const f of files) {
    const p = path.join(dir, f)
    try { if (now - fs.statSync(p).mtimeMs > maxAge) { fs.unlinkSync(p); removed++ } } catch {}
  }
  return removed
}

// ---- 文献笔记（F3/F4）：文件名 / frontmatter / 分块 / AI ----
// 笔记文件名 = AI 标题：清洗 Windows 非法字符 + 空白折叠 + 截断 50 字 + 空兜底
function sanitizeMdTitle(s) {
  const t = String(s).replace(/[\\/:*?"<>|#^[\]]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 50)
  return t || '文献笔记'
}

// 转写文稿分块：优先按句边界（。！？；）切，单块不超 maxLen；超长单句硬切。
// faster-whisper 输出为无换行的连接文本，句边界即自然段落。
function chunkTranscript(text, maxLen = 4000) {
  const src = String(text || '').trim()
  if (!src) return []
  const segs = src.split(/(?<=[。！？!?；;])/).map(s => s.trim()).filter(Boolean)
  const chunks = []
  let cur = ''
  for (const seg of segs) {
    if (cur && (cur + seg).length > maxLen) { chunks.push(cur); cur = '' }
    if (seg.length <= maxLen) { cur += seg; continue }
    if (cur) { chunks.push(cur); cur = '' }   // 前一块已入列，再硬切超长句
    let rest = seg
    while (rest.length > maxLen) { chunks.push(rest.slice(0, maxLen)); rest = rest.slice(maxLen) }
    cur = rest
  }
  if (cur) chunks.push(cur)
  return chunks
}

// frontmatter 引号包裹（对齐 auto-summary 的 YAML 风格，防冒号/引号破坏结构）
function quoteYaml(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

// 组装文献笔记全文（1.2.7）：frontmatter 七键 + 逐段「润色正文 + 视频双链」块依次排布
// （blocks: [{text, wiki}] 每组 = 该段润色正文在上、双链在下；字符串项兼容为纯双链行）
function buildLiteratureNote({ title, tags = [], summary, url, date, author, videoTitle, blocks = [] }) {
  const tagLines = (Array.isArray(tags) ? tags : []).map(t => `  - ${quoteYaml(t)}`).join('\n')
  const head = ['---',
    `title: ${quoteYaml(title)}`,
    'tags:',
    tagLines,
    `summary: ${quoteYaml(summary || '')}`,
    `url: ${quoteYaml(url || '')}`,
    `date: ${quoteYaml(date || '')}`,
    `author: ${quoteYaml(author || '')}`,
    `videoTitle: ${quoteYaml(videoTitle || '')}`,
    '---',
  ].join('\n')
  const groups = (Array.isArray(blocks) ? blocks : []).filter(Boolean).map(item => {
    if (typeof item === 'string') return item
    const w = item && item.wiki ? String(item.wiki) : ''
    const t = item && item.text ? String(item.text) : ''
    return [t, w].filter(Boolean).join('\n\n')
  })
  return [head, ...groups].filter(Boolean).join('\n\n')
}

// ---- AI 直读 bz 配置（F2）：provider 映射与 bz core/ai.ts 同套，工具侧持有副本 ----
const AI_TIMEOUT_MS = 180000
const AI_PROVIDERS = {
  'opencode-go': { endpoint: 'https://opencode.ai/zen/go/v1', model: 'deepseek-v4-flash', keyField: 'opencodeGoApiKey' },
  deepseek: { endpoint: 'https://api.deepseek.com', model: 'deepseek-v4-flash', keyField: 'deepseekApiKey' },
}

// 直读 <vaultPath>/.obsidian/plugins/bz/data.json（只读；无 quickadd 回退，缺 key 报错）
function loadBzAiConfig(conf) {
  const vaultPath = conf && conf.vaultPath
  if (!vaultPath) throw new Error('AI 配置读取失败：rc 未配置 vaultPath')
  const data = readJson(path.join(vaultPath, '.obsidian', 'plugins', 'bz', 'data.json'), null)
  if (!data) throw new Error('AI 配置读取失败：找不到 bz 插件数据文件（请确认 bz 插件已安装在该 vault）')
  const name = data.aiProvider || 'opencode-go'
  const p = AI_PROVIDERS[name]
  if (!p) throw new Error(`AI 配置错误：不支持的 provider ${name}`)
  const apiKey = data[p.keyField]
  if (!apiKey) throw new Error(`AI 密钥缺失：请先在 bz（备忘录插件）设置中填写（${name === 'deepseek' ? 'DeepSeek' : 'OpenCode Go'} API Key）`)
  return { provider: name, endpoint: p.endpoint, apiKey, model: p.model }
}

// AI 错误信息提取：兼容 OpenAI（{error:{message}}) 与 opencode（{error:{error:{message}}}）格式
function aiErrMsg(j) {
  if (!j) return ''
  const e = j.error
  if (e && typeof e === 'object') return e.message || e.msg || ((e.error && (e.error.message || e.error.msg)) || '')
  if (typeof e === 'string') return e
  return j.message || ''
}

// OpenAI 兼容 chat/completions（原生 https，零依赖；显式超时默认 180s）
function aiChat({ endpoint, apiKey, model, messages, temperature = 0.3, maxTokens, responseFormat, timeoutMs = AI_TIMEOUT_MS, requestImpl = https.request }) {
  return new Promise((resolve, reject) => {
    const url = `${String(endpoint).replace(/\/+$/, '')}/chat/completions`
    const body = JSON.stringify({
      model, messages,
      temperature,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      ...(responseFormat ? { response_format: { type: responseFormat } } : {}),
    })
    const req = requestImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      timeout: timeoutMs,
    }, res => {
      let d = ''
      res.on('data', c => (d += c))
      res.on('end', () => {
        let j
        try { j = JSON.parse(d) } catch { return reject(new Error('AI 响应解析失败')) }
        if (!res.statusCode || res.statusCode >= 400) {
          return reject(new Error(`AI 请求失败：${aiErrMsg(j) || 'HTTP ' + res.statusCode}`))
        }
        const content = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content
        if (content == null) return reject(new Error('AI 响应缺少内容'))
        resolve(String(content).trim())
      })
    })
    req.on('error', e => reject(new Error(`AI 请求失败：${e.message}`)))
    req.on('timeout', () => { req.destroy(new Error('AI 请求超时')) })
    req.write(body)
    req.end()
  })
}

// JSON 模式调用：response_format=json_object + 残留文本容错提取
async function aiJson(args) {
  const content = await aiChat({ ...args, responseFormat: 'json_object' })
  try { return JSON.parse(content) } catch {}
  const m = content.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch {} }
  throw new Error('AI 返回的不是 JSON：' + content.slice(0, 120))
}

// 元数据提示词（1.2.7：标题/tags 规则对齐 bz 自动摘要；简介维持一句话 ≤60 字；全部简体中文）
function literatureMetaPrompt(videoTitle, transcriptSample) {
  return `你是文献整理助手。基于下方 B站视频《${videoTitle || '未命名'}》的转写文稿片段，生成文献笔记元数据。只输出 JSON，不要任何解释：
{"title": "15-30字的中文完整陈述句或疑问句，禁止冒号、破折号、句中句号问号，需要连接时用逗号", "tags": ["3-6个中文标签，每个不超过5个字，涵盖主题领域、关键概念、应用场景"], "summary": "一句话简介，不超过60字"}
所有字段一律使用简体中文。\n\n【转写文稿片段】\n${transcriptSample}`
}

// 润色提示词（轻度：口语转书面、去口水词，保原顺序原内容；简体中文兜底——繁体转写一并转为简体）
function literaturePolishPrompt(chunk) {
  return `你是文字编辑。把下面的视频转写文稿轻度润色为书面语：口语转书面、删除口水词与重复内容，保持原顺序、原事实（数字与专名不变）。输出必须是简体中文（繁体转写一律转为简体）。直接输出润色后的正文，不要解释、不要加标题、不要列表。\n\n【转写文稿】\n${chunk}`
}

module.exports = {
  UA, MIXIN_KEY_ENC_TAB, getMixinKey, fetchJsonImpl, getWbiKeys, wbiSign, getViewInfo, getPlayUrls,
  lastLine, qualityLabel, sanitizeName, extractBv, fmtTime, fmtDuration, fmtSec, parseTimeInput, buildFileName,
  parseVideo, fmtEta, downloadStream, mergeStreams, downloadVideo,
  buildTrimArgs, runFfmpeg, probeDuration, validateClip, trimVideo,
  buildMergeArgs, writeConcatList, mergeSegments,
  loadCookies, saveCookies, readJson, writeJson, uniquePath,
  abortAll, resetAbort, trackProc, runPython, PY_TRANSCRIBE, parseTranscriptUnits,
  cacheKey, getCacheDir, cachePath, cleanupCache,
  sanitizeMdTitle, chunkTranscript, buildLiteratureNote,
  AI_TIMEOUT_MS, AI_PROVIDERS, loadBzAiConfig, aiChat, aiJson,
  literatureMetaPrompt, literaturePolishPrompt,
}
