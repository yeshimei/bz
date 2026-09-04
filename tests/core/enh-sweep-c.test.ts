/**
 * 全站收尾 C 包（enh-sweep-c：移动端与样式细节扫尾）回归测试。
 * 覆盖：
 *  1) 样式库 .bz-panel-mtop（≤768px 全屏面板顶距 44px 工具类）+ 可改域全屏面板根节点接线；
 *  2) 接入域头行不再自带 safe-area 垫顶（防双份避让）；
 *  3) 触控热区扫尾（pointer:coarse ::after 外扩 / padding 抬档）；
 *  4) 小字号扫尾（可改域 styles.css 无 9px/10px；.bz-clip-favchip.sm 8px 装饰性例外）；
 *  5) favorites/belongings 静态 z 档退役（topifyZ 动态发号，ADR-0067）；
 *  6) 杂项：review 遮罩去毛玻璃 / 滚动条隐藏 / 死选择器删除 / favorites 计数类名对齐；
 *  7) lucide 收尾：encrypt 状态栏·抽屉头、review 对错标记·排除钮去 emoji/文本符号。
 * 样式断言读源 styles.css 文本（jsdom 不解析 css 文件）；行为断言见 favorites/belongings/encrypt 域测试。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = (d: string) => readFileSync(resolve(process.cwd(), `src/${d}/styles.css`), 'utf8');
const src = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const componentsCss = () => readFileSync(resolve(process.cwd(), 'src/core/ui/components.css'), 'utf8');

/** 本包可改域（其余域在跑代理地盘，不纳入断言） */
const EDITABLE = ['diary-wall', 'home', 'cinema', 'clipbook', 'encrypt', 'favorites', 'belongings', 'pomodoro', 'review', 'attach'];

