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
import type { ReviewDataManager } from './data';
import type { ReviewAddOutcome, ReviewAddSummary } from './reader-api';
import { stripMdExt } from '../core/utils';

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
