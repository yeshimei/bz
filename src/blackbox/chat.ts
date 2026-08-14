/**
 * 黑匣子对话（ticket 63）：中央对话弹窗 + 三层记忆。
 * 三层记忆 = 日记条目 TF-IDF 检索（长期）+ 画像概要（名字+印象一句话+最近 3 个事件标题）+ 对话历史（短期）。
 * 包仔人设（种子 + 语气示例）代码常量；AI 不可用 → 文本检索兜底回复。
 */
import { escManager } from '../core/esc-manager';
import { createOverlay, createIconBtn } from '../core/dom';
import { getBlackBoxAI } from './ai';
import { notice } from '../core/notice';
import { BlackBoxDataManager } from './data';
import { scanAllDiaryEntries } from './diary-scan';
import { personLabel, trimChat } from './types';
import type { App } from 'obsidian';
import type { BlackBoxData, ChatMsg, DiarySourceEntry, EventItem, Profile } from './types';

/** 包仔人设（代码常量，ADR-0017：persona 段不落盘） */
export const DEFAULT_PERSONA = {
  name: '包仔',
  seed: '有诗心的思辨者——懂诗、爱琢磨、记性很好，把你日记里的每段日子都当成养分；深夜陪你说话，不吵你，但你想聊的时候他永远在。',
  toneExample: '你写茉莉花的时候是凌晨两点。我想知道，那晚的风，现在还在你记忆里吗？',
};

const MASK_ID = 'bz-blackbox-chat-mask';
const POPUP_ID = 'bz-blackbox-chat';

let mask: HTMLDivElement | null = null;
let popup: HTMLDivElement | null = null;
let msgsEl: HTMLDivElement | null = null;
let escHandle: { unregister: () => void } | null = null;
let _app: any = null;
let _ai: any = null;

/** 中文停用词（v1 沿用；TF-IDF 过滤） */
const STOPWORDS = new Set('的了是在我有和人这中大为上个国不以到说时要就出会也年对自其他里去子后也得着与把等'.split(''));

/** 分词（纯函数）：按字符切 + 停用词过滤 + 去重 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const ch of text.replace(/\s+/g, '')) {
    if (STOPWORDS.has(ch)) continue;
    if (/[\u4e00-\u9fa5a-zA-Z0-9]/.test(ch)) out.push(ch);
  }
  return out;
}

/**
 * TF-IDF 检索（纯函数）：查询词 → 条目评分（词频×逆文档频率），返回相关条目（降序）。
 */
