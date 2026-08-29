/**
 * 文献盒（literature 域）UI（ticket 136 改版，ADR-0072）
 *
 * 三窗口 + 两弹窗：
 * - 主面板（showMain，文献笔记列表）：扫描 settings.literatureDirectory（缺省「文献盒」）下 .md，
 *   经 metadataCache 读 frontmatter（title/type/domain/summary/date…），固定最近创建降序；
 *   领域筛选行（剪藏本 rebuildSiteBar 同款，按 count 降序）+ 类型过滤（全部/视频/术语，可叠加）、
 *   🔍 搜索（标题/简介，300ms 防抖）、scroll 触底懒加载（50px 阈值，批次 20，尾部「已显示所有笔记」）、
 *   literature:file-* 四通道 300ms 防抖增量刷新（照抄剪藏本 attachFileListener/scheduleRefreshFlush）、
 *   文献目录设置变更时清缓存全量重载；卡片 = 标题 + 领域徽标 + 简介两行省略 + 日期（ticket 138 §3.2 去类型徽章），
 *   双击打开笔记（click 计数 300ms，影视先例）、attachItemActions 抽屉（打开/复制双链/
 *   复制原文链接[仅视频有 url]/删除 danger+flow-dialog 确认——删除视频笔记时同步清理
 *   literature.json 指向该笔记的任务记录）；打开主面板时调 backfillNotes() 补全旧笔记。
 * - 视频录入面板（showVideoEntry，任务队列）：原 bili-tasks 面板整体搬入，去掉 ⚙️ 设置 /
 *   ⬇️ 下载按钮；保留 ➕ 添加 / 单钮（纯 emoji ▶️ ↔ ⏹，文字移到 title hover，ticket 148）/ 🕘 历史 / ❌；
 *   移动端仅 ➕ 添加 + ❌（ticket 139/144：批量按钮与历史全部隐藏，移动端无处理能力）。
 *   批处理调 BatchRunner.runAll（work = 非 archived 且 pending/failed），事件回调驱动行内进度/
 *   步骤时间线/完成态文案（STEP_DONE_MAP 覆盖「AI 生成文献笔记中」「笔记落盘中」）+ 整批通知。
 * - 术语生成面板（showTermEntry，文字录入）：遮罩 + 弹窗，术语输入（预填/可改）→ 「生成」调
 *   generateTermDraft(term) 纯 AI 预览（只读展示、纯内存，不写盘；ticket 142 简洁版：无标题/label/
 *   placeholder/状态行，生成中并入按钮文案；预览上属性卡[术语/领域/日期]下内容卡，无输入框不可编辑、
 *   无手改覆盖守卫）→「确认写入」= 调 generateTermNote 传面板当前 term/summary/domain
 *   （所见即所得、不重跑 AI）→ 自动打开新笔记 → emitDomainEvent('literature:tasks',
 *   { kind:'term-generated', term, title }) → 关闭面板。预览阶段不产生任何文件（ticket 138 §2.1）。
 * - 设置面板：主面板 ⚙️ → openSettingsModal（五组声明式 schema，见 literatureSettingsSchema）。
 *
 * 移动端默认全屏（ticket 68 三件事）：主面板 + 历史弹窗 + 视频录入面板三处 applyMobileWindowFullscreen
 * （ticket 139 补齐视频面板）。
 *
 * ticket 139 交互修订：📝/🎬 打开子面板不再隐藏主面板（topifyZ 叠开，关闭子面板回列表）；
 * 文件事件增量刷新走 core patchKeyedCards 只动对应卡片（不再全列表重建，滚动不跳顶）；
 * 打开文献笔记即收起文献盒全部窗口；失败原因行内白话化（humanizeError，原文见 title）；
 * 添加任务弹窗「整片/剪辑」分段开关 + 校验失败聚焦定位；术语面板重设计 + 重新生成手改确认。
 * ticket 142 术语面板简洁版（拍板）：删标题/术语 label/placeholder/状态行（加载并入按钮「生成中…」），
 * 预览只读——上属性卡（术语/领域/日期）下内容卡，无输入框不可编辑，「重新生成」手改守卫随之删除。
 * ticket 143 全部窗口简洁布局 A（拍板）：主面板与视频录入**保留原标题**（用户拍板「还是使用之前的标题」），
 * 添加弹窗去标题（编辑态右上角小标签）+ 链接输入 label + 整片/剪辑开关同行 + 默认剪辑片段 + 分P 去括号
 * + 去 placeholder + 失败提示条中性化；搜索框简洁化（去 placeholder，盒内 🔍 图标）；
 * 历史去标题（工具栏=计数+❌）+ 组头去「UP主」前缀与「N 条笔记」计数、笔记行去目录去 .md（shortNoteName）、
 * 时间用 formatRelativeTime 相对显示（ticket 143）。
 * ticket 146（用户拍板三改）：① 主面板卡片加大标题/简介/日期间距，日期改 formatRelativeTime 相对显示；
 * ② 视频录入去独立 ⏹ 终止按钮改为单钮态机（ticket 146；ticket 148 起按钮纯 emoji、文字移到
 * title hover）：空闲「▶️」，运行中该按钮即「⏹」（仅失败项续跑时 title 提示「中止整批」），
 * 处理完成有失败仍可再点续跑，移动端整钮隐藏。
 */
import type { App } from 'obsidian';
import type { SettingsSchema } from '../core/settings-schema';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { openSettingsModal } from '../core/settings-modal';
import { mobileFullscreenGroup } from '../core/settings-common';
import { attachItemActions, type ItemAction } from '../core/item-actions';
import { patchKeyedCards } from '../core/list-patch';
import { openFlowDialog } from '../core/flow-dialog';
import { notice } from '../core/notice';
import { formatRelativeTime } from '../core/utils';
import { topifyZ } from '../core/z-order';
import { emitDomainEvent, onDomainEvent } from '../core/domain-bus';
import { getApp } from '../core/app';
import type BzSettings from '../settings';
import { LiteratureData, normalizeLooseTime } from './data';
import type { LiteratureTask } from './types';
import { BatchRunner, type BatchEvents } from './processor';
import { backfillNotes, generateTermDraft, generateTermNote, summarizeTermSummary } from './note-gen';

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

