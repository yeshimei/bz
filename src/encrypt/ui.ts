/**
 * 加密保险箱 UI（encrypt 域）
 * 主面板（备忘录样式）：标题「加密保险箱」+ 列表 + 预览/还原/设置。
 * 解锁弹窗（复用密码本 showPasswordDialog 范式）；预览窗（独立只读弹窗，Markdown 渲染 + 图片/视频压缩预览）。
 * 协调层：加锁当前笔记（含预览生成 + 动态进度；完成自动打开面板）、还原取出（完成跳转笔记并关闭面板）。
 */
import { Setting, MarkdownRenderer, Component } from 'obsidian';
import { notice, notify } from '../core/notice';
import type { NoticeHandle } from '../core/notice';
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { openFlowDialog } from '../core/flow-dialog';
import { createIconBtn, createOverlay } from '../core/dom';
import {
  attachItemActions,
  registerSheetCompanion,
  unregisterSheetCompanion,
  type ItemAction,
} from '../core/item-actions';
import { escapeHtml, formatRelativeTime } from '../core/utils';
import { getSettings, tryGetSettings, saveSettings } from '../core/settings-provider';
import { openSettingsModal, createSettingsGroup } from '../core/settings-modal';
import { renderPathSettingRow } from '../core/path-picker';
import { isMobileEnv, applyMobileWindowFullscreen } from '../core/mobile';
import { SafeManager, base64ToBytes, bytesToBase64, type SafeNote, type SafeAttachment, type HealthReport, type HealthItem, type LockAttachmentInput } from './data';
import { compressImage, videoFrame } from './preview';

export interface EncryptUIConfig {
  root: string;
  previewEnabled: boolean;
  previewSize: number;
  previewQuality: number;
  autoLoadOriginal: boolean;
  securityMode: boolean;
}

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



export class UIManager {
  dataManager: SafeManager;
  config: EncryptUIConfig;
  /** 顶部「加密当前笔记」按钮回调（由 Controller 注入，调 lockCurrentNote） */
  onLockCurrentNote: (() => void) | null = null;
  // DOM
  mask: HTMLDivElement | null = null;
  popup: HTMLDivElement | null = null;
  listContainer: HTMLDivElement | null = null;
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

