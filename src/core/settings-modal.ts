/**
 * 通用设置弹窗（ADR-0009 域设置弹窗）：各功能主面板右上角 ⚙️ 打开的功能专属设置弹窗。
 * 单例管理：同一时刻至多一个设置弹窗；重复调用先关闭旧弹窗（toggle 语义）。
 * 结构：mask + popup（标题栏 + 可滚动设置区），点击遮罩 / Esc 关闭（不放右上角关闭按钮）。
 * build 回调内用 obsidian Setting 挂设置项；未挂任何 .setting-item 时显示空态。
 * 重设计（2026-08 用户拍板方案 A 分组卡片）：build 内可用 createSettingsGroup 建
 * 「分组卡片」（原生图标+组名+项数徽标头 + 设置项体）；弹窗打开后徽标自动回填。
 * 焦点管理（UX 整改 37）：打开聚焦弹窗内首个可交互设置项（跳过隐藏项；
 * 移动端再跳过 input/textarea，避免弹软键盘遮挡并聚焦到按钮/开关/下拉），
 * 关闭（遮罩/Esc/被顶替）还原焦点到触发元素；popup 挂 role="dialog" aria-modal="true"。
 */
import { Setting, setIcon } from 'obsidian';
import { createOverlay } from './dom';
import { escManager } from './esc-manager';
import { isMobileEnv } from './mobile';

/** 弹窗内可交互元素选择器（读屏/焦点管理的通用口径） */
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface SettingsModalOptions {
  /** 弹窗标题，如「书库设置」 */
  title: string;
  /** 设置项构建回调：在滚动内容区挂 Setting（可多次调用） */
  build: (el: HTMLElement) => void;
  /** 空态主文案（无设置项时显示；归物本/收藏本用） */
  emptyText?: string;
  /** 空态二级说明 */
  emptyDesc?: string;
  /** 弹窗最大宽度 px（默认 400；分组卡片方案建议 520 更透气） */
  maxWidth?: number;
  /**
   * 关闭回调：遮罩点击 / Esc / 被新弹窗顶替时触发（dispose 后调用一次）。
   * 域内用它复位打开时置位的状态（如 smartcat 的交互锁——否则移动端长按开设置
   * 再关闭后，isSettingsOpen 卡在 true，拖拽永久失效）。
   */
  onClose?: () => void;
}

/** 建「分组卡片」：head（原生图标+组名+项数徽标）+ body（挂 Setting），返回 body。
 *  icon 为 lucide 原生图标名（setIcon 渲染，如 folder-open/eye/monitor/smartphone）。
 *  项数徽标由 openSettingsModal 在 build 后统一回填（隐藏项不计）；
 *  动态显隐后可调 refreshSettingsGroupCounts 手动刷新。 */
export function createSettingsGroup(container: HTMLElement, opts: { icon: string; name: string }): HTMLElement {
  const group = document.createElement('div');
  group.className = 'bz-settings-group';
  const head = document.createElement('div');
  head.className = 'bz-settings-group-head';
  const icon = document.createElement('span');
  icon.className = 'bz-settings-group-icon';
  setIcon(icon, opts.icon);
  const name = document.createElement('span');
  name.className = 'bz-settings-group-name';
  name.textContent = opts.name;
  const count = document.createElement('span');
  count.className = 'bz-settings-group-count';
  count.textContent = '0 项';
  head.append(icon, name, count);
  const body = document.createElement('div');
  body.className = 'bz-settings-group-body';
  group.append(head, body);
  container.appendChild(group);
  return body;
}

/** 设置项是否不可见：自身或任一祖先挂 bz-setting-hidden / 内联 display none（review 做题家容器、番茄钟自定义行等动态隐藏场景）。 */
function isItemHidden(el: HTMLElement): boolean {
  let cur: HTMLElement | null = el;
  while (cur && cur !== document.body) {
    if (cur.classList.contains('bz-setting-hidden')) return true;
    if (cur.style.display === 'none') return true;
    cur = cur.parentElement;
  }
  return false;
}

/** 回填分组卡片项数徽标（实际可见设置项数；隐藏项与纯操作行不计）。幂等；导出供域内动态显隐后刷新。
 *  纯操作行（如「添加监听文件夹」按钮行）复用 .setting-item 布局但非设置项，约定挂 bz-setting-action-row 豁免。
 *  计数为 0 的组（纯自定义内容组，如 smartcat 皮肤网格）隐藏徽标，避免出现「0 项」。 */
export function refreshSettingsGroupCounts(content: HTMLElement): void {
  content.querySelectorAll('.bz-settings-group').forEach((g) => {
    const body = g.querySelector('.bz-settings-group-body');
    const countEl = g.querySelector('.bz-settings-group-count') as HTMLElement | null;
    if (!body || !countEl) return;
    const n = [...body.querySelectorAll('.setting-item')].filter((el) => {
      const h = el as HTMLElement;
      return !h.classList.contains('bz-setting-action-row') && !isItemHidden(h);
    }).length;
    countEl.textContent = `${n} 项`;
    // 功能性显隐（铁律 8 允许）：0 项组隐藏徽标
    countEl.style.display = n > 0 ? '' : 'none';
  });
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
  // 打开前记录焦点归属，关闭时还原（被顶替/遮罩/Esc 均走 dispose）
  const prevActive = document.activeElement;

  const { mask, popup } = createOverlay({
    maskId: 'bz-settings-modal-mask',
    popupId: 'bz-settings-modal-popup',
    // z-index 家族表（全站统一层规，改层级前先对表）：
    //   999x        主面板族（各域主面板 9999 / 遮罩 9998）
    //   10001-10060 域模态旧档（各域历史弹窗/预览/加密确认等）
    //   10050       设置弹窗（本组件，压域模态、被抽屉与 companion 盖）
    //   10999-11000 统一抽屉（core/item-actions：遮罩 10999 + 本体 11000）
    //   11100+      companion 档（必须 >11000：抽屉之上叠的域内小弹窗）
    //   12000       movie 小窗
    //   200000      attach 选择器
    zIndex: 10050,
    maxWidth: opts.maxWidth,
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
  // 分组卡片项数徽标回填（build 后、空态判断前）
  refreshSettingsGroupCounts(content);

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
  // UX 整改 37：读屏语义——弹窗容器为 dialog 模态（挂载后设置）
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');
  // 聚焦首个可交互设置项：跳过隐藏项（bz-setting-hidden / 内联 display none）；
  // 移动端再跳过 input/textarea（避免弹软键盘遮挡，仅聚焦按钮/开关/下拉）
  const firstFocusable = Array.from(popup.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).find((el) => {
    if (isItemHidden(el)) return false;
    if (isMobileEnv()) {
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return false;
    }
    return true;
  });
  if (firstFocusable) firstFocusable.focus();

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
      // 关闭后还原焦点到触发元素（元素仍连接时；被外部清理时跳过）
      if (prevActive && prevActive instanceof HTMLElement && prevActive.isConnected) {
        prevActive.focus();
      }
    },
  };
}
