/**
 * 日记观察集成（ticket 077，ADR-0030）：ensure 后模拟日记 create/modify/delete/rename →
 * 每条独立 10 分钟结算（测试注入 60ms 真实 timer，规避 fake timers 与反射调度相互作用）。
 * 覆盖：首次（首落有字）/ 累计 >50 更新 / ≤50 不生成（计入累计）/ 空标题不落 / 条目级删除追加 /
 * 文件删除（逐条 + 文件级兜底）/ noteSource 关静默 / 多条目独立计时 / 重启基线不落首落 / unload 清理。
 * ticket 084d 修复：B1 settle 真删除 vs 瞬态读失败分离；B2 rename 计时/快照 key 迁移与移出目录删除；
 * B3 基线扩窗（当日+前 2 天）；B4 累计 delta 钳位 ≥0。
 * 文案构造单测见 diary-source.test.ts。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { attachObsidianAdapter, detachObsidianAdapter } from '../../src/core/obsidian-adapter';
import { clearDomainEvents } from '../../src/core/domain-bus';
import {
  ensureSmartCat, unloadSmartCat, __getSmartcatInternals,
  __setDiarySettleMsForTests, __getDiaryTimersForTests, __getDiaryTrackedForTests,
} from '../../src/smartcat/index';

let settings: any = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };

function makeApp() {
  const vault = new MockVault();
  const app: any = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  setSettingsSaver(async () => {});
  const wsListeners: Record<string, Function[]> = {};
  app.workspace.on = (ev: string, cb: any) => { (wsListeners[ev] ||= []).push(cb); return { ev, cb }; };
  app.workspace.offref = (ref: any) => {
    const arr = wsListeners[ref?.ev] || [];
    const idx = arr.indexOf(ref?.cb);
    if (idx >= 0) arr.splice(idx, 1);
  };
  // 总线接线（对齐生产 main.ts 挂载）：vault 裸事件 → adapter 两路派发；
  // 单例先摘再挂 + 清空订阅，防跨用例串线（ensureSmartCat 的总线订阅在其后注册，不受影响）
  detachObsidianAdapter();
  clearDomainEvents();
  attachObsidianAdapter(app);
  return { app, vault };
}

/** 短促等待：让事件 handler 的异步首段（读+解析+装计时）跑完 */
const flush = () => new Promise((r) => setTimeout(r, 5));
/** 等待 fire-and-forget 的 addObservation 落流 */
const settle = () => new Promise((r) => setTimeout(r, 100));
/** 等待计时结算：60ms 计时 + 读文件 + 判定 + 观察落流 */
const waitSettle = () => new Promise((r) => setTimeout(r, 320));

const readStream = (): any[] => __getSmartcatInternals().data.memory.memoryStream;
const timerKey = (path: string, date: string, time: string) => `${path}\u0001${date}\u0001${time}`;

/** 今天日期（本地时区，与 index diaryTodayStr 同语义——重启基线测试用） */
function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 距今 offset 天日期（本地时区，与 index diaryDateStr 同语义——基线扩窗测试用） */
function dateOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  settings = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };
  unloadSmartCat();
  __setDiarySettleMsForTests(60); // 注入短计时（unload 会复位，须在 unload 之后设置）
});

