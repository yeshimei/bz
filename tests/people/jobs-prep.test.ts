// @vitest-environment node
/**
 * 画脸谱阶段机流转测试（issue 469 / ADR-0196 决策 2、3、7、9、10；spec Testing Decisions 第 1 条）：
 * 生成任务引擎（jobs.ts）× 工具段（prep.ts）在「画脸谱编排」这一条缝上的编排行为——
 * runExternalTool 经 setPrepRunnerForTests 注入假件、fs 经 setPrepFsForTests 注入内存假件、
 * 保库记录用 MockVault 上的真 SafeManager（467 注入式先例），喂预录协议行断言：
 *   · 阶段推进（preprocess → extracting → done）与阶段行计数；
 *   · 零媒体联系人自动跳过 prep 全段（决策 9）；
 *   · 协作式暂停（写控制文件让行、进程复用不重起）与续跑；
 *   · 上锁暂停（wireLock → pauseJobs → 协作式让行而非杀进程）；
 *   · 硬失败整链停给中文原因；单条失败计账继续 + retryPrepFailures 重跑补缺口；
 *   · 完成合并进保库记录聊天仓（转写 / 图片关联由插件写入，ADR-0197 决策 4）；
 *   · 重启后 running → interrupted 出「继续生成」，不自动开跑。
 * 测试数据全构造，不含真实聊天内容。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startJobs,
  resumeJobs,
  resume,
  pauseJobs,
  retryPrepFailures,
  snapshot,
  whenIdle,
  __resetJobsForTests,
  type JobTarget,
  type PersonJob,
} from '../../src/people/jobs';
import { storeStatsOf, storeToUnified, type ImageMapItem, type StoreMsg, type VoiceItem } from '../../src/people/datasource';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';
import { setPrepRunnerForTests, setPrepFsForTests, type PrepFs } from '../../src/people/prep';
import type { ExternalToolCallbacks, ExternalToolOutcome, ExternalToolSpec } from '../../src/core/external-tool';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

const TALKER = 'wxid_test';
const DATA_ROOT = 'E:\\构造数据根';
const BASE = Date.UTC(2024, 4, 1, 12, 0, 0);
const PW = 'jobs-prep-pw';

/** 假 prep 进程：记录 spec、转发协议行、手动终结 */
class FakePrep {
  calls: ExternalToolSpec[] = [];
  stopCalls = 0;
  private cb: ExternalToolCallbacks | null = null;
  private resolve: ((o: ExternalToolOutcome) => void) | null = null;

  runner = (spec: ExternalToolSpec, cb: ExternalToolCallbacks) => {
    this.calls.push(spec);
    this.cb = cb;
    return {
      stop: () => {
        this.stopCalls++;
        void this.settle({ ok: false, stopped: true, code: null, stderr: '', error: null });
      },
      done: new Promise<ExternalToolOutcome>((r) => {
        this.resolve = r;
      }),
    };
  };

  progress(phase: string | null, pct: number | null): void { this.cb!.onProgress(phase, pct); }
  info(data: Record<string, unknown>): void { this.cb!.onInfo(data); }
  result(data: Record<string, unknown>): void { this.cb!.onResult(data); }
  settle(o: Partial<ExternalToolOutcome>): Promise<void> {
    this.resolve?.({ ok: false, stopped: false, code: 1, stderr: '', error: null, ...o } as ExternalToolOutcome);
    return new Promise((r) => setTimeout(r, 0));
  }
}

/** 内存 fs 假件（旁路表预置 + 控制文件断言） */
class MemFs implements PrepFs {
  files = new Map<string, string>();
  writeText(path: string, data: string): void { this.files.set(path.replace(/\\/g, '/'), data); }
  readText(path: string): string | null { return this.files.get(path.replace(/\\/g, '/')) ?? null; }
  exists(path: string): boolean { return this.files.has(path.replace(/\\/g, '/')); }
  unlink(path: string): void { this.files.delete(path.replace(/\\/g, '/')); }
  control(): { action: string } | null {
    const raw = this.files.get(`${DATA_ROOT.replace(/\\/g, '/')}/.bz-face/control.json`);
    return raw ? (JSON.parse(raw) as { action: string }) : null;
  }
}

let vault: MockVault;
let app: any;
let sm: SafeManager;
let safe: PeopleSafeStore;
let prep: FakePrep;
let fs: MemFs;

const BATCH_JSON = JSON.stringify({
  events: [{ ts: '2024-05-01', kind: 'major', summary: '构造事件' }],
  traits: ['构造特质'],
  quotes: [{ ts: '2024-05-01', who: '对方', text: '构造原话' }],
  moments: [{ ts: '2024-05-01', summary: '构造场景' }],
  interests: [{ ts: '2024-05-01', topic: '构造话题' }],
  threads: [{ ts: '2024-05-01', text: '下次一起构造' }],
});

