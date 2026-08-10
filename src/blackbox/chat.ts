/**
 * 黑匣子对话面板（ticket 36）：bz-blackbox-open「黑匣子」中央弹窗（单例）。
 * 三层记忆对话（感触检索 + 人格档案 + 对话历史）；首开无历史时包仔本地自我介绍；
 * 底部「成长」区：最近复盘产物 + 手动复盘按钮（复盘产物公开写入对话，静默执行不打扰）。
 */
import type { App } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { createOverlay } from '../core/dom';
import { notice } from '../core/notice';
import { BlackBoxAI } from './ai';
import { BlackBoxDataManager } from './data';
import { manualReview } from './review';
import type { BlackBoxData } from './types';

let appRef: App | null = null;
let dataManager: BlackBoxDataManager | null = null;
let maskEl: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;
let data: BlackBoxData | null = null;
let busy = false;

function manager(app: App): BlackBoxDataManager {
  if (!dataManager) dataManager = new BlackBoxDataManager(app);
  return dataManager;
}

/** 打开对话面板（幂等；已开则仅确保显示） */
export async function openBlackBoxChat(app: App): Promise<void> {
  appRef = app;
  if (maskEl) {
    maskEl.style.display = 'block';
    return;
  }
  data = await manager(app).load();
  buildDOM();
  renderAll();
}

export function closeBlackBoxChat(): void {
  if (maskEl) {
    maskEl.remove();
    maskEl = null;
  }
  if (escHandle) {
    escHandle.unregister();
    escHandle = null;
  }
}

export function unloadBlackBoxChat(): void {
  closeBlackBoxChat();
  data = null;
  dataManager = null;
  appRef = null;
}

// ---------------- DOM ----------------

function buildDOM(): void {
  const { mask, popup } = createOverlay({
    maskId: 'bz-blackbox-chat-mask',
    popupId: 'bz-blackbox-chat-popup',
    zIndex: 10040,
    width: '560px',
    onMaskClick: () => closeBlackBoxChat(),
  });
  maskEl = mask;
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';

  // header
  const header = document.createElement('div');
  header.className = 'bz-blackbox-modal-header';
  const title = document.createElement('span');
  title.id = 'bz-blackbox-chat-title';
  header.appendChild(title);
  const closeBtn = document.createElement('button');
  closeBtn.className = 'bz-blackbox-modal-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => closeBlackBoxChat());
  header.appendChild(closeBtn);
  popup.appendChild(header);

  // 消息列表
  const list = document.createElement('div');
  list.id = 'bz-blackbox-chat-list';
  list.className = 'bz-blackbox-chat-list';
  popup.appendChild(list);

  // 成长区（复盘产物 + 手动复盘）
  const growth = document.createElement('div');
  growth.id = 'bz-blackbox-growth';
  growth.className = 'bz-blackbox-growth';
  popup.appendChild(growth);

  // 输入区
  const inputRow = document.createElement('div');
  inputRow.className = 'bz-blackbox-chat-input-row';
  const input = document.createElement('textarea');
  input.id = 'bz-blackbox-chat-input';
  input.className = 'bz-blackbox-chat-input';
  input.placeholder = '和包仔说点什么…';
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  });
  const sendBtn = document.createElement('button');
  sendBtn.id = 'bz-blackbox-chat-send';
  sendBtn.textContent = '发送';
  sendBtn.className = 'bz-blackbox-btn bz-blackbox-btn-primary';
  sendBtn.addEventListener('click', () => void send());
  inputRow.append(input, sendBtn);
  popup.appendChild(inputRow);

  escHandle = escManager.register('blackbox-chat', { isVisible: () => !!maskEl, close: () => closeBlackBoxChat() });
}

function renderAll(): void {
  if (!data) return;
  const title = document.getElementById('bz-blackbox-chat-title');
  if (title) {
    const name = data.persona?.name || '包仔';
    title.textContent = `🕳️ ${name} · 已收录 ${data.impressions.length} 条感触`;
  }
  renderChat();
  renderGrowth();
}

