/**
 * 设置面板 review 面板组回归（review-all-bugs.md H1-H10）：
 * H1 面板渲染器消费行级 onCommit（SpCommitWarn） / H2 isChild 跟随组级父开关 /
 * H4 同组下拉 overflow 还原竞态 / H5 先写后翻 UI / H6 refresh 中 visibleWhen 抛错不中断 /
 * H8 移动端搜索空态转义 / H9 面板重开重跑徽标预载 / H10 choiceCards 布局全不匹配回退全量。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetObsidianMocks, hasNotice, clearNotices } from './mock-obsidian-entry';
import { setSettingsProvider } from '../src/core/settings-provider';
import { renderPanelSchema } from '../src/settings-panel/renderer';
import type { SettingsSchema } from '../src/core/settings-schema';
import { MockVault } from './mock-vault';
import { setApp } from '../src/core/app';

// mock Platform.isMobile 切换（H8 移动端搜索 / H9 桌面）
let mobileFlag = false;
vi.mock('obsidian', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  return {
    ...mod,
    Platform: {
      get isMobile() {
        return mobileFlag;
      },
    },
  };
});

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const flush = () => tick(5);

/** 等待谓词成立（preload 等异步链路轮询） */
async function waitFor(fn: () => boolean, ms = 3000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (fn()) return;
    await tick(30);
  }
  throw new Error('waitFor 超时');
}

