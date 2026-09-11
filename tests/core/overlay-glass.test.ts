// @vitest-environment node
/**
 * memo item-1789106289860：全仓遮罩统一毛玻璃（明暗自适应）回归守卫。
 * jsdom 不解析 CSS 文件，样式断言读源文本（先例 tests/memo/skin-dark.test.ts、
 * tests/cinema/mobile-3fix-guard.test.ts）：
 *  1) tokens.css 单源：:root 定义 --bz-overlay-blur（明暗同值，结构令牌层），
 *     .theme-dark / .theme-light 各有 --bz-overlay（遮罩底色随主题）；
 *  2) components.css 三共享遮罩（.bz-panel-overlay / .bz-overlay-mask / .bz-sheet-mask）
 *     声明块含 backdrop-filter: blur(var(--bz-overlay-blur))
 *     （仓内先例 diary/password-vault/smartcat 均无 -webkit- 前缀，不引入）；
 *  3) core/styles.css 两处旧硬编码遮罩（#__shared_confirm_mask__ / .bz-item-sheet-mask）
 *     底色统一 var(--bz-overlay) + 同款 blur；
 *  4) 域遮罩 blur 全量在位：非品牌域统一 token blur（品牌底色域 favorites/
 *     secondbrain/settings-panel 保留域底色只加 blur）。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

const BLUR = 'backdrop-filter: blur(var(--bz-overlay-blur))';

/** 取某选择器首个声明块体：要求选择器后直接跟 `{`（跳过逗号分组/后代选择器里的同前缀文本） */
const rule = (css: string, selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  expect(m, `规则 ${selector} 应存在`).not.toBeNull();
  return m![1];
};

describe('遮罩毛玻璃单源 token（tokens.css）', () => {
  const tokens = () => repo('src/core/ui/tokens.css');

  it(':root 定义 --bz-overlay-blur: 8px（明暗同值，结构令牌层）', () => {
    const root = tokens().match(/:root\s*\{([^}]*)\}/);
    expect(root, '缺 :root 结构令牌块').not.toBeNull();
    expect(root![1]).toContain('--bz-overlay-blur: 8px');
  });

  it('.theme-dark / .theme-light 各有 --bz-overlay（底色随明暗自适应）', () => {
    for (const theme of ['.theme-dark', '.theme-light']) {
      const block = tokens().match(new RegExp(`${theme.replace('.', '\\.')}\\s*\\{([^}]*)\\}`));
      expect(block, `缺 ${theme} 色彩令牌块`).not.toBeNull();
      expect(block![1]).toContain('--bz-overlay:');
    }
  });
});

describe('core 共享遮罩三件（components.css）', () => {
  const css = () => repo('src/core/ui/components.css');

  it.each(['.bz-panel-overlay', '.bz-overlay-mask', '.bz-sheet-mask'] as const)(
    '%s 声明块含 backdrop-filter: blur(var(--bz-overlay-blur))',
    (sel) => {
      expect(rule(css(), sel), `${sel} 缺 token 毛玻璃`).toContain(BLUR);
    }
  );
});

describe('core 旧硬编码遮罩两处（core/styles.css）', () => {
  const css = () => repo('src/core/styles.css');

  it.each(['#__shared_confirm_mask__', '.bz-item-sheet-mask'] as const)(
    '%s 底色统一 var(--bz-overlay) + 同款 blur（硬编码 rgba 退役）',
    (sel) => {
      const body = rule(css(), sel);
      expect(body).toContain('background: var(--bz-overlay)');
      expect(body).toContain(BLUR);
      expect(body, '硬编码黑底应退役').not.toMatch(/background:\s*rgba\(0,\s*0,\s*0/);
    }
  );
});

describe('域遮罩 blur 全量在位', () => {
  it('非品牌域遮罩含 token blur（encrypt×3 / knowledge / review×3 / pomodoro / diary×2 / password-vault×3）', () => {
    const cases: Array<[file: string, selector: string]> = [
      ['src/encrypt/styles.css', '.bz-encrypt-dialog-mask'],
      ['src/encrypt/styles.css', '.bz-encrypt-health-mask'],
      ['src/encrypt/styles.css', '.bz-vault-dlg-mask'],
      ['src/knowledge/styles.css', '.bz-kb-mask'],
      ['src/review/styles.css', '#review-stats-mask'],
      ['src/review/styles.css', '#review-history-mask'],
      ['src/review/styles.css', '#quiz-mask'],
      ['src/pomodoro/styles.css', '#pomodoro-mask'],
      ['src/diary/styles.css', '#add-diary-mask'],
      ['src/diary/styles.css', '#diary-tag-selector-mask'],
      ['src/password-vault/styles.css', '.bz-password-vault-mobpage'],
      ['src/password-vault/styles.css', '.bz-password-vault-modal'],
      ['src/password-vault/styles.css', '.bz-password-vault-pop2'],
    ];
    for (const [file, sel] of cases) {
      expect(rule(repo(file), sel), `${file} ${sel} 缺 token 毛玻璃`).toContain(BLUR);
    }
  });

  it('品牌底色遮罩保留域底色只加 blur（favorites / secondbrain / settings-panel）', () => {
    const fav = rule(repo('src/favorites/styles.css'), '.bz-fav-form-mask');
    expect(fav).toContain(BLUR);
    expect(fav, 'favorites 暖纸 --mask 底色应保留').toContain('background: var(--mask)');

    const sb = rule(repo('src/secondbrain/styles.css'), '.bz-sb-panel-mask');
    expect(sb).toContain(BLUR);
    expect(sb, 'secondbrain 暖褐底色应保留').toContain('background: #2a261e4d');

    const sp = rule(repo('src/settings-panel/styles.css'), '.bz-sp-picker-mask');
    expect(sp).toContain(BLUR);
    expect(sp, 'settings-panel 暖黑亮态底色应保留').toContain('background: rgba(20, 15, 8, 0.4)');
  });
});
