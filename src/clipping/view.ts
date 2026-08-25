/**
 * 剪藏本（ticket 08）：文章展示面板——搜索、站点过滤（单选）、排序、
 * 反链显示、vault modify 自动刷新、滚动加载。
 * ticket 69 手势重构：统一抽屉（桌面右键 → 跟手菜单、移动端长按 → 底部抽屉，
 * 打开/复制双链/复制原文链接/删除，全局组件承载）＋**双击整卡打开文章**（用户反馈回退单击直开）；
 * 移除旧「长按日期删除」。头部两行=标题+简介（摘要两行省略号截断）。
 */
import { Setting } from 'obsidian';
import { notice } from '../core/notice';
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { createSiteIcon } from '../core/dom';
import { formatRelativeTime } from '../core/utils';
import { getSettings, saveSettings, tryGetSettings } from '../core/settings-provider';
import { onDomainEvent } from '../core/domain-bus';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { openSettingsModal, createSettingsGroup } from '../core/settings-modal';
import { attachItemActions, type ItemAction } from '../core/item-actions';
import { ensureAutoSummary, stopAutoSummary } from '../auto-summary';

// ---------- 模块状态 ----------
let articlePopup: HTMLElement | null = null;
let articleMask: HTMLElement | null = null;
let selectedSite: string | null = null; // 单个字符串，null 表示全部
let allArticles: ArticleEntry[] = [];
let filteredArticles: ArticleEntry[] = [];
let currentDisplayCount = 0;
let isLoadingMore = false;
let allLoaded = false;
let articlesContainer: HTMLElement | null = null;
let scrollContainer: HTMLElement | null = null;
let isTouchDevice = false;
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentSearchKeyword = '';
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let fileListenerAttached = false;
/** 总线退订函数（原存 vault ref 用于 offref，换线后改存 onDomainEvent 返回的退订闭包） */
let fileListenerRef: (() => void) | null = null;
let isLoadingData = false;

// ---------- 配置（从设置读取） ----------
let ARTICLE_DIRECTORY = '归档/网页剪藏';
let BATCH_SIZE = 20;

/** 文章条目（parseArticleFile 产物） */
export interface ArticleEntry {
  file: any;
  path: string;
  /** 剪藏原文 URL（frontmatter url 字段，2026-08-25 由 link 改名，ADR-0050） */
  url: string;
  author: string;
  site: string;
  summary: string;
  tags: string[];
  created: Date;
  title: string;
  rawContent: string;
  hasBacklink: boolean;
  backlinkSources: string[];
}

/** 读取插件设置（剪藏目录；批次读设置） */
export function applyArticleSettings(): void {
  const s = tryGetSettings() as any;
  ARTICLE_DIRECTORY = s.articleDirectory || '归档/网页剪藏';
  BATCH_SIZE = parseInt(s.articleBatchSize || '20', 10) || 20;
}

// ========== 初始化 ==========
export async function initArticleView(showImmediately = true): Promise<void> {
  const existingPopup = document.getElementById('article-view-popup');
  const existingMask = document.getElementById('article-view-mask');
  if (existingPopup && existingMask) {
    // 窗口已存在，根据参数切换可见性
    if (showImmediately) {
      setArticleViewVisible(true);
      // 移动端默认全屏：开关开=挂 .bz-win-mfs 全屏类（幂等），关=常规卡
      applyMobileWindowFullscreen(articlePopup, tryGetSettings().clippingMobileDefaultFullscreen === true);
      // 若数据为空（可能加载失败），重新加载
      if (allArticles.length === 0 && !isLoadingData) {
        void loadAllArticles();
      }
    } else {
      setArticleViewVisible(false);
    }
    return;
  }

  // 首次创建
  isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  createMaskAndPopup();
  registerEscapeListener();

  // 设置可见性
  setArticleViewVisible(showImmediately);
  // 移动端默认全屏：开关开=挂 .bz-win-mfs 全屏类（幂等），关=常规卡
  applyMobileWindowFullscreen(articlePopup, tryGetSettings().clippingMobileDefaultFullscreen === true);

  // 显示加载提示
  articlesContainer!.innerHTML = '';
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'article-loading-hint';
  loadingDiv.textContent = '📚 正在加载文章...';
  articlesContainer!.appendChild(loadingDiv);

  // 异步加载数据（不阻塞显示）
  void loadAllArticles();

  initScroll();
  attachFileListener();
}

