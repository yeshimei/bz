/**
 * 第二大脑主面板（ticket 103 建；ticket 107 首用引导；ticket 108 打磨；ticket 109 统计卡精简）
 * 统一入口弹窗：统计卡片 / 内容规模明细 / 来源分布树形 / 近 12 周趋势 / 最近向量化 / AI 概括。
 * - ticket 108 打磨项：
 *   ① 存储占用=meta+向量合计单值（hover 明细）；上次索引与最近向量化行用共享 formatRelativeTime；
 *   ② 来源分布改树形逐级展开（名称左对齐，▸/▾ 递归下钻子目录）；
 *   ③ ticket 108 曾新增白名单覆盖率/内容规模/最厚笔记 Top5/一致性健康四项，其中覆盖率卡与 Top5 区块已按 ticket 109 移除（语义重复/需求砍掉）；
 *   ④ 每次打开自动增量索引：有待处理变更 → 全屏进度视图接管，完成后再进统计；无变更直接统计；
 *   ⑤ 概括走统一 AI 通道（主设置页服务商）；缓存并入 secondbrain.json panel 段（ticket 120），设置页清除入口移除。
 * - 引导/进度视图三用：首次初始化（空库，带按钮）/ 自动增量（待处理块，纯进度）/ 重新索引（设置页确认后）。
 * - ticket 114：初始向量化进行中关页重开 → 恢复实时进度视图（原缺陷：重开回引导态且按钮
 *   因 initializing 守卫静默失效，看起来「点击没有任何反应」）；重复点击不再吞掉，接回进度。
 * - 样式全部收敛 src/secondbrain/styles.css（bz-sb-panel-* / bz-sb-onboard-* / bz-sb-dist-*）。
 */
import type { App } from 'obsidian';
import { Setting } from 'obsidian';
import { notice } from '../core/notice';
import { tryGetSettings, saveSettings } from '../core/settings-provider';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { openSettingsModal, closeSettingsModal, createSettingsGroup, refreshSettingsGroupCounts } from '../core/settings-modal';
import { escapeHtml, formatRelativeTime } from '../core/utils';
import { confirm } from '../core/confirm';
import { getApp } from '../core/app';
import { buildConfig, IS_MOBILE } from './config';
import { loadStore, mutateStore } from './store-file';
import { AI } from './ai';
import type { VectorStore, SecondBrainMeta } from './vector-store';
import { parsePathList, formatPathList } from './whitelist';
import { openWhitelistPicker, renderSelectedChips } from './whitelist-modal';
import { getLanIPs, formatRemoteOllamaUrl, pickPrimaryLanIp } from './local-ip';

// ==================== 统计聚合（纯函数，可测） ====================

export interface SourceDistItem {
  name: string;
  notes: number;
  chunks: number;
}

export interface RecentNote {
  path: string;
  mtime: number;
  chunks: number;
}

export interface SecondBrainStats {
  chunkCount: number;
  noteCount: number;
  dim: number;
  metaBytes: number;
  vecBytes: number;
  lastIndexedAt: number | null;
  bySource: SourceDistItem[];
  recent: RecentNote[];
  /** 近 12 周（含本周）每周向量化笔记数，旧→新 */
  trend12w: number[];
  /** 内容规模（ticket 108）：总字符数 / 平均块长 / 平均每篇块数 */
  totalChars: number;
  avgChunkLen: number;
  avgChunksPerNote: number;
}

/** 来源分布树节点（ticket 108）：dir 末段为 name，聚合整棵子树计数，children 按 chunks 降序 */
export interface SourceTreeNode {
  name: string;
  path: string;
  notes: number;
  chunks: number;
  children: SourceTreeNode[];
}

function topLevelDir(path: string): string {
  const i = path.indexOf('/');
  return i === -1 ? '（根目录）' : path.slice(0, i);
}

/**
 * 由 meta.notes 构建来源目录树（纯函数）：每级节点聚合其下全部笔记/块数，
 * 子节点按 chunks 降序；根节点=白名单顶层目录。
 */
export function buildSourceTree(meta: SecondBrainMeta): SourceTreeNode[] {
  const roots = new Map<string, SourceTreeNode>();
  const childOf = new Map<string, SourceTreeNode[]>(); // dirPath → children
  const nodeOf = new Map<string, SourceTreeNode>();

  const ensureDir = (dir: string): SourceTreeNode => {
    let node = nodeOf.get(dir);
    if (node) return node;
    const segs = dir.split('/').filter(Boolean);
    node = {
      name: segs[segs.length - 1] || dir,
      path: dir,
      notes: 0,
      chunks: 0,
      children: [],
    };
    nodeOf.set(dir, node);
    if (segs.length === 1) {
      roots.set(dir, node);
    } else {
      const parent = ensureDir(segs.slice(0, -1).join('/'));
      const siblings = childOf.get(parent.path) || [];
      siblings.push(node);
      childOf.set(parent.path, siblings);
    }
    return node;
  };

  for (const [path, entry] of Object.entries(meta.notes)) {
    // 根目录文件（无 '/'）归入「（根目录）」；注意 lastIndexOf=-1 时不能 slice(0,-1) 切掉末字符
    const idx = path.lastIndexOf('/');
    const dir = idx === -1 ? '（根目录）' : path.slice(0, idx);
    // 逐级向上聚合：每一级目录节点都计入其下全部笔记与块（树形口径，ticket 108）
    let cursor: SourceTreeNode | null = ensureDir(dir);
    while (cursor) {
      cursor.notes++;
      cursor.chunks += entry.chunks.length;
      const segs = cursor.path.split('/').filter(Boolean);
      if (segs.length <= 1) break; // 到达顶层（含「（根目录）」）即止
      cursor = nodeOf.get(segs.slice(0, -1).join('/')) ?? null;
    }
  }

  // 物化父子连接：ensureDir 期间子节点挂到 childOf[父 path]，此处回填到各节点 .children
  for (const node of nodeOf.values()) {
    node.children = childOf.get(node.path) || [];
  }

  const sortChildren = (arr: SourceTreeNode[]): void => {
    arr.sort((a, b) => b.chunks - a.chunks);
    for (const c of arr) sortChildren(c.children);
  };
  const rootsArr = [...roots.values()];
  sortChildren(rootsArr);
  return rootsArr;
}