describe('enh-sweep-c：.bz-panel-mtop 移动全屏顶距', () => {
  it('样式库：≤768px 断点内 44px 顶距（max 安全区）+ 首子元素顶距归零', () => {
    const s = componentsCss();
    const m = s.match(/@media \(max-width: 768px\) \{[\s\S]*?\.bz-panel-mtop \{[^}]*\}/);
    expect(m).not.toBeNull();
    expect(m![0]).toContain('max(44px');
    expect(m![0]).toContain('!important');
    expect(s).toContain('.bz-panel-mtop > div:first-child');
  });

  it('全屏面板根节点接线：8 域挂载点 + 番茄钟随 mfs 开关同挂摘', () => {
    expect(src('src/home/ui.ts')).toContain('bz-home-panel bz-panel-mtop');
    expect(src('src/cinema/ui.ts')).toContain('bz-cinema-panel bz-panel-mtop');
    expect(src('src/favorites/ui.ts')).toContain('bz-fav-panel bz-panel-mtop');
    expect(src('src/belongings/ui.ts')).toContain('bz-bel-panel bz-panel-mtop');
    const clip = src('src/clipbook/ui.ts');
    expect(clip).toContain('bz-clip-frame bz-panel-mtop');
    expect(clip).toContain('bz-clip-mob-detail bz-panel-mtop'); // 移动详情屏2 overlay 自带避让
    expect(src('src/encrypt/ui.ts')).toContain("classList.add('bz-panel-mtop')");
    expect(src('src/review/ui.ts')).toContain("classList.add('bz-panel-mtop')");
    expect(src('src/diary-wall/ui.ts')).toContain("'bz-diary-wall-mob bz-panel-mtop'");
    expect(src('src/pomodoro/ui.ts')).toContain("classList.toggle('bz-panel-mtop'");
  });

  it('接入域头行不再自带 safe-area 垫顶（顶距由工具类统一接管，防双份）', () => {
    expect(css('favorites')).not.toMatch(/bz-fav-head \{[^}]*safe-area-inset-top/);
    expect(css('belongings')).not.toMatch(/bz-bel-head \{[^}]*safe-area-inset-top/);
    expect(css('cinema')).not.toMatch(/bz-cinema-head \{ padding-top: max\(12px/);
    expect(css('clipbook')).not.toMatch(/bz-clip-mob-top \{[^}]*safe-area-inset-top/);
    expect(css('clipbook')).not.toMatch(/bz-clip-mob-detail-top \{[^}]*safe-area-inset-top/);
    expect(css('diary-wall')).not.toMatch(/bz-diary-wall-mob \{[^}]*padding-top: max\(12px/);
    expect(css('diary-wall')).not.toMatch(/bz-diary-wall-mob \.bz-diary-wall-head \{[^}]*padding-top/);
    expect(css('home')).not.toMatch(/bz-home-hero \{[^}]*env\(safe-area-inset-top/);
  });
});

describe('enh-sweep-c：触控热区扫尾', () => {
  it('coarse 外扩档落位（修复批 B 收编 core .bz-touch-target：favorites/belongings/encrypt 等挂类，其余域留域内块）', () => {
    // 收编域：外扩本体在 core components.css，域内模板挂共享类（热区档位随类）
    expect(componentsCss()).toMatch(/\.bz-touch-target::after/);
    expect(src('src/favorites/ui.ts')).toContain('bz-touch-target');
    expect(src('src/belongings/ui.ts')).toContain('bz-touch-target');
    expect(src('src/encrypt/ui.ts')).toContain('bz-touch-target--xl');
    // 未收编域（cinema 域 ui 冻结 / attach 为 padding 抬档形态 / home·review·pomodoro 保留
    // padding·视觉抬档块）：域内仍持有 pointer:coarse 块
    for (const d of ['home', 'cinema', 'review', 'pomodoro', 'attach']) {
      expect(css(d), d).toMatch(/@media \(pointer: coarse\)/);
    }
    // 收编域不再复制 ::after 外扩（防双份外扩）
    for (const d of ['favorites', 'belongings', 'encrypt', 'diary-wall']) {
      expect(css(d), d).not.toMatch(/inset: -(6|8|12)px/);
    }
  });

  it('clipbook 移动详情返回钮 44px 档（原仅覆盖列表顶栏）', () => {
    expect(css('clipbook')).toMatch(/\.bz-clip-mob-detail-top \.bz-icon-btn--lg[^}]*44px/);
  });

  it('横滑标签 44px 档（cinema/favorites/belongings 移动 chips）', () => {
    expect(css('cinema')).toMatch(/bz-cinema-mob-chip \{[^}]*min-height: 44px/);
    expect(css('favorites')).toMatch(/bz-fav-mobchip \{[^}]*min-height: 44px/);
    expect(css('belongings')).toMatch(/bz-bel-mobchip \{[^}]*min-height: 44px/);
  });
});

describe('enh-sweep-c：小字号扫尾', () => {
  it('可改域 styles.css 无 9px/10px 字号（.bz-clip-favchip.sm 8px 装饰性例外）', () => {
    for (const d of EDITABLE) {
      const hits = [...css(d).matchAll(/font-size:\s*(9|10)px/g)].map((h) => `${d}: ${h[0]}`);
      expect(hits).toEqual([]);
    }
    expect(css('clipbook')).toContain('font-size: 8px'); // 14px 框 favicon 回退字 chip，装饰性
  });

  it('样式库计数同步抬档（.bz-chip-cnt 11px）', () => {
    expect(componentsCss()).toMatch(/\.bz-chip-cnt \{ margin-left: 2px; font-size: 11px;/);
  });
});

describe('enh-sweep-c：静态 z-index 退役（favorites/belongings）', () => {
  it('css 不再持有 100000/110000 静态档；ui.ts 显示时 topifyZ 发号', () => {
    for (const d of ['favorites', 'belongings']) {
      const s = css(d);
      expect(s).not.toContain('z-index: 100000');
      expect(s).not.toContain('110000');
      expect(src(`src/${d}/ui.ts`).match(/topifyZ\(overlay\)/)).not.toBeNull();
      expect(src(`src/${d}/ui.ts`).match(/topifyZ\(mask\)/)).not.toBeNull();
    }
  });
});

describe('enh-sweep-c：杂项打磨', () => {
  it('review：遮罩去毛玻璃 + 队列/冲刺滚动条隐藏 + 死规则清理', () => {
    const s = css('review');
    expect(s).not.toContain('backdrop-filter');
    expect(s).toMatch(/#review-entries-container, #review-entries-container \* \{ scrollbar-width: none/);
    expect(s).not.toMatch(/#review-entries-container::-webkit-scrollbar \{ width/); // overflow:hidden 容器上的死规则
    expect(s).not.toContain('#review-watch-folders'); // 监听文件夹 chip 渲染已退役
    expect(s).not.toContain('bz-review-watch-chip');
    expect(s).not.toContain('bz-sprint-block');
  });

  it('死选择器清理：diary-wall text--locked / encrypt 旧清单卡视图', () => {
    expect(css('diary-wall')).not.toContain('text--locked');
    expect(css('encrypt')).not.toMatch(/\.bz-encrypt-card\b/);
    expect(css('encrypt')).not.toMatch(/\.bz-encrypt-head\b/);
    expect(css('encrypt')).not.toMatch(/\.bz-encrypt-empty\b/);
  });

  it('favorites 计数类名对齐（ui 渲染 bz-fav-chip-cnt；旧 mobchip-cnt 为死选择器笔误）', () => {
    expect(css('favorites')).toContain('.bz-fav-chip-cnt');
    expect(css('favorites')).not.toContain('bz-fav-mobchip-cnt');
  });
});

describe('enh-sweep-c：lucide 收尾', () => {
  it('encrypt：状态栏与抽屉头锁图标换 lucide（新增 lock-open 路径）', () => {
    expect(src('src/encrypt/vault-assets-view.ts')).toContain("'lock-open'");
    expect(src('src/encrypt/index.ts')).not.toMatch(/🔒|🔓/);
    expect(src('src/encrypt/ui.ts')).not.toMatch(/🔒|🔓|🔐/);
  });

  it('review：对错标记与排除名单关闭钮去文本符号（lucide check/x）', () => {
    expect(src('src/review/sprint.ts')).toContain('data-lucide="check"');
    expect(src('src/review/sprint.ts')).toContain('data-lucide="x"');
    expect(src('src/review/sprint.ts')).not.toMatch(/bz-mark ok \$\{size\}">✓/);
    expect(src('src/review/settings-schema.ts')).toContain("setIcon(removeIc, 'x')");
    expect(src('src/review/settings-schema.ts')).not.toContain("textContent = '✕'");
  });
});
