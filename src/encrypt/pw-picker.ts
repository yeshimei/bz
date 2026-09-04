/**
 * 快速取密轻量选择器（encrypt 域；命令 bz-encrypt-copy-password 专用）
 * 复用 path-picker 范式（createOverlay + escManager 层级 + 搜索即时过滤）：
 * 搜索框 + 密码条目行（平台/账号），fuzzy 过滤（连续子串优先、子序列兜底），
 * 点击/Enter 选中即回调复制；全程不打开保险库主面板。
 * z-index 动态发号（ADR-0067）：每次打开新建 DOM，创建即显示，谁后开谁在上。
 */
import { createOverlay } from '../core/dom';
import { escManager } from '../core/esc-manager';
import type { PasswordVaultEntry } from './vault-data';

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
 * 打开快速取密选择器（幂等：已开先关）。onPick 在选择器关闭后回调选中的条目，
 * 复制与 60s 自动清空由调用方执行（本模块不碰剪贴板）。
 */
export function openPasswordQuickPicker(
  entries: PasswordVaultEntry[],
  onPick: (entry: PasswordVaultEntry) => void
): void {
  closePasswordQuickPicker();
  const { mask, popup } = createOverlay({
    maskId: 'bz-encrypt-pw-picker-mask',
    popupId: 'bz-encrypt-pw-picker-popup',
    width: 'min(calc(100vw - 32px), 420px)',
    maxWidth: 420,
    onMaskClick: () => closePasswordQuickPicker(),
  });
  currentMask = mask;
  currentPopup = popup;
  popup.classList.add('bz-encrypt-pwqp');
  popup.style.height = 'min(420px, 72vh)'; // 功能性几何（铁律 8：视觉收敛 CSS，尺寸内联）

  const head = document.createElement('div');
  head.className = 'bz-encrypt-pwqp-head';
  const title = document.createElement('h3');
  title.className = 'bz-encrypt-pwqp-title';
  title.textContent = '快速复制密码';
  head.appendChild(title);

  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'bz-encrypt-pwqp-search';
  search.placeholder = '搜索平台 / 账号…';
  search.spellcheck = false;
  search.setAttribute('aria-label', '搜索密码条目');

  const listEl = document.createElement('div');
  listEl.className = 'bz-encrypt-pwqp-list';

  // 状态：过滤结果 + 键盘活动行（Enter 取当前活动行，无活动行取首行）
  const state: { hits: PasswordVaultEntry[]; active: number } = { hits: [], active: 0 };

  const setActive = (i: number): void => {
    if (!state.hits.length) return;
    state.active = Math.max(0, Math.min(state.hits.length - 1, i));
    listEl.querySelectorAll('.bz-encrypt-pwqp-row').forEach((el, k) => {
      el.classList.toggle('on', k === state.active);
    });
    listEl.querySelector('.bz-encrypt-pwqp-row.on')?.scrollIntoView({ block: 'nearest' });
  };

  const renderList = (): void => {
    listEl.innerHTML = '';
    state.hits = fuzzyFilterEntries(entries, search.value.trim());
    state.active = 0;
    if (!state.hits.length) {
      const empty = document.createElement('div');
      empty.className = 'bz-encrypt-pwqp-empty';
      empty.textContent = '没有匹配的密码条目';
      listEl.appendChild(empty);
      return;
    }
    const shown = state.hits.slice(0, LIMIT);
    shown.forEach((d, i) => {
      const row = document.createElement('div');
      row.className = 'bz-encrypt-pwqp-row' + (i === 0 ? ' on' : '');
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
        onPick(d);
      });
      listEl.appendChild(row);
    });
    if (state.hits.length > LIMIT) {
      const more = document.createElement('div');
      more.className = 'bz-encrypt-pwqp-empty';
      more.textContent = `已显示前 ${LIMIT} 条（共 ${state.hits.length} 条命中），请输入关键词缩小范围`;
      listEl.appendChild(more);
    }
  };

  search.addEventListener('input', () => renderList());
  // 键盘：↑/↓ 换活动行，Enter 复制活动行（无命中则忽略），Esc 走 escManager 层
  search.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(state.active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(state.active - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const d = state.hits[state.active];
      if (d) {
        closePasswordQuickPicker();
        onPick(d);
      }
    }
  });

  popup.append(head, search, listEl);
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';

  currentHandle = escManager.register('bz-encrypt-pw-picker', {
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
