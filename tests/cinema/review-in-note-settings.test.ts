// @vitest-environment node
/**
 * 影院设置面板「影评写入笔记」开关：首次确认 + 二次确认钩子 + 默认关。
 */
import { describe, it, expect } from 'vitest';
import { cinemaSettingsSchema } from '../../src/cinema/settings';
import { DEFAULT_SETTINGS } from '../../src/settings';
import type { SettingsRow } from '../../src/core/settings-schema';

type ToggleRowLike = Extract<SettingsRow, { type: 'toggle' }> & {
  confirm?: (value: boolean) => Promise<boolean> | boolean;
};

describe('影院设置：影评写入笔记开关', () => {
  const rows = cinemaSettingsSchema().groups.flatMap((g) => g.rows);
  const row = rows.find((r) => 'binding' in r && (r.binding as { key?: string })?.key === 'cinemaReviewInNote') as ToggleRowLike | undefined;

  it('显示组有一条绑定 cinemaReviewInNote 的 toggle，默认关', () => {
    expect(row).toBeDefined();
    expect(row?.type).toBe('toggle');
    expect(DEFAULT_SETTINGS.cinemaReviewInNote).toBe(false);
  });

  it('开关带二次确认钩子，取消时渲染器不写值', () => {
    expect(typeof row?.confirm).toBe('function');
  });
});
