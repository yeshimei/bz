/**
 * 黑匣子三标签面板（ticket 59 骨架；60/61 精化）：
 * 人物墙 / 事件时间线 / 复盘流 + 打开时即时提炼（Q8）。
 * 自建 DOM（createOverlay + escManager），样式类 bz-blackbox-*（styles.css）。
 */
import { escManager } from '../core/esc-manager';
import { createOverlay, createIconBtn } from '../core/dom';
import { BlackBoxDataManager } from './data';
import { processPendingEntries } from './sync';
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

// ===== 人物墙（ticket 61 精化；59 骨架 = 简单卡） =====

function renderProfiles(data: BlackBoxData): void {
  if (!contentEl) return;
  if (!data.profiles.length) {
    contentEl.appendChild(emptyEl('暂无人物画像'));
    return;
  }
  for (const p of data.profiles) {
    const card = document.createElement('div');
    card.className = 'bz-profile-card';
    const name = document.createElement('div');
    name.className = 'bz-profile-name';
    name.textContent = p.name;
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
    meta.textContent = `提及 ${p.mentionCount} 次 · ${p.firstSeen} ~ ${p.lastSeen}`;
    card.appendChild(meta);
    contentEl!.appendChild(card);
  }
}

// ===== 事件时间线（ticket 60 精化；59 骨架 = 简单列表） =====

function renderEvents(data: BlackBoxData): void {
  if (!contentEl) return;
  const events = data.events.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
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
    if (ev.emotions.length) {
      const emo = document.createElement('div');
      emo.className = 'bz-event-emotions';
      emo.textContent = ev.emotions.join(' ');
      card.appendChild(emo);
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