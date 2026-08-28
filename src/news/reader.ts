/**
 * 聚合讯（ticket 09）：新闻聚合阅读流——逐篇阅读、已读/跳过、剪藏保存、
 * news.json / news-stats.json 统计、dataviewjs 代码块写入。
 * 源码：聚合讯.js 逐字移植（单篇渲染 DOM、文案、样式一致）。
 */
import { TFile } from 'obsidian';
import { notice } from '../core/notice';
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { createSiteIcon, topifyZ } from '../core/dom';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { pad2 } from '../core/utils';
// 聚合讯观察（ticket 076，ADR-0029）：域事件派发挂点（域内 import 之后，对齐影视 movie/ui）
// ticket 123 追加（2026-08-27 用户拍板）：跳过也发观察（news:skipped → 行为流）——见 markAsRead
import { emitDomainEvent } from '../core/domain-bus';
import type { NewsReadEvent } from '../smartcat/news-source';

// ---------- 常量 ----------
// ticket 124（ADR-0060）：news.json 四段结构 + 保留策略；路径/读写/迁移收 src/news/data.ts
import {
  readNewsData, writeNewsData, migrateLegacyStats, applyRetention, normalizeRetentionDays, statsHasData,
} from './data';

const CLIP_DIR = '归档/网页剪藏';
const PLATFORM_DOMAIN: Record<string, string> = { '果壳': 'guokr.com', '知乎日报': 'zhihu.com', 'B站': 'bilibili.com' };

/** HTML 转义（源码内联 esc） */
const esc = (s: any) =>
  String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** frontmatter 双引号标量转义：引号 → \"、换行 → 空格，防破坏 YAML 结构（P1-24 全字段推广） */
const yamlEscape = (v: any): string =>
  String(v ?? '').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');

// ---------- 模块状态 ----------
let allArticles: any[] = [];
let articles: any[] = [];
let batchTotal = 0;
let currentIndex = 0;
let popup: HTMLElement | null = null;
let mask: HTMLElement | null = null;
let container: HTMLElement | null = null;
let stats: any = { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} };
/** ticket 076 修订（2026-08-25 用户拍板）：本篇文章累计可视时长——
 *  openedAt=本次显示会话起算时刻（0=暂停中）；accumMs=关闭前已累计可视毫秒（跨会话续算）；
 *  render 文章切换（url|title 键）才清零累计；hide 暂停并入 accumMs，重开同篇续算。 */
let openedAt = 0;
let accumMs = 0;
let renderedKey = '';
/** l5 三态：news.json 缺失（首用引导）与解析失败（错误态，不渲染「读完」态） */
let dataFileMissing = false;
let loadFailed = false;
/** show() 重入串行化：加载链在跑时重入（hide 后立即重开 / 双 show 并发）复用同一链，
 *  防双链竞态——晚完成链用旧快照覆盖面板、晚到 render() 重设 openedAt 截断已读时长。 */
let pendingLoad: Promise<void> | null = null;
/** ticket 124（ADR-0060）：news.json 写回串行队列——saveArticles（articles 段）与 saveStats
 *  （stats 段）同文件异步写回必须串行执行（先读盘→改段→整写），否则两写回并发互相覆盖对方段。 */
let writeChain: Promise<void> = Promise.resolve();
function enqueueWrite(fn: () => Promise<void>): void {
  writeChain = writeChain.then(fn).catch(() => { /* 写回失败静默（原语义） */ });
}

// ---------- 创建弹窗 ----------
function createMaskAndPopup() {
  // 防御：DOM 被外部清空（测试/热更新）后重建
  if (mask && mask.isConnected) return;

  mask = document.createElement('div');
  mask.className = 'news-mask';
  mask.onclick = () => hide();

  popup = document.createElement('div');
  popup.className = 'news-popup';

  // 关闭按钮（移动端显示）
  const closeBtn = document.createElement('button');
  closeBtn.className = 'news-close-btn';
  closeBtn.innerHTML = '❌';
  closeBtn.onclick = (e) => { e.stopPropagation(); hide(); };
  popup.appendChild(closeBtn);

  container = document.createElement('div');
  container.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';
  popup.appendChild(container);

  document.body.appendChild(mask);
  document.body.appendChild(popup);
}

