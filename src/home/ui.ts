/**
 * 内容首页（home 域）UI：入口页「新标签页」原型（launcher-p3-newtab）一比一迁移。
 *
 * 形态（桌面/移动同一 overlay 面板，CSS ≤768px 切换；与 cinema 同构）：
 *  - 桌面：hero（问候/日期/搜索/编辑）+ 钉选域卡 grid（徽标=真实统计）
 *          + 未钉迷你 chips + 右侧「各域一览」；点遮罩/ESC 关闭（无关闭钮）
 *  - 移动：hero 渐变 + 搜索 + 三格统计条 + 两列域卡（徽标行内）+ 迷你 chips
 * 交互：卡片点按 → 执行对应 bz-* 命令（真实接线，关闭首页后开域）；
 *       编辑模式 → 点卡移除（勾选框视觉）、「＋ 加域卡」pick 钉选；点别处收起。
 *       命令搜索：app.commands.listCommands() 真实过滤 + 执行。
 * 组件库纪律（铁律 6）：基线按钮/图标钮/输入/chip 走 src/core/ui 与 --bz-* token；
 * 图标一律 lucide（data-lucide 占位 → mountIcons 统一 setIcon）。
 */
import { escManager } from '../core/esc-manager';
import { notice } from '../core/notice';
import { uiIcon } from '../core/ui';
import { H } from './state';
import { DOMAINS, DOMAIN_MAP, DOMAIN_DOT, ALL_DOMAIN_IDS } from './domains';
import { DEFAULT_PINNED, loadHomeData, saveHomeData } from './data';
import { collectHomeSnapshot } from './snapshot';
import type { DomainStat } from './snapshot';

/* ---------- lucide 占位 + 挂载 ---------- */

function iconSpan(name: string, extra = ''): string {
  return `<i data-lucide="${name}" class="bz-ic${extra ? ' ' + extra : ''}"></i>`;
}

function mountIcons(container: HTMLElement): void {
  container.querySelectorAll('i[data-lucide]').forEach((el) => {
    const fresh = uiIcon(el.getAttribute('data-lucide') || '', '');
    const cls = el.className;
    if (cls && cls !== 'bz-ic') fresh.className = cls;
    el.replaceWith(fresh);
  });
}

function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }) as Record<string, string>)[c]);
}

/* ---------- 小工具 ---------- */

function p2(n: number): string {
  return String(n).padStart(2, '0');
}

