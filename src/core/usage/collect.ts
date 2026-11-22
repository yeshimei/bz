import { localDayKey } from '../ui/str';
import { addActiveMinute, normalizeLedger, pruneDays, recordCommand, startSession } from './ledger';
import { buildDailyPayload, markDailySent, pendingDates, retryDelay, retryWaitMs } from './rollup';
import { earlierDay } from './since';
import {
  MIN_UPLOAD_GAP_MS,
  USAGE_SCHEMA,
  TICK_MS,
  UPLOAD_FIRST_DELAY_MS,
  UPLOAD_INTERVAL_MS,
  emptyLedger,
  type DailyPayload,
  type Ledger,
  type UsageMeta,
} from './types';

const SAVE_EVERY_MS = 5 * 60_000;

export interface UsageHost {
  now(): number;
  visible(): boolean;
  enabled(): boolean;
  load(): Promise<Ledger | null>;
  save(ledger: Ledger): Promise<void>;
  sendDaily(payload: DailyPayload): Promise<boolean>;
  meta(): UsageMeta;
  /** 本地考古「最早使用日」；查不到返回 ''（新装 / 目录还没建） */
  probeSince(): Promise<string>;
  warn(msg: string, err?: unknown): void;
  setInterval(fn: () => void, ms: number): number;
  clearInterval(id: number): void;
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

export interface UsageHandle {
  trackCommand(commandId: string): void;
  tick(): void;
  upload(): Promise<void>;
  stop(): Promise<void>;
  snapshot(): Readonly<Ledger>;
}

export function createUsage(host: UsageHost): UsageHandle {
  let ledger: Ledger = emptyLedger(host.now());
  let ready = false;
  let stopped = false;
  let dirty = false;
  let revision = 0;
  let lastSaveAt = 0;
  let uploadAt = 0;
  let ticking = false;
  let uploading = false;

  const earlyCommands: Array<{ id: string; at: number }> = [];

  function markDirty(): void {
    dirty = true;
    revision += 1;
  }

  const tickTimer = host.setInterval(() => {
    runTick();
  }, TICK_MS);
  const uploadTimer = host.setTimeout(() => {
    void uploadPending();
  }, UPLOAD_FIRST_DELAY_MS);
  uploadAt = host.now() + UPLOAD_FIRST_DELAY_MS;

  void (async () => {
    try {
      const raw = await host.load();
      ledger = normalizeLedger(raw, host.now());
      if (!ledger.createdAt) ledger.createdAt = host.now();
    } catch (e) {
      host.warn('读取账本失败，按空账本继续', e);
    }
    startSession(ledger, host.now());
    // 跨重启节流（2026-11-22）：日汇总每次都重发「今天」，而上传计时器是进程内的——
    // 用户反复重载插件就会反复发同一份。账本里的 lastAttemptAt 是落盘的，用它挡掉
    // 一小时内的重复；超过一小时（或从没发过）就按正常的首查延迟走。
    const lastTry = ledger.lastAttemptAt || 0;
    const bootAt = host.now();
    if (lastTry > 0 && bootAt - lastTry < MIN_UPLOAD_GAP_MS) {
      uploadAt = Math.max(uploadAt, lastTry + MIN_UPLOAD_GAP_MS);
    }
    markDirty();
    ready = true;
    for (const cmd of earlyCommands.splice(0)) recordCommand(ledger, cmd.id, cmd.at);
    void backfillSince();
  })();

  /**
   * 补算「最早使用日」。放在 ready 之后跑：扫目录可能几百毫秒，不能挡住活跃分钟与命令计数。
   *
   * 每次启动都扫一遍，取「已有值」与「这次扫到的」里更早的那个——只往早里走，绝不改晚。
   * 必须每次都扫：同一个设备号开两个库就有两份账本，只在各自第一次算会让后开的那个
   * 把起点顶成更晚的日子（主库 8-31 与测试库 11-09 之间来回切就会这样）。
   * 代价只有一次 list + 几十次 stat，扫不到就保持原值。
   */
  async function backfillSince(): Promise<void> {
    if (stopped) return;
    let day = '';
    try {
      day = String((await host.probeSince()) || '');
    } catch {
      return; // 考古失败不打扰用户，也不写脏值
    }
    const best = earlierDay(ledger.sinceDay, day);
    if (!best || best === ledger.sinceDay) return;
    ledger.sinceDay = best;
    markDirty();
  }

  function runTick(): void {
    if (stopped || !ready || ticking) return;
    ticking = true;
    try {
      const now = host.now();
      if (host.visible()) {
        addActiveMinute(ledger, now);
        markDirty();
      }
      pruneDays(ledger, now);
      if (dirty && now - lastSaveAt >= SAVE_EVERY_MS) {
        lastSaveAt = now;
        void persist();
      }
      void uploadPending();
    } finally {
      ticking = false;
    }
  }

  async function persist(): Promise<void> {
    if (!ready) return;
    const at = revision;
    try {
      await host.save(ledger);
      // 只有落盘期间没有再改动才算干净；否则留着脏标记，下一拍接着存
      if (revision === at) dirty = false;
    } catch (e) {
      host.warn('账本落盘失败（下次再试）', e);
    }
  }


  async function uploadPending(): Promise<void> {
    if (stopped || !ready || !host.enabled() || uploading) return;
    const now = host.now();
    if (now < uploadAt) return;
    const wait = retryWaitMs(ledger, now);
    if (wait > 0) {
      uploadAt = now + wait;
      return;
    }
    const dates = pendingDates(ledger, now);
    if (!dates.length) {
      uploadAt = now + UPLOAD_INTERVAL_MS;
      return;
    }
    // 一次只飞一个请求：慢网下请求活得比一拍还久，没这个锁会每分钟再叠一份上去
    uploading = true;
    ledger.lastAttemptAt = now;
    try {
      const ok = await host.sendDaily(
        buildDailyPayload(host.meta(), dates.map((d) => ledger.days[d]), ledger.sinceDay),
      );
      if (ok) {
        markDailySent(ledger, dates, localDayKey(now));
        markDirty();
        uploadAt = now + UPLOAD_INTERVAL_MS;
        void persist();
      } else {
        ledger.failures = Math.min(99, ledger.failures + 1);
        markDirty();
        uploadAt = now + retryDelay(ledger.failures);
      }
    } catch {
      ledger.failures = Math.min(99, ledger.failures + 1);
      markDirty();
      uploadAt = now + retryDelay(ledger.failures);
    } finally {
      uploading = false;
    }
  }

  return {
    trackCommand(commandId: string): void {
      if (stopped) return;
      if (!ready) {
        earlyCommands.push({ id: commandId, at: host.now() });
        return;
      }
      if (recordCommand(ledger, commandId, host.now())) markDirty();
    },
    tick(): void {
      runTick();
    },
    upload(): Promise<void> {
      return uploadPending();
    },
    async stop(): Promise<void> {
      if (stopped) return;
      stopped = true;
      host.clearInterval(tickTimer);
      host.clearTimeout(uploadTimer);
      await persist();
    },
    snapshot(): Readonly<Ledger> {
      return ledger;
    },
  };
}
