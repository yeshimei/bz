// @vitest-environment node
/**
 * 画像生成确认门编排测试（issue 471 / ADR-0196 决策 8；第二次独立确认）：
 * 生成任务引擎（jobs.ts）在采集批切定后、烧 AI 前回调 askPortraitConfirm 的行为——
 *   · 确认门数据（服务商/模型/素材条数/约调用次数 = 采集批 + 其人 + 我们 + 时间线）；
 *   · 「取消」= 任务整条移除：不烧一次 AI 调用，队列与保库记录 job 段都清掉（与描述的
 *     「跳过 ≠ 取消」互为镜像）；
 *   · 跳过图片描述后画像门照弹（两次确认互相独立）；
 *   · 零媒体联系人：prep / describe 全跳过且不弹它们的门，画像门照弹、直通生成（决策 9）；
 *   · 确认过（portraitConfirmed 记账）暂停续跑不再二次弹窗；
 *   · 门未注入 = 放行（生产入口恒注入；引擎直调的测试 / 编程消费不阻）；门抛错按取消。
 * 测试数据全构造，不含真实聊天内容。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startJobs,
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
import type { PortraitConfirmInfo } from '../../src/people/types';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

const TALKER = 'wxid_portrait';
const DATA_ROOT = 'E:\\构造数据根';
const BASE = Date.UTC(2024, 4, 1, 12, 0, 0);
const PW = 'jobs-portrait-pw';

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

/** 假画像确认门：记录收到的确认数据，按预设答复（可注入抛错） */
function makePortraitGate(answer: 'start' | 'cancel' = 'start', opts: { reject?: boolean; onStart?: () => void } = {}) {
  const seen: Array<PortraitConfirmInfo> = [];
  const gate = vi.fn(async (info: PortraitConfirmInfo) => {
    seen.push(info);
    if (opts.reject) throw new Error('构造确认门异常');
    opts.onStart?.();
    return answer;
  });
  return { gate, seen };
}

/** 假提炼 / 画像 AI */
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

/** 构造一条仓消息 */
function m(n: number, over: Partial<StoreMsg> = {}): StoreMsg {
  return { key: `k${n}`, ts: BASE + n * 60000, isSender: n % 2 === 1, type: 1, text: `构造消息${n}`, ...over };
}

async function seedStore(msgs: StoreMsg[]): Promise<void> {
  await safe.write(TALKER, (rec) => {
    rec.store = { msgs, watermarkSid: msgs.length, stats: storeStatsOf(msgs), kindCounts: { 文本: msgs.length }, updatedAt: '2026-09-25T00:00:00.000Z' };
  });
}

function target(msgs: StoreMsg[]): JobTarget {
  return { talker: TALKER, name: '构造对象', msgs: storeToUnified(msgs), kindCounts: {}, skippedCount: 0, fileLabel: `数据源:${TALKER}` };
}

function jobOf(): PersonJob | undefined {
  return snapshot().queue.find((j) => j.talker === TALKER);
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
  setSettingsProvider(
    () => ({ storagePath: 'CONFIG/STORAGE', peopleDataDir: DATA_ROOT, aiProvider: 'zhipu-plan' }) as never
  );
});

afterEach(() => {
  __resetJobsForTests();
  setPeopleSafeStoreForTests(null);
  sm.lock();
});

