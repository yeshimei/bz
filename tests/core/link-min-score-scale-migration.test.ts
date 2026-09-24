// @vitest-environment node
/**
 * issue 425/ADR-0185 一次性迁移测试（migrateLinkMinScoreScale，src/settings.ts）：
 * 检索分数不再做 score^0.35 锐化，`linkAgentMinScore` 从锐化尺换算到原始余弦尺（cos = 旧分^(1/0.35)）。
 * 两把尺值域重叠故无法凭数值判幂等，迁移落一个内部标记键 `linkAgentMinScoreScale: 'cos'`。
 */
import { describe, it, expect } from 'vitest';
import { migrateLinkMinScoreScale, DEFAULT_SETTINGS } from '../../src/settings';

describe('migrateLinkMinScoreScale', () => {
  it('旧默认 0.65 → 0.29（≈新默认 0.30），并留下换算标记', () => {
    const raw: Record<string, unknown> = { linkAgentMinScore: 0.65, linkAgentTopK: 15 };
    expect(migrateLinkMinScoreScale(raw)).toBe(true);
    expect(raw.linkAgentMinScore).toBe(0.29);
    expect(raw.linkAgentMinScoreScale).toBe('cos');
    expect(raw.linkAgentTopK).toBe(15); // 其余键不动
  });

  it('自定义值同语义换算：0.9→0.74、0.5→0.14、0.3→0.03、0.1→0.01（下限）', () => {
    const conv = (old: number): unknown => {
      const raw: Record<string, unknown> = { linkAgentMinScore: old };
      migrateLinkMinScoreScale(raw);
      return raw.linkAgentMinScore;
    };
    expect(conv(0.9)).toBe(0.74);
    expect(conv(0.5)).toBe(0.14);
    expect(conv(0.3)).toBe(0.03);
    expect(conv(0.1)).toBe(0.01); // 极严的小值取整会掉到 0（= 不过滤），故下限 0.01
    expect(conv(0.01)).toBe(0.01);
  });

  it('标记已在册 → 不再动值（幂等，防二次换算把 0.3 打到 0.03）', () => {
    const raw: Record<string, unknown> = { linkAgentMinScore: 0.3, linkAgentMinScoreScale: 'cos' };
    expect(migrateLinkMinScoreScale(raw)).toBe(false);
    expect(raw.linkAgentMinScore).toBe(0.3);
  });

  it('未落盘过该键 → 不迁移不标记（缺省值本就取新尺 0.30）', () => {
    const raw: Record<string, unknown> = { linkAgentTopK: 8 };
    expect(migrateLinkMinScoreScale(raw)).toBe(false);
    expect('linkAgentMinScoreScale' in raw).toBe(false);
  });

  it('落盘过的默认设置再启动 → 不改值（标记随 DEFAULT_SETTINGS 一起落盘，绝不能被当旧尺二次换算）', () => {
    // 插件自身的保存路径（ensureRemoteOllamaUrl / 设置页任意一键）会把
    // Object.assign({}, DEFAULT_SETTINGS, loaded) 整份写回 data.json——若 DEFAULT_SETTINGS 不带标记，
    // 默认值 0.30 会在第二次启动被当旧尺换算成 0.03（下限静默失效、候选全量送裁判），故标记须在缺省值里。
    const persisted: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    expect(persisted.linkAgentMinScore).toBe(0.3);
    expect(persisted.linkAgentMinScoreScale).toBe('cos');
    expect(migrateLinkMinScoreScale(persisted)).toBe(false);
    expect(persisted.linkAgentMinScore).toBe(0.3);
  });

  it('0（不过滤）原样保留——两把尺上都是「关掉过滤」，换算会把下限 0.01 变成替用户打开过滤', () => {
    const raw: Record<string, unknown> = { linkAgentMinScore: 0 };
    expect(migrateLinkMinScoreScale(raw)).toBe(true);
    expect(raw.linkAgentMinScore).toBe(0);
    expect(raw.linkAgentMinScoreScale).toBe('cos');
  });

  it('脏值（负数 / 非数）→ 回落新默认并留标记', () => {
    for (const bad of [-0.5, '0.65', NaN]) {
      const raw: Record<string, unknown> = { linkAgentMinScore: bad };
      expect(migrateLinkMinScoreScale(raw)).toBe(true);
      expect(raw.linkAgentMinScore).toBe(DEFAULT_SETTINGS.linkAgentMinScore);
      expect(raw.linkAgentMinScoreScale).toBe('cos');
    }
  });

  it('畸形入参（null/undefined/字符串）→ 不改动返回 false', () => {
    expect(migrateLinkMinScoreScale(null)).toBe(false);
    expect(migrateLinkMinScoreScale(undefined)).toBe(false);
    expect(migrateLinkMinScoreScale('字符串')).toBe(false);
  });

  it('新默认本身在斜线以内：0.30 < 0.63（撞车阈值）——「值得建链」严于「高度重合」的档位关系不倒挂', () => {
    expect(DEFAULT_SETTINGS.linkAgentMinScore).toBe(0.3);
    expect(DEFAULT_SETTINGS.linkAgentMinScore).toBeLessThan(0.63);
  });
});
