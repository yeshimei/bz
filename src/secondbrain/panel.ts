/**
 * 第二大脑主面板（ticket 103 建；ticket 107 首用引导；ticket 108 打磨；ticket 109 统计卡精简）
 * 统一入口弹窗：统计卡片 / 内容规模明细 / 来源分布树形 / 近 12 周趋势 / 最近向量化。
 * - ticket 108 打磨项：
 *   ① 存储占用=meta+向量合计单值（hover 明细）；上次索引与最近向量化行用共享 formatRelativeTime；
 *   ② 来源分布改树形逐级展开（名称左对齐，▸/▾ 递归下钻子目录）；
 *   ③ ticket 108 曾新增白名单覆盖率/内容规模/最厚笔记 Top5/一致性健康四项，其中覆盖率卡与 Top5 区块已按 ticket 109 移除（语义重复/需求砍掉）；
 *   ④ 每次打开自动增量索引：有待处理变更 → 全屏进度视图接管，完成后再进统计；无变更直接统计；
 *   ⑤ 概括走统一 AI 通道（主设置页服务商）；缓存并入 secondbrain.json panel 段（ticket 120），设置页清除入口移除。
 *     （ticket 141：「AI 生成概括」入口与调用链整体移除——与「对话」区分，对话保留；
 *      panel 段数据结构冻结保留，旧缓存仅不再消费/回显）
 * - 引导/进度视图三用：首次初始化（空库，带按钮）/ 自动增量（待处理块，纯进度）/ 重新索引（设置页确认后）。
 * - ticket 114：初始向量化进行中关页重开 → 恢复实时进度视图（原缺陷：重开回引导态且按钮
 *   因 initializing 守卫静默失效，看起来「点击没有任何反应」）；重复点击不再吞掉，接回进度。
 * - ticket 141：ESC 迁 escManager 层级（原私挂 document keydown 废弃）——⚙️ 设置弹窗叠开时
 *   其层级后注册在上，ESC 先关设置再关面板。
 * - 样式全部收敛 src/secondbrain/styles.css（bz-sb-panel-* / bz-sb-onboard-* / bz-sb-dist-*）。
 */
import type { App } from 'obsidian';
import { Setting } from 'obsidian';
import { notice } from '../core/notice';
import { topifyZ } from '../core/z-order';
import { tryGetSettings, getSettings, saveSettings } from '../core/settings-provider';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { openSettingsModal, closeSettingsModal } from '../core/settings-modal';
import { mobileFullscreenRow } from '../core/settings-common';
import type { SettingsSchema } from '../core/settings-schema';
import { escapeHtml, formatRelativeTime } from '../core/utils';
import { openFlowDialog } from '../core/flow-dialog';
import { escManager } from '../core/esc-manager';
import { getApp } from '../core/app';
import { buildConfig, IS_MOBILE } from './config';
import type { VectorStore, SecondBrainMeta } from './vector-store';
import { parsePathList, formatPathList } from './whitelist';
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

// ==================== 概括缓存（已随 ticket 141 移除；panel 段数据结构冻结保留于 store-file） ====================

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
  /** ESC 层级句柄（ticket 141 迁移：原私挂 document keydown 废弃） */
  private escHandle: ReturnType<typeof escManager.register> | null = null;
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
    // [l2-sb] ESC 层级与 open/close 成对：open 注册、close 注销（幂等），反复开关不累积
    this.attachEscapeListener();
    topifyZ(this.mask!, this.popup!); // ADR-0067：显示即发号，谁后显示谁在上
    this.mask!.style.display = 'block';
    this.popup!.style.display = 'flex';
    applyMobileWindowFullscreen(this.popup, tryGetSettings().secondBrainMobileDefaultFullscreen === true);
    // 先等初始 load 完成再定形态（防启动竞态把已有索引误判为空库）
    await this.render();
  }

  close(): void {
    this.removeEscapeListener(); // [l2-sb] 面板关闭即注销 ESC 层级（与 open 成对）
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
  }

  /** [l2-sb] ESC 关闭走 escManager 层级（ticket 141 迁移）：open 注册、close 注销成对（幂等）——
   *  ⚙️ 设置弹窗叠开时其 'bz-settings-modal' 层后注册在上，ESC 先关设置、再 ESC 才关面板 */
  private attachEscapeListener(): void {
    if (this.escHandle) return;
    this.escHandle = escManager.register('bz-sb-panel', {
      isVisible: () => !!this.popup && this.popup.isConnected && this.popup.style.display === 'flex',
      close: () => this.close(),
    });
  }

  private removeEscapeListener(): void {
    this.escHandle?.unregister();
    this.escHandle = null;
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

    // 「AI 生成概括」区块已随 ticket 141 整体移除（panel 段数据结构冻结保留）

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
    // ESC 层级在 open()/close() 成对注册注销（[l2-sb]/ticket 141：escManager 统一管理，不私挂 document keydown）

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
  }

  /** ⚙️ 域设置弹窗（共享实现见 openSecondBrainSettings） */
  private openSettings(): void {
    openSecondBrainSettings(this.app);
  }
}

