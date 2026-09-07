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
const coreUiCss = () => repo('src/core/ui/components.css');
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

  it('封面书评浮层随网格退役（issue 218 书脊墙：书评在借书卡 .bz-bs-d-quote），笔记挂载点保持 .bz-bs-hl-quote', () => {
    const css = bsCss();
    // 封面浮层与进度条 :has 挂钩一并退役
    expect(rule(css, '.bz-bs-quote')).toBeNull();
    expect(css).not.toContain('.bz-bs-cover-wrap:has(.bz-bs-quote)');
    // 借书卡书评 = .bz-bs-d-quote（可读多行，非浮层）
    expect(rule(css, '.bz-bs-d-quote')).not.toBeNull();
    // 挂载点：ui.ts 不再渲染封面浮层；笔记两处（md + epub）保持 .bz-bs-hl-quote
    const ui = repo('src/bookshelf/shared.ts'); // ADR-0105：借书卡=跨布局共享层
    expect(ui).not.toContain('class="bz-bs-quote"');
    expect(ui).toContain('bz-bs-d-quote');
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

describe('批 C-2/C-3（issue 223 只读化后口径更新）', () => {
  it('详情卡只读：状态徽标改为台账圆点示意（不再有 chip/编辑控件/删除保存入口）', () => {
    const ui = repo('src/bookshelf/shared.ts'); // ADR-0105：借书卡=跨布局共享层
    expect(ui).toMatch(/bz-bs-d-stdot/);
    expect(ui).not.toContain('bz-chip--tint');
    expect(ui).not.toContain('bz-chip--locked');
    expect(ui).not.toContain('bz-bs-d-openlink');
    expect(ui).not.toContain('bz-btn--danger-ghost');
    expect(ui).not.toContain('persistBook');
    expect(ui).not.toContain('rollbackBook');
    const css = bsCss();
    expect(css).not.toContain('.bz-bs-d-openlink');
    expect(css).not.toContain('.bz-bs-d-review');
    expect(css).not.toContain('.bz-bs-d-actions');
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

  it('挂载点在书脊墙布局层（ADR-0105：面板骨架=布局差异层）', () => {
    const ui = repo('src/bookshelf/layouts/wall/render.ts');
    for (const sel of ['bz-rr-head', 'bz-rr-title', 'bz-rr-close', 'bz-rr-content']) {
      expect(ui).toContain(sel);
    }
  });
});

describe('批 C-5：bookshelf 面板 44px 补接 .bz-panel-mtop', () => {
  it('面板根节点挂类；书脊墙体系在位（issue 218 换血：头行退役，墙变量/书脊/借书卡落域样式）', () => {
    const ui = repo('src/bookshelf/layouts/wall/render.ts');
    // ADR-0094：面板壳接入共享 .bz-panel-frame（域内只留宽高）；issue 216 皮肤类尾随插入
    expect(ui).toMatch(/class="bz-panel-frame bz-bs-panel bz-panel-mtop( \$\{esc\(skinClass\)\}| \$\{bsSkinClass\(\)\})?"/);
    const css = bsCss();
    // issue 218：旧头行/网格退役（.bz-panel-head 规则不再存在），书脊墙体系落位
    expect(css).not.toMatch(/\.bz-bs-panel \.bz-panel-head\s*\{/);
    expect(css).toMatch(/\.bz-bs-spine\s*\{/);
    expect(css).toMatch(/\.bz-bs-d-card\s*\{/);
    expect(css).toMatch(/--bsw-wall:/);
  });
});

// ═══════════ todo（项 6；ADR-0094 头行/壳接组件库后复检） ═══════════

describe('批 C-6：todo 头行类名拆雷', () => {
  it('头行接共享 .bz-panel-head（新体系），不撞 core 对 .bz-todo-head 的 !important 旧规范', () => {
    const ui = repo('src/todo/ui.ts');
    expect(ui).toContain('class="bz-panel-head"');
    const css = repo('src/todo/styles.css');
    expect(css).not.toMatch(/\.bz-todo-panel-head\s*\{/); // 域内头行规则退役（共享类接管）
    expect(css).not.toMatch(/\.bz-todo-head\s*\{/); // 旧类名规则退役
    // core 旧规范（.bz-todo-head 选择器组）随 memo 域退役（ADR-0092）失去服务对象，仅历史样式残留
  });

  it('面板根节点挂 .bz-panel-mtop；移动头行自垫 safe-area 收拢', () => {
    expect(repo('src/todo/ui.ts')).toMatch(/class="bz-panel-frame bz-todo-panel bz-panel-mtop"/);
    const css = repo('src/todo/styles.css');
    expect(css).not.toMatch(/\.bz-todo-head\s*\{[^}]*safe-area-inset-top/);
    expect(css).not.toMatch(/safe-area-inset-top\)\);?\s*\}/);
  });
});

// ═══════════ cinema（项 7-9） ═══════════

describe('批 C-7：移动端主头行添加钮触控抬档', () => {
  it('cinema 主头行添加钮 = 域内 .d-head .add（ADR-0103 风格化：共享 .bz-btn--md 条款随骨架退役）', () => {
    const css = cineCss();
    const ui = repo('src/cinema/layouts/midnight/render.ts'); // ADR-0104 markup 单源：d-head 添加钮在午夜场布局层
    expect(ui).toMatch(/class="add j-add"/); // 原型 d-head 添加钮（逐字同构）
    expect(css).toMatch(/\.bz-cinema--midnight \.d-head \.add\s*\{/); // 域内样式承载
  });
});

describe('批 C-8：cinema 触控热区收编 .bz-touch-target', () => {
  it('域内 pointer:coarse ::after 外扩块撤除；风格化后不再挂共享 .bz-touch-target（ADR-0103 域内自绘）', () => {
    expect(cineCss()).not.toMatch(/@media \(pointer: coarse\)/);
    const ui = repo('src/cinema/layouts/midnight/render.ts'); // ADR-0104 markup 单源：m-head 工具钮在午夜场布局层
    expect(ui).toContain('m-tool j-mgear'); // 原型 m-head 工具钮（逐字同构）
    expect(ui).not.toMatch(/bz-touch-target/);
  });
});

describe('批 C-9：分析页排印归档', () => {
  it('rem 散档守护：analysis 渲染无 .68~.95rem 残留（ADR-0103 后排印走原型 px 口径，token 断言退役）', () => {
    const ts = repo('src/cinema/analysis.ts');
    expect(ts).not.toMatch(/font-size:\.(6[89]|7[0-9]|8[0-9]|9[0-5])rem/);
    expect(ts).toContain('stat-cards'); // 原型分析页语言在位
  });

  it('cinema 旧骨架间距条款退役（ADR-0103：原型 1:1 允许原型同款内联样式，共享弹窗仍走域内类）', () => {
    const ui = repo('src/cinema/shared.ts'); // ADR-0104 markup 单源：共享确认框在纯层 shared
    const css = cineCss();
    expect(ui).toContain('cn-modal cn-confirm'); // 确认框域内类在位
    expect(css).toMatch(/\.bz-cinema--midnight \.cn-confirm/); // 共享弹窗样式 scoped 午夜场锚
    expect(css).toMatch(/\.bz-cinema--midnight \.cn-toast/); // 面板 toast 同上
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
  it('三处 rgba 手写透明底改 color-mix(var 语义色)（ADR-0094：rail 图标 accent 档收编组件库）', () => {
    const css = clipCss();
    // rail 图标底座 accent 档已收编组件库（.bz-rail-item 形制接入后域内规则退役）
    expect(coreUiCss()).toMatch(/\.bz-rail-ic--accent\s*\{[^}]*background: color-mix\(in srgb, var\(--bz-info\) 14%, transparent\)/);
    expect(css).toMatch(/\.bz-clip-art-flag\.info\s*\{[^}]*color-mix\(in srgb, var\(--bz-info\) 13%, transparent\)/);
    expect(css).toMatch(/\.bz-clip-art-flag\.warn\s*\{[^}]*color-mix\(in srgb, var\(--bz-warning\) 13%, transparent\)/);
    expect(css).toMatch(/\.bz-clip-art-flag\.ok\s*\{[^}]*color-mix\(in srgb, var\(--bz-success\) 12%, transparent\)/);
    expect(css).toMatch(/\.bz-clip-mob-save\.saved\s*\{[^}]*color-mix\(in srgb, var\(--bz-success\) 16%, transparent\)/);
    expect(css).not.toMatch(/rgba\(88,166,255|rgba\(217,161,60|rgba\(63,185,106/);
  });

  it('.bili 徽标紫单一事实源收敛到样式侧（ui 不再内联传 #8b7cf6；ADR-0094 起 tint 变量注入 .bz-rail-badge）', () => {
    expect(clipCss()).toMatch(/\.bz-clip-rail \.bz-rail-badge\.bili\s*\{\s*--bz-rail-tint: #8b7cf6;\s*\}/);
    const ui = repo('src/clipbook/render.ts'); // issue 247 markup 单源 render.ts（挂载点 markup 迁纯层）
    expect(ui).not.toMatch(/'bili', '#8b7cf6'/);
    expect(ui).toMatch(/bz-rail-badge bili">\$/); // 挂载点不再带内联 tint
  });
});

describe('批 C-12：clipbook 左栏选中态对齐五域实底档（ADR-0094 收编 .bz-rail 族后由组件库承担）', () => {
  it('.on 品牌实底 + on-brand 字 + medium 字重；行内次级文字随 on-brand；域内不再复制规则', () => {
    const shared = coreUiCss();
    expect(shared).toMatch(/\.bz-rail-item\.on\s*\{\s*background: var\(--bz-brand\);\s*color: var\(--bz-on-brand\);\s*font-weight: var\(--bz-weight-medium\);\s*\}/);
    expect(shared).toMatch(/\.bz-rail-item\.on \.bz-rail-count\s*\{\s*color: inherit;\s*opacity: 0\.72;\s*\}/);
    expect(shared).not.toMatch(/\.bz-rail-item\.on\s*\{[^}]*brand-soft/);
    // 域内旧 .bz-clip-rail-* 形制整族退役（改挂共享类）
    expect(clipCss()).not.toMatch(/bz-clip-rail-row|bz-clip-rail-count|bz-clip-rail-unread/);
  });
});

describe('批 C-13：clipbook 阅读右栏间距归档', () => {
  it('阅读滚动容器内边距归档（issue 214 编辑部风：28/44/40，对齐 p1-final 原型）', () => {
    const css = clipCss();
    expect(css).toMatch(/\.bz-clip-read-scroll\s*\{[^}]*padding: 28px 44px 40px;/);
    expect(css).not.toMatch(/\.bz-clip-read-scroll\s*\{[^}]*30px/);
  });
});

describe('批 C-14：clipbook rail 徽标白字对比（底色加深一档；ADR-0094 收编组件库）', () => {
  it('徽标底色经 color-mix 混黑加深（--bz-rail-tint 70% + 30% 黑）', () => {
    expect(coreUiCss()).toMatch(/\.bz-rail-badge\s*\{[^}]*background: color-mix\(in srgb, var\(--bz-rail-tint, var\(--bz-info\)\) 70%, #000\);/);
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
    // issue 198 批 D token 化：主题描边档收编 --bz-border（语义不变，仍非 rgba 白底）
    expect(spinner![1]).toContain('border: 3px solid var(--bz-border);');
    expect(spinner![1]).not.toMatch(/rgba\(255/);
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
