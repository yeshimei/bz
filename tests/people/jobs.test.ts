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
  DRIFT_ERROR,
  __resetJobsForTests,
  type JobTarget,
  type PersonJob,
} from '../../src/people/jobs';
import { chunkMessages, chunkMetaOf, DEFAULTS, type DigestChunk } from '../../src/people/digest';
import { PreviewStore, previewStatsOf, previewToUnified, type PreviewMsg } from '../../src/people/datasource';
import { PeopleStore } from '../../src/people/data';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

const TALKER = 'wxid_test';
const BASE = Date.UTC(2024, 4, 1, 12, 0, 0);

/** 构造一条预览桶消息（秒级 ts、key 递增） */
function pm(n: number, text = `构造消息${n}`): PreviewMsg {
  return { key: `k${n}`, ts: BASE + n * 60000, isSender: n % 2 === 1, text };
}

/** 假提炼批回执（每批同内容：跨批去重后素材唯一） */
const BATCH_JSON = JSON.stringify({
  events: [{ ts: '2024-05-01', kind: 'major', summary: '构造事件' }],
  traits: ['构造特质'],
  quotes: [{ ts: '2024-05-01', who: '对方', text: '构造原话' }],
  moments: [{ ts: '2024-05-01', summary: '构造场景' }],
});

function makeAsks() {
  return {
    askExtract: vi.fn(async () => BATCH_JSON),
    askPortrait: vi.fn(async (p: string) => (p.includes('关系时间线') ? '## 2024 年' : '## 画像速写\n构造画像')),
  };
}

let vault: MockVault;
let app: any;

async function seedPreview(msgs: PreviewMsg[], name = TALKER): Promise<void> {
  const store = new PreviewStore(app);
  await store.upsertContact(name, {
    msgs,
    watermarkSid: 0,
    stats: previewStatsOf(msgs),
    kindCounts: { 文本: msgs.length },
    updatedAt: '2026-09-25T00:00:00.000Z',
  });
}

function target(msgs: PreviewMsg[], over: Partial<JobTarget> = {}): JobTarget {
  return {
    talker: TALKER,
    name: '构造对象',
    msgs: previewToUnified(msgs),
    kindCounts: {},
    skippedCount: 0,
    fileLabel: `数据源:${TALKER}`,
    ...over,
  };
}

const JOBS_PATH = 'CONFIG/STORAGE/people-jobs.json';

function fileRaw(): string {
  return vault.files.get(JOBS_PATH) ?? '';
}

function readQueue(): PersonJob[] {
  const raw = fileRaw();
  return raw ? (JSON.parse(raw).queue ?? []) : [];
}