describe('画像生成确认门编排（471）', () => {
  it('确认门数据与「开始」路径：素材条数 / 约调用次数（采集批 + 3）→ 三段跑完 done', async () => {
    const msgs = [m(1), m(2), m(3)];
    await seedStore(msgs);
    const gateBox = makePortraitGate('start');
    const asks = makeAsks();
    await startJobs(app, [target(msgs)], { maxRetries: 0, sleep: async () => {}, ...asks, askPortraitConfirm: gateBox.gate });
    await whenIdle();
    const job = jobOf();
    expect(job?.status).toBe('done');
    // 确认门数据（ADR-0196 决策 8：服务商/模型/素材条数/约调用次数；不报金额）
    expect(gateBox.seen.length).toBe(1);
    expect(gateBox.seen[0]).toMatchObject({
      provider: '智谱 Plan',
      model: 'glm-5.3-flash',
      name: '构造对象',
      materials: 3, // 三条文本消息全部进素材（派生文本非空口径）
      calls: 4, // 采集 1 批 + 其人 + 我们 + 时间线
    });
    expect(asks.askExtract).toHaveBeenCalledTimes(1);
    // 确认记账：落保库记录 job 段
    expect(job?.portraitConfirmed).toBe(true);
  });

  it('「取消」= 任务整条移除：不烧一次 AI 调用，队列清空', async () => {
    const msgs = [m(1), m(2), m(3)];
    await seedStore(msgs);
    const gateBox = makePortraitGate('cancel');
    const asks = makeAsks();
    await startJobs(app, [target(msgs)], { maxRetries: 0, sleep: async () => {}, ...asks, askPortraitConfirm: gateBox.gate });
    await whenIdle();
    expect(jobOf()).toBeUndefined(); // 队列里没有这条任务了
    expect(asks.askExtract).not.toHaveBeenCalled(); // 一分钱没烧
    expect(asks.askPortrait).not.toHaveBeenCalled();
    const rec = await safe.read(TALKER);
    expect(rec?.job ?? null).toBeNull(); // 保库记录 job 段同步摘除
  });

  it('跳过图片描述后画像门照弹（两次确认互相独立，决策 8）', async () => {
    const msgs = [
      m(1),
      m(2, { key: 'p1', type: 3, sid: 101, img: '2026-05/p1.jpg', text: '' }),
      m(3),
    ];
    await seedStore(msgs);
    const descGate = vi.fn(async () => 'skip' as const);
    const portraitGateBox = makePortraitGate('start');
    const asks = makeAsks();
    await startJobs(app, [target(msgs)], {
      maxRetries: 0,
      sleep: async () => {},
      ...asks,
      askDescribeConfirm: descGate,
      askPortraitConfirm: portraitGateBox.gate,
    });
    await whenIdle();
    const job = jobOf();
    expect(job?.status).toBe('done');
    expect(job?.describe?.skipped).toBe(true); // 描述被跳过
    expect(descGate).toHaveBeenCalledTimes(1);
    expect(portraitGateBox.gate).toHaveBeenCalledTimes(1); // 画像门照弹
    expect(portraitGateBox.seen[0].materials).toBe(2); // 素材 = 2 条文本（图片空文本不进素材）
  });

  it('零媒体联系人：prep / describe 全跳过不弹门，画像门照弹、直通生成（决策 9）', async () => {
    const msgs = [m(1), m(2), m(3)];
    await seedStore(msgs);
    const descGate = vi.fn(async () => 'start' as const);
    const portraitGateBox = makePortraitGate('start');
    const asks = makeAsks();
    await startJobs(app, [target(msgs)], {
      maxRetries: 0,
      sleep: async () => {},
      ...asks,
      askDescribeConfirm: descGate,
      askPortraitConfirm: portraitGateBox.gate,
    });
    await whenIdle();
    const job = jobOf();
    expect(job?.status).toBe('done');
    expect(descGate).not.toHaveBeenCalled(); // 零图片：描述门不弹
    expect(portraitGateBox.gate).toHaveBeenCalledTimes(1); // 画像门照弹
  });

  it('确认过（portraitConfirmed 记账）：提取批间暂停、续跑不再二次弹窗', async () => {
    const msgs = [m(1), m(2), m(3)];
    await seedStore(msgs);
    const gateBox = makePortraitGate('start', { onStart: () => pauseJobs() }); // 门里顺手请求暂停
    const asks = makeAsks();
    await startJobs(app, [target(msgs)], { maxRetries: 0, sleep: async () => {}, ...asks, askPortraitConfirm: gateBox.gate });
    await vi.waitFor(() => expect(jobOf()?.status).toBe('paused'), { timeout: 3000 });
    expect(gateBox.gate).toHaveBeenCalledTimes(1);
    expect(resume(TALKER)).toBe(true);
    await whenIdle();
    expect(jobOf()?.status).toBe('done');
    expect(gateBox.gate).toHaveBeenCalledTimes(1); // 续跑不重弹
    expect(asks.askExtract).toHaveBeenCalledTimes(1);
  });

  it('门未注入 = 放行（生产入口恒注入；引擎直调不阻）；门抛错按取消处理', async () => {
    const msgs = [m(1), m(2), m(3)];
    await seedStore(msgs);
    // 未注入：整链照跑（引擎直调的消费形态）
    const asks = makeAsks();
    await startJobs(app, [target(msgs)], { maxRetries: 0, sleep: async () => {}, ...asks });
    await whenIdle();
    expect(jobOf()?.status).toBe('done');
    expect(jobOf()?.portraitConfirmed).toBe(true);
    // 抛错 = 没拿到授权 → 取消（任务移除、不烧调用）
    __resetJobsForTests();
    await seedStore(msgs);
    const asks2 = makeAsks();
    const badGate = makePortraitGate('start', { reject: true });
    await startJobs(app, [target(msgs)], { maxRetries: 0, sleep: async () => {}, ...asks2, askPortraitConfirm: badGate.gate });
    await whenIdle();
    expect(jobOf()).toBeUndefined();
    expect(asks2.askExtract).not.toHaveBeenCalled();
  });
});
