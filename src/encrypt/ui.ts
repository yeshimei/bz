/**
 * 统一保险库 UI（encrypt 域；ADR-0085 合并保险库 × 保险库）
 * 主面板 = 保险库三栏工作台（P1 资产档案库视觉）：
 *   - 左栏资产导航：品牌印章 + 概览 + 密码/加密笔记/加密日记（分类色计数）+ 体检状态 + 立即上锁
 *   - 中栏列表 / 右栏详情：密码（平台聚合/账号卡/收藏/复制）、加密笔记（预览/还原/删除）、
 *     加密日记（预览/还原回日记/复制正文/彻底销毁）；概览 = hero 计数 + 统计卡 + 最近 + 体检摘要
 *   - 移动端：恒真全屏 + 底部资产 tab + 平台/账号/详情页
 * 数据：SafeManager 单例（三类资产同一 manifest）+ PasswordVaultDataManager（密码资产）。
 * 解锁弹窗（showPasswordDialog）、压缩预览窗、体检弹窗、加锁当前笔记协调均保留于此。
 */
import { MarkdownRenderer, Component } from 'obsidian';
import { notice, notify, notifyActionError } from '../core/notice';
import type { NoticeHandle } from '../core/notice';
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { openFlowDialog } from '../core/flow-dialog';
import { createOverlay, topifyZ } from '../core/dom';
import {
  attachItemActions,
  openItemSheet,
  registerSheetCompanion,
  unregisterSheetCompanion,
  type ItemAction,
  type ItemActionsOptions,
} from '../core/item-actions';
import { escapeHtml, formatRelativeTime } from '../core/utils';
import { tryGetSettings, getSettings, saveSettings } from '../core/settings-provider';
import { openSettingsModal } from '../core/settings-modal';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { mobileFullscreenGroup, makeReloadWarnOnce, numStrBinding } from '../core/settings-common';
import type { SettingsSchema } from '../core/settings-schema';
import { SafeManager, base64ToBytes, bytesToBase64, type SafeNote, type SafeAttachment, type HealthReport, type HealthItem, type LockAttachmentInput } from './data';
import { compressImage, videoFrame } from './preview';
import { PasswordVaultDataManager, type PasswordVaultEntry, type PlatformGroup } from './vault-data';
import { VaultPwView, relTime as pwRelTime, DEFAULT_PW_STATE, type PwViewState, type PwViewHost } from './vault-pw-view';
import { openPasswordQuickPicker } from './pw-picker';
import { ASSET_COLOR, overviewHTML, noteRowHTML, noteDetailHTML, type VaultAsset, type OverviewStats, vIc } from './vault-assets-view';

/** 状态栏内容：lucide 锁图标（解锁态开锁）+ 文案（与 index.ts mountEncryptStatusBar 同源，铁律：图标不用 emoji） */
function statusbarHtml(unlocked: boolean): string {
  return `${vIc(unlocked ? 'lock-open' : 'lock', 12)} 保险库`;
}

export interface EncryptUIConfig {
  root: string;
  previewEnabled: boolean;
  previewSize: number;
  previewQuality: number;
  autoLoadOriginal: boolean;
  securityMode: boolean;
  /** 密码生成字符集/长度（ADR-0085：密码资产并入，快照自全局键 passwordCharset/passwordLength） */
  pwCharset?: string;
  pwLength?: string;
}

/** 默认生成字符集（与旧密码本同款） */
export const DEFAULT_PW_CHARSET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+';

/** 加密安全随机密码（拒绝采样，与旧密码本同款） */
export function secureRandomPassword(length: number, charset: string): string {
  const n = charset.length;
  if (!(length > 0) || n === 0) return '';
  const LIMIT = Math.floor(0x100000000 / n) * n;
  let pwd = '';
  while (pwd.length < length) {
    const buf = new Uint32Array(length - pwd.length);
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length && pwd.length < length; i++) {
      if (buf[i] >= LIMIT) continue;
      pwd += charset.charAt(buf[i] % n);
    }
  }
  return pwd;
}

/** 复制敏感内容 + 60s 自动清空剪贴板 */
const CLIPBOARD_CLEAR_DELAY_MS = 60_000;
let clipboardClearTimer: ReturnType<typeof setTimeout> | null = null;
/** 取消未触发的自动清空（卸载清理用，防插件禁用后定时器仍写剪贴板） */
export function cancelClipboardClear(): void {
  if (clipboardClearTimer !== null) {
    clearTimeout(clipboardClearTimer);
    clipboardClearTimer = null;
  }
}
export function armClipboardClear(): void {
  if (clipboardClearTimer !== null) clearTimeout(clipboardClearTimer);
  clipboardClearTimer = setTimeout(() => {
    clipboardClearTimer = null;
    try {
      void navigator.clipboard.writeText('').catch(() => {});
    } catch (e) {
      /* 尽力而为 */
    }
  }, CLIPBOARD_CLEAR_DELAY_MS);
}
export function copySensitiveText(text: string): Promise<void> {
  try {
    return navigator.clipboard.writeText(text).then(() => armClipboardClear());
  } catch (e) {
    return Promise.reject(e);
  }
}

/** 密码强度档（表单强度提示）：弱 / 中 / 强 */
export type PwStrength = 'weak' | 'mid' | 'strong';

/**
 * 密码强度（纯本地计算，不联网、不落盘）：长度 + 字符多样性计分。
 * len≥8 / len≥12 / 大小写并存 / 含数字 / 含符号 各 1 分：≤2 弱、3-4 中、5 强。
 */
export function passwordStrength(pw: string): PwStrength {
  if (!pw) return 'weak';
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score <= 2 ? 'weak' : score <= 4 ? 'mid' : 'strong';
}

/** 密码强度提示文案（UI 与测试共用） */
export function pwStrengthLabel(s: PwStrength): string {
  return s === 'weak' ? '弱' : s === 'mid' ? '中' : '强';
}

/** 上次停留资产（会话级记忆）：下次打开面板/快速取密直落该资产，不回概览 */
let lastVisitedAsset: VaultAsset = 'pw';

/**
 * 收集笔记引用的图片/视频附件路径（纯函数，只读，便于单测）。
 * 引用来源双通道：
 * 1. embedLinks：调用方从 metadataCache.getFileCache(file).embeds 直接取 Obsidian
 *    已索引的 `![[...]]` 嵌入（权威、含带块引用等变体）——用户拍板直接拿自带链接信息；
 * 2. 正则兜底：embeds 不覆盖 markdown 图片 `![](x)` 与本地 `<video src>`，
 *    且新建/刚保存文件缓存可能尚未刷新，故保留三件套正则取并集，不降级功能。
 * 查找用 basename 索引（一次 O(n) 建表，逐引用 O(1)），替代逐引用全表扫描。
 */
export function collectNoteAttachments(
  content: string,
  embedLinks: string[],
  vaultFiles: { path: string }[]
): string[] {
  const refs = new Set<string>();
  for (const l of embedLinks) {
    if (l && typeof l === 'string') refs.add(l.trim());
  }
  // wikilink 嵌入 ![[x.png]] / ![[x.png|alt]]（图片/视频附件）
  const wiki = /!\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = wiki.exec(content)) !== null) refs.add(m[1].trim());
  // markdown 图片 ![](x.png) / 本地视频 <video src="x.mp4">
  const mdImg = /!\[[^\]]*\]\(([^)\s]+)\)/g;
  while ((m = mdImg.exec(content)) !== null) refs.add(m[1].trim());
  const vid = /<video[^>]*src=["']([^"']+)["']/g;
  while ((m = vid.exec(content)) !== null) refs.add(m[1].trim());
  // 一次性索引：全路径 Set + basename → 首个 path（顺序稳定，与旧 find 首命中一致）
  const paths = new Set<string>();
  const byName = new Map<string, string>();
  for (const f of vaultFiles) {
    paths.add(f.path);
    const name = f.path.slice(f.path.lastIndexOf('/') + 1);
    if (name && !byName.has(name)) byName.set(name, f.path);
  }
  const valid = new Set<string>();
  for (const r of refs) {
    if (!r) continue;
    const clean = decodeURIComponent(r).replace(/^\.\//, '');
    let hit: string | undefined;
    if (paths.has(clean)) hit = clean;
    else if (!clean.includes('/')) hit = byName.get(clean);
    else {
      // 相对路径（含子目录）形式：退化为全表后缀匹配（低频路径）
      for (const p of paths) {
        if (p.endsWith('/' + clean)) {
          hit = p;
          break;
        }
      }
    }
    if (hit) valid.add(hit);
  }
  return [...valid];
}

/**
 * 从 app 直接收集当前笔记引用的附件路径（UI/日记共用入口）：
 * metadataCache.getFileCache().embeds 为主 + 正则兜底（见 collectNoteAttachments）。
 * 兼容 file 对象或路径字符串；缓存缺失则退化为纯正则（功能不降级）。
 */
export function collectNoteAttachmentPaths(app: any, file: any, content: string): string[] {
  const embedLinks: string[] = [];
  try {
    const cache = app?.metadataCache?.getFileCache?.(file);
    const embeds = cache && Array.isArray(cache.embeds) ? cache.embeds : [];
    for (const e of embeds) {
      if (e && typeof e.link === 'string') embedLinks.push(e.link);
    }
  } catch (e) {
    /* 缓存读取失败退化为纯正则 */
  }
  const vaultFiles: { path: string }[] = (app?.vault?.getFiles && app.vault.getFiles()) || [];
  return collectNoteAttachments(content, embedLinks, vaultFiles);
}

/** 判断附件类型（按扩展名） */
export function kindOf(path: string): 'image' | 'video' {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return /^(mp4|webm|mov|mkv|avi|m4v|ogv)$/.test(ext) ? 'video' : 'image';
}

/** 按扩展名推断 MIME（缩略图点击加载原图/视频的 Blob 类型；未知回退 octet-stream） */
export function mimeOf(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const IMG: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml', avif: 'image/avif',
  };
  const VID: Record<string, string> = {
    mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    mkv: 'video/x-matroska', avi: 'video/x-msvideo', ogv: 'video/ogg',
  };
  return IMG[ext] || VID[ext] || 'application/octet-stream';
}

/** 预览窗混排占位槽：正文里每个嵌入对应一个槽 */
export interface MediaSlot {
  attachment: SafeAttachment | null;
  token: string;
}

/**
 * 把正文中的图片/视频嵌入改写为占位 token（按文档顺序），并映射回附件。
 * 渲染 Markdown 后按 token 原位替换成解密出的预览图——实现「图随文走」混排，
 * 而非把图片全部堆到末尾。未被引用的附件由调用方放到底部画廊兜底。
 */
export function collectMediaSlots(md: string, attachments: SafeAttachment[]): {
  text: string;
  slots: MediaSlot[];
  inlined: Set<string>;
} {
  // 三种嵌入（按出现顺序单次扫描）：![[x]] / ![...](x) / <video src=x>
  const re = /!\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]|!\[[^\]]*\]\(([^)\s]+)\)|<video[^>]*src=["']([^"']+)["']/g;
  const slots: MediaSlot[] = [];
  const inlined = new Set<string>();
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const target = (m[1] || m[2] || m[3] || '').trim().replace(/^\.\//, '');
    const att = findAttachment(target, attachments);
    const token = '@@ENC_MEDIA_' + slots.length + '@@';
    slots.push({ attachment: att ?? null, token });
    if (att) inlined.add(att.path);
    out += md.slice(last, m.index) + token;
    last = m.index + m[0].length;
  }
  out += md.slice(last);
  return { text: out, slots, inlined };
}

/** 按路径（basename 或全路径后缀）匹配附件 */
function findAttachment(target: string, attachments: SafeAttachment[]): SafeAttachment | undefined {
  const t = decodeURIComponent(target).trim();
  return attachments.find((a) => a.path === t || a.path.endsWith('/' + t));
}

/**
 * 附件预览媒体 HTML：slot 包裹（缩略图/占位 + 加载转圈），data-attach 按附件 path 标记。
 * 有预览层 → 省略图 <img>；无 → 占位提示。点击 slot 由 bindMediaClicks 按需解密原始层，
 * 原地替换为原始质量图片/可播放视频（只加载被点的那一张，缩略图内转圈，不弹通知）。
 */
function mediaHtml(a: SafeAttachment | null | undefined, dataUrl: string | null | undefined): string {
  if (!a) return '';
  const alt = escapeHtml(a.path || '');
  const key = encodeURIComponent(a.path);
  const kindLabel = a.kind === 'video' ? '视频' : '图';
  let inner: string;
  if (dataUrl) {
    inner = `<img class="bz-encrypt-preview-media" src="${dataUrl}" alt="${alt}" loading="lazy">`;
  } else {
    inner = `<div class="bz-encrypt-preview-missing" title="${alt}">
      <span class="bz-encrypt-preview-missing-name">${alt}</span>
      <span>${a.kind === 'video' ? '视频抽帧预览不可用' : '无压缩预览'}，点击加载原${kindLabel}</span>
    </div>`;
  }
  return `<span class="bz-encrypt-preview-slot" data-attach="${key}">${inner}<span class="bz-encrypt-preview-spinner"></span></span>`;
}

/** 进度通知按次独立：每次加密/还原用唯一键，避免相邻操作被去重抑制 */
function progressKey() {
  return 'encrypt-progress-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
}

/** 创建顶部动态进度通知（progress 类型，不自动消失） */
function progressNotify(title: string): NoticeHandle | null {
  try {
    return notify('0/0', { type: 'progress', title, dedupeKey: progressKey(), duration: -1 });
  } catch (e) {
    return null;
  }
}

/** 文件名过长截断（先取 basename，再按 20 字符截断加省略号，防通知栏忽高忽低） */
export function truncateName(current: string, maxLen = 20): string {
  let name = current.split('/').pop() || current;
  if (name.length > maxLen) name = name.slice(0, maxLen) + '…';
  return name;
}

/** 更新进度通知：左「已处理 N/总数」右「当前文件名（截断）」 */
function updateProgress(h: NoticeHandle | null, done: number, total: number, current: string) {
  if (!h) return;
  const base = `已处理 ${done}/${total}`;
  h.setMessage(`${base} · 当前：${truncateName(current)}`);
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0;
  h.setProgress(pct);
}

/** 完成进度通知：转成功态并收起 */
function finishProgress(h: NoticeHandle | null, done: number, msg: string) {
  if (!h) return;
  h.setMessage(`${msg}（${done} 个文件）`);
  h.setType('success');
}



/** 保险库设置 schema（ticket 131；ADR-0064；ADR-0085 统一收纳保险库 + 密码生成/安全）：
 *  存储/预览/安全/移动端 + 密码「生成/安全」两组。全部配置项为启动快照
 *  （控制器构造时读取），改动需重载插件后生效——warnReload 收敛为 makeReloadWarnOnce（onCommit/
 *  onChange 一次性提示）。置于模块顶层供文案 lint 直接引用。移动端组走通用预设（mobileFullscreenGroup）。 */
