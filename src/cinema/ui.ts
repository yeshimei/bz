/**
 * 影院（cinema）域 UI：一比一复刻原型（movie-prototype-3b-full 定稿）
 * 桌面：左栏分类树（类型+状态+底部 AI 荐片/分析）＋ 右侧海报网格（观影日期倒序）
 * 移动：右上角 🤖/📊/❌ ＋ 搜索/添加 ＋ 分类横滑 ＋ 海报网格（3 列）
 * 交互：点海报 → 详情弹窗（无滚动条/无关闭按钮，编辑/删除在弹窗内）
 *       想看/在看 灰色小字 → 快速状态窗（升级+评分滑杆+影评）
 *       再点已选分类 → 取消筛选
 * 样式：自绘主题变量（不套 Obsidian 变量），亮/暗随 Obsidian 主题，类名 bz-cinema-*
 */
import type { App } from 'obsidian';
import { TFile } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { allocZ } from '../core/z-order';
import { notice } from '../core/notice';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import {
  STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED, RATING_MAX, DEFAULT_RATING,
  GROUP_ORDER, GROUP_SUBS, TYPE_COLORS, STATUS_COLORS, ALL_TAGS, getGroupForTag,
} from './constants';
import { M, resetCinemaState, type CinemaItem } from './state';
import { rebuildItems, getDisplayItems, refreshDataAndView } from './data';

// ---------- 小工具 ----------

function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]));
}

/** 相对日期（仿 core formatRelativeTime）：刚刚/N分钟前/N小时前/昨天/前天/周几/MM-DD/YYYY-MM-DD */
export function relDate(d: string | null, now: Date = new Date()): string {
  if (!d) return '未标注日期';
  const t = new Date(d).getTime();
  if (isNaN(t)) return '未标注日期';
  const nowMs = now.getTime();
  const diffSeconds = Math.floor((nowMs - t) / 1000);
  const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  if (diffSeconds < 0) return fmt(new Date(t)); // 未来 → 原样日期
  if (diffSeconds < 60) return '刚刚';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;
  const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const todayStart = startOfDay(now);
  const targetDay = startOfDay(new Date(t));
  const dayDiff = Math.round((todayStart - targetDay) / 86400000);
  if (dayDiff === 0) return `${Math.floor(diffMinutes / 60)}小时前`;
  if (dayDiff === 1) return '昨天';
  if (dayDiff === 2) return '前天';
  const day = now.getDay();
  const weekStart = todayStart - (day === 0 ? 6 : day - 1) * 86400000;
  if (targetDay >= weekStart && targetDay < todayStart) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(t).getDay()];
  }
  if (new Date(t).getFullYear() === now.getFullYear()) {
    return `${String(new Date(t).getMonth() + 1).padStart(2, '0')}-${String(new Date(t).getDate()).padStart(2, '0')}`;
  }
  return fmt(new Date(t));
}

/** 类型徽章色 */
function groupColor(group: string): string {
  return TYPE_COLORS[group] ?? '#888';
}

/** 状态徽章色 */
function statusColor(status: number): string {
  return status === STATUS_WANT ? STATUS_COLORS['想看'] : status === STATUS_WATCHING ? STATUS_COLORS['在看'] : STATUS_COLORS['已看'];
}

function statusText(status: number): string {
  return status === STATUS_WANT ? '想看' : status === STATUS_WATCHING ? '在看' : '已看';
}

// ---------- 海报 ----------

/** 海报资源 URL（file 相对路径 → vault 资源路径）；无图返回 null */
function posterUrl(item: CinemaItem, app: App): string | null {
  if (!item.poster) return null;
  const f = app.vault.getAbstractFileByPath(item.poster);
  if (f && f instanceof TFile && /\.(png|jpe?g|gif|webp)$/i.test(f.name)) {
    return app.vault.getResourcePath(f);
  }
  return null;
}

/** 海报区块 HTML：有图出图（onerror 兜底），无图出占位 */
function posterBlock(item: CinemaItem, app: App, cls: string): string {
  const url = posterUrl(item, app);
  if (!url) return `<div class="bz-cinema-poster-blank ${cls}"></div>`;
  return `<div class="${cls}"><img src="${esc(url)}" alt="" loading="lazy" onerror="this.parentNode.innerHTML=''"></div>`;
}

// ---------- 渲染：左栏 ----------

function countBy(list: CinemaItem[], key: (it: CinemaItem) => string): Record<string, number> {
  const acc: Record<string, number> = {};
  list.forEach((it) => {
    const k = key(it);
    acc[k] = (acc[k] || 0) + 1;
  });
  return acc;
}

