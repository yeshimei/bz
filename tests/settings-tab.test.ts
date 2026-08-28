/**
 * 设置页测试（覆盖 main.ts BzSettingTab，ADR-0009）：单页两区块（🤖 AI / 📂 数据存储路径）渲染 +
 * 控件交互保存持久化 + storagePath 迁移（旧 7 字段 → 共享路径）。
 * ticket 128：数据存储路径行改为统一路径选择器（chips + 选择…按钮，无手输文本框），
 * 交互经选择器录入；onCommit 提示语义（有变更才提示、同一次会话至多一次、改回原值复位）保留。
 * ticket 131：两区块 schema 化（ADR-0064 渲染器）；AI 服务商切换 → 密钥行显隐走 visibleWhen；
 * ticket 100 文案修正（标题收短为「DeepSeek 密钥」「OpenCode 密钥」，键名/行为不动）。
 * 依赖 mock-obsidian-entry 的 Setting 链式 mock（MockDropdown/MockText/MockToggle）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import BzPlugin, { BzSettingTab } from '../src/main';
import { MockVault, mockAppWithVault } from './mock-vault';
import { setApp } from '../src/core/app';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices } from './mock-obsidian-entry';

const diskData: Record<string, any> = {};

function makeMockApp() {
  const vault = new MockVault();
  return {
    vault,
    workspace: {
      onLayoutReady: (cb: () => void) => cb(),
      getActiveFile: () => null,
      activeEditor: null,
      on: () => ({ ref: 'ref' }),
    },
    commands: { addCommand: () => {}, removeCommand: () => {} },
    metadataCache: { getFileCache: () => null, getBacklinksForFile: () => null, on: () => ({ ref: 'ref' }) },
    fileManager: { processFrontMatter: () => Promise.resolve() },
  };
}

async function createPlugin(app: any) {
  const plugin: any = new BzPlugin(app, {} as any);
  plugin.app = app;
  plugin.loadData = async () => diskData['bz'] ?? null;
  plugin.saveData = async (d: any) => {
    diskData['bz'] = d;
  };
  await plugin.onload();
  return plugin;
}

/** 按设置名找 setting-item */
function findSetting(tab: BzSettingTab, name: string): HTMLElement {
  const el = [...tab.containerEl.querySelectorAll('.setting-item')].find(
    (s) => (s as HTMLElement).dataset.name === name
  ) as HTMLElement;
  expect(el, `设置项「${name}」存在`).toBeTruthy();
  return el;
}

/** 取设置项的控件（MockText/MockToggle 均有 trigger） */
function controlOf(el: HTMLElement): any {
  return (el as any).__setting.controls.find((c: any) => typeof c.trigger === 'function');
}