// ========== 创建 UI ==========
/** 面板显隐单点：mask + popup 同步切换（模块级引用即当前实例节点） */
function setArticleViewVisible(visible: boolean): void {
  const v = visible ? 'visible' : 'hidden';
  if (articleMask) articleMask.style.visibility = v;
  if (articlePopup) articlePopup.style.visibility = v;
}

function createMaskAndPopup() {
  // 遮罩
  articleMask = document.createElement('div');
  articleMask.id = 'article-view-mask';
  articleMask.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;background:var(--background-modifier-cover);z-index:9998;visibility:hidden;';
  articleMask.onclick = () => setArticleViewVisible(false);

  // 弹窗
  articlePopup = document.createElement('div');
  articlePopup.id = 'article-view-popup';
  articlePopup.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.2);z-index:9999;width:90%;max-width:800px;max-height:80vh;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif;visibility:hidden;';

  // 头部
  const header = createHeader();

  // 站点标签栏
  const siteBar = createSiteBar();

  // 搜索框
  const searchContainer = createSearchContainer();

  // 文章列表容器
  articlesContainer = document.createElement('div');
  articlesContainer.id = '__article-entries-container__';
  articlesContainer.style.cssText = 'flex:1;overflow-y:auto;padding:0 20px;min-height:300px;';

  articlePopup.appendChild(header);
  articlePopup.appendChild(siteBar);
  articlePopup.appendChild(searchContainer);
  articlePopup.appendChild(articlesContainer);

  document.body.appendChild(articleMask);
  document.body.appendChild(articlePopup);
}

function createHeader(): HTMLElement {
  const app = getApp();
  const header = document.createElement('div');
  header.className = 'bz-win-head';
  header.style.cssText = 'padding:20px 24px 12px 24px;display:flex;justify-content:space-between;align-items:center;';

  const title = document.createElement('h3');
  title.textContent = '剪藏本';
  title.style.cssText = 'margin:0;font-size:18px;font-weight:600;color:var(--text-normal);';

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display:flex;align-items:center;gap:8px;';

  // 搜索切换按钮
  const searchToggleBtn = createIconButton('🔍', '切换搜索框', () => {
    const container = document.getElementById('article-search-container');
    if (container) {
      const isHidden = container.style.display === 'none' || getComputedStyle(container).display === 'none';
      container.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        const input = container.querySelector('#article-search-input');
        if (input) setTimeout(() => (input as HTMLInputElement).focus(), 100);
      } else {
        const input = container.querySelector('#article-search-input') as HTMLInputElement;
        if (input) {
          input.value = '';
          currentSearchKeyword = '';
          if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
          applyFilter();
        }
      }
    }
  });

  const refreshBtn = createIconButton('⏳', '重新加载文章', async () => {
    if (refreshBtn.disabled) return;
    refreshBtn.disabled = true;
    refreshBtn.style.opacity = '0.5';
    try {
      await refreshData();
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.style.opacity = '1';
    }
  });
  refreshBtn.disabled = true;
  refreshBtn.style.opacity = '0.5';

  // 剪藏本设置弹窗（ADR-0009 域设置弹窗；分组卡片重设计，2026-08 用户拍板方案 A）
  const settingsBtn = createIconButton('⚙️', '剪藏本设置', () => {
    openSettingsModal({
      title: '剪藏本设置',
      maxWidth: 560,
      build: (el) => {
        const s = getSettings();
        // ===== 基础组 =====
        const basicGroup = createSettingsGroup(el, { icon: 'folder-open', name: '基础' });
        new Setting(basicGroup)
          .setName('剪藏目录')
          .setDesc('存放网页剪藏文章的文件夹')
          .addText((text) =>
            text.setValue(s.articleDirectory || '').onChange(async (v) => {
              s.articleDirectory = v;
              await saveSettings();
            })
          );
        new Setting(basicGroup)
          .setName('每批加载数量')
          .setDesc('滚动加载时每批显示的条目数')
          .addText((text) =>
            text.setValue(s.articleBatchSize || '').onChange(async (v) => {
              s.articleBatchSize = v;
              await saveSettings();
            })
          );
        // ===== 智能组 =====
        const smartGroup = createSettingsGroup(el, { icon: 'sparkles', name: '智能' });
        new Setting(smartGroup)
          .setName('自动摘要')
          .setDesc('新剪藏的文章自动生成 AI 摘要')
          .addToggle((toggle) =>
            toggle.setValue(!!s.autoSummaryEnabled).onChange(async (v) => {
              s.autoSummaryEnabled = v;
              await saveSettings();
              if (v) ensureAutoSummary(app);
              else stopAutoSummary(); // 关闭：摘除监听（initialized 保留，再开启复用注册）
            })
          );
        // ===== 移动端组（仅移动端显示） =====
        if (isMobileEnv()) {
          const mobileGroup = createSettingsGroup(el, { icon: 'smartphone', name: '移动端' });
          new Setting(mobileGroup)
            .setName('移动端默认全屏')
            .setDesc('移动端打开主窗口时默认全屏，关闭则显示常规卡片')
            .addToggle((toggle) =>
              toggle.setValue(!!s.clippingMobileDefaultFullscreen).onChange(async (v) => { s.clippingMobileDefaultFullscreen = v; await saveSettings(); })
            );
        }
      },
    });
  });
  const closeBtn = createIconButton('❌', '关闭', () => setArticleViewVisible(false));

  buttonContainer.appendChild(searchToggleBtn);

  // 资讯阅读器按钮（剪藏本互调 bz-news-reader-open）
  const newsBtn = createIconButton('📰', '打开资讯阅读器', () => {
    setArticleViewVisible(false);
    (app as any).commands.executeCommandById('bz-news-open');
  });
  buttonContainer.appendChild(newsBtn);

  // ⚙️ 设置置于关闭正前（用户拍板：所有窗口设置按钮都在关闭前）
  buttonContainer.appendChild(settingsBtn);

  buttonContainer.appendChild(closeBtn);
  header.appendChild(title);
  header.appendChild(buttonContainer);
  return header;
}

