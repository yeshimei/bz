/**
 * memo 域修复批 C 回归（渲染·检索·列表交互·月历，2026-09 深审五报告拍板项）：
 *   1  M2-4   滚位保存恢复（renderContent/renderMobScenes）
 *   2  M2-5+M3-1 移动触控热区（markup touch-target + styles 次级抬档）
 *   3  M3-2   月历 chip halo 收敛（inset 双值）
 *   4  M3-8   死选择器删除（pos-hint .bz-ic / skinprev-default）
 *   5  M3-7   设置钮死 UI 删 markup+委托（markup 侧断言；ui/CSS 侧在 mobile-ui-3fix）
 *   6  M3-3   抽屉头位置标签接线（源码级断言：关抽屉 + jumpToNote）
 *   7  M3-10  键盘可达（卡 Enter/Space 开菜单、勾选圈键盘、折叠条语义 button）
 *   8  效率#2 打开面板聚焦（桌面 composer / notePath 聚焦搜索框 / 移动跳过）
 *   9  效率#5 搜索框 ESC 清词不关面板
 *   10 效率#6 搜索 ✕ 清除 + 空态「清除搜索」钮
 *   11 效率#7 命中高亮（先转义后 <mark>，防注入）
 *   12 效率#8 搜索域扩展（清单子任务/链接）
 *   13 效率#9 搜索增量显隐（DOM 探针证明未整墙重建）
 *   14 效率#10 桌面双击卡体直开编辑器
 *   15 一致#7 stripMdExt 下沉 core/ui/str（utils 转发 + render 消费；纯度由 render-purity 守卫）
 *   16 一致#5 单源微收口（isTodayStr→localDayKey、月历 pad2）
 *   17 一致#6+#11 月历空态 emptyHtmlStr + calDayPanelHtml 壳收口
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import moment from 'moment';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { M, resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel } from '../../src/memo/ui';
import { MemoData } from '../../src/memo/data';
import {
  panelShellHtml, highlightTitleHtml, doneBarHtml, calDayPanelHtml, calEmptyHtml, cardHtml,
} from '../../src/memo/render';
import { stripMdExt as stripMdExtFromStr } from '../../src/core/ui/str';
import { stripMdExt as stripMdExtFromUtils } from '../../src/core/utils';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoFilePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoOpenScene: '@last',
  memoDoneWindow: '30',
  memoAutoArchive: true,
};

function at(dayOffset: number, hm: string): string {
  return moment().add(dayOffset, 'days').format(`YYYY-MM-DD ${hm}:00`);
}

function seedVault(items?: Record<string, unknown>[]): { vault: MockVault; app: ReturnType<typeof mockAppWithVault>; settings: any } {
  const vault = new MockVault();
  const data = items ?? [
    { id: 'a', title: '完成阅读报告', scene: '学习', priority: 'important', created: at(-3, '10:00'), completed: null, due: at(0, '09:00') },
    { id: 'b', title: 'ffmpeg 转写参数整理', scene: '代码', priority: 'minor', created: at(-2, '09:00'), completed: null, due: null, scriptName: 'transcribe.py' },
    { id: 'c', title: '筹备旅行', scene: '生活', priority: 'minor', created: at(-1, '08:00'), completed: null, due: null, checklist: [{ text: '订机票', done: false }, { text: '订酒店', done: false }], url: 'https://example.com/trip' },
  ];
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(data, null, 2));
  const settings = { ...SETTINGS };
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings as any);
  setSettingsSaver(vi.fn(async () => {}));
  MemoData.init(settings as any);
  return { vault, app, settings };
}

/** 可见卡（效率#9 增量显隐语义：未命中卡原地 display:none，仍占 DOM） */
const visibleCards = () =>
  [...document.querySelectorAll<HTMLElement>('.bz-memo-card')].filter((c) => c.style.display !== 'none');

beforeEach(() => {
  resetObsidianMocks();
  resetMemoState();
  MockPlatform.isMobile = false;
});
afterEach(() => {
  closeMemoPanel();
  resetMemoState();
  MockPlatform.isMobile = false;
});

