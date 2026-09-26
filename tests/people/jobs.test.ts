// @vitest-environment node
/**
 * 脸谱生成任务引擎测试（issue 450 E1）：任务创建与逐批落盘（批完成即原子写）、
 * ADR-0191 隐私红线（批内对话行 / 消息原文不进 people-jobs.json）、切批与抽样进度说明、
 * 暂停（当前批完成后停）与断点续跑（跳过已完成批不重烧）、指纹漂移判废、
 * 中断标记（running → interrupted）、subscribe 推送与退订、增量模式合并与 skip 跳过、
 * storagePath 覆盖基目录。（MockVault + 假 ask，全部构造数据）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startJobs,
  resumeJobs,
  resume,
  pauseJobs,
  snapshot,
  subscribe,
  removeJob,
  whenIdle,
  fingerprintOf,
  JobStore,
  DRIFT_ERROR,
  __resetJobsForTests,
  type JobTarget,
  type PersonJob,
} from '../../src/people/jobs';
import { chunkMessages, chunkMetaOf, DEFAULTS, type DigestChunk } from '../../src/people/digest';
import { computeInsights, emptyInsightSignals } from '../../src/people/insights';
import { storeStatsOf, storeToUnified, type StoreMsg } from '../../src/people/datasource';
import { PeopleStore } from '../../src/people/data';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { SafeManager } from '../../src/encrypt/data';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

const TALKER = 'wxid_test';
const BASE = Date.UTC(2024, 4, 1, 12, 0, 0);

/** 构造一条聊天仓消息（时间线形态：type=1 有文本；key 递增） */
function pm(n: number, text = `构造消息${n}`): StoreMsg {
  return { key: `k${n}`, ts: BASE + n * 60000, isSender: n % 2 === 1, type: 1, text };
}

/** 假提炼批回执（每批同内容：跨批去重后素材唯一；issue 455 起带 interests / threads 两类） */
const BATCH_JSON = JSON.stringify({
  events: [{ ts: '2024-05-01', kind: 'major', summary: '构造事件' }],
  traits: ['构造特质'],
  quotes: [{ ts: '2024-05-01', who: '对方', text: '构造原话' }],
  moments: [{ ts: '2024-05-01', summary: '构造场景' }],
  interests: [{ ts: '2024-05-01', topic: '构造话题' }],
  threads: [{ ts: '2024-05-01', text: '下次一起构造' }],
});

function makeAsks() {
  return {
    askExtract: vi.fn(async () => BATCH_JSON),
    // 三次文本调用（issue 455）：其人 → 我们 → 时间线，按 prompt 特征分支
    askPortrait: vi.fn(async (p: string) => {
      if (p.includes('关系时间线')) return '## 2024 年';
      if (p.includes('要产出的卷二')) return '## 关系定性\n构造我们';
      return '## 画像速写\n构造画像';
    }),
  };
}

let vault: MockVault;
let app: any;
let sm: SafeManager;
let safe: PeopleSafeStore;
const PW = 'jobs-test-pw';

/** 聊天仓播种（467）：写进该联系人的保库记录 store 段（不再有 people-preview.json） */
async function seedPreview(msgs: StoreMsg[], name = TALKER): Promise<void> {
  await safe.write(name, (rec) => {
    rec.store = {
      msgs,
      watermarkSid: 0,
      stats: storeStatsOf(msgs),
      kindCounts: { 文本: msgs.length },
      updatedAt: '2026-09-25T00:00:00.000Z',
    };
  });
}

/** 任务播种（崩溃现场构造用）：直接把任务挂进保库记录 job 段 */
async function seedJob(name: string, j: PersonJob): Promise<void> {
  await safe.write(name, (rec) => {
    rec.job = j;
  });
}

function target(msgs: StoreMsg[], over: Partial<JobTarget> = {}): JobTarget {
  return {
    talker: TALKER,
    name: '构造对象',
    msgs: storeToUnified(msgs),
    kindCounts: {},
    skippedCount: 0,
    fileLabel: `数据源:${TALKER}`,
    ...over,
  };
}

/** vault 内全部明文内容拼串（467 隐私断言用：加密库外不得出现任何聊天数据） */
function allVaultText(): string {
  return [...vault.files.entries()].map(([p, c]) => `${p}:${c}`).join('\n');
}

/** 读盘上全部任务（各保库记录 job 段；JobStore.read 同口径排序） */
async function readQueue(): Promise<PersonJob[]> {
  return (await new JobStore(app).read()).queue;
}

/** 轮询等待（引擎是后台 promise，测试以落盘记录 / 调用计数为条件） */
async function until(cond: () => boolean | Promise<boolean>): Promise<void> {
  for (let i = 0; i < 2000; i++) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('jobs.test: 等待条件超时');
}

