/**
 * 文献盒（literature 域）UI（ticket 136 改版，ADR-0072）
 *
 * 三窗口 + 两弹窗：
 * - 主面板（showMain，文献笔记列表）：扫描 settings.literatureDirectory（缺省「文献盒」）下 .md，
 *   经 metadataCache 读 frontmatter（title/type/domain/summary/date…），固定最近创建降序；
 *   领域筛选行（剪藏本 rebuildSiteBar 同款，按 count 降序）+ 类型过滤（全部/视频/术语，可叠加）、
 *   🔍 搜索（标题/简介，300ms 防抖）、scroll 触底懒加载（50px 阈值，批次 20，尾部「已显示所有笔记」）、
 *   literature:file-* 四通道 300ms 防抖增量刷新（照抄剪藏本 attachFileListener/scheduleRefreshFlush）、
 *   文献目录设置变更时清缓存全量重载；卡片 = 标题 + 类型徽标 + 领域徽标 + 简介两行省略 + 日期，
 *   双击打开笔记（click 计数 300ms，影视先例）、attachItemActions 抽屉（打开/复制双链/
 *   复制原文链接[仅视频有 url]/删除 danger+flow-dialog 确认——删除视频笔记时同步清理
 *   literature.json 指向该笔记的任务记录）；打开主面板时调 backfillNotes() 补全旧笔记。
 * - 视频录入面板（showVideoEntry，任务队列）：原 bili-tasks 面板整体搬入，去掉 ⚙️ 设置 /
 *   ⬇️ 下载按钮；保留 ➕ 添加 / ▶️ 处理 / ⏹ 中止 / 🕘 历史 / ✕；移动端仅 ➕ 添加 / 🕘 历史 + ✕。
 *   批处理调 BatchRunner.runAll（work = 非 archived 且 pending/failed），事件回调驱动行内进度/
 *   步骤时间线/完成态文案（STEP_DONE_MAP 覆盖「AI 生成文献笔记中」「笔记落盘中」）+ 整批通知。
 * - 术语生成面板（showTermEntry，文字录入）：遮罩 + 弹窗，术语输入（预填/可改）→ 「生成」调
 *   generateTermNote({term}) 得 AI 简介 → 预览（术语/领域可改、简介正文可编辑 textarea）→
 *   「重新生成」= 按当前术语重跑丢弃预览手改；「确认写入」= 再次调 generateTermNote 按面板
 *   当前术语落盘 + 按面板当前值覆盖 domain/正文（vault.modify）→ 自动打开新笔记 →
 *   emitDomainEvent('literature:tasks', { kind:'term-generated', term, title }) → 关闭面板。
 *   预览/重新生成产生的草稿笔记在「重新生成替换 / 确认写入 / 关闭面板」时删除——未确认不落盘。
 * - 设置面板：主面板 ⚙️ → openSettingsModal（五组声明式 schema，见 literatureSettingsSchema）。
 *
 * 移动端默认全屏（ticket 68 三件事）：主面板 + 历史弹窗两处 applyMobileWindowFullscreen。
 */
import type { App } from 'obsidian';
import type { SettingsSchema } from '../core/settings-schema';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { openSettingsModal } from '../core/settings-modal';
import { mobileFullscreenGroup } from '../core/settings-common';
import { attachItemActions, type ItemAction } from '../core/item-actions';
import { openFlowDialog } from '../core/flow-dialog';
import { notice } from '../core/notice';
import { topifyZ } from '../core/z-order';
import { emitDomainEvent, onDomainEvent } from '../core/domain-bus';
import { getApp } from '../core/app';
import type BzSettings from '../settings';
import { LiteratureData, normalizeLooseTime } from './data';
import type { LiteratureTask } from './types';
import { BatchRunner, type BatchEvents } from './processor';
import { backfillNotes, generateTermNote } from './note-gen';

interface StatusMeta { label: string; cls: string; }
const STATUS_META: Record<LiteratureTask['status'], StatusMeta> = {
  pending: { label: '待处理', cls: 'bz-bili-pending' },
  processing: { label: '处理中', cls: 'bz-bili-processing' },
  success: { label: '成功', cls: 'bz-bili-success' },
  failed: { label: '失败', cls: 'bz-bili-failed' },
};

function q<T extends HTMLElement>(root: HTMLElement, sel: string): T | null {
  return root.querySelector(sel) as T | null;
}

/** HTML 转义（进度文案来自外部进程 stdout，统一转义防注入） */
function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** 运行中行内进度态（内存瞬态，不落库；刷新面板重读 storage 时由步骤文案兜底） */
interface RowRunState {
  steps: string[];
  phase: string | null;
  pct: number | null;
  startAt: number;
}

/** 步骤完成态文案映射（工具步骤名 → 「已…」；插件侧 AI 两步亦在此，ADR-0071） */
const STEP_DONE_MAP: Record<string, string> = {
  'AI 生成文献笔记中': '已生成文献笔记',
  '笔记落盘中': '已落盘笔记',
};
function stepDoneLabel(step: string): string {
  const mapped = STEP_DONE_MAP[step];
  if (mapped) return mapped;
  return step.endsWith('中') ? `已${step.slice(0, -1)}` : `已${step}`;
}

/** 未解析任务的行内短链接：优先提取 BV 号 / b23.tv 短码，其余截断（完整链接见悬浮 title，ADR-0070） */
function shortUrlText(url: string): string {
  const m = url.match(/BV[0-9A-Za-z]{8,12}/i) || url.match(/b23\.tv\/([0-9A-Za-z]+)/i);
  if (m) return m[0];
  return url.length > 28 ? url.slice(0, 28) + '…' : url;
}

const fmtElapsed = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
};