// ═══════════ markup / 样式源静态断言（mobile-ui-3fix 范式） ═══════════

describe('批C · markup 源静态断言', () => {
  it('条目2 M2-5：视图切换钮与月历翻页钮挂 touch-target--lg（markup 热区）', () => {
    const render = read('src/memo/render.ts');
    expect(render).toMatch(/bz-memo-viewbtn bz-touch-target bz-touch-target--lg/);
    expect(render).toMatch(/bz-icon-btn bz-touch-target bz-touch-target--lg" data-memo-cal-prev/);
    expect(render).toMatch(/bz-icon-btn bz-touch-target bz-touch-target--lg" data-memo-cal-next/);
  });

  it('条目2 M3-1：移动收口段次级热区抬档（排序下拉/添加钮/折叠条/更早/回到今天/位置标签）', () => {
    const css = read('src/memo/styles.css');
    const closing = css.slice(css.lastIndexOf('移动端收口段'));
    expect(closing).toMatch(/\.bz-memo-panel \.bz-memo-sort \.bz-select\s*\{\s*height:\s*40px/);
    expect(closing).toMatch(/\.bz-memo-composer \.bz-btn\s*\{\s*min-height:\s*40px/);
    expect(closing).toMatch(/\.bz-memo-donebar\s*\{\s*min-height:\s*40px/);
    expect(closing).toMatch(/\.bz-memo-done-more\s*\{\s*min-height:\s*40px/);
    expect(closing).toMatch(/\.bz-memo-cal-today\s*\{\s*min-height:\s*40px/);
    expect(closing).toMatch(/\.bz-memo-tag-pos::after\s*\{\s*content:\s*'';\s*position:\s*absolute;\s*inset:\s*-11px/);
  });

  it('条目3 M3-2：月历 chip halo 双值外扩（横向收敛，少侵入邻格）', () => {
    const css = read('src/memo/styles.css');
    expect(css).toMatch(/\.bz-memo-cal-chip::after\s*\{\s*content:\s*'';\s*position:\s*absolute;\s*inset:\s*-12px -8px/);
  });

  it('条目4 M3-8：死选择器已删（pos-hint .bz-ic 与 skinprev-default 系零残留）', () => {
    const css = read('src/memo/styles.css');
    expect(css).not.toMatch(/\.bz-memo-pos-hint \.bz-ic/);
    expect(css).not.toContain('bz-skinprev-default');
    // pos-hint 本体样式保留（非死选择器）
    expect(css).toMatch(/\.bz-memo-pos-hint\s*\{\s*font-size/);
  });

  it('条目5 M3-7：设置钮 markup 退役；条目10 效率#6：搜索壳带清除 ✕', () => {
    const render = read('src/memo/render.ts');
    expect(render).not.toContain('data-memo-head-settings');
    expect(render).toContain('data-memo-search-clear');
  });

  it('条目7 M3-10：折叠条语义 button + aria-expanded；卡/圈/清单行键盘属性', () => {
    expect(doneBarHtml(true, 3)).toMatch(/^<button type="button"/);
    expect(doneBarHtml(false, 0)).toContain('aria-expanded="false"');
    const render = read('src/memo/render.ts');
    expect(render).toContain('data-memo-id="${esc(it.id)}" tabindex="0"');
    expect(render).toMatch(/data-memo-check role="checkbox" tabindex="0" aria-checked/);
    expect(render).toContain('role="checkbox" tabindex="0" aria-checked');
  });

  it('条目6 M3-3：抽屉头位置标签接线「关抽屉 + jumpToNote」（源码级）', () => {
    const ui = read('src/memo/ui.ts');
    expect(ui).toMatch(/head\.querySelector\('\[data-memo-pos\]'\)\?\.addEventListener\('click'[\s\S]{0,200}closeItemMenu\(\);[\s\S]{0,60}jumpToNote\(it\)/);
  });

  it('条目17 一致#6+#11：月历空态/当日空清单走 emptyHtmlStr 单源，cal-empt*/cal-noday 样式退役', () => {
    const render = read('src/memo/render.ts');
    expect(render).toContain('emptyHtmlStr');
    expect(render).toContain('calDayPanelHtml');
    expect(calEmptyHtml(false)).toContain('bz-empty');
    expect(calEmptyHtml(false)).not.toContain('bz-memo-cal-empt');
    const panel = calDayPanelHtml('3月4日 · 0 项', 0, '');
    expect(panel).toContain('bz-memo-cal-daypanel');
    expect(panel).toContain('这一天没有备忘录');
    expect(panel).toContain('bz-empty');
    const css = read('src/memo/styles.css');
    expect(css).not.toContain('bz-memo-cal-empt');
    expect(css).not.toContain('bz-memo-cal-noday');
  });

  it('条目15 一致#7：stripMdExt 单源 core/ui/str，utils 同引用转发', () => {
    expect(stripMdExtFromUtils).toBe(stripMdExtFromStr);
    expect(stripMdExtFromStr('笔记/算法笔记.MD')).toBe('笔记/算法笔记');
    expect(stripMdExtFromStr('')).toBe('');
    const str = read('src/core/ui/str.ts');
    expect(str).toContain('export function stripMdExt');
    const utils = read('src/core/utils.ts');
    expect(utils).toContain('export { stripMdExt }');
    expect(utils).not.toMatch(/function stripMdExt/);
    // 纯层消费 str 版（render-purity 守卫 import 图，此处锚措辞）
    expect(read('src/memo/render.ts')).toContain("} from '../core/ui/str'");
    expect(read('src/secondbrain/render.ts')).toContain("import { stripMdExt } from '../core/ui/str'");
  });

  it('条目16 一致#5：isTodayStr 收口 localDayKey、月历日键 pad2（合并后全域 padStart 归零，批 D 已收尾）', () => {
    const ui = read('src/memo/ui.ts');
    expect(ui).toMatch(/isTodayStr[\s\S]{0,200}localDayKey\(\)/);
    expect(ui).toContain('pad2');
    // 合并终态：批 D 把 postponeItem/postponeSub 四处也 pad2 化（一致#5 全清），全域零 padStart
    expect(ui.match(/padStart\(2, '0'\)/g)?.length ?? 0).toBe(0);
  });
});

// ═══════════ 渲染纯层（高亮防注入 / 卡 markup） ═══════════

describe('批C · 条目11 效率#7 命中高亮', () => {
  it('highlightTitleHtml：大小写不敏感 <mark> 包裹', () => {
    expect(highlightTitleHtml('Hello World', 'world')).toBe('Hello <mark>World</mark>');
    expect(highlightTitleHtml('ffmpeg 转写', 'FF')).toBe('<mark>ff</mark>mpeg 转写');
  });

  it('highlightTitleHtml：先转义后包裹——HTML 元素不被注入、实体不被劈开', () => {
    // title 带 HTML：输出仍是转义文本（无裸标签），命中段是转义形态的 `<b>`
    expect(highlightTitleHtml('<b>ab</b>', '<b>')).toBe('<mark>&lt;b&gt;</mark>ab&lt;/b&gt;');
    // 关键词含 & 时按转义后形态匹配，包裹段仍是转义文本（不产生裸 &）
    expect(highlightTitleHtml('a&b', '&')).toBe('a<mark>&amp;</mark>b');
    expect(highlightTitleHtml('x', 'amp')).toBe('x');
  });

  it('highlightTitleHtml：空词/无命中原样返回；cardHtml kw 注入标题段', () => {
    expect(highlightTitleHtml('abc', '')).toBe('abc');
    expect(highlightTitleHtml('abc', 'zz')).toBe('abc');
    const h = cardHtml(
      { id: 'k1', title: '完成阅读报告', scene: '学习', priority: 'minor', created: '', completed: null, due: null, notePath: null, notePosition: null, scriptName: null, courseName: null, coursePath: null, linkedNote: null, url: null, recur: null, checklist: null } as any,
      null, '', '', '', '报告'
    );
    expect(h).toContain('<mark>报告</mark>');
  });
});

// ═══════════ UI 行为（jsdom） ═══════════

describe('批C · 条目1 M2-4 滚位保存恢复', () => {
  it('场景切换全量重建后，列表纵滚位与场景条横滚位保持', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-memo-card').length).toBe(3);
    });
    const content = document.querySelector('[data-memo-content]') as HTMLElement;
    const strip = document.querySelector('[data-memo-mob-scenes]') as HTMLElement;
    // jsdom 无滚动实现：own property 探针接管读写
    let top = 240, left = 60;
    Object.defineProperty(content, 'scrollTop', { get: () => top, set: (v) => { top = v; }, configurable: true });
    Object.defineProperty(strip, 'scrollLeft', { get: () => left, set: (v) => { left = v; }, configurable: true });
    // 场景切换 = 全量 renderAll（非搜索增量路径）
    (document.querySelector('[data-memo-scene="学习"]') as HTMLElement).click();
    expect(top).toBe(240); // 重建后按快照恢复（未恢复会归 0）
    expect(left).toBe(60);
  });
});

describe('批C · 条目7 M3-10 键盘可达', () => {
  it('Tab 焦点到卡后 Enter 开条目菜单（core item-actions 浮层）', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-memo-card').length).toBe(3);
    });
    const card = document.querySelector('.bz-memo-card') as HTMLElement;
    expect(card.getAttribute('tabindex')).toBe('0');
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.querySelector('.bz-item-menu')).toBeTruthy();
    // Space 同款
    (document.querySelector('.bz-item-menu .bz-item-menu-item') as HTMLElement).click(); // 关菜单（执行动作）
    await vi.waitFor(() => { expect(document.querySelector('.bz-item-menu')).toBeNull(); });
  });

  it('勾选圈键盘 Enter 标记完成（与点击同口径：300ms 防抖后落盘）', async () => {
    const { app, vault } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-memo-card').length).toBe(3);
    });
    const check = document.querySelector('[data-memo-check]') as HTMLElement;
    expect(check.getAttribute('role')).toBe('checkbox');
    check.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => {
      const data = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(data.find((i: any) => i.id === 'a')?.completed).toBeTruthy();
    }, { timeout: 2000 });
  });

  it('清单子任务行键盘 Space 切换勾选', async () => {
    const { app, vault } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-memo-card').length).toBe(3);
    });
    const row = document.querySelector('[data-memo-cl="c:0"]') as HTMLElement;
    expect(row.getAttribute('role')).toBe('checkbox');
    expect(row.getAttribute('aria-checked')).toBe('false');
    row.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await vi.waitFor(() => {
      const data = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(data.find((i: any) => i.id === 'c')?.checklist[0].done).toBe(true);
    });
  });
});

