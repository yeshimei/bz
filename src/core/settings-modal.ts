/**
 * 通用设置弹窗（ADR-0009 域设置弹窗）：各功能主面板右上角 ⚙️ 打开的功能专属设置弹窗。
 * 单例管理：同一时刻至多一个设置弹窗；重复调用先关闭旧弹窗（toggle 语义）。
 * 结构：mask + popup（标题栏 + 可滚动设置区），点击遮罩 / Esc 关闭（不放右上角关闭按钮）。
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
  /**
   * 关闭回调：遮罩点击 / Esc / 被新弹窗顶替时触发（dispose 后调用一次）。
   * 域内用它复位打开时置位的状态（如 smartcat 的交互锁——否则移动端长按开设置
   * 再关闭后，isSettingsOpen 卡在 true，拖拽永久失效）。
   */
  onClose?: () => void;
}

let currentModal: { mask: HTMLElement; popup: HTMLElement; dispose: () => void; onClose?: () => void } | null = null;

/** 关闭当前设置弹窗（无则静默）；触发该弹窗的 onClose（至多一次） */
export function closeSettingsModal(): void {
  if (currentModal) {
    const m = currentModal;
    currentModal = null;
    m.dispose();
    m.onClose?.();
  }
}

/** 打开域设置弹窗（幂等：已开先关） */
export function openSettingsModal(opts: SettingsModalOptions): void {
  closeSettingsModal();

  const { mask, popup } = createOverlay({
    maskId: 'bz-settings-modal-mask',
    popupId: 'bz-settings-modal-popup',
    // 高于所有面板与面板内弹窗（主面板 9999/弹窗 10001-10005/闪念窄窗 10020），低于入口页 10100
    zIndex: 10050,
    onMaskClick: () => closeSettingsModal(),
  });

  const header = document.createElement('div');
  header.className = 'bz-settings-header';
  const title = document.createElement('h3');
  title.className = 'bz-settings-title';
  title.textContent = opts.title;
  // 不放右上角关闭按钮（用户拍板 2026-08：弹窗不放关闭按钮，靠遮罩 + ESC，与主窗口规范一致）
  header.appendChild(title);

  const content = document.createElement('div');
  content.className = 'bz-settings-content';

  opts.build(content);

  // 空态：build 未挂任何设置项（归物本/收藏本）
  if (!content.querySelector('.setting-item')) {
    content.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'bz-settings-empty';
    empty.textContent = opts.emptyText || '暂无设置项';
    if (opts.emptyDesc) {
      const desc = document.createElement('div');
      desc.className = 'bz-settings-empty-desc';
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
    onClose: opts.onClose,
    dispose: () => {
      mask.remove();
      popup.remove();
      handle.unregister();
    },
  };
}
