/**
 * 第二大脑主面板（ticket 103 新功能）
 * 统一入口弹窗：统计卡片 / 来源分布 / 近 12 周趋势 / 最近向量化 Top10 / AI 一键概括。
 * - 每次打开自动触发一次增量 refresh（后台 modify 5s 防抖静默刷新由域入口另行挂载）；
 * - 头部按钮秩序：功能（📚 侧边栏 · 💬 对话）→ ⚙️ → 关闭；✕ 仅移动端全屏形态渲染，桌面靠 mask+ESC；
 * - 样式全部收敛根 styles.css（bz-sb-panel-*），此处零视觉内联（仅显隐/动态计算）；
 * - 概括缓存 STORAGE/secondbrain_panel.json（含生成时间，可重新生成/清除）。
 */
import type { App } from 'obsidian';
import { Setting } from 'obsidian';
import { notice } from '../core/notice';
import { tryGetSettings, saveSettings } from '../core/settings-provider';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { openSettingsModal, createSettingsGroup } from '../core/settings-modal';
import { buildConfig } from './config';
import { AI } from './ai';
import type { VectorStore, SecondBrainMeta } from './vector-store';

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
}

function topLevelDir(path: string): string {
  const i = path.indexOf('/');
  return i === -1 ? '（根目录）' : path.slice(0, i);
}