/** 轮询等待（引擎是后台 promise，测试以落盘文件 / 调用计数为条件） */
async function until(cond: () => boolean): Promise<void> {
  for (let i = 0; i < 2000; i++) {
    if (cond()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('jobs.test: 等待条件超时');
}

beforeEach(() => {
  vault = new MockVault();
  app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
  resetObsidianMocks();
  __resetJobsForTests();
});

afterEach(() => {
  __resetJobsForTests();
});

describe('startJobs：任务创建与逐批落盘', () => {
  it('排队跑完：产物挂 job、批次计数正确、文件结构与隐私红线', async () => {
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
    expect(job.portrait).toContain('画像速写');
    expect(job.chronicle).toBe('## 2024 年');
    expect(job.events).toEqual([{ ts: '2024-05-01', summary: '构造事件', kind: 'major' }]); // 跨批同事件去重 + kind 回填
    expect(job.quotes).toEqual([{ ts: '2024-05-01', who: '对方', text: '构造原话' }]);
    expect(job.material?.traits).toEqual(['构造特质']);
    expect(job.material?.moments).toEqual([{ ts: '2024-05-01', summary: '构造场景' }]);
    expect(job.message).toBe('「构造对象」脸谱已生成');
    expect(askExtract).toHaveBeenCalledTimes(2);
    expect(askPortrait).toHaveBeenCalledTimes(2); // 画像 + 时间线
    expect(snap.running).toBe(false);
    expect(snap.currentIndex).toBe(-1);

    // 落盘结构：{ version: 1, queue: [...] }
    const data = JSON.parse(fileRaw());
    expect(data.version).toBe(1);
    const saved = data.queue[0];
    expect(saved.status).toBe('done');
    expect(saved.batchesDone).toBe(2);
    // 导入记录元数据（ui 层落 ImportRecord 所需）
    expect(saved.importRecord).toEqual({
      fileLabel: `数据源:${TALKER}`,
      skippedCount: 0,
      messageCount: 4,
      timeFrom: new Date(msgs[0].ts).toISOString(),
      timeTo: new Date(msgs[3].ts).toISOString(),
    });
    expect(saved.stats).toBeTruthy();

    // 隐私红线（ADR-0191）：消息原文与批内对话行不落盘
    expect(fileRaw()).not.toContain('构造消息');
    expect(fileRaw()).not.toContain('"lines"');
    expect(fileRaw()).not.toContain('[2024-');
  });

  it('切批说明（缺省双限 = digest.DEFAULTS）与逐批文案经 subscribe 推送；每批完成即落盘', async () => {
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
    subscribe((s) => {
      if (s.queue[0]?.message) messages.push(s.queue[0].message);
    });
    void startJobs(app, [target(msgs)], { chunkOpts: { maxCount: 2 }, askExtract, askPortrait });
    await until(() => readQueue()[0]?.batchesDone === 1);

    // 第一批完成即原子落盘（任务仍在跑）
    expect(readQueue()[0].status).toBe('running');
    expect(readQueue()[0].stage).toBe('extracting');
    expect(readQueue()[0].results).toHaveLength(1);
    release();
    await whenIdle();

    // 切批说明在切批后立刻可算（AI 调用预告 = 批数 + 2）
    expect(messages).toContain(`消息 4 条 → 2 批（每批 ≤2 条 · ≤12000 字），共 4 次 AI 调用`);
    expect(messages.some((m) => /^第 1\/2 批 · \d{4}-\d{2}-\d{2} ~ \d{4}-\d{2}-\d{2} · 2 条$/.test(m))).toBe(true);
    expect(messages.some((m) => /^第 2\/2 批 · /.test(m))).toBe(true);
    expect(messages).toContain('素材采集完成：事件 1 · 原话 1 · 场景 1 · 特质 1 → 正在生成画像');
  });

  it('无可提炼文本 / 空消息目标不排队，计入 skipped', async () => {
    await seedPreview([pm(0)]);
    const { askExtract, askPortrait } = makeAsks();
    const r = await startJobs(app, [target([pm(0, '有内容')]), target([], { name: '空桶' })], { askExtract, askPortrait });
    expect(r.queued).toEqual(['构造对象']);
    expect(r.skipped).toEqual(['空桶']);
    await whenIdle();
    expect(readQueue()).toHaveLength(1);
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

    const job = readQueue()[0];
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
  async function setupPaused(): Promise<{ askExtract: ReturnType<typeof vi.fn>; msgs: PreviewMsg[] }> {
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
    const job = readQueue()[0];
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

    const done = readQueue()[0];
    expect(done.status).toBe('done');
    expect(done.stage).toBe('done');
    expect(done.batchesDone).toBe(3);
    expect(done.results).toHaveLength(3);
    expect((askExtract as any).mock.calls.length).toBe(callsBefore + 1); // 只补第 3 批，不重烧
  });

  it('指纹漂移判废：暂停期间导入过新数据 → error + 冻结文案；判废后不可续、可删除', async () => {
    const { msgs } = await setupPaused();
    // 中途导入新数据：预览桶多一条 → 指纹漂移
    await seedPreview([...msgs, pm(9)]);
    resume(TALKER);
    await whenIdle();

    const job = readQueue()[0];
    expect(job.status).toBe('error');
    expect(job.error).toBe(DRIFT_ERROR);
    expect(job.error).toBe('消息集已变化（导入过新数据），请删除任务后重新生成');
    expect(resume(TALKER)).toBe(false); // 判废任务不可再续
    await expect(removeJob(TALKER)).resolves.toBe(true);
    expect(readQueue()).toEqual([]);
    expect(snapshot().queue).toEqual([]);
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
    expect(readQueue()).toEqual([]);
    expect(snapshot().queue).toEqual([]);
  });
});

describe('resumeJobs：中断标记与重启续跑', () => {
  it('启动扫描把 running 标为 interrupted；resume 从断点续跑（已完成批不重烧）', async () => {
    const msgs = [pm(0), pm(1), pm(2), pm(3)];
    await seedPreview(msgs);
    // 构造崩溃现场：running + 已完成 1 批（批元数据与指纹按引擎同口径构造）
    const chunks: DigestChunk[] = chunkMessages(previewToUnified(msgs), { ...DEFAULTS, maxCount: 2 });
    const fp = fingerprintOf(previewToUnified(msgs));
    const crashed: PersonJob = {
      talker: TALKER,
      name: '构造对象',
      mode: 'full',
      fileLabel: `数据源:${TALKER}`,
      status: 'running',
      stage: 'extracting',
      msgCount: fp.msgCount,
      lastMsgKey: fp.lastMsgKey,
      chunkOpts: { ...DEFAULTS, maxCount: 2 },
      chunks: chunks.map(chunkMetaOf),
      batchesDone: 1,
      results: [JSON.parse(BATCH_JSON)],
      startedAt: '2026-09-25T00:00:00.000Z',
      updatedAt: '2026-09-25T00:00:00.000Z',
    };
    vault.files.set(JOBS_PATH, JSON.stringify({ version: 1, queue: [crashed] }));

    const { askExtract, askPortrait } = makeAsks();
    await resumeJobs(app, { askExtract, askPortrait });
    expect(readQueue()[0].status).toBe('interrupted'); // running → interrupted
    expect(readQueue()[0].results).toHaveLength(1); // 已付批次保留
    expect(readQueue()[0].message).toBe('上次未完成，可从断点继续');

    expect(resume(TALKER)).toBe(true);
    await whenIdle();
    const done = readQueue()[0];
    expect(done.status).toBe('done');
    expect(done.batchesDone).toBe(2);
    expect(done.results).toHaveLength(2); // 断点前 1 批不重烧
    expect(askExtract).toHaveBeenCalledTimes(1); // 只补第 2 批
    expect(done.portrait).toContain('画像速写');
    expect(askPortrait).toHaveBeenCalledTimes(2);
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

    const job = readQueue()[0];
    expect(job.mode).toBe('incremental'); // 有锚点 + 有新消息
    // 同秒容差：锚点同秒的 msgs[1] 也算新素材 → 提炼集 = msgs[1..3] 共 3 条
    expect(job.importRecord?.messageCount).toBe(3);
    expect(job.batchesDone).toBe(2);
    expect(job.events).toEqual([
      { ts: '2024-04-01', summary: '旧事件' },
      { ts: '2024-05-01', summary: '构造事件', kind: 'major' },
    ]); // 旧事件不丢
    expect(job.portrait).toContain('画像速写');
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
    expect(readQueue()).toEqual([]);
    expect(askExtract).not.toHaveBeenCalled();
  });
});

describe('多人队列与路径覆盖', () => {
  it('多人按序跑完；storagePath 设置键覆盖基目录', async () => {
    setSettingsProvider(() => ({ storagePath: '我的数据' }) as any);
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
    expect(vault.files.has('我的数据/people-jobs.json')).toBe(true);
    const queue = JSON.parse(vault.files.get('我的数据/people-jobs.json')!).queue as PersonJob[];
    expect(queue.map((j) => j.status)).toEqual(['done', 'done']);
    expect(queue.map((j) => j.talker)).toEqual([TALKER, 'wxid_b']);
    expect(queue.map((j) => j.batchesDone)).toEqual([2, 1]); // 各自按消息量切批
  });
});