function createIconButton(text: string, title: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.title = title;
  // 规格：普通 14px/22×26，关闭 ❌ 13px/21×25
  const isClose = text === '❌';
  btn.style.cssText =
    `background:none;border:none;font-size:${isClose ? 13 : 14}px;cursor:pointer;color:var(--text-muted);padding:0;width:${isClose ? 21 : 22}px;height:${isClose ? 25 : 26}px;border-radius:4px;display:flex;align-items:center;justify-content:center;box-shadow:none;`;
  if (isClose) btn.classList.add('bz-win-close');
  btn.onmouseover = () => (btn.style.background = 'var(--background-secondary)');
  btn.onmouseout = () => (btn.style.background = 'none');
  btn.onclick = onClick;
  return btn;
}

function createSiteBar(): HTMLElement {
  const container = document.createElement('div');
  container.id = 'article-site-bar';
  container.style.cssText = 'padding:10px 24px;';

  const sc = document.createElement('div');
  sc.className = 'article-sites-scroll';
  sc.style.cssText =
    'display:flex;flex-wrap:wrap;gap:8px;overflow-x:auto;padding:4px 0;scrollbar-width:none;-ms-overflow-style:none;';

  container.appendChild(sc);
  return container;
}

function createSearchContainer(): HTMLElement {
  const container = document.createElement('div');
  container.id = 'article-search-container';
  container.style.cssText = 'padding:12px 24px;display:none;';

  const input = document.createElement('input');
  input.id = 'article-search-input';
  input.type = 'text';
  input.placeholder = '🔍 搜索文章（标题、摘要、作者、标签）...';
  input.style.cssText =
    'width:100%;padding:10px 12px;font-size:14px;border:1px solid var(--background-modifier-border);border-radius:8px;background:var(--background-primary);color:var(--text-normal);outline:none;box-sizing:border-box;';
  input.addEventListener('input', (e) => {
    const keyword = (e.target as HTMLInputElement).value.trim();
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      currentSearchKeyword = keyword;
      applyFilter();
    }, 300);
  });

  container.appendChild(input);
  return container;
}

