// ================================================================
// B站下载器 - 前端交互（vanilla，无依赖）
// 与 server.js 的 API + SSE 协作；剪贴板交付：
//   转录完成 → 自动复制转录文本；完成 → 复制 wikilink 或
//   wikilink + 空行 + 转录全文（服务端组装，前端写入剪贴板）
// ================================================================
const $ = id => document.getElementById(id)

const fmtDuration = t => {
  const s = Math.max(0, Math.round(t))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
const fmtMB = b => (b / 1048576).toFixed(1) + 'MB'

async function api(path, method = 'GET', body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await res.json().catch(() => ({ ok: false, error: '响应解析失败' }))
  if (!j.ok) throw new Error(j.error || '请求失败')
  return j
}

let toastTimer
function toast(msg, isErr = false) {
  const el = $('toast')
  el.textContent = (isErr ? '❌ ' : '') + msg
  el.classList.remove('hidden')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3600)
}

// ---- 任务状态（单任务）----
const S = { info: null, quality: 0, crf: 23, start: 0, end: 0, dur: 0, transcript: '', busy: false, derived: false }
const OP_BTNS = ['parse-btn', 'dl-btn', 'trim-btn', 'compress-btn', 'transcribe-btn', 'done-btn', 'ts-copy', 'cookie-save-btn', 'settings-save']
function setBusy(b) {
  S.busy = b
  OP_BTNS.forEach(id => { const el = $(id); if (el) el.disabled = b })
  $('ts-text').readOnly = b
  $('cancel-btn').classList.toggle('hidden', !b)
}

// ---- SSE ----
const es = new EventSource('/events')
es.onmessage = e => {
  const d = JSON.parse(e.data)
  if (d.type === 'busy') setBusy(d.busy)
  else if (d.type === 'diag') $('dl-diag').textContent = d.text
  else if (d.type === 'download-progress') {
    const fill = $('dl-fill'), txt = $('dl-text')
    if (d.phase === 'merge') { fill.classList.add('indet'); txt.textContent = '合并音视频…' }
    else {
      fill.classList.remove('indet')
      fill.style.width = `${d.percent}%`
      txt.textContent = `${d.percent.toFixed(1)}% · ${d.speed || '?'} · ETA ${d.eta || '?'}`
    }
  } else if (d.type === 'trim-progress') {
    // 当前操作（trim/compress）由发起方记录在 S.op
    const fill = S.op === 'compress' ? $('cp-fill') : $('trim-fill')
    const txt = S.op === 'compress' ? $('cp-text') : $('trim-text')
    if (fill) fill.style.width = `${d.percent}%`
    if (txt) txt.textContent = `${d.percent.toFixed(0)}% · ${S.op === 'compress' ? '编码中…' : '裁切中…'}`
  } else if (d.type === 'transcript-chunk') {
    $('ts-text').value += d.text
  } else if (d.type === 'cookie-status') {
    onCookieStatus(d.valid)
  }
}

// ---- Cookie 状态 ----
function onCookieStatus(valid) {
  const guide = $('cookie-guide')
  if (valid === null) { $('cookie-status').textContent = 'Cookie 验证中…'; return }
  if (valid) { guide.classList.add('hidden'); return }
  $('cookie-status').textContent = '⚠️ Cookie 未配置或已失效：只能下载低清晰度（≤720P），请到设置页粘贴。'
  guide.classList.remove('hidden')
  const c2 = $('cookie-status2')
  if (c2) c2.textContent = '⚠️ Cookie 未配置或已失效'
  c2.className = 'hint err'
}

