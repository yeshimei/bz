/* ============================================================
 * bz · 划线卡的 AI 内容（review/card-ai.ts）
 *
 * 复习计划这边只认三种方式，内容一律在**加入计划那一刻**生成一次，之后固定
 * 在卡上：抽认卡存一句问句，做题存一份题库，展开全文什么都不存。
 *
 * 两条口径：
 *   · **只生成一次**。卡上已经有当前方式要用的东西就跳过——每轮复习都重新
 *     问模型，既慢又变味（题库会漂移，复习就没法比较）。
 *   · **串行排队**。整本书一次加几十条划线时，逐张并发打模型只会一起超时。
 *     这里排成一条队，一张一张来，一张失败不影响后面；用户该看到的「已加入」
 *     早就返回了，生成在后台继续。
 * ============================================================ */
import { createAI, type AIService } from '../core/ai';
import { tryGetSettings } from '../core/settings-provider';
import type { ReviewCard } from './data';
import type { QuizQuestion } from './quiz-core/manager';
import { generateFlashcard } from './flashcard';
import { generateCardQuiz } from './card-quiz';

/** 划线卡的三种复习方式 */
export type CardMode = 'flashcard' | 'quiz' | 'plain';

/** 当前设置选的是哪种；没设过/脏值一律按抽认卡 */
export function cardModeOf(settings?: any): CardMode {
  const raw = (settings ?? tryGetSettings())?.reviewCardMode;
  if (raw === 'quiz' || raw === 'plain') return raw;
  return 'flashcard';
}

/** 每轮抽题比例（分母）：2=一半、3=三分之一、4=四分之一 */
export function cardQuizRatioOf(settings?: any): number {
  const n = Math.round(Number((settings ?? tryGetSettings())?.reviewCardQuizRatio) || 3);
  return Math.min(4, Math.max(2, n));
}

/** 生成一张卡需要的全部外部能力（测试里注入假的就行） */
export interface CardPrepareContext {
  mode: CardMode;
  /** 按钥匙读回卡的最新内容（排期表可能刚被别处改过） */
  loadCard: (key: string) => Promise<ReviewCard | null>;
  updateCard: (key: string, patch: Partial<ReviewCard>) => Promise<unknown>;
  loadQuiz: (key: string) => Promise<QuizQuestion[] | null>;
  saveQuiz: (key: string, questions: QuizQuestion[]) => Promise<void>;
  /** 建 AI 服务；没配好时返回 null（不许抛） */
  makeAI: () => AIService | null;
}

/** 包一层 createAI：没配 AI 时它可能抛，这里统一收成 null */
export function safeMakeAI(): AIService | null {
  try {
    return createAI();
  } catch {
    return null;
  }
}

/**
 * 给一张卡补齐当前方式要用的内容。
 *
 * 返回「这次真的生成了吗」——调用方据此决定要不要刷新界面。`force` 为 true
 * 时无视已有内容覆盖（「重新生成」按钮），否则已有就跳过。
 */
export async function ensureCardContent(
  card: ReviewCard,
  ctx: CardPrepareContext,
  force = false,
): Promise<boolean> {
  if (!card?.key) return false;
  if (ctx.mode === 'plain') return false;

  if (ctx.mode === 'flashcard') {
    if (!force && String(card.qa?.q ?? '').trim()) return false;
    const res = await generateFlashcard(card, ctx.makeAI);
    if (!res?.q) return false;
    await ctx.updateCard(card.key, { qa: { q: res.q, a: res.a, at: Date.now() } });
    return true;
  }

  if (!force) {
    const have = await ctx.loadQuiz(card.key);
    if (have && have.length) return false;
  }
  const list = await generateCardQuiz(card, ctx.makeAI);
  if (!list?.length) return false;
  await ctx.saveQuiz(card.key, list);
  return true;
}

/** 正在排队/生成中的钥匙（同一张卡被连点两次不排两遍） */
const pending = new Set<string>();
/** 串行链：一张一张来，避免整本书加入时几十个请求一起打出去 */
let chain: Promise<void> = Promise.resolve();

/**
 * 后台排队给若干张卡补内容。
 *
 * 返回的是队列的尾巴，测试里可以直接 await；正常调用方不用等（`void` 掉），
 * 「已加入」的反馈不该卡在模型上。
 */
export function queueCardPreparation(
  keys: readonly string[],
  ctx: CardPrepareContext,
  force = false,
): Promise<void> {
  const list = Array.from(new Set((Array.isArray(keys) ? keys : []).map((k) => String(k ?? '').trim()).filter(Boolean)));
  const todo = list.filter((k) => !pending.has(k));
  if (!todo.length) return chain;
  for (const k of todo) pending.add(k);
  chain = chain.then(async () => {
    for (const key of todo) {
      try {
        const card = await ctx.loadCard(key);
        if (card) await ensureCardContent(card, ctx, force);
      } catch {
        /* 一张失败不影响后面：卡片本身还在，复习时还能退回普通提示 */
      } finally {
        pending.delete(key);
      }
    }
  });
  return chain;
}

/** 当前还有几张在排队（面板刷新/测试断言用） */
export function pendingCardCount(): number {
  return pending.size;
}