describe('设置页 BzSettingTab（ADR-0009 单页）', () => {
  let plugin: any;
  let tab: BzSettingTab;

  beforeEach(async () => {
    resetObsidianMocks();
    delete diskData['bz'];
    document.body.innerHTML = '';
    plugin = await createPlugin(makeMockApp());
    tab = new BzSettingTab(plugin.app, plugin);
    tab.display();
  });

  afterEach(() => {
    if (plugin && plugin.unregisterGestures) plugin.unregisterGestures();
  });

  it('单页平铺：无 tab，只有 🤖 AI 与 📂 数据存储路径 两个区块标题', () => {
    expect(tab.containerEl.querySelectorAll('.bz-tab').length).toBe(0);
    const titles = [...tab.containerEl.querySelectorAll('.bz-setting-section-title')].map((t) => t.textContent);
    expect(titles).toEqual(['🤖 AI', '📂 数据存储路径']);
  });

  it('AI 区块：服务商下拉 + 两个密钥行；数据存储路径区块：路径选择行（选择…按钮 + chips，无手输输入框）', () => {
    findSetting(tab, 'AI 服务商');
    findSetting(tab, 'DeepSeek 密钥');
    findSetting(tab, 'OpenCode 密钥');
    const storageRow = findSetting(tab, '数据存储路径');
    // ticket 128：行内无 text 输入框（ddd），选择…按钮 + 控件区内 chips（当前值 chip）
    expect(storageRow.querySelector('.setting-item-control input')).toBeNull();
    const btn = storageRow.querySelector('.setting-item-control button') as HTMLButtonElement;
    expect(btn.textContent).toBe('选择…');
    expect(storageRow.querySelector('.setting-item-control .bz-path-picker-chip-name')!.textContent).toBe('CONFIG/STORAGE');
    // 域设置不再出现在设置页（已迁往各域 ⚙️ 弹窗）
    expect([...tab.containerEl.querySelectorAll('.setting-item')].some((s) => (s as HTMLElement).dataset.name === '启动时自动弹窗')).toBe(false);
    expect([...tab.containerEl.querySelectorAll('.setting-item')].some((s) => (s as HTMLElement).dataset.name === '剪藏目录')).toBe(false);
  });

  it('AI 服务商切换 → 密钥行 visibleWhen 显隐（ticket 131：默认 opencode-go 显示 OpenCode 行）', async () => {
    const hiddenOf = (name: string) => findSetting(tab, name).classList.contains('bz-setting-hidden');
    // 默认 opencode-go：OpenCode 行显示、DeepSeek 行隐藏
    expect(hiddenOf('DeepSeek 密钥')).toBe(true);
    expect(hiddenOf('OpenCode 密钥')).toBe(false);
    // 切 deepseek：反转
    const aiSetting = findSetting(tab, 'AI 服务商');
    const dd = (aiSetting as any).__setting.controls.find((c: any) => c.options && 'deepseek' in c.options);
    dd.trigger('deepseek');
    await new Promise((r) => setTimeout(r, 10));
    expect(hiddenOf('DeepSeek 密钥')).toBe(false);
    expect(hiddenOf('OpenCode 密钥')).toBe(true);
    // 切回 opencode-go：再次反转
    dd.trigger('opencode-go');
    await new Promise((r) => setTimeout(r, 10));
    expect(hiddenOf('DeepSeek 密钥')).toBe(true);
    expect(hiddenOf('OpenCode 密钥')).toBe(false);
  });

  it('AI 服务商切换更新设置并持久化', async () => {
    const aiSetting = findSetting(tab, 'AI 服务商');
    const dd = (aiSetting as any).__setting.controls.find((c: any) => c.options && 'opencode-go' in c.options);
    dd.trigger('opencode-go');
    await new Promise((r) => setTimeout(r, 10));
    expect(plugin.settings.aiProvider).toBe('opencode-go');
    expect(diskData['bz'].aiProvider).toBe('opencode-go');
  });

  it('数据存储路径经统一选择器录入：确认即落盘 + f1 风险提示（同会话不重复、改回原值复位）', async () => {
    // 选择器数据源 = vault 文件夹：种几个候选目录（含默认 CONFIG/STORAGE）
    const vault = new MockVault();
    vault.create('CONFIG/STORAGE/a.json', 'x');
    vault.create('CONFIG/数据/b.json', 'x');
    vault.create('CONFIG/数据2/c.json', 'x');
    setApp(mockAppWithVault(vault) as any);
    const saveSpy = vi.spyOn(plugin, 'saveData');

    const pickVia = async (path: string) => {
      const el = findSetting(tab, '数据存储路径');
      (el as any).__setting.controls[0].trigger(); // 「选择…」按钮 → 打开选择器
      const popup = document.getElementById('bz-path-picker-popup')!;
      await vi.waitFor(() => expect(popup.querySelectorAll('.bz-path-picker-row').length).toBeGreaterThan(0));
      const row = [...popup.querySelectorAll('.bz-path-picker-row')].find(
        (r) => (r as HTMLElement).dataset.path === path
      ) as HTMLElement;
      row.click();
      (popup.querySelector('.bz-path-picker-btn--primary') as HTMLButtonElement).click();
      await new Promise((r) => setTimeout(r, 10));
    };

    // 选 CONFIG/数据 → 内存 + 落盘一次 + 风险提示（仅改路径、文件不迁移、重载后生效；正文不带 emoji）
    await pickVia('CONFIG/数据');
    expect(plugin.settings.storagePath).toBe('CONFIG/数据');
    expect(saveSpy).toHaveBeenCalledTimes(1); // 离散选择 → 确认即落盘（无防抖必要，语义保留）
    expect(getNoticeMessages().some((m) => m.includes('文件') && m.includes('迁移') && m.includes('重载'))).toBe(true);

    // 同会话再改其它值：不重复提示（warned 去重）
    clearNotices();
    await pickVia('CONFIG/数据2');
    expect(plugin.settings.storagePath).toBe('CONFIG/数据2');
    expect(getNoticeMessages().filter((m) => m.includes('重载')).length).toBe(0);

    // 改回原值 → warned 复位（不提示）；再次改动 → 可再次提示
    clearNotices();
    await pickVia('CONFIG/STORAGE');
    expect(plugin.settings.storagePath).toBe('CONFIG/STORAGE');
    expect(getNoticeMessages().filter((m) => m.includes('重载')).length).toBe(0);
    await pickVia('CONFIG/数据');
    expect(hasNotice(/重载/)).toBe(true);
  });
});

