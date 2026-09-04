/**
 * 全域走查修复批 C（布局与样式，20 项小修）回归测试。
 * 覆盖走查报告 walkthrough-ui-2026-09-05「布局与结构」8 条 +「样式细节」12 条。
 * 样式断言读源文件文本（jsdom 不解析 css 文件；先例 review-fix-b.test.ts / enh-sweep-c.test.ts）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const bsCss = () => repo('src/bookshelf/styles.css');
const clipCss = () => repo('src/clipbook/styles.css');
const cineCss = () => repo('src/cinema/styles.css');
const rule = (css: string, sel: string) =>
  css.match(new RegExp(`${sel.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*\\{([^}]*)\\}`));

// ═══════════ bookshelf（项 1-5） ═══════════

describe('批 C-1：.bz-bs-quote 双定义拆雷（笔记侧改名 .bz-bs-hl-quote）', () => {
  it('笔记引文独立类名：规则不再绝对定位/不再单行截断（引文可读）', () => {
    const css = bsCss();
    const quote = rule(css, '.bz-bs-hl-quote');
    expect(quote, '缺 .bz-bs-hl-quote 规则').not.toBeNull();
    expect(quote![1]).not.toMatch(/position:\s*absolute/);
    expect(quote![1]).not.toMatch(/white-space:\s*nowrap/);
    expect(quote![1]).not.toMatch(/text-overflow/);
    expect(quote![1]).not.toMatch(/linear-gradient/);
  });

  it('封面书评浮层 .bz-bs-quote 独立生效（保留绝对定位浮层形制），笔记挂载点全部改名', () => {
    const css = bsCss();
    const cover = rule(css, '.bz-bs-quote');
    expect(cover, '封面浮层规则丢失').not.toBeNull();
    expect(cover![1]).toMatch(/position:\s*absolute/);
    // 封面进度条 :has 挂钩仍指向封面浮层类
    expect(css).toContain('.bz-bs-cover-wrap:has(.bz-bs-quote) .bz-bs-prog');
    // 挂载点：仅封面书评（ui.ts 渲染书评浮层）用 .bz-bs-quote；笔记两处（md + epub）改 .bz-bs-hl-quote
    const ui = repo('src/bookshelf/ui.ts');
    expect(ui).toContain('class="bz-bs-quote"');
    const notesUi = repo('src/bookshelf/notes-ui.ts');
    expect(notesUi.match(/bz-bs-hl-quote/g)?.length).toBe(2);
    expect(notesUi).not.toMatch(/className = 'bz-bs-quote'/);
  });

  it('笔记弹窗引文挂载点断言同步（notes-ui.test.ts 选择器已改名）', () => {
    const t = repo('tests/bookshelf/notes-ui.test.ts');
    expect(t).toContain(".bz-bs-hl-quote");
    expect(t).not.toContain("'.bz-bs-quote'");
  });
});

describe('批 C-2：详情弹窗状态徽标改 .bz-chip--tint（状态色恢复）', () => {
  it('ui.ts 徽标经 tint 变量注入状态色（影院先例），不再挂 --locked + 内联配色', () => {
    const ui = repo('src/bookshelf/ui.ts');
    expect(ui).toMatch(/bz-chip--tint" style="--bz-chip-tint:\$\{statusColor\(it\.status\)\};--bz-chip-tint-fg:var\(--bz-on-overlay\)"/);
    expect(ui).not.toContain('bz-chip--locked');
    expect(ui).not.toMatch(/bz-chip--locked/);
  });
});

describe('批 C-3：!important 压基线换类收尾', () => {
  it('笔记入口 chip 挂 .bz-chip--hover-accent（hover 品牌档），域内 !important hover 规则删除', () => {
    const ui = repo('src/bookshelf/ui.ts');
    expect(ui).toMatch(/bz-chip bz-chip--hover-accent bz-bs-d-notes/);
    const css = bsCss();
    expect(css).not.toContain('.bz-bs-d-notes:hover');
    expect(css).toMatch(/\.bz-bs-d-notes\s*\{\s*cursor: pointer;\s*\}/); // 仅剩指针钩子
  });

  it('删除钮挂 .bz-btn--danger-ghost，域内 .bz-bs-d-danger 配色规则删除', () => {
    const ui = repo('src/bookshelf/ui.ts');
    expect(ui).toMatch(/bz-btn--danger-ghost bz-bs-d-danger/);
    const css = bsCss();
    expect(css).not.toMatch(/\.bz-bs-d-danger\s*\{/);
    expect(css).not.toMatch(/\.bz-bs-d-danger:hover/);
  });
});

describe('批 C-4：报告头行样式归位 reading-report', () => {
  it('四条规则（head/title/close/content）+ 移动关闭钮显隐全部在本域文件', () => {
    const rr = repo('src/reading-report/styles.css');
    for (const sel of ['.bz-rr-head', '.bz-rr-title', '.bz-rr-close', '.bz-rr-content']) {
      expect(rule(rr, sel), `缺 ${sel}`).not.toBeNull();
    }
    expect(rr).toMatch(/@media \(max-width: 768px\)\s*\{\s*\.bz-rr-close\s*\{\s*display: inline-flex;/);
    // bookshelf 侧不再寄存
    const bs = bsCss();
    expect(bs).not.toMatch(/\.bz-rr-head/);
    expect(bs).not.toMatch(/\.bz-rr-title/);
    expect(bs).not.toMatch(/\.bz-rr-close/);
    expect(bs).not.toMatch(/\.bz-rr-content/);
  });

  it('挂载点仍在 bookshelf/ui.ts（视图容器归属不变）', () => {
    const ui = repo('src/bookshelf/ui.ts');
    for (const sel of ['bz-rr-head', 'bz-rr-title', 'bz-rr-close', 'bz-rr-content']) {
      expect(ui).toContain(sel);
    }
  });
});

describe('批 C-5：bookshelf 面板 44px 补接 .bz-panel-mtop', () => {
  it('面板根节点挂类；移动头行旧垫顶收拢（防双份顶距）', () => {
    const ui = repo('src/bookshelf/ui.ts');
    expect(ui).toMatch(/class="bz-bs-panel bz-panel-mtop"/);
    const css = bsCss();
    // 头行移动规则不再自垫 safe-area（.bz-panel-mtop > div:first-child 归零接管）
    expect(css).not.toMatch(/\.bz-bs-head\s*\{[^}]*safe-area-inset-top/);
    expect(css).toMatch(/@media \(max-width: 768px\)\s*\{[\s\S]*?\.bz-bs-head\s*\{\s*height: 46px;\s*\}/);
  });
});

// ═══════════ todo（项 6） ═══════════

describe('批 C-6：todo 头行类名拆雷', () => {
  it('头行改独有类 .bz-todo-panel-head，不再撞 core 对 .bz-todo-head 的 !important 旧规范', () => {
    const ui = repo('src/todo/ui.ts');
    expect(ui).toContain('class="bz-todo-panel-head"');
    const css = repo('src/todo/styles.css');
    expect(css).toMatch(/\.bz-todo-panel-head\s*\{[^}]*height: 44px;/);
    expect(css).not.toMatch(/\.bz-todo-head\s*\{/); // 旧类名规则退役
    // core 旧规范（.bz-todo-head 选择器组）随 memo 域退役（ADR-0092）失去服务对象，仅历史样式残留
  });

  it('面板根节点挂 .bz-panel-mtop；移动头行自垫 safe-area 收拢', () => {
    expect(repo('src/todo/ui.ts')).toMatch(/class="bz-todo-panel bz-panel-mtop"/);
    const css = repo('src/todo/styles.css');
    expect(css).not.toMatch(/\.bz-todo-head\s*\{[^}]*safe-area-inset-top/);
    expect(css).not.toMatch(/safe-area-inset-top\)\);?\s*\}/);
  });
});

// ═══════════ cinema（项 7-9） ═══════════

describe('批 C-7：移动端主头行添加钮触控抬档', () => {
  it('≤768px 添加钮抬 40px 档（--bz-control-h-lg），桌面维持 32px 控件档', () => {
    const css = cineCss();
    expect(css).toMatch(/\.bz-cinema-main-head \.bz-btn\s*\{\s*height: var\(--bz-control-h\);/); // 桌面 32px
    expect(css).toMatch(/@media \(max-width: 768px\)\s*\{[\s\S]*?\.bz-cinema-main-head \.bz-btn\s*\{\s*height: var\(--bz-control-h-lg\);/);
  });
});

describe('批 C-8：cinema 触控热区收编 .bz-touch-target', () => {
  it('域内 pointer:coarse ::after 外扩块撤除，三处可点小元素改挂共享类', () => {
    expect(cineCss()).not.toMatch(/@media \(pointer: coarse\)/);
    const ui = repo('src/cinema/ui.ts');
    expect(ui).toContain('bz-icon-btn bz-touch-target'); // 头行图标钮（iconBtnHTML）
    expect(ui).toMatch(/bz-touch-target bz-cinema-dm-douban/); // 详情豆瓣页外链
    expect(ui).toMatch(/bz-touch-target bz-cinema-rec-douban/); // 推荐卡豆瓣搜索
  });
});

describe('批 C-9：分析页排印归档', () => {
  it('rem 散档归并字号 token 四档，无 .68~.95rem 残留（图表大数字除外）', () => {
    const ts = repo('src/cinema/analysis.ts');
    expect(ts).not.toMatch(/font-size:\.(6[89]|7[0-9]|8[0-9]|9[0-5])rem/);
    for (const tok of ['var(--bz-font-caption)', 'var(--bz-font-meta)', 'var(--bz-font-label)', 'var(--bz-font-body)']) {
      expect(ts).toContain(tok);
    }
    expect(ts).toContain('1.35rem'); // 图表几何大数字保留
  });

  it('ui.ts 三处非几何间距内联迁入域 styles.css', () => {
    const ui = repo('src/cinema/ui.ts');
    expect(ui).not.toMatch(/bz-cinema-ai-start" data-cinema-ai-start style="margin-top/);
    expect(ui).not.toMatch(/bz-cinema-page-sub" style="margin-bottom/);
    expect(ui).not.toMatch(/bz-btn-row--center" style="margin-top/);
    const css = cineCss();
    expect(css).toMatch(/\.bz-cinema-ai-err ~ \.bz-cinema-ai-start\s*\{\s*margin-top: var\(--bz-space-lg\);/);
    expect(css).toMatch(/\.bz-cinema-ai-pref\s*\{\s*margin-bottom: var\(--bz-space-md\);/);
    expect(css).toMatch(/\.bz-cinema-confirm \.bz-btn-row\s*\{\s*margin-top: var\(--bz-space-lg\);/);
    // 挂载点：偏好行挂新类
    expect(ui).toContain('bz-cinema-page-sub bz-cinema-ai-pref');
  });
});

// ═══════════ review / clipbook / literature / encrypt / home / settings-panel / diary-wall（项 10-20） ═══════════

describe('批 C-10：review 评级条贴底安全区', () => {
  it('bottom 走 max(22px, safe-area)', () => {
    const css = repo('src/review/styles.css');
    expect(css).toMatch(/\.bz-review-bar\s*\{[^}]*bottom: max\(22px, env\(safe-area-inset-bottom, 0px\)\)/);
  });
});

describe('批 C-11：clipbook 死色收编 color-mix 语义变量', () => {
  it('三处 rgba 手写透明底改 color-mix(var 语义色)', () => {
    const css = clipCss();
    expect(css).toMatch(/\.bz-clip-rail-ic\.accent\s*\{[^}]*background: color-mix\(in srgb, var\(--bz-info\) 14%, transparent\)/);
    expect(css).toMatch(/\.bz-clip-art-flag\.info\s*\{[^}]*color-mix\(in srgb, var\(--bz-info\) 13%, transparent\)/);
    expect(css).toMatch(/\.bz-clip-art-flag\.warn\s*\{[^}]*color-mix\(in srgb, var\(--bz-warning\) 13%, transparent\)/);
    expect(css).toMatch(/\.bz-clip-art-flag\.ok\s*\{[^}]*color-mix\(in srgb, var\(--bz-success\) 12%, transparent\)/);
    expect(css).toMatch(/\.bz-clip-mob-save\.saved\s*\{[^}]*color-mix\(in srgb, var\(--bz-success\) 16%, transparent\)/);
    expect(css).not.toMatch(/rgba\(88,166,255|rgba\(217,161,60|rgba\(63,185,106/);
  });

  it('.bili 徽标紫单一事实源收敛到样式侧（ui 不再内联传 #8b7cf6）', () => {
    expect(clipCss()).toMatch(/\.bz-clip-rail-badge\.bili\s*\{\s*--rail-c: #8b7cf6;\s*\}/);
    const ui = repo('src/clipbook/ui.ts');
    expect(ui).not.toMatch(/'bili', '#8b7cf6'/);
    expect(ui).toMatch(/bz-clip-rail-badge bili">\$/); // 挂载点不再带内联 --rail-c
  });
});

describe('批 C-12：clipbook 左栏选中态对齐五域实底档', () => {
  it('.on 品牌实底 + on-brand 字 + medium 字重；行内次级文字随 on-brand', () => {
    const css = clipCss();
    expect(css).toMatch(/\.bz-clip-rail-row\.on\s*\{\s*background: var\(--bz-brand\);\s*color: var\(--bz-on-brand\);\s*font-weight: var\(--bz-weight-medium\);\s*\}/);
    expect(css).toMatch(/\.bz-clip-rail-row\.on \.bz-clip-rail-name\s*\{\s*color: inherit;\s*\}/);
    expect(css).toMatch(/\.bz-clip-rail-row\.on \.bz-clip-rail-count\s*\{\s*color: inherit;\s*opacity: 0\.72;\s*\}/);
    expect(css).not.toMatch(/\.bz-clip-rail-row\.on\s*\{[^}]*brand-soft/);
  });
});

describe('批 C-13：clipbook 阅读右栏间距归档', () => {
  it('30/60 非档位间距 → 24/32 档（space-xl/space-2xl）', () => {
    const css = clipCss();
    expect(css).toMatch(/\.bz-clip-read-scroll\s*\{[^}]*padding: var\(--bz-space-xl\) var\(--bz-space-xl\) var\(--bz-space-2xl\);/);
    expect(css).not.toMatch(/\.bz-clip-read-scroll\s*\{[^}]*30px/);
  });
});

describe('批 C-14：clipbook rail 徽标白字对比（底色加深一档）', () => {
  it('徽标底色经 color-mix 混黑加深（--rail-c 70% + 30% 黑）', () => {
    const css = clipCss();
    expect(css).toMatch(/\.bz-clip-rail-badge\s*\{[^}]*background: color-mix\(in srgb, var\(--rail-c, #58a6ff\) 70%, #000\);/);
  });
});

describe('批 C-15/16：literature 遮罩与 B站状态徽标', () => {
  it('遮罩去毛玻璃：纯 var(--background-modifier-cover)，无 backdrop-filter', () => {
    const css = repo('src/literature/styles.css');
    const mask = rule(css, '.bz-lit-mask');
    expect(mask, '缺 .bz-lit-mask 规则').not.toBeNull();
    expect(mask![1]).toContain('background: var(--background-modifier-cover)');
    expect(css).not.toMatch(/backdrop-filter/);
  });

  it('状态徽标 tint 底 + 深语义字（.bz-badge--* 模式），实底白字退役', () => {
    const css = repo('src/literature/styles.css');
    const status = rule(css, '.bz-bili-status');
    expect(status, '缺 .bz-bili-status 规则').not.toBeNull();
    expect(status![1]).not.toMatch(/color:\s*#fff/);
    expect(css).toMatch(/\.bz-bili-pending\s*\{[^}]*color: var\(--text-muted\)/);
    expect(css).toMatch(/\.bz-bili-processing\s*\{[^}]*color-mix\(in srgb, var\(--interactive-accent\) 16%, transparent\)[^}]*color: var\(--interactive-accent\)/);
    expect(css).toMatch(/\.bz-bili-success\s*\{[^}]*color-mix\(in srgb, var\(--color-green[^)]*\) 16%, transparent\)/);
    expect(css).toMatch(/\.bz-bili-failed\s*\{[^}]*color-mix\(in srgb, var\(--text-error[^)]*\) 16%, transparent\)/);
  });
});

describe('批 C-17：encrypt 预览 spinner 轨道', () => {
  it('轨道走主题描边档，亮色主题可见（仅 spinner 规则域；hero 按钮白字区不在本项范围）', () => {
    const css = repo('src/encrypt/styles.css');
    const spinner = rule(css, '.bz-encrypt-preview-spinner');
    expect(spinner, '缺 .bz-encrypt-preview-spinner 规则').not.toBeNull();
    expect(spinner![1]).toContain('border: 3px solid var(--background-modifier-border);');
    expect(spinner![1]).not.toMatch(/rgba\(255/);
  });
});

describe('批 C-18：home 搜索焦点环对齐组件库', () => {
  it('focus-within 环 2px（.bz-input:focus 同档）', () => {
    const css = repo('src/home/styles.css');
    expect(css).toMatch(/\.bz-home-search:focus-within\s*\{[^}]*box-shadow: 0 0 0 2px var\(--bz-brand-soft\);/);
  });
});

describe('批 C-19：settings-panel 移动列表项名归档', () => {
  it('14.5px 半像素 → var(--bz-font-body)', () => {
    const css = repo('src/settings-panel/styles.css');
    expect(css).toMatch(/\.bz-sp-mob-name\s*\{[^}]*font-size: var\(--bz-font-body\);/);
    expect(css).not.toContain('14.5px');
  });
});

describe('批 C-20：diary-wall 矮窗兜底', () => {
  it('桌面卡 max-height 压顶 + min-height 随视口收缩，矮窗不再溢出被裁', () => {
    const css = repo('src/diary-wall/styles.css');
    const desk = rule(css, '.bz-diary-wall-desk');
    expect(desk, '缺 .bz-diary-wall-desk 规则').not.toBeNull();
    expect(desk![1]).toContain('max-height: calc(100vh - 48px)');
    expect(desk![1]).toContain('min-height: min(640px, calc(100vh - 48px))');
  });
});
