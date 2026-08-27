/**
 * 卡片盒/现代诗/信 观察集成（ticket 083，ADR-0035；v1 + v2 + v3 + v4）：ensure 后模拟三域 create/modify/delete/rename →
 * 每篇独立 10 分钟结算（测试注入 60ms 真实 timer，规避 fake timers 与反射调度相互作用）。
 * 覆盖：新建有字首落（flash 无日期 / 信 frontmatter date / 诗三层日期）/ 信无 date 或 readonly 不观察 /
 * 修改重置 + 段落 diff（小改动也产）/ 窗口内连续编辑合并一次 / 删除（有跟踪 → 删除观察；未跟踪 → 跳过）/
 * 存量基线（flash 直接 diff；存量信先补首落再 diff；存量诗无日期只 diff）/ 空文件不产（补字后首落）/
 * noteSource 关静默 / unload 清理。
 * ticket 084d 同款修复：B1 settle 真删除 vs 瞬态读失败分离；B2 rename 计时/快照 key 迁移与移出目录删除。
 * 文案与 diff 纯函数单测见 note-source.test.ts。
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
  __setNoteSettleMsForTests, __getNoteTimersForTests, __getNoteTrackedForTests,
} from '../../src/smartcat/index';

let settings: any = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };

function makeApp() {
  const vault = new MockVault();
  const app: any = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  setSettingsSaver(async () => {});
  // 总线接线（对齐生产 main.ts 挂载）：vault 裸事件 → adapter 两路派发；
  // 单例先摘再挂 + 清空订阅，防跨用例串线（ensureSmartCat 的总线订阅在其后注册，不受影响）
  detachObsidianAdapter();
  clearDomainEvents();
  attachObsidianAdapter(app);
  return { app, vault };
}

/** 短促等待：让事件 handler 的异步首段（读+装计时）跑完 */
const flush = () => new Promise((r) => setTimeout(r, 5));
/** 等待 fire-and-forget 的 addObservation 落流 */
const settle = () => new Promise((r) => setTimeout(r, 100));
/** 等待计时结算：60ms 计时 + 读文件 + 判定 + 观察落流 */
const waitSettle = () => new Promise((r) => setTimeout(r, 320));

const readStream = (): any[] => __getSmartcatInternals().data.memory.memoryStream;

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  settings = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };
  unloadSmartCat();
  __setNoteSettleMsForTests(60); // 注入短计时（unload 会复位，须在 unload 之后设置）
});