function helloText(): string {
  const h = new Date().getHours();
  if (h < 5) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function todayText(): string {
  const d = new Date();
  const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 周${wd} · ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

const ICO = {
  edit: 'sliders-horizontal',
  search: 'search',
  close: 'x',
  check: 'check',
  add: 'plus',
  cmd: 'command',
  folder: 'folder',
  chevronRight: 'chevron-right',
};

/* ---------- 状态辅助 ---------- */

function statOf(id: string): DomainStat {
  return H.snapshot?.byDomain?.[id] ?? { text: '', hl: false, sub: '' };
}

async function ensurePinned(): Promise<void> {
  if (H.pinned.length) return;
  try {
    const data = await loadHomeData();
    H.pinned = data.pinned;
  } catch {
    H.pinned = [...DEFAULT_PINNED];
  }
}

function persistPinned(): void {
  void saveHomeData({ version: 1, pinned: H.pinned }).catch(() => undefined);
}

/* ---------- 面板骨架 ---------- */

export function createOverlay(app: any): void {
  void ensurePinned().then(() => renderAll());
  const overlay = document.createElement('div');
  overlay.className = 'bz-home-overlay';
  overlay.innerHTML = `
    <div class="bz-home-panel">
      <div class="bz-home-hero">
        <div class="bz-home-hero-top">
          <div class="bz-home-hero-l">
            <span class="bz-home-hello" data-home-hello></span>
            <span class="bz-home-date" data-home-date></span>
          </div>
          <button class="bz-icon-btn bz-home-edit" data-home-edit title="编辑钉选" aria-label="编辑钉选">${iconSpan(ICO.edit)}</button>
        </div>
        <div class="bz-home-search">
          <span class="bz-home-search-ic">${iconSpan(ICO.search)}</span>
          <input class="bz-home-q" data-home-q placeholder="搜索命令 / 域…" autocomplete="off" spellcheck="false">
        </div>
        <div class="bz-home-pal" data-home-pal hidden></div>
      </div>
      <div class="bz-home-body">
        <div class="bz-home-main">
          <div class="bz-home-mstats" data-home-mstats></div>
          <div class="bz-home-block-t">快捷入口 <span class="bz-home-block-cnt" data-home-cnt></span></div>
          <div class="bz-home-cards" data-home-cards></div>
          <button class="bz-home-addcard" data-home-addcard hidden>${iconSpan(ICO.add)} 加域卡</button>
          <div class="bz-home-minis" data-home-minis></div>
        </div>
        <div class="bz-home-side" data-home-side></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  H.currentOverlay = overlay;
  mountIcons(overlay);
  bindEvents(overlay, app);
  renderAll();
  void refreshSnapshotAndRender();
}

/** 重新拉取跨域统计快照并重绘（面板打开时调用） */
export async function refreshSnapshotAndRender(): Promise<void> {
  if (!H.currentOverlay) return;
  try {
    H.snapshot = await collectHomeSnapshot(H.appRef ?? undefined);
  } catch {
    H.snapshot = null;
  }
  renderAll();
}

export function closeOverlay(): void {
  if (!H.currentOverlay) return;
  H.currentOverlay.remove();
  H.currentOverlay = null;
  H.editing = false;
  releaseDocClick();
  palItems = [];
}

/* ---------- 事件 ---------- */

function bindEvents(overlay: HTMLElement, app: any): void {
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (e.target === overlay) {
      closeOverlay();
      return;
    }
    if (t.closest('[data-home-edit]')) {
      setEditing(!H.editing);
      return;
    }
    // 加域卡 → pick
    if (t.closest('[data-home-addcard]')) {
      openAddPick(t.closest('[data-home-addcard]') as HTMLElement);
      return;
    }
    // pick 选项
    const pickOpt = t.closest('[data-home-pickopt]') as HTMLElement | null;
    if (pickOpt) {
      const id = pickOpt.dataset.homePickopt || '';
      if (id && DOMAIN_MAP.has(id) && !H.pinned.includes(id)) {
        H.pinned.push(id);
        setEditing(false);
        hideAddPick();
        persistPinned();
        toast(`已把「${DOMAIN_MAP.get(id)!.name}」钉到首页`, 'success');
      }
      return;
    }
    // 搜索面板行
    const prow = t.closest('[data-home-pal-i]') as HTMLElement | null;
    if (prow) {
      palSel = Number(prow.dataset.homePalI);
      execPal(app);
      return;
    }
    // 卡片（编辑态 = 移除；普通态 = 开域）
    const card = t.closest('[data-home-card]') as HTMLElement | null;
    if (card) {
      const id = card.dataset.homeCard || '';
      if (H.editing) {
        removePinned(id);
      } else if (id) {
        openDomain(id, app);
      }
      return;
    }
    // 迷你 chip
    const mini = t.closest('[data-home-mini]') as HTMLElement | null;
    if (mini) {
      const id = mini.dataset.homeMini || '';
      if (id) openDomain(id, app);
      return;
    }
    // 侧栏行
    const side = t.closest('[data-home-side]') as HTMLElement | null;
    if (side) {
      const id = side.dataset.homeSide || '';
      if (id) openDomain(id, app);
      return;
    }
  });

  const q = overlay.querySelector('[data-home-q]') as HTMLInputElement;
  q.addEventListener('input', () => updatePal(app, q.value));
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hidePal(); q.blur(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); movePal(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); movePal(-1); }
    if (e.key === 'Enter') { e.preventDefault(); execPal(app); }
  });

  // 点面板外收起 pick/pal（docClick 单例：防多面板累积重复监听）
  releaseDocClick();
  docClickHandler = (e: MouseEvent) => {
    const cur = H.currentOverlay;
    if (cur && !cur.contains(e.target as Node)) {
      hidePal();
      hideAddPick();
    }
  };
  document.addEventListener('click', docClickHandler);
}

let docClickHandler: ((e: MouseEvent) => void) | null = null;

function releaseDocClick(): void {
  if (docClickHandler) {
    document.removeEventListener('click', docClickHandler);
    docClickHandler = null;
  }
}

function removePinned(id: string): void {
  if (!H.pinned.includes(id)) return;
  H.pinned = H.pinned.filter((x) => x !== id);
  persistPinned();
  renderAll();
  toast(`已把「${DOMAIN_MAP.get(id)?.name ?? id}」移出首页`, 'info');
}

function setEditing(on: boolean): void {
  H.editing = on;
  H.currentOverlay?.querySelector('[data-home-edit]')?.classList.toggle('on', on);
  renderAll();
}

/* ---------- 加域 pick ---------- */

function hideAddPick(): void {
  H.currentOverlay?.querySelector('.bz-home-pick')?.remove();
}

function openAddPick(anchor: HTMLElement): void {
  hideAddPick();
  const overlay = H.currentOverlay;
  if (!overlay) return;
  const avail = DOMAINS.filter((d) => !H.pinned.includes(d.id));
  const pick = document.createElement('div');
  pick.className = 'bz-home-pick';
  pick.innerHTML =
    '<div class="bz-home-pick-t">钉到首页</div>' +
    (avail.length
      ? avail
          .map((d) => `<button type="button" class="bz-home-pickopt" data-home-pickopt="${d.id}">${iconSpan(d.icon)}<span>${esc(d.name)}</span></button>`)
          .join('')
      : '<div class="bz-home-pick-empty">都钉上了</div>');
  overlay.appendChild(pick);
  mountIcons(pick);
  const r = anchor.getBoundingClientRect();
  const pr = overlay.querySelector('.bz-home-panel')!.getBoundingClientRect();
  pick.style.left = `${Math.max(8, Math.min(r.left - pr.left, pr.width - 240))}px`;
  pick.style.top = `${r.bottom - pr.top + 6}px`;
}

/* ---------- 渲染：桌面 + 移动（同一 DOM，CSS 断点差异） ---------- */

function cardHtml(id: string): string {
  const d = DOMAIN_MAP.get(id)!;
  const st = statOf(id);
  const dot = DOMAIN_DOT[id] ?? '#8a8f99';
  const badge = H.editing
    ? `<span class="bz-home-chk">${iconSpan(ICO.check)}</span>`
    : st.text
      ? `<span class="bz-home-badge${st.hl ? ' bz-home-badge--hl' : ''}"><i style="background:${dot}"></i>${esc(st.text)}${st.sub ? `<em>${esc(st.sub)}</em>` : ''}</span>`
      : '';
  return `<button type="button" class="bz-home-card${H.editing ? ' bz-home-card--edit' : ''}" data-home-card="${id}">
    <span class="bz-home-ce">${iconSpan(d.icon)}</span>
    <span class="bz-home-cn">${esc(d.name)}</span>
    <span class="bz-home-cs">${esc(d.sub)}</span>
    ${badge}</button>`;
}

function renderAll(): void {
  const overlay = H.currentOverlay;
  if (!overlay) return;
  // hero 文案
  const hello = overlay.querySelector('[data-home-hello]');
  if (hello) hello.textContent = `${helloText()}，包仔`;
  const date = overlay.querySelector('[data-home-date]');
  if (date) date.textContent = todayText();
  overlay.querySelector('[data-home-edit]')?.classList.toggle('on', H.editing);

  // 统计条（移动端：三格）
  const mstats = overlay.querySelector('[data-home-mstats]') as HTMLElement | null;
  if (mstats) {
    const memo = statOf('memo').text || '—';
    const rev = statOf('review').text || '—';
    const pom = statOf('pomodoro').text || '—';
    mstats.innerHTML = `
      <div class="bz-home-mstat"><span class="bz-home-mstat-v">${esc(memo)}</span><span class="bz-home-mstat-k">待办</span></div>
      <div class="bz-home-mstat"><span class="bz-home-mstat-v">${esc(rev)}</span><span class="bz-home-mstat-k">复习到期</span></div>
      <div class="bz-home-mstat"><span class="bz-home-mstat-v">${esc(pom)}</span><span class="bz-home-mstat-k">今日专注</span></div>`;
  }

  // 卡片网格
  const cards = overlay.querySelector('[data-home-cards]') as HTMLElement;
  const pinned = H.pinned.filter((id) => DOMAIN_MAP.has(id));
  cards.innerHTML = pinned.length
    ? pinned.map((id) => cardHtml(id)).join('')
    : '<div class="bz-home-cards-empty">还没有钉选域 — 点右上角编辑添加</div>';
  overlay.querySelector('[data-home-cnt]')!.textContent = `${pinned.length} 个`;
  mountIcons(cards);

  // 加域卡
  const addBtn = overlay.querySelector('[data-home-addcard]') as HTMLElement;
  addBtn.hidden = !H.editing;

  // 迷你 chips（未钉域）
  const minis = overlay.querySelector('[data-home-minis]') as HTMLElement;
  const unpinned = ALL_DOMAIN_IDS.filter((id) => !H.pinned.includes(id));
  minis.innerHTML = unpinned.length
    ? unpinned
        .map((id) => `<button type="button" class="bz-home-mini" data-home-mini="${id}">${iconSpan(DOMAINS.find((x) => x.id === id)!.icon)}<span>${esc(DOMAINS.find((x) => x.id === id)!.name)}</span></button>`)
        .join('')
    : '';
  mountIcons(minis);

  // 侧栏（各域一览：其余域快捷行 + 徽标文本）
  const side = overlay.querySelector('[data-home-side]') as HTMLElement;
  if (side) {
    side.innerHTML = '<div class="bz-home-side-t">各域一览</div>' +
      unpinned
        .map((id) => {
          const d = DOMAINS.find((x) => x.id === id)!;
          const st = statOf(id);
          return `<button type="button" class="bz-home-side-row" data-home-side="${id}">
            <span class="bz-home-side-ic">${iconSpan(d.icon)}</span>
            <span class="bz-home-side-n">${esc(d.name)}</span>
            <span class="bz-home-side-s">${st.text ? esc(st.text) : esc(d.sub)}</span>
            <span class="bz-home-side-go">${iconSpan(ICO.chevronRight)}</span></button>`;
        })
        .join('');
    mountIcons(side);
  }
}

/* ---------- 域执行 ---------- */

function execDomain(id: string, app: any): void {
  const d = DOMAIN_MAP.get(id);
  if (!d) return;
  closeOverlay();
  try {
    void app.commands.executeCommandById(d.commandId);
  } catch {
    notice(`命令 ${d.commandId} 不可用`, 'warning');
  }
}

function openDomain(id: string, app: any): void {
  execDomain(id, app);
}

/* ---------- 命令搜索 ---------- */

interface PalItem {
  type: 'cmd' | 'domain';
  name: string;
  cmdId?: string;
  domainId?: string;
}

let palItems: PalItem[] = [];
let palSel = 0;

function updatePal(app: any, q: string): void {
  const overlay = H.currentOverlay;
  if (!overlay) return;
  const pal = overlay.querySelector('[data-home-pal]') as HTMLElement;
  const kw = q.trim().toLowerCase();
  if (!kw) { hidePal(); return; }
  const items: PalItem[] = [];
  DOMAINS.forEach((d) => {
    if (d.name.toLowerCase().includes(kw)) items.push({ type: 'domain', name: d.name, domainId: d.id });
  });
  try {
    const cmds = app.commands.listCommands() as Array<{ id: string; name: string }>;
    (cmds || []).forEach((c) => {
      if (c.id.includes(kw) || (c.name && c.name.toLowerCase().includes(kw))) {
        items.push({ type: 'cmd', name: c.name || c.id, cmdId: c.id });
      }
    });
  } catch {
    /* 注册表不可用：仅域搜索 */
  }
  // 去重（同 name + type）
  const seen = new Set<string>();
  const uniq = items.filter((i) => {
    const k = i.type + '|' + i.name;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  palItems = uniq.slice(0, 12);
  palSel = 0;
  if (!palItems.length) {
    pal.innerHTML = '<div class="bz-home-pal-empty">没有匹配的命令或域</div>';
  } else {
    pal.innerHTML =
      '<div class="bz-home-pal-res">' +
      palItems
        .map((it, i) => `<button type="button" class="bz-home-prow${i === 0 ? ' sel' : ''}" data-home-pal-i="${i}">${iconSpan(it.type === 'cmd' ? ICO.cmd : ICO.folder)}<span class="bz-home-prow-n">${esc(it.name)}</span><span class="bz-home-prow-k">${it.type === 'cmd' ? '命令' : '域'}</span></button>`)
        .join('') +
      '</div><div class="bz-home-pal-tip">↑↓ 选择 · ↵ 执行 · Esc 关闭</div>';
  }
  mountIcons(pal);
  pal.hidden = false;
}

function movePal(delta: number): void {
  const overlay = H.currentOverlay;
  const pal = overlay?.querySelector('[data-home-pal]') as HTMLElement | null;
  if (!overlay || !pal || pal.hidden) return;
  if (!palItems.length) return;
  palSel = Math.min(Math.max(palSel + delta, 0), palItems.length - 1);
  overlay.querySelectorAll('.bz-home-prow').forEach((el, i) => el.classList.toggle('sel', i === palSel));
}

function hidePal(): void {
  const pal = H.currentOverlay?.querySelector('[data-home-pal]') as HTMLElement | null;
  if (pal) pal.hidden = true;
}

function execPal(app: any): void {
  const it = palItems[palSel];
  const q = H.currentOverlay?.querySelector('[data-home-q]') as HTMLInputElement | null;
  hidePal();
  if (q) { q.value = ''; q.blur(); }
  if (!it) return;
  if (it.type === 'domain' && it.domainId) {
    execDomain(it.domainId, app);
    return;
  }
  if (it.type === 'cmd' && it.cmdId) {
    closeOverlay();
    try {
      void app.commands.executeCommandById(it.cmdId);
    } catch {
      notice(`命令 ${it.cmdId} 不可用`, 'warning');
    }
  }
}

/* ---------- ESC / 通知 ---------- */

function toast(msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
  notice(msg, type);
}

let escRegistered = false;
export function registerEscapeHandler(): void {
  if (escRegistered) return;
  escRegistered = true;
  escManager.register('bz-home', {
    isVisible: () => !!H.currentOverlay,
    close: closeOverlay,
  });
}
