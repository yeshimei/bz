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

  it('全屏面板根节点接线：各域挂载点（markup 单源）', () => {
    expect(src('src/home/layouts/river/render.ts')).toContain('bz-home-panel bz-panel-mtop'); // issue 243 markup 单源 render.ts
    expect(src('src/favorites/layouts/board/render.ts')).toContain('bz-fav-panel bz-fav-scope'); // issue 242 markup 单源 render.ts（bz-panel-mtop 随移动端挂载）
    expect(src('src/belongings/layouts/poster/render.ts')).toContain('bz-bel-panel bz-panel-frame bz-panel-mtop'); // issue 237 markup 单源 render.ts
    const clip = src('src/clipbook/render.ts'); // issue 247 markup 单源 render.ts
    expect(clip).toContain('bz-clip-frame bz-panel-mtop');
    expect(clip).toContain('bz-clip-mob-detail bz-panel-mtop'); // 移动详情屏2 overlay 自带避让
    expect(src('src/encrypt/ui.ts')).toContain("classList.add('bz-panel-mtop')");
    expect(src('src/review/ui.ts')).toContain("classList.add('bz-panel-mtop')");
    expect(src('src/diary-wall/ui.ts')).toContain("'bz-diary-wall-mob bz-panel-mtop'");
    // 番茄钟原「随 mfs 开关同挂摘」接线已随「移动端默认全屏」特性全链退役
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
    expect(src('src/favorites/layouts/board/render.ts')).toContain('bz-touch-target'); // issue 242 markup 单源 render.ts：移动 ✕ 关闭钮挂 44px 触控档
    expect(src('src/belongings/layouts/poster/render.ts')).toContain('bz-touch-target'); // issue 237 markup 单源 render.ts
    expect(src('src/encrypt/ui.ts')).toContain('bz-touch-target--xl');
    // 未收编域（attach 为 padding 抬档形态 / review·pomodoro 保留 padding·视觉抬档块；
    // cinema 走查批 C-8、home 活动河改版（issue 232）均收编/退役，不再持域内块）：域内仍持有 pointer:coarse 块
    for (const d of ['review', 'pomodoro', 'attach']) {
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

  it('横滑标签 44px 档（favorites issue 219b 磁贴行取代；cinema 午夜场走 1:1 探索稿 .m-chips 原生档、旧 .bz-cinema-panel 死段已随纯清理批退役；belongings 用户拍板缩小让位）', () => {
    expect(css('favorites')).toMatch(/pointer: coarse[\s\S]*bz-fav-tags button[^}]*min-height: 44px/);
    // belongings/cinema：均不持 44px 档（belongings 用户拍板；cinema 午夜场原型逐字档）
    expect(css('belongings')).not.toMatch(/bz-mobstrip-chip \{[^}]*min-height: 44px/);
    expect(css('cinema')).not.toMatch(/bz-mobstrip-chip \{[^}]*min-height: 44px/);
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

  it('favorites 磁贴计数=纯文本紧贴名后（issue 219c 口径延续；ADR-0101 无计数胶囊类）', () => {
    expect(css('favorites')).not.toContain('bz-fav-chip-cnt');
    expect(src('src/favorites/ui.ts')).not.toContain('bz-fav-chip-num');
    expect(src('src/favorites/layouts/board/render.ts')).not.toContain('bz-fav-chip-num'); // issue 242 markup 单源
    expect(src('src/favorites/layouts/board/render.ts')).toContain('data-fav-tag');
    expect(css('favorites')).not.toContain('bz-fav-mobchip-cnt');
  });

  it('favorites 磁贴选择器 >0,1,1 提级（issue 219f 口径延续：抗 reset button 0,1,1 基线）', () => {
    expect(css('favorites')).toContain('.bz-fav-scope .bz-fav-tags button {');
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
    // 排除名单已收敛为通用 list 行（.bz-setlist-remove 文本按钮）；无文本符号 ✕ 回潮
    expect(src('src/review/settings-schema.ts')).toContain("type: 'list'");
    expect(src('src/review/settings-schema.ts')).not.toContain("✕");
  });
});
