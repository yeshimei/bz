/**
 * 游戏库（gameshelf）域后台全量回填（2026-09-18 用户拍板）：
 * **商店资料 + 成就三键 → 笔记属性**，不等用户逐款点开详情弹窗。
 *
 * 做法（同 names.ts 的串行队列范式）：
 * - 只回填 frontmatter 里**没有 `详情时间`** 的条目——这是幂等标记，手动点过详情
 *   弹窗的也算已回填（弹窗写回时带同一个标记），不会重复请求；
 * - 每条之间留 `BACKFILL_INTERVAL_MS` 间隔（appdetails 一次只能一个 appid，
 *   别打连发；147 款全程约 3-5 分钟，一次性）；
 * - **连错 3 条就停**（商店不可达时别把队列跑成雪崩；下次开面板/同步会重新排队）；
 * - 每条 = 商店资料（storeToFm 全字段，含 `详情时间` 标记）→ 有成就页再拉成就
 *   三键（成就失败不阻塞：资料已成，成就下次点详情会补）。
 *
 * 为什么独立于同步：同 names.ts —— 同步走 api.steampowered.com（需代理），回填走
 * store.steampowered.com（直连可达），两条通道可用性互不影响，混跑会互相连坐。
 */
import type { App, TFile } from 'obsidian';
import { loadAchievements, loadStore, safeDetailFm } from './detail';
import { M, type GameItem } from './state';

/** 队列条目间隔（毫秒） */
export const BACKFILL_INTERVAL_MS = 900;
/** 连续失败上限：到此为止，剩下的下次开面板再试 */
export const BACKFILL_MAX_FAILURES = 3;

interface Job {
  app: App;
  item: GameItem;
  file: TFile | null;
}

const queue: Job[] = [];
const queued = new Set<number>();
let running = false;
let failures = 0;
let intervalMs = BACKFILL_INTERVAL_MS;
let rerenderTimer: ReturnType<typeof setTimeout> | null = null;

/** 队列节奏（毫秒；测试调到 0 免得等 147×0.9s） */
export function setBackfillInterval(ms: number): void {
  intervalMs = Math.max(0, ms);
}

function drainQueue(): void {
  while (queue.length > 0) queued.delete(queue.shift()!.item.appid);
}

/** 节流重渲（统计页的成就覆盖数会随回填变化；1.2s 尾沿，别每条都整页重画） */
function scheduleRerender(): void {
  if (rerenderTimer) clearTimeout(rerenderTimer);
  rerenderTimer = setTimeout(() => {
    rerenderTimer = null;
    M.renderFn?.();
  }, 1200);
}

/** 把还没回填过详情的条目入队（幂等；调用方为面板打开 / 同步完成） */
export function ensureBackfill(app: App, items: GameItem[]): void {
  let added = 0;
  for (const it of items) {
    if (queued.has(it.appid)) continue;
    const fm = safeDetailFm(app, it.file);
    if (fm['详情时间']) continue;
    queued.add(it.appid);
    queue.push({ app, item: it, file: it.file });
    added += 1;
  }
  if (added > 0 && !running) void runQueue();
}

async function runQueue(): Promise<void> {
  running = true;
  failures = 0;
  while (queue.length > 0) {
    if (failures >= BACKFILL_MAX_FAILURES) {
      drainQueue();
      break;
    }
    const job = queue.shift()!;
    try {
      const store = await loadStore(job.app, job.item, safeDetailFm(job.app, job.file));
      if (store.error) {
        failures += 1;
      } else {
        failures = 0;
        // 成就三键尽力而为：资料已成（详情时间已写）就不会再整款重试，
        // 成就缺失下次点开详情弹窗时会补
        if (job.item.hasAch) {
          await loadAchievements(job.app, job.item, safeDetailFm(job.app, job.file)).catch(() => undefined);
        }
        scheduleRerender();
      }
    } catch (e) {
      failures += 1;
      console.warn('bz 游戏库：详情回填异常:', job.item.name, e);
    } finally {
      queued.delete(job.item.appid);
    }
    if (queue.length > 0) await sleep(intervalMs);
  }
  running = false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 卸载清空（main.ts onunload / closePanel 收尾时调用） */
export function unloadBackfill(): void {
  queue.length = 0;
  queued.clear();
  failures = 0;
  if (rerenderTimer) {
    clearTimeout(rerenderTimer);
    rerenderTimer = null;
  }
  running = false;
}
