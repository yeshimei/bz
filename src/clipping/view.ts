/**
 * 剪藏本（ticket 08）：文章展示面板——搜索、站点过滤（单选）、排序、
 * 反链显示、vault modify 自动刷新、滚动加载。
 * ticket 69 手势重构：统一抽屉（桌面右键 → 跟手菜单、移动端长按 → 底部抽屉，
 * 打开/复制双链/复制原文链接/删除，全局组件承载）＋**双击整卡打开文章**（用户反馈回退单击直开）；
 * 移除旧「长按日期删除」。头部两行=标题+简介（摘要两行省略号截断）。
 */
import { notice } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { getApp } from '../core/app';
import { patchKeyedCards } from '../core/list-patch';
import { escManager } from '../core/esc-manager';
import { createSiteIcon, topifyZ } from '../core/dom';
import { formatRelativeTime } from '../core/utils';
import { tryGetSettings } from '../core/settings-provider';
import { onDomainEvent } from '../core/domain-bus';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { openSettingsModal } from '../core/settings-modal';
import { mobileFullscreenGroup } from '../core/settings-common';
import type { SettingsSchema } from '../core/settings-schema';
import { attachItemActions, type ItemAction } from '../core/item-actions';
import { ensureAutoSummary, stopAutoSummary } from '../auto-summary';
import { buildNewsSourcesGroup } from './news-sources-group';

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
/** 总线退订闭包集合（modify/delete/rename 三通道，onDomainEvent 各返回一个退订函数） */
let fileListenerRefs: (() => void)[] = [];
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
  hasBacklink: boolean;
  backlinkSources: string[];
}

/** 读取插件设置（剪藏目录；批次读设置）。
 *  ticket 130 / ADR-0063 目录变更检测：设置 articleDirectory 与当前缓存目录不一致
 *  → 清空模块列表/筛选态 + 全量重载一次（此后重开零扫描，旧目录文件不留存防错目录渲染）；
 *  面板未建或已卸载（detached）时仅更新配置不重载（避免 hook 错位触发空载）。 */
export function applyArticleSettings(): void {
  const s = tryGetSettings() as any;
  const nextDir = s.articleDirectory || '归档/网页剪藏';
  const nextBatch = parseInt(s.articleBatchSize || '20', 10) || 20;
  if (articlePopup && articlePopup.isConnected && nextDir !== ARTICLE_DIRECTORY) {
    resetArticleCache();
    ARTICLE_DIRECTORY = nextDir;
    BATCH_SIZE = nextBatch;
    if (articlesContainer) showLoadingHint(); // 目录切换期间不残留旧目录内容（防错目录渲染）
    void loadAllArticles();
    return;
  }
  ARTICLE_DIRECTORY = nextDir;
  BATCH_SIZE = nextBatch;
}

/** 目录变更重载前清空缓存（ticket 130）：模块列表/筛选态/滚动进度 + 待结算防抖
 *  （旧目录路径不再结算，防旧目录文件混入新列表） + 搜索框回显同步清空。 */
function resetArticleCache(): void {
  allArticles = [];
  filteredArticles = [];
  currentDisplayCount = 0;
  allLoaded = false;
  selectedSite = null;
  currentSearchKeyword = '';
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  pendingRefreshPaths.clear();
  pendingDeletePaths.clear();
  const input = document.getElementById('article-search-input') as HTMLInputElement | null;
  if (input) input.value = '';
}

// ========== 初始化 ==========
/** 内容区加载提示（打开面板即写入；数据渲染/空态渲染时整体替换） */
function showLoadingHint(): void {
  articlesContainer!.innerHTML = '';
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'article-loading-hint';
  loadingDiv.textContent = '📚 正在加载文章...';
  articlesContainer!.appendChild(loadingDiv);
}

