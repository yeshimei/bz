/**
 * smartcat 数据层测试：smartcat.json 读写 + 记忆流结构归一化 + .vec 路径。
 * ADR-0021：迁移路径已删除——旧 localStorage/旧文件一律不再读取（无数据产生）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { loadSmartCatData, saveSmartCatData, getSmartcatFilePath, getSmartcatVecPath, defaultSmartCatData, defaultMemoryStream, normalizeData, applyInsightPatch } from '../../src/smartcat/data';

function baseApp(vault: MockVault) {
  const app: any = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' } as any));
  return app;
}

beforeEach(() => {
  (globalThis as any).localStorage = undefined;
});

describe('路径', () => {
  it('smartcat.json 跟随 storagePath（默认 CONFIG/STORAGE/smartcat.json）', () => {
    expect(getSmartcatFilePath()).toBe('CONFIG/STORAGE/smartcat.json');
  });

  it('记忆向量文件同目录（ADR-0021：.vec 豁免单 json）', () => {
    expect(getSmartcatVecPath()).toBe('CONFIG/STORAGE/smartcat-memory-vectors.vec');
  });
});

describe('loadSmartCatData', () => {
  it('文件不存在 → 默认数据 + 建默认数据文件（统一读写语义；不迁移）', async () => {
    const vault = new MockVault();
    const app = baseApp(vault);
    const d = await loadSmartCatData(app);
    expect(d.config.appearance).toBe('orange');
    expect(d.config.conversationHistory).toEqual([]);
    expect(d.memory.memoryStream).toEqual([]);
    expect(vault.files.has('CONFIG/STORAGE/smartcat.json')).toBe(true); // 统一读写语义：缺失建文件
  });

  it('文件存在 → 读取归一化（新 schema）', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/smartcat.json', JSON.stringify({
      config: { appearance: 'neon', personality: 'mentor', shortTermMemory: 99, conversationHistory: [] },
      memory: { version: 2, memoryStream: [{ id: 'm1', created: '2026-01-01', lastAccessed: '2026-01-01', description: '用户说：你好', importance: 0.8, type: 'observation' }], behaviorStream: [] },
    }));
    const app = baseApp(vault);
    const d = await loadSmartCatData(app);
    expect(d.config.appearance).toBe('neon');
    expect(d.memory.memoryStream.length).toBe(1);
    expect(d.memory.memoryStream[0].importance).toBe(0.8);
  });

  it('旧 schema（有 stream 字段）→ 重置为空新结构', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/smartcat.json', JSON.stringify({
      config: { appearance: 'neon', conversationHistory: [] },
      memory: { version: 1, stream: [{ id: 'm1', created: '2026-01-01', lastAccessed: '2026-01-01', description: '旧数据', importance: 0.8, type: 'observation' }] },
    }));
    const app = baseApp(vault);
    const d = await loadSmartCatData(app);
    expect(d.config.appearance).toBe('neon');
    expect(d.memory.memoryStream).toEqual([]);
    expect(d.memory.version).toBe(2);
  });

  it('坏 JSON → 默认数据', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/smartcat.json', '{broken');
    const app = baseApp(vault);
    const d = await loadSmartCatData(app);
    expect(d.config.appearance).toBe('orange');
  });
});

describe('saveSmartCatData', () => {
  it('保存（不存在 → 建目录建文件）', async () => {
    const vault = new MockVault();
    const app = baseApp(vault);
    await saveSmartCatData(app, defaultSmartCatData());
    expect(vault.files.has('CONFIG/STORAGE/smartcat.json')).toBe(true);
    const parsed = JSON.parse(vault.files.get('CONFIG/STORAGE/smartcat.json')!);
    expect(parsed.config.appearance).toBe('orange');
    expect(parsed.memory.memoryStream).toEqual([]);
  });

  it('保存（存在 → modify）', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/smartcat.json', JSON.stringify(defaultSmartCatData()));
    const app = baseApp(vault);
    const data = defaultSmartCatData();
    data.config.appearance = 'black';
    await saveSmartCatData(app, data);
    const parsed = JSON.parse(vault.files.get('CONFIG/STORAGE/smartcat.json')!);
    expect(parsed.config.appearance).toBe('black');
  });
});

describe('applyInsightPatch（P1-29 常驻通道写点）', () => {
  it('常驻内存对象原位修正 pinned/supersededBy；统一落盘后常驻侧任意保存不再回滚', async () => {
    const vault = new MockVault();
    const app = baseApp(vault);
    const data = defaultSmartCatData(); // 模拟常驻实例持有的内存对象
    data.memory.memoryStream.push({
      id: 'ins1', created: new Date().toISOString(), lastAccessed: new Date().toISOString(),
      description: '【洞察】用户坚持复习', importance: 0.75, type: 'insight',
    });
    await saveSmartCatData(app, data);
    // 面板固定 → 通道内 applyInsightPatch 原位改内存对象 + 统一 dataSaver 落盘
    expect(applyInsightPatch(data, 'ins1', (m) => { m.pinned = true; })).toBe(true);
    expect(data.memory.memoryStream[0].pinned).toBe(true);
    await saveSmartCatData(app, data);
    // 常驻侧触发任意保存（如心情衰减/观察落盘）
    data.mood.pad.pleasure = 60;
    await saveSmartCatData(app, data);
    // 从磁盘重读：pinned 保持 true（旧 load-modify-save 副本会被这次任意保存回滚成 false）
    const reloaded = await loadSmartCatData(app);
    expect(reloaded.memory.memoryStream.find((m) => m.id === 'ins1')!.pinned).toBe(true);

    // 废弃动作同通道可用
    expect(applyInsightPatch(data, 'ins1', (m) => { m.supersededBy = 'manual'; })).toBe(true);
    expect(data.memory.memoryStream[0].supersededBy).toBe('manual');
  });

  it('未找到该洞察返回 false 且不改数据', () => {
    const data = defaultSmartCatData();
    const before = JSON.stringify(data.memory.memoryStream);
    expect(applyInsightPatch(data, 'missing-id', () => { throw new Error('不应被调用'); })).toBe(false);
    expect(JSON.stringify(data.memory.memoryStream)).toBe(before);
  });
});

describe('normalizeData（记忆流，ADR-0021）', () => {
  it('旧布局（整个文件即 config）兼容', () => {
    const d = normalizeData({ appearance: 'galaxy', contextLength: 200 });
    expect(d.config.appearance).toBe('galaxy');
    expect(d.config.contextLength).toBe(200);
  });

  it('旧 schema（有 stream 字段）→ 重置为空新结构（P1 数据基座 ticket 123）', () => {
    const d = normalizeData({ memory: { version: 1, stream: [
      { id: 'ok', description: '合法', importance: 0.5, type: 'observation' },
      { id: 'no-desc' },
      null,
      'string',
    ] } });
    // 旧 schema → memoryStream 重置为空（旧数据清空，拍板决定）
    expect(d.memory.memoryStream).toEqual([]);
    expect(d.memory.version).toBe(2);
  });

  it('新 schema（有 memoryStream 字段）→ 正常读取', () => {
    const d = normalizeData({ memory: { version: 2, memoryStream: [
      { id: 'ok', description: '合法', importance: 0.5, type: 'observation' },
      { id: 'no-desc' },
    ] } });
    expect(d.memory.memoryStream.length).toBe(1);
    expect(d.memory.memoryStream[0].id).toBe('ok');
    expect(d.memory.version).toBe(2);
  });

  it('新 schema 包含 behaviorStream → 正常读取', () => {
    const d = normalizeData({ memory: { version: 2, memoryStream: [], behaviorStream: [
      { id: 'beh_1', timestamp: '2026-08-27T12:00:00Z', type: 'created', source: 'diary', description: 'diary:created' },
    ] } });
    expect(d.memory.behaviorStream.length).toBe(1);
    expect(d.memory.behaviorStream[0].id).toBe('beh_1');
  });

  it('旧四层字段（shortTerm 等）不再读取——无迁移，memoryStream 空（ADR-0021）', () => {
    const d = normalizeData({ memory: { shortTerm: { memories: [{ id: 's1' }] }, longTerm: { memories: [] } } });
    expect(d.memory.memoryStream).toEqual([]);
    expect((d.memory as any).shortTerm).toBeUndefined();
  });

  it('defaultMemoryStream 结构完整（version/memoryStream/behaviorStream/reflection + digest 字段）', () => {
    const m = defaultMemoryStream();
    expect(m.version).toBe(2);
    expect(m.memoryStream).toEqual([]);
    expect(m.behaviorStream).toEqual([]);
    expect(m.reflection).toEqual({ lastReflectAt: 0, count: 0, lastDigestAt: 0, digestCount: 0 });
  });
});