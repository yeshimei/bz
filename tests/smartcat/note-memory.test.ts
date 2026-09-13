/**
 * 记忆目录数据层测试（ADR-0069 记忆目录流）：扫描/日记拆段/节流合并/增删改/目录清理/失效自愈。
 * vault 经注入 adapter（内存 map 模拟），memory.ts 契约 API 经 backend 桩承接。
 */
import { describe, it, expect } from 'vitest';
import {
  isSkippablePath,
  resolveOwnerDir,
  buildSeedsForFile,
  diarySeeds,
  noteMemoryToday,
  NoteMemorySync,
  NOTE_MEMORY_THROTTLE_MS,
  type NoteMemorySeed,
} from '../../src/smartcat/note-memory';
import { diaryEntryPath, serializeDiaryEntryFile } from '../../src/core/diary-format';

/** 内存 vault 桩 */
function makeAdapter(files: Record<string, string>, opts: { now?: () => number; diaryDir?: string } = {}) {
  const content = new Map(Object.entries(files));
  return {
    listFiles: () => [...content.keys()],
    readFile: async (p: string) => (content.has(p) ? content.get(p)! : null),
    fileMtime: (p: string) => (content.has(p) ? 1700000000000 : null),
    now: opts.now || (() => 1000000),
    diaryDirectory: () => opts.diaryDir || '我的/日记',
    /** 测试驱动写回（模拟 vault 修改） */
    __write(p: string, c: string) { if (content.has(p) || true) content.set(p, c); },
    __delete(p: string) { content.delete(p); },
  };
}

/** backend 桩：记录契约 API 调用 */
function makeBackend(existingRefs: string[] = []) {
  const upserts: NoteMemorySeed[] = [];
  const removed: string[] = [];
  let resolver: ((ref: string) => Promise<string | null>) | null = null;
  let refs = [...existingRefs];
  return {
    upsertNoteMemory: async (seed: NoteMemorySeed) => {
      upserts.push(seed);
      if (!refs.includes(seed.refPath)) refs.push(seed.refPath);
    },
    removeMemoryByRef: async (ref: string) => { removed.push(ref); refs = refs.filter((r) => r !== ref); },
    setRefResolver: (fn: (ref: string) => Promise<string | null>) => { resolver = fn; },
    listRefPaths: async () => [...refs],
    __resolver: () => resolver as unknown as (ref: string) => Promise<string | null>,
    __upserts: upserts,
    __removed: removed,
    __refs: () => refs,
  };
}

/** 条目文件夹具（ADR-0131 一目一文件：一条日记一个文件；走契约序列化） */
const diaryEntryFile = (time: string, body: string, date = '2026-08-01') =>
  serializeDiaryEntryFile({ date, time }, ['日记'], body);
const DIRS = ['我的/日记', '笔记'];

describe('isSkippablePath（杂物过滤，ADR-0069 §3）', () => {
  it('只认 .md；环境目录/模板目录/加密 .enc 一律跳过', () => {
    expect(isSkippablePath('笔记/a.md')).toBe(false);
    expect(isSkippablePath('笔记/a.txt')).toBe(true);
    expect(isSkippablePath('.obsidian/plugins/bz/a.md')).toBe(true);
    expect(isSkippablePath('模板/日记模板.md')).toBe(true);
    expect(isSkippablePath('templates/t.md')).toBe(true);
    expect(isSkippablePath('CONFIG/.ENCRYPT/x.safe.enc.md')).toBe(false); // .md 结尾但 .enc 防御
    expect(isSkippablePath('CONFIG/.ENCRYPT/x.safe.enc')).toBe(true);
  });
});

