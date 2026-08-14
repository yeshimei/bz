/**
 * 黑匣子三标签面板（ticket 59 骨架；60/61 精化）：
 * 人物墙 / 事件时间线 / 复盘流 + 打开时即时提炼（Q8）。
 * 自建 DOM（createOverlay + escManager），样式类 bz-blackbox-*（styles.css）。
 */
import { escManager } from '../core/esc-manager';
import { createOverlay, createIconBtn } from '../core/dom';
import { BlackBoxDataManager } from './data';
import { processPendingEntries } from './sync';
import { manualReview } from './review';
import { personLabel } from './types';
import type { App } from 'obsidian';
import type { BlackBoxData, EventItem, Profile, Review } from './types';

const MASK_ID = 'bz-blackbox-panel-mask';
const POPUP_ID = 'bz-blackbox-panel';

let mask: HTMLDivElement | null = null;
let popup: HTMLDivElement | null = null;
let contentEl: HTMLDivElement | null = null;
let currentTab = 0;
let escHandle: { unregister: () => void } | null = null;
let _app: any = null;

const TABS = ['👤 人物墙', '🕐 时间线', '📋 复盘流'];

/** 面板状态（escManager 层 + 测试断言） */
export function getPanelState() {
  return {
    isVisible: () => !!popup && popup.style.display !== 'none',
    close: () => closeBlackBoxPanel(),
  };
}

/** 打开面板（幂等：已打开则聚焦；打开时若有待处理条目先即时提炼） */
export async function openBlackBoxPanel(app: any, ai?: any): Promise<void> {
  _app = app;
  if (popup && popup.style.display !== 'none') return;
  if (!mask || !popup || !contentEl) {
    if (mask && mask.parentNode) mask.parentNode.removeChild(mask);
    if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
    const ov = createOverlay({ maskId: MASK_ID, popupId: POPUP_ID, zIndex: 10000, onMaskClick: closeBlackBoxPanel, width: '92%', maxWidth: 560 });
    mask = ov.mask;
    popup = ov.popup;
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    buildPanel();
  }
  mask.style.display = 'flex';
  popup.style.display = 'block';
  escHandle = escManager.register(POPUP_ID, getPanelState());
  // Q8：打开时若有待处理条目 → 先即时提炼再渲染
  await processPendingEntries(app, ai);
  await render();
}

function buildPanel(): void {
  if (!popup) return;
  popup.innerHTML = '';
  // header
  const header = document.createElement('div');
  header.className = 'bz-blackbox-header';
  const title = document.createElement('span');
  title.id = 'bz-blackbox-panel-title';
  title.textContent = '黑匣子';
  header.appendChild(title);
  // 复盘按钮（手动触发，ticket 62）
  header.appendChild(createIconBtn('📊', '复盘', () => {
    void manualReview(_app).then((ok) => {
      if (ok) void render();
    });
  }));
  // 关闭按钮
  header.appendChild(createIconBtn('❌', '关闭', () => closeBlackBoxPanel()));
  popup.appendChild(header);
  // 标签栏
  const tabBar = document.createElement('div');
  tabBar.className = 'bz-blackbox-tabs';
  TABS.forEach((label, i) => {
    const tab = document.createElement('button');
    tab.className = 'bz-blackbox-tab' + (i === currentTab ? ' active' : '');
    tab.textContent = label;
    tab.onclick = () => {
      currentTab = i;
      tabBar.querySelectorAll('.bz-blackbox-tab').forEach((t, ti) => t.classList.toggle('active', ti === i));
      void render();
    };
    tabBar.appendChild(tab);
  });
  popup.appendChild(tabBar);
  // 内容区
  contentEl = document.createElement('div');
  contentEl.id = 'bz-blackbox-panel-content';
  contentEl.className = 'bz-blackbox-content';
  popup.appendChild(contentEl);
}

/** 关闭面板 */
export function closeBlackBoxPanel(): void {
  if (mask) mask.style.display = 'none';
  if (popup) popup.style.display = 'none';
  if (escHandle) {
    escHandle.unregister();
    escHandle = null;
  }
}

/** 卸载清理 */
export function unloadBlackBoxPanel(): void {
  closeBlackBoxPanel();
  if (mask && mask.parentNode) mask.parentNode.removeChild(mask);
  if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
  mask = null;
  popup = null;
  contentEl = null;
  currentTab = 0;
  _app = null;
}

/** 渲染当前标签 */
async function render(): Promise<void> {
  const dm = new BlackBoxDataManager();
  const data = await dm.load();
  // await 期间面板可能已关闭（contentEl 置 null）→ 不再渲染
  if (!contentEl) return;
  contentEl.innerHTML = '';
  if (currentTab === 0) renderProfiles(data);
  else if (currentTab === 1) renderEvents(data);
  else renderReviews(data);
}

function emptyEl(text: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = 'bz-blackbox-empty';
  d.textContent = text;
  return d;
}

