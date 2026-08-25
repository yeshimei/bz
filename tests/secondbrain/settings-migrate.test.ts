// @vitest-environment node
/**
 * 第二大脑设置迁移测试（ticket 103）：闪念 16 旧键更名平移、废弃键清除、默认值口径。
 * migrateSecondBrainSettings 为纯函数（src/settings.ts 无任何依赖，node 环境直测）。
 */
import { describe, it, expect } from 'vitest';
import { migrateSecondBrainSettings, SECOND_BRAIN_RENAMED_KEYS, DEFAULT_SETTINGS } from '../../src/settings';

describe('migrateSecondBrainSettings', () => {
  it('16 对旧键全部平移到新键且旧键删除', () => {
    expect(SECOND_BRAIN_RENAMED_KEYS).toHaveLength(16);
    const s: any = {};
    for (const [from] of SECOND_BRAIN_RENAMED_KEYS) s[from] = `OLD::${from}`;
    expect(migrateSecondBrainSettings(s)).toBe(true);
    for (const [from, to] of SECOND_BRAIN_RENAMED_KEYS) {
      expect(s[to]).toBe(`OLD::${from}`); // 值原样平移
      expect(from in s).toBe(false); // 旧键一律删除
    }
  });

  it('新键已有值时旧键仅删除不平移（不覆盖现有配置）', () => {
    const s: any = {
      OLLAMA_URL: 'http://old:11434',
      secondBrainOllamaUrl: 'http://new:11434',
      flashEnabled: false,
      secondBrainEnabled: true,
    };
    expect(migrateSecondBrainSettings(s)).toBe(true);
    expect(s.secondBrainOllamaUrl).toBe('http://new:11434');
    expect(s.secondBrainEnabled).toBe(true);
    expect('OLLAMA_URL' in s).toBe(false);
    expect('flashEnabled' in s).toBe(false);
  });

  it('废弃键 META_PATH/VEC_PATH 直接清除，不平移到任何键', () => {
    const s: any = {
      META_PATH: 'CONFIG/STORAGE/ai_completion_meta.json',
      VEC_PATH: 'CONFIG/STORAGE/ai_completion_vectors.vec',
    };
    expect(migrateSecondBrainSettings(s)).toBe(true);
    expect(Object.keys(s)).toEqual([]); // 清除且无继任者
  });

  it('无旧键时返回 false 且对象零改动', () => {
    const s: any = { ...DEFAULT_SETTINGS };
    const before = JSON.stringify(s);
    expect(migrateSecondBrainSettings(s)).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('DEFAULT_SETTINGS 口径：新默认值就位、闪念废弃键不复存在', () => {
    expect(DEFAULT_SETTINGS.secondBrainOllamaUrl).toBe('http://localhost:11434');
    expect(DEFAULT_SETTINGS.secondBrainEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.secondBrainMobileDefaultFullscreen).toBe(true);
    expect('OLLAMA_URL' in DEFAULT_SETTINGS).toBe(false);
    expect('flashEnabled' in DEFAULT_SETTINGS).toBe(false);
    expect('META_PATH' in DEFAULT_SETTINGS).toBe(false);
  });
});