// ---- 解析 ----
async function doParse() {
  const url = $('url').value.trim()
  if (!url) return toast('请输入B站链接', true)
  const btn = $('parse-btn')
  btn.disabled = true
  btn.textContent = '解析中…'
  try {
    const r = await api('/api/parse', 'POST', { url })
    S.info = r.info
    const savedQ = parseInt(localStorage.getItem('bili-quality'))
    S.quality = savedQ && r.info.formats.some(f => f.height === savedQ) ? savedQ : r.info.maxHeight
    renderCard()
    $('card-wrap').classList.remove('hidden')
    $('dl-wrap').classList.remove('hidden')
    $('preview-wrap').classList.add('hidden')
    $('ts-wrap').classList.add('hidden')
    $('result-wrap').classList.add('hidden')
    $('done-btn').disabled = true
    $('dl-diag').textContent = ''
    $('dl-fill').style.width = '0'
    $('dl-text').textContent = ''
    $('trim-fill').style.width = '0'
    $('trim-text').textContent = ''
    $('cp-fill').style.width = '0'
    $('cp-text').textContent = ''
    $('cp-feedback').classList.add('hidden')
  } catch (e) {
    toast(e.message, true)
  } finally {
    btn.disabled = false
    btn.textContent = '解析'
  }
}
$('parse-btn').onclick = doParse
$('url').addEventListener('keydown', e => { if (e.key === 'Enter') doParse() })

function renderCard() {
  const i = S.info
  $('cover').src = i.thumbnail
  $('title').textContent = i.title
  $('meta').textContent = `${i.uploader} · ${fmtDuration(i.duration)}`
  const chips = $('chips')
  chips.innerHTML = ''
  for (const f of i.formats) {
    const c = document.createElement('div')
    c.className = 'chip' + (f.height === S.quality ? ' sel' : '')
    c.textContent = f.label
    c.onclick = () => {
      S.quality = f.height
      localStorage.setItem('bili-quality', String(f.height))
      chips.querySelectorAll('.chip').forEach(x => x.classList.remove('sel'))
      c.classList.add('sel')
    }
    chips.appendChild(c)
  }
}

// ---- 下载 ----
$('dl-btn').onclick = async () => {
  const btn = $('dl-btn')
  btn.disabled = true
  const fill = $('dl-fill'), txt = $('dl-text')
  fill.classList.remove('indet')
  fill.style.width = '0'
  txt.textContent = '连接中…'
  try {
    await api('/api/download', 'POST', { height: S.quality })
    $('dl-wrap').classList.add('hidden')
    $('preview-wrap').classList.remove('hidden')
    S.dur = S.info.duration
    S.start = 0
    S.end = S.info.duration
    S.derived = false
    $('revert-btn').classList.add('hidden')
    initTrimUI(S.info.duration)
    loadVideo()
    $('done-btn').disabled = false
    toast('✅ 下载完成，拖动滑块可实时预览裁切范围')
  } catch (e) {
    if (!/已中止/.test(e.message)) toast(e.message, true)
  } finally {
    btn.disabled = false
  }
}

// ---- 预览 + 裁切 UI ----
function loadVideo() {
  const v = $('video')
  v.src = '/media/current?t=' + Date.now()
  $('play-btn').textContent = '播放'
  v.onerror = () => toast('⚠️ 预览加载失败，不影响保存', true)
  v.onplay = () => { $('play-btn').textContent = '暂停' }
  v.onpause = () => { $('play-btn').textContent = '播放' }
}
$('play-btn').onclick = () => {
  const v = $('video')
  if (v.paused) {
    if (S.end > 0 && (v.currentTime < S.start || v.currentTime >= S.end)) v.currentTime = S.start
    v.play()
  } else v.pause()
}
$('video').ontimeupdate = () => {
  const v = $('video')
  $('vtime').textContent = `${fmtDuration(v.currentTime)} / ${fmtDuration(v.duration || S.dur)}`
  if (S.end > 0 && v.currentTime >= S.end) { v.pause(); v.currentTime = S.end }
}

function initTrimUI(duration) {
  const st = $('range-start'), en = $('range-end')
  st.max = en.max = String(duration)
  st.value = '0'
  en.value = String(duration)
  S.start = 0
  S.end = duration
  syncRange()
  st.oninput = () => {
    let v = parseFloat(st.value)
    if (v > parseFloat(en.value)) { v = parseFloat(en.value); st.value = String(v) }
    S.start = v
    syncRange()
    seekPreview(v)
  }
  en.oninput = () => {
    let v = parseFloat(en.value)
    if (v < parseFloat(st.value)) { v = parseFloat(st.value); en.value = String(v) }
    S.end = v
    syncRange()
    seekPreview(v)
  }
}
function seekPreview(t) {
  const v = $('video')
  if (v && v.readyState >= 1) v.currentTime = t
}
function syncRange() {
  $('start-label').textContent = `起 ${fmtDuration(S.start)}`
  $('end-label').textContent = `止 ${fmtDuration(S.end)} / 共 ${fmtDuration(S.dur)}`
  if (S.dur > 0) {
    const p1 = (S.start / S.dur) * 100
    const p2 = (S.end / S.dur) * 100
    $('range-bar').style.background = `linear-gradient(to right, var(--border) ${p1}%, var(--accent) ${p1}% ${p2}%, var(--border) ${p2}%)`
  }
}

