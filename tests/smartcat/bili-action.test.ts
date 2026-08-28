/**
 * 文献盒动作观察集成（ADR-0066/0067 域事件派发）：emitDomainEvent('bili-tasks', evt) →
 * 小橘行为流（source 'bili-downloader'）；用户拍板只收 added/converted 两个节点——
 * edited/failed 不进行为流（buildBiliStructured 返回 null）；noteSource 关闭时不观察。
 * ADR-0067：parsed 事件不新增条目，而是充实之前那条 added 条目（BV 号 → 标题语义）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { emitDomainEvent } from '../../src/core/domain-bus';
import { ensureSmartCat, unloadSmartCat, __getSmartcatInternals } from '../../src/smartcat/index';
import { enrichBiliAddedWithParsed } from '../../src/smartcat/bili-source';

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

describe('enrichBiliAddedWithParsed（ADR-0067：解析信息充实既有 added 条目，纯函数）', () => {
  function entry(url: string): any {
    return {
      id: 'beh_1', timestamp: new Date().toISOString(), type: 'added', source: 'bili-downloader',
      description: `bili-downloader:added ${url}`,
      metadata: { entityType: 'bili', action: 'added', name: url, extras: { url } },
    };
  }

  it('命中同 url 的最近 added 条目：name 换标题、extras 补 uploader、描述同步', () => {
    const stream: any[] = [entry('BV1xx411c7mD')];
    const ok = enrichBiliAddedWithParsed(stream, { url: 'BV1xx411c7mD', title: '从零开始学B站', uploader: '某UP' });
    expect(ok).toBe(true);
    expect(stream[0].metadata.name).toBe('从零开始学B站');
    expect(stream[0].metadata.extras).toMatchObject({ url: 'BV1xx411c7mD', title: '从零开始学B站', uploader: '某UP' });
    expect(stream[0].description).toBe('bili-downloader:added 从零开始学B站');
  });

  it('url 不匹配 / 无 added 条目 → 不改写返回 false（不新增条目）', () => {
    const stream: any[] = [entry('BV1xx411c7mE')];
    expect(enrichBiliAddedWithParsed(stream, { url: 'BV1xx411c7mD', title: 'X' })).toBe(false);
    expect(stream[0].metadata.name).toBe('BV1xx411c7mE');
    expect(enrichBiliAddedWithParsed([], { url: 'BV1xx411c7mD', title: 'X' })).toBe(false);
    expect(enrichBiliAddedWithParsed(stream, { url: '', title: 'X' })).toBe(false);
    expect(enrichBiliAddedWithParsed(stream, { url: 'BV1xx411c7mD', title: '' })).toBe(false);
  });
});

describe('notifyBiliAction：parsed 充实既有条目（ADR-0067 集成）', () => {
  it('added 后发 parsed → 不新增条目，原条目语义升级为标题', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('bili-tasks', { kind: 'added', url: 'https://www.bilibili.com/video/BV1xx411c7mD' });
    await settle();
    emitDomainEvent('bili-tasks', { kind: 'parsed', url: 'https://www.bilibili.com/video/BV1xx411c7mD', title: '从零开始学B站', uploader: '某UP' });
    await settle();
    const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    expect(beh).toHaveLength(1); // 不新增
    const last = beh[0];
    expect(last.type).toBe('added');
    expect(last.metadata.name).toBe('从零开始学B站');
    expect(last.metadata.extras.uploader).toBe('某UP');
  });

  it('无对应 added 条目（如旧数据）→ parsed 静默不产生任何条目', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('bili-tasks', { kind: 'parsed', url: 'BV1xx411c7mD', title: '孤立的解析', uploader: '某UP' });
    await settle();
    const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    expect(beh).toHaveLength(0);
  });
});