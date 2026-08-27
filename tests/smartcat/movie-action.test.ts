/**
 * 影视动作观察集成（ticket 074 域事件派发）：emitDomainEvent('movie', evt) → 记忆流观察；
 * noteSource 关闭时不观察。文案构造单测见 movie-source.test.ts。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { emitDomainEvent } from '../../src/core/domain-bus';
import { ensureSmartCat, unloadSmartCat, __getSmartcatInternals } from '../../src/smartcat/index';

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

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  settings = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };
  unloadSmartCat();
});

describe('notifyMovieAction（影视动作观察，域事件派发）', () => {
  it('创建想看 → 观察入流', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('movie', { kind: 'created', name: '美丽人生', status: 'want', rating: -1, review: null });
    await settle();
    const stream: any[] = __getSmartcatInternals().data.memory.memoryStream;
    expect(stream[stream.length - 1].description).toBe('你把《美丽人生》加入想看');
    expect(stream[stream.length - 1].source).toBe('movie');
  });

  it('状态流转/改分/影评/删除各事件 → 对应结构化观察', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    // P2a：status 事件无专用路由规则 → system:fallback → behavior 流
    emitDomainEvent('movie', { kind: 'status', name: '美丽人生', from: 'watching', to: 'watched' });
    emitDomainEvent('movie', { kind: 'rated', name: '美丽人生', fromRating: 3.5, toRating: 4.5 });
    emitDomainEvent('movie', { kind: 'review', name: '美丽人生', fromReview: null, toReview: '经典' });
    emitDomainEvent('movie', { kind: 'review', name: '美丽人生', fromReview: '经典', toReview: '' });
    emitDomainEvent('movie', { kind: 'deleted', name: '美丽人生' });
    await settle();
    const stream: any[] = __getSmartcatInternals().data.memory.memoryStream;
    const behavior: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    // rated → memory, reviewed×2 → memory; status/deleted → behavior
    const memTail = stream.slice(-3).map((m) => m.description);
    expect(memTail).toEqual([
      '你把《美丽人生》的评分从 3.5 改为 4.5',
      '你写了《美丽人生》的影评：经典',
      '你删掉了《美丽人生》的影评',
    ]);
    // status/deleted → behavior 流（至少有 movie 来源的条目）
    const movieBeh = behavior.filter((m) => m.source === 'movie');
    expect(movieBeh.length).toBeGreaterThanOrEqual(1);
  });

  it('noteSource 关闭 → 静默不观察', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    const data: any = __getSmartcatInternals().data;
    data.config.noteSource = false;
    const before = data.memory.memoryStream.length;
    emitDomainEvent('movie', { kind: 'created', name: '美丽人生', status: 'want', rating: -1, review: null });
    await settle();
    expect(data.memory.memoryStream.length).toBe(before);
  });

  it('未初始化（unload 后）→ 静默不观察', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    unloadSmartCat();
    let before = 0;
    try { before = __getSmartcatInternals().data?.memory.memoryStream?.length ?? 0; } catch { before = -1; }
    expect(() => emitDomainEvent('movie', { kind: 'deleted', name: '美丽人生' })).not.toThrow();
    await settle();
    const after = (() => { try { return __getSmartcatInternals().data?.memory.memoryStream?.length ?? 0; } catch { return before; } })();
    void vi; // 保持 vi 引用（测试风格一致性）
    expect(after).toBe(before);
  });

  it('B6 防重：同事件同 key 近 300ms 只发一次（双击确认防重）；payload 不同不误伤', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    const data: any = __getSmartcatInternals().data;
    const before = data.memory.memoryStream.length;
    // 双击「已看」确认 → 重复 status 事件只入流一次
    emitDomainEvent('movie', { kind: 'status', name: '美丽人生', from: 'watching', to: 'watched' });
    emitDomainEvent('movie', { kind: 'status', name: '美丽人生', from: 'watching', to: 'watched' });
    await settle();
    expect(data.memory.memoryStream.length).toBe(before + 1);
    // payload 不同不误伤：紧随其后的改分事件正常入流（同 key 判定含 payload）
    emitDomainEvent('movie', { kind: 'rated', name: '美丽人生', fromRating: 4, toRating: 4.5 });
    await settle();
    expect(data.memory.memoryStream.length).toBe(before + 2);
    // 窗口外（>300ms）同事件可再次入流（防重不锁死）
    await new Promise((r) => setTimeout(r, 320));
    emitDomainEvent('movie', { kind: 'status', name: '美丽人生', from: 'watching', to: 'watched' });
    await settle();
    expect(data.memory.memoryStream.length).toBe(before + 3);
  });
});