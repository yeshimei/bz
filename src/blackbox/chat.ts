/**
 * 黑匣子对话面板（ticket 36/45）：bz-blackbox-open「黑匣子」中央弹窗（单例）。
 * 三层记忆对话（条目检索 + 人格档案 + 对话历史；v2 检索上下文含画像概要 + 命中条目关联事件标题，
 * 组装在 ai.chat 内，画像/事件未提炼时优雅降级与 v1 一致）；
 * 首开无历史时包仔本地自我介绍；底部「成长」区：最近复盘产物（含事件汇报/新人物提示）+ 手动复盘按钮。
 */
import type { App } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { createOverlay } from '../core/dom';
import { notice } from '../core/notice';
import { BlackBoxAI } from './ai';
import { BlackBoxDataManager } from './data';
import { manualReview } from './review';
import type { BlackBoxData, Review } from './types';

let appRef: App | null = null;
let dataManager: BlackBoxDataManager | null = null;
let maskEl: HTMLElement | null = null;
let popupEl: HTMLElement | null = null;
let escHandle: { unregister: () => void } | null = null;
let data: BlackBoxData | null = null;
let busy = false;

function manager(app: App): BlackBoxDataManager {
  if (!dataManager) dataManager = new BlackBoxDataManager(app);
  return dataManager;
}

/** 打开对话面板（幂等；已开则重新加载数据并刷新，保持与文件同步） */
export async function openBlackBoxChat(app: App): Promise<void> {
  appRef = app;
  if (maskEl) {
    maskEl.style.display = 'block';
    // 面板开着期间可能有其他写入（如新录入的内容/自动复盘）——重载刷新，避免旧快照显示与覆盖
    data = await manager(app).load();
    renderAll();
    return;
  }
  data = await manager(app).load();
  buildDOM();
  renderAll();
}

export function closeBlackBoxChat(): void {
  // mask 与 popup 是 body 下兄弟元素（createOverlay），必须同时移除——否则 popup 残留盖屏拦截点击
  if (maskEl) {
    maskEl.remove();
    maskEl = null;
  }
  if (popupEl) {
    popupEl.remove();
    popupEl = null;
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
    maxWidth: 560,
    onMaskClick: () => closeBlackBoxChat(),
  });
  maskEl = mask;
  popupEl = popup;
  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'block';
  popup.style.display = 'flex';

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
    // isComposing：中文输入法选词确认（Enter）不触发发送
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
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
    title.textContent = `🕳️ ${name} · 已收录 ${data.entries.length} 条内容`;
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
      `我是${p.name}，黑匣子的意识体。\n\n${p.seed}${self}\n\n现在黑匣子还是空的。把你觉得值得记住的东西喂进来吧——一个念头、一段摘抄、一个想搞懂的概念，我都会好好收着。`
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
    tip.textContent = '包仔会在每 10 条新内容后静静复盘，成长都会在这里。';
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
  el.appendChild(reviewCard(last));
  const reviewBtn = document.createElement('button');
  reviewBtn.className = 'bz-blackbox-btn bz-blackbox-review-btn';
  reviewBtn.textContent = '🕳️ 让包仔复盘一次';
  reviewBtn.addEventListener('click', () => void runManualReview(reviewBtn));
  el.appendChild(reviewBtn);
}

/** 复盘产物卡（v2：含事件汇报/新人物提示） */
function reviewCard(r: Review): HTMLElement {
  const card = document.createElement('div');
  card.className = 'bz-blackbox-growth-card';
  const time = document.createElement('div');
  time.className = 'bz-blackbox-growth-time';
  time.textContent = r.ts.slice(0, 16).replace('T', ' ');
  card.appendChild(time);
  const text = document.createElement('div');
  text.textContent = r.text;
  card.appendChild(text);
  if (r.eventReport) {
    const ev = document.createElement('div');
    ev.className = 'bz-blackbox-growth-report';
    ev.textContent = `🕐 ${r.eventReport}`;
    card.appendChild(ev);
  }
  if (r.profileHint) {
    const hint = document.createElement('div');
    hint.className = 'bz-blackbox-growth-report';
    hint.textContent = r.profileHint;
    card.appendChild(hint);
  }
  return card;
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
  // 重新加载最新数据：面板快照期间可能已有其他写入（新内容/复盘），旧快照整体写回会覆盖丢数据
  data = await m.load();
  await m.addChat(data, 'user', text, ts);
  renderChat();
  busy = true;
  if (sendBtn) sendBtn.disabled = true;
  const list = document.getElementById('bz-blackbox-chat-list');
  if (list) appendBubble(list, 'assistant', '…');
  try {
    const ai = new BlackBoxAI();
    const reply = await ai.chat(data, text);
    // 写前重载：AI 调用（长耗时）期间可能有其他写入（新内容/复盘），陈旧快照整体写回会覆盖丢数据
    data = await m.load();
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
