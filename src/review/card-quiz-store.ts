/* ============================================================
 * bz · 卡片题库落盘（review/card-quiz-store.ts）
 *
 * 题库不进 review.json。那个文件是整份读写的：一条长划线加十几道题就是好几
 * KB，一千张卡能把它撑到十几兆，每次排期改动都要整体过一遍。所以单开一个
 * `review-quiz.json`，按卡片钥匙索引。
 *
 * 两条口径：
 *   · **钥匙就是卡片钥匙**（`reader:<bookId>:<highlightId>`），跟排期表里那条
 *     完全是同一个字符串——查题库只需要这一个字段。
 *   · **卡片移出计划时顺手清掉题库**。不清的话，反复加/移同一段划线，旧题会
 *     一直堆在这个文件里，谁也不知道它还有没有主人。
 * ============================================================ */
import { enqueueFileTask, jsonFileStore, storageFile } from '../core/storage';
import { tryGetSettings } from '../core/settings-provider';
import type { QuizQuestion } from './quiz-core/manager';

export const CARD_QUIZ_FILE = 'review-quiz.json';

/** 题库文件路径（与 review.json 同 storagePath 口径） */
export function getCardQuizFilePath(): string {
  const s = tryGetSettings() as any;
  return storageFile(CARD_QUIZ_FILE, (s && s.storagePath) || 'CONFIG/STORAGE');
}

/** 一张卡的题库；at = 生成时间（重生成时更新） */
export interface CardQuizEntry {
  questions: QuizQuestion[];
  at: number;
}

/** 整个文件：钥匙 → 题库 */
export type CardQuizBank = Record<string, CardQuizEntry>;

/** 读整份题库；坏文件按空处理（题库丢了最多重新生成，不该拦住复习） */
async function readBank(): Promise<CardQuizBank> {
  try {
    const data = await jsonFileStore<CardQuizBank>(getCardQuizFilePath(), { defaultValue: () => ({}) }).read();
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function cleanKey(key: unknown): string {
  return typeof key === 'string' ? key.trim() : '';
}

/** 取一张卡的题库；没有/空返回 null（调用方据此决定「要不要先生成」） */
export async function getCardQuiz(key: string): Promise<QuizQuestion[] | null> {
  const k = cleanKey(key);
  if (!k) return null;
  const bank = await readBank();
  const entry = bank[k];
  return Array.isArray(entry?.questions) && entry.questions.length ? entry.questions : null;
}

/** 一次取多张（复习队列里一次问几十条，不逐条读盘） */
export async function getCardQuizzes(keys: readonly string[]): Promise<Record<string, QuizQuestion[]>> {
  const bank = await readBank();
  const out: Record<string, QuizQuestion[]> = {};
  for (const raw of Array.isArray(keys) ? keys : []) {
    const k = cleanKey(raw);
    const list = bank[k]?.questions;
    if (k && Array.isArray(list) && list.length) out[k] = list;
  }
  return out;
}

/** 覆盖写一张卡的题库（重新生成就是覆盖，不是追加） */
export async function saveCardQuiz(key: string, questions: readonly QuizQuestion[]): Promise<void> {
  const k = cleanKey(key);
  const list = Array.isArray(questions) ? questions.filter((q) => q && q.question && Array.isArray(q.options)) : [];
  if (!k || !list.length) return;
  await enqueueFileTask(getCardQuizFilePath(), async () => {
    const bank = await readBank();
    bank[k] = { questions: list.map((q) => ({ ...q })), at: Date.now() };
    await jsonFileStore<CardQuizBank>(getCardQuizFilePath()).write(bank);
  });
}

/** 清掉一张卡的题库（卡片移出计划时调；没有就静默跳过） */
export async function removeCardQuiz(key: string): Promise<void> {
  const k = cleanKey(key);
  if (!k) return;
  await enqueueFileTask(getCardQuizFilePath(), async () => {
    const bank = await readBank();
    if (!bank[k]) return false;
    delete bank[k];
    await jsonFileStore<CardQuizBank>(getCardQuizFilePath()).write(bank);
    return true;
  });
}