// ===== 人物墙（ticket 61 精化） =====

/** 画像关联事件数（事件投影计数） */
function profileEventCount(p: Profile, events: EventItem[]): number {
  return events.filter((ev) => ev.people.some((x) => x === p.id || x === p.name)).length;
}

function renderProfiles(data: BlackBoxData): void {
  if (!contentEl) return;
  // mentions 候选（未建画像人物）
  for (const m of data.mentions) {
    const chip = document.createElement('div');
    chip.className = 'bz-mention-chip';
    chip.textContent = `${m.name}（提及 ${m.count} 次）`;
    contentEl.appendChild(chip);
  }
  if (!data.profiles.length) {
    contentEl.appendChild(emptyEl('暂无人物画像'));
    return;
  }
  for (const p of data.profiles) {
    const card = document.createElement('div');
    card.className = 'bz-profile-card';
    const name = document.createElement('div');
    name.className = 'bz-profile-name';
    name.textContent = p.name + (p.humanEdited ? ' 🔒' : '');
    card.appendChild(name);
    if (p.impression) {
      const imp = document.createElement('div');
      imp.className = 'bz-profile-impression';
      imp.textContent = p.impression;
      card.appendChild(imp);
    } else if (p.aiObservations.length) {
      const obs = document.createElement('div');
      obs.className = 'bz-profile-obs';
      obs.textContent = p.aiObservations[p.aiObservations.length - 1].text;
      card.appendChild(obs);
    }
    const meta = document.createElement('div');
    meta.className = 'bz-profile-meta';
    const emoStr = p.emotions.length ? ` · ${p.emotions.map((e) => `${e.tag}×${e.count}`).join(' ')}` : '';
    meta.textContent = `提及 ${p.mentionCount} 次 · ${profileEventCount(p, data.events)} 个事件${emoStr}`;
    card.appendChild(meta);
    // 点击展开详情
    card.onclick = () => {
      card.classList.toggle('open');
      const existing = card.querySelector('.bz-profile-detail');
      if (existing) {
        existing.remove();
        return;
      }
      const detail = document.createElement('div');
      detail.className = 'bz-profile-detail';
      // AI 观察区（可采纳/移除）
      for (const obs of p.aiObservations) {
        const row = document.createElement('div');
        row.className = 'bz-obs-row';
        const txt = document.createElement('span');
        txt.textContent = obs.text;
        row.appendChild(txt);
        const adopt = document.createElement('button');
        adopt.className = 'bz-obs-adopt';
        adopt.textContent = '采纳';
        adopt.onclick = async (e) => {
          e.stopPropagation();
          p.impression = p.impression ? `${p.impression}；${obs.text}` : obs.text;
          p.humanEdited = true;
          await saveAndRender(data);
        };
        const remove = document.createElement('button');
        remove.className = 'bz-obs-remove';
        remove.textContent = '移除';
        remove.onclick = async (e) => {
          e.stopPropagation();
          p.aiObservations = p.aiObservations.filter((x) => x !== obs);
          p.humanEdited = true;
          await saveAndRender(data);
        };
        row.appendChild(adopt);
        row.appendChild(remove);
        detail.appendChild(row);
      }
      // 事件投影
      const evs = data.events.filter((ev) => ev.people.some((x) => x === p.id || x === p.name));
      if (evs.length) {
        const proj = document.createElement('div');
        proj.className = 'bz-profile-events';
        proj.textContent = '相关事件：' + evs.map((ev) => ev.title).join('、');
        detail.appendChild(proj);
      }
      card.appendChild(detail);
    };
    contentEl!.appendChild(card);
  }
}

// ===== 事件时间线（ticket 60 精化） =====

/** 时间线筛选状态（模块级，面板会话内保持） */
let eventPersonFilter = '';
let eventYearFilter = '';

/** 保存派生层 + 重渲染（事件操作后） */
async function saveAndRender(data: BlackBoxData): Promise<void> {
  const dm = new BlackBoxDataManager();
  await dm.save(data);
  await render();
}

/** 事件人物显示名（画像 id → 名；纯名字原样） */
function evPersonLabel(p: string, profiles: Profile[]): string {
  return personLabel(p, profiles);
}

/** 打开日记文件 + 滚动到条目（证据链跳转，Q7） */
function jumpToDiary(app: any, path: string, lineNumber: number): void {
  const file = app.vault.getAbstractFileByPath ? app.vault.getAbstractFileByPath(`${path}.md`) : null;
  void app.workspace.openLinkText(path, '', false);
}

