/**
 * 游戏库（gameshelf）域中文名回填（2026-09-17）。
 *
 * 问题：Steam 的 GetOwnedGames 只给**英文名**（Balatro / Deep Rock Galactic），
 * 中文名只能问商店接口（`appdetails?l=schinese` 的 `name` → 小丑牌 / 深岩银河）。
 *
 * 做法（同域 posters.ts 的串行队列范式，手感一致）：
 * - 只回填 frontmatter 里**没有 `中文名`** 的条目——拉过即写、写后不再问，幂等；
 * - 每条之间留 `ZH_NAME_INTERVAL_MS` 间隔（不给商店接口打连发）；
 * - **连错 3 条就停**（商店不可达时别把队列跑成雪崩；下次开面板会重新排队）；
 * - 每成功一条 → 就地更新内存条目 + 节流重渲（1.2s 尾沿）→ 封面墙上的名字渐进换成中文。
 *
 * 为什么不在同步时顺手拉：同步走 `api.steampowered.com`（需代理），而中文名走
 * `store.steampowered.com`（直连可达）——两条通道的可用性互不影响，混在一起会让
 * 「代理没开」连带把中文名也拉不到。分开跑，各自失败各自退化。
 */
import type { App, TFile } from 'obsidian';
import { notify } from '../core/notice';
import { upsertDetail } from './notes';
import { M, type GameItem } from './state';
import { fetchZhName } from './steam';
import { GS_FM, QUEUE_HALTED_NOTICE, QUEUE_HALTED_DEDUPE_KEY } from './constants';

/** 队列条目间隔（毫秒） */
export const ZH_NAME_INTERVAL_MS = 900;
/** 连续失败上限：到此为止，剩下的下次开面板再试 */
export const ZH_NAME_MAX_FAILURES = 3;

/**
 * 会话级负缓存（深审 F7）：Steam 未做本地化的款（商店返回 = 原名，如 Bongo Cat）记入，
 * 本会话不再重拉——此前只更新内存条目的 zhName，rebuildItems 整表换新后标记即丢，
 * 每开面板对这批游戏各重发一次商店请求，永不收敛。
 * 只记内存不落盘：插件重载后重试一轮，Steam 后来补了官方中文名的款能自愈；
 * 落盘负标记（或把英文名写进「中文名」）反而把这条自愈路堵死。
 * 面板关开不清（unloadZhNames 不动它）——一清就回到「每开面板重拉一轮」；随插件卸载整个模块态消亡。
 */
const noLocale = new Set<number>();

/** 测试隔离用：清空会话级负缓存 */
export function resetZhNameNoLocale(): void {
  noLocale.clear();
}

interface Job {
  app: App;
  item: GameItem;
  file: TFile | null;
}

const queue: Job[] = [];
const queued = new Set<number>();
let running = false;
let failures = 0;
let intervalMs = ZH_NAME_INTERVAL_MS;
let rerenderTimer: ReturnType<typeof setTimeout> | null = null;

/** 队列节奏（毫秒；测试调到 0 免得等 147×0.9s） */
export function setZhNameInterval(ms: number): void {
  intervalMs = Math.max(0, ms);
}

/** 清空排队（停止本轮时调用：剩余条目退出 queued，下次 ensureZhNames 才会重新入队） */
function drainQueue(): void {
  while (queue.length > 0) queued.delete(queue.shift()!.item.appid);
}

/** 把缺中文名的条目入队（幂等；调用方为面板打开 / 同步完成） */
export function ensureZhNames(app: App, items: GameItem[]): void {
  let added = 0;
  for (const it of items) {
    if (it.zhName) continue;
    if (noLocale.has(it.appid)) continue; // F7：本会话已确认 Steam 无本地化，不再白拉
    if (queued.has(it.appid)) continue;
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
    if (failures >= ZH_NAME_MAX_FAILURES) {
      drainQueue();
      // 熔断人话收尾（S2）：此前只有 console，用户视角「中文名一直是英文」无一字出口。
      // 与 backfill 共用文案与 dedupeKey——同窗熔断原地合并，不刷屏；下次开面板幂等续跑
      notify(QUEUE_HALTED_NOTICE, { type: 'warning', dedupeKey: QUEUE_HALTED_DEDUPE_KEY });
      break;
    }
    const job = queue.shift()!;
    try {
      const r = await fetchZhName(job.item.appid);
      if (r.ok) {
        failures = 0;
        // 先更新内存（列表立刻能显示），再落盘（写回失败也不影响本次会话的显示）
        job.item.zhName = r.data;
        // Steam 没做本地化时返回的还是英文名（如 Bongo Cat）——记会话负缓存（F7），
        // **不写盘**：把英文名写成「中文名」是脏数据，而且会让笔记属性看不出到底
        // 有没有本地化、还堵死 Steam 后补本地化的自愈路。
        if (r.data === job.item.name) noLocale.add(job.item.appid);
        if (job.file && r.data !== job.item.name) {
          try {
            await upsertDetail(job.app, job.file, { [GS_FM.zhName]: r.data });
          } catch (e) {
            console.warn('bz 游戏库：中文名写回失败:', job.item.name, e);
          }
        }
        scheduleRerender();
      } else {
        failures += 1;
      }
    } catch (e) {
      failures += 1;
      console.warn('bz 游戏库：中文名拉取异常:', job.item.name, e);
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

/** 节流重渲（1.2s 尾沿；面板关着 renderFn 空转无害） */
function scheduleRerender(): void {
  if (rerenderTimer) return;
  rerenderTimer = setTimeout(() => {
    rerenderTimer = null;
    M.renderFn?.();
  }, 1200);
}

/**
 * 卸载收口：清队列与节流计时器（在途请求随响应自然落地，不阻塞卸载）。
 * 不动 noLocale（F7 会话负缓存，见其注释）也不动 running——提前复位 running 会放第二个
 * runQueue 进来与本循环并发消费同一队列（深审 F6 同款缺陷），对齐「在途自然退出」范式。
 */
export function unloadZhNames(): void {
  queue.length = 0;
  queued.clear();
  failures = 0;
  if (rerenderTimer) {
    clearTimeout(rerenderTimer);
    rerenderTimer = null;
  }
}