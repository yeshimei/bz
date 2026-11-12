import { localDayKey } from '../ui/str';
import { addActiveMinute, normalizeLedger, pruneDays, recordCommand, startSession } from './ledger';
import { buildDailyPayload, markDailySent, pendingDates, retryDelay, retryWaitMs } from './rollup';
import {
  PING_FIRST_DELAY_MS,
  PING_MS,
  USAGE_SCHEMA,
  TICK_MS,
  UPLOAD_FIRST_DELAY_MS,
  UPLOAD_INTERVAL_MS,
  emptyLedger,
  type DailyPayload,
  type Ledger,
  type PingPayload,
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
  sendPing(payload: PingPayload): Promise<boolean>;
  meta(): UsageMeta;
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
  let lastPingAt = 0;
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
  const pingTimer = host.setTimeout(() => {
    void pingNow();
  }, PING_FIRST_DELAY_MS);
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
    markDirty();
    ready = true;
    for (const cmd of earlyCommands.splice(0)) recordCommand(ledger, cmd.id, cmd.at);
  })();

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
      void pingNow();
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

  async function pingNow(): Promise<void> {
    // 在线只认「插件还在跑」：窗口最小化、切到别的笔记库，Obsidian 都还开着，
    // 不该从在线掉下去。活跃分钟另有 visible 门槛（那才是「真的在看」）。
    if (stopped || !ready || !host.enabled()) return;
    const now = host.now();
    if (now - lastPingAt < PING_MS) return;
    lastPingAt = now;
    try {
      await host.sendPing({
        schema: USAGE_SCHEMA,
        ...host.meta(),
        at: now,
      });
    } catch {
      /* 失败不重试，下一拍再来 */
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
      const ok = await host.sendDaily(buildDailyPayload(host.meta(), dates.map((d) => ledger.days[d])));
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
      host.clearTimeout(pingTimer);
      host.clearTimeout(uploadTimer);
      await persist();
    },
    snapshot(): Readonly<Ledger> {
      return ledger;
    },
  };
}