// ---- CRF（localStorage 记忆）----
const CRF_OPTS = [
  { v: null, label: '不压缩(快速)' },
  { v: 18, label: '视觉无损 18' },
  { v: 23, label: '高清 23' },
  { v: 28, label: '中等 28' },
]
function renderCrfs() {
  const wrap = $('crfs')
  wrap.innerHTML = ''
  for (const o of CRF_OPTS) {
    const c = document.createElement('div')
    c.className = 'crf' + (S.crf === o.v ? ' sel' : '')
    c.textContent = o.label
    c.onclick = () => {
      S.crf = o.v
      localStorage.setItem('bili-crf', o.v === null ? 'null' : String(o.v))
      renderCrfs()
    }
    wrap.appendChild(c)
  }
}

// ---- 裁切 / 压缩 ----
$('trim-btn').onclick = async () => {
  if (!(S.start > 0 || S.end < S.dur)) return toast('未选择裁切范围，请先拖动滑块', true)
  const btn = $('trim-btn')
  btn.disabled = true
  S.op = 'trim'
  $('trim-fill').style.width = '0'
  $('trim-text').textContent = '裁切中…'
  try {
    const r = await api('/api/trim', 'POST', { start: S.start, end: S.end })
    S.dur = r.duration !== undefined ? r.duration : (S.end - S.start)
    S.end = S.dur
    S.start = 0
    S.derived = true
    $('revert-btn').classList.remove('hidden')
    initTrimUI(S.dur)
    loadVideo()
    toast('✅ 已生成裁切片段，可继续压缩或转文字')
  } catch (e) {
    if (!/已中止/.test(e.message)) toast(e.message, true)
  } finally {
    btn.disabled = false
  }
}
$('compress-btn').onclick = async () => {
  if (S.crf === null) return toast('已选择「不压缩」，请先选择压缩档位', true)
  const btn = $('compress-btn')
  btn.disabled = true
  S.op = 'compress'
  $('cp-fill').style.width = '0'
  $('cp-text').textContent = '编码中…'
  $('cp-feedback').classList.add('hidden')
  try {
    const r = await api('/api/compress', 'POST', { crf: S.crf })
    const fb = $('cp-feedback')
    fb.textContent = `原 ${fmtMB(r.before)} → ${fmtMB(r.after)} · ${r.pct >= 0 ? `减少 ${r.pct.toFixed(1)}%` : `增大 ${(-r.pct).toFixed(1)}%`}`
    fb.classList.remove('hidden')
    if (r.kept === 'original') {
      // 压缩无收益：服务端已保留原件，提醒用户
      fb.className = 'hint err'
      fb.textContent = '⚠️ 压缩后反而更大，已保留原文件：' + fb.textContent
      toast('压缩无收益，已保留原文件')
      return
    }
    S.derived = true
    $('revert-btn').classList.remove('hidden')
    loadVideo()
    toast('✅ 压缩完成')
  } catch (e) {
    if (!/已中止/.test(e.message)) toast(e.message, true)
  } finally {
    btn.disabled = false
  }
}

// ---- 转文字（完成自动复制）----
$('transcribe-btn').onclick = async () => {
  const wrap = $('ts-wrap')
  wrap.classList.remove('hidden')
  const st = $('ts-status')
  st.className = 'hint'
  if (S.transcript) { $('ts-text').value = S.transcript; st.textContent = '已有转录文本'; st.className = 'hint ok'; return }
  st.textContent = '转录中（首次加载模型约1-2分钟，请稍候）…'
  $('ts-text').value = ''
  try {
    const r = await api('/api/transcribe', 'POST', {})
    S.transcript = r.transcript
    $('ts-text').value = r.transcript
    st.textContent = '转录完成'
    st.className = 'hint ok'
    try {
      await navigator.clipboard.writeText(r.transcript)
      toast('✅ 转录完成，文本已自动复制到剪贴板')
    } catch {
      toast('✅ 转录完成（自动复制失败，请手动复制）')
    }
  } catch (e) {
    if (/已中止/.test(e.message)) return
    st.textContent = `转录失败：${e.message}`
    st.className = 'hint err'
  }
}
$('ts-copy').onclick = async () => {
  const v = $('ts-text').value.trim()
  if (!v) return toast('无内容', true)
  try { await navigator.clipboard.writeText(v); toast('📋 转录文本已复制') }
  catch { toast('复制失败，请手动选择复制', true) }
}

