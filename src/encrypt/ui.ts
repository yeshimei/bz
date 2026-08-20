/**
 * 加密保险箱 UI（encrypt 域）
 * 主面板（备忘录样式）：标题「加密保险箱」+ 列表 + 锁定/预览/设置。
 * 解锁弹窗（复用密码本 showPasswordDialog 范式）；预览窗（独立只读弹窗，Markdown 渲染 + 图片/视频压缩预览）。
 * 协调层：加锁当前笔记（含预览生成）、真还原、收回全部。
 */
import { Setting, MarkdownRenderer, Component } from 'obsidian';
import { notice, notify } from '../core/notice';
import type { NoticeHandle } from '../core/notice';
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { confirm } from '../core/confirm';
import { createIconBtn, createOverlay } from '../core/dom';
import { formatRelativeTime } from '../core/utils';
import { getSettings, saveSettings } from '../core/settings-provider';
import { openSettingsModal } from '../core/settings-modal';
import { SafeManager, type SafeNote, type SafeAttachment } from './data';
import { compressImage, videoFrame } from './preview';

export interface EncryptUIConfig {
  root: string;
  previewEnabled: boolean;
  previewSize: number;
  previewQuality: number;
  securityMode: boolean;
}

/** 收集当前打开笔记的双链图片/视频附件路径（纯函数，只读，便于单测） */
export function collectNoteAttachments(content: string, vaultFiles: { path: string }[]): string[] {
  const refs = new Set<string>();
  // wikilink 嵌入 ![[x.png]] / ![[x.png|alt]]（图片/视频附件）
  const wiki = /!\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = wiki.exec(content)) !== null) refs.add(m[1].trim());
  // markdown 图片 ![](x.png) / 本地视频 <video src="x.mp4">
  const mdImg = /!\[[^\]]*\]\(([^)\s]+)\)/g;
  while ((m = mdImg.exec(content)) !== null) refs.add(m[1].trim());
  const vid = /<video[^>]*src=["']([^"']+)["']/g;
  while ((m = vid.exec(content)) !== null) refs.add(m[1].trim());
  const valid = new Set<string>();
  for (const r of refs) {
    if (!r) continue;
    const clean = decodeURIComponent(r).replace(/^\.\//, '');
    const hit = vaultFiles.find((f) => f.path === clean || f.path.endsWith('/' + clean));
    if (hit) valid.add(hit.path);
  }
  return [...valid];
}

