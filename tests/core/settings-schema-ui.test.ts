/**
 * 声明式设置 schema 渲染器 UI 层测试（ticket 131，ADR-0064）：键直绑读写落盘 / 外部数据绑定 /
 * text 行防抖 + 失焦 + 回车 commit + onCommit 一次性提示（warnedInitial 复位）/ visibleWhen
 * 联动 + 分组徽标刷新 / actionRow 豁免 / custom 插槽 / number 钳制 / select·slider·info /
 * path 行（单选/多选接 path-picker）/ 区块标题平铺形态（主设置页形态）。jsdom 环境。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/settings';
import type BzSettings from '../../src/settings';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { renderSettingsInto } from '../../src/core/settings-schema';
import type { SettingsSchema } from '../../src/core/settings-schema';
import { closePathPicker } from '../../src/core/path-picker';

const state = { ...DEFAULT_SETTINGS } as BzSettings & Record<string, unknown>;
const saver = vi.fn(async () => {});

/** 按设置名找行（mock Setting 在 settingEl 挂 dataset.name） */
function findRow(container: HTMLElement, name: string): HTMLElement {
  const el = [...container.querySelectorAll('.setting-item')].find(
    (s) => (s as HTMLElement).dataset.name === name
  ) as HTMLElement;
  expect(el, `行「${name}」存在`).toBeTruthy();
  return el;
}

/** 取行内第一个带 trigger 的 mock 控件 */
function controlOf(el: HTMLElement): any {
  return (el as any).__setting.controls.find((c: any) => typeof c.trigger === 'function');
}

/** 行内 mock 文本控件（含真实 inputEl） */
function textControlOf(el: HTMLElement): any {
  return (el as any).__setting.controls.find((c: any) => c.inputEl);
}

beforeEach(() => {
  resetObsidianMocks();
  for (const k of Object.keys(state)) delete (state as any)[k];
  Object.assign(state, DEFAULT_SETTINGS);
  saver.mockClear();
  setSettingsProvider(() => state);
  setSettingsSaver(saver);
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('renderSettingsInto：绑定与落盘', () => {
  it('toggle 键直绑：初始值回填，变更即时写内存 + 落盘', () => {
    state.showTagCount = true;
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [
        { icon: 'eye', name: '显示', rows: [{ type: 'toggle', name: '显示标签计数', binding: { key: 'showTagCount' } }] },
      ],
    });
    const row = findRow(container, '显示标签计数');
    const toggle = controlOf(row);
    expect(toggle.value).toBe(true);
    toggle.trigger(false);
    expect(state.showTagCount).toBe(false);
    expect(saver).toHaveBeenCalledTimes(1);
  });

  it('外部数据绑定（get/set/save 三函数逃生口）：读值入控件，写值回数据并调 save', () => {
    vi.useFakeTimers();
    const external = { value: '旧值' };
    const save = vi.fn(async () => {});
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [
        {
          name: '外部',
          rows: [
            {
              type: 'text',
              name: '外部数据行',
              binding: { get: () => external.value, set: (v) => (external.value = v), save },
            },
          ],
        },
      ],
    });
    const text = controlOf(findRow(container, '外部数据行'));
    expect(text.value).toBe('旧值');
    text.trigger('新值');
    expect(external.value).toBe('新值');
    expect(save).toHaveBeenCalledTimes(0); // 落盘走 800ms 防抖 commit
    vi.advanceTimersByTime(800);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('select 行：选项渲染 + 变更写内存 + 落盘', () => {
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [
        {
          name: 'G',
          rows: [
            {
              type: 'select',
              name: '服务商',
              binding: { key: 'aiProvider' },
              options: [
                { value: 'deepseek', label: 'DeepSeek' },
                { value: 'opencode-go', label: 'OpenCode Go' },
              ],
            },
          ],
        },
      ],
    });
    const dd = controlOf(findRow(container, '服务商'));
    expect(dd.options).toEqual({ deepseek: 'DeepSeek', 'opencode-go': 'OpenCode Go' });
    expect(dd.value).toBe('opencode-go');
    dd.trigger('deepseek');
    expect(state.aiProvider).toBe('deepseek');
    expect(saver).toHaveBeenCalledTimes(1);
  });

  it('slider 行：setLimits 回填 + 变更写内存 + 落盘', () => {
    state.pomodoroVolume = 80;
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [{ name: 'G', rows: [{ type: 'slider', name: '音量', min: 0, max: 100, step: 5, binding: { key: 'pomodoroVolume' } }] }],
    });
    const sl = controlOf(findRow(container, '音量'));
    expect(sl.limits).toEqual([0, 100, 5]);
    expect(sl.value).toBe(80);
    sl.trigger(50);
    expect(state.pomodoroVolume).toBe(50);
    expect(saver).toHaveBeenCalledTimes(1);
  });

  it('number 行：min/max 钳制写入，非数字不写；blur 立即落盘', () => {
    state.reviewDailyLimit = 0;
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [{ name: 'G', rows: [{ type: 'number', name: '每日上限', min: 0, max: 10, binding: { key: 'reviewDailyLimit' } }] }],
    });
    const text = textControlOf(findRow(container, '每日上限'));
    expect(text.inputEl.type).toBe('number');
    text.trigger('999');
    expect(state.reviewDailyLimit).toBe(10); // 上界钳制
    text.trigger('abc');
    expect(state.reviewDailyLimit).toBe(10); // 脏值不写
    text.trigger('3');
    expect(state.reviewDailyLimit).toBe(3);
    expect(saver).not.toHaveBeenCalled(); // 防抖窗口内未落盘
    text.inputEl.dispatchEvent(new Event('blur'));
    expect(saver).toHaveBeenCalledTimes(1); // blur 立即落盘
  });
});

