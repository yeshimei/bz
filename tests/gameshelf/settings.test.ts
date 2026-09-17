// @vitest-environment node
/**
 * 游戏库域设置 schema（2026-09-17 用户点名：「也如其他域加上外观组放到最前面」）。
 * 守卫三条：组顺序（外观置顶）/ 外观两行的绑定与预览契约 / 两键在 DEFAULT_SETTINGS 有默认值，
 * 外加「预览类在样式表里有定义」——prevClass 写错会让卡片渲染成空白，界面不报错、测试也不红。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gameshelfSettingsSchema } from '../../src/gameshelf/settings';
import { DEFAULT_SETTINGS } from '../../src/settings';
import type { SettingsRow } from '../../src/core/settings-schema';

/** 外观组两行都是 choiceCards（行判别联合里就地取，schema 未单独导出该成员类型） */
type ChoiceCardsRow = Extract<SettingsRow, { type: 'choiceCards' }>;

/** 直绑键（RowBinding 是「键直绑 | 外部三函数逃生口」二选一，这里断言走的是直绑那支） */
function boundKey(row: ChoiceCardsRow): keyof typeof DEFAULT_SETTINGS {
  const b = row.binding as { key?: string };
  if (!b.key) throw new Error(`${row.name} 未直绑设置键`);
  return b.key as keyof typeof DEFAULT_SETTINGS;
}

const readRepoFile = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('游戏库设置 schema：外观组置顶', () => {
  const schema = gameshelfSettingsSchema();

  it('组顺序 = 外观 → 目录 → Steam（与各域同范式，issue 246）', () => {
    expect(schema.groups.map((g) => g.name)).toEqual(['外观', '目录', 'Steam']);
    expect(schema.groups[0].icon).toBe('palette');
  });

  it('外观两行：布局单卡（海报墙）+ 主题单档（墨黑，layoutKey 联动）', () => {
    const rows = schema.groups[0].rows as ChoiceCardsRow[];
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('面板布局');
    expect(boundKey(rows[0])).toBe('gameshelfLayout');
    expect(rows[0].options).toEqual([{ value: 'default', label: '海报墙', prevClass: 'bz-sp-prev-panel' }]);
    expect(rows[1].name).toBe('面板主题');
    expect(boundKey(rows[1])).toBe('gameshelfSkinTheme');
    expect(rows[1].layoutKey).toBe('gameshelfLayout'); // 主题随布局联动（同各域范式）
    expect(rows[1].options).toEqual([{ value: 'ink', label: '墨黑', layout: 'default', prevClass: 'bz-sp-prev-ink' }]);
  });

  it('两键在 DEFAULT_SETTINGS 里有默认值且与选项值一致（首装不落空卡）', () => {
    const rows = schema.groups[0].rows as ChoiceCardsRow[];
    for (const row of rows) {
      const def = DEFAULT_SETTINGS[boundKey(row)];
      expect(typeof def, `${row.name} 默认值应为串`).toBe('string');
      expect(row.options.map((o) => o.value)).toContain(def as string);
    }
  });

  it('预览类在样式表里有定义（prevClass 写错 = 卡片空白，不报错）', () => {
    const css = readRepoFile('../../src/settings-panel/styles.css');
    for (const row of schema.groups[0].rows as ChoiceCardsRow[]) {
      for (const o of row.options) {
        expect(o.prevClass, `${row.name}/${o.label} 缺 prevClass`).toBeTruthy();
        expect(css, `${o.prevClass} 未在样式表定义`).toContain(`.bz-sp-mini.${o.prevClass}`);
      }
    }
  });
});
