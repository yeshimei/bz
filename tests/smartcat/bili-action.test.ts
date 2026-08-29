/**
 * 文献盒动作观察集成（ADR-0066/0072 域事件派发）：emitDomainEvent('literature:tasks', evt) →
 * 小橘行为流（source 'literature'）；ticket 136 用户拍板只收 converted（视频转文献成功）与
 * term-generated（术语生成成功）两个节点——added/edited/failed 不进行为流（buildLiteratureStructured 返回 null）；
 * noteSource 关闭时不观察。
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

describe('notifyLiteratureAction（文献盒动作观察，literature:tasks 域事件派发，ADR-0066/0072）', () => {
  it('视频转文献成功（converted）→ 行为流条目，source=literature, action=converted, name=文献标题（notePath 提取）', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('literature:tasks', { kind: 'converted', id: 't1', url: 'BV1xx411c7mD', notePath: '文献盒/从零开始学B站.md' });
    await settle();
    const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    const last = beh[beh.length - 1];
    expect(last.source).toBe('literature');
    expect(last.type).toBe('converted');
    expect(last.description).toBe('literature:converted 从零开始学B站');
    expect(last.metadata.entityType).toBe('literature');
    expect(last.metadata.name).toBe('从零开始学B站');
    expect(last.metadata.extras).toEqual({ url: 'BV1xx411c7mD', notePath: '文献盒/从零开始学B站.md' });
  });

  it('converted 无 notePath → name 兜底 BV 号', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('literature:tasks', { kind: 'converted', url: 'BV1xx411c7mD', notePath: null });
    await settle();
    const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    expect(beh[beh.length - 1].metadata.name).toBe('BV1xx411c7mD');
  });

  it('术语生成成功（term-generated）→ 行为流条目，name=术语词', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('literature:tasks', { kind: 'term-generated', term: '习得性无助', title: '习得性无助' });
    await settle();
    const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    const last = beh[beh.length - 1];
    expect(last.source).toBe('literature');
    expect(last.type).toBe('term-generated');
    expect(last.metadata.entityType).toBe('literature');
    expect(last.metadata.name).toBe('习得性无助');
    expect(last.metadata.extras).toEqual({ term: '习得性无助', title: '习得性无助' });
  });

  it('添加/编辑/失败事件不进行为流（ticket 136 只收 converted/term-generated）', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('literature:tasks', { kind: 'added', url: 'BV1xx411c7mD' });
    emitDomainEvent('literature:tasks', { kind: 'edited', url: 'BV1xx411c7mD' });
    emitDomainEvent('literature:tasks', { kind: 'failed', url: 'BV1xx411c7mD', notePath: null });
    await settle();
    const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    expect(beh).toHaveLength(0);
  });

  it('noteSource 关闭 → 静默不观察', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    const d = __getSmartcatInternals().data;
    d.config.noteSource = false;
    emitDomainEvent('literature:tasks', { kind: 'converted', url: 'BV1xx411c7mD', notePath: '文献盒/x.md' });
    await settle();
    const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    expect(beh).toHaveLength(0);
  });
});
