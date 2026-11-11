/* ============================================================
 * bz · 划线卡的题库（review/card-quiz.ts）
 *
 * 一条划线也能出选择题，但它跟「一篇笔记出题」不是一回事：
 *
 *   · **题量跟着长短走**。一整段话能问出十来个角度，一句话只够问三道。
 *     所以按字数折算，最少 3 道、最多 15 道。
 *   · **一次生成、之后固定**。题库进了卡就存下来，每轮复习只从里面抽
 *     三分之一——每次都重新出题，等于每次都在做新卷子，复习就没有「温故」
 *     可言了。
 *   · **脏题不进会话**。四个选项、正确项索引 0~3，缺一条就丢；宁可少一道，
 *     也不能让用户点了个「没有正确答案」的选项。
 * ============================================================ */
import type { AIService } from '../core/ai';
import type { ReviewCard } from './data';
import type { QuizQuestion } from './quiz-core/manager';
import { parseLooseJson } from './loose-json';

/** 一道题最少要多少字才够问出东西 */
const CHARS_PER_QUESTION = 40;
export const QUIZ_MIN = 3;
export const QUIZ_MAX = 15;
/** 每轮抽多少：分母。3 = 抽三分之一 */
export const QUIZ_RATIO = 3;

/**
 * 这条划线出几道题。
 *
 * 短划线（几十字）保底 3 道，长段落按每 40 字一道往上加，15 道封顶——
 * 再多就不是考回忆，是考耐心。
 */
export function quizCountFor(text: string): number {
  const len = Array.from(String(text ?? '').trim()).length;
  if (!len) return QUIZ_MIN;
  const byLength = Math.round(len / CHARS_PER_QUESTION);
  return Math.min(QUIZ_MAX, Math.max(QUIZ_MIN, byLength));
}

/** 拼出题提示词：四选一、带一句解析、只输出 JSON */
export function buildCardQuizPrompt(card: ReviewCard, count: number): string {
  const book = String(card.bookTitle ?? '').trim();
  const chapter = String(card.chapterTitle ?? '').trim();
  const where = chapter ? `《${book}》${chapter}` : `《${book}》`;
  const idea = String(card.comment ?? '').trim();
  const n = Math.min(QUIZ_MAX, Math.max(QUIZ_MIN, Math.round(Number(count) || QUIZ_MIN)));
  return [
    `下面是一条读书划线（${where}），请据此出 ${n} 道四选一的选择题。`,
    '',
    '要求：',
    `1. 一共 ${n} 道，每题四个选项、有且只有一个正确答案；`,
    '2. 题目问的是划线里说了什么、为什么这么说，不要问「这段话出自哪本书」这种靠书名就能猜的；',
    '3. 干扰项要像真的，但必须能从划线内容判出真假；',
    '4. 每题带一句 explain：一句话解析正确答案，并点出原文依据；',
    '5. 只输出 JSON，不要解释、不要代码块。',
    '',
    '结构：',
    '{"questions":[{"question":"题目","options":["A","B","C","D"],"correctIndices":[0],"explain":"解析"}]}',
    '',
    idea ? `我当时的想法：${idea}` : '',
    `划线原文：${card.text}`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/** 一道题合不合格：题干非空、四个选项都非空、正确项索引都在 0~3 */
function validQuestion(raw: any): QuizQuestion | null {
  const question = String(raw?.question ?? '').trim();
  if (!question) return null;
  const options = Array.isArray(raw?.options) ? raw.options.map((o: any) => String(o ?? '').trim()) : [];
  if (options.length !== 4 || options.some((o: string) => !o)) return null;
  const indices = Array.isArray(raw?.correctIndices)
    ? raw.correctIndices.filter((i: any) => Number.isInteger(i) && i >= 0 && i <= 3)
    : [];
  const uniq = Array.from(new Set(indices)) as number[];
  if (!uniq.length) return null;
  const explain = String(raw?.explain ?? '').trim();
  return explain ? { question, options, correctIndices: uniq, explain } : { question, options, correctIndices: uniq };
}

/**
 * 从模型回复里取题目。
 *
 * 宽容解析（模型爱包一层代码块或前言），但校验不宽容：坏题整道丢掉。
 * 一道都不剩就返回 null——调用方据此说「这次没生成出来」，而不是拿空数组
 * 当成「题库是空的」。
 */
export function parseCardQuiz(reply: string, card: ReviewCard, limit = QUIZ_MAX): QuizQuestion[] | null {
  const text = String(reply ?? '');
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first < 0 || last <= first) return null;

  const parsed: any = parseLooseJson(text.slice(first, last + 1));
  if (!parsed) return null;
  const raw = parsed?.questions;
  if (!Array.isArray(raw) || !raw.length) return null;

  const cap = Math.max(1, Math.min(QUIZ_MAX, Math.round(Number(limit) || QUIZ_MAX)));
  const out: QuizQuestion[] = [];
  for (const item of raw) {
    if (out.length >= cap) break;
    const q = validQuestion(item);
    if (q) out.push(q);
  }
  return out.length ? out : null;
}

/**
 * 让模型出一次题。
 *
 * 任何失败都返回 null（没配 AI、网络断了、回复不合规）——调用方把这张卡
 * 降级成「展开全文」，不能因为题库没生成出来就复习不了。
 */
export async function generateCardQuiz(
  card: ReviewCard,
  makeAI: () => AIService | null,
  count?: number,
): Promise<QuizQuestion[] | null> {
  let ai: AIService | null = null;
  try {
    ai = makeAI();
  } catch {
    return null;
  }
  if (!ai) return null;
  const n = Math.min(QUIZ_MAX, Math.max(QUIZ_MIN, Math.round(Number(count) || quizCountFor(card.text))));
  try {
    const reply = await ai.json(buildCardQuizPrompt(card, n));
    return parseCardQuiz(String(reply ?? ''), card, n);
  } catch {
    return null;
  }
}

/**
 * 这一轮抽哪几道。
 *
 * 固定抽三分之一（至少一道）：题库 15 道就抽 5 道，3 道就抽 1 道。洗牌用
 * 调用方给的随机源，测试里好钉住。
 */
export function pickCardQuestions(
  list: readonly QuizQuestion[],
  ratio: number = QUIZ_RATIO,
  rand: () => number = Math.random,
): QuizQuestion[] {
  const all = Array.isArray(list) ? list.slice() : [];
  if (!all.length) return [];
  const r = Math.max(1, Math.round(Number(ratio) || QUIZ_RATIO));
  const k = Math.max(1, Math.ceil(all.length / r));
  for (let i = all.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, k);
}
