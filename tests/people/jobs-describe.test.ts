// @vitest-environment node
/**
 * 图片描述段编排测试（issue 470 / ADR-0196 决策 8、9；spec Testing Decisions 第 1 条）：
 * 生成任务引擎（jobs.ts）的 describe 段在「画脸谱编排」缝上的行为——AI 与确认门经
 * startJobs / resumeJobs 的 askDescribe / askDescribeConfirm 注入假件、派生档 fs 经
 * setDescribeFsForTests 注入内存假件（零媒体联系人不起 prep 进程，本票不依赖工具段），断言：
 *   · 确认门数据（服务商/模型/张数/调用数/起始位置）与「开始」路径的逐批描述并合并回聊天仓；
 *   · 「跳过图片描述」≠ 取消：图片空文本继续走到画像生成（决策 8）；
 *   · 零图片自动跳过且不弹确认（决策 9）；
 *   · 批级断点：单批失败只废该批，续跑只补失败批、已完成批零调用；确认过的任务续跑不再弹窗；
 *   · 批间暂停（决策 3 同款语义）；门未注入按跳过处理（绝不静默烧钱）。
 * 测试数据全构造，不含真实聊天内容。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startJobs,
  resumeJobs,
  resume,
  pauseJobs,
  snapshot,
  whenIdle,
  __resetJobsForTests,
  type JobTarget,
  type PersonJob,
} from '../../src/people/jobs';
import { storeStatsOf, storeToUnified, type StoreMsg } from '../../src/people/datasource';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';
import { setDescribeFsForTests, type DescribeFs } from '../../src/people/describe';
import type { DescribeConfirmInfo } from '../../src/people/types';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

const TALKER = 'wxid_desc';
const DATA_ROOT = 'E:\\构造数据根';
const BASE = Date.UTC(2024, 4, 1, 12, 0, 0);
const PW = 'jobs-desc-pw';

let vault: MockVault;
let app: any;
let sm: SafeManager;
let safe: PeopleSafeStore;

const BATCH_JSON = JSON.stringify({
  events: [{ ts: '2024-05-01', kind: 'major', summary: '构造事件' }],
  traits: ['构造特质'],
  quotes: [{ ts: '2024-05-01', who: '对方', text: '构造原话' }],
  moments: [{ ts: '2024-05-01', summary: '构造场景' }],
});

/** 假确认门：记录收到的确认数据，按预设答复 */
function makeGate(answer: 'start' | 'skip' = 'start') {
  const seen: Array<DescribeConfirmInfo> = [];
  const gate = vi.fn(async (info: DescribeConfirmInfo) => {
    seen.push(info);
    return answer;
  });
  return { gate, seen };
}

/** 假提炼 / 画像 AI（describe 段之后的整链沿用 jobs-prep 同款假件） */
function makeAsks() {
  return {
    askExtract: vi.fn(async () => BATCH_JSON),
    askPortrait: vi.fn(async (p: string) => {
      if (p.includes('关系时间线')) return '## 2024 年';
      if (p.includes('要产出的卷二')) return '## 关系定性\n构造我们';
      return '## 画像速写\n构造画像';
    }),
  };
}

/** 假视觉 AI：按图片张数回 descs 数组；可注入第几批失败 */
function makeAskDescribe(opts: { failBatch?: number } = {}) {
  const calls: string[][] = []; // 每次调用的图片路径集合（从 prompt 不可见，改由注入侧记录 images）
  let batch = 0;
  const ask = vi.fn(async (input: { text: string; images: string[] }) => {
    batch += 1;
    calls.push(input.images);
    if (opts.failBatch !== undefined && batch === opts.failBatch) throw new Error('构造视觉调用失败');
    const prompt = input.text;
    const count = Number(/图片张数 (\d+)/.exec(prompt)?.[1] ?? input.images.length);
    return JSON.stringify({ descs: input.images.map((_, i) => `构造描述${batch}-${i + 1}`).slice(0, count) });
  });
  return { ask, calls };
}

/** 构造一条仓消息 */
function m(n: number, over: Partial<StoreMsg> = {}): StoreMsg {
  return { key: `k${n}`, ts: BASE + n * 60000, isSender: n % 2 === 1, type: 1, text: `构造消息${n}`, ...over };
}