function renderEvents(data: BlackBoxData): void {
  if (!contentEl) return;
  const showSpec = data.settings.showSpeculativeEvents !== false;
  let events = data.events
    .filter((ev) => showSpec || ev.status !== 'speculative')
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!events.length) {
    contentEl.appendChild(emptyEl('暂无事件'));
    return;
  }
  // 筛选栏：人物 + 年份
  const bar = document.createElement('div');
  bar.className = 'bz-event-filter-bar';
  // 人物下拉
  const personSel = document.createElement('select');
  personSel.className = 'bz-event-person-filter';
  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = '全部人物';
  personSel.appendChild(allOpt);
  for (const pf of data.profiles) {
    const opt = document.createElement('option');
    opt.value = pf.name;
    opt.textContent = pf.name;
    personSel.appendChild(opt);
  }
  personSel.value = eventPersonFilter;
  personSel.onchange = () => {
    eventPersonFilter = personSel.value;
    void render();
  };
  bar.appendChild(personSel);
  // 年份下拉
  const yearSel = document.createElement('select');
  yearSel.className = 'bz-event-year-filter';
  const yAll = document.createElement('option');
  yAll.value = '';
  yAll.textContent = '全部年份';
  yearSel.appendChild(yAll);
  const years = [...new Set(data.events.map((e) => e.date.slice(0, 4)))].sort().reverse();
  for (const y of years) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    yearSel.appendChild(opt);
  }
  yearSel.value = eventYearFilter;
  yearSel.onchange = () => {
    eventYearFilter = yearSel.value;
    void render();
  };
  bar.appendChild(yearSel);
  contentEl.appendChild(bar);

  // 时段情绪分布条（按事件日期聚合情绪计数）
  const dist = document.createElement('div');
  dist.className = 'bz-event-emotion-dist';
  const counts: Record<string, number> = {};
  for (const ev of events) {
    for (const t of ev.emotions) counts[t] = (counts[t] || 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length) {
    dist.textContent = '情绪分布：' + entries.map(([t, n]) => `${t}×${n}`).join(' ');
    contentEl.appendChild(dist);
  }

  // 应用筛选
  if (eventPersonFilter) {
    events = events.filter((ev) => ev.people.some((p) => evPersonLabel(p, data.profiles) === eventPersonFilter));
  }
  if (eventYearFilter) {
    events = events.filter((ev) => ev.date.slice(0, 4) === eventYearFilter);
  }
  if (!events.length) {
    contentEl.appendChild(emptyEl('暂无事件'));
    return;
  }

  for (const ev of events) {
    const card = document.createElement('div');
    card.className = 'bz-event-card' + (ev.status === 'speculative' ? ' speculative' : '');
    const head = document.createElement('div');
    head.className = 'bz-event-head';
    head.textContent = `${ev.date.slice(0, 10)} ${ev.status === 'speculative' ? '❓' : ''} ${ev.title}`;
    card.appendChild(head);
    if (ev.people.length) {
      const people = document.createElement('div');
      people.className = 'bz-event-people';
      people.textContent = ev.people.map((p) => evPersonLabel(p, data.profiles)).join('、');
      card.appendChild(people);
    }
    if (ev.emotions.length) {
      const emo = document.createElement('div');
      emo.className = 'bz-event-emotions';
      emo.textContent = ev.emotions.join(' ');
      card.appendChild(emo);
    }
    // 证据链跳转
    if (ev.source && ev.source.path) {
      const src = document.createElement('button');
      src.className = 'bz-event-source';
      src.textContent = `📄 ${ev.source.path} #${ev.source.lineNumber}`;
      src.onclick = () => jumpToDiary(_app, ev.source!.path, ev.source!.lineNumber);
      card.appendChild(src);
    }
    // 推测事件操作
    if (ev.status === 'speculative') {
      const actions = document.createElement('div');
      actions.className = 'bz-event-actions';
      const confirm = document.createElement('button');
      confirm.className = 'bz-event-confirm';
      confirm.textContent = '✓ 确认';
      confirm.onclick = async () => {
        ev.status = 'confirmed';
        await saveAndRender(data);
      };
      const del = document.createElement('button');
      del.className = 'bz-event-delete';
      del.textContent = '✕ 删除';
      del.onclick = async () => {
        data.events = data.events.filter((x) => x.id !== ev.id);
        await saveAndRender(data);
      };
      actions.appendChild(confirm);
      actions.appendChild(del);
      card.appendChild(actions);
    }
    contentEl!.appendChild(card);
  }
}

// ===== 复盘流（ticket 62 精化；59 骨架 = 简单列表） =====

function renderReviews(data: BlackBoxData): void {
  if (!contentEl) return;
  const reviews = data.reviews.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (!reviews.length) {
    contentEl.appendChild(emptyEl('暂无复盘'));
    return;
  }
  for (const rv of reviews) {
    const card = document.createElement('div');
    card.className = 'bz-review-card';
    const head = document.createElement('div');
    head.className = 'bz-review-head';
    head.textContent = `${rv.period.from} ~ ${rv.period.to}`;
    card.appendChild(head);
    const body = document.createElement('div');
    body.className = 'bz-review-body';
    body.textContent = (rv.report.reflections || []).join(' ');
    card.appendChild(body);
    contentEl!.appendChild(card);
  }
}