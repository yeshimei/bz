/**
 * 聚合讯观察集成（ticket 076，ADR-0029）：notifyNewsRead 观察入口 → 行为流条目（source news）；
 * 2026-08-25 修订注记：生产（reader）只发 saved → 2026-08-27 追加拍板（ticket 123）：跳过也发
 * （news:skipped → 行为流）——本文件按函数契约覆盖三态兼容（text 构造层保留）；
 * 保存联动 auto-summary（方案 a）：notifyNewsSaved 登记 → 剪藏 modify 命中补全完整保存观察且登记移除
 * （再触发不再产）；2 分钟降级（注入短间隔）产出无摘要保存观察；剪藏事件观察短路；noteSource 关静默。
 * ticket 084b（R2 审查 A2）：剪藏无 title → auto-summary rename 改名 → 登记键失效——
 * 改名后降级按 url/baseName 定位新路径命中带摘要、modify 新路径反查登记补全、防重保留。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { attachObsidianAdapter, detachObsidianAdapter } from '../../src/core/obsidian-adapter';
import { emitDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import {
  ensureSmartCat, unloadSmartCat,
  __getSmartcatInternals, __getNewsPendingSavesForTests, __setNewsSaveTimeoutForTests,
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
  // 总线接线（对齐生产 main.ts 挂载）：vault 裸事件 → adapter 两路派发（剪藏 modify 补全链路依赖此转译）；
  // 单例先摘再挂 + 清空订阅，防跨用例串线
  detachObsidianAdapter();
  clearDomainEvents();
  attachObsidianAdapter(app);
  return { app, vault };
}

/** 等待 fire-and-forget 的 addObservation 落流 */
const settle = () => new Promise((r) => setTimeout(r, 100));

const readStream = (): any[] => __getSmartcatInternals().data.memory.memoryStream;

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  settings = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };
  unloadSmartCat();
});

const readBeh = (): any[] => __getSmartcatInternals().data.memory.behaviorStream;

describe('notifyNewsRead（逐篇三态，方法监听）', () => {
  it('阅读 → 行为流条目（source=news, action=read）', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('news', { kind: 'read', evt: { title: '黑洞照片刷新认知', platform: '果壳', state: 'read', durationMin: 5 } });
    await settle();
    const beh = readBeh();
    const last = beh[beh.length - 1];
    expect(last.source).toBe('news');
    expect(last.type).toBe('read');
    expect(last.metadata.entityType).toBe('news');
    expect(last.metadata.name).toBe('黑洞照片刷新认知');
    expect(last.metadata.extras).toEqual({ platform: '果壳', durationMin: 5 });
  });

  it('跳过 → 行为流条目（source=news, action=skipped，2026-08-27 追加拍板）', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('news', { kind: 'read', evt: { title: '被跳过的一篇', platform: '知乎日报', state: 'skipped', durationMin: 1 } });
    await settle();
    const beh = readBeh();
    const last = beh[beh.length - 1];
    expect(last.source).toBe('news');
    expect(last.type).toBe('skipped');
    expect(last.metadata.entityType).toBe('news');
    expect(last.metadata.name).toBe('被跳过的一篇');
    expect(last.metadata.extras).toEqual({ platform: '知乎日报', durationMin: 1 });
  });

  it('noteSource 关闭 → 静默不观察；notifyNewsSaved 也不登记', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    const data: any = __getSmartcatInternals().data;
    data.config.noteSource = false;
    const before = data.memory.behaviorStream.length;
    emitDomainEvent('news', { kind: 'read', evt: { title: '黑洞照片刷新认知', platform: '果壳', state: 'saved', durationMin: 5 } });
    emitDomainEvent('news', { kind: 'saved', evt: { title: '黑洞照片刷新认知', platform: '果壳', state: 'saved', durationMin: 5 }, clipPath: '归档/网页剪藏/黑洞照片刷新认知.md' });
    await settle();
    expect(data.memory.behaviorStream.length).toBe(before);
    expect(__getNewsPendingSavesForTests().size).toBe(0);
  });

  it('未初始化（unload 后）→ 静默不观察、不登记、不抛错', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    unloadSmartCat();
    expect(() => {
      emitDomainEvent('news', { kind: 'read', evt: { title: 'X', platform: '果壳', state: 'read', durationMin: 1 } });
      emitDomainEvent('news', { kind: 'saved', evt: { title: 'X', platform: '果壳', state: 'saved', durationMin: 1 }, clipPath: '归档/网页剪藏/X.md' });
    }).not.toThrow();
    await settle();
    expect(__getNewsPendingSavesForTests().size).toBe(0);
  });
});