beforeEach(async () => {
  vault = new MockVault();
  app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
  resetObsidianMocks();
  __resetJobsForTests();
  // 保库注入缝（467）：MockVault 上的真 SafeManager，先解锁再交给引擎 / 门面共用
  sm = new SafeManager('CONFIG/.ENCRYPT');
  await sm.unlock(PW);
  safe = new PeopleSafeStore(sm);
  setPeopleSafeStoreForTests(safe);
});

afterEach(() => {
  __resetJobsForTests();
  setPeopleSafeStoreForTests(null);
  sm.lock();
});

/** 盘上某位联系人的记录（断言用） */
function recordOf(talker: string): Promise<{ job: PersonJob | null } | null> {
  return safe.read(talker).then((r) => (r ? { job: r.job ?? null } : null));
}

describe('startJobs：任务创建与逐批落盘', () => {
  it('排队跑完：双卷产物挂 job、批次计数正确、文件结构与隐私红线', async () => {
    const msgs = [pm(0), pm(1), pm(2), pm(3)];
    await seedPreview(msgs);
    const { askExtract, askPortrait } = makeAsks();
    const r = await startJobs(app, [target(msgs)], { chunkOpts: { maxCount: 2 }, askExtract, askPortrait });
    expect(r.queued).toEqual(['构造对象']);
    expect(r.skipped).toEqual([]);
    await whenIdle();

    const snap = snapshot();
    const job = snap.queue[0];
    expect(job.status).toBe('done');
    expect(job.stage).toBe('done');
    expect(job.batchesDone).toBe(2);
    expect(job.results).toHaveLength(2);
    expect(job.person).toContain('画像速写'); // 卷一《其人》
    expect(job.bond).toContain('关系定性'); // 卷二《我们》
    expect(job.chronicle).toBe('## 2024 年');
    expect(job.events).toEqual([{ ts: '2024-05-01', summary: '构造事件', kind: 'major' }]); // 跨批同事件去重 + kind 回填
    expect(job.quotes).toEqual([{ ts: '2024-05-01', who: '对方', text: '构造原话' }]);
    expect(job.material?.traits).toEqual(['构造特质']);
    expect(job.material?.moments).toEqual([{ ts: '2024-05-01', summary: '构造场景' }]);
    expect(job.material?.interests).toEqual([{ ts: '2024-05-01', topic: '构造话题' }]); // issue 455 新素材落盘
    expect(job.material?.threads).toEqual([{ ts: '2024-05-01', text: '下次一起构造' }]);
    expect(job.message).toBe('「构造对象」脸谱已生成');
    expect(askExtract).toHaveBeenCalledTimes(2);
    expect(askPortrait).toHaveBeenCalledTimes(3); // 其人 + 我们 + 时间线
    expect(snap.running).toBe(false);
    expect(snap.currentIndex).toBe(-1);

    // 落盘结构（467）：任务落在该联系人保库记录的 job 段
    const saved = (await recordOf(TALKER))?.job;
    expect(saved?.status).toBe('done');
    expect(saved?.batchesDone).toBe(2);
    // 导入记录元数据（ui 层落 ImportRecord 所需）
    expect(saved?.importRecord).toEqual({
      fileLabel: `数据源:${TALKER}`,
      skippedCount: 0,
      messageCount: 4,
      timeFrom: new Date(msgs[0].ts).toISOString(),
      timeTo: new Date(msgs[3].ts).toISOString(),
    });
    expect(saved?.stats).toBeTruthy();

    // 隐私口径（ADR-0194 取代 ADR-0191 §2）：消息原文与批内对话行不落盘，
    // 且 467 起任务 / 提炼产物整体只进加密库——vault 任何明文角落都搜不到
    expect(allVaultText()).not.toContain('构造消息');
    expect(allVaultText()).not.toContain('"lines"');
    expect(allVaultText()).not.toContain('[2024-');
    expect(vault.files.has('CONFIG/STORAGE/people-jobs.json')).toBe(false);
  });

  it('切批说明（缺省双限 = digest.DEFAULTS，成文三次调用）与逐批 / 四阶段文案经 subscribe 推送；每批完成即落盘', async () => {
    const msgs = [pm(0), pm(1), pm(2), pm(3)];
    await seedPreview(msgs);
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((res) => {
      release = res;
    });
    const askExtract = vi.fn(async () => {
      calls += 1;
      if (calls === 2) await gate; // 卡住第 2 批，验证第 1 批已落盘
      return BATCH_JSON;
    });
    const { askPortrait } = makeAsks();
    const messages: string[] = [];
    const stages: string[] = [];
    subscribe((s) => {
      if (s.queue[0]?.message) messages.push(s.queue[0].message);
      if (s.queue[0]?.stage) stages.push(s.queue[0].stage);
    });
    void startJobs(app, [target(msgs)], { chunkOpts: { maxCount: 2 }, askExtract, askPortrait });
    await until(async () => (await readQueue())[0]?.batchesDone === 1);

    // 第一批完成即原子落盘（任务仍在跑）
    expect((await readQueue())[0].status).toBe('running');
    expect((await readQueue())[0].stage).toBe('extracting');
    expect((await readQueue())[0].results).toHaveLength(1);
    release();
    await whenIdle();

    // 切批说明在切批后立刻可算（AI 调用预告 = 批数 + 3：其人 / 我们 / 时间线）
    expect(messages).toContain(`消息 4 条 → 2 批（每批 ≤2 条 · ≤12000 字），共 5 次 AI 调用`);
    expect(messages.some((m) => /^第 1\/2 批 · \d{4}-\d{2}-\d{2} ~ \d{4}-\d{2}-\d{2} · 2 条$/.test(m))).toBe(true);
    expect(messages.some((m) => /^第 2\/2 批 · /.test(m))).toBe(true);
    // 成文阶段四段（issue 455）：素材 → 《其人》 → 《我们》 → 时间线
    expect(messages).toContain('素材采集完成：事件 1 · 原话 1 · 场景 1 · 特质 1 → 正在生成《其人》');
    expect(messages).toContain('《其人》完成，正在生成《我们》…');
    expect(messages).toContain('双卷完成，正在生成关系时间线…');
    expect(stages).toEqual(expect.arrayContaining(['extracting', 'person', 'bond', 'chronicle', 'done']));
  });

  it('无可提炼文本 / 空消息目标不排队，计入 skipped', async () => {
    await seedPreview([pm(0)]);
    const { askExtract, askPortrait } = makeAsks();
    const r = await startJobs(app, [target([pm(0, '有内容')]), target([], { name: '空仓' })], { askExtract, askPortrait });
    expect(r.queued).toEqual(['构造对象']);
    expect(r.skipped).toEqual(['空仓']);
    await whenIdle();
    expect(await readQueue()).toHaveLength(1);
  });

  it('monthly / profile 透传（issue 455）：statsNote 带「消息密度」段、素材〇随 material 落盘', async () => {
    const msgs = [pm(0), pm(1)];
    await seedPreview(msgs);
    const insights = computeInsights([], emptyInsightSignals());
    const { askExtract, askPortrait } = makeAsks();
    await startJobs(
      app,
      [target(msgs, { insights, monthly: [['2026-04', 4239], ['2026-03', 6221]], profile: { tags: ['同学'], note: '手动备注' } })],
      { chunkOpts: { maxCount: 1 }, askExtract, askPortrait }
    );
    await whenIdle();
    const job = (await readQueue())[0];
    // 密度段按月升序进 statsNote（buildStatsNote 第二参）
    expect(job.material?.statsNote).toContain('消息密度：2026-03 6221 条、2026-04 4239 条');
    // 档案段排队时定稿并落 material（重启续跑不用重算）
    expect(job.material?.profileNote).toContain('关系标签：同学');
    expect(job.material?.profileNote).toContain('备注：手动备注');
    const personPrompts = (askPortrait as any).mock.calls.map((c: any[]) => c[0] as string);
    expect(personPrompts.some((p: string) => p.includes('消息密度：2026-03 6221 条'))).toBe(true);
    expect(personPrompts.filter((p: string) => p.includes('关系标签：同学'))).toHaveLength(2); // 两卷都吃素材〇
  });
});

