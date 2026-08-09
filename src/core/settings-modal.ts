/**
 * 通用设置弹窗（ADR-0009 域设置弹窗）：各功能主面板右上角 ⚙️ 打开的功能专属设置弹窗。
 * 单例管理：同一时刻至多一个设置弹窗；重复调用先关闭旧弹窗（toggle 语义）。
 * 结构：mask + popup（标题栏 + 可滚动设置区），点击遮罩 / ✕ / Esc 关闭。
 * build 回调内用 obsidian Setting 挂设置项；未挂任何 .setting-item 时显示空态。
 */
import { Setting } from 'obsidian';
import { createOverlay } from './dom';
import { escManager } from './esc-manager';

export interface SettingsModalOptions {
  /** 弹窗标题，如「书库设置」 */
  title: string;
  /** 设置项构建回调：在滚动内容区挂 Setting（可多次调用） */
  build: (el: HTMLElement) => void;
  /** 空态主文案（无设置项时显示；归物本/收藏本用） */
  emptyText?: string;
  /** 空态二级说明 */
  emptyDesc?: string;
}

let currentModal: { mask: HTMLElement; popup: HTMLElement; dispose: () => void } | null = null;

/** 设置弹窗样式：移动端（≤768px）字号层级——分组标题调大 / 设置项标题调小 / 简介更小（用户决策 2026-08-09） */
const SETTINGS_MODAL_CSS = `
@media (max-width: 768px) {
    #bz-settings-modal-popup .setting-item-heading .setting-item-name {
        font-size: 17px;
        font-weight: 600;
    }
    #bz-settings-modal-popup .setting-item-name {
        font-size: 14px;
    }
    #bz-settings-modal-popup .setting-item-description {
        font-size: 12px;
    }
}
`;

/** 幂等注入设置弹窗样式 */
function injectSettingsModalStyles(): void {
  if (document.querySelector('style[data-settings-modal-styles]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-settings-modal-styles', '');
  style.textContent = SETTINGS_MODAL_CSS;
  document.head.appendChild(style);
}

/** 关闭当前设置弹窗（无则静默） */
export function closeSettingsModal(): void {
  if (currentModal) {
    currentModal.dispose();
    currentModal = null;
  }
}

/** 打开域设置弹窗（幂等：已开先关） */
export function openSettingsModal(opts: SettingsModalOptions): void {
  closeSettingsModal();
  injectSettingsModalStyles();

  const { mask, popup } = createOverlay({
    maskId: 'bz-settings-modal-mask',
    popupId: 'bz-settings-modal-popup',
    // 高于所有面板与面板内弹窗（主面板 9999/弹窗 10001-10005/闪念窄窗 10020），低于入口页 10100
    zIndex: 10030,
    onMaskClick: () => closeSettingsModal(),
  });

  const header = document.createElement('div');
  header.style.cssText =
    'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;' +
    'border-bottom:1px solid var(--background-modifier-border);flex-shrink:0;';
  const title = document.createElement('h3');
  title.style.cssText = 'margin:0;font-size:16px;font-weight:600;color:var(--text-normal);';
  title.textContent = opts.title;
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText =
    'background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text-muted);padding:0 4px;';
  closeBtn.addEventListener('click', () => closeSettingsModal());
  header.appendChild(title);
  header.appendChild(closeBtn);

  const content = document.createElement('div');
  content.style.cssText = 'padding:12px 16px 16px;max-height:65vh;overflow-y:auto;';

  opts.build(content);

  // 空态：build 未挂任何设置项（归物本/收藏本）
  if (!content.querySelector('.setting-item')) {
    content.innerHTML = '';
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:28px 12px;text-align:center;color:var(--text-faint);font-size:14px;';
    empty.textContent = opts.emptyText || '暂无设置项';
    if (opts.emptyDesc) {
      const desc = document.createElement('div');
      desc.style.cssText = 'margin-top:6px;font-size:12px;color:var(--text-muted);';
      desc.textContent = opts.emptyDesc;
      empty.appendChild(desc);
    }
    content.appendChild(empty);
  }

  popup.appendChild(header);
  popup.appendChild(content);
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';

  const handle = escManager.register('bz-settings-modal', {
    isVisible: () => !!currentModal,
    close: () => closeSettingsModal(),
  });
  currentModal = {
    mask,
    popup,
    dispose: () => {
      mask.remove();
      popup.remove();
      handle.unregister();
    },
  };
}