/** 带图种子聊天仓：2 文本 + 3 图片（img 已关联、text 空 = 待描述） */
function imageMsgs(): StoreMsg[] {
  return [
    m(1),
    m(2, { key: 'p1', type: 3, sid: 101, img: '2026-05/p1.jpg', text: '' }),
    m(3),
    m(4, { key: 'p2', type: 3, sid: 102, img: '2026-05/p2.jpg', text: '' }),
    m(5, { key: 'p3', type: 3, sid: 103, img: '2026-05/p3.jpg', text: '' }),
  ];
}

async function seedStore(msgs: StoreMsg[]): Promise<void> {
  await safe.write(TALKER, (rec) => {
    rec.store = { msgs, watermarkSid: 103, stats: storeStatsOf(msgs), kindCounts: { 文本: 2 }, updatedAt: '2026-09-25T00:00:00.000Z' };
  });
}

/**
 * 给任务补「prep 已齐段」账本。生产流里图片有 img 必然经过 prep（image_map / desc 派生档
 * 是它的产物），账本必然齐段、续跑不再起进程；本票用例不依赖工具段，直接落位同一状态。
 */
async function markPrepDone(): Promise<void> {
  await safe.write(TALKER, (rec) => {
    if (rec.job && !rec.job.prep) {
      rec.job.prep = { phase: null, pct: null, counts: {}, donePhases: ['media', 'derive', 'map', 'transcribe'], failed: 0 };
    }
  });
}

function target(msgs: StoreMsg[]): JobTarget {
  return { talker: TALKER, name: '构造对象', msgs: storeToUnified(msgs), kindCounts: {}, skippedCount: 0, fileLabel: `数据源:${TALKER}` };
}

function jobOf(): PersonJob | undefined {
  return snapshot().queue.find((j) => j.talker === TALKER);
}

/** 轮询等待（引擎是后台 promise，以状态 / 调用计数为条件） */
async function until(cond: () => boolean | Promise<boolean>): Promise<void> {
  for (let i = 0; i < 2000; i++) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('jobs-describe.test: 等待条件超时');
}

/** 派生档 fs 假件：desc/ 下的 jpg 都可读（内容任意非空字节） */
class MemDescFs implements DescribeFs {
  missing = new Set<string>();
  readBytes(path: string): Uint8Array | null {
    const p = path.replace(/\\/g, '/');
    if (!p.includes('/desc/') || this.missing.has(p)) return null;
    return new Uint8Array([1, 2, 3]);
  }
}

let descFs: MemDescFs;

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
  descFs = new MemDescFs();
  setDescribeFsForTests(descFs);
  setSettingsProvider(
    () => ({ storagePath: 'CONFIG/STORAGE', peopleDataDir: DATA_ROOT, aiProvider: 'zhipu-plan' }) as never
  );
});

afterEach(() => {
  __resetJobsForTests();
  setPeopleSafeStoreForTests(null);
  setDescribeFsForTests(null);
  sm.lock();
});