export function encryptSettingsSchema(): SettingsSchema {
  const warnReload = makeReloadWarnOnce();
  return {
    groups: [
      {
        icon: 'key-round',
        name: '生成',
        rows: [
          {
            type: 'text',
            name: '密码生成字符集',
            desc: '随机生成密码时使用的字符集',
            binding: { key: 'passwordCharset' },
            onCommit: warnReload,
          },
          {
            type: 'number',
            name: '密码生成长度',
            desc: '随机生成密码的字符个数',
            binding: numStrBinding('passwordLength', 16),
            min: 4,
            max: 128,
            step: 1,
            onCommit: warnReload,
          },
        ],
      },
      {
        icon: 'shield',
        name: '安全',
        rows: [
          // 统一「安全模式」：密码(securityMode)与加密(encryptSecurityMode)历史双键 OR 读取、
          // 同步双写（键位冻结兼容老用户任一键开启状态；ADR-0085 统一行为=关闭保险库立即自动上锁）
          {
            type: 'toggle',
            name: '安全模式',
            desc: '关闭保险库窗口立即自动上锁',
            binding: {
              get: () => !!(tryGetSettings() as any).securityMode || !!(tryGetSettings() as any).encryptSecurityMode,
              set: (v: boolean) => {
                const s = getSettings() as any;
                s.securityMode = v;
                s.encryptSecurityMode = v;
              },
              save: () => saveSettings(),
            },
            onChange: warnReload,
          },
        ],
      },
      {
        icon: 'folder-open',
        name: '存储',
        rows: [
          // ticket 128：保险库根目录（统一路径选择器录入，无手输文本框；点前缀目录可选自 CONFIG/.ENCRYPT）
          {
            type: 'path',
            mode: 'single',
            name: '保险库根目录',
            desc: '加密文件的存放位置',
            binding: { key: 'encryptRoot' },
            onCommit: warnReload,
          },
        ],
      },
      {
        icon: 'image',
        name: '预览',
        rows: [
          { type: 'toggle', name: '生成压缩预览', desc: '加密时生成图片视频的压缩预览', binding: { key: 'encryptPreviewEnabled' }, onChange: warnReload },
          { type: 'number', name: '预览长边', desc: '预览图目标长边像素', binding: numStrBinding('encryptPreviewSize', 384), min: 64, max: 1024, step: 16, onCommit: warnReload, isChild: true },
          { type: 'number', name: '预览质量', desc: 'JPEG 图像压缩质量', binding: numStrBinding('encryptPreviewQuality', 0.5), min: 0.1, max: 1, step: 0.1, onCommit: warnReload, isChild: true },
          { type: 'toggle', name: '预览自动加载原图', desc: '打开预览自动解密原图', binding: { key: 'encryptAutoLoadOriginal' }, onChange: warnReload, isChild: true },
        ],
      },
      mobileFullscreenGroup('encryptMobileDefaultFullscreen', { desc: '' }),
    ],
  };
}

export class UIManager {
  dataManager: SafeManager;
  config: EncryptUIConfig;
  /** 顶部「加密当前笔记」按钮回调（由 Controller 注入，调 lockCurrentNote） */
  onLockCurrentNote: (() => void) | null = null;
  // DOM
  mask: HTMLDivElement | null = null;
  popup: HTMLDivElement | null = null;
  listContainer: HTMLElement | null = null;
  previewMask: HTMLDivElement | null = null;
  previewPopup: HTMLDivElement | null = null;
  /** 体检弹窗（右上角 🩺 替换原清理扫把：先报告后勾选清理，用户拍板） */
  healthMask: HTMLDivElement | null = null;
  healthPopup: HTMLDivElement | null = null;
  /** 缩略图按需加载产生的 Blob URL（预览窗关闭时统一 revoke，防泄漏） */
  private _previewUrls: string[] = [];
  _initialized = false;
  /** 解锁连续失败次数（P2 节流：冷却 = min(2^(n-1) 秒, 8 秒)；成功复位） */
  private unlockFailStreak = 0;
  /** 当前冷却截止时间戳（ms）；早于此的尝试被拒绝并提示剩余等待 */
  private unlockCooldownUntil = 0;
  /** 搜索防抖计时器 */
  searchTimer: ReturnType<typeof setTimeout> | null = null;

  // ---------- 密码资产（ADR-0085 并入统一保险库） ----------
  /** 密码资产数据管理器（encrypt Controller 构造注入同一 SafeManager 单例） */
  pwDataManager: PasswordVaultDataManager;
  /** 密码资产 UI（平台列表/详情/移动卡，宿主 = 本 UIManager） */
  pwView: VaultPwView;
  /** 密码资产状态（列表筛选/选中/显隐） */
  pwState: PwViewState = { ...DEFAULT_PW_STATE };
  /** 当前资产视图（概览/密码/笔记/日记） */
  asset: VaultAsset = 'overview';
  /** 加密日记详情临时明文缓存（渲染详情时惰性解密） */
  private _diaryPlain: Record<string, string> = {};
  /** 最近一次体检结果缓存（E5：概览健康卡随 scanHealth 更新，未体检为 null；上锁清空） */
  lastHealth: { issues: number; lastChecked: string } | null = null;
  /** 本次解锁会话起点（ms；notifyUnlockUi 同步，上锁清空）——左栏「已解锁时长」计时用 */
  private unlockedAt: number | null = null;
  /** 已解锁时长刷新计时器（面板可见时每秒跳一次） */
  private sessionTimer: ReturnType<typeof setInterval> | null = null;
  /** 安全模式无交互自动上锁计时器（15 分钟；面板内交互重置） */
  private idleLockTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(dataManager: SafeManager, config: EncryptUIConfig, pwDataManager?: PasswordVaultDataManager) {
    this.dataManager = dataManager;
    this.config = config;
    // 密码数据管理器缺省自建（同一 SafeManager 单例）——Controller 可注入
    this.pwDataManager = pwDataManager || new PasswordVaultDataManager(dataManager);
    this.pwView = new VaultPwView(
      this.pwDataManager,
      {
        toast: (m, err) => this.toast(m, err),
        openPwEntryDialog: (edit, prefill) => this.openPwEntryDialog(edit, prefill),
        openPwPlatformEdit: (p) => this.openPwPlatformEdit(p),
        askConfirm: (t, m, okLabel, cb) => this.askPwConfirm(t, m, okLabel, cb),
        copySensitive: (t) => this.copySensitive(t),
        openExternal: (u) => this.openExternal(u),
        onPwChanged: () => this.renderAll(),
        openPwAccountPage: (d, st) => this.openPwAccountPage(d, st),
      } satisfies PwViewHost,
      { charset: config.pwCharset, length: config.pwLength }
    );
    // 外部写密码条目（保险库/其它实例）→ 重载密码数据 + 重绘
    this.pwDataManager.onExternalChange = () => this.renderAll();
  }

  /** 解锁成功后复位节流状态 */
  private resetUnlockThrottle() {
    this.unlockFailStreak = 0;
    this.unlockCooldownUntil = 0;
  }

  /** 登记一次密码错误：递增失败连击并按 1s/2s/4s…封顶 8s 设置下次可试时间，返回本次冷却秒数 */
  private registerUnlockFailure(): number {
    this.unlockFailStreak += 1;
    const delaySec = Math.min(2 ** (this.unlockFailStreak - 1), 8);
    this.unlockCooldownUntil = Date.now() + delaySec * 1000;
    return delaySec;
  }

  // ---------- 创建 DOM（统一保险库三栏工作台） ----------
  /** 桌面 nav 图标容器 / 计数 / 中列表 / 右详情 / 搜索 / 移动端引用 */
  private desk!: {
    nav: HTMLElement;
    area: HTMLElement;
    list: HTMLElement;
    detail: HTMLElement;
    count: HTMLElement;
    search: HTMLInputElement;
  };
  private mob!: {
    body: HTMLElement;
    search: HTMLInputElement;
    seg: HTMLElement;
  };

  ensureElements() {
    if (this._initialized) return;
    this.mask = this.createMask('bz-encrypt-mask');
    this.popup = this.createPopup('bz-encrypt-popup');
    // ≤768px 恒真全屏：挂顶距工具类（44px 避让 Obsidian 移动端头，components.css 统一档）
    this.popup.classList.add('bz-panel-mtop');
    // 统一骨架：nav（三栏左）+ main（顶栏 + area：中列表 / 右详情）
    this.popup.innerHTML = `
      <div class="bz-vault-desk">
        <div class="bz-vault-nav">
          <div class="bz-vault-brand">
            <div class="seal">${vIc('lock', 19)}</div>
            <div class="nm">保险库<small>VAULT</small></div>
          </div>
          <div class="bz-vault-item on" data-asset="overview">${vIc('layout-grid', 16)}概览<span class="cnt" data-cnt="overview"></span></div>
          <div class="bz-vault-sec">资产档案</div>
          <div class="bz-vault-item" data-asset="pw">${vIc('key', 16)}密码<span class="cnt" data-cnt="pw"></span></div>
          <div class="bz-vault-item k-note" data-asset="note">${vIc('file-lock', 16)}加密笔记<span class="cnt" data-cnt="note"></span></div>
          <div class="bz-vault-item k-diary" data-asset="diary">${vIc('book-lock', 16)}加密日记<span class="cnt" data-cnt="diary"></span></div>
          <div class="grow"></div>
          <div class="bz-vault-health" data-act="health-card" title="打开保险库体检">
            <div class="ht"><span class="okdot"></span><span data-health-t>保险库健康</span></div>
            <div class="hd" data-health-d>未体检</div>
          </div>
          <div class="bz-vault-lockbtn" data-act="lock"><span class="lbl">${vIc('lock', 14)} 立即上锁</span><span class="dur" data-unlock-dur></span><span class="dot"></span></div>
        </div>
        <div class="bz-vault-main">
          <div class="bz-vault-bar">
            <h1 data-vault-title>保险库</h1>
            <div class="sub" data-vault-sub></div>
            <div class="bz-vault-search">${vIc('search', 14)}<input placeholder="搜索全部资产…" data-vault-search></div>
            <button class="bz-vault-ic" data-act="gen" title="生成密码">${vIc('refresh-cw', 15)}</button>
            <button class="bz-vault-ic" data-act="lock-note" title="加密当前笔记">${vIc('file-lock', 15)}</button>
            <button class="bz-vault-ic" data-act="health" title="保险库体检">${vIc('stethoscope', 15)}</button>
            <button class="bz-vault-ic" data-act="settings" title="保险库设置">${vIc('settings', 15)}</button>
            <button class="bz-vault-ic close" data-act="close" title="关闭">${vIc('x', 15)}</button>
          </div>
          <div class="bz-vault-pane">
            <div class="bz-vault-listcol" data-vault-list></div>
            <div class="bz-vault-detail" data-vault-detail></div>
          </div>
        </div>
      </div>
      <div class="bz-vault-mob">
        <div class="bz-vault-mbar">
          <div class="seal">${vIc('lock', 15)}</div>
          <div class="t">保险库</div>
          <span class="st" data-mob-unlock>已解锁</span>
          <button class="bz-vault-mobclose" data-act="mob-close" aria-label="关闭">${vIc('x', 15)}</button>
        </div>
        <div class="bz-vault-msearch">${vIc('search', 13)}<input placeholder="搜索全部资产…" data-mob-search></div>
        <div class="bz-vault-mseg" data-mob-seg>
          <span class="sg on" data-masset="overview">概览</span>
          <span class="sg" data-masset="pw">密码</span>
          <span class="sg" data-masset="note">笔记</span>
          <span class="sg" data-masset="diary">日记</span>
        </div>
        <div class="bz-vault-mbody" data-mob-body></div>
      </div>`;
    this.popup.style.display = 'none';
    // DOM 引用
    const desk = this.popup.querySelector('.bz-vault-desk') as HTMLElement;
    this.desk = {
      nav: desk.querySelector('.bz-vault-nav')!,
      area: desk.querySelector('.bz-vault-pane')!,
      list: desk.querySelector('[data-vault-list]')!,
      detail: desk.querySelector('[data-vault-detail]')!,
      count: desk.querySelector('[data-cnt="overview"]')!,
      search: desk.querySelector('[data-vault-search]')!,
    };
    const mob = this.popup.querySelector('.bz-vault-mob') as HTMLElement;
    this.mob = {
      body: mob.querySelector('[data-mob-body]')!,
      search: mob.querySelector('[data-mob-search]')!,
      seg: mob.querySelector('[data-mob-seg]')!,
    };
    // 列表容器兼容字段（旧测试/工具引用）
    this.listContainer = this.desk.list;
    document.body.appendChild(this.mask);
    document.body.appendChild(this.popup);
    // 预览窗
    const ov = createOverlay({ maskId: 'bz-encrypt-preview-mask', popupId: 'bz-encrypt-preview-popup', maxWidth: 640, onMaskClick: () => this.closePreview() });
    this.previewMask = ov.mask;
    this.previewPopup = ov.popup;
    document.body.appendChild(this.previewMask);
    document.body.appendChild(this.previewPopup);
    // 绑定
    this.bindVaultShell();
    this.registerEscape();
    this._initialized = true;
  }