describe('text 行：防抖 + 失焦/回车 + onCommit 一次性提示（warnedInitial 语义）', () => {
  function renderTextInput() {
    const container = document.createElement('div');
    const onCommit = vi.fn();
    renderSettingsInto(container, {
      groups: [
        {
          name: 'G',
          rows: [{ type: 'text', name: '文本行', binding: { key: 'bookTag' }, onCommit }],
        },
      ],
    });
    return { container, onCommit, text: textControlOf(findRow(container, '文本行')) };
  }

  it('800ms 防抖到期落盘；防抖窗口内连续输入只落盘一次', () => {
    vi.useFakeTimers();
    const { text } = renderTextInput();
    text.trigger('bookx');
    vi.advanceTimersByTime(400);
    text.trigger('bookxy');
    vi.advanceTimersByTime(799);
    expect(saver).not.toHaveBeenCalled(); // 重置计时
    vi.advanceTimersByTime(1);
    expect(state.bookTag).toBe('bookxy');
    expect(saver).toHaveBeenCalledTimes(1);
  });

  it('失焦 / 回车立即落盘并清掉挂起防抖', () => {
    vi.useFakeTimers();
    const { text } = renderTextInput();
    text.trigger('失焦值');
    text.inputEl.dispatchEvent(new Event('blur'));
    expect(saver).toHaveBeenCalledTimes(1);
    text.trigger('回车值');
    text.inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(saver).toHaveBeenCalledTimes(2);
    expect(state.bookTag).toBe('回车值');
    // 挂起防抖已清：时间走完不再多落盘
    vi.advanceTimersByTime(2000);
    expect(saver).toHaveBeenCalledTimes(2);
  });

  it('onCommit 一次性提示：变更才提示、同会话至多一次、改回原值复位可再次提示', () => {
    vi.useFakeTimers();
    const { onCommit, text } = renderTextInput();
    // 无变更不提示
    text.trigger('book');
    text.inputEl.dispatchEvent(new Event('blur'));
    expect(onCommit).not.toHaveBeenCalled();
    // 变更 → 提示一次
    text.trigger('bookA');
    vi.advanceTimersByTime(800);
    expect(onCommit).toHaveBeenCalledTimes(1);
    // 同会话再次变更 → 不重复提示
    text.trigger('bookAB');
    vi.advanceTimersByTime(800);
    expect(onCommit).toHaveBeenCalledTimes(1);
    // 改回原值 → warned 复位（不提示）
    text.trigger('book');
    vi.advanceTimersByTime(800);
    expect(onCommit).toHaveBeenCalledTimes(1);
    // 再次变更 → 可再次提示
    text.trigger('bookB');
    vi.advanceTimersByTime(800);
    expect(onCommit).toHaveBeenCalledTimes(2);
  });
});

