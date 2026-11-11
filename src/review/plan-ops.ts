/**
 * 复习计划对外操作（bz-reader 门面背后的纯逻辑，不碰界面、不碰全局单例）。
 *
 * 为什么要单独一层：复习条目的钥匙是**笔记文件的路径**（review.json 里存
 * filePath，复习时直接打开那篇笔记），所以「加一张卡片」在数据上就是
 * 「把一条文件路径塞进计划」。调用方（阅读器）在写文件之后立刻调这里，
 * 中间没有任何界面参与，逻辑放成纯函数才好被测试钉住。
 *
 * 三条口径：
 *   1. **不抛错**：文件不在、已经在计划里，一律收敛成结构化结果。跨插件
 *      调用里抛一条异常，阅读器那边只能弹一句看不懂的红字。
 *   2. **文件必须真的在 vault 里**：review 的 loadItems 会按路径查文件，
 *      查不到就标挂起（列表删除线、不进队列）——先检查再写，别造悬空条目。
 *   3. **批量走一趟读改写**：一次加入几十张卡片时，逐条 addItem 就是几十次
 *      全文件读写，慢到用户以为卡死。
 */
import type { App } from 'obsidian';
import type { ReviewCard, ReviewDataManager, ReviewItem } from './data';
import type { ReviewAddOutcome, ReviewAddSummary, ReviewNoteStatus } from './reader-api';
import { stripMdExt } from '../core/utils';
import { removeCardQuiz } from './card-quiz-store';

/** 路径规整：只留非空字符串（外部传 null / 数字 / 空白一律当没传） */
function cleanPath(path: unknown): string {
  return typeof path === 'string' ? path.trim() : '';
}

/** 文件名（不带 .md）：review 条目的 name 取自它，复习列表显示的就是这行字 */
function nameOf(path: string): string {
  return stripMdExt(path.split('/').pop() || '') || path;
}

/** 这篇笔记在不在复习计划里 */
export async function hasNote(dm: ReviewDataManager, path: string): Promise<boolean> {
  const p = cleanPath(path);
  if (!p) return false;
  const items = await dm.loadItems();
  return items.some((i) => i.filePath === p);
}

/** 加一篇笔记进计划 */
export async function addNote(dm: ReviewDataManager, app: App, path: string): Promise<ReviewAddOutcome> {
  const p = cleanPath(path);
  if (!p) return { added: false, reason: 'notFound' };
  if (!app.vault.getAbstractFileByPath(p)) return { added: false, reason: 'notFound' };
  /* 先查一次再 addItem：addItem 遇到重复会抛，而这里的重复是正常情况
     （用户点了两次「加入复习」），不该走异常分支 */
  const items = await dm.loadItems();
  if (items.some((i) => i.filePath === p)) return { added: false, reason: 'exists' };
  try {
    await dm.addItem(p, nameOf(p));
  } catch (e) {
    /* 查重判定到落盘之间被另一条路径抢先插入：同样按「已在计划里」处理 */
    if (e instanceof Error && e.message.includes('已在复习计划中')) return { added: false, reason: 'exists' };
    throw e;
  }
  return { added: true };
}

/**
 * 批量加。
 *
 * 返回三类计数而不是布尔：调用方要能说「加入 8 篇，3 篇已在计划中，
 * 1 篇文件找不到」，只说「成功」等于什么都没说。
 */
export async function addNotes(dm: ReviewDataManager, app: App, paths: readonly string[]): Promise<ReviewAddSummary> {
  const out: ReviewAddSummary = { added: 0, exists: 0, notFound: 0 };
  const items = await dm.loadItems();
  const have = new Set(items.map((i) => i.filePath));
  const seen = new Set<string>();
  const pending: Array<{ filePath: string; fileName: string }> = [];

  for (const raw of Array.isArray(paths) ? paths : []) {
    const p = cleanPath(raw);
    if (!p) {
      out.notFound += 1;
      continue;
    }
    /* 批内重复：同一批里传了两次同一张卡，第二次不该算「新增」 */
    if (seen.has(p)) {
      out.exists += 1;
      continue;
    }
    seen.add(p);
    if (have.has(p)) {
      out.exists += 1;
      continue;
    }
    if (!app.vault.getAbstractFileByPath(p)) {
      out.notFound += 1;
      continue;
    }
    pending.push({ filePath: p, fileName: nameOf(p) });
  }

  if (pending.length) {
    const res = await dm.addItems(pending);
    out.added = res.added;
    /* addItems 自己也会跳过已存在的：正常走不到，留着防两条路径口径分叉 */
    out.exists += res.skipped;
  }
  return out;
}

