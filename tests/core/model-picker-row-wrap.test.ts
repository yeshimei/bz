// @vitest-environment node
/**
 * 模型选择器行「长说明不再挤竖模型名」回归守卫（2026-09-24 用户截图：Jev 模型行的
 * Typesafe 描述很长，模型名被压成逐字竖排、说明溢出裁切）。
 * jsdom 不解析 CSS，读源文本断言（先例 tests/core/overlay-glass.test.ts）：
 *  - 行必须允许换行（长说明整段折到第二行）——不能是单行 flex；
 *  - 说明必须可收缩（可让位）且能就地折行，不能是 `flex: 0 0 auto`（不收缩 ⇒ 挤走名字）；
 *  - 名字保留 `min-width: 0` 收缩底（超长模型名仍有断字兜底）。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = () => readFileSync(resolve(process.cwd(), 'src/core/styles.css'), 'utf8');

/** 取某选择器首个声明块体（跳过后代选择器/分组里的同前缀文本） */
const rule = (source: string, selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  expect(m, `规则 ${selector} 应存在`).not.toBeNull();
  return m![1];
};

describe('模型选择器行：长说明换行布局（core/styles.css）', () => {
  it('.bz-model-picker-row 允许换行（flex-wrap: wrap，长说明整段落第二行）', () => {
    expect(rule(css(), '.bz-model-picker-row')).toContain('flex-wrap: wrap');
  });

  it('.bz-model-picker-detail 可收缩 + 就地折行，且不再是不可收缩的 flex: 0 0 auto', () => {
    const block = rule(css(), '.bz-model-picker-detail');
    expect(block).toContain('flex: 0 1 auto');
    expect(block).toContain('min-width: 0');
    expect(block).toContain('overflow-wrap: anywhere');
    expect(block).not.toContain('flex: 0 0 auto');
  });

  it('.bz-model-picker-name 保留 min-width: 0（超长模型名断字兜底）', () => {
    expect(rule(css(), '.bz-model-picker-name')).toContain('min-width: 0');
  });
});
