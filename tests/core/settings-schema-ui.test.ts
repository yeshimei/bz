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
import { resetObsidianMocks, getNoticeMessages } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { renderSettingsInto, resolveNumberBound } from '../../src/core/settings-schema';
import type { SettingsSchema } from '../../src/core/settings-schema';
import { mainSettingsSchema } from '../../src/core/settings-main-schema';
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
    state.useFileDateTime = true;
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [
        { icon: 'eye', name: '显示', rows: [{ type: 'toggle', name: '默认日期取自文件', binding: { key: 'useFileDateTime' } }] },
      ],
    });
    const row = findRow(container, '默认日期取自文件');
    const toggle = controlOf(row);
    expect(toggle.value).toBe(true);
    toggle.trigger(false);
    expect(state.useFileDateTime).toBe(false);
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
                { value: 'ollama', label: 'Ollama（本地）' },
              ],
            },
          ],
        },
      ],
    });
    const dd = controlOf(findRow(container, '服务商'));
    expect(dd.options).toEqual({ deepseek: 'DeepSeek', ollama: 'Ollama（本地）' });
    expect(dd.value).toBe('deepseek'); // 绑定现值（DEFAULT_SETTINGS 缺省通道）
    dd.trigger('ollama');
    expect(state.aiProvider).toBe('ollama');
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
          rows: [{ type: 'text', name: '文本行', binding: { key: 'bookshelfFolderPath' }, onCommit }],
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
    expect(state.bookshelfFolderPath).toBe('bookxy');
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
    expect(state.bookshelfFolderPath).toBe('回车值');
    // 挂起防抖已清：时间走完不再多落盘
    vi.advanceTimersByTime(2000);
    expect(saver).toHaveBeenCalledTimes(2);
  });

  it('onCommit 一次性提示：变更才提示、同会话至多一次、改回原值复位可再次提示', () => {
    vi.useFakeTimers();
    const { onCommit, text } = renderTextInput();
    // 无变更不提示（bookshelfFolderPath 缺省 ''，触发同值不提示）
    text.trigger('');
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
    text.trigger('');
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
    state.useFileDateTime = true;
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [
        {
          icon: 'eye',
          name: '联动组',
          rows: [
            { type: 'toggle', name: '总开关', binding: { key: 'useFileDateTime' } },
            {
              type: 'text',
              name: '条件行',
              binding: { key: 'bookshelfFolderPath' },
              visibleWhen: (s) => s.useFileDateTime === true,
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
    state.useFileDateTime = true;
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [
        {
          name: 'G',
          rows: [
            { type: 'toggle', name: '总开关', binding: { key: 'useFileDateTime' } },
            {
              type: 'custom',
              visibleWhen: (s) => s.useFileDateTime === true,
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
        { name: '🤖 AI', rows: [{ type: 'toggle', name: '开关行', binding: { key: 'useFileDateTime' } }] },
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

  it('N6：域行 onChange 同步抛错 → 绑定值回滚 + chips 回滚 + 保存失败通知（不再 unhandled rejection）', async () => {
    const vault = new MockVault();
    vault.create('旧目录/a.md', 'x');
    vault.create('新目录/b.md', 'x');
    setApp(mockAppWithVault(vault) as any);
    state.reviewWatchedFolders = ['旧目录'];
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [
        {
          name: '路径组',
          rows: [
            {
              type: 'path',
              mode: 'multi',
              name: '监听文件夹',
              binding: { key: 'reviewWatchedFolders' },
              onChange: () => {
                throw new Error('域炸了');
              },
            },
          ],
        },
      ],
    });
    const row = findRow(container, '监听文件夹');
    controlOf(row).trigger(); // 「添加…」按钮开选择器
    await pickInPicker('新目录');
    // 域回调炸：绑定值回滚旧清单并补落盘，chips 以旧清单重渲染，人话提示
    expect(state.reviewWatchedFolders).toEqual(['旧目录']);
    expect(row.querySelector('.bz-path-picker-chip-name')!.textContent).toBe('旧目录');
    expect(hasSaveError('监听文件夹')).toBe(true);
  });
});

describe('主设置页 AI per-provider 配置三行（ticket 172）', () => {
  // 直接构造与 mainSettingsSchema 相同的三行（避免全量 schema 重渲染的 DOM 噪音）；
  // issue 422 起 AI 页四组（LLM/Embedding/JEV/凭据）；服务商与模型行同在 LLM 组——
  // 渲 AI 页前三组，顺带覆盖 JEV/凭据组与「思考档位选项随服务商换表」的联动
  function renderProviderRows(container: HTMLElement) {
    const schema = mainSettingsSchema();
    renderSettingsInto(container, { groups: schema.groups.slice(0, 3) });
  }

  it('模型名称/最大输出 token 两行渲染，初始值 = 当前模型官方最大档（issue 342/ADR-0151）', () => {
    state.aiProvider = 'zhipu-plan';
    const container = document.createElement('div');
    renderProviderRows(container);
    const modelRow = findRow(container, '模型名称');
    const maxTokensRow = findRow(container, '最大输出 token');
    // 初始 = 按模型名查官方档（zhipu-plan: model glm-5.3-flash → 128K 输出）；
    // 「上下文窗口」行已删（issue 342 后续：模型固有属性、零消费点）
    expect(textControlOf(modelRow).value).toBe('glm-5.3-flash');
    expect([...container.querySelectorAll('.setting-item')].some(
      (s) => (s as HTMLElement).dataset.name === '上下文窗口'
    )).toBe(false);
    expect(textControlOf(maxTokensRow).value).toBe('131072');
  });

  it('输入覆盖值写入 per-provider map；清空回落注册表默认', () => {
    state.aiProvider = 'ollama';
    const container = document.createElement('div');
    renderProviderRows(container);
    const modelRow = findRow(container, '模型名称');
    // 初始 = ollama 注册表默认 llama3.1
    expect(textControlOf(modelRow).value).toBe('llama3.1');
    textControlOf(modelRow).trigger('my-local-model');
    expect(state.aiModelOverrides?.ollama).toBe('my-local-model');
    textControlOf(modelRow).trigger('');
    expect(state.aiModelOverrides?.ollama).toBeUndefined(); // 清空 = 回落默认
  });

  it('切换 provider 后两行值联动刷新（onRefresh）', () => {
    state.aiProvider = 'deepseek';
    state.aiModelOverrides = {};
    state.aiMaxTokensOverrides = {};
    const container = document.createElement('div');
    renderProviderRows(container);
    // 先看 ollama 时的默认
    const providerRow = findRow(container, 'AI 服务商');
    const dd = controlOf(providerRow);
    dd.trigger('ollama');
    // 触发 reevaluate（select onChange 后渲染器自动 reevaluate → 行级联动刷新）
    expect(textControlOf(findRow(container, '模型名称')).value).toBe('llama3.1');
    expect(textControlOf(findRow(container, '最大输出 token')).value).toBe('8192');
    // 再切 deepseek（注册表 model 为空 → 兜底档 = 端点在售模型官方最大档）
    dd.trigger('deepseek');
    expect(textControlOf(findRow(container, '模型名称')).value).toBe(''); // deepseek 注册表 model 为空
    expect(textControlOf(findRow(container, '最大输出 token')).value).toBe('393216');
  });

  it('思考行随服务商换表（issue 411/ADR-0179）：档位按家显示、值按家存、切回不丢', () => {
    state.aiProvider = 'deepseek';
    state.aiThinkingOverrides = {};
    const container = document.createElement('div');
    renderProviderRows(container);
    // 动态选项行切换服务商时整只下拉重建（controlEl 清空 + 新 <select>），
    // mock 的 controls 数组保留旧件——取「当前在场」的最后一个 trigger 控件
    const liveDd = () =>
      [...((findRow(container, '思考 reasoning') as any).__setting.controls as any[])]
        .reverse()
        .find((c) => typeof c.trigger === 'function');

    // deepseek：有「关闭」无「中」
    expect(Object.keys(liveDd().options)).toEqual(['auto', 'off', 'low', 'high', 'max']);
    liveDd().trigger('off');
    expect(state.aiThinkingOverrides).toEqual({ deepseek: 'off' });

    // 切智谱 Plan：换表（glm-5.3 强制思考 → 无「关闭」），该家自己的值缺省 auto
    const providerDd = () =>
      [...((findRow(container, 'AI 服务商') as any).__setting.controls as any[])]
        .reverse()
        .find((c) => typeof c.trigger === 'function');
    providerDd().trigger('zhipu-plan');
    expect(Object.keys(liveDd().options)).toEqual(['auto', 'low', 'high', 'max']);
    expect(liveDd().value).toBe('auto');
    liveDd().trigger('max');
    expect(state.aiThinkingOverrides).toEqual({ deepseek: 'off', 'zhipu-plan': 'max' });

    // 切回 deepseek：本家档位仍在（per-provider 互不污染）
    providerDd().trigger('deepseek');
    expect(liveDd().value).toBe('off');
    expect(Object.keys(liveDd().options)).toEqual(['auto', 'off', 'low', 'high', 'max']);
  });
});

describe('choiceCards 行（issue 210）', () => {
  it('预览卡渲染进控件区 + 点击写键落盘 + 空值回退首个选项', () => {
    state.memoSkin = '';
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [
        {
          icon: 'eye',
          name: '显示',
          rows: [
            {
              type: 'choiceCards',
              name: '面板皮肤',
              binding: { key: 'memoSkin' },
              options: [
                { value: 'default', label: '默认', prevClass: 'bz-skinprev-default' },
                { value: 'paper', label: '纸感手账', prevClass: 'bz-skinprev-paper' },
              ],
            } as any,
          ],
        },
      ],
    });
    const settingEl = findRow(container, '面板皮肤');
    const cards = settingEl.querySelectorAll('.bz-cardpick-card');
    expect(cards.length).toBe(2);
    // 空值回退首个选项（同 select 口径）
    expect(cards[0].classList.contains('is-on')).toBe(true);
    (cards[1] as HTMLElement).click();
    expect(state.memoSkin).toBe('paper');
    expect(saver).toHaveBeenCalled();
    expect(cards[1].classList.contains('is-on')).toBe(true);
    expect(cards[0].classList.contains('is-on')).toBe(false);
  });
});

/** 通知里是否出现「保存失败（行名）」人话提示（N5/N6 断言口径） */
function hasSaveError(rowName?: string): boolean {
  return getNoticeMessages().some((m) =>
    rowName ? m.includes(`保存失败（${rowName}）`) : m.includes('保存失败')
  );
}

/** 微任务冲刷（落盘 reject → catch → notify 链） */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('persist 失败兜底（N5：reject/抛错不再 unhandled rejection，必须人话提示）', () => {
  function useFailingSaver() {
    const failing = vi.fn(() => Promise.reject(new Error('磁盘满了')));
    setSettingsSaver(failing);
    return failing;
  }

  it('toggle 行：persist reject → 通知，内存已写，回调链不断', async () => {
    useFailingSaver();
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [{ name: 'G', rows: [{ type: 'toggle', name: '开关行', binding: { key: 'useFileDateTime' } }] }],
    });
    controlOf(findRow(container, '开关行')).trigger(true);
    await flush();
    expect(state.useFileDateTime).toBe(true);
    expect(hasSaveError('开关行')).toBe(true);
  });

  it('select 行：persist reject → 通知', async () => {
    useFailingSaver();
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [
        {
          name: 'G',
          rows: [
            { type: 'select', name: '服务商行', binding: { key: 'aiProvider' }, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
          ],
        },
      ],
    });
    controlOf(findRow(container, '服务商行')).trigger('a');
    await flush();
    expect(state.aiProvider).toBe('a');
    expect(hasSaveError('服务商行')).toBe(true);
  });

  it('slider 行：persist reject → 通知', async () => {
    useFailingSaver();
    state.pomodoroVolume = 80;
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [{ name: 'G', rows: [{ type: 'slider', name: '音量行', min: 0, max: 100, binding: { key: 'pomodoroVolume' } }] }],
    });
    controlOf(findRow(container, '音量行')).trigger(50);
    await flush();
    expect(state.pomodoroVolume).toBe(50);
    expect(hasSaveError('音量行')).toBe(true);
  });

  it('text 行 commit：persist reject → 通知（void persist 不再裸奔）', async () => {
    useFailingSaver();
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [{ name: 'G', rows: [{ type: 'text', name: '文本行', binding: { key: 'bookshelfFolderPath' } }] }],
    });
    textControlOf(findRow(container, '文本行')).trigger('新值');
    textControlOf(findRow(container, '文本行')).inputEl.dispatchEvent(new Event('blur'));
    await flush();
    expect(state.bookshelfFolderPath).toBe('新值');
    expect(hasSaveError('文本行')).toBe(true);
  });

  it('save 同步抛错（外部绑定）→ toggle 行照常通知，不炸渲染器', async () => {
    setSettingsSaver(() => {
      throw new Error('同步炸');
    });
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [{ name: 'G', rows: [{ type: 'toggle', name: '同步炸行', binding: { key: 'useFileDateTime' } }] }],
    });
    controlOf(findRow(container, '同步炸行')).trigger(true);
    await flush();
    expect(hasSaveError('同步炸行')).toBe(true);
  });
});