/** 判断附件类型（按扩展名） */
export function kindOf(path: string): 'image' | 'video' {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return /^(mp4|webm|mov|mkv|avi|m4v|ogv)$/.test(ext) ? 'video' : 'image';
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

/** 附件预览媒体 HTML（有预览 → <img>；无/失败 → 占位提示真还原查看原图） */
export function mediaHtml(a: SafeAttachment | null | undefined, dataUrl: string | null | undefined): string {
  if (!a) return '';
  const alt = (a.path || '').replace(/"/g, '&quot;');
  if (dataUrl) {
    return `<img class="bz-encrypt-preview-media" src="${dataUrl}" alt="${alt}" loading="lazy">`;
  }
  return `<div class="bz-encrypt-preview-missing" title="${alt}">
      <span class="bz-encrypt-preview-missing-name">${alt}</span>
      <span>${a.kind === 'video' ? '视频抽帧预览不可用' : '无压缩预览'}，用「真还原」查看原图</span>
    </div>`;
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

/** 更新进度通知：左「已处理 N/总数」右「当前文件名」 */
export function updateProgress(h: NoticeHandle | null, done: number, total: number, current: string) {
  if (!h) return;
  const base = `已处理 ${done}/${total}`;
  const name = current.split('/').pop() || current;
  h.setMessage(`${base} · 当前：${name}`);
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
  // DOM
  mask: HTMLDivElement | null = null;
  popup: HTMLDivElement | null = null;
  listContainer: HTMLDivElement | null = null;
  previewMask: HTMLDivElement | null = null;
  previewPopup: HTMLDivElement | null = null;
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
    if (window.innerWidth <= 768) {
      this.popup.style.top = '0';
      this.popup.style.left = '0';
      this.popup.style.transform = 'none';
      this.popup.style.width = '100%';
      this.popup.style.maxWidth = '100%';
      this.popup.style.maxHeight = '100vh';
      this.popup.style.height = '100vh';
      this.popup.style.borderRadius = '0';
      this.popup.style.paddingTop = '34px';
    }
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
    popup.style.width = '90%';
    popup.style.maxWidth = '700px';
    popup.style.maxHeight = '80vh';
    popup.style.display = 'none';
    return popup;
  }

  createHeader(): HTMLDivElement {
    const header = document.createElement('div');
    header.className = 'bz-encrypt-head';
    const title = document.createElement('h3');
    title.textContent = '加密保险箱';
    const btns = document.createElement('div');
    btns.className = 'bz-encrypt-head-btns';
    const lockBtn = createIconBtn('🔐', '收回全部（加锁）', () => this.collectAll());
    const previewBtn = createIconBtn('👁', '预览模式', () => notice('点击条目上的「预览」打开独立预览窗'));
    const settingsBtn = createIconBtn('⚙️', '加密保险箱设置', () => this.openSettings());
    const closeBtn = createIconBtn('❌', '关闭', () => this.hide());
    btns.appendChild(lockBtn);
    btns.appendChild(previewBtn);
    btns.appendChild(settingsBtn);
    btns.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(btns);
    return header;
  }

  // ---------- 显示/隐藏 ----------
  show() {
    if (!this._initialized) this.ensureElements();
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
  showPasswordDialog(): Promise<boolean> {
    return new Promise((resolve) => {
      const mask = document.createElement('div');
      mask.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:10070;display:flex;align-items:center;justify-content:center;';
      const box = document.createElement('div');
      box.style.cssText = 'background:var(--background-primary);border-radius:12px;padding:28px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);';
      const title = document.createElement('h4');
      title.style.cssText = 'margin:0 0 12px 0;font-size:18px;font-weight:600;';
      const message = document.createElement('p');
      message.style.cssText = 'margin:0 0 16px 0;font-size:14px;color:var(--text-muted);';
      const input = document.createElement('input');
      input.type = 'password';
      input.placeholder = '输入主密码';
      input.style.cssText = 'width:100%;padding:8px 12px;border-radius:6px;font-size:14px;box-sizing:border-box;margin-bottom:12px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);';
      const input2 = document.createElement('input');
      input2.type = 'password';
      input2.placeholder = '再次输入';
      input2.style.cssText = 'width:100%;padding:8px 12px;border-radius:6px;font-size:14px;box-sizing:border-box;margin-bottom:16px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);display:none;';
      const warning = document.createElement('div');
      warning.style.cssText = 'background:#ffecb0;color:#8a6d3b;padding:10px 12px;border-radius:6px;margin-bottom:16px;font-size:14px;border:1px solid #f5c842;display:none;';
      warning.innerHTML = '<strong>⚠️ 重要提醒</strong><br>• 主密码 <b>不会存储</b>，也无法找回，请务必牢记！<br>• 若遗忘密码，加密笔记及其附件将永久丢失。<br>• 建议使用密码本（如 Bitwarden）保存此密码。';
      const btnContainer = document.createElement('div');
      btnContainer.style.cssText = 'display:flex;gap:12px;justify-content:flex-end;';
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = '取消';
      cancelBtn.style.cssText = 'padding:8px 16px;border-radius:6px;border:none;background:var(--background-secondary);cursor:pointer;font-size:14px;';
      cancelBtn.onclick = () => { document.body.removeChild(mask); resolve(false); };
      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = '确认';
      confirmBtn.style.cssText = 'padding:8px 16px;border-radius:6px;border:none;background:var(--interactive-accent);color:var(--text-on-accent);cursor:pointer;font-size:14px;font-weight:500;';
      confirmBtn.onclick = async () => {
        const pw = input.value;
        if (!pw) { notice('请输入密码'); return; }
        const exists = this.dataManager.exists();
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
              await this.dataManager.unlock(pw);
              document.body.removeChild(mask);
              resolve(true);
              notice('密码已设置，数据已加密', 'success');
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
            notice('密码错误，请重试', 'error');
            input.value = '';
            input.focus();
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
      (async () => {
        if (this.dataManager.exists()) {
          title.textContent = '输入主密码';
          message.textContent = '请输入您设置的主密码以解锁加密保险箱';
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
      })();
    });
  }

  // ---------- 渲染列表 ----------
  async renderList() {
    if (!this.listContainer) return;
    this.listContainer.innerHTML = '';
    const notes = [...this.dataManager.manifest.notes].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
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
    card.className = 'bz-encrypt-card' + (note.restored ? ' bz-encrypt-card--restored' : '');
    const top = document.createElement('div');
    top.className = 'bz-encrypt-card-top';
    const titleBox = document.createElement('div');
    titleBox.className = 'bz-encrypt-card-titlebox';
    const title = document.createElement('span');
    title.className = 'bz-encrypt-card-title';
    title.textContent = note.title;
    const badge = document.createElement('span');
    badge.className = 'bz-encrypt-badge' + (note.restored ? ' bz-encrypt-badge--restored' : '');
    badge.textContent = note.restored ? '已还原·待收回' : '已入库';
    titleBox.appendChild(title);
    titleBox.appendChild(badge);
    const meta = document.createElement('div');
    meta.className = 'bz-encrypt-card-meta';
    meta.textContent = `${formatRelativeTime(note.createdAt)} · ${note.attachments.length} 个附件`;
    const actions = document.createElement('div');
    actions.className = 'bz-encrypt-card-actions';
    if (note.attachments.length > 0 || note.hasSummary) {
      const previewBtn = document.createElement('button');
      previewBtn.textContent = '预览';
      previewBtn.className = 'bz-encrypt-btn';
      previewBtn.onclick = (e) => { e.stopPropagation(); void this.openPreview(note); };
      actions.appendChild(previewBtn);
    }
    const restoreBtn = document.createElement('button');
    restoreBtn.textContent = note.restored ? '已还原' : '真还原';
    restoreBtn.className = 'bz-encrypt-btn bz-encrypt-btn--primary';
    restoreBtn.disabled = note.restored;
    restoreBtn.onclick = (e) => {
      e.stopPropagation();
      if (note.restored) return;
      void this.confirmRestore(note);
    };
    actions.appendChild(restoreBtn);
    top.appendChild(titleBox);
    top.appendChild(actions);
    card.appendChild(top);
    card.appendChild(meta);
    // 主要动作均在卡片按钮；预览/还原不误触
    return card;
  }

  confirmRestore(note: SafeNote) {
    confirm({
      title: '真还原',
      message: `将「${note.title}」的原文${note.attachments.length ? '与 ' + note.attachments.length + ' 个原质量附件' : ''}还原到原路径。`,
      confirmText: '真还原',
      onConfirm: () => {
        const h = progressNotify('还原 ' + note.title);
        void this.dataManager
          .restoreNote(note.id, (p) => updateProgress(h, p.done, p.total, p.current))
          .then(({ conflicts }) => {
            const total = note.attachments.length + 1;
            if (conflicts.length) {
              finishProgress(h, total, '还原完成（' + conflicts.length + ' 个冲突未覆盖）');
              notice('还原冲突 ' + conflicts.length + ' 个（未覆盖同名文件）', 'warning');
            } else {
              finishProgress(h, total, '已还原');
              notice('已还原「' + note.title + '」', 'success');
            }
            this.openRestoredNote(note);
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
  async openPreview(note: SafeNote) {
    if (!this.previewPopup) this.ensureElements();
    if (!this.dataManager.unlocked || !this.dataManager.password) return;
    this.previewPopup!.innerHTML = '';
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
    this.previewPopup!.appendChild(header);
    const body = document.createElement('div');
    body.className = 'bz-encrypt-preview-body';

    try {
      const plain = await this.dataManager.decryptText(note.content);
      // 先把嵌入改写占位 token（按文档顺序混排），渲染后再原位替换为预览图
      const { text, slots, inlined } = collectMediaSlots(plain, note.attachments);
      // 预先解密所有附件的预览层（每个只解一次；嵌入与底部画廊共用）
      const dataUrls = new Map<string, string>();
      for (const a of note.attachments) {
        if (!a.hasPreview || dataUrls.has(a.path)) continue;
        let du = '';
        try {
          du = (await this.dataManager.decryptPreview(a)) || '';
        } catch (e) {
          du = '';
        }
        dataUrls.set(a.path, du);
      }
      // Markdown 渲染（占位 token 原样保留）
      const mdEl = document.createElement('div');
      mdEl.className = 'bz-encrypt-preview-md';
      let rendered = false;
      try {
        await MarkdownRenderer.render(getApp(), text, mdEl, note.path, new Component());
        rendered = true;
      } catch (e) {
        mdEl.textContent = plain;
      }
      if (rendered) {
        // 原位替换 token → 预览图，实现图随文走
        let html = mdEl.innerHTML;
        for (const slot of slots) {
          const a = slot.attachment;
          if (a) html = html.split(slot.token).join(mediaHtml(a, dataUrls.get(a.path)));
          else html = html.split(slot.token).join('');
        }
        mdEl.innerHTML = html;
      }
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
    } catch (e) {
      const err = document.createElement('div');
      err.textContent = '正文解密失败';
      body.appendChild(err);
    }

    this.previewPopup!.appendChild(body);
    this.previewMask!.style.display = 'block';
    this.previewPopup!.style.display = 'flex';
  }

  closePreview() {
    if (this.previewMask) this.previewMask.style.display = 'none';
    if (this.previewPopup) this.previewPopup.style.display = 'none';
  }

  // ---------- 设置弹窗 ----------
  openSettings() {
    openSettingsModal({
      title: '加密保险箱设置',
      build: (el) => {
        const s = getSettings() as any;
        new Setting(el)
          .setName('保险箱根目录')
          .setDesc('加密清单与附件密文镜像的存放目录')
          .addText((text) =>
            text.setValue(s.encryptRoot || 'CONFIG/ENCRYPT').onChange(async (v) => {
              s.encryptRoot = v;
              await saveSettings();
            })
          );
        new Setting(el)
          .setName('生成压缩预览')
          .setDesc('加密时生成图片/视频压缩预览层（体积小但看得清）')
          .addToggle((toggle) =>
            toggle.setValue(!!s.encryptPreviewEnabled).onChange(async (v) => {
              s.encryptPreviewEnabled = v;
              await saveSettings();
            })
          );
        new Setting(el)
          .setName('预览目标长边（px）')
          .setDesc('压缩/抽帧预览的目标分辨率长边')
          .addText((text) =>
            text.setValue(String(s.encryptPreviewSize || '960')).onChange(async (v) => {
              s.encryptPreviewSize = v;
              await saveSettings();
            })
          );
        new Setting(el)
          .setName('预览质量')
          .setDesc('JPEG 压缩质量 0-1')
          .addText((text) =>
            text.setValue(String(s.encryptPreviewQuality || '0.7')).onChange(async (v) => {
              s.encryptPreviewQuality = v;
              await saveSettings();
            })
          );
        new Setting(el)
          .setName('安全模式')
          .setDesc('关闭保险箱面板立即自动上锁')
          .addToggle((toggle) =>
            toggle.setValue(!!s.encryptSecurityMode).onChange(async (v) => {
              s.encryptSecurityMode = v;
              await saveSettings();
            })
          );
      },
    });
  }

  // ---------- 协调：收回全部 ----------
  collectAll() {
    const pending = this.dataManager.manifest.notes.filter((n) => n.restored);
    if (pending.length === 0) {
      notice('没有待收回的已还原笔记');
      return;
    }
    confirm({
      title: '收回全部',
      message: `把 ${pending.length} 篇已还原笔记及其附件重新加密入库？`,
      confirmText: '收回',
      onConfirm: () => {
        void (async () => {
          for (const n of pending) {
            await this.dataManager.collectNote(n.id);
          }
          notice('已收回 ' + pending.length + ' 篇', 'success');
          void this.renderList();
        })().catch((e: any) => notice('收回失败：' + e.message, 'error'));
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

  constructor(config: EncryptUIConfig) {
    this.config = config;
    this.dataManager = new SafeManager(config.root);
    this.uiManager = new UIManager(this.dataManager, config);
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

  /** 加锁当前打开笔记（正文 + 双链图片/视频附件） */
  async lockCurrentNote() {
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
    const vaultFiles: { path: string }[] = (app.vault.getFiles && app.vault.getFiles()) || [];
    const attPaths = collectNoteAttachments(content, vaultFiles);
    const attachments: any[] = [];
    const size = this.config.previewSize || 960;
    const quality = this.config.previewQuality || 0.7;
    for (const p of attPaths) {
      try {
        const f = app.vault.getAbstractFileByPath(p);
        if (!f) continue;
        const buf = await app.vault.readBinary(f as any);
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const data = btoa(bin);
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
      } catch (e) {
        /* 附件读取失败跳过该附件 */
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
        (p) => updateProgress(h, p.done, p.total, p.current)
      );
      const total = attachments.length + 1;
      finishProgress(h, total, '已加密');
      notice('已加密「' + file.basename + '」及其 ' + attachments.length + ' 个附件', 'success');
      void this.uiManager.renderList();
    } catch (e: any) {
      notice('加密失败：' + e.message, 'error');
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