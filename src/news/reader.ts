/**
 * 聚合讯（ticket 09）：新闻聚合阅读流——逐篇阅读、已读/跳过、剪藏保存、
 * news.json / news-stats.json 统计、dataviewjs 代码块写入。
 * 源码：聚合讯.js 逐字移植（单篇渲染 DOM、文案、样式一致）。
 */
import { TFile } from 'obsidian';
import { notice } from '../core/notice';
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { createSiteIcon, injectStyles } from '../core/dom';

// ---------- 常量 ----------
const NEWS_JSON_PATH = 'CONFIG/STORAGE/news.json';
const STATS_JSON_PATH = 'CONFIG/STORAGE/news-stats.json';
const CLIP_DIR = '归档/网页剪藏';
const PLATFORM_DOMAIN: Record<string, string> = { '果壳': 'guokr.com', '知乎日报': 'zhihu.com' };

/** HTML 转义（源码内联 esc） */
const esc = (s: any) =>
  String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- 模块状态 ----------
let allArticles: any[] = [];
let articles: any[] = [];
let batchTotal = 0;
let currentIndex = 0;
let popup: HTMLElement | null = null;
let mask: HTMLElement | null = null;
let container: HTMLElement | null = null;
let stats: any = { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} };

// ---------- CSS（≈196 行，与源码逐字一致；已同步 styles/news.css） ----------
export const NEWS_CSS = `
.news-mask {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: var(--background-modifier-cover);
    backdrop-filter: blur(2px);
    z-index: 9998;
    visibility: hidden;
}
.news-popup {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: var(--background-primary);
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.2);
    z-index: 9999;
    width: 90%; max-width: 680px; max-height: 80vh;
    display: flex; flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif;
    visibility: hidden;
    animation: newsSlideUp 0.25s ease-out;
}
@keyframes newsSlideUp {
    from { opacity: 0; transform: translate(-50%, -46%); }
    to { opacity: 1; transform: translate(-50%, -50%); }
}
.news-card-header {
    padding: 28px 32px 0 32px;
    flex-shrink: 0;
}
.news-card-area {
    flex: 1;
    overflow-y: auto;
    padding: 20px 32px 28px 32px;
}
.news-card-area::-webkit-scrollbar { width: 6px; }
.news-card-area::-webkit-scrollbar-thumb { background: var(--background-modifier-border); border-radius: 4px; }
.news-card-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-normal);
    line-height: 1.45;
    margin-bottom: 12px;
}
.news-card-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 20px;
}
.news-card-meta .platform-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: var(--background-secondary);
    padding: 2px 10px;
    border-radius: 12px;
    border: 1px solid var(--background-modifier-border);
}
.news-card-body {
    font-size: 15px;
    line-height: 1.85;
    color: var(--text-normal);
}
.news-card-body img { max-width: 100%; border-radius: 6px; margin: 8px 0; }
.news-card-body h1, .news-card-body h2, .news-card-body h3, .news-card-body h4 {
    font-weight: 600; margin: 16px 0 8px 0; color: var(--text-normal);
}
.news-card-body h1 { font-size: 18px; }
.news-card-body h2 { font-size: 16px; }
.news-card-body h3 { font-size: 15px; }
.news-card-body blockquote {
    border-left: 3px solid var(--background-modifier-border);
    padding-left: 12px; color: var(--text-muted); margin: 8px 0;
}
.news-card-body a { color: var(--interactive-accent); }
.news-bottombar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 24px;
    border-top: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
}
.news-counter {
    font-size: 12px;
    color: var(--text-faint);
    margin-left: auto;
}
.news-btn {
    padding: 8px 18px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--background-modifier-border);
    transition: all 0.15s;
    background: var(--background-secondary);
    color: var(--text-normal);
}
.news-btn:hover { background: var(--background-modifier-hover); }
.news-btn-primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: transparent;
}
.news-btn-primary:hover { opacity: 0.9; }

/* 空状态 */
.news-done {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 16px;
    padding: 32px;
}
.news-done-stats {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    padding: 20px 28px;
    width: 100%;
    max-width: 360px;
}
.news-done-stats-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 14px;
    text-align: center;
}
.news-stat-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 13px;
    color: var(--text-muted);
}
.news-stat-row .num {
    color: var(--text-normal);
    font-weight: 600;
}
.news-done-hint {
    font-size: 13px;
    color: var(--text-faint);
    margin-top: 4px;
}
.news-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 12px;
    color: var(--text-muted);
}
.news-loading-spinner {
    width: 28px; height: 28px;
    border: 3px solid var(--background-modifier-border);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: newsSpin 0.8s linear infinite;
}
@keyframes newsSpin { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
    .news-popup { width: 100vw; height: 100vh; max-height: 100vh; top: 0; left: 0; transform: none; border-radius: 0; padding-top: 58px; }
    .news-card-header { padding: 12px 20px 0 20px; }
    .news-card-area { padding: 12px 20px 20px 20px; }
    .news-bottombar { padding-bottom: max(12px, env(safe-area-inset-bottom)); }
}
.news-close-btn {
    display: none;
    position: absolute;
    top: 62px;
    right: 10px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: var(--background-secondary);
    color: var(--text-muted);
    font-size: 16px;
    cursor: pointer;
    z-index: 10;
    line-height: 1;
}
.news-close-btn:hover { background: var(--background-modifier-hover); }
@media (max-width: 640px) {
    .news-close-btn { display: flex; align-items: center; justify-content: center; }
}
`;