  /** 统一骨架交互：资产导航 / 顶栏动作 / 搜索防抖 / 移动端 seg */
  private bindVaultShell(): void {
    const setAsset = (a: VaultAsset) => {
      this.asset = a;
      lastVisitedAsset = a; // 记住停留资产：下次打开直落
      this.pwState.searchKw = '';
      this.desk.search.value = '';
      this.mob.search.value = '';
      this.renderAll();
    };
    this.desk.nav.querySelectorAll('.bz-vault-item').forEach((el) => {
      el.addEventListener('click', () => setAsset((el.getAttribute('data-asset') as VaultAsset) || 'overview'));
    });
    this.mob.seg.querySelectorAll('.sg').forEach((el) => {
      el.addEventListener('click', () => setAsset((el.getAttribute('data-masset') as VaultAsset) || 'overview'));
    });
    // 顶栏动作
    this.popup!.querySelector('[data-act="lock"]')?.addEventListener('click', () => this.lockNow());
    this.popup!.querySelector('[data-act="close"]')?.addEventListener('click', () => this.hide());
    this.popup!.querySelector('[data-act="mob-close"]')?.addEventListener('click', () => this.hide());
    this.popup!.querySelector('[data-act="settings"]')?.addEventListener('click', () => this.openSettings());
    this.popup!.querySelector('[data-act="health"]')?.addEventListener('click', () => void this.openHealthDialog());
    // 左栏健康卡：读真实体检状态 + 点击直达体检
    this.popup!.querySelector('[data-act="health-card"]')?.addEventListener('click', () => void this.openHealthDialog());
    this.popup!.querySelector('[data-act="lock-note"]')?.addEventListener('click', () => this.onLockCurrentNote?.());
    this.popup!.querySelector('[data-act="gen"]')?.addEventListener('click', () => this.genAndToast());
    // 搜索防抖（资产内过滤）；概览页输入 → 自动切到密码结果（资产切换保留关键词）
    const bindSearch = (input: HTMLInputElement, isMob: boolean) => {
      input.addEventListener('input', () => {
        const v = input.value.trim();
        if (this.asset === 'overview' && v) {
          this.asset = 'pw';
          lastVisitedAsset = 'pw';
        }
        this.pwState.searchKw = v;
        this.desk.search.value = isMob ? v : this.desk.search.value;
        this.mob.search.value = isMob ? this.mob.search.value : v;
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.renderAll(), 180);
      });
    };
    bindSearch(this.desk.search, false);
    bindSearch(this.mob.search, true);
    // 桌面点遮罩关闭
    this.mask!.addEventListener('click', () => {
      if (this.mask!.style.display === 'block') this.hide();
    });
    // 安全模式防偷看自动上锁：面板内任何交互重置 15 分钟倒计时（捕获阶段兜底输入框事件）
    const bump = () => this.bumpIdleLock();
    this.popup!.addEventListener('pointerdown', bump, true);
    this.popup!.addEventListener('keydown', bump, true);
  }

  createMask(id: string): HTMLDivElement {
    const mask = document.createElement('div');
    mask.id = id;
    mask.className = 'bz-overlay-mask';
    mask.style.display = 'none';
    return mask;
  }

  createPopup(id: string): HTMLDivElement {
    const popup = document.createElement('div');
    popup.id = id;
    popup.className = 'bz-overlay-popup';
    // 视觉尺寸已收敛至 styles.css（#bz-encrypt-popup），此处只保留功能性显隐（display）
    popup.style.display = 'none';
    return popup;
  }

  // ---------- 显示/隐藏 ----------
  show() {
    if (!this._initialized) this.ensureElements();
    applyMobileWindowFullscreen(this.popup, tryGetSettings().encryptMobileDefaultFullscreen === true);
    topifyZ(this.mask!, this.popup!); // ADR-0067：显示即发号，谁后显示谁在上
    this.mask!.style.display = 'block';
    this.popup!.style.display = 'flex';
    this.notifyUnlockUi();
    void this.renderList();
    this.startSessionTimers();
  }

  hide() {
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
    this.stopSessionTimers();
    if (this.isSecurityMode()) {
      this.dataManager.lock();
      this.pwDataManager.lock();
      this.pwState = { ...DEFAULT_PW_STATE };
      this._selNoteId = null;
      this._diaryPlain = {}; // G：明文缓存随上锁一并清出内存（与 lockNow 同口径）
      this.noticeAutoLock();
    }
  }

  /** 安全模式双口径（config 快照可能落后于设置实时值：单读 config 会漏，历史双键 OR） */
  private isSecurityMode(): boolean {
    return !!this.config.securityMode || !!(tryGetSettings() as any)?.securityMode;
  }

  // ---------- 解锁会话可见性（已解锁时长 + 安全模式无交互自动上锁） ----------
  /** 面板可见期间：每秒刷新「已解锁时长」+ 布防无交互自动上锁 */
  private startSessionTimers(): void {
    this.stopSessionTimers();
    if (!this.dataManager.unlocked) return;
    if (this.unlockedAt === null) this.unlockedAt = Date.now();
    this.updateUnlockDuration();
    this.sessionTimer = setInterval(() => this.updateUnlockDuration(), 1000);
    this.bumpIdleLock();
  }

  /** 停会话计时（时长刷新 + 无交互自动上锁；hide/上锁/卸载共用） */
  stopSessionTimers(): void {
    if (this.sessionTimer !== null) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }
    this.clearIdleLock();
  }

  /** 左栏「立即上锁」旁的已解锁时长（mm:ss，超 1 小时 h:mm:ss） */
  private updateUnlockDuration(): void {
    const el = this.popup?.querySelector('[data-unlock-dur]');
    if (!el) return;
    if (!this.dataManager.unlocked || this.unlockedAt === null) {
      el.textContent = '';
      return;
    }
    const s = Math.max(0, Math.floor((Date.now() - this.unlockedAt) / 1000));
    const mm = String(Math.floor(s / 60) % 60).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    const h = Math.floor(s / 3600);
    el.textContent = h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
    (el as HTMLElement).title = '已解锁时长';
  }

  /** 安全模式：15 分钟无面板交互自动上锁（交互即重置；非安全模式/未解锁不布防） */
  static readonly IDLE_LOCK_MS = 15 * 60 * 1000;

  private bumpIdleLock(): void {
    this.clearIdleLock();
    if (!this.isSecurityMode() || !this.dataManager.unlocked) return;
    if (!this.rootVisible()) return;
    this.idleLockTimer = setTimeout(() => {
      this.idleLockTimer = null;
      if (!this.isSecurityMode() || !this.dataManager.unlocked || !this.rootVisible()) return;
      notice('安全模式：15 分钟无操作，已自动上锁');
      this.lockNow();
    }, UIManager.IDLE_LOCK_MS);
  }

  private clearIdleLock(): void {
    if (this.idleLockTimer !== null) {
      clearTimeout(this.idleLockTimer);
      this.idleLockTimer = null;
    }
  }

  private noticeAutoLock(): void {
    notice('安全模式：已自动上锁');
  }

  // ---------- 体检弹窗 ----------
  /**
   * 体检（用户拍板：右上角 🩺 按钮替换原清理扫把，先报告后勾选清理）。
   * 体检需解锁（对账依赖清单明文，完整性检测需解密）——未解锁先弹主密码，取消则不进入。
   * 可清理类（失效条目/孤儿密文）默认不全选、勾选后二次确认才删（ticket 18）；损坏/缺失类只展示不清理（删了就是真丢数据）。
   * 清理后自动重新体检，报告收敛。
   */
  async openHealthDialog() {
    if (!this.dataManager.unlocked) {
      const ok = await this.showPasswordDialog();
      if (!ok) return;
    }
    if (!this.healthMask) this.ensureHealthElements();
    topifyZ(this.healthMask!, this.healthPopup!); // ADR-0067：显示即发号
    this.healthMask!.style.display = 'flex';
    this.healthPopup!.style.display = 'flex';
    void this.runHealthScan();
  }

  private ensureHealthElements() {
    const mask = document.createElement('div');
    mask.id = 'bz-encrypt-health-mask';
    mask.className = 'bz-encrypt-health-mask';
    mask.style.display = 'none';
    const popup = document.createElement('div');
    popup.id = 'bz-encrypt-health-popup';
    popup.className = 'bz-encrypt-health-box';
    popup.style.display = 'none';
    const head = document.createElement('div');
    head.className = 'bz-encrypt-health-head';
    const title = document.createElement('h4');
    title.textContent = '保险库体检';
    // 无右上角关闭按钮（用户拍板）：关闭走遮罩点击 / ESC（escManager 层级）
    head.appendChild(title);
    popup.appendChild(head);
    const body = document.createElement('div');
    body.id = 'bz-encrypt-health-body';
    body.className = 'bz-encrypt-health-body';
    popup.appendChild(body);
    const foot = document.createElement('div');
    foot.className = 'bz-encrypt-health-foot';
    const cleanBtn = document.createElement('button');
    cleanBtn.id = 'bz-encrypt-health-clean';
    cleanBtn.className = 'bz-encrypt-dialog-btn bz-encrypt-dialog-btn--primary';
    cleanBtn.textContent = '清理勾选项 (0)';
    cleanBtn.onclick = () => void this.confirmHealthCleanup();
    const rescanBtn = document.createElement('button');
    rescanBtn.className = 'bz-encrypt-dialog-btn';
    rescanBtn.textContent = '重新体检';
    rescanBtn.onclick = () => void this.runHealthScan();
    // 无底部关闭按钮（用户拍板）：关闭走遮罩点击 / ESC
    foot.appendChild(cleanBtn);
    foot.appendChild(rescanBtn);
    popup.appendChild(foot);
    // 弹窗必须挂在遮罩内（mask 的 flex 居中承载；误挂 body 会脱离 flex 容器，
    // 且本卡片无 fixed 定位 → 沉入文档流被遮罩盖住——曾出现「只有遮罩没有内容」）
    mask.appendChild(popup);
    document.body.appendChild(mask);
    // 点遮罩（非内容区）关闭 = 取消（同解锁弹窗语义）
    mask.onclick = (e) => {
      if (e.target === mask) this.hideHealthDialog();
    };
    // esc 独立层级（后注册优先）：体检窗开着时 ESC 关体检而不是关主面板
    escManager.register('encrypt-health', {
      isVisible: () => !!(this.healthMask && this.healthMask.style.display === 'flex'),
      close: () => this.hideHealthDialog(),
    });
    this.healthMask = mask;
    this.healthPopup = popup;
  }

  private hideHealthDialog() {
    if (this.healthMask) this.healthMask.style.display = 'none';
    if (this.healthPopup) this.healthPopup.style.display = 'none';
  }

  /** 体检执行：动态显示（用户拍板）——扫描是长任务（逐镜像 PBKDF2），
   *  顶部实时进度（计数 + 当前对象），发现的问题即时追加，扫完再整理成完整勾选报告。 */
  private async runHealthScan() {
    if (!this.healthPopup) return;
    const body = this.healthPopup.querySelector('#bz-encrypt-health-body') as HTMLElement | null;
    if (!body) return;
    body.innerHTML = '';
    // 骨架：进度区（文本 + 条，宽度为功能性动态计算）+ 实时发现区
    const progress = document.createElement('div');
    progress.className = 'bz-encrypt-health-progress';
    progress.textContent = '体检中…';
    const bar = document.createElement('div');
    bar.className = 'bz-encrypt-health-bar';
    const barFill = document.createElement('i');
    barFill.style.width = '0%';
    bar.appendChild(barFill);
    body.appendChild(progress);
    body.appendChild(bar);
    const live = document.createElement('div');
    live.className = 'bz-encrypt-health-live';
    const liveTitle = document.createElement('div');
    liveTitle.className = 'bz-encrypt-health-section-title';
    liveTitle.textContent = '发现的异常';
    live.appendChild(liveTitle);
    body.appendChild(live);
    try {
      const report = await this.dataManager.scanHealth((p) => {
        progress.textContent = `检查中 ${p.done}/${p.total} · ${truncateName(p.current)}`;
        barFill.style.width = Math.round((p.done / p.total) * 100) + '%';
        for (const item of p.found) {
          const row = document.createElement('div');
          row.className =
            'bz-encrypt-health-item ' +
            (item.cat === 'corrupted-body' || item.cat === 'corrupted-attachment'
              ? 'bz-encrypt-health-item--bad'
              : item.cat === 'missing-attachment'
                ? 'bz-encrypt-health-item--warn'
                : '');
          row.textContent = item.label;
          live.appendChild(row);
        }
      });
      // 扫描完成：缓存问题数供概览健康卡（E5）+ 全量重渲染（分类规整 + 勾选框 + 底部按钮计数）
      this.lastHealth = { issues: report.items.length, lastChecked: new Date().toLocaleString() };
      this.renderHealthReport(report, body);
      // 概览健康卡即时跟随（若正停在概览视图）
      this.renderNav();
    } catch (e: any) {
      body.innerHTML = '';
      const err = document.createElement('div');
      err.textContent = '体检失败：' + e.message;
      body.appendChild(err);
    }
  }

  /** 渲染体检报告（UI 保证解锁后调用，integrityChecked 恒 true）：可清理类默认不全选；损坏/缺失只展示 */
  private renderHealthReport(report: HealthReport, body: HTMLElement) {
    body.innerHTML = '';
    const cleanable = report.items.filter((i) => i.cat === 'dead-entry' || i.cat === 'orphan-file');
    const bad = report.items.filter((i) => i.cat === 'corrupted-body' || i.cat === 'corrupted-attachment');
    const missing = report.items.filter((i) => i.cat === 'missing-attachment');
    const summary = document.createElement('div');
    summary.className = 'bz-encrypt-health-summary';
    summary.textContent = '体检完成：' + report.items.length + ' 个问题';
    body.appendChild(summary);
    this.appendCleanableSection(body, cleanable);
    if (bad.length) {
      const sec = document.createElement('div');
      sec.className = 'bz-encrypt-health-section bz-encrypt-health-section--bad';
      const t = document.createElement('div');
      t.className = 'bz-encrypt-health-section-title';
      t.textContent = '损坏镜像（' + bad.length + '）——不可清理，请从备份恢复后重试还原';
      sec.appendChild(t);
      for (const item of bad) {
        const row = document.createElement('div');
        row.className = 'bz-encrypt-health-item bz-encrypt-health-item--bad';
        row.textContent = item.label;
        row.title = '损坏的密文镜像，删除即丢失数据';
        sec.appendChild(row);
      }
      body.appendChild(sec);
    }
    if (missing.length) {
      const sec = document.createElement('div');
      sec.className = 'bz-encrypt-health-section';
      const t = document.createElement('div');
      t.className = 'bz-encrypt-health-section-title';
      t.textContent = '附件镜像缺失（' + missing.length + '）——还原时该附件将不可用';
      sec.appendChild(t);
      for (const item of missing) {
        const row = document.createElement('div');
        row.className = 'bz-encrypt-health-item bz-encrypt-health-item--warn';
        row.textContent = item.label;
        sec.appendChild(row);
      }
      body.appendChild(sec);
    }
    if (!bad.length && !missing.length) {
      const ok = document.createElement('div');
      ok.className = 'bz-encrypt-health-hint';
      ok.textContent = '全部镜像完整（解密+指纹校验通过）';
      body.appendChild(ok);
    }
    this.updateHealthCleanCount();
  }

  /** 可清理区块：失效条目 + 孤儿密文（checkbox 默认不全选，勾选才计入清理） */
  private appendCleanableSection(body: HTMLElement, items: HealthItem[]) {
    const sec = document.createElement('div');
    sec.className = 'bz-encrypt-health-section bz-encrypt-health-section--clean';
    const t = document.createElement('div');
    t.className = 'bz-encrypt-health-section-title';
    const dead = items.filter((i) => i.cat === 'dead-entry').length;
    const orphan = items.filter((i) => i.cat === 'orphan-file').length;
    t.textContent = items.length
      ? '可清理（' + items.length + '）：' + dead + ' 个失效条目、' + orphan + ' 个孤儿密文'
      : '可清理：无';
    sec.appendChild(t);
    for (const item of items) {
      const row = document.createElement('label');
      row.className = 'bz-encrypt-health-item';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.className = 'bz-encrypt-health-check';
      box.value = item.key;
      box.checked = false; // 用户拍板（ticket 18）：可清理项默认不全选，勾选即明确同意删除
      box.addEventListener('change', () => this.updateHealthCleanCount());
      row.appendChild(box);
      row.appendChild(document.createTextNode(item.label));
      sec.appendChild(row);
    }
    body.appendChild(sec);
  }

  private updateHealthCleanCount() {
    const btn = document.getElementById('bz-encrypt-health-clean') as HTMLButtonElement | null;
    if (!btn) return;
    btn.textContent = '清理勾选项 (' + this.collectCheckedKeys().length + ')';
  }

  private collectCheckedKeys(): string[] {
    const popup = this.healthPopup;
    if (!popup) return [];
    return [...popup.querySelectorAll<HTMLInputElement>('input.bz-encrypt-health-check:checked')].map((i) => i.value);
  }

  /**
   * 清理勾选项（ticket 18）：执行前二次确认——写明将永久删除的数量（失效条目含残余附件镜像、
   * 孤儿密文），确认后才执行；只处理可清理类（resolveHealth 对损坏/缺失类防御性忽略），
   * 完成后自动重新体检。
   */
  private async confirmHealthCleanup() {
    const keys = this.collectCheckedKeys();
    if (!keys.length) {
      notice('未勾选任何可清理项');
      return;
    }
    // 勾选 key 按类别计数（契约见 data.ts HealthItem：dead-entry=`entry:<id>`、orphan-file=`file:<文件名>`）
    const dead = keys.filter((k) => k.startsWith('entry:')).length;
    const orphan = keys.filter((k) => k.startsWith('file:')).length;
    const parts: string[] = [];
    if (dead > 0) parts.push(dead + ' 条失效条目（含残余附件镜像）');
    if (orphan > 0) parts.push(orphan + ' 个孤儿密文');
    void openFlowDialog({
      title: '清理确认',
      message: parts.join('、') + '将永久删除，不可恢复',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '永久删除', value: 'ok', cta: true },
      ],
    }).then((v) => {
      if (v === 'ok') void this.executeHealthCleanup(keys);
    });
  }

  /** 执行清理（二次确认通过后）：resolveHealth 只处理可清理类，完成后自动重新体检 */
  private async executeHealthCleanup(keys: string[]) {
    try {
      const { notes, files } = await this.dataManager.resolveHealth(keys);
      const parts: string[] = [];
      if (notes > 0) parts.push(notes + ' 个失效条目');
      if (files > 0) parts.push(files + ' 个孤儿密文');
      notice(parts.length ? '已清理：' + parts.join('、') : '已清理所选项', 'success');
      void this.renderList();
      void this.runHealthScan(); // 清理后重新体检，报告收敛
    } catch (e: any) {
      notifyActionError(e, '清理');
    }
  }

  // ---------- 解锁弹窗 ----------
  /**
   * 主密码弹窗（首设两次确认 + 损坏清单重设确认）。视觉样式已收敛至 styles.css
   * （铁律 9：.bz-encrypt-dialog-* 类）；内联仅保留功能性 zIndex/显隐（display）。
   */
  async showPasswordDialog(): Promise<boolean> {
    const exists = await this.dataManager.exists();
    return new Promise((resolve) => {
      const mask = document.createElement('div');
      mask.className = 'bz-encrypt-dialog-mask';
      topifyZ(mask); // ADR-0067：一次性弹窗，创建即显示即发号
      mask.style.display = 'flex';
      const box = document.createElement('div');
      box.className = 'bz-encrypt-dialog-box';
      const title = document.createElement('h4');
      title.className = 'bz-encrypt-dialog-title';
      const message = document.createElement('p');
      message.className = 'bz-encrypt-dialog-msg';
      const input = document.createElement('input');
      input.type = 'password';
      input.placeholder = '输入主密码';
      input.className = 'bz-encrypt-dialog-input';
      const input2 = document.createElement('input');
      input2.type = 'password';
      input2.placeholder = '再次输入';
      input2.className = 'bz-encrypt-dialog-input';
      input2.style.display = 'none'; // 功能性显隐（首设第二遍确认时才显示）
      const warning = document.createElement('div');
      warning.className = 'bz-encrypt-dialog-warning';
      warning.style.display = 'none'; // 功能性显隐
      warning.innerHTML = `${vIc('triangle-alert', 14)} <strong>重要提醒</strong><br>• 主密码 <b>不会存储</b>，也无法找回，请务必牢记！<br>• 若遗忘密码，加密笔记及其附件将永久丢失。<br>• 建议使用密码本（如 Bitwarden）保存此密码。`;
      // 硬警告确认：首设必须勾选「已了解风险」才能完成设置（用户拍板：遗忘=数据永久丢失，须显式确认）
      const ack = document.createElement('label');
      ack.className = 'bz-encrypt-dialog-ack';
      ack.style.display = 'none'; // 功能性显隐（仅首设显示）
      const ackBox = document.createElement('input');
      ackBox.type = 'checkbox';
      ack.appendChild(ackBox);
      ack.appendChild(document.createTextNode('我已了解：主密码无法找回，遗忘将导致密文永久无法恢复'));
      if (exists) {
        title.textContent = '输入主密码';
        message.textContent = '请输入您设置的主密码以解锁保险库';
        input2.style.display = 'none';
        warning.style.display = 'none';
        ack.style.display = 'none';
      } else {
        title.textContent = '设置主密码';
        message.textContent = '请设置一个主密码（用于加密所有数据）';
        input2.style.display = 'block';
        input2.placeholder = '再次输入';
        warning.style.display = 'block';
        ack.style.display = 'block';
      }
      const btnContainer = document.createElement('div');
      btnContainer.className = 'bz-encrypt-dialog-btns';
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = '取消';
      cancelBtn.className = 'bz-encrypt-dialog-btn';
      cancelBtn.onclick = () => { document.body.removeChild(mask); resolve(false); };
      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = '确认';
      confirmBtn.className = 'bz-encrypt-dialog-btn bz-encrypt-dialog-btn--primary';
      confirmBtn.onclick = async () => {
        const pw = input.value;
        if (!pw) { notice('请输入密码'); return; }
        if (!exists) {
          if (input2.style.display === 'none') {
            input2.style.display = 'block';
            input2.value = '';
            this.focusUnlockInput(input2);
            message.textContent = '请再次输入主密码确认';
            return;
          } else {
            if (pw !== input2.value) { notice('两次密码不一致'); return; }
            if (!ackBox.checked) { notice('请先勾选风险确认'); return; }
            try {
              const ok = await this.dataManager.unlock(pw);
              if (ok) {
                document.body.removeChild(mask);
                resolve(true);
                notice('密码已设置，数据已加密', 'success');
              } else {
                // 数据层已回滚解锁态；写盘失败必须明示（不再假装成功）
                notice('设置失败：无法写入清单，请检查磁盘空间后重试', 'error');
                resolve(false);
              }
            } catch (e: any) {
              notifyActionError(e, '设置主密码');
              resolve(false);
            }
            return;
          }
        } else {
          // 冷却期内（P2 节流）：拒绝本次尝试并提示剩余等待
          const remainMs = this.unlockCooldownUntil - Date.now();
          if (remainMs > 0) {
            notice(`尝试过于频繁，请再等 ${Math.ceil(remainMs / 1000)} 秒`, 'warning');
            return;
          }
          const success = await this.dataManager.unlock(pw);
          if (success) {
            this.resetUnlockThrottle();
            document.body.removeChild(mask);
            resolve(true);
            // 自愈回滚提示（ticket 6）：上次未完成的加密已被自动回滚，原文全程未被删过（原文未动）
            const healMsg =
              this.dataManager.selfHealRolledBack > 0 ? '；上次未完成的加密已自动回滚，原文未动' : '';
            notice('解锁成功' + healMsg, 'success');
          } else {
            // 区分「清单损坏」与「密码错误」：损坏必须显式确认后才能重设，绝不静默
            const issue = this.dataManager.manifestIssue;
            if (issue === 'empty' || issue === 'corrupt') {
              void openFlowDialog({
                title: '清单疑似损坏',
                message:
                  '保险库清单文件为空或无法解析（可能因写入中断/同步冲突损坏）。' +
                  '重设主密码将生成全新空清单，旧加密数据将永久无法恢复。确定重设吗？',
                actions: [
                  { label: '暂不重设', value: 'cancel' },
                  { label: '仍要重设', value: 'ok', cta: true },
                ],
              }).then((v) => {
                if (v === 'ok') {
                  void this.dataManager.unlock(pw, true).then((ok) => {
                    if (ok) {
                      this.resetUnlockThrottle();
                      document.body.removeChild(mask);
                      resolve(true);
                      notice('已重设主密码（旧数据不可恢复）', 'warning');
                    } else {
                      notice('重设失败：无法写入清单', 'error');
                    }
                  });
                } else {
                  notice('未重设：请先检查或备份数据文件', 'warning');
                }
              });
            } else {
              notice('密码错误，请重试', 'error');
              // 连续失败递增冷却（1s/2s/4s…封顶 8s；成功复位），提示剩余等待（P2）
              const delaySec = this.registerUnlockFailure();
              notice(`${delaySec} 秒后可再次尝试`, 'warning');
              input.value = '';
              this.focusUnlockInput(input);
            }
          }
        }
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmBtn.click(); });
      input2.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmBtn.click(); });
      btnContainer.appendChild(cancelBtn);
      btnContainer.appendChild(confirmBtn);
      box.appendChild(title);
      box.appendChild(warning);
      box.appendChild(ack);
      box.appendChild(message);
      box.appendChild(input);
      box.appendChild(input2);
      box.appendChild(btnContainer);
      mask.appendChild(box);
      document.body.appendChild(mask);
      // 点遮罩（非内容区）关闭弹窗 = 取消
      mask.onclick = (e) => {
        if (e.target === mask) {
          try {
            document.body.removeChild(mask);
          } catch (err) {
            /* 幂等 */
          }
          resolve(false);
        }
      };
      // 焦点：元素挂载后再聚焦才生效；移动端 WebView 对异步创建输入框需二次聚焦才弹键盘
      this.focusUnlockInput(input);
      setTimeout(() => this.focusUnlockInput(input), 150);
    });
  }

  /** 输入框聚焦（不滚动页面）+ 兼容性兜底；移动端靠二次聚焦触发系统键盘 */
  private focusUnlockInput(el: HTMLInputElement) {
    try {
      el.focus({ preventScroll: true } as any);
    } catch (e) {
      el.focus();
    }
  }

  // ---------- 统一工作台渲染 ----------
  /** show/解锁/外部变更/资产切换统一入口：加载 → 全量重绘 */
  async renderList() {
    if (!this.listContainer) return;
    // 密码资产数据（未解锁静默，锁屏接管）
    if (this.dataManager.unlocked) {
      try {
        await this.pwDataManager.load();
      } catch (e) {
        /* 密码载荷损坏等：保持空态，详情由 UI 呈现 */
      }
    }
    this.renderAll();
  }

  /** 全量重绘：导航计数 + 概览/资产内容 + 移动端 + 健康卡 + 顶栏标题 */
  renderAll() {
    if (!this.rootVisible()) return;
    this.renderNav();
    this.renderDesktop();
    this.renderMobile();
  }

  private rootVisible(): boolean {
    return !!(this.popup && this.popup.style.display === 'flex');
  }

  /** 资产计数 + 导航高亮 */
  private counts(): { pw: number; note: number; diary: number } {
    const notes = this.dataManager.manifest.notes;
    return {
      pw: this.pwDataManager.pwData.length,
      note: notes.filter((n) => n.kind !== 'diary-entry' && n.kind !== 'password-vault').length,
      diary: notes.filter((n) => n.kind === 'diary-entry').length,
    };
  }

  private renderNav() {
    const c = this.counts();
    const setCnt = (a: string, v: number) => {
      const el = this.popup!.querySelector(`[data-cnt="${a}"]`);
      if (el) el.textContent = String(v);
    };
    setCnt('overview', c.pw + c.note + c.diary);
    setCnt('pw', c.pw);
    setCnt('note', c.note);
    setCnt('diary', c.diary);
    this.desk.nav.querySelectorAll('.bz-vault-item').forEach((el) => {
      el.classList.toggle('on', el.getAttribute('data-asset') === this.asset);
    });
    this.mob.seg.querySelectorAll('.sg').forEach((el) => {
      el.classList.toggle('on', el.getAttribute('data-masset') === this.asset);
    });
    // 健康卡（真实体检状态：未体检/健康/N 个待处理；点击直达体检——绑定见 bindVaultShell）
    const ht = this.popup!.querySelector('[data-health-t]');
    const hd = this.popup!.querySelector('[data-health-d]');
    const dot = this.popup!.querySelector<HTMLElement>('.bz-vault-health .okdot');
    if (ht) ht.textContent = c.pw + c.note + c.diary ? '保险库健康' : '保险库为空';
    if (hd) {
      if (!this.lastHealth) hd.textContent = '未体检 · 点此体检';
      else if (this.lastHealth.issues === 0) hd.textContent = `体检通过 · ${this.lastHealth.lastChecked}`;
      else hd.textContent = `${this.lastHealth.issues} 个待处理 · 点此查看`;
    }
    if (dot) {
      // 状态不只靠颜色（WCAG 1.4.1）：文案已随状态变化，色点仅作辅助佐证
      const color = !this.lastHealth
        ? 'var(--bz-vault-faint)'
        : this.lastHealth.issues > 0
          ? 'var(--bz-vault-warn)'
          : 'var(--bz-vault-ok)';
      dot.style.background = color;
      dot.style.boxShadow = 'none';
    }
  }

  /** 概览统计（供 overviewHTML） */
  private overviewStats(): OverviewStats {
    const c = this.counts();
    const allNotes = [...this.dataManager.manifest.notes].filter((n) => n.kind !== 'password-vault');
    const attachments = allNotes.reduce((s, n) => s + n.attachments.length, 0);
    const pwPlats = this.pwDataManager.platforms();
    const recent: Array<{ kind: 'pw' | 'note' | 'diary'; title: string; sub: string; time: string; ts: number }> = [];
    const pushRecent = (kind: 'pw' | 'note' | 'diary', title: string, sub: string, time: string, ts: number) =>
      recent.push({ kind, title, sub, time, ts });
    // 密码：平台最近更新
    for (const p of pwPlats.slice(0, 3)) {
      const r = p.accounts[0];
      const created = (r && r.createdAt) || '';
      pushRecent('pw', p.platform, r ? r.account || '(无账号)' : '', pwRelTime(created), Date.parse(created) || 0);
    }
    // 笔记/日记
    for (const n of allNotes.slice(0, 3)) {
      const kind = n.kind === 'diary-entry' ? 'diary' : 'note';
      pushRecent(kind, n.title, `${n.attachments.length} 个附件`, formatRelativeTime(n.createdAt), Date.parse(n.createdAt || '') || 0);
    }
    // G：按真实时间戳降序（旧实现按相对时间字符串 localeCompare——「今天」「3 天前」字典序无时序意义）
    recent.sort((a, b) => b.ts - a.ts);
    return {
      counts: c,
      pwPlatforms: pwPlats.length,
      pwFavPlatforms: pwPlats.filter((p) => this.pwDataManager.hasFav(p.platform)).length,
      attachments,
      recent: recent.slice(0, 6).map(({ kind, title, sub, time }) => ({ kind, title, sub, time })),
      health: this.lastHealth, // E5：随最近一次体检结果更新（未体检 null → 显示「未体检」）
    };
  }

  /** 桌面区渲染（中列表 + 右详情按资产分发） */
  private renderDesktop() {
    const list = this.desk.list;
    const detail = this.desk.detail;
    const kw = this.pwState.searchKw;
    list.innerHTML = '';
    detail.innerHTML = '';
    const titleEl = this.popup!.querySelector('[data-vault-title]')!;
    const subEl = this.popup!.querySelector('[data-vault-sub]')!;
    const c = this.counts();
    // 离开密码资产时移除密码专用收藏切换钮（顶栏共享）
    if (this.asset !== 'pw') {
      this.popup!.querySelector('.bz-vault-bar [data-act="pw-fav"]')?.remove();
    }
    // 概览
    if (this.asset === 'overview') {
      titleEl.textContent = '保险库';
      subEl.textContent = `${c.pw} 密码 · ${c.note} 笔记 · ${c.diary} 日记`;
      const area = document.createElement('div');
      area.className = 'bz-vault-area';
      area.innerHTML = overviewHTML(this.overviewStats());
      // 概览卡/hero 点击 → 资产跳转
      area.querySelectorAll('.card[data-nav]').forEach((el) =>
        el.addEventListener('click', () => this.setAssetFromNav((el.getAttribute('data-nav') as VaultAsset)))
      );
      area.querySelector('[data-hero="lock-note"]')?.addEventListener('click', () => this.onLockCurrentNote?.());
      area.querySelector('[data-hero="add-pw"]')?.addEventListener('click', () => this.openPwEntryDialog());
      // hero「体检」按钮 + 概览体检卡（整卡可点）都直达体检
      area.querySelectorAll('[data-hero="health"]').forEach((el) =>
        el.addEventListener('click', () => void this.openHealthDialog())
      );
      area.querySelector('[data-hero="recent-all"]')?.addEventListener('click', () => this.setAssetFromNav('pw'));
      area.querySelectorAll('.bz-vault-minirow[data-recent]').forEach((el) =>
        el.addEventListener('click', () => this.setAssetFromNav((el.getAttribute('data-recent') as 'pw' | 'note' | 'diary')))
      );
      detail.appendChild(area);
      return;
    }
    // 密码
    if (this.asset === 'pw') {
      titleEl.textContent = '密码';
      const plats = this.pwDataManager.platforms();
      subEl.textContent = kw ? `${this.pwDataManager.search(kw).length} 条匹配` : `${plats.length} 平台 · ${c.pw} 账号`;
      // 顶栏追加密码动作按钮（生成/新增在通用 gen 已有——密码视图放专用新增/收藏切换）
      const barActs = this.popup!.querySelector('.bz-vault-bar')!;
      const hasPwFav = !!barActs.querySelector('[data-act="pw-fav"]');
      if (!hasPwFav) {
        const favBtn = document.createElement('button');
        favBtn.className = 'bz-vault-ic';
        favBtn.dataset.act = 'pw-fav';
        favBtn.title = this.pwState.view === 'fav' ? '全部平台' : '只看收藏';
        favBtn.innerHTML = vIc(this.pwState.view === 'fav' ? 'star' : 'star-outline', 15);
        barActs.appendChild(favBtn);
        favBtn.addEventListener('click', () => {
          this.pwState.view = this.pwState.view === 'fav' ? 'all' : 'fav';
          this.renderAll();
        });
      } else {
        const b = barActs.querySelector('[data-act="pw-fav"]') as HTMLElement;
        b.title = this.pwState.view === 'fav' ? '全部平台' : '只看收藏';
        b.innerHTML = vIc(this.pwState.view === 'fav' ? 'star' : 'star-outline', 15);
      }
      // 列头（含新增入口）与滚动 body 分离：行渲染/空态写 body，避免整列清空丢掉入口
      const listHead = document.createElement('div');
      listHead.className = 'bz-vault-lc-head';
      listHead.innerHTML = `<div class="t">平台</div><button class="lc-add" data-lc-add="pw" title="新增密码">${vIc('plus', 13)} 新增密码</button>`;
      listHead.querySelector('[data-lc-add="pw"]')?.addEventListener('click', () => this.openPwEntryDialog());
      const listBody = document.createElement('div');
      listBody.className = 'bz-vault-lc-body';
      list.appendChild(listHead);
      list.appendChild(listBody);
      this.pwView.renderDeskList(listBody, this.pwState, (p, a) => {
        this.pwState.selPlatform = p;
        this.pwState.selAccount = a;
        this.renderDesktop();
      });
      this.pwView.renderDeskDetail(detail, this.pwState);
      return;
    }
    // 加密笔记 / 加密日记
    const kind = this.asset;
    let notes = [...this.dataManager.manifest.notes]
      .filter((n) => (kind === 'diary' ? n.kind === 'diary-entry' : n.kind !== 'diary-entry' && n.kind !== 'password-vault'))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    titleEl.textContent = kind === 'note' ? '加密笔记' : '加密日记';
    subEl.textContent = kind === 'note' ? `${notes.length} 篇 · 原路径已移出` : `${notes.length} 篇 · 日记面板「加密」分类移入`;
    if (kw) {
      const lower = kw.toLowerCase();
      notes = notes.filter((n) => (n.title || '').toLowerCase().includes(lower) || (n.path || '').toLowerCase().includes(lower));
    }
    const listHead = document.createElement('div');
    listHead.className = 'bz-vault-lc-head';
    listHead.innerHTML = `<div class="t">${kind === 'note' ? '全部加密笔记' : '加密日记条目'}</div><span class="lc-count">${notes.length} 项</span>`;
    const listBody = document.createElement('div');
    listBody.className = 'bz-vault-lc-body';
    list.appendChild(listHead);
    list.appendChild(listBody);
    if (!notes.length) {
      listBody.innerHTML =
        kind === 'note'
          ? '<div class="bz-pwv-empty"><div class="t">还没有加密笔记</div><div class="d">用「加密当前笔记」把整篇笔记移入保险库</div></div>'
          : '<div class="bz-pwv-empty"><div class="t">还没有加密日记</div><div class="d">日记面板把条目改分类为「加密」后移入这里</div></div>';
      return;
    }
    const selId = this._selNoteId && notes.some((n) => n.id === this._selNoteId) ? this._selNoteId : notes[0].id;
    for (const n of notes) {
      const row = document.createElement('div');
      row.innerHTML = noteRowHTML(n, kind, n.id === selId);
      const el = row.firstElementChild as HTMLElement;
      el.addEventListener('click', () => {
        this._selNoteId = n.id;
        this.renderDesktop();
      });
      el.addEventListener('dblclick', () => {
        if (this.previewMask) registerSheetCompanion(this.previewMask);
        void this.openPreview(n);
      });
      this.attachNoteDrawer(el, n, kind);
      listBody.appendChild(el);
    }
    this.renderNoteDetail(detail, notes.find((n) => n.id === selId) || notes[0], kind);
  }

  private _selNoteId: string | null = null;

  /** 详情 ⋮ → 弹行级抽屉（attachItemActions 需要真实元素承载，临时挂到 detail 根再触发 contextmenu） */
  private openNoteDetailMenu(note: SafeNote, kind: 'note' | 'diary'): void {
    const holder = document.createElement('div');
    holder.style.display = 'none';
    this.desk.detail.appendChild(holder);
    this.attachNoteDrawer(holder, note, kind);
    holder.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
  }

  /** 加密笔记/日记详情（异步解密日记正文预览） */
  private renderNoteDetail(detail: HTMLElement, note: SafeNote, kind: 'note' | 'diary') {
    const plain = kind === 'diary' ? this._diaryPlain[note.id] : undefined;
    detail.innerHTML = noteDetailHTML(note, kind, plain);
    const bind = (a: string, fn: () => void) => {
      detail.querySelector(`[data-detail="${a}"]`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        fn();
      });
    };
    bind('preview', () => {
      if (this.previewMask) registerSheetCompanion(this.previewMask);
      void this.openPreview(note);
    });
    bind('restore', () => this.confirmRestore(note));
    bind('delete', () => this.confirmDeleteNote(note));
    bind('restore-diary', () => this.confirmRestoreDiary(note));
    bind('copy-diary', () => this.copyDiaryText(note));
    bind('destroy-diary', () => this.confirmDestroyDiary(note));
    // 详情 ⋮ 菜单：复用行右键抽屉（临时载体触发）
    bind('menu', () => this.openNoteDetailMenu(note, kind));
    // 无 kind 过滤（正文预览异步）
    if (kind === 'diary' && !this._diaryPlain[note.id]) {
      void this.dataManager
        .decryptNoteBody(note)
        .then((t) => {
          if (t !== null && this._selNoteId === note.id) {
            this._diaryPlain[note.id] = t;
            this.renderNoteDetail(detail, note, kind);
          }
        })
        .catch(() => {});
    }
  }

  /** 笔记/日记动作集（行卡抽屉与移动详情页 ⋮ 共用） */
  private noteDrawerActions(note: SafeNote, kind: 'note' | 'diary'): { actions: ItemAction[]; opts: ItemActionsOptions } {
    const isDiary = kind === 'diary';
    const actions: ItemAction[] = [];
    actions.push({
      icon: 'eye',
      label: isDiary ? '预览正文' : '预览',
      keepOpen: true,
      onClick: () => {
        if (this.previewMask) registerSheetCompanion(this.previewMask);
        void this.openPreview(note);
      },
    });
    if (isDiary) {
      actions.push({
        icon: 'download',
        label: '还原回日记',
        onClick: () => this.confirmRestoreDiary(note),
      });
      actions.push({
        icon: 'trash-2',
        label: '彻底销毁',
        kind: 'danger',
        onClick: () => this.confirmDestroyDiary(note),
      });
    } else {
      actions.push({
        icon: 'undo-2',
        label: '还原',
        kind: 'danger',
        onClick: () => this.confirmRestore(note),
      });
      actions.push({
        icon: 'trash-2',
        label: '删除',
        kind: 'danger',
        onClick: () => this.confirmDeleteNote(note),
      });
    }
    return { actions, opts: { sheetHead: this.buildSheetHead(note, isDiary) } };
  }

  /** 笔记行/详情统一右键抽屉（预览/还原/删除） */
  private attachNoteDrawer(el: HTMLElement, note: SafeNote, kind: 'note' | 'diary'): void {
    const { actions, opts } = this.noteDrawerActions(note, kind);
    attachItemActions(el, actions, opts);
  }

  private buildSheetHead(note: SafeNote, isDiary = false): HTMLElement {
    const head = document.createElement('div');
    head.className = 'bz-item-sheet-entry';
    const body = document.createElement('div');
    body.style.cssText = 'display:flex; align-items:flex-start; gap:10px;';
    const emoji = document.createElement('span');
    emoji.className = 'bz-item-sheet-emoji';
    // 抽屉头资产图标：lucide 锁系（笔记=文件锁 / 日记=本子锁，对齐保险库资产图标语言），不用 emoji
    emoji.innerHTML = vIc(isDiary ? 'book-lock' : 'file-lock', 16);
    body.appendChild(emoji);
    const info = document.createElement('div');
    info.style.cssText = 'flex:1; min-width:0;';
    const t = document.createElement('div');
    t.className = 'bz-item-sheet-title';
    t.textContent = note.title;
    info.appendChild(t);
    const s = document.createElement('div');
    s.className = 'bz-item-sheet-sub';
    s.textContent = `${formatRelativeTime(note.createdAt)} · ${note.attachments.length} 个附件`;
    info.appendChild(s);
    body.appendChild(info);
    head.appendChild(body);
    return head;
  }

  // ---------- 密码条目弹窗（添加/编辑/平台编辑/确认/toast） ----------
  /** 密码添加/编辑弹窗（移动端复用桌面弹窗 DOM；双端共享 pwDataManager） */
  openPwEntryDialog(edit?: PasswordVaultEntry | null, prefill?: { platform?: string; url?: string }): void {
    if (!this.dataManager.unlocked) {
      notice('请先解锁保险库');
      return;
    }
    this._pwEditingId = edit ? edit.id : null;
    this._pwDupConfirmed = false; // 查重放行标志随弹窗打开复位：每次保存都要重新确认
    const dlg = this.ensurePwDialog();
    const title = dlg.querySelector('.bz-vault-dlg h3')!;
    title.textContent = edit ? '编辑密码条目' : '添加密码条目';
    const fields = ['platform', 'url', 'account', 'password', 'note'] as const;
    fields.forEach((f) => {
      const input = dlg.querySelector(`[data-f="${f}"]`) as HTMLInputElement;
      input.value = edit ? edit[f] || '' : prefill && f !== 'password' ? prefill[f as 'platform' | 'url'] || '' : '';
    });
    const pw = edit ? edit.password : this.generatePassword();
    const pwInput = dlg.querySelector('[data-f="password"]') as HTMLInputElement;
    pwInput.value = pw;
    // 防偷看：每次打开默认掩码态，eye 手动切换明文
    pwInput.type = 'password';
    const eyeBtn = dlg.querySelector('[data-pwv-dlg="eye"]') as HTMLElement | null;
    if (eyeBtn) {
      eyeBtn.title = '显示密码';
      eyeBtn.innerHTML = vIc('eye', 14);
    }
    (dlg.querySelector('[data-f-err]') as HTMLElement).textContent = '';
    this.pwDlgSyncUi?.();
    this.openPwDialogOverlay(true);
    // 焦点移到平台输入
    const first = dlg.querySelector('[data-f="platform"]') as HTMLInputElement | null;
    first?.focus();
  }

  private _pwEditingId: string | null = null;
  /** 同平台+账号查重命中后的放行标志（同一弹窗会话内再点一次保存即放行） */
  private _pwDupConfirmed = false;
  /** 弹窗内联动刷新（强度提示等）；ensurePwDialog 首建时注入 */
  private pwDlgSyncUi: (() => void) | null = null;
  private pwDlg: HTMLElement | null = null;
  /** 密码添加/编辑弹窗的 ESC 层（E7：弹窗可见时 ESC 只关弹窗，不穿透关掉主面板） */
  private pwDlgEsc: { unregister: () => void } | null = null;

  private ensurePwDialog(): HTMLElement {
    if (this.pwDlg && document.body.contains(this.pwDlg)) return this.pwDlg;
    const dlg = document.createElement('div');
    dlg.className = 'bz-vault-dlg-mask';
    dlg.innerHTML = `
      <div class="bz-vault-dlg">
        <h3>添加密码条目</h3>
        <div class="sub">带 * 为必填 · 平台与账号密码不可为空</div>
        <label>平台 *</label><input data-f="platform" placeholder="如 GitHub">
        <label>链接（可选）</label><input data-f="url" placeholder="https://…">
        <label>账号 *</label><input data-f="account" placeholder="登录账号 / 邮箱 / 手机号">
        <label>密码 *</label>
        <div class="pwdrow"><input data-f="password" type="password" placeholder="密码" autocomplete="new-password"><button class="gen" data-pwv-dlg="gen">生成</button><button class="mini" data-pwv-dlg="eye" type="button" title="显示密码">${vIc('eye', 14)}</button></div>
        <div class="pwstrength" data-pw-strength></div>
        <label>备注（可选）</label><input data-f="note" placeholder="备用信息…">
        <div class="err" data-f-err></div>
        <div class="btns"><button class="cancel" data-pwv-dlg="cancel">取消</button><button class="save" data-pwv-dlg="save">保存</button></div>
      </div>`;
    const errEl = dlg.querySelector('[data-f-err]') as HTMLElement;
    const get = (f: string) => (dlg.querySelector(`[data-f="${f}"]`) as HTMLInputElement).value.trim();
    // 防偷看：eye 切换密码明文/掩码（默认掩码）
    dlg.querySelector('[data-pwv-dlg="eye"]')?.addEventListener('click', () => {
      const input = dlg.querySelector('[data-f="password"]') as HTMLInputElement;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      const eye = dlg.querySelector('[data-pwv-dlg="eye"]') as HTMLElement;
      eye.title = show ? '隐藏密码' : '显示密码';
      eye.innerHTML = vIc(show ? 'eye-off' : 'eye', 14);
      input.focus();
    });
    // 强度提示（纯本地计算）：密码框输入/生成/打开弹窗时联动刷新
    const strengthEl = dlg.querySelector('[data-pw-strength]') as HTMLElement;
    const syncStrength = () => {
      const v = (dlg.querySelector('[data-f="password"]') as HTMLInputElement).value;
      if (!v) {
        strengthEl.textContent = '';
        delete strengthEl.dataset.level;
        return;
      }
      const s = passwordStrength(v);
      strengthEl.textContent = '强度：' + pwStrengthLabel(s);
      strengthEl.dataset.level = s;
    };
    this.pwDlgSyncUi = syncStrength;
    (dlg.querySelector('[data-f="password"]') as HTMLInputElement).addEventListener('input', syncStrength);
    // Enter 流转：平台→链接→账号→密码→备注→保存（末字段 Enter=保存）
    const flow: Array<[string, string | null]> = [
      ['platform', 'url'],
      ['url', 'account'],
      ['account', 'password'],
      ['password', 'note'],
      ['note', null],
    ];
    for (const [f, next] of flow) {
      dlg.querySelector(`[data-f="${f}"]`)?.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key !== 'Enter') return;
        e.preventDefault();
        if (next) (dlg.querySelector(`[data-f="${next}"]`) as HTMLInputElement | null)?.focus();
        else (dlg.querySelector('[data-pwv-dlg="save"]') as HTMLButtonElement | null)?.click();
      });
    }
    // 遮罩点击（内容区外）关闭
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) this.openPwDialogOverlay(false);
    });
    dlg.querySelector('[data-pwv-dlg="gen"]')?.addEventListener('click', () => {
      (dlg.querySelector('[data-f="password"]') as HTMLInputElement).value = this.generatePassword();
      syncStrength();
      this.toast('已生成新密码');
    });
    dlg.querySelector('[data-pwv-dlg="cancel"]')?.addEventListener('click', () => this.openPwDialogOverlay(false));
    dlg.querySelector('[data-pwv-dlg="save"]')?.addEventListener('click', async () => {
      const platform = get('platform');
      if (!platform) {
        errEl.textContent = '平台不能为空';
        return;
      }
      if (!get('account') || !get('password')) {
        errEl.textContent = '账号和密码不能为空';
        return;
      }
      // 同平台+账号查重（防重复收录）：首次命中只提示，再点一次保存放行（用户拍板）
      const account = get('account');
      const dup = this.pwDataManager.pwData.find(
        (d) => d.id !== this._pwEditingId && (d.platform || '').trim() === platform && (d.account || '').trim() === account
      );
      if (dup && !this._pwDupConfirmed) {
        this._pwDupConfirmed = true;
        errEl.textContent = `该平台已有同名账号（${dup.account || account}），再次点击保存将放行`;
        return;
      }
      const item = { platform, url: get('url'), account, password: get('password'), note: get('note') };
      try {
        if (this._pwEditingId) {
          await this.pwDataManager.updateItem(this._pwEditingId, item);
          this.pwState.selPlatform = item.platform;
          this.pwState.selAccount = this._pwEditingId;
        } else {
          await this.pwDataManager.addItem(item);
          this.pwState.selPlatform = item.platform;
          this.pwState.selAccount = this.pwDataManager.pwData[0]?.id ?? null;
        }
        this.openPwDialogOverlay(false);
        this.renderAll();
        this.toast('已保存');
      } catch (e: any) {
        errEl.textContent = '保存失败：' + e.message;
      }
    });
    document.body.appendChild(dlg);
    this.pwDlg = dlg;
    return dlg;
  }

  private openPwDialogOverlay(open: boolean) {
    if (!this.pwDlg) return;
    if (open) {
      topifyZ(this.pwDlg); // ADR-0067：密码弹窗挂 body，显示即发号保证盖过 vault 面板
      // E7：注册独立 ESC 层（isVisible = 弹窗 display，close = 关弹窗）——对照 save.ts confirmOverwrite。
      // 此前 ESC 命中主面板层：安全模式下 hide() 随即上锁清数据，再点保存报「保存失败：未解锁」。
      if (!this.pwDlgEsc) {
        this.pwDlgEsc = escManager.register('bz-vault-pw-dlg', {
          isVisible: () => !!this.pwDlg && this.pwDlg.style.display !== 'none' && document.body.contains(this.pwDlg),
          close: () => this.openPwDialogOverlay(false),
        });
      }
    } else {
      this.pwDlgEsc?.unregister();
      this.pwDlgEsc = null;
    }
    this.pwDlg.style.display = open ? 'flex' : 'none';
  }

  /** 卸载辅助：关密码弹窗（注销 ESC 层）并移除 body 上无 id 的弹窗遮罩（G：cleanup 此前不清） */
  closeAllDialogs(): void {
    this.openPwDialogOverlay(false);
    document.querySelectorAll('body > .bz-vault-dlg-mask').forEach((el) => el.remove());
  }

  /** 平台信息编辑弹窗（独立自绘） */
  private openPwPlatformEdit(platform: string) {
    const accs = this.pwDataManager.accountsOf(platform);
    const d = accs[0];
    const mask = document.createElement('div');
    mask.className = 'bz-vault-dlg-mask';
    topifyZ(mask); // ADR-0067：一次性弹窗，创建即显示即发号（挂 body，盖过 vault 面板）
    mask.style.display = 'flex';
    mask.innerHTML = `
      <div class="bz-vault-dlg">
        <h3>编辑平台 · ${escapeHtml(platform)}</h3>
        <div class="sub">改名/改链接将应用到该平台全部账号</div>
        <label>平台名 *</label><input data-pf="platform" value="${escapeHtml(platform === '(无平台)' ? '' : platform)}">
        <label>链接（可选）</label><input data-pf="url" value="${escapeHtml(d?.url || '')}">
        <div class="err" data-pf-err></div>
        <div class="btns"><button class="cancel" data-pf-act="cancel">取消</button><button class="save" data-pf-act="save">保存</button></div>
      </div>`;
    const errEl = mask.querySelector('[data-pf-err]') as HTMLElement;
    // E7：注册独立 ESC 层（isVisible = 遮罩在 DOM，close = 关弹窗），弹窗可见时 ESC 不穿透到主面板
    let escH: { unregister: () => void } | null = null;
    const closePf = () => {
      escH?.unregister();
      escH = null;
      mask.remove();
    };
    escH = escManager.register('bz-vault-pw-platform-edit', {
      isVisible: () => mask.isConnected,
      close: closePf,
    });
    mask.addEventListener('click', (e) => {
      if (e.target === mask) closePf();
    });
    mask.querySelector('[data-pf-act="cancel"]')?.addEventListener('click', () => closePf());
    mask.querySelector('[data-pf-act="save"]')?.addEventListener('click', async () => {
      const name = (mask.querySelector('[data-pf="platform"]') as HTMLInputElement).value.trim();
      if (!name) {
        errEl.textContent = '平台名不能为空';
        return;
      }
      const url = (mask.querySelector('[data-pf="url"]') as HTMLInputElement).value;
      try {
        await this.pwDataManager.updatePlatform(platform, { platform: name, url });
        this.pwState.selPlatform = name;
        this.pwState.selAccount = null;
        closePf();
        this.renderAll();
        this.toast('平台信息已更新');
      } catch (e: any) {
        errEl.textContent = '保存失败：' + e.message;
      }
    });
    document.body.appendChild(mask);
  }

  private askPwConfirm(title: string, message: string, okLabel: string, onYes: () => void): void {
    void openFlowDialog({
      title,
      message,
      actions: [
        { label: '取消', value: 'cancel' },
        { label: okLabel, value: 'ok', cta: true },
      ],
    }).then((v) => {
      if (v === 'ok') onYes();
    });
  }

  /** 敏感文本复制 + 60s 自动清空（密码资产与日记共用） */
  async copySensitive(text: string): Promise<boolean> {
    try {
      await copySensitiveText(text);
      return true;
    } catch (e) {
      // 降级：textarea 选中法
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        if (ok) armClipboardClear();
        return ok;
      } catch (e2) {
        return false;
      }
    }
  }

  private openExternal(url: string): void {
    try {
      const w = window as any;
      const electron = w.require && w.require('electron');
      if (electron && electron.shell) {
        electron.shell.openExternal(url);
        return;
      }
    } catch (e) {
      /* fallthrough */
    }
    window.open(url, '_blank');
  }

  private generatePassword(): string {
    const length = parseInt(this.config.pwLength || '') || 16;
    const charset = this.config.pwCharset || DEFAULT_PW_CHARSET;
    return secureRandomPassword(length, charset);
  }

  private genAndToast(): void {
    if (!this.dataManager.unlocked) {
      notice('请先解锁保险库');
      return;
    }
    // 生成密码（不自动落盘）：放入剪贴板，进入密码视图（供用户添加）
    void this.copySensitive(this.generatePassword()).then((ok) => {
      if (ok) this.toast('新密码已生成并复制（60 秒后自动清空），可「新增密码」粘贴使用');
      else this.toast('生成失败，请重试', true);
    });
  }

  private setAssetFromNav(a: VaultAsset): void {
    this.asset = a;
    lastVisitedAsset = a; // 记住停留资产：下次打开直落
    this.desk.nav.querySelectorAll('.bz-vault-item').forEach((el) =>
      el.classList.toggle('on', el.getAttribute('data-asset') === a)
    );
    this.mob.seg.querySelectorAll('.sg').forEach((el) =>
      el.classList.toggle('on', el.getAttribute('data-masset') === a)
    );
    this.renderAll();
  }

  /**
   * 快速取密落点（解锁成功后调用）：直接切到密码资产并聚焦搜索框——
   * 打开面板就是为了取密/管密，不再停留在概览多点一步。
   */
  enterPwQuickAccess(): void {
    if (!this._initialized) return;
    this.setAssetFromNav('pw');
    this.desk.search.value = '';
    try {
      this.desk.search.focus({ preventScroll: true } as any);
    } catch (e) {
      this.desk.search.focus();
    }
  }

  /** 直落上次停留资产（已解锁直接打开面板时；无记忆回落密码资产） */
  restoreLastAsset(): void {
    if (!this._initialized) return;
    this.setAssetFromNav(lastVisitedAsset);
  }

  /** 立即上锁（锁屏接管） */
  lockNow(): void {
    this.dataManager.lock();
    this.pwDataManager.lock();
    this.pwState = { ...DEFAULT_PW_STATE };
    this._selNoteId = null;
    this._diaryPlain = {};
    // E4：编辑态复位（关闭中的密码弹窗残留 id 不带到下次解锁）
    this._pwEditingId = null;
    // E3：收敛回概览 + 锁态文案——避免停在「密码/笔记」视图显示"保险库还没有密码"空态，
    // 视觉像"清空"而非"上锁"
    this.asset = 'overview';
    // E5：上锁后体检结果无意义，复位未体检态
    this.lastHealth = null;
    // 解锁会话计时终止（已解锁时长/无交互自动上锁）
    this.unlockedAt = null;
    this.stopSessionTimers();
    this.notifyUnlockUi();
    if (this.isSecurityMode()) {
      // G：与 hide() 同双口径（securityMode 可能只写在旧全局键上——单读 config 会漏上锁）
      this.hide();
    }
  }

  /** 解锁态变更后 UI 同步（Controller attachStatusBar 也调；锁屏/已解锁文本 + 重绘）。未建 DOM 时静默 */
  notifyUnlockUi(): void {
    if (!this.popup || !this._initialized) return;
    const st = this.popup.querySelector('[data-mob-unlock]');
    if (st) st.textContent = this.dataManager.unlocked ? '已解锁' : '已锁定';
    // 解锁会话起点（供左栏「已解锁时长」计时；上锁清零）
    if (this.dataManager.unlocked) {
      if (this.unlockedAt === null) this.unlockedAt = Date.now();
    } else {
      this.unlockedAt = null;
    }
    this.updateUnlockDuration();
    this.renderAll();
  }

  // ---------- 移动端渲染 ----------
  private renderMobile() {
    const body = this.mob.body;
    body.innerHTML = '';
    const c = this.counts();
    if (this.asset === 'overview') {
      const area = document.createElement('div');
      area.className = 'bz-vault-mob-overview';
      area.innerHTML = overviewHTML(this.overviewStats());
      body.appendChild(area);
      return;
    }
    if (this.asset === 'pw') {
      const card = document.createElement('div');
      card.className = 'bz-vault-mob-pwlist';
      this.pwView.renderMobList(card, this.pwState, (p) => this.openPwMobPage(p));
      body.appendChild(card);
      return;
    }
    // 笔记/日记
    const kind = this.asset;
    const notes = [...this.dataManager.manifest.notes]
      .filter((n) => (kind === 'diary' ? n.kind === 'diary-entry' : n.kind !== 'diary-entry' && n.kind !== 'password-vault'))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const kw = this.pwState.searchKw;
    const filtered = kw
      ? notes.filter((n) => (n.title || '').toLowerCase().includes(kw.toLowerCase()) || (n.path || '').toLowerCase().includes(kw.toLowerCase()))
      : notes;
    if (!filtered.length) {
      // G：日记空态不复用笔记文案（移动端此前恒显「加密当前笔记」引导，日记条目无从入口）
      body.innerHTML =
        kind === 'diary'
          ? '<div class="bz-pwv-empty"><div class="t">还没有加密日记</div><div class="d">日记面板把条目改分类为「加密」后移入这里</div></div>'
          : '<div class="bz-pwv-empty"><div class="t">还没有加密笔记</div><div class="d">用「加密当前笔记」把整篇笔记移入保险库</div></div>';
      return;
    }
    for (const n of filtered) {
      const row = document.createElement('div');
      row.innerHTML = noteRowHTML(n, kind, false);
      const el = row.firstElementChild as HTMLElement;
      el.addEventListener('click', () => {
        this._selNoteId = n.id;
        this.openNoteMobPage(n, kind);
      });
      this.attachNoteDrawer(el, n, kind);
      body.appendChild(el);
    }
  }

  private openNoteMobPage(note: SafeNote, kind: 'note' | 'diary') {
    // 移动端详情 = 全屏二级页（复用桌面详情 HTML，顶部带返回）
    const page = document.createElement('div');
    page.className = 'bz-vault-mobpage';
    page.innerHTML = `<div class="head"><button class="back" data-mob-back>${vIc('chevron-left', 16)}</button><div class="t">${kind === 'note' ? '加密笔记' : '加密日记'}</div><button class="ic" data-mob-menu>${vIc('more-h', 16)}</button></div><div class="body"></div>`;
    const body = page.querySelector('.body') as HTMLElement;
    body.innerHTML = noteDetailHTML(note, kind);
    // 详情动作（复用 bind 逻辑）
    const bind = (a: string, fn: () => void) => {
      body.querySelector(`[data-detail="${a}"]`)?.addEventListener('click', (e) => {
        e.stopPropagation();
        fn();
      });
    };
    bind('preview', () => void this.openPreview(note));
    bind('restore', () => this.confirmRestore(note));
    bind('delete', () => this.confirmDeleteNote(note));
    bind('restore-diary', () => this.confirmRestoreDiary(note));
    bind('copy-diary', () => this.copyDiaryText(note));
    bind('destroy-diary', () => this.confirmDestroyDiary(note));
    page.querySelector('[data-mob-back]')?.addEventListener('click', () => page.remove());
    page.querySelector('[data-mob-menu]')?.addEventListener('click', () => {
      // 移动端详情 ⋮：直接开底部抽屉（E6：旧实现 tmp.click() 触发不了 contextmenu/长按手势，
      // 移动端预览/还原/删除/编辑全入口丢失）
      const { actions, opts } = this.noteDrawerActions(note, kind);
      openItemSheet(actions, opts);
    });
    this.mob.body.appendChild(page);
    // 渲染日记正文预览
    if (kind === 'diary') {
      void this.dataManager.decryptNoteBody(note).then((t) => {
        const pre = body.querySelector('.note.pre');
        if (pre && t !== null) pre.innerHTML = escapeHtml(t).replace(/\n/g, '<br>');
      }).catch(() => {});
    }
  }

  private openPwMobPage(p: PlatformGroup) {
    const page = document.createElement('div');
    page.className = 'bz-vault-mobpage';
    page.innerHTML = `<div class="head"><button class="back" data-mob-back>${vIc('chevron-left', 16)}</button><div class="t">${escapeHtml(p.platform)}</div><button class="ic" data-mob-menu>${vIc('more-h', 16)}</button></div><div class="body"></div>`;
    this.pwView.renderMobPlatformPage(page.querySelector('.body') as HTMLElement, p, this.pwState);
    page.querySelector('[data-mob-back]')?.addEventListener('click', () => page.remove());
    // E6：平台详情页 ⋮ 此前未绑事件（点击无反应）——移动端直接开底部抽屉
    page.querySelector('[data-mob-menu]')?.addEventListener('click', () => this.pwView.openPlatformSheet(p.platform));
    this.mob.body.appendChild(page);
  }

  private openPwAccountPage(d: PasswordVaultEntry, st: PwViewState) {
    const page = document.createElement('div');
    page.className = 'bz-vault-mobpage';
    page.innerHTML = `<div class="head"><button class="back" data-mob-back>${vIc('chevron-left', 16)}</button><div class="t">${escapeHtml(d.platform)}</div><button class="ic" data-mob-menu>${vIc('more-h', 16)}</button></div><div class="body"></div>`;
    const body = page.querySelector('.body') as HTMLElement;
    // 单账号详情（搜索态复用平台页单卡逻辑——直接构账号卡）
    this.pwView.renderDeskDetail(body, { ...st, selPlatform: d.platform, selAccount: d.id });
    page.querySelector('[data-mob-back]')?.addEventListener('click', () => page.remove());
    // E6：账号详情页 ⋮ 此前未绑事件——移动端直接开底部抽屉
    page.querySelector('[data-mob-menu]')?.addEventListener('click', () => this.pwView.openAccountSheet(d));
    this.mob.body.appendChild(page);
  }

  /** 轻量 toast（保险库窗口内） */
  toast(msg: string, isErr = false) {
    notice(msg, isErr ? 'error' : undefined);
  }

  // ---------- 加密笔记/日记销毁/还原 ----------
  confirmDeleteNote(note: SafeNote) {
    void openFlowDialog({
      title: '删除加密笔记',
      message: `将永久删除「${note.title}」的正文与全部附件密文，不可恢复。确定删除？`,
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '永久删除', value: 'ok', cta: true },
      ],
    }).then((v) => {
      if (v !== 'ok') return;
      void this.dataManager
        .removeNote(note.id)
        .then(() => {
          if (this._selNoteId === note.id) this._selNoteId = null;
          this.renderList();
          this.toast(`已删除加密笔记「${note.title}」`);
        })
        .catch((e: any) => this.toast('删除失败：' + e.message, true));
    });
  }

  /** 日记还原回日记（复用 diary reclassifyEntry 语义：还原块 merge 回原日期 md） */
  confirmRestoreDiary(note: SafeNote) {
    void openFlowDialog({
      title: '还原回日记',
      message: `将「${note.title}」的正文与附件还原到 ${note.path} 的时间序位置？`,
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '还原', value: 'ok', cta: true },
      ],
    }).then((v) => {
      if (v !== 'ok') return;
      const h = progressNotify('还原日记 ' + note.title);
      void this.restoreDiaryEntry(note, h);
    });
  }

  /** 实际执行日记还原（调 SafeManager.restoreDiaryEntry——diary 域同款语义） */
  private async restoreDiaryEntry(note: SafeNote, h: NoticeHandle | null): Promise<void> {
    try {
      const plain = await this.dataManager.decryptNoteBody(note);
      if (plain === null) {
        if (h) h.hide();
        this.toast('正文解密失败，无法还原', true);
        return;
      }
      const ok = await this.dataManager.restoreDiaryEntry(note.id, plain);
      if (h) h.hide();
      if (ok) {
        if (this._selNoteId === note.id) this._selNoteId = null;
        this.renderList();
        this.toast('已还原回日记');
      } else {
        this.toast('还原失败：附件冲突或写回失败', true);
      }
    } catch (e: any) {
      if (h) h.hide();
      this.toast('还原失败：' + e.message, true);
    }
  }

  copyDiaryText(note: SafeNote) {
    void this.dataManager
      .decryptNoteBody(note)
      .then((t) => {
        if (t === null) {
          this.toast('正文解密失败', true);
          return;
        }
        void this.copySensitive(t).then((ok) => this.toast(ok ? '正文已复制（60 秒后自动清空）' : '复制失败', !ok));
      })
      .catch(() => this.toast('正文解密失败', true));
  }

  confirmDestroyDiary(note: SafeNote) {
    void openFlowDialog({
      title: '彻底销毁日记',
      message: `将永久销毁「${note.title}」的密文（含附件），此操作不可撤销。确定？`,
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '永久销毁', value: 'ok', cta: true },
      ],
    }).then((v) => {
      if (v !== 'ok') return;
      void this.dataManager
        .removeNote(note.id)
        .then(() => {
          delete this._diaryPlain[note.id];
          if (this._selNoteId === note.id) this._selNoteId = null;
          this.renderList();
          this.toast(`已销毁「${note.title}」`);
        })
        .catch((e: any) => this.toast('销毁失败：' + e.message, true));
    });
  }

  confirmRestore(note: SafeNote) {
    void openFlowDialog({
      title: '还原',
      message: `将「${note.title}」的原文${note.attachments.length ? '与 ' + note.attachments.length + ' 个原质量附件' : ''}还原到原路径？`,
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '还原', value: 'ok', cta: true },
      ],
    }).then((v) => {
      if (v !== 'ok') return;
      const h = progressNotify('还原 ' + note.title);
      void this.dataManager
        .restoreNote(note.id, (p) => updateProgress(h, p.done, p.total, p.current))
        .then(({ conflicts, removed, manifestSaveFailed }) => {
          const total = note.attachments.length + 1;
          if (removed) {
            // 取出即删：进度通知内直接显示完成；随后跳转笔记并关闭面板
            finishProgress(h, total, '还原完成');
            this.hide();
            this.openRestoredNote(note);
          } else if (manifestSaveFailed) {
            // 文件已还原、仅清单落盘失败（磁盘异常）：如实告知，重试可幂等收敛
            finishProgress(h, total, '文件已还原（清单保存失败）');
            notice(
              '笔记与附件已还原到原位置，但保险库清单保存失败（磁盘异常）；下次解锁后重试还原将自动完成清理',
              'warning'
            );
          } else {
            // 原子还原（优化五）：任一冲突/失败 → 整体未写回，条目保留在保险库
            finishProgress(h, total, '还原未完成（' + conflicts.length + ' 个目标有冲突）');
            // 列出具体冲突路径（保留目录信息让用户知道是哪个目标被占用；超长截断防通知栏过高）
            const cap = (p: string) => (p.length > 48 ? p.slice(0, 48) + '…' : p);
            const paths = conflicts.map(cap).join('、');
            notice(
              `还原中止：${conflicts.length} 个目标被占用或不可用（${paths}），未写入任何文件，条目保留在保险库`,
              'warning'
            );
          }
          void this.renderList();
        })
        .catch((e: any) => {
          // 失败分支收尾进度通知（ticket 5）：收起常驻转圈，不残留幽灵进度条
          if (h) h.hide();
          notifyActionError(e, '还原');
        });
    });
  }

  /** 还原成功后打开该笔记（Obsidian 当前叶子页打开） */
  openRestoredNote(note: SafeNote) {
    const app = getApp();
    try {
      const file = app.vault.getAbstractFileByPath(note.path);
      if (file && (file as any).isFolder !== true) {
        (app.workspace as any).openLinkText?.(note.path, note.path);
      }
    } catch (e) {
      /* 打开失败静默 */
    }
  }

  // ---------- 预览窗 ----------
  /**
   * 打开预览窗。关键：先同步显示弹窗骨架再异步填充正文——
   * 真实 Obsidian 里 MarkdownRenderer.render 可能挂起（历史 b0831de 修过预览挂起），
   * 若把所有 await 跑完才设 display，挂起时单击就毫无反应；故拆成「先显骨架 + 异步填充」。
   */
  async openPreview(note: SafeNote) {
    if (!this.previewPopup) this.ensureElements();
    if (!this.dataManager.unlocked || !this.dataManager.password) return;
    // 连开多篇预览不关窗：先释放上一批 Blob URL（防内存泄漏）
    this.revokePreviewUrls();
    const popup = this.previewPopup!;
    const mask = this.previewMask!;
    popup.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'bz-encrypt-preview-head';
    const title = document.createElement('h4');
    title.textContent = note.title;
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = vIc('x', 14); // 预览关闭（原 ❌ emoji 改 lucide 内联，铁律通知/图标去 emoji）
    closeBtn.className = 'bz-encrypt-btn bz-win-close';
    closeBtn.title = '关闭';
    closeBtn.setAttribute('aria-label', '关闭');
    closeBtn.onclick = () => this.closePreview();
    header.appendChild(title);
    header.appendChild(closeBtn);
    popup.appendChild(header);
    const body = document.createElement('div');
    body.className = 'bz-encrypt-preview-body';
    const loadHint = document.createElement('div');
    loadHint.className = 'bz-encrypt-preview-loading';
    loadHint.textContent = '解密中…';
    body.appendChild(loadHint);
    popup.appendChild(body);
    // 先显示弹窗（同步），内容异步填充，保证单击必然弹出
    topifyZ(this.previewMask, this.previewPopup); // ADR-0067：复用面板显示即发号
    mask.style.display = 'block';
    popup.style.display = 'flex';
    void this.fillPreviewBody(note, body);
  }

  /** 预览窗正文异步填充：解密 → 渲染（带超时兜底）→ 图随文走 → 画廊 */
  private async fillPreviewBody(note: SafeNote, body: HTMLDivElement) {
    try {
      // 正文与全部预览层并行解密（PBKDF2 派生在浏览器多线程实现，串行逐个解会很慢；
      // 并行后多附件预览窗显著提速；每个附件只解一次，嵌入与底部画廊共用）
      const bodyP = this.dataManager.decryptNoteBody(note);
      const previewP: Promise<{ path: string; du: string }>[] = [];
      const seen = new Set<string>();
      for (const a of note.attachments) {
        if (!a.hasPreview || seen.has(a.path)) continue;
        seen.add(a.path);
        previewP.push(
          this.dataManager.decryptPreview(a).then(
            (du) => ({ path: a.path, du: du || '' }),
            () => ({ path: a.path, du: '' })
          )
        );
      }
      const [plain, previewResults] = await Promise.all([bodyP, Promise.all(previewP)]);
      const dataUrls = new Map<string, string>();
      for (const r of previewResults) dataUrls.set(r.path, r.du);
      // 先把嵌入改写占位 token（按文档顺序混排），渲染后再原位替换为预览图
      const { text, slots, inlined } = collectMediaSlots(plain ?? '', note.attachments);
      // Markdown 渲染（占位 token 原样保留）——带超时：render 挂起时降级纯文本而不是让弹窗空白
      const mdEl = document.createElement('div');
      mdEl.className = 'bz-encrypt-preview-md';
      const rendered = await this.renderWithTimeout(getApp(), text, mdEl, note.path);
      if (rendered) {
        // 原位替换 token → 预览图，实现图随文走
        let html = mdEl.innerHTML;
        for (const slot of slots) {
          const a = slot.attachment;
          if (a) html = html.split(slot.token).join(mediaHtml(a, dataUrls.get(a.path)));
          else html = html.split(slot.token).join('');
        }
        mdEl.innerHTML = html;
      } else {
        // 渲染失败/超时 → 纯文本兜底（至少能看正文）
        mdEl.textContent = plain;
      }
      body.innerHTML = '';
      body.appendChild(mdEl);
      // 底部画廊：未被正文引用的附件兜底展示（避免漏看）
      const residuals = note.attachments.filter((a) => !inlined.has(a.path));
      if (residuals.length) {
        const gallery = document.createElement('div');
        gallery.className = 'bz-encrypt-preview-gallery';
        for (const a of residuals) {
          const wrap = document.createElement('div');
          wrap.innerHTML = mediaHtml(a, dataUrls.get(a.path));
          gallery.appendChild(wrap);
        }
        body.appendChild(gallery);
      }
      // 缩略图/占位统一绑定：点击按需解密原始层（只加载被点的那一张）
      this.bindMediaClicks(body, note.attachments);
      // 自动加载原图（设置开关，默认关）：预览打开即自动解密全部原始层替换省略图；
      // 复用点击链路的 loadOriginal（每 slot 独立转圈/失败恢复，与手动点击同语义）
      if (this.config.autoLoadOriginal) {
        body.querySelectorAll<HTMLElement>('.bz-encrypt-preview-slot').forEach((slot) => slot.click());
      }
    } catch (e) {
      body.innerHTML = '';
      const err = document.createElement('div');
      err.textContent = '正文解密失败';
      body.appendChild(err);
    }
  }

  /** 渲染带超时：3000ms 内不完成视为失败（防真实环境 render 挂起导致弹窗永久空白/不可关） */
  private async renderWithTimeout(
    app: any,
    text: string,
    el: HTMLElement,
    path: string,
    timeoutMs = 3000
  ): Promise<boolean> {
    let finished = false;
    const render = MarkdownRenderer.render(app, text, el, path, new Component()).then(
      () => {
        finished = true;
      },
      () => {
        finished = true;
      }
    );
    await Promise.race([render, new Promise((r) => setTimeout(r, timeoutMs))]);
    return finished;
  }

  /** 预览窗内所有缩略图/占位 slot 绑定点击：只加载被点的那一张原始层 */
  private bindMediaClicks(root: HTMLElement, attachments: SafeAttachment[]) {
    const slots = root.querySelectorAll<HTMLElement>('.bz-encrypt-preview-slot');
    for (const slot of slots) {
      const key = slot.getAttribute('data-attach');
      if (!key) continue;
      const a = attachments.find((x) => x.path === decodeURIComponent(key));
      if (!a) continue;
      slot.addEventListener('click', () => void this.loadOriginal(a, slot));
    }
  }

  /**
   * 点击缩略图：该图 slot 显示转圈 → 解密原始层 → 原地替换为原始质量图片 / 可播放视频。
   * 不弹通知（缩略图内加载态更直观）；失败恢复缩略图并提示 title 可重试。
   */
  private async loadOriginal(a: SafeAttachment, slot: HTMLElement) {
    if (slot.dataset.loaded === '1' || slot.dataset.loading === '1') return;
    slot.dataset.loading = '1';
    slot.classList.add('bz-encrypt-preview-slot--loading');
    try {
      const b64 = await this.dataManager.decryptAttachmentOriginal(a);
      if (!b64) throw new Error('无密文');
      const url = await this.blobUrlOf(b64, mimeOf(a.path));
      const img = slot.querySelector<HTMLImageElement>('img.bz-encrypt-preview-media');
      const missing = slot.querySelector<HTMLElement>('.bz-encrypt-preview-missing');
      if (a.kind === 'video') {
        // 视频：缩略图/占位替换为可播放 <video>
        const video = document.createElement('video');
        video.className = 'bz-encrypt-preview-video';
        video.controls = true;
        video.preload = 'metadata';
        video.src = url;
        if (img) img.replaceWith(video);
        else if (missing) missing.replaceWith(video);
        else slot.appendChild(video);
      } else if (img) {
        // 图片：原地换 src（不用换元素，保持布局）
        img.src = url;
      } else if (missing) {
        const im = document.createElement('img');
        im.className = 'bz-encrypt-preview-media';
        im.alt = escapeHtml(a.path || '');
        im.src = url;
        missing.replaceWith(im);
      }
      slot.dataset.loaded = '1';
      slot.classList.add('bz-encrypt-preview-slot--loaded');
    } catch (e) {
      // 失败：恢复缩略图，title 提示可重试（不弹通知）
      const img = slot.querySelector<HTMLImageElement>('img.bz-encrypt-preview-media');
      const missing = slot.querySelector<HTMLElement>('.bz-encrypt-preview-missing');
      if (img) img.title = '加载失败，点击重试';
      if (missing) missing.title = '加载失败，点击重试';
    } finally {
      delete slot.dataset.loading;
      slot.classList.remove('bz-encrypt-preview-slot--loading');
    }
  }

  /** 原始 base64 → 展示 URL：优先 Blob URL（大视频/大图不撑坏内存），环境不支持时退回 dataURL */
  private async blobUrlOf(b64: string, mime: string): Promise<string> {
    try {
      const bytes = base64ToBytes(b64);
      const url = URL.createObjectURL(new Blob([bytes as any], { type: mime }));
      if (url) {
        this._previewUrls.push(url);
        return url;
      }
    } catch (e) {
      /* 环境不支持 Blob URL → 退回 dataURL */
    }
    return `data:${mime};base64,${b64}`;
  }

  /** 释放本次预览积累的全部 Blob URL（关预览/换预览共用，防内存泄漏） */
  private revokePreviewUrls() {
    for (const u of this._previewUrls) {
      try {
        URL.revokeObjectURL(u);
      } catch (e) {
        /* 忽略 */
      }
    }
    this._previewUrls = [];
  }

  closePreview() {
    // 释放本次预览产生的全部 Blob URL（防内存泄漏）
    this.revokePreviewUrls();
    // 抽屉来源打开时注册过附属浮层：关闭预览注销（常驻元素，非抽屉路径 unregister 为 no-op）
    if (this.previewMask) unregisterSheetCompanion(this.previewMask);
    if (this.previewMask) this.previewMask.style.display = 'none';
    if (this.previewPopup) this.previewPopup.style.display = 'none';
  }

  // ---------- 设置弹窗 ----------
  openSettings() {
    // 以下配置项均为启动快照（控制器构造时读取），改动需重载插件后生效——warnReload 一次性提示
    // 收敛为渲染器 onCommit（text/path 行）/ onChange 一次性闭包（toggle），文案逐字保留（ticket 131）
    openSettingsModal({ title: '保险库设置', maxWidth: 560, schema: encryptSettingsSchema() });
  }

  registerEscape() {
    escManager.register('encrypt', {
      isVisible: () => !!(this.mask && this.mask.style.display === 'block') || !!(this.previewMask && this.previewMask.style.display === 'block'),
      close: () => {
        if (this.previewMask && this.previewMask.style.display === 'block') this.closePreview();
        else if (this.mask && this.mask.style.display === 'block') this.hide();
      },
    });
  }
}

