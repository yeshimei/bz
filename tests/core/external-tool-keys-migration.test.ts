// @vitest-environment node
/**
 * 外部工具路径键测试（issue 462/ADR-0195）：
 * - migrateExternalToolKeys：knowledgePythonPath / knowledgeFfmpegPath / knowledgeFfprobePath
 *   → pythonPath / ffmpegPath / ffprobePath 一次性迁移（读旧写新删旧，migrateAsrKeys 同款 C16 口径）；
 * - DEFAULT_SETTINGS：新三键缺省（''/'ffmpeg'/'ffprobe' = 旧三键缺省，行为不变），旧键不再有默认值；
 * - peopleWxAccountDir：微信账号目录键位（默认空 = 自动探测）。
 * node 环境（settings.ts 纯数据层可加载，obsidian 经 alias mock）。
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, migrateExternalToolKeys } from '../../src/settings';

describe('migrateExternalToolKeys · issue 462（knowledge 三路径键 → 外部工具组）', () => {
  it('旧键有值 → 三键全部搬入新键并删除旧键，返回 true', () => {
    const raw: Record<string, unknown> = {
      knowledgePythonPath: 'D:/Python/python.exe',
      knowledgeFfmpegPath: 'D:/tools/ffmpeg.exe',
      knowledgeFfprobePath: 'D:/tools/ffprobe.exe',
    };
    expect(migrateExternalToolKeys(raw)).toBe(true);
    expect(raw.pythonPath).toBe('D:/Python/python.exe');
    expect(raw.ffmpegPath).toBe('D:/tools/ffmpeg.exe');
    expect(raw.ffprobePath).toBe('D:/tools/ffprobe.exe');
    expect(raw.knowledgePythonPath).toBeUndefined();
    expect(raw.knowledgeFfmpegPath).toBeUndefined();
    expect(raw.knowledgeFfprobePath).toBeUndefined();
  });

  it('部分旧键有值 → 只搬在册的，其余不动', () => {
    const raw: Record<string, unknown> = { knowledgePythonPath: 'py' };
    expect(migrateExternalToolKeys(raw)).toBe(true);
    expect(raw.pythonPath).toBe('py');
    expect(raw.ffmpegPath).toBeUndefined(); // 无旧键不写，合并默认值时取缺省
    expect(raw.ffprobePath).toBeUndefined();
  });

  it('新键已有值 → 只删旧不覆盖（不踩用户改过的新值）', () => {
    const raw: Record<string, unknown> = {
      knowledgePythonPath: 'old-py',
      knowledgeFfmpegPath: 'old-ffmpeg',
      pythonPath: 'new-py',
    };
    expect(migrateExternalToolKeys(raw)).toBe(true);
    expect(raw.pythonPath).toBe('new-py');
    expect(raw.ffmpegPath).toBe('old-ffmpeg'); // 新键缺位照常搬
    expect(raw.knowledgePythonPath).toBeUndefined();
    expect(raw.knowledgeFfmpegPath).toBeUndefined();
  });

  it('旧键为空串 → 键照删、值不搬（空值搬进去等于噪音，照 migrateAsrKeys 口径）', () => {
    const raw: Record<string, unknown> = { knowledgePythonPath: '', knowledgeFfmpegPath: '  ' };
    expect(migrateExternalToolKeys(raw)).toBe(true);
    expect(raw.knowledgePythonPath).toBeUndefined();
    expect(raw.knowledgeFfmpegPath).toBeUndefined();
    expect(raw.pythonPath).toBeUndefined();
    expect(raw.ffmpegPath).toBeUndefined();
  });

  it('无旧键 → 不改动返回 false（含非对象入参）', () => {
    expect(migrateExternalToolKeys({ pythonPath: 'py' })).toBe(false);
    expect(migrateExternalToolKeys({})).toBe(false);
    expect(migrateExternalToolKeys(null)).toBe(false);
    expect(migrateExternalToolKeys(undefined)).toBe(false);
    expect(migrateExternalToolKeys(42)).toBe(false);
  });

  it('幂等：迁移后的对象再跑一遍不改动（重复执行不重复落盘）', () => {
    const raw: Record<string, unknown> = {
      knowledgePythonPath: 'py',
      knowledgeFfmpegPath: 'ffmpeg',
      knowledgeFfprobePath: 'ffprobe',
    };
    expect(migrateExternalToolKeys(raw)).toBe(true);
    const snapshot = JSON.parse(JSON.stringify(raw));
    expect(migrateExternalToolKeys(raw)).toBe(false);
    expect(raw).toEqual(snapshot);
    expect(raw).toEqual({ pythonPath: 'py', ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe' });
  });
});

describe('外部工具默认值（issue 462）', () => {
  it('新三键缺省 = 旧三键缺省（空串与 ffmpeg/ffprobe，行为不变）；旧键不再有默认值', () => {
    expect(DEFAULT_SETTINGS.pythonPath).toBe('');
    expect(DEFAULT_SETTINGS.ffmpegPath).toBe('ffmpeg');
    expect(DEFAULT_SETTINGS.ffprobePath).toBe('ffprobe');
    const legacy = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
    expect(legacy.knowledgePythonPath).toBeUndefined();
    expect(legacy.knowledgeFfmpegPath).toBeUndefined();
    expect(legacy.knowledgeFfprobePath).toBeUndefined();
  });

  it('微信账号目录键位：默认空 = 自动探测（issue 462，本票仅键位）', () => {
    expect(DEFAULT_SETTINGS.peopleWxAccountDir).toBe('');
  });
});