// ---------- 样式注入 ----------
function injectStylesNews() {
  if (document.getElementById('news-reader-style')) return;
  injectStyles('news', NEWS_CSS);
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
  closeBtn.innerHTML = '✕';
  closeBtn.onclick = (e) => { e.stopPropagation(); hide(); };
  popup.appendChild(closeBtn);

  container = document.createElement('div');
  container.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';
  popup.appendChild(container);

  document.body.appendChild(mask);
  document.body.appendChild(popup);
}

// ---------- 统计 ----------
export async function loadStats() {
  const app = getApp();
  const af = app.vault.getAbstractFileByPath(STATS_JSON_PATH);
  if (!af) return;
  try {
    stats = JSON.parse(await app.vault.read(af as TFile));
  } catch (e) { /* 保留默认 */ }
}

export async function saveStats() {
  const app = getApp();
  try {
    const dir = STATS_JSON_PATH.substring(0, STATS_JSON_PATH.lastIndexOf('/'));
    const dirAf = app.vault.getAbstractFileByPath(dir);
    if (!dirAf) await app.vault.createFolder(dir);
    const af = app.vault.getAbstractFileByPath(STATS_JSON_PATH);
    if (af) await app.vault.modify(af as TFile, JSON.stringify(stats, null, 2));
    else await app.vault.create(STATS_JSON_PATH, JSON.stringify(stats, null, 2));
  } catch (e) { /* 静默 */ }
}

export function recordStat(action: string, article: any) {
  stats.totalRead++;
  if (action === 'saved') stats.totalSaved++;
  else stats.totalSkipped++;

  const platform = article.platform || '未知';
  stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;

  const today = new Date().toISOString().substring(0, 10);
  stats.byDate[today] = (stats.byDate[today] || 0) + 1;

  void saveStats();
}

// ---------- 数据 ----------
export async function loadArticles() {
  const app = getApp();
  const af = app.vault.getAbstractFileByPath(NEWS_JSON_PATH);
  if (!af) { allArticles = []; articles = []; batchTotal = 0; return; }
  try {
    allArticles = JSON.parse(await app.vault.read(af as TFile));
    articles = allArticles.filter((a: any) => !a.read);
    batchTotal = articles.length;
  } catch (e) {
    allArticles = []; articles = []; batchTotal = 0;
  }
  if (currentIndex >= articles.length) currentIndex = Math.max(0, articles.length - 1);
}

// ---------- 渲染 ----------
export function render() {
  if (!container) return;
  container.innerHTML = '';

  // 所有文章读完 → 完成状态
  if (articles.length === 0) {
    renderDoneState();
    return;
  }

  const a = articles[currentIndex];

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

  // 底部栏
  const bottombar = document.createElement('div');
  bottombar.className = 'news-bottombar';
  bottombar.innerHTML = `
        <button class="news-btn news-btn-primary" data-action="save">📥 保存至剪藏</button>
        <button class="news-btn" data-action="next">⏭️ 下一篇</button>
        <span class="news-counter">${batchTotal - articles.length} / ${batchTotal}</span>
    `;
  container.appendChild(bottombar);
  bottombar.querySelector<HTMLElement>('[data-action="save"]')!.onclick = () => saveToClip();
  bottombar.querySelector<HTMLElement>('[data-action="next"]')!.onclick = () => skipArticle();
}