// ==================== 协调/命令入口（Controller） ====================

export class EncryptAppController {
  static instance: EncryptAppController | null = null;
  static getInstance(config: EncryptUIConfig): EncryptAppController {
    if (!EncryptAppController.instance) {
      EncryptAppController.instance = new EncryptAppController(config);
    }
    return EncryptAppController.instance;
  }

  config: EncryptUIConfig;
  dataManager: SafeManager;
  uiManager: UIManager;
  _initialized = false;
  /** 加密进行中标志（重入保护：处理中拒绝再次触发 lockCurrentNote） */
  private _locking = false;
  /** 状态栏元素（main.ts mount 注入；解锁态变化时刷新，补丁：状态栏锁状态提示） */
  private statusBarEl: HTMLElement | null = null;

  constructor(config: EncryptUIConfig) {
    this.config = config;
    this.dataManager = new SafeManager(config.root);
    // ADR-0085：密码资产数据管理器与保险库同一 SafeManager 单例（统一解锁态/清单）
    this.uiManager = new UIManager(this.dataManager, config);
    this.uiManager.onLockCurrentNote = () => {
      void this.lockCurrentNote();
    };
  }

  /**
   * 状态栏挂载（main.ts onload 调用）：初始为锁定态；订阅解锁态变化刷新，
   * 点击打开统一保险库面板（openEncrypt 有解锁引导）。
   */
  attachStatusBar(el: HTMLElement) {
    this.statusBarEl = el;
    this.dataManager.onUnlockChange = (unlocked) => {
      if (this.statusBarEl) this.statusBarEl.innerHTML = statusbarHtml(unlocked);
      // 解锁/上锁后 UI 同步（密码数据加载/锁屏态）
      this.uiManager.notifyUnlockUi?.();
    };
    this.dataManager.onUnlockChange(this.dataManager.unlocked);
  }

