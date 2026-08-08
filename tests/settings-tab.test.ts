/**
 * 设置页测试（覆盖 main.ts BzSettingTab）：12 个 tab 渲染 + 控件交互触发保存持久化。
 * 依赖 mock-obsidian-entry 的 Setting 链式 mock（MockDropdown/MockText/MockToggle）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import BzPlugin, { BzSettingTab } from '../src/main';
import { MockVault } from './mock-vault';
import { resetObsidianMocks } from './mock-obsidian-entry';

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

/** 点击 tab 并返回内容区 */
function clickTab(tab: BzSettingTab, label: string): HTMLElement {
  const btn = [...tab.containerEl.querySelectorAll('.bz-tab')].find((b) => b.textContent === label) as HTMLElement;
  expect(btn, `tab「${label}」存在`).toBeTruthy();
  btn.click();
  return btn;
}

/** 按设置名找 setting-item */
function findSetting(tab: BzSettingTab, name: string) {
  const el = [...tab.containerEl.querySelectorAll('.setting-item')].find(
    (s) => (s as HTMLElement).dataset.name === name
  ) as HTMLElement;
  expect(el, `设置项「${name}」存在`).toBeTruthy();
  return el;
}

const ALL_TABS = ['AI', '备忘录', '日记本', '归物本', '剪藏本', '密码本', '收藏本', '书库', '影视', '复习计划', '入口页', 'AI Agent', '闪念'];

describe('设置页 BzSettingTab', () => {
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

  it('display 渲染 13 个 tab，默认第一个（AI）激活', () => {
    const btns = [...tab.containerEl.querySelectorAll('.bz-tab')];
    expect(btns.map((b) => b.textContent)).toEqual(ALL_TABS);
    expect(btns[0].classList.contains('bz-tab-active')).toBe(true);
    expect(tab.containerEl.querySelectorAll('.bz-tab-content').length).toBe(13);
  });

  it('每个 tab 点击后渲染对应设置项（抽查关键项）', () => {
    const spotChecks: Record<string, string[]> = {
      AI: ['AI 服务商', 'DeepSeek API Key', 'OpenCode Go API Key'],
      备忘录: ['备忘录数据文件路径', '启动时自动弹窗'],
      日记本: ['日记目录', '每批加载数量', '显示标签计数'],
      归物本: ['存储文件夹路径'],
      剪藏本: ['剪藏目录', '自动摘要'],
      密码本: ['数据存储路径', '安全模式'],
      收藏本: ['数据存储路径'],
      书库: ['书库文件夹', '书籍识别标签'],
      影视: ['影视文件夹', '每页加载数量'],
      复习计划: ['数据存储路径', '做题决定难度', '题目难度'],
      入口页: ['网格列数'],
      闪念: ['Ollama URL', 'Embedding 模型', '并发数'],
      'AI Agent': ['启用', '监听文件夹', 'AI 匹配模型'],
    };
    for (const label of ALL_TABS) {
      clickTab(tab, label);
      for (const name of spotChecks[label]) {
        expect(
          [...tab.containerEl.querySelectorAll('.setting-item')].some((s) => (s as HTMLElement).dataset.name === name),
          `${label} tab 应有「${name}」`
        ).toBe(true);
      }
    }
  });

  it('AI tab：切换服务商更新设置并持久化', async () => {
    clickTab(tab, 'AI');
    const aiSetting = [...tab.containerEl.querySelectorAll('.setting-item')].find(
      (s) => (s as HTMLElement).dataset.name === 'AI 服务商'
    ) as HTMLElement;
    const dd = (aiSetting as any).__setting.controls.find((c: any) => c.options && 'opencode-go' in c.options);
    expect(dd).toBeTruthy();
    dd.trigger('opencode-go');
    await new Promise((r) => setTimeout(r, 10));
    expect(plugin.settings.aiProvider).toBe('opencode-go');
    expect(diskData['bz'].aiProvider).toBe('opencode-go');
  });

  it('备忘录 tab：文本输入更新设置并持久化', async () => {
    clickTab(tab, '备忘录');
    const el = findSetting(tab, '备忘录数据文件路径');
    const text = (el as any).__setting.controls.find((c: any) => typeof c.trigger === 'function' && c.placeholder !== undefined);
    text.trigger('自定义/路径');
    await new Promise((r) => setTimeout(r, 10));
    expect(plugin.settings.todoFilePath).toBe('自定义/路径');
    expect(diskData['bz'].todoFilePath).toBe('自定义/路径');
  });

  it('日记本 tab：开关交互更新设置', async () => {
    clickTab(tab, '日记本');
    const el = findSetting(tab, '显示标签计数');
    const toggle = (el as any).__setting.controls.find((c: any) => typeof c.trigger === 'function');
    toggle.trigger(false);
    await new Promise((r) => setTimeout(r, 10));
    expect(plugin.settings.showTagCount).toBe(false);
  });

  it('复习 tab：做题决定难度开关控制做题家选项显隐', async () => {
    clickTab(tab, '复习计划');
    const quizNames = ['允许多选题', '每笔记题目数量（0为自动）', '打乱题目顺序', '题目难度'];
    const quizEls = quizNames.map((n) => findSetting(tab, n));
    // 默认 forceQuizForReview=false → 选项隐藏
    for (const el of quizEls) expect(el.classList.contains('bz-setting-hidden')).toBe(true);

    const toggleEl = findSetting(tab, '做题决定难度');
    const toggle = (toggleEl as any).__setting.controls.find((c: any) => typeof c.trigger === 'function');
    toggle.trigger(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(plugin.settings.forceQuizForReview).toBe(true);
    for (const el of quizEls) expect(el.classList.contains('bz-setting-hidden')).toBe(false);
  });

  it('剪藏 tab：自动摘要开关开启触发 ensureAutoSummary（不抛错）', async () => {
    clickTab(tab, '剪藏本');
    const el = findSetting(tab, '自动摘要');
    const toggle = (el as any).__setting.controls.find((c: any) => typeof c.trigger === 'function');
    await expect(Promise.resolve(toggle.trigger(true))).resolves.toBeUndefined();
    expect(plugin.settings.autoSummaryEnabled).toBe(true);
  });

  it('闪念 tab：启用开关触发 ensureFlashOnReady（占位实现不抛错）', async () => {
    clickTab(tab, '闪念');
    const el = findSetting(tab, '启用');
    const toggle = (el as any).__setting.controls.find((c: any) => typeof c.trigger === 'function');
    expect(() => toggle.trigger(true)).not.toThrow();
    expect(plugin.settings.flashEnabled).toBe(true);
  });

  it('AI Agent tab：启用开关触发 ensureAIAgent（不抛错）', async () => {
    clickTab(tab, 'AI Agent');
    const el = findSetting(tab, '启用');
    const toggle = (el as any).__setting.controls.find((c: any) => typeof c.trigger === 'function');
    expect(() => toggle.trigger(true)).not.toThrow();
    expect(plugin.settings.aiAgentEnabled).toBe(true);
  });
});