// ---------- 统计（ticket 124：并入 news.json stats 段，兼容旧 news-stats.json 迁移）----------
export async function loadStats() {
  const res = await readNewsData();
  if (!res.ok || res.missing) return;
  let data = res.data;
  // 首次迁移：stats 段无真实数据且旧 news-stats.json 存在 → 并入并落盘一次
  if (!statsHasData(data.stats)) {
    const migrated = await migrateLegacyStats(data);
    if (statsHasData(migrated.stats) && migrated !== data) {
      data = migrated;
      await writeNewsData(data);
    }
  }
  stats = data.stats || stats;
}

export async function saveStats() {
  // 四段整读写：读盘保留 articles/bilibiliUps/sources，仅替换 stats 段；
  // 写回串行队列（与 saveArticles 同文件，防并发覆盖）
  enqueueWrite(async () => {
    try {
      const res = await readNewsData();
      if (!res.ok || res.missing) return;
      await writeNewsData({ ...res.data, stats });
    } catch (e) { /* 静默 */ }
  });
}

export function recordStat(action: string, article: any) {
  stats.totalRead++;
  if (action === 'saved') stats.totalSaved++;
  else stats.totalSkipped++;

  const platform = article.platform || '未知';
  stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;

  // x2b：byDate 键用本地日（对齐 src/pomodoro/stats.ts dayKey 口径，UTC+8 凌晨 0-8 点不落昨日）
  const today = localDayKey();
  stats.byDate[today] = (stats.byDate[today] || 0) + 1;

  void saveStats();
}

// ---------- 数据 ----------
/** 文章稳定标识（优先 url，其次 title+date）：双写者合并与游标锚定共用 */
function articleKeyOf(a: any): string {
  if (a && a.url) return 'url:' + String(a.url);
  return 'td:' + String((a && a.title) || '') + '|' + String((a && a.date) || '');
}

/**
 * 双写者合并：以磁盘为基底，同标识项用内存版本覆盖（携带 read 标记等处理状态），
 * 磁盘上多出的外部追加项原样保留，内存新增项防御性追加。
 */
export function mergeWithDisk(memory: any[], disk: any[]): any[] {
  const memByKey = new Map(memory.map((a: any) => [articleKeyOf(a), a]));
  const merged = disk.map((d: any) => memByKey.get(articleKeyOf(d)) ?? d);
  const diskKeys = new Set(disk.map((d: any) => articleKeyOf(d)));
  for (const m of memory) {
    if (!diskKeys.has(articleKeyOf(m))) merged.push(m);
  }
  return merged;
}

export async function loadArticles() {
  const app = getApp();
  loadFailed = false; // 每次加载重置状态（修复文件后重开即可恢复）
  const res = await readNewsData();
  if (res.missing) {
    // l5：无数据文件（首次使用）→ 首用引导态；allArticles 清空（后续 saveArticles 不覆写）
    dataFileMissing = true;
    allArticles = []; articles = []; batchTotal = 0;
    return;
  }
  if (!res.ok) {
    // l5：崩溃半截/损坏 JSON → 错误态（不渲染「读完」态），error toast 人话提示；
    // 保留磁盘旧文件不动（后续 saveArticles 不覆写），技术详情进 console
    loadFailed = true;
    allArticles = []; articles = []; batchTotal = 0;
    console.warn('[聚合讯] news.json 解析失败，进入错误态（不渲染完成态）');
    notice('新闻数据读取失败，请检查数据文件后重试', 'error');
    return;
  }
  dataFileMissing = false;
  const prevCurrent = articles[currentIndex]; // 重载前当前篇，用于游标锚定
  try {
    let data = res.data;
    // ticket 124（ADR-0060）保留策略：打开阅读器清理一次（插件侧；未读不处理）
    const s = tryGetSettings() as any;
    const savedDays = normalizeRetentionDays(s?.newsRetentionSavedDays) ?? 3;
    const skippedDays = normalizeRetentionDays(s?.newsRetentionSkippedDays) ?? 7;
    const cleaned = applyRetention(data.articles, savedDays, skippedDays);
    if (cleaned.length !== data.articles.length) {
      data = { ...data, articles: cleaned };
      await writeNewsData(data);
    }
    allArticles = data.articles;
    articles = allArticles.filter((a: any) => !a.read);
    batchTotal = articles.length;
  } catch (e) {
    loadFailed = true;
    allArticles = []; articles = []; batchTotal = 0;
    console.warn('[聚合讯] news.json 处理失败，进入错误态', e);
    notice('新闻数据读取失败，请检查数据文件后重试', 'error');
  }
  // 游标锚定：优先按上一当前篇的稳定标识定位新索引，找不到再夹取边界
  const anchored = anchorCursor(prevCurrent, articles);
  if (anchored >= 0) currentIndex = anchored;
  else if (currentIndex >= articles.length) currentIndex = Math.max(0, articles.length - 1);
}