describe('设置面板 review 回归（H1-H10）', () => {
  let state: Record<string, unknown>;

  beforeEach(() => {
    resetObsidianMocks();
    mobileFlag = false;
    document.body.innerHTML = '';
    clearNotices();
    state = {};
    setSettingsProvider(() => state as any);
    setApp({ vault: new MockVault(), workspace: { getLeaf: () => ({ openFile: vi.fn() }) } } as any);
  });

  const render = (schema: SettingsSchema) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    return { host, handle: renderPanelSchema(host, schema) };
  };

  it('H1：textarea 行落盘后触发行级 onCommit（备忘录场景列表钩子）；改回原值复位、再改再提示', async () => {
    const onCommit = vi.fn();
    const { handle } = render({
      groups: [{
        name: '场景列表',
        rows: [{ type: 'textarea', name: '自定义场景列表', binding: { key: 'memoScenarios' }, onCommit }],
      }],
    } as unknown as SettingsSchema);
    const ta = document.querySelector('textarea')!;
    // 初始值 = ''；输入新值（置脏）→ blur 提交 → onCommit 一次
    ta.value = '剪藏,工作';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('blur'));
    await flush();
    expect(onCommit).toHaveBeenCalledTimes(1);
    // 程序化刷新不置脏 → blur 不重复提示（dirty 守卫既有语义）
    ta.dispatchEvent(new Event('blur'));
    await flush();
    expect(onCommit).toHaveBeenCalledTimes(1);
    // 改回原值（'') → 复位；再改新值再提示
    ta.value = '';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('blur'));
    ta.value = '学习';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('blur'));
    await flush();
    expect(onCommit).toHaveBeenCalledTimes(2);
    void handle;
  });

  it('H1：text 行落盘后同样触发行级 onCommit（存储路径/生成字符集等 warnReload 钩子）', async () => {
    const onCommit = vi.fn();
    render({
      groups: [{
        name: 'g',
        rows: [{ type: 'text', name: '字符集', binding: { key: 'passwordCharset' }, onCommit }],
      }],
    } as unknown as SettingsSchema);
    const input = document.querySelector('.bz-input') as HTMLInputElement;
    input.value = 'abcABC';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur'));
    await flush();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('H2：isChild 行跟随组内首个键直绑 toggle 显隐（encrypt 预览三行口径）', async () => {
    state.p = true;
    const { handle } = render({
      groups: [{
        name: '预览',
        rows: [
          { type: 'toggle', name: '生成压缩预览', binding: { key: 'p' } },
          { type: 'number', name: '预览长边', binding: { key: 'n1' }, isChild: true },
          { type: 'toggle', name: '自动加载原图', binding: { key: 'p2' }, isChild: true },
          { type: 'number', name: '无关行', binding: { key: 'n2' } },
        ],
      }],
    } as unknown as SettingsSchema);
    const rows = [...document.querySelectorAll('.bz-sp-set-row')] as HTMLElement[];
    expect(rows[1].style.display).toBe(''); // 父开 → 子行显示
    expect(rows[2].style.display).toBe('');
    state.p = false;
    handle.refresh();
    expect(rows[1].style.display).toBe('none'); // 父关 → 子行隐藏
    expect(rows[2].style.display).toBe('none');
    expect(rows[3].style.display).toBe(''); // 非 isChild 行不受父键影响
    state.p = true;
    handle.refresh();
    expect(rows[1].style.display).toBe('');
  });

  it('H4：同组 A 下拉未关时点开 B 下拉 → A 收起不还原组卡 overflow（B 菜单不被裁剪）', async () => {
    render({
      groups: [{
        name: 'g',
        rows: [
          { type: 'select', name: 'A', binding: { key: 'a' }, options: [{ value: '1', label: '一' }, { value: '2', label: '二' }] },
          { type: 'select', name: 'B', binding: { key: 'b' }, options: [{ value: '1', label: '一' }, { value: '2', label: '二' }] },
        ],
      }],
    } as unknown as SettingsSchema);
    const group = document.querySelector('.bz-sp-group') as HTMLElement;
    const sels = [...document.querySelectorAll('.bz-select')] as HTMLElement[];
    // 开 A
    sels[0].click();
    await flush();
    expect(group.querySelector('.bz-select-menu')).toBeTruthy();
    expect(group.style.overflow).toBe('visible');
    // 直接点 B 触发器：A 的 closeMenu 冒泡末段不得抹掉 B 刚设的 visible
    sels[1].click();
    await flush();
    const menus = group.querySelectorAll('.bz-select-menu');
    expect(menus.length).toBe(1); // A 已收、B 开着
    expect(menus[0].closest('.bz-select')).toBe(sels[1]);
    expect(group.style.overflow).toBe('visible'); // 修复前被还原成 '' → B 菜单被裁剪
    // 外点收起 → overflow 还原
    document.body.click();
    await flush();
    expect(group.querySelector('.bz-select-menu')).toBeNull();
    expect(group.style.overflow).toBe('');
  });

  it('H5：toggle 绑定写入抛错 → 开关不翻、出失败提示（先写后翻）', async () => {
    const schema = {
      groups: [{
        name: 'g',
        rows: [{
          type: 'toggle', name: 't',
          binding: { get: () => false, set: () => { throw new Error('boom'); }, save: () => {} },
        }],
      }],
    } as unknown as SettingsSchema;
    render(schema);
    const sw = document.querySelector('.bz-sw') as HTMLElement;
    sw.click();
    await flush();
    expect(sw.classList.contains('on')).toBe(false); // 显示值不背离实际值
    expect(hasNotice(/设置写入失败.*boom/s)).toBe(true);
  });

  it('H6：refresh 中 visibleWhen 抛错 → 该行保守可见，其余行显隐照常（不中断整轮）', async () => {
    state.p = true;
    let calls = 0;
    const { handle } = render({
      groups: [{
        name: 'g',
        rows: [
          { type: 'toggle', name: 't', binding: { key: 'p' }, visibleWhen: (s: any) => s.p === true },
          { type: 'number', name: '炸现行', binding: { key: 'n' }, visibleWhen: () => { calls++; if (calls > 1) throw new Error('vw boom'); return true; } },
        ],
      }],
    } as unknown as SettingsSchema);
    const rows = [...document.querySelectorAll('.bz-sp-set-row')] as HTMLElement[];
    state.p = false;
    expect(() => handle.refresh()).not.toThrow();
    expect(rows[0].style.display).toBe('none'); // 正常行求值未被中断
    expect(rows[1].style.display).toBe(''); // 抛错行保守可见
  });

  it('H8：移动端搜索空态对 query 转义（不产生 img 元素）', async () => {
    mobileFlag = true;
    const { SettingsPanelUI } = await import('../src/settings-panel/ui');
    const ui = new SettingsPanelUI();
    ui.open();
    const searchIn = document.querySelector('.bz-sp-mob-search .bz-input') as HTMLInputElement;
    expect(searchIn).toBeTruthy();
    searchIn.value = '<img src=x onerror="window.__xss=1">';
    searchIn.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    const list = document.querySelector('.bz-sp-mob-list') as HTMLElement;
    expect(list.querySelectorAll('img').length).toBe(0); // 未转义会成真 img
    expect(list.querySelector('.bz-sp-mob-empty')).toBeTruthy();
    expect(list.querySelector('.bz-sp-mob-empty')!.textContent).toContain('<img src=x onerror=');
    ui.cleanup();
  });

  it('H9：面板已开重开（hide→open）重跑徽标预载——会话内改设置后徽标不再是首开快照', async () => {
    const { SettingsPanelUI } = await import('../src/settings-panel/ui');
    const ui = new SettingsPanelUI();
    ui.open();
    const popup = document.getElementById('bz-settings-panel-popup')!;
    const aiBadge = () => {
      const item = [...popup.querySelectorAll('.bz-sp-nav-item')].find((el) => el.textContent?.includes('AI'));
      return item?.querySelector('.bz-sp-nav-count')?.textContent || '';
    };
    await waitFor(() => aiBadge() !== '·' && aiBadge() !== '—');
    const before = aiBadge();
    expect(before).not.toBe('·');
    // 会话内改设置：AI 服务商设置后密钥行解除门控 → 可见项 +1
    state.aiProvider = 'openai';
    ui.hide();
    ui.open();
    await waitFor(() => aiBadge() === String(Number(before) + 1));
    expect(aiBadge()).toBe(String(Number(before) + 1));
    ui.cleanup();
  });

  it('H10：choiceCards 布局值与主题 options 全不匹配 → 回退全量 options（防空白卡组）', async () => {
    state.skin = 'default';
    render({
      groups: [{
        name: '外观',
        rows: [
          { type: 'choiceCards', name: '布局', binding: { key: 'skin' }, options: [{ value: 'default', label: '默认', prevClass: 'p0' }] },
          { type: 'choiceCards', name: '主题', binding: { key: 'theme' }, layoutKey: 'skin', options: [
            { value: 't1', label: '主题甲', layout: 'legacy', prevClass: 'p1' },
            { value: 't2', label: '主题乙', layout: 'legacy', prevClass: 'p2' },
          ] },
        ],
      }],
    } as unknown as SettingsSchema);
    const picks = [...document.querySelectorAll('.bz-sp-cardpick')] as HTMLElement[];
    expect(picks.length).toBe(2);
    // 布局值 'default' 与主题 options 的 layout 'legacy' 全不匹配 → 修复前渲染 0 卡空白
    expect(picks[1].querySelectorAll('.bz-sp-cardpick-card').length).toBe(2);
  });
});
