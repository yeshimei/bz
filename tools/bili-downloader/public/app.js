// ================================================================
// B站下载器 - 前端交互（vanilla，无依赖）
// 与 server.js 的 API + SSE 协作；剪辑 = 对一个「下载原件」定义
// 0..N 个「段落{开始,结束}」，交付模式分「分开交付 / 合并成一个视频」。
// 时间精度 0.1s，显示恒显小时位 HH:MM:SS(.S)。
// ================================================================
const $ = id => document.getElementById(id)

const pad = n => String(n).padStart(2, '0')
const fmtDuration = t => {                                  // HH:MM:SS（显示/播放头）
  const s = Math.max(0, Math.floor(t))
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`
}
const fmtPrec = t => {                                      // HH:MM:SS.S（起/止精度 0.1s；秒位取模，防总秒数溢出）
  const s = Math.max(0, t)
  const ss = Math.floor(s), ds = Math.round((s - ss) * 10)
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(ss % 60)}.${ds}`
}
const fmtMB = b => (b / 1048576).toFixed(1) + 'MB'

// 解析用户输入时间 → 秒（与 core.parseTimeInput 同规）；失败返回 null
function parseTimeInput(str) {
  const s = String(str).trim()
  if (!s || !/^-?[\d:.]+$/.test(s)) return null
  const parts = s.split(':').map(p => p.trim())
  if (parts.length > 3) return null
  const nums = parts.map(p => { const n = Number(p); return isFinite(n) && n >= 0 ? n : NaN })
  if (nums.some(Number.isNaN)) return null
  let sec
  if (nums.length === 1) sec = nums[0]
  else if (nums.length === 2) sec = nums[0] * 60 + nums[1]
  else sec = nums[0] * 3600 + nums[1] * 60 + nums[2]
  return Math.max(0, Math.round(sec * 10) / 10)
}

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

// ---- 任务状态（单任务 + 多段落 + 分P）----
const S = {
  info: null, quality: 0, crf: 23, dur: 0, transcript: '', busy: false,
  transcriptSig: '',        // 已有转录对应的段落签名（flowSig）：不符则快捷命令重转，防陈旧稿复用
  delivered: false,         // 本任务是否已交付（文献笔记快捷命令用于避免重复交付）
  draft: { start: 0, end: 0 },  // 无激活段时的时间轴圈选草稿（下载后段落为空，先圈选再加段）
  mode: 'split',            // split（分开交付）| merge（合并成一个视频）
  segments: [],             // [{id, start, end, checked?}]
  activeId: null,
  pages: [], pageIndex: 0,  // 分P/分批：解析出的 P 列表与当前选中
}
let segSeq = 0
const nextSegId = () => 'seg' + (++segSeq)
const activeSeg = () => S.segments.find(s => s.id === S.activeId) || null
const pageCount = () => (S.pages || []).length || 1

