/**
 * 笔记库接入（ADR-0024/025 + 2026-08-23 用户拍板扩展）：
 *  1) 写日记/闪念 → 计入信任成长（轻质量 0.15）；
 *  2) 笔记库内容 = 小橘信息来源（全内容读取 + LLM 云端打分 + 词法情绪，用户拍板放开隐私边界）。
 * 接入面（用户 2026-08-23 拍板，context-source → index onVaultActivity + onDomainActivity）：
 *  - diary 日记：读正文，标记关键词和情绪，影响小橘情绪
 *  - flash 闪念：取完整内容，让小橘记住都写过什么
 *  - clipping 剪藏：记住完整的 AI 摘要
 *  - movie 影视：读影评完整正文
 *  - reading 书库：weve epub 划线（<span class="__comment cm-highlight">）、想法/书评（==dialogue== / bookReview）
 *  - poem 现代诗 / letter 信：完整内容（reflection 反省观察 ticket 083 彻底移除——不再产任何反省观察）
 *  - 域事件（memo/pomodoro/news/quiz/review/favorites/belongings）：CONFIG/STORAGE JSON 监听感知
 */
import type { App, TAbstractFile } from 'obsidian';
import { DIARY_DIRECTORY } from '../diary/config';
import { smartcatStorageDir } from './data';

// 'favorites'/'belongings'/'pomodoro' 加入联合仅供 onVaultActivity 防御性短接（ticket 078/079/080 方法监听：
// 收藏本/归物本/番茄钟是 JSON 数据域，classifyPath 对 .md 外的 JSON 显式短路，类型成员零运行时影响）
export type ActivityKind = 'diary' | 'flash' | 'clipping' | 'movie' | 'reading' | 'poem' | 'letter' | 'domain' | 'favorites' | 'belongings' | 'pomodoro' | null;

/** 默认 flash（卡片盒）目录（flash 域 ALLOW_PATHS 默认含卡片盒；可配目录后续扩展） */
const FLASH_DIR = '卡片盒';

/** 路径分类（只认 .md；日志目录经 diary/config 动态目录；现代诗/信/书库/影视按目录） */
export function classifyPath(path: string | null | undefined): ActivityKind {
  if (!path) return null;
  const p = path.replace(/\\/g, '/');
  // 番茄钟已改方法监听（ticket 080）：pomodoro.json 的 vault 事件显式短路（防域 JSON 事件双记录，对齐 movie 先例）
  // P2 硬编码路径修复：经 smartcatStorageDir() 动态拼装，跟随 storagePath 设置（默认仍 CONFIG/STORAGE）
  if (p === `${smartcatStorageDir()}/pomodoro.json`) return 'pomodoro';
  if (!p.endsWith('.md')) return null;
  const diaryDir = (DIARY_DIRECTORY || '我的/日记').replace(/\/+$/, '');
  if (p.startsWith(diaryDir + '/') || p.startsWith('我的/日记/')) return 'diary';
  if (p.startsWith(FLASH_DIR + '/')) return 'flash';
  if (p.startsWith('归档/网页剪藏')) return 'clipping';
  if (p.startsWith('我的/影视')) return 'movie';
  if (p.startsWith('书库')) return 'reading';
  if (p.startsWith('我的/现代诗')) return 'poem';
  if (p.startsWith('我的/信')) return 'letter';
  return null;
}