function renderNavHtml(app: App): string {
  const groupCounts = countBy(M.items, (it) => it.group);
  const subCounts = countBy(M.items, (it) => it.typeTag);
  const statusCounts = { 想看: 0, 在看: 0, 已看: 0 };
  M.items.forEach((it) => { statusCounts[statusText(it.status)]++; });

  let html = '<div class="bz-cinema-nav-label">类型</div>';
  for (const g of GROUP_ORDER) {
    if (!groupCounts[g]) continue;
    const isOpen = !!M.expanded[g];
    const active = M.typeFilter === g && !M.subFilter;
    html += `<button class="bz-cinema-nav-item${active ? ' bz-cinema-nav-active' : ''}" data-cinema-type="${g}">
      <span class="bz-cinema-nav-dot" style="background:${groupColor(g)}"></span>${g}<span class="bz-cinema-nav-cnt">${groupCounts[g]}</span></button>`;
    const subs = (GROUP_SUBS[g] || []).filter((s) => subCounts[s]);
    if (subs.length) {
      html += `<div class="bz-cinema-nav-sub${isOpen ? ' bz-cinema-nav-sub-open' : ''}">`;
      for (const s of subs) {
        html += `<button class="bz-cinema-nav-sub-item${M.subFilter === s ? ' bz-cinema-nav-active' : ''}" data-cinema-sub="${s}">${s}<span class="bz-cinema-nav-cnt">${subCounts[s]}</span></button>`;
      }
      html += '</div>';
    }
  }
  html += '<div class="bz-cinema-nav-label">状态</div>';
  (['想看', '在看', '已看'] as const).forEach((s) => {
    const active = M.statusFilter === s;
    html += `<button class="bz-cinema-nav-item${active ? ' bz-cinema-nav-active' : ''}" data-cinema-status="${s}">
      <span class="bz-cinema-nav-dot" style="background:${STATUS_COLORS[s]}"></span>${s}<span class="bz-cinema-nav-cnt">${statusCounts[s]}</span></button>`;
  });
  html += '<div class="bz-cinema-nav-tools">';
  html += `<button class="bz-cinema-nav-tool${M.view === 'ai' ? ' bz-cinema-nav-active' : ''}" data-cinema-tool="ai"><span class="bz-cinema-tool-ic">🤖</span>AI 荐片</button>`;
  html += `<button class="bz-cinema-nav-tool${M.view === 'stat' ? ' bz-cinema-nav-active' : ''}" data-cinema-tool="stat"><span class="bz-cinema-tool-ic">📊</span>影视分析</button>`;
  html += '</div>';
  return html;
}

// ---------- 渲染：海报网格 ----------

function pcardHtml(item: CinemaItem, app: App): string {
  const badge = item.status !== STATUS_WATCHED
    ? `<span class="bz-cinema-p-badge" style="background:${statusColor(item.status)}">${statusText(item.status)}</span>` : '';
  const upgradeable = item.status !== STATUS_WATCHED;
  const idx = M.items.indexOf(item);
  // 灰色小字：想看/在看 = 可点状态 + 相对日期；已看 = 星星（无数字）+ 相对日期
  let metaInner = esc(relDate(item.watchDate));
  if (item.status === STATUS_WANT || item.status === STATUS_WATCHING) {
    metaInner = `<span class="bz-cinema-st-label" data-cinema-upgrade="${idx}">${statusText(item.status)}</span> · ${metaInner}`;
  } else if (item.rating && item.rating > 0) {
    metaInner = `<span class="bz-cinema-p-stars">${stars(item.rating)}</span> · ${metaInner}`;
  }
  return `<div class="bz-cinema-pcard" data-cinema-idx="${idx}">
    ${posterBlock(item, app, 'bz-cinema-poster-wrap')}${badge}
    <div class="bz-cinema-p-name">${esc(item.name)}</div>
    <div class="bz-cinema-p-meta${upgradeable ? ' bz-cinema-p-meta-up' : ''}">${metaInner}</div></div>`;
}

/** 星星串（5 星轨道，黄色） */
function stars(rating: number): string {
  if (!rating || rating <= 0) return '';
  const st = Math.min(Math.round((rating / 2) * 2) / 2, 5);
  const full = Math.floor(st);
  let s = '';
  for (let i = 0; i < full; i++) s += '★';
  for (let j = full; j < 5; j++) s += '☆';
  return s;
}

function renderListHtml(app: App): string {
  const list = getDisplayItems();
  if (!list.length) {
    return '<div class="bz-cinema-empty"><div class="bz-cinema-empty-ic">🎬</div><p>没有符合条件的影视</p><div class="bz-cinema-empty-hint">试试清空筛选或搜索</div></div>';
  }
  return `<div class="bz-cinema-grid">${list.map((it) => pcardHtml(it, app)).join('')}</div>`;
}

// ---------- 渲染：AI 荐片 / 分析页 ----------