const OP_BTNS = ['parse-btn', 'dl-btn', 'trim-btn', 'compress-btn', 'transcribe-btn', 'done-btn', 'add-seg-btn', 'ts-copy', 'cookie-save-btn', 'settings-save', 'gen-note']
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
      // percent 为 null（拿不到总大小）时：不确定进度 + 已下载字节，绝不假报固定百分比
      if (typeof d.percent === 'number') fill.style.width = `${d.percent}%`
      else { fill.classList.add('indet'); fill.style.width = '0' }
      const left = typeof d.percent === 'number' ? `${d.percent.toFixed(1)}%` : (d.received != null ? fmtMB(d.received) : '?')
      txt.textContent = `${left} · ${d.speed || '?'} · ETA ${d.eta || '?'}`
    }
  } else if (d.type === 'trim-progress') {
    const fill = S.op === 'compress' ? $('cp-fill') : $('trim-fill')
    const txt = S.op === 'compress' ? $('cp-text') : $('trim-text')
    if (fill) fill.style.width = `${d.percent}%`
    if (txt) txt.textContent = `${d.percent.toFixed(0)}% · ${S.op === 'compress' ? '编码中…' : '裁切中…'}`
  } else if (d.type === 'transcript-chunk') {
    $('ts-text').value += d.text
  } else if (d.type === 'note-progress') {
    flowStatus(`步骤 4/5：${d.text}`)   // AI 润色逐块进度（1.2.7）
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
    S.pages = r.info.pages || []
    S.pageIndex = 0
    const savedQ = parseInt(localStorage.getItem('bili-quality'))
    S.quality = savedQ && r.info.formats.some(f => f.height === savedQ) ? savedQ : r.info.maxHeight
    renderCard()
    renderPages()
    $('card-wrap').classList.remove('hidden')
    $('dl-wrap').classList.remove('hidden')
    $('preview-wrap').classList.add('hidden')
    $('ts-wrap').classList.add('hidden')
    $('result-wrap').classList.add('hidden')
    $('done-btn').disabled = true
    S.delivered = false
    updateGenNote()
    $('dl-diag').textContent = ''
    $('dl-fill').style.width = '0'
    $('dl-text').textContent = ''
    resetProgress()
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

// 分批/分P：列出所有 P 供选择下载哪一批（默认第一个）
function renderPages() {
  const wrap = $('pages')
  wrap.innerHTML = ''
  if (pageCount() <= 1) { wrap.classList.add('hidden'); return }
  wrap.classList.remove('hidden')
  S.pages.forEach((p, i) => {
    const c = document.createElement('div')
    c.className = 'chip' + (i === S.pageIndex ? ' sel' : '')
    c.textContent = `P${p.page}${p.title ? ' ' + p.title : ''}`.trim()
    c.title = p.title || ''
    c.onclick = () => { S.pageIndex = i; renderPages() }
    wrap.appendChild(c)
  })
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
    const page = S.pages[S.pageIndex]
    const r = await api('/api/download', 'POST', {
      height: S.quality,
      cid: page ? page.cid : undefined,
      part: page ? page.page : 1,
      partTitle: page ? page.title : '',
      duration: page ? page.duration : S.info.duration,
    })
    $('dl-wrap').classList.add('hidden')
    $('preview-wrap').classList.remove('hidden')
    // 预览时长以所选 P 为准
    S.dur = page ? page.duration : S.info.duration
    // 下载后段落为空：用时间轴圈选后「+ 添加段落」手动添加；不加段落 = 整片交付/转录
    S.draft = { start: 0, end: S.dur }
    S.segments = []
    S.activeId = null
    S.mode = 'split'
    S.transcript = ''; S.transcriptSig = ''   // 新下载：清上一任务残留转录（服务端已随 parse 重置）
    setMode('split')
    $('revert-btn').classList.add('hidden')
    initTrimUI(S.dur)
    renderSegList()
    syncFromActive()
    loadVideo()
    $('done-btn').disabled = false
    S.delivered = false
    updateGenNote()
    toast(r.cached ? '⚡ 缓存命中，跳过下载，直接进入剪辑' : '✅ 下载完成，时间轴圈选后点「+ 添加段落」；不加即为整片')
  } catch (e) {
    if (!/已中止/.test(e.message)) toast(e.message, true)
  } finally {
    btn.disabled = false
  }
}

// ---- 预览 + 剪辑 UI ----
function loadVideo() {
  const v = $('video')
  v.src = '/media/current?t=' + Date.now()
  $('play-btn').textContent = '播放'
  v.onerror = () => toast('⚠️ 预览加载失败，不影响剪辑', true)
  v.onplay = () => { $('play-btn').textContent = '暂停' }
  v.onpause = () => { $('play-btn').textContent = '播放' }
  // F1：长视频 seek 缓冲反馈（waiting/seeked）
  v.onwaiting = () => $('buf-hint').classList.remove('hidden')
  v.onseeked = () => $('buf-hint').classList.add('hidden')
}
$('buf-hint').classList.add('hidden')
$('play-btn').onclick = () => {
  const v = $('video'); const a = activeSeg()
  if (v.paused) {
    if (a && (v.currentTime < a.start || v.currentTime > a.end)) v.currentTime = a.start
    v.play()
  } else v.pause()
}
$('video').ontimeupdate = () => {
  const v = $('video'); const a = activeSeg()
  $('vtime').textContent = `${fmtDuration(v.currentTime)} / ${fmtDuration(v.duration || S.dur)}`
  if (a && v.currentTime < a.start) { v.currentTime = a.start; return }
  if (a && v.currentTime > a.end) { v.pause(); v.currentTime = a.end }
}

