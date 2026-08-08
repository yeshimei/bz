/**
 * 设置页测试（覆盖 main.ts BzSettingTab，ADR-0009）：单页两区块（🤖 AI / 📂 数据存储路径）渲染 +
 * 控件交互保存持久化 + storagePath 迁移（旧 7 字段 → 共享路径）。
 * 依赖 mock-obsidian-entry 的 Setting 链式 mock（MockDropdown/MockText/MockToggle）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import BzPlugin, { BzSettingTab } from '../src/main';
import { MockVault } from './mock-vault';
import { resetObsidianMocks, MockNotice } from './mock-obsidian-entry';

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

  it('AI 区块：服务商下拉 + 两个 API Key；数据存储路径区块：storagePath 输入', () => {
    findSetting(tab, 'AI 服务商');
    findSetting(tab, 'DeepSeek API Key');
    findSetting(tab, 'OpenCode Go API Key');
    findSetting(tab, '数据存储路径');
    // 域设置不再出现在设置页（已迁往各域 ⚙️ 弹窗）
    expect([...tab.containerEl.querySelectorAll('.setting-item')].some((s) => (s as HTMLElement).dataset.name === '启动时自动弹窗')).toBe(false);
    expect([...tab.containerEl.querySelectorAll('.setting-item')].some((s) => (s as HTMLElement).dataset.name === '剪藏目录')).toBe(false);
  });

  it('AI 服务商切换更新设置并持久化', async () => {
    const aiSetting = findSetting(tab, 'AI 服务商');
    const dd = (aiSetting as any).__setting.controls.find((c: any) => c.options && 'opencode-go' in c.options);
    dd.trigger('opencode-go');
    await new Promise((r) => setTimeout(r, 10));
    expect(plugin.settings.aiProvider).toBe('opencode-go');
    expect(diskData['bz'].aiProvider).toBe('opencode-go');
  });

  it('数据存储路径输入更新设置并持久化', async () => {
    const el = findSetting(tab, '数据存储路径');
    const text = (el as any).__setting.controls.find((c: any) => typeof c.trigger === 'function' && c.placeholder !== undefined);
    text.trigger('CONFIG/数据');
    await new Promise((r) => setTimeout(r, 10));
    expect(plugin.settings.storagePath).toBe('CONFIG/数据');
    expect(diskData['bz'].storagePath).toBe('CONFIG/数据');
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
    MockNotice.instances.length = 0;
  });

  it('旧 7 字段全部相同（默认 CONFIG/STORAGE）→ seed storagePath，无 Notice', async () => {
    const p = await createPlugin(makeAppNoLayout());
    expect(p.settings.storagePath).toBe('CONFIG/STORAGE');
    expect(MockNotice.instances.length).toBe(0);
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
    expect(MockNotice.instances.length).toBe(0);
  });

  it('旧字段参差 → 默认 CONFIG/STORAGE + Notice 列出被忽略路径', async () => {
    diskData['bz'] = {
      todoFilePath: 'CONFIG/数据',
      pwStoragePath: '其他/路径',
    };
    const p = await createPlugin(makeAppNoLayout());
    expect(p.settings.storagePath).toBe('CONFIG/STORAGE');
    expect(MockNotice.instances.length).toBe(1);
    const msg = MockNotice.instances[0].message as string;
    expect(msg).toContain('todoFilePath');
    expect(msg).toContain('pwStoragePath');
  });

  it('已有 storagePath → 不覆盖（用户已配置）', async () => {
    diskData['bz'] = { storagePath: 'CONFIG/我的数据', todoFilePath: '旧/路径' };
    const p = await createPlugin(makeAppNoLayout());
    expect(p.settings.storagePath).toBe('CONFIG/我的数据');
    expect(MockNotice.instances.length).toBe(0);
  });
});

describe('设置页 onload 迁移（保留既有）', () => {
  it('旧手势设置 → launcherGesture 单选', async () => {
    diskData['bz'] = { gestureDoubleTap: true, gestureTripleTap: false };
    const p1 = await createPlugin(makeMockApp());
    expect(p1.settings.launcherGesture).toBe('double');
    expect((p1.settings as any).gestureDoubleTap).toBeUndefined();
    diskData['bz'] = { gestureSwipeDown: 'bz-memo-open-panel' };
    const p2 = await createPlugin(makeMockApp());
    expect(p2.settings.launcherGesture).toBe('swipe');
    diskData['bz'] = { gestureTripleTap: 'off' };
    const p3 = await createPlugin(makeMockApp());
    expect(p3.settings.launcherGesture).toBe('off');
  });
});
