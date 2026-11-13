/**
 * clipbook（剪藏本融合域）：阅读时长记账 —— 纯逻辑，node 可测。
 *
 * 背景：剪藏本有两种读法。bz 面板里读（右栏 / 详情停留，会话封存进 readLog），
 * 和在 bz-reader 里把剪藏本当一本书读（按章计时，秒级）。后者的时长以前
 * 只留在阅读器自己的书数据里，剪藏本面板和阅读报告完全不知道。
 *
 * 两条出口，各管一件事：
 *   readSeconds        每篇累计秒数（只增）。剪藏本列表显示「3 分钟」用它，
 *                      精确到秒，多次上报的零头不会被吃掉。
 *   readLog            整分钟会话流水（issue 358 的既有口径）。阅读报告
 *                      （report-stats / press）只认它，形状不动。
 *
 * 两段之间的对账靠 readLoggedSeconds：已经折进 readLog 的秒数。没有它，
 * 每次上报都按「本次秒数」独立取整（比如每次切章 20 秒，永远凑不满 1 分钟），
 * 报告总时长会比 readSeconds 少一大截，用户会发现列表写着 8 分钟、报告只有 2 分钟。
 */
import type { ClipReadLogEntry } from './data';

/** 一次上报里的单篇条目（阅读器切章 / 关书时发来的就是它） */
export interface ReadBatch {
  key: string;
  seconds: number;
  /** 展示用：剪藏本列表与报告的条目名 */
  title?: string;
  /** 展示用：来源名（B站 UP / 平台 / 站点） */
  src?: string;
}

/**
 * 单篇单次上报的上限：4 小时。
 *
 * 阅读器自己已经把闲置剔掉了（15 秒一拍、60 秒没动作就不记），正常一次上报
 * 是几十秒到几分钟。超过 4 小时只可能是计时器被系统挂起后一次性回填、或者
 * 数据被手改过——截断比把统计撑爆好。
 */
export const MAX_READ_BATCH_SECONDS = 4 * 60 * 60;

export interface ReadAccrual {
  /** 新的每篇累计秒数 */
  readSeconds: Record<string, number>;
  /** 新的「已折进 readLog」秒数 */
  readLoggedSeconds: Record<string, number>;
  /** 本次要追加进 readLog 的条目（可能为空） */
  log: ClipReadLogEntry[];
}

function normKey(key: unknown): string {
  return String(key ?? '').trim();
}

/**
 * 把一批上报折进侧写的两段账。
 *
 * 入参是**当前值**（不可变）：返回新对象，调用方负责写盘。纯函数，
 * 同一份输入永远得到同一份输出，方便在事务里重放。
 */
export function accrueRead(input: {
  readSeconds?: Record<string, number> | null;
  readLoggedSeconds?: Record<string, number> | null;
  batch?: ReadBatch[] | null;
  /** 会话封存时刻（epoch ms）；同一次上报的所有条目共用一个 */
  ts: number;
}): ReadAccrual {
  const readSeconds: Record<string, number> = { ...(input.readSeconds || {}) };
  const readLoggedSeconds: Record<string, number> = { ...(input.readLoggedSeconds || {}) };
  const log: ClipReadLogEntry[] = [];
  const ts = Number.isFinite(input.ts) ? Number(input.ts) : Date.now();

  for (const item of input.batch || []) {
    const key = normKey(item?.key);
    /* 取整再判：12.9 秒记 12 秒，不足 1 秒的零头本来就没有意义 */
    const raw = Math.floor(Number(item?.seconds) || 0);
    if (!key || raw <= 0) continue;
    const add = Math.min(raw, MAX_READ_BATCH_SECONDS);

    const total = (Number(readSeconds[key]) || 0) + add;
    readSeconds[key] = total;

    /* 按「累计秒数」算可入账的整分钟，而不是按本次：30 + 30 两次上报才能
       凑出 1 分钟，按本次取整会两次都丢。 */
    const logged = Number(readLoggedSeconds[key]) || 0;
    const minutes = Math.floor(total / 60) - Math.floor(logged / 60);
    if (minutes <= 0) continue;
    readLoggedSeconds[key] = logged + minutes * 60;
    log.push({
      key,
      title: String(item?.title ?? '').trim(),
      src: String(item?.src ?? '').trim(),
      minutes,
      ts,
    });
  }

  return { readSeconds, readLoggedSeconds, log };
}

/**
 * 展示用的秒数视图：把 readLog 里的旧账也折进来。
 *
 * readSeconds 是 2026-11-13 才有的段；在那之前，面板里读的时长只记在 readLog
 * （整分钟流水）。不回溯写盘——写回会让「累计」与「已入账」错位、下一批
 * 上报在 readLog 里重复入账——只在读取时按 key 合并，取两者的大值。
 *
 * 逐条相加只发生在 readLog 内部（同一篇读过多次 = 多条），跨段不能相加：
 * readSeconds 已经包含 readLog 那张账，相加等于翻倍。
 */
export function readSecondsView(
  readSeconds: Record<string, number> | null | undefined,
  readLog: ClipReadLogEntry[] | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = { ...(readSeconds || {}) };
  const fromLog: Record<string, number> = {};
  for (const e of readLog || []) {
    const key = normKey(e?.key);
    const sec = Math.max(0, Math.round(Number(e?.minutes) || 0)) * 60;
    if (!key || sec <= 0) continue;
    fromLog[key] = (fromLog[key] || 0) + sec;
  }
  for (const key of Object.keys(fromLog)) {
    if ((out[key] || 0) < fromLog[key]) out[key] = fromLog[key];
  }
  return out;
}

/** 批量上报的合法性过滤（门面在交给实现方之前先过一遍） */export function sanitizeReadBatch(entries: ReadBatch[] | null | undefined): ReadBatch[] {
  const out: ReadBatch[] = [];
  for (const item of entries || []) {
    const key = normKey(item?.key);
    const seconds = Math.floor(Number(item?.seconds) || 0);
    if (!key || seconds <= 0) continue;
    out.push({
      key,
      seconds: Math.min(seconds, MAX_READ_BATCH_SECONDS),
      title: String(item?.title ?? '').trim(),
      src: String(item?.src ?? '').trim(),
    });
  }
  return out;
}