// 节流 seek：拖动时 <180ms 的请求合并到下一拍，避免长视频 seek 风暴；未就绪挂 loadedmetadata
let seekTimer = null, lastSeekAt = 0
function seekPreview(t) {
  const v = $('video'); const a = activeSeg()
  if (!v || !isFinite(t)) return
  const now = Date.now()
  if (now - lastSeekAt < 180) {
    clearTimeout(seekTimer)
    seekTimer = setTimeout(() => seekPreview(t), 160)
    return
  }
  lastSeekAt = now
  if (v.readyState >= 1) { v.currentTime = t; $('vtime').textContent = `${fmtDuration(t)} / ${fmtDuration(v.duration || S.dur)}` }
  else { v.addEventListener('loadedmetadata', () => { v.currentTime = t }, { once: true }) }
}

function initTrimUI(duration) {
  const st = $('range-start'), en = $('range-end')
  st.max = en.max = String(duration)
  st.step = en.step = '0.1'
  st.oninput = () => {
    const a = activeSeg()
    let v = parseFloat(st.value)
    const e = a ? a.end : S.draft.end
    if (v > e - 0.1) v = e - 0.1
    const start = Math.max(0, Math.round(v * 10) / 10)
    if (a) { a.start = start; markDirty(a) }
    else S.draft.start = start
    st.value = String(start)
    syncFromActive()
    seekPreview(start)
  }
  en.oninput = () => {
    const a = activeSeg()
    let v = parseFloat(en.value)
    const s = a ? a.start : S.draft.start
    if (v < s + 0.1) v = Math.min(S.dur, s + 0.5)
    const end = Math.max(s + 0.1, Math.min(S.dur, Math.round(v * 10) / 10))
    if (a) { a.end = end; markDirty(a) }
    else S.draft.end = end
    en.value = String(end)
    syncFromActive()
    seekPreview(end)   // 拖末尾把手：视频跟随到结束位置
  }
  syncFromActive()
}
const markDirty = a => { delete a.checked }
function setActive(id) { S.activeId = id; renderSegList(); syncFromActive() }
function syncFromActive() {
  renderBlocks()
  const a = activeSeg()
  $('range-start').value = a ? String(a.start) : String(S.draft.start)
  $('range-end').value = a ? String(a.end) : String(S.draft.end)
  syncRange()
}
function syncRange() {
  const a = activeSeg()
  const s = a ? a.start : S.draft.start, e = a ? a.end : S.draft.end
  $('start-label').textContent = `起 ${fmtPrec(s)}`
  $('end-label').textContent = `止 ${fmtPrec(e)} / 共 ${fmtPrec(S.dur)}`
  if (document.activeElement !== $('seg-start')) $('seg-start').value = fmtPrec(s)
  if (document.activeElement !== $('seg-end')) $('seg-end').value = fmtPrec(e)
  validateSegInputs()
  if (S.dur > 0) {
    const p1 = (s / S.dur) * 100, p2 = (e / S.dur) * 100
    $('range-bar').style.background = `linear-gradient(to right, var(--border) ${p1}%, var(--accent) ${p1}% ${p2}%, var(--border) ${p2}%)`
  }
}

// ---- 时间轴色块（主时间轴 + 激活段手柄）----
function renderBlocks() {
  const wrap = $('timeline-blocks'); wrap.innerHTML = ''
  if (!S.dur) return
  for (const seg of S.segments) {
    const b = document.createElement('div')
    b.className = 'blk' + (seg.id === S.activeId ? ' active' : '')
    b.style.left = (seg.start / S.dur * 100) + '%'
    b.style.width = Math.max(0.6, (seg.end - seg.start) / S.dur * 100) + '%'
    b.onclick = () => setActive(seg.id)
    if (seg.id === S.activeId) {
      const hl = document.createElement('div'), hr = document.createElement('div')
      hl.className = 'handle hl'; hr.className = 'handle hr'
      addHandleDrag(hl, 'start', seg); addHandleDrag(hr, 'end', seg)
      b.appendChild(hl); b.appendChild(hr)
    }
    wrap.appendChild(b)
  }
}
function addHandleDrag(el, which, seg) {
  let dragging = false
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); dragging = true; el.setPointerCapture(e.pointerId) })
  el.addEventListener('pointermove', e => {
    if (!dragging) return
    const r = $('range-bar').getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const v = Math.round(frac * S.dur * 10) / 10
    if (which === 'start') { if (v < seg.end - 0.1) { seg.start = Math.max(0, v); markDirty(seg) } }
    else { if (v > seg.start + 0.1) { seg.end = Math.min(S.dur, v); markDirty(seg) } }
    syncFromActive()
    seekPreview(which === 'start' ? seg.start : seg.end)   // 结束把手拖动：视频跟随到结束位置
  })
  el.addEventListener('pointerup', () => { dragging = false })
}