  async init() {
    if (this._initialized) return;
    this.uiManager.ensureElements();
    this._initialized = true;
  }

  /** 打开保险库主面板：解锁成功直落密码资产并聚焦搜索（快速取密路径）；
   *  已解锁直接打开则恢复上次停留资产（会话级记忆）。 */
  async openManager() {
    if (!this.dataManager.unlocked) {
      const ok = await this.uiManager.showPasswordDialog();
      if (ok) {
        this.uiManager.show();
        this.uiManager.enterPwQuickAccess();
      }
    } else {
      this.uiManager.show();
      this.uiManager.restoreLastAsset();
    }
  }

  /**
   * 快速复制密码（命令 bz-encrypt-copy-password；不打开主面板）：
   * 未解锁先弹主密码 → 轻量 fuzzy 选择器选条目 → 复制到剪贴板（60s 自动清空）。
   */
  async quickCopyPassword(): Promise<void> {
    if (!this.dataManager.unlocked) {
      const ok = await this.uiManager.showPasswordDialog();
      if (!ok) return;
    }
    try {
      await this.uiManager.pwDataManager.load();
    } catch (e) {
      /* 载荷损坏等：按空态处理，由下方「还没有密码」兜底提示 */
    }
    const entries = this.uiManager.pwDataManager.pwData;
    if (!entries.length) {
      notice('保险库还没有密码，打开面板后可新增');
      return;
    }
    void openPasswordQuickPicker(entries, (d) => {
      void this.uiManager.copySensitive(d.password).then((ok) => {
        notice(
          ok ? `已复制「${d.platform}」${d.account ? `（${d.account}）` : ''}的密码，60 秒后自动清空` : '复制失败，请手动复制',
          ok ? 'success' : 'error'
        );
      });
    });
  }

