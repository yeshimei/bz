// @vitest-environment node
/**
 * 画谱档案提炼编排测试（issue 487）：生成任务引擎（jobs.ts）在 chronicle 段内、
 * 关系时间线之后追加档案提炼的行为——
 *   · 素材齐时提炼被调用（asks.portrait 通道），job.aiProfile 落值且随 job 段落保库记录；
 *   · 手填档案以「已知档案（不要覆盖）」进 prompt；
 *   · 提炼失败不阻断画谱主流程：任务仍 done，aiProfile 缺省；
 *   · 四类素材（事件 / 原话 / 场景 / 特质）全空则整段跳过，不烧那次调用。
 * 测试数据全构造，不含真实聊天内容。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startJobs,
  snapshot,
  whenIdle,
  __resetJobsForTests,
  type JobTarget,
  type PersonJob,
} from '../../src/people/jobs';
import { storeStatsOf, storeToUnified, type StoreMsg } from '../../src/people/datasource';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

const TALKER = 'wxid_dims';
const DATA_ROOT = 'E:\\构造数据根';
const BASE = Date.UTC(2024, 4, 1, 12, 0, 0);
const PW = 'profile-dims-pw';

/** 档案提炼回执（覆盖新维度的构造值） */
const PROFILE_JSON = JSON.stringify({
  personality: '外冷内热，嘴硬心软',
  interests: ['爬山', '摇滚'],
  habits: '早睡早起',
  recentLife: '在准备考试',
  nickname: '老猫',
  quote: '问题不大',
  likes: ['手冲咖啡'],
  dislikes: ['香菜'],
  relationships: [{ who: '阿珍', relation: '女朋友' }],
  importantDates: [{ date: '05-20', what: '领养猫' }],
});

let vault: MockVault;
let app: any;
let sm: SafeManager;
let safe: PeopleSafeStore;

/** 假画像 AI：双卷 / 时间线 / 档案提炼按 prompt 关键字分流；档案提炼可注入回执或抛错 */
function makeAskPortrait(opts: { profileReply?: string; profileFail?: boolean; seen?: string[] } = {}) {
  return vi.fn(async (p: string) => {
    opts.seen?.push(p);
    if (p.includes('请推断档案缺失字段')) {
      if (opts.profileFail) throw new Error('档案提炼崩了');
      return opts.profileReply ?? PROFILE_JSON;
    }
    if (p.includes('关系时间线')) return '## 2024 年';
    if (p.includes('要产出的卷二')) return '## 关系定性\n构造我们';
    return '## 画像速写\n构造画像';
  });
}

function makeAskExtract(batchJson: string) {
  return vi.fn(async () => batchJson);
}

/** 构造一条仓消息 */
function m(n: number, over: Partial<StoreMsg> = {}): StoreMsg {
  return { key: `k${n}`, ts: BASE + n * 60000, isSender: n % 2 === 1, type: 1, text: `构造消息${n}`, ...over };
}

/** 有素材的批回执：四类齐全 */
const RICH_BATCH = JSON.stringify({
  events: [{ ts: '2024-05-01', kind: 'major', summary: '构造事件' }],
  traits: ['构造特质'],
  quotes: [{ ts: '2024-05-01', who: '对方', text: '构造原话' }],
  moments: [{ ts: '2024-05-01', summary: '构造场景' }],
});

/** 四类全空的批回执（issue 487 口径：跳过判定只看事件 / 原话 / 场景 / 特质这四类） */
const EMPTY_BATCH = JSON.stringify({ events: [], traits: [], quotes: [], moments: [] });

async function seedStore(msgs: StoreMsg[]): Promise<void> {
  await safe.write(TALKER, (rec) => {
    rec.store = { msgs, watermarkSid: msgs.length, stats: storeStatsOf(msgs), kindCounts: { 文本: msgs.length }, updatedAt: '2026-09-25T00:00:00.000Z' };
  });
}