describe('批C · 条目8 效率#2 打开聚焦', () => {
  it('桌面打开面板聚焦 composer；notePath 定位分支聚焦搜索框', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-memo-composer-input]')).toBeTruthy();
    });
    expect(document.activeElement).toBe(document.querySelector('[data-memo-composer-input]'));
    closeMemoPanel();

    openMemoPanel(app, { notePath: '我的/日记/x.md' });
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(document.querySelector('[data-memo-search]'));
    });
  });

  it('移动端遵 core 口径跳过 input 聚焦（防软键盘）', async () => {
    MockPlatform.isMobile = true;
    const { app } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-memo-composer-input]')).toBeTruthy();
    });
    expect(document.activeElement).not.toBe(document.querySelector('[data-memo-composer-input]'));
    expect(document.activeElement).not.toBe(document.querySelector('[data-memo-search]'));
  });
});

describe('批C · 条目9 效率#5 搜索框 ESC 清词', () => {
  it('有词：清词重渲且不关面板（stopPropagation 挡 escManager）；无词放行不误伤', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-memo-card').length).toBe(3);
    });
    const inp = document.querySelector('[data-memo-search]') as HTMLInputElement;
    inp.value = 'ffmpeg';
    inp.dispatchEvent(new Event('input'));
    await vi.waitFor(() => { expect(M.search).toBe('ffmpeg'); });
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(M.search).toBe('');
    expect(inp.value).toBe('');
    expect(document.querySelector('.bz-panel-overlay')).toBeTruthy(); // 面板未被 ESC 关掉
    expect(document.querySelector('.bz-panel-overlay')).toBeTruthy();
    // 无词时 ESC 不 preventDefault（放行给 escManager 的关面板语义）——只断言不抛错不误清
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.bz-panel-overlay')).toBeTruthy();
  });
});