export async function initArticleView(showImmediately = true): Promise<void> {
  const existingPopup = document.getElementById('article-view-popup');
  const existingMask = document.getElementById('article-view-mask');
  if (existingPopup && existingMask) {
    // 窗口已存在，根据参数切换可见性
    if (showImmediately) {
      setArticleViewVisible(true);
      // 移动端默认全屏：开关开=挂 .bz-win-mfs 全屏类（幂等），关=常规卡
      applyMobileWindowFullscreen(articlePopup, tryGetSettings().clippingMobileDefaultFullscreen === true);
      // 重开缓存复用（ticket 130 / ADR-0063）：模块级 allArticles 跨重开常驻、面板显隐只切
      // visibility 不清 DOM，旧列表直接展示——零扫描零加载提示（首开才先弹窗+加载提示+全量加载）。
      // B1 幽灵卡片防护由常驻监听（modify/delete/rename 三通道，面板隐藏不卸、unloadClipping 才退订）
      // 增量维护；仅剪藏目录设置变更时由 applyArticleSettings 清缓存全量重载一次。
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

  // 先弹窗并显示加载提示，再异步加载数据（窗口不等待数据就绪）
  showLoadingHint();
  void loadAllArticles();

  initScroll();
  attachFileListener();
}

// ========== 创建 UI ==========
// ===== 剪藏本设置 schema（ticket 131 声明式，ADR-0064）=====
// 基础/智能组键直绑 + visibleWhen 联动（自动摘要详设随开关展开）；数据源组为 news.json
// 外部数据 + 异步状态，整段走 custom 插槽保留内部联动（组壳卡片形态由渲染器承担）；
// 移动端组 = 通用预设 mobileFullscreenGroup（行为/文案与现网逐字一致）。
export function clippingSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        icon: 'folder-open', name: '基础',
        rows: [
          { type: 'path', mode: 'single', name: '剪藏目录', desc: '存放网页剪藏文章的文件夹', binding: { key: 'articleDirectory' } },
          { type: 'text', name: '每批加载数量', desc: '滚动加载时每批显示的条目数', binding: { key: 'articleBatchSize' } },
        ],
      },
      {
        icon: 'sparkles', name: '智能',
        rows: [
          {
            type: 'toggle', name: '自动摘要', desc: '新剪藏的文章自动生成 AI 摘要', binding: { key: 'autoSummaryEnabled' },
            onChange: (v) => {
              if (v) ensureAutoSummary(getApp());
              else stopAutoSummary(); // 关闭：摘除监听（initialized 保留，再开启复用注册）
            },
          },
          // ticket 124（Q8/Q14）：自动摘要详设——开关开 → 显示详情设置项；关 → 隐藏（visibleWhen 联动）
          { type: 'select', name: '摘要长度', desc: '控制生成的摘要详略程度', binding: { key: 'autoSummaryLength' },
            options: [
              { value: 'simple', label: '简短（50-100 字）' },
              { value: 'standard', label: '标准（150-250 字）' },
              { value: 'detailed', label: '详细（300-400 字）' },
            ],
            visibleWhen: (s) => s.autoSummaryEnabled === true },
          { type: 'toggle', name: '生成标签', desc: '为剪藏生成中文标签', binding: { key: 'autoSummaryTagsEnabled' },
            visibleWhen: (s) => s.autoSummaryEnabled === true },
          { type: 'text', name: '标签数量', desc: '生成的标签个数写成区间，如 3-6', binding: { key: 'autoSummaryTagCount' },
            visibleWhen: (s) => s.autoSummaryEnabled === true && s.autoSummaryTagsEnabled === true },
          { type: 'select', name: '摘要时机', desc: '保存后立刻生成，或仅打开文件时才补全', binding: { key: 'autoSummaryTiming' },
            options: [
              { value: 'immediate', label: '保存后立刻' },
              { value: 'lazy', label: '懒触发（打开时）' },
            ],
            visibleWhen: (s) => s.autoSummaryEnabled === true },
        ],
      },
      {
        icon: 'radio', name: '数据源',
        rows: [
          // custom 插槽：news.json 外部数据 + 异步状态行 + 缺失引导 + B 站开关段内联动（整段保留现有逻辑）
          { type: 'custom', render: (body, ctx) => buildNewsSourcesGroup(body, ctx.refreshVisibility) },
        ],
      },
      mobileFullscreenGroup('clippingMobileDefaultFullscreen'),
    ],
  };
}
/** 面板显隐单点：mask + popup 同步切换（模块级引用即当前实例节点） */
function setArticleViewVisible(visible: boolean): void {
  if (visible && articleMask && articlePopup) topifyZ(articleMask, articlePopup); // ADR-0067：显示即发号，谁后显示谁在上
  const v = visible ? 'visible' : 'hidden';
  if (articleMask) articleMask.style.visibility = v;
  if (articlePopup) articlePopup.style.visibility = v;
}