describe('resolveOwnerDir（R6 嵌套去重：一条笔记只归一个目录，按配置顺序首个匹配）', () => {
  it('嵌套重叠取配置顺序首个；库根匹配一切；未命中 null', () => {
    expect(resolveOwnerDir('笔记/子/a.md', ['笔记', '笔记/子'])).toBe('笔记');
    expect(resolveOwnerDir('a.md', [''])).toBe('');
    expect(resolveOwnerDir('别的/a.md', ['笔记'])).toBeNull();
  });
});

describe('buildSeedsForFile（一篇一条 + 日记拆段）', () => {
  it('普通笔记一篇一条：created 取 mtime，source note', () => {
    const seeds = buildSeedsForFile('笔记/想法.md', '正文内容', 1700000000000, DIRS, '我的/日记', '2026-08-29');
    expect(seeds).toHaveLength(1);
    expect(seeds[0]).toEqual({ refPath: '笔记/想法.md', fullText: '正文内容', created: new Date(1700000000000).toISOString(), source: 'note' });
  });

  it('mtime 不可得 → created 用当天', () => {
    const seeds = buildSeedsForFile('笔记/想法.md', '正文', null, DIRS, '我的/日记', '2026-08-29');
    expect(seeds[0].created).toBe('2026-08-29T00:00:00');
  });

  it('条目文件一篇一条：refPath=路径#HH:MM，created=日期+时间（ADR-0131）', () => {
    const path = '我的/日记/2608010830.md';
    const seeds = buildSeedsForFile(path, diaryEntryFile('08:30', '早晨写了周报'), 1700000000000, DIRS, '我的/日记', '2026-08-29');
    expect(seeds).toHaveLength(1);
    expect(seeds[0].refPath).toBe('我的/日记/2608010830.md#08:30');
    expect(seeds[0].locator).toBe('08:30');
    expect(seeds[0].fullText).toBe('早晨写了周报');
    expect(seeds[0].created).toBe('2026-08-01T08:30:00');
    expect(seeds[0].source).toBe('diary');
  });

  it('日记目录下非日期命名文件不跟踪；未配置目录/空正文 → 无种子', () => {
    expect(buildSeedsForFile('我的/日记/随手记.md', 'x', 1, DIRS, '我的/日记', '2026-08-29')).toEqual([]);
    expect(buildSeedsForFile('别的/a.md', 'x', 1, DIRS, '我的/日记', '2026-08-29')).toEqual([]);
    expect(buildSeedsForFile('笔记/空.md', '   ', 1, DIRS, '我的/日记', '2026-08-29')).toEqual([]);
  });
});

describe('diarySeeds 解析兜底（ADR-0131：属性不可信按题目降级）', () => {
  it('空内容 → 无种子；属性与题目都不可信 → 无种子', () => {
    expect(diarySeeds('我的/日记/2608010830.md', '', '2026-08-01')).toEqual([]);
    expect(diarySeeds('我的/日记/随手记.md', '随便几行没有 frontmatter', '2026-08-01')).toEqual([]);
  });

  it('属性损坏但题目合法 → 按题目降级产种子（正文取全文，不再丢条目）', () => {
    const seeds = diarySeeds('我的/日记/2608010830.md', '随便几行没有 frontmatter', '2026-08-01');
    // v3：属性不可信时从题目（YYMMDDHHmm）还原时间，不再返回 []
    expect(seeds).toHaveLength(1);
    expect(seeds[0].refPath).toBe('我的/日记/2608010830.md#08:30');
    expect(seeds[0].fullText).toBe('随便几行没有 frontmatter');
  });
});

describe('noteMemoryToday', () => {
  it('本地日期格式', () => {
    expect(noteMemoryToday(new Date(2026, 7, 29, 9, 5).getTime())).toBe('2026-08-29');
  });
});