/** 按上一当前篇的稳定标识在新列表中定位索引；找不到返回 -1（由调用方夹取边界） */
function anchorCursor(prev: any, list: any[]): number {
  if (!prev) return -1;
  const key = articleKeyOf(prev);
  return list.findIndex((x: any) => articleKeyOf(x) === key);
}

// ---------- 渲染 ----------
export function render() {
  if (!container) return;
  container.innerHTML = '';

  // l5 三态：解析失败 → 错误态（不渲染「读完」）；无数据文件 → 首用引导；真读空 → 完成态
  if (loadFailed) {
    renderErrorState();
    return;
  }
  if (articles.length === 0) {
    if (dataFileMissing) renderFirstUseState();
    else renderDoneState();
    return;
  }

  const a = articles[currentIndex];

  // ticket 076 修订：文章切换（打开/下一篇）→ 清零累计；同篇重渲染（面板重开）续算
  const key = a ? `${a.url}|${a.title}` : '';
  if (key !== renderedKey) {
    renderedKey = key;
    accumMs = 0;
  }
  openedAt = Date.now(); // 本次显示会话起算（重开同篇 = resume）

  // 固定头部（标题 + 元信息，不随滚动）
  const header = document.createElement('div');
  header.className = 'news-card-header';

  const title = document.createElement('div');
  title.className = 'news-card-title';
  title.textContent = a.title;
  header.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'news-card-meta';

  const pill = document.createElement('span');
  pill.className = 'platform-pill';
  const domain = PLATFORM_DOMAIN[a.platform];
  if (domain) {
    const icon = createSiteIcon(domain, 14);
    if (icon) pill.appendChild(icon);
  }
  const platformText = document.createElement('span');
  platformText.textContent = a.platform;
  pill.appendChild(platformText);
  meta.appendChild(pill);

  if (a.author) {
    const authorSpan = document.createElement('span');
    authorSpan.textContent = '👤 ' + a.author;
    meta.appendChild(authorSpan);
  }

  const date = a.date ? toDatetime(a.date).substring(0, 10) : '';
  if (date) {
    const dateSpan = document.createElement('span');
    dateSpan.textContent = '📅 ' + date;
    meta.appendChild(dateSpan);
  }
  header.appendChild(meta);

  // 可滚动正文区域
  const cardArea = document.createElement('div');
  cardArea.className = 'news-card-area';

  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'news-card-body';
  bodyDiv.innerHTML = renderMarkdown(a.body || '');
  cardArea.appendChild(bodyDiv);

  container.appendChild(header);
  container.appendChild(cardArea);

  // 底部栏（剩最后一篇时「下一篇」按钮改为完成说明）
  const bottombar = document.createElement('div');
  bottombar.className = 'news-bottombar';
  const nextLabel = articles.length === 1 ? '✅ 完成阅读' : '⏭️ 下一篇';
  bottombar.innerHTML = `
        <button class="news-btn news-btn-primary" data-action="save">📥 保存至剪藏</button>
        <button class="news-btn" data-action="next">${nextLabel}</button>
        <span class="news-counter">${batchTotal - articles.length + 1} / ${batchTotal}</span>
    `;
  container.appendChild(bottombar);
  bottombar.querySelector<HTMLElement>('[data-action="save"]')!.onclick = () => saveToClip();
  bottombar.querySelector<HTMLElement>('[data-action="next"]')!.onclick = () => skipArticle();
}