// ========== 数据加载 ==========
async function loadAllArticles(): Promise<void> {
  const app = getApp();
  if (isLoadingData) return;
  isLoadingData = true;
  try {
    const dir = app.vault.getAbstractFileByPath(ARTICLE_DIRECTORY);
    if (!dir || !(dir as any).children) {
      allArticles = [];
      filteredArticles = [];
      renderEmpty();
      return;
    }

    const mdFiles = (dir as any).children.filter((f: any) => f.extension === 'md');
    const articles: ArticleEntry[] = [];
    for (const file of mdFiles) {
      const entry = await parseArticleFile(file);
      if (entry) articles.push(entry);
    }

    articles.sort((a, b) => b.created.valueOf() - a.created.valueOf());

    allArticles = articles;
    filteredArticles = [...allArticles];
    renderEntries(true);
    rebuildSiteBar();
  } catch (e) {
    console.error('加载文章失败:', e);
  } finally {
    isLoadingData = false;
  }
}

/** 解析文章：frontmatter 必需 url+created（缺任一跳过）；title=文件名 */
export async function parseArticleFile(file: any): Promise<ArticleEntry | null> {
  const app = getApp();
  try {
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache && (cache as any).frontmatter;
    if (!fm) return null;
    if (!fm.url || !fm.created) return null;

    const content = await app.vault.read(file);
    const title = file.basename;

    // created 解析失败（如 "1750000000000" 这类值）→ Invalid Date 会在 toISOString 抛
    // RangeError 卡死整个列表渲染；回退当前时间（P1-23）
    let created = new Date(fm.created);
    if (isNaN(created.valueOf())) created = new Date();

    // 检测反链（被其他笔记引用）
    const backlinks = (app.metadataCache as any).getBacklinksForFile(file);
    const hasBacklink = backlinks && (backlinks as any).data.size > 0;
    const backlinkSources: string[] = hasBacklink ? Array.from((backlinks as any).data.keys()) : [];

    return {
      file,
      path: file.path,
      url: fm.url,
      author: fm.author || '',
      site: fm.site || '未知',
      summary: fm.summary || '',
      tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : fm.tags ? [fm.tags as string] : [],
      created,
      title,
      rawContent: content,
      hasBacklink,
      backlinkSources,
    };
  } catch (e) {
    console.warn('解析文章失败:', file.path, e);
    return null;
  }
}

// ========== 刷新数据 ==========
async function refreshData(): Promise<void> {
  if (isLoadingData) return;
  await loadAllArticles();
  applyFilter();
}

// ========== 筛选与排序（单选站点） ==========
export function applyFilter() {
  let filtered = [...allArticles];

  if (selectedSite) {
    filtered = filtered.filter((article) => article.site === selectedSite);
  }

  if (currentSearchKeyword) {
    const keyword = currentSearchKeyword.toLowerCase();
    filtered = filtered.filter((article) => {
      return (
        article.title.toLowerCase().includes(keyword) ||
        article.summary.toLowerCase().includes(keyword) ||
        article.author.toLowerCase().includes(keyword) ||
        article.tags.some((t) => t.toLowerCase().includes(keyword)) ||
        article.site.toLowerCase().includes(keyword)
      );
    });
  }

  filteredArticles = filtered;
  currentDisplayCount = 0;
  allLoaded = false;
  renderEntries(true);
}