function makeAsks(failFirst = false) {
  let first = true;
  return {
    askExtract: vi.fn(async () => {
      if (failFirst && first) {
        first = false;
        throw new Error('构造 AI 失败');
      }
      return BATCH_JSON;
    }),
    askPortrait: vi.fn(async (p: string) => {
      if (p.includes('关系时间线')) return '## 2024 年';
      if (p.includes('要产出的卷二')) return '## 关系定性\n构造我们';
      return '## 画像速写\n构造画像';
    }),
  };
}

/** 构造一条聊天仓消息 */
function m(n: number, over: Partial<StoreMsg> = {}): StoreMsg {
  return { key: `k${n}`, ts: BASE + n * 60000, isSender: n % 2 === 1, type: 1, text: `构造消息${n}`, ...over };
}

/** 带媒体的种子聊天仓：文本 2 + 语音 1（无转写）+ 图片 1（无关联） */
function mediaMsgs(): StoreMsg[] {
  return [
    m(1),
    m(2, { key: 'v91', type: 34, sid: 91, dur: 14, wav: `${TALKER}/voice/v_91.wav`, text: '' }),
    m(3),
    m(4, { key: 'p92', type: 3, sid: 92, ts: BASE + 4 * 60000, text: '' }),
  ];
}

async function seedStore(msgs: StoreMsg[], kindCounts: Record<string, number>): Promise<void> {
  await safe.write(TALKER, (rec) => {
    rec.store = { msgs, watermarkSid: 92, stats: storeStatsOf(msgs), kindCounts, updatedAt: '2026-09-25T00:00:00.000Z' };
  });
}

function target(msgs: StoreMsg[]): JobTarget {
  return { talker: TALKER, name: '构造对象', msgs: storeToUnified(msgs), kindCounts: {}, skippedCount: 0, fileLabel: `数据源:${TALKER}` };
}

function jobOf(): PersonJob | undefined {
  return snapshot().queue.find((j) => j.talker === TALKER);
}

/** 轮询等待（引擎是后台 promise，以落盘记录 / 调用计数为条件） */
async function until(cond: () => boolean | Promise<boolean>): Promise<void> {
  for (let i = 0; i < 2000; i++) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('jobs-prep.test: 等待条件超时');
}

/** 旁路表预置：voice.json（wav 关联转写）+ image_map.json（sid 关联图片） */
function seedSidecars(voiceFail = false): void {
  const voice: VoiceItem[] = [
    voiceFail
      ? { wav: `${TALKER}/voice/v_91.wav`, sid: 91, text: '<转写失败:boom>', emotion: 'ERR' }
      : { wav: `${TALKER}/voice/v_91.wav`, sid: 91, dur: 14, text: '构造转写', emotion: 'HAPPY' },
  ];
  const map: ImageMapItem[] = [{ file: '2026-05/p1.jpg', ct: Math.round((BASE + 4 * 60000) / 1000), sid: 92 }];
  fs.files.set(`${DATA_ROOT.replace(/\\/g, '/')}/${TALKER}/voice.json`, JSON.stringify(voice));
  fs.files.set(`${DATA_ROOT.replace(/\\/g, '/')}/${TALKER}/image_map.json`, JSON.stringify(map));
}

beforeEach(async () => {
  vault = new MockVault();
  app = mockAppWithVault(vault);
  setApp(app);
  resetObsidianMocks();
  __resetJobsForTests();
  sm = new SafeManager('CONFIG/.ENCRYPT');
  await sm.unlock(PW);
  safe = new PeopleSafeStore(sm);
  setPeopleSafeStoreForTests(safe);
  prep = new FakePrep();
  fs = new MemFs();
  setPrepRunnerForTests(prep.runner);
  setPrepFsForTests(fs);
  setSettingsProvider(
    () => ({ storagePath: 'CONFIG/STORAGE', peopleDataDir: DATA_ROOT, asrEngine: 'sensevoice' }) as never
  );
});

afterEach(() => {
  __resetJobsForTests();
  setPeopleSafeStoreForTests(null);
  setPrepRunnerForTests(null);
  setPrepFsForTests(null);
  sm.lock();
});