function createMaskAndPopup() {
  // 遮罩
  articleMask = document.createElement('div');
  articleMask.id = 'article-view-mask';
  articleMask.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;background:var(--background-modifier-cover);visibility:hidden;';
  articleMask.onclick = () => setArticleViewVisible(false);

  // 弹窗
  articlePopup = document.createElement('div');
  articlePopup.id = 'article-view-popup';
  articlePopup.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.2);width:90%;max-width:800px;max-height:80vh;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif;visibility:hidden;';

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

  // 剪藏本设置弹窗（ADR-0009 域设置弹窗；ticket 131 声明式 schema，分组卡片重设计形态保持）
  const settingsBtn = createIconButton('⚙️', '剪藏本设置', () => {
    openSettingsModal({
      title: '剪藏本设置',
      maxWidth: 560,
      // ticket 130 review S1：面板开着时改目录，关设置弹窗即触发目录变更检测（清缓存+全量重载），
      // 不必等下次重开——applyArticleSettings 内部有 isConnected 门控与非变更短路
      onClose: () => applyArticleSettings(),
      schema: clippingSettingsSchema(),
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
  // 先让浏览器绘制「窗口+加载提示」首帧，再整批解析：parseArticleFile 无内部 await，
  // Promise.all 的 map 回调同步执行——不让出一个宏任务，整批解析会抢在首帧绘制前跑完，
  // 加载提示与内容同帧出现（点击后卡顿无反馈，窗口"等加载完才弹出"的观感）。
  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    const dir = app.vault.getAbstractFileByPath(ARTICLE_DIRECTORY);
    if (!dir || !(dir as any).children) {
      allArticles = [];
      filteredArticles = [];
      renderEmpty(); // 目录未配置/不存在 → 引导设置空态（ticket 63）
      return;
    }

    const mdFiles = (dir as any).children.filter((f: any) => f.extension === 'md');
    // 并行解析（parseArticleFile 不读文件本体，纯 metadataCache）
    const entries = await Promise.all(mdFiles.map((f: any) => parseArticleFile(f)));
    const articles = entries.filter((e): e is ArticleEntry => e !== null);
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

/** 解析文章：frontmatter 必需 url+created（缺任一跳过）；title=文件名；纯 metadataCache，不读文件本体 */
export async function parseArticleFile(file: any): Promise<ArticleEntry | null> {
  const app = getApp();
  try {
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache && (cache as any).frontmatter;
    if (!fm) return null;
    if (!fm.url || !fm.created) return null;

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
      hasBacklink,
      backlinkSources,
    };
  } catch (e) {
    console.warn('解析文章失败:', file.path, e);
    return null;
  }
}

// ========== 刷新数据（单文件增量，ticket 45 + B1；ticket 139 起文件事件只 patch 差异卡片） ==========
/** 按路径移除存量条目并增量刷新（删除/改名旧路径/解析失败共用；无此条目则不动） */
function removeArticleByPath(path: string): void {
  const idx = allArticles.findIndex((a) => a.path === path);
  if (idx === -1) return;
  allArticles.splice(idx, 1);
  allArticles.sort((a, b) => b.created.valueOf() - a.created.valueOf());
  refilter();
  patchEntryList(); // 被 key 不在目标区段 → patch 自动移除该卡；其余卡片复用（滚动不跳）
  rebuildSiteBar();
}

/** modify/rename 新路径：只重解析这一个文件并增量更新列表（parseArticleFile 无 I/O，代价低廉） */
async function refreshSingleFile(path: string): Promise<void> {
  const app = getApp();
  const file = app.vault.getAbstractFileByPath(path) as any;
  if (!file) {
    // 文件已删除/移出（如整目录清理）：按路径移除存量条目，防幽灵卡片（B1）
    removeArticleByPath(path);
    return;
  }
  if (file.extension !== 'md') return;
  const entry = await parseArticleFile(file);
  let isNew = false;
  if (entry) {
    isNew = !allArticles.some((a) => a.path === path);
    const idx = allArticles.findIndex((a) => a.path === path);
    if (idx >= 0) allArticles[idx] = entry;
    else allArticles.push(entry);
  } else {
    removeArticleByPath(path); // 修改后不再是合法文章（缺 url/created）→ 从列表移除
    return;
  }
  allArticles.sort((a, b) => b.created.valueOf() - a.created.valueOf());
  refilter();
  if (isNew) {
    // 新增条目落在已显示区段内（或列表为空/区段未开）→ 区段 +1，避免把区段尾部已有卡片挤出屏幕（ticket 139）
    const fi = filteredArticles.findIndex((a) => a.path === path);
    if (fi >= 0 && (fi < currentDisplayCount || currentDisplayCount === 0)) currentDisplayCount++;
  }
  patchEntryList(new Set([path]));
  rebuildSiteBar();
}

// ========== 筛选与排序（单选站点） ==========
/** 纯筛选重算（不动渲染与懒加载计数；ticket 139 从 applyFilter 拆出，文件事件增量路径共用） */
function refilter() {
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
}

export function applyFilter() {
  refilter();
  currentDisplayCount = 0;
  allLoaded = false;
  renderEntries(true);
}

/**
 * 文件事件增量路径（ticket 139）：core patchKeyedCards 只增/删/移/换差异卡片，
 * 不再全列表 innerHTML 重建（根因：任一单文件变更销毁整个列表 DOM → 滚动位置跳顶）。
 */
function patchEntryList(changedPaths: ReadonlySet<string> = new Set()): void {
  if (!articlesContainer) return;
  currentDisplayCount = Math.min(currentDisplayCount, filteredArticles.length);
  if (filteredArticles.length === 0) {
    syncEntryHints();
    return;
  }
  if (!scrollContainer) {
    scrollContainer = document.createElement('div');
    scrollContainer.className = 'article-scroll-container';
    articlesContainer.appendChild(scrollContainer);
  }
  const keys = filteredArticles.slice(0, currentDisplayCount).map((a) => a.path);
  patchKeyedCards({
    container: scrollContainer,
    keyAttr: 'path',
    keys,
    render: (p) => {
      const a = filteredArticles.find((x) => x.path === p);
      return a ? createArticleCard(a) : null;
    },
    changedKeys: changedPaths,
  });
  allLoaded = currentDisplayCount >= filteredArticles.length;
  syncEntryHints();
}

/** 空态（外层容器）/ 懒加载尾部提示（内层滚动区）与增量 patch 后的列表状态同步（ticket 139） */
function syncEntryHints(): void {
  if (!articlesContainer) return;
  const empty = articlesContainer.querySelector<HTMLElement>(':scope > .article-empty');
  if (filteredArticles.length === 0) {
    if (scrollContainer) {
      scrollContainer.remove();
      scrollContainer = null;
    }
    if (!empty) {
      const fresh = document.createElement('div');
      fresh.className = 'article-empty';
      // 空态三态区分（ticket 63）口径与 renderEntries 一致
      if (selectedSite || currentSearchKeyword) {
        fresh.textContent = '没有符合条件的文章';
      } else if (allArticles.length === 0) {
        fresh.textContent = '目录为空，还没有剪藏文章';
      } else {
        fresh.textContent = '没有符合条件的文章';
      }
      articlesContainer.appendChild(fresh);
    }
    return;
  }
  if (empty) empty.remove();
  if (!scrollContainer) {
    scrollContainer = document.createElement('div');
    scrollContainer.className = 'article-scroll-container';
    articlesContainer.appendChild(scrollContainer);
  }
  if (allLoaded) {
    let hint = scrollContainer.querySelector<HTMLElement>('.article-loading-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'article-loading-hint';
      hint.textContent = '已显示所有文章';
    }
    scrollContainer.appendChild(hint); // appendChild 自带移动语义：patch 后恒在末尾，幂等
  } else {
    scrollContainer.querySelectorAll('.article-loading-hint').forEach((el) => el.remove());
  }
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
      // 空态三态区分（ticket 63）：筛选/搜索无结果 vs 目录为空 vs 目录未配置（renderEmpty）
      if (selectedSite || currentSearchKeyword) {
        empty.textContent = '没有符合条件的文章';
      } else if (allArticles.length === 0) {
        empty.textContent = '目录为空，还没有剪藏文章';
      } else {
        empty.textContent = '没有符合条件的文章';
      }
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
/** 删除确认统一走 core/flow-dialog（ticket 52 + 131）：与书库 EPUB 删除同一套自绘确认，保留「此操作不可撤销」说明 */
function showDeleteConfirm(article: ArticleEntry, card: HTMLElement | null) {
  void openFlowDialog({
    title: '确认删除',
    message: `确定要删除文章「${article.title}」吗？\n此操作不可撤销。`,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '删除', value: 'ok', cta: true },
    ],
  }).then((v) => {
    if (v === 'ok') void deleteArticle(article, card);
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
/** 防抖窗口内被修改（含改名新路径）的文件路径集合 */
const pendingRefreshPaths = new Set<string>();
/** 防抖窗口内被删除（含改名旧路径）的文件路径集合 */
const pendingDeletePaths = new Set<string>();

/** 防抖窗口结束统一结算：先按删除路径移除（含改名旧路径），再逐个增量解析存活路径 */
function scheduleRefreshFlush(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    const deletes = Array.from(pendingDeletePaths);
    const modifies = Array.from(pendingRefreshPaths);
    pendingDeletePaths.clear();
    pendingRefreshPaths.clear();
    for (const p of deletes) removeArticleByPath(p);
    for (const p of modifies) await refreshSingleFile(p);
    refreshTimer = null;
  }, 300);
}

function attachFileListener() {
  if (fileListenerAttached) return;
  const inDir = (path: string) => path.startsWith(ARTICLE_DIRECTORY + '/');
  const fileModifyHandler = (file: any) => {
    // 补 '/' 边界：防「我的/文章备选」误命中「我的/文章」前缀（与 auto-summary getWatchDir()+'/' 对齐）
    if (inDir(file.path) && file.extension === 'md') {
      pendingRefreshPaths.add(file.path);
      scheduleRefreshFlush();
    }
  };
  // 销毁侧（vault delete / rename 旧路径）：文件已不在，按路径移除旧条目，防幽灵卡片（B1）
  const fileDeleteHandler = (evt: { path: string }) => {
    if (inDir(evt.path)) {
      pendingDeletePaths.add(evt.path);
      scheduleRefreshFlush();
    }
  };
  // 改名：移除 oldPath 旧卡；新路径仍在剪藏目录则增量解析（auto-summary 改名正走此事件 → 防同文双卡）
  const fileRenameHandler = (evt: { oldPath: string; newPath: string; movedOut: boolean }) => {
    if (inDir(evt.oldPath)) pendingDeletePaths.add(evt.oldPath);
    // movedOut=true 为移入（旧路径不在域内，无旧卡）；movedOut=false 则新旧路径均在剪藏目录
    if (!evt.movedOut && inDir(evt.newPath)) pendingRefreshPaths.add(evt.newPath);
    scheduleRefreshFlush();
  };
  // 换线：原生 vault 事件 → 域事件总线 clipping:file-*（obsidian-adapter 统一派发，仅 md；rename 只发一条）。
  // fileListenerRefs 存各通道退订闭包，卸载点 unloadClipping 统一退订；防抖与目录边界判断原样保留。
  fileListenerRefs = [
    // created 通道（ticket 130 review 补口，ADR-0063 四通道）：面板隐藏期/无回写路径的新建剪藏
    // （资讯阅读器保存、网页剪藏、手动拖入均为单次 create 无后续 modify）→ 与 modify 同语义增量补挂，
    // 防「重开零扫描后新文章永久缺失」；空目录新建等非 md 由 obsidian-adapter 语义路过滤
    onDomainEvent<{ path: string }>('clipping:file-created', (evt) =>
      fileModifyHandler({ path: evt.path, extension: 'md' })
    ),
    onDomainEvent<{ path: string }>('clipping:file-modified', (evt) =>
      fileModifyHandler({ path: evt.path, extension: 'md' })
    ),
    onDomainEvent<{ path: string }>('clipping:file-deleted', fileDeleteHandler),
    onDomainEvent<{ oldPath: string; newPath: string; movedOut: boolean }>('clipping:file-renamed', fileRenameHandler),
  ];
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
/** 目录未配置/不存在空态（ticket 63）：引导到设置；区别于「目录为空」与「筛选无结果」 */
export function renderEmpty() {
  if (!articlesContainer) return;
  articlesContainer.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'article-empty';
  empty.textContent = `未找到剪藏目录「${ARTICLE_DIRECTORY}」，请点击右上角 ⚙️ 前往设置`;
  articlesContainer.appendChild(empty);
}

/** 卸载清理（main.ts onunload 可调用） */
export function unloadClipping(): void {
  if (fileListenerRefs.length > 0) {
    for (const unsub of fileListenerRefs) {
      try {
        unsub(); // 总线退订函数（幂等，重复调用安全）
      } catch (e) { /* 忽略 */ }
    }
    fileListenerRefs = [];
    fileListenerAttached = false;
  }
  ['article-view-mask', 'article-view-popup'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
}