// ========== 渲染列表 ==========
export function renderEntries(reset = false) {
  if (!articlesContainer) return;

  if (reset) {
    articlesContainer.innerHTML = '';
    scrollContainer = null;
    currentDisplayCount = 0;
    allLoaded = false;
  }

  if (filteredArticles.length === 0) {
    if (currentDisplayCount === 0) {
      const empty = document.createElement('div');
      empty.className = 'article-empty';
      empty.textContent = selectedSite ? '没有匹配站点的文章' : '没有文章，请添加';
      articlesContainer.appendChild(empty);
    }
    return;
  }

  if (allLoaded && !reset) return;

  if (!scrollContainer) {
    scrollContainer = document.createElement('div');
    scrollContainer.className = 'article-scroll-container';
    articlesContainer.appendChild(scrollContainer);
  }

  const start = currentDisplayCount;
  const end = Math.min(start + BATCH_SIZE, filteredArticles.length);
  const batch = filteredArticles.slice(start, end);

  for (const article of batch) {
    const card = createArticleCard(article);
    scrollContainer.appendChild(card);
  }

  currentDisplayCount = end;

  if (currentDisplayCount >= filteredArticles.length) {
    allLoaded = true;
    const oldHints = scrollContainer.querySelectorAll('.article-loading-hint');
    oldHints.forEach((el) => el.remove());
    const allLoadedDiv = document.createElement('div');
    allLoadedDiv.className = 'article-loading-hint';
    allLoadedDiv.textContent = '已显示所有文章';
    scrollContainer.appendChild(allLoadedDiv);
  } else {
    allLoaded = false;
  }
}

/** 卡片标题块（列表与抽屉头部共用，ticket 69 提取） */
function buildTitleDiv(article: ArticleEntry): HTMLElement {
  const titleDiv = document.createElement('div');
  titleDiv.className = 'article-entry-title';
  if (article.hasBacklink) {
    titleDiv.classList.add('has-backlink');
  }
  titleDiv.textContent = `${article.title}` || '无标题';
  return titleDiv;
}

/** 卡片摘要块（列表与抽屉头部共用） */
function buildSummaryEl(article: ArticleEntry): HTMLElement {
  const summary = document.createElement('div');
  summary.className = 'article-entry-summary';
  summary.textContent = article.summary || '（无摘要）';
  return summary;
}

/**
 * 元信息行（站点图标/作者/反链/相对时间；列表与抽屉头部共用）。
 * @param interactive true=列表卡片（反链可点跳转）；false=抽屉头部纯展示（反链不带跳转交互，memo 范式）
 */
function buildMetaRow(article: ArticleEntry, interactive: boolean): HTMLElement {
  const app = getApp();
  const metaRow = document.createElement('div');
  metaRow.className = 'article-entry-meta';
  metaRow.style.cssText =
    'display:flex; flex-wrap:wrap; align-items:center; gap:6px 12px; margin-top:10px; font-size:13px; color:var(--text-muted);';

  // -------- 平台（站点）带图标 --------
  const siteContainer = document.createElement('span');
  siteContainer.className = 'article-entry-site';
  siteContainer.style.cssText = 'display:inline-flex; align-items:center; gap:4px;';

  // 尝试添加图标（Yandex 服务）
  if (article.url) {
    try {
      const url = new URL(article.url);
      const icon = createSiteIcon(url.hostname, 16);
      if (icon) siteContainer.appendChild(icon);
    } catch (e) { /* 忽略 */ }
  }

  // 站点名称文本
  const siteText = document.createTextNode(article.site);
  siteContainer.appendChild(siteText);
  metaRow.appendChild(siteContainer);

  // -------- 作者 --------
  if (article.author) {
    const authorSpan = document.createElement('span');
    authorSpan.className = 'article-entry-site';
    authorSpan.textContent = `✍️${article.author}`;
    metaRow.appendChild(authorSpan);
  }

  // -------- 反链笔记（去《》书名号显示；仅列表可点，抽屉头部纯展示） --------
  if (article.backlinkSources && article.backlinkSources.length > 0) {
    for (const sourcePath of article.backlinkSources) {
      const sourceFile = app.vault.getAbstractFileByPath(sourcePath);
      if (!sourceFile) continue;
      const name = (sourceFile as any).basename;
      const linkTag = document.createElement('span');
      linkTag.className = 'article-entry-site';
      linkTag.textContent = `📌 ${name.replace(/^《|》$/g, '')}`;
      if (interactive) {
        linkTag.style.cursor = 'pointer';
        linkTag.onclick = (e) => {
          e.stopPropagation();
          app.workspace.openLinkText(sourcePath, '', false, { active: true });
          setArticleViewVisible(false);
        };
      }
      metaRow.appendChild(linkTag);
    }
  }

  // -------- 日期（右对齐） --------
  const dateSpan = document.createElement('span');
  dateSpan.textContent = formatRelativeTime(article.created);
  try {
    dateSpan.dataset.created = article.created.toISOString();
  } catch { /* Invalid Date 容错：不设 dataset（P1-23） */ }
  dateSpan.style.marginLeft = 'auto';
  metaRow.appendChild(dateSpan);

  return metaRow;
}

