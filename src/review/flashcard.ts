/* ============================================================
 * bz · AI 抽认卡（review/flashcard.ts）
 *
 * 划线卡的默认提示是「书名 · 章节 + 划线开头一截」——它能让人想起「这段话
 * 大概在讲什么」，但想不起「具体说了什么」。抽认卡要的是**问题面**：一句
 * 不能照抄原文的问句，逼着脑子把那段话整个找回来。
 *
 * 三条硬约束（都来自「提示不能等于答案」）：
 *   1. 问句里不许出现原文片段。模型很爱写「文中说『红海早过了』，这指的是
 *      什么」——那等于把答案念了一遍。
 *   2. 问句要能独立读懂，不要求用户先看到原文。
 *   3. 拿不到合格问句就返回 null，由调用方退回内置提示。宁可给一条普通提示，
 *      也不要给一条把答案写进去的「提示」。
 *
 * 纯函数在这里，模型调用也在这里收口；会话层只决定「什么时候问」。
 * ============================================================ */
import type { AIService } from '../core/ai';
import type { ReviewCard } from './data';
import { parseLooseJson } from './loose-json';

/** 问句至少这么长：太短的（「这句话讲了什么」）没有回忆价值 */
const MIN_Q = 8;
/** 问句最多这么长：太长就变成阅读理解 */
const MAX_Q = 80;

/**
 * 拼提示词。
 *
 * 强调「不许复述原文」不是客气话：模型默认会写「划线中『XX』是什么意思」，
 * 那是把答案塞进问题里，复习就退化成认字。
 */
export function buildFlashcardPrompt(card: ReviewCard): string {
  const book = String(card.bookTitle ?? '').trim();
  const chapter = String(card.chapterTitle ?? '').trim();
  const where = chapter ? `《${book}》${chapter}` : `《${book}》`;
  return [
    '你是记忆卡片设计助手。下面是一条读书划线，请把它做成一张抽认卡。',
    '',
    '要求：',
    '1. 问题（q）必须是一个**不能照抄原文**的问句，引导人回忆这段话讲了什么、是在说什么事；',
    '2. 问题里**绝对不能出现划线里的词语或句子**（出现任何一个都算失败）；',
    '3. 问题要能独立读懂，不需要先看到原文；',
    `4. 问题长度 ${MIN_Q}~${MAX_Q} 个汉字；`,
    '5. 答案（a）就是划线原文，原样返回，不要改写。',
    '',
    '只输出一个 JSON 对象，不要解释、不要代码块：',
    '{"q": "问题", "a": "原文"}',
    '',
    `出处：${where}`,
    `划线原文：${card.text}`,
  ].join('\n');
}

/**
 * 从模型回复里取问答对。
 *
 * 宽容解析：模型经常包一层 ```json 或者前言后语，所以取第一个 `{` 到最后一个
 * `}`。解析不出来、字段缺失、问句里出现了原文片段——一律返回 null。
 */
export function parseFlashcard(reply: string, card: ReviewCard): { q: string; a: string } | null {
  const text = String(reply ?? '');
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first < 0 || last <= first) return null;

  const parsed: any = parseLooseJson(text.slice(first, last + 1));
  if (!parsed) return null;
  const q = String(parsed?.q ?? parsed?.question ?? '').trim();
  if (!q) return null;
  const a = String(parsed?.a ?? parsed?.answer ?? card.text ?? '').trim() || card.text;
  return checkQuestion(q, card) ? { q, a } : null;
}

/**
 * 问句合格吗。
 *
 * 最重要的一条：**问句里不能有原文的片段**。四字以上重合就算泄露——中文里
 * 四字足以把一句原话认出来。另外长度也有上下限。
 */
export function checkQuestion(q: string, card: ReviewCard): boolean {
  const len = Array.from(q).length;
  if (len < MIN_Q || len > MAX_Q) return false;
  const original = Array.from(String(card.text ?? '').trim());
  /* 短划线（<8 字）没法谈「泄露」：整句就那么几个字，问句里出现才叫泄露 */
  const span = original.length < 8 ? original.length : 4;
  if (span < 2) return true;
  for (let i = 0; i + span <= original.length; i += 1) {
    const piece = original.slice(i, i + span).join('');
    if (piece.trim() && q.includes(piece)) return false;
  }
  return true;
}

/**
 * 让模型出一道题。
 *
 * 任何失败都返回 null（没配 AI、网络断了、回复不合规）——调用方据此退回
 * 内置提示。这一层不打日志、不弹窗：复习进行中，用户不需要知道模型怎么了。
 */
export async function generateFlashcard(
  card: ReviewCard,
  makeAI: () => AIService | null,
  isCancelled?: () => boolean,
): Promise<{ q: string; a: string } | null> {
  let ai: AIService | null = null;
  try {
    ai = makeAI();
  } catch {
    return null;
  }
  if (!ai) return null;
  try {
    const reply = await ai.json(buildFlashcardPrompt(card));
    if (isCancelled?.()) return null;
    return parseFlashcard(String(reply ?? ''), card);
  } catch {
    return null;
  }
}
