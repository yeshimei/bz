/**
 * 第二大脑主面板 · 行为层（issue 251 / ADR-0110）
 *
 * UI 按定稿原型（.zcode/ui-prototypes/secondbrain-final/，P1 布局 × P2 米白红棕主题）
 * 抛弃式重写：全部 markup 出自 render.ts 纯层（ADR-0104），本文件只留生命周期、
 * 形态分派、事件绑定与 core 服务接线。行为逻辑逐行保留：open 形态分派（重建意图/
 * 空库引导/进度恢复/待处理增量/统计态）、onboard 三形态、进度回调解析、自动增量
 * 刷新、来源树展开会话记忆、最近向量化点击打开。
 *
 * 落域适配（原型不出，ADR-0110 §4）：真身运维维度并入——统计带第六卡=存储占用、
 * 底部状态行=上次索引 · 索引一致性（向量行数 vs 块数） · 自动建链数；AI 库摘要卡
 * 读 secondbrain.json panel 段（生成入口已随 ticket 141 移除，有值渲染无值隐藏）。
 *
 * 设置 schema（secondBrainSettingsSchema/openSecondBrainSettings）逐字保留于本文件
 * 模块顶层：settings-panel 域动态 import 本路径（tests/settings-panel.test.ts /
 * copy-lint 同锚），文案与键零变化。统计纯函数收编 render.ts，此处 re-export 兼容旧引用。
 */
import type { App } from 'obsidian';
import { notice } from '../core/notice';
import { topifyZ } from '../core/z-order';
import { isMobileEnv } from '../core/mobile';
import { mountIcons } from '../core/ui';
import { openFlowDialog } from '../core/flow-dialog';
import { escManager } from '../core/esc-manager';
import { getApp } from '../core/app';
import { formatRelativeTime } from '../core/utils';
import { tryGetSettings, getSettings, saveSettings } from '../core/settings-provider';
import { openSettingsModal, closeSettingsModal } from '../core/settings-modal';
import type { SettingsSchema } from '../core/settings-schema';
import { buildConfig, IS_MOBILE } from './config';
import type { VectorStore } from './vector-store';
import { parsePathList, formatPathList } from './whitelist';
import { getLanIPs, formatRemoteOllamaUrl, pickPrimaryLanIp } from './local-ip';
import { loadStore } from './store-file';
import {
  panelShellHtml,
  panelCardsHtml,
  panelTrendHtml,
  panelDistHtml,
  panelRecentHtml,
  panelSummaryHtml,
  panelLogHtml,
  sbSourceColor,
  computeStats,
  buildSourceTree,
  fmtCompact,
} from './render';

export { computeStats, buildSourceTree, fmtCompact } from './render';
export type { SecondBrainStats, SourceDistItem, RecentNote, SourceTreeNode } from './render';

// ==================== 主面板弹窗 ====================

export interface PanelOptions {
  onOpenReference: () => void;
  onOpenChat: () => void;
}

/**
 * 「重新索引」确认框（flow 弹窗**单源**，2026-09-11）：三处共用同一段文案与动作 ——
 * ① 本面板底部「全量重建」钮 ② 设置页「重新索引」行 ③ 首页入口菜单
 * （bz-secondbrain-rebuild-index，用户要求右键也要先确认）。
 * 改文案/按钮只改这里，别再各处内联一份。
 */