function renderAiPageHtml(app: App): string {
  const watched = M.items.filter((i) => i.status === STATUS_WATCHED && i.rating && i.rating > 0);
  const byGroup: Record<string, number> = {};
  const byDirector: Record<string, number> = {};
  const byActor: Record<string, number> = {};
  watched.forEach((i) => {
    byGroup[i.group] = (byGroup[i.group] || 0) + 1;
    if (i.director) i.director.split('/').forEach((d) => { d = d.trim(); if (d) byDirector[d] = (byDirector[d] || 0) + 1; });
    if (i.actors) i.actors.split('/').slice(0, 3).forEach((a) => { a = a.trim(); if (a) byActor[a] = (byActor[a] || 0) + 1; });
  });
  const top = (acc: Record<string, number>) => Object.keys(acc).sort((a, b) => acc[b] - acc[a])[0] || '未知';
  const topGroup = top(byGroup) === '未知' ? '电影' : top(byGroup);
  const topDirector = top(byDirector);
  const topActor = top(byActor);
  const avg = watched.length ? (watched.reduce((s, i) => s + (i.rating as number), 0) / watched.length).toFixed(1) : '—';

  let cand = M.items.filter((i) => i.status === STATUS_WANT || i.status === STATUS_WATCHING);
  if (cand.length < 5) cand = cand.concat(M.items.filter((i) => i.status === STATUS_WATCHED).slice(0, 5 - cand.length));
  const recs = cand.slice(0, 5).map((i) => {
    let reason: string;
    if (i.status === STATUS_WANT) reason = `在你的想看清单里，${i.director ? `你偏爱 ${topDirector} 的风格，${i.director} 的作品很可能对味` : '口碑值得期待'}。`;
    else if (i.status === STATUS_WATCHING) reason = `正在追的剧，${i.group === topGroup ? `与你最常看的 ${topGroup} 类型一致` : `拓展了你的 ${i.group} 类型版图`}。`;
    else reason = `你给同类型影视的均分约 ${avg}，这部评分 ${Number(i.rating).toFixed(1)}，大概率合口味。`;
    return { it: i, reason };
  });

  let html = '<div class="bz-cinema-page"><div class="bz-cinema-page-head"><span class="bz-cinema-page-title">🤖 AI 荐片</span><span class="bz-cinema-page-sub">基于 ' + watched.length + ' 部已看影视的口味画像</span></div>';
  html += `<div class="bz-cinema-page-sub" style="margin-bottom:12px;">偏好：${topGroup} · ${topDirector} · ${topActor} · 均分 ${avg}</div>`;
  for (const r of recs) {
    html += `<div class="bz-cinema-rec-card">${posterBlock(r.it, app, 'bz-cinema-rec-poster')}
      <div><div class="bz-cinema-rec-name">${esc(r.it.name)}</div>
      <div class="bz-cinema-rec-meta">${esc(r.it.typeTag)}${r.it.rating ? ` · ${Number(r.it.rating).toFixed(1)}` : ` · ${statusText(r.it.status)}`}${r.it.director ? ` · ${esc(r.it.director)}` : ''}</div>
      <div class="bz-cinema-rec-reason">${esc(r.reason)}</div></div></div>`;
  }
  html += '</div>';
  return html;
}

function renderStatPageHtml(): string {
  const total = M.items.length;
  const watchedN = M.items.filter((i) => i.status === STATUS_WATCHED).length;
  const wantN = M.items.filter((i) => i.status === STATUS_WANT).length;
  const watchingN = M.items.filter((i) => i.status === STATUS_WATCHING).length;
  const withReview = M.items.filter((i) => i.review).length;
  const watched = M.items.filter((i) => i.status === STATUS_WATCHED && i.rating && i.rating > 0);
  const avg = watched.length ? (watched.reduce((s, i) => s + (i.rating as number), 0) / watched.length).toFixed(1) : '—';
  const byGroup = countBy(M.items, (it) => it.group);
  const byTag = countBy(M.items, (it) => it.typeTag);
  const maxGroup = Math.max(1, ...Object.values(byGroup));
  const maxTag = Math.max(1, ...Object.values(byTag));
  const tagRows = Object.keys(byTag).sort((a, b) => byTag[b] - byTag[a]).slice(0, 6);

  let html = '<div class="bz-cinema-page"><div class="bz-cinema-page-head"><span class="bz-cinema-page-title">📊 影视分析</span></div>';
  html += '<div class="bz-cinema-stat-grid">';
  html += `<div class="bz-cinema-stat-card"><div class="bz-cinema-stat-num">${total}</div><div class="bz-cinema-stat-label">全部影视</div></div>`;
  html += `<div class="bz-cinema-stat-card"><div class="bz-cinema-stat-num">${watchedN}</div><div class="bz-cinema-stat-label">已看</div></div>`;
  html += `<div class="bz-cinema-stat-card"><div class="bz-cinema-stat-num">${avg}</div><div class="bz-cinema-stat-label">平均评分</div></div>`;
  html += `<div class="bz-cinema-stat-card"><div class="bz-cinema-stat-num">${wantN}</div><div class="bz-cinema-stat-label">想看</div></div>`;
  html += `<div class="bz-cinema-stat-card"><div class="bz-cinema-stat-num">${watchingN}</div><div class="bz-cinema-stat-label">在看</div></div>`;
  html += `<div class="bz-cinema-stat-card"><div class="bz-cinema-stat-num">${withReview}</div><div class="bz-cinema-stat-label">写了影评</div></div>`;
  html += '</div>';
  html += '<div class="bz-cinema-sec-title">类型分布</div>';
  Object.keys(byGroup).sort((a, b) => byGroup[b] - byGroup[a]).forEach((g) => {
    html += `<div class="bz-cinema-stat-bar"><span class="bz-cinema-stat-bar-label">${g}</span><div class="bz-cinema-stat-bar-track"><div class="bz-cinema-stat-bar-fill" style="width:${(byGroup[g] / maxGroup) * 100}%"></div></div><span class="bz-cinema-stat-bar-num">${byGroup[g]}</span></div>`;
  });
  html += '<div class="bz-cinema-sec-title">细分类型 TOP</div>';
  tagRows.forEach((t) => {
    html += `<div class="bz-cinema-stat-bar"><span class="bz-cinema-stat-bar-label">${t}</span><div class="bz-cinema-stat-bar-track"><div class="bz-cinema-stat-bar-fill" style="width:${(byTag[t] / maxTag) * 100}%"></div></div><span class="bz-cinema-stat-bar-num">${byTag[t]}</span></div>`;
  });
  html += '</div>';
  return html;
}

