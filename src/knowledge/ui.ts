/**
 * 知识盒（knowledge 域）UI —— ADR-0112 三部重构（原型为唯一真理）：
 * 部壹·文献（两种录入进货 + 文献词典列表 + 预览/提炼成卡）、部贰·卡片（卡片盒扫描展示）、
 * 部叁·主题（主题笔记仅展示，写作与检索归 Obsidian + 第二大脑）。
 * 知识盒只整理关联：文献→卡片 = 连一张旧卡 + 一句为什么（related 键，源文献自动互链）。
 * 保留承继：术语生成面板（ticket 142/155 简洁版契约 + ADR-0116 可选「来源」行）、视频任务队列（ticket 146 单钮态机/148 纯 emoji）、
 * 添加弹窗校验、历史分组、ESC 分层、topifyZ、域事件刷新（knowledge:tasks / knowledge:file-*）。
 * 移除（ADR-0112 原型拍板）：领域筛选/搜索/双击打开/抽屉/面板内设置按钮（设置走设置面板域）。
 */
import { Component, MarkdownRenderer, type App } from 'obsidian';
import type { SettingsSchema } from '../core/settings-schema';
import { isMobileEnv } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { attachItemActions, type ItemAction } from '../core/item-actions';
import { openFlowDialog } from '../core/flow-dialog';
import { notice } from '../core/notice';
import { escapeHtml, fetchPageTitle, formatRelativeTime, stripMdExt } from '../core/utils';
import { uiSuggest } from '../core/ui/suggest';
import { topifyZ } from '../core/z-order';
import { emitDomainEvent, onDomainEvent } from '../core/domain-bus';
import { getApp } from '../core/app';
import type BzSettings from '../settings';
import { KnowledgeData, normalizeLooseTime, secToTimeText, timeTextToSec } from './data';
import type { KnowledgeTask } from './types';
import { BatchRunner, type BatchEvents } from './processor';
import { backfillNotes, generateTermDraft, generateTermNote, summarizeTermSummary } from './note-gen';
import { canonicalVideoUrl, cleanSourceTitle, isUrlLikeSourceText, normalizeSourceUrl, noteSourceName, type TermSource } from './source';
import { fetchCheckedQualities, fetchVideoMeta, parseBvid, resolveVideo, type ResolvedVideo, type VideoMeta } from './video-meta';
import { RangeBar } from './range-bar';

interface StatusMeta { label: string; cls: string; }
const STATUS_META: Record<KnowledgeTask['status'], StatusMeta> = {
  pending: { label: '待处理', cls: 'bz-kb-pending' },
  processing: { label: '处理中', cls: 'bz-kb-processing' },
  success: { label: '成功', cls: 'bz-kb-success' },
  failed: { label: '失败', cls: 'bz-kb-failed' },
};

function q<T extends HTMLElement>(root: HTMLElement, sel: string): T | null {
  return root.querySelector(sel) as T | null;
}

/** HTML 转义（进度文案来自外部进程 stdout，统一转义防注入；core escapeHtml 转发壳） */
function esc(s: unknown): string {
  return escapeHtml(String(s ?? ''));
}

/** 历史笔记行展示名：去目录（含反斜杠兼容）去 .md 后缀；空路径回退原串 */
function shortNoteName(path: string): string {
  const base = String(path || '').replace(/\\/g, '/').split('/').pop() || '';
  return stripMdExt(base) || String(path || '');
}

