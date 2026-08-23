/**
 * 聚合讯观察集成（ticket 076，ADR-0029）：notifyNewsRead 逐篇三态 → 记忆流观察（source news）；
 * 保存联动 auto-summary（方案 a）：notifyNewsSaved 登记 → 剪藏 modify 命中补全完整保存观察且登记移除
 * （再触发不再产）；2 分钟降级（注入短间隔）产出无摘要保存观察；剪藏事件观察短路；noteSource 关静默。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import {
  ensureSmartCat, unloadSmartCat, notifyNewsRead, notifyNewsSaved,
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
  return { app, vault };
}

/** 等待 fire-and-forget 的 addObservation 落流 */
const settle = () => new Promise((r) => setTimeout(r, 100));

const readStream = (): any[] => __getSmartcatInternals().data.memory.stream;

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  settings = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };
  unloadSmartCat();
});

describe('notifyNewsRead（逐篇三态，方法监听）', () => {
  it('阅读 → 观察入流（含 source news）', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    notifyNewsRead({ title: '黑洞照片刷新认知', platform: '果壳', state: 'read', durationMin: 5 });
    await settle();
    const stream = readStream();
    expect(stream[stream.length - 1].description).toBe('你阅读了《黑洞照片刷新认知》（果壳·读了 5 分钟）');
    expect(stream[stream.length - 1].source).toBe('news');
  });

  it('noteSource 关闭 → 静默不观察；notifyNewsSaved 也不登记', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    const data: any = __getSmartcatInternals().data;
    data.config.noteSource = false;
    const before = data.memory.stream.length;
    notifyNewsRead({ title: '黑洞照片刷新认知', platform: '果壳', state: 'saved', durationMin: 5 });
    notifyNewsSaved({ title: '黑洞照片刷新认知', platform: '果壳', state: 'saved', durationMin: 5 }, '归档/网页剪藏/黑洞照片刷新认知.md');
    await settle();
    expect(data.memory.stream.length).toBe(before);
    expect(__getNewsPendingSavesForTests().size).toBe(0);
  });

  it('未初始化（unload 后）→ 静默不观察、不登记、不抛错', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    unloadSmartCat();
    expect(() => {
      notifyNewsRead({ title: 'X', platform: '果壳', state: 'read', durationMin: 1 });
      notifyNewsSaved({ title: 'X', platform: '果壳', state: 'saved', durationMin: 1 }, '归档/网页剪藏/X.md');
    }).not.toThrow();
    await settle();
    expect(__getNewsPendingSavesForTests().size).toBe(0);
  });
});

describe('保存联动 auto-summary（方案 a，ticket 076）', () => {
  it('剪藏 modify 命中登记 → 完整保存观察 + 登记移除（再触发不再产）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const clipPath = '归档/网页剪藏/黑洞照片刷新认知.md';
    // 模拟 saveToClip 已创建剪藏 + auto-summary 写回 frontmatter（summary/tags）
    vault.files.set(clipPath, '---\nsummary: "首张黑洞照片公布，视觉中国被质疑滥用版权。"\ntags:\n  - "科学"\n  - "AI"\n---\n\n正文');
    notifyNewsSaved({ title: '黑洞照片刷新认知', platform: '果壳', state: 'saved', durationMin: 5 }, clipPath);
    expect(__getNewsPendingSavesForTests().size).toBe(1);
    // auto-summary 写回触发的 modify 事件
    vault.emit('modify', vault.file(clipPath));
    await settle();
    const stream = readStream();
    expect(stream[stream.length - 1].description).toBe('你保存了《黑洞照片刷新认知》（果壳·读了 5 分钟）：首张黑洞照片公布，视觉中国被质疑滥用版权。 #科学 #AI');
    expect(stream[stream.length - 1].source).toBe('news');
    // 登记已移除；再触发 modify 不再产
    expect(__getNewsPendingSavesForTests().size).toBe(0);
    const before = stream.length;
    vault.emit('modify', vault.file(clipPath));
    await settle();
    expect(readStream().length).toBe(before);
  });

  it('普通剪藏 modify（未命中登记）→ 短路：不产「你剪藏了」观察', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const clipPath = '归档/网页剪藏/普通剪藏文章.md';
    vault.files.set(clipPath, '---\nsummary: "普通摘要"\n---\n\n正文');
    const before = readStream().length;
    vault.emit('modify', vault.file(clipPath));
    await settle();
    const stream = readStream();
    expect(stream.length).toBe(before);
    expect(stream.some((m) => m.description.includes('你剪藏了'))).toBe(false);
    expect(__getNewsPendingSavesForTests().size).toBe(0);
  });

  it('降级：登记后未等到 summary → 产出无摘要保存观察 + 登记移除', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    __setNewsSaveTimeoutForTests(60);
    const clipPath = '归档/网页剪藏/未等来摘要.md';
    notifyNewsSaved({ title: '未等来摘要', platform: '知乎日报', state: 'saved', durationMin: 3 }, clipPath);
    expect(__getNewsPendingSavesForTests().size).toBe(1);
    await new Promise((r) => setTimeout(r, 250)); // 超过降级等待（60ms）并等落流
    const stream = readStream();
    expect(stream[stream.length - 1].description).toBe('你保存了《未等来摘要》（知乎日报·读了 3 分钟）');
    expect(stream[stream.length - 1].source).toBe('news');
    expect(__getNewsPendingSavesForTests().size).toBe(0);
  });
});

void vi; // 保持 vi 引用（测试风格一致性，同 movie-action.test.ts）