function renderChat(): void {
  const list = document.getElementById('bz-blackbox-chat-list');
  if (!list || !data) return;
  list.innerHTML = '';
  const msgs = data.chat;
  if (msgs.length === 0) {
    // 首开欢迎：本地组装（不调 AI）
    const p = data.persona;
    const self = p.selfViews.length ? `\n\n${p.selfViews[p.selfViews.length - 1].view}` : '';
    appendBubble(
      list,
      'assistant',
      `我是${p.name}，黑匣子的意识体。\n\n${p.seed}${self}\n\n现在黑匣子还是空的。把你觉得值得记住的东西喂进来吧——别人的一句话、你心里的一阵风，我都会好好收着。`
    );
    return;
  }
  for (const m of msgs) {
    appendBubble(list, m.role, m.text);
  }
  list.scrollTop = list.scrollHeight;
}

function appendBubble(list: HTMLElement, role: 'user' | 'assistant', text: string): void {
  const div = document.createElement('div');
  div.className = `bz-blackbox-bubble bz-blackbox-bubble-${role}`;
  const label = document.createElement('div');
  label.className = 'bz-blackbox-bubble-label';
  label.textContent = role === 'assistant' ? '包仔' : '你';
  div.appendChild(label);
  const body = document.createElement('div');
  body.className = 'bz-blackbox-bubble-body';
  body.textContent = text;
  div.appendChild(body);
  list.appendChild(div);
}

function renderGrowth(): void {
  const el = document.getElementById('bz-blackbox-growth');
  if (!el || !data) return;
  el.innerHTML = '';
  if (data.reviews.length === 0) {
    const tip = document.createElement('div');
    tip.className = 'bz-blackbox-growth-tip';
    tip.textContent = '包仔会在每 10 条新感触后静静复盘，成长都会在这里。';
    el.appendChild(tip);
    const reviewBtn = document.createElement('button');
    reviewBtn.className = 'bz-blackbox-btn bz-blackbox-review-btn';
    reviewBtn.textContent = '🕳️ 让包仔复盘一次';
    reviewBtn.addEventListener('click', () => void runManualReview(reviewBtn));
    el.appendChild(reviewBtn);
    return;
  }
  const head = document.createElement('div');
  head.className = 'bz-blackbox-growth-head';
  head.textContent = '🌱 包仔的成长';
  el.appendChild(head);
  const last = data.reviews[data.reviews.length - 1];
  const card = document.createElement('div');
  card.className = 'bz-blackbox-growth-card';
  const time = document.createElement('div');
  time.className = 'bz-blackbox-growth-time';
  time.textContent = last.ts.slice(0, 16).replace('T', ' ');
  card.appendChild(time);
  const text = document.createElement('div');
  text.textContent = last.text;
  card.appendChild(text);
  el.appendChild(card);
  const reviewBtn = document.createElement('button');
  reviewBtn.className = 'bz-blackbox-btn bz-blackbox-review-btn';
  reviewBtn.textContent = '🕳️ 让包仔复盘一次';
  reviewBtn.addEventListener('click', () => void runManualReview(reviewBtn));
  el.appendChild(reviewBtn);
}

// ---------------- 发送与复盘 ----------------

async function send(): Promise<void> {
  if (!appRef || !data || busy) return;
  const input = document.getElementById('bz-blackbox-chat-input') as HTMLTextAreaElement;
  const sendBtn = document.getElementById('bz-blackbox-chat-send') as HTMLButtonElement;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  const ts = new Date().toISOString();
  const m = manager(appRef);
  await m.addChat(data, 'user', text, ts);
  renderChat();
  busy = true;
  if (sendBtn) sendBtn.disabled = true;
  const list = document.getElementById('bz-blackbox-chat-list');
  if (list) appendBubble(list, 'assistant', '…');
  try {
    const ai = new BlackBoxAI();
    const reply = await ai.chat(data, text);
    await m.addChat(data, 'assistant', reply, new Date().toISOString());
  } catch (e) {
    console.warn('黑匣子对话失败', e);
    notice('❌ 包仔暂时没法说话（AI 未配置或网络异常）', 'error');
  } finally {
    busy = false;
    if (sendBtn) sendBtn.disabled = false;
    renderChat();
  }
}

async function runManualReview(btn: HTMLButtonElement): Promise<void> {
  if (!appRef || !data) return;
  btn.disabled = true;
  const oldText = btn.textContent;
  btn.textContent = '⏳ 复盘进行中…';
  const text = await manualReview(appRef);
  // 复盘产物公开写入对话面板（若成功且为成长区刷新）
  if (text) {
    data = await manager(appRef).load();
    renderAll();
  }
  btn.disabled = false;
  btn.textContent = oldText;
}