export function searchDiaryEntries(entries: DiarySourceEntry[], query: string, topK = 5): DiarySourceEntry[] {
  if (!query || !query.trim() || !entries || !entries.length) return [];
  const qTokens = tokenize(query);
  if (!qTokens.length) return [];
  const N = entries.length;
  const docFreq: Record<string, number> = {};
  for (const e of entries) {
    const toks = new Set(tokenize(e.content));
    for (const t of toks) docFreq[t] = (docFreq[t] || 0) + 1;
  }
  const scored = entries.map((e) => {
    const toks = tokenize(e.content);
    let score = 0;
    for (const t of qTokens) {
      const tf = toks.filter((x) => x === t).length;
      if (tf === 0) continue;
      const df = docFreq[t] || 1;
      const idf = Math.log((N + 1) / (df + 1)) + 1;
      score += tf * idf;
    }
    return { e, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.e);
}

/** 画像概要（纯函数）：名字 + 印象一句话 + 最近 3 个事件标题 */
export function profilesSummary(profiles: Profile[], events: EventItem[]): string {
  if (!profiles.length) return '（暂无画像）';
  const sorted = events.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  return profiles
    .map((p) => {
      const recent = sorted.filter((ev) => ev.people.some((x) => x === p.id || x === p.name)).slice(0, 3);
      const evStr = recent.length ? '；最近：' + recent.map((ev) => ev.title).join('、') : '';
      return `- ${p.name}：${p.impression || '（暂无印象）'}${evStr}`;
    })
    .join('\n');
}

/**
 * 三层记忆拼接（纯函数）：检索片段（topK）+ 画像概要 + 对话历史（maxHistory 条）。
 */
export function buildChatContext(
  entries: DiarySourceEntry[],
  profiles: Profile[],
  events: EventItem[],
  history: ChatMsg[],
  query: string,
  maxHistory = 20
): string {
  const hits = searchDiaryEntries(entries, query, 5);
  const hitStr = hits.length ? hits.map((e) => `[${e.date} ${e.time}] ${e.content.slice(0, 200)}`).join('\n') : '（无相关日记）';
  const profileStr = profilesSummary(profiles, events);
  const recent = history.slice(-Math.max(1, maxHistory)).map((m) => `${m.role === 'user' ? '我' : '包仔'}：${m.content}`).join('\n');
  return `【我的日记（相关）】\n${hitStr}\n\n【我认识的人】\n${profileStr}\n\n【我们的对话】\n${recent || '（暂无）'}`;
}

/** 对话弹窗状态（escManager 层） */
function getChatState() {
  return {
    isVisible: () => !!popup && popup.style.display !== 'none',
    close: () => closeBlackBoxChat(),
  };
}

/** 打开对话弹窗（幂等） */
export function openBlackBoxChat(app: any, ai?: any): void {
  _app = app;
  _ai = ai || null;
  if (popup && popup.style.display !== 'none') return;
  if (!mask || !popup || !msgsEl) {
    if (mask && mask.parentNode) mask.parentNode.removeChild(mask);
    if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
    const ov = createOverlay({ maskId: MASK_ID, popupId: POPUP_ID, zIndex: 10000, onMaskClick: closeBlackBoxChat, width: '92%', maxWidth: 480 });
    mask = ov.mask;
    popup = ov.popup;
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    buildChat();
  }
  mask.style.display = 'flex';
  popup.style.display = 'block';
  escHandle = escManager.register(POPUP_ID, getChatState());
  void renderHistory();
}

function buildChat(): void {
  if (!popup) return;
  popup.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'bz-blackbox-header';
  const title = document.createElement('span');
  title.id = 'bz-blackbox-chat-title';
  title.textContent = '黑匣子 · 包仔';
  header.appendChild(title);
  header.appendChild(createIconBtn('❌', '关闭', () => closeBlackBoxChat()));
  popup.appendChild(header);
  msgsEl = document.createElement('div');
  msgsEl.id = 'bz-blackbox-chat-msgs';
  msgsEl.className = 'bz-chat-msgs';
  popup.appendChild(msgsEl);
  const inputRow = document.createElement('div');
  inputRow.className = 'bz-chat-input-row';
  const input = document.createElement('textarea');
  input.id = 'bz-blackbox-chat-input';
  input.placeholder = '和包仔说点什么…';
  inputRow.appendChild(input);
  const send = document.createElement('button');
  send.id = 'bz-blackbox-chat-send';
  send.textContent = '发送';
  send.onclick = () => void sendMessage();
  inputRow.appendChild(send);
  popup.appendChild(inputRow);
}

/** 渲染历史消息 */
async function renderHistory(): Promise<void> {
  if (!msgsEl) return;
  const dm = new BlackBoxDataManager();
  const data = await dm.load();
  if (!msgsEl) return;
  msgsEl.innerHTML = '';
  for (const m of data.chat) {
    const div = document.createElement('div');
    div.className = 'bz-chat-msg ' + (m.role === 'user' ? 'user' : 'assistant');
    div.textContent = m.content;
    msgsEl.appendChild(div);
  }
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

/** 发送消息（三层记忆 → AI 回复 → 落盘） */
async function sendMessage(): Promise<void> {
  if (!msgsEl || !popup) return;
  const input = popup.querySelector('#bz-blackbox-chat-input') as HTMLTextAreaElement;
  const text = (input.value || '').trim();
  if (!text) return;
  input.value = '';
  const dm = new BlackBoxDataManager();
  const data = await dm.load();
  const userMsg: ChatMsg = { role: 'user', content: text, ts: new Date().toISOString() };
  data.chat.push(userMsg);
  // 追加用户消息到 UI
  const uDiv = document.createElement('div');
  uDiv.className = 'bz-chat-msg user';
  uDiv.textContent = text;
  msgsEl.appendChild(uDiv);
  // 待回复占位
  const aDiv = document.createElement('div');
  aDiv.className = 'bz-chat-msg assistant';
  aDiv.textContent = '…';
  msgsEl.appendChild(aDiv);
  msgsEl.scrollTop = msgsEl.scrollHeight;
  try {
    const all = await scanAllDiaryEntries(_app);
    const maxHistory = Number((await getMaxHistory())) || 20;
    const ctx = buildChatContext(all, data.profiles, data.events, data.chat, text, maxHistory);
    const prompt = `${DEFAULT_PERSONA.seed}\n\n语气示例：${DEFAULT_PERSONA.toneExample}\n\n${ctx}\n\n我：${text}\n包仔：`;
    const service = _ai || getBlackBoxAI();
    const reply = await service.json(prompt);
    const clean = (reply || '').trim();
    aDiv.textContent = clean || '（没有回应）';
    const aiMsg: ChatMsg = { role: 'assistant', content: clean || '（没有回应）', ts: new Date().toISOString() };
    data.chat.push(aiMsg);
    data.chat = trimChat(data.chat, maxHistory);
    await dm.save(data);
  } catch {
    aDiv.textContent = '（AI 服务不可用，暂时无法回应）';
    notice('AI 服务不可用', 'warning');
  }
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

async function getMaxHistory(): Promise<number> {
  try {
    const { tryGetSettings } = await import('../core/settings-provider');
    const s = tryGetSettings() as any;
    const n = Number(s && s.blackboxMaxHistory);
    return n > 0 ? n : 20;
  } catch {
    return 20;
  }
}

/** 关闭对话弹窗 */
export function closeBlackBoxChat(): void {
  if (mask) mask.style.display = 'none';
  if (popup) popup.style.display = 'none';
  if (escHandle) {
    escHandle.unregister();
    escHandle = null;
  }
}

/** 卸载清理 */
export function unloadBlackBoxChat(): void {
  closeBlackBoxChat();
  if (mask && mask.parentNode) mask.parentNode.removeChild(mask);
  if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
  mask = null;
  popup = null;
  msgsEl = null;
  _app = null;
  _ai = null;
}