/** 文献目录（设置缺省「文献盒」，去首尾斜杠） */
function litDirOf(s: Partial<BzSettings> | undefined): string {
  const raw = s && (s as any).literatureDirectory ? String((s as any).literatureDirectory) : '文献盒';
  return raw.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

/** 解析 frontmatter date → 时间戳（宽松：'2026-08-30 10:00:00' / ISO）；失败返回 NaN 由调用方兜底 */
function parseDateRaw(raw: string | undefined | null): number {
  const s = String(raw ?? '').trim();
  if (!s) return NaN;
  const d1 = new Date(s.replace(' ', 'T'));
  if (!isNaN(d1.valueOf())) return d1.valueOf();
  const d2 = new Date(s);
  return d2.valueOf();
}

/** 轻量提取 frontmatter 键值（原样字符串；术语预览用；不剥引号——展示时自剥） */
function extractFrontmatter(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  const m = String(content || '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z\u4e00-\u9fa5_]+):\s*(.*)$/);
    if (kv) out[kv[1].trim()] = String(kv[2] ?? '').trim();
  }
  return out;
}

/** 覆盖 frontmatter 的 domain 键（保持 note-gen 引号包裹风格；缺键则追加） */
function overrideDomain(content: string, domain: string): string {
  const escV = String(domain).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const val = `"${escV}"`;
  const m = String(content || '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return content;
  let found = false;
  const next = m[1].split(/\r?\n/).map((line) => {
    if (/^domain\s*:/.test(line)) { found = true; return `domain: ${val}`; }
    return line;
  });
  if (!found) next.push(`domain: ${val}`);
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---/, '---\n' + next.join('\n') + '\n---');
}

/** 替换正文（frontmatter 之后的全部内容） */
function overrideBody(content: string, body: string): string {
  const m = String(content || '').match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (!m) return content;
  return m[0] + (body || '');
}

/** 主面板文献笔记条目（parseNoteFile 产物；数据源 = 文献目录文件夹实况，不依赖 literature.json） */
interface LiteratureNoteEntry {
  file: any;
  path: string;
  title: string;
  /** frontmatter type：'video' / 'term' / ''（旧笔记未补全） */
  type: string;
  domain: string;
  summary: string;
  /** 视频原文链接（frontmatter url；仅视频笔记有） */
  url: string;
  /** frontmatter date 原文（卡片展示） */
  date: string;
  /** 排序键：frontmatter date → 文件 ctime 兜底 */
  created: number;
}

/**
 * 文献盒设置 schema（ticket 136 §7，声明式五组，参考 diarySettingsSchema）：
 * 「目录与分类」folder-open / 「视频处理」settings-2 / 「工具」wrench /
 * mobileFullscreenGroup（移动端仅显示）/ 「维护」wrench（清空历史 button 行 + 确认弹窗由调用方接）。
 */
export function literatureSettingsSchema(opts?: { onClearHistory?: () => void | Promise<void> }): SettingsSchema {
  return {
    groups: [
      {
        icon: 'folder-open', name: '目录与分类',
        rows: [
          { type: 'path', mode: 'single', name: '文献目录', desc: '文献笔记所在文件夹，列表实时扫描该目录', binding: { key: 'literatureDirectory' } },
          { type: 'textarea', name: '领域词表', desc: '逗号分隔的领域词；留空 = AI 自由写领域', binding: { key: 'literatureDomainList' }, placeholder: '物理,医学,计算机,经济,文史哲…' },
        ],
      },
      {
        icon: 'settings-2', name: '视频处理',
        rows: [
          { type: 'toggle', name: '详细进度提示', desc: '处理中显示当前步骤、耗时、百分比与步骤时间线；关闭则仅显示步骤徽章', binding: { key: 'literatureProgressDetail' } },
          { type: 'toggle', name: '保留视频原件', desc: '转文献完成后保留视频文件；关闭则只生成文献笔记', binding: { key: 'literatureKeepVideo' } },
          { type: 'select', name: '下载清晰度', desc: '以视频源可用档位为准，低档优先命中缓存', binding: { key: 'literatureQuality' }, options: [{ value: 'highest', label: '最高' }, { value: '1080', label: '1080P' }, { value: '720', label: '720P' }] },
          { type: 'toggle', name: '遇错即停', desc: '单条失败后停止处理剩余任务；关闭则失败后继续', binding: { key: 'literatureStopOnFailure' } },
          { type: 'text', name: '输出目录', desc: '视频文件落地目录；留空跟随工具配置', binding: { key: 'literatureOutputDir' }, placeholder: '如 D:/videos' },
          { type: 'toggle', name: '压缩', desc: '转文字前压缩视频；默认开启（用户拍板）', binding: { key: 'literatureCompress' } },
          { type: 'number', name: '压缩质量（CRF）', desc: '数值越小画质越高；范围 18-28', binding: { key: 'literatureCrf' }, min: 18, max: 28, step: 1 },
        ],
      },
      {
        icon: 'wrench', name: '工具',
        rows: [
          { type: 'text', name: 'ffmpeg 路径', desc: '视频处理用；留空跟随工具配置', binding: { key: 'literatureFfmpegPath' }, placeholder: '如 ffmpeg 或 D:/tools/ffmpeg.exe' },
          { type: 'text', name: 'ffprobe 路径', desc: '探测视频元数据用；留空跟随工具配置', binding: { key: 'literatureFfprobePath' }, placeholder: '如 ffprobe 或 D:/tools/ffprobe.exe' },
          { type: 'text', name: 'Python 路径', desc: 'faster-whisper 依赖；留空跟随工具配置', binding: { key: 'literaturePythonPath' }, placeholder: '如 python 或 D:/tools/python.exe' },
          { type: 'text', name: 'Whisper 模型', desc: '转写模型档位（tiny/base/small/medium/large）', binding: { key: 'literatureWhisperModel' }, placeholder: '如 small' },
          { type: 'text', name: '缓存目录', desc: '剪辑产物与转写稿缓存；留空 = 系统临时目录', binding: { key: 'literatureCacheDir' }, placeholder: '如 D:/bili-dl-cache' },
          { type: 'number', name: '缓存保留天数', desc: '超过该天数的缓存自动清理', binding: { key: 'literatureCacheRetentionDays' }, min: 1, step: 1 },
        ],
      },
      mobileFullscreenGroup('literatureMobileDefaultFullscreen'),
      {
        icon: 'wrench', name: '维护',
        rows: [
          {
            type: 'button', name: '清空历史', desc: '移除全部成功归档的转文献记录；文献笔记与视频文件保留在 vault 中',
            buttonText: '清空历史', onClick: () => { if (opts?.onClearHistory) void opts.onClearHistory(); },
          },
        ],
      },
    ],
  };
}

export class UIManager {
  app: App;
  // ---- 主面板（文献笔记列表）----
  mask: HTMLElement | null = null;
  popup: HTMLElement | null = null;
  list: HTMLElement | null = null;
  private allNotes: LiteratureNoteEntry[] = [];
  private filteredNotes: LiteratureNoteEntry[] = [];
  private selectedDomain: string | null = null;
  private selectedType = '';
  private searchKeyword = '';
  private currentDisplayCount = 0;
  private allLoaded = false;
  private isLoadingMore = false;
  /** 最后加载的文献目录（变更检测：设置改了目录 → 清缓存全量重载，ticket 136 §3） */
  private loadedDir = '';
  /** 已补全过旧笔记的目录（防每次打开重复跑 AI，ADR-0073） */
  private backfilledDir = '';
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRefreshPaths = new Set<string>();
  private pendingDeletePaths = new Set<string>();
  private fileListenerRefs: (() => void)[] = [];
  private fileListenerAttached = false;
  // ---- 视频录入面板（任务队列）----
  videoMask: HTMLElement | null = null;
  videoPopup: HTMLElement | null = null;
  videoList: HTMLElement | null = null;
  // ---- 添加任务弹窗 / 历史弹窗 ----
  addMask: HTMLElement | null = null;
  addPopup: HTMLElement | null = null;
  historyMask: HTMLElement | null = null;
  historyPopup: HTMLElement | null = null;
  historyList: HTMLElement | null = null;
  // ---- 术语生成面板 ----
  termMask: HTMLElement | null = null;
  termPopup: HTMLElement | null = null;
  /** 当前术语预览草稿（path + 面板当前展示值；确认前不视为落盘笔记） */
  private termPreview: { path: string; domain: string; body: string } | null = null;
  private termGenerating = false;

  private editingId: string | null = null;
  private onKeydown: (e: KeyboardEvent) => void = () => {};
  /** 运行中行内进度态（task.id → 时间线/百分比/启动时刻） */
  private runState = new Map<string, RowRunState>();
  /** 耗时秒针（整批期间每秒刷新处理中行的耗时） */
  private runTimer: ReturnType<typeof setInterval> | null = null;

  constructor(app: App) {
    this.app = app;
    this.createMainUI();
    this.createVideoUI();
    this.createAddDialog();
    this.createHistoryUI();
    this.createTermUI();
    this.onKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // ESC 关最上层：术语面板 → 历史弹窗 → 添加弹窗 → 视频面板 → 主面板（各层显隐独立，ADR-0070）
      if (this.termPopup && this.termPopup.style.display === 'flex') this.hideTermEntry();
      else if (this.historyPopup && this.historyPopup.style.display === 'flex') this.hideHistory();
      else if (this.addPopup && this.addPopup.style.display === 'flex') this.hideAddDialog();
      else if (this.videoPopup && this.videoPopup.style.display === 'flex') this.hideVideo();
      else if (this.popup && this.popup.style.display === 'flex') this.hideMain();
    };
    document.addEventListener('keydown', this.onKeydown);
  }

  // ==================== 主面板（文献笔记列表） ====================

  createMainUI(): void {
    const mask = document.createElement('div');
    mask.id = 'literature-mask';
    mask.className = 'bz-lit-mask';
    mask.style.display = 'none';
    mask.onclick = () => this.hideMain();

    const popup = document.createElement('div');
    popup.id = 'literature-popup';
    popup.className = 'bz-lit-window';
    popup.style.display = 'none';

    const header = document.createElement('div');
    header.className = 'bz-win-head';
    header.innerHTML = `
      <h3 style="margin:0;font-size:16px;font-weight:600;color:var(--text-normal);">文献盒</h3>
      <div class="bz-lit-head-btns">
        <button id="lit-btn-search" title="切换搜索框">🔍</button>
        <button id="lit-btn-text" title="文字录入：术语生成文献笔记">文字录入</button>
        <button id="lit-btn-video" title="视频录入：添加转文献任务并批处理">视频录入</button>
        <button id="lit-btn-settings" title="设置">⚙️</button>
        <button id="lit-btn-close" class="bz-win-close" title="关闭">✕</button>
      </div>`;
    popup.appendChild(header);

    // 顶部：领域筛选行 + 类型过滤（可叠加，ticket 136 §3）
    const barBox = document.createElement('div');
    barBox.className = 'bz-lit-filterbar';
    const typeBar = document.createElement('div');
    typeBar.id = 'literature-typebar';
    typeBar.className = 'bz-lit-typebar';
    typeBar.innerHTML = `
      <button class="bz-lit-filter-btn active" data-type="">全部</button>
      <button class="bz-lit-filter-btn" data-type="video">视频</button>
      <button class="bz-lit-filter-btn" data-type="term">术语</button>`;
    const siteBar = document.createElement('div');
    siteBar.id = 'literature-sitebar';
    siteBar.className = 'bz-lit-sitebar';
    barBox.appendChild(typeBar);
    barBox.appendChild(siteBar);
    popup.appendChild(barBox);

    // 搜索框（🔍 按钮切换显隐，剪藏本同款）
    const searchContainer = document.createElement('div');
    searchContainer.id = 'literature-search-container';
    searchContainer.className = 'bz-lit-search';
    searchContainer.style.display = 'none';
    const searchInput = document.createElement('input');
    searchInput.id = 'literature-search-input';
    searchInput.type = 'text';
    searchInput.placeholder = '🔍 搜索文献笔记（标题、简介）…';
    searchInput.addEventListener('input', (e) => {
      const keyword = (e.target as HTMLInputElement).value.trim();
      if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.searchKeyword = keyword;
        this.applyFilter();
      }, 300);
    });
    searchContainer.appendChild(searchInput);
    popup.appendChild(searchContainer);

    const list = document.createElement('div');
    list.id = 'literature-list';
    list.className = 'bz-lit-list';
    popup.appendChild(list);

    document.body.appendChild(mask);
    document.body.appendChild(popup);
    this.mask = mask;
    this.popup = popup;
    this.list = list;
    this._bindMainHeaderEvents();
    // 懒加载：scroll 触底（阈值 50px）批次 ~20（照抄剪藏本 initScroll）
    list.addEventListener('scroll', () => {
      if (this.isLoadingMore || this.allLoaded) return;
      const { scrollTop, scrollHeight, clientHeight } = list;
      if (scrollTop + clientHeight >= scrollHeight - 50) {
        this.isLoadingMore = true;
        this.renderList(false);
        this.isLoadingMore = false;
      }
    });
    this.attachFileListener();
  }

  private _bindMainHeaderEvents(): void {
    const p = this.popup;
    if (!p) return;
    // 🔍 搜索切换显示（剪藏本同款：开=聚焦，关=清空并应用筛选）
    q<HTMLButtonElement>(p, '#lit-btn-search')!.onclick = () => {
      const container = q<HTMLElement>(p, '#literature-search-container');
      if (!container) return;
      const isHidden = container.style.display === 'none' || getComputedStyle(container).display === 'none';
      container.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        const input = q<HTMLInputElement>(p, '#literature-search-input');
        if (input) setTimeout(() => input.focus(), 100);
      } else {
        const input = q<HTMLInputElement>(p, '#literature-search-input');
        if (input) {
          input.value = '';
          this.searchKeyword = '';
          if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
          this.applyFilter();
        }
      }
    };
    // 文字录入 → 术语生成面板；视频录入 → 任务队列（剪藏本互调先例：隐藏当前窗开目标窗）
    q<HTMLButtonElement>(p, '#lit-btn-text')!.onclick = () => {
      this.hideMain();
      this.showTermEntry();
    };
    q<HTMLButtonElement>(p, '#lit-btn-video')!.onclick = () => {
      this.hideMain();
      this.showVideoEntry();
    };
    q<HTMLButtonElement>(p, '#lit-btn-settings')!.onclick = () =>
      openSettingsModal({
        title: '文献盒设置',
        maxWidth: 560,
        schema: literatureSettingsSchema({ onClearHistory: () => this.confirmClearHistory() }),
        // 目录设置变更 → 主面板清缓存全量重载（ticket 136 §3）；refreshPanel 亦有兜底检测
        onClose: () => this.reloadIfDirChanged(),
      });
    q<HTMLButtonElement>(p, '#lit-btn-close')!.onclick = () => this.hideMain();
    // 类型过滤（全部/视频/术语），与领域筛选叠加
    const typeBar = q<HTMLElement>(p, '#literature-typebar');
    if (typeBar) {
      typeBar.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.selectedType = btn.dataset.type ?? '';
          typeBar.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
          this.applyFilter();
        });
      });
    }
  }

  /** 打开主面板（文献笔记列表）：移动端默认全屏、抬顶、刷新列表 + 旧笔记自动补全 */
  showMain(): void {
    if (!this.popup || !this.mask) return;
    applyMobileWindowFullscreen(this.popup, tryGetSettings().literatureMobileDefaultFullscreen === true);
    topifyZ(this.mask, this.popup); // ADR-0067：显示即发号，谁后显示谁在上
    this.mask.style.display = 'block';
    this.popup.style.display = 'flex';
    void this.refreshPanel();
    void this.runBackfill();
  }

  hideMain(): void {
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
  }

  /** 主面板全量刷新（目录变更检测 → 重扫 → 重建筛选 → 渲染），公开供测试触达 */
  async refreshPanel(): Promise<void> {
    if (!this.list) return;
    const dir = litDirOf(tryGetSettings());
    if (this.loadedDir && this.loadedDir !== dir) {
      this.resetNoteCache();
      this.loadedDir = '';
      this.backfilledDir = ''; // 目录换了，旧目录的补全记录作废
    }
    await this.loadNotes();
    if (!this.list) return; // await 期间面板被销毁 → 放弃渲染
    this.rebuildDomainBar();
    this.syncTypebarActive();
    this.applyFilter(); // 以全部笔记（+当前筛选态）重建 filteredNotes 并渲染；纯 renderList 不会灌 filteredNotes
  }

  /** 扫描「文献目录」下 .md（metadataCache 解析 frontmatter；不含文件本体 I/O） */
  private async loadNotes(): Promise<void> {
    const app = getApp();
    const dir = litDirOf(tryGetSettings());
    let entries: LiteratureNoteEntry[] = [];
    const folder = app.vault.getAbstractFileByPath(dir);
    if (folder && (folder as any).children) {
      const mdFiles = (folder as any).children.filter((f: any) => f.extension === 'md');
      entries = (await Promise.all(mdFiles.map((f: any) => this.parseNoteFile(f)))).filter((e): e is LiteratureNoteEntry => e !== null);
    }
    entries.sort((a, b) => (b.created - a.created) || a.path.localeCompare(b.path));
    this.allNotes = entries;
    this.loadedDir = dir;
  }

  private async parseNoteFile(file: any): Promise<LiteratureNoteEntry | null> {
    const app = getApp();
    try {
      const cache = app.metadataCache.getFileCache(file);
      const fm = cache && (cache as any).frontmatter;
      const title = fm && fm.title ? String(fm.title) : file.basename;
      const date = fm && fm.date ? String(fm.date) : '';
      let created = parseDateRaw(date);
      if (isNaN(created)) {
        try {
          const st = await file.stat;
          created = st && st.ctime ? new Date(st.ctime).valueOf() : 0;
        } catch { created = 0; }
      }
      return {
        file,
        path: file.path,
        title,
        type: fm && fm.type ? String(fm.type) : '',
        domain: fm && fm.domain ? String(fm.domain) : '',
        summary: fm && fm.summary ? String(fm.summary) : '',
        url: fm && fm.url ? String(fm.url) : '',
        date,
        created,
      };
    } catch (e) {
      console.warn('解析文献笔记失败:', file.path, e);
      return null;
    }
  }

  /** 清理主面板缓存（目录变更 / 清缓存场景）：列表/筛选态/搜索回显/待结算防抖 */
  private resetNoteCache(): void {
    this.allNotes = [];
    this.filteredNotes = [];
    this.currentDisplayCount = 0;
    this.allLoaded = false;
    this.selectedDomain = null;
    this.selectedType = '';
    this.searchKeyword = '';
    if (this.searchDebounceTimer) { clearTimeout(this.searchDebounceTimer); this.searchDebounceTimer = null; }
    if (this.refreshTimer) { clearTimeout(this.refreshTimer); this.refreshTimer = null; }
    this.pendingRefreshPaths.clear();
    this.pendingDeletePaths.clear();
    if (this.popup) {
      const input = q<HTMLInputElement>(this.popup, '#literature-search-input');
      if (input) input.value = '';
    }
  }

  /** 设置弹窗关闭/打开时比较文献目录：变了 → 清缓存全量重载（ticket 136 §3） */
  private reloadIfDirChanged(): void {
    if (!this.popup || !this.popup.isConnected) return; // 面板未建/已卸载跳过
    const dir = litDirOf(tryGetSettings());
    if (this.loadedDir && this.loadedDir !== dir) {
      this.resetNoteCache();
      this.loadedDir = '';
      void this.refreshPanel();
    }
  }

  /** 旧笔记自动补全（note-gen 已实现；AI 未配置跳过并提示一句）；每目录至多跑一次 */
  private async runBackfill(): Promise<void> {
    const dir = litDirOf(tryGetSettings());
    if (this.backfilledDir === dir) return;
    this.backfilledDir = dir;
    try {
      const res = await backfillNotes();
      if (res && res.aiSkipped) {
        notice('AI 未配置：部分旧笔记缺少领域分类，已跳过补全（配置 AI 后重新打开面板可补全）', 'info');
      }
      if (res && res.filled > 0) await this.refreshPanel();
    } catch { /* 补全失败静默，不影响列表 */ }
  }

  /** 领域筛选行（剪藏本 rebuildSiteBar 同款：全部 (N) + 各领域按钮带数量，按 count 降序） */
  private rebuildDomainBar(): void {
    const container = this.popup ? q<HTMLElement>(this.popup, '#literature-sitebar') : null;
    if (!container) return;
    const counts = new Map<string, number>();
    for (const n of this.allNotes) {
      const d = n.domain || '未分类';
      counts.set(d, (counts.get(d) || 0) + 1);
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([d]) => d);
    container.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = 'bz-lit-filter-btn' + (this.selectedDomain ? '' : ' active');
    allBtn.textContent = `全部 (${this.allNotes.length})`;
    allBtn.onclick = () => { this.selectedDomain = null; this.applyFilter(); };
    container.appendChild(allBtn);
    for (const d of sorted) {
      const btn = document.createElement('button');
      btn.className = 'bz-lit-filter-btn' + (this.selectedDomain === d ? ' active' : '');
      btn.dataset.domain = d;
      btn.textContent = `${d} (${counts.get(d)})`;
      btn.onclick = () => {
        this.selectedDomain = this.selectedDomain === d ? null : d;
        this.applyFilter();
      };
      container.appendChild(btn);
    }
  }

  private syncTypebarActive(): void {
    if (!this.popup) return;
    const typeBar = q<HTMLElement>(this.popup, '#literature-typebar');
    if (!typeBar) return;
    typeBar.querySelectorAll('button').forEach((b) => b.classList.toggle('active', (b.dataset.type ?? '') === this.selectedType));
  }

  /** 筛选管线：类型过滤（叠加）→ 领域筛选（叠加）→ 搜索（标题/简介） */
  private applyFilter(): void {
    let list = this.allNotes;
    if (this.selectedType) list = list.filter((n) => n.type === this.selectedType);
    if (this.selectedDomain) list = list.filter((n) => (n.domain || '未分类') === this.selectedDomain);
    if (this.searchKeyword) {
      const kw = this.searchKeyword.toLowerCase();
      list = list.filter((n) => n.title.toLowerCase().includes(kw) || n.summary.toLowerCase().includes(kw));
    }
    this.filteredNotes = list;
    this.currentDisplayCount = 0;
    this.allLoaded = false;
    this.renderList(true);
  }

  /** 渲染列表（懒加载：reset 重建，否则追加下一批 ~20 条） */
  private renderList(reset = false): void {
    if (!this.list) return;
    if (reset) {
      this.list.innerHTML = '';
      this.currentDisplayCount = 0;
      this.allLoaded = false;
    }
    if (this.filteredNotes.length === 0) {
      if (this.currentDisplayCount === 0) {
        const empty = document.createElement('div');
        empty.className = 'bz-lit-empty';
        empty.textContent = this.selectedType || this.selectedDomain || this.searchKeyword
          ? '没有符合条件的文献笔记'
          : `「${this.loadedDir || litDirOf(tryGetSettings())}」还没有文献笔记`;
        this.list.appendChild(empty);
      }
      return;
    }
    if (this.allLoaded && !reset) return;
    const start = this.currentDisplayCount;
    const end = Math.min(start + 20, this.filteredNotes.length);
    const batch = this.filteredNotes.slice(start, end);
    for (const n of batch) this.list.appendChild(this.renderNoteCard(n));
    this.currentDisplayCount = end;
    if (this.currentDisplayCount >= this.filteredNotes.length) {
      this.allLoaded = true;
      const hint = document.createElement('div');
      hint.className = 'bz-lit-tail';
      hint.textContent = '已显示所有笔记';
      this.list.appendChild(hint);
    }
  }

  /** 文献笔记卡片：标题 + 类型徽标 + 领域徽标 + 简介两行省略 + 日期；双击打开 + 抽屉 */
  private renderNoteCard(n: LiteratureNoteEntry): HTMLElement {
    const card = document.createElement('div');
    card.className = 'bz-lit-card';
    card.dataset.path = n.path;
    const typeLabel = n.type === 'video' ? '视频' : n.type === 'term' ? '术语' : '';
    const typeBadge = typeLabel ? `<span class="bz-lit-badge bz-lit-badge-type">${typeLabel}</span>` : '';
    const domainBadge = n.domain ? `<span class="bz-lit-badge bz-lit-badge-domain">${esc(n.domain)}</span>` : '';
    card.innerHTML = `
      <div class="bz-lit-card-title-row">
        <span class="bz-lit-card-title">${esc(n.title || '无标题')}</span>
        ${typeBadge}${domainBadge}
      </div>
      <div class="bz-lit-card-summary">${esc(n.summary || '（无简介）')}</div>
      <div class="bz-lit-card-date">${esc(n.date)}</div>`;
    // 双击打开（click 计数 300ms，影视先例 movie/ui.ts:155；单击无操作防误触）
    let lastClick = 0;
    card.addEventListener('click', (e) => {
      const now = Date.now();
      if (lastClick && now - lastClick < 300) {
        e.stopPropagation();
        e.preventDefault();
        this.openNote(n.path);
      }
      lastClick = now;
    });
    // 抽屉（桌面右键 / 移动端长按自动分流，item-actions 承载）
    attachItemActions(card, this.buildNoteActions(n), { sheetHead: this.buildNoteSheetHead(n) });
    return card;
  }

  private buildNoteSheetHead(n: LiteratureNoteEntry): HTMLElement {
    const head = document.createElement('div');
    head.className = 'bz-lit-sheet-head';
    const title = document.createElement('div');
    title.className = 'bz-lit-card-title';
    title.textContent = n.title || '无标题';
    const summary = document.createElement('div');
    summary.className = 'bz-lit-card-summary';
    summary.textContent = n.summary || '（无简介）';
    head.appendChild(title);
    head.appendChild(summary);
    return head;
  }

  private buildNoteActions(n: LiteratureNoteEntry): ItemAction[] {
    const actions: ItemAction[] = [
      { icon: 'book-open', label: '打开', title: '打开文献笔记', onClick: () => this.openNote(n.path) },
      { icon: 'link', label: '复制双链', title: '复制双链', onClick: () => void this.copyWikilink(n) },
    ];
    // 视频笔记有原文链接（frontmatter url）；术语笔记无
    if (n.url) {
      let sub = '';
      try { sub = new URL(n.url).hostname; } catch { /* 忽略非法链接 */ }
      actions.push({ icon: 'globe', label: '复制原文链接', sub: sub || undefined, title: '复制原文链接', onClick: () => void this.copyText(n.url) });
    }
    // 删除 danger + flow-dialog 确认；删除时同步清理 literature.json 指向该笔记的任务记录
    actions.push({ icon: 'trash-2', label: '删除', kind: 'danger', title: '删除文献笔记', onClick: () => void this.confirmDeleteNote(n) });
    return actions;
  }

  private async confirmDeleteNote(n: LiteratureNoteEntry): Promise<void> {
    const v = await openFlowDialog({
      title: '删除这篇文献笔记？',
      message: `将从 vault 删除「${n.title}」；视频转文献历史中指向该笔记的记录会同步移除。\n此操作不可撤销。`,
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '删除', value: 'ok', danger: true },
      ],
    });
    if (v !== 'ok') return;
    const app = getApp();
    try {
      this.removeNoteByPath(n.path);
      await app.vault.delete(n.file);
      await this.cleanupTaskRecordsForNote(n.path);
      this.rebuildDomainBar();
      notice(`已删除「${n.title}」`, 'success');
    } catch (e: any) {
      notice('删除失败：' + (e?.message ?? String(e)), 'error');
    }
  }

  /** 删除视频笔记时同步清理 literature.json 里指向该笔记的任务记录（避免悬挂 notePath，ticket 136 §3） */
  private async cleanupTaskRecordsForNote(path: string): Promise<void> {
    const tasks = await LiteratureData.loadTasks();
    for (const t of tasks) {
      if (t.notePath === path) await LiteratureData.deleteTask(t.id);
    }
  }

  // ---- 主面板增量刷新（literature:file-* 四通道 300ms 防抖，照抄剪藏本 attachFileListener） ----

  private removeNoteByPath(path: string): void {
    const idx = this.allNotes.findIndex((n) => n.path === path);
    if (idx === -1) return;
    this.allNotes.splice(idx, 1);
    this.applyFilter();
    this.rebuildDomainBar();
  }

  /** 单文件增量解析（create/modify/rename 新路径；parseNoteFile 无文件本体 I/O，代价低廉） */
  private async refreshSingleNote(path: string): Promise<void> {
    const app = getApp();
    const file = app.vault.getAbstractFileByPath(path) as any;
    if (!file) { this.removeNoteByPath(path); return; }
    if (file.extension !== 'md') return;
    const entry = await this.parseNoteFile(file);
    if (entry) {
      const idx = this.allNotes.findIndex((n) => n.path === path);
      if (idx >= 0) this.allNotes[idx] = entry;
      else this.allNotes.push(entry);
      this.allNotes.sort((a, b) => (b.created - a.created) || a.path.localeCompare(b.path));
      this.applyFilter();
    } else {
      this.removeNoteByPath(path);
    }
  }

  private scheduleRefreshFlush(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(async () => {
      const deletes = Array.from(this.pendingDeletePaths);
      const modifies = Array.from(this.pendingRefreshPaths);
      this.pendingDeletePaths.clear();
      this.pendingRefreshPaths.clear();
      for (const p of deletes) this.removeNoteByPath(p);
      for (const p of modifies) await this.refreshSingleNote(p);
      this.refreshTimer = null;
    }, 300);
  }

  private attachFileListener(): void {
    if (this.fileListenerAttached) return;
    const inDir = (path: string) => path.startsWith(litDirOf(tryGetSettings()) + '/');
    const fileModifyHandler = (p: string) => {
      if (inDir(p)) { this.pendingRefreshPaths.add(p); this.scheduleRefreshFlush(); }
    };
    const fileDeleteHandler = (evt: { path: string }) => {
      if (inDir(evt.path)) { this.pendingDeletePaths.add(evt.path); this.scheduleRefreshFlush(); }
    };
    const fileRenameHandler = (evt: { oldPath: string; newPath: string; movedOut: boolean }) => {
      if (inDir(evt.oldPath)) this.pendingDeletePaths.add(evt.oldPath);
      // movedOut=true 为移入（旧路径不在域内，无旧卡）；movedOut=false 则新旧路径均在文献目录
      if (!evt.movedOut && inDir(evt.newPath)) this.pendingRefreshPaths.add(evt.newPath);
      this.scheduleRefreshFlush();
    };
    // 换线：原生 vault 事件 → 域事件总线 literature:file-*（obsidian-adapter 统一派发，仅 md）
    this.fileListenerRefs = [
      onDomainEvent<{ path: string }>('literature:file-created', (evt) => fileModifyHandler(evt.path)),
      onDomainEvent<{ path: string }>('literature:file-modified', (evt) => fileModifyHandler(evt.path)),
      onDomainEvent<{ path: string }>('literature:file-deleted', fileDeleteHandler),
      onDomainEvent<{ oldPath: string; newPath: string; movedOut: boolean }>('literature:file-renamed', fileRenameHandler),
    ];
    this.fileListenerAttached = true;
  }

  // ==================== 视频录入面板（任务队列，原 bili-tasks 搬入） ====================

  createVideoUI(): void {
    const mask = document.createElement('div');
    mask.id = 'literature-video-mask';
    mask.className = 'bz-lit-mask';
    mask.style.display = 'none';
    mask.onclick = () => this.hideVideo();
    const popup = document.createElement('div');
    popup.id = 'literature-video-popup';
    popup.className = 'bz-lit-window';
    popup.style.display = 'none';
    const header = document.createElement('div');
    header.className = 'bz-win-head';
    header.innerHTML = `
      <div style="display:flex;gap:8px;align-items:baseline;min-width:0;">
        <h3 style="margin:0;font-size:16px;font-weight:600;color:var(--text-normal);">视频录入</h3>
        <span id="lit-video-counts" class="bz-bili-counts"></span>
      </div>
      <div class="bz-lit-head-btns">
        <button id="lit-btn-video-add" title="添加转文献任务">➕</button>
        <button id="lit-btn-video-run" title="批量处理（桌面端）">▶️</button>
        <button id="lit-btn-video-abort" title="中止整批" style="display:none;">⏹</button>
        <button id="lit-btn-video-history" title="历史">🕘</button>
        <button id="lit-btn-video-close" class="bz-win-close" title="关闭">✕</button>
      </div>`;
    const list = document.createElement('div');
    list.id = 'literature-video-list';
    list.className = 'bz-lit-list';
    popup.appendChild(header);
    popup.appendChild(list);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    this.videoMask = mask;
    this.videoPopup = popup;
    this.videoList = list;
    this._bindVideoHeaderEvents();
    // 移动端仅 ➕ 添加 / 🕘 历史 + ✕（隐藏 处理/中止——原 isMobileEnv 逻辑扩展，ticket 136 §5）
    if (isMobileEnv()) {
      const run = q<HTMLButtonElement>(popup, '#lit-btn-video-run');
      const abort = q<HTMLButtonElement>(popup, '#lit-btn-video-abort');
      if (run) run.style.display = 'none';
      if (abort) abort.style.display = 'none';
    }
  }

  private _bindVideoHeaderEvents(): void {
    const p = this.videoPopup;
    if (!p) return;
    q<HTMLButtonElement>(p, '#lit-btn-video-add')!.onclick = () => this.showAddDialog();
    q<HTMLButtonElement>(p, '#lit-btn-video-run')!.onclick = () => void this.onRunBatch();
    q<HTMLButtonElement>(p, '#lit-btn-video-abort')!.onclick = () => void this.onAbortBatch();
    q<HTMLButtonElement>(p, '#lit-btn-video-history')!.onclick = () => this.showHistory();
    q<HTMLButtonElement>(p, '#lit-btn-video-close')!.onclick = () => this.hideVideo();
  }

  /** 打开视频录入面板（任务队列）；prefill 存在则叠开添加弹窗（聚合讯「保存至文献」入口，ADR-0068） */
  showVideoEntry(prefill?: { url: string; title?: string | null; uploader?: string | null }): void {
    if (!this.videoPopup || !this.videoMask) return;
    topifyZ(this.videoMask, this.videoPopup);
    this.videoMask.style.display = 'block';
    this.videoPopup.style.display = 'flex';
    void this.refreshVideoPanel();
    if (prefill) {
      this.showAddDialog({ url: prefill.url, title: prefill.title ?? null, uploader: prefill.uploader ?? null });
    }
  }

  hideVideo(): void {
    if (this.videoMask) this.videoMask.style.display = 'none';
    if (this.videoPopup) this.videoPopup.style.display = 'none';
  }

  async refreshVideoPanel(): Promise<void> {
    const tasks = await LiteratureData.loadTasks();
    if (!this.videoList) return; // await 期间面板被销毁（unload/测试清理）→ 放弃渲染
    this.videoList.innerHTML = '';
    const active = tasks.filter((t) => !t.archived);
    const running = BatchRunner.running;
    // 运行中的批次横幅：处理到第几部
    if (running) {
      const idx = active.findIndex((t) => t.status === 'processing');
      const banner = document.createElement('div');
      banner.className = 'bz-bili-banner';
      banner.textContent = idx >= 0 ? `⏳ 正在处理 第 ${idx + 1}/${active.length} 部…` : '⏳ 正在准备处理…';
      this.videoList.appendChild(banner);
    }
    this._syncStatusCounts(active);
    if (active.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bz-bili-empty';
      empty.textContent = '暂无转文献任务。点击 ➕ 添加视频链接与起止时间，回到桌面端即可批量处理。';
      this.videoList.appendChild(empty);
      this._syncRunButton(active);
      return;
    }
    for (const t of active) this.videoList.appendChild(this.renderRow(t));
    this._syncRunButton(active);
  }

  /** 头部状态计数（ADR-0070）：待处理/处理中/失败 非零项，一眼看清队列健康度 */
  private _syncStatusCounts(tasks: LiteratureTask[]): void {
    const el = this.videoPopup ? q<HTMLElement>(this.videoPopup, '#lit-video-counts') : null;
    if (!el) return;
    const count = (s: LiteratureTask['status']) => tasks.filter((t) => t.status === s).length;
    const parts: string[] = [];
    if (count('pending')) parts.push(`${count('pending')} 待处理`);
    if (count('processing')) parts.push(`${count('processing')} 处理中`);
    if (count('failed')) parts.push(`${count('failed')} 失败`);
    el.textContent = parts.join(' · ');
  }

  private _syncRunButton(tasks: LiteratureTask[]): void {
    if (!this.videoPopup) return;
    const run = q<HTMLButtonElement>(this.videoPopup, '#lit-btn-video-run');
    const abort = q<HTMLButtonElement>(this.videoPopup, '#lit-btn-video-abort');
    if (!run) return;
    const hasWork = tasks.some((t) => t.status === 'pending' || t.status === 'failed');
    run.disabled = BatchRunner.running || !hasWork;
    if (abort) abort.style.display = BatchRunner.running && !isMobileEnv() ? '' : 'none';
  }

  private renderRow(task: LiteratureTask): HTMLElement {
    const card = document.createElement('div');
    card.className = 'bz-bili-task-card';
    card.dataset.id = task.id;
    const meta = STATUS_META[task.status] ?? STATUS_META.pending;
    const timeText = task.start && task.end ? `${task.start} ~ ${task.end}` : '整片';
    const linkLine = task.title
      ? `<a class="bz-bili-title" href="${esc(task.url)}" title="${esc(task.url)}">${esc(task.title)}</a>`
      : `<span class="bz-bili-url" title="${esc(task.url)}">${esc(shortUrlText(task.url))}</span>`;
    const upText = task.uploader ? ` · UP主 ${esc(task.uploader)}` : '';
    card.innerHTML = `
      <div class="bz-bili-row">
        <span class="bz-bili-status ${meta.cls}">${meta.label}</span>
        ${linkLine}
      </div>
      <div class="bz-bili-meta">${timeText}${upText}${task.remark ? ' · ' + esc(task.remark) : ''}</div>
      ${task.status === 'processing' ? (this.runState.has(task.id) ? '<div class="bz-bili-progress-box"></div>' : (task.reason ? `<div class="bz-bili-progress">${esc(task.reason)}</div>` : '')) : ''}
      ${task.status === 'failed' && task.reason ? `<div class="bz-bili-progress bz-bili-progress-error">${esc(task.reason)}</div>` : ''}
      ${task.status === 'success' && task.notePath ? `<div class="bz-bili-note">📄 ${esc(task.notePath)}</div>` : ''}`;
    const actions = this.buildCardActions(task);
    if (actions.length) attachItemActions(card, actions);
    // 标题链接：浏览器打开（不停泡点击分流的冒泡）
    const titleLink = q<HTMLAnchorElement>(card, '.bz-bili-title');
    if (titleLink) titleLink.onclick = (e) => { e.stopPropagation(); this._openExternal(titleLink.href || task.url); };
    // 点击分流：成功→打开文献笔记；待处理→编辑（失败原因已行内直显，处理中不响应）
    card.addEventListener('click', () => {
      if (task.status === 'success' && task.notePath) this.openNote(task.notePath);
      else if (task.status === 'pending') this.showAddDialog(task);
    });
    return card;
  }

  private buildCardActions(task: LiteratureTask): ItemAction[] {
    const actions: ItemAction[] = [];
    if (task.status === 'success') {
      if (task.notePath) actions.push({ icon: 'book-open', label: '打开文献笔记', onClick: () => this.openNote(task.notePath!) });
      if (task.videoPath) actions.push({ icon: 'copy', label: '复制视频路径', onClick: () => void this.copyText(task.videoPath!) });
      actions.push({ icon: 'pencil', label: '编辑', onClick: () => this.showAddDialog(task) });
    } else if (task.status === 'failed') {
      // 无行内重试（ADR-0070）：失败项重试 = 再次点击 ▶️ 批量处理（处理范围含待处理+失败）
      actions.push({ icon: 'pencil', label: '编辑', onClick: () => this.showAddDialog(task) });
    } else if (task.status === 'pending') {
      actions.push({ icon: 'pencil', label: '编辑', onClick: () => this.showAddDialog(task) });
    }
    actions.push({ icon: 'trash-2', label: '删除', kind: 'danger', onClick: () => void this.confirmDelete(task) });
    return actions;
  }

  /** 行内进度定点更新（不等 storage 落库——[bz-step]/[bz-p] 一到立即刷 DOM，修「UI 滞后于 JSON」） */
  private updateRowProgress(id: string): void {
    if (!this.videoList) return;
    const st = this.runState.get(id);
    const card = q<HTMLElement>(this.videoList, `.bz-bili-task-card[data-id="${id}"]`);
    if (!card || !st) return;
    let box = q<HTMLElement>(card, '.bz-bili-progress-box');
    if (!box) {
      box = document.createElement('div');
      box.className = 'bz-bili-progress-box';
      const meta = q<HTMLElement>(card, '.bz-bili-meta');
      if (meta) meta.after(box);
      else card.appendChild(box);
    }
    // 简要模式（设置 literatureProgressDetail=false 显式关闭）：仅当前步骤文本；
    // 缺省/未注入（=undefined）走详细模式——默认值即详细
    if (tryGetSettings().literatureProgressDetail === false) {
      const cur = st.steps[st.steps.length - 1] || '处理中…';
      box.innerHTML = `<div class="bz-bili-progress">${esc(cur)}</div>`;
      return;
    }
    // 详细模式：✓ 已完成步骤时间线（完成态文案「已…」，ADR-0070）→ 当前步骤 + 耗时；
    // 百分比/进度条仅「下载中」显示（ADR-0067 拍板：除下载外其余阶段不显示百分比）
    const segs = st.steps.map((s, i) =>
      i === st.steps.length - 1
        ? `<span class="bz-bili-step-cur">${esc(s)}</span>`
        : `<span class="bz-bili-step-done">✓ ${esc(stepDoneLabel(s))}</span>`
    );
    const pct = st.phase === 'download' ? st.pct : null;
    const bar = pct != null
      ? `<div class="bz-bili-progress-track"><div class="bz-bili-progress-fill" style="width:${Math.min(100, Math.max(0, pct))}%"></div></div>`
      : '';
    box.innerHTML = `
      <div class="bz-bili-steps">${segs.join('<span class="bz-bili-step-arrow">→</span>')}${pct != null ? ` <span class="bz-bili-step-pct">${Math.round(pct)}%</span>` : ''}</div>
      ${bar}
      <div class="bz-bili-elapsed">⌛ ${fmtElapsed(Date.now() - st.startAt)}</div>`;
  }

  /** 整批耗时秒针：每秒刷新处理中行的耗时显示 */
  private startRunTimer(): void {
    this.clearRunTimer();
    this.runTimer = setInterval(() => {
      for (const id of Array.from(this.runState.keys())) this.updateRowProgress(id);
    }, 1000);
  }

  private clearRunTimer(): void {
    if (this.runTimer !== null) { clearInterval(this.runTimer); this.runTimer = null; }
  }

  private async onRunBatch(): Promise<void> {
    if (!BatchRunner.available()) {
      notice('仅桌面端可用：批量处理需要 Node.js 外部进程', 'error');
      return;
    }
    if (BatchRunner.running) return;
    const tasks = await LiteratureData.loadTasks();
    // ADR-0067 断点续跑：待处理 + 失败 项一起处理（失败项从出错步骤继续，成功项已归档不重跑）
    const work = tasks.filter((t) => !t.archived && (t.status === 'pending' || t.status === 'failed'));
    if (work.length === 0) { notice('没有待处理或失败的任务', 'info'); return; }
    const ui = this;
    ui.startRunTimer();
    const events: BatchEvents = {
      // 步骤/进度事件：更新内存态 + 行内定点刷新（不整表重读，UI 与工具输出同步）
      onTaskProgress: (t, stepText, progress) => {
        let st = ui.runState.get(t.id);
        if (!st) { st = { steps: [], phase: null, pct: null, startAt: Date.now() }; ui.runState.set(t.id, st); }
        // 「启动中…」是占位文案不是工具步骤，不进时间线（真实第一步是「解析中」）
        if (stepText && stepText !== '启动中…' && !st.steps.includes(stepText)) st.steps.push(stepText);
        if (progress) {
          if (progress.phase) st.phase = progress.phase;
          if (progress.pct != null) st.pct = progress.pct;
        }
        ui.updateRowProgress(t.id);
      },
      // 解析信息落库（ADR-0067）：标题/UP主 就位 → 整表刷新，行内切换为「文字+链接」形态
      onTaskInfo: (t) => { void ui.refreshVideoPanel(); },
      onTaskDone: (t) => {
        ui.runState.delete(t.id);
        // 终态域事件（converted/failed）由 processor._finish 专责发射（ADR-0071），此处不再发
        // （ticket 136 后 smartcat 只收 converted/term-generated；UI 回调仅做状态清理 + 刷新）
        void ui.refreshVideoPanel();
      },
      onBatchDone: (summary) => {
        ui.clearRunTimer();
        ui.runState.clear();
        const head = `处理完成：成功 ${summary.success} 部`;
        const tail = summary.failed ? `，失败 ${summary.failed} 部` : '';
        const end = summary.aborted ? '（已中止）' : summary.stopped ? '（遇错即停）' : '';
        notice(head + tail + end, summary.failed || summary.aborted || summary.stopped ? 'warning' : 'success');
        void ui.refreshVideoPanel();
      },
    };
    await BatchRunner.runAll(work, events);
  }

  private async onAbortBatch(): Promise<void> {
    if (!BatchRunner.running) return;
    const v = await openFlowDialog({
      title: '中止批量处理？',
      message: '当前正在处理的视频将停止，已成功的保留在列表；未开始的项保持待处理，可稍后继续。',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '中止', value: 'ok', danger: true },
      ],
    });
    if (v !== 'ok') return;
    BatchRunner.abort();
    await this.refreshVideoPanel();
  }

  private async confirmDelete(task: LiteratureTask): Promise<void> {
    const v = await openFlowDialog({
      title: '删除这条转文献任务？',
      message: '仅从列表移除记录，已生成的文献笔记与视频不受影响。',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '删除', value: 'ok', danger: true },
      ],
    });
    if (v !== 'ok') return;
    await LiteratureData.deleteTask(task.id);
    await this.refreshVideoPanel();
    await this.refreshHistory();
  }

  /** 清空历史（⚙️ 设置面板入口，ADR-0070）：确认后移除全部归档记录 */
  private async confirmClearHistory(): Promise<void> {
    const v = await openFlowDialog({
      title: '清空历史？',
      message: '将移除全部「成功」归档记录；文献笔记与视频文件保留在 vault 中。',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '清空', value: 'ok', danger: true },
      ],
    });
    if (v !== 'ok') return;
    await LiteratureData.clearHistory();
    await this.refreshHistory();
  }

  // ==================== 添加任务弹窗 ====================

  createAddDialog(): void {
    const addMask = document.createElement('div');
    addMask.id = 'literature-add-mask';
    addMask.className = 'bz-lit-mask';
    addMask.style.display = 'none';
    addMask.onclick = () => this.hideAddDialog();
    const popup = document.createElement('div');
    popup.id = 'literature-add-popup';
    popup.className = 'bz-lit-dialog';
    popup.style.display = 'none';
    // 无取消按钮：遮罩 + ESC 关闭，与其他域弹窗一致（ADR-0070）
    popup.innerHTML = `
      <h4 style="margin:0;font-size:14px;font-weight:600;" id="lit-add-title">添加转文献任务</h4>
      <label style="font-size:12px;color:var(--text-muted);">视频链接 / BV 号</label>
      <input id="lit-add-url" type="text" placeholder="https://www.bilibili.com/video/BV… 或 BV1xx411c7mD" style="width:100%;box-sizing:border-box;">
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label style="font-size:12px;color:var(--text-muted);">视频标题（可选）</label>
          <input id="lit-add-vtitle" type="text" placeholder="队列里好认，留空用链接" style="width:100%;box-sizing:border-box;"></div>
        <div style="flex:1;"><label style="font-size:12px;color:var(--text-muted);">UP主（可选）</label>
          <input id="lit-add-uploader" type="text" placeholder="投稿 UP 主" style="width:100%;box-sizing:border-box;"></div>
      </div>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label style="font-size:12px;color:var(--text-muted);">下载清晰度</label>
          <select id="lit-add-quality" style="width:100%;">
            <option value="">跟随全局设置</option>
            <option value="highest">最高</option>
            <option value="1080">1080P</option>
            <option value="720">720P</option>
          </select></div>
        <div style="flex:1;"><label style="font-size:12px;color:var(--text-muted);">分P（留空 = 第 1 P）</label>
          <input id="lit-add-page" type="number" min="1" step="1" placeholder="如 2" style="width:100%;box-sizing:border-box;"></div>
      </div>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;"><label style="font-size:12px;color:var(--text-muted);">开始时间（留空 = 整片）</label>
          <input id="lit-add-start" type="text" placeholder="12.2 / 12-2 / 1:30:05" style="width:100%;box-sizing:border-box;"></div>
        <div style="flex:1;"><label style="font-size:12px;color:var(--text-muted);">结束时间</label>
          <input id="lit-add-end" type="text" placeholder="与开始成对填写" style="width:100%;box-sizing:border-box;"></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px;">
        <button id="lit-add-save" style="background:var(--interactive-accent);color:var(--text-on-accent);">保存</button>
      </div>`;
    document.body.appendChild(addMask);
    document.body.appendChild(popup);
    this.addMask = addMask;
    this.addPopup = popup;
    q<HTMLButtonElement>(popup, '#lit-add-save')!.onclick = () => void this._handleAddSave();
  }

  showAddDialog(editItem?: Partial<LiteratureTask>): void {
    if (!this.addPopup || !this.addMask) return;
    this.editingId = editItem?.id ?? null;
    // 有 id = 编辑既有任务；无 id（含预填对象）= 新增模式（ticket 134：聚合讯入口预填不显示编辑态）
    q<HTMLElement>(this.addPopup, '#lit-add-title')!.textContent = this.editingId ? '编辑转文献任务' : '添加转文献任务';
    (q<HTMLInputElement>(this.addPopup, '#lit-add-url')!).value = editItem?.url ?? '';
    (q<HTMLInputElement>(this.addPopup, '#lit-add-start')!).value = editItem?.start ?? '';
    (q<HTMLInputElement>(this.addPopup, '#lit-add-end')!).value = editItem?.end ?? '';
    (q<HTMLSelectElement>(this.addPopup, '#lit-add-quality')!).value = editItem?.quality ?? '';
    (q<HTMLInputElement>(this.addPopup, '#lit-add-page')!).value = editItem?.page ? String(editItem.page) : '';
    (q<HTMLInputElement>(this.addPopup, '#lit-add-vtitle')!).value = editItem?.title ?? '';
    (q<HTMLInputElement>(this.addPopup, '#lit-add-uploader')!).value = editItem?.uploader ?? '';
    topifyZ(this.addMask, this.addPopup); // ADR-0067：显示即发号
    this.addMask.style.display = 'block';
    this.addPopup.style.display = 'flex';
  }

  hideAddDialog(): void {
    if (this.addMask) this.addMask.style.display = 'none';
    if (this.addPopup) this.addPopup.style.display = 'none';
    this.editingId = null;
  }

  private async _handleAddSave(): Promise<void> {
    if (!this.addPopup) return;
    const url = (q<HTMLInputElement>(this.addPopup, '#lit-add-url')?.value ?? '').trim();
    const start = normalizeLooseTime(q<HTMLInputElement>(this.addPopup, '#lit-add-start')?.value);
    const end = normalizeLooseTime(q<HTMLInputElement>(this.addPopup, '#lit-add-end')?.value);
    const quality = (q<HTMLSelectElement>(this.addPopup, '#lit-add-quality')?.value ?? '').trim() || null;
    const pageRaw = (q<HTMLInputElement>(this.addPopup, '#lit-add-page')?.value ?? '').trim();
    const vtitle = (q<HTMLInputElement>(this.addPopup, '#lit-add-vtitle')?.value ?? '').trim();
    const uploader = (q<HTMLInputElement>(this.addPopup, '#lit-add-uploader')?.value ?? '').trim();
    if (!url) { notice('请填写视频链接或 BV 号', 'error'); return; }
    if (start === null || end === null) { notice('时间格式看不懂：支持 12.2 / 12-2 / 1:30:05 等，单个数字按分钟算', 'error'); return; }
    if ((!start && end) || (start && !end)) { notice('开始与结束时间需成对填写（都留空 = 整片）', 'error'); return; }
    let page: number | null = null;
    if (pageRaw) {
      const n = Number(pageRaw);
      if (!Number.isInteger(n) || n < 1) { notice('分P 应为正整数（留空 = 第 1 P）', 'error'); return; }
      page = n;
    }
    try {
      // 不带 remark：编辑旧任务时保留既有备注（数据格式兼容冻结），新任务备注恒空
      const patch = { url, start: start || null, end: end || null, quality, page, title: vtitle || null, uploader: uploader || null };
      if (this.editingId) {
        await LiteratureData.updateTask(this.editingId, patch);
        emitDomainEvent('literature:tasks', { kind: 'edited', id: this.editingId });
      } else {
        await LiteratureData.addTask(patch);
        emitDomainEvent('literature:tasks', { kind: 'added', url });
      }
      notice('已保存');
      this.hideAddDialog();
      await this.refreshVideoPanel();
    } catch (e: any) {
      notice('保存失败：' + (e?.message ?? String(e)), 'error');
    }
  }

  // ==================== 历史弹窗 ====================

  createHistoryUI(): void {
    const mask = document.createElement('div');
    mask.id = 'literature-history-mask';
    mask.className = 'bz-lit-mask';
    mask.style.display = 'none';
    mask.onclick = () => this.hideHistory();
    const popup = document.createElement('div');
    popup.id = 'literature-history-popup';
    popup.className = 'bz-lit-window';
    popup.style.display = 'none';
    const header = document.createElement('div');
    header.className = 'bz-win-head';
    header.innerHTML = `
      <h3 style="margin:0;font-size:16px;font-weight:600;color:var(--text-normal);">文献盒 · 历史</h3>
      <div class="bz-lit-head-btns">
        <button id="lit-history-close" class="bz-win-close" title="关闭">✕</button>
      </div>`;
    const list = document.createElement('div');
    list.id = 'literature-history-list';
    list.className = 'bz-lit-list';
    popup.appendChild(header);
    popup.appendChild(list);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    this.historyMask = mask;
    this.historyPopup = popup;
    this.historyList = list;
    q<HTMLButtonElement>(popup, '#lit-history-close')!.onclick = () => this.hideHistory();
  }

  /** 历史独立弹窗（ADR-0070）：视频面板之上叠开，遮罩 + ✕/ESC/点遮罩关闭 */
  showHistory(): void {
    if (!this.historyPopup || !this.historyMask) return;
    applyMobileWindowFullscreen(this.historyPopup, tryGetSettings().literatureMobileDefaultFullscreen === true);
    topifyZ(this.historyMask, this.historyPopup);
    this.historyMask.style.display = 'block';
    this.historyPopup.style.display = 'flex';
    void this.refreshHistory();
  }

  hideHistory(): void {
    if (this.historyMask) this.historyMask.style.display = 'none';
    if (this.historyPopup) this.historyPopup.style.display = 'none';
  }

  /** 历史列表（ADR-0070）：无条带无成功徽标；同一视频的多条文献笔记归并在一张卡片内分组列出 */
  private async refreshHistory(): Promise<void> {
    if (!this.historyList) return;
    const tasks = await LiteratureData.loadTasks();
    if (!this.historyList) return;
    this.historyList.innerHTML = '';
    const rows = tasks.filter((t) => t.archived);
    if (rows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bz-bili-empty';
      empty.textContent = '暂无历史记录。成功的任务完成时会自动归档到这里。';
      this.historyList.appendChild(empty);
      return;
    }
    // 按 url 分组（同一视频不同分P/起止 = 多条任务 → 多份文献笔记），组内按完成时间正序，组间按最新完成倒序
    const groups = new Map<string, LiteratureTask[]>();
    for (const t of rows) {
      const key = t.url || t.id;
      const g = groups.get(key);
      if (g) g.push(t);
      else groups.set(key, [t]);
    }
    const sortedGroups = Array.from(groups.values()).map((g) => {
      g.sort((a, b) => String(a.processedAt || a.created).localeCompare(String(b.processedAt || b.created)));
      return g;
    });
    sortedGroups.sort((a, b) => {
      const la = String(a[a.length - 1]?.processedAt || a[a.length - 1]?.created || '');
      const lb = String(b[b.length - 1]?.processedAt || b[b.length - 1]?.created || '');
      return lb.localeCompare(la);
    });
    for (const g of sortedGroups) this.historyList.appendChild(this.renderHistoryGroup(g));
  }

  /** 历史分组卡片：标题链接（UP主名紧随其后，ADR-0070）+ 每条任务一行「📄 笔记路径 ⏱ 完成时间」 */
  private renderHistoryGroup(group: LiteratureTask[]): HTMLElement {
    const head = group[0];
    const card = document.createElement('div');
    card.className = 'bz-bili-task-card bz-bili-hgroup';
    card.dataset.url = head.url || '';
    const href = head.url ? `href="${esc(head.url)}"` : '';
    const upText = head.uploader ? `<span class="bz-bili-hup">${esc(head.uploader)}</span>` : '';
    const countText = group.length > 1 ? `<span class="bz-bili-hcount">${group.length} 条笔记</span>` : '';
    card.innerHTML = `
      <div class="bz-bili-row">
        ${head.title
          ? `<a class="bz-bili-title" ${href} title="${esc(head.url || '')}">${esc(head.title)}</a>`
          : `<span class="bz-bili-url" title="${esc(head.url || '')}">${esc(shortUrlText(head.url || ''))}</span>`}
        ${upText}
        ${countText}
      </div>`;
    for (const task of group) {
      const line = document.createElement('div');
      line.className = 'bz-bili-hnote';
      line.innerHTML = `📄 ${esc(task.notePath || '')}<span class="bz-bili-hnote-time">⏱ ${esc(task.processedAt || task.created || '')}</span>`;
      line.addEventListener('click', () => { if (task.notePath) this.openNote(task.notePath); });
      const actions: ItemAction[] = [];
      if (task.notePath) actions.push({ icon: 'book-open', label: '打开文献笔记', onClick: () => this.openNote(task.notePath!) });
      if (task.videoPath) actions.push({ icon: 'copy', label: '复制视频路径', onClick: () => void this.copyText(task.videoPath!) });
      actions.push({ icon: 'trash-2', label: '移出历史', kind: 'danger', onClick: () => void this.confirmDelete(task) });
      attachItemActions(line, actions);
      card.appendChild(line);
    }
    const link = q<HTMLAnchorElement>(card, '.bz-bili-title');
    if (link && head.url) link.onclick = (e) => { e.stopPropagation(); this._openExternal(head.url); };
    return card;
  }

  // ==================== 术语生成面板（文字录入，ticket 136 §6） ====================

  createTermUI(): void {
    const mask = document.createElement('div');
    mask.id = 'literature-term-mask';
    mask.className = 'bz-lit-mask';
    mask.style.display = 'none';
    mask.onclick = () => this.hideTermEntry();
    const popup = document.createElement('div');
    popup.id = 'literature-term-popup';
    popup.className = 'bz-lit-dialog bz-lit-term-dialog';
    popup.style.display = 'none';
    const header = document.createElement('div');
    header.className = 'bz-win-head';
    header.innerHTML = `
      <h3 style="margin:0;font-size:15px;font-weight:600;color:var(--text-normal);">术语生成文献笔记</h3>`;
    const body = document.createElement('div');
    body.className = 'bz-lit-term-body';
    body.innerHTML = `
      <label style="font-size:12px;color:var(--text-muted);">术语</label>
      <input id="lit-term-input" type="text" placeholder="如 黑洞 / 贝叶斯定理" style="width:100%;box-sizing:border-box;">
      <div style="margin-top:10px;">
        <button id="lit-term-generate">生成</button>
      </div>
      <div id="lit-term-preview" class="bz-lit-term-preview" style="display:none;">
        <label style="font-size:12px;color:var(--text-muted);">领域（可改，留空 = 无）</label>
        <input id="lit-term-domain" type="text" placeholder="领域词，如 物理" style="width:100%;box-sizing:border-box;">
        <label style="font-size:12px;color:var(--text-muted);">简介（可编辑）</label>
        <textarea id="lit-term-body" rows="7" placeholder="AI 生成的百科式简介…" style="width:100%;box-sizing:border-box;resize:vertical;"></textarea>
        <div class="bz-lit-term-actions">
          <button id="lit-term-regenerate">重新生成</button>
          <button id="lit-term-save" style="background:var(--interactive-accent);color:var(--text-on-accent);">确认写入</button>
        </div>
      </div>`;
    popup.appendChild(header);
    popup.appendChild(body);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    this.termMask = mask;
    this.termPopup = popup;
    q<HTMLButtonElement>(popup, '#lit-term-generate')!.onclick = () => void this.onTermGenerate();
    q<HTMLButtonElement>(popup, '#lit-term-regenerate')!.onclick = () => void this.onTermGenerate();
    q<HTMLButtonElement>(popup, '#lit-term-save')!.onclick = () => void this.onTermConfirm();
  }

  /** 打开术语生成面板；term 预填输入框（命令入口带编辑器选中词；主面板入口不带） */
  showTermEntry(term?: string): void {
    if (!this.termPopup || !this.termMask) return;
    this.termPreview = null;
    const input = q<HTMLInputElement>(this.termPopup, '#lit-term-input');
    if (input) input.value = (term ?? '').trim();
    this.setTermPreviewVisible(false);
    this.setTermGenLoading(false);
    topifyZ(this.termMask, this.termPopup);
    this.termMask.style.display = 'block';
    this.termPopup.style.display = 'flex';
  }

  private setTermPreviewVisible(v: boolean): void {
    if (!this.termPopup) return;
    const p = q<HTMLElement>(this.termPopup, '#lit-term-preview');
    if (p) p.style.display = v ? 'block' : 'none';
  }

  private setTermGenLoading(loading: boolean): void {
    if (!this.termPopup) return;
    const gen = q<HTMLButtonElement>(this.termPopup, '#lit-term-generate');
    if (gen) { gen.disabled = loading; gen.textContent = loading ? '生成中…' : '生成'; }
    const regen = q<HTMLButtonElement>(this.termPopup, '#lit-term-regenerate');
    if (regen) regen.disabled = loading;
    const save = q<HTMLButtonElement>(this.termPopup, '#lit-term-save');
    if (save) save.disabled = loading;
  }

  private noticeTermError(e: unknown): void {
    const msg = String((e && (e as any).message) || e || '未知错误');
    if (/API Key|AI 配置|未配置/.test(msg)) {
      notice('未配置 AI：请在插件设置 → AI 配置里填 API Key 后再生成', 'error');
    } else {
      notice('生成失败：' + msg, 'error');
    }
  }

  /** 生成/重新生成：调 generateTermNote({term}) 取 AI 简介 → 预览（丢弃上一版草稿与手改） */
  private async onTermGenerate(): Promise<void> {
    if (!this.termPopup || this.termGenerating) return;
    const term = (q<HTMLInputElement>(this.termPopup, '#lit-term-input')?.value ?? '').trim();
    if (!term) { notice('请输入术语', 'error'); return; }
    this.termGenerating = true;
    this.setTermGenLoading(true);
    try {
      const path = await this.generateTermDraft(term);
      await this.presentTermPreview(path);
    } catch (e) {
      this.noticeTermError(e);
    } finally {
      this.termGenerating = false;
      this.setTermGenLoading(false);
    }
  }

  /**
   * 生成一篇术语草稿笔记：先调 generateTermNote 落盘（note-gen 现行为），成功后删除上一版草稿
   * （重新生成/确认前旧稿不留——「未确认不落盘」收口，vault 不攒草稿）。
   */
  private async generateTermDraft(term: string): Promise<string> {
    const prev = this.termPreview?.path ?? null;
    const path = await generateTermNote({ term });
    if (prev && prev !== path) {
      try {
        const f = getApp().vault.getAbstractFileByPath(prev);
        if (f) await getApp().vault.delete(f);
      } catch { /* 草稿已不存在 */ }
    }
    return path;
  }

  /** 读草稿内容 → 填充预览（术语输入框不变；领域/正文按 AI 结果，覆盖用户上一轮手改） */
  private async presentTermPreview(path: string): Promise<void> {
    const app = getApp();
    const file = app.vault.getAbstractFileByPath(path) as any;
    let domain = '';
    let body = '';
    if (file) {
      try {
        const content = await app.vault.read(file);
        body = String(content || '').replace(/^---[\s\S]*?---\s*/, '').trim();
        const fm = extractFrontmatter(content);
        domain = String(fm.domain || '').replace(/^"(.*)"$/, '$1').trim();
      } catch { /* 读失败按空预览 */ }
    }
    this.termPreview = { path, domain, body };
    if (!this.termPopup) return;
    const domainEl = q<HTMLInputElement>(this.termPopup, '#lit-term-domain');
    if (domainEl) domainEl.value = domain;
    const bodyEl = q<HTMLTextAreaElement>(this.termPopup, '#lit-term-body');
    if (bodyEl) bodyEl.value = body;
    this.setTermPreviewVisible(true);
  }

  /**
   * 确认写入 = 当前术语再调 generateTermNote 落盘 + 按面板当前值覆盖 domain/正文（vault.modify）
   * → 自动打开新笔记 → term-generated 域事件 → 关闭面板。
   */
  private async onTermConfirm(): Promise<void> {
    if (!this.termPopup || this.termGenerating) return;
    const term = (q<HTMLInputElement>(this.termPopup, '#lit-term-input')?.value ?? '').trim();
    if (!term) { notice('请输入术语', 'error'); return; }
    if (!this.termPreview) { notice('请先点击「生成」获取简介预览', 'info'); return; }
    const domain = (q<HTMLInputElement>(this.termPopup, '#lit-term-domain')?.value ?? '').trim();
    const body = (q<HTMLTextAreaElement>(this.termPopup, '#lit-term-body')?.value ?? '').trim();
    this.termGenerating = true;
    this.setTermGenLoading(true);
    try {
      // 1) 旧预览草稿先删（确认后不再需要；保证 generateTermNote 落盘取干净文件名）
      const prevPath = this.termPreview.path;
      try {
        const f = getApp().vault.getAbstractFileByPath(prevPath);
        if (f) await getApp().vault.delete(f);
      } catch { /* 草稿已不存在 */ }
      // 2) 以面板当前术语为准落盘（AI 重新生成一次，含领域）
      const path = await generateTermNote({ term });
      // 3) 按面板当前值覆盖 domain/正文（有变化才写回）
      const app = getApp();
      const file = app.vault.getAbstractFileByPath(path) as any;
      if (file) {
        const content = await app.vault.read(file);
        const needDomain = domain !== this.termPreview.domain;
        const needBody = body !== this.termPreview.body;
        let updated = content;
        if (needDomain) updated = overrideDomain(updated, domain);
        if (needBody) updated = overrideBody(updated, body);
        if ((needDomain || needBody) && updated !== content) await app.vault.modify(file, updated);
      }
      // 4) 自动打开新笔记
      this.openNote(path);
      // 5) 行为流观察（ticket 136 §10：term-generated，载荷 term/title）
      emitDomainEvent('literature:tasks', { kind: 'term-generated', term, title: term });
      // 6) 关闭面板（草稿已清理，置空防 hideTermEntry 误删刚落盘的笔记）
      this.termPreview = null;
      this.hideTermEntry();
      notice('已生成术语文献笔记：' + term, 'success');
    } catch (e) {
      this.noticeTermError(e);
    } finally {
      this.termGenerating = false;
      this.setTermGenLoading(false);
    }
  }

  /** 关闭术语面板（遮罩 / ESC）；未确认的预览草稿一并删除（未确认不落盘） */
  hideTermEntry(): void {
    if (this.termPreview) {
      const path = this.termPreview.path;
      try {
        const f = getApp().vault.getAbstractFileByPath(path);
        if (f) void getApp().vault.delete(f);
      } catch { /* 草稿已不存在 */ }
    }
    this.termPreview = null;
    if (this.termMask) this.termMask.style.display = 'none';
    if (this.termPopup) this.termPopup.style.display = 'none';
  }

  // ==================== 通用小工具 ====================

  private openNote(path: string): void {
    const app = getApp();
    const file = app.vault.getAbstractFileByPath(path);
    if (file) void app.workspace.getLeaf(false).openFile(file as any);
    else notice('文献笔记不存在：' + path, 'error');
  }

  private async copyWikilink(n: LiteratureNoteEntry): Promise<void> {
    const link = `[[${n.path}|${n.title}]]`;
    try { await navigator.clipboard.writeText(link); notice('已复制双链引用：' + link, 'success'); }
    catch { notice('复制失败', 'error'); }
  }

  private async copyText(text: string): Promise<void> {
    try { await navigator.clipboard.writeText(text); notice('已复制：' + text, 'success'); }
    catch { notice('复制失败', 'error'); }
  }

  /** 外部浏览器打开（app.openUrl 优先，Electron shell 兜底，与收藏本同路径） */
  private _openExternal(url: string): void {
    const app = getApp();
    try {
      (app as any).openUrl(url);
    } catch {
      const w = window as any;
      const electron = w.require && w.require('electron');
      if (electron && electron.shell) electron.shell.openExternal(url);
    }
  }

  destroy(): void {
    this.clearRunTimer();
    this.runState.clear();
    if (this.searchDebounceTimer) { clearTimeout(this.searchDebounceTimer); this.searchDebounceTimer = null; }
    if (this.refreshTimer) { clearTimeout(this.refreshTimer); this.refreshTimer = null; }
    for (const unsub of this.fileListenerRefs) {
      try { unsub(); } catch { /* 忽略 */ }
    }
    this.fileListenerRefs = [];
    this.fileListenerAttached = false;
    document.removeEventListener('keydown', this.onKeydown);
    // 未确认术语草稿清理
    if (this.termPreview) {
      try {
        const f = getApp().vault.getAbstractFileByPath(this.termPreview.path);
        if (f) void getApp().vault.delete(f);
      } catch { /* 忽略 */ }
    }
    this.termPreview = null;
    for (const el of [this.mask, this.popup, this.videoMask, this.videoPopup, this.addMask, this.addPopup, this.historyMask, this.historyPopup, this.termMask, this.termPopup]) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    this.mask = null;
    this.popup = null;
    this.list = null;
    this.videoMask = null;
    this.videoPopup = null;
    this.videoList = null;
    this.addMask = null;
    this.addPopup = null;
    this.historyMask = null;
    this.historyPopup = null;
    this.historyList = null;
    this.termMask = null;
    this.termPopup = null;
  }
}