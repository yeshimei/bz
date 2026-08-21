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
import { confirm } from '../core/confirm';
import { createIconBtn, createOverlay, longPress } from '../core/dom';
import { escapeHtml, formatRelativeTime } from '../core/utils';
import { getSettings, tryGetSettings, saveSettings } from '../core/settings-provider';
import { openSettingsModal } from '../core/settings-modal';
import { isMobileEnv, applyMobileWindowFullscreen } from '../core/mobile';
import { SafeManager, base64ToBytes, bytesToBase64, type SafeNote, type SafeAttachment } from './data';
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
export function mediaHtml(a: SafeAttachment | null | undefined, dataUrl: string | null | undefined): string {
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
export function progressNotify(title: string): NoticeHandle | null {
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
export function updateProgress(h: NoticeHandle | null, done: number, total: number, current: string) {
  if (!h) return;
  const base = `已处理 ${done}/${total}`;
  h.setMessage(`${base} · 当前：${truncateName(current)}`);
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0;
  h.setProgress(pct);
}

/** 完成进度通知：转成功态并收起 */
export function finishProgress(h: NoticeHandle | null, done: number, msg: string) {
  if (!h) return;
  h.setMessage(`${msg}（${done} 个文件）`);
  h.setType('success');
}



export class UIManager {
  dataManager: SafeManager;
  config: EncryptUIConfig;
  /** 顶部「加密当前笔记」按钮回调（由 Controller 注入，调 lockCurrentNote） */
  onLockCurrentNote: (() => void) | null = null;
  /** 顶部「清理未引用的密文」按钮回调（由 Controller 注入，调 cleanupOrphans；Q5-A 手动触发） */
  onCleanupOrphans: (() => void) | null = null;
  // DOM
  mask: HTMLDivElement | null = null;
  popup: HTMLDivElement | null = null;
  listContainer: HTMLDivElement | null = null;
  previewMask: HTMLDivElement | null = null;
  previewPopup: HTMLDivElement | null = null;
  /** 缩略图按需加载产生的 Blob URL（预览窗关闭时统一 revoke，防泄漏） */
  private _previewUrls: string[] = [];
  _initialized = false;

  constructor(dataManager: SafeManager, config: EncryptUIConfig) {
    this.dataManager = dataManager;
    this.config = config;
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
    const ov = createOverlay({ maskId: 'bz-encrypt-preview-mask', popupId: 'bz-encrypt-preview-popup', zIndex: 10060, maxWidth: 640 });
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
    const cleanupBtn = createIconBtn('🧹', '清理未引用的密文', () => this.onCleanupOrphans?.());
    const closeBtn = createIconBtn('❌', '关闭', () => this.hide());
    if (this.onLockCurrentNote) btns.appendChild(lockBtn);
    btns.appendChild(settingsBtn);
    btns.appendChild(cleanupBtn);
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
      if (exists) {
        title.textContent = '输入主密码';
        message.textContent = '请输入您设置的主密码以解锁保险箱';
        input2.style.display = 'none';
        warning.style.display = 'none';
      } else {
        title.textContent = '设置主密码';
        message.textContent = '请设置一个主密码（用于加密所有数据）';
        input2.style.display = 'block';
        input2.placeholder = '再次输入';
        warning.style.display = 'block';
      }
      input.focus();
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
            input2.focus();
            message.textContent = '请再次输入主密码确认';
            return;
          } else {
            if (pw !== input2.value) { notice('两次密码不一致'); return; }
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
          const success = await this.dataManager.unlock(pw);
          if (success) {
            document.body.removeChild(mask);
            resolve(true);
            notice('解锁成功', 'success');
          } else {
            // 区分「清单损坏」与「密码错误」：损坏必须显式确认后才能重设，绝不静默
            const issue = this.dataManager.manifestIssue;
            if (issue === 'empty' || issue === 'corrupt') {
              confirm({
                title: '清单疑似损坏',
                message:
                  '保险箱清单文件为空或无法解析（可能因写入中断/同步冲突损坏）。' +
                  '重设主密码将生成全新空清单，旧加密数据将永久无法恢复。确定重设吗？',
                confirmText: '仍要重设',
                cancelText: '暂不重设',
                onConfirm: () => {
                  void this.dataManager.unlock(pw, true).then((ok) => {
                    if (ok) {
                      document.body.removeChild(mask);
                      resolve(true);
                      notice('已重设主密码（旧数据不可恢复）', 'warning');
                    } else {
                      notice('重设失败：无法写入清单', 'error');
                    }
                  });
                },
                onCancel: () => {
                  notice('未重设：请先检查或备份数据文件', 'warning');
                },
              });
            } else {
              notice('密码错误，请重试', 'error');
              input.value = '';
              input.focus();
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
      box.appendChild(message);
      box.appendChild(input);
      box.appendChild(input2);
      box.appendChild(btnContainer);
      mask.appendChild(box);
      document.body.appendChild(mask);
    });
  }

  // ---------- 渲染列表 ----------
  async renderList() {
    if (!this.listContainer) return;
    this.listContainer.innerHTML = '';
    // 保险箱面板只显示普通加密笔记，过滤日记加密条目（ADR-0017：日记加密由日记面板单独呈现）
    const notes = [...this.dataManager.manifest.notes]
      .filter((n) => n.kind !== 'diary-entry')
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
    // 手势触发（同其他面板）：单击 → 打开预览；长按 → 弹确认还原
    card.addEventListener('click', () => void this.openPreview(note));
    longPress(card, () => this.confirmRestore(note));
    return card;
  }

  confirmRestore(note: SafeNote) {
    confirm({
      title: '还原',
      message: `将「${note.title}」的原文${note.attachments.length ? '与 ' + note.attachments.length + ' 个原质量附件' : ''}还原到原路径？`,
      confirmText: '还原',
      onConfirm: () => {
        const h = progressNotify('还原 ' + note.title);
        void this.dataManager
          .restoreNote(note.id, (p) => updateProgress(h, p.done, p.total, p.current))
          .then(({ conflicts, removed }) => {
            const total = note.attachments.length + 1;
            if (removed) {
              // 取出即删：进度通知内直接显示完成；随后跳转笔记并关闭面板
              finishProgress(h, total, '还原完成');
              this.hide();
              this.openRestoredNote(note);
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
          .catch((e: any) => notice('还原失败：' + e.message, 'error'));
      },
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
    closeBtn.textContent = '✕';
    closeBtn.className = 'bz-encrypt-btn';
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
      build: (el) => {
        const s = getSettings() as any;
        new Setting(el)
          .setName('保险箱根目录')
          .setDesc('加密清单与点前缀密文镜像的存放目录（点前缀目录在 Obsidian 侧栏隐藏，防误删）')
          .addText((text) =>
            text.setValue(s.encryptRoot || 'CONFIG/.ENCRYPT').onChange(async (v) => {
              s.encryptRoot = v;
              await saveSettings();
              warnReload();
            })
          );
        new Setting(el)
          .setName('生成压缩预览')
          .setDesc('加密时生成图片/视频压缩预览层（体积小但看得清）')
          .addToggle((toggle) =>
            toggle.setValue(!!s.encryptPreviewEnabled).onChange(async (v) => {
              s.encryptPreviewEnabled = v;
              await saveSettings();
              warnReload();
            })
          );
        new Setting(el)
          .setName('预览目标长边（px）')
          .setDesc('压缩/抽帧预览（省略图）的目标分辨率长边，越小预览打开越快；点击缩略图可加载原图/视频')
          .addText((text) =>
            text.setValue(String(s.encryptPreviewSize || '384')).onChange(async (v) => {
              s.encryptPreviewSize = v;
              await saveSettings();
              warnReload();
            })
          );
        new Setting(el)
          .setName('预览质量')
          .setDesc('JPEG 压缩质量 0-1，模糊可接受时调低更省空间')
          .addText((text) =>
            text.setValue(String(s.encryptPreviewQuality || '0.5')).onChange(async (v) => {
              s.encryptPreviewQuality = v;
              await saveSettings();
              warnReload();
            })
          );
        new Setting(el)
          .setName('预览自动加载原图')
          .setDesc('预览窗打开后自动解密原始质量替换省略图（默认关，省流量/内存；开启后为每个附件逐个加载，视频同样替换为可播放）')
          .addToggle((toggle) =>
            toggle.setValue(!!s.encryptAutoLoadOriginal).onChange(async (v) => {
              s.encryptAutoLoadOriginal = v;
              await saveSettings();
              warnReload();
            })
          );
        new Setting(el)
          .setName('安全模式')
          .setDesc('关闭保险箱面板立即自动上锁')
          .addToggle((toggle) =>
            toggle.setValue(!!s.encryptSecurityMode).onChange(async (v) => {
              s.encryptSecurityMode = v;
              await saveSettings();
              warnReload();
            })
          );
        if (isMobileEnv()) {
          new Setting(el)
            .setName('移动端默认全屏')
            .setDesc('移动端打开主窗口时默认全屏显示（≤768px；关=常规卡）')
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

  constructor(config: EncryptUIConfig) {
    this.config = config;
    this.dataManager = new SafeManager(config.root);
    this.uiManager = new UIManager(this.dataManager, config);
    this.uiManager.onLockCurrentNote = () => {
      void this.lockCurrentNote();
    };
    this.uiManager.onCleanupOrphans = () => {
      void this.cleanupOrphans();
    };
  }

  /** 手动清理无引用密文（Q5-A：不自动触发，点按钮才跑）+ 过期暂存残留 */
  async cleanupOrphans() {
    try {
      const removed = await this.dataManager.cleanupOrphans();
      if (removed > 0) notice(`已删除 ${removed} 个无引用的密文文件`, 'success');
      else notice('没有需要清理的无引用密文', 'success');
    } catch (e: any) {
      notice('清理失败：' + e.message, 'error');
    }
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
    // 二次确认：正文与附件将移入保险箱（原路径消失），点确认才开始
    const proceed = await new Promise<boolean>((resolve) => {
      confirm({
        title: '加密到保险箱',
        message: `把「${file.basename}」的正文${attPaths.length ? '与 ' + attPaths.length + ' 个附件' : ''}加密移入保险箱？加密后原笔记与附件将从原路径移出（保险箱内为密文）。`,
        confirmText: '加密',
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!proceed) return;

    const attachments: any[] = [];
    // 省略图固定档（无设置项）：长边 256 / 质量 0.45，预览只要看得清，点击缩略图加载原始质量
    const size = this.config.previewSize || 384;
    const quality = this.config.previewQuality || 0.5;
    // Q3-A：任一附件读取失败 → 整笔放弃（不落任何东西、原文件不动）；预览失败不算失败（可选增强）
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
        return;
      }
    }
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
      const total = attachments.length + 1;
      finishProgress(h, total, '加密完成');
      this.uiManager.show();
    } catch (e: any) {
      notice('加密失败：' + e.message, 'error');
    }
    } finally {
      this._locking = false;
    }
  }

  /** 卸载清理 */
  cleanup() {
    const ids = ['bz-encrypt-mask', 'bz-encrypt-popup', 'bz-encrypt-preview-mask', 'bz-encrypt-preview-popup'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
    this.uiManager.mask = null;
    this.uiManager.popup = null;
    this.uiManager.previewMask = null;
    this.uiManager.previewPopup = null;
    this.uiManager._initialized = false;
    this.dataManager.lock();
  }
}