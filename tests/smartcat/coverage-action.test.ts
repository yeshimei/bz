/**
 * 复习计划 / 附件搬移动作观察集成（issue 261：ADR-0069 遗留接线补齐）：
 * emitDomainEvent('review'|'attach', evt) → 行为流观察（source 'review'/'attach'）；
 * noteSource 关闭时不观察。文案构造单测见 behavior-wording.test.ts。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { emitDomainEvent } from '../../src/core/domain-bus';
import { ensureSmartCat, unloadSmartCat, __getSmartcatInternals } from '../../src/smartcat/index';

let settings: any = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true };

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

/** 取行为流最后一条 */
function lastBehavior(): any {
  const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
  return beh[beh.length - 1];
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  settings = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true };
  unloadSmartCat();
});

describe('notifyReviewAction（复习计划动作观察，域事件派发）', () => {
  it('开始复习 → 行为流条目，source=review, action=started', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('review', { kind: 'started' });
    await settle();
    const last = lastBehavior();
    expect(last.source).toBe('review');
    expect(last.type).toBe('started');
    expect(last.description).toBe('review:started');
    expect(last.metadata.entityType).toBe('review');
  });

  it('加入 / 移出 / 评分 → 行为流对应条目（带条目名）', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('review', { kind: 'added', title: '三体' });
    emitDomainEvent('review', { kind: 'removed', title: '三体' });
    emitDomainEvent('review', { kind: 'rated', title: '三体', rating: 'good' });
    await settle();
    const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    const kinds = beh.slice(-3).map((b) => `${b.source}:${b.type}`);
    expect(kinds).toEqual(['review:added', 'review:removed', 'review:rated']);
    const rated = beh[beh.length - 1];
    expect(rated.metadata.name).toBe('三体');
    expect(rated.metadata.extras).toEqual({ rating: 'good' });
  });

  it('载荷缺标题（added）→ 静默不产条目', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    const before = __getSmartcatInternals().data.memory.behaviorStream.length;
    emitDomainEvent('review', { kind: 'added', title: '  ' });
    await settle();
    expect(__getSmartcatInternals().data.memory.behaviorStream.length).toBe(before);
  });

  it('noteSource 关 → 不观察', async () => {
    settings = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatNoteSource: false };
    const { app } = makeApp();
    await ensureSmartCat(app);
    (__getSmartcatInternals().data.config as any).noteSource = false;
    const before = __getSmartcatInternals().data.memory.behaviorStream.length;
    emitDomainEvent('review', { kind: 'started' });
    await settle();
    expect(__getSmartcatInternals().data.memory.behaviorStream.length).toBe(before);
  });
});

describe('notifyAttachMoved（附件搬移动作观察，域事件派发）', () => {
  it('搬移成功 → 行为流条目，source=attach, action=moved, 带成功数', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('attach', { kind: 'moved', count: 3 });
    await settle();
    const last = lastBehavior();
    expect(last.source).toBe('attach');
    expect(last.type).toBe('moved');
    expect(last.metadata.entityType).toBe('attach');
    expect(last.metadata.count).toBe(3);
  });

  it('无计数 → 条目仍产，count 缺省', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('attach', { kind: 'moved' });
    await settle();
    const last = lastBehavior();
    expect(last.source).toBe('attach');
    expect(last.metadata.count).toBeUndefined();
  });
});