describe('保存联动 auto-summary（方案 a，ticket 076）', () => {
  it('剪藏 modify 命中登记 → 完整保存观察（行为流）+ 登记移除（再触发不再产）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const clipPath = '归档/网页剪藏/黑洞照片刷新认知.md';
    // 模拟 saveToClip 已创建剪藏 + auto-summary 写回 frontmatter（summary/tags）
    vault.files.set(clipPath, '---\nsummary: "首张黑洞照片公布，视觉中国被质疑滥用版权。"\ntags:\n  - "科学"\n  - "AI"\n---\n\n正文');
    emitDomainEvent('news', { kind: 'saved', evt: { title: '黑洞照片刷新认知', platform: '果壳', state: 'saved', durationMin: 5 }, clipPath: clipPath });
    expect(__getNewsPendingSavesForTests().size).toBe(1);
    // auto-summary 写回触发的 modify 事件
    vault.emit('modify', vault.file(clipPath));
    await settle();
    const beh = readBeh();
    const last = beh[beh.length - 1];
    expect(last.source).toBe('news');
    expect(last.type).toBe('saved');
    expect(last.metadata.entityType).toBe('news');
    expect(last.metadata.name).toBe('黑洞照片刷新认知');
    expect(last.metadata.extras.summary).toBe('首张黑洞照片公布，视觉中国被质疑滥用版权。');
    expect(last.metadata.extras.tags).toEqual(['科学', 'AI']);
    // 登记已移除；再触发 modify 不再产
    expect(__getNewsPendingSavesForTests().size).toBe(0);
    const before = beh.length;
    vault.emit('modify', vault.file(clipPath));
    await settle();
    expect(readBeh().length).toBe(before);
  });

  it('普通剪藏 modify（未命中登记）→ 短路：不产观察', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const clipPath = '归档/网页剪藏/普通剪藏文章.md';
    vault.files.set(clipPath, '---\nsummary: "普通摘要"\n---\n\n正文');
    const before = readBeh().length;
    vault.emit('modify', vault.file(clipPath));
    await settle();
    expect(readBeh().length).toBe(before);
    expect(__getNewsPendingSavesForTests().size).toBe(0);
  });

  it('降级：登记后未等到 summary → 行为流产出无摘要保存观察 + 登记移除', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    __setNewsSaveTimeoutForTests(60);
    const clipPath = '归档/网页剪藏/未等来摘要.md';
    emitDomainEvent('news', { kind: 'saved', evt: { title: '未等来摘要', platform: '知乎日报', state: 'saved', durationMin: 3 }, clipPath: clipPath });
    expect(__getNewsPendingSavesForTests().size).toBe(1);
    await new Promise((r) => setTimeout(r, 250)); // 超过降级等待（60ms）并等落流
    const beh = readBeh();
    const last = beh[beh.length - 1];
    expect(last.source).toBe('news');
    expect(last.type).toBe('saved');
    expect(last.metadata.name).toBe('未等来摘要');
    expect(last.metadata.extras.platform).toBe('知乎日报');
    expect(last.metadata.extras.durationMin).toBe(3);
    expect(__getNewsPendingSavesForTests().size).toBe(0);
  });

  // ticket 084b（R2 审查 A2）：剪藏 frontmatter 无 title → auto-summary renameToTitle 必改名
  // （登记键=原路径失效）。以下 4 测覆盖：改名降级 url 反查、改名 modify 补全反查、
  // 无 url 剪藏 baseName 兜底降级、防重保留（降级无摘要同立即形态不产第二条）。
  it('改名后降级：登记原路径 → 同 url 新路径出现（renameToTitle）→ 降级定位命中带摘要（行为流）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    __setNewsSaveTimeoutForTests(60);
    const oldPath = '归档/网页剪藏/黑洞照片刷新认知.md';
    const newPath = '归档/网页剪藏/黑洞照片刷新认知 AI标题.md';
    // saveToClip 落盘（剪藏模板形态：url 有、title 无）
    vault.files.set(oldPath, '---\nurl: "https://www.guokr.com/article/black-hole"\n---\n\n正文');
    emitDomainEvent('news', { kind: 'saved', evt: { title: '黑洞照片刷新认知', platform: '果壳', state: 'saved', durationMin: 5 }, clipPath: oldPath });
    await new Promise((r) => setTimeout(r, 5)); // 只等异步 url 登记（微任务），60ms 定时器未到
    expect(__getNewsPendingSavesForTests().size).toBe(1);
    // auto-summary renameToTitle：原路径删除，新路径同名 url + summary/tags 写回（modify 事件未捕获场景）
    vault.files.delete(oldPath);
    vault.files.set(newPath, '---\nurl: "https://www.guokr.com/article/black-hole"\nsummary: "首张黑洞照片公布，视觉中国被质疑滥用版权。"\ntags:\n  - "科学"\n---\n\n正文');
    await new Promise((r) => setTimeout(r, 250)); // 超过降级等待（60ms）并等落流
    const beh = readBeh();
    const last = beh[beh.length - 1];
    expect(last.source).toBe('news');
    expect(last.metadata.extras.summary).toBe('首张黑洞照片公布，视觉中国被质疑滥用版权。');
    expect(last.metadata.extras.tags).toEqual(['科学']);
    expect(__getNewsPendingSavesForTests().size).toBe(0);
  });

  it('改名后 modify 补全：事件新路径 ≠ 登记键 → frontmatter url 反查登记 → 带摘要完整观察（行为流）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const oldPath = '归档/网页剪藏/黑洞照片刷新认知.md';
    const newPath = '归档/网页剪藏/黑洞照片刷新认知 AI标题.md';
    vault.files.set(oldPath, '---\nurl: "https://www.guokr.com/article/black-hole"\n---\n\n正文');
    emitDomainEvent('news', { kind: 'saved', evt: { title: '黑洞照片刷新认知', platform: '果壳', state: 'saved', durationMin: 5 }, clipPath: oldPath });
    await settle();
    // auto-summary 改名 + 写回：原路径删除，新路径带 summary/tags，modify 事件携带新路径文件
    vault.files.delete(oldPath);
    vault.files.set(newPath, '---\nurl: "https://www.guokr.com/article/black-hole"\nsummary: "首张黑洞照片公布。"\ntags:\n  - "科学"\n---\n\n正文');
    vault.emit('modify', vault.file(newPath));
    await settle();
    const beh = readBeh();
    const last = beh[beh.length - 1];
    expect(last.source).toBe('news');
    expect(last.metadata.extras.summary).toBe('首张黑洞照片公布。');
    expect(last.metadata.extras.tags).toEqual(['科学']);
    expect(__getNewsPendingSavesForTests().size).toBe(0);
  });

  it('改名后降级（无 url 剪藏）：basename 反查子目录移动后新路径 → 命中带摘要（行为流）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    __setNewsSaveTimeoutForTests(60);
    const oldPath = '归档/网页剪藏/黑洞照片刷新认知.md';
    const newPath = '归档/网页剪藏/科技/黑洞照片刷新认知.md'; // 同 basename 新路径（目录移动）
    vault.files.set(oldPath, '---\nsummary: ""\n---\n\n正文'); // 无 url 剪藏 → 登记 baseName 兜底
    emitDomainEvent('news', { kind: 'saved', evt: { title: '黑洞照片刷新认知', platform: '果壳', state: 'saved', durationMin: 5 }, clipPath: oldPath });
    await new Promise((r) => setTimeout(r, 5)); // 登记完成即可（60ms 定时器未到）
    vault.files.delete(oldPath);
    vault.files.set(newPath, '---\nurl: "https://www.guokr.com/article/black-hole"\nsummary: "首张黑洞照片公布。"\ntags:\n  - "科学"\n---\n\n正文');
    await new Promise((r) => setTimeout(r, 250));
    const beh = readBeh();
    const last = beh[beh.length - 1];
    expect(last.source).toBe('news');
    expect(last.metadata.extras.summary).toBe('首张黑洞照片公布。');
    expect(last.metadata.extras.tags).toEqual(['科学']);
    expect(__getNewsPendingSavesForTests().size).toBe(0);
  });

  it('防重保留：保存立即形态已入流 → 降级无摘要同标题不产第二条（行为流）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    __setNewsSaveTimeoutForTests(60);
    const clipPath = '归档/网页剪藏/防重文章.md';
    // reader 保存真实顺序：markAsRead('saved') 先产立即形态，再登记待补全
    emitDomainEvent('news', { kind: 'read', evt: { title: '防重文章', platform: '少数派', state: 'saved', durationMin: 2 } });
    await settle();
    const before = readBeh().length;
    vault.files.set(clipPath, '---\nsummary: ""\n---\n\n正文'); // auto-summary 未及写回
    emitDomainEvent('news', { kind: 'saved', evt: { title: '防重文章', platform: '少数派', state: 'saved', durationMin: 2 }, clipPath: clipPath });
    await new Promise((r) => setTimeout(r, 250));
    const beh = readBeh();
    expect(beh.length).toBe(before); // 降级无摘要 → 同标题防重跳过
    expect(__getNewsPendingSavesForTests().size).toBe(0);
  });
});

