// @vitest-environment node
/**
 * 接缝跨文件契约守护（深审测试缺口 1/2 + RR-U1/EFF-1 可视性教训）：
 * 报告头行返回钮的 markup（宿主 layouts/wall/render.ts）与显隐规则（域 styles.css）分居
 * 两域文件，jsdom 不解析 CSS、程序化 click 穿透 display:none——「DOM 在而桌面不可见」
 * 只能用文本级跨文件断言守护。同时锁 data-rr-* 属性名的域↔宿主两侧一致（magic string
 * 漂移编译期查不到）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const wallRender = () => repo('src/bookshelf/layouts/wall/render.ts');
const bookshelfUi = () => repo('src/bookshelf/ui.ts');
const rrStyles = () => repo('src/reading-report/styles.css');
const rrIndex = () => repo('src/reading-report/index.ts');
const rrReport = () => repo('src/reading-report/report.ts');

describe('报告↔书架接缝（跨文件契约）', () => {
  it('RR-U1/EFF-1：返回钮 markup 在场（aria-label + 触控热区），桌面 CSS 不再 display:none', () => {
    // markup 侧（宿主 render.ts）：类 + 委托属性 + 可读名 + 热区
    const markup = wallRender();
    expect(markup).toContain('bz-rr-close');
    expect(markup).toContain('data-rr-goto-shelf');
    expect(markup).toContain('aria-label="返回书库"');
    expect(markup).toMatch(/bz-rr-close[^"]*bz-touch-target/);
    // CSS 侧（域 styles.css）：.bz-rr-close 规则不得 display:none（桌面/移动同一可见出口）
    const closeRule = rrStyles().match(/\.bz-rr-close[^{]*\{[^}]*\}/);
    expect(closeRule, '.bz-rr-close 应有恒可见规则').not.toBeNull();
    expect(closeRule![0]).not.toContain('display: none');
  });

  it('EFF-5：报告态隐藏宿主 chrome——域 CSS 状态规则 + 宿主结构选择器在场（防选择器漂移）', () => {
    // 宿主 markup 侧类名仍在（wallpage/labels/tools/view 容器）
    const markup = wallRender();
    for (const cls of ['bz-bs-wallpage', 'bz-bs-labels', 'bz-bs-tools', 'bz-bs-view-report']) {
      expect(markup, `宿主 markup 缺 ${cls}`).toContain(cls);
    }
    // 域 CSS 侧 :has 状态规则在场（style.test 已断言；此处锁「宿主类名 ↔ 域规则」对齐）
    const sheet = rrStyles();
    expect(sheet).toContain('.bz-bs-wallpage:has(.bz-bs-view-report.active) .bz-bs-tools');
    expect(sheet).toContain('.bz-bs-wallpage:has(.bz-bs-view-report.active) .bz-bs-labels');
  });

  it('接缝属性名单源：data-rr-* 的产生（域）与消费（宿主委托）字面量一致', () => {
    const domain = rrReport() + rrIndex();
    const host = bookshelfUi();
    // data-rr-goto-shelf/author/cat 由宿主委托消费；data-rr-year/hm-* 由域内 handleReportInteraction 消费
    for (const attr of ['data-rr-goto-shelf', 'data-rr-author', 'data-rr-cat']) {
      expect(domain, `域侧缺 ${attr}`).toContain(attr);
      expect(host, `宿主委托缺 ${attr}`).toContain(attr);
    }
    for (const attr of ['data-rr-year', 'data-rr-hm-prev', 'data-rr-hm-next']) {
      expect(domain, `域内委托缺 ${attr}`).toContain(attr);
    }
  });

  it('宿主委托消费 handleReportInteraction + 自动刷新传 silent（RR-A2 接线不断裂）', () => {
    const host = bookshelfUi();
    expect(host).toContain('handleReportInteraction');
    expect(host).toMatch(/startReportRender\(app,\s*\{\s*silent:\s*true\s*\}\)/);
  });
});