// ---- 完成 = 交付（自动复制 wikilink 或 wikilink+转录全文）----
$('done-btn').onclick = async () => {
  const btn = $('done-btn')
  btn.disabled = true
  try {
    const r = await api('/api/done', 'POST', {})
    $('result-path').textContent = '📂 ' + r.finalPath
    $('result-clip').textContent = r.clipboard
    $('result-wrap').classList.remove('hidden')
    try {
      await navigator.clipboard.writeText(r.clipboard)
      toast('✅ 已交付并复制：' + r.wiki)
    } catch {
      toast('✅ 已交付（剪贴板复制失败，请点「复制」按钮）')
    }
  } catch (e) {
    toast(e.message, true)
    btn.disabled = false
  }
}
$('copy-btn').onclick = async () => {
  try { await navigator.clipboard.writeText($('result-clip').textContent); toast('📋 已复制') }
  catch { toast('复制失败', true) }
}

// ---- 返回原视频（重新裁切/压缩）----
$('revert-btn').onclick = async () => {
  try {
    const r = await api('/api/revert', 'POST', {})
    S.dur = r.duration
    S.start = 0
    S.end = r.duration
    S.derived = false
    $('revert-btn').classList.add('hidden')
    initTrimUI(r.duration)
    loadVideo()
    $('trim-fill').style.width = '0'
    $('trim-text').textContent = ''
    $('cp-fill').style.width = '0'
    $('cp-text').textContent = ''
    $('cp-feedback').classList.add('hidden')
    toast('↩ 已返回原视频，可重新裁切/压缩')
  } catch (e) { toast(e.message, true) }
}

// ---- 取消 / 新建任务 ----
function resetUI() {
  S.info = null
  S.transcript = ''
  S.dur = 0
  S.derived = false
  $('revert-btn').classList.add('hidden')
  ;['card-wrap', 'dl-wrap', 'preview-wrap', 'ts-wrap', 'result-wrap'].forEach(id => $(id).classList.add('hidden'))
  $('url').value = ''
  $('done-btn').disabled = true
  $('video').removeAttribute('src')
  $('video').load && $('video').load()
  $('dl-diag').textContent = ''
  $('dl-fill').style.width = '0'
  $('dl-text').textContent = ''
  $('trim-fill').style.width = '0'
  $('trim-text').textContent = ''
  $('cp-fill').style.width = '0'
  $('cp-text').textContent = ''
  $('cp-feedback').classList.add('hidden')
  $('ts-text').value = ''
}
$('cancel-btn').onclick = async () => {
  try {
    await api('/api/cancel', 'POST', {})
    resetUI()
    toast('任务已取消，全部产物已删除')
  } catch (e) { toast(e.message, true) }
}
$('newtask-btn').onclick = async () => {
  try {
    await api('/api/newtask', 'POST', {})
    resetUI()
    toast('已开始新任务')
  } catch (e) { toast(e.message, true) }
}