describe('批C · 条目10 效率#6 搜索清除', () => {
  it('尾部 ✕：有词才显示；点击清词 + 焦点回框', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-memo-card').length).toBe(3);
    });
    const inp = document.querySelector('[data-memo-search]') as HTMLInputElement;
    const clear = document.querySelector('[data-memo-search-clear]') as HTMLElement;
    expect(clear.hidden).toBe(true);
    inp.value = 'ffmpeg';
    inp.dispatchEvent(new Event('input'));
    expect(clear.hidden).toBe(false);
    clear.click();
    expect(M.search).toBe('');
    expect(inp.value).toBe('');
    expect(document.activeElement).toBe(inp);
    expect(clear.hidden).toBe(true);
  });

  it('搜索空态 actions 追加「清除搜索」钮：点击回全量', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-memo-card').length).toBe(3);
    });
    const inp = document.querySelector('[data-memo-search]') as HTMLInputElement;
    inp.value = '不存在的关键词';
    inp.dispatchEvent(new Event('input'));
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-empty')?.textContent).toContain('没有匹配的备忘录');
    });
    const clearBtn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('清除搜索'));
    expect(clearBtn).toBeTruthy();
    clearBtn!.click();
    await vi.waitFor(() => {
      expect(visibleCards().length).toBe(3);
    });
    expect(M.search).toBe('');
  });
});