// ==================== ⚙️ 域设置弹窗（主面板 / 窄窗共用） ====================

/**
 * 第二大脑设置 schema（ticket 131；ADR-0064）：基础/自动双链/检索/对话/面板 五组卡片。
 * - ticket 100 文案修正：含符号标题（（本地）/（ms）/（电脑）/…）改写自然句，键名/行为/通知文案零变化；
 * - 省略 desc 的行保持省略（lint 只查有 name/desc 的行，不为过 lint 加文案）；
 * - 「本机局域网 IP」行为态（探测 IP 动态 desc + 「填入远程 URL」确认覆盖 + 输入框即时回显）
 *   走 custom 插槽保行为；「重新索引」确认已 flow 化（openFlowDialog）不动。
 * 置于模块顶层供文案 lint 直接引用。 */
export function secondBrainSettingsSchema(): SettingsSchema {
  // [f2-sb] 重载提示：以下开关均为启动快照配置（监听注册发生在域初始化），一次弹窗会话只提示一次（文案冻结）
  let reloadWarned = false;
  const warnReload = () => {
    if (reloadWarned) return;
    reloadWarned = true;
    notice('第二大脑设置已保存，重载插件后生效', 'info');
  };
  // 远程 Ollama URL 输入框引用（「填入远程 URL」按钮确认覆盖后即时回显）
  let remoteUrlText: { setValue(v: string): void } | null = null;
  /** text 行 trim 落盘（沿用原 onChange 口径：v.trim() 写内存，防抖落盘读内存值） */
  const trimStore = (key: string) => (v: string) => {
    (getSettings() as any)[key] = v.trim();
  };
  /** 缺省开语义（键缺失视为开，沿用原 !== false 口径） */
  const boolDefaultOn = (key: string) => ({
    get: () => (tryGetSettings() as any)[key] !== false,
    set: (v: boolean) => {
      (getSettings() as any)[key] = v;
    },
    save: () => saveSettings(),
  });
  /** 逗号分隔串 ↔ 多选路径数组（存储格式冻结——英文逗号分隔字符串） */
  const pathsOf = (key: string) => ({
    get: () => parsePathList(String((tryGetSettings() as any)[key] ?? '')),
    set: (v: string[]) => {
      (getSettings() as any)[key] = formatPathList(v);
    },
    save: () => saveSettings(),
  });
  return {
    groups: [
      {
        icon: 'folder-open',
        name: '基础',
        rows: [
          { type: 'text', name: 'Ollama 本地 URL', binding: { key: 'secondBrainOllamaUrl' }, onChange: trimStore('secondBrainOllamaUrl') },
          // 远程 Ollama URL（移动端）：custom 持输入框引用（「填入远程 URL」按钮覆盖后即时回显）
          {
            type: 'custom',
            render: (body) => {
              new Setting(body)
                .setName('远程 Ollama URL（移动端）')
                .addText((t) => {
                  remoteUrlText = t;
                  t.setValue(String((tryGetSettings() as any).secondBrainRemoteOllamaUrl ?? '')).onChange((v) =>
                    trimStore('secondBrainRemoteOllamaUrl')(v)
                  );
                });
            },
          },
          // ticket 122：本机局域网 IP（移动端连不上的自查路径；仅桌面端探测显示）
          {
            type: 'custom',
            render: (body) => {
              if (!isMobileEnv()) {
                const lanIPs = getLanIPs();
                const primary = pickPrimaryLanIp(lanIPs);
                const ipDesc =
                  lanIPs.length > 0
                    ? `本机当前局域网 IP：${lanIPs.map((l) => `${l.ip}（${l.iface}）`).join('、')}。移动端连不上时，把上方远程 URL 填为此处 IP`
                    : '未能探测本机局域网 IP（请确认电脑已联网），移动端远程 URL 需手动填写电脑的局域网 IP';
                new Setting(body)
                  .setName('本机局域网 IP（电脑）')
                  .setDesc(ipDesc)
                  .addButton((btn) =>
                    btn.setButtonText('填入远程 URL').setCta().onClick(() => {
                      if (!primary) {
                        notice('未探测到本机局域网 IP，请手动填写');
                        return;
                      }
                      const target = formatRemoteOllamaUrl(primary.ip);
                      void openFlowDialog({
                        title: '填入远程 Ollama URL',
                        message: `将「远程 Ollama URL（移动端）」覆盖为 ${target}？`,
                        actions: [
                          { label: '取消', value: 'cancel' },
                          { label: '覆盖', value: 'ok', cta: true },
                        ],
                      }).then((v) => {
                        if (v === 'ok') {
                          (getSettings() as any).secondBrainRemoteOllamaUrl = target;
                          void saveSettings();
                          remoteUrlText?.setValue(target); // 输入框即时回显新值
                        }
                      });
                    })
                  );
              } else {
                new Setting(body)
                  .setName('本机局域网 IP 提示')
                  .setDesc('移动端连不上远程向量库时，请在电脑上打开第二大脑设置，查看「本机局域网 IP（电脑）」并核对上方远程 URL');
              }
            },
          },
          { type: 'text', name: 'Embedding 模型', binding: { key: 'secondBrainEmbeddingModel' }, onChange: trimStore('secondBrainEmbeddingModel') },
          // 白名单目录（ticket 128 统一选择器：chips + 选择按钮；存储格式冻结——英文逗号分隔字符串）
          {
            type: 'path',
            mode: 'multi',
            name: '白名单目录',
            desc: '纳入第二大脑检索与候选来源的笔记目录，留空则不索引',
            binding: pathsOf('secondBrainAllowPaths'),
            pickerTitle: '选择白名单目录',
            pickerDesc: '白名单为目录前缀语义：勾选祖先目录即覆盖其下全部子目录',
            buttonText: '选择',
            emptyText: '暂未选择（留空 = 不索引任何目录）',
          },
          { type: 'toggle', name: '启用', desc: '仅控制启动时自动加载，关闭后仍可从命令面板手动打开', binding: { key: 'secondBrainEnabled' }, onChange: warnReload },
        ],
      },
      {
        icon: 'link',
        name: '自动双链',
        rows: [
          // 自动双链（ticket 111）：总开关为明细设置的显隐开关（visibleWhen 声明式联动 + 徽标自动刷新）
          { type: 'toggle', name: '自动双链', desc: '关联范围内新笔记落盘时自动建双链，候选近邻经 AI 裁判筛选', binding: boolDefaultOn('linkAgentEnabled'), onChange: warnReload },
          {
            type: 'text',
            name: '单篇候选数量 TopK',
            desc: '每篇笔记的近邻候选数，来源为白名单索引库的全部笔记',
            // number 键（linkAgentTopK）不走键直绑（收窄到 string），三函数绑定 + onChange 钳制复写
            binding: {
              get: () => String((getSettings() as any).linkAgentTopK ?? 8),
              set: (v: string) => {
                (getSettings() as any).linkAgentTopK = v;
              },
              save: () => saveSettings(),
            },
            visibleWhen: (s) => s.linkAgentEnabled !== false,
            isChild: true,
            onChange: (v) => {
              const n = Math.floor(Number(v));
              (getSettings() as any).linkAgentTopK = Number.isFinite(n) && n > 0 ? n : 8;
            },
          },
          {
            type: 'text',
            name: '每篇关联上限',
            desc: '0 表示不限量，由 AI 裁判自行决定，沿用复习域惯例',
            // number 键（linkAgentMaxLinks）同上
            binding: {
              get: () => String((getSettings() as any).linkAgentMaxLinks ?? 0),
              set: (v: string) => {
                (getSettings() as any).linkAgentMaxLinks = v;
              },
              save: () => saveSettings(),
            },
            visibleWhen: (s) => s.linkAgentEnabled !== false,
            isChild: true,
            onChange: (v) => {
              const n = Math.floor(Number(v));
              (getSettings() as any).linkAgentMaxLinks = Number.isFinite(n) && n > 0 ? n : 0;
            },
          },
          { type: 'toggle', name: '完成通知', desc: '处理完成后通知提醒，关闭则全程静默', binding: boolDefaultOn('linkAgentNotify'), visibleWhen: (s) => s.linkAgentEnabled !== false, isChild: true },
          { type: 'toggle', name: '失效关联自动清理', desc: '笔记删除后自动移除指向它的失效 related 条目', binding: boolDefaultOn('linkAgentAutoClean'), visibleWhen: (s) => s.linkAgentEnabled !== false, isChild: true },
          { type: 'toggle', name: '已有关联不再建链', desc: '笔记已有关联时自动跳过处理', binding: boolDefaultOn('linkAgentRespectRelated'), visibleWhen: (s) => s.linkAgentEnabled !== false, isChild: true },
          // 关联范围（ticket 128 统一选择器：chips + 选择按钮；格式冻结——英文逗号分隔字符串）
          {
            type: 'path',
            mode: 'multi',
            name: '关联范围',
            desc: '决定哪些笔记会被自动关联，并作为落盘监听与补链目标',
            binding: pathsOf('linkAgentScopes'),
            visibleWhen: (s) => s.linkAgentEnabled !== false,
            isChild: true,
            pickerTitle: '选择关联范围目录',
            buttonText: '选择', // ticket 170：去 emoji
            emptyText: '暂未选择（留空 = 不自动关联）',
          },
        ],
      },
      {
        icon: 'search',
        name: '检索',
        rows: [
          { type: 'text', name: '参考结果数 TopK', binding: { key: 'secondBrainTopK' }, onChange: trimStore('secondBrainTopK') },
          { type: 'text', name: '对话参考结果数', binding: { key: 'secondBrainChatTopK' }, onChange: trimStore('secondBrainChatTopK') },
          { type: 'text', name: '段落最小长度', binding: { key: 'secondBrainChunkMinLength' }, onChange: trimStore('secondBrainChunkMinLength') },
          { type: 'text', name: '上下文限制', binding: { key: 'secondBrainContextLimit' }, onChange: trimStore('secondBrainContextLimit') },
          { type: 'text', name: '防抖延迟毫秒', binding: { key: 'secondBrainDebounceDelay' }, onChange: trimStore('secondBrainDebounceDelay') },
          { type: 'text', name: '光标轮询毫秒', binding: { key: 'secondBrainCursorPollInterval' }, onChange: trimStore('secondBrainCursorPollInterval') },
          { type: 'text', name: '嵌入并发', desc: '该设置暂不生效，保留兼容', binding: { key: 'secondBrainConcurrency' }, onChange: trimStore('secondBrainConcurrency') },
        ],
      },
      {
        icon: 'message-square',
        name: '对话',
        rows: [
          { type: 'text', name: '最大历史记录', binding: { key: 'secondBrainMaxHistory' }, onChange: trimStore('secondBrainMaxHistory') },
          {
            type: 'button',
            name: 'AI 通道',
            // ticket 141：「AI 生成概括」移除后描述同步收敛（仅剩对话走主设置页 AI）
            desc: '对话统一走主设置页 AI 服务商，Embedding 仍走 Ollama',
            buttonText: '前往配置',
            onClick: () => {
              closeSettingsModal();
              (getApp() as any).setting?.open?.(); // 打开主设置页「🤖 AI」区块
            },
          },
        ],
      },
      {
        icon: 'layout-dashboard',
        name: '面板',
        rows: [
          // 移动端默认全屏（无描述——保持省略；仅移动端可见）
          mobileFullscreenRow('secondBrainMobileDefaultFullscreen', { desc: '' }),
          // 重新索引（ticket 108）：确认已 flow 化（openFlowDialog），此处仅保留按钮与文案
          {
            type: 'button',
            name: '重新索引',
            desc: '清空现有向量索引并按当前白名单重嵌入，期间检索降级为文本匹配',
            buttonText: '开始',
            onClick: () => {
              void openFlowDialog({
                title: '重新索引',
                message: '将清空现有向量索引，按当前白名单全部重嵌入（约等于首次初始化全量跑一遍）。期间参考侧边栏与对话的向量检索会降级为文本匹配。确定继续吗？',
                actions: [
                  { label: '取消', value: 'cancel' },
                  { label: '开始重建', value: 'ok', cta: true },
                ],
              }).then((v) => {
                if (v === 'ok') {
                  // 关设置弹窗 → 打开主面板 → 进入重建进度视图（ticket 108）
                  closeSettingsModal();
                  void import('./index').then((m) => m.rebuildSecondBrainIndex(getApp()));
                }
              });
            },
          },
        ],
      },
    ],
  };
}

/** 第二大脑域设置：基础/自动双链/检索/对话/面板 五组卡片（主面板 ⚙️ 入口；ticket 108 对话组收敛） */
export function openSecondBrainSettings(_app?: App): void {
  openSettingsModal({ title: '第二大脑设置', maxWidth: 520, schema: secondBrainSettingsSchema() });
}
