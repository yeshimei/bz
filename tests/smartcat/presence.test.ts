/**
 * smartcat 在场口径（ticket 088，H5 统一 lastPresenceAt）：
 * touchPresence/getAbsenceDays 纯函数边界（mock Date）+ addObservation 观察路径刷新
 * + 聊天路径刷新（发消息即在场）+ ensure 缺省初始化（新用户不触发缺席，旧数据容忍）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { MemorySystem } from '../../src/smartcat/memory';
import { defaultSmartCatData, touchPresence, getAbsenceDays, DAY_MS, getSmartcatFilePath } from '../../src/smartcat/data';
import { ensureSmartCat, unloadSmartCat, openSmartCatChat, __getSmartcatInternals } from '../../src/smartcat/index';
import type { SmartCatData } from '../../src/smartcat/types';

let settings: any = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };

function baseData(): SmartCatData {
  return defaultSmartCatData();
}

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

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  settings = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };
  unloadSmartCat();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('touchPresence 刷新（写 helper）', () => {
  it('写入 Date.now() 到 editingData.lastPresenceAt（mock Date 固定值）', () => {
    const now = new Date('2026-08-24T03:00:00Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const data = baseData();
    expect(data.editingData).toBeNull(); // 默认数据 editingData null
    touchPresence(data);
    expect(data.editingData.lastPresenceAt).toBe(now);
  });

  it('旧数据 editingData 已有其它字段 → 补 lastPresenceAt 不覆盖其它字段', () => {
    const data = baseData();
    data.editingData = { proactiveCare: { week: '2026-W34', count: 1, lastAt: 111 }, dueScan: { date: '2026-08-24' } };
    touchPresence(data, 123456);
    expect(data.editingData.lastPresenceAt).toBe(123456);
    expect(data.editingData.proactiveCare).toEqual({ week: '2026-W34', count: 1, lastAt: 111 });
    expect(data.editingData.dueScan).toEqual({ date: '2026-08-24' });
  });

  it('重复 touch 覆盖旧值（刷新语义）', () => {
    const data = baseData();
    touchPresence(data, 100);
    touchPresence(data, 200);
    expect(data.editingData.lastPresenceAt).toBe(200);
  });
});

describe('getAbsenceDays 边界（读 helper，now 注入）', () => {
  it('缺省（editingData null / 无 lastPresenceAt）→ 0 天（ensure 缺省初始化即当前时间）', () => {
    expect(getAbsenceDays(baseData(), 1000000)).toBe(0);
    const data = baseData();
    data.editingData = {};
    expect(getAbsenceDays(data, 1000000)).toBe(0);
  });

  it('0 天：距 lastPresenceAt 不足 1 天', () => {
    const data = baseData();
    const now = 1000000 * DAY_MS;
    touchPresence(data, now - 23 * 3600 * 1000);
    expect(getAbsenceDays(data, now)).toBe(0);
  });

  it('1 天：≥1 天且 <2 天', () => {
    const data = baseData();
    const now = 1000000 * DAY_MS;
    touchPresence(data, now - DAY_MS - 3600 * 1000);
    expect(getAbsenceDays(data, now)).toBe(1);
  });

  it('N 天：距 lastPresenceAt 整 N 天', () => {
    const data = baseData();
    const now = 1000000 * DAY_MS;
    touchPresence(data, now - 3 * DAY_MS);
    expect(getAbsenceDays(data, now)).toBe(3);
    touchPresence(data, now - 30 * DAY_MS);
    expect(getAbsenceDays(data, now)).toBe(30);
  });

  it('未来时间（now < lastPresenceAt，时钟回拨）→ 钳位 0', () => {
    const data = baseData();
    touchPresence(data, 5000000000);
    expect(getAbsenceDays(data, 1000000000)).toBe(0);
  });
});

describe('addObservation 后字段更新（观察路径并入 dataSaver）', () => {
  it('观察成功写入后 editingData.lastPresenceAt 更新且随 saver 落盘（不新增独立写盘）', async () => {
    let data = baseData();
    const saver = vi.fn<(d: SmartCatData) => Promise<void>>(async (d) => { data = d; });
    const m = new MemorySystem({ vault: { adapter: {} } } as any, () => data, saver);
    (m as any).ollamaAvailable = false;
    await m.addObservation('用户说：今天学 TypeScript', { importance: 0.6, source: 'chat' });
    expect(typeof data.editingData.lastPresenceAt).toBe('number');
    expect(data.editingData.lastPresenceAt).toBeLessThanOrEqual(Date.now());
    // 落盘数据同引用（editingData 字段随既有 dataSaver 一起保存）
    const saved = saver.mock.calls.at(-1)![0];
    expect(saved.editingData.lastPresenceAt).toBe(data.editingData.lastPresenceAt);
  });
});

describe('聊天后字段更新（发消息即在场）', () => {
  it('openSmartCatChat 后派发 Enter：editingData.lastPresenceAt 更新为 number', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    await openSmartCatChat(app);
    // 聊天面板 input 触发 onSend → sendChatMessage（AI 成败无关——touch 在函数开头）
    const input = document.querySelector<HTMLTextAreaElement>('.chat-input')!;
    expect(input).not.toBeNull();
    (input.value as any) = '你好，小橘';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    const data: any = __getSmartcatInternals().data;
    expect(typeof data.editingData.lastPresenceAt).toBe('number');
    expect(data.editingData.lastPresenceAt).toBeLessThanOrEqual(Date.now());
    expect(data.editingData.lastPresenceAt).toBeGreaterThan(0);
  }, 20000);

  it('聊天成功路径落盘（mock fetch 返回回复）后字段随 conversationHistory 保存', async () => {
    const { app, vault } = makeApp();
    // AI 配置 + fetch mock：callChat 走 fetch 成功路径（conversationHistory 才落盘）
    resetAIProviderCache();
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
    await ensureSmartCat(app);
    await openSmartCatChat(app);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '喵呜~' } }] }),
    }));
    (globalThis as any).fetch = fetchMock;
    const input = document.querySelector<HTMLTextAreaElement>('.chat-input')!;
    (input.value as any) = '今天好累';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    // 等聊天完整走完（打字机式渲染 + conversationHistory dataSaver）
    await new Promise((r) => setTimeout(r, 300));
    const data: any = __getSmartcatInternals().data;
    expect(data.config.conversationHistory.length).toBeGreaterThan(0);
    expect(typeof data.editingData.lastPresenceAt).toBe('number');
    // 落盘文件编辑数据含 lastPresenceAt
    const onDisk = JSON.parse(vault.files.get(getSmartcatFilePath())!);
    expect(typeof onDisk.editingData.lastPresenceAt).toBe('number');
  }, 20000);
});

describe('ensure 缺省初始化', () => {
  it('新用户（无文件 default 数据）ensure 后 lastPresenceAt 初始化为当前时间', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const data: any = __getSmartcatInternals().data;
    expect(typeof data.editingData.lastPresenceAt).toBe('number');
    expect(data.editingData.lastPresenceAt).toBeLessThanOrEqual(Date.now());
    expect(vault.files.has(getSmartcatFilePath())).toBe(true);
  }, 20000);

  it('旧数据（editingData 无 lastPresenceAt）→ ensure 补齐当前时间且保留既有字段', async () => {
    const { app, vault } = makeApp();
    const legacy = baseData();
    legacy.editingData = { proactiveCare: { week: '2026-W33', count: 2, lastAt: 999 } };
    vault.files.set(getSmartcatFilePath(), JSON.stringify(legacy));
    await ensureSmartCat(app);
    const data: any = __getSmartcatInternals().data;
    expect(typeof data.editingData.lastPresenceAt).toBe('number');
    expect(data.editingData.proactiveCare).toEqual({ week: '2026-W33', count: 2, lastAt: 999 }); // 保留既有字段
  }, 20000);
});