  constructor(dataManager: SafeManager, config: EncryptUIConfig) {
    this.dataManager = dataManager;
    this.config = config;
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

  // ---------- 创建 DOM ----------
  ensureElements() {
    if (this._initialized) return;
    this.mask = this.createMask('bz-encrypt-mask');
    this.popup = this.createPopup('bz-encrypt-popup');
    // 移动端形态：常规卡由基样式承担，真全屏统一走 .bz-win-mfs（ticket 68，show() 每次挂类）
    const header = this.createHeader();
    this.popup.appendChild(header);
    this.listContainer = document.createElement('div');
    this.listContainer.id = 'bz-encrypt-list';
    this.listContainer.className = 'bz-encrypt-list';
    this.popup.appendChild(this.listContainer);
    document.body.appendChild(this.mask);
    document.body.appendChild(this.popup);
    // 预览窗
    const ov = createOverlay({ maskId: 'bz-encrypt-preview-mask', popupId: 'bz-encrypt-preview-popup', zIndex: 10060, maxWidth: 640, onMaskClick: () => this.closePreview() });
    this.previewMask = ov.mask;
    this.previewPopup = ov.popup;
    document.body.appendChild(this.previewMask);
    document.body.appendChild(this.previewPopup);
    this.registerEscape();
    this._initialized = true;
  }

  createMask(id: string): HTMLDivElement {
    const mask = document.createElement('div');
    mask.id = id;
    mask.className = 'bz-overlay-mask';
    mask.style.zIndex = '9998';
    mask.style.display = 'none';
    mask.onclick = () => this.hide();
    return mask;
  }

  createPopup(id: string): HTMLDivElement {
    const popup = document.createElement('div');
    popup.id = id;
    popup.className = 'bz-overlay-popup';
    popup.style.zIndex = '9999';
    // 视觉尺寸已收敛至 styles.css（#bz-encrypt-popup），此处只保留功能性 zIndex/显隐
    popup.style.display = 'none';
    return popup;
  }

  createHeader(): HTMLDivElement {
    const header = document.createElement('div');
    header.className = 'bz-encrypt-head';
    const title = document.createElement('h3');
    title.textContent = '保险箱';
    const btns = document.createElement('div');
    btns.className = 'bz-encrypt-head-btns';
    const lockBtn = createIconBtn('🔒', '加密当前笔记', () => this.onLockCurrentNote?.());
    const settingsBtn = createIconBtn('⚙️', '保险箱设置', () => this.openSettings());
    const healthBtn = createIconBtn('🩺', '保险箱体检与清理', () => void this.openHealthDialog());
    const closeBtn = createIconBtn('❌', '关闭', () => this.hide());
    if (this.onLockCurrentNote) btns.appendChild(lockBtn);
    btns.appendChild(healthBtn);
    btns.appendChild(settingsBtn);
    btns.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(btns);
    return header;
  }

  // ---------- 显示/隐藏 ----------
  show() {
    if (!this._initialized) this.ensureElements();
    applyMobileWindowFullscreen(this.popup, tryGetSettings().encryptMobileDefaultFullscreen === true);
    this.mask!.style.display = 'block';
    this.popup!.style.display = 'flex';
    void this.renderList();
  }

  hide() {
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
    if (this.config.securityMode) {
      this.dataManager.lock();
      notice('安全模式：已自动上锁');
    }
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
    this.healthMask!.style.display = 'flex';
    this.healthPopup!.style.display = 'flex';
    void this.runHealthScan();
  }

  private ensureHealthElements() {
    const mask = document.createElement('div');
    mask.id = 'bz-encrypt-health-mask';
    mask.className = 'bz-encrypt-health-mask';
    mask.style.zIndex = '10080';
    mask.style.display = 'none';
    const popup = document.createElement('div');
    popup.id = 'bz-encrypt-health-popup';
    popup.className = 'bz-encrypt-health-box';
    popup.style.zIndex = '10081';
    popup.style.display = 'none';
    const head = document.createElement('div');
    head.className = 'bz-encrypt-health-head';
    const title = document.createElement('h4');
    title.textContent = '保险箱体检';
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
      // 扫描完成：全量重渲染（分类规整 + 勾选框 + 底部按钮计数）
      this.renderHealthReport(report, body);
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
      notice('清理失败：' + e.message, 'error');
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
      mask.style.zIndex = '10070';
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
      warning.innerHTML = '<strong>⚠️ 重要提醒</strong><br>• 主密码 <b>不会存储</b>，也无法找回，请务必牢记！<br>• 若遗忘密码，加密笔记及其附件将永久丢失。<br>• 建议使用密码本（如 Bitwarden）保存此密码。';
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
        message.textContent = '请输入您设置的主密码以解锁保险箱';
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
              notice('设置失败：' + e.message, 'error');
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
                  '保险箱清单文件为空或无法解析（可能因写入中断/同步冲突损坏）。' +
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

  // ---------- 渲染列表 ----------
  async renderList() {
    if (!this.listContainer) return;
    this.listContainer.innerHTML = '';
    // 保险箱面板只显示普通加密笔记，过滤日记/密码本条目
    //（ADR-0017：日记加密由日记面板单独呈现；密码本由密码本面板单独读写）
    const notes = [...this.dataManager.manifest.notes]
      .filter((n) => n.kind !== 'diary-entry' && n.kind !== 'password-vault')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (notes.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bz-encrypt-empty';
      empty.textContent = '保险箱为空，用「加密当前笔记」把整篇笔记及附件移入';
      this.listContainer.appendChild(empty);
      return;
    }
    for (const note of notes) this.listContainer.appendChild(this.createCard(note));
  }

  createCard(note: SafeNote): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'bz-encrypt-card';
    const top = document.createElement('div');
    top.className = 'bz-encrypt-card-top';
    const titleBox = document.createElement('div');
    titleBox.className = 'bz-encrypt-card-titlebox';
    const title = document.createElement('span');
    title.className = 'bz-encrypt-card-title';
    title.textContent = note.title;
    titleBox.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'bz-encrypt-card-meta';
    meta.textContent = `${formatRelativeTime(note.createdAt)} · ${note.attachments.length} 个附件`;
    top.appendChild(titleBox);
    card.appendChild(top);
    card.appendChild(meta);
    // 手势（用户拍板）：双击 → 预览（原单击改双击防误触）；还原收敛进抽屉
    card.addEventListener('dblclick', () => void this.openPreview(note));
    // 统一抽屉（桌面右键/移动长按）：预览 → 还原
    this.attachDrawerActions(card, note);
    return card;
  }

  /** 卡片挂统一抽屉 + 头部（🔒 标题 · 时间·附件数） */
  private attachDrawerActions(card: HTMLElement, note: SafeNote): void {
    const actions: ItemAction[] = [];

    // 预览（keepOpen：预览窗叠抽屉，关闭预览后可继续还原等操作）
    actions.push({
      icon: 'eye',
      label: '预览',
      keepOpen: true,
      onClick: () => {
        if (this.previewMask) registerSheetCompanion(this.previewMask);
        void this.openPreview(note);
      },
    });

    // 还原（danger：先收抽屉再确认；还原成功即删镜像取出）
    actions.push({
      icon: 'undo-2',
      label: '还原',
      kind: 'danger',
      onClick: () => {
        this.confirmRestore(note);
      },
    });

    attachItemActions(card, actions, { sheetHead: this.buildSheetHead(note) });
  }

  /** 抽屉头部：🔒 + 标题；小字=时间 · 附件数 */
  private buildSheetHead(note: SafeNote): HTMLElement {
    const head = document.createElement('div');
    head.className = 'bz-item-sheet-entry';
    const body = document.createElement('div');
    body.style.cssText = 'display:flex; align-items:flex-start; gap:10px;';

    const emoji = document.createElement('span');
    emoji.className = 'bz-item-sheet-emoji';
    emoji.textContent = '🔒';
    body.appendChild(emoji);

    const info = document.createElement('div');
    info.style.cssText = 'flex:1; min-width:0;';
    const title = document.createElement('div');
    title.className = 'bz-item-sheet-title';
    title.textContent = note.title;
    info.appendChild(title);
    const sub = document.createElement('div');
    sub.className = 'bz-item-sheet-sub';
    sub.textContent = `${formatRelativeTime(note.createdAt)} · ${note.attachments.length} 个附件`;
    info.appendChild(sub);

    body.appendChild(info);
    head.appendChild(body);
    return head;
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
              '笔记与附件已还原到原位置，但保险箱清单保存失败（磁盘异常）；下次解锁后重试还原将自动完成清理',
              'warning'
            );
          } else {
            // 原子还原（优化五）：任一冲突/失败 → 整体未写回，条目保留在保险箱
            finishProgress(h, total, '还原未完成（' + conflicts.length + ' 个目标有冲突）');
            notice(
              '还原中止：' + conflicts.length + ' 个目标被占用或不可用，未写入任何文件，条目保留在保险箱',
              'warning'
            );
          }
          void this.renderList();
        })
        .catch((e: any) => {
          // 失败分支收尾进度通知（ticket 5）：收起常驻转圈，不残留幽灵进度条
          if (h) h.hide();
          notice('还原失败：' + e.message, 'error');
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
    closeBtn.textContent = '❌';
    closeBtn.className = 'bz-encrypt-btn bz-win-close';
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
    // 以下配置项均为启动快照（控制器构造时读取），改动需重载插件后生效——首次改动即提示一次
    let reloadWarned = false;
    const warnReload = () => {
      if (!reloadWarned) {
        reloadWarned = true;
        notice('保险箱设置已保存，重载插件后生效', 'info');
      }
    };
    openSettingsModal({
      title: '保险箱设置',
      maxWidth: 560,
      build: (el) => {
        const s = getSettings() as any;
        // ===== 存储组 =====
        const storeGroup = createSettingsGroup(el, { icon: 'folder-open', name: '存储' });
        // ticket 128：保险箱根目录（统一路径选择器录入，无手输文本框；点前缀目录可选自 CONFIG/.ENCRYPT）
        renderPathSettingRow({
          parent: storeGroup,
          name: '保险箱根目录',
          desc: '加密清单与密文镜像的存放位置，点前缀目录在侧栏隐藏，防止误删',
          mode: 'single',
          value: s.encryptRoot || 'CONFIG/.ENCRYPT',
          onChange: (list) => {
            s.encryptRoot = list[0] || '';
            void saveSettings().then(warnReload);
          },
        });
        // ===== 预览组 =====
        const previewGroup = createSettingsGroup(el, { icon: 'image', name: '预览' });
        new Setting(previewGroup)
          .setName('生成压缩预览')
          .setDesc('加密时生成图片和视频的压缩预览，体积小但足够清晰')
          .addToggle((toggle) =>
            toggle.setValue(!!s.encryptPreviewEnabled).onChange(async (v) => {
              s.encryptPreviewEnabled = v;
              await saveSettings();
              warnReload();
            })
          );
        new Setting(previewGroup)
          .setName('预览长边')
          .setDesc('压缩预览的目标长边像素，默认 384，数值越小打开越快')
          .addText((text) =>
            text.setValue(String(s.encryptPreviewSize || '384')).onChange(async (v) => {
              s.encryptPreviewSize = v;
              await saveSettings();
              warnReload();
            })
          );
        new Setting(previewGroup)
          .setName('预览质量')
          .setDesc('压缩图的 JPEG 质量，默认 0.5，调低更省空间，画质会变模糊')
          .addText((text) =>
            text.setValue(String(s.encryptPreviewQuality || '0.5')).onChange(async (v) => {
              s.encryptPreviewQuality = v;
              await saveSettings();
              warnReload();
            })
          );
        new Setting(previewGroup)
          .setName('预览自动加载原图')
          .setDesc('打开预览自动解密原图替换省略图，默认关闭，省流量和内存')
          .addToggle((toggle) =>
            toggle.setValue(!!s.encryptAutoLoadOriginal).onChange(async (v) => {
              s.encryptAutoLoadOriginal = v;
              await saveSettings();
              warnReload();
            })
          );
        // ===== 安全组 =====
        const securityGroup = createSettingsGroup(el, { icon: 'shield', name: '安全' });
        new Setting(securityGroup)
          .setName('安全模式')
          .setDesc('关闭保险箱面板立即自动上锁')
          .addToggle((toggle) =>
            toggle.setValue(!!s.encryptSecurityMode).onChange(async (v) => {
              s.encryptSecurityMode = v;
              await saveSettings();
              warnReload();
            })
          );
        // ===== 移动端组（仅移动端显示） =====
        if (isMobileEnv()) {
          const mobileGroup = createSettingsGroup(el, { icon: 'smartphone', name: '移动端' });
          new Setting(mobileGroup)
            .setName('移动端默认全屏')
            .setDesc('移动端打开主窗口时默认全屏，关闭则显示常规卡片')
            .addToggle((toggle) =>
              toggle.setValue(!!s.encryptMobileDefaultFullscreen).onChange(async (v) => {
                s.encryptMobileDefaultFullscreen = v;
                await saveSettings();
                warnReload();
              })
            );
        }
      },
    });
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
    this.uiManager = new UIManager(this.dataManager, config);
    this.uiManager.onLockCurrentNote = () => {
      void this.lockCurrentNote();
    };
  }

  /**
   * 状态栏挂载（main.ts onload 调用）：初始为锁定态；订阅解锁态变化刷新，
   * 点击打开保险箱面板（openEncrypt 有解锁引导）。
   */
  attachStatusBar(el: HTMLElement) {
    this.statusBarEl = el;
    this.dataManager.onUnlockChange = (unlocked) => {
      if (this.statusBarEl) this.statusBarEl.textContent = unlocked ? '🔓 保险箱' : '🔒 保险箱';
    };
    this.dataManager.onUnlockChange(this.dataManager.unlocked);
  }

  async init() {
    if (this._initialized) return;
    this.uiManager.ensureElements();
    this._initialized = true;
  }

  /** 打开保险箱主面板 */
  async openManager() {
    if (!this.dataManager.unlocked) {
      const ok = await this.uiManager.showPasswordDialog();
      if (ok) this.uiManager.show();
    } else {
      this.uiManager.show();
    }
  }

  /** 二次确认：正文与附件将移入保险箱（原路径消失），点确认才开始 */
  private async confirmLockProceed(file: { basename: string }, attCount: number): Promise<boolean> {
    return (
      (await openFlowDialog({
        title: '加密到保险箱',
        message: `把「${file.basename}」的正文${attCount ? '与 ' + attCount + ' 个附件' : ''}加密移入保险箱？加密后原笔记与附件将从原路径移出（保险箱内为密文）。`,
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
      if (!this.dataManager.unlocked || !this.dataManager.password) {
        notice('请先打开加密保险箱并解锁');
        return;
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
        // 主动打开加密保险箱面板，展示刚加密的条目（无独立完成 toast，进度通知已显示完成）
        finishProgress(h, attachments.length + 1, '加密完成');
        this.uiManager.show();
      } catch (e: any) {
        // 失败分支收尾进度通知（ticket 5）：收起常驻转圈，不残留幽灵进度条；错误另由 error toast 明示
        if (h) h.hide();
        notice('加密失败：' + e.message, 'error');
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