export function confirmFullRebuild(): Promise<boolean> {
  return openFlowDialog({
    title: '重新索引',
    message: '将清空现有向量索引，按当前白名单全部重嵌入（约等于首次初始化全量跑一遍）。期间参考侧边栏与对话的向量检索会降级为文本匹配。确定继续吗？',
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '开始重建', value: 'ok', cta: true },
    ],
  }).then((v) => v === 'ok');
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
    for (const b of this.popup?.querySelectorAll('.bz-sb-panel-func') ?? []) b.classList.remove('bz-sb-btn-hidden');
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
      btn.textContent = '开始向量化';
    }
    if (box) box.style.display = 'none';
    if (onboard) onboard.style.display = 'flex';
    if (content) content.style.display = 'none';
    for (const b of this.popup?.querySelectorAll('.bz-sb-panel-func') ?? []) b.classList.add('bz-sb-btn-hidden');
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
    for (const b of this.popup?.querySelectorAll('.bz-sb-panel-func') ?? []) b.classList.add('bz-sb-btn-hidden');
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
    const status = document.getElementById('bz-sb-init-status');
    this.initializing = true;
    try {
      await this.store.rebuildAll(this.progressObserver());
      if (this.store.isIndexReady()) {
        this.showContent(true);
        await this.renderStats();
      } else {
        const box = document.getElementById('bz-sb-init-progress');
        if (box) box.style.display = 'flex';
        if (status) status.textContent = '重建未完成：请确认 Ollama 服务与 Embedding 模型可用后重试';
        this.revealInitBtn('重试重建');
      }
    } catch (e: any) {
      console.warn('[secondbrain] 全量重建失败', e);
      if (status?.isConnected) {
        status.textContent = '重建失败：' + (e?.message || e);
        this.revealInitBtn('重试重建');
      }
    } finally {
      this.initializing = false;
    }
  }

  /** 组装弹窗 DOM（markup 全部出自 render.ts；本方法只绑定事件） */
  private createUI(): void {
    if (this.mask && document.body.contains(this.mask)) return;

    const mask = document.createElement('div');
    mask.className = 'bz-sb-panel-mask';
    mask.onclick = () => this.close();

    const popup = document.createElement('div');
    popup.className = 'bz-sb-panel bz-panel-mtop'; // 移动端全屏 + 44px 顶部避让（issue 272；桌面不生效）
    popup.innerHTML = panelShellHtml();

    // 头行：AI 对话 / 灵感参考 / 关闭（图标钮；⚙️ 已摘——设置走设置面板；引导期 func 钮整体收起，ticket 107）
    // 「关闭」复位优先（clipbook 同款语义）：来源分布树有展开目录先全部收起并重绘，无展开才关面板
    popup.querySelector('#bz-sb-panel-close')?.addEventListener('click', () => {
      if (this.expandedDirs.size) {
        this.expandedDirs.clear();
        this.renderDist();
      } else {
        this.close();
      }
    });
    popup.querySelector('#bz-sb-open-chat')?.addEventListener('click', () => {
      this.close();
      this.opts.onOpenChat();
    });
    popup.querySelector('#bz-sb-open-ref')?.addEventListener('click', () => {
      this.close();
      this.opts.onOpenReference();
    });

    // 底部操作：手动增量 / 全量重建（flow 确认，同设置页「重新索引」语义）
    popup.querySelector('#bz-sb-incr')?.addEventListener('click', () => {
      if (this.refreshing || this.initializing) return;
      void this.runIncremental();
    });
    popup.querySelector('#bz-sb-rebuild')?.addEventListener('click', () => {
      void confirmFullRebuild().then((ok) => {
        if (ok) void this.runRebuild();
      });
    });

    // 引导态按钮
    const initBtn = popup.querySelector('#bz-sb-init-btn') as HTMLButtonElement | null;
    if (initBtn) initBtn.onclick = () => void this.startInitialIndex();

    // 来源树展开：父容器一次性委托（重渲 innerHTML 不丢监听）
    popup.querySelector('#bz-sb-dist')?.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest('.bz-sb-dist-row--dir') as HTMLElement | null;
      if (!row) return;
      const path = row.dataset.path;
      if (!path) return;
      if (this.expandedDirs.has(path)) this.expandedDirs.delete(path);
      else this.expandedDirs.add(path);
      this.renderDist();
    });

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
        this.revealInitBtn('重试初始化');
      } else if (sawWarning) {
        status.textContent = '白名单目录内没有可索引的 Markdown 笔记：请检查 ⚙️ 设置中的「白名单目录」';
        this.revealInitBtn('重试初始化');
      } else {
        status.textContent = '未发现可索引的笔记内容';
        this.revealInitBtn('重试初始化');
      }
    } catch (e: any) {
      console.warn('[secondbrain] 初始向量化失败', e);
      if (status.isConnected) {
        status.textContent = '初始化失败：' + (e?.message || e);
        this.revealInitBtn('重试初始化');
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

  /** 内容态统计渲染：markup 出 render.ts，本方法只算数与注入 */
  private async renderStats(): Promise<void> {
    const popup = this.popup;
    if (!popup || !popup.isConnected) return;
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

    // 索引健康：向量行数 vs 块总数（dim>0 才有行数概念）
    const vecRows = stats.dim && vecBytes > 0 ? this.store.vectors.length / stats.dim : 0;
    const healthy = vecRows === 0 || vecRows === stats.chunkCount;
    const fmtBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

    // 来源序（色板位次）——树/最近列表共用
    const order = new Map(stats.bySource.map((s, i) => [s.name, i]));
    const colorOf = (name: string) => sbSourceColor(name, order);

    // 头行：计数 + 健康 pill
    const cnt = popup.querySelector('#bz-sb-cnt');
    if (cnt) cnt.textContent = `${fmtCompact(stats.noteCount)} 篇 · ${fmtCompact(stats.chunkCount)} 段已入脑`;
    const pill = popup.querySelector('#bz-sb-pill-txt');
    if (pill) pill.textContent = healthy ? '索引健康' : `索引偏差 ${Math.abs(vecRows - stats.chunkCount)} 行`;
    popup.querySelector('.bz-sb-pill-dot')?.classList.toggle('bz-sb-pill-dot--warn', !healthy);

    // 统计带六卡（原型口径 + 真身存储卡；hover 精确值）
    const cards = popup.querySelector('#bz-sb-cards');
    if (cards) {
      cards.innerHTML = panelCardsHtml([
        { v: fmtCompact(stats.noteCount), k: '笔记', tip: `共 ${stats.noteCount.toLocaleString()} 篇笔记`, acc: true },
        { v: fmtCompact(stats.chunkCount), k: '段落', tip: `共 ${stats.chunkCount.toLocaleString()} 个向量块`, acc: true },
        { v: fmtCompact(stats.totalChars), k: '字符', tip: `共 ${stats.totalChars.toLocaleString()} 字` },
        { v: stats.dim > 0 ? `${stats.dim} 维` : '—', k: '向量维度', tip: `嵌入模型 ${CONFIG.EMBEDDING_MODEL} · 维度变更需重建索引` },
        { v: `${stats.avgChunkLen} 字`, k: '平均段长', tip: `平均每篇 ${stats.avgChunksPerNote} 段` },
        { v: vecBytes ? fmtBytes(metaBytes + vecBytes) : '—', k: '存储占用', tip: `meta ${fmtBytes(metaBytes)} + 向量 ${fmtBytes(vecBytes)}` },
      ]);
    }

    // 近 12 周趋势
    const trend = popup.querySelector('#bz-sb-trend');
    if (trend) {
      trend.innerHTML = panelTrendHtml(stats.trend12w);
      const sum = popup.querySelector('#bz-sb-trend-sum');
      if (sum) sum.textContent = stats.trend12w.reduce((a, b) => a + b, 0) + ' 篇';
    }

    // 来源分布树（展开集会话内记忆）
    this.renderDist();

    // 最近向量化（点击打开文件——真身行为保留）
    const recentEl = popup.querySelector('#bz-sb-recent');
    if (recentEl) {
      recentEl.innerHTML = panelRecentHtml(
        stats.recent.map((r) => ({
          path: r.path,
          name: r.path.split('/').pop() || r.path,
          chunks: r.chunks,
          when: formatRelativeTime(r.mtime),
          color: colorOf(topLevelName(r.path)),
        }))
      );
      const recentN = popup.querySelector('#bz-sb-recent-n');
      if (recentN) recentN.textContent = `最新 ${stats.recent.length} 条`;
    }

    // 底部状态行：上次索引 · 索引一致性 · 存储明细
    const log = popup.querySelector('#bz-sb-log');
    if (log) {
      log.innerHTML = panelLogHtml([
        { text: `上次索引 ${stats.lastIndexedAt ? formatRelativeTime(stats.lastIndexedAt) : '—'}` },
        { text: healthy ? '索引一致' : `向量 ${Math.round(vecRows)} 行 / 块 ${stats.chunkCount} 个`, warn: !healthy },
        { text: vecBytes ? `占用 ${fmtBytes(metaBytes + vecBytes)}` : '暂无向量文件' },
      ]);
    }

    mountIcons(popup);
    void this.loadSummaryAndLinks();
  }

  /** 来源树渲染（renderStats 与展开点击共用；展开集会话内记忆） */
  private renderDist(): void {
    const popup = this.popup;
    const dist = popup?.querySelector('#bz-sb-dist') as HTMLElement | null;
    if (!popup || !dist) return;
    const tree = buildSourceTree(this.store.meta);
    const order = new Map(computeStats(this.store.meta).bySource.map((s, i) => [s.name, i]));
    const colorOf = (name: string) => sbSourceColor(name, order);
    const rootMax = Math.max(1, ...tree.map((n) => n.chunks));
    dist.innerHTML = panelDistHtml(tree, this.expandedDirs, colorOf, rootMax);
    const distN = popup.querySelector('#bz-sb-dist-n');
    if (distN) distN.textContent = `${tree.length} 个来源`;
    mountIcons(dist);
  }

  /** AI 库摘要 + 自动建链数（secondbrain.json panel/link 段，异步回填；生成入口已移除，旧值仍可展示） */
  private async loadSummaryAndLinks(): Promise<void> {
    try {
      const store = await loadStore(this.app);
      const popup = this.popup;
      if (!popup || !popup.isConnected) return;
      const summary = store.panel?.summary || '';
      const aiCard = popup.querySelector('#bz-sb-ai-card') as HTMLElement | null;
      const aiTxt = popup.querySelector('#bz-sb-ai-txt');
      if (aiCard) aiCard.style.display = summary ? '' : 'none';
      if (aiTxt && summary) {
        aiTxt.innerHTML = panelSummaryHtml(summary, store.panel?.generatedAt ? formatRelativeTime(store.panel.generatedAt) : '');
      }
      const linkedTotal = Object.keys(store.link?.state || {}).length;
      const log = popup.querySelector('#bz-sb-log');
      if (log && linkedTotal) {
        log.insertAdjacentHTML(
          'beforeend',
          `<span class="bz-sb-log-sep">·</span>${panelLogHtml([{ text: `自动建链 ${linkedTotal} 条` }])}`
        );
      }
    } catch {
      /* 读库失败不阻断统计展示 */
    }
  }
}

/** 最近向量化行的来源名（顶层目录，色板键） */
function topLevelName(path: string): string {
  const i = path.indexOf('/');
  return i === -1 ? '（根目录）' : path.slice(0, i);
}

// ==================== ⚙️ 域设置弹窗（主面板 / 窄窗共用） ====================

/**
 * 第二大脑设置 schema（ticket 131；ADR-0064）：基础/自动双链/检索/对话/面板 五组卡片。
 * - ticket 100 文案修正：含符号标题（（本地）/（ms）/（电脑）/…）改写自然句，键名/行为/通知文案零变化；
 * - 省略 desc 的行保持省略（lint 只查有 name/desc 的行，不为过 lint 加文案）；
 * - 「本机局域网 IP」行为态（探测 IP 动态 desc + 「填入远程 URL」确认覆盖 + 输入框即时回显）
 *   走 custom 插槽保行为；「重新索引」确认已 flow 化（openFlowDialog）不动。
 * 置于模块顶层供文案 lint 直接引用。 */

/** 本机局域网 IP 描述（schema 构建期探测；「填入远程 URL」动作实时重探）。
 *  含 IP/接口符号，copy-lint-c 白名单豁免——IP 列表是本行的信息本体（ticket 122 自查路径）。 */
function lanIpDesc(): string {
  if (isMobileEnv()) return ''; // 移动端整行隐藏（visibleWhen），不做 os 探测
  const lanIPs = getLanIPs();
  if (lanIPs.length === 0) {
    return '未能探测本机局域网 IP，请确认电脑已联网，移动端远程地址需手动填写电脑的局域网 IP';
  }
  const primary = pickPrimaryLanIp(lanIPs);
  return `本机当前局域网 IP 为 ${lanIPs.map((l) => `${l.ip}，${l.iface}`).join('；')}。移动端连不上时，把远程地址填为${primary ? ` ${formatRemoteOllamaUrl(primary.ip)}` : '此处 IP'}`;
}

export function secondBrainSettingsSchema(): SettingsSchema {
  // [f2-sb] 重载提示：以下开关均为启动快照配置（监听注册发生在域初始化），一次弹窗会话只提示一次（文案冻结）
  let reloadWarned = false;
  const warnReload = () => {
    if (reloadWarned) return;
    reloadWarned = true;
    notice('第二大脑设置已保存，重载插件后生效', 'info');
  };
  // 远程 Ollama URL 输入框引用（「填入远程 URL」按钮确认覆盖后即时回显）
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
        // 外观组（issue 246 占位单卡）：布局/主题各一档，域 UI 消费待皮肤设计时接入
        icon: 'palette',
        name: '外观',
        rows: [
          { type: 'choiceCards', name: '面板布局', binding: { key: 'secondbrainSkin' }, options: [{ value: 'default', label: '对话', prevClass: 'bz-sp-prev-panel' }] },
          { type: 'choiceCards', name: '面板主题', binding: { key: 'secondbrainSkinTheme' }, layoutKey: 'secondbrainSkin', options: [{ value: 'graphite', label: '石墨', layout: 'default', prevClass: 'bz-sp-prev-graphite' }] },
        ],
      },
      {
        icon: 'folder-open',
        name: '基础',
        rows: [
          { type: 'text', name: 'Ollama 本地 URL', binding: { key: 'secondBrainOllamaUrl' }, onChange: trimStore('secondBrainOllamaUrl') },
          // 远程 Ollama URL（移动端）：声明 text 行 + 行内「填入远程 URL」按钮（actions 统一实现，
          // 动作完成后渲染器重读绑定回填显示——custom 输入框引用持快手已退役）
          {
            type: 'text',
            name: '移动端远程地址',
            desc: '手机上连本地向量库走这个地址',
            binding: { key: 'secondBrainRemoteOllamaUrl' },
            onChange: (v) => trimStore('secondBrainRemoteOllamaUrl')(v),
            actions: [{
              text: '填入远程 URL',
              cta: true,
              onClick: () => {
                const lanIPs = getLanIPs();
                const primary = pickPrimaryLanIp(lanIPs);
                if (!primary) {
                  notice('未探测到本机局域网 IP，请手动填写');
                  return;
                }
                const target = formatRemoteOllamaUrl(primary.ip);
                // 返回 Promise：渲染器等确认框 resolve 后再回填输入框显示值
                return openFlowDialog({
                  title: '填入远程 Ollama URL',
                  message: `将「移动端远程地址」覆盖为 ${target}？`,
                  actions: [
                    { label: '取消', value: 'cancel' },
                    { label: '覆盖', value: 'ok', cta: true },
                  ],
                }).then((v) => {
                  if (v === 'ok') {
                    (getSettings() as any).secondBrainRemoteOllamaUrl = target;
                    void saveSettings();
                  }
                });
              },
            }],
          },
          // 本机局域网 IP（展示行，actions 已并上侧「填入远程 URL」按钮；custom 双分支已退役）
          {
            type: 'info',
            name: '本机局域网 IP',
            visibleWhen: () => !isMobileEnv(),
            desc: lanIpDesc(),
          },
          {
            type: 'info',
            name: '局域网 IP 提示',
            visibleWhen: () => isMobileEnv(),
            desc: '连不上远程库时，在电脑上查看本机 IP 并核对上方地址',
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
          // 重新索引（ticket 108）：确认已 flow 化（openFlowDialog），此处仅保留按钮与文案
          {
            type: 'button',
            name: '重新索引',
            desc: '清空现有向量索引并按当前白名单重嵌入，期间检索降级为文本匹配',
            buttonText: '开始',
            onClick: () => {
              // 确认框走 confirmFullRebuild 单源；确认后关设置弹窗 → 打开主面板进重建视图
              // （requestRebuildAndOpen 不再二次确认 —— 确认在这里已经做过）
              void confirmFullRebuild().then((ok) => {
                if (ok) {
                  closeSettingsModal();
                  void import('./index').then((m) => m.requestRebuildAndOpen(getApp()));
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