// ---------- 渲染：主内容区 ----------

function renderContent(app: App): void {
  const content = M.currentOverlay?.querySelector('.bz-cinema-content') as HTMLElement | null;
  if (!content) return;
  if (M.view === 'ai') content.innerHTML = renderAiPageHtml(app);
  else if (M.view === 'stat') content.innerHTML = renderStatPageHtml();
  else content.innerHTML = renderListHtml(app);
}

export function renderAll(app: App): void {
  const nav = M.currentOverlay?.querySelector('.bz-cinema-nav') as HTMLElement | null;
  if (nav) nav.innerHTML = renderNavHtml(app);
  const mobNav = M.currentOverlay?.querySelector('.bz-cinema-mob-nav') as HTMLElement | null;
  if (mobNav) mobNav.innerHTML = renderMobNavHtml();
  renderContent(app);
}

/** 移动端分类横滑条（类型 + 状态，点击筛选/再点取消） */
function renderMobNavHtml(): string {
  const groupCounts = countBy(M.items, (it) => it.group);
  const statusCounts = { 想看: 0, 在看: 0, 已看: 0 };
  M.items.forEach((it) => { statusCounts[statusText(it.status)]++; });
  let html = '';
  for (const g of GROUP_ORDER) {
    if (!groupCounts[g]) continue;
    html += `<span class="bz-cinema-mob-chip${M.typeFilter === g && !M.subFilter ? ' bz-cinema-mob-chip-active' : ''}" data-cinema-mob data-cinema-type="${g}">${g}</span>`;
  }
  (['想看', '在看', '已看'] as const).forEach((s) => {
    html += `<span class="bz-cinema-mob-chip${M.statusFilter === s ? ' bz-cinema-mob-chip-active' : ''}" data-cinema-mob data-cinema-status="${s}">${s}</span>`;
  });
  return html;
}

// ---------- 弹窗基础设施 ----------

/** 通用弹窗（遮罩 + 内容容器），返回 { mask, modal }；z 动态发号 */
function openModal(contentHtml: string, maxWidth = 400): { mask: HTMLElement; modal: HTMLElement } {
  const mask = document.createElement('div');
  mask.className = 'bz-cinema-mask';
  mask.style.zIndex = String(allocZ());
  mask.innerHTML = `<div class="bz-cinema-modal" style="max-width:${maxWidth}px">${contentHtml}</div>`;
  document.body.appendChild(mask);
  const modal = mask.firstElementChild as HTMLElement;
  mask.addEventListener('click', (e) => {
    if (e.target === mask) mask.remove();
  });
  return { mask, modal };
}

function closeModal(mask: HTMLElement): void {
  mask.remove();
}

// ---------- 详情弹窗（无滚动条、无关闭按钮；编辑/删除在弹窗内） ----------