/**
 * 抽屉顶部信息区：两行精简（用户拍板：头部不要太多）——
 * 第 1 行标题 + 第 2 行简介（文章摘要，最多两行超出省略号截断，CSS 承载）；
 * meta 行（站点/作者/时间）不在抽屉头部显示。
 */
export function buildSheetHead(article: ArticleEntry): HTMLElement {
  const head = document.createElement('div');
  head.className = 'bz-item-sheet-entry';
  head.appendChild(buildTitleDiv(article));
  head.appendChild(buildSummaryEl(article));
  return head;
}

// ========== 抽屉动作（打开 / 复制双链 / 复制原文链接 / 删除） ==========
function buildArticleActions(article: ArticleEntry): ItemAction[] {
  // 复制原文链接右侧小字：域名（取不到则不显示小字）
  let domain = '';
  if (article.url) {
    try {
      domain = new URL(article.url).hostname;
    } catch (e) { /* 忽略 */ }
  }
  return [
    { icon: 'external-link', label: '打开', title: '打开文章', onClick: () => jumpToArticle(article) },
    { icon: 'link', label: '复制双链', title: '复制双链', onClick: () => void copyWikilink(article) },
    {
      icon: 'globe',
      label: '复制原文链接',
      sub: domain || undefined,
      title: '复制原文链接',
      onClick: () => void copyOriginalLink(article),
    },
    {
      icon: 'trash-2',
      label: '删除',
      kind: 'danger',
      title: '删除文章',
      onClick: () => showDeleteConfirm(article, findCardByPath(article.path)),
    },
  ];
}

async function copyWikilink(article: ArticleEntry): Promise<void> {
  const link = `[[${article.path}|${article.title}]]`;
  await navigator.clipboard.writeText(link);
  notice(`已复制双链引用：${link}`, 'success');
}

async function copyOriginalLink(article: ArticleEntry): Promise<void> {
  await navigator.clipboard.writeText(article.url);
  notice(`已复制原文链接：${article.url}`, 'success');
}

/** 按路径找回列表卡片节点（删除确认后移除卡片用；找不到返回 null，deleteArticle 已兜底） */
function findCardByPath(path: string): HTMLElement | null {
  if (!articlesContainer) return null;
  // 遍历比对 dataset.path：路径含引号时拼属性选择器会抛 DOMException（P2）
  const cards = articlesContainer.querySelectorAll<HTMLElement>('.article-entry-card');
  for (const card of Array.from(cards)) {
    if (card.dataset.path === path) return card;
  }
  return null;
}

function createArticleCard(article: ArticleEntry): HTMLElement {
  const card = document.createElement('div');
  card.className = 'article-entry-card';
  card.dataset.path = article.path;

  // 组装卡片（标题/摘要/meta 与抽屉头部同构建函数）
  card.appendChild(buildTitleDiv(article));
  card.appendChild(buildSummaryEl(article));
  card.appendChild(buildMetaRow(article, true));

  // 双击整卡打开文章（用户反馈回退：单击直开误触多，改回双击；单击无操作）。
  // 反链📌自带 stopPropagation 不受影响；长按松手的残余/合成 click 由 item-actions 文档捕获层吞掉。
  card.addEventListener('dblclick', () => {
    jumpToArticle(article);
  });

  // 统一操作：桌面右键 → 跟手菜单 / 移动端长按 → 底部抽屉（ticket 69 + 全局右键方案）
  attachItemActions(card, buildArticleActions(article), {
    sheetHead: buildSheetHead(article),
  });

  return card;
}