/** 数值缩写（ticket 109）：≥10,000 显示 K/M（19.7K / 1.2M），万以下原样千分位；精确值走卡片 title hover */
export function fmtCompact(n: number): string {
  const trim = (s: string) => s.replace(/\.0$/, '');
  if (n >= 1_000_000_000) return `${trim((n / 1_000_000_000).toFixed(1))}B`;
  if (n >= 1_000_000) return `${trim((n / 1_000_000).toFixed(1))}M`;
  if (n >= 10_000) return `${trim((n / 1000).toFixed(1))}K`;
  return n.toLocaleString();
}

/** 由 meta.notes 聚合全部统计（本地计算，秒开） */
export function computeStats(meta: SecondBrainMeta, now = Date.now()): Omit<SecondBrainStats, 'metaBytes' | 'vecBytes'> {
  const bySource = new Map<string, SourceDistItem>();
  let chunkCount = 0;
  let totalChars = 0;
  const recent: RecentNote[] = [];
  // 12 周桶：桶 0=最早，桶 11=本周
  const weekMs = 7 * 24 * 3600 * 1000;
  const thisWeekStart = Math.floor(now / weekMs) * weekMs;
  const trend12w = new Array<number>(12).fill(0);

  for (const [path, entry] of Object.entries(meta.notes)) {
    const chunks = entry.chunks.length;
    chunkCount += chunks;
    let chars = 0;
    for (const c of entry.chunks) chars += c.text.length;
    totalChars += chars;
    const dir = topLevelDir(path);
    const item = bySource.get(dir) || { name: dir, notes: 0, chunks: 0 };
    item.notes++;
    item.chunks += chunks;
    bySource.set(dir, item);
    recent.push({ path, mtime: entry.mtime, chunks });
    const bucket = 11 - Math.floor((thisWeekStart - entry.mtime) / weekMs);
    if (bucket >= 0 && bucket <= 11) trend12w[bucket]++;
  }

  recent.sort((a, b) => b.mtime - a.mtime);
  const bySourceArr = [...bySource.values()].sort((a, b) => b.chunks - a.chunks);
  const noteCount = Object.keys(meta.notes).length;
  return {
    chunkCount,
    noteCount,
    dim: meta._dim || 0,
    lastIndexedAt: recent[0]?.mtime ?? null,
    bySource: bySourceArr,
    recent: recent.slice(0, 10),
    trend12w,
    totalChars,
    avgChunkLen: chunkCount ? Math.round(totalChars / chunkCount) : 0,
    avgChunksPerNote: noteCount ? Math.round((chunkCount / noteCount) * 10) / 10 : 0,
  };
}

// ==================== 概括缓存（secondbrain.json panel 段，ticket 120） ====================

interface SummaryCache {
  summary: string;
  generatedAt: number;
}

async function readCache(): Promise<SummaryCache | null> {
  try {
    const store = await loadStore();
    return store.panel;
  } catch {
    return null;
  }
}

async function writeCache(cache: SummaryCache): Promise<void> {
  await mutateStore((s) => {
    s.panel = cache;
  });
}

/** 构建概括提示词（纯函数） */
export function buildSummaryPrompt(stats: Pick<SecondBrainStats, 'noteCount' | 'chunkCount' | 'bySource'>): string {
  const dist = stats.bySource
    .slice(0, 8)
    .map((s) => `- ${s.name}：${s.notes} 篇 / ${s.chunks} 段`)
    .join('\n');
  return (
    `你是「第二大脑」助手。用户的笔记向量库共有 ${stats.noteCount} 篇笔记、${stats.chunkCount} 个段落，分布如下：\n` +
    `${dist}\n\n请用不超过 120 字的中文，概括这个知识库的构成与侧重，语气自然，不要罗列数字清单。`
  );
}

// ==================== 主面板弹窗 ====================

export interface PanelOptions {
  onOpenReference: () => void;
  onOpenChat: () => void;
}

export class SecondBrainPanel {
  app: App;
  store: VectorStore;
  private opts: PanelOptions;
  private mask: HTMLElement | null = null;
  private popup: HTMLElement | null = null;
  private escapeHandler: ((e: KeyboardEvent) => void) | null = null;
  private refreshing = false;
  /** 初始向量化视图进行中标记（ticket 114：runInitialIndexView 持有；进行中重复点击接回进度视图而非静默失效） */
  private initializing = false;
  /** 头部功能钮（📚💬）——引导期收起 */
  private funcBtns: HTMLButtonElement[] = [];
  /** 来源分布树已展开的目录（ticket 108，会话内记忆） */
  private expandedDirs = new Set<string>();
  /** 设置页「重新索引」意图标记（ticket 108：确认后打开面板即自动全量重建） */
  private rebuildRequested = false;

  constructor(app: App, store: VectorStore, opts: PanelOptions) {
    this.app = app;
    this.store = store;
    this.opts = opts;
  }

  /** 设置页「重新索引」调用（index.ts 入口转发）：标记意图后打开面板自动跑 */
  requestRebuild(): void {
    this.rebuildRequested = true;
  }

  async open(): Promise<void> {
    this.createUI();
    // [l2-sb] ESC 监听与 open/close 成对：open 挂载、close 移除（幂等），反复开关不累积
    this.attachEscapeListener();
    this.mask!.style.display = 'block';
    this.popup!.style.display = 'flex';
    applyMobileWindowFullscreen(this.popup, tryGetSettings().secondBrainMobileDefaultFullscreen === true);
    // 先等初始 load 完成再定形态（防启动竞态把已有索引误判为空库）
    await this.render();
  }

  close(): void {
    this.removeEscapeListener(); // [l2-sb] 面板关闭即移除 ESC 监听（与 open 成对）
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
  }