describe('R9 + 效率#14：number 行钳制回写与非法输入行内报错', () => {
  function renderNumRow(desc?: string) {
    const container = document.createElement('div');
    renderSettingsInto(container, {
      groups: [
        {
          name: 'G',
          rows: [{ type: 'number', name: '每日上限', desc, min: 0, max: 10, binding: { key: 'reviewDailyLimit' } }],
        },
      ],
    });
    const rowEl = findRow(container, '每日上限');
    return { rowEl, text: textControlOf(rowEl) };
  }

  it('钳制值 ≠ 输入值 → 回写输入框（显示值不再 ≠ 落盘值），dirty 保持，blur 落钳制值', () => {
    state.reviewDailyLimit = 5;
    const { text } = renderNumRow();
    text.trigger('15');
    expect(state.reviewDailyLimit).toBe(10); // 上界钳制写入
    expect(text.inputEl.value).toBe('10'); // 钳制值回写显示
    expect(text.inputEl.classList.contains('bz-input--error')).toBe(false);
    text.inputEl.dispatchEvent(new Event('blur'));
    expect(saver).toHaveBeenCalledTimes(1); // 回写不丢 dirty，blur 照常落盘
    expect(state.reviewDailyLimit).toBe(10);
  });

  it('负数输入（min 0）→ 钳到 0 并回写（N4 同机制）', () => {
    state.reviewDailyLimit = 9;
    const { text } = renderNumRow();
    text.trigger('-5');
    expect(state.reviewDailyLimit).toBe(0);
    expect(text.inputEl.value).toBe('0');
  });

  it('非法输入：error 态 + desc「已保留原值」提示；下次有效输入清除', () => {
    state.reviewDailyLimit = 3;
    const { rowEl, text } = renderNumRow('每日复习上限');
    text.trigger('abc');
    expect(state.reviewDailyLimit).toBe(3); // 不写入
    expect(text.inputEl.classList.contains('bz-input--error')).toBe(true);
    expect((rowEl as any).__setting.desc).toContain('需为数字，已保留原值 3');
    // 下次有效输入清除报错态
    text.trigger('7');
    expect(text.inputEl.classList.contains('bz-input--error')).toBe(false);
    expect((rowEl as any).__setting.desc).toBe('每日复习上限');
    expect(state.reviewDailyLimit).toBe(7);
  });

  it('非法输入后 blur：回显生效旧值并清报错态（落的是旧值，与显示对齐）', () => {
    state.reviewDailyLimit = 7;
    const { text } = renderNumRow();
    text.trigger('abc');
    text.inputEl.dispatchEvent(new Event('blur'));
    expect(text.inputEl.value).toBe('7'); // 回显生效旧值
    expect(text.inputEl.classList.contains('bz-input--error')).toBe(false);
    expect(state.reviewDailyLimit).toBe(7);
  });

  it('清空（空串）：不报错、不写入、blur 不回显（留空回落默认是有意义状态）', () => {
    state.reviewDailyLimit = 3;
    const { text } = renderNumRow('每日复习上限');
    text.trigger('');
    expect(text.inputEl.classList.contains('bz-input--error')).toBe(false);
    text.inputEl.dispatchEvent(new Event('blur'));
    expect(text.inputEl.value).toBe('');
    expect(state.reviewDailyLimit).toBe(3);
  });
});