describe('visibleWhen 联动 + 徽标 + actionRow 豁免 + custom 插槽', () => {
  function renderLinked(): HTMLElement {
    state.showTagCount = true;
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [
        {
          icon: 'eye',
          name: '联动组',
          rows: [
            { type: 'toggle', name: '总开关', binding: { key: 'showTagCount' } },
            {
              type: 'text',
              name: '条件行',
              binding: { key: 'bookTag' },
              visibleWhen: (s) => s.showTagCount === true,
            },
            {
              type: 'button',
              name: '操作行',
              buttonText: '执行',
              onClick: () => {},
            },
          ],
        },
        {
          icon: 'monitor',
          name: '隐藏组',
          rows: [{ type: 'info', name: '占位' }],
          visibleWhen: () => false,
        },
      ],
    });
    return container;
  }

  it('初始求值：条件行显示、隐藏组整组隐藏；徽标计可见行（操作行豁免）', () => {
    const container = renderLinked();
    expect(findRow(container, '条件行').classList.contains('bz-setting-hidden')).toBe(false);
    const groups = container.querySelectorAll('.bz-settings-group');
    expect(groups.length).toBe(2);
    const badgeOf = (g: Element) => g.querySelector('.bz-settings-group-count')!.textContent;
    expect(badgeOf(groups[0])).toBe('2 项'); // toggle + 条件行；button 行豁免
    expect(groups[1].classList.contains('bz-setting-hidden')).toBe(true); // 组级 visibleWhen
    expect((groups[1].querySelector('.bz-settings-group-count') as HTMLElement).style.display).toBe('none');
  });

  it('行变更后重求值：条件行显隐切换 + 徽标刷新；空 schema 与 refresh 句柄可用', () => {
    const container = renderLinked();
    const handle = renderSettingsInto(document.createElement('div'), { groups: [] }); // 空 schema 不抛错
    controlOf(findRow(container, '总开关')).trigger(false);
    expect(findRow(container, '条件行').classList.contains('bz-setting-hidden')).toBe(true);
    const badge = container.querySelector('.bz-settings-group-count')!.textContent;
    expect(badge).toBe('1 项');
    handle.refresh(); // 句柄可独立调用
    expect(findRow(container, '条件行').classList.contains('bz-setting-hidden')).toBe(true);
  });

  it('custom 插槽：render(body, ctx) 渲染进包装容器，visibleWhen 作用于包装容器', () => {
    state.showTagCount = true;
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [
        {
          name: 'G',
          rows: [
            { type: 'toggle', name: '总开关', binding: { key: 'showTagCount' } },
            {
              type: 'custom',
              visibleWhen: (s) => s.showTagCount === true,
              render: (body, ctx) => {
                const flag = document.createElement('span');
                flag.className = 'bz-schema-custom-flag';
                flag.textContent = '自定义内容';
                flag.onclick = () => ctx.refreshVisibility();
                body.appendChild(flag);
              },
            },
          ],
        },
      ],
    });
    const flag = container.querySelector('.bz-schema-custom-flag') as HTMLElement;
    expect(flag).toBeTruthy();
    const wrap = flag.parentElement!;
    expect(wrap.classList.contains('bz-setting-hidden')).toBe(false);
    controlOf(findRow(container, '总开关')).trigger(false);
    expect(wrap.classList.contains('bz-setting-hidden')).toBe(true);
  });

  it('info 行纯展示：名称 + 描述，无控件；button 行挂 bz-setting-action-row 且 onClick 可用', () => {
    const container = document.createElement('div');
    const onClick = vi.fn();
    renderSettingsInto(container, {
      groups: [
        {
          name: 'G',
          rows: [
            { type: 'info', name: '说明行', desc: '这是纯展示说明' },
            { type: 'button', name: '操作行', buttonText: '点我', onClick },
          ],
        },
      ],
    });
    const info = findRow(container, '说明行');
    expect((info as any).__setting.controls.length).toBe(0);
    expect((info as any).__setting.desc).toBe('这是纯展示说明');
    const btnRow = findRow(container, '操作行');
    expect(btnRow.classList.contains('bz-setting-action-row')).toBe(true);
    controlOf(btnRow).trigger();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('textarea 行与区块标题平铺形态', () => {
  it('textarea：防抖落盘、回车不提交（换行语义）', () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [{ name: 'G', rows: [{ type: 'textarea', name: '多行行', binding: { key: 'secondBrainAllowPaths' } }] }],
    });
    const text = textControlOf(findRow(container, '多行行'));
    text.trigger('目录A');
    text.inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(saver).not.toHaveBeenCalled(); // 回车 = 换行，不提交
    vi.advanceTimersByTime(800);
    expect(state.secondBrainAllowPaths).toBe('目录A');
    expect(saver).toHaveBeenCalledTimes(1);
  });

  it('无 icon 分组 = 区块标题平铺形态（主设置页 DOM 契约）', () => {
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [
        { name: '🤖 AI', rows: [{ type: 'toggle', name: '开关行', binding: { key: 'showTagCount' } }] },
        { name: '📂 数据', rows: [{ type: 'info', name: '说明行' }] },
      ],
    });
    const titles = [...container.querySelectorAll('.bz-setting-section-title')].map((t) => t.textContent);
    expect(titles).toEqual(['🤖 AI', '📂 数据']);
    expect(container.querySelectorAll('.bz-settings-group').length).toBe(0);
    // 两区块的行按声明顺序平铺在容器上
    const names = [...container.querySelectorAll('.setting-item')].map((s) => (s as HTMLElement).dataset.name);
    expect(names).toEqual(['开关行', '说明行']);
  });
});