/** 历史笔记行展示名：去目录（含反斜杠兼容）去 .md 后缀（ticket 143）；空路径回退原串 */
function shortNoteName(path: string): string {
  const base = String(path || '').replace(/\\/g, '/').split('/').pop() || '';
  return base.replace(/\.md$/i, '') || String(path || '');
}

/**
 * 失败原因白话化（ticket 139，渲染层）：外部工具 stderr / AI 报错多为英文原文，
 * 行内直出对使用者不可读。按常见失败模式映射为一句中文白话；未命中返回截断原文。
 * 原文始终保留在卡片 title 悬浮与编辑弹窗失败提示条，白话只做行内展示。
 */
export function humanizeError(reason: string | null | undefined): string {
  const s = String(reason ?? '').trim();
  if (!s) return '';
  // bili-dl 未安装（processor INSTALL_HINT 或 spawn ENOENT）
  if (/未找到 bili-dl|npm install -g @jwbz\/bili-downloader|ENOENT.*bili-dl/i.test(s)) {
    return '下载工具未安装：在电脑上运行 npm install -g @jwbz/bili-downloader 后重试';
  }
  if (/ffmpeg/i.test(s)) return '视频处理工具（ffmpeg）不可用：检查电脑是否已安装，或设置里的「ffmpeg 路径」';
  if (/ffprobe/i.test(s)) return '视频探测工具（ffprobe）不可用：检查电脑是否已安装，或设置里的「ffprobe 路径」';
  // Python 本身找不到（pythonPath 不可执行：spawn ENOENT / 启动失败）——消息不含 whisper 词，须独立匹配
  if (/找不到 Python|无法启动 Python|python.*ENOENT/i.test(s)) {
    return '语音转写失败：未找到 Python——设置里「Python 路径」填 python（一般装了 Python 即可），或运行 where python 查绝对路径填入';
  }
  // pythonPath 未配置（设置留空且工具 rc/DEFAULTS 也无兜底）
  if (/未配置 pythonPath/i.test(s)) {
    return '语音转写未配置：文献盒设置「Python 路径」填 python 即可（一般装了 Python 就能用，走系统 PATH），或填绝对路径（Windows 在命令提示符运行 where python 可查）';
  }
  if (/pip install faster-whisper|faster-whisper 环境已安装/i.test(s)) {
    return '语音转写失败：faster-whisper 未安装，请在目标 Python 中运行 pip install faster-whisper';
  }
  if (/whisper|faster.whisper|no module/i.test(s)) {
    return '语音转写失败：检查设置里的「Python 路径」与「Whisper 模型」';
  }
  if (/API Key|AI 配置|未配置|Unauthorized|\b401\b|invalid_api_key|insufficient|quota/i.test(s)) {
    return 'AI 配置不可用：请在插件设置 → AI 配置里检查 API Key';
  }
  if (/AI 请求超时|AI 返回的不是 JSON/i.test(s)) return 'AI 响应异常：网络不稳定或服务繁忙，稍后重试';
  if (/转录文件读取失败|无转录文件/i.test(s)) return '转写稿缺失：视频处理步骤未完成，可重试';
  if (/ETIMEDOUT|ESOCKETTIMEDOUT|timed? ?out|超时/i.test(s)) return '网络超时：请检查网络连接后重试';
  if (/ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|getaddrinfo|fetch failed/i.test(s)) {
    return '网络连接失败：请检查网络或代理设置后重试';
  }
  if (/^-352|\b412\b|风控|请求过于频繁/i.test(s)) return 'B 站风控拦截：稍后再试，或在设置里配置登录 Cookie';
  if (/视频不存在|稿件不存在|\b404\b|not found/i.test(s)) return '视频不存在或已删除：请检查链接是否正确';
  return s.length > 160 ? s.slice(0, 160) + '…' : s;
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
          { type: 'text', name: 'Python 路径', desc: '装了 Python 一般填 python 即可（走系统 PATH）；或填绝对路径（命令提示符运行 where python 可查）；留空跟随工具配置', binding: { key: 'literaturePythonPath' }, placeholder: '如 python 或 D:/tools/python.exe' },
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
  /** 当前术语预览（面板当前展示值，纯内存；确认前不落盘，ticket 138 §2.1） */
  private termPreview: { domain: string; body: string } | null = null;
  private termGenerating = false;
  /** 总结中（ticket 155：底部按钮对预览正文做 AI 精简） */
  private termSummarizing = false;
  /** 本轮是否已有生成结果（ticket 155：有则输入行按钮文案为「重新生成」） */
  private termHasDraft = false;

  private editingId: string | null = null;
  private onKeydown: (e: KeyboardEvent) => void = () => {};
  /** 运行中终止按钮文案（ticket 146 单钮态机）：整批=「终止」；仅失败项续跑=「终止整批」；空闲=null */
  private batchAbortLabel: '终止' | '终止整批' | null = null;
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
    // 幂等重入守卫（review createMainUI 先例，ticket 138 §1.2）：掩码/窗口已挂载在 DOM 则复用；
    // 节点被外部移除时自动重建（showMain 每次调此）——保证 bz-literature-open 单击即开、幂等。
    if ((this.mask && this.mask.isConnected) || (this.popup && this.popup.isConnected)) return;
    const mask = document.createElement('div');
    mask.id = 'literature-mask';
    mask.className = 'bz-lit-mask';
    mask.style.display = 'none';
    mask.onclick = () => this.hideMain();

    const popup = document.createElement('div');
    popup.id = 'literature-popup';
    popup.className = 'bz-lit-window';
    popup.style.display = 'none';

    // 主面板保留原标题（用户拍板，ticket 143）：bz-win-head「文献盒」+ 动作钮；领域筛选 chips 在下方独立行
    const header = document.createElement('div');
    header.className = 'bz-win-head';
    header.innerHTML = `
      <h3 class="bz-lit-title">文献盒</h3>
      <div class="bz-lit-head-btns">
        <button id="lit-btn-text" title="文字录入：术语生成文献笔记">📝</button>
        <button id="lit-btn-video" title="视频录入：添加转文献任务并批处理">🎬</button>
        <button id="lit-btn-search" title="切换搜索框">🔍</button>
        <button id="lit-btn-settings" title="设置">⚙️</button>
        <button id="lit-btn-close" class="bz-win-close" title="关闭">❌</button>
      </div>`;
    popup.appendChild(header);
    const barBox = document.createElement('div');
    barBox.className = 'bz-lit-filterbar';
    const siteBar = document.createElement('div');
    siteBar.id = 'literature-sitebar';
    siteBar.className = 'bz-lit-sitebar';
    barBox.appendChild(siteBar);
    popup.appendChild(barBox);

    // 搜索框（🔍 按钮切换显隐，剪藏本同款；简洁版：无 placeholder，盒内 🔍 图标自明，ticket 143）
    const searchContainer = document.createElement('div');
    searchContainer.id = 'literature-search-container';
    searchContainer.className = 'bz-lit-search';
    searchContainer.style.display = 'none';
    const searchBox = document.createElement('div');
    searchBox.className = 'bz-lit-search-box';
    const searchIc = document.createElement('span');
    searchIc.className = 'bz-lit-search-ic';
    searchIc.textContent = '🔍';
    const searchInput = document.createElement('input');
    searchInput.id = 'literature-search-input';
    searchInput.type = 'text';
    searchInput.addEventListener('input', (e) => {
      const keyword = (e.target as HTMLInputElement).value.trim();
      if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.searchKeyword = keyword;
        this.applyFilter();
      }, 300);
    });
    searchBox.appendChild(searchIc);
    searchBox.appendChild(searchInput);
    searchContainer.appendChild(searchBox);
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
    // 文字录入 → 术语生成面板；视频录入 → 任务队列（ticket 139：不隐藏主面板，子面板 topifyZ
    // 叠开，关闭子面板自然回到主面板——原「隐藏当前窗开目标窗」导致关闭后回不到列表）
    q<HTMLButtonElement>(p, '#lit-btn-text')!.onclick = () => {
      this.showTermEntry();
    };
    q<HTMLButtonElement>(p, '#lit-btn-video')!.onclick = () => {
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
  }

  /** 打开主面板（文献笔记列表）：移动端默认全屏、抬顶、刷新列表 + 旧笔记自动补全 */
  showMain(): void {
    this.createMainUI(); // 自愈（ticket 138 §1.2）：DOM 丢失时重建，单击即开、幂等
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
    if (this.allNotes.length === 0) this.showListLoading(); // 首载/目录切换：加载态防白屏（ticket 139）
    await this.loadNotes();
    if (!this.list) return; // await 期间面板被销毁 → 放弃渲染
    this.rebuildDomainBar();
    this.applyFilter(); // 以全部笔记（+当前筛选态）重建 filteredNotes 并渲染；纯 renderList 不会灌 filteredNotes
  }

  /** 列表加载中占位（renderList(true) 重建时自然清掉；ticket 139） */
  private showListLoading(): void {
    if (!this.list) return;
    this.list.innerHTML = '';
    const loading = document.createElement('div');
    loading.className = 'bz-lit-loading bz-lit-empty';
    loading.textContent = '正在扫描文献目录…';
    this.list.appendChild(loading);
  }

  /** 扫描「文献目录」下全部 .md（含嵌套子目录——与 backfillNotes 前缀匹配口径一致，P3-5；
 *  metadataCache 解析 frontmatter；不含文件本体 I/O） */
  private async loadNotes(): Promise<void> {
    const app = getApp();
    const dir = litDirOf(tryGetSettings());
    const prefix = dir + '/';
    const mdFiles = (app.vault.getFiles() || []).filter((f: any) => f.path.startsWith(prefix) && f.extension === 'md');
    let entries: LiteratureNoteEntry[] = [];
    entries = (await Promise.all(mdFiles.map((f: any) => this.parseNoteFile(f)))).filter((e): e is LiteratureNoteEntry => e !== null);
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

  /** 纯筛选重算（不动渲染与懒加载计数）：领域筛选（叠加）→ 搜索（标题/简介） */
  private refilter(): void {
    let list = this.allNotes;
    if (this.selectedDomain) list = list.filter((n) => (n.domain || '未分类') === this.selectedDomain);
    if (this.searchKeyword) {
      const kw = this.searchKeyword.toLowerCase();
      list = list.filter((n) => n.title.toLowerCase().includes(kw) || n.summary.toLowerCase().includes(kw));
    }
    this.filteredNotes = list;
  }

  /** 用户主动筛选/搜索：计数复位从头渲染（回顶是预期行为） */
  private applyFilter(): void {
    this.refilter();
    this.currentDisplayCount = 0;
    this.allLoaded = false;
    this.rebuildDomainBar(); // 活跃态随筛选重算（切「全部」/单域后高亮必须同步，勿漏）
    this.renderList(true);
  }

  /**
   * 文件事件增量路径（ticket 139）：不重建整个列表 DOM（滚动跳顶根因），
   * core patchKeyedCards 只增/删/移/换差异卡片；changedPaths 为内容需重建的 key。
   */
  private patchList(changedPaths: ReadonlySet<string> = new Set()): void {
    if (!this.list) return;
    this.currentDisplayCount = Math.min(this.currentDisplayCount, this.filteredNotes.length);
    const keys = this.filteredNotes.slice(0, this.currentDisplayCount).map((n) => n.path);
    patchKeyedCards({
      container: this.list,
      keyAttr: 'path',
      keys,
      render: (p) => {
        const n = this.filteredNotes.find((x) => x.path === p);
        return n ? this.renderNoteCard(n) : null;
      },
      changedKeys: changedPaths,
    });
    this.allLoaded = this.currentDisplayCount >= this.filteredNotes.length;
    this.syncListHints();
  }

  /** 空态 / 懒加载尾部提示与增量 patch 后的列表状态同步（全量 renderList 亦复用收尾） */
  private syncListHints(): void {
    if (!this.list) return;
    let empty = q<HTMLElement>(this.list, '.bz-lit-empty');
    let tail = q<HTMLElement>(this.list, '.bz-lit-tail');
    if (this.filteredNotes.length === 0) {
      if (tail) tail.remove();
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'bz-lit-empty';
        empty.textContent = this.selectedDomain || this.searchKeyword
          ? '没有符合条件的文献笔记'
          : `「${this.loadedDir || litDirOf(tryGetSettings())}」还没有文献笔记`;
        this.list.appendChild(empty);
      }
      return;
    }
    if (empty) empty.remove();
    if (this.allLoaded) {
      if (!tail) {
        tail = document.createElement('div');
        tail.className = 'bz-lit-tail';
        tail.textContent = '已显示所有笔记';
      }
      this.list.appendChild(tail); // appendChild 自带移动语义：patch 后恒在末尾，幂等
    } else if (tail) {
      tail.remove();
    }
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
        empty.textContent = this.selectedDomain || this.searchKeyword
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

  /** 文献笔记卡片：标题 + 领域徽标 + 简介两行省略 + 日期；双击打开 + 抽屉（类型徽章已移除，ticket 138 §3.2） */
  private renderNoteCard(n: LiteratureNoteEntry): HTMLElement {
    const card = document.createElement('div');
    card.className = 'bz-lit-card';
    card.dataset.path = n.path;
    const domainBadge = n.domain ? `<span class="bz-lit-badge bz-lit-badge-domain">${esc(n.domain)}</span>` : '';
    // ticket 146：日期用 BZ 相对时间函数（历史/主面板同口径）；无效日期回退原文，空日期不显示
    let dateText = '';
    if (n.date) {
      const rel = formatRelativeTime(n.date);
      dateText = rel === '无效日期' ? n.date : rel;
    }
    card.innerHTML = `
      <div class="bz-lit-card-title-row">
        <span class="bz-lit-card-title">${esc(n.title || '无标题')}</span>
        ${domainBadge}
      </div>
      <div class="bz-lit-card-summary">${esc(n.summary || '（无简介）')}</div>
      <div class="bz-lit-card-date">${esc(dateText)}</div>`;
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
    this.refilter();
    this.patchList(); // 被 key 不在目标区段 → patch 自动移除该卡；其余卡片原样复用（滚动不跳）
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
      const isNew = !this.allNotes.some((n) => n.path === path);
      const idx = this.allNotes.findIndex((n) => n.path === path);
      if (idx >= 0) this.allNotes[idx] = entry;
      else this.allNotes.push(entry);
      this.allNotes.sort((a, b) => (b.created - a.created) || a.path.localeCompare(b.path));
      this.refilter();
      if (isNew) {
        // 新增条目落在已显示区段内（或列表为空/区段未开）→ 区段 +1，避免把区段尾部已有卡片挤出屏幕
        const fi = this.filteredNotes.findIndex((n) => n.path === path);
        if (fi >= 0 && (fi < this.currentDisplayCount || this.currentDisplayCount === 0)) this.currentDisplayCount++;
      }
      this.patchList(new Set([path]));
      this.rebuildDomainBar(); // 领域徽标/计数可能随内容变化
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
    // 视频录入保留原标题（用户拍板，ticket 143）：bz-win-head「视频录入」+ 动作钮；
    // 标题后的灰色状态计数小字已去掉（用户拍板「去掉后面的灰色小字」）
    const header = document.createElement('div');
    header.className = 'bz-win-head';
    header.innerHTML = `
      <h3 class="bz-lit-title">视频录入</h3>
      <div class="bz-lit-head-btns">
        <button id="lit-btn-video-add" title="添加转文献任务">➕</button>
        <button id="lit-btn-video-run" class="bz-lit-run-btn" title="批量处理（桌面端）">▶️</button>
        <button id="lit-btn-video-history" title="历史">🕘</button>
        <button id="lit-btn-video-close" class="bz-win-close" title="关闭">❌</button>
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
    // 移动端仅 ➕ 添加 + ✕（ticket 139/144：单钮批量按钮与历史全部隐藏——移动端无处理能力，
    // 历史入口一并收起；原 ticket 136 §5 仅藏 处理/中止）
    if (isMobileEnv()) {
      const run = q<HTMLButtonElement>(popup, '#lit-btn-video-run');
      const history = q<HTMLButtonElement>(popup, '#lit-btn-video-history');
      if (run) run.style.display = 'none';
      if (history) history.style.display = 'none';
    }
  }

  private _bindVideoHeaderEvents(): void {
    const p = this.videoPopup;
    if (!p) return;
    q<HTMLButtonElement>(p, '#lit-btn-video-add')!.onclick = () => this.showAddDialog();
    // ticket 146 单钮态机：运行中该按钮即「终止」控制（onAbortBatch），空闲即「批量处理」（ticket 148 起纯 emoji）
    q<HTMLButtonElement>(p, '#lit-btn-video-run')!.onclick = () => {
      if (BatchRunner.running) void this.onAbortBatch();
      else void this.onRunBatch();
    };
    q<HTMLButtonElement>(p, '#lit-btn-video-history')!.onclick = () => this.showHistory();
    q<HTMLButtonElement>(p, '#lit-btn-video-close')!.onclick = () => this.hideVideo();
  }

  /** 打开视频录入面板（任务队列）；prefill 存在则叠开添加弹窗（聚合讯「保存至文献」入口，ADR-0068）。
   *  移动端默认全屏（ticket 139：主面板/历史弹窗同款三件事对齐）。 */
  showVideoEntry(prefill?: { url: string; title?: string | null; uploader?: string | null }): void {
    if (!this.videoPopup || !this.videoMask) return;
    applyMobileWindowFullscreen(this.videoPopup, tryGetSettings().literatureMobileDefaultFullscreen === true);
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

  /**
   * ticket 146 单钮态机（去独立 ⏹ 按钮；ticket 148 起按钮纯 emoji、文字移到 title hover）：
   * 空闲 = 「▶️」（无工作禁用；完成有失败仍在 → 可再点续跑）；运行中 = 该按钮即终止控制「⏹」——
   * 整批 title「中止批量处理」/ 仅失败项续跑 title「中止整批（处理失败任务中）」；移动端整钮隐藏（isMobileEnv）。
   */
  private _syncRunButton(tasks: LiteratureTask[]): void {
    if (!this.videoPopup) return;
    const run = q<HTMLButtonElement>(this.videoPopup, '#lit-btn-video-run');
    if (!run) return;
    const running = BatchRunner.running;
    const hasWork = tasks.some((t) => t.status === 'pending' || t.status === 'failed');
    if (running) {
      run.disabled = false; // 运行中按钮 = 终止控制，必须可点
      const retry = this.batchAbortLabel === '终止整批';
      // ticket 148 纯 emoji：文字移到 title 提示，按钮只显示图形（终止/终止整批同图，靠 title 区分）
      run.textContent = '⏹';
      run.title = retry ? '中止整批（处理失败任务中）' : '中止批量处理';
    } else {
      run.disabled = !hasWork;
      run.textContent = '▶️';
      run.title = '批量处理（桌面端）';
    }
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
      ${task.status === 'failed' && task.reason ? `<div class="bz-bili-progress bz-bili-progress-error" title="${esc(task.reason)}">${esc(humanizeError(task.reason))}</div>` : ''}
      ${task.status === 'success' && task.notePath ? `<div class="bz-bili-note">📄 ${esc(task.notePath)}</div>` : ''}`;
    const actions = this.buildCardActions(task);
    if (actions.length) attachItemActions(card, actions);
    // 标题链接：浏览器打开（不停泡点击分流的冒泡）
    const titleLink = q<HTMLAnchorElement>(card, '.bz-bili-title');
    if (titleLink) titleLink.onclick = (e) => { e.stopPropagation(); this._openExternal(titleLink.href || task.url); };
    // 点击分流：成功→打开文献笔记；待处理/失败→编辑（失败编辑弹窗带原因提示条，ticket 139；
    // 处理中不响应——中途不可改，拍板 ADR-0070）
    card.addEventListener('click', () => {
      if (task.status === 'success' && task.notePath) this.openNote(task.notePath);
      else if (task.status === 'pending' || task.status === 'failed') this.showAddDialog(task);
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
    // ticket 146：整批（含待处理项）→ 终止按钮文案「终止」；仅失败项续跑 →「终止整批」；仅文案区分，中止行为一致
    this.batchAbortLabel = work.every((t) => t.status === 'failed') ? '终止整批' : '终止';
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
    // runAll 同步段已置 running=true → 刷新一次让按钮立即转为「终止/终止整批」（不等首个任务事件）
    const runP = BatchRunner.runAll(work, events);
    void this.refreshVideoPanel();
    try {
      await runP;
    } finally {
      this.batchAbortLabel = null;
    }
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
    // ticket 143 简洁版（拍板布局 A）：无标题（编辑态右上角小标签 #lit-add-mode 表意）、
    // 链接输入框上方 label 且与整片/剪辑开关同行、分P 去括号、去 placeholder、失败提示条中性化
    popup.innerHTML = `
      <div id="lit-add-mode" class="bz-lit-mode-tag" style="display:none;">编辑任务</div>
      <div id="lit-add-fail" class="bz-lit-form-alert" style="display:none;"></div>
      <div class="bz-lit-form-col bz-lit-url-col">
        <label>视频链接 / BV 号</label>
        <div class="bz-lit-url-row">
          <input id="lit-add-url" type="text">
          <div class="bz-lit-range-toggle" id="lit-add-range">
            <button type="button" data-range="whole">整片</button>
            <button type="button" data-range="clip">剪辑片段</button>
          </div>
        </div>
      </div>
      <div class="bz-lit-form-row">
        <div class="bz-lit-form-col"><label>视频标题（可选）</label>
          <input id="lit-add-vtitle" type="text"></div>
        <div class="bz-lit-form-col"><label>UP主（可选）</label>
          <input id="lit-add-uploader" type="text"></div>
      </div>
      <div class="bz-lit-form-row">
        <div class="bz-lit-form-col"><label>下载清晰度</label>
          <select id="lit-add-quality">
            <option value="">跟随全局设置</option>
            <option value="highest">最高</option>
            <option value="1080">1080P</option>
            <option value="720">720P</option>
          </select></div>
        <div class="bz-lit-form-col"><label>分P</label>
          <input id="lit-add-page" type="number" min="1" step="1"></div>
      </div>
      <div id="lit-add-clip-fields" style="display:none;">
        <div class="bz-lit-form-row">
          <div class="bz-lit-form-col"><label>开始时间</label>
            <input id="lit-add-start" type="text"></div>
          <div class="bz-lit-form-col"><label>结束时间</label>
            <input id="lit-add-end" type="text"></div>
        </div>
      </div>
      <div class="bz-lit-form-actions">
        <button id="lit-add-save" class="bz-lit-accent-btn">保存</button>
      </div>`;
    document.body.appendChild(addMask);
    document.body.appendChild(popup);
    this.addMask = addMask;
    this.addPopup = popup;
    q<HTMLButtonElement>(popup, '#lit-add-save')!.onclick = () => void this._handleAddSave();
    // 整片/剪辑分段开关（ticket 139）：剪辑才展开时间输入
    const rangeBox = q<HTMLElement>(popup, '#lit-add-range');
    if (rangeBox) {
      rangeBox.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('button[data-range]');
        if (btn) this._setAddRangeMode(btn.getAttribute('data-range') === 'clip' ? 'clip' : 'whole');
      });
    }
    // 表单内 Enter 直接保存（ticket 139）
    for (const sel of ['#lit-add-url', '#lit-add-vtitle', '#lit-add-uploader', '#lit-add-page', '#lit-add-start', '#lit-add-end']) {
      q<HTMLInputElement>(popup, sel)?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); void this._handleAddSave(); }
      });
    }
  }

  showAddDialog(editItem?: Partial<LiteratureTask>): void {
    if (!this.addPopup || !this.addMask) return;
    this.editingId = editItem?.id ?? null;
    // 有 id = 编辑既有任务；无 id（含预填对象）= 新增模式（ticket 134：聚合讯入口预填不显示编辑态）；
    // ticket 143：无标题，编辑态以右上角小标签 #lit-add-mode 表意
    const modeTag = q<HTMLElement>(this.addPopup, '#lit-add-mode');
    if (modeTag) modeTag.style.display = this.editingId ? 'inline-block' : 'none';
    (q<HTMLInputElement>(this.addPopup, '#lit-add-url')!).value = editItem?.url ?? '';
    (q<HTMLInputElement>(this.addPopup, '#lit-add-start')!).value = editItem?.start ?? '';
    (q<HTMLInputElement>(this.addPopup, '#lit-add-end')!).value = editItem?.end ?? '';
    (q<HTMLSelectElement>(this.addPopup, '#lit-add-quality')!).value = editItem?.quality ?? '';
    (q<HTMLInputElement>(this.addPopup, '#lit-add-page')!).value = editItem?.page ? String(editItem.page) : '';
    (q<HTMLInputElement>(this.addPopup, '#lit-add-vtitle')!).value = editItem?.title ?? '';
    (q<HTMLInputElement>(this.addPopup, '#lit-add-uploader')!).value = editItem?.uploader ?? '';
    // 处理范围（ticket 143 拍板：新任务默认剪辑片段；编辑既有任务仍按 start/end 有无回显）
    this._setAddRangeMode(this.editingId ? (editItem?.start || editItem?.end ? 'clip' : 'whole') : 'clip');
    // 失败任务编辑态：顶部原因提示条（白话 + 悬浮原文，ticket 139）
    const fail = q<HTMLElement>(this.addPopup, '#lit-add-fail');
    if (fail) {
      const reason = editItem?.status === 'failed' ? (editItem.reason || '') : '';
      fail.style.display = reason ? 'block' : 'none';
      fail.textContent = reason ? `上次处理失败：${humanizeError(reason)}` : '';
      fail.title = reason;
    }
    topifyZ(this.addMask, this.addPopup); // ADR-0067：显示即发号
    this.addMask.style.display = 'block';
    this.addPopup.style.display = 'flex';
    const urlInput = q<HTMLInputElement>(this.addPopup, '#lit-add-url');
    if (urlInput) setTimeout(() => urlInput.focus(), 100);
  }

  /** 整片/剪辑分段开关：active 高亮 + 时间输入区显隐（ticket 139） */
  private _setAddRangeMode(mode: 'whole' | 'clip'): void {
    if (!this.addPopup) return;
    const box = q<HTMLElement>(this.addPopup, '#lit-add-range');
    if (box) {
      for (const btn of Array.from(box.querySelectorAll('button[data-range]'))) {
        btn.classList.toggle('active', btn.getAttribute('data-range') === mode);
      }
    }
    const clipFields = q<HTMLElement>(this.addPopup, '#lit-add-clip-fields');
    if (clipFields) clipFields.style.display = mode === 'clip' ? 'block' : 'none';
  }

  hideAddDialog(): void {
    if (this.addMask) this.addMask.style.display = 'none';
    if (this.addPopup) this.addPopup.style.display = 'none';
    this.editingId = null;
  }

  private async _handleAddSave(): Promise<void> {
    if (!this.addPopup) return;
    const url = (q<HTMLInputElement>(this.addPopup, '#lit-add-url')?.value ?? '').trim();
    const clipMode = q<HTMLElement>(this.addPopup, '#lit-add-range')?.querySelector('button[data-range].active')?.getAttribute('data-range') === 'clip';
    const startRaw = (q<HTMLInputElement>(this.addPopup, '#lit-add-start')?.value ?? '').trim();
    const endRaw = (q<HTMLInputElement>(this.addPopup, '#lit-add-end')?.value ?? '').trim();
    const start = clipMode ? normalizeLooseTime(startRaw) : '';
    const end = clipMode ? normalizeLooseTime(endRaw) : '';
    const quality = (q<HTMLSelectElement>(this.addPopup, '#lit-add-quality')?.value ?? '').trim() || null;
    const pageRaw = (q<HTMLInputElement>(this.addPopup, '#lit-add-page')?.value ?? '').trim();
    const vtitle = (q<HTMLInputElement>(this.addPopup, '#lit-add-vtitle')?.value ?? '').trim();
    const uploader = (q<HTMLInputElement>(this.addPopup, '#lit-add-uploader')?.value ?? '').trim();
    const focusField = (sel: string): void => q<HTMLInputElement>(this.addPopup!, sel)?.focus();
    if (!url) { notice('请填写视频链接或 BV 号', 'error'); focusField('#lit-add-url'); return; }
    if (clipMode && !startRaw && !endRaw) { notice('剪辑片段需填写开始与结束时间', 'error'); focusField('#lit-add-start'); return; }
    if (start === null || end === null) { notice('时间格式看不懂：支持 12.2 / 12-2 / 1:30:05 等，单个数字按分钟算', 'error'); focusField(start === null ? '#lit-add-start' : '#lit-add-end'); return; }
    if ((!start && end) || (start && !end)) { notice('开始与结束时间需成对填写', 'error'); focusField(start ? '#lit-add-end' : '#lit-add-start'); return; }
    let page: number | null = null;
    if (pageRaw) {
      const n = Number(pageRaw);
      if (!Number.isInteger(n) || n < 1) { notice('分P 应为正整数（留空 = 第 1 P）', 'error'); focusField('#lit-add-page'); return; }
      page = n;
    }
    try {
      // 不带 remark：编辑旧任务时保留既有备注（数据格式兼容冻结），新任务备注恒空
      const patch = { url, start: start || null, end: end || null, quality, page, title: vtitle || null, uploader: uploader || null };
      // 域事件观察收敛（P3-2）：新增/编辑不再发射 added/edited（smartcat 对其返回 null），
      // literature:tasks 只剩 converted（processor）与 term-generated（术语面板）两类
      if (this.editingId) {
        await LiteratureData.updateTask(this.editingId, patch);
      } else {
        await LiteratureData.addTask(patch);
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
    // 简洁工具栏（ticket 143）：无标题，历史计数 + 关闭钮同行
    const toolbar = document.createElement('div');
    toolbar.className = 'bz-lit-toolbar';
    const counts = document.createElement('span');
    counts.id = 'lit-history-counts';
    counts.className = 'bz-lit-counts';
    const headBtns = document.createElement('div');
    headBtns.className = 'bz-lit-head-btns';
    headBtns.innerHTML = `
      <button id="lit-history-close" class="bz-win-close" title="关闭">❌</button>`;
    toolbar.appendChild(counts);
    toolbar.appendChild(headBtns);
    const list = document.createElement('div');
    list.id = 'literature-history-list';
    list.className = 'bz-lit-list';
    popup.appendChild(toolbar);
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
    // 工具栏计数（ticket 143：无标题，计数替之）
    const countsEl = this.historyPopup ? q<HTMLElement>(this.historyPopup, '#lit-history-counts') : null;
    if (countsEl) countsEl.textContent = `🕘 历史 · 共 ${rows.length} 条`;
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

  /** 历史分组卡片：标题链接 + UP主名（ticket 143：去掉「UP主」前缀与「N 条笔记」计数）；
   *  每条任务一行「📄 笔记名（去目录去 .md）⏱ 相对时间（formatRelativeTime）」 */
  private renderHistoryGroup(group: LiteratureTask[]): HTMLElement {
    const head = group[0];
    const card = document.createElement('div');
    card.className = 'bz-bili-task-card bz-bili-hgroup';
    card.dataset.url = head.url || '';
    const href = head.url ? `href="${esc(head.url)}"` : '';
    const upText = head.uploader ? `<span class="bz-bili-hup">${esc(head.uploader)}</span>` : '';
    card.innerHTML = `
      <div class="bz-bili-row">
        ${head.title
          ? `<a class="bz-bili-title" ${href} title="${esc(head.url || '')}">${esc(head.title)}</a>`
          : `<span class="bz-bili-url" title="${esc(head.url || '')}">${esc(shortUrlText(head.url || ''))}</span>`}
        ${upText}
      </div>`;
    for (const task of group) {
      const line = document.createElement('div');
      line.className = 'bz-bili-hnote';
      line.innerHTML = `📄 ${esc(shortNoteName(task.notePath || ''))}<span class="bz-bili-hnote-time">⏱ ${esc(formatRelativeTime(task.processedAt || task.created || ''))}</span>`;
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

  // ==================== 术语生成面板（文字录入，ticket 136 §6；142 简洁版拍板） ====================

  /** 当前时间戳（Y-m-d H:i:s，与落盘 frontmatter date 同款格式；预览「日期」只读展示） */
  private termDateStamp(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

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
    const body = document.createElement('div');
    body.className = 'bz-lit-term-body';
    // ticket 142 简洁版：无标题（bz-win-head 整行删除）、无 label、无 placeholder、无状态行；
    // 预览只读——上属性卡（术语/领域/日期）下内容卡，无输入框不可编辑（id 契约仅保留仍存在元素）
    body.innerHTML = `
      <div class="bz-lit-term-inputrow">
        <input id="lit-term-input" type="text" autocomplete="off">
        <button id="lit-term-generate" class="bz-lit-accent-btn">生成</button>
      </div>
      <div id="lit-term-preview" style="display:none;">
        <div class="bz-lit-term-card">
          <div class="bz-lit-term-meta">
            <div class="bz-lit-term-meta-row"><span class="bz-lit-term-meta-k">术语</span><span id="lit-term-meta-term" class="bz-lit-term-meta-v"></span></div>
            <div class="bz-lit-term-meta-row"><span class="bz-lit-term-meta-k">领域</span><span id="lit-term-meta-domain" class="bz-lit-term-meta-v"></span></div>
            <div class="bz-lit-term-meta-row"><span class="bz-lit-term-meta-k">日期</span><span id="lit-term-meta-date" class="bz-lit-term-meta-v"></span></div>
          </div>
        </div>
        <div class="bz-lit-term-card">
          <div id="lit-term-content" class="bz-lit-term-content"></div>
        </div>
        <div class="bz-lit-term-actions">
          <button id="lit-term-regenerate">总结</button>
          <button id="lit-term-save" class="bz-lit-accent-btn">确认写入</button>
        </div>
      </div>`;
    popup.appendChild(body);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    this.termMask = mask;
    this.termPopup = popup;
    q<HTMLButtonElement>(popup, '#lit-term-generate')!.onclick = () => void this.onTermGenerate();
    // ticket 155：底部按钮语义由「重新生成」改「总结」（重跑生成职责归输入行按钮）；id 保留 DOM 契约
    q<HTMLButtonElement>(popup, '#lit-term-regenerate')!.onclick = () => void this.onTermSummarize();
    q<HTMLButtonElement>(popup, '#lit-term-save')!.onclick = () => void this.onTermConfirm();
    // 术语输入框 Enter 直接生成（ticket 139）
    q<HTMLInputElement>(popup, '#lit-term-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); void this.onTermGenerate(); }
    });
  }

  /** 打开术语生成面板；term 预填输入框（命令入口带编辑器选中词；主面板入口不带）。
   *  ticket 155：带词入口（选中文字打开）自动触发生成，无需再点按钮。 */
  showTermEntry(term?: string): void {
    if (!this.termPopup || !this.termMask) return;
    this.termPreview = null;
    this.termHasDraft = false;
    const input = q<HTMLInputElement>(this.termPopup, '#lit-term-input');
    if (input) input.value = (term ?? '').trim();
    this.setTermPreviewVisible(false);
    this.setTermGenLoading(false);
    topifyZ(this.termMask, this.termPopup);
    this.termMask.style.display = 'block';
    this.termPopup.style.display = 'flex';
    if (input && !input.value) setTimeout(() => input.focus(), 100);
    if (input && input.value) void this.onTermGenerate();
  }

  private setTermPreviewVisible(v: boolean): void {
    if (!this.termPopup) return;
    const p = q<HTMLElement>(this.termPopup, '#lit-term-preview');
    if (p) p.style.display = v ? 'flex' : 'none'; // 与 #lit-term-preview 的 flex column + gap 一致
  }

  private setTermGenLoading(loading: boolean): void {
    if (!this.termPopup) return;
    const gen = q<HTMLButtonElement>(this.termPopup, '#lit-term-generate');
    // ticket 155：已有生成结果后按钮文案为「重新生成」，空态/首轮仍为「生成」
    if (gen) { gen.disabled = loading; gen.textContent = loading ? '生成中…' : (this.termHasDraft ? '重新生成' : '生成'); }
    const regen = q<HTMLButtonElement>(this.termPopup, '#lit-term-regenerate');
    if (regen) regen.disabled = loading;
    const save = q<HTMLButtonElement>(this.termPopup, '#lit-term-save');
    if (save) save.disabled = loading;
    // ticket 142：状态行已删除，生成中态并入「生成」按钮文案，输入行下方无任何提示文字
  }

  /** 总结按钮禁用/进行中态（ticket 155）；生成按钮同步禁用防并发 */
  private setTermSummarizing(s: boolean): void {
    if (!this.termPopup) return;
    const regen = q<HTMLButtonElement>(this.termPopup, '#lit-term-regenerate');
    if (regen) { regen.disabled = s; regen.textContent = s ? '总结中…' : '总结'; }
    const save = q<HTMLButtonElement>(this.termPopup, '#lit-term-save');
    if (save) save.disabled = s;
    const gen = q<HTMLButtonElement>(this.termPopup, '#lit-term-generate');
    if (gen) gen.disabled = s;
  }

  private noticeTermError(e: unknown): void {
    const msg = String((e && (e as any).message) || e || '未知错误');
    if (/API Key|AI 配置|未配置/.test(msg)) {
      notice('未配置 AI：请在插件设置 → AI 配置里填 API Key 后再生成', 'error');
    } else {
      notice('生成失败：' + msg, 'error');
    }
  }

  /** 生成/重新生成（输入行按钮）：调 generateTermDraft 纯 AI 预览（不落盘）→ 只读填充预览。
   *  ticket 142：预览无输入框不可编辑，重跑直接覆盖上一轮预览；
   *  ticket 155：成功后 termHasDraft 置位，输入行按钮文案变「重新生成」。 */
  private async onTermGenerate(): Promise<void> {
    if (!this.termPopup || this.termGenerating) return;
    const term = (q<HTMLInputElement>(this.termPopup, '#lit-term-input')?.value ?? '').trim();
    if (!term) { notice('请输入术语', 'error'); return; }
    this.termGenerating = true;
    this.setTermGenLoading(true);
    try {
      const draft = await generateTermDraft(term);
      this.presentTermPreview(draft);
    } catch (e) {
      this.noticeTermError(e);
    } finally {
      this.termGenerating = false;
      this.setTermGenLoading(false);
    }
  }

  /** 总结（ticket 155）：对当前预览正文再做一次 AI 精简并回填内容卡（术语/领域不变，所见即所得落入确认写入）。 */
  private async onTermSummarize(): Promise<void> {
    if (!this.termPopup || this.termSummarizing || this.termGenerating) return;
    if (!this.termPreview || !this.termPreview.body.trim()) { notice('请先生成简介', 'info'); return; }
    this.termSummarizing = true;
    this.setTermSummarizing(true);
    try {
      const summarized = await summarizeTermSummary(this.termPreview.body);
      this.termPreview.body = summarized;
      const contentEl = q<HTMLElement>(this.termPopup, '#lit-term-content');
      if (contentEl) contentEl.textContent = summarized;
    } catch (e) {
      this.noticeTermError(e);
    } finally {
      this.termSummarizing = false;
      this.setTermSummarizing(false);
    }
  }

  /** 填充预览（只读：属性卡/内容卡按 AI 草稿回填，纯内存不写盘；术语输入框不变，ticket 142） */
  private presentTermPreview(draft: { summary: string; domain: string }): void {
    this.termPreview = { domain: draft.domain, body: draft.summary };
    this.termHasDraft = true;
    if (!this.termPopup) return;
    const term = (q<HTMLInputElement>(this.termPopup, '#lit-term-input')?.value ?? '').trim();
    const termEl = q<HTMLElement>(this.termPopup, '#lit-term-meta-term');
    if (termEl) termEl.textContent = term || '—';
    const domainEl = q<HTMLElement>(this.termPopup, '#lit-term-meta-domain');
    if (domainEl) domainEl.textContent = draft.domain || '—';
    const dateEl = q<HTMLElement>(this.termPopup, '#lit-term-meta-date');
    if (dateEl) dateEl.textContent = this.termDateStamp();
    const contentEl = q<HTMLElement>(this.termPopup, '#lit-term-content');
    if (contentEl) contentEl.textContent = draft.summary;
    this.setTermPreviewVisible(true);
  }

  /**
   * 确认写入（ticket 138 §2.1 + 终审 P1-4）：须先有 AI 预览（无预览直接确认 → 提示先生成）；
   * generateTermNote 传面板当前 term/this.termPreview（只读预览即最终值，所见即所得不重跑 AI）→
   * 自动打开新笔记 → term-generated 域事件 → 关闭面板。
   */
  private async onTermConfirm(): Promise<void> {
    if (!this.termPopup || this.termGenerating) return;
    const term = (q<HTMLInputElement>(this.termPopup, '#lit-term-input')?.value ?? '').trim();
    if (!term) { notice('请输入术语', 'error'); return; }
    if (!this.termPreview) { notice('请先点击「生成」获取简介预览', 'info'); return; }
    this.termGenerating = true;
    this.setTermGenLoading(true);
    try {
      // 1) 以面板当前术语/领域/正文落盘一次（预览只读纯内存，无手改值；无草稿/旧稿需要删除）
      const path = await generateTermNote({ term, summary: this.termPreview.body, domain: this.termPreview.domain });
      // 2) 自动打开新笔记
      this.openNote(path);
      // 3) 行为流观察（ticket 136 §10：term-generated，载荷 term/title）
      emitDomainEvent('literature:tasks', { kind: 'term-generated', term, title: term });
      // 4) 关闭面板（预览纯内存，置空即可，无文件误删风险）
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

  /** 关闭术语面板（遮罩 / ESC）；预览纯内存，无草稿文件可删（ticket 138 §2.1） */
  hideTermEntry(): void {
    this.termPreview = null;
    if (this.termMask) this.termMask.style.display = 'none';
    if (this.termPopup) this.termPopup.style.display = 'none';
  }

  // ==================== 通用小工具 ====================

  private openNote(path: string): void {
    const app = getApp();
    const file = app.vault.getAbstractFileByPath(path);
    if (file) {
      void app.workspace.getLeaf(false).openFile(file as any);
      // 打开笔记即收起文献盒全部窗口（ticket 139）：面板浮层盖着笔记，用户得先关面板才看得到
      this.hideMain();
      this.hideVideo();
      this.hideHistory();
    } else {
      notice('文献笔记不存在：' + path, 'error');
    }
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
    // 术语预览纯内存（ticket 138 §2.1），无草稿文件清理
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