describe('日记观察（per-entry 10 分钟结算，ticket 077）', () => {
  it('首次：有字条目静置结算 → 新增观察（source diary），计时结束', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const date = '2026-08-24';
    const path = `我的/日记/${date}.md`;
    vault.files.set(path, '# 📖 23:05\n今天写了很多内容\n');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    const stream = readStream();
    expect(stream[stream.length - 1].source).toBe('diary');
    expect(stream[stream.length - 1].description).toBe('你在 2026-08-24 23:05 写了一篇日记（分类：日记）：今天写了很多内容');
    // 结算后该条计时已跑完（timer 为 null；记录保留作后续累计基线）
    expect(__getDiaryTimersForTests().get(timerKey(path, date, '23:05'))?.timer).toBeNull();
  });

  it('更新：已有观察后累计 >50 → 新增更新观察', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const date = '2026-08-24';
    const path = `我的/日记/${date}.md`;
    vault.files.set(path, `# 📖 23:05\n${'早'.repeat(60)}\n`);
    vault.emit('modify', vault.file(path));
    await waitSettle();
    let stream = readStream();
    expect(stream[stream.length - 1].description).toBe('你在 2026-08-24 23:05 写了一篇日记（分类：日记）：' + '早'.repeat(60));
    // 续写 +70 → 累计 70 >50 → 更新观察（原观察保留）
    vault.files.set(path, `# 📖 23:05\n${'早'.repeat(130)}\n`);
    vault.emit('modify', vault.file(path));
    await waitSettle();
    stream = readStream();
    expect(stream[stream.length - 1].description).toBe('你更新了日记（2026-08-24 23:05）：' + '早'.repeat(130));
    expect(stream[stream.length - 1].source).toBe('diary');
    expect(stream.length).toBe(2); // 首落 + 更新，原观察保留
  });

  it('≤50 不生成：补写不入记忆但计入累计，再补跨 50 才更新', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const date = '2026-08-24';
    const path = `我的/日记/${date}.md`;
    vault.files.set(path, `# 📖 23:05\n${'早'.repeat(60)}\n`);
    vault.emit('modify', vault.file(path));
    await waitSettle();
    expect(readStream().length).toBe(1);
    // +30（累计 30 ≤50）→ 不生成
    vault.files.set(path, `# 📖 23:05\n${'早'.repeat(90)}\n`);
    vault.emit('modify', vault.file(path));
    await waitSettle();
    expect(readStream().length).toBe(1);
    const key = timerKey(path, date, '23:05');
    expect(__getDiaryTimersForTests().get(key)?.accum).toBe(30);
    // 再 +40（累计 30+70=100 >50）→ 更新
    vault.files.set(path, `# 📖 23:05\n${'早'.repeat(130)}\n`);
    vault.emit('modify', vault.file(path));
    await waitSettle();
    const stream = readStream();
    expect(stream.length).toBe(2);
    expect(stream[stream.length - 1].description).toBe('你更新了日记（2026-08-24 23:05）：' + '早'.repeat(130));
    expect(__getDiaryTimersForTests().get(key)?.accum).toBe(0); // 更新后累计归零
  });

  it('空标题不落：只有标题的条目结算不生成；补正文后才首落', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const date = '2026-08-24';
    const path = `我的/日记/${date}.md`;
    vault.files.set(path, '# 📖 08:00\n');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    expect(readStream().length).toBe(0);
    // 补正文 → 走首落（不是「你更新了日记」）
    vault.files.set(path, '# 📖 08:00\n写了点东西\n');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    const stream = readStream();
    expect(stream.length).toBe(1);
    expect(stream[0].description).toBe('你在 2026-08-24 08:00 写了一篇日记（分类：日记）：写了点东西');
  });

  it('多条目独立计时：新增另一条只另起该条计时，其它条目不被重置/重新观察', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const date = '2026-08-24';
    const path = `我的/日记/${date}.md`;
    vault.files.set(path, '# 📖 08:00\n第一条\n');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    let stream = readStream();
    expect(stream.length).toBe(1);
    expect(stream[0].description).toBe('你在 2026-08-24 08:00 写了一篇日记（分类：日记）：第一条');
    // 新增第二条（第一条未改动）→ 只有第二条另起计时
    vault.files.set(path, '# 📖 08:00\n第一条\n# ✍️ 09:00\n第二条\n');
    vault.emit('modify', vault.file(path));
    await flush();
    const timers = __getDiaryTimersForTests();
    expect(timers.size).toBe(2);
    const a = timers.get(timerKey(path, date, '08:00'))!;
    const b = timers.get(timerKey(path, date, '09:00'))!;
    expect(a.generated).toBe(true); // 第一条已结算，未被动（基线保留）
    expect(b.generated).toBe(false); // 第二条新装计时，待首落
    await waitSettle();
    stream = readStream();
    expect(stream.length).toBe(2);
    expect(stream[stream.length - 1].description).toBe('你在 2026-08-24 09:00 写了一篇日记（分类：随笔）：第二条'); // ✍️ → 随笔
    expect(stream.some((m) => m.description.includes('第一条'))).toBe(true); // 第一条未被重新观察
  });

  it('条目级删除：modify diff 发现上次快照的条目消失 → 追加删除观察 + 清该条计时', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const date = '2026-08-24';
    const path = `我的/日记/${date}.md`;
    vault.files.set(path, '# 📖 08:00\n第一条\n# ✍️ 09:00\n第二条\n');
    vault.emit('modify', vault.file(path));
    await flush(); // 两条计时装上
    // 删除第二条（整块移除）
    vault.files.set(path, '# 📖 08:00\n第一条\n');
    vault.emit('modify', vault.file(path));
    await settle();
    const stream = readStream();
    const del = stream.find((m) => m.description === '你删除了 2026-08-24 09:00 的日记');
    expect(del).toBeTruthy();
    expect(del.source).toBe('diary');
    expect(__getDiaryTimersForTests().size).toBe(1); // 第一条计时保留，第二条已清
  });

  it('文件删除：跟踪过快照的文件删整文件 → 逐条追加删除观察；从未跟踪过 → 文件级单条兜底', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const date = '2026-08-24';
    const path = `我的/日记/${date}.md`;
    vault.files.set(path, '# 📖 08:00\n第一条\n# ✍️ 09:00\n第二条\n');
    vault.emit('modify', vault.file(path));
    await flush();
    vault.files.delete(path);
    vault.emit('delete', vault.file(path));
    await settle();
    let stream = readStream();
    expect(stream.some((m) => m.description === '你删除了 2026-08-24 08:00 的日记')).toBe(true);
    expect(stream.some((m) => m.description === '你删除了 2026-08-24 09:00 的日记')).toBe(true);
    expect(__getDiaryTimersForTests().size).toBe(0);
    // 从未跟踪过的旧文件删除 → 文件级兜底（仅日期）
    const oldPath = '我的/日记/2020-01-05.md';
    vault.files.set(oldPath, '# 📖 08:00\n旧内容\n');
    vault.files.delete(oldPath);
    vault.emit('delete', vault.file(oldPath));
    await settle();
    stream = readStream();
    expect(stream[stream.length - 1].description).toBe('你删除了 2020-01-05 的日记');
    expect(stream[stream.length - 1].source).toBe('diary');
  });

  it('重启基线：ensure 当日文件建快照不产出；改动 >50 字后走更新分支（不落首落）', async () => {
    const { app, vault } = makeApp();
    const today = todayStr();
    const path = `我的/日记/${today}.md`;
    vault.files.set(path, `# 📖 10:00\n${'旧'.repeat(20)}\n`);
    await ensureSmartCat(app); // 基线扫描（不产出观察）
    expect(readStream().length).toBe(0);
    expect(__getDiaryTimersForTests().get(timerKey(path, today, '10:00'))?.generated).toBe(true);
    // 改正文 +60 → 更新观察（不是「写了一篇日记」）
    vault.files.set(path, `# 📖 10:00\n${'旧'.repeat(20)}${'新'.repeat(60)}\n`);
    vault.emit('modify', vault.file(path));
    await waitSettle();
    const stream = readStream();
    expect(stream.length).toBe(1);
    expect(stream[0].description).toContain('你更新了日记（');
    expect(stream[0].description).not.toContain('写了一篇日记');
  });

  it('noteSource 关闭 → modify/delete 均静默（不装计时、不观察）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const data: any = __getSmartcatInternals().data;
    data.config.noteSource = false;
    const path = '我的/日记/2026-08-24.md';
    vault.files.set(path, '# 📖 08:00\n第一条\n');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    expect(readStream().length).toBe(0);
    expect(__getDiaryTimersForTests().size).toBe(0);
    vault.files.delete(path);
    vault.emit('delete', vault.file(path));
    await settle();
    expect(readStream().length).toBe(0);
  });

  it('unload 清理计时表（定时器 + 记录全清）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const path = '我的/日记/2026-08-24.md';
    vault.files.set(path, '# 📖 08:00\n第一条\n');
    vault.emit('modify', vault.file(path));
    await flush();
    expect(__getDiaryTimersForTests().size).toBe(1);
    unloadSmartCat();
    expect(__getDiaryTimersForTests().size).toBe(0);
  });

  it('B1：settle 时文件真删除（无 delete 事件）→ 兜底删除观察 + 清计时 + 同步跟踪快照（P2 防重复删除观察）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const date = '2026-08-24';
    const path = `我的/日记/${date}.md`;
    vault.files.set(path, '# 📖 08:00\n第一条\n');
    vault.emit('modify', vault.file(path));
    await flush(); // 计时已装（未到结算）
    vault.files.delete(path); // 不 emit delete —— 只走 settle 的 getAbstractFileByPath null 兜底
    await waitSettle();
    const stream = readStream();
    expect(stream.some((m) => m.description === '你删除了 2026-08-24 08:00 的日记')).toBe(true);
    expect(__getDiaryTimersForTests().size).toBe(0);
    // P2：跟踪快照同步清理（该条不再挂快照上）
    expect(__getDiaryTrackedForTests().get(path)?.has(`${date}\u000108:00`)).toBeFalsy();
    // 随后 vault delete 事件到达：快照已无该条 → 只产文件级兜底一条，不重复逐条删除观察
    vault.emit('delete', vault.file(path));
    await settle();
    const after = readStream();
    expect(after.filter((m) => m.description === '你删除了 2026-08-24 08:00 的日记')).toHaveLength(1);
    expect(after[after.length - 1].description).toBe('你删除了 2026-08-24 的日记'); // 文件级兜底
  });

  it('B1：settle 瞬态读失败（vault.read 抛错）→ 保留计时记录，不产删除观察', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const date = '2026-08-24';
    const path = `我的/日记/${date}.md`;
    vault.files.set(path, '# 📖 23:05\n第一条\n');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    expect(readStream().length).toBe(1); // 首落已产
    // 再改一次（read 成功 → 重新装计时）
    vault.files.set(path, '# 📖 23:05\n第一条\n补充\n');
    vault.emit('modify', vault.file(path));
    await flush();
    // 接下来 settle 的 read 抛错（瞬态 IO）→ 不判删除、保留记录等下轮
    const origRead = vault.read.bind(vault);
    vault.read = async () => { throw new Error('transient io'); };
    await waitSettle();
    vault.read = origRead;
    const stream = readStream();
    expect(stream.length).toBe(1); // 无删除观察
    expect(__getDiaryTimersForTests().has(timerKey(path, date, '23:05'))).toBe(true);
  });

  it('B2：diary 同目录 rename → diaryTimers/diaryTracked key 迁移（不产删除、不重刷首落）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const date = '2026-08-24';
    const path = `我的/日记/${date}.md`;
    const newPath = `我的/日记/${date}-改名.md`; // 仍在 diary 目录
    vault.files.set(path, '# 📖 08:00\n第一条\n');
    vault.emit('modify', vault.file(path));
    await flush();
    expect(__getDiaryTimersForTests().has(timerKey(path, date, '08:00'))).toBe(true);
    await vault.rename(vault.file(path), newPath);
    vault.emit('rename', vault.file(newPath), path);
    await flush();
    expect(readStream().length).toBe(0); // 无删除观察
    const timers = __getDiaryTimersForTests();
    expect(timers.has(timerKey(path, date, '08:00'))).toBe(false); // 旧 key 已迁移
    const migrated = timers.get(timerKey(newPath, date, '08:00'));
    expect(migrated).toBeTruthy();
    expect(migrated!.generated).toBe(false); // state 原样迁移（待首落）
    expect(__getDiaryTrackedForTests().has(path)).toBe(false);
    expect(__getDiaryTrackedForTests().has(newPath)).toBe(true);
  });

  it('B2：diary rename 移出目录 → 按旧跟踪逐条产删除观察 + 清理', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const date = '2026-08-24';
    const path = `我的/日记/${date}.md`;
    vault.files.set(path, '# 📖 08:00\n第一条\n# ✍️ 09:00\n第二条\n');
    vault.emit('modify', vault.file(path));
    await flush();
    const outPath = '归档/旧日记.md'; // classifyPath null（移出观察域）
    await vault.rename(vault.file(path), outPath);
    vault.emit('rename', vault.file(outPath), path);
    await settle();
    const stream = readStream();
    expect(stream.some((m) => m.description === '你删除了 2026-08-24 08:00 的日记')).toBe(true);
    expect(stream.some((m) => m.description === '你删除了 2026-08-24 09:00 的日记')).toBe(true);
    expect(__getDiaryTimersForTests().size).toBe(0);
    expect(__getDiaryTrackedForTests().has(path)).toBe(false);
  });

  it('B3：重启基线扩窗——昨日/前日文件建快照不产出；补写走更新分支（防假首落）', async () => {
    const { app, vault } = makeApp();
    const y = dateOffset(1);
    const y2 = dateOffset(2);
    const py = `我的/日记/${y}.md`;
    const py2 = `我的/日记/${y2}.md`;
    vault.files.set(py, `# 📖 09:00\n${'昨'.repeat(20)}\n`);
    vault.files.set(py2, `# 📖 07:00\n${'前'.repeat(20)}\n`);
    await ensureSmartCat(app); // 基线扫描（不产出观察）
    expect(readStream().length).toBe(0);
    expect(__getDiaryTimersForTests().get(timerKey(py, y, '09:00'))?.generated).toBe(true);
    expect(__getDiaryTimersForTests().get(timerKey(py2, y2, '07:00'))?.generated).toBe(true);
    // 补写昨日 → 更新分支（不是「写了一篇日记」）
    vault.files.set(py, `# 📖 09:00\n${'昨'.repeat(20)}${'补'.repeat(60)}\n`);
    vault.emit('modify', vault.file(py));
    await waitSettle();
    const stream = readStream();
    expect(stream.length).toBe(1);
    expect(stream[0].description).toContain('你更新了日记（');
    expect(stream[0].description).not.toContain('写了一篇日记');
  });

  it('B4：删改后补写不被负累计压制（delta 钳位 ≥0，累计不回落）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const date = '2026-08-24';
    const path = `我的/日记/${date}.md`;
    const key = timerKey(path, date, '23:05');
    vault.files.set(path, `# 📖 23:05\n${'早'.repeat(60)}\n`);
    vault.emit('modify', vault.file(path));
    await waitSettle(); // 首落 60 字
    expect(readStream().length).toBe(1);
    // 大删 40 → 剩 20：负 delta 钳位 0（旧行为累计 -40，补写被长期压制）
    vault.files.set(path, `# 📖 23:05\n${'早'.repeat(20)}\n`);
    vault.emit('modify', vault.file(path));
    await waitSettle();
    expect(readStream().length).toBe(1);
    expect(__getDiaryTimersForTests().get(key)?.accum).toBe(0);
    // 补写 +100 → 120 字：delta 120-60=60 → 累计 60 >50 → 更新（旧行为：-40+60=20 被压制）
    vault.files.set(path, `# 📖 23:05\n${'早'.repeat(120)}\n`);
    vault.emit('modify', vault.file(path));
    await waitSettle();
    const stream = readStream();
    expect(stream.length).toBe(2);
    expect(stream[stream.length - 1].description).toBe('你更新了日记（2026-08-24 23:05）：' + '早'.repeat(120));
  });
});