function openDetail(item: CinemaItem, app: App): void {
  const html = `<div class="bz-cinema-dm-head">${posterBlock(item, app, 'bz-cinema-dm-poster')}
    <div><div class="bz-cinema-dm-title">${esc(item.name)}</div>
    <div class="bz-cinema-dm-badges">
      <span class="bz-cinema-chip" style="background:${groupColor(item.group)}">${esc(item.typeTag)}</span>
      ${item.status !== STATUS_WATCHED ? `<span class="bz-cinema-chip" style="background:${statusColor(item.status)}">${statusText(item.status)}</span>` : ''}
      ${item.rating && item.rating > 0 ? `<span class="bz-cinema-dm-stars">${stars(item.rating)}</span><span class="bz-cinema-dm-rating">${Number(item.rating).toFixed(1)}</span>` : ''}
      ${item.watchDate ? `<span class="bz-cinema-dm-date">${esc(relDate(item.watchDate))}</span>` : ''}
    </div>
    ${item.review ? `<div class="bz-cinema-dm-review">${esc(item.review)}</div>` : ''}
    </div></div>`;
  const rows: [string, string][] = ([
    ['类型', item.genre ?? ''],
    ['导演', item.director ?? ''],
    ['主演', item.actors ?? ''],
    ['制片国家/地区', item.region ?? ''],
    ['上映日期', item.year ?? ''],
    ['豆瓣评分', item.doubanRating ?? ''],
  ] as [string, string][]).filter(([, v]) => v !== '');
  let body = html;
  if (rows.length) {
    body += '<div class="bz-cinema-sec-title">豆瓣信息</div>';
    rows.forEach(([k, v]) => { body += `<div class="bz-cinema-kv"><span class="bz-cinema-kv-k">${k}</span><span class="bz-cinema-kv-v">${esc(v)}</span></div>`; });
  }
  if (item.doubanUrl) body += `<div class="bz-cinema-kv"><span class="bz-cinema-kv-k">豆瓣链接</span><span class="bz-cinema-kv-v"><a href="${esc(item.doubanUrl)}" target="_blank" rel="noopener">${esc(item.doubanUrl)}</a></span></div>`;
  if (item.synopsis) body += `<div class="bz-cinema-sec-title">简介</div><div class="bz-cinema-synopsis">${esc(item.synopsis)}</div>`;
  body += `<div class="bz-cinema-dm-actions"><button class="bz-cinema-btn" data-cinema-dm-edit>✏️ 编辑</button><button class="bz-cinema-btn bz-cinema-btn-danger" data-cinema-dm-del>🗑 删除</button></div>`;
  const { mask, modal } = openModal(body, 400);
  modal.classList.add('bz-cinema-dm');
  modal.querySelector('[data-cinema-dm-edit]')?.addEventListener('click', () => {
    mask.remove();
    openEditForm(item, app);
  });
  modal.querySelector('[data-cinema-dm-del]')?.addEventListener('click', () => {
    mask.remove();
    openDeleteConfirm(item, app);
  });
  registerModalEsc(mask);
}

// ---------- 添加 / 编辑（评分滑杆） ----------

/** 本地时间 YYYY-MM-DD HH:mm:ss（写笔记用） */
function localNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 把条目落盘：新增建笔记（movie 域同格式），编辑/快速状态写 frontmatter（保留海报/豆瓣字段） */
async function persistItem(item: CinemaItem, app: App): Promise<void> {
  if (!item.file) {
    // 新增：创建《名称》.md（与 movie 域文件格式一致；海报/豆瓣字段由外部工具补）
    const folder = M.folderPath;
    if (!app.vault.getAbstractFileByPath(folder)) {
      await app.vault.createFolder(folder);
    }
    const filePath = `${folder}/《${item.name}》.md`;
    const content = `---\ntags:\n- ${item.typeTag}\n观影日期: ${item.watchDate || localNow()}\n评分: ${item.rating ?? 0}\n${item.review ? `影评: ${item.review}\n` : ''}海报: \n---\n`;
    const f = await app.vault.create(filePath, content);
    item.file = f;
    return;
  }
  // 编辑/快速状态：写 frontmatter（不动海报/豆瓣等字段）
  await app.fileManager.processFrontMatter(item.file, (fm: Record<string, unknown>) => {
    fm['评分'] = item.rating ?? 0;
    fm['观影日期'] = item.watchDate || localNow();
    if (item.review) fm['影评'] = item.review;
    else delete fm['影评'];
  });
}

/** 打开添加弹窗（命令 bz-cinema-add 直达；未开主面板则先建） */
export function openAddModalDirect(app: App): void {
  if (!M.currentOverlay) createOverlay(app);
  openEditForm(null, app);
}