// ---- 手动时间输入（F3：双向同步 + 硬钳制）----
function validateSegInputs() {
  const a = activeSeg(); const err = $('seg-input-err')
  const sEl = $('seg-start'), eEl = $('seg-end')
  sEl.classList.remove('err'); eEl.classList.remove('err'); err.classList.add('hidden')
  if (!a) return
  const sv = parseTimeInput(sEl.value), ev = parseTimeInput(eEl.value)
  if (sv !== null && ev !== null && sv >= ev) {
    err.textContent = `开始必须小于结束（开始 ${fmtPrec(sv)} ≥ 结束 ${fmtPrec(ev)}）`
    err.classList.remove('hidden')
    sEl.classList.add('err'); eEl.classList.add('err')
  }
}
function applySegTime(which) {
  const a = activeSeg()
  const el = which === 'start' ? $('seg-start') : $('seg-end')
  const v = parseTimeInput(el.value)
  if (v === null) { el.classList.add('err'); $('seg-input-err').textContent = '时间格式：HH:MM:SS.S / MM:SS / 秒'; $('seg-input-err').classList.remove('hidden'); return }
  const clamped = Math.max(0, Math.min(S.dur, v))
  if (a) {
    if (which === 'start') { if (clamped < a.end - 0.1) { a.start = Math.round(clamped * 10) / 10; markDirty(a) } }
    else { if (clamped > a.start + 0.1) { a.end = Math.round(clamped * 10) / 10; markDirty(a) } }
  } else {
    // 无激活段：编辑草稿圈选范围（圈好再「+ 添加段落」）
    if (which === 'start') S.draft.start = Math.min(Math.round(clamped * 10) / 10, Math.max(0, S.draft.end - 0.1))
    else S.draft.end = Math.max(Math.round(clamped * 10) / 10, Math.min(S.dur, S.draft.start + 0.1))
  }
  syncFromActive()
  const t = a ? (which === 'start' ? a.start : a.end) : (which === 'start' ? S.draft.start : S.draft.end)
  seekPreview(t)
}
$('seg-start').addEventListener('change', () => applySegTime('start'))
$('seg-end').addEventListener('change', () => applySegTime('end'))

// ---- 段落列表（CRUD）----
function renderSegList() {
  const wrap = $('seg-list'); wrap.innerHTML = ''
  if (!S.segments.length) {
    wrap.innerHTML = '<div class="hist-empty">尚未添加段落，用上方时间轴/时间框圈选后「+ 添加段落」</div>'
    return
  }
  S.segments.forEach((seg, i) => {
    const row = document.createElement('div')
    row.className = 'segl-row' + (seg.id === S.activeId ? ' sel' : '')
    const t = document.createElement('div')
    t.className = 'segl-time'
    t.textContent = `${i + 1}. ${fmtPrec(seg.start)} → ${fmtPrec(seg.end)}${seg.checked ? ' ✓' : ''}`
    t.onclick = () => setActive(seg.id)
    const act = document.createElement('div')
    act.className = 'segl-actions'
    for (const [label, fn, title] of [['↑', () => moveSeg(i, -1), '上移'], ['↓', () => moveSeg(i, 1), '下移'], ['✕', () => delSeg(i), '删除']]) {
      const b = document.createElement('button')
      b.className = 'btn small'; b.textContent = label; b.title = title || ''
      b.onclick = e => { e.stopPropagation(); fn() }
      act.appendChild(b)
    }
    row.appendChild(t); row.appendChild(act)
    wrap.appendChild(row)
  })
}
function moveSeg(i, dir) {
  const j = i + dir
  if (j < 0 || j >= S.segments.length) return
  const arr = S.segments
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  renderSegList(); syncFromActive()
}
function delSeg(i) {
  const seg = S.segments[i]
  S.segments.splice(i, 1)
  if (S.activeId === seg.id) S.activeId = (S.segments[Math.min(i, S.segments.length - 1)] || {}).id || null
  renderSegList(); syncFromActive()
}
$('add-seg-btn').onclick = () => {
  if (!S.dur) return
  const last = S.segments[S.segments.length - 1]
  let s, e
  if (last) { s = Math.min(last.end, S.dur); e = Math.min(S.dur, s + Math.max(60, (last.end - last.start) || S.dur)) }
  else { s = S.draft.start; e = S.draft.end }   // 无段落：按草稿圈选范围添加
  if (e - s < 0.1) { s = 0; e = Math.min(S.dur, 60) }
  if (e - s < 0.1) { s = 0; e = S.dur }
  const id = nextSegId()
  S.segments.push({ id, start: Math.round(s * 10) / 10, end: Math.round(e * 10) / 10 })
  setActive(id)
  if (S.dur > 0 && s < S.dur) seekPreview(s)
}