/** 由 meta.notes 聚合全部统计（本地计算，秒开） */
export function computeStats(meta: SecondBrainMeta, now = Date.now()): Omit<SecondBrainStats, 'metaBytes' | 'vecBytes'> {
  const bySource = new Map<string, SourceDistItem>();
  let chunkCount = 0;
  const recent: RecentNote[] = [];
  // 12 周桶：桶 0=最早，桶 11=本周
  const weekMs = 7 * 24 * 3600 * 1000;
  const thisWeekStart = Math.floor(now / weekMs) * weekMs;
  const trend12w = new Array<number>(12).fill(0);

  for (const [path, entry] of Object.entries(meta.notes)) {
    const chunks = entry.chunks.length;
    chunkCount += chunks;
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
  return {
    chunkCount,
    noteCount: Object.keys(meta.notes).length,
    dim: meta._dim || 0,
    lastIndexedAt: recent[0]?.mtime ?? null,
    bySource: bySourceArr,
    recent: recent.slice(0, 10),
    trend12w,
  };
}

// ==================== 概括缓存（secondbrain_panel.json） ====================

interface SummaryCache {
  summary: string;
  generatedAt: number;
}

const PANEL_CACHE_FILE = () => `${buildConfig().META_PATH.replace(/secondbrain_meta\.json$/, '')}secondbrain_panel.json`;

async function readCache(app: App): Promise<SummaryCache | null> {
  try {
    return JSON.parse(await app.vault.adapter.read(PANEL_CACHE_FILE()));
  } catch {
    return null;
  }
}

async function writeCache(app: App, cache: SummaryCache): Promise<void> {
  await app.vault.adapter.write(PANEL_CACHE_FILE(), JSON.stringify(cache));
}

/** 清除 AI 概括缓存（⚙️ 域设置弹窗动作行调用） */
export async function clearSummaryCache(app?: App): Promise<boolean> {
  try {
    await (app as any).vault.adapter.remove(PANEL_CACHE_FILE());
    notice('第二大脑：AI 概括缓存已清除');
    return true;
  } catch {
    notice('第二大脑：无概括缓存可清除');
    return false;
  }
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

  constructor(app: App, store: VectorStore, opts: PanelOptions) {
    this.app = app;
    this.store = store;
    this.opts = opts;
  }

  async open(): Promise<void> {
    this.createUI();
    this.mask!.style.display = 'block';
    this.popup!.style.display = 'flex';
    applyMobileWindowFullscreen(this.popup, tryGetSettings().secondBrainMobileDefaultFullscreen === true);
    // 打开即自动增量刷新（每次打开触发一次）
    void this.autoRefresh();
    await this.renderStats();
  }

  close(): void {
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
  }

  destroy(): void {
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }
    this.mask?.remove();
    this.popup?.remove();
    this.mask = null;
    this.popup = null;
  }

  private createUI(): void {
    if (this.mask && document.body.contains(this.mask)) return;
    const mask = document.createElement('div');
    mask.className = 'bz-sb-panel-mask';
    mask.onclick = () => this.close();

    const popup = document.createElement('div');
    popup.className = 'bz-sb-panel';
    popup.classList.add('bz-win-mfs-host');

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
    mkBtn('bz-sb-panel-func', '📚', '打开侧边栏', () => {
      this.close();
      this.opts.onOpenReference();
    });
    mkBtn('bz-sb-panel-func', '💬', '打开对话', () => {
      this.close();
      this.opts.onOpenChat();
    });
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

    const cards = document.createElement('div');
    cards.className = 'bz-sb-cards';
    cards.id = 'bz-sb-cards';
    body.appendChild(cards);

    const trendBox = document.createElement('div');
    trendBox.className = 'bz-sb-section';
    trendBox.innerHTML = `<div class="bz-sb-section-title">近 12 周向量化趋势</div><div id="bz-sb-trend" class="bz-sb-trend"></div>`;
    body.appendChild(trendBox);

    const distBox = document.createElement('div');
    distBox.className = 'bz-sb-section';
    distBox.innerHTML = `<div class="bz-sb-section-title">来源分布</div><div id="bz-sb-dist" class="bz-sb-dist"></div>`;
    body.appendChild(distBox);

    const recentBox = document.createElement('div');
    recentBox.className = 'bz-sb-section';
    recentBox.innerHTML = `<div class="bz-sb-section-title">最近向量化</div><div id="bz-sb-recent" class="bz-sb-recent"></div>`;
    body.appendChild(recentBox);

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
    body.appendChild(summaryBox);

    popup.appendChild(body);
    document.body.appendChild(mask);
    document.body.appendChild(popup);

    // ESC 关闭（桌面）；记录 handler 以便销毁
    this.escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this.escapeHandler);

    this.mask = mask;
    this.popup = popup;
  }

  /** 打开时自动增量刷新（并发去重；进度走 toast） */
  private async autoRefresh(): Promise<void> {
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
  }

  private async renderStats(): Promise<void> {
    const CONFIG = buildConfig();
    let metaBytes = 0;
    let vecBytes = 0;
    try {
      metaBytes = (await this.app.vault.adapter.stat(CONFIG.META_PATH))?.size ?? 0;
    } catch {}
    try {
      vecBytes = (await this.app.vault.adapter.stat(CONFIG.VEC_PATH))?.size ?? 0;
    } catch {}
    const stats = { ...computeStats(this.store.meta), metaBytes, vecBytes };

    const cards = document.getElementById('bz-sb-cards');
    if (cards) {
      const fmtBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
      const items: [string, string][] = [
        ['向量块', String(stats.chunkCount)],
        ['覆盖笔记', String(stats.noteCount)],
        ['维度', stats.dim ? String(stats.dim) : '—'],
        ['存储占用', stats.vecBytes ? `${fmtBytes(metaBytes)} + ${fmtBytes(vecBytes)}` : '—'],
        ['上次索引', stats.lastIndexedAt ? new Date(stats.lastIndexedAt).toLocaleString() : '—'],
      ];
      cards.innerHTML = items
        .map(([k, v]) => `<div class="bz-sb-card"><div class="bz-sb-card-value">${v}</div><div class="bz-sb-card-label">${k}</div></div>`)
        .join('');
    }

    const trend = document.getElementById('bz-sb-trend');
    if (trend) {
      const max = Math.max(...stats.trend12w, 1);
      trend.innerHTML = stats.trend12w
        .map((n) => `<div class="bz-sb-trend-col" style="height:${Math.max(4, Math.round((n / max) * 64))}px" aria-label="${n} 篇"></div>`)
        .join('');
    }

    const dist = document.getElementById('bz-sb-dist');
    if (dist) {
      const maxChunks = Math.max(1, ...stats.bySource.map((s) => s.chunks));
      dist.innerHTML = stats.bySource
        .map(
          (s) =>
            `<div class="bz-sb-dist-row"><span class="bz-sb-dist-name">${s.name}</span>` +
            `<span class="bz-sb-dist-bar"><span class="bz-sb-dist-fill" style="width:${Math.round((s.chunks / maxChunks) * 100)}%"></span></span>` +
            `<span class="bz-sb-dist-num">${s.notes} 篇 / ${s.chunks} 段</span></div>`
        )
        .join('');
    }

    const recentEl = document.getElementById('bz-sb-recent');
    if (recentEl) {
      recentEl.innerHTML =
        stats.recent.length === 0
          ? '<div class="bz-sb-empty">⚠️ 没有符合条件的文件</div>'
          : '';
      for (const r of stats.recent) {
        const row = document.createElement('div');
        row.className = 'bz-sb-recent-row';
        const name = document.createElement('span');
        name.className = 'bz-sb-recent-name';
        name.textContent = r.path.split('/').pop() || r.path;
        const time = document.createElement('span');
        time.className = 'bz-sb-recent-time';
        time.textContent = `${new Date(r.mtime).toLocaleDateString()} · ${r.chunks} 段`;
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
    const cache = await readCache(this.app);
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
      const summary = await AI.ask(buildSummaryPrompt(stats), false);
      const cache: SummaryCache = { summary, generatedAt: Date.now() };
      await writeCache(this.app, cache);
      const text = document.getElementById('bz-sb-summary-text');
      const meta = document.getElementById('bz-sb-summary-meta');
      if (text) text.textContent = summary;
      if (meta) meta.textContent = `生成于 ${new Date(cache.generatedAt).toLocaleString()}`;
    } catch (e) {
      console.warn('[secondbrain] AI 概括失败', e);
      notice('第二大脑：AI 概括失败，请确认 Ollama 可用');
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

/** 第二大脑域设置：基础/检索/对话/面板 四分组卡片（窄窗 ⚙️ 与主面板 ⚙️ 共用此入口） */
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

      const b1 = group('folder-open', '基础');
      new Setting(b1)
        .setName('Ollama URL（本地）')
        .addText((t) => t.setValue(String(s.secondBrainOllamaUrl ?? '')).onChange((v) => set('secondBrainOllamaUrl', v.trim())));
      new Setting(b1)
        .setName('远程 Ollama URL（移动端）')
        .addText((t) => t.setValue(String(s.secondBrainRemoteOllamaUrl ?? '')).onChange((v) => set('secondBrainRemoteOllamaUrl', v.trim())));
      new Setting(b1)
        .setName('Embedding 模型')
        .addText((t) => t.setValue(String(s.secondBrainEmbeddingModel ?? '')).onChange((v) => set('secondBrainEmbeddingModel', v.trim())));
      new Setting(b1)
        .setName('白名单目录（逗号分隔）')
        .addText((t) => t.setValue(String(s.secondBrainAllowPaths ?? '')).onChange((v) => set('secondBrainAllowPaths', v)));
      new Setting(b1)
        .setName('启用')
        .setDesc('常驻监听光标移动与笔记变更，触发向量检索和 AI 对话')
        .addToggle((t) => t.setValue(s.secondBrainEnabled === true).onChange((v) => set('secondBrainEnabled', v)));

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
      new Setting(b3).setName('Ollama 对话模型').addText((t) => t.setValue(String(s.secondBrainChatModel ?? '')).onChange((v) => set('secondBrainChatModel', v.trim())));
      new Setting(b3).setName('DeepSeek 模型').addText((t) => t.setValue(String(s.secondBrainDeepseekModel ?? '')).onChange((v) => set('secondBrainDeepseekModel', v.trim())));
      new Setting(b3)
        .setName('默认使用 DeepSeek')
        .addDropdown((d) =>
          d
            .addOptions({ true: 'true', false: 'false' })
            .setValue(String(s.secondBrainDefaultUseDeepseek ?? 'false'))
            .onChange((v) => set('secondBrainDefaultUseDeepseek', v))
        );
      new Setting(b3).setName('最大历史记录').addText((t) => t.setValue(String(s.secondBrainMaxHistory ?? '')).onChange((v) => set('secondBrainMaxHistory', v)));

      const b4 = group('layout-dashboard', '面板');
      const mobileRow = new Setting(b4)
        .setName('移动端默认全屏')
        .addToggle((t) => t.setValue(s.secondBrainMobileDefaultFullscreen === true).onChange((v) => set('secondBrainMobileDefaultFullscreen', v)));
      if (!isMobileEnv()) mobileRow.settingEl.classList.add('bz-setting-hidden');
      const clearRow = new Setting(b4)
        .setName('AI 概括缓存')
        .addButton((b) => b.setButtonText('清除').onClick(() => void clearSummaryCache()));
      clearRow.settingEl.classList.add('bz-setting-action-row');
    },
  });
}
