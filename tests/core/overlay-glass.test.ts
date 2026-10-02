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
  it('非品牌域遮罩含 token blur（encrypt-lockscreen / review-quiz / password-vault×3）', () => {
    const cases: Array<[file: string, selector: string]> = [
      // 保险库解锁屏已收编为 core 共享组件（三域同源），遮罩随之落到 core 组件库
      ['src/core/ui/components.css', '.bz-lockscreen--mask'],
      // review stats/history / pomodoro / knowledge .bz-kb-mask / encrypt 体检遮罩已收编
      // .bz-overlay-mask 单源（issue 365），blur 随 core 组断言，域断言迁入下方收编组
      // .bz-vault-dlg-mask（密码添加/编辑弹窗遮罩）随 ADR-0158 密码视图退役，断言一并清退
      ['src/review/styles.css', '#quiz-mask'],
      // diary 写日记/标签选择器两遮罩已随一致#2 收编 core uiModal 壳（issue 365 同款）：
      // 遮罩底色/blur 归 .bz-overlay-mask 单源（core 组断言覆盖），diary 域手绘 mask 退役；
      // 书页界面的拟物浮层（纸条/贴纸册/台历/抽出的纸）走**有意例外**，见下方 diary 组
      ['src/password-vault/styles.css', '.bz-password-vault-mobpage'],
      ['src/password-vault/styles.css', '.bz-password-vault-modal'],
      ['src/password-vault/styles.css', '.bz-password-vault-pop2'],
    ];
    for (const [file, sel] of cases) {
      expect(rule(repo(file), sel), `${file} ${sel} 缺 token 毛玻璃`).toContain(BLUR);
    }
  });

  it('diary 拟物浮层不掺 token 遮罩（ADR-0230 有意例外；回忆墙那张日期筛选遮罩已随墙退役）', () => {
    const css = repo('src/diary/styles.css');
    // ADR-0230 决策 7：回忆墙整域退役，旧日期筛选遮罩（曾收编 .bz-diary-datefilter）随之消失
    expect(css).not.toContain('.bz-diary-datefilter');
    // 书桌上那几层纸（纸条 / 贴纸册 / 台历 / 抽出的纸）的压暗底是**拟物材料**：
    // 域根自己就是一块固定的深色桌面，遮罩压的是桌面而不是宿主内容，
    // 「底色随主题自适应」在这里没有可观察差别（ADR-0230 样式头注的有意例外）。
    // 口径：半点不掺——既不挂 .bz-overlay-mask，也不带 backdrop-filter，
    // 防「只抄底不抄 blur」的中间态。
    // 火漆密码框（.bz-diary-pass）同理：也是域内自绘的拟物纸层，不是 token 遮罩
    for (const sel of ['.bz-diary-slip', '.bz-diary-album-pop', '.bz-diary-cal-pop', '.bz-diary-sheet', '.bz-diary-pass']) {
      const body = rule(css, sel);
      expect(body, `${sel} 应保留域内拟物压暗底`).toMatch(/background: rgba\(20, 12, 5/);
      expect(body, `${sel} 不应掺 token 遮罩`).not.toContain('backdrop-filter');
      expect(body, `${sel} 不应掺 token 遮罩`).not.toContain('--bz-overlay');
    }
  });

  it('品牌底色遮罩保留域底色只加 blur（secondbrain / settings-panel）', () => {
    // favorites 表单遮罩已随壳收编 core uiModal（issue 365 第 5 项）：
    // 遮罩底色/blur 归 .bz-overlay-mask 单源（core 组断言覆盖），暖纸底留在 popup 卡皮
    const sb = rule(repo('src/secondbrain/styles.css'), '.bz-sb-panel-mask');
    expect(sb).toContain(BLUR);
    expect(sb, 'secondbrain 暖褐底色应保留').toContain('background: #2a261e4d');

    // 路径选择弹窗（core openPathPicker + .bz-sp-skin 面板皮肤；ADR-0127）
    const sp = rule(repo('src/settings-panel/styles.css'), '.bz-sp-skin.bz-overlay-mask');
    expect(sp).toContain(BLUR);
    expect(sp, 'settings-panel 暖黑亮态底色应保留').toContain('background: rgba(20, 15, 8, 0.4)');
  });
});

describe('遮罩三件套收编 .bz-overlay-mask 单源（issue 365）', () => {
  /** TS 挂类锚点：域遮罩底色/blur 归 core 单源，blur 由上方 core 组断言守卫 */
  const TS_ANCHORS: Array<[file: string, anchor: string]> = [
    ['src/review/stats-ui.ts', "statsMask.className = 'bz-overlay-mask'"],
    ['src/review/stats-ui.ts', "histMask.className = 'bz-overlay-mask'"],
    ['src/pomodoro/ui.ts', "mask.className = 'bz-overlay-mask'"],
    ['src/encrypt/ui.ts', "'bz-overlay-mask bz-encrypt-health-mask'"],
    ['src/knowledge/mount-canvas.ts', "'bz-overlay-mask bz-kb-mask bz-kb-mt-mask'"],
  ];

  it('五处域遮罩 TS 挂 core 单源类', () => {
    for (const [file, anchor] of TS_ANCHORS) {
      expect(repo(file).includes(anchor), `${file} 缺挂类锚点 ${anchor}`).toBe(true);
    }
  });

  it('域 CSS 不再重复声明遮罩底/blur（防回潮）', () => {
    // review×2 / knowledge .bz-kb-mask：三件套规则整条退役（选择器应不存在）
    for (const sel of ['#review-stats-mask', '#review-history-mask']) {
      expect(repo('src/review/styles.css').includes(sel + ' {'), `${sel} 三件套应已退役`).toBe(false);
    }
    expect(repo('src/knowledge/styles.css').includes('.bz-kb-mask {'), '.bz-kb-mask 三件套应已退役').toBe(false);
    // pomodoro / encrypt 体检遮罩：域块仅剩 padding 覆写，不得回潮底色/blur
    expect(rule(repo('src/pomodoro/styles.css'), '#pomodoro-mask.bz-overlay-mask')).toEqual(
      expect.not.stringContaining('backdrop-filter')
    );
    const health = rule(repo('src/encrypt/styles.css'), '.bz-encrypt-health-mask.bz-overlay-mask');
    expect(health).not.toContain('backdrop-filter');
    expect(health).not.toContain('background');
  });
});