// ---- 交付模式切换 ----
function setMode(m) {
  S.mode = m
  $('mode-split').classList.toggle('sel', m === 'split')
  $('mode-merge').classList.toggle('sel', m === 'merge')
}
$('mode-split').onclick = () => setMode('split')
$('mode-merge').onclick = () => setMode('merge')

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

function resetProgress() {
  $('trim-fill').style.width = '0'; $('trim-text').textContent = ''
  $('cp-fill').style.width = '0'; $('cp-text').textContent = ''
  $('cp-feedback').classList.add('hidden')
}

// ---- 应用裁切（只作用于激活段：校验 + 缓存）----
$('trim-btn').onclick = async () => {
  const a = activeSeg()
  if (!a) return toast('请先添加/选择段落', true)
  if (a.end - a.start < 0.1) return toast('段落区间无效', true)
  const btn = $('trim-btn')
  btn.disabled = true
  S.op = 'trim'
  $('trim-fill').style.width = '0'
  $('trim-text').textContent = '裁切中…'
  try {
    const r = await api('/api/trim', 'POST', { segmentId: a.id, start: a.start, end: a.end })
    a.checked = true
    renderSegList()
    toast(`✅ 段落 ${fmtPrec(a.start)}-${fmtPrec(a.end)} 校验通过${r.mode === 'reencode' ? '（已自动重编码）' : ''}`)
  } catch (e) {
    if (!/已中止/.test(e.message)) toast(e.message, true)
  } finally {
    btn.disabled = false
    $('trim-text').textContent = ''
  }
}

// ---- 压缩（作用于激活段：CRF 预编码 + 回退提示）----
$('compress-btn').onclick = async () => {
  if (S.crf === null) return toast('请先选择压缩档位', true)
  const a = activeSeg()
  if (!a) return toast('请先添加/选择段落', true)
  const btn = $('compress-btn')
  btn.disabled = true
  S.op = 'compress'
  $('cp-fill').style.width = '0'
  $('cp-text').textContent = '编码中…'
  $('cp-feedback').classList.add('hidden')
  try {
    const r = await api('/api/compress', 'POST', { segmentId: a.id, start: a.start, end: a.end, crf: S.crf })
    const fb = $('cp-feedback')
    fb.textContent = `原 ${fmtMB(r.before)} → ${fmtMB(r.after)} · ${r.pct >= 0 ? `减少 ${r.pct.toFixed(1)}%` : `增大 ${(-r.pct).toFixed(1)}%`}`
    fb.classList.remove('hidden')
    if (r.kept === 'original') {
      fb.className = 'hint err'
      fb.textContent = '⚠️ 压缩后反而更大，已保留快速件：' + fb.textContent
      toast('压缩无收益，该段交付时将保留快速件')
      return
    }
    a.checked = true
    renderSegList()
    toast('✅ 该段已按所选 CRF 预编码，交付时直接复用')
  } catch (e) {
    if (!/已中止/.test(e.message)) toast(e.message, true)
  } finally {
    btn.disabled = false
    $('cp-text').textContent = ''   // 压缩完成/失败都清掉「编码中」残影
  }
}