describe('storagePath 迁移（ADR-0009）', () => {
  // 迁移只关心 onload 的 migrateStoragePath；不触发布局回调（避免日记本初始化噪音 Notice）
  function makeAppNoLayout() {
    const app = makeMockApp();
    app.workspace.onLayoutReady = () => {};
    return app;
  }

  beforeEach(() => {
    delete diskData['bz'];
    clearNotices();
  });

  it('旧 7 字段全部相同（默认 CONFIG/STORAGE）→ seed storagePath，无 Notice', async () => {
    const p = await createPlugin(makeAppNoLayout());
    expect(p.settings.storagePath).toBe('CONFIG/STORAGE');
    expect(getNoticeMessages().length).toBe(0);
  });

  it('旧字段全同但自定义 → 以该值初始化 storagePath', async () => {
    diskData['bz'] = {
      todoFilePath: 'CONFIG/数据',
      belongingsDataFolder: 'CONFIG/数据',
      pwStoragePath: 'CONFIG/数据',
      favoritesStoragePath: 'CONFIG/数据',
      reviewStoragePath: 'CONFIG/数据',
      META_PATH: 'CONFIG/数据/ai_completion_meta.json',
      VEC_PATH: 'CONFIG/数据/ai_completion_vectors.vec',
    };
    const p = await createPlugin(makeAppNoLayout());
    expect(p.settings.storagePath).toBe('CONFIG/数据');
    expect(getNoticeMessages().length).toBe(0);
  });

  it('旧字段参差 → 默认 CONFIG/STORAGE + Notice 列出被忽略路径', async () => {
    diskData['bz'] = {
      todoFilePath: 'CONFIG/数据',
      pwStoragePath: '其他/路径',
    };
    const p = await createPlugin(makeAppNoLayout());
    expect(p.settings.storagePath).toBe('CONFIG/STORAGE');
    expect(getNoticeMessages().length).toBe(1);
    const msg = getNoticeMessages()[0] as string;
    expect(msg).toContain('todoFilePath');
    expect(msg).toContain('pwStoragePath');
  });

  it('已有 storagePath → 不覆盖（用户已配置）', async () => {
    diskData['bz'] = { storagePath: 'CONFIG/我的数据', todoFilePath: '旧/路径' };
    const p = await createPlugin(makeAppNoLayout());
    expect(p.settings.storagePath).toBe('CONFIG/我的数据');
    expect(getNoticeMessages().length).toBe(0);
  });
});

describe('设置页 onload 迁移（保留既有）', () => {
  it('旧手势设置 → launcherGesture 单选', async () => {
    diskData['bz'] = { gestureDoubleTap: true, gestureTripleTap: false };
    const p1 = await createPlugin(makeMockApp());
    expect(p1.settings.launcherGesture).toBe('double');
    expect((p1.settings as any).gestureDoubleTap).toBeUndefined();
    diskData['bz'] = { gestureSwipeDown: 'bz-memo-open' };
    const p2 = await createPlugin(makeMockApp());
    expect(p2.settings.launcherGesture).toBe('swipe');
    diskData['bz'] = { gestureTripleTap: 'off' };
    const p3 = await createPlugin(makeMockApp());
    expect(p3.settings.launcherGesture).toBe('off');
  });
});
