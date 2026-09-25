// @vitest-environment node
/**
 * 语音转写设置键测试（issue 444）：
 * - migrateAsrKeys：knowledgeWhisperModel → asrWhisperModel 一次性迁移（读旧写新删旧，C16 口径）；
 * - DEFAULT_SETTINGS：asrEngine 缺省 sensevoice / asrWhisperModel 缺省 small，旧键不再有默认值。
 * node 环境（settings.ts 纯数据层可加载，obsidian 经 alias mock）。
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, migrateAsrKeys } from '../../src/settings';

describe('migrateAsrKeys · issue 444（knowledgeWhisperModel → asrWhisperModel）', () => {
  it('旧键有值 → 搬入新键并删除旧键，返回 true', () => {
    const raw: Record<string, unknown> = { knowledgeWhisperModel: 'medium', knowledgePythonPath: 'py' };
    expect(migrateAsrKeys(raw)).toBe(true);
    expect(raw.knowledgeWhisperModel).toBeUndefined();
    expect(raw.asrWhisperModel).toBe('medium');
    expect(raw.knowledgePythonPath).toBe('py'); // 无关键不动（两引擎共用 Python 路径，继续沿用）
  });

  it('新键已有值 → 只删旧不覆盖（不踩用户改过的新值）', () => {
    const raw: Record<string, unknown> = { knowledgeWhisperModel: 'medium', asrWhisperModel: 'large-v3' };
    expect(migrateAsrKeys(raw)).toBe(true);
    expect(raw.knowledgeWhisperModel).toBeUndefined();
    expect(raw.asrWhisperModel).toBe('large-v3');
  });

  it('旧键为空串 → 键照删、值不搬（空值搬进去等于噪音，照 Jev 迁移口径）', () => {
    const raw: Record<string, unknown> = { knowledgeWhisperModel: '' };
    expect(migrateAsrKeys(raw)).toBe(true);
    expect(raw.knowledgeWhisperModel).toBeUndefined();
    expect(raw.asrWhisperModel).toBeUndefined();
  });

  it('无旧键 → 不改动返回 false（幂等，不重复落盘）', () => {
    expect(migrateAsrKeys({ asrWhisperModel: 'small' })).toBe(false);
    expect(migrateAsrKeys({})).toBe(false);
    expect(migrateAsrKeys(null)).toBe(false);
    expect(migrateAsrKeys(undefined)).toBe(false);
    expect(migrateAsrKeys(42)).toBe(false);
  });

  it('幂等：迁移后的对象再跑一遍不改动', () => {
    const raw: Record<string, unknown> = { knowledgeWhisperModel: 'small' };
    expect(migrateAsrKeys(raw)).toBe(true);
    const snapshot = JSON.parse(JSON.stringify(raw));
    expect(migrateAsrKeys(raw)).toBe(false);
    expect(raw).toEqual(snapshot);
  });
});

describe('语音转写默认值（issue 444）', () => {
  it('asrEngine 缺省 sensevoice / asrWhisperModel 缺省 small；旧键不再有默认值', () => {
    expect(DEFAULT_SETTINGS.asrEngine).toBe('sensevoice');
    expect(DEFAULT_SETTINGS.asrWhisperModel).toBe('small');
    expect((DEFAULT_SETTINGS as unknown as Record<string, unknown>).knowledgeWhisperModel).toBeUndefined();
  });
});