// ---- 转文字（完成自动复制；若拖拽了把手自动添为段落）----
$('transcribe-btn').onclick = async () => {
  const wrap = $('ts-wrap')
  wrap.classList.remove('hidden')
  const st = $('ts-status')
  st.className = 'hint'
  const segs = resolveSegments()
  const sig = flowSig(segs)
  if (S.transcript && S.transcriptSig === sig) { $('ts-text').value = S.transcript; st.textContent = '已有转录文本'; st.className = 'hint ok'; updateGenNote(); return }
  st.textContent = '转录中（首次加载模型约1-2分钟，请稍候）…'
  $('ts-text').value = ''
  try {
    const r = await api('/api/transcribe', 'POST', { segments: segs.map(s => ({ id: s.id, start: s.start, end: s.end })) })
    S.transcript = r.transcript
    S.transcriptSig = sig
    $('ts-text').value = r.transcript
    st.textContent = '转录完成'
    st.className = 'hint ok'
    updateGenNote()
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

// ---- 完成 = 交付（按交付模式批量产出全部交付物）----
// 交付结果展示（「完成」按钮与「生成文献笔记」快捷命令共用）
async function showDelivered(r) {
  S.delivered = true
  $('result-path').textContent = '📂 ' + r.files.map(f => f.finalPath).join('\n')
  $('result-clip').textContent = r.clipboard
  $('result-wrap').classList.remove('hidden')
  updateGenNote()
  if (r.failures && r.failures.length) toast('部分失败：' + r.failures.join('；'), true)
  try {
    await navigator.clipboard.writeText(r.clipboard)
    toast(`✅ 已交付并复制${r.files.length > 1 ? `：${r.files.length} 个文件` : ''}`)
  } catch {
    toast('✅ 已交付（剪贴板复制失败，请点「复制」按钮）')
  }
}
$('done-btn').onclick = async () => {
  const btn = $('done-btn')
  btn.disabled = true
  try {
    const segs = resolveSegments()
    const r = await api('/api/done', 'POST', {
      segments: segs.map(s => ({ id: s.id, start: s.start, end: s.end })),
      mode: S.mode,
      crf: S.crf,
    })
    await showDelivered(r)
  } catch (e) {
    toast(e.message, true)
    btn.disabled = false
  }
}
$('copy-btn').onclick = async () => {
  try { await navigator.clipboard.writeText($('result-clip').textContent); toast('📋 已复制') }
  catch { toast('复制失败', true) }
}

// ---- 快速命令：生成文献笔记（严格顺序：① 应用剪切 ② 应用压缩 ③ 转文字 ④ AI 润色 ⑤ 生成笔记）----
// 前置：已下载（段落与 CRF 即用户已圈选参数）；各步串行 await，绝不并行；步骤状态显式展示。
// 段落语义（用户拍板）：
//   - 三个入口（转文字 / 完成 / 生成文献笔记）共用本文 resolveSegments()：若未添加段落但拖拽了把手（draft 非整片），自动把草稿范围添加为段落。
//   - 若既无段落也未拖拽（整视频、未圈选）：生成文献笔记 **跳过 ①剪切 / ②压缩**，③ 转文字走整片，再 ④⑤。
function updateGenNote() {
  $('gen-note').disabled = !(S.dur > 0)
}
function flowStatus(text) {
  const el = $('flow-status')
  if (text) { el.textContent = text; el.classList.remove('hidden') }
  else el.classList.add('hidden')
}
// AI 润色完成后：把「转文字」框里的原文替换为润色稿（1.2.7；S.transcript 同步，后续步骤用简体稿）
function applyPolished(rt) {
  if (!rt || !rt.body) return
  S.transcript = rt.body
  const wrap = $('ts-wrap')
  wrap.classList.remove('hidden')
  $('ts-text').value = rt.body
  const st = $('ts-status')
  st.textContent = '已替换为 AI 润色稿（简体）'
  st.className = 'hint ok'
}
// 草稿是否被拖拽（draft 非整片）：拖过把手/改过时间则 true
function draftTrimmed() {
  return S.draft.start > 0.05 || S.draft.end < S.dur - 0.05
}
// 转录覆盖范围签名（与 server transSig 同构）：整片='full'；分段=id+起止(0.1s)。防陈旧转录跨段落复用
function flowSig(segs) {
  if (!segs.length) return 'full'
  if (segs.length === 1 && segs[0].start === 0 && segs[0].end === S.dur) return 'full'
  const r = v => Math.round(v * 10) / 10
  return segs.map(s => `${s.id}:${r(s.start)}-${r(s.end)}`).join('|')
}
// 统一生效段落：S.segments 非空则用其；否则若草稿被拖拽 → 自动把草稿范围添加为段落；否则返回空（=整片）
function resolveSegments() {
  if (S.segments.length) return S.segments.map(s => ({ id: s.id, start: s.start, end: s.end }))
  if (draftTrimmed() && S.dur > 0) {
    const id = nextSegId()
    const seg = { id, start: S.draft.start, end: S.draft.end }
    S.segments.push({ id, start: S.draft.start, end: S.draft.end, checked: true })
    S.activeId = id
    renderSegList()
    syncFromActive()
    return [{ id, start: seg.start, end: seg.end }]
  }
  return []
}
$('gen-note').onclick = async () => {
  const btn = $('gen-note')
  btn.disabled = true
  const nr = $('note-result')
  nr.classList.add('hidden')
  nr.textContent = ''
  const segs = resolveSegments()
  const trimmed = segs.length > 0                       // 是否为「已圈选段落」（需剪切/压缩）
  const scopeLabel = trimmed ? `共 ${segs.length} 段` : '整片（未圈选）'
  try {
    if (trimmed) {
      // ① 应用剪切（逐段串行）
      flowStatus(`步骤 1/5：应用剪切（${scopeLabel}）…`)
      S.op = 'trim'
      for (let i = 0; i < segs.length; i++) {
        flowStatus(`步骤 1/5：应用剪切（${scopeLabel} · ${i + 1}/${segs.length}）…`)
        await api('/api/trim', 'POST', { segmentId: segs[i].id, start: segs[i].start, end: segs[i].end })
      }
      $('trim-text').textContent = ''
      // ② 应用压缩（选档才压，逐段串行）
      if (S.crf !== null) {
        flowStatus(`步骤 2/5：应用压缩（CRF ${S.crf} · ${scopeLabel}）…`)
        S.op = 'compress'
        for (let i = 0; i < segs.length; i++) {
          flowStatus(`步骤 2/5：应用压缩（CRF ${S.crf} · ${scopeLabel} · ${i + 1}/${segs.length}）…`)
          await api('/api/compress', 'POST', { segmentId: segs[i].id, start: segs[i].start, end: segs[i].end, crf: S.crf })
        }
      } else {
        flowStatus('步骤 2/5：应用压缩（未选档位，跳过）')
      }
      $('cp-text').textContent = ''
    } else {
      flowStatus('步骤 1/5：应用剪切（整片未圈选，跳过） → 步骤 2/5：应用压缩（跳过）')
    }
    if (!S.delivered) {
      // ③ 转文字（签名不符自动重转；单次模型加载多文件转录）
      const wantSig = flowSig(segs)
      if (!S.transcript || S.transcriptSig !== wantSig) {
        flowStatus('步骤 3/5：转文字（模型单次加载，稍候）…')
        const tsWrap = $('ts-wrap')
        tsWrap.classList.remove('hidden')
        const st = $('ts-status')
        st.className = 'hint'
        st.textContent = '转录中（首次加载模型约1-2分钟，请稍候）…'
        $('ts-text').value = ''
        const rt = await api('/api/transcribe', 'POST', { segments: segs.map(s => ({ id: s.id, start: s.start, end: s.end })) })
        S.transcript = rt.transcript
        S.transcriptSig = wantSig
        $('ts-text').value = rt.transcript
        st.textContent = '转录完成'
        st.className = 'hint ok'
      } else {
        flowStatus('步骤 3/5：转文字（当前段落已有转录，跳过）')
      }
      // ④ AI 润色（元数据 + 按段润色，独立步骤；完成后回填润色稿到转写框）
      flowStatus('步骤 4/5：AI 润色…')
      applyPolished(await api('/api/note-prepare', 'POST', { segments: segs.map(s => ({ id: s.id, start: s.start, end: s.end })) }))
      // ⑤ 生成笔记（自动交付 + 写入文献盒）
      flowStatus('步骤 5/5：生成笔记（自动交付 + 写入文献盒）…')
      const r = await api('/api/done', 'POST', {
        segments: segs.map(s => ({ id: s.id, start: s.start, end: s.end })),
        mode: S.mode,
        crf: S.crf,
      })
      await showDelivered(r)
    } else {
      if (!S.transcript) throw new Error('缺少转录文本：请先转文字')
      flowStatus('步骤 4/5：AI 润色…')
      applyPolished(await api('/api/note-prepare', 'POST', { segments: segs.map(s => ({ id: s.id, start: s.start, end: s.end })) }))
      flowStatus('步骤 5/5：生成笔记…')
    }
    const r2 = await api('/api/note', 'POST', {})
    const a = document.createElement('a')
    a.href = r2.note.url
    a.textContent = `📄 ${r2.note.wiki}（未自动打开时点击跳转）`
    nr.appendChild(a)
    nr.classList.remove('hidden')
    try { window.location.href = r2.note.url } catch {}   // 自动在 Obsidian 打开（浏览器首次可能弹外部协议确认）
    flowStatus('')
    toast('✅ 文献笔记已生成')
  } catch (e) {
    flowStatus('')
    toast(e.message, true)
  } finally {
    S.op = null
    btn.disabled = false
  }
}

// ---- 返回原视频（清空段落回到整片，可重新剪辑）----
$('revert-btn').onclick = async () => {
  try {
    const r = await api('/api/revert', 'POST', {})
    S.dur = r.duration
    S.draft = { start: 0, end: r.duration }
    S.segments = []
    S.activeId = null
    $('revert-btn').classList.add('hidden')
    initTrimUI(r.duration)
    renderSegList()
    syncFromActive()
    loadVideo()
    resetProgress()
    toast('↩ 已返回原视频，可重新剪辑')
  } catch (e) { toast(e.message, true) }
}

// ---- 取消 / 新建任务 ----
function resetUI() {
  S.info = null
  S.transcript = ''
  S.transcriptSig = ''
  S.dur = 0
  S.delivered = false
  S.draft = { start: 0, end: 0 }
  S.mode = 'split'
  setMode('split')
  S.segments = []
  S.activeId = null
  S.pages = []; S.pageIndex = 0
  const pagesEl = $('pages'); if (pagesEl) { pagesEl.innerHTML = ''; pagesEl.classList.add('hidden') }
  $('revert-btn').classList.add('hidden')
  ;['card-wrap', 'dl-wrap', 'preview-wrap', 'ts-wrap', 'result-wrap'].forEach(id => $(id).classList.add('hidden'))
  $('url').value = ''
  $('done-btn').disabled = true
  updateGenNote()
  $('note-result').classList.add('hidden')
  $('note-result').textContent = ''
  $('video').removeAttribute('src')
  $('video').load && $('video').load()
  $('dl-diag').textContent = ''
  $('dl-fill').style.width = '0'
  $('dl-text').textContent = ''
  resetProgress()
  $('ts-text').value = ''
  $('seg-list').innerHTML = ''
  $('timeline-blocks').innerHTML = ''
  syncFromActive()
}
$('cancel-btn').onclick = async () => {
  try {
    await api('/api/cancel', 'POST', {})
    resetUI()
    toast('任务已取消，全部临时产物已删除（已交付文件不受影响）')
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
    $('set-ffprobePath').value = r.config.ffprobePath || ''
    $('set-pythonPath').value = r.config.pythonPath || ''
    $('set-whisperModel').value = r.config.whisperModel || ''
    $('set-cacheDir').value = r.config.cacheDir || ''
    $('set-cacheRetentionDays').value = r.config.cacheRetentionDays != null ? r.config.cacheRetentionDays : '7'
    $('set-literatureFolder').value = r.config.literatureFolder || '文献盒'
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
      ffprobePath: $('set-ffprobePath').value.trim() || 'ffprobe',
      pythonPath: $('set-pythonPath').value.trim(),
      whisperModel: $('set-whisperModel').value.trim() || 'small',
      cacheDir: $('set-cacheDir').value.trim(),
      cacheRetentionDays: parseInt($('set-cacheRetentionDays').value.trim(), 10) || 7,
      literatureFolder: $('set-literatureFolder').value.trim() || '文献盒',
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
  syncFromActive()
  try {
    const r = await api('/api/config')
    onCookieStatus(r.cookieConfigured ? r.cookieValid : false)
  } catch {}
})
