// @vitest-environment node
/**
 * 自动摘要设置键单源收口回归（bd-fix-bd-checkup-attach，呈报批 A6 余款）：
 * - src/settings.ts 默认值五键、src/clipbook/ui.ts 设置 schema 五键绑定改引
 *   src/auto-summary/keys.ts AUTO_SUMMARY_KEYS 单源（键名唯一定义处）；
 * - 契约锁：常量 ↔ 默认值表逐键对齐（A6 arch 报告建议的元测试）+ 源码无键字面残留守卫
 *  （防回潮：字面量散布时改名漏改一处即静默回退默认值）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AUTO_SUMMARY_KEYS } from '../../src/auto-summary/keys';
import { DEFAULT_SETTINGS } from '../../src/settings';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('A6 自动摘要五键单源（keys.ts）', () => {
  it('常量 ↔ DEFAULT_SETTINGS 逐键对齐（键名与默认值双锁）', () => {
    const s = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
    expect(s[AUTO_SUMMARY_KEYS.enabled]).toBe(true);
    expect(s[AUTO_SUMMARY_KEYS.length]).toBe('standard');
    expect(s[AUTO_SUMMARY_KEYS.tagsEnabled]).toBe(true);
    expect(s[AUTO_SUMMARY_KEYS.tagCount]).toBe('3-6');
    expect(s[AUTO_SUMMARY_KEYS.timing]).toBe('immediate');
  });

  it('settings.ts 默认值区无键字面残留（改引常量后防回潮；接口类型声明行不在此列）', () => {
    const src = repo('src/settings.ts');
    expect(src).toContain('AUTO_SUMMARY_KEYS');
    // 只锁「字面量默认值」形态（autoSummaryEnabled: true / autoSummaryLength: '…'），
    // 接口块的类型声明（autoSummaryEnabled: boolean;）是 TS 键位非运行时字面，允许保留
    expect(src).not.toMatch(/^\s*autoSummary\w+: (?:true|false|'|")/m);
  });

  it('clipbook 设置 schema 绑定行无键字面残留（binding/visibleWhen 均引常量）', () => {
    const src = repo('src/clipbook/ui.ts');
    expect(src).toContain('AUTO_SUMMARY_KEYS');
    expect(src).not.toMatch(/key: 'autoSummary/);
    expect(src).not.toMatch(/s\.autoSummary/);
  });

  it('keys.ts 为零 import 叶子模块（settings/clipbook 反向引用不造环）', () => {
    const src = repo('src/auto-summary/keys.ts');
    expect(src).not.toMatch(/^import /m);
  });
});