// ========== 删除确认 ==========
function showDeleteConfirm(article: ArticleEntry, card: HTMLElement | null) {
  const confirmMask = document.createElement('div');
  confirmMask.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;background:var(--background-modifier-cover);z-index:10001;display:flex;align-items:center;justify-content:center;';
  confirmMask.onclick = (e) => {
    if (e.target === confirmMask) confirmMask.remove();
  };

  const popup = document.createElement('div');
  popup.style.cssText =
    'background:var(--background-primary);border-radius:12px;padding:24px;max-width:320px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);';
  const title = document.createElement('h4');
  title.textContent = '确认删除';
  title.style.cssText = 'margin:0 0 16px 0;font-size:18px;color:var(--text-normal);';
  const msg = document.createElement('p');
  msg.textContent = `确定要删除文章「${article.title}」吗？\n此操作不可撤销。`;
  msg.style.cssText = 'margin:0 0 24px 0;color:var(--text-muted);font-size:14px;white-space:pre-line;';

  const btnContainer = document.createElement('div');
  btnContainer.style.cssText = 'display:flex;gap:12px;justify-content:flex-end;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.style.cssText = 'padding:8px 16px;border-radius:6px;border:none;background:var(--background-secondary);cursor:pointer;font-size:14px;';
  cancelBtn.onclick = () => confirmMask.remove();

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '删除';
  deleteBtn.style.cssText =
    'padding:8px 16px;border-radius:6px;border:none;background:var(--background-modifier-error);color:var(--text-on-accent);cursor:pointer;font-size:14px;font-weight:500;';
  deleteBtn.onclick = async () => {
    await deleteArticle(article, card);
    confirmMask.remove();
  };

  btnContainer.appendChild(cancelBtn);
  btnContainer.appendChild(deleteBtn);

  popup.appendChild(title);
  popup.appendChild(msg);
  popup.appendChild(btnContainer);
  confirmMask.appendChild(popup);
  document.body.appendChild(confirmMask);
  escManager.register('article-confirm', {
    isVisible: () => confirmMask.isConnected,
    close: () => confirmMask.remove(),
  });
}

async function deleteArticle(article: ArticleEntry, card: HTMLElement | null) {
  const app = getApp();
  try {
    await app.vault.delete(article.file);
    const index = allArticles.indexOf(article);
    if (index > -1) allArticles.splice(index, 1);
    const fIndex = filteredArticles.indexOf(article);
    if (fIndex > -1) filteredArticles.splice(fIndex, 1);
    if (card && card.parentNode) card.remove();
    if (filteredArticles.length === 0) {
      articlesContainer!.innerHTML = '';
      renderEntries(true);
    }
    rebuildSiteBar();
    notice(`已删除「${article.title}」`, 'success');
  } catch (e) {
    console.error('删除失败:', e);
    notice('删除失败，请检查文件权限', 'error');
  }
}

// ========== 跳转文章 ==========
function jumpToArticle(article: ArticleEntry) {
  getApp().workspace.openLinkText(article.path, '', false, { active: true });
  setArticleViewVisible(false);
}