export function renderDoneState() {
  const roundRead = allArticles.filter((a: any) => a.read).length;

  const cardArea = document.createElement('div');
  cardArea.className = 'news-card-area';
  cardArea.style.display = 'flex';
  cardArea.style.flexDirection = 'column';
  cardArea.style.alignItems = 'center';
  cardArea.style.justifyContent = 'center';
  cardArea.innerHTML = `
        <div style="background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:10px;padding:20px 28px;width:100%;max-width:360px;margin-bottom:24px;">
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:var(--text-muted);"><span>本轮阅读</span><span style="color:var(--text-normal);font-weight:600;">${roundRead} 篇</span></div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:var(--text-muted);"><span>累计保存</span><span style="color:var(--text-normal);font-weight:600;">${stats.totalSaved} 篇</span></div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:var(--text-muted);"><span>累计跳过</span><span style="color:var(--text-normal);font-weight:600;">${stats.totalSkipped} 篇</span></div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:var(--text-muted);"><span>总计阅读</span><span style="color:var(--text-normal);font-weight:600;">${stats.totalRead} 篇</span></div>
        </div>
        <div style="font-size:13px;color:var(--text-faint);">今日文章已读完，欢迎明天再来！</div>
    `;
  container!.appendChild(cardArea);
}

// ---------- 工具 ----------
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
        zIndex: 10001, minWidth: '260px', textAlign: 'center',
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
      Object.assign(ov.style, { position: 'fixed', inset: '0', background: 'var(--background-modifier-cover)', zIndex: 10000 });
      document.body.appendChild(ov);
      document.body.appendChild(el);
      escManager.register('news-confirm', {
        isVisible: () => ov.isConnected,
        close: () => { ov.remove(); el.remove(); resolve(false); },
      });
      el.querySelector<HTMLElement>('.y')!.onclick = () => { ov.remove(); el.remove(); resolve(true); };
      el.querySelector<HTMLElement>('.n')!.onclick = () => { ov.remove(); el.remove(); resolve(false); };
    });
    if (!ok) return;
  }

  const tagsYaml = (a.tags || []).map((t: string) => `  - "${t}"`).join('\n');
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const pubDate = a.date ? toDatetime(a.date) : '';
  const body = (a.body || '').replace(/^\s*---[\s\S]*?---\s*/m, '').replace(/^\s*```dataviewjs[\s\S]*?```\s*/m, '').trim();

  const md = `---
link: "${a.url || ''}"
author: "${a.author || ''}"
site: "${a.platform || ''}"
summary: "${(a.summary || '').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"
tags:
${tagsYaml}
date: "${pubDate}"
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
    notice(`✅ 已保存：${cleanTitle}`);
    hide();
    app.workspace.openLinkText(filePath, filePath, true);
    markAsRead('saved');
  } catch (e: any) {
    notice(`❌ 保存失败：${e.message}`);
  }
}

// ---------- 下一篇 / 标记已读 ----------
export function skipArticle() { markAsRead('skipped'); }

export function markAsRead(action: string) {
  const a = articles[currentIndex];
  if (a) {
    a.read = true;
    delete a.body;
    recordStat(action, a);
  }
  const prevTotal = allArticles.length;
  articles = allArticles.filter((x: any) => !x.read);
  if (currentIndex >= articles.length) currentIndex = Math.max(0, articles.length - 1);
  render();
  void saveArticles();
  void checkNewArticles(prevTotal);
}

export async function checkNewArticles(prevTotal: number) {
  const app = getApp();
  try {
    const af = app.vault.getAbstractFileByPath(NEWS_JSON_PATH);
    if (!af) return;
    const fresh = JSON.parse(await app.vault.read(af as TFile));
    if (fresh.length > prevTotal) {
      notice(`📰 新增 ${fresh.length - prevTotal} 篇文章`);
    }
  } catch (e) { /* 忽略 */ }
}

export async function saveArticles() {
  const app = getApp();
  try {
    const af = app.vault.getAbstractFileByPath(NEWS_JSON_PATH);
    if (af) await app.vault.modify(af as TFile, JSON.stringify(allArticles, null, 2));
  } catch (e) { /* 忽略 */ }
}

// ---------- 显示 / 隐藏 ----------
export function show() {
  if (!popup) createMaskAndPopup();
  loadStats()
    .then(() => loadArticles())
    .then(() => {
      render();
      mask!.style.visibility = 'visible';
      popup!.style.visibility = 'visible';
    });
}

export function hide() {
  if (mask) mask.style.visibility = 'hidden';
  if (popup) popup.style.visibility = 'hidden';
}

// ---------- 初始化 ----------
export function init(showImmediately: boolean) {
  injectStylesNews();
  createMaskAndPopup();
  escManager.register('news', {
    isVisible: () => !!(popup && popup.style.visibility === 'visible'),
    close: () => hide(),
  });
  if (showImmediately) show();
}

/** 卸载清理（main.ts onunload 可调用） */
export function unloadNews(): void {
  ['news-mask', 'news-popup'].forEach(() => {});
  const masks = document.querySelectorAll('.news-mask');
  const popups = document.querySelectorAll('.news-popup');
  masks.forEach((el) => el.remove());
  popups.forEach((el) => el.remove());
  mask = null;
  popup = null;
  container = null;
}