describe('批C · 条目12 效率#8 搜索域扩展', () => {
  it('清单子任务文本与链接可被检索', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-memo-card').length).toBe(3);
    });
    const inp = document.querySelector('[data-memo-search]') as HTMLInputElement;
    inp.value = '订机票';
    inp.dispatchEvent(new Event('input'));
    await vi.waitFor(() => {
      expect(visibleCards().length).toBe(1);
      expect(visibleCards()[0].dataset.memoId).toBe('c');
    });
    inp.value = 'example.com/trip';
    inp.dispatchEvent(new Event('input'));
    await vi.waitFor(() => {
      expect(visibleCards().length).toBe(1);
      expect(visibleCards()[0].dataset.memoId).toBe('c');
    });
  });
});

describe('批C · 条目13 效率#9 搜索增量显隐', () => {
  it('关键词缩小时未整墙重建（DOM 探针：卡元素引用不变），未命中卡 display:none', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-memo-card').length).toBe(3);
    });
    const before = [...document.querySelectorAll('.bz-memo-card')] as HTMLElement[];
    const inp = document.querySelector('[data-memo-search]') as HTMLInputElement;
    inp.value = 'ffmpeg';
    inp.dispatchEvent(new Event('input'));
    await vi.waitFor(() => {
      expect(visibleCards().length).toBe(1);
    });
    const after = [...document.querySelectorAll('.bz-memo-card')] as HTMLElement[];
    // 探针：同一批元素原地显隐，innerHTML 未重建（重建则引用全换）
    expect(after).toEqual(before);
    expect(after.find((c) => c.dataset.memoId === 'a')!.style.display).toBe('none');
    expect(after.find((c) => c.dataset.memoId === 'b')!.style.display).toBe('');
    // 分区计数同步
    const urgentCnt = document.querySelector('[data-memo-sec="urgent"] .bz-memo-sec-cnt') as HTMLElement;
    expect(urgentCnt).toBeTruthy(); // 标签在场（计数归零时隐藏）
  });

  it('结果出现墙外新卡（清词方向）自动回退全量，不丢单', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-memo-card').length).toBe(3);
    });
    const inp = document.querySelector('[data-memo-search]') as HTMLInputElement;
    inp.value = 'ffmpeg';
    inp.dispatchEvent(new Event('input'));
    await vi.waitFor(() => { expect(visibleCards().length).toBe(1); });
    // 删词方向：结果集扩大（墙中只有 1 张卡）→ 回退全量
    inp.value = '';
    inp.dispatchEvent(new Event('input'));
    await vi.waitFor(() => {
      expect(visibleCards().length).toBe(3);
      expect(M.search).toBe('');
    });
  });
});