describe('NoteMemorySync（增量同步器）', () => {
  const SEED_A = '我的/日记/2608010830.md'; // v3 题目：YYMMDDHHmm
  const SEED_B = '我的/日记/2608012310.md';

  function setup(files: Record<string, string>, dirs: string[] = DIRS, nowMs = 1700000000000) {
    const adapter = makeAdapter(files, { now: () => nowMs, diaryDir: '我的/日记' });
    const backend = makeBackend();
    const sync = new NoteMemorySync({
      adapter: adapter as any,
      backend: backend as any,
      getDirectories: () => dirs,
    });
    return { adapter, backend, sync, nowMs };
  }

  it('init 全量扫描建库 + 注入 refResolver（条目文件按定位符对时间取正文、普通笔记取全文、缺失 null）', async () => {
    const { adapter, backend, sync } = setup({
      [SEED_A]: diaryEntryFile('08:30', '早晨写了周报'),
      [SEED_B]: diaryEntryFile('23:10', '夜里读了会书'),
      '笔记/想法.md': '想法正文',
      '.obsidian/x.md': '杂物',
      '笔记/其他.txt': '非md',
    });
    await sync.init();
    // 杂物与非 md 不入库；条目文件 2 篇 + 普通笔记 1 条
    expect(backend.__upserts).toHaveLength(3);
    const resolver = backend.__resolver();
    expect(resolver).toBeTypeOf('function');
    expect(await resolver!('笔记/想法.md')).toBe('想法正文');
    expect(await resolver!(`${SEED_A}#08:30`)).toBe('早晨写了周报');
    expect(await resolver!(`${SEED_A}#99:99`)).toBeNull();
    expect(await resolver!('不存在.md')).toBeNull();
  });

  it('R4 节流：节流窗口内 modify 合并 pending 不入库；flushDue 到期重入库一次', async () => {
    let now = 1700000000000;
    const adapter = makeAdapter({ '笔记/想法.md': 'v1' }, { now: () => now, diaryDir: '我的/日记' });
    const backend = makeBackend();
    const sync = new NoteMemorySync({ adapter: adapter as any, backend: backend as any, getDirectories: () => ['笔记'] });
    await sync.init();
    expect(backend.__upserts).toHaveLength(1);
    // 5 分钟后修改：合并 pending
    now += 5 * 60 * 1000;
    adapter.__write('笔记/想法.md', 'v2');
    await sync.onModified('笔记/想法.md');
    expect(backend.__upserts).toHaveLength(1);
    expect(sync.getPending()).toContain('笔记/想法.md');
    // 未到期 flushDue 不动
    await sync.flushDue();
    expect(backend.__upserts).toHaveLength(1);
    // 10 分钟后到期 flushDue → 重入库一次
    now += 11 * 60 * 1000;
    await sync.flushDue();
    expect(backend.__upserts).toHaveLength(2);
    expect(backend.__upserts[1].fullText).toBe('v2');
    expect(sync.getPending()).toHaveLength(0);
  });

  it('R4 豁免：「今天」的条目文件 modify 即时入库', async () => {
    const today = noteMemoryToday(1700000000000);
    const path = diaryEntryPath('我的/日记', today, '08:30');
    const { adapter, backend, sync } = setup({ [path]: diaryEntryFile('08:30', '早晨写了周报', today) });
    await sync.init();
    const n = backend.__upserts.length;
    await sync.onModified(path); // 距上次 0ms，但今日日记即时
    expect(backend.__upserts.length).toBeGreaterThan(n);
  });

  it('delete：按已跟踪 ref 逐条回删（条目文件删除）', async () => {
    const { adapter, backend, sync } = setup({
      [SEED_A]: diaryEntryFile('08:30', '早晨写了周报'),
      [SEED_B]: diaryEntryFile('23:10', '夜里读了会书'),
    });
    await sync.init();
    adapter.__delete(SEED_A);
    adapter.__delete(SEED_B);
    await sync.onDeleted(SEED_A);
    await sync.onDeleted(SEED_B);
    expect(backend.__removed).toContain(`${SEED_A}#08:30`);
    expect(backend.__removed).toContain(`${SEED_B}#23:10`);
    expect(sync.getTrackedRefs().has(SEED_A)).toBe(false);
    expect(sync.getTrackedRefs().has(SEED_B)).toBe(false);
  });

  it('delete：未跟踪过的普通笔记按路径兜底回删；非我方文件跳过', async () => {
    const { backend, sync } = setup({ '笔记/重启前.md': 'x', '别的/外部.md': 'y' }, ['笔记']);
    // 模拟重启前入库（init 时该文件存在会跟踪——这里直接不 init，用未跟踪状态验证兜底）
    await sync.onDeleted('笔记/重启前.md');
    expect(backend.__removed).toContain('笔记/重启前.md');
    await sync.onDeleted('别的/外部.md');
    expect(backend.__removed).not.toContain('别的/外部.md');
  });

  it('rename：删旧 ref + 读新文件重新 upsert（R6 不拆 delete+create）', async () => {
    const { adapter, backend, sync } = setup({ '笔记/旧.md': '正文' });
    await sync.init();
    adapter.__delete('笔记/旧.md');
    adapter.__write('笔记/新.md', '新正文');
    await sync.onRenamed('笔记/旧.md', '笔记/新.md');
    expect(backend.__removed).toContain('笔记/旧.md');
    const last = backend.__upserts[backend.__upserts.length - 1];
    expect(last.refPath).toBe('笔记/新.md');
    expect(last.fullText).toBe('新正文');
  });

  it('目录从设置移除 → 清其名下全部条目；新增目录 → 补扫入库（R6）', async () => {
    const files = { '笔记/a.md': 'a', '其他/b.md': 'b' };
    let dirs = ['笔记', '其他'];
    const adapter = makeAdapter(files, { diaryDir: '我的/日记' });
    const backend = makeBackend();
    const sync = new NoteMemorySync({ adapter: adapter as any, backend: backend as any, getDirectories: () => dirs });
    await sync.init();
    expect(backend.__upserts).toHaveLength(2);
    // 移除「其他」
    dirs = ['笔记'];
    await sync.syncDirectories(dirs);
    expect(backend.__removed).toContain('其他/b.md');
    // 新增回去 → 补扫入库
    dirs = ['笔记', '其他'];
    await sync.syncDirectories(dirs);
    expect(backend.__upserts.some((s) => s.refPath === '其他/b.md')).toBe(true);
  });

  it('引用失效自愈：resolver 读不到的条目登记 onStaleRef 并清理（文件删除/定位符时间错位）', async () => {
    const stale: string[] = [];
    const adapter = makeAdapter({ [SEED_A]: diaryEntryFile('08:30', '早晨写了周报'), '笔记/a.md': 'a' }, { diaryDir: '我的/日记' });
    const backend = makeBackend([`${SEED_A}#08:30`, `${SEED_A}#07:00`, '笔记/a.md', '笔记/已删.md']);
    const sync = new NoteMemorySync({ adapter: adapter as any, backend: backend as any, getDirectories: () => ['笔记'], onStaleRef: (r) => stale.push(r) });
    // 预置 stale 引用：07:00 定位符与文件 frontmatter 时间错位、已删.md 文件不存在
    await sync.verifyStaleRefs();
    expect(stale).toContain(`${SEED_A}#07:00`);
    expect(stale).toContain('笔记/已删.md');
    expect(backend.__removed).toContain(`${SEED_A}#07:00`);
    expect(backend.__removed).toContain('笔记/已删.md');
    expect(stale).not.toContain(`${SEED_A}#08:30`);
    expect(stale).not.toContain('笔记/a.md');
  });

  it('dispose 清内存表；throttle 默认 10 分钟', () => {
    const { sync } = setup({});
    expect(NOTE_MEMORY_THROTTLE_MS).toBe(10 * 60 * 1000);
    sync.dispose();
    expect(sync.getTrackedRefs().size).toBe(0);
    expect(sync.getPending().size).toBe(0);
  });
});