async function seedPerson(profile?: Record<string, unknown>): Promise<void> {
  await safe.write(TALKER, (rec) => {
    rec.person = {
      id: TALKER,
      name: '构造对象',
      createdAt: '2026-09-01T00:00:00.000Z',
      imports: [],
      ...(profile ? { profile } : {}),
    };
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

describe('画谱档案提炼（issue 487）', () => {
  it('素材齐：时间线之后提炼档案，job.aiProfile 落值并随 job 段落保库记录', async () => {
    const msgs = [m(1), m(2), m(3)];
    await seedStore(msgs);
    const seen: string[] = [];
    const askPortrait = makeAskPortrait({ seen });
    await startJobs(app, [target(msgs)], {
      maxRetries: 0,
      sleep: async () => {},
      askExtract: makeAskExtract(RICH_BATCH),
      askPortrait,
    });
    await whenIdle();
    const job = jobOf();
    expect(job?.status).toBe('done');
    // 档案提炼走了画像通道，且排在时间线 prompt 之后
    const profIdx = seen.findIndex((p) => p.includes('请推断档案缺失字段'));
    const chronIdx = seen.findIndex((p) => p.includes('关系时间线'));
    expect(profIdx).toBeGreaterThan(chronIdx);
    expect(profIdx).toBeGreaterThanOrEqual(0);
    // aiProfile 落值（新维度齐全）+ 阶段仍报 chronicle 不新增
    expect(job?.aiProfile).toMatchObject({
      personality: '外冷内热，嘴硬心软',
      interests: ['爬山', '摇滚'],
      nickname: '老猫',
      quote: '问题不大',
      relationships: [{ who: '阿珍', relation: '女朋友' }],
      importantDates: [{ date: '05-20', what: '领养猫' }],
    });
    expect(job?.stage).toBe('done');
    // 随 job 段落保库记录（后台 / 重开面板可消费）
    const rec = await safe.read(TALKER);
    expect(rec?.job?.aiProfile).toMatchObject({ nickname: '老猫' });
  });

  it('手填档案以「已知档案（不要覆盖）」进提炼 prompt', async () => {
    const msgs = [m(1), m(2), m(3)];
    await seedStore(msgs);
    await seedPerson({ birthday: '1990-01-01', job: '设计师' });
    const seen: string[] = [];
    await startJobs(app, [target(msgs)], {
      maxRetries: 0,
      sleep: async () => {},
      askExtract: makeAskExtract(RICH_BATCH),
      askPortrait: makeAskPortrait({ seen }),
    });
    await whenIdle();
    const profPrompt = seen.find((p) => p.includes('请推断档案缺失字段'));
    expect(profPrompt).toContain('已知档案（用户手填，不要覆盖也不要重复推断）：生日 1990-01-01；职业 设计师');
  });

  it('提炼失败不阻断：任务仍 done、双卷照落，aiProfile 缺省', async () => {
    const msgs = [m(1), m(2), m(3)];
    await seedStore(msgs);
    await startJobs(app, [target(msgs)], {
      maxRetries: 0,
      sleep: async () => {},
      askExtract: makeAskExtract(RICH_BATCH),
      askPortrait: makeAskPortrait({ profileFail: true }),
    });
    await whenIdle();
    const job = jobOf();
    expect(job?.status).toBe('done');
    expect(job?.person).toContain('构造画像');
    expect(job?.bond).toContain('构造我们');
    expect(job?.chronicle).toBe('## 2024 年');
    expect(job?.aiProfile).toBeUndefined();
  });

  it('四类素材全空：整段跳过，档案提炼那次调用不烧', async () => {
    const msgs = [m(1), m(2), m(3)];
    await seedStore(msgs);
    const seen: string[] = [];
    await startJobs(app, [target(msgs)], {
      maxRetries: 0,
      sleep: async () => {},
      askExtract: makeAskExtract(EMPTY_BATCH),
      askPortrait: makeAskPortrait({ seen }),
    });
    await whenIdle();
    expect(jobOf()?.status).toBe('done');
    expect(seen.some((p) => p.includes('请推断档案缺失字段'))).toBe(false);
  });

  it('AI 回执全空 / 不支撑（无新值）：aiProfile 不挂空对象', async () => {
    const msgs = [m(1), m(2), m(3)];
    await seedStore(msgs);
    await startJobs(app, [target(msgs)], {
      maxRetries: 0,
      sleep: async () => {},
      askExtract: makeAskExtract(RICH_BATCH),
      askPortrait: makeAskPortrait({ profileReply: '{"birthday":"","interests":[]}' }),
    });
    await whenIdle();
    const job = jobOf();
    expect(job?.status).toBe('done');
    expect(job?.aiProfile).toBeUndefined();
  });
});