describe('抽样说明（超大记录）', () => {
  it('超 maxBatches：均匀抽样封顶，未抽中的批次不送 AI，说明文案带全时段', async () => {
    const msgs = Array.from({ length: 6 }, (_, i) => pm(i));
    await seedPreview(msgs);
    const { askExtract, askPortrait } = makeAsks();
    const messages: string[] = [];
    subscribe((s) => {
      if (s.queue[0]?.message) messages.push(s.queue[0].message);
    });
    await startJobs(app, [target(msgs)], { chunkOpts: { maxCount: 1, maxBatches: 2 }, askExtract, askPortrait });
    await whenIdle();

    const job = (await readQueue())[0];
    expect(job.status).toBe('done');
    expect(job.chunks).toHaveLength(2);
    expect(job.batchesDone).toBe(2);
    expect(job.results).toHaveLength(2);
    expect(askExtract).toHaveBeenCalledTimes(2); // 6 批只送抽中的 2 批
    expect(messages).toContain(
      `消息 6 条 → 6 批超上限，均匀抽样 2 批（覆盖 2024-05-01 ~ 2024-05-01 全时段，首尾必保，未抽中的批次不送 AI）`
    );
  });
});

describe('暂停与断点续跑', () => {
  /** 公共装配：3 批任务暂停在第 2 批完成处（第 2 批 AI 调用被闸门放行后收尾） */
  async function setupPaused(): Promise<{ askExtract: ReturnType<typeof vi.fn>; msgs: StoreMsg[] }> {
    const msgs = [pm(0), pm(1), pm(2)]; // maxCount 1 → 3 批
    await seedPreview(msgs);
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((res) => {
      release = res;
    });
    const askExtract = vi.fn(async () => {
      calls += 1;
      if (calls === 2) await gate;
      return BATCH_JSON;
    });
    const { askPortrait } = makeAsks();
    const started = startJobs(app, [target(msgs)], { chunkOpts: { maxCount: 1 }, askExtract, askPortrait });
    await until(() => calls >= 2); // 第 2 批调用已发出
    pauseJobs(); // 请求暂停：当前批（第 2 批）完成后生效
    release();
    await started;
    await whenIdle();
    const job = (await readQueue())[0];
    expect(job.status).toBe('paused');
    expect(job.batchesDone).toBe(2);
    expect(job.results).toHaveLength(2);
    expect(job.message).toBe('已暂停（2/3 批）');
    return { askExtract, msgs };
  }

  it('暂停：当前批完成后停；resume 续跑只补剩余批', async () => {
    const { askExtract } = await setupPaused();
    const callsBefore = (askExtract as any).mock.calls.length as number; // 已烧 2 批
    expect(resume(TALKER)).toBe(true);
    await whenIdle();

    const done = (await readQueue())[0];
    expect(done.status).toBe('done');
    expect(done.stage).toBe('done');
    expect(done.batchesDone).toBe(3);
    expect(done.results).toHaveLength(3);
    expect((askExtract as any).mock.calls.length).toBe(callsBefore + 1); // 只补第 3 批，不重烧
  });

  it('指纹漂移判废：暂停期间导入过新数据 → error + 冻结文案；判废后不可续、可删除', async () => {
    const { msgs } = await setupPaused();
    // 中途导入新数据：聊天仓多一条 → 指纹漂移
    await seedPreview([...msgs, pm(9)]);
    resume(TALKER);
    await whenIdle();

    const job = (await readQueue())[0];
    expect(job.status).toBe('error');
    expect(job.error).toBe(DRIFT_ERROR);
    expect(job.error).toBe('消息集已变化（导入过新数据），请删除任务后重新生成');
    expect(resume(TALKER)).toBe(false); // 判废任务不可再续
    await expect(removeJob(TALKER)).resolves.toBe(true);
    expect(await readQueue()).toEqual([]);
    expect(snapshot().queue).toEqual([]);
  });

  it('内容哈希指纹（466 / ADR-0197）：条数不变、内容变了 → 同样漂移判废（旧「条数+末条键」察觉不到）', async () => {
    const { msgs } = await setupPaused();
    // 中途回写升级：条数不变，某条文本被 upsert 覆盖（如语音转写补上）
    await seedPreview([pm(0, '构造消息0（升级后）'), ...msgs.slice(1)]);
    resume(TALKER);
    await whenIdle();
    const job = (await readQueue())[0];
    expect(job.status).toBe('error');
    expect(job.error).toBe(DRIFT_ERROR);
  });

  it('AI 调用类失败可续跑（451）：error → resume 从断点补剩余批，已付批次不重烧', async () => {
    const msgs = [pm(0), pm(1), pm(2)]; // maxCount 1 → 3 批
    await seedPreview(msgs);
    let calls = 0;
    let fail = true;
    const askExtract = vi.fn(async () => {
      calls += 1;
      if (calls === 2 && fail) throw new Error('AI 调用超时');
      return BATCH_JSON;
    });
    const { askPortrait } = makeAsks();
    // maxRetries: 0 关掉批级重试（453 引入）——本用例测的是「error 能被 resume 接上」，
    // 重试自愈另有用例；不关的话第 2 批会被重试救活，测不到 error 路径
    const started = startJobs(app, [target(msgs)], { chunkOpts: { maxCount: 1 }, askExtract, askPortrait, maxRetries: 0 });
    await started;
    await whenIdle();

    const failed = (await readQueue())[0];
    expect(failed.status).toBe('error');
    expect(failed.error).toBe('AI 调用超时');
    expect(failed.batchesDone).toBe(1);
    expect(failed.results).toHaveLength(1); // 第 1 批已付、保留
    expect(calls).toBe(2); // 第 1 批成功 + 第 2 批失败

    fail = false;
    expect(resume(TALKER)).toBe(true); // 451：AI 调用类失败受理（漂移判废仍不受理，见上一条）
    await whenIdle();
    const done = (await readQueue())[0];
    expect(done.status).toBe('done');
    expect(done.batchesDone).toBe(3);
    expect(done.results).toHaveLength(3);
    expect(calls).toBe(4); // 只补第 2、3 批——第 1 批（已付）不重烧
  });

  it('批级重试（453）：单批失败自动重试，退避期间推「正在重试」文案，重试成功任务照常跑完', async () => {
    const msgs = [pm(0), pm(1), pm(2)]; // maxCount 1 → 3 批
    await seedPreview(msgs);
    let calls = 0;
    const waits: string[] = [];
    const askExtract = vi.fn(async () => {
      calls += 1;
      if (calls === 2) throw new Error('AI 调用超时'); // 第 2 批首次失败，重试成功
      return BATCH_JSON;
    });
    const { askPortrait } = makeAsks();
    await startJobs(app, [target(msgs)], {
      chunkOpts: { maxCount: 1 },
      askExtract,
      askPortrait,
      maxRetries: 2,
      sleep: async () => {
        waits.push(snapshot().queue[0]?.message ?? ''); // 退避等待里读到的应是重试文案
      },
    });
    await whenIdle();

    const job = (await readQueue())[0];
    expect(job.status).toBe('done');
    expect(job.batchesDone).toBe(3); // 重试自愈，任务不停
    expect(calls).toBe(4); // 批 1 + 批 2（失败）+ 批 2 重试 + 批 3
    expect(waits).toHaveLength(1); // 只重试了一次
    expect(waits[0]).toContain('正在重试 1/2');
    expect(waits[0]).toContain('AI 调用超时');
  });

  it('批级重试（453）：重试耗尽 → error，已完成批次保留、文案说清不必从头重来', async () => {
    const msgs = [pm(0), pm(1), pm(2)];
    await seedPreview(msgs);
    let calls = 0;
    const askExtract = vi.fn(async () => {
      calls += 1;
      if (calls >= 2) throw new Error('AI 调用超时'); // 第 2 批永远失败
      return BATCH_JSON;
    });
    const { askPortrait } = makeAsks();
    await startJobs(app, [target(msgs)], {
      chunkOpts: { maxCount: 1 },
      askExtract,
      askPortrait,
      maxRetries: 2,
      sleep: async () => {},
    });
    await whenIdle();

    const job = (await readQueue())[0];
    expect(job.status).toBe('error');
    expect(job.batchesDone).toBe(1); // 第 1 批成果保留
    expect(job.results).toHaveLength(1);
    expect(calls).toBe(4); // 批 1 + 批 2 的 1 次 + 2 次重试
    expect(job.message).toContain('已完成 1 批保留'); // 455 评审：精简文案（具体错误归进度块错误行）
    expect(resume(TALKER)).toBe(true); // 仍可续（451 口径）
  });

  it('startJobs 复用已完成批次（453）：error 后重新排队同靶 → 续跑，已付批次不重烧', async () => {
    const msgs = [pm(0), pm(1), pm(2)];
    await seedPreview(msgs);
    let calls = 0;
    let fail = true;
    const askExtract = vi.fn(async () => {
      calls += 1;
      if (calls === 2 && fail) throw new Error('AI 调用超时');
      return BATCH_JSON;
    });
    const { askPortrait } = makeAsks();
    const opts = { chunkOpts: { maxCount: 1 }, askExtract, askPortrait, maxRetries: 0 };
    await startJobs(app, [target(msgs)], opts);
    await whenIdle();
    expect((await readQueue())[0].status).toBe('error');
    const paid = (askExtract as any).mock.calls.length;
    expect(paid).toBe(2);

    // 重新点「画脸谱」：同靶、同指纹 → 复用旧任务（过去这里整体替换 = 从第 1 批重烧）
    fail = false;
    const again = await startJobs(app, [target(msgs)], opts);
    expect(again.resumed).toEqual(['构造对象']);
    expect(again.queued).toEqual(['构造对象']);
    await whenIdle();

    const done = (await readQueue())[0];
    expect(done.status).toBe('done');
    expect(done.batchesDone).toBe(3);
    expect(done.results).toHaveLength(3);
    expect((askExtract as any).mock.calls.length).toBe(paid + 2); // 只补第 2、3 批
  });

  it('startJobs 不复用（453）：聊天仓变了 → 指纹对不上，重排新任务从头跑', async () => {
    const msgs = [pm(0), pm(1), pm(2)];
    await seedPreview(msgs);
    let calls = 0;
    const askExtract = vi.fn(async () => {
      calls += 1;
      if (calls === 2) throw new Error('AI 调用超时');
      return BATCH_JSON;
    });
    const { askPortrait } = makeAsks();
    const opts = { chunkOpts: { maxCount: 1 }, askExtract, askPortrait, maxRetries: 0 };
    await startJobs(app, [target(msgs)], opts);
    await whenIdle();
    expect((await readQueue())[0].status).toBe('error');

    const grown = [...msgs, pm(9)]; // 中途导入过新数据
    await seedPreview(grown);
    const again = await startJobs(app, [target(grown)], opts);
    expect(again.resumed).toEqual([]); // 接不上：不复用
    await whenIdle();
    const job = (await readQueue())[0];
    expect(job.status).toBe('done');
    expect(job.batchesDone).toBe(4); // 新靶 4 批全跑
  });

  it('removeJob 运行中删除：立即收手、不落盘已废批次', async () => {
    const msgs = [pm(0), pm(1), pm(2), pm(3)];
    await seedPreview(msgs);
    let release!: () => void;
    const gate = new Promise<void>((res) => {
      release = res;
    });
    let calls = 0;
    const askExtract = vi.fn(async () => {
      calls += 1;
      if (calls === 1) await gate;
      return BATCH_JSON;
    });
    const { askPortrait } = makeAsks();
    void startJobs(app, [target(msgs)], { chunkOpts: { maxCount: 2 }, askExtract, askPortrait });
    await until(() => calls >= 1);
    await expect(removeJob(TALKER)).resolves.toBe(true);
    release();
    await whenIdle();
    expect(await readQueue()).toEqual([]);
    expect(snapshot().queue).toEqual([]);
  });
});