/** 移出一篇笔记；本来就不在返回 false（调用方据此说「它不在复习计划里」） */
export async function removeNote(dm: ReviewDataManager, path: string): Promise<boolean> {
  const p = cleanPath(path);
  if (!p) return false;
  const items = await dm.loadItems();
  if (!items.some((i) => i.filePath === p)) return false;
  await dm.removeItem(p);
  return true;
}

/**
 * 批量加划线卡。
 *
 * 与加笔记的区别：**不查文件**。卡片的内容就在条目里，没有路径可查——查了
 * 反而会把每一张都判成「文件不存在」。空钥匙 / 空原文算无效，与「已存在」
 * 一样计入 skipped，让调用方能说清「加了几张、跳过几张」。
 *
 * 返回里带 `addedKeys`：调用方据此只给**这次新进来的**卡生成 AI 内容，
 * 已经在计划里的卡不动（用户手点的「重新生成」才覆盖）。
 */
export async function addCards(dm: ReviewDataManager, cards: readonly ReviewCard[]): Promise<ReviewAddSummary> {
  const all = Array.isArray(cards) ? cards : [];
  const list = all.filter((c) => !!cleanPath(c?.key) && !!String(c?.text ?? '').trim());
  const out: ReviewAddSummary = { added: 0, exists: 0, notFound: all.length - list.length };
  if (!list.length) return out;
  const res = await dm.addCards(list);
  out.added = res.added;
  out.exists = res.skipped;
  if (res.keys.length) out.addedKeys = res.keys;
  return out;
}

/** 移出一张划线卡（按钥匙）；本来就不在返回 false。题库跟着一起清 */
export async function removeCard(dm: ReviewDataManager, key: string): Promise<boolean> {
  const k = cleanPath(key);
  if (!k) return false;
  const items = await dm.loadItems();
  if (!items.some((i) => i.filePath === k)) return false;
  await dm.removeItem(k);
  await removeCardQuiz(k);
  return true;
}

/**
 * 批量查排期现状。
 *
 * 一趟 loadItems 回答整批：阅读器的划线面板一次要问几十条，逐条查就是几十次
 * 读盘。返回顺序与入参一致，调用方按下标对齐即可；`path` 原样回传（含空串），
 * 免得调用方还得自己维护「第几条对应哪个路径」。
 *
 * 没进计划的条目给空态而不是省略——省略会让调用方拿不到对应关系。
 */
export async function statusOf(dm: ReviewDataManager, paths: readonly string[]): Promise<ReviewNoteStatus[]> {
  const list = Array.isArray(paths) ? paths : [];
  if (!list.length) return [];
  const items = await dm.loadItems();
  const byPath = new Map<string, ReviewItem>();
  for (const it of items) byPath.set(it.filePath, it);

  return list.map((raw) => {
    const p = cleanPath(raw);
    const it = p ? byPath.get(p) : undefined;
    if (!it) {
      return {
        path: typeof raw === 'string' ? raw : '',
        planned: false,
        nextReviewDate: null,
        stage: 0,
        phase: 'ladder' as const,
        totalReviews: 0,
      };
    }
    return {
      path: typeof raw === 'string' ? raw : p,
      planned: true,
      nextReviewDate: it.nextReviewDate ?? null,
      stage: Number.isFinite(it.stage) ? it.stage : 0,
      phase: it.phase === 'fsrs' ? ('fsrs' as const) : ('ladder' as const),
      totalReviews: Number.isFinite(it.totalReviews) ? it.totalReviews : 0,
    };
  });
}