describe('describe 段编排（470）', () => {
  it('确认门数据与「开始」路径：逐批描述合并回聊天仓 → 指纹刷新 → 整链继续走到 done', async () => {
    const msgs = imageMsgs();
    await seedStore(msgs);
    const gateBox = makeGate('start');
    const askBox = makeAskDescribe();
    await startJobs(app, [target(msgs)], {
      maxRetries: 0,
      sleep: async () => {},
      ...makeAsks(),
      askDescribe: askBox.ask,
      askDescribeConfirm: gateBox.gate,
    });
    await whenIdle();
    const job = jobOf();
    expect(job?.status).toBe('done');
    expect(job?.stage).toBe('done');
    // 确认门数据（ADR-0196 决策 8：服务商/模型/张数/调用数/起始位置；不报金额）
    expect(gateBox.seen.length).toBe(1);
    expect(gateBox.seen[0]).toMatchObject({
      provider: '智谱 Plan',
      model: 'glm-5.3-flash',
      name: '构造对象',
      totalImages: 3,
      doneImages: 0,
      calls: 1, // 3 张按缺省批 20 → 1 批 1 次调用
      batchSize: 20,
    });
    expect(askBox.calls.length).toBe(1);
    // 合并回聊天仓（ADR-0197 决策 4）：`[图片] 描述` 进派生 text，时间线与统计随之更新
    const rec = await safe.read(TALKER);
    const img1 = rec!.store.msgs.find((x) => x.key === 'p1')!;
    expect(img1.text).toBe('[图片] 构造描述1-1');
    expect(rec!.store.stats.msgCount).toBe(5); // 2 文本 + 3 图（描述进时间线）
    expect(rec!.store.stats.imageCount).toBe(3);
    // 指纹刷新（合并后重算，不判废）；账本落位
    expect(job?.describe).toMatchObject({ imgCount: 3, totalBatches: 1, doneBatches: 1, confirmed: true });
    const refp = (await import('../../src/people/jobs')).fingerprintOf(
      rec!.store.msgs.filter((x) => x.text !== '').map((x) => ({ ts: x.ts, isSender: x.isSender, text: x.text }))
    );
    expect(job?.contentHash).toBe(refp.contentHash);
  });

  it('跳过 ≠ 取消（决策 8）：图片空文本继续走到画像生成；视觉调用零发生', async () => {
    const msgs = imageMsgs();
    await seedStore(msgs);
    const gateBox = makeGate('skip');
    const askBox = makeAskDescribe();
    await startJobs(app, [target(msgs)], {
      maxRetries: 0,
      sleep: async () => {},
      ...makeAsks(),
      askDescribe: askBox.ask,
      askDescribeConfirm: gateBox.gate,
    });
    await whenIdle();
    const job = jobOf();
    expect(job?.status).toBe('done'); // 整链不中断
    expect(askBox.ask).not.toHaveBeenCalled();
    expect(job?.describe?.skipped).toBe(true);
    const rec = await safe.read(TALKER);
    expect(rec!.store.msgs.find((x) => x.key === 'p1')?.text).toBe(''); // 空文本 = 不进时间线
    expect(rec!.store.stats.msgCount).toBe(2);
    expect(job?.msgCount).toBe(2); // 指纹按空文本口径刷新
  });

  it('零图片自动跳过本段且不弹确认（决策 9）', async () => {
    const msgs = [m(1), m(2), m(3)];
    await seedStore(msgs);
    const gateBox = makeGate('start');
    await startJobs(app, [target(msgs)], { maxRetries: 0, sleep: async () => {}, ...makeAsks(), askDescribeConfirm: gateBox.gate });
    await whenIdle();
    expect(jobOf()?.status).toBe('done');
    expect(gateBox.gate).not.toHaveBeenCalled();
    expect(jobOf()?.describe).toBeUndefined();
  });

  it('批级断点：单批失败只废该批；续跑只补失败批（已完成批零调用）且不再弹确认', async () => {
    const msgs = imageMsgs();
    await seedStore(msgs);
    // 设置批 2 → 2 批：批 1 成功、批 2 失败（maxRetries 0 → 任务 error）
    setSettingsProvider(
      () => ({ storagePath: 'CONFIG/STORAGE', peopleDataDir: DATA_ROOT, peopleDescBatchSize: 2 }) as never
    );
    const askBox = makeAskDescribe({ failBatch: 2 });
    const gateBox = makeGate('start');
    await startJobs(app, [target(msgs)], {
      maxRetries: 0,
      sleep: async () => {},
      ...makeAsks(),
      askDescribe: askBox.ask,
      askDescribeConfirm: gateBox.gate,
    });
    await until(() => jobOf()?.status === 'error');
    let job = jobOf();
    expect(job?.error).toBe('构造视觉调用失败');
    expect(job?.message).toContain('图片描述第 2/2 批失败');
    expect(job?.describe).toMatchObject({ doneBatches: 1, totalBatches: 2, confirmed: true });
    expect(askBox.calls.length).toBe(2);
    // 批 1 的成果已逐批落仓（checkpoint：p1 / p2 都在批 1）
    const rec0 = await safe.read(TALKER);
    expect(rec0!.store.msgs.find((x) => x.key === 'p1')?.text).toBe('[图片] 构造描述1-1');
    expect(rec0!.store.msgs.find((x) => x.key === 'p2')?.text).toBe('[图片] 构造描述1-2');
    expect(rec0!.store.msgs.find((x) => x.key === 'p3')?.text).toBe('');
    // 续跑：不再弹确认（confirmed 记账）；批 1 零调用，只补批 2
    await markPrepDone(); // 描述并仓后图片进时间线（stats.imageCount 增长）——prep 账本齐段则不再起进程
    expect(resume(TALKER)).toBe(true);
    await whenIdle();
    job = jobOf();
    expect(job?.status).toBe('done');
    expect(gateBox.gate).toHaveBeenCalledTimes(1);
    expect(askBox.calls.length).toBe(3); // 批1 + 批2失败 + 续跑只重试批2
    expect(askBox.calls[2].length).toBe(1); // 第 3 次调用只带批 2 的 1 张
    const rec = await safe.read(TALKER);
    expect(rec!.store.msgs.find((x) => x.key === 'p3')?.text).toBe('[图片] 构造描述3-1');
  });

  it('批间暂停：确认门回来后、下一批开始前收手（断点留在 describe 段）', async () => {
    const msgs = imageMsgs();
    await seedStore(msgs);
    setSettingsProvider(
      () => ({ storagePath: 'CONFIG/STORAGE', peopleDataDir: DATA_ROOT, peopleDescBatchSize: 1 }) as never
    );
    const askBox = makeAskDescribe();
    const gateBox = makeGate('start');
    // 门里顺手请求暂停：引擎从 await 恢复后，describe 循环在批顶收手
    const gate = vi.fn(async (info: DescribeConfirmInfo) => {
      void info;
      pauseJobs();
      return 'start' as const;
    });
    await startJobs(app, [target(msgs)], {
      maxRetries: 0,
      sleep: async () => {},
      ...makeAsks(),
      askDescribe: askBox.ask,
      askDescribeConfirm: gate,
    });
    await until(() => jobOf()?.status === 'paused');
    const job = jobOf();
    expect(job?.stage).toBe('describe');
    expect(job?.message).toBe('已暂停 · 图片描述 0/3 批');
    expect(askBox.ask).not.toHaveBeenCalled();
    // 恢复：确认不重弹（已 confirmed），三批跑完
    expect(resume(TALKER)).toBe(true);
    await whenIdle();
    expect(jobOf()?.status).toBe('done');
    expect(gate).toHaveBeenCalledTimes(1);
    expect(askBox.calls.length).toBe(3);
  });

  it('确认门未注入（无授权通道）按跳过处理：不烧调用，整链继续', async () => {
    const msgs = imageMsgs();
    await seedStore(msgs);
    const askBox = makeAskDescribe();
    await startJobs(app, [target(msgs)], { maxRetries: 0, sleep: async () => {}, ...makeAsks(), askDescribe: askBox.ask });
    await whenIdle();
    const job = jobOf();
    expect(job?.status).toBe('done');
    expect(askBox.ask).not.toHaveBeenCalled();
    expect(job?.describe?.skipped).toBe(true);
  });

  it('重启续跑：崩溃遗留 interrupted 任务恢复后不再重复弹确认，只补未描述的图', async () => {
    const msgs = imageMsgs();
    await seedStore(msgs);
    // 盘上遗留：describe 已确认（confirmed 记账），p1 的描述上次已并仓、p2 / p3 待补
    await safe.write(TALKER, (rec) => {
      rec.store.msgs.find((x) => x.key === 'p1')!.text = '[图片] 上次已并仓';
      rec.job = {
        talker: TALKER,
        name: '构造对象',
        mode: 'full',
        fileLabel: `数据源:${TALKER}`,
        status: 'running',
        stage: 'describe',
        msgCount: 3,
        contentHash: 'stale',
        chunks: [],
        batchesDone: 0,
        results: [],
        describe: { imgCount: 3, batchSize: 2, totalBatches: 2, doneBatches: 1, confirmed: true },
        startedAt: '2026-09-26T00:00:00.000Z',
        updatedAt: '2026-09-26T00:00:00.000Z',
      };
    });
    const gateBox = makeGate('start');
    const askBox = makeAskDescribe();
    await resumeJobs(app, { ...makeAsks(), askDescribe: askBox.ask, askDescribeConfirm: gateBox.gate });
    expect(jobOf()?.status).toBe('interrupted'); // 中断不自动续（烧 token 等用户点）
    expect(resume(TALKER)).toBe(true);
    await whenIdle();
    const job = jobOf();
    expect(job?.status).toBe('done');
    expect(gateBox.gate).not.toHaveBeenCalled(); // confirmed 记账：续跑不重复弹确认
    expect(askBox.calls.length).toBe(2); // 批边界按遗留账本重导（[p1,p2],[p3]）：p2 一批、p3 一批
    expect(askBox.calls[0].length).toBe(1);
    const rec = await safe.read(TALKER);
    expect(rec!.store.msgs.find((x) => x.key === 'p1')?.text).toBe('[图片] 上次已并仓'); // 已描述的不重写
    expect(rec!.store.msgs.find((x) => x.key === 'p3')?.text).toContain('[图片] 构造描述');
  });
});