export function renderDoneState() {
  // x2b：今日统计键用本地日（与 recordStat 的 byDate 同口径）
  const today = localDayKey();
  const todayRead = stats.byDate[today] || 0;

  const cardArea = document.createElement('div');
  cardArea.className = 'news-card-area';
  cardArea.style.display = 'flex';
  cardArea.style.flexDirection = 'column';
  cardArea.style.alignItems = 'center';
  cardArea.style.justifyContent = 'center';
  cardArea.innerHTML = `
        <div style="background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:10px;padding:20px 28px;width:100%;max-width:360px;margin-bottom:24px;">
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:var(--text-muted);"><span>今日阅读</span><span style="color:var(--text-normal);font-weight:600;">${todayRead} 篇</span></div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:var(--text-muted);"><span>累计保存</span><span style="color:var(--text-normal);font-weight:600;">${stats.totalSaved} 篇</span></div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:var(--text-muted);"><span>总计阅读</span><span style="color:var(--text-normal);font-weight:600;">${stats.totalRead} 篇</span></div>
        </div>
        <div style="font-size:13px;color:var(--text-faint);">今日文章已读完，欢迎明天再来！</div>
    `;
  container!.appendChild(cardArea);
  // 完成态保留底部栏：右下角计数显示全部读完的最终值（N / N，与最后一篇一致）
  if (batchTotal > 0) {
    const bottombar = document.createElement('div');
    bottombar.className = 'news-bottombar';
    const counter = document.createElement('span');
    counter.className = 'news-counter';
    counter.textContent = `${batchTotal} / ${batchTotal}`;
    bottombar.appendChild(counter);
    container!.appendChild(bottombar);
  }
}

// ---------- 工具 ----------
/** 本地日期键 YYYY-MM-DD（对齐 src/pomodoro/stats.ts dayKey 本地日口径：UTC+8 凌晨 0-8 点不落昨日） */
export function localDayKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 本地时间戳 YYYY-MM-DD HH:mm:ss（剪藏 created 字段，避免 UTC+8 凌晨写入昨日） */
export function localDatetime(ts: number = Date.now()): string {
  const d = new Date(ts);
  const hms = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  return `${localDayKey(ts)} ${hms}`;
}

/**
 * l5 错误态：news.json 解析失败——错误 toast 已提示（loadArticles），面板不渲染「读完」态，
 * 只说明文件可能正在被写入或已损坏，重开即重试。
 */
function renderErrorState() {
  const card = document.createElement('div');
  card.className = 'news-done';
  card.innerHTML = `
        <div class="news-done-stats">
            <div class="news-done-stats-title">新闻数据读取失败</div>
            <div class="news-done-body">数据文件（CONFIG/STORAGE/news.json）可能正在被写入或已损坏。请检查文件内容后重新打开阅读器。</div>
        </div>
    `;
  container!.appendChild(card);
}

/**
 * l5 首用引导态：无数据文件（首次使用）——说明数据从哪来：
 * 由外部「数据源守护」进程（obsidian-news）抓取写入，插件本身只读渲染。
 */
function renderFirstUseState() {
  const card = document.createElement('div');
  card.className = 'news-done';
  card.innerHTML = `
        <div class="news-done-stats">
            <div class="news-done-stats-title">数据从哪里来？</div>
            <div class="news-done-body">聚合讯的数据由外部「数据源守护」进程（obsidian-news）自动抓取写入 CONFIG/STORAGE/news.json，插件本身不抓取新闻，只负责渲染阅读流。</div>
            <div class="news-done-body">首次使用请先配置并运行数据源守护（obsidian-news watch），守护进程每 30 分钟抓取最新文章入库，之后回到这里即可阅读。</div>
            <div class="news-done-body">B 站 UP 主聚合在剪藏本设置 →「数据源」组配置（添加关注的 UP 主即可自动抓取其新视频）。</div>
        </div>
    `;
  container!.appendChild(card);
}

/** l5 加载态占位：show() 异步加载期间的反馈（.news-loading 样式已收敛在 src/news/styles.css） */
function renderLoading() {
  if (!container) return;
  container.innerHTML = '';
  const loading = document.createElement('div');
  loading.className = 'news-loading';
  const spinner = document.createElement('div');
  spinner.className = 'news-loading-spinner';
  const text = document.createElement('div');
  text.textContent = '正在加载…';
  loading.appendChild(spinner);
  loading.appendChild(text);
  container.appendChild(loading);
}