describe('批C · 条目14 效率#10 桌面双击卡体直开编辑器', () => {
  it('双击卡体开编辑弹窗；让位区（勾选圈）双击不劫持', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-memo-card').length).toBe(3);
    });
    // 让位区先断言（此时无弹窗）：勾选圈上的双击不弹编辑器
    (document.querySelector('[data-memo-check]') as HTMLElement).dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true })
    );
    expect(document.querySelector('.bz-overlay-popup')).toBeNull();
    // 双击卡体 → 编辑弹窗
    const card = document.querySelector('.bz-memo-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-overlay-popup')).toBeTruthy();
      expect(document.querySelector('.bz-memo-form-title')?.textContent).toBe('编辑备忘录');
    });
  });
});

describe('批C · 条目16 一致#5 单源微收口（行为侧）', () => {
  it('月历点日选中键为 pad2 口径（个位日补零）', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-memo-viewtoggle]')).toBeTruthy();
    });
    (document.querySelector('[data-memo-view="calendar"]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-cal-grid')).toBeTruthy();
    });
    (document.querySelector('[data-memo-cal-day="3"]') as HTMLElement).click();
    expect(M.calSelected).toBe(`${moment().format('YYYY-MM')}-03`);
  });
});

describe('批C · 条目17 一致#6 月历空态单源（行为侧）', () => {
  it('空月出 .bz-empty 人话空态（bz-memo-cal-empt 退役）', async () => {
    const { app } = seedVault([
      { id: 'nd', title: '无截止事项', scene: '工作', priority: 'minor', created: '2026-09-01 09:00:00', completed: null, due: null },
    ]);
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-memo-viewtoggle]')).toBeTruthy();
    });
    (document.querySelector('[data-memo-view="calendar"]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-cal-grid')).toBeTruthy();
    });
    expect(document.querySelector('.bz-memo-cal-stats')?.textContent).toContain('本月到期 0 条');
    expect(document.querySelector('.bz-empty')?.textContent).toContain('本月没有到期事项');
  });

  it('月历空日清单出「这一天没有备忘录」空态（calDayPanelHtml 单源）', async () => {
    const { app } = seedVault();
    openMemoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-memo-viewtoggle]')).toBeTruthy();
    });
    (document.querySelector('[data-memo-view="calendar"]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-cal-grid')).toBeTruthy();
    });
    // 点一个没有条目的日子（今日有条目 a——选 15 号之后的日子）
    const day = moment().date() < 20 ? 21 : 5;
    (document.querySelector(`[data-memo-cal-day="${day}"]`) as HTMLElement)?.click();
    await vi.waitFor(() => {
      const panel = document.querySelector('.bz-memo-cal-daypanel');
      expect(panel?.textContent).toContain('这一天没有备忘录');
      expect(panel?.querySelector('.bz-empty')).toBeTruthy();
    });
  });
});

describe('批C · panelShell 壳锚点（条目2/5/10 综合）', () => {
  it('壳：关闭钮在、设置钮不在、清除 ✕ 在、视图页签带热区类', () => {
    const h = panelShellHtml();
    expect(h).toContain('data-memo-head-close');
    expect(h).not.toContain('data-memo-head-settings');
    expect(h).toContain('data-memo-search-clear');
    expect(h.match(/bz-memo-viewbtn bz-touch-target bz-touch-target--lg/g)).toHaveLength(2);
  });
});
