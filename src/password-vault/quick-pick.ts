/**
 * 快速取密轻量选择器（password-vault 域；命令 bz-password-vault-gen「快速取密」专用，
 * ADR-0158 统一流：自 encrypt/pw-picker.ts 移植升级）。
 * 复用 path-picker 范式（createOverlay + escManager 层级 + 搜索即时过滤）：
 * 搜索框 + 现有密码条目行（平台/账号）fuzzy 过滤（连续子串优先、子序列兜底），
 * **顶部固定「生成新密码」选项**（不受过滤影响，恒在首位）——选中现有条目回调复制，
 * 选「生成新」回调生成；复制与 60s 自动清空由调用方执行（本模块不碰剪贴板内容）。
 * z-index 动态发号（ADR-0067）：每次打开新建 DOM，创建即显示，谁后开谁在上。
 */
import { createOverlay } from '../core/dom';
import { escManager } from '../core/esc-manager';
import type { PasswordVaultEntry } from './data';

/** 选中动作：现有条目（复制该密码）| 生成新（按设置生成并复制） */
export type QuickPickAction =
  | { type: 'entry'; entry: PasswordVaultEntry }
  | { type: 'generate' };

/**
 * fuzzy 匹配得分（大小写不敏感）：未命中 -1；
 * 连续子串命中 = 高分段（越靠前越高）；子序列命中 = 普通段（fuzzy 容错）。
 */
export function fuzzyScore(hay: string, query: string): number {
  if (!query) return 0;
  const h = (hay || '').toLowerCase();
  const q = query.toLowerCase();
  const idx = h.indexOf(q);
  if (idx >= 0) return 1000 - idx; // 连续子串：位置越靠前分越高
  let hi = 0;
  for (let qi = 0; qi < q.length; qi++) {
    hi = h.indexOf(q[qi], hi);
    if (hi === -1) return -1;
    hi++;
  }
  return 100; // 子序列命中（如 "gh" 命中 "GitHub"）
}

/** fuzzy 过滤 + 排序（得分降序，平分按创建时间倒序）：返回命中条目（不含得分） */
export function fuzzyFilterEntries(
  entries: PasswordVaultEntry[],
  query: string
): PasswordVaultEntry[] {
  const hits: Array<{ e: PasswordVaultEntry; score: number }> = [];
  for (const e of entries) {
    const score = Math.max(
      fuzzyScore(e.platform || '', query),
      fuzzyScore(e.account || '', query),
      fuzzyScore(e.note || '', query)
    );
    if (score >= 0) hits.push({ e, score });
  }
  hits.sort((a, b) => b.score - a.score || (b.e.createdAt || '').localeCompare(a.e.createdAt || ''));
  return hits.map((h) => h.e);
}

/** 渲染上限（密码条目量级远小于目录树，一般触不到；超出提示缩关键词） */
const LIMIT = 100;

let currentMask: HTMLElement | null = null;
let currentPopup: HTMLElement | null = null;
let currentHandle: { unregister: () => void } | null = null;
let focusTimer: number | null = null;

/** 关闭当前快速取密选择器（无则静默；取消语义：不回调 onPick） */
export function closePasswordQuickPicker(): void {
  if (currentMask) {
    currentMask.remove();
    currentMask = null;
  }
  if (currentPopup) {
    currentPopup.remove();
    currentPopup = null;
  }
  if (currentHandle) {
    currentHandle.unregister();
    currentHandle = null;
  }
  if (focusTimer !== null) {
    window.clearTimeout(focusTimer);
    focusTimer = null;
  }
}

/**
 * 打开快速取密选择器（幂等：已开先关）。onPick 在选择器关闭后回调选中动作，
 * 复制与 60s 自动清空由调用方执行（copySensitiveWithFallback 已收口 core/utils，issue 365）。
 * 顶部固定「生成新密码」项不受过滤影响；无命中时列表只剩该项（ADR-0158 口径：搜到即复制、
 * 无命中生成）。
 */