  /** 二次确认：正文与附件将移入保险库（原路径消失），点确认才开始 */
  private async confirmLockProceed(file: { basename: string }, attCount: number): Promise<boolean> {
    return (
      (await openFlowDialog({
        title: '加密到保险库',
        message: `把「${file.basename}」的正文${attCount ? '与 ' + attCount + ' 个附件' : ''}加密移入保险库？加密后原笔记与附件将从原路径移出（保险库内为密文）。`,
        actions: [
          { label: '取消', value: 'cancel' },
          { label: '加密', value: 'ok', cta: true },
        ],
      })) === 'ok'
    );
  }

  /**
   * 读取附件原始内容并按设置生成预览层。
   * Q3-A：任一附件读取失败 → 整笔放弃（返回 null，不落任何东西、原文件不动）；预览失败不算失败（可选增强）。
   */
  private async readAttachmentInputs(app: any, attPaths: string[]): Promise<LockAttachmentInput[] | null> {
    const attachments: LockAttachmentInput[] = [];
    // 预览档取构造时注入的设置快照（长边/质量，缺省 384/0.5）
    const size = this.config.previewSize || 384;
    const quality = this.config.previewQuality || 0.5;
    for (const p of attPaths) {
      try {
        const f = app.vault.getAbstractFileByPath(p);
        if (!f) throw new Error('附件不存在');
        const buf = await app.vault.readBinary(f as any);
        const data = bytesToBase64(new Uint8Array(buf)); // 统一分块 util（防大附件栈溢出/性能劣化）
        let previewData: string | undefined;
        if (this.config.previewEnabled) {
          try {
            const resourceUrl = (app.vault as any).getResourcePath?.(f) || '';
            const result =
              kindOf(p) === 'video'
                ? await videoFrame(resourceUrl, size, quality)
                : await compressImage(resourceUrl, size, quality);
            if (result) previewData = result.dataUrl;
          } catch (e) {
            previewData = undefined;
          }
        }
        attachments.push({ path: p, kind: kindOf(p), data, previewData });
      } catch (e: any) {
        notice('加密失败：附件读取失败（' + p + '）', 'error');
        return null;
      }
    }
    return attachments;
  }

