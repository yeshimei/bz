/**
 * smartcat 数据层测试：smartcat.json 读写 + 一次性迁移（localStorage/旧文件）+ apiKey 忽略。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { loadSmartCatData, saveSmartCatData, getSmartcatFilePath, defaultSmartCatData, normalizeData } from '../../src/smartcat/data';

function baseApp(vault: MockVault) {
  const app: any = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' } as any));
  return app;
}

beforeEach(() => {
  (globalThis as any).localStorage = undefined;
});

describe('smartcat.json 路径', () => {
  it('跟随 storagePath（默认 CONFIG/STORAGE/smartcat.json）', () => {
    expect(getSmartcatFilePath()).toBe('CONFIG/STORAGE/smartcat.json');
  });
});

describe('loadSmartCatData', () => {
  it('文件不存在且无旧数据 → 默认数据 + 落盘', async () => {
    const vault = new MockVault();
    const app = baseApp(vault);
    const d = await loadSmartCatData(app);
    expect(d.config.appearance).toBe('orange');
    expect(d.config.conversationHistory).toEqual([]);
    // 迁移写盘（无旧数据 → 不迁移，不建文件）
    expect(vault.files.has('CONFIG/STORAGE/smartcat.json')).toBe(false);
  });

  it('文件存在 → 读取归一化', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/smartcat.json', JSON.stringify({
      config: { appearance: 'neon', personality: 'mentor', shortTermMemory: 99, conversationHistory: [] },
    }));
    const app = baseApp(vault);
    const d = await loadSmartCatData(app);
    expect(d.config.appearance).toBe('neon');
    expect(d.config.personality).toBe('mentor');
    expect(d.config.shortTermMemory).toBe(99);
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

describe('legacy 迁移（一次性）', () => {
  beforeEach(() => {
    (globalThis as any).localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
  });

  it('localStorage smart-cat-config → 迁移进 json（apiKey 忽略）', async () => {
    (globalThis as any).localStorage.getItem.mockImplementation((k: string) => {
      if (k === 'smart-cat-config') {
        return JSON.stringify({ appearance: 'fire', apiKey: 'sk-secret', personality: 'cute', conversationHistory: [] });
      }
      return null;
    });
    const vault = new MockVault();
    const app = baseApp(vault);
    const d = await loadSmartCatData(app);
    expect(d.config.appearance).toBe('fire');
    expect(d.config.personality).toBe('cute');
    expect((d.config as any).apiKey).toBeUndefined();
    expect(vault.files.has('CONFIG/STORAGE/smartcat.json')).toBe(true);
  });

  it('旧 vault 情感记忆文件迁移', async () => {
    const legacy = { version: '2.0', memories: [{ id: 'm1' }] };
    const vault = new MockVault();
    vault.files.set('CONFIG/SMART CAT/smart-cat-emotional-memory.json', JSON.stringify(legacy));
    const app = baseApp(vault);
    const d = await loadSmartCatData(app);
    expect(d.emotionalMemory).toEqual(legacy);
  });

  it('旧 memories 四层迁移', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/SMART_CAT/memories/short_term.json', JSON.stringify({ version: '1.0', memories: [{ id: 's1' }] }));
    const app = baseApp(vault);
    const d = await loadSmartCatData(app);
    expect(d.memory.shortTerm.memories.length).toBe(1);
    expect(d.memory.longTerm.memories).toEqual([]);
  });
});

describe('normalizeData', () => {
  it('旧布局（整个文件即 config）兼容', () => {
    const d = normalizeData({ appearance: 'galaxy', contextLength: 200 });
    expect(d.config.appearance).toBe('galaxy');
    expect(d.config.contextLength).toBe(200);
  });
});