  /** [l2-sb] ESC 关闭监听：注册/移除成对（幂等）——open 挂载、close 移除 */
  private attachEscapeListener(): void {
    if (this.escapeHandler) return;
    this.escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this.escapeHandler);
  }

  private removeEscapeListener(): void {
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }
  }

  destroy(): void {
    this.removeEscapeListener();
    this.mask?.remove();
    this.popup?.remove();
    this.mask = null;
    this.popup = null;
  }

  /** 打开形态分派：重建意图 → 全量重建进度；空库+初始索引进行中 → 恢复进度（fire-and-forget，不阻塞 panel.open）；空库 → 引导态；
   *  就绪 + 待处理 → 增量进度；就绪无变更 → 统计（ticket 114 补「空库但 refresh 在途」分支） */
  private async render(): Promise<void> {
    if (this.store.initialLoad) {
      try {
        await this.store.initialLoad;
      } catch {
        /* load 失败按空库处理，走引导态 */
      }
    }
    const rebuild = this.rebuildRequested;
    this.rebuildRequested = false;
    if (rebuild && this.store.isIndexReady()) {
      await this.runRebuild();
      return;
    }
    if (!this.store.isIndexReady()) {
      if (this.store.isRefreshing()) {
        // 初始向量化仍在后台跑（关页重开场景）：先展示进度视图，不 await——
        // 背景 runInitialIndexView 完成后自行切内容态或重试按钮，panel.open() 不阻塞。
        this.enterProgressView('正在初始化向量数据库');
        void this.runInitialIndexView();
        return;
      }
      this.showInitGuidance();
      return;
    }
    if (this.store.hasPendingChanges()) {
      // ticket 108：有待处理增量 → 全屏进度视图接管，完成后自动进统计
      await this.runIncremental();
      return;
    }
    this.showContent();
  }

  private showContent(skipRefresh = false): void {
    const onboard = document.getElementById('bz-sb-onboard');
    const content = document.getElementById('bz-sb-content');
    if (onboard) onboard.style.display = 'none';
    if (content) content.style.display = 'flex';
    for (const b of this.funcBtns) b.classList.remove('bz-sb-btn-hidden');
    if (!skipRefresh && !this.refreshing) void this.autoRefreshThenRender();
  }

  /** 空库首次引导：说明 + 开始按钮（进度视图的 init 形态） */
  private showInitGuidance(): void {
    const onboard = document.getElementById('bz-sb-onboard');
    const content = document.getElementById('bz-sb-content');
    const title = document.getElementById('bz-sb-progress-title');
    const desc = document.getElementById('bz-sb-onboard-desc');
    const btn = document.getElementById('bz-sb-init-btn') as HTMLButtonElement | null;
    const box = document.getElementById('bz-sb-init-progress');
    if (title) title.textContent = '初始化向量数据库';
    if (desc) desc.style.display = 'block';
    if (btn) {
      btn.style.display = 'block';
      btn.disabled = false;
      btn.textContent = '🚀 开始向量化';
    }
    if (box) box.style.display = 'none';
    if (onboard) onboard.style.display = 'flex';
    if (content) content.style.display = 'none';
    for (const b of this.funcBtns) b.classList.add('bz-sb-btn-hidden');
  }

  /** 进入纯进度形态（自动运行，无按钮；title 由调用方给定） */
  private enterProgressView(titleText: string, resetStatus = true): void {
    const onboard = document.getElementById('bz-sb-onboard');
    const content = document.getElementById('bz-sb-content');
    const title = document.getElementById('bz-sb-progress-title');
    const desc = document.getElementById('bz-sb-onboard-desc');
    const btn = document.getElementById('bz-sb-init-btn') as HTMLButtonElement | null;
    const box = document.getElementById('bz-sb-init-progress');
    const fill = document.getElementById('bz-sb-init-fill');
    const status = document.getElementById('bz-sb-init-status');
    if (title) title.textContent = titleText;
    if (desc) desc.style.display = 'none';
    if (btn) btn.style.display = 'none';
    if (box) box.style.display = 'flex';
    if (fill) fill.style.width = '0%';
    if (resetStatus && status) status.textContent = '准备中…';
    if (onboard) onboard.style.display = 'flex';
    if (content) content.style.display = 'none';
    for (const b of this.funcBtns) b.classList.add('bz-sb-btn-hidden');
  }

  /** 进度回调解析：把 store.updateProgress 文案换算成进度条（面板销毁后不再写 DOM） */
  private progressObserver(): (msg: string) => void {
    const status = document.getElementById('bz-sb-init-status');
    const fill = document.getElementById('bz-sb-init-fill');
    return (msg: string) => {
      if (!status?.isConnected) return;
      const m = msg.match(/向量化:\s*(\d+)\/(\d+)/);
      if (m && Number(m[2]) > 0) {
        fill!.style.width = Math.min(100, Math.round((Number(m[1]) / Number(m[2])) * 100)) + '%';
      }
      status.textContent = msg;
    };
  }

  /** 自动增量索引（ticket 108）：有待处理块 → 进度视图 → 完成后统计；
   *  ticket 3 假成功修复：有失败段 → toast 明示失败数（进度视图随即被内容态替代，仅靠状态行不可见） */
  private async runIncremental(): Promise<void> {
    this.enterProgressView('正在同步索引');
    let lastMsg = '';
    try {
      await this.store.refresh((msg) => {
        lastMsg = msg;
        this.progressObserver()(msg);
      });
    } catch (e) {
      console.warn('[secondbrain] 面板增量索引失败', e);
    }
    if (!this.store.isIndexReady()) {
      // 极端：增量后索引反而不可用（如全部被清空）→ 回引导态兜底
      this.showInitGuidance();
      return;
    }
    this.showContent(true);
    await this.renderStats();
    // 增量索引失败段数提示（与 vector-store 完成态文案同口径；成功不发——完成态已展示）
    const fail = lastMsg.match(/^⚠️\s*(\d+)\s*段向量化失败/);
    if (fail) {
      notice(`第二大脑：${fail[1]} 段向量化失败，请检查 Ollama 服务`, 'warning');
    }
  }

  /** 全量重建（ticket 108「重新索引」）：清空 → 整库重嵌 → 统计；失败给原因可重试 */
  private async runRebuild(): Promise<void> {
    this.enterProgressView('正在重建向量数据库');
    const btn = document.getElementById('bz-sb-init-btn') as HTMLButtonElement | null;
    const status = document.getElementById('bz-sb-init-status');
    const box = document.getElementById('bz-sb-init-progress');
    this.initializing = true;
    try {
      await this.store.rebuildAll(this.progressObserver());
      if (this.store.isIndexReady()) {
        this.showContent(true);
        await this.renderStats();
      } else {
        if (box) box.style.display = 'flex';
        if (status) status.textContent = '重建未完成：请确认 Ollama 服务与 Embedding 模型可用后重试';
        if (btn) {
          btn.style.display = 'block';
          btn.disabled = false;
          btn.textContent = '🚀 重试重建';
          btn.onclick = () => void this.runRebuild();
        }
      }
    } catch (e: any) {
      console.warn('[secondbrain] 全量重建失败', e);
      if (status?.isConnected) {
        status.textContent = '重建失败：' + (e?.message || e);
        if (btn) {
          btn.style.display = 'block';
          btn.disabled = false;
          btn.textContent = '🚀 重试重建';
          btn.onclick = () => void this.runRebuild();
        }
      }
    } finally {
      this.initializing = false;
    }
  }

  private createUI(): void {
    if (this.mask && document.body.contains(this.mask)) return;
    const mask = document.createElement('div');
    mask.className = 'bz-sb-panel-mask';
    mask.onclick = () => this.close();

    const popup = document.createElement('div');
    popup.className = 'bz-sb-panel';

    // 头部：标题 + 功能(📚💬) + ⚙️ + ✕(仅移动全屏)
    const head = document.createElement('div');
    head.className = 'bz-win-head bz-sb-panel-head';
    const title = document.createElement('h3');
    title.textContent = '🧠 第二大脑';
    const btns = document.createElement('div');
    btns.className = 'bz-sb-panel-btns';
    const mkBtn = (cls: string, label: string, tip: string, onclick: () => void) => {
      const b = document.createElement('button');
      b.className = cls;
      b.textContent = label;
      b.setAttribute('aria-label', tip);
      b.onclick = onclick;
      btns.appendChild(b);
      return b;
    };
    const refBtn = mkBtn('bz-sb-panel-func', '📚', '打开侧边栏', () => {
      this.close();
      this.opts.onOpenReference();
    });
    const chatBtn = mkBtn('bz-sb-panel-func', '💬', '打开对话', () => {
      this.close();
      this.opts.onOpenChat();
    });
    this.funcBtns = [refBtn, chatBtn]; // 引导期整体收起（ticket 107）
    mkBtn('bz-sb-panel-gear', '⚙️', '第二大脑设置', () => this.openSettings());
    if (isMobileEnv() && tryGetSettings().secondBrainMobileDefaultFullscreen === true) {
      mkBtn('bz-win-close', '❌', '关闭', () => this.close());
    }

    head.appendChild(title);
    head.appendChild(btns);
    popup.appendChild(head);

    // 内容区
    const body = document.createElement('div');
    body.className = 'bz-sb-panel-body';

    // 内容态包裹层（引导态整层隐藏；初始双隐，open().render() 后二选一显示）
    const content = document.createElement('div');
    content.className = 'bz-sb-panel-content';
    content.id = 'bz-sb-content';
    content.style.display = 'none';

    const cards = document.createElement('div');
    cards.className = 'bz-sb-cards';
    cards.id = 'bz-sb-cards';
    content.appendChild(cards);

    const trendBox = document.createElement('div');
    trendBox.className = 'bz-sb-section';
    trendBox.innerHTML = `<div class="bz-sb-section-title">近 12 周向量化趋势</div><div id="bz-sb-trend" class="bz-sb-trend"></div>`;
    content.appendChild(trendBox);

    // ticket 108 新维度：内容规模（总字数/平均块长/平均每篇块数）
    const scaleBox = document.createElement('div');
    scaleBox.className = 'bz-sb-section';
    scaleBox.innerHTML = `<div class="bz-sb-section-title">内容规模</div><div id="bz-sb-scale" class="bz-sb-scale"></div>`;
    content.appendChild(scaleBox);

    const distBox = document.createElement('div');
    distBox.className = 'bz-sb-section';
    distBox.innerHTML = `<div class="bz-sb-section-title">来源分布</div><div id="bz-sb-dist" class="bz-sb-dist"></div>`;
    content.appendChild(distBox);

    const recentBox = document.createElement('div');
    recentBox.className = 'bz-sb-section';
    recentBox.innerHTML = `<div class="bz-sb-section-title">最近向量化</div><div id="bz-sb-recent" class="bz-sb-recent"></div>`;
    content.appendChild(recentBox);

    const summaryBox = document.createElement('div');
    summaryBox.className = 'bz-sb-section';
    const sumBtn = document.createElement('button');
    sumBtn.className = 'bz-sb-summary-btn';
    sumBtn.textContent = '✨ 生成概括';
    sumBtn.onclick = () => void this.generateSummary(sumBtn);
    const sumMeta = document.createElement('span');
    sumMeta.className = 'bz-sb-summary-meta';
    sumMeta.id = 'bz-sb-summary-meta';
    const sumText = document.createElement('div');
    sumText.className = 'bz-sb-summary-text';
    sumText.id = 'bz-sb-summary-text';
    summaryBox.appendChild(sumBtn);
    summaryBox.appendChild(sumMeta);
    summaryBox.appendChild(sumText);
    content.appendChild(summaryBox);

    body.appendChild(content);

    // 引导态（ticket 107）：本地无向量数据时的首次初始化入口
    const onboard = document.createElement('div');
    onboard.className = 'bz-sb-onboard';
    onboard.id = 'bz-sb-onboard';
    onboard.style.display = 'none';

    const obIcon = document.createElement('div');
    obIcon.className = 'bz-sb-onboard-icon';
    obIcon.textContent = '🧠';
    const obTitle = document.createElement('div');
    obTitle.className = 'bz-sb-onboard-title';
    obTitle.id = 'bz-sb-progress-title'; // 引导/增量/重建三形态共用的标题位（ticket 108）
    obTitle.textContent = '初始化向量数据库';
    const obDesc = document.createElement('div');
    obDesc.className = 'bz-sb-onboard-desc';
    obDesc.id = 'bz-sb-onboard-desc';
    obDesc.textContent =
      '第二大脑还没有你的笔记索引。点击下方按钮后，会把白名单目录内的笔记分块并向量化' +
      '（通过 Ollama 本地生成，数据不出本机），建成可检索的知识库——之后参考侧边栏、AI 对话与这里的统计才会可用。' +
      '首次向量化需要手动触发一次，完成后笔记变更会自动增量同步。';
    const initBtn = document.createElement('button');
    initBtn.className = 'bz-sb-init-btn';
    initBtn.id = 'bz-sb-init-btn';
    initBtn.textContent = '🚀 开始向量化';
    initBtn.onclick = () => void this.startInitialIndex();
    const progress = document.createElement('div');
    progress.className = 'bz-sb-init-progress';
    progress.id = 'bz-sb-init-progress';
    const bar = document.createElement('div');
    bar.className = 'bz-sb-init-bar';
    const fill = document.createElement('span');
    fill.className = 'bz-sb-init-fill';
    fill.id = 'bz-sb-init-fill';
    bar.appendChild(fill);
    const status = document.createElement('div');
    status.className = 'bz-sb-init-status';
    status.id = 'bz-sb-init-status';
    progress.appendChild(bar);
    progress.appendChild(status);

    onboard.appendChild(obIcon);
    onboard.appendChild(obTitle);
    onboard.appendChild(obDesc);
    onboard.appendChild(initBtn);
    onboard.appendChild(progress);
    body.appendChild(onboard);

    popup.appendChild(body);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    // ESC 关闭监听移到 open()/close() 成对注册移除（[l2-sb]：不再每次 createUI 私挂 document keydown）

    this.mask = mask;
    this.popup = popup;
  }

  /** 内容态打开时自动增量刷新，完成后重渲统计（修复：原先渲染不等 refresh，展示的总是上一轮旧数据） */
  private async autoRefreshThenRender(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      await this.store.refresh((msg) => {
        if (msg.startsWith('向量化:') || msg.startsWith('✅ 向量化完成')) console.log(`[secondbrain] ${msg}`);
      });
    } catch (e) {
      console.warn('[secondbrain] 面板自动刷新失败', e);
    } finally {
      this.refreshing = false;
    }
    await this.renderStats();
  }

  /**
   * 初始向量化运行器（ticket 114 自按钮处理器抽出共用）：进入进度视图并接住 refresh 实时进度，
   * 完成切内容态渲染统计；失败给出原因并可重试。
   * 按钮点击与「关页重开恢复」（render 分派）两条路都走这里——store.refresh 并发去重保证
   * 重复调用只是把进度回调重新接到同一个进行中的 promise 上，不会二次跑库。
   * 注意：refresh 全部嵌入失败时不抛错也不登记任何条目（QA 同语义），故以 isIndexReady 判定成败。
   */
  private async runInitialIndexView(): Promise<void> {
    const status = document.getElementById('bz-sb-init-status');
    if (!status || !status.isConnected) return;
    this.enterProgressView('正在初始化向量数据库');
    this.initializing = true;
    let sawCountedDone = false; // ✅ 向量化完成：N 篇…（ticket 3 起仅全部成功才发）
    let sawWarning = false; // ⚠️ 白名单空 / 无符合条件的文件
    let sawFail = false; // [3] 「N 段向量化失败」提示（Ollama 服务异常或部分失败）
    try {
      await this.store.refresh((msg) => {
        if (!status.isConnected) return; // 面板已销毁：不再写 DOM
        if (msg.startsWith('⚠️')) sawWarning = true;
        if (msg.includes('段向量化失败')) sawFail = true;
        if (msg.startsWith('✅ 向量化完成：')) sawCountedDone = true;
        this.progressObserver()(msg);
      });
      if (!status.isConnected) return;
      if (this.store.isIndexReady()) {
        this.showContent(true); // 刚完成全量索引，跳过重复自动刷新
        await this.renderStats(); // 但统计必须立即渲染（skipRefresh 不带渲染）
      } else if (sawFail || sawCountedDone) {
        // [3]：失败段提示（缺 ✅ 完整完成）或全跑完仍未登记 → 判为 Ollama/数据不可用，先于白名单提示
        status.textContent =
          '没有成功向量化任何内容：请确认 Ollama 服务与 Embedding 模型可用' +
          (IS_MOBILE ? '（移动端需配置「远程 Ollama URL」）' : '') +
          '后重试';
        this.revealInitBtn('🚀 重试初始化');
      } else if (sawWarning) {
        status.textContent = '白名单目录内没有可索引的 Markdown 笔记：请检查 ⚙️ 设置中的「白名单目录」';
        this.revealInitBtn('🚀 重试初始化');
      } else {
        status.textContent = '未发现可索引的笔记内容';
        this.revealInitBtn('🚀 重试初始化');
      }
    } catch (e: any) {
      console.warn('[secondbrain] 初始向量化失败', e);
      if (status.isConnected) {
        status.textContent = '初始化失败：' + (e?.message || e);
        this.revealInitBtn('🚀 重试初始化');
      }
    } finally {
      this.initializing = false;
    }
  }

  /**
   * 引导按钮（ticket 107/108；ticket 114 修「点了没反应」）：首次全量向量化。
   * 已在进行中（关页重开后的引导态残留 / 双击）时不再静默吞掉——只要后台确有 refresh 在跑，
   * 就切回进度视图接回实时进度；否则维持原守卫语义不动。
   */
  private startInitialIndex(): void {
    if (!document.getElementById('bz-sb-init-progress')) return;
    if (this.initializing || this.refreshing) {
      if (this.store.isRefreshing()) void this.runInitialIndexView();
      return;
    }
    void this.runInitialIndexView();
  }

  /** 失败路径恢复「开始按钮」可见并复位文案（进度形态时按钮被隐藏） */
  private revealInitBtn(label: string): void {
    const btn = document.getElementById('bz-sb-init-btn') as HTMLButtonElement | null;
    if (!btn) return;
    btn.style.display = 'block';
    btn.disabled = false;
    btn.textContent = label;
    btn.onclick = () => void this.startInitialIndex();
  }

  private async renderStats(): Promise<void> {
    const CONFIG = buildConfig();
    let metaBytes = 0;
    let vecBytes = 0;
    try {
      metaBytes = (await this.app.vault.adapter.stat(CONFIG.STORE_PATH))?.size ?? 0;
    } catch {}
    try {
      vecBytes = (await this.app.vault.adapter.stat(CONFIG.VEC_PATH))?.size ?? 0;
    } catch {}
    const stats = { ...computeStats(this.store.meta), metaBytes, vecBytes };

    // ---- 卡片行（ticket 109：六张精简版一行放下；≥1 万数值 K/M 缩写，hover 精确值） ----
    const cards = document.getElementById('bz-sb-cards');
    if (cards) {
      const fmtBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
      // 索引健康：向量行数 vs 块总数（dim>0 才有行数概念）
      const vecRows = stats.dim && vecBytes > 0 ? (this.store.vectors.length / stats.dim) : 0;
      const healthy = vecRows === 0 || vecRows === stats.chunkCount;
      const items: Array<[string, string, string]> = [
        ['向量块', fmtCompact(stats.chunkCount), `共 ${stats.chunkCount.toLocaleString()} 个向量块`],
        ['覆盖笔记', fmtCompact(stats.noteCount), `共 ${stats.noteCount.toLocaleString()} 篇笔记`],
        ['嵌入维度', stats.dim > 0 ? `${stats.dim} 维` : '—', `嵌入模型 ${CONFIG.EMBEDDING_MODEL} · 维度变更需重建索引`],
        ['索引健康', healthy ? '✓ 一致' : `⚠ 偏差 ${Math.abs(vecRows - stats.chunkCount)} 行`, `向量 ${vecRows} 行 / 块 ${stats.chunkCount} 个`],
        ['存储占用', stats.vecBytes ? fmtBytes(metaBytes + vecBytes) : '—', `meta ${fmtBytes(metaBytes)} + 向量 ${fmtBytes(vecBytes)}`],
        ['上次索引', stats.lastIndexedAt ? formatRelativeTime(stats.lastIndexedAt) : '—', stats.lastIndexedAt ? new Date(stats.lastIndexedAt).toLocaleString() : ''],
      ];
      cards.innerHTML = items
        .map(
          ([k, v, tip]) =>
            `<div class="bz-sb-card"${tip ? ` title="${tip}"` : ''}><div class="bz-sb-card-value${k === '索引健康' && !healthy ? ' bz-sb-card-value--warn' : ''}">${v}</div><div class="bz-sb-card-label">${k}</div></div>`
        )
        .join('');
    }

    const trend = document.getElementById('bz-sb-trend');
    if (trend) {
      const max = Math.max(...stats.trend12w, 1);
      trend.innerHTML = stats.trend12w
        .map((n) => `<div class="bz-sb-trend-col" style="height:${Math.max(4, Math.round((n / max) * 64))}px" aria-label="${n} 篇"></div>`)
        .join('');
    }

    // ---- 内容规模（ticket 108） ----
    const scale = document.getElementById('bz-sb-scale');
    if (scale) {
      scale.innerHTML = [
        ['总字数', stats.totalChars.toLocaleString()],
        ['平均块长', `${stats.avgChunkLen} 字`],
        ['平均每篇块数', String(stats.avgChunksPerNote)],
      ]
        .map(([k, v]) => `<div class="bz-sb-scale-item"><div class="bz-sb-scale-value">${v}</div><div class="bz-sb-scale-label">${k}</div></div>`)
        .join('');
    }

    // ---- 来源分布（树形逐级展开，ticket 108） ----
    const dist = document.getElementById('bz-sb-dist');
    if (dist) {
      const tree = buildSourceTree(this.store.meta);
      const rootMax = Math.max(1, ...tree.map((n) => n.chunks));
      const rows = dist.querySelectorAll('.bz-sb-dist-row-inner');
      dist.innerHTML = '';
      const renderNode = (node: SourceTreeNode, depth: number, container: HTMLElement) => {
        const hasChildren = node.children.length > 0;
        const open = this.expandedDirs.has(node.path);
        const row = document.createElement('div');
        row.className = 'bz-sb-dist-row';
        if (depth > 0) row.style.paddingLeft = `${10 + depth * 16}px`; // 树形缩进（功能性几何内联）
        row.innerHTML = `
          <span class="bz-sb-dist-caret ${hasChildren ? '' : 'bz-sb-dist-caret--leaf'}">${hasChildren ? (open ? '▾' : '▸') : ''}</span>
          <span class="bz-sb-dist-name">${escapeHtml(node.name)}</span>
          <span class="bz-sb-dist-bar"><span class="bz-sb-dist-fill" style="width:${Math.round((node.chunks / rootMax) * 100)}%"></span></span>
          <span class="bz-sb-dist-num">${node.notes} 篇 / ${node.chunks} 段</span>`;
        if (hasChildren) {
          row.onclick = () => {
            if (this.expandedDirs.has(node.path)) this.expandedDirs.delete(node.path);
            else this.expandedDirs.add(node.path);
            this.renderStats(); // 重渲树（其余统计不变，开销可接受）
          };
        }
        container.appendChild(row);
        if (open) {
          for (const child of node.children) renderNode(child, depth + 1, container);
        }
      };
      for (const root of tree) renderNode(root, 0, dist);
    }

    // ---- 最近向量化（相对日期，ticket 108） ----
    const recentEl = document.getElementById('bz-sb-recent');
    if (recentEl) {
      recentEl.innerHTML = '';
      if (stats.recent.length === 0) {
        recentEl.innerHTML = '<div class="bz-sb-empty">⚠️ 没有符合条件的文件</div>';
      }
      for (const r of stats.recent) {
        const row = document.createElement('div');
        row.className = 'bz-sb-recent-row';
        const name = document.createElement('span');
        name.className = 'bz-sb-recent-name';
        name.textContent = r.path.split('/').pop() || r.path;
        const time = document.createElement('span');
        time.className = 'bz-sb-recent-time';
        time.textContent = `${formatRelativeTime(r.mtime)} · ${r.chunks} 段`;
        time.title = new Date(r.mtime).toLocaleString();
        row.appendChild(name);
        row.appendChild(time);
        row.onclick = () => {
          const f = this.app.vault.getAbstractFileByPath(r.path);
          if (f) this.app.workspace.getLeaf(false).openFile(f as any);
        };
        recentEl.appendChild(row);
      }
    }

    // 概括缓存回显
    const cache = await readCache();
    if (cache) {
      const text = document.getElementById('bz-sb-summary-text');
      const meta = document.getElementById('bz-sb-summary-meta');
      if (text) text.textContent = cache.summary;
      if (meta) meta.textContent = `生成于 ${new Date(cache.generatedAt).toLocaleString()}`;
    }
  }

  private async generateSummary(btn: HTMLButtonElement): Promise<void> {
    const stats = computeStats(this.store.meta);
    if (stats.chunkCount === 0) {
      notice('第二大脑：向量库为空，先索引一些笔记吧');
      return;
    }
    btn.disabled = true;
    btn.textContent = '生成中…';
    try {
      const summary = await AI.ask(buildSummaryPrompt(stats));
      const cache: SummaryCache = { summary, generatedAt: Date.now() };
      await writeCache(cache);
      const text = document.getElementById('bz-sb-summary-text');
      const meta = document.getElementById('bz-sb-summary-meta');
      if (text) text.textContent = summary;
      if (meta) meta.textContent = `生成于 ${new Date(cache.generatedAt).toLocaleString()}`;
    } catch (e) {
      console.warn('[secondbrain] AI 概括失败', e);
      notice('第二大脑：AI 概括失败，请确认主设置页 AI 服务商配置可用');
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ 生成概括';
    }
  }

  /** ⚙️ 域设置弹窗（共享实现见 openSecondBrainSettings） */
  private openSettings(): void {
    openSecondBrainSettings(this.app);
  }
}

