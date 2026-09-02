/**
 * 域设置弹窗测试（ADR-0009）：
 * 1) core/settings-modal 机制——打开/标题/schema/空态/无右上角关闭按钮/遮罩/Esc/幂等替换；
 * 2) 备忘录面板 ⚙️ 交互（toggle 写回设置）；
 * 3) 归物本（空弹窗 + 排序按钮改 🔀）、收藏本（空弹窗）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openSettingsModal, closeSettingsModal, createSettingsGroup } from '../src/core/settings-modal';
import { setApp } from '../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../src/core/settings-provider';
import { mobileFullscreenGroup } from '../src/core/settings-common';
import { setBzSettingsProvider } from '../src/memo';
import { App } from '../src/memo/app';
import { UIManager } from '../src/memo/ui';
import { DataManager } from '../src/memo/data';
import { belongingSettingsSchema } from '../src/belongings/ui';
import { favoritesSettingsSchema } from '../src/favorites/ui';
import { MockVault } from './mock-vault';
import { resetObsidianMocks, Platform as MockPlatform } from './mock-obsidian-entry';
import moment from 'moment';

describe('core settings-modal 机制', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    closeSettingsModal();
  });

  it('打开：mask/popup 挂载 body，标题正确，schema 内容渲染', () => {
    openSettingsModal({
      title: '测试设置',
      schema: {
        groups: [
          {
            name: '测试组',
            rows: [
              {
                type: 'custom',
                render: (body) => {
                  const s = document.createElement('div');
                  s.className = 'setting-item';
                  s.dataset.name = '测试项';
                  body.appendChild(s);
                },
              },
            ],
          },
        ],
      },
    });
    const mask = document.getElementById('bz-settings-modal-mask');
    const popup = document.getElementById('bz-settings-modal-popup');
    expect(mask).not.toBeNull();
    expect(popup).not.toBeNull();
    expect(mask!.style.display).toBe('block');
    expect(popup!.textContent).toContain('测试设置');
    expect(popup!.querySelector('[data-name="测试项"]')).not.toBeNull();
  });

  it('层级：设置弹窗 z 动态发号（ADR-0067），遮罩在下、本体在上', () => {
    openSettingsModal({ title: '层级测试', schema: { groups: [] } });
    const mask = document.getElementById('bz-settings-modal-mask');
    expect(mask).not.toBeNull();
    const z = parseInt(mask!.style.zIndex, 10);
    expect(Number.isFinite(z)).toBe(true);
    const popup = document.getElementById('bz-settings-modal-popup');
    expect(parseInt(popup!.style.zIndex, 10)).toBe(z + 1);
  });

  it('空态：schema 未挂 setting-item 时显示 emptyText/emptyDesc', () => {
    openSettingsModal({ title: '空设置', schema: { groups: [] }, emptyText: '没有可配置的设置项', emptyDesc: '路径由全局管理' });
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('没有可配置的设置项');
    expect(popup.textContent).toContain('路径由全局管理');
    expect(popup.querySelector('.setting-item')).toBeNull();
  });

  it('schema 仅含移动端组：桌面端整组隐藏 → 显示空态；移动端显示开关行（ticket 131）', () => {
    setSettingsProvider(() => ({ diaryMobileDefaultFullscreen: false } as any));
    setSettingsSaver(async () => {});
    const prevMobile = MockPlatform.isMobile;
    try {
      MockPlatform.isMobile = false;
      openSettingsModal({
        title: '仅移动端组',
        schema: { groups: [mobileFullscreenGroup('diaryMobileDefaultFullscreen')] },
        emptyText: '桌面空态',
      });
      let popup = document.getElementById('bz-settings-modal-popup')!;
      expect(popup.textContent).toContain('桌面空态');
      closeSettingsModal();

      MockPlatform.isMobile = true;
      openSettingsModal({
        title: '仅移动端组',
        schema: { groups: [mobileFullscreenGroup('diaryMobileDefaultFullscreen')] },
        emptyText: '桌面空态',
      });
      popup = document.getElementById('bz-settings-modal-popup')!;
      expect(popup.querySelector('.bz-settings-empty')).toBeNull();
      const mfs = [...popup.querySelectorAll('.setting-item')].find(
        (el) => (el as HTMLElement).dataset.name === '移动端默认全屏'
      );
      expect(mfs).toBeTruthy();
      closeSettingsModal();
    } finally {
      MockPlatform.isMobile = prevMobile;
    }
  });

  it('不渲染右上角关闭按钮（关闭只走遮罩/Esc，用户拍板）', () => {
    openSettingsModal({ title: '测试设置', schema: { groups: [] } });
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect([...popup.querySelectorAll('button')].some((b) => b.textContent === '✕')).toBe(false);
    expect(popup.querySelector('.bz-settings-close')).toBeNull();
  });

  it('点击遮罩关闭', () => {
    openSettingsModal({ title: '测试设置', schema: { groups: [] } });
    document.getElementById('bz-settings-modal-mask')!.click();
    expect(document.getElementById('bz-settings-modal-mask')).toBeNull();
  });

  it('Esc 关闭（escManager 层级）', () => {
    openSettingsModal({ title: '测试设置', schema: { groups: [] } });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('bz-settings-modal-mask')).toBeNull();
  });

  it('重复打开替换旧弹窗（同一时刻至多一个）', () => {
    openSettingsModal({ title: '旧弹窗', schema: { groups: [] } });
    openSettingsModal({ title: '新弹窗', schema: { groups: [] } });
    const popups = [...document.querySelectorAll('#bz-settings-modal-popup')];
    expect(popups.length).toBe(1);
    expect(popups[0].textContent).toContain('新弹窗');
  });

  it('onClose：点遮罩关闭时触发一次', () => {
    let closed = 0;
    openSettingsModal({ title: '回调测试', schema: { groups: [] }, onClose: () => { closed++; } });
    const mask = document.getElementById('bz-settings-modal-mask')!;
    mask.click();
    expect(closed).toBe(1);
    // 关闭后遮罩已脱离 DOM，再次 click 不应重复触发
    mask.click();
    expect(closed).toBe(1);
  });

  it('onClose：遮罩与 Esc 关闭均触发；无 onClose 不报错', () => {
    let closed = 0;
    openSettingsModal({ title: '回调测试', schema: { groups: [] }, onClose: () => { closed++; } });
    document.getElementById('bz-settings-modal-mask')!.click();
    expect(closed).toBe(1);
    openSettingsModal({ title: '回调测试2', schema: { groups: [] }, onClose: () => { closed++; } });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toBe(2);
    // 无 onClose 的弹窗正常关闭
    openSettingsModal({ title: '无回调', schema: { groups: [] } });
    closeSettingsModal();
    expect(document.getElementById('bz-settings-modal-mask')).toBeNull();
  });

  it('onClose：被新弹窗顶替时对旧弹窗触发', () => {
    let oldClosed = 0;
    openSettingsModal({ title: '旧弹窗', schema: { groups: [] }, onClose: () => { oldClosed++; } });
    openSettingsModal({ title: '新弹窗', schema: { groups: [] } });
    expect(oldClosed).toBe(1);
  });

  it('焦点管理（UX 整改 37）：popup 挂 role=dialog + aria-modal；打开聚焦首个可交互项；关闭还原焦点', () => {
    const trigger = document.createElement('button');
    trigger.textContent = '触发';
    document.body.appendChild(trigger);
    trigger.focus();
    openSettingsModal({
      title: '焦点测试',
      schema: {
        groups: [
          {
            name: '焦点组',
            rows: [
              {
                type: 'custom',
                render: (body) => {
                  const item = document.createElement('div');
                  item.className = 'setting-item';
                  body.appendChild(item);
                  const first = document.createElement('button');
                  first.className = 'first-control';
                  first.textContent = '第一个控件';
                  item.appendChild(first);
                  const second = document.createElement('button');
                  second.className = 'second-control';
                  second.textContent = '第二个控件';
                  item.appendChild(second);
                },
              },
            ],
          },
        ],
      },
    });
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.getAttribute('role')).toBe('dialog');
    expect(popup.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(popup.querySelector('.first-control'));
    expect((document.activeElement as HTMLElement).className).toBe('first-control');
    closeSettingsModal();
    expect(document.getElementById('bz-settings-modal-mask')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('焦点管理：隐藏项（bz-setting-hidden）不承接首焦点', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    openSettingsModal({
      title: '隐藏焦点测试',
      schema: {
        groups: [
          {
            name: '隐藏组',
            rows: [
              {
                type: 'custom',
                render: (body) => {
                  const item = document.createElement('div');
                  item.className = 'setting-item bz-setting-hidden';
                  body.appendChild(item);
                  const hiddenBtn = document.createElement('button');
                  hiddenBtn.className = 'hidden-control';
                  hiddenBtn.textContent = '隐藏项';
                  item.appendChild(hiddenBtn);
                  const item2 = document.createElement('div');
                  item2.className = 'setting-item';
                  body.appendChild(item2);
                  const visibleBtn = document.createElement('button');
                  visibleBtn.className = 'visible-control';
                  visibleBtn.textContent = '可见项';
                  item2.appendChild(visibleBtn);
                },
              },
            ],
          },
        ],
      },
    });
    const popup = document.getElementById('bz-settings-modal-popup')!;
    // 跳过隐藏项，聚焦可见首项 → 仍为原触发元素（可见项虽在但首个可见按钮是 visible-control）
    expect(popup.querySelector('.visible-control')).not.toBeNull();
    expect((document.activeElement as HTMLElement).className).toBe('visible-control');
    closeSettingsModal();
  });

  it('焦点管理：移动端跳过 input/textarea（避免弹软键盘），聚焦按钮/开关/下拉', () => {
    MockPlatform.isMobile = true;
    try {
      const trigger = document.createElement('button');
      document.body.appendChild(trigger);
      trigger.focus();
      openSettingsModal({
        title: '移动端焦点测试',
        schema: {
          groups: [
            {
              name: '移动焦点组',
              rows: [
                {
                  type: 'custom',
                  render: (body) => {
                    const item = document.createElement('div');
                    item.className = 'setting-item';
                    body.appendChild(item);
                    const firstInput = document.createElement('input');
                    firstInput.className = 'first-input';
                    item.appendChild(firstInput);
                    const toggleBtn = document.createElement('button');
                    toggleBtn.className = 'toggle-control';
                    toggleBtn.textContent = '开关';
                    item.appendChild(toggleBtn);
                  },
                },
              ],
            },
          ],
        },
      });
      const popup = document.getElementById('bz-settings-modal-popup')!;
      // 桌面会聚焦 first-input；移动端跳过它 → 聚焦首个按钮（开关/下拉同理）
      expect(popup.querySelector('.first-input')).not.toBeNull();
      expect(popup.querySelector('.toggle-control')).not.toBeNull();
      expect(document.activeElement).not.toBe(popup.querySelector('.first-input'));
      expect((document.activeElement as HTMLElement).className).toBe('toggle-control');
      closeSettingsModal();
    } finally {
      MockPlatform.isMobile = false;
    }
  });
});

describe('分组卡片（2026-08 用户拍板方案 A：先落日记本）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    closeSettingsModal();
  });

  it('createSettingsGroup：head（原生图标+组名+徽标）+ body 容器，徽标初始 0 项', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const body = createSettingsGroup(host, { icon: 'folder-open', name: '目录' });
    expect(body.className).toBe('bz-settings-group-body');
    const group = host.querySelector('.bz-settings-group')!;
    expect(group.querySelector('.bz-settings-group-icon')!.getAttribute('data-icon')).toBe('folder-open');
    expect(group.querySelector('.bz-settings-group-name')!.textContent).toBe('目录');
    expect(group.querySelector('.bz-settings-group-count')!.textContent).toBe('0 项');
  });

  it('打开弹窗：schema 分组挂设置项后，徽标回填实际项数；平铺结构不受影响', () => {
    openSettingsModal({
      title: '分组测试',
      schema: {
        groups: [
          {
            icon: 'eye', name: '显示',
            rows: [
              {
                type: 'custom',
                render: (body) => {
                  const s1 = document.createElement('div');
                  s1.className = 'setting-item';
                  body.appendChild(s1);
                  const s2 = document.createElement('div');
                  s2.className = 'setting-item bz-setting-hidden';
                  body.appendChild(s2);
                  // 父链隐藏容器（review 做题家式）同样不计入
                  const box = document.createElement('div');
                  box.style.display = 'none';
                  const s3 = document.createElement('div');
                  s3.className = 'setting-item';
                  box.appendChild(s3);
                  body.appendChild(box);
                  // 纯操作行（review「添加监听文件夹」式）：挂豁免类不计入徽标
                  const actionRow = document.createElement('div');
                  actionRow.className = 'setting-item bz-setting-action-row';
                  body.appendChild(actionRow);
                },
              },
            ],
          },
        ],
      },
    });
    const popup = document.getElementById('bz-settings-modal-popup')!;
    const groups = popup.querySelectorAll('.bz-settings-group');
    expect(groups.length).toBe(1);
    // 隐藏项（含父链隐藏容器内）不计入徽标
    expect(groups[0].querySelector('.bz-settings-group-count')!.textContent).toBe('1 项');
    expect(popup.querySelector('.bz-settings-group-body .setting-item')).not.toBeNull();
  });

  it('多组连续创建：每组独立卡片，间距样式由 CSS 负责（结构断言）', () => {
    openSettingsModal({
      title: '多组测试',
      schema: {
        groups: [
          {
            icon: 'folder-open', name: '目录',
            rows: [
              {
                type: 'custom',
                render: (body) => {
                  const s1 = document.createElement('div');
                  s1.className = 'setting-item';
                  body.appendChild(s1);
                },
              },
            ],
          },
          {
            icon: 'monitor', name: '默认视图',
            rows: [
              {
                type: 'custom',
                render: (body) => {
                  const s2 = document.createElement('div');
                  s2.className = 'setting-item';
                  body.appendChild(s2);
                },
              },
            ],
          },
          // 纯自定义内容组（smartcat 皮肤网格式）：0 个 setting-item，徽标应隐藏
          {
            icon: 'palette', name: '外观',
            rows: [
              {
                type: 'custom',
                render: (body) => {
                  body.appendChild(document.createElement('div'));
                },
              },
            ],
          },
        ],
      },
    });
    const popup = document.getElementById('bz-settings-modal-popup')!;
    const heads = [...popup.querySelectorAll('.bz-settings-group-name')].map((e) => e.textContent);
    expect(heads).toEqual(['目录', '默认视图', '外观']);
    expect(popup.querySelectorAll('.bz-settings-group').length).toBe(3);
    // 0 项组（纯自定义内容）徽标隐藏
    const emptyCount = [...popup.querySelectorAll('.bz-settings-group')]
      .find((g) => g.querySelector('.bz-settings-group-name')!.textContent === '外观')!
      .querySelector('.bz-settings-group-count') as HTMLElement;
    expect(emptyCount.style.display).toBe('none');
    // 有项组徽标正常显示
    const normalCount = [...popup.querySelectorAll('.bz-settings-group')]
      .find((g) => g.querySelector('.bz-settings-group-name')!.textContent === '目录')!
      .querySelector('.bz-settings-group-count') as HTMLElement;
    expect(normalCount.style.display).toBe('');
    expect(normalCount.textContent).toBe('1 项');
  });

  it('maxWidth 透传：传 560 时 popup 最大宽度为 560px，默认仍 400', () => {
    openSettingsModal({ title: '宽弹窗', schema: { groups: [] }, maxWidth: 560 });
    const wide = document.getElementById('bz-settings-modal-popup')!;
    expect(wide.style.maxWidth).toBe('560px');
    closeSettingsModal();
    openSettingsModal({ title: '默认弹窗', schema: { groups: [] } });
    const normal = document.getElementById('bz-settings-modal-popup')!;
    expect(normal.style.maxWidth).toBe('400px');
  });

  it('空态兼容：分组为空时仍显示空态文案（分组结构不破坏空态判断）', () => {
    openSettingsModal({ title: '空分组', schema: { groups: [{ icon: 'folder-open', name: '目录', rows: [] }] }, emptyText: '暂无可配置项' });
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('暂无可配置项');
  });
});

describe('备忘录面板 ⚙️ 设置弹窗', () => {
  const SETTINGS = {
    todoFilePath: 'CONFIG/STORAGE',
    showFileName: true,
    autoPopupOnStart: false,
    movieFolderPath: '我的/影视',
  };

  beforeEach(async () => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.useRealTimers();
    const vault = new MockVault();
    const app = {
      vault,
      workspace: {
        on: vi.fn(() => ({ ref: 'ref' })),
        getLeaf: vi.fn(() => ({ openFile: vi.fn(), view: null })),
        getActiveFile: () => null,
      },
      metadataCache: { getFileCache: () => null },
      commands: { removeCommand: vi.fn() },
    };
    setApp(app as any);
    setBzSettingsProvider(() => SETTINGS);
    setSettingsProvider(() => SETTINGS as any);
    await App.init(SETTINGS);
  });

  it('点 ⚙️ 打开弹窗，切换「启动时自动弹出」写回设置', async () => {
    UIManager.showMain(null, false);
    const settingsBtn = document.querySelector('.todo-btn-settings') as HTMLElement;
    expect(settingsBtn).not.toBeNull();
    settingsBtn.click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    expect(popup.textContent).toContain('备忘录设置');
    const item = [...popup.querySelectorAll('.setting-item')].find((el) => (el as HTMLElement).dataset.name === '启动时自动弹出') as HTMLElement;
    expect(item).toBeTruthy();
    const toggle = (item as any).__setting.controls.find((c: any) => typeof c.trigger === 'function');
    toggle.trigger(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(SETTINGS.autoPopupOnStart).toBe(true);
  });
});

describe('归物本设置 schema（⚙️ 收敛设置面板，ticket 177）', () => {
  // 旧 ⚙️/🔀 头行按钮已随重设计移除：设置全收敛进设置面板（settings-panel schemaLoader）。
  // 此处直测 schema 契约：桌面空态域 + 移动端「移动端默认全屏」组（与设置面板内嵌渲染同源）。
  let settings: Record<string, unknown>;
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    settings = { belongingsDataFolder: 'CONFIG/STORAGE' };
    setSettingsProvider(() => settings as any);
    setSettingsSaver(async () => {});
  });

  it('桌面端：schema 为空态域（仅移动端组，组级门控隐藏 → 无可渲染项）', () => {
    const schema = belongingSettingsSchema();
    expect(schema.groups).toHaveLength(1);
    expect(schema.groups[0].name).toBe('移动端');
    expect(schema.groups[0].visibleWhen!(settings as any)).toBe(false); // 桌面整组隐藏
  });

  it('移动端：schema 暴露「移动端默认全屏」toggle，直绑 belongingsMobileDefaultFullscreen', () => {
    const prevMobile = MockPlatform.isMobile;
    try {
      MockPlatform.isMobile = true;
      const schema = belongingSettingsSchema();
      expect(schema.groups[0].visibleWhen!(settings as any)).toBe(true);
      const row = schema.groups[0].rows[0] as any;
      expect(row.name).toBe('移动端默认全屏');
      expect(row.binding).toMatchObject({ key: 'belongingsMobileDefaultFullscreen' });
    } finally {
      MockPlatform.isMobile = prevMobile;
    }
  });
});

describe('收藏本设置 schema（⚙️ 收敛设置面板，ticket 177）', () => {
  let settings: Record<string, unknown>;
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    settings = { favoritesStoragePath: 'CONFIG/STORAGE' };
    setSettingsProvider(() => settings as any);
    setSettingsSaver(async () => {});
  });

  it('桌面端：schema 为空态域（仅移动端组，组级门控隐藏）', () => {
    const schema = favoritesSettingsSchema();
    expect(schema.groups).toHaveLength(1);
    expect(schema.groups[0].name).toBe('移动端');
    expect(schema.groups[0].visibleWhen!(settings as any)).toBe(false);
  });

  it('移动端：schema 暴露「移动端默认全屏」toggle，直绑 favoritesMobileDefaultFullscreen', () => {
    const prevMobile = MockPlatform.isMobile;
    try {
      MockPlatform.isMobile = true;
      const schema = favoritesSettingsSchema();
      expect(schema.groups[0].visibleWhen!(settings as any)).toBe(true);
      const row = schema.groups[0].rows[0] as any;
      expect(row.name).toBe('移动端默认全屏');
      expect(row.binding).toMatchObject({ key: 'favoritesMobileDefaultFullscreen' });
    } finally {
      MockPlatform.isMobile = prevMobile;
    }
  });
});