function openEditForm(item: CinemaItem | null, app: App): void {
  const editing = !!item;
  const ratingVal = item && item.rating && item.rating > 0 ? item.rating : DEFAULT_RATING;
  const tagOptions = ALL_TAGS.map((t) => `<option value="${t}"${item && item.typeTag === t ? ' selected' : t === '电影' && !item ? ' selected' : ''}>${t}</option>`).join('');
  const statusOptions = ['想看', '在看', '已看'].map((s) => `<option${item && statusText(item.status) === s ? ' selected' : s === '已看' && !item ? ' selected' : ''}>${s}</option>`).join('');
  const html = `<div class="bz-cinema-form-title">${editing ? '编辑影视' : '添加影视'}</div>
    <div class="bz-cinema-form">
      <div><label>名称</label><input id="bz-cinema-f-name" value="${item ? esc(item.name) : ''}" placeholder="影视名称"></div>
      <div class="bz-cinema-form-row">
        <div><label>类型</label><select id="bz-cinema-f-tag">${tagOptions}</select></div>
        <div><label>状态</label><select id="bz-cinema-f-status">${statusOptions}</select></div>
      </div>
      <div><label>观影日期</label><input id="bz-cinema-f-date" type="date" value="${item && item.watchDate ? String(item.watchDate).slice(0, 10) : new Date().toISOString().slice(0, 10)}"></div>
      <div><label>评分（已看）</label><div class="bz-cinema-rating-row"><input type="range" id="bz-cinema-f-rating" min="1" max="${RATING_MAX}" step="0.1" value="${ratingVal}"><span class="bz-cinema-rating-val" id="bz-cinema-f-rating-val">${Number(ratingVal).toFixed(1)}</span></div></div>
      <div><label>影评</label><textarea id="bz-cinema-f-review" placeholder="写点什么…">${item ? esc(item.review ?? '') : ''}</textarea></div>
    </div>
    <div class="bz-cinema-form-actions"><button class="bz-cinema-btn" id="bz-cinema-f-cancel">取消</button><button class="bz-cinema-btn bz-cinema-btn-primary" id="bz-cinema-f-save">${editing ? '保存' : '添加'}</button></div>`;
  const { mask, modal } = openModal(html, 400);
  modal.classList.add('bz-cinema-dm');
  const ratingInput = modal.querySelector('#bz-cinema-f-rating') as HTMLInputElement;
  const ratingValEl = modal.querySelector('#bz-cinema-f-rating-val') as HTMLElement;
  ratingInput.addEventListener('input', () => { ratingValEl.textContent = Number(ratingInput.value).toFixed(1); });
  modal.querySelector('#bz-cinema-f-cancel')?.addEventListener('click', () => closeModal(mask));
  modal.querySelector('#bz-cinema-f-save')?.addEventListener('click', () => {
    const name = (modal.querySelector('#bz-cinema-f-name') as HTMLInputElement).value.trim();
    if (!name) { notice('请输入名称'); return; }
    const tag = (modal.querySelector('#bz-cinema-f-tag') as HTMLSelectElement).value;
    const status = (modal.querySelector('#bz-cinema-f-status') as HTMLSelectElement).value;
    const rating = parseFloat(ratingInput.value);
    const date = (modal.querySelector('#bz-cinema-f-date') as HTMLInputElement).value;
    const review = (modal.querySelector('#bz-cinema-f-review') as HTMLTextAreaElement).value.trim();
    const group = getGroupForTag(tag) ?? '其他';
    const mapped = status === '已看' ? rating : status === '想看' ? -1 : 0;
    const st = status === '想看' ? STATUS_WANT : status === '在看' ? STATUS_WATCHING : STATUS_WATCHED;
    void (async () => {
      try {
        if (editing && item) {
          item.name = name; item.typeTag = tag; item.group = group;
          item.status = st; item.rating = mapped; item.watchDate = date; item.review = review;
          await persistItem(item, app);
        } else {
          const it: CinemaItem = { file: null, name, typeTag: tag, group, status: st, rating: mapped, watchDate: date, review, poster: null, genre: null, director: null, actors: null, region: null, year: null, doubanRating: null, doubanUrl: null, synopsis: null };
          M.items.unshift(it);
          await persistItem(it, app);
        }
        closeModal(mask);
        notice(editing ? '已保存' : '已添加', 'success');
        renderAll(app);
      } catch (e) {
        notice('保存失败', 'error');
        console.error(e);
      }
    })();
  });
  registerModalEsc(mask);
}

// ---------- 删除确认 ----------

function openDeleteConfirm(item: CinemaItem, app: App): void {
  const html = `<div class="bz-cinema-confirm">
    <div class="bz-cinema-confirm-ic">🗑</div>
    <p>确定删除《${esc(item.name)}》吗？</p>
    <div class="bz-cinema-confirm-sub">此操作不可撤销</div>
    <div class="bz-cinema-form-actions" style="justify-content:center;margin-top:16px;">
      <button class="bz-cinema-btn" id="bz-cinema-d-cancel">取消</button>
      <button class="bz-cinema-btn bz-cinema-btn-danger" id="bz-cinema-d-del">删除</button>
    </div></div>`;
  const { mask, modal } = openModal(html, 320);
  modal.classList.add('bz-cinema-dm');
  modal.querySelector('#bz-cinema-d-cancel')?.addEventListener('click', () => closeModal(mask));
  modal.querySelector('#bz-cinema-d-del')?.addEventListener('click', async () => {
    if (item.file) {
      try {
        await app.vault.delete(item.file);
      } catch (e) {
        console.error('删除影视笔记失败:', e);
      }
    }
    const idx = M.items.indexOf(item);
    if (idx > -1) M.items.splice(idx, 1);
    closeModal(mask);
    notice('影视已删除', 'success');
    renderAll(app);
  });
  registerModalEsc(mask);
}