/** 失败原因白话化：外部工具 stderr / AI 报错多为英文原文，行内映射为中文白话；未命中返回截断原文 */
export function humanizeError(reason: string | null | undefined): string {
  const s = String(reason ?? '').trim();
  if (!s) return '';
  if (/未找到 bili-dl|npm install -g @jwbz\/bili-downloader|ENOENT.*bili-dl/i.test(s)) {
    return '下载工具未安装：在电脑上运行 npm install -g @jwbz/bili-downloader 后重试';
  }
  if (/ffmpeg/i.test(s)) return '视频处理工具（ffmpeg）不可用：检查电脑是否已安装，或设置里的「ffmpeg 路径」';
  if (/ffprobe/i.test(s)) return '视频探测工具（ffprobe）不可用：检查电脑是否已安装，或设置里的「ffprobe 路径」';
  if (/找不到 Python|无法启动 Python|python.*ENOENT/i.test(s)) {
    return '语音转写失败：未找到 Python——设置里「Python 路径」填 python（一般装了 Python 即可），或运行 where python 查绝对路径填入';
  }
  if (/未配置 pythonPath/i.test(s)) {
    return '语音转写未配置：知识盒设置「Python 路径」填 python 即可（一般装了 Python 就能用，走系统 PATH），或填绝对路径（Windows 在命令提示符运行 where python 可查）';
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

interface RowRunState {
  steps: string[];
  phase: string | null;
  pct: number | null;
  startAt: number;
}

/** 步骤完成态文案映射（工具步骤名 → 「已…」；插件侧 AI 两步亦在此） */
const STEP_DONE_MAP: Record<string, string> = {
  'AI 生成文献笔记中': '已生成文献笔记',
  '笔记落盘中': '已落盘笔记',
};
function stepDoneLabel(step: string): string {
  const mapped = STEP_DONE_MAP[step];
  if (mapped) return mapped;
  return step.endsWith('中') ? `已${step.slice(0, -1)}` : `已${step}`;
}

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

/** 本地时间戳「YYYY-MM-DD HH:mm:ss」（卡片 date / 术语卡日期展示共用） */
function dateStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 文献目录（设置缺省「文献盒」，去首尾斜杠） */
function litDirOf(s: Partial<BzSettings> | undefined): string {
  const raw = s && s.knowledgeDirectory ? String(s.knowledgeDirectory) : '文献盒';
  return raw.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}
/** 卡片目录（缺省「卡片盒」） */
function cardboxDirOf(s: Partial<BzSettings> | undefined): string {
  const raw = s && s.knowledgeCardboxDirectory ? String(s.knowledgeCardboxDirectory) : '卡片盒';
  return raw.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}
/** 主题目录（缺省「主题盒」） */
function topicDirOf(s: Partial<BzSettings> | undefined): string {
  const raw = s && s.knowledgeTopicDirectory ? String(s.knowledgeTopicDirectory) : '主题盒';
  return raw.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function parseDateRaw(raw: string | undefined | null): number {
  const s = String(raw ?? '').trim();
  if (!s) return NaN;
  const d1 = new Date(s.replace(' ', 'T'));
  if (!isNaN(d1.valueOf())) return d1.valueOf();
  const d2 = new Date(s);
  return d2.valueOf();
}

/** 剥 frontmatter 返回正文 */
function stripFrontmatter(text: string): string {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return text.slice(m ? m[0].length : 0).replace(/^\r?\n+/, '');
}

/** frontmatter related 列表追加一条（无 related 键则整键插入；纯字符串操作，行扫描实现） */
export function appendRelatedLine(text: string, link: string): string {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return text;
  let close = -1;
  let relatedAt = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { close = i; break; }
    if (/^related:/.test(lines[i])) relatedAt = i;
  }
  if (close === -1) return text;
  if (relatedAt === -1) {
    lines.splice(close, 0, 'related:', `  - "${link}"`);
  } else {
    let end = relatedAt + 1;
    while (end < close && /^\s*-\s/.test(lines[end])) end++;
    lines.splice(end, 0, `  - "${link}"`);
  }
  return lines.join('\n');
}

/** 部壹文献条目（数据源 = 文献目录文件夹实况，不从数据文件派生） */
interface KnowledgeNoteEntry {
  file: any;
  path: string;
  title: string;
  type: string;
  domain: string;
  summary: string;
  url: string;
  source: string;      // 术语来源原文值（ADR-0116：URL 或 [[双链]]；视频文献无此键）
  sourceTitle: string; // 外部来源抓到的页面标题（可选）
  date: string;
  created: number;
}

/** 三部预览共用最小面：文献/卡片/主题行点击开同一个弹层（缺省字段安全降级） */
interface PreviewEntry {
  file: any;
  path: string;
  title: string;
  type?: string;
  domain?: string;
  date?: string;
  url?: string;
  source?: string;
  sourceTitle?: string;
}

/** 部贰卡片条目（存量零迁移：领域读序 domain → category → 未分类） */
interface CardEntry {
  file: any;
  path: string;
  title: string;
  domain: string;
  review: boolean;
  created: number;
}

/** 部叁主题条目（仅展示） */
interface TopicEntry {
  file: any;
  path: string;
  title: string;
  where: string;
  created: number;
}

/** 知识盒设置 schema（声明式四组；ADR-0112 更名并新增卡片/主题目录） */
export function knowledgeSettingsSchema(opts?: { onClearHistory?: () => void | Promise<void> }): SettingsSchema {
  return {
    groups: [
      {
        // 外观组（issue 246 占位单卡）：布局/主题各一档，域 UI 消费待皮肤设计时接入
        icon: 'palette', name: '外观',
        rows: [
          { type: 'choiceCards', name: '面板布局', binding: { key: 'knowledgeSkin' }, options: [{ value: 'default', label: '词条', prevClass: 'bz-sp-prev-panel' }] },
          { type: 'choiceCards', name: '面板主题', binding: { key: 'knowledgeSkinTheme' }, layoutKey: 'knowledgeSkin', options: [{ value: 'manila', label: '牛皮纸', layout: 'default', prevClass: 'bz-sp-prev-manila' }] },
        ],
      },
      {
        icon: 'folder-open', name: '目录与分类',
        rows: [
          { type: 'path', mode: 'single', name: '文献文件夹', desc: '文献笔记所在文件夹，部壹扫描这里', binding: { key: 'knowledgeDirectory' } },
          { type: 'path', mode: 'single', name: '卡片文件夹', desc: '你自己写的卡片笔记所在文件夹，部贰扫描后把提炼的卡落在这里', binding: { key: 'knowledgeCardboxDirectory' } },
          { type: 'path', mode: 'single', name: '主题文件夹', desc: '主题笔记所在文件夹，部叁仅作展示不影响写作', binding: { key: 'knowledgeTopicDirectory' } },
          { type: 'textarea', name: '领域词表', desc: '逗号分隔的领域词，留空则 AI 自由写领域', binding: { key: 'knowledgeDomainList' }, placeholder: '物理,医学,计算机,经济…' },
        ],
      },
      {
        icon: 'settings-2', name: '视频处理',
        rows: [
          { type: 'toggle', name: '详细进度提示', desc: '处理中显示当前步骤与耗时，关闭则仅显示步骤徽章', binding: { key: 'knowledgeProgressDetail' } },
          { type: 'toggle', name: '保留视频原件', desc: '转文献完成后保留视频文件，关闭则只生成文献笔记', binding: { key: 'knowledgeKeepVideo' } },
          { type: 'select', name: '下载清晰度', desc: '以视频源可用档位为准，低档优先命中缓存', binding: { key: 'knowledgeQuality' }, options: [{ value: 'highest', label: '最高' }, { value: '1080', label: '1080P' }, { value: '720', label: '720P' }] },
          { type: 'toggle', name: '遇错即停', desc: '单条失败后停止处理剩余任务，关闭则失败后继续', binding: { key: 'knowledgeStopOnFailure' } },
          { type: 'text', name: '输出文件夹', desc: '视频文件落地文件夹，留空跟随工具配置', binding: { key: 'knowledgeOutputDir' }, placeholder: '如 D:/videos' },
          { type: 'toggle', name: '视频压缩', desc: '转文字前压缩视频，默认开启', binding: { key: 'knowledgeCompress' } },
          { type: 'number', name: '压缩质量 CRF', desc: '数值越小画质越高，范围 18 到 28', binding: { key: 'knowledgeCrf' }, min: 18, max: 28, step: 1 },
        ],
      },
      {
        icon: 'terminal', name: '工具',
        rows: [
          { type: 'text', name: 'ffmpeg 路径', desc: '视频处理用，留空跟随工具配置', binding: { key: 'knowledgeFfmpegPath' }, placeholder: '如 ffmpeg 或 D:/tools/ffmpeg.exe' },
          { type: 'text', name: 'ffprobe 路径', desc: '探测视频元数据用，留空跟随工具配置', binding: { key: 'knowledgeFfprobePath' }, placeholder: '如 ffprobe 或 D:/tools/ffprobe.exe' },
          { type: 'text', name: 'Python 路径', desc: '装了 Python 一般填 python 即可，或填绝对路径，留空跟随工具配置', binding: { key: 'knowledgePythonPath' }, placeholder: '如 python 或 D:/tools/python.exe' },
          { type: 'text', name: 'Whisper 模型', desc: '转写模型档位，可选 tiny 到 large', binding: { key: 'knowledgeWhisperModel' }, placeholder: '如 small' },
          { type: 'text', name: '缓存文件夹', desc: '剪辑产物与转写稿的缓存，留空用系统临时目录', binding: { key: 'knowledgeCacheDir' }, placeholder: '如 D:/bili-dl-cache' },
          { type: 'number', name: '缓存保留天数', desc: '超过该天数的缓存自动清理', binding: { key: 'knowledgeCacheRetentionDays' }, min: 1, step: 1 },
        ],
      },
      {
        icon: 'wrench', name: '维护',
        rows: [
          {
            type: 'button', name: '清空历史', desc: '移除全部成功归档的转文献记录，文献笔记与视频文件保留在库中',
            buttonText: '清空历史', onClick: () => { if (opts?.onClearHistory) void opts.onClearHistory(); },
          },
        ],
      },
    ],
  };
}

export class UIManager {
  app: App;
  // ---- 主壳（三部）----
  mask: HTMLElement | null = null;
  popup: HTMLElement | null = null;
  contentEl: HTMLElement | null = null;
  part: 'z1' | 'z2' | 'z3' = 'z1';
  private allNotes: KnowledgeNoteEntry[] = [];
  private allCards: CardEntry[] = [];
  private allTopics: TopicEntry[] = [];
  private cardsShown = 0;
  private editor: { source: KnowledgeNoteEntry; pick: string | null; why: string; title: string } | null = null;
  private sessionNewPaths = new Set<string>();
  private loadedLitDir = '';
  private loadedCardDir = '';
  private loadedTopicDir = '';
  private backfilledDir = '';
  // ---- 视频录入面板（任务队列）----
  videoMask: HTMLElement | null = null;
  videoPopup: HTMLElement | null = null;
  videoList: HTMLElement | null = null;
  // ---- 添加任务弹窗 / 历史弹窗 ----
  addMask: HTMLElement | null = null;
  addPopup: HTMLElement | null = null;
  // ---- 添加弹窗解析态（ADR-0133：解析按钮 + 只读信息区 + 双把手范围）----
  /** 解析序列号：新解析/关弹窗使在途响应过期（回填前校验丢弃） */
  private addUrlSeq = 0;
  /** 解析中（解析按钮 loading、保存禁用） */
  private addResolving = false;
  /** 解析成功的信息（null = 未解析 / 失败态） */
  private addMeta: VideoMeta | null = null;
  /** 实测清晰度档位（null = 未取到 → 固定列表回落） */
  private addQualities: number[] | null = null;
  /** 当前选中分 P（1 起） */
  private addPage = 1;
  /** 当前 P 时长（秒；0 = 未知 → 进度条不可用、只出时间框） */
  private addDuration = 0;
  /** 范围选择（秒；全选 = 整片） */
  private addStart = 0;
  private addEnd = 0;
  /** 双把手范围条实例（重建时销毁旧的） */
  private addBar: RangeBar | null = null;
  /** 主面板自动重抓（ADR-0133）：进行中标记 + 已尝试任务 id 集（防重入/防重复请求） */
  private backfillRunning = false;
  private backfillTried = new Set<string>();
  historyMask: HTMLElement | null = null;
  historyPopup: HTMLElement | null = null;
  historyList: HTMLElement | null = null;
  // ---- 术语生成面板 ----
  termMask: HTMLElement | null = null;
  termPopup: HTMLElement | null = null;
  private termPreview: { domain: string; body: string } | null = null;
  private termGenerating = false;
  private termSummarizing = false;
  private termHasDraft = false;
  private termSource: TermSource | null = null; // 术语来源（ADR-0116；null = 未填）
  private termSrcSuggest: ReturnType<typeof uiSuggest> | null = null;
  private termSrcTimer: ReturnType<typeof setTimeout> | null = null;

  private editingId: string | null = null;
  private onKeydown: (e: KeyboardEvent) => void = () => {};
  private batchAbortLabel: '终止' | '终止整批' | null = null;
  private runState = new Map<string, RowRunState>();
  private runTimer: ReturnType<typeof setInterval> | null = null;
  private fileListenerRefs: (() => void)[] = [];
  private fileListenerAttached = false;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRefreshPaths = new Set<string>();
  private pendingDeletePaths = new Set<string>();

  constructor(app: App) {
    this.app = app;
    this.createMainUI();
    this.createVideoUI();
    this.createAddDialog();
    this.createHistoryUI();
    this.createTermUI();
    this.onKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // ESC 关最上层：术语面板 → 历史弹窗 → 添加弹窗 → 视频面板 → 主面板
      if (this.termPopup && this.termPopup.style.display === 'flex') this.hideTermEntry();
      else if (this.historyPopup && this.historyPopup.style.display === 'flex') this.hideHistory();
      else if (this.addPopup && this.addPopup.style.display === 'flex') this.hideAddDialog();
      else if (this.videoPopup && this.videoPopup.style.display === 'flex') this.hideVideo();
      else if (this.popup && this.popup.style.display === 'flex') this.hideMain();
    };
    document.addEventListener('keydown', this.onKeydown);
  }

  // ==================== 主壳（三部） ====================

  createMainUI(): void {
    if ((this.mask && this.mask.isConnected) || (this.popup && this.popup.isConnected)) return;
    const mask = document.createElement('div');
    mask.id = 'knowledge-mask';
    mask.className = 'bz-kb-mask';
    mask.style.display = 'none';
    mask.onclick = () => this.hideMain();

    const popup = document.createElement('div');
    popup.id = 'knowledge-popup';
    popup.className = 'bz-kb-window kb';
    if (isMobileEnv()) popup.classList.add('bz-panel-mtop'); // 移动端主窗真全屏（ADR-0116，样式见 styles.css 尾部）
    popup.style.display = 'none';
    // 移动端头部定稿（章回式）：题字居中一行，部切换通栏三格挪出头部压双细线；桌面维持竖排部签居中题字
    const partBtns = `
          <button class="bz-kb-part is-on" data-kb-act="part" data-part="z1">部壹 · 文献</button>
          <button class="bz-kb-part" data-kb-act="part" data-part="z2">部贰 · 卡片</button>
          <button class="bz-kb-part" data-kb-act="part" data-part="z3">部叁 · 主题</button>`;
    popup.innerHTML = isMobileEnv() ? `
      <div class="bz-kb-head">
        <div class="bz-kb-brand">
          <div class="bz-kb-top">LEXICON · BOX OF NOTES</div>
          <div class="bz-kb-title">知 识 盒</div>
        </div>
        <button class="bz-kb-mclose" data-kb-act="kb-close" title="关闭知识盒">✕</button>
      </div>
      <div class="bz-kb-parts">${partBtns}
      </div>
      <div class="bz-kb-sc" id="kb-sc"></div>` : `
      <div class="bz-kb-head">
        <div class="bz-kb-parts">${partBtns}
        </div>
        <div class="bz-kb-brand">
          <div class="bz-kb-top">LEXICON · BOX OF NOTES</div>
          <div class="bz-kb-title">知 识 盒</div>
        </div>
      </div>
      <div class="bz-kb-sc" id="kb-sc"></div>`;
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    this.mask = mask;
    this.popup = popup;
    this.contentEl = q<HTMLElement>(popup, '#kb-sc');
    popup.addEventListener('click', (e) => this.onShellClick(e as MouseEvent));
    this.contentEl?.addEventListener('scroll', () => this.onContentScroll());
    this.attachFileListener();
  }

  /** 主壳点击委托（部切换 / 录入入口 / 文献行 / 主题行 / 返回） */
  private onShellClick(e: MouseEvent): void {
    const t = (e.target as HTMLElement).closest('[data-kb-act]') as HTMLElement | null;
    if (!t) return;
    const act = t.getAttribute('data-kb-act');
    if (act === 'part') { this.part = (t.getAttribute('data-part') as 'z1' | 'z2' | 'z3') || 'z1'; void this.refreshCurrent(); this.syncPartButtons(); }
    else if (act === 'term-entry') this.showTermEntry();
    else if (act === 'video-entry') this.showVideoEntry();
    else if (act === 'lit-peek') { const p = t.getAttribute('data-path') || ''; const n = this.allNotes.find((x) => x.path === p); if (n) void this.openPreview(n); }
    else if (act === 'card-peek') { const p = t.getAttribute('data-path') || ''; const c = this.allCards.find((x) => x.path === p); if (c) void this.openPreview(c, 'card'); }
    else if (act === 'topic-open') { const p = t.getAttribute('data-path') || ''; const tp = this.allTopics.find((x) => x.path === p); if (tp) void this.openPreview({ file: tp.file, path: tp.path, title: tp.title, domain: tp.where }, 'topic'); }
    else if (act === 'kb-close') this.hideMain(); // 移动端全屏主窗出口（ADR-0116：手机无 ESC/遮罩边缘）
  }

  private syncPartButtons(): void {
    if (!this.popup) return;
    this.popup.querySelectorAll('.bz-kb-part').forEach((b) => {
      b.classList.toggle('is-on', (b as HTMLElement).getAttribute('data-part') === this.part);
    });
  }

  showMain(): void {
    this.createMainUI();
    if (!this.popup || !this.mask || !this.contentEl) return;
    topifyZ(this.mask, this.popup);
    this.mask.style.display = 'block';
    this.popup.style.display = 'flex';
    void this.refreshCurrent();
    void this.runBackfill();
  }

  hideMain(): void {
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
  }

  /** 当前部数据 + 渲染（目录变更检测 → 清缓存重扫） */
  private async refreshCurrent(): Promise<void> {
    if (!this.contentEl) return;
    const s = tryGetSettings() as Partial<BzSettings> | undefined;
    if (this.part === 'z1') {
      const dir = litDirOf(s);
      if (this.loadedLitDir && this.loadedLitDir !== dir) this.allNotes = [];
      await this.loadLiterature(dir);
      this.renderLiterature();
    } else if (this.part === 'z2') {
      const dir = cardboxDirOf(s);
      if (this.loadedCardDir && this.loadedCardDir !== dir) this.allCards = [];
      await this.loadCards(dir);
      this.cardsShown = 0;
      this.renderCards();
    } else {
      const dir = topicDirOf(s);
      if (this.loadedTopicDir && this.loadedTopicDir !== dir) this.allTopics = [];
      await this.loadTopics(dir);
      this.renderTopics();
    }
  }

  /** 部壹文献扫描：文献目录下全部 .md（含子目录），metadataCache 解析 frontmatter */
  private async loadLiterature(dir: string): Promise<void> {
    const app = getApp();
    this.loadedLitDir = dir;
    const prefix = dir + '/';
    const mdFiles = (app.vault.getFiles() || []).filter((f: any) => f.path.startsWith(prefix) && f.extension === 'md');
    const entries: KnowledgeNoteEntry[] = [];
    for (const f of mdFiles) {
      const e = await this.parseNoteFile(f);
      if (e) entries.push(e);
    }
    entries.sort((a, b) => (b.created - a.created) || a.path.localeCompare(b.path));
    this.allNotes = entries;
  }

  private async parseNoteFile(file: any): Promise<KnowledgeNoteEntry | null> {
    const app = getApp();
    try {
      const cache = app.metadataCache.getFileCache(file);
      const fm = cache && (cache as any).frontmatter;
      const title = fm && fm.title ? String(fm.title) : file.basename;
      const date = fm && fm.date ? String(fm.date) : '';
      let created = parseDateRaw(date);
      if (isNaN(created)) {
        try {
          const st = (file as any).stat;
          created = st && st.ctime ? new Date(st.ctime).valueOf() : 0;
        } catch { created = 0; }
      }
      return {
        file, path: file.path, title,
        type: fm && fm.type ? String(fm.type) : '',
        domain: fm && fm.domain ? String(fm.domain) : '',
        summary: fm && fm.summary ? String(fm.summary) : '',
        url: fm && fm.url ? String(fm.url) : '',
        source: fm && fm.source ? String(fm.source) : '',
        sourceTitle: fm && fm.sourceTitle ? String(fm.sourceTitle) : '',
        date, created,
      };
    } catch (e) {
      console.warn('解析文献笔记失败:', file.path, e);
      return null;
    }
  }

  private renderLiterature(): void {
    if (!this.contentEl) return;
    const rows = this.allNotes.map((n, i) => {
      const no = String(i + 1).padStart(2, '0');
      const kind = n.type === 'video' ? '影 像' : '词 条';
      return `<div class="bz-kb-lexrow" data-kb-act="lit-peek" data-path="${esc(n.path)}">
        <div class="bz-kb-hw"><span class="bz-kb-w">${esc(n.title)}</span><span class="bz-kb-pos ${n.type === 'video' ? 'hot' : ''}">${kind}</span><span class="bz-kb-dom">${esc(n.domain || '未分类')}</span></div>
        <div class="bz-kb-tail"><span class="bz-kb-meta">LIT-${no} · ${esc(n.date || '')}</span></div>
      </div>`;
    }).join('');
    this.contentEl.innerHTML = `
      <div class="bz-kb-pd">
        <div class="bz-kb-entryrow">
          <button class="bz-kb-entrybtn" data-kb-act="term-entry"><b>文字录入 · 术语</b><span>想到一个概念，当场落成一张术语卡</span></button>
          <button class="bz-kb-entrybtn" data-kb-act="video-entry"><b>视频录入 · 任务</b><span>丢进来一个 B 站链接，文献笔记自动长出来</span></button>
        </div>
        ${rows || '<div class="bz-kb-empty">「文献目录」还没有文献笔记——从上面的两种录入开始。</div>'}
      </div>`;
  }

  /** 三部共用预览弹层（文献/卡片/主题同一样式）：正文真 Markdown 渲染（视频 ![[mp4]] 内嵌可播）+ 关联 + 可点来源（只读；关闭走 ✕/ESC） */
  private async openPreview(n: PreviewEntry, kind: 'lit' | 'card' | 'topic' = 'lit'): Promise<void> {
    const app = getApp();
    let raw = '';
    try { raw = await app.vault.read(n.file); } catch { raw = ''; }
    const body = stripFrontmatter(raw);
    // 纯文本段落 = 渲染失败兜底（只在渲染抛错/无产出或空正文时写入，绝不预填——预填 + 追加渲染 = 双份，issue 275）
    const parasHtml = body
      .split(/\r?\n\r?\n+/)
      .map((b) => b.trim())
      .filter(Boolean)
      .map((b) => `<p>${esc(b)}</p>`)
      .join('') || '<p>（无正文）</p>';
    const rels = await this.noteRels(n);
    // 来源/原文（可点外开）：视频文献 url 键 → 「原文」；术语外部 source 键 → 「来源」（内部笔记来源只在术语面板 meta 行呈现）
    const srcHtml = n.url
      ? `<div class="bz-kb-sec">原 文</div><div class="bz-kb-cliplink"><a class="bz-lit-srcopen" data-lit-src-url="${esc(n.url)}" href="#">${esc(n.url)}</a></div>`
      : n.source && !n.source.startsWith('[[')
        ? `<div class="bz-kb-sec">来 源</div><div class="bz-kb-cliplink"><a class="bz-lit-srcopen" data-lit-src-url="${esc(n.source)}" href="#">${esc(n.sourceTitle || n.source)}</a></div>`
        : '';
    const head = kind === 'card'
      ? { title: '卡片预览 · 卡片盒', badge: '卡 片', hot: false }
      : kind === 'topic'
        ? { title: '主题预览 · 主题笔记', badge: '主 题', hot: false }
        : { title: `文献预览 · ${n.type === 'video' ? '影像' : '词条'}`, badge: n.type === 'video' ? '影 像' : '词 条', hot: n.type === 'video' };
    this.openSheet(this.sheetWrap(head.title, `
      <div class="bz-kb-hw"><span class="bz-kb-w" style="font-size:17px">${esc(n.title)}</span>
        <span class="bz-kb-pos ${head.hot ? 'hot' : ''}">${head.badge}</span>
        <span class="bz-kb-dom">${esc(n.domain || '未分类')}</span></div>
      <div class="bz-kb-tail"><span class="bz-kb-meta">${esc(n.date || '')}</span></div>
      <div class="bz-kb-paras" id="bz-kb-preview-body"></div>
      ${rels.length ? `<div class="bz-kb-sec">关 联</div><div class="bz-kb-rels">${rels.map((r) => `<span class="bz-kb-cite">${esc(r)}</span>`).join('')}</div>` : ''}
      ${srcHtml}`));
    this._previewNote = n;
    // 正文真 Markdown 渲染：加粗/列表/标题/引用原生出，视频 ![[mp4]] 内嵌为可播放 <video>。
    // ADR-0122 追加语义契约：render 是「追加到容器」，渲染前容器必须为空（预填纯文本再渲染 = 双份，issue 275）；
    // 兜底改事后判定——渲染抛错/无产出（mock、空产出）才回退纯文本段落；空正文显式「（无正文）」，不留全白
    const bodyEl = this.popup ? q<HTMLElement>(this.popup, '#bz-kb-preview-body') : null;
    if (bodyEl) {
      bodyEl.textContent = '';
      if (body) {
        try {
          const comp = new Component();
          await MarkdownRenderer.render(this.app, body, bodyEl, n.path, comp);
          comp.unload();
        } catch { /* 渲染失败回退纯文本 */ }
        if (!bodyEl.querySelector('*')) {
          // 成败判据 =「是否产出元素」：嵌入型正文（如纯 ![[…mp4]]）渲染成功产出 video 但无文本，
          // 不得因 textContent 为空误触发兜底（否则字面嵌入叠加在视频后 = 双份复现，review 275 修复）
          bodyEl.innerHTML = parasHtml;
        }
      } else {
        bodyEl.innerHTML = parasHtml;
      }
    }
    // 来源/原文链接统一外开
    const srcLinks = this.popup ? this.popup.querySelectorAll('[data-lit-src-url]') : [];
    srcLinks.forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._openExternal(a.getAttribute('data-lit-src-url') || '');
      });
    });
  }
  private _previewNote: PreviewEntry | null = null;

  /** 提炼成卡编辑弹层（原型唯一真理：词头可改 / 源文献+领域自动带，落 related 双链互链 / 连一张旧卡 / 为什么相关） */
  private async openCardEditor(n: KnowledgeNoteEntry): Promise<void> {
    await this.ensureCards();
    const dom = n.domain || '未分类';
    const sameDom = this.allCards.filter((c) => c.domain === dom).map((c) => c.title);
    const others = this.allCards.map((c) => c.title).filter((t) => !sameDom.includes(t));
    const olds: string[] = [...sameDom.slice(0, 5)];
    for (const t of others) { if (olds.length >= 6) break; olds.push(t); }
    if (olds.length === 0) olds.push(n.title);
    const whySug = `《${n.title}》与这张旧卡讨论同一主题——读后补全了机制细节，整理为显式连接。`;
    const oldsHtml = olds.map((o, i) => `<button class="bz-kb-old" data-kb-old="${esc(o)}">${esc(o)}${i === 0 ? '<span class="bz-kb-rec">推荐</span>' : ''}</button>`).join('');
    this.openSheet(this.sheetWrap('提炼成卡 → 卡片盒', `
      <div class="bz-kb-f"><div class="bz-kb-flb">词 头（可 改）</div>
        <input type="text" data-kb-role="cardtitle" value="${esc(n.title)}"></div>
      <div class="bz-kb-f"><div class="bz-kb-flb">来 源 与 领 域（自 动 带，落 related 双链）</div>
        <div class="bz-kb-srcline"><span class="bz-kb-srchip"><b>源</b>${esc(n.path)}</span>
        <span class="bz-kb-srchip"><b>领域</b>〔${esc(dom)}〕自动继承</span></div></div>
      <div class="bz-kb-f"><div class="bz-kb-flb">连 一 张 旧 卡（铁律：不 解 释 的 链 接 不 产 生 知 识）</div>
        <div class="bz-kb-olds">${oldsHtml}</div></div>
      <div class="bz-kb-f"><div class="bz-kb-flb">为 什 么 相 关（一 句 话，可 改）</div>
        <input type="text" data-kb-role="why" value="${esc(whySug)}"></div>
      <div style="margin-top:18px;display:flex;gap:10px">
        <button class="bz-kb-bigbtn" data-kb-act="card-save" disabled>落 卡</button>
        <button class="bz-kb-ghost" data-kb-close>取消</button>
      </div>
      <div class="bz-kb-note" style="font-size:11px;margin-top:14px">落卡后它躺在卡片盒，随时被任何笔记引用——不强迫挂进哪篇，也不强迫复习。</div>`));
    // openSheet→closeSheet 会清编辑态，故状态在挂载后置入（输入/旧卡选择监听由 openSheet 统一挂）
    this.editor = { source: n, pick: null, why: whySug, title: n.title };
  }

  private syncSaveBtn(): void {
    const btn = this.popup?.querySelector('[data-kb-act=card-save]') as HTMLButtonElement | null;
    if (btn && this.editor) btn.disabled = !(this.editor.pick && this.editor.why.trim());
  }

  /** 落卡：写卡片盒笔记（category=领域、related=源文献）+ 源文献 related 追加新卡（互链） */
  private async saveCard(): Promise<void> {
    if (!this.editor || !this.editor.pick || !this.editor.why.trim()) return;
    const app = getApp();
    const s = tryGetSettings() as Partial<BzSettings> | undefined;
    const dir = cardboxDirOf(s);
    const src = this.editor.source;
    const why = this.editor.why.trim();
    let base = this.editor.title.trim() || src.title;
    const stamp = dateStamp();
    try {
      let idx = 2;
      while (app.vault.getAbstractFileByPath(`${dir}/${base}.md`)) { base = `${this.editor.title.trim() || src.title} ${idx}`; idx++; }
      const path = `${dir}/${base}.md`;
      try { if (!app.vault.getFolderByPath(dir)) await (app.vault as any).createFolder(dir); } catch { /* 已存在 */ }
      const md = ['---', 'tags: []', `category: ${src.domain || '未分类'}`, 'related:', `  - "[[${src.path}|${src.title}]]"`, `date: "${stamp}"`, '---', '', why, ''].join('\n');
      await app.vault.create(path, md);
      // 互链：源文献 frontmatter.related 追加新卡
      const srcFile = app.vault.getAbstractFileByPath(src.path);
      if (srcFile) {
        const text = await app.vault.read(srcFile as any);
        const linkText = `[[${stripMdExt(path)}|${base}]]`;
        const updated = appendRelatedLine(text, linkText);
        if (updated !== text) await app.vault.modify(srcFile as any, updated);
      }
      this.allCards.unshift({ file: null as any, path, title: base, domain: src.domain || '未分类', review: false, created: Date.now() });
      this.sessionNewPaths.add(path);
      this.editor = null;
      this.closeSheet();
      notice('已落卡 卡片盒/' + base + '.md · 它随时被任何笔记引用', 'success');
      if (this.part === 'z2') { this.cardsShown = 0; this.renderCards(); }
    } catch (e: any) {
      notice('落卡失败：' + (e?.message ?? String(e)), 'error');
    }
  }

  /** 部贰卡片扫描（存量零迁移：领域读序 domain → category → 未分类） */
  private async loadCards(dir: string): Promise<void> {
    const app = getApp();
    this.loadedCardDir = dir;
    const prefix = dir + '/';
    const mdFiles = (app.vault.getFiles() || []).filter((f: any) => f.path.startsWith(prefix) && f.extension === 'md');
    const out: CardEntry[] = [];
    for (const f of mdFiles) {
      try {
        const cache = app.metadataCache.getFileCache(f);
        const fm = (cache && (cache as any).frontmatter) || {};
        let created = 0;
        try { created = (f as any).stat?.ctime ? new Date((f as any).stat.ctime).valueOf() : 0; } catch { created = 0; }
        out.push({
          file: f, path: f.path,
          title: fm && fm.title ? String(fm.title) : f.basename,
          domain: fm && fm.domain ? String(fm.domain) : fm && fm.category ? String(fm.category) : '未分类',
          review: fm && fm.reviewStart != null,
          created,
        });
      } catch { /* 单文件解析失败跳过 */ }
    }
    out.sort((a, b) => b.created - a.created || a.path.localeCompare(b.path));
    this.allCards = out;
  }

  private renderCards(): void {
    if (!this.contentEl) return;
    this.cardsShown = Math.max(this.cardsShown, 80);
    const shown = this.allCards.slice(0, this.cardsShown);
    const rows = shown.map((c) => `<div class="bz-kb-lexrow" data-kb-act="card-peek" data-path="${esc(c.path)}">
      <div class="bz-kb-hw"><span class="bz-kb-w">${esc(c.title)}</span>${this.sessionNewPaths.has(c.path) ? '<span class="bz-kb-pos ok">新 落</span>' : ''}<span class="bz-kb-dom">${esc(c.domain)}</span></div>
      <div class="bz-kb-tail"><span>${c.review ? '复习中 · 到期由闹钟安排' : '未入复习'}</span><span style="margin-left:auto">连 1 张旧卡</span></div>
    </div>`).join('');
    const rest = this.allCards.length - shown.length;
    this.contentEl.innerHTML = `<div class="bz-kb-pd">
      ${rows || '<div class="bz-kb-empty">卡片目录还没有卡片——在部壹文献预览里「提炼成卡」。</div>'}
      ${rest > 0 ? `<div class="bz-kb-empty" data-kb-act="cards-more">↓ 还有 ${rest} 张，滚动或点此加载</div>` : ''}
    </div>`;
  }

  private moreCards(): void {
    if (this.cardsShown >= this.allCards.length) return;
    this.cardsShown += 80;
    this.renderCards();
  }

  private onContentScroll(): void {
    const sc = this.contentEl;
    if (!sc || this.part !== 'z2') return;
    if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 60) this.moreCards();
  }

  /** 部叁主题扫描（仅展示） */
  private async loadTopics(dir: string): Promise<void> {
    const app = getApp();
    this.loadedTopicDir = dir;
    const prefix = dir + '/';
    const mdFiles = (app.vault.getFiles() || []).filter((f: any) => f.path.startsWith(prefix) && f.extension === 'md');
    const out: TopicEntry[] = mdFiles.map((f: any) => {
      let created = 0;
      try { created = (f as any).stat?.mtime ? new Date((f as any).stat.mtime).valueOf() : 0; } catch { created = 0; }
      return { file: f, path: f.path, title: f.basename, where: dir, created };
    });
    out.sort((a, b) => b.created - a.created || a.path.localeCompare(b.path));
    this.allTopics = out;
  }

  private renderTopics(): void {
    if (!this.contentEl) return;
    const rows = this.allTopics.map((t) => {
      const rel = formatRelativeTime(String(t.created || ''));
      return `<div class="bz-kb-lexrow" data-kb-act="topic-open" data-path="${esc(t.path)}">
      <div class="bz-kb-hw"><span class="bz-kb-w">${esc(t.title)}</span><span class="bz-kb-dom">${esc(t.where)}</span></div>
      <div class="bz-kb-tail"><span class="bz-kb-meta">${rel === '无效日期' ? '' : esc(rel)}</span></div>
    </div>`;
    }).join('');
    this.contentEl.innerHTML = `<div class="bz-kb-pd">
      ${rows || '<div class="bz-kb-empty">主题目录还没有笔记。</div>'}
    </div>`;
  }

  private async ensureCards(): Promise<void> {
    const dir = cardboxDirOf(tryGetSettings() as Partial<BzSettings> | undefined);
    if (!this.loadedCardDir || this.loadedCardDir !== dir || this.allCards.length === 0) await this.loadCards(dir);
  }

  /** 读笔记 frontmatter related 展示名列表（预览「关联」区；行扫描实现） */
  private async noteRels(n: PreviewEntry): Promise<string[]> {
    try {
      const app = getApp();
      const text = await app.vault.read(n.file);
      const lines = text.split(/\r?\n/);
      if (lines[0]?.trim() !== '---') return [];
      const out: string[] = [];
      let inRelated = false;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '---') break;
        if (/^related:/.test(line)) { inRelated = true; continue; }
        if (inRelated) {
          if (/^\s+-\s/.test(line)) {
            const mm = line.match(/^\s*-\s*"?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]"?\s*$/);
            if (mm) out.push(mm[2] || mm[1]);
          } else if (line.trim() !== '') {
            break; // related 列表结束
          }
        }
      }
      return out;
    } catch { return []; }
  }

  /** 弹层（面板内覆盖） */
  private openSheet(html: string): void {
    this.closeSheet();
    if (!this.popup) return;
    const ovl = document.createElement('div');
    ovl.className = 'bz-kb-ovl';
    ovl.innerHTML = `<div class="bz-kb-sheet">${html}</div>`;
    ovl.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-kb-act],[data-kb-close]') as HTMLElement | null;
      if (e.target === ovl || (t && t.hasAttribute('data-kb-close'))) { this.closeSheet(); return; }
      if (!t) return;
      const act = t.getAttribute('data-kb-act');
      if (act === 'card-new') {
        const w = t.closest('.bz-kb-sheet')?.querySelector('.bz-kb-hw .bz-kb-w')?.textContent || '';
        const n = this.allNotes.find((x) => x.title === w);
        if (n) void this.openCardEditor(n);
      } else if (act === 'card-save') {
        void this.saveCard();
      }
    });
    this.popup.appendChild(ovl);
    // 词头/为什么 输入 + 旧卡选择（编辑弹层）
    const titleInput = ovl.querySelector('[data-kb-role=cardtitle]') as HTMLInputElement | null;
    if (titleInput) titleInput.addEventListener('input', () => { if (this.editor) this.editor.title = titleInput.value; this.syncSaveBtn(); });
    const whyInput = ovl.querySelector('[data-kb-role=why]') as HTMLInputElement | null;
    if (whyInput) whyInput.addEventListener('input', () => { if (this.editor) this.editor.why = whyInput.value; this.syncSaveBtn(); });
    ovl.querySelectorAll('[data-kb-old]').forEach((b) => {
      b.addEventListener('click', () => {
        if (!this.editor) return;
        this.editor.pick = (b as HTMLElement).getAttribute('data-kb-old');
        ovl.querySelectorAll('[data-kb-old]').forEach((x) => x.classList.toggle('is-on', x === b));
        this.syncSaveBtn();
      });
    });
    this.syncSaveBtn();
  }
  private closeSheet(): void {
    this.popup?.querySelectorAll('.bz-kb-ovl').forEach((x) => x.remove());
    this.editor = null;
  }
  private sheetWrap(title: string, body: string): string {
    return `<div class="bz-kb-sheet-head"><span class="bz-kb-sheet-title">${esc(title)}</span></div><div class="bz-kb-sheet-body">${body}</div>`;
  }

  /** 旧笔记自动补全（note-gen；AI 未配置跳过并提示一句）；每目录至多跑一次 */
  private async runBackfill(): Promise<void> {
    const dir = litDirOf(tryGetSettings() as Partial<BzSettings> | undefined);
    if (this.backfilledDir === dir) return;
    this.backfilledDir = dir;
    try {
      const res = await backfillNotes();
      if (res && res.aiSkipped) {
        notice('AI 未配置：部分旧笔记缺少领域分类，已跳过补全（配置 AI 后重新打开面板可补全）', 'info');
      }
      if (res && res.filled > 0 && this.part === 'z1') await this.refreshCurrent();
    } catch { /* 补全失败静默，不影响列表 */ }
  }

  // ---- 主面板增量刷新（knowledge:file-* 四通道 300ms 防抖） ----

  private scheduleRefreshFlush(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(async () => {
      const deletes = Array.from(this.pendingDeletePaths);
      const modifies = Array.from(this.pendingRefreshPaths);
      this.pendingDeletePaths.clear();
      this.pendingRefreshPaths.clear();
      for (const p of deletes) this.removeCached(p);
      for (const p of modifies) this.invalidateCached(p);
      if (this.popup && this.popup.style.display === 'flex') await this.refreshCurrent();
    }, 300);
  }

  private removeCached(path: string): void {
    this.allNotes = this.allNotes.filter((n) => n.path !== path);
    this.allCards = this.allCards.filter((c) => c.path !== path);
    this.allTopics = this.allTopics.filter((t) => t.path !== path);
  }
  private invalidateCached(_path: string): void {
    // 任一缓存目录标记清零即可迫使 refreshCurrent 重扫（modifies 单条难精确定位到部）
    this.loadedLitDir = '';
    this.loadedCardDir = '';
    this.loadedTopicDir = '';
  }

  private attachFileListener(): void {
    if (this.fileListenerAttached) return;
    const inAnyDir = (path: string) => {
      const s = tryGetSettings() as Partial<BzSettings> | undefined;
      return path.startsWith(litDirOf(s) + '/') || path.startsWith(cardboxDirOf(s) + '/') || path.startsWith(topicDirOf(s) + '/');
    };
    const modifyHandler = (p: string) => { if (inAnyDir(p)) { this.pendingRefreshPaths.add(p); this.scheduleRefreshFlush(); } };
    const deleteHandler = (evt: { path: string }) => { if (inAnyDir(evt.path)) { this.pendingDeletePaths.add(evt.path); this.scheduleRefreshFlush(); } };
    const renameHandler = (evt: { oldPath: string; newPath: string; movedOut: boolean }) => {
      if (inAnyDir(evt.oldPath)) this.pendingDeletePaths.add(evt.oldPath);
      if (!evt.movedOut && inAnyDir(evt.newPath)) this.pendingRefreshPaths.add(evt.newPath);
      this.scheduleRefreshFlush();
    };
    this.fileListenerRefs = [
      onDomainEvent<{ path: string }>('knowledge:file-created', (evt) => modifyHandler(evt.path)),
      onDomainEvent<{ path: string }>('knowledge:file-modified', (evt) => modifyHandler(evt.path)),
      onDomainEvent<{ path: string }>('knowledge:file-deleted', deleteHandler),
      onDomainEvent<{ oldPath: string; newPath: string; movedOut: boolean }>('knowledge:file-renamed', renameHandler),
    ];
    this.fileListenerAttached = true;
  }

  // ==================== 视频录入面板（任务队列） ====================

  createVideoUI(): void {
    const mask = document.createElement('div');
    mask.id = 'knowledge-video-mask';
    mask.className = 'bz-kb-mask';
    mask.style.display = 'none';
    mask.onclick = () => this.hideVideo();
    const popup = document.createElement('div');
    popup.id = 'knowledge-video-popup';
    popup.className = 'bz-kb-window kb';
    popup.style.display = 'none';
    const header = document.createElement('div');
    header.className = 'bz-kb-vhead';
    header.innerHTML = `
      <h3 class="bz-kb-vtitle">视频录入</h3>
      <div class="bz-lit-head-btns">
        <button id="lit-btn-video-add" title="添加转文献任务">➕</button>
        <button id="lit-btn-video-run" class="bz-lit-run-btn" title="批量处理（桌面端）">▶️</button>
        <button id="lit-btn-video-history" title="历史">🕘</button>
      </div>`;
    const list = document.createElement('div');
    list.id = 'knowledge-video-list';
    list.className = 'bz-kb-list';
    popup.appendChild(header);
    popup.appendChild(list);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    this.videoMask = mask;
    this.videoPopup = popup;
    this.videoList = list;
    this._bindVideoHeaderEvents();
    // 移动端仅 ➕ + ✕（批量与历史隐藏——移动端无处理能力）
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
    q<HTMLButtonElement>(p, '#lit-btn-video-run')!.onclick = () => {
      if (BatchRunner.running) void this.onAbortBatch();
      else void this.onRunBatch();
    };
    q<HTMLButtonElement>(p, '#lit-btn-video-history')!.onclick = () => this.showHistory();
  }

  /** 打开视频录入面板；prefill 存在则叠开添加弹窗（聚合讯「保存至文献」入口）；打开即自动重抓缺信息任务（ADR-0133） */
  showVideoEntry(prefill?: { url: string; title?: string | null; uploader?: string | null }): void {
    if (!this.videoPopup || !this.videoMask) return;
    topifyZ(this.videoMask, this.videoPopup);
    this.videoMask.style.display = 'block';
    this.videoPopup.style.display = 'flex';
    void this.refreshVideoPanel();
    void this.backfillVideoTasks();
    if (prefill) this.showAddDialog({ url: prefill.url, title: prefill.title ?? null, uploader: prefill.uploader ?? null });
  }

  /**
   * 打开面板时的自动重抓（ADR-0133）：对缺标题任务串行补信息（标题/UP/时长，只补缺失），
   * 成功即落库；任务间 300ms 间隔防风控；已尝试过的 id 会话内不再重试，失败静默。
   * ADR-0134：链接里没有 BV 号（b23.tv 短链）的任务一并重抓——顺手把 url 修成规范链接，
   * 否则下载阶段认不出 BV 号（存量任务也据此自愈）。
   */
  private async backfillVideoTasks(): Promise<void> {
    if (this.backfillRunning) return;
    this.backfillRunning = true;
    try {
      const tasks = await KnowledgeData.loadTasks();
      const todo = tasks.filter((t) => !t.archived && t.url && !this.backfillTried.has(t.id) && (!t.title || !parseBvid(t.url)));
      if (todo.length) {
        const cookie = String(tryGetSettings()?.bilibiliCookie || '');
        for (const t of todo) {
          this.backfillTried.add(t.id);
          try {
            const res = await resolveVideo(t.url, cookie, Math.max(0, (t.page || 1) - 1));
            if (res) await this._persistResolved(t, res);
          } catch { /* 单条失败静默，继续后续 */ }
          await new Promise((r) => setTimeout(r, 300));
        }
        await this.refreshVideoPanel();
      }
    } catch { /* 面板流程不因重抓失败中断 */ }
    finally { this.backfillRunning = false; }
  }

  hideVideo(): void {
    if (this.videoMask) this.videoMask.style.display = 'none';
    if (this.videoPopup) this.videoPopup.style.display = 'none';
  }

  async refreshVideoPanel(): Promise<void> {
    const tasks = await KnowledgeData.loadTasks();
    if (!this.videoList) return;
    this.videoList.innerHTML = '';
    const active = tasks.filter((t) => !t.archived);
    const running = BatchRunner.running;
    if (running) {
      const idx = active.findIndex((t) => t.status === 'processing');
      const banner = document.createElement('div');
      banner.className = 'bz-kb-banner';
      banner.textContent = idx >= 0 ? `⏳ 正在处理 第 ${idx + 1}/${active.length} 部…` : '⏳ 正在准备处理…';
      this.videoList.appendChild(banner);
    }
    this._syncStatusCounts(active);
    if (active.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bz-kb-empty';
      empty.textContent = '暂无转文献任务。点击 ➕ 添加视频链接与起止时间，回到桌面端即可批量处理。';
      this.videoList.appendChild(empty);
      this._syncRunButton(active);
      return;
    }
    for (const t of active) this.videoList.appendChild(this.renderRow(t));
    this._syncRunButton(active);
  }

  private _syncStatusCounts(tasks: KnowledgeTask[]): void {
    const el = this.videoPopup ? q<HTMLElement>(this.videoPopup, '#lit-video-counts') : null;
    if (!el) return;
    const count = (s: KnowledgeTask['status']) => tasks.filter((t) => t.status === s).length;
    const parts: string[] = [];
    if (count('pending')) parts.push(`${count('pending')} 待处理`);
    if (count('processing')) parts.push(`${count('processing')} 处理中`);
    if (count('failed')) parts.push(`${count('failed')} 失败`);
    el.textContent = parts.join(' · ');
  }

  /** 单钮态机：空闲「▶️」/运行中「⏹」（终止靠 title hover 区分），移动端整钮隐藏 */
  private _syncRunButton(tasks: KnowledgeTask[]): void {
    if (!this.videoPopup) return;
    const run = q<HTMLButtonElement>(this.videoPopup, '#lit-btn-video-run');
    if (!run) return;
    const running = BatchRunner.running;
    const hasWork = tasks.some((t) => t.status === 'pending' || t.status === 'failed');
    if (running) {
      run.disabled = false;
      const retry = this.batchAbortLabel === '终止整批';
      run.textContent = '⏹';
      run.title = retry ? '中止整批（处理失败任务中）' : '中止批量处理';
    } else {
      run.disabled = !hasWork;
      run.textContent = '▶️';
      run.title = '批量处理（桌面端）';
    }
  }

  private renderRow(task: KnowledgeTask): HTMLElement {
    const card = document.createElement('div');
    card.className = 'bz-kb-taskcard';
    card.dataset.id = task.id;
    const meta = STATUS_META[task.status] ?? STATUS_META.pending;
    const pageTag = task.page && task.page > 1 ? `P${task.page} · ` : '';
    const timeText = task.start && task.end ? `${pageTag}${task.start} ~ ${task.end}` : `${pageTag}整片`;
    const durText = task.duration ? ` · ${secToTimeText(task.duration)}` : '';
    const linkLine = task.title
      ? `<a class="bz-kb-tlink" href="${esc(task.url)}" title="${esc(task.url)}">${esc(task.title)}</a>`
      : `<span class="bz-kb-turl" title="${esc(task.url)}">${esc(shortUrlText(task.url))}</span>`;
    const upText = task.uploader ? ` · UP主 ${esc(task.uploader)}` : '';
    card.innerHTML = `
      <div class="bz-kb-trow">
        <span class="bz-kb-status ${meta.cls}">${meta.label}</span>
        ${linkLine}
      </div>
      <div class="bz-kb-tmeta">${timeText}${durText}${upText}${task.remark ? ' · ' + esc(task.remark) : ''}</div>
      ${task.status === 'processing' ? (this.runState.has(task.id) ? '<div class="bz-kb-progress-box"></div>' : (task.reason ? `<div class="bz-kb-progress">${esc(task.reason)}</div>` : '')) : ''}
      ${task.status === 'failed' && task.reason ? `<div class="bz-kb-progress bz-kb-progress-error" title="${esc(task.reason)}">${esc(humanizeError(task.reason))}</div>` : ''}
      ${task.status === 'success' && task.notePath ? `<div class="bz-kb-notepath">📄 ${esc(task.notePath)}</div>` : ''}`;
    const actions = this.buildCardActions(task);
    if (actions.length) attachItemActions(card, actions);
    const titleLink = q<HTMLAnchorElement>(card, '.bz-kb-tlink');
    if (titleLink) titleLink.onclick = (e) => { e.stopPropagation(); this._openExternal(titleLink.href || task.url); };
    card.addEventListener('click', () => {
      if (task.status === 'success' && task.notePath) this.openNote(task.notePath);
      else if (task.status === 'pending' || task.status === 'failed') this.showAddDialog(task);
    });
    return card;
  }

  private buildCardActions(task: KnowledgeTask): ItemAction[] {
    const actions: ItemAction[] = [];
    if (task.status === 'success') {
      if (task.notePath) actions.push({ icon: 'book-open', label: '打开文献笔记', onClick: () => this.openNote(task.notePath!) });
      if (task.videoPath) actions.push({ icon: 'copy', label: '复制视频路径', onClick: () => void this.copyText(task.videoPath!) });
      actions.push({ icon: 'pencil', label: '编辑', onClick: () => this.showAddDialog(task) });
    } else if (task.status === 'failed' || task.status === 'pending') {
      actions.push({ icon: 'pencil', label: '编辑', onClick: () => this.showAddDialog(task) });
    }
    actions.push({ icon: 'trash-2', label: '删除', kind: 'danger', onClick: () => void this.confirmDelete(task) });
    return actions;
  }

  /** 行内进度定点更新（不等 storage 落库，一到立即刷 DOM） */
  private updateRowProgress(id: string): void {
    if (!this.videoList) return;
    const st = this.runState.get(id);
    const card = q<HTMLElement>(this.videoList, `.bz-kb-taskcard[data-id="${id}"]`);
    if (!card || !st) return;
    let box = q<HTMLElement>(card, '.bz-kb-progress-box');
    if (!box) {
      box = document.createElement('div');
      box.className = 'bz-kb-progress-box';
      const meta = q<HTMLElement>(card, '.bz-kb-tmeta');
      if (meta) meta.after(box);
      else card.appendChild(box);
    }
    if (tryGetSettings().knowledgeProgressDetail === false) {
      const cur = st.steps[st.steps.length - 1] || '处理中…';
      box.innerHTML = `<div class="bz-kb-progress">${esc(cur)}</div>`;
      return;
    }
    const segs = st.steps.map((s, i) =>
      i === st.steps.length - 1
        ? `<span class="bz-kb-step-cur">${esc(s)}</span>`
        : `<span class="bz-kb-step-done">✓ ${esc(stepDoneLabel(s))}</span>`
    );
    const pct = st.phase === 'download' ? st.pct : null;
    const bar = pct != null
      ? `<div class="bz-kb-progress-track"><div class="bz-kb-progress-fill" style="width:${Math.min(100, Math.max(0, pct))}%"></div></div>`
      : '';
    box.innerHTML = `
      <div class="bz-kb-steps">${segs.join('<span class="bz-kb-step-arrow">→</span>')}${pct != null ? ` <span class="bz-kb-step-pct">${Math.round(pct)}%</span>` : ''}</div>
      ${bar}
      <div class="bz-kb-elapsed">⌛ ${fmtElapsed(Date.now() - st.startAt)}</div>`;
  }

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
    const tasks = await KnowledgeData.loadTasks();
    const work = tasks.filter((t) => !t.archived && (t.status === 'pending' || t.status === 'failed'));
    if (work.length === 0) { notice('没有待处理或失败的任务', 'info'); return; }
    this.batchAbortLabel = work.every((t) => t.status === 'failed') ? '终止整批' : '终止';
    const ui = this;
    ui.startRunTimer();
    const events: BatchEvents = {
      onTaskProgress: (t, stepText, progress) => {
        let st = ui.runState.get(t.id);
        if (!st) { st = { steps: [], phase: null, pct: null, startAt: Date.now() }; ui.runState.set(t.id, st); }
        if (stepText && stepText !== '启动中…' && !st.steps.includes(stepText)) st.steps.push(stepText);
        if (progress) {
          if (progress.phase) st.phase = progress.phase;
          if (progress.pct != null) st.pct = progress.pct;
        }
        ui.updateRowProgress(t.id);
      },
      onTaskInfo: () => { void ui.refreshVideoPanel(); },
      onTaskDone: () => { void ui.refreshVideoPanel(); },
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
      // issue 291：流程框挂 document.body，脱离面板根后纸墨 token 与域弹窗类全部失效。
      // 必须显式带两个类——'kb' = 纸墨变量作用域（本域 styles.css :7-33，亮暗两档），
      // 'bz-kb-flow-dialog' = 域弹窗类（供 id 选择器把共享壳改写成本域材质），
      // 否则本框与同域的「添加文献」「术语录入」弹窗不同皮（缺 'kb' 连底色都失效，同 issue 257 事故）。
      className: 'kb bz-kb-flow-dialog',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '中止', value: 'ok', danger: true },
      ],
    });
    if (v !== 'ok') return;
    BatchRunner.abort();
    await this.refreshVideoPanel();
  }

  private async confirmDelete(task: KnowledgeTask): Promise<void> {
    const v = await openFlowDialog({
      title: '删除转文献任务',
      message: '仅从列表移除记录，已生成的文献笔记与视频不受影响。',
      // issue 291：同上——弹窗挂 body 必须自带 'kb'（token 作用域）+ 'bz-kb-flow-dialog'（域皮）
      className: 'kb bz-kb-flow-dialog',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '删除', value: 'ok', danger: true },
      ],
    });
    if (v !== 'ok') return;
    await KnowledgeData.deleteTask(task.id);
    await this.refreshVideoPanel();
    await this.refreshHistory();
  }

  private async confirmClearHistory(): Promise<void> {
    const v = await openFlowDialog({
      title: '清空历史',
      message: '将移除全部「成功」归档记录；文献笔记与视频文件保留在原处。',
      // issue 291：同上——挂 body 的流程框须显式带皮肤类才与「历史」窗口同皮
      className: 'kb bz-kb-flow-dialog',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '清空', value: 'ok', danger: true },
      ],
    });
    if (v !== 'ok') return;
    await KnowledgeData.clearHistory();
    await this.refreshHistory();
  }

  // ==================== 添加任务弹窗 ====================

  createAddDialog(): void {
    const addMask = document.createElement('div');
    addMask.id = 'knowledge-add-mask';
    addMask.className = 'bz-kb-mask';
    addMask.style.display = 'none';
    addMask.onclick = () => this.hideAddDialog();
    const popup = document.createElement('div');
    popup.id = 'knowledge-add-popup';
    popup.className = 'bz-lit-dialog kb'; // kb：纸墨皮变量作用域（缺此背景 var(--panel) 失效成透明，issue 257）
    popup.style.display = 'none';
    // ADR-0133：单框 + 解析按钮 → 只读信息区（标题/UP/分P 下拉）→ 双把手范围 + 时间框 → 清晰度；两端统一「保存」
    popup.innerHTML = `
      <div id="lit-add-mode" class="bz-lit-mode-tag" style="display:none;">编辑任务</div>
      <div id="lit-add-fail" class="bz-lit-form-alert" style="display:none;"></div>
      <div class="bz-lit-form-col bz-lit-url-col">
        <label>视频链接 / BV 号</label>
        <div class="bz-lit-url-row">
          <input id="lit-add-url" type="text">
          <button id="lit-add-resolve" type="button">解析</button>
        </div>
      </div>
      <div id="lit-add-rstate" class="bz-lit-rstate" style="display:none;"></div>
      <div id="lit-add-info" class="bz-lit-info" style="display:none;">
        <div class="bz-lit-info-line"><span class="bz-lit-info-k">标题</span><span class="bz-lit-info-v" id="lit-add-ititle"></span></div>
        <div class="bz-lit-info-line"><span class="bz-lit-info-k">UP 主</span><span class="bz-lit-info-v" id="lit-add-iuploader"></span></div>
      </div>
      <div class="bz-lit-form-col" id="lit-add-page-row" style="display:none;">
        <label>分P</label>
        <select id="lit-add-page"></select>
      </div>
      <div class="bz-lit-form-col" id="lit-add-pagenum-row" style="display:none;">
        <label>分P</label>
        <input id="lit-add-page-num" type="number" min="1" step="1">
      </div>
      <div class="bz-lit-range-area">
        <div class="bz-lit-range-head">
          <label>剪辑范围</label>
          <button id="lit-add-whole" type="button">整片</button>
        </div>
        <div id="lit-add-rb"></div>
        <div class="bz-lit-form-row">
          <div class="bz-lit-form-col"><label>开始时间</label>
            <input id="lit-add-start" type="text"></div>
          <div class="bz-lit-form-col"><label>结束时间</label>
            <input id="lit-add-end" type="text"></div>
        </div>
      </div>
      <div class="bz-lit-form-col">
        <label>下载清晰度</label>
        <select id="lit-add-quality"></select>
        <div id="lit-add-rhint" class="bz-lit-rhint" style="display:none;"></div>
      </div>
      <div class="bz-lit-form-actions">
        <button id="lit-add-save" class="bz-lit-accent-btn">保存</button>
      </div>`;
    document.body.appendChild(addMask);
    document.body.appendChild(popup);
    this.addMask = addMask;
    this.addPopup = popup;
    q<HTMLButtonElement>(popup, '#lit-add-save')!.onclick = () => void this._handleAddSave();
    q<HTMLButtonElement>(popup, '#lit-add-resolve')!.onclick = () => void this._handleResolve();
    q<HTMLButtonElement>(popup, '#lit-add-whole')!.onclick = () => this._resetAddRange();
    // 链接框：输入即作废已解析信息并放弃在途解析（需重新点「解析」，ADR-0133）；回车 = 解析
    const addUrlInput = q<HTMLInputElement>(popup, '#lit-add-url');
    if (addUrlInput) {
      addUrlInput.addEventListener('input', () => {
        this.addUrlSeq++; // 在途解析过期（回填前序列号校验丢弃）
        this.addResolving = false; // 改输入 = 放弃在途解析：按钮恢复可用
        this._setResolveState(null);
        if (this.addMeta || this.addDuration > 0) {
          this.addMeta = null;
          this.addQualities = null;
          this.addDuration = 0;
          this.addStart = 0;
          this.addEnd = 0;
          this.addPage = 1; // 分 P 同作废（防把上一条视频选过的 P 落到新链接，review 306）
        }
        this._renderAdd();
      });
      addUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (this.addResolving) return; // 解析中不重复起请求（按钮同款约束）
          void this._handleResolve();
        }
      });
    }
    // 分P 下拉：切 P → 量程更新 + 范围重置 + 档位重查（ADR-0133）
    q<HTMLSelectElement>(popup, '#lit-add-page')?.addEventListener('change', (e) => {
      void this._switchAddPage(Number((e.target as HTMLSelectElement).value) || 1);
    });
    // 时间框：blur/回车提交秒值（钳制 + 同步进度条）；↑/↓ = ±1 秒（Shift ±10）；回车提交后保存
    for (const [sel, which] of [['#lit-add-start', 'start'], ['#lit-add-end', 'end']] as const) {
      const input = q<HTMLInputElement>(popup, sel);
      if (!input) continue;
      input.addEventListener('change', () => this._commitTimeInput(which));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          this._nudgeTime(which, e.key === 'ArrowUp' ? 1 : -1, e.shiftKey ? 10 : 1);
        } else if (e.key === 'Enter') { e.preventDefault(); this._commitTimeInput(which, true); void this._handleAddSave(); }
      });
    }
    const numInput = q<HTMLInputElement>(popup, '#lit-add-page-num');
    if (numInput) {
      // 输入即同步状态：_renderAdd 的回写不吞用户手填（review 306）
      numInput.addEventListener('input', () => {
        const n = Number(numInput.value.trim());
        this.addPage = Number.isInteger(n) && n > 0 ? n : 1;
      });
      numInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); void this._handleAddSave(); }
      });
    }
    this._renderAdd();
  }

  showAddDialog(editItem?: Partial<KnowledgeTask>): void {
    if (!this.addPopup || !this.addMask) return;
    this.addUrlReset(); // 开弹窗使在途解析过期（ADR-0133）
    this.editingId = editItem?.id ?? null;
    const modeTag = q<HTMLElement>(this.addPopup, '#lit-add-mode');
    if (modeTag) modeTag.style.display = this.editingId ? 'inline-block' : 'none';
    (q<HTMLInputElement>(this.addPopup, '#lit-add-url')!).value = editItem?.url ?? '';
    // 解析态回显（ADR-0133）：编辑态先铺任务已有信息（解析失败不丢），再自动重抓刷新
    this.addMeta = editItem && (editItem.title || editItem.uploader)
      ? { title: editItem.title || undefined, uploader: editItem.uploader || undefined }
      : null;
    this.addQualities = null;
    this.addResolving = false;
    this.addPage = editItem?.page && editItem.page > 0 ? editItem.page : 1;
    this.addDuration = editItem?.duration && editItem.duration > 0 ? editItem.duration : 0;
    this.addStart = timeTextToSec(editItem?.start ?? '') ?? 0;
    this.addEnd = timeTextToSec(editItem?.end ?? '') ?? this.addDuration;
    this._setResolveState(null);
    this._renderAdd(this.editingId !== null);
    if (editItem?.quality) {
      const qSel = q<HTMLSelectElement>(this.addPopup, '#lit-add-quality');
      if (qSel) qSel.value = editItem.quality;
    }
    const fail = q<HTMLElement>(this.addPopup, '#lit-add-fail');
    if (fail) {
      const reason = editItem?.status === 'failed' ? (editItem.reason || '') : '';
      fail.style.display = reason ? 'block' : 'none';
      fail.textContent = reason ? `上次处理失败：${humanizeError(reason)}` : '';
      fail.title = reason;
    }
    topifyZ(this.addMask, this.addPopup);
    this.addMask.style.display = 'block';
    this.addPopup.style.display = 'flex';
    const urlInput = q<HTMLInputElement>(this.addPopup, '#lit-add-url');
    if (urlInput) setTimeout(() => urlInput.focus(), 100);
    // 打开即自动重抓（ADR-0133：无需用户操作；失败静默保留已有值）
    if ((editItem?.url ?? '').trim()) void this._handleResolve({ auto: true });
  }

  /** 弹窗全量重绘（ADR-0133 状态单源）：信息区 / 分P 控件 / 范围条 / 档位下拉 / 按钮态 */
  private _renderAdd(preserveQuality = false): void {
    const popup = this.addPopup;
    if (!popup) return;
    const prevQuality = preserveQuality ? q<HTMLSelectElement>(popup, '#lit-add-quality')?.value ?? null : null;
    const meta = this.addMeta;
    const pages = meta?.pages || [];
    const multi = pages.length > 1;
    // 信息区（标题 / UP 主只读；缺项显示占位）
    const info = q<HTMLElement>(popup, '#lit-add-info');
    if (info) info.style.display = meta && (meta.title || meta.uploader) ? '' : 'none';
    const tEl = q<HTMLElement>(popup, '#lit-add-ititle');
    if (tEl) { tEl.textContent = meta?.title || '（未取到标题）'; tEl.title = meta?.title || ''; }
    const uEl = q<HTMLElement>(popup, '#lit-add-iuploader');
    if (uEl) { uEl.textContent = meta?.uploader || '（未取到）'; uEl.title = meta?.uploader || ''; }
    // 分P：多 P 下拉；单 P 隐藏（拍板）；无 pages 信息 → 数字框（失败态口径，可手填）
    const pageRow = q<HTMLElement>(popup, '#lit-add-page-row');
    const numRow = q<HTMLElement>(popup, '#lit-add-pagenum-row');
    if (pageRow) pageRow.style.display = multi ? '' : 'none';
    if (numRow) numRow.style.display = pages.length ? 'none' : '';
    const sel = q<HTMLSelectElement>(popup, '#lit-add-page');
    if (multi && sel) {
      sel.innerHTML = pages.map((p) => `<option value="${p.page}">${esc(this._pageLabel(p))}</option>`).join('');
      sel.value = String(this.addPage);
    }
    const num = q<HTMLInputElement>(popup, '#lit-add-page-num');
    if (num && !pages.length) num.value = this.addPage > 1 ? String(this.addPage) : '';
    this._rebuildBar();
    this._paintRange();
    this._renderQualitySelect(prevQuality);
    const rBtn = q<HTMLButtonElement>(popup, '#lit-add-resolve');
    if (rBtn) { rBtn.disabled = this.addResolving; rBtn.textContent = this.addResolving ? '解析中…' : '解析'; }
    const sBtn = q<HTMLButtonElement>(popup, '#lit-add-save');
    if (sBtn) sBtn.disabled = this.addResolving;
  }

  /** 分P 下拉项文案：P{n} · {标题} · {时长}（时长未知省略） */
  private _pageLabel(p: { page: number; part: string; duration: number }): string {
    const parts = [`P${p.page}`];
    if (p.part) parts.push(p.part);
    if (p.duration > 0) parts.push(secToTimeText(p.duration));
    return parts.join(' · ');
  }

  /** 档位标签：4K / 2K / {h}P（口径随 CLI qualityLabel，不带帧率） */
  private _heightLabel(h: number): string {
    return h >= 2160 ? '4K' : h >= 1440 ? '2K' : `${h}P`;
  }

  /**
   * 清晰度下拉重绘（ADR-0133）：有实测档位 → [最高, 实测各档]，默认选中全局设置对应的具体档
   * （不可用回落最高可用 + 提示）；无实测档位 → 固定 [最高, 1080P, 720P]，默认全局档。
   * prevValue 仍在新列表内时优先保留（编辑态回显 / 切 P 重查）。
   */
  private _renderQualitySelect(prevValue: string | null): void {
    const popup = this.addPopup;
    if (!popup) return;
    const sel = q<HTMLSelectElement>(popup, '#lit-add-quality');
    if (!sel) return;
    const hint = q<HTMLElement>(popup, '#lit-add-rhint');
    const globalQ = String(tryGetSettings()?.knowledgeQuality || 'highest');
    const heights = this.addQualities;
    const opts: Array<{ value: string; label: string }> = [];
    let def = 'highest';
    let hintText = '';
    if (heights && heights.length) {
      opts.push({ value: 'highest', label: '最高' });
      for (const h of heights) opts.push({ value: String(h), label: this._heightLabel(h) });
      const gv = /^\d+$/.test(globalQ) ? Number(globalQ) : 0;
      if (gv) {
        if (heights.includes(gv)) def = String(gv);
        else { def = String(heights[0]); hintText = `全局 ${gv}P 在该视频不可用，已选最高可用 ${heights[0]}P`; }
      }
    } else {
      opts.push({ value: 'highest', label: '最高' }, { value: '1080', label: '1080P' }, { value: '720', label: '720P' });
      if (/^\d+$/.test(globalQ) && (globalQ === '1080' || globalQ === '720')) def = globalQ;
    }
    const keep = prevValue && opts.some((o) => o.value === prevValue) ? prevValue : null;
    sel.innerHTML = opts.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
    sel.value = keep || def;
    if (hint) { hint.style.display = hintText ? '' : 'none'; hint.textContent = hintText; }
  }

  /** 范围条重建（量程 < 2 秒 = 无进度条：失败态/未知时长只出时间框）；实例在宿主上时只 set 复用（重绘不摘把手） */
  private _rebuildBar(): void {
    const popup = this.addPopup;
    if (!popup) return;
    const host = q<HTMLElement>(popup, '#lit-add-rb');
    if (!host) return;
    if (this.addDuration < 2) {
      host.innerHTML = '';
      host.style.display = 'none';
      this.addBar = null;
      return;
    }
    host.style.display = '';
    if (this.addBar && this.addBar.el.parentElement === host) {
      this.addBar.set(this.addDuration, this.addStart, this.addEnd);
      return;
    }
    host.innerHTML = '';
    const bar = new RangeBar({
      onChange: (s, e) => { this.addStart = s; this.addEnd = e; this._paintRange(); },
    });
    bar.set(this.addDuration, this.addStart, this.addEnd);
    host.appendChild(bar.el);
    this.addBar = bar;
  }

  /** 范围值 → 进度条 + 时间框（`only` = 只重写该框、不碰另一个——防覆盖用户正在输入的框；null = 两个都写） */
  private _paintRange(only: 'start' | 'end' | null = null): void {
    const popup = this.addPopup;
    if (!popup) return;
    if (this.addBar && this.addDuration >= 2) this.addBar.set(this.addDuration, this.addStart, this.addEnd);
    const sEl = q<HTMLInputElement>(popup, '#lit-add-start');
    const eEl = q<HTMLInputElement>(popup, '#lit-add-end');
    if (sEl && only !== 'end') sEl.value = this.addStart > 0 || this.addDuration > 0 ? secToTimeText(this.addStart) : '';
    if (eEl && only !== 'start') eEl.value = this.addEnd > 0 ? secToTimeText(this.addEnd) : '';
  }

  /** 「整片」一键重置（ADR-0133）：有量程 → 全选；无时长 → 清空时间框 */
  private _resetAddRange(): void {
    this.addStart = 0;
    this.addEnd = this.addDuration > 0 ? this.addDuration : 0;
    this._paintRange();
  }

  /** 时间框提交（blur/回车）：宽松解析 → 钳制到量程 → 回写状态与把手；非法值时回填旧值 */
  private _commitTimeInput(which: 'start' | 'end', silent = false): void {
    const popup = this.addPopup;
    if (!popup) return;
    const input = q<HTMLInputElement>(popup, which === 'start' ? '#lit-add-start' : '#lit-add-end');
    if (!input) return;
    const raw = input.value.trim();
    const sec = timeTextToSec(raw);
    if (sec === null) {
      if (raw && !silent) notice('时间格式看不懂：支持 12.2 / 12-2 / 1:30:05 等，单个数字按分钟算', 'error');
      input.value = this.addDuration > 0 ? secToTimeText(which === 'start' ? this.addStart : this.addEnd) : '';
      return;
    }
    if (which === 'start') this.addStart = Math.max(0, Math.min(sec, this.addDuration > 0 ? this.addEnd - 1 : Number.MAX_SAFE_INTEGER));
    else this.addEnd = Math.min(this.addDuration > 0 ? this.addDuration : Number.MAX_SAFE_INTEGER, Math.max(sec, this.addDuration > 0 ? this.addStart + 1 : 0));
    this._paintRange(which);
  }

  /** 时间框 ↑/↓ 微调（ADR-0133：一次 1 秒，Shift ±10） */
  private _nudgeTime(which: 'start' | 'end', dir: 1 | -1, step: number): void {
    if (which === 'start') this.addStart = Math.max(0, Math.min(this.addStart + dir * step, this.addDuration > 0 ? this.addEnd - 1 : Number.MAX_SAFE_INTEGER));
    else this.addEnd = Math.min(this.addDuration > 0 ? this.addDuration : Number.MAX_SAFE_INTEGER, Math.max(this.addEnd + dir * step, this.addDuration > 0 ? this.addStart + 1 : 0));
    this._paintRange(which);
  }

  /** 解析态提示行（解析中/失败原因；null = 隐藏） */
  private _setResolveState(text: string | null, kind: 'busy' | 'error' = 'error'): void {
    const el = this.addPopup ? q<HTMLElement>(this.addPopup, '#lit-add-rstate') : null;
    if (!el) return;
    el.style.display = text ? '' : 'none';
    el.textContent = text || '';
    el.classList.toggle('is-error', !!text && kind === 'error');
  }

  /** 分P 切换（ADR-0133）：量程与范围重置为全选，档位按该 P 的 cid 静默重查（未登录/失败 → 清档回落固定列表） */
  private async _switchAddPage(p: number): Promise<void> {
    const popup = this.addPopup;
    if (!popup) return;
    this.addPage = p;
    const pages = this.addMeta?.pages || [];
    const sel = pages.find((x) => x.page === p) || pages[0];
    const dur = sel?.duration || this.addMeta?.duration || 0;
    this.addDuration = dur;
    this.addStart = 0;
    this.addEnd = dur;
    this._rebuildBar();
    this._paintRange();
    const cookie = String(tryGetSettings()?.bilibiliCookie || '');
    // 短链（b23.tv）链接里没有 BV 号：用解析出的 meta.bvid（ADR-0134）
    const bvid = this.addMeta?.bvid || parseBvid(q<HTMLInputElement>(popup, '#lit-add-url')?.value || '');
    if (!cookie || !bvid || !sel?.cid) return;
    const cur = q<HTMLSelectElement>(popup, '#lit-add-quality')?.value ?? null;
    const qualities = await fetchCheckedQualities(bvid, sel.cid, cookie);
    if (this.addPopup !== popup || this.addPage !== p) return;
    // 拿不到（含登录态失效）→ 清档回落固定列表，不留上一 P 的档位当真
    this.addQualities = qualities;
    this._renderQualitySelect(cur);
  }

  /**
   * 「解析」按钮 / 打开弹窗自动重抓（ADR-0133）：净化写回 → resolveVideo（meta + 实测档位）→ 渲染。
   * 手动解析：按钮 loading + 保存禁用；自动重抓：全程静默、不阻塞保存（失败保留已有值）。
   * 手动解析失败进失败态（可手填分 P 与时间范围）；编辑态自动重抓成功 → 即落库（只补缺失字段）。
   */
  private async _handleResolve(opts?: { auto?: boolean }): Promise<void> {
    const popup = this.addPopup;
    if (!popup) return;
    const urlInput = q<HTMLInputElement>(popup, '#lit-add-url');
    if (!urlInput) return;
    const cleaned = normalizeSourceUrl(urlInput.value.trim());
    if (!cleaned) {
      if (!opts?.auto) { notice('请填写视频链接或 BV 号', 'error'); urlInput.focus(); }
      return;
    }
    if (cleaned !== urlInput.value) urlInput.value = cleaned; // 净化写回（用户可见）
    const seq = ++this.addUrlSeq;
    const manual = !opts?.auto;
    if (manual) {
      this.addResolving = true;
      this._setResolveState('解析中…', 'busy');
      this._renderAdd(true);
    }
    const cookie = String(tryGetSettings()?.bilibiliCookie || '');
    const res = await resolveVideo(cleaned, cookie, Math.max(0, this.addPage - 1));
    if (seq !== this.addUrlSeq || this.addPopup !== popup) return; // 过期响应丢弃：busy 态由输入处理/关闭/新解析各自收尾
    this.addResolving = false;
    if (!res) {
      if (!opts?.auto) {
        this.addMeta = null;
        this.addQualities = null;
        this.addDuration = 0;
        this.addStart = 0;
        this.addEnd = 0;
        this._setResolveState('解析失败：拿不到视频信息（网络不可达 / 视频被删 / 非 B 站链接）——可手动填写分 P 与时间范围');
      }
      this._renderAdd(true);
      return;
    }
    this._setResolveState(null);
    this._applyResolved(res);
    // 短链（b23.tv 分享链接）写回规范链接：用户看得见落地目标，下载器也才认得出 BV 号（ADR-0134）
    if (res.meta.bvid && !parseBvid(cleaned)) urlInput.value = canonicalVideoUrl(res.meta.bvid);
    this._renderAdd(opts?.auto === true);
    if (opts?.auto) {
      const editId = this.editingId; // await 前捕获：期间换任务/关弹窗即作废（review 306）
      if (editId) {
        const tasks = await KnowledgeData.loadTasks();
        const cur = tasks.find((t) => t.id === editId);
        if (cur && this.editingId === editId && this.addPopup === popup) await this._persistResolved(cur, res);
      }
    }
  }

  /** 解析结果落地到弹窗状态：分 P 校正 / 量程 / 范围（首次拿到时长 → 全选；已有范围 → 钳制保持） */
  private _applyResolved(res: ResolvedVideo): void {
    const meta = res.meta;
    const pages = meta.pages || [];
    if (pages.length > 1) {
      if (!pages.some((p) => p.page === this.addPage)) this.addPage = pages[0].page;
    } else {
      this.addPage = pages[0]?.page ?? 1;
    }
    const sel = pages.find((p) => p.page === this.addPage) || pages[0];
    const newDur = sel?.duration || meta.duration || 0;
    // 新时长缺失（如只拿到标题的兜底路径）→ 保留旧量程，防编辑态范围被清成"成对填写"死局（review 306）
    const dur = newDur > 0 ? newDur : this.addDuration;
    const hadRange = this.addDuration > 0;
    this.addMeta = meta;
    this.addQualities = res.qualities || null;
    this.addDuration = dur;
    if (dur > 0) {
      if (hadRange) {
        this.addStart = Math.max(0, Math.min(this.addStart, dur - 1));
        this.addEnd = Math.min(dur, Math.max(this.addEnd, this.addStart + 1));
      } else {
        this.addStart = 0;
        this.addEnd = dur;
      }
    }
  }

  /** 抓取成功即落库（ADR-0133）：只补缺失字段（标题/UP/时长），失败静默不打断录入 */
  private async _persistResolved(task: KnowledgeTask, res: ResolvedVideo): Promise<void> {
    try {
      const patch: Partial<KnowledgeTask> = {};
      const meta = res.meta;
      // 存量短链任务顺手修 URL（老链接只存了 b23.tv，下载阶段认不出 BV 号；ADR-0134）
      if (meta.bvid && !parseBvid(task.url)) patch.url = canonicalVideoUrl(meta.bvid);
      if (!task.title && meta.title) patch.title = meta.title;
      if (!task.uploader && meta.uploader) patch.uploader = meta.uploader;
      // duration 语义 = 该任务将下载的那个分 P 的时长（多 P 时按 task.page 取，与弹窗保存同口径）
      const pages = meta.pages || [];
      const pageIdx = Math.max(0, (task.page || 1) - 1);
      const sel = pages[pageIdx] || pages[0];
      const dur = (sel && sel.duration > 0 ? sel.duration : 0) || meta.duration || 0;
      if (!task.duration && dur > 0) patch.duration = dur;
      if (!Object.keys(patch).length) return;
      await KnowledgeData.updateTask(task.id, patch);
      // 面板可见时同步刷新卡片（不派域事件：smartcat 行为流只收 converted / term-generated）
      if (this.videoPopup && this.videoPopup.style.display === 'flex') await this.refreshVideoPanel();
    } catch { /* 落库失败不阻塞（用户仍可点保存） */ }
  }

  hideAddDialog(): void {
    if (this.addMask) this.addMask.style.display = 'none';
    if (this.addPopup) this.addPopup.style.display = 'none';
    this.editingId = null;
    this.addUrlReset(); // 关弹窗使在途解析过期（杜绝迟到回填到已卸载 DOM）
    this.addMeta = null;
    this.addQualities = null;
    this.addResolving = false;
    this.addPage = 1;
    this.addDuration = 0;
    this.addStart = 0;
    this.addEnd = 0;
    this.addBar = null;
    // 清档位下拉：下次干净打开时无残值可选（编辑态由 showAddDialog 显式回填 task.quality，review 306）
    const qSel = this.addPopup ? q<HTMLSelectElement>(this.addPopup, '#lit-add-quality') : null;
    if (qSel) qSel.innerHTML = '';
  }

  /** 录入解析清理：序列号失效在途响应（开/关弹窗共用，ADR-0133） */
  private addUrlReset(): void {
    this.addUrlSeq++;
  }

  private async _handleAddSave(): Promise<void> {
    if (!this.addPopup) return;
    if (this.addResolving) { notice('解析中，请稍候', 'info'); return; }
    // 保存前净化兜底（ADR-0133）：裸 BV 号/非 http 文本原样
    let url = normalizeSourceUrl((q<HTMLInputElement>(this.addPopup, '#lit-add-url')?.value ?? '').trim());
    if (!url) { notice('请填写视频链接或 BV 号', 'error'); q<HTMLInputElement>(this.addPopup, '#lit-add-url')?.focus(); return; }
    // 解析过但链接里没有 BV 号（b23.tv 短链）→ 按解析出的 bvid 落库规范链接（ADR-0134）
    const resolvedBvid = this.addMeta?.bvid;
    if (resolvedBvid && !parseBvid(url)) url = canonicalVideoUrl(resolvedBvid);
    // 时间框现值先提交进状态（防用户输入后直接点保存）
    this._commitTimeInput('start', true);
    this._commitTimeInput('end', true);
    const dur = this.addDuration;
    // 整片判定：有量程 = 全选（start=0 且 end=duration）；无时长 = 两端都空
    const whole = this.addStart <= 0 && (dur > 0 ? this.addEnd >= dur : this.addEnd <= 0);
    let start: string | null = null;
    let end: string | null = null;
    if (!whole) {
      if (!(this.addStart > 0) || !(this.addEnd > 0)) { notice('开始与结束时间需成对填写', 'error'); return; }
      if (this.addStart >= this.addEnd) { notice('结束时间需大于开始时间', 'error'); return; }
      start = secToTimeText(this.addStart);
      end = secToTimeText(this.addEnd);
    }
    // 分P：多 P 下拉 → 选中值（P1 归一 null）；无 pages 信息 → 数字框手填；单 P 恒 null
    let page: number | null = null;
    const pages = this.addMeta?.pages || [];
    if (pages.length > 1) {
      page = this.addPage > 1 ? this.addPage : null;
    } else if (!pages.length) {
      const raw = (q<HTMLInputElement>(this.addPopup, '#lit-add-page-num')?.value ?? '').trim();
      if (raw) {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1) { notice('分P 应为正整数（留空 = 第 1 P）', 'error'); q<HTMLInputElement>(this.addPopup, '#lit-add-page-num')?.focus(); return; }
        page = n > 1 ? n : null;
      }
    }
    const quality = (q<HTMLSelectElement>(this.addPopup, '#lit-add-quality')?.value ?? '').trim() || null;
    try {
      const patch = {
        url,
        start,
        end,
        quality,
        page,
        title: this.addMeta?.title || null,
        uploader: this.addMeta?.uploader || null,
        duration: dur > 0 ? dur : null,
      };
      if (this.editingId) {
        await KnowledgeData.updateTask(this.editingId, patch);
      } else {
        await KnowledgeData.addTask(patch);
      }
      this.hideAddDialog();
      await this.refreshVideoPanel();
    } catch (e: any) {
      notice('保存失败：' + (e?.message ?? String(e)), 'error');
    }
  }

  // ==================== 历史弹窗 ====================

  createHistoryUI(): void {
    const mask = document.createElement('div');
    mask.id = 'knowledge-history-mask';
    mask.className = 'bz-kb-mask';
    mask.style.display = 'none';
    mask.onclick = () => this.hideHistory();
    const popup = document.createElement('div');
    popup.id = 'knowledge-history-popup';
    popup.className = 'bz-kb-window kb';
    popup.style.display = 'none';
    const toolbar = document.createElement('div');
    toolbar.className = 'bz-kb-vhead';
    const counts = document.createElement('span');
    counts.id = 'lit-history-counts';
    counts.className = 'bz-kb-vmeta';
    toolbar.appendChild(counts);
    const list = document.createElement('div');
    list.id = 'knowledge-history-list';
    list.className = 'bz-kb-list';
    popup.appendChild(toolbar);
    popup.appendChild(list);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    this.historyMask = mask;
    this.historyPopup = popup;
    this.historyList = list;
  }

  showHistory(): void {
    if (!this.historyPopup || !this.historyMask) return;
    topifyZ(this.historyMask, this.historyPopup);
    this.historyMask.style.display = 'block';
    this.historyPopup.style.display = 'flex';
    void this.refreshHistory();
  }

  hideHistory(): void {
    if (this.historyMask) this.historyMask.style.display = 'none';
    if (this.historyPopup) this.historyPopup.style.display = 'none';
  }

  private async refreshHistory(): Promise<void> {
    if (!this.historyList) return;
    const tasks = await KnowledgeData.loadTasks();
    if (!this.historyList) return;
    this.historyList.innerHTML = '';
    const rows = tasks.filter((t) => t.archived);
    const countsEl = this.historyPopup ? q<HTMLElement>(this.historyPopup, '#lit-history-counts') : null;
    if (countsEl) countsEl.textContent = `🕘 历史 · 共 ${rows.length} 条`;
    if (rows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bz-kb-empty';
      empty.textContent = '暂无历史记录。成功的任务完成时会自动归档到这里。';
      this.historyList.appendChild(empty);
      return;
    }
    const groups = new Map<string, KnowledgeTask[]>();
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

  private renderHistoryGroup(group: KnowledgeTask[]): HTMLElement {
    const head = group[0];
    const card = document.createElement('div');
    card.className = 'bz-kb-taskcard bz-kb-hgroup';
    card.dataset.url = head.url || '';
    const href = head.url ? `href="${esc(head.url)}"` : '';
    const upText = head.uploader ? `<span class="bz-kb-hup">${esc(head.uploader)}</span>` : '';
    card.innerHTML = `
      <div class="bz-kb-trow">
        ${head.title
          ? `<a class="bz-kb-tlink" ${href} title="${esc(head.url || '')}">${esc(head.title)}</a>`
          : `<span class="bz-kb-turl" title="${esc(head.url || '')}">${esc(shortUrlText(head.url || ''))}</span>`}
        ${upText}
      </div>`;
    for (const task of group) {
      const line = document.createElement('div');
      line.className = 'bz-kb-hnote';
      line.innerHTML = `📄 ${esc(shortNoteName(task.notePath || ''))}<span class="bz-kb-hnote-time">⏱ ${esc(formatRelativeTime(task.processedAt || task.created || ''))}</span>`;
      line.addEventListener('click', () => { if (task.notePath) this.openNote(task.notePath); });
      const actions: ItemAction[] = [];
      if (task.notePath) actions.push({ icon: 'book-open', label: '打开文献笔记', onClick: () => this.openNote(task.notePath!) });
      if (task.videoPath) actions.push({ icon: 'copy', label: '复制视频路径', onClick: () => void this.copyText(task.videoPath!) });
      actions.push({ icon: 'trash-2', label: '移出历史', kind: 'danger', onClick: () => void this.confirmDelete(task) });
      attachItemActions(line, actions);
      card.appendChild(line);
    }
    const link = q<HTMLAnchorElement>(card, '.bz-kb-tlink');
    if (link && head.url) link.onclick = (e) => { e.stopPropagation(); this._openExternal(head.url); };
    return card;
  }

  // ==================== 术语生成面板（文字录入；142 简洁版 + 155 总结） ====================

  createTermUI(): void {
    const mask = document.createElement('div');
    mask.id = 'knowledge-term-mask';
    mask.className = 'bz-kb-mask';
    mask.style.display = 'none';
    mask.onclick = () => this.hideTermEntry();
    const popup = document.createElement('div');
    popup.id = 'knowledge-term-popup';
    popup.className = 'bz-lit-dialog bz-lit-term-dialog kb'; // kb：纸墨皮变量作用域（缺此背景 var(--panel) 失效成透明，issue 257）
    popup.style.display = 'none';
    const body = document.createElement('div');
    body.className = 'bz-lit-term-body';
    // 词典皮（issue 258/快改批）：标题栏+✕ / 术语与来源同款行内标签行 / 生成+取消；
    // 预览态：属性卡+内容卡+总结/确认写入。说明行与试试示例已按用户复核移除。
    body.innerHTML = `
      <div class="bz-lit-sheet-head">
        <span class="bz-lit-sheet-title">文字录入 · 术语</span>
      </div>
      <div class="bz-lit-term-row">
        <span class="bz-lit-term-meta-k">术语</span>
        <input id="lit-term-input" type="text" autocomplete="off">
      </div>
      <div class="bz-lit-term-row">
        <span class="bz-lit-term-meta-k">来源</span>
        <input id="lit-term-src" type="text" autocomplete="off">
        <span id="lit-term-src-chip" class="bz-lit-srcchip" style="display:none;"></span>
      </div>
      <div class="bz-lit-term-actions">
        <button id="lit-term-generate" class="bz-lit-accent-btn">生成</button>
        <button id="lit-term-cancel" class="bz-lit-ghost-btn">取消</button>
      </div>
      <div id="lit-term-preview" style="display:none;">
        <div class="bz-lit-term-card">
          <div class="bz-lit-term-meta">
            <div class="bz-lit-term-meta-row"><span class="bz-lit-term-meta-k">术语</span><span id="lit-term-meta-term" class="bz-lit-term-meta-v"></span></div>
            <div class="bz-lit-term-meta-row"><span class="bz-lit-term-meta-k">领域</span><span id="lit-term-meta-domain" class="bz-lit-term-meta-v"></span></div>
            <div class="bz-lit-term-meta-row"><span class="bz-lit-term-meta-k">日期</span><span id="lit-term-meta-date" class="bz-lit-term-meta-v"></span></div>
            <div class="bz-lit-term-meta-row" id="lit-term-meta-srcrow" style="display:none;"><span class="bz-lit-term-meta-k">来源</span><span id="lit-term-meta-src" class="bz-lit-term-meta-v bz-lit-srcopen" data-term-src-open="1"></span></div>
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
    // 统一遮罩点关（issue 271）：✕ 已退役，点遮罩即收起
    mask.addEventListener('click', (e) => { if (e.target === mask) this.hideTermEntry(); });
    q<HTMLButtonElement>(popup, '#lit-term-generate')!.onclick = () => void this.onTermGenerate();
    q<HTMLButtonElement>(popup, '#lit-term-cancel')!.onclick = () => this.hideTermEntry();
    q<HTMLButtonElement>(popup, '#lit-term-regenerate')!.onclick = () => void this.onTermSummarize();
    q<HTMLButtonElement>(popup, '#lit-term-save')!.onclick = () => void this.onTermConfirm();
    q<HTMLInputElement>(popup, '#lit-term-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); void this.onTermGenerate(); }
    });
    // 来源行事件（ADR-0116）
    const srcInput = q<HTMLInputElement>(popup, '#lit-term-src');
    if (srcInput) {
      srcInput.addEventListener('input', () => {
        if (this.termSrcTimer) clearTimeout(this.termSrcTimer);
        this.termSrcTimer = setTimeout(() => this.termSrcTryCommit(srcInput), 450);
      });
      srcInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const raw = (srcInput.value || '').trim();
        if (raw && isUrlLikeSourceText(raw)) {
          // URL 字样整串 → 直接落外部 chip（回车即确认）；非 URL 交给联想层选中回填
          e.preventDefault();
          this.termSrcSet({ kind: 'external', url: normalizeSourceUrl(raw) }, srcInput);
        }
      });
      // 联想源：vault 全部 .md（现值过滤、上限 12）；空输入不弹空壳
      this.termSrcSuggest = uiSuggest({
        anchor: srcInput,
        max: 12,
        iconOf: () => '📄',
        labelOf: (p: string) => noteSourceName(p),
        source: () => {
          if (!srcInput.value.trim()) return [];
          return (getApp().vault.getFiles() || []).filter((f: any) => f.extension === 'md').map((f: any) => f.path);
        },
        onPick: (p: string) => this.termSrcSet({ kind: 'note', path: p }, srcInput),
      });
    }
    // 委托：标题栏 ✕ / chip ✕ 清除 / meta 行点击打开（动态渲染元素，委托一次）
    popup.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-term-src-clear],[data-term-src-open]') as HTMLElement | null;
      if (!t) return;
      e.stopPropagation();
      if (t.hasAttribute('data-term-src-clear')) {
        const input = q<HTMLInputElement>(popup, '#lit-term-src');
        this.termSrcClear(input);
      } else if (this.termSource) {
        // meta 行点击：内部笔记 → 打开笔记；外部链接 → 系统浏览器
        if (this.termSource.kind === 'note') this.openNote(this.termSource.path);
        else this._openExternal(this.termSource.url);
      }
    });
  }

  /**
   * 打开术语录入弹层；term 预填（命令带选中词时自动生成）；src 预填来源（ADR-0116——
   * 仅命令入口带当前笔记，主窗按钮入口不预填）。
   */
  showTermEntry(term?: string, src?: TermSource | null): void {
    if (!this.termPopup || !this.termMask) return;
    this.termPreview = null;
    this.termHasDraft = false;
    const input = q<HTMLInputElement>(this.termPopup, '#lit-term-input');
    if (input) input.value = (term ?? '').trim();
    this.termSrcReset(q<HTMLInputElement>(this.termPopup, '#lit-term-src'));
    if (src) this.termSrcSet(src, q<HTMLInputElement>(this.termPopup, '#lit-term-src'));
    this.setTermPreviewVisible(false);
    this.setTermGenLoading(false);
    topifyZ(this.termMask, this.termPopup);
    this.termMask.style.display = 'block';
    this.termPopup.style.display = 'flex';
    if (input && !input.value) setTimeout(() => input.focus(), 100);
    if (input && input.value) void this.onTermGenerate();
  }

  /** 来源状态清空（chip 收起、输入框复位、计时器/联想层归零）——每次打开弹层即全新 */
  private termSrcReset(input: HTMLInputElement | null): void {
    if (this.termSrcTimer) { clearTimeout(this.termSrcTimer); this.termSrcTimer = null; }
    this.termSource = null;
    if (input) {
      input.value = '';
      input.style.display = '';
    }
    this.renderTermSrcChip(input);
    this.termSrcRefreshMeta();
  }

  private termSrcClear(input: HTMLInputElement | null): void {
    this.termSrcReset(input);
    if (input) setTimeout(() => input.focus(), 0);
  }

  /** 输入惰性提交：整串 URL 字样 → 外部 chip；其余文本等联想点选（不自动认领） */
  private termSrcTryCommit(input: HTMLInputElement): void {
    this.termSrcTimer = null;
    const raw = (input.value || '').trim();
    if (!raw || !isUrlLikeSourceText(raw)) return;
    this.termSrcSet({ kind: 'external', url: normalizeSourceUrl(raw) }, input);
  }

  /** 落来源：记录 + chip 渲染 + meta 行同步；外部来源异步抓标题（失败静默降级为纯链接） */
  private termSrcSet(src: TermSource, input: HTMLInputElement | null): void {
    this.termSource = src;
    this.renderTermSrcChip(input);
    this.termSrcRefreshMeta();
    if (src.kind === 'external') void this.termSrcFetchTitle(src);
  }

  private async termSrcFetchTitle(src: Extract<TermSource, { kind: 'external' }>): Promise<void> {
    try {
      const t = await fetchPageTitle(src.url);
      if (!t || this.termSource !== src) return; // 期间已被清除/更换 → 丢弃
      src.title = cleanSourceTitle(t); // 剥站点尾巴（_哔哩哔哩_bilibili / - 知乎 系）+ 实体解码
      const inp = this.termPopup ? q<HTMLInputElement>(this.termPopup, '#lit-term-src') : null;
      this.renderTermSrcChip(inp);
      this.termSrcRefreshMeta();
    } catch { /* 抓标题失败静默：chip 保持纯链接 */ }
  }

  /** chip 渲染：有来源 → 徽标（内/外）+ 名称 + ✕；无 → 输入框可见 */
  private renderTermSrcChip(input: HTMLInputElement | null): void {
    const popup = this.termPopup;
    if (!popup) return;
    const chip = q<HTMLElement>(popup, '#lit-term-src-chip');
    if (!chip) return;
    const src = this.termSource;
    if (!src) {
      chip.style.display = 'none';
      chip.textContent = '';
      if (input) input.style.display = '';
      return;
    }
    const isNote = src.kind === 'note';
    const label = isNote ? noteSourceName(src.path) : src.title || shortUrlText(src.url);
    chip.title = isNote ? src.path : src.url;
    chip.style.display = 'inline-flex';
    chip.innerHTML = `<b>${isNote ? '内 部' : '外 部'}</b><span>${esc(label)}</span><button type="button" data-term-src-clear title="清除来源" aria-label="清除来源">✕</button>`;
    if (input) input.style.display = 'none';
  }

  /** 预览属性卡第 4 行「来源」：有来源显行（可点开），无来源隐行 */
  private termSrcRefreshMeta(): void {
    const popup = this.termPopup;
    if (!popup) return;
    const row = q<HTMLElement>(popup, '#lit-term-meta-srcrow');
    const val = q<HTMLElement>(popup, '#lit-term-meta-src');
    if (!row || !val) return;
    const src = this.termSource;
    if (!src) { row.style.display = 'none'; val.textContent = ''; return; }
    row.style.display = '';
    val.textContent = src.kind === 'note'
      ? noteSourceName(src.path)
      : src.title || src.url;
    val.title = src.kind === 'note' ? src.path : src.url;
  }

  private setTermPreviewVisible(v: boolean): void {
    if (!this.termPopup) return;
    const p = q<HTMLElement>(this.termPopup, '#lit-term-preview');
    if (p) p.style.display = v ? 'flex' : 'none';
  }

  private setTermGenLoading(loading: boolean): void {
    if (!this.termPopup) return;
    const gen = q<HTMLButtonElement>(this.termPopup, '#lit-term-generate');
    if (gen) { gen.disabled = loading; gen.textContent = loading ? '生成中…' : (this.termHasDraft ? '重新生成' : '生成'); }
    const regen = q<HTMLButtonElement>(this.termPopup, '#lit-term-regenerate');
    if (regen) regen.disabled = loading;
    const save = q<HTMLButtonElement>(this.termPopup, '#lit-term-save');
    if (save) save.disabled = loading;
  }

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
      notice('未配置 AI：请到插件设置「AI 配置」页填 API Key 后再生成', 'error');
    } else {
      notice('生成失败：' + msg, 'error');
    }
  }

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
    if (dateEl) dateEl.textContent = dateStamp();
    const contentEl = q<HTMLElement>(this.termPopup, '#lit-term-content');
    if (contentEl) contentEl.textContent = draft.summary;
    this.setTermPreviewVisible(true);
    const prev = q<HTMLElement>(this.termPopup, '#lit-term-preview');
    prev?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }); // 移动端软键盘下让预览进入视口
  }

  private async onTermConfirm(): Promise<void> {
    if (!this.termPopup || this.termGenerating) return;
    const term = (q<HTMLInputElement>(this.termPopup, '#lit-term-input')?.value ?? '').trim();
    if (!term) { notice('请输入术语', 'error'); return; }
    if (!this.termPreview) { notice('请先点击「生成」获取简介预览', 'info'); return; }
    this.termGenerating = true;
    this.setTermGenLoading(true);
    try {
      const path = await generateTermNote({
        term,
        summary: this.termPreview.body,
        domain: this.termPreview.domain,
        source: this.termSource, // 术语来源随确认时刻的值落库（ADR-0116）
      });
      this.openNote(path);
      emitDomainEvent('knowledge:tasks', { kind: 'term-generated', term, title: term, notePath: path });
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

  hideTermEntry(): void {
    this.termPreview = null;
    const srcInput = this.termPopup ? q<HTMLInputElement>(this.termPopup, '#lit-term-src') : null;
    this.termSrcReset(srcInput);
    if (this.termMask) this.termMask.style.display = 'none';
    if (this.termPopup) this.termPopup.style.display = 'none';
  }

  // ==================== 通用小工具 ====================

  private openNote(path: string): void {
    const app = getApp();
    const file = app.vault.getAbstractFileByPath(path);
    if (file) {
      void app.workspace.getLeaf(false).openFile(file as any);
      this.hideMain();
      this.hideVideo();
      this.hideHistory();
    } else {
      notice('文献笔记不存在：' + path, 'error');
    }
  }

  private async copyText(text: string): Promise<void> {
    try { await navigator.clipboard.writeText(text); notice('已复制：' + text, 'success'); }
    catch { notice('复制失败', 'error'); }
  }

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
    if (this.termSrcTimer) { clearTimeout(this.termSrcTimer); this.termSrcTimer = null; }
    this.addUrlReset(); // 录入 URL 防抖定时器/在途序列随销毁归零（issue 278）
    try { this.termSrcSuggest?.detach(); } catch { /* 忽略 */ }
    this.termSrcSuggest = null;
    if (this.refreshTimer) { clearTimeout(this.refreshTimer); this.refreshTimer = null; }
    for (const unsub of this.fileListenerRefs) {
      try { unsub(); } catch { /* 忽略 */ }
    }
    this.fileListenerRefs = [];
    this.fileListenerAttached = false;
    document.removeEventListener('keydown', this.onKeydown);
    this.termPreview = null;
    for (const el of [this.mask, this.popup, this.videoMask, this.videoPopup, this.addMask, this.addPopup, this.historyMask, this.historyPopup, this.termMask, this.termPopup]) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    this.mask = null;
    this.popup = null;
    this.contentEl = null;
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