  /** 加锁当前打开笔记（正文 + 双链图片/视频附件；执行前弹确认）。重入保护：处理中拒绝再次触发 */
  async lockCurrentNote() {
    if (this._locking) {
      notice('正在加密当前笔记，请稍候');
      return;
    }
    this._locking = true;
    try {
      const app = getApp();
      const file = app.workspace.getActiveFile();
      if (!file) {
        notice('请先打开要加密的笔记');
        return;
      }
      // 锁定状态点「加密当前笔记」：先弹解锁，成功后继续原操作（不再只提示让用户自己绕路）
      if (!this.dataManager.unlocked || !this.dataManager.password) {
        const ok = await this.uiManager.showPasswordDialog();
        if (!ok) {
          notice('未解锁，已取消加密');
          return;
        }
      }
      const content = await app.vault.read(file);
      // 附件引用：metadataCache.embeds（Obsidian 自带链接信息）为主 + 正则兜底（collectNoteAttachmentPaths）
      const attPaths = collectNoteAttachmentPaths(app, file, content);
      if (!(await this.confirmLockProceed(file, attPaths.length))) return;
      const attachments = await this.readAttachmentInputs(app, attPaths);
      if (!attachments) return;
      const h = progressNotify('加密 ' + file.basename);
      try {
        await this.dataManager.lockNote(
          {
            path: file.path,
            title: file.basename,
            content,
            attachments,
          },
          (p) => updateProgress(h, p.done, p.total, p.current),
          (failed) => {
            // Q4-A：删原文件失败仅提示、不回滚（冗余原文件可见、可手动删除）
            if (failed.length) {
              notice(failed.length + ' 个原文件删除失败（已保留在原位置，可手动删除）', 'warning');
            }
          }
        );
        // 主动打开保险库面板，展示刚加密的条目（无独立完成 toast，进度通知已显示完成）
        finishProgress(h, attachments.length + 1, '加密完成');
        this.uiManager.show();
      } catch (e: any) {
        // 失败分支收尾进度通知（ticket 5）：收起常驻转圈，不残留幽灵进度条；错误另由 error toast 明示
        if (h) h.hide();
        notifyActionError(e, '加密');
      }
    } finally {
      this._locking = false;
    }
  }

  /** 卸载清理 */
  cleanup() {
    const ids = ['bz-encrypt-mask', 'bz-encrypt-popup', 'bz-encrypt-preview-mask', 'bz-encrypt-preview-popup', 'bz-encrypt-health-mask', 'bz-encrypt-health-popup'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
    // G：密码弹窗（含平台编辑遮罩，无 id 挂 body）、剪贴板自动清空计时器、密码资产域事件订阅
    this.uiManager.closeAllDialogs();
    cancelClipboardClear();
    // 解锁会话计时（时长刷新/无交互自动上锁）+ 账号卡明文自动回遮计时
    this.uiManager.stopSessionTimers();
    this.uiManager.pwView.disposeRevealTimers();
    this.uiManager.pwDataManager.destroy();
    this.uiManager.mask = null;
    this.uiManager.popup = null;
    this.uiManager.previewMask = null;
    this.uiManager.previewPopup = null;
    this.uiManager.healthMask = null;
    this.uiManager.healthPopup = null;
    this.uiManager._initialized = false;
    this.dataManager.onUnlockChange = null;
    this.dataManager.lock();
  }
}