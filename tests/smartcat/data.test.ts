/**
 * smartcat 数据层测试：smartcat.json 读写 + 记忆流结构归一化 + .vec 路径。
 * ADR-0021：迁移路径已删除——旧 localStorage/旧文件一律不再读取（无数据产生）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { loadSmartCatData, saveSmartCatData, getSmartcatFilePath, getSmartcatVecPath, defaultSmartCatData, defaultMemoryStream, normalizeData } from '../../src/smartcat/data';

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
  it('文件不存在 → 默认数据（不建文件、不迁移）', async () => {
    const vault = new MockVault();
    const app = baseApp(vault);
    const d = await loadSmartCatData(app);
    expect(d.config.appearance).toBe('orange');
    expect(d.config.conversationHistory).toEqual([]);
    expect(d.memory.stream).toEqual([]);
    expect(vault.files.has('CONFIG/STORAGE/smartcat.json')).toBe(false);
  });

  it('文件存在 → 读取归一化', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/smartcat.json', JSON.stringify({
      config: { appearance: 'neon', personality: 'mentor', shortTermMemory: 99, conversationHistory: [] },
      memory: { stream: [{ id: 'm1', created: '2026-01-01', lastAccessed: '2026-01-01', description: '用户说：你好', importance: 0.8, type: 'observation' }] },
    }));
    const app = baseApp(vault);
    const d = await loadSmartCatData(app);
    expect(d.config.appearance).toBe('neon');
    expect(d.memory.stream.length).toBe(1);
    expect(d.memory.stream[0].importance).toBe(0.8);
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
    expect(parsed.memory.stream).toEqual([]);
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

describe('normalizeData（记忆流，ADR-0021）', () => {
  it('旧布局（整个文件即 config）兼容', () => {
    const d = normalizeData({ appearance: 'galaxy', contextLength: 200 });
    expect(d.config.appearance).toBe('galaxy');
    expect(d.config.contextLength).toBe(200);
  });

  it('memory.stream 过滤非法条目（id/description 缺失丢弃）', () => {
    const d = normalizeData({ memory: { stream: [
      { id: 'ok', description: '合法', importance: 0.5, type: 'observation' },
      { id: 'no-desc' },
      null,
      'string',
    ] } });
    expect(d.memory.stream.length).toBe(1);
    expect(d.memory.stream[0].id).toBe('ok');
  });

  it('旧四层字段（shortTerm 等）不再读取——无迁移，stream 空（ADR-0021）', () => {
    const d = normalizeData({ memory: { shortTerm: { memories: [{ id: 's1' }] }, longTerm: { memories: [] } } });
    expect(d.memory.stream).toEqual([]);
    expect((d.memory as any).shortTerm).toBeUndefined();
  });

  it('defaultMemoryStream 结构完整（version/stream/reflection）', () => {
    const m = defaultMemoryStream();
    expect(m.version).toBe(1);
    expect(m.stream).toEqual([]);
    expect(m.reflection).toEqual({ lastReflectAt: 0, count: 0 });
  });
});