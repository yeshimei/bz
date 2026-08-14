/**
 * 黑匣子增量提炼链路测试（ticket 59）：vault modify/create 监听（防抖 30 分钟）+
 * 打开即时提炼 + 首次全量分批 50 串行 + cursor 推进 + AI 失败跳过。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { BlackBoxDataManager } from '../../src/blackbox/data';
import {
  ensureBlackBoxExtraction,
  unloadBlackBoxExtraction,
  processPendingEntries,
  runFullExtraction,
  hasPendingEntries,
  autoStartBlackBoxExtraction,
  getExtractionInFlight,
} from '../../src/blackbox/sync';

const DIARY = (lines: string[]) => lines.join('\n');

function setup() {
  const vault = new MockVault();
  vault.create('我的/日记/2026-08-10.md', DIARY(['# 📖 08:30', '', '和妈妈搬完家。', '', '# ✍️ 21:00', '', '晚上散步。', '']));
  vault.create('我的/日记/2026-08-11.md', DIARY(['# 📖 09:00', '', '妈妈来新家。', '']));
  vault.create('我的/日记本/无关.md', '# 📖 10:00\n\n无关');
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
  return { vault, app };
}

function makeAI(result: string) {
  return { json: vi.fn().mockResolvedValue(result) } as any;
}

const EXTRACT_JSON = JSON.stringify({
  people: [{ name: '妈妈', aliases: ['妈'], dates: ['2026-08-10', '2026-08-11'] }],
  events: [{ title: '搬家完成', confidence: 0.9, emotion: '疲惫', date: '2026-08-10', time: '08:30' }],
  emotions: [{ entry: '2026-08-10 08:30', tags: ['疲惫', '释然'] }],
});

describe('hasPendingEntries / processPendingEntries（打开即时提炼）', () => {
  beforeEach(() => resetObsidianMocks());
  afterEach(() => unloadBlackBoxExtraction());

  it('无 cursor → 有待处理（全量）', async () => {
    const { app } = setup();
    expect(await hasPendingEntries(app)).toBe(true);
  });

  it('processPendingEntries：AI 提炼 → 落盘 mentions/events + cursor 推进', async () => {
    const { vault, app } = setup();
    const ai = makeAI(EXTRACT_JSON);
    const done = await processPendingEntries(app, ai);
    expect(done).toBe(true);
    expect(ai.json).toHaveBeenCalledTimes(1);
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    expect(data.profiles).toHaveLength(1); // 妈妈跨 08-10/08-11 两次 → 建画像
    expect(data.profiles[0].name).toBe('妈妈');
    expect(data.events).toHaveLength(1);
    expect(data.events[0].title).toBe('搬家完成');
    expect(data.cursor).not.toBeNull();
    expect(vault.files.has('CONFIG/STORAGE/blackbox.json')).toBe(true);
  });

  it('无新条目 → 不调 AI', async () => {
    const { app } = setup();
    const ai = makeAI(EXTRACT_JSON);
    await processPendingEntries(app, ai);
    const ai2 = makeAI(EXTRACT_JSON);
    const done = await processPendingEntries(app, ai2);
    expect(done).toBe(false);
    expect(ai2.json).not.toHaveBeenCalled();
  });

  it('AI 失败 → 返回 false 不崩溃，cursor 不推进（下次重试）', async () => {
    const { app } = setup();
    const ai = { json: vi.fn().mockRejectedValue(new Error('AI 挂了')) } as any;
    const done = await processPendingEntries(app, ai);
    expect(done).toBe(false);
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    expect(data.cursor).toBeNull();
    expect(getExtractionInFlight()).toBe(false);
  });

  it('AI 返回损坏 JSON → 跳过不崩溃', async () => {
    const { app } = setup();
    const ai = makeAI('不是 JSON');
    const done = await processPendingEntries(app, ai);
    expect(done).toBe(false);
  });
});

describe('runFullExtraction（首次全量分批）', () => {
  beforeEach(() => resetObsidianMocks());

  it('分批 50 串行 + 进度通知 + cursor 落盘', async () => {
    const vault = new MockVault();
    for (let d = 1; d <= 60; d++) {
      const date = `2026-07-${String(d).padStart(2, '0')}`;
      vault.create(`我的/日记/${date}.md`, DIARY(['# 📖 08:30', '', `第 ${d} 天日记内容。`, '']));
    }
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
    const ai = makeAI(EXTRACT_JSON);
    await runFullExtraction(app, ai);
    expect(ai.json.mock.calls.length).toBeGreaterThanOrEqual(2); // 60 条 / 50 每批 = 2 批
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    expect(data.cursor).not.toBeNull();
    // 进度通知存在
    const msgs = getNoticeMessages().join(' ');
    expect(msgs).toContain('提炼');
  });

  it('完成通知：提炼完成后 success 通知含「提炼完成」+ 新增人物/事件统计', async () => {
    const { app } = setup();
    const ai = makeAI(EXTRACT_JSON);
    await runFullExtraction(app, ai);
    const msgs = getNoticeMessages().join(' ');
    expect(msgs).toContain('提炼完成');
    expect(msgs).toContain('新增人物');
    expect(msgs).toContain('事件');
  });

  it('全部批次 AI 失败 → warning 通知 + cursor 不推进（下次启动重试）', async () => {
    const { app } = setup();
    const ai = { json: vi.fn().mockRejectedValue(new Error('AI 挂了')) } as any;
    await runFullExtraction(app, ai);
    const msgs = getNoticeMessages().join(' ');
    expect(msgs).toContain('提炼失败');
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    expect(data.cursor).toBeNull(); // 全失败不推进 → 下次启动重试
    expect(data.events).toHaveLength(0);
  });

  it('无日记 → 不调 AI', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
    const ai = makeAI(EXTRACT_JSON);
    await runFullExtraction(app, ai);
    expect(ai.json).not.toHaveBeenCalled();
  });
});

describe('ensureBlackBoxExtraction（vault 监听 + 防抖 30 分钟）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    unloadBlackBoxExtraction();
    vi.useRealTimers();
  });

  it('三目录 modify → 30 分钟后自动提炼', async () => {
    const { vault, app } = setup();
    const ai = makeAI(EXTRACT_JSON);
    ensureBlackBoxExtraction(app, ai);
    // 修改日记文件 + 触发 modify 事件
    const f = vault.file('我的/日记/2026-08-10.md');
    await vault.modify(f, DIARY(['# 📖 08:30', '', '和妈妈搬完家。', '', '# ✍️ 21:00', '', '晚上散步。', '', '# 🌙 23:00', '', '做了个梦。', '']));
    vault.emit('modify', f);
    expect(ai.json).not.toHaveBeenCalled();
    // 防抖 30 分钟未到
    await vi.advanceTimersByTimeAsync(29 * 60 * 1000);
    expect(ai.json).not.toHaveBeenCalled();
    // 30 分钟到 → 触发
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(ai.json).toHaveBeenCalled();
  });

  it('非三目录文件 modify → 不触发', async () => {
    const { vault, app } = setup();
    const ai = makeAI(EXTRACT_JSON);
    ensureBlackBoxExtraction(app, ai);
    const f = vault.file('我的/日记本/无关.md');
    await vault.modify(f, 'x');
    vault.emit('modify', f);
    await vi.advanceTimersByTimeAsync(31 * 60 * 1000);
    expect(ai.json).not.toHaveBeenCalled();
  });

  it('连续修改重置防抖（30 分钟内多次 modify 只提炼一次）', async () => {
    const { vault, app } = setup();
    const ai = makeAI(EXTRACT_JSON);
    ensureBlackBoxExtraction(app, ai);
    const f = vault.file('我的/日记/2026-08-10.md');
    await vault.modify(f, 'v1');
    vault.emit('modify', f);
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    await vault.modify(f, 'v2');
    vault.emit('modify', f);
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    await vault.modify(f, 'v3');
    vault.emit('modify', f);
    await vi.advanceTimersByTimeAsync(31 * 60 * 1000);
    expect(ai.json).toHaveBeenCalledTimes(1);
  });
});

describe('autoStartBlackBoxExtraction（启动自动提炼）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    unloadBlackBoxExtraction();
    vi.useRealTimers();
  });

  it('AI 未配置 → warning 提示去设置，不调 AI', async () => {
    const { app } = setup(); // setup 无 AI key
    const ai = makeAI(EXTRACT_JSON);
    await autoStartBlackBoxExtraction(app, ai);
    expect(ai.json).not.toHaveBeenCalled();
    const msgs = getNoticeMessages().join(' ');
    expect(msgs).toContain('配置 AI');
  });

  it('cursor 空 + AI 已配置 + 有日记 → 自动全量提炼 + cursor 落盘', async () => {
    const { app } = setup();
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }) as any);
    const ai = makeAI(EXTRACT_JSON);
    await autoStartBlackBoxExtraction(app, ai);
    expect(ai.json).toHaveBeenCalled();
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    expect(data.cursor).not.toBeNull();
    expect(data.events.length).toBeGreaterThan(0);
  });

  it('无日记目录 → 无操作不调 AI', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE', deepseekApiKey: 'sk-test' }) as any);
    const ai = makeAI(EXTRACT_JSON);
    await autoStartBlackBoxExtraction(app, ai);
    expect(ai.json).not.toHaveBeenCalled();
  });
});