// ==================== ⚙️ 域设置弹窗（主面板 / 窄窗共用） ====================

/** 第二大脑域设置：基础/检索/对话/面板 三分组卡片（主面板 ⚙️ 入口；ticket 108 对话组收敛） */
export function openSecondBrainSettings(_app?: App): void {
  openSettingsModal({
    title: '第二大脑设置',
    maxWidth: 520,
    build: (content) => {
      const s = tryGetSettings() as any;
      const set = (k: string, v: unknown) => {
        s[k] = v;
        void saveSettings();
      };
      const group = (icon: string, name: string) => createSettingsGroup(content, { icon, name });
      // [f2-sb] 重载提示：以下开关均为启动快照配置（监听注册发生在域初始化），改动重载插件后生效；
      // 参照 encrypt warnReload 先例——一次弹窗会话内只提示一次
      let reloadWarned = false;
      const warnReload = () => {
        if (reloadWarned) return;
        reloadWarned = true;
        notice('第二大脑设置已保存，重载插件后生效', 'info');
      };

      const b1 = group('folder-open', '基础');
      new Setting(b1)
        .setName('Ollama URL（本地）')
        .addText((t) => t.setValue(String(s.secondBrainOllamaUrl ?? '')).onChange((v) => set('secondBrainOllamaUrl', v.trim())));
      let urlText: any = null;
      new Setting(b1)
        .setName('远程 Ollama URL（移动端）')
        .addText((t) => {
          urlText = t;
          t.setValue(String(s.secondBrainRemoteOllamaUrl ?? '')).onChange((v) => set('secondBrainRemoteOllamaUrl', v.trim()));
        });
      // ticket 122：本机局域网 IP 提示 + 一键填入（移动端连不上的自查路径；仅桌面端探测显示）
      if (!isMobileEnv()) {
        const lanIPs = getLanIPs();
        const primary = pickPrimaryLanIp(lanIPs);
        const ipDesc =
          lanIPs.length > 0
            ? `本机当前局域网 IP：${lanIPs.map((l) => `${l.ip}（${l.iface}）`).join('、')}。移动端连不上时，把上方远程 URL 填为此处 IP`
            : '未能探测本机局域网 IP（请确认电脑已联网），移动端远程 URL 需手动填写电脑的局域网 IP';
        new Setting(b1)
          .setName('本机局域网 IP（电脑）')
          .setDesc(ipDesc)
          .addButton((btn) =>
            btn.setButtonText('填入远程 URL').setCta().onClick(() => {
              if (!primary) {
                notice('未探测到本机局域网 IP，请手动填写');
                return;
              }
              const target = formatRemoteOllamaUrl(primary.ip);
              confirm({
                title: '填入远程 Ollama URL',
                message: `将「远程 Ollama URL（移动端）」覆盖为 ${target}？`,
                confirmText: '覆盖',
                onConfirm: () => {
                  set('secondBrainRemoteOllamaUrl', target);
                  urlText?.setValue(target); // 输入框即时回显新值
                },
              });
            })
          );
      } else {
        new Setting(b1)
          .setName('本机局域网 IP 提示')
          .setDesc('移动端连不上远程向量库时，请在电脑上打开第二大脑设置，查看「本机局域网 IP（电脑）」并核对上方远程 URL');
      }
      new Setting(b1)
        .setName('Embedding 模型')
        .addText((t) => t.setValue(String(s.secondBrainEmbeddingModel ?? '')).onChange((v) => set('secondBrainEmbeddingModel', v.trim())));
      const allowChipsWrap = document.createElement('div');
      allowChipsWrap.className = 'bz-sb-pick-chips--setting';
      const allowSetting = new Setting(b1)
        .setName('白名单目录')
        .setDesc('纳入第二大脑检索/候选来源的笔记目录；点「📁 选择」从库内文件夹勾选，也可直接改路径文本（英文逗号分隔）；留空 = 不索引')
        .addText((t) =>
          t.setValue(String(s.secondBrainAllowPaths ?? '')).onChange((v) => {
            set('secondBrainAllowPaths', v);
            renderAllowChips();
          })
        )
        .addButton((b) =>
          b.setButtonText('📁 选择').onClick(() =>
            openWhitelistPicker({
              selected: parsePathList((tryGetSettings() as any).secondBrainAllowPaths),
              onConfirm: (list) => {
                set('secondBrainAllowPaths', formatPathList(list));
                renderAllowChips();
              },
            })
          )
        );
      // chips 预览紧随设置行下方（显示当前已选目录，可 ✕ 移除）
      allowChipsWrap.style.marginTop = '4px';
      allowSetting.settingEl.insertAdjacentElement('afterend', allowChipsWrap);
      const renderAllowChips = () => {
        renderSelectedChips(
          allowChipsWrap,
          parsePathList((tryGetSettings() as any).secondBrainAllowPaths),
          (list) => {
            set('secondBrainAllowPaths', formatPathList(list));
            renderAllowChips();
          }
        );
      };
      renderAllowChips();
      new Setting(b1)
        .setName('启用')
        .setDesc('仅控制启动时自动加载，关闭后仍可从命令面板手动打开') // [l7A] 语义修正
        .addToggle((t) =>
          t.setValue(s.secondBrainEnabled === true).onChange((v) => {
            set('secondBrainEnabled', v);
            warnReload(); // [f2-sb] 启动快照配置：重载后生效
          })
        );

      // 自动双链（ticket 111）：总开关为明细设置的显隐开关——onChange 即时重渲染该区块，
      // 各键独立持久化，重开弹窗按当前状态还原；显隐属功能性显隐，无新 CSS
      const bLink = group('link', '自动双链');
      const linkDetailBox = document.createElement('div');
      const renderLinkDetail = () => {
        linkDetailBox.innerHTML = '';
        if ((tryGetSettings() as any).linkAgentEnabled === false) return;
        new Setting(linkDetailBox)
          .setName('单篇候选数量 TopK')
          .setDesc('每篇笔记的近邻候选数（候选来源 = 白名单索引库中的全部笔记）')
          .addText((t) =>
            t.setValue(String((tryGetSettings() as any).linkAgentTopK ?? 8)).onChange((v) => {
              const n = Math.floor(Number(v));
              set('linkAgentTopK', Number.isFinite(n) && n > 0 ? n : 8);
            })
          );
        new Setting(linkDetailBox)
          .setName('每篇关联上限')
          .setDesc('0 = 不限量，由 AI 裁判自行决定（沿用复习域「0=不限制」惯例）')
          .addText((t) =>
            t.setValue(String((tryGetSettings() as any).linkAgentMaxLinks ?? 0)).onChange((v) => {
              const n = Math.floor(Number(v));
              set('linkAgentMaxLinks', Number.isFinite(n) && n > 0 ? n : 0);
            })
          );
        new Setting(linkDetailBox)
          .setName('完成通知')
          .setDesc('处理完成后通知提醒；关闭则全程静默')
          .addToggle((t) => t.setValue((tryGetSettings() as any).linkAgentNotify !== false).onChange((v) => set('linkAgentNotify', v)));
        new Setting(linkDetailBox)
          .setName('失效关联自动清理')
          .setDesc('笔记删除后自动移除指向它的失效 related 条目')
          .addToggle((t) => t.setValue((tryGetSettings() as any).linkAgentAutoClean !== false).onChange((v) => set('linkAgentAutoClean', v)));
        new Setting(linkDetailBox)
          .setName('关联范围')
          .setDesc('决定哪些笔记会被自动关联（落盘监听与补链目标）；候选来源为白名单索引库全部笔记；留空 = 不自动关联')
          .addText((t) =>
            t.setValue(String((tryGetSettings() as any).linkAgentScopes ?? '')).onChange((v) => set('linkAgentScopes', v))
          )
          .addButton((b) =>
            b.setButtonText('📁 选择').onClick(() =>
              openWhitelistPicker({
                title: '选择关联范围目录',
                selected: parsePathList((tryGetSettings() as any).linkAgentScopes),
                onConfirm: (list) => set('linkAgentScopes', formatPathList(list)),
              })
            )
          );
      };
      new Setting(bLink)
        .setName('自动双链')
        .setDesc('关联范围内新笔记落盘时自动建立 related 双链：向量近邻出候选（白名单索引库）、AI 裁判、只写新笔记侧')
        .addToggle((t) =>
          t.setValue(s.linkAgentEnabled !== false).onChange((v) => {
            set('linkAgentEnabled', v);
            warnReload(); // [f2-sb] 监听注册在域启动时：重载后生效
            renderLinkDetail();
            refreshSettingsGroupCounts(content);
          })
        );
      bLink.appendChild(linkDetailBox);
      renderLinkDetail();

      const b2 = group('search', '检索');
      new Setting(b2).setName('参考结果数 TOP_K').addText((t) => t.setValue(String(s.secondBrainTopK ?? '')).onChange((v) => set('secondBrainTopK', v)));
      new Setting(b2).setName('AI 检索结果数 CHAT_TOP_K').addText((t) => t.setValue(String(s.secondBrainChatTopK ?? '')).onChange((v) => set('secondBrainChatTopK', v)));
      new Setting(b2).setName('段落最小长度').addText((t) => t.setValue(String(s.secondBrainChunkMinLength ?? '')).onChange((v) => set('secondBrainChunkMinLength', v)));
      new Setting(b2).setName('上下文限制').addText((t) => t.setValue(String(s.secondBrainContextLimit ?? '')).onChange((v) => set('secondBrainContextLimit', v)));
      new Setting(b2).setName('防抖延迟（ms）').addText((t) => t.setValue(String(s.secondBrainDebounceDelay ?? '')).onChange((v) => set('secondBrainDebounceDelay', v)));
      new Setting(b2).setName('光标轮询间隔（ms）').addText((t) => t.setValue(String(s.secondBrainCursorPollInterval ?? '')).onChange((v) => set('secondBrainCursorPollInterval', v)));
      new Setting(b2)
        .setName('嵌入并发')
        .setDesc('QA 遗留死配置：定义后从未接线，忠实保留不删')
        .addText((t) => t.setValue(String(s.secondBrainConcurrency ?? '')).onChange((v) => set('secondBrainConcurrency', v)));

      const b3 = group('message-square', '对话');
      new Setting(b3).setName('最大历史记录').addText((t) => t.setValue(String(s.secondBrainMaxHistory ?? '')).onChange((v) => set('secondBrainMaxHistory', v)));
      new Setting(b3)
        .setName('AI 通道')
        .setDesc('对话与概括统一走主设置页「🤖 AI」服务商；Embedding 仍走 Ollama。ticket 108 起此处不再单独配置模型')
        .addButton((b) => b.setButtonText('前往配置').onClick(() => {
          closeSettingsModal();
          (getApp() as any).setting?.open?.(); // 打开主设置页「🤖 AI」区块
        }));

      const b4 = group('layout-dashboard', '面板');
      const mobileRow = new Setting(b4)
        .setName('移动端默认全屏')
        .addToggle((t) => t.setValue(s.secondBrainMobileDefaultFullscreen === true).onChange((v) => set('secondBrainMobileDefaultFullscreen', v)));
      if (!isMobileEnv()) mobileRow.settingEl.classList.add('bz-setting-hidden');
      // ticket 108：概括缓存清除入口移除（缓存保留，面板可重新生成覆盖）；新增「重新索引」
      const rebuildRow = new Setting(b4)
        .setName('重新索引')
        .setDesc('清空现有向量索引并按当前白名单全部重嵌入；视库大小耗时数分钟，期间检索降级为文本匹配')
        .addButton((b) =>
          b.setButtonText('开始').onClick(() => {
            confirm({
              title: '重新索引',
              message: '将清空现有向量索引，按当前白名单全部重嵌入（约等于首次初始化全量跑一遍）。期间参考侧边栏与对话的向量检索会降级为文本匹配。确定继续吗？',
              confirmText: '开始重建',
              cancelText: '取消',
              onConfirm: () => {
                // 关设置弹窗 → 打开主面板 → 进入重建进度视图（ticket 108）
                closeSettingsModal();
                void import('./index').then((m) => m.rebuildSecondBrainIndex(getApp()));
              },
            });
          })
        );
      rebuildRow.settingEl.classList.add('bz-setting-action-row');
    },
  });
}