// ---------- 快速状态窗（升级 + 评分滑杆 + 影评） ----------

function openQuickStatus(item: CinemaItem, app: App): void {
  // 升级路径：想看 →（在看/已看）；在看 →（已看）
  const targets = item.status === STATUS_WANT ? ['在看', '已看'] : ['已看'];
  const btns = targets.map((s) => `<button class="bz-cinema-qs-btn" data-cinema-qs="${s}">${s}</button>`).join('');
  const curRating = item.rating && item.rating > 0 ? item.rating : DEFAULT_RATING;
  const html = `<div class="bz-cinema-qs-title">${esc(item.name)}</div>
    <div class="bz-cinema-qs-btns">${btns}</div>
    <div class="bz-cinema-qs-rating"><div class="bz-cinema-qs-rating-label">评分（已看时生效）</div>
      <div class="bz-cinema-rating-row"><input type="range" id="bz-cinema-qs-rating" min="1" max="${RATING_MAX}" step="0.1" value="${curRating}">
      <span class="bz-cinema-rating-val" id="bz-cinema-qs-rating-val">${Number(curRating).toFixed(1)}</span></div></div>
    <div class="bz-cinema-qs-review"><label>影评</label><textarea id="bz-cinema-qs-review" placeholder="写点什么…">${item.review ? esc(item.review) : ''}</textarea></div>
    <div class="bz-cinema-form-actions"><button class="bz-cinema-btn" id="bz-cinema-qs-cancel">取消</button><button class="bz-cinema-btn bz-cinema-btn-primary" id="bz-cinema-qs-save">保存</button></div>
    <div class="bz-cinema-qs-hint">想快速看完？点「在看」→「已看」，评分与影评一步保存。</div>`;
  const { mask, modal } = openModal(html, 360);
  modal.classList.add('bz-cinema-dm');
  const ratingInput = modal.querySelector('#bz-cinema-qs-rating') as HTMLInputElement;
  const ratingValEl = modal.querySelector('#bz-cinema-qs-rating-val') as HTMLElement;
  ratingInput.addEventListener('input', () => { ratingValEl.textContent = Number(ratingInput.value).toFixed(1); });
  let selected = targets[0];
  modal.querySelectorAll('[data-cinema-qs]').forEach((b) => {
    b.addEventListener('click', () => {
      selected = (b as HTMLElement).dataset.cinemaQs as string;
      modal.querySelectorAll('[data-cinema-qs]').forEach((x) => x.classList.remove('bz-cinema-qs-active'));
      b.classList.add('bz-cinema-qs-active');
    });
  });
  modal.querySelector('#bz-cinema-qs-cancel')?.addEventListener('click', () => closeModal(mask));
  modal.querySelector('#bz-cinema-qs-save')?.addEventListener('click', () => {
    const ratingVal = parseFloat(ratingInput.value);
    const review = (modal.querySelector('#bz-cinema-qs-review') as HTMLTextAreaElement).value.trim();
    const mapped = selected === '已看' ? ratingVal : selected === '在看' ? 0 : -1;
    item.status = selected === '已看' ? STATUS_WATCHED : selected === '在看' ? STATUS_WATCHING : STATUS_WANT;
    item.rating = mapped;
    if (review) item.review = review;
    void (async () => {
      try {
        await persistItem(item, app);
        closeModal(mask);
        notice(`已标记${selected}`, 'success');
        renderAll(app);
      } catch (e) {
        notice('保存失败', 'error');
        console.error(e);
      }
    })();
  });
  registerModalEsc(mask);
}

// ---------- ESC ----------

let modalEscRegistered = false;
function registerModalEsc(mask: HTMLElement): void {
  if (!modalEscRegistered) {
    modalEscRegistered = true;
    escManager.register('bz-cinema-modal', {
      isVisible: () => !!document.querySelector('.bz-cinema-mask'),
      close: () => {
        document.querySelectorAll('.bz-cinema-mask').forEach((el) => el.remove());
      },
    });
  }
  // 单次：遮罩移除后 ESC 不再响应（isVisible 已覆盖）
  void mask;
}

// ---------- 主 overlay ----------