describe('path 行接入统一路径选择器（ADR-0061）', () => {
  function seedVault(): any {
    const vault = new MockVault();
    vault.create('CONFIG/STORAGE/a.json', 'x');
    vault.create('CONFIG/数据/b.json', 'x');
    setApp(mockAppWithVault(vault) as any);
  }

  async function pickInPicker(path: string): Promise<void> {
    const popup = document.getElementById('bz-path-picker-popup')!;
    await vi.waitFor(() => expect(popup.querySelectorAll('.bz-path-picker-row').length).toBeGreaterThan(0));
    const row = [...popup.querySelectorAll('.bz-path-picker-row')].find(
      (r) => (r as HTMLElement).dataset.path === path
    ) as HTMLElement;
    row.click();
    (popup.querySelector('.bz-path-picker-btn--primary') as HTMLButtonElement).click();
  }

  afterEach(() => {
    closePathPicker();
  });

  it('单选：选择…按钮开选择器，确定后写内存 + 落盘 + onCommit 一次性提示', async () => {
    seedVault();
    const container = document.createElement('div');
    const onCommit = vi.fn();
    renderSettingsInto(container, {
      groups: [
        {
          name: '路径组',
          rows: [{ type: 'path', mode: 'single', name: '存储路径', binding: { key: 'storagePath' }, onCommit }],
        },
      ],
    });
    const row = findRow(container, '存储路径');
    controlOf(row).trigger(); // 「选择…」按钮
    await pickInPicker('CONFIG/数据');
    expect(state.storagePath).toBe('CONFIG/数据');
    expect(saver).toHaveBeenCalledTimes(1); // 离散确认即落盘
    expect(onCommit).toHaveBeenCalledTimes(1);
    // 同会话再改：不重复提示（warned 语义）
    controlOf(row).trigger();
    await pickInPicker('CONFIG/STORAGE');
    expect(state.storagePath).toBe('CONFIG/STORAGE');
    expect(onCommit).toHaveBeenCalledTimes(1); // 改回原值：复位且不提示
    controlOf(row).trigger();
    await pickInPicker('CONFIG/数据');
    expect(onCommit).toHaveBeenCalledTimes(2); // 复位后可再次提示
  });

  it('多选：chips ✕ 移除即写内存 + 落盘', async () => {
    seedVault();
    state.reviewWatchedFolders = ['CONFIG/数据'];
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [
        {
          name: '路径组',
          rows: [{ type: 'path', mode: 'multi', name: '监听文件夹', binding: { key: 'reviewWatchedFolders' } }],
        },
      ],
    });
    const row = findRow(container, '监听文件夹');
    const chips = row.querySelector('.bz-path-picker-chip-name')!;
    expect(chips.textContent).toBe('CONFIG/数据');
    (row.querySelector('.bz-path-picker-chip-x') as HTMLElement).click();
    expect(state.reviewWatchedFolders).toEqual([]);
    expect(saver).toHaveBeenCalledTimes(1);
  });
});