// ---- 设置弹层 ----
$('settings-btn').onclick = async () => {
  try {
    const r = await api('/api/config')
    $('set-outputDir').value = r.config.outputDir || ''
    $('set-vaultPath').value = r.config.vaultPath || ''
    $('set-ffmpegPath').value = r.config.ffmpegPath || ''
    $('set-pythonPath').value = r.config.pythonPath || ''
    $('set-whisperModel').value = r.config.whisperModel || ''
    $('set-cookie').value = ''
    const c2 = $('cookie-status2')
    if (!r.cookieConfigured) { c2.textContent = '⚠️ 未配置 Cookie：只能下载低清晰度（≤720P）'; c2.className = 'hint err' }
    else if (r.cookieValid === true) { c2.textContent = '✅ Cookie 已配置且有效'; c2.className = 'hint ok' }
    else if (r.cookieValid === false) { c2.textContent = '⚠️ Cookie 已过期或无效，请重新粘贴'; c2.className = 'hint err' }
    else { c2.textContent = 'Cookie 验证中…'; c2.className = 'hint' }
    $('settings-mask').classList.remove('hidden')
  } catch (e) { toast(e.message, true) }
}
$('settings-close').onclick = () => $('settings-mask').classList.add('hidden')
$('settings-mask').addEventListener('click', e => { if (e.target === $('settings-mask')) $('settings-mask').classList.add('hidden') })

$('settings-save').onclick = async () => {
  try {
    await api('/api/config', 'POST', {
      outputDir: $('set-outputDir').value.trim() || 'E:/Obsidian/叫我包仔/CONFIG/APPENDIX',
      vaultPath: $('set-vaultPath').value.trim() || 'E:/Obsidian/叫我包仔',
      ffmpegPath: $('set-ffmpegPath').value.trim() || 'ffmpeg',
      pythonPath: $('set-pythonPath').value.trim(),
      whisperModel: $('set-whisperModel').value.trim() || 'small',
    })
    toast('✅ 设置已保存')
  } catch (e) { toast(e.message, true) }
}
$('cookie-save-btn').onclick = async () => {
  const v = $('set-cookie').value.trim()
  if (!v) return toast('Cookie 为空', true)
  try {
    await api('/api/cookie', 'POST', { cookie: v })
    $('set-cookie').value = ''
    $('cookie-status2').textContent = '✅ Cookie 有效，已保存'
    $('cookie-status2').className = 'hint ok'
    toast('✅ Cookie 有效，已保存')
  } catch (e) {
    $('cookie-status2').textContent = '⚠️ ' + e.message + '（已保存，可重新粘贴覆盖）'
    $('cookie-status2').className = 'hint err'
    toast(e.message, true)
  }
}

// ---- 历史弹层 ----
$('history-btn').onclick = async () => {
  try {
    const r = await api('/api/history')
    const list = $('history-list')
    list.innerHTML = ''
    if (!r.history.length) {
      list.innerHTML = '<div class="hist-empty">暂无下载记录</div>'
      $('history-clear').classList.add('hidden')
    } else {
      $('history-clear').classList.remove('hidden')
      for (const it of r.history) {
        const row = document.createElement('div')
        row.className = 'hist-row'
        const left = document.createElement('div')
        left.className = 'hist-left'
        const t = document.createElement('div')
        t.className = 'hist-title'
        t.textContent = it.title
        const m = document.createElement('div')
        m.className = 'hist-meta'
        m.textContent = `${it.time} · ${it.quality} · ${it.file}`
        left.appendChild(t)
        left.appendChild(m)
        const btn = document.createElement('button')
        btn.className = 'btn small'
        btn.textContent = '复制'
        btn.onclick = async () => {
          try { await navigator.clipboard.writeText(it.wiki); toast('📋 wikilink 已复制') }
          catch { toast('复制失败', true) }
        }
        row.appendChild(left)
        row.appendChild(btn)
        list.appendChild(row)
      }
    }
    $('history-mask').classList.remove('hidden')
  } catch (e) { toast(e.message, true) }
}
$('history-close').onclick = () => $('history-mask').classList.add('hidden')
$('history-mask').addEventListener('click', e => { if (e.target === $('history-mask')) $('history-mask').classList.add('hidden') })
$('history-clear').onclick = async () => {
  if (!confirm('确定清空全部下载历史？')) return
  try { await api('/api/history', 'DELETE', {}); $('history-btn').click(); toast('历史已清空') }
  catch (e) { toast(e.message, true) }
}

// ---- 初始化 ----
window.addEventListener('DOMContentLoaded', async () => {
  const savedCrf = localStorage.getItem('bili-crf')
  if (savedCrf !== null) S.crf = savedCrf === 'null' ? null : parseInt(savedCrf)
  renderCrfs()
  try {
    const r = await api('/api/config')
    onCookieStatus(r.cookieConfigured ? r.cookieValid : false)
  } catch {}
})