describe('resumeJobs：中断标记与重启续跑', () => {
  it('启动扫描把 running 标为 interrupted；resume 从断点续跑（已完成批不重烧）', async () => {
    const msgs = [pm(0), pm(1), pm(2), pm(3)];
    await seedPreview(msgs);
    // 构造崩溃现场：running + 已完成 1 批（批元数据与指纹按引擎同口径构造）
    const chunks: DigestChunk[] = chunkMessages(storeToUnified(msgs), { ...DEFAULTS, maxCount: 2 });
    const fp = fingerprintOf(storeToUnified(msgs));
    const crashed: PersonJob = {
      talker: TALKER,
      name: '构造对象',
      mode: 'full',
      fileLabel: `数据源:${TALKER}`,
      status: 'running',
      stage: 'extracting',
      msgCount: fp.msgCount,
      contentHash: fp.contentHash,
      chunkOpts: { ...DEFAULTS, maxCount: 2 },
      chunks: chunks.map(chunkMetaOf),
      batchesDone: 1,
      results: [JSON.parse(BATCH_JSON)],
      startedAt: '2026-09-25T00:00:00.000Z',
      updatedAt: '2026-09-25T00:00:00.000Z',
    };
    await seedJob(TALKER, crashed); // 崩溃现场：任务挂在保库记录 job 段（467）

    const { askExtract, askPortrait } = makeAsks();
    await resumeJobs(app, { askExtract, askPortrait });
    expect((await readQueue())[0].status).toBe('interrupted'); // running → interrupted
    expect((await readQueue())[0].results).toHaveLength(1); // 已付批次保留
    expect((await readQueue())[0].message).toBe('上次未完成，可从断点继续');

    expect(resume(TALKER)).toBe(true);
    await whenIdle();
    const done = (await readQueue())[0];
    expect(done.status).toBe('done');
    expect(done.batchesDone).toBe(2);
    expect(done.results).toHaveLength(2); // 断点前 1 批不重烧
    expect(askExtract).toHaveBeenCalledTimes(1); // 只补第 2 批
    expect(done.person).toContain('画像速写');
    expect(askPortrait).toHaveBeenCalledTimes(3); // 其人 + 我们 + 时间线
  });

  it('旧落盘兼容（issue 455）：in-flight job 的 portrait 读入视作 person，续跑已缓存批次照常复用、重画双卷', async () => {
    const msgs = [pm(0), pm(1), pm(2)];
    await seedPreview(msgs);
    const chunks: DigestChunk[] = chunkMessages(storeToUnified(msgs), { ...DEFAULTS, maxCount: 1 });
    const fp = fingerprintOf(storeToUnified(msgs));
    // 旧版任务形态：单卷 portrait 字段 + 旧阶段名 'portrait'（无 person/bond 概念）
    const legacy = {
      talker: TALKER,
      name: '构造对象',
      mode: 'full',
      fileLabel: `数据源:${TALKER}`,
      status: 'interrupted',
      stage: 'portrait',
      msgCount: fp.msgCount,
      contentHash: fp.contentHash,
      chunkOpts: { ...DEFAULTS, maxCount: 1 },
      chunks: chunks.map(chunkMetaOf),
      batchesDone: 2,
      results: [JSON.parse(BATCH_JSON), JSON.parse(BATCH_JSON)],
      portrait: '## 画像速写\n旧单卷画像',
      startedAt: '2026-09-25T00:00:00.000Z',
      updatedAt: '2026-09-25T00:00:00.000Z',
    };
    await seedJob(TALKER, legacy as unknown as PersonJob);

    const { askExtract, askPortrait } = makeAsks();
    await resumeJobs(app, { askExtract, askPortrait });
    expect((await readQueue())[0].person).toBe('## 画像速写\n旧单卷画像'); // portrait → person 映射
    expect((await readQueue())[0].results).toHaveLength(2); // 已付批次保留

    expect(resume(TALKER)).toBe(true);
    await whenIdle();
    const done = (await readQueue())[0];
    expect(done.status).toBe('done');
    expect(done.batchesDone).toBe(3);
    expect(done.results).toHaveLength(3);
    expect(askExtract).toHaveBeenCalledTimes(1); // 只补第 3 批——issue 453 批级复用语义不回退
    expect(done.person).toContain('构造画像'); // 从《其人》阶段起重画双卷
    expect(done.bond).toContain('构造我们');
    expect(askPortrait).toHaveBeenCalledTimes(3);
  });

  it('样本警示与档案段（issue 455）：msgCount < 200 两卷 prompt 头注样本警示；target.profile 进素材〇', async () => {
    const msgs = [pm(0), pm(1)];
    await seedPreview(msgs);
    const { askExtract, askPortrait } = makeAsks();
    await startJobs(app, [target(msgs, { profile: { birthday: '1994-02-14', tags: ['同学'] } })], {
      chunkOpts: { maxCount: 1 },
      askExtract,
      askPortrait,
    });
    await whenIdle();
    const personPrompts = (askPortrait as any).mock.calls.map((c: any[]) => c[0] as string);
    expect(personPrompts.filter((p: string) => p.includes('本次样本仅 2 条消息'))).toHaveLength(2); // 其人 + 我们共用
    expect(personPrompts.filter((p: string) => p.includes('生日：1994-02-14'))).toHaveLength(2); // 素材〇进两卷
  });
});