// ========== 站点标签栏（单选） ==========
export function rebuildSiteBar() {
  const container = document.querySelector('#article-site-bar .article-sites-scroll');
  if (!container) return;

  // 统计各站点文章数，并缓存一个可用的域名（用于获取图标）
  const siteInfo = new Map<string, { count: number; domain: string }>();
  for (const a of allArticles) {
    const site = a.site;
    if (!siteInfo.has(site)) {
      let domain = '';
      if (a.url) {
        try {
          const url = new URL(a.url);
          domain = url.hostname;
        } catch (e) { /* 忽略 */ }
      }
      siteInfo.set(site, { count: 0, domain });
    }
    siteInfo.get(site)!.count++;
  }

  // 按文章数降序排序
  const sortedSites = Array.from(siteInfo.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map((entry) => entry[0]);

  container.innerHTML = '';

  // -------- "全部"按钮（不加图标） --------
  const allBtn = document.createElement('button');
  allBtn.className = 'article-site-btn';
  allBtn.textContent = `全部 (${allArticles.length})`;
  if (!selectedSite) allBtn.classList.add('active');
  allBtn.onclick = () => {
    selectedSite = null;
    updateSiteButtons(allBtn);
    applyFilter();
  };
  container.appendChild(allBtn);

  // -------- 各站点按钮（带图标） --------
  for (const site of sortedSites) {
    const info = siteInfo.get(site)!;
    const btn = document.createElement('button');
    btn.className = 'article-site-btn';
    btn.dataset.site = site;
    btn.style.cssText = 'display:inline-flex; align-items:center; gap:4px;';

    // 添加图标
    const icon = createSiteIcon(info.domain, 14);
    if (icon) btn.appendChild(icon);

    // 文本：站点名（textContent 子节点防注入，P0-8）+ 计数
    const textSpan = document.createElement('span');
    textSpan.appendChild(document.createTextNode(site));
    textSpan.appendChild(document.createTextNode(' '));
    const countSpan = document.createElement('span');
    countSpan.className = 'count';
    countSpan.textContent = `(${info.count})`;
    textSpan.appendChild(countSpan);
    btn.appendChild(textSpan);

    if (selectedSite === site) btn.classList.add('active');

    btn.onclick = () => {
      if (selectedSite === site) {
        selectedSite = null;
      } else {
        selectedSite = site;
      }
      updateSiteButtons(btn);
      applyFilter();
    };

    container.appendChild(btn);
  }

  // 触摸设备适配（横向滚动）
  const sc = container as HTMLElement;
  if (isTouchDevice) {
    sc.style.flexWrap = 'nowrap';
    sc.style.overflowX = 'auto';
  } else {
    sc.style.flexWrap = 'wrap';
    sc.style.overflowX = 'visible';
  }
}

function updateSiteButtons(clickedBtn: HTMLElement) {
  const allBtns = document.querySelectorAll('.article-site-btn');
  allBtns.forEach((btn) => {
    const el = btn as HTMLElement;
    if (!el.dataset.site) {
      if (!selectedSite) el.classList.add('active');
      else el.classList.remove('active');
    } else {
      if (selectedSite === el.dataset.site) el.classList.add('active');
      else el.classList.remove('active');
    }
  });
}

// ========== 滚动加载更多 ==========
function initScroll() {
  if (!articlesContainer) return;
  articlesContainer.addEventListener('scroll', () => {
    if (isLoadingMore || allLoaded) return;
    const { scrollTop, scrollHeight, clientHeight } = articlesContainer!;
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      isLoadingMore = true;
      renderEntries(false);
      isLoadingMore = false;
    }
  });
}

// ========== 文件监听 ==========
function attachFileListener() {
  if (fileListenerAttached) return;
  const fileModifyHandler = async (file: any) => {
    // 补 '/' 边界：防「我的/文章备选」误命中「我的/文章」前缀（与 auto-summary getWatchDir()+'/' 对齐）
    if (file.path.startsWith(ARTICLE_DIRECTORY + '/') && file.extension === 'md') {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(async () => {
        await refreshData();
        refreshTimer = null;
      }, 300);
    }
  };
  // 换线：原生 vault modify 订阅 → 域事件总线 clipping:file-modified（obsidian-adapter 统一派发，仅 md）。
  // fileListenerRef 改存总线退订函数，卸载点 unloadClipping 同步适配；防抖与目录边界判断原样保留。
  fileListenerRef = onDomainEvent<{ path: string }>('clipping:file-modified', (evt) =>
    fileModifyHandler({ path: evt.path, extension: 'md' })
  );
  fileListenerAttached = true;
}

// ========== ESC 关闭 ==========
function registerEscapeListener() {
  escManager.register('article', {
    isVisible: () => {
      const mask = document.getElementById('article-view-mask');
      return !!mask && mask.style.visibility === 'visible';
    },
    close: () => {
      const mask = document.getElementById('article-view-mask');
      const popup = document.getElementById('article-view-popup');
      if (mask) mask.style.visibility = 'hidden';
      if (popup) popup.style.visibility = 'hidden';
    },
  });
}

// ========== 渲染空状态 ==========
export function renderEmpty() {
  if (!articlesContainer) return;
  articlesContainer.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'article-empty';
  empty.textContent = '暂无文章';
  articlesContainer.appendChild(empty);
}

/** 卸载清理（main.ts onunload 可调用） */
export function unloadClipping(): void {
  if (fileListenerRef) {
    try {
      fileListenerRef(); // 总线退订函数（幂等，重复调用安全）
    } catch (e) { /* 忽略 */ }
    fileListenerRef = null;
    fileListenerAttached = false;
  }
  ['article-view-mask', 'article-view-popup'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
}