/**
 * 文献盒动作观察集成（ADR-0066 域事件派发）：emitDomainEvent('bili-tasks', evt) →
 * 小橘行为流（source 'bili-downloader'）；用户拍板只收 added/converted 两个节点——
 * edited/failed 不进行为流（buildBiliStructured 返回 null）；noteSource 关闭时不观察。
 * 文案构造单测见 bili-source.test.ts（如建）与 routing/behavior-wording。
 */
import { describe, it, expect, beforeEach } from 'vitest';
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

describe('notifyBiliAction（文献盒动作观察，bili-tasks 域事件派发，ADR-0066）', () => {
  it('添加转文献任务（added）→ 行为流条目，source=bili-downloader, action=added, name=BV 号', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('bili-tasks', { kind: 'added', url: 'https://www.bilibili.com/video/BV1xx411c7mD' });
    await settle();
    const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    const last = beh[beh.length - 1];
    expect(last.source).toBe('bili-downloader');
    expect(last.type).toBe('added');
    expect(last.description).toBe('bili-downloader:added BV1xx411c7mD');
    expect(last.metadata.entityType).toBe('bili');
    expect(last.metadata.action).toBe('added');
    expect(last.metadata.name).toBe('BV1xx411c7mD');
    expect(last.metadata.extras.url).toContain('BV1xx411c7mD');
  });

  it('单条转文献成功（converted）→ 行为流条目，name=文献标题（notePath 提取）', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('bili-tasks', { kind: 'converted', id: 't1', url: 'BV1xx411c7mD', notePath: '文献盒/从零开始学B站.md' });
    await settle();
    const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    const last = beh[beh.length - 1];
    expect(last.type).toBe('converted');
    expect(last.metadata.entityType).toBe('bili');
    expect(last.metadata.name).toBe('从零开始学B站');
    expect(last.metadata.extras).toEqual({ url: 'BV1xx411c7mD', notePath: '文献盒/从零开始学B站.md' });
  });

  it('converted 无 notePath → name 兜底 BV 号', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('bili-tasks', { kind: 'converted', url: 'BV1xx411c7mD', notePath: null });
    await settle();
    const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    expect(beh[beh.length - 1].metadata.name).toBe('BV1xx411c7mD');
  });

  it('编辑/失败事件不进行为流（用户拍板只收 added/converted）', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('bili-tasks', { kind: 'edited', url: 'BV1xx411c7mD' });
    emitDomainEvent('bili-tasks', { kind: 'failed', url: 'BV1xx411c7mD', notePath: null });
    await settle();
    const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    expect(beh).toHaveLength(0);
  });

  it('noteSource 关闭 → 静默不观察', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    const d = __getSmartcatInternals().data;
    d.config.noteSource = false;
    emitDomainEvent('bili-tasks', { kind: 'added', url: 'BV1xx411c7mD' });
    await settle();
    const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    expect(beh).toHaveLength(0);
  });
});