describe('subscribe 推送与退订', () => {
  it('订阅即推当前态、阶段推进续推；退订后不再推', async () => {
    await seedPreview([pm(0), pm(1)]);
    const pushes: number[] = [];
    const off = subscribe((s) => pushes.push(s.queue.length));
    const { askExtract, askPortrait } = makeAsks();
    await startJobs(app, [target([pm(0), pm(1)])], { chunkOpts: { maxCount: 1 }, askExtract, askPortrait });
    await whenIdle();
    expect(pushes.length).toBeGreaterThan(1); // 启动 / 逐批 / 成文 / 终局都有推送
    expect(pushes.every((n) => n === 1)).toBe(true);

    const before = pushes.length;
    off();
    removeJob(TALKER); // 触发一次 emit
    expect(pushes.length).toBe(before);
  });
});

describe('增量模式与 skip 跳过', () => {
  it('auto 模式按增量计划走 incremental：提炼集只含新消息，旧素材并入终局产物', async () => {
    const msgs = [pm(0), pm(1), pm(2), pm(3)];
    await seedPreview(msgs);
    const people = new PeopleStore(app);
    await people.upsert({
      id: TALKER,
      name: '构造对象',
      createdAt: '2026-01-01T00:00:00.000Z',
      imports: [
        {
          file: '构造.csv',
          importedAt: '2026-01-02T00:00:00.000Z',
          messageCount: 2,
          skippedCount: 0,
          timeFrom: new Date(msgs[0].ts).toISOString(),
          timeTo: new Date(msgs[1].ts).toISOString(),
        },
      ],
      lastProcessedTs: msgs[1].ts,
      digest: {
        portrait: '旧画像',
        events: [{ ts: '2024-04-01', summary: '旧事件' }],
        quotes: [],
        generatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    const { askExtract, askPortrait } = makeAsks();
    const r = await startJobs(app, [target(msgs)], { chunkOpts: { maxCount: 2 }, askExtract, askPortrait });
    expect(r.queued).toEqual(['构造对象']);
    await whenIdle();

    const job = (await readQueue())[0];
    expect(job.mode).toBe('incremental'); // 有锚点 + 有新消息
    // 同秒容差：锚点同秒的 msgs[1] 也算新素材 → 提炼集 = msgs[1..3] 共 3 条
    expect(job.importRecord?.messageCount).toBe(3);
    expect(job.batchesDone).toBe(2);
    expect(job.events).toEqual([
      { ts: '2024-04-01', summary: '旧事件' },
      { ts: '2024-05-01', summary: '构造事件', kind: 'major' },
    ]); // 旧事件不丢
    expect(job.person).toContain('画像速写');
    expect(job.bond).toContain('关系定性');
  });

  it('整份指纹已在导入记录里（同一导出再导）→ 跳过不排队', async () => {
    const msgs = [pm(0), pm(1), pm(2), pm(3)];
    await seedPreview(msgs);
    const people = new PeopleStore(app);
    await people.upsert({
      id: TALKER,
      name: '构造对象',
      createdAt: '2026-01-01T00:00:00.000Z',
      imports: [
        {
          file: '构造.csv',
          importedAt: '2026-01-02T00:00:00.000Z',
          messageCount: 4,
          skippedCount: 0,
          timeFrom: new Date(msgs[0].ts).toISOString(),
          timeTo: new Date(msgs[3].ts).toISOString(),
        },
      ],
      lastProcessedTs: msgs[3].ts,
    });
    const { askExtract, askPortrait } = makeAsks();
    const r = await startJobs(app, [target(msgs)], { askExtract, askPortrait });
    expect(r.queued).toEqual([]);
    expect(r.skipped).toEqual(['构造对象']);
    await whenIdle();
    expect(await readQueue()).toEqual([]);
    expect(askExtract).not.toHaveBeenCalled();
  });
});

describe('fingerprintOf 内容哈希指纹（466）', () => {
  const u = (ts: number, isSender: boolean, text: string) => ({ ts, isSender, text });
  it('同一份素材 → 同一哈希；任一条内容或顺序变 → 哈希变', () => {
    const a = [u(1, true, '甲'), u(2, false, '乙')];
    expect(fingerprintOf(a)).toEqual(fingerprintOf([u(1, true, '甲'), u(2, false, '乙')]));
    const h0 = fingerprintOf(a).contentHash;
    expect(fingerprintOf([u(1, true, '甲'), u(2, false, '乙（内容升级）')]).contentHash).not.toBe(h0); // 条数不变内容变
    expect(fingerprintOf([u(2, false, '乙'), u(1, true, '甲')]).contentHash).not.toBe(h0); // 顺序变
    expect(fingerprintOf([u(1, true, '甲')]).contentHash).not.toBe(h0); // 条数变
    expect(fingerprintOf([u(1, true, '甲'), u(2, false, '乙'), u(3, true, '丙')]).contentHash).not.toBe(h0);
  });
  it('空素材 → 条数 0 与稳定哈希', () => {
    expect(fingerprintOf([])).toEqual({ msgCount: 0, contentHash: fingerprintOf([]).contentHash });
  });
});

describe('多人队列（467：任务按人各归各的保库记录）', () => {
  it('多人按序跑完；任务与素材各自落在对应联系人的记录里，明文任务文件不再出现', async () => {
    await seedPreview([pm(0), pm(1)]);
    await seedPreview([pm(0, '乙的构造消息')], 'wxid_b');
    const { askExtract, askPortrait } = makeAsks();
    const r = await startJobs(
      app,
      [target([pm(0), pm(1)]), target([pm(0, '乙的构造消息')], { talker: 'wxid_b', name: '构造乙', fileLabel: '数据源:wxid_b' })],
      { chunkOpts: { maxCount: 1 }, askExtract, askPortrait }
    );
    expect(r.queued).toEqual(['构造对象', '构造乙']);
    await whenIdle();
    // 各自记录里的任务互不串扰（status / 批数按人断言，不依赖队列序）
    const queue = await readQueue();
    expect(queue).toHaveLength(2);
    const byTalker = new Map(queue.map((j) => [j.talker, j]));
    expect(byTalker.get(TALKER)?.status).toBe('done');
    expect(byTalker.get(TALKER)?.batchesDone).toBe(2);
    expect(byTalker.get('wxid_b')?.status).toBe('done');
    expect(byTalker.get('wxid_b')?.batchesDone).toBe(1); // 各自按消息量切批
    expect(vault.files.has('CONFIG/STORAGE/people-jobs.json')).toBe(false);
  });

  it('上锁协作暂停（ADR-0194 决策 5）：上锁 → 当前批完成即停；解锁 → kick 续跑到完', async () => {
    const msgs = [pm(0), pm(1), pm(2)]; // maxCount 1 → 3 批
    await seedPreview(msgs);
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((res) => {
      release = res;
    });
    const askExtract = vi.fn(async () => {
      calls += 1;
      if (calls === 2) await gate; // 卡住第 2 批
      return BATCH_JSON;
    });
    const { askPortrait } = makeAsks();
    const started = startJobs(app, [target(msgs)], { chunkOpts: { maxCount: 1 }, askExtract, askPortrait });
    await until(async () => calls >= 2);
    sm.lock(); // 第 2 批 AI 调用窗口内上锁：解锁态广播 → 引擎协作暂停（wireLock 接线），批级断点保留
    release();
    await started;
    await whenIdle();
    // 协作暂停落在内存（上锁期落盘被拒——密文库不可写）：批级断点 2/3 保留、不再烧第 3 批
    const paused = snapshot().queue[0];
    expect(paused.status).toBe('paused');
    expect(paused.batchesDone).toBe(2);
    expect(vault.files.has('CONFIG/STORAGE/people-jobs.json')).toBe(false);
    // 解锁 → 广播驱动 kick → 从第 3 批续跑到完（无需手动 resume）
    await sm.unlock(PW);
    await until(async () => (snapshot().queue[0]?.status ?? '') === 'done');
    const done = snapshot().queue[0];
    expect(done.batchesDone).toBe(3);
    expect((askExtract as any).mock.calls.length).toBe(3); // 第 3 批补跑，不重烧
    // 落盘收敛：任务连同成果回到保库记录
    await until(async () => ((await readQueue())[0]?.status ?? '') === 'done');
    expect((await recordOf(TALKER))?.job?.batchesDone).toBe(3);
  });
});