export function createOverlay(app: App): void {
  const overlay = document.createElement('div');
  overlay.className = 'bz-cinema-overlay';
  overlay.style.zIndex = String(allocZ());
  const fullscreen = (tryGetSettings() as Record<string, unknown>).cinemaMobileDefaultFullscreen === true;

  overlay.innerHTML = `
    <div class="bz-cinema-panel">
      <div class="bz-cinema-head">
        <div class="bz-cinema-title">影视</div>
        <div class="bz-cinema-head-btns">
          <button class="bz-cinema-ic-btn bz-cinema-mob-only" data-cinema-tool="ai" title="AI 荐片">🤖</button>
          <button class="bz-cinema-ic-btn bz-cinema-mob-only" data-cinema-tool="stat" title="数据分析">📊</button>
          <button class="bz-cinema-ic-btn bz-cinema-close" data-cinema-close title="关闭">❌</button>
        </div>
      </div>
      <div class="bz-cinema-body">
        <div class="bz-cinema-nav"></div>
        <div class="bz-cinema-main">
          <div class="bz-cinema-top">
            <div class="bz-cinema-search"><input type="text" data-cinema-search placeholder="🔍 搜索影视（名称、类型、影评）..."></div>
            <button class="bz-cinema-add" data-cinema-add>＋ 添加影视</button>
          </div>
          <div class="bz-cinema-mob-nav"></div>
          <div class="bz-cinema-content"></div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  M.currentOverlay = overlay;
  M.renderFn = () => renderAll(app);
  applyMobileWindowFullscreen(overlay.querySelector('.bz-cinema-panel') as HTMLElement, fullscreen);

  // 事件
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    // 分类（含二级展开/再点取消）
    const navItem = t.closest('[data-cinema-type]') as HTMLElement | null;
    if (navItem) {
      const g = navItem.dataset.cinemaType as string;
      const isMob = navItem.hasAttribute('data-cinema-mob');
      if (M.typeFilter === g && !M.subFilter) {
        M.typeFilter = null;
      } else {
        M.typeFilter = g;
        M.subFilter = null;
        // 桌面左栏才触发展开二级；移动端 chip 只做筛选
        const subs = (GROUP_SUBS[g] || []).filter((s) => M.items.some((i) => i.typeTag === s));
        if (subs.length && !isMob) M.expanded[g] = !M.expanded[g];
      }
      M.view = 'list';
      renderAll(app);
      return;
    }
    const subItem = t.closest('[data-cinema-sub]') as HTMLElement | null;
    if (subItem) {
      const s = subItem.dataset.cinemaSub as string;
      if (M.subFilter === s) M.subFilter = null;
      else {
        M.subFilter = s;
        M.typeFilter = getGroupForTag(s);
      }
      M.view = 'list';
      renderAll(app);
      return;
    }
    const statusItem = t.closest('[data-cinema-status]') as HTMLElement | null;
    if (statusItem) {
      const s = statusItem.dataset.cinemaStatus as string;
      M.statusFilter = M.statusFilter === s ? null : s;
      M.view = 'list';
      renderAll(app);
      return;
    }
    const tool = t.closest('[data-cinema-tool]') as HTMLElement | null;
    if (tool) {
      M.view = tool.dataset.cinemaTool === 'ai' ? 'ai' : 'stat';
      renderAll(app);
      return;
    }
    // 快速状态升级（想看/在看 灰色小字）
    const up = t.closest('[data-cinema-upgrade]') as HTMLElement | null;
    if (up) {
      const idx = Number(up.dataset.cinemaUpgrade);
      const item = M.items[idx];
      if (item) openQuickStatus(item, app);
      return;
    }
    // 海报卡片 → 详情
    const pcard = t.closest('[data-cinema-idx]') as HTMLElement | null;
    if (pcard) {
      const item = M.items[Number(pcard.dataset.cinemaIdx)];
      if (item) openDetail(item, app);
      return;
    }
    const add = t.closest('[data-cinema-add]') as HTMLElement | null;
    if (add) { openEditForm(null, app); return; }
    const close = t.closest('[data-cinema-close]') as HTMLElement | null;
    if (close) { closeOverlay(); return; }
  });

  // 搜索（防抖）
  const searchInput = overlay.querySelector('[data-cinema-search]') as HTMLInputElement;
  searchInput.addEventListener('input', () => {
    if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
    M.searchDebounceTimer = setTimeout(() => {
      M.searchKeyword = searchInput.value.trim();
      M.view = 'list';
      renderAll(app);
    }, 300);
  });

  rebuildItems(app);
  renderAll(app);
}

export function closeOverlay(): void {
  if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
  if (M.currentOverlay) {
    M.currentOverlay.remove();
    M.currentOverlay = null;
  }
  M.renderFn = null;
}

// ---------- ESC（主面板） ----------

let mainEscRegistered = false;
export function registerEscapeHandler(): void {
  if (mainEscRegistered) return;
  mainEscRegistered = true;
  escManager.register('bz-cinema', {
    isVisible: () => !!M.currentOverlay || !!document.querySelector('.bz-cinema-mask'),
    close: () => {
      const mask = document.querySelector('.bz-cinema-mask');
      if (mask) mask.remove();
      else closeOverlay();
    },
  });
}