describe('阶段机流转（preprocess 段）', () => {
  it('prep 全段推进：参数面 → 阶段计数 → 终结后合并旁路表进聊天仓 → AI 段跑完 done', async () => {
    const msgs = mediaMsgs();
    await seedStore(msgs, { 文本: 2, 语音: 1, 图片: 1 });
    seedSidecars();
    const asks = makeAsks();
    await startJobs(app, [target(msgs)], { maxRetries: 0, sleep: async () => {}, ...asks });
    await until(() => prep.calls.length === 1);
    // 参数面：468 prep-core CLI——位置联系人 + --data-root + --asr-engine
    const args = prep.calls[0].args ?? [];
    expect(args[0]).toBe('prep');
    expect(args.join(' ')).toContain(TALKER);
    expect(args.join(' ')).toContain('--data-root');
    expect(args.join(' ')).toContain('--asr-engine');
    // 阶段推进与计数（[bz-info] 汇总落账）
    prep.progress('media', 50);
    prep.info({ phase: 'media', counts: { voice: { done: 1, skip: 0, fail: 0 }, image: { done: 3, skip: 0, fail: 0 } } });
    let job = jobOf();
    expect(job?.stage).toBe('preprocess');
    expect(job?.prep?.counts.media).toEqual({ done: 4, total: 4 });
    expect(job?.prep?.donePhases).toEqual(['media']);
    // 终结：[bz-result] 权威 → 合并 → AI 段
    prep.result({ ok: true, stopped: false, failed: 0 });
    await prep.settle({ ok: true, code: 0 });
    await whenIdle();
    job = jobOf();
    expect(job?.status).toBe('done');
    expect(job?.stage).toBe('done');
    expect(job?.person).toContain('构造画像');
    // 完成合并（ADR-0197：插件是唯一写入者）：转写与图片关联进保库记录聊天仓
    const rec = await safe.read(TALKER);
    const voiceMsg = rec!.store.msgs.find((x) => x.key === 'v91');
    const imgMsg = rec!.store.msgs.find((x) => x.key === 'p92');
    expect(voiceMsg?.text).toBe('[语音 14秒·开心] 构造转写');
    expect(imgMsg?.img).toBe('2026-05/p1.jpg');
    // 指纹刷新：prep 升级素材后任务指纹对齐新聊天仓（未判废）——转写进了时间线，
    // 图片没有描述（text 空）仍不进时间线：时间线 = 2 文本 + 1 语音
    expect(job?.msgCount).toBe(3);
    const refp = (await import('../../src/people/jobs')).fingerprintOf(rec!.store.msgs.filter((x) => x.text !== '').map((x) => ({ ts: x.ts, isSender: x.isSender, text: x.text })));
    expect(job?.contentHash).toBe(refp.contentHash);
  });

  it('零媒体联系人自动跳过 prep 全段（决策 9）：不起进程直接进 AI 段', async () => {
    const msgs = [m(1), m(2), m(3)];
    await seedStore(msgs, { 文本: 3 });
    await startJobs(app, [target(msgs)], { maxRetries: 0, sleep: async () => {}, ...makeAsks() });
    await whenIdle();
    expect(prep.calls.length).toBe(0);
    const job = jobOf();
    expect(job?.status).toBe('done');
    expect(job?.stage).toBe('done');
    expect(job?.prep).toBeUndefined(); // 没起过 prep 段
  });

  it('协作式暂停 / 续跑（决策 3）：暂停写控制文件让行，恢复写 resume 且复用同一进程', async () => {
    const msgs = mediaMsgs();
    await seedStore(msgs, { 文本: 2, 语音: 1, 图片: 1 });
    seedSidecars();
    await startJobs(app, [target(msgs)], { maxRetries: 0, sleep: async () => {}, ...makeAsks() });
    await until(() => prep.calls.length === 1);
    pauseJobs();
    await until(() => fs.control()?.action === 'pause' && jobOf()?.status === 'paused');
    expect(jobOf()?.stage).toBe('preprocess'); // 工具段中途暂停，断点留在 preprocess
    // 恢复：不重起进程（模型冷加载不白付），写 resume 让待命进程继续
    expect(resume(TALKER)).toBe(true);
    await until(() => fs.control()?.action === 'resume');
    expect(prep.calls.length).toBe(1);
    prep.result({ ok: true, stopped: false, failed: 0 });
    await prep.settle({ ok: true, code: 0 });
    await whenIdle();
    expect(jobOf()?.status).toBe('done');
  });

  it('上锁暂停走协作式让行（wireLock → pauseJobs → 控制文件而非杀进程）；解锁后恢复', async () => {
    const msgs = mediaMsgs();
    await seedStore(msgs, { 文本: 2, 语音: 1, 图片: 1 });
    seedSidecars();
    await startJobs(app, [target(msgs)], { maxRetries: 0, sleep: async () => {}, ...makeAsks() });
    await until(() => prep.calls.length === 1);
    sm.lock(); // 任意路径上锁（ADR-0194 决策 5）→ wireLock → pauseJobs
    await until(() => fs.control()?.action === 'pause' && jobOf()?.status === 'paused');
    expect(prep.stopCalls).toBe(0); // 协作式让行：进程不硬杀
    sm.unlock(PW);
    await until(() => fs.control()?.action === 'resume');
    prep.result({ ok: true, stopped: false, failed: 0 });
    await prep.settle({ ok: true, code: 0 });
    await whenIdle();
    expect(jobOf()?.status).toBe('done');
  });

  it('硬失败整链停（决策 7）：[bz-result]{ok:false} → error 态 + 中文原因透传', async () => {
    const msgs = mediaMsgs();
    await seedStore(msgs, { 文本: 2, 语音: 1, 图片: 1 });
    const reason = '联系人目录里没有 chat.json：E:\\根\\大琳——先跑 bz-face sync（prep 的语音定位与图片关联都靠它对齐）';
    await startJobs(app, [target(msgs)], { maxRetries: 0, sleep: async () => {}, ...makeAsks() });
    await until(() => prep.calls.length === 1);
    prep.result({ ok: false, error: reason });
    await prep.settle({ ok: false, code: 1 });
    await until(() => jobOf()?.status === 'error');
    const job = jobOf();
    expect(job?.error).toBe(reason); // 工具给的中文引导原样透传，不包装不抛栈
    expect(job?.message).toBe(reason);
    expect(job?.person).toBeUndefined(); // AI 段没有开跑
  });

  it('单条失败计账继续 + retryPrepFailures 重跑补缺口（决策 7）', async () => {
    const msgs = mediaMsgs();
    await seedStore(msgs, { 文本: 2, 语音: 1, 图片: 1 });
    seedSidecars();
    const asks = makeAsks(true); // 第一批 AI 失败（maxRetries 0 → 任务 error，prep 成果保留）
    await startJobs(app, [target(msgs)], { maxRetries: 0, sleep: async () => {}, ...asks });
    await until(() => prep.calls.length === 1);
    prep.result({ ok: true, stopped: false, failed: 2 }); // 单条媒体 / 语音失败计账继续
    await prep.settle({ ok: true, code: 0 });
    await until(() => jobOf()?.status === 'error');
    expect(jobOf()?.prep?.failed).toBe(2);
    expect(jobOf()?.error).toBe('构造 AI 失败'); // error 来自 AI 段，prep 的失败计账不影响继续
    // 「重试失败项」：error 态受理——清 prep 断点账本重跑工具（幂等只补失败项），AI 批次保留
    expect(retryPrepFailures(TALKER)).toBe(true);
    await until(() => prep.calls.length === 2);
    expect(jobOf()?.prep?.donePhases).toEqual([]); // 账本已清，重跑 prep
    prep.result({ ok: true, stopped: false, failed: 0 });
    await prep.settle({ ok: true, code: 0 });
    await whenIdle();
    expect(jobOf()?.status).toBe('done');
  });

  it('重启后崩溃遗留 running → interrupted 出「继续生成」，不自动开跑', async () => {
    const msgs = mediaMsgs();
    await seedStore(msgs, { 文本: 2, 语音: 1, 图片: 1 });
    await safe.write(TALKER, (rec) => {
      rec.job = {
        talker: TALKER,
        name: '构造对象',
        mode: 'full',
        fileLabel: `数据源:${TALKER}`,
        status: 'running',
        stage: 'preprocess',
        msgCount: 4,
        contentHash: 'x',
        chunks: [],
        batchesDone: 0,
        results: [],
        prep: { phase: 'media', pct: 30, counts: { media: { done: 2, total: 4 } }, donePhases: [], failed: 0 },
        startedAt: '2026-09-26T00:00:00.000Z',
        updatedAt: '2026-09-26T00:00:00.000Z',
      };
    });
    await resumeJobs(app, makeAsks()); // boot 时注入 AI 依赖（续跑后的 AI 段用）
    const job = jobOf();
    expect(job?.status).toBe('interrupted');
    expect(job?.stage).toBe('preprocess'); // 断点留在工具段，进度账本保留
    expect(job?.prep?.counts.media).toEqual({ done: 2, total: 4 });
    expect(prep.calls.length).toBe(0); // 不自动开跑（烧 token 的事永远等用户点「继续生成」）
    // 用户点了「继续生成」才从断点续：重起 prep 进程（工具幂等补缺口）
    seedSidecars();
    expect(resume(TALKER)).toBe(true);
    await until(() => prep.calls.length === 1);
    prep.result({ ok: true, stopped: false, failed: 0 });
    await prep.settle({ ok: true, code: 0 });
    await whenIdle();
    expect(jobOf()?.status).toBe('done');
  });
});