export function toDatetime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date().toISOString().replace('T', ' ').substring(0, 19);
    return d.toISOString().replace('T', ' ').substring(0, 19);
  } catch {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }
}

/** markdown 渲染（源码逐字：先转义再正则替换，注意 &gt; 是转义后的 >） */
export function renderMarkdown(md: string): string {
  let html = esc(md);
  // 图片
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:6px;margin:8px 0;">');
  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // 标题
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // 粗体 / 斜体
  html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');
  // 引用
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote style="border-left:3px solid var(--background-modifier-border);padding-left:12px;color:var(--text-muted);margin:8px 0;">$1</blockquote>');
  // 列表
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul style="padding-left:20px;margin:8px 0;">$&</ul>');
  // 段落
  html = html.replace(/\n\n/g, '</p><p style="margin:10px 0;line-height:1.8;">');
  html = html.replace(/\n/g, '<br>');
  return `<p style="margin:10px 0;line-height:1.8;">${html}</p>`;
}

// ---------- 保存至剪藏 ----------
export async function saveToClip() {
  const app = getApp();
  const a = articles[currentIndex];
  if (!a) return;

  const cleanTitle = a.title.replace(/[\\/:*?"<>|]/g, '').trim();
  if (!cleanTitle) { notice('标题为空'); return; }

  const filePath = `${CLIP_DIR}/${cleanTitle}.md`;

  if (app.vault.getAbstractFileByPath(filePath)) {
    const ok = await new Promise<boolean>((resolve) => {
      const el = document.createElement('div');
      Object.assign(el.style, {
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        background: 'var(--background-primary)',
        borderRadius: '10px', padding: '20px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        minWidth: '260px', textAlign: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif',
      });
      el.innerHTML = `
                <div style="margin-bottom:14px;color:var(--text-normal);font-size:14px;">已存在同名文件，覆盖？</div>
                <div style="display:flex;gap:8px;justify-content:center;">
                    <button class="y" style="padding:6px 18px;border:none;background:var(--interactive-accent);color:var(--text-on-accent);border-radius:4px;cursor:pointer;">覆盖</button>
                    <button class="n" style="padding:6px 18px;border:1px solid var(--background-modifier-border);background:var(--background-secondary);color:var(--text-normal);border-radius:4px;cursor:pointer;">取消</button>
                </div>
            `;
      const ov = document.createElement('div');
      Object.assign(ov.style, { position: 'fixed', inset: '0', background: 'var(--background-modifier-cover)' });
      topifyZ(ov, el); // ADR-0067：一次性弹窗，创建即显示即发号
      document.body.appendChild(ov);
      document.body.appendChild(el);
      // 点遮罩 = 取消（与「取消」按钮同语义，用户拍板：小弹窗靠遮罩关闭）
      ov.onclick = () => { ov.remove(); el.remove(); resolve(false); };
      escManager.register('news-confirm', {
        isVisible: () => ov.isConnected,
        close: () => { ov.remove(); el.remove(); resolve(false); },
      });
      el.querySelector<HTMLElement>('.y')!.onclick = () => { ov.remove(); el.remove(); resolve(true); };
      el.querySelector<HTMLElement>('.n')!.onclick = () => { ov.remove(); el.remove(); resolve(false); };
    });
    if (!ok) return;
  }

  const tagsYaml = (a.tags || []).map((t: string) => `  - "${yamlEscape(t)}"`).join('\n');
  // x2b：created 用本地时间戳（与 byDate 本地日同口径，避免 UTC+8 凌晨写入昨日）
  const now = localDatetime();
  const pubDate = a.date ? toDatetime(a.date) : '';
  const body = (a.body || '').replace(/^\s*---[\s\S]*?---\s*/m, '').replace(/^\s*```dataviewjs[\s\S]*?```\s*/m, '').trim();

  const md = `---
url: "${yamlEscape(a.url || '')}"
author: "${yamlEscape(a.author || '')}"
site: "${yamlEscape(a.platform || '')}"
summary: "${yamlEscape(a.summary || '')}"
tags:
${tagsYaml}
date: "${yamlEscape(pubDate)}"
created: ${now}
---
\`\`\`dataviewjs
await dv.view(\`CONFIG/SCRIPTS/DataView/摘要\`)
\`\`\`

${body}`;

  try {
    const dirAf = app.vault.getAbstractFileByPath(CLIP_DIR);
    if (!dirAf) await app.vault.createFolder(CLIP_DIR);
    const existing = app.vault.getAbstractFileByPath(filePath);
    if (existing) await app.vault.modify(existing as TFile, md);
    else await app.vault.create(filePath, md);
    notice(`已保存：${cleanTitle}`, 'success');
    hide();
    app.workspace.openLinkText(filePath, filePath, true);
    const evt = markAsRead('saved'); // 内部发 'news' 通道 read 事件（保存立即形态），避免双通知
    // ticket 076：保存联动 auto-summary——登记待补全（smartcat 订阅该剪藏 modify 补全 / 2 分钟降级）
    if (evt) emitDomainEvent('news', { kind: 'saved', evt, clipPath: filePath });
  } catch (e: any) {
    // m1b-news：技术详情进 console，toast 只给可操作的人话（正文不带 emoji）
    console.error('[聚合讯] 保存剪藏失败', e);
    notice('保存失败，请稍后重试', 'error');
  }
}

// ---------- 下一篇 / 标记已读 ----------
export function skipArticle() { markAsRead('skipped'); }

export function markAsRead(action: string): NewsReadEvent | null {
  const a = articles[currentIndex];
  let evt: NewsReadEvent | null = null;
  if (a) {
    // ticket 076 修订（2026-08-25 用户拍板：只发保存）→ ticket 123 追加（2026-08-27 用户拍板）：跳过也产观察
    // ——保存走 saved 立即形态 + auto-summary 补全；跳过走 news:skipped 入行为流（轻量记录，不向量化）；
    // 阅读无独立动作不发（域统计照记）；
    // 时长 = 累计可视时间（hide 已暂停并入 accumMs，此处补挂起会话），毫秒/60000 取整分钟 ≥1
    // （原实现 ms/60 致时长虚增 60 倍——「读了 N 分钟」离谱根因之一）
    if (action === 'saved' || action === 'skipped') {
      const now = Date.now();
      const durationSec = (openedAt ? now - openedAt : 0) + accumMs;
      const durationMin = Math.max(1, Math.round(durationSec / 60000));
      evt = { title: a.title, platform: a.platform, state: action as 'saved' | 'skipped', durationMin };
      // 保存立即形态在此发（saveToClip 再经 'news' saved 入口登记 auto-summary 补全）；
      // 跳过：news:skipped → 行为流；smartcat 未初始化 / noteSource 关时静默
      emitDomainEvent('news', { kind: 'read', evt });
    }
    a.read = true;
    // ticket 124（ADR-0060）保留策略档位依据：保存/跳过写 state（旧数据无 state → 按跳过档）
    a.state = action === 'saved' ? 'saved' : 'skipped';
    delete a.body;
    recordStat(action, a);
  }
  const prevTotal = allArticles.length;
  articles = allArticles.filter((x: any) => !x.read);
  // 游标锚定：当前篇已标读必然不在新未读列表（找不到 → 夹取边界，行为同旧逻辑）；
  // 若后续出现磁盘同步已读等场景则按标识定位不漂移
  const anchored = anchorCursor(a, articles);
  if (anchored >= 0) currentIndex = anchored;
  else if (currentIndex >= articles.length) currentIndex = Math.max(0, articles.length - 1);
  render();
  void saveArticles();
  void checkNewArticles(prevTotal);
  return evt;
}

export async function checkNewArticles(prevTotal: number) {
  try {
    const res = await readNewsData();
    if (!res.ok || res.missing) return;
    if (res.data.articles.length > prevTotal) {
      notice(`新增 ${res.data.articles.length - prevTotal} 篇文章`, 'info');
    }
  } catch (e) { /* 忽略 */ }
}

export async function saveArticles() {
  // 双写者防丢：写前重读磁盘（四段），仅替换 articles 段（保留 stats/bilibiliUps/sources）；
  // 写回串行队列（与 saveStats 同文件，防并发覆盖）；磁盘解析失败/缺失不覆写防清盘
  enqueueWrite(async () => {
    try {
      const res = await readNewsData();
      if (!res.ok || res.missing) return;
      const merged = mergeWithDisk(allArticles, res.data.articles);
      await writeNewsData({ ...res.data, articles: merged });
    } catch (e) { /* 忽略 */ }
  });
}

// ---------- 显示 / 隐藏 ----------
/** 一次读盘加载（stats 迁移 + articles + 保留清理；show 链专用，避免 loadStats+loadArticles 双读盘） */
export async function loadAll(): Promise<void> {
  const res = await readNewsData();
  loadFailed = false;
  if (res.missing) {
    dataFileMissing = true;
    allArticles = []; articles = []; batchTotal = 0;
    stats = { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} };
    return;
  }
  if (!res.ok) {
    dataFileMissing = false;
    loadFailed = true;
    allArticles = []; articles = []; batchTotal = 0;
    console.warn('[聚合讯] news.json 解析失败，进入错误态（不渲染完成态）');
    notice('新闻数据读取失败，请检查数据文件后重试', 'error');
    return;
  }
  dataFileMissing = false;
  let data = res.data;
  // 保留策略清理（插件侧；未读不处理）
  const s = tryGetSettings() as any;
  const savedDays = normalizeRetentionDays(s?.newsRetentionSavedDays) ?? 3;
  const skippedDays = normalizeRetentionDays(s?.newsRetentionSkippedDays) ?? 7;
  const cleaned = applyRetention(data.articles, savedDays, skippedDays);
  // 旧 news-stats.json 迁移（stats 段无真实数据时）
  let changed = cleaned.length !== data.articles.length;
  if (!statsHasData(data.stats)) {
    const migrated = await migrateLegacyStats(data);
    if (statsHasData(migrated.stats)) { data = migrated; changed = true; }
  }
  if (changed) {
    data = { ...data, articles: cleaned };
    await writeNewsData(data);
  }
  stats = data.stats || stats;
  allArticles = data.articles;
  articles = allArticles.filter((a: any) => !a.read);
  batchTotal = articles.length;
}

export function show() {
  if (!popup) createMaskAndPopup();
  // 移动端默认全屏跟随剪藏本（用户拍板：聚合讯不设独立开关，与剪藏本同键 clippingMobileDefaultFullscreen）
  applyMobileWindowFullscreen(popup, tryGetSettings().clippingMobileDefaultFullscreen === true);
  // l5：加载期先展示占位（此前整个加载过程全程 hidden 无反馈），加载完成后 render() 替换为正文；
  // 不可见即展示：加载中途 hide() 关闭 → 加载完成只渲染内容不再强制弹出
  renderLoading();
  topifyZ(mask!, popup!); // ADR-0067：显示即发号，谁后显示谁在上
  mask!.style.visibility = 'visible';
  popup!.style.visibility = 'visible';
  // 重入串行化：已有加载链在跑 → 占位/显窗已重建，复用同一链（其完成时 render 替换占位），不另起第二条链
  if (pendingLoad) return;
  pendingLoad = loadAll()
    .then(() => {
      render();
    })
    .finally(() => {
      pendingLoad = null;
    });
}

export function hide() {
  // ticket 076 修订：关闭暂停——本次会话已视时长并入累计，openedAt 归零防重复累计
  if (openedAt) {
    accumMs += Date.now() - openedAt;
    openedAt = 0;
  }
  if (mask) mask.style.visibility = 'hidden';
  if (popup) popup.style.visibility = 'hidden';
}

// ---------- 初始化 ----------
export function init(showImmediately: boolean) {
  createMaskAndPopup();
  escManager.register('news', {
    isVisible: () => !!(popup && popup.style.visibility === 'visible'),
    close: () => hide(),
  });
  if (showImmediately) show();
}

/** 卸载清理（main.ts onunload 可调用） */
export function unloadNews(): void {
  const masks = document.querySelectorAll('.news-mask');
  const popups = document.querySelectorAll('.news-popup');
  masks.forEach((el) => el.remove());
  popups.forEach((el) => el.remove());
  mask = null;
  popup = null;
  container = null;
}