describe('新-1 连带：域行 onChange 同步抛错不中断防抖排程', () => {
  it('text 行 onChange 抛错：commit 必达（落盘）+ console.error + 保存失败通知', () => {
    vi.useFakeTimers();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const container = document.createElement('div');
      renderSettingsInto(container, {
        groups: [
          {
            name: 'G',
            rows: [
              {
                type: 'text',
                name: '抛错行',
                binding: { key: 'bookshelfFolderPath' },
                onChange: () => {
                  throw new Error('域回调炸了');
                },
              },
            ],
          },
        ],
      });
      const text = textControlOf(findRow(container, '抛错行'));
      expect(() => text.trigger('新值')).not.toThrow();
      vi.advanceTimersByTime(800); // 防抖排程必达
      expect(state.bookshelfFolderPath).toBe('新值');
      expect(saver).toHaveBeenCalledTimes(1);
      expect(errSpy).toHaveBeenCalled();
      expect(hasSaveError('抛错行')).toBe(true);
    } finally {
      errSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe('最大输出 token 行 min 钳制（N4）', () => {
  it('schema 声明 min:0；负数输入钳到 0 = 删覆盖回落默认（不再直通服务商 max_tokens）', () => {
    const schema = mainSettingsSchema();
    const row = schema.groups[0].rows.find((r) => (r as { name?: string }).name === '最大输出 token') as { min?: number };
    expect(row.min).toBe(0);

    state.aiProvider = 'openai';
    state.aiMaxTokensOverrides = { openai: 16384 };
    const container = document.createElement('div');
    renderSettingsInto(container, { groups: schema.groups.slice(0, 1) });
    const text = textControlOf(findRow(container, '最大输出 token'));
    expect(text.value).toBe('16384');
    text.trigger('-5');
    // 0 经 setProviderValue 删键 = 回落注册表默认（口径自洽），而非存 -5 发给服务商
    expect((state.aiMaxTokensOverrides as Record<string, unknown>).openai).toBeUndefined();
    expect(text.inputEl.value).toBe('0'); // 钳制值回写（R9）
  });
});

describe('最大输出 token 行上界按服务商动态取（issue 457/ADR-0193）', () => {
  it('resolveNumberBound：静态原样、函数求值；undefined / 非有限数一律不钳制', () => {
    const snap = {} as never;
    expect(resolveNumberBound(10, snap)).toBe(10);
    expect(resolveNumberBound(undefined, snap)).toBeUndefined();
    expect(resolveNumberBound(() => 131072, snap)).toBe(131072);
    expect(resolveNumberBound(() => undefined, snap)).toBeUndefined();
    expect(resolveNumberBound(() => Number.NaN, snap)).toBeUndefined();
  });

  it('「最大输出 token」上界随服务商切换：DeepSeek 393216 ↔ 智谱 131072', () => {
    state.aiProvider = 'deepseek';
    const container = document.createElement('div');
    const handle = renderSettingsInto(container, { groups: mainSettingsSchema().groups.slice(0, 1) });
    const text = textControlOf(findRow(container, '最大输出 token'));
    expect(text.inputEl.max).toBe('393216'); // 原来恒为硬编码 200000

    state.aiProvider = 'zhipu-plan';
    handle.refresh();
    expect(text.inputEl.max).toBe('131072');
    // 上界即真上限：20 万填不进去（原样直送会被服务端 400 / 1210 拒绝）
    text.trigger('200000');
    expect((state.aiMaxTokensOverrides as Record<string, number>)['zhipu-plan']).toBe(131072);
  });

  it('切到「无上限可依」的通道（本地 Ollama）后上界属性清空，不留上一条通道的数', () => {
    state.aiProvider = 'deepseek';
    const container = document.createElement('div');
    const handle = renderSettingsInto(container, { groups: mainSettingsSchema().groups.slice(0, 1) });
    const text = textControlOf(findRow(container, '最大输出 token'));
    expect(text.inputEl.max).toBe('393216');

    state.aiProvider = 'ollama';
    handle.refresh();
    expect(text.inputEl.max).toBe(''); // 不清空就会残留 393216，把本地通道的输入框框死
  });

  it('上界随「模型名称」覆盖联动：DeepSeek 换成 gpt-4o-mini → 16384', () => {
    state.aiProvider = 'deepseek';
    state.aiModelOverrides = { deepseek: 'gpt-4o-mini' };
    const container = document.createElement('div');
    renderSettingsInto(container, { groups: mainSettingsSchema().groups.slice(0, 1) });
    const text = textControlOf(findRow(container, '最大输出 token'));
    expect(text.inputEl.max).toBe('16384');
    // 未填覆盖时的显示默认值也按同一个模型算（显示值 = 生效值，不留缝）
    expect(text.value).toBe('16384');
  });
});