/** 关键词提取（用户拍板：日记标记关键词；中文轻量切分：词块 + 2-4 字 n-gram 双通道高频） */
export function extractKeywords(text: string, max = 5): string[] {
  if (!text) return [];
  const freq = new Map<string, number>();
  const bump = (w: string, wgt: number) => {
    if (w.length < 2 || w.length > 8) return;
    if (/^[\dA-Za-z]+$/.test(w) && w.length > 6) return; // 过长的纯字母数字跳过
    freq.set(w, (freq.get(w) || 0) + wgt);
  };
  // 通道一：按标点/空白切分的词块（含中文连续段整体）
  const stops = /[，。！？；：、\s\n（）()《》「」"'“”‘’\-—…·]/g;
  for (const w of text.replace(stops, ' ').split(/\s+/)) if (w) bump(w, 1);
  // 通道二：2-4 字 n-gram（覆盖未分词的中文）
  const flat = text.replace(stops, '');
  for (let i = 0; i + 2 <= flat.length; i++) {
    for (let len = 4; len >= 2; len--) {
      if (i + len > flat.length) continue;
      const g = flat.slice(i, i + len);
      if (/^[\dA-Za-z]+$/.test(g)) continue;
      bump(g, len === 2 ? 0.4 : len === 3 ? 0.7 : 1);
    }
  }
  const STOPS = new Set(['没有', '什么', '一个', '可以', '我们', '你们', '他们', '她们', '因为', '所以', '但是', '就是', '自己', '今天', '昨天', '明天', '还是', '已经', '这个', '那个', '时候', '现在', '觉得', '有点', '真的', '然后', '如果', '一直', '起来', '下来', '这样', '知道', '生活', '东西']);
  return [...freq.entries()]
    .filter(([k]) => !STOPS.has(k) && k.trim().length >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k);
}

/** 隐私分级观察文本（2026-08-23 用户拍板：全内容读取；失败/无内容返回 null，调用方静默） */
export async function observationText(app: App, file: TAbstractFile, kind: ActivityKind): Promise<string | null> {
  if (!kind) return null;
  const readAll = async (): Promise<string> => {
    try {
      const c = await app.vault.read(file as any);
      return c || '';
    } catch { return ''; }
  };
  switch (kind) {
    case 'flash': {
      // 用户拍板：闪念取完整内容（原只首行 ≤40）
      const full = (await readAll()).trim();
      return full ? '你在卡片盒记下闪念：' + full.slice(0, 300) : null;
    }
    case 'diary': {
      // ADR-0069 R3 双通道去重收缩：日记正文不再实时进 prompt（记忆目录按时间段拆条入库，
      // 正文进 prompt 改由记忆检索承担）——关键词标记保留（词法情绪/信任成长钩子不受影响）
      const full = (await readAll()).trim();
      if (!full) return null;
      const kws = extractKeywords(full);
      const kw = kws.length ? '（关键词：' + kws.join('、') + '）' : '';
      return '你写了日记' + kw;
    }
    case 'clipping': {
      // 用户拍板：记住完整的 AI 摘要
      const top = await readAll();
      // 优先 frontmatter summary；无则取全文摘要段（auto-summary 写 frontmatter，正文多为原文）
      const m = top.match(/^summary\s*[:：]\s*(.+)$/m);
      if (m) return '你剪藏了：' + m[1].trim().slice(0, 300);
      return top ? '你剪藏了一篇文章：' + top.replace(/^---[\s\S]*?---\s*/, '').trim().slice(0, 200) : null;
    }
    case 'movie': {
      // 用户拍板：读影评完整正文（原只片名+评分）
      const top = await readAll();
      const name = String((file as any).basename || '').replace(/^《(.+?)》.*$/, '$1');
      const body = top.replace(/^---[\s\S]*?---\s*/, '').trim() || '';
      const sc = top.match(/^评分\s*[:：]\s*(\d+)/m);
      const head = name && name !== String((file as any).basename || '') ? '《' + name + '》' : '影视';
      return '你看了' + head + (sc ? '（评分 ' + sc[1] + '）' : '') + '，影评：' + body.slice(0, 300);
    }
    case 'reading': {
      // 用户拍板：书库记划线、想法、书评（weve epub）
      const top = await readAll();
      if (!top) return null;
      const highlights = [...top.matchAll(/<span class="__comment cm-highlight"[^>]*>(.*?)<\/span>/g)].map((x) => x[1]).slice(0, 3);
      const dialogues = [...top.matchAll(/==dialogue==\s*\n([\s\S]*?)(?=\n==|$)/g)].map((x) => x[1].trim()).filter(Boolean).slice(0, 2);
      const review = top.match(/bookReview\s*[:：]\s*(.+)$/m)?.[1]?.trim();
      const name = String((file as any).basename || '').replace(/\.md$/, '');
      const parts: string[] = [];
      if (highlights.length) parts.push('划线：' + highlights.join('；').slice(0, 200));
      if (dialogues.length) parts.push('想法：' + dialogues.join('；').slice(0, 200));
      if (review) parts.push('书评：' + review.slice(0, 120));
      return parts.length ? '你读了《' + name + '》，' + parts.join('；') : '书库笔记《' + name + '》有更新';
    }
    case 'poem': {
      const full = (await readAll()).trim();
      return full ? '你写了现代诗：' + full.replace(/^---[\s\S]*?---\s*/, '').slice(0, 300) : null;
    }
    case 'letter': {
      const full = (await readAll()).trim();
      return full ? '你写了一封信：' + full.replace(/^---[\s\S]*?---\s*/, '').slice(0, 300) : null;
    }
    case 'pomodoro':
      return null; // 番茄钟观察走方法监听（ticket 080），事件通道短路于 onVaultActivity，不取文本
    case 'domain':
      return null; // 域事件由 index onDomainActivity 直接构造观察文本
  }
  return null;
}