describe('卡片盒/现代诗/信 观察（per-file 10 分钟结算，ticket 083 v1+v2+v3+v4）', () => {
  it('首落：新建有字 flash（无日期）静置结算 → 新增观察（source=flash，全文），计时结束', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const path = '卡片盒/TDD.md';
    vault.files.set(path, '今天实践 TDD\n第二行');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    const stream = readStream();
    const last = stream[stream.length - 1];
    expect(last.source).toBe('flash');
    expect(last.description).toBe('你在卡片盒记下了「TDD」：「今天实践 TDD\n第二行」');
    expect(__getNoteTimersForTests().get(path)?.timer).toBeNull();
  });

  it('首落：新建信（frontmatter date 空格式）→ 带日期全文观察', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const path = '我的/信/第2封信：在大理的风.md';
    vault.files.set(path, '---\ndate: 2026-06-17 23:44\n---\n见字如面');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    const stream = readStream();
    expect(stream[stream.length - 1].source).toBe('letter');
    expect(stream[stream.length - 1].description).toBe('你在 2026-06-17 23:44 写了一封信「第2封信：在大理的风」：见字如面');
  });

  it('首落：新建现代诗（frontmatter date ISO）→ 带日期全文观察（frontmatter 不进入正文）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const path = '我的/现代诗/2026/0115.md';
    vault.files.set(path, '---\ndate: 2026-03-01 09:30\n---\n黑夜给了我黑色的眼睛');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    const stream = readStream();
    expect(stream[stream.length - 1].source).toBe('poem');
    expect(stream[stream.length - 1].description).toBe('你在 2026-03-01 09:30 写了一首现代诗「0115」：黑夜给了我黑色的眼睛');
  });

  it('信无 frontmatter date → 不观察（不装计时、不产出）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const path = '我的/信/无日期信.md';
    vault.files.set(path, '没有日期的信');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    expect(readStream().length).toBe(0);
    expect(__getNoteTimersForTests().size).toBe(0);
    // 删除同样不产（从未跟踪）
    vault.files.delete(path);
    vault.emit('delete', vault.file(path));
    await settle();
    expect(readStream().length).toBe(0);
  });

  it('信 readonly:true → 不观察（v4）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const path = '我的/信/第0封信.md';
    vault.files.set(path, '---\ndate: 2026-07-06T12:14:00\nreadonly: true\n---\n勿动');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    expect(readStream().length).toBe(0);
    expect(__getNoteTimersForTests().size).toBe(0);
  });

  it('修改：首落后改一个字 → 段落 diff（小改动也产，v2「有变化就发」）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const path = '卡片盒/TDD.md';
    vault.files.set(path, '今天天气很好');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    expect(readStream().length).toBe(1);
    vault.files.set(path, '今天天气不好');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    const stream = readStream();
    expect(stream.length).toBe(2);
    expect(stream[stream.length - 1].description).toBe('你修改了卡片盒「TDD」：修改了第 1 段「今天天气很好」→「今天天气不好」');
  });

  it('修改：删段 + 增段 diff；窗口内连续编辑合并为一次结算', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const path = '卡片盒/TDD.md';
    vault.files.set(path, 'A');
    vault.emit('modify', vault.file(path));
    await waitSettle(); // 首落完成
    // 60ms 窗口内连续两次修改（删 A 段、补 B/C 段）→ 计时被重置，只结算一次合并 diff
    vault.files.set(path, 'B');
    vault.emit('modify', vault.file(path));
    await flush(); // 5ms（<60ms）
    vault.files.set(path, 'B\n\nC');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    const stream = readStream();
    expect(stream.length).toBe(2); // 首落 + 一次合并 diff（不是两次）
    expect(stream[stream.length - 1].description).toBe('你修改了卡片盒「TDD」：删除了第 1 段「A」；新增了第 1 段「B」、新增了第 2 段「C」');
  });

  it('删除：跟踪过的文件删整文件 → 追加删除观察 + 清计时；未跟踪过 → 跳过', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const path = '卡片盒/TDD.md';
    vault.files.set(path, '内容');
    vault.emit('modify', vault.file(path));
    await flush();
    expect(__getNoteTimersForTests().size).toBe(1);
    vault.files.delete(path);
    vault.emit('delete', vault.file(path));
    await settle();
    const stream = readStream();
    const del = stream.find((m) => m.description === '你删除了卡片盒「TDD」');
    expect(del).toBeTruthy();
    expect(del.source).toBe('flash');
    expect(__getNoteTimersForTests().size).toBe(0);
    // 从未跟踪过的文件删除 → 跳过（无法知道内容）
    const oldPath = '我的/现代诗/旧诗.md';
    vault.files.set(oldPath, '旧内容');
    vault.files.delete(oldPath);
    vault.emit('delete', vault.file(oldPath));
    await settle();
    expect(readStream().length).toBe(1);
  });

  it('存量基线：ensure 前已有 flash 文件 → 修改直接产 diff（不补首落，v2 规则 3）', async () => {
    const { app, vault } = makeApp();
    const path = '卡片盒/旧卡.md';
    vault.files.set(path, '旧内容第一段');
    await ensureSmartCat(app); // 基线扫描（不产出观察）
    expect(readStream().length).toBe(0);
    expect(__getNoteTimersForTests().get(path)?.generated).toBe(true);
    vault.files.set(path, '旧内容第一段\n\n新加的第二段');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    const stream = readStream();
    expect(stream.length).toBe(1); // 只 diff，无「你在卡片盒记下了」
    expect(stream[0].description).toBe('你修改了卡片盒「旧卡」：新增了第 2 段「新加的第二段」');
  });

  it('存量信（frontmatter date）：首次修改 → 先补带日期全文首落，再产 diff（v3，两条观察）', async () => {
    const { app, vault } = makeApp();
    const path = '我的/信/阿尼玛.md';
    vault.files.set(path, '---\ndate: 2026-06-17 23:44\n---\n最初的正文');
    await ensureSmartCat(app);
    expect(readStream().length).toBe(0);
    vault.files.set(path, '---\ndate: 2026-06-17 23:44\n---\n最初的正文\n\n后续补充的正文');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    const stream = readStream();
    expect(stream.length).toBe(2);
    // 两条观察都存在（补首落 + 修改 diff）；顺序不断言——两条都 fire-and-forget（appendVector 坑不可 await，流内顺序非契约）
    const descriptions = stream.map((m) => m.description);
    expect(descriptions).toContain('你在 2026-06-17 23:44 写了一封信「阿尼玛」：最初的正文\n\n后续补充的正文');
    expect(descriptions).toContain('你修改了信「阿尼玛」：新增了第 2 段「后续补充的正文」');
    expect(stream.every((m) => m.source === 'letter')).toBe(true);
  });

  it('存量现代诗（无任何日期来源）：修改只产 diff，不补首落（v3）', async () => {
    const { app, vault } = makeApp();
    const path = '我的/现代诗/无名诗.md';
    vault.files.set(path, '旧诗行');
    await ensureSmartCat(app);
    expect(readStream().length).toBe(0);
    vault.files.set(path, '旧诗行\n\n新诗行');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    const stream = readStream();
    expect(stream.length).toBe(1);
    expect(stream[0].description).toBe('你修改了现代诗「无名诗」：新增了第 2 段「新诗行」');
  });

  it('空文件不产：新建空文件结算不生成；补字后走首落（flash）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const path = '卡片盒/空卡.md';
    vault.files.set(path, '   \n');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    expect(readStream().length).toBe(0);
    vault.files.set(path, '写了第一句话');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    const stream = readStream();
    expect(stream.length).toBe(1);
    expect(stream[0].description).toBe('你在卡片盒记下了「空卡」：「写了第一句话」');
  });

  it('noteSource 关闭 → modify/delete 均静默（不装计时、不观察）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const data: any = __getSmartcatInternals().data;
    data.config.noteSource = false;
    const path = '卡片盒/TDD.md';
    vault.files.set(path, '内容');
    vault.emit('modify', vault.file(path));
    await waitSettle();
    expect(readStream().length).toBe(0);
    expect(__getNoteTimersForTests().size).toBe(0);
    vault.files.delete(path);
    vault.emit('delete', vault.file(path));
    await settle();
    expect(readStream().length).toBe(0);
  });

  it('unload 清理计时表（定时器 + 记录全清）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const path = '卡片盒/TDD.md';
    vault.files.set(path, '内容');
    vault.emit('modify', vault.file(path));
    await flush();
    expect(__getNoteTimersForTests().size).toBe(1);
    unloadSmartCat();
    expect(__getNoteTimersForTests().size).toBe(0);
  });

  it('B1：settle 时文件真删除（无 delete 事件）→ 兜底删除观察 + 清理', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const path = '卡片盒/TDD.md';
    vault.files.set(path, '内容');
    vault.emit('modify', vault.file(path));
    await flush(); // 计时已装（未到结算）
    vault.files.delete(path); // 不 emit delete —— 只走 settle 的 getAbstractFileByPath null 兜底
    await waitSettle();
    const stream = readStream();
    expect(stream.some((m) => m.description === '你删除了卡片盒「TDD」')).toBe(true);
    expect(__getNoteTimersForTests().size).toBe(0);
    expect(__getNoteTrackedForTests().has(path)).toBe(false);
  });

  it('B1：settle 瞬态读失败（vault.read 抛错）→ 保留计时记录，不产观察', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const path = '卡片盒/TDD.md';
    vault.files.set(path, '内容');
    vault.emit('modify', vault.file(path));
    await flush(); // 计时已装
    const origRead = vault.read.bind(vault);
    vault.read = async () => { throw new Error('transient io'); };
    await waitSettle(); // settle 读失败 → 不产差异观察、保留记录
    vault.read = origRead;
    expect(readStream().length).toBe(0);
    expect(__getNoteTimersForTests().has(path)).toBe(true);
  });

  it('B2：note 同目录 rename → noteTimers/noteTracked key 迁移（不产删除、不重刷首落）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const path = '卡片盒/A.md';
    const newPath = '卡片盒/B.md'; // 仍在卡片盒目录
    vault.files.set(path, '内容');
    vault.emit('modify', vault.file(path));
    await flush();
    expect(__getNoteTimersForTests().has(path)).toBe(true);
    await vault.rename(vault.file(path), newPath);
    vault.emit('rename', vault.file(newPath), path);
    await flush();
    expect(readStream().length).toBe(0); // 无删除观察
    const timers = __getNoteTimersForTests();
    expect(timers.has(path)).toBe(false); // 旧 key 已迁移
    expect(timers.has(newPath)).toBe(true);
    expect(__getNoteTrackedForTests().has(newPath)).toBe(true);
    expect(__getNoteTrackedForTests().has(path)).toBe(false);
  });

  it('B2：note rename 移出目录 → 按旧跟踪产删除观察 + 清理', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const path = '卡片盒/A.md';
    vault.files.set(path, '内容');
    vault.emit('modify', vault.file(path));
    await flush();
    const outPath = '归档/A.md'; // classifyPath null（移出观察域）
    await vault.rename(vault.file(path), outPath);
    vault.emit('rename', vault.file(outPath), path);
    await settle();
    const stream = readStream();
    expect(stream.some((m) => m.description === '你删除了卡片盒「A」')).toBe(true);
    expect(__getNoteTimersForTests().size).toBe(0);
    expect(__getNoteTrackedForTests().has(path)).toBe(false);
  });
});