export function openPasswordQuickPicker(
  entries: PasswordVaultEntry[],
  onPick: (action: QuickPickAction) => void
): void {
  closePasswordQuickPicker();
  const { mask, popup } = createOverlay({
    maskId: 'bz-password-vault-qp-mask',
    popupId: 'bz-password-vault-qp-popup',
    width: 'min(calc(100vw - 32px), 420px)',
    maxWidth: 420,
    onMaskClick: () => closePasswordQuickPicker(),
  });
  currentMask = mask;
  currentPopup = popup;
  popup.classList.add('bz-password-vault-qp');
  popup.style.height = 'min(420px, 72vh)'; // 功能性几何（铁律 8：视觉收敛 CSS，尺寸内联）

  const head = document.createElement('div');
  head.className = 'bz-password-vault-qp-head';
  const title = document.createElement('h3');
  title.className = 'bz-password-vault-qp-title';
  title.textContent = '快速取密';
  head.appendChild(title);

  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'bz-input bz-password-vault-qp-search'; // 输入基线走样式库 .bz-input；域内类只管弹窗内边距
  search.placeholder = '搜索平台 / 账号，或选「生成新密码」…';
  search.spellcheck = false;
  search.setAttribute('aria-label', '搜索密码条目或生成新密码');

  const listEl = document.createElement('div');
  listEl.className = 'bz-password-vault-qp-list';

  // 状态：过滤结果 + 键盘活动行（0 = 顶部「生成新」，1..n = 命中条目）
  const state: { hits: PasswordVaultEntry[]; active: number } = { hits: [], active: 0 };

  const setActive = (i: number): void => {
    // 活动行总跨度 = 1（生成新）+ 命中数；空态也恒有「生成新」可落
    const total = 1 + state.hits.length;
    state.active = Math.max(0, Math.min(total - 1, i));
    listEl.querySelectorAll('.bz-popover-item').forEach((el, k) => {
      el.classList.toggle('is-on', k === state.active);
    });
    listEl.querySelector('.bz-popover-item.is-on')?.scrollIntoView({ block: 'nearest' });
  };

  /** 顶部固定项：生成新密码（不受过滤影响，恒在首位） */
  const buildGenerateRow = (): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'bz-popover-item';
    row.setAttribute('role', 'option');
    const mid = document.createElement('div');
    mid.className = 'mid';
    const pl = document.createElement('div');
    pl.className = 'pl';
    pl.textContent = '生成新密码';
    const ac = document.createElement('div');
    ac.className = 'ac';
    ac.textContent = '按设置的长度与字符集随机生成';
    mid.appendChild(pl);
    mid.appendChild(ac);
    const key = document.createElement('span');
    key.className = 'key';
    key.textContent = 'Enter 生成';
    row.appendChild(mid);
    row.appendChild(key);
    row.addEventListener('click', () => {
      closePasswordQuickPicker();
      onPick({ type: 'generate' });
    });
    return row;
  };

  const renderList = (): void => {
    listEl.innerHTML = '';
    state.hits = fuzzyFilterEntries(entries, search.value.trim());
    listEl.appendChild(buildGenerateRow());
    state.active = 0; // 打开/过滤后活动行回落顶部「生成新」
    if (state.hits.length) {
      const shown = state.hits.slice(0, LIMIT);
      shown.forEach((d, i) => {
        const row = document.createElement('div');
        row.className = 'bz-popover-item';
        row.setAttribute('role', 'option');
        const mid = document.createElement('div');
        mid.className = 'mid';
        const pl = document.createElement('div');
        pl.className = 'pl';
        pl.textContent = d.platform || '(无平台)';
        const ac = document.createElement('div');
        ac.className = 'ac';
        ac.textContent = d.account || '(无账号)';
        mid.appendChild(pl);
        mid.appendChild(ac);
        const key = document.createElement('span');
        key.className = 'key';
        key.textContent = 'Enter 复制';
        row.appendChild(mid);
        row.appendChild(key);
        row.addEventListener('click', () => {
          closePasswordQuickPicker();
          onPick({ type: 'entry', entry: d });
        });
        listEl.appendChild(row);
      });
      if (state.hits.length > LIMIT) {
        const more = document.createElement('div');
        more.className = 'bz-popover-empty';
        more.textContent = `已显示前 ${LIMIT} 条（共 ${state.hits.length} 条命中），请输入关键词缩小范围`;
        listEl.appendChild(more);
      }
    } else if (entries.length) {
      const empty = document.createElement('div');
      empty.className = 'bz-popover-empty';
      empty.textContent = '没有匹配的密码条目';
      listEl.appendChild(empty);
    }
    setActive(state.active);
  };

  search.addEventListener('input', () => renderList());
  // 键盘：↑/↓ 换活动行（含顶部「生成新」），Enter 走活动行，Esc 走 escManager 层
  search.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(state.active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(state.active - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (state.active === 0) {
        closePasswordQuickPicker();
        onPick({ type: 'generate' });
        return;
      }
      const d = state.hits[state.active - 1];
      if (d) {
        closePasswordQuickPicker();
        onPick({ type: 'entry', entry: d });
      }
    }
  });

  popup.append(head, search, listEl);
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';

  currentHandle = escManager.register('bz-password-vault-qp', {
    isVisible: () => !!currentMask,
    close: () => closePasswordQuickPicker(),
  });
  renderList();
  // 打开聚焦搜索框（30ms 等 DOM 挂载，与 path-picker 同范式）
  focusTimer = window.setTimeout(() => {
    focusTimer = null;
    if (mask.isConnected) search.focus();
  }, 30);
}