// ---------------- 行为流落盘测试（ticket 123 缺陷修复：writeBehaviorStream 补 dataSaver） ----------------

describe('行为流落盘（writeBehaviorStream → sidecar 防抖落盘，ADR-0069）', () => {
  it('news:skipped 后 flushSidecars 确认 behaviorStream 已持久化到 smartcat-behavior.json', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('news', { kind: 'read', evt: { title: '落盘验证文章', platform: '知乎日报', state: 'skipped', durationMin: 2 } });
    await settle();
    // 内存行为流已写入
    const beh = readBeh();
    const last = beh[beh.length - 1];
    expect(last.source).toBe('news');
    expect(last.type).toBe('skipped');
    expect(last.metadata.name).toBe('落盘验证文章');
    // R5 防抖：内存写入只标脏，30s tick / 显式 flush 合并落盘到 sidecar（smartcat.json 不再随事件整写）
    expect(__getSmartcatInternals().memorySystem).toBeTruthy();
    await __getSmartcatInternals().memorySystem.flushSidecars();
    const sidePath = 'CONFIG/STORAGE/smartcat-behavior.json';
    const raw = JSON.parse(await vault.adapter.read(sidePath));
    const persisted = raw.items;
    expect(Array.isArray(persisted)).toBe(true);
    expect(persisted.some((b: any) => b.source === 'news' && b.type === 'skipped' && b.metadata?.name === '落盘验证文章')).toBe(true);
  });

  it('dataSaver 抛错 → 行为流条目仍在内存（容错不崩链）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    // 覆盖 vault.modify 使落盘失败（ensureSmartCat 已完成初始化，不会受影响）
    const realModify = vault.modify.bind(vault);
    vault.modify = async () => { throw new Error('disk full'); };
    const before = readBeh().length;
    emitDomainEvent('news', { kind: 'read', evt: { title: '容错文章', platform: '果壳', state: 'skipped', durationMin: 1 } });
    await settle();
    // 内存行为流条目已写入（dataSaver 失败不导致调用链崩溃）
    const beh = readBeh();
    expect(beh.length).toBe(before + 1);
    const last = beh[beh.length - 1];
    expect(last.source).toBe('news');
    expect(last.type).toBe('skipped');
    expect(last.metadata.name).toBe('容错文章');
    // 恢复 vault.modify
    vault.modify = realModify;
  });
});

void vi; // 保持 vi 引用（测试风格一致性，同 movie-action.test.ts）