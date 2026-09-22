/**
 * 游戏库（gameshelf）域后台全量回填（2026-09-18 用户拍板；2026-09-22 成就图标改远端直取、
 * 不再本地化，ADR-0176）：**商店资料 + 成就全量 → 笔记属性；截图 → 本地文件夹**，
 * 不等用户逐款点开详情弹窗。
 *
 * 补跑判据（三件各自独立，任一缺就排队；全齐才跳过）：
 * - `详情时间` 缺、或 `截图源` 键缺失（= 全量落盘改造前回填的存量笔记）→ 拉商店资料；
 * - 有成就页却缺 `成就` 全量列表 → 拉成就三接口；
 * - `截图源` 有值而 `截图` 对应位缺 → 只补下载，**零网络请求**（URL 就在属性里）。
 *
 * 做法（同 names.ts 的串行队列范式）：
 * - 每条之间留 `BACKFILL_INTERVAL_MS` 间隔（appdetails 一次只能一个 appid，别打连发）；
 * - **连错 3 条就停**（商店不可达时别把队列跑成雪崩；下次开面板/同步会重新排队）；
 * - 图片本体走 posters.ts 的第二条队列，不占本队列的节奏。
 *
 * 不在这里做的事（写给下一个人）：**成就的定时刷新**。全库 134 款 × 3 个接口 = 400 请求，
 * 每次开面板都跑太重。改由「打开某款详情时若属性超过 ACH_STALE_MS 就静默重拉」兜住——
 * 你常看的那几款始终新鲜，不看的保持上次快照。
 *
 * 为什么独立于同步：同 names.ts —— 同步走 api.steampowered.com（需代理），回填走
 * store.steampowered.com（直连可达），两条通道可用性互不影响，混跑会互相连坐。
 */
import type { App, TFile } from 'obsidian';
import { notify } from '../core/notice';
import { fmToAchDetail, fmToShots, refreshAchievements, refreshStore, safeDetailFm } from './detail';
import { ensureShots } from './posters';
import { M, type GameItem } from './state';
import { GS_FM, QUEUE_HALTED_NOTICE, QUEUE_HALTED_DEDUPE_KEY } from './constants';

/** 队列条目间隔（毫秒） */
export const BACKFILL_INTERVAL_MS = 900;
/** 连续失败上限：到此为止，剩下的下次开面板再试 */
export const BACKFILL_MAX_FAILURES = 3;

interface Job {
  app: App;
  item: GameItem;
  file: TFile | null;
  /** 该拉商店资料（缺 `详情时间`） */
  needStore: boolean;
  /** 该拉成就（有成就页却缺全量列表） */
  needAch: boolean;
}

/** 某款还缺什么（纯函数，可测；三种活各自独立） */
export function backfillNeeds(fm: Record<string, unknown>, hasAch: boolean): { store: boolean; ach: boolean; shots: boolean } {
  // `截图源` 键缺失也算该拉：全量落盘改造（2026-09-18）之前回填的存量笔记有 `详情时间`
  // 却从没写过截图源——只看详情时间它们永远判「不用拉」，截图就永远本地化不了。
  // storeToFm 现在始终写截图源（无截图写空数组），重拉一次即自愈，不会反复 churn。
  const store = !fm[GS_FM.detailAt] || fm[GS_FM.shotsSrc] === undefined;
  // 缺全量列表 → 拉一次补齐；补过即自愈（有列表就不再命中，不会反复 churn）
  const ach = hasAch && !fmToAchDetail(fm);
  const { local, remote } = fmToShots(fm);
  const shots = remote.some((u, i) => !!u && !local[i]);
  return { store, ach, shots };
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

/**
 * 节流重渲（统计页的成就覆盖数会随回填变化；别每条都整页重画）。
 * 节流（首沿）语义，与 names/posters 同构（深审 A3 收敛）：窗口内首条触发设表，1.2s 后
 * 必刷一次——此前这里是 clearTimeout 防抖式，队列节奏 900ms < 1.2s 时每次完成都重置计时，
 * 持续回填期间 M.renderFn 一次都不发（本地代理常态恰好落在这个区间）。
 */
function scheduleRerender(): void {
  if (rerenderTimer) return;
  rerenderTimer = setTimeout(() => {
    rerenderTimer = null;
    M.renderFn?.();
  }, 1200);
}

/** 把还没回填齐的条目入队（幂等；调用方为面板打开 / 同步完成） */
export function ensureBackfill(app: App, items: GameItem[]): void {
  let added = 0;
  for (const it of items) {
    if (queued.has(it.appid)) continue;
    const fm = safeDetailFm(app, it.file);
    const need = backfillNeeds(fm, it.hasAch);
    // 截图只缺文件时**零网络**就能补（URL 就在 `截图源` 里）→ 直接交给媒体队列，
    // 不占这条慢队列的 900ms 节奏，也不受「连错 3 条就停」牵连
    if (need.shots) {
      const s = fmToShots(fm);
      ensureShots(app, { appid: it.appid, file: it.file, remote: s.remote, prevLocal: s.local });
    }
    if (!need.store && !need.ach) continue;
    queued.add(it.appid);
    queue.push({ app, item: it, file: it.file, needStore: need.store, needAch: need.ach });
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
      // 熔断人话收尾（S2）：此前只有 console，「已经停了、下次会继续」无一字出口。
      // 与 names 共用文案与 dedupeKey——同窗熔断原地合并，不刷屏；下次开面板幂等续跑
      notify(QUEUE_HALTED_NOTICE, { type: 'warning', dedupeKey: QUEUE_HALTED_DEDUPE_KEY });
      break;
    }
    const job = queue.shift()!;
    try {
      // 注意：这里必须用 refresh*（强制走网络）而不是 load*——load* 是「属性优先」的读路径，
      // 属性里有就不发请求，队列会空转（曾因此让媒体永远补不下来）。
      if (job.needStore) {
        const store = await refreshStore(job.app, job.item);
        if (store.error) failures += 1;
        else {
          failures = 0;
          scheduleRerender();
        }
      }
      // 成就失败**不计入失败计数**：它走 api.* 通道（需系统代理），与商店通道（直连可达）
      // 的可用性无关。若算进去，没开代理时会连错 3 条把整条商店回填队列一起拖停
      if (job.needAch) {
        await refreshAchievements(job.app, job.item).catch(() => undefined);
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

/**
 * 卸载清空（main.ts onunload / closePanel 收尾时调用）。
 * 不置 running = false（深审 F6）：置了会把还在途的旧循环「放行」——它 await 完成后回
 * while 继续消费新入队的条目，同时新 ensureBackfill 看 running=false 又起第二个 runQueue，
 * 双消费者交错把 900ms 节奏砍半（撞限流面）、failures 计数互踩提前熔断。对齐 names/posters
 * 范式：旧循环发现队列已空自然退出并自行复位 running，期间新 ensure 只入队不启动。
 */
export function unloadBackfill(): void {
  queue.length = 0;
  queued.clear();
  failures = 0;
  if (rerenderTimer) {
    clearTimeout(rerenderTimer);
    rerenderTimer = null;
  }
}
