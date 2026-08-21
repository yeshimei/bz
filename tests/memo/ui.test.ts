/**
 * 备忘录 UI 测试（ticket 04/05）：面板渲染、排序置顶、勾选完成/归档、
 * 长按编辑/删除、剪贴板/提醒设置开关、到期通知。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { setBzSettingsProvider } from '../../src/memo';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { App } from '../../src/memo/app';
import { UIManager } from '../../src/memo/ui';
import { DataManager } from '../../src/memo/data';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, Platform as MockPlatform, getNoticeMessages, hasNotice, clearNotices } from '../mock-obsidian-entry';
import moment from 'moment';

function makeApp(vault: MockVault) {
  const workspace = {
    on: vi.fn(() => ({ ref: 'file-open-ref' })),
    offref: vi.fn(),
    getLeaf: vi.fn(() => ({ openFile: vi.fn(), view: null })),
    getActiveFile: () => null,
  };
  return {
    vault,
    workspace,
    metadataCache: { getFileCache: () => null },
    commands: { removeCommand: vi.fn() },
  };
}

const SETTINGS = {
  todoFilePath: 'CONFIG/STORAGE',
  scenarios: '',
  showFileName: true,
  autoPopupOnStart: false,
  movieFolderPath: '我的/影视',
};

async function initApp(vault: MockVault) {
  const app = makeApp(vault);
  setApp(app as any);
  setBzSettingsProvider(() => ({ ...SETTINGS }));
  setSettingsProvider(() => ({ ...SETTINGS } as any));
  setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
  resetAIProviderCache();
  await App.init(SETTINGS);
  return app;
}

async function seedItems(vault: MockVault, items: any[]) {
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(items, null, 2));
  await App.loadData();
}

describe('备忘录面板', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    MockPlatform.isMobile = false; // 防移动端用例失败时泄漏 isMobile 污染后续用例
  });

  it('init 构建 DOM（todo-mask/todo-popup/entries/add 弹窗）', async () => {
    const vault = new MockVault();
    await initApp(vault);
    expect(document.getElementById('todo-mask')).not.toBeNull();
    expect(document.getElementById('todo-popup')).not.toBeNull();
    expect(document.getElementById('todo-entries-container')).not.toBeNull();
    expect(document.getElementById('add-todo-mask')).not.toBeNull();
    expect(document.getElementById('add-todo-popup')).not.toBeNull();
  });

  it('showMain 渲染条目；空列表显示空态「没有备忘录 🎉」', async () => {
    const vault = new MockVault();
    await initApp(vault);
    UIManager.showMain(null, false);
    await new Promise((r) => setTimeout(r, 20)); // flush 异步 refresh
    expect(document.getElementById('todo-entries-container')!.innerHTML).toContain('没有备忘录 🎉');
    expect(document.getElementById('todo-mask')!.style.display).toBe('block');
  });

  it('渲染卡片：内容/场景标签/时间；逾期置顶（🔴）', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(moment('2025-06-15 12:00:00', 'YYYY-MM-DD HH:mm:ss').toDate());
    const vault = new MockVault();
    await initApp(vault);
    await seedItems(vault, [
      { id: '1', title: '普通任务', scene: '工作', priority: 'minor', created: '2025-06-14 10:00:00', completed: null },
      { id: '2', title: '过期待办', scene: '学习', priority: 'minor', created: '2025-06-14 09:00:00', completed: null, due: '2025-06-10 08:00' },
      { id: '3', title: '今日到期', scene: '生活', priority: 'minor', created: '2025-06-14 08:00:00', completed: null, due: '2025-06-15 18:00' },
    ]);
    await App.refresh();
    const cards = document.querySelectorAll('.todo-card');
    expect(cards.length).toBe(3);
    // 逾期最前、今日到期次之、普通最后（置顶排序）
    expect(cards[0].textContent).toContain('过期待办');
    expect(cards[0].textContent).toContain('');
    expect(cards[0].textContent).toContain('5天前已过期');
    expect(cards[1].textContent).toContain('今日到期');
    expect(cards[1].textContent).toContain('');
    expect(cards[2].textContent).toContain('普通任务');
    // 场景标签
    expect(cards[0].textContent).toContain('#学习');
    vi.useRealTimers();
  });

  it('勾选完成 → completed 写盘 + 300ms 后刷新（条目移出主列表）', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    await initApp(vault);
    await seedItems(vault, [
      { id: '1', title: '待办A', scene: '工作', priority: 'minor', created: '2025-06-14 10:00:00', completed: null },
    ]);
    await App.refresh();
    const checkbox = document.querySelector('.todo-card input[type="checkbox"]') as HTMLInputElement;
    checkbox.click();
    await vi.advanceTimersByTimeAsync(350);
    const items = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(items[0].completed).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    // 已完成移出主列表 → 无卡片（原脚本行为：active 空且未开归档时不渲染空态文案）
    expect(document.getElementById('todo-entries-container')!.querySelectorAll('.todo-card').length).toBe(0);
    vi.useRealTimers();
  });

  it('归档开关：📁/📂 切换显示已完成', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    await initApp(vault);
    await seedItems(vault, [
      { id: '1', title: '已完成', scene: '工作', priority: 'minor', created: '2025-06-14 10:00:00', completed: '2025-06-15 09:00:00' },
      { id: '2', title: '未完成', scene: '工作', priority: 'minor', created: '2025-06-14 10:00:00', completed: null },
    ]);
    await App.refresh();
    expect(document.querySelectorAll('.todo-card').length).toBe(1);
    const archiveBtn = document.querySelector('.todo-btn-archive') as HTMLButtonElement;
    archiveBtn.click();
    await vi.advanceTimersByTimeAsync(20);
    expect(document.querySelectorAll('.todo-card').length).toBe(2);
    expect(document.getElementById('todo-entries-container')!.textContent).toContain('已归档');
    expect(document.querySelectorAll('.todo-card')[1].textContent).toContain('📦');
    vi.useRealTimers();
  });

  it('添加弹窗：默认选中第一个场景（剪藏）+ 次要优先级', async () => {
    const vault = new MockVault();
    await initApp(vault);
    UIManager.showAddDialog(null);
    const activeScene = document.querySelector('#add-todo-scenes .scene-btn.active');
    expect((activeScene as HTMLElement).dataset.scene).toBe('剪藏');
    const activePriority = document.querySelector('#add-todo-priority .priority-btn.active');
    expect((activePriority as HTMLElement).dataset.priority).toBe('minor');
    // 6 个默认场景按钮
    expect(document.querySelectorAll('#add-todo-scenes .scene-btn').length).toBe(6);
  });

  it('保存新增：条目写入 memo.json 并刷新', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    await initApp(vault);
    UIManager.showAddDialog(null);
    // 先切到工作场景（原脚本：切换非剪藏场景会清空输入框）
    const sceneBtns = document.querySelectorAll('#add-todo-scenes .scene-btn');
    (sceneBtns[1] as HTMLElement).click(); // 工作
    const content = document.getElementById('add-todo-content') as HTMLTextAreaElement;
    content.value = '新任务内容';
    const saveBtn = document.getElementById('add-todo-save') as HTMLButtonElement;
    saveBtn.click();
    await vi.advanceTimersByTimeAsync(50);
    const items = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(items.length).toBe(1);
    expect(items[0]).toMatchObject({ title: '新任务内容', scene: '工作', priority: 'minor', url: null });
    expect(items[0].id).toMatch(/^todo-/);
    expect(items[0].created).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    // 弹窗关闭
    expect(document.getElementById('add-todo-popup')!.style.display).toBe('none');
    vi.useRealTimers();
  });

  it('编辑：长按卡片 500ms → 跟手菜单 → 点「编辑」打开编辑弹窗（回填内容）', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    await initApp(vault);
    await seedItems(vault, [
      { id: '1', title: '编辑我', scene: '学习', priority: 'important', created: '2025-06-14 10:00:00', completed: null },
    ]);
    await App.refresh();
    const card = document.querySelector('.todo-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 120, clientY: 120 }));
    vi.advanceTimersByTime(550);
    const menu = document.querySelector('.bz-item-menu');
    expect(menu).not.toBeNull();
    // 跟手定位：锚点右下方、不超出视口（jsdom 默认 1024×768）
    const left = parseFloat((menu as HTMLElement).style.left || '0');
    const top = parseFloat((menu as HTMLElement).style.top || '0');
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThan(window.innerWidth);
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThan(window.innerHeight);
    // 松手残余 click 被吞（菜单不关、不穿透）
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();
    // 点「编辑」
    const editItem = [...menu!.querySelectorAll('.bz-item-menu-item')].find(
      (b) => b.textContent!.includes('编辑')
    ) as HTMLElement;
    editItem.click();
    expect(document.getElementById('add-todo-popup')!.style.display).toBe('block');
    expect((document.querySelector('h4') as HTMLElement).textContent).toBe('编辑备忘录');
    expect((document.getElementById('add-todo-content') as HTMLTextAreaElement).value).toBe('编辑我');
    vi.useRealTimers();
  });

  it('长按卡片 → 跟手菜单 → 点「删除」→ 确认弹窗 → 确认删除', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    await initApp(vault);
    await seedItems(vault, [
      { id: '1', title: '删除我', scene: '工作', priority: 'minor', created: '2025-06-14 10:00:00', completed: null },
    ]);
    await App.refresh();
    const card = document.querySelector('.todo-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    vi.advanceTimersByTime(550);
    const menu = document.querySelector('.bz-item-menu');
    expect(menu).not.toBeNull();
    const deleteItem = [...menu!.querySelectorAll('.bz-item-menu-item')].find(
      (b) => b.textContent!.includes('删除')
    ) as HTMLElement;
    deleteItem.click();
    // 确认弹窗出现
    const confirmMask = document.getElementById('__shared_confirm_mask__');
    expect(confirmMask).not.toBeNull();
    expect(confirmMask!.textContent).toContain('删除备忘录');
    // 点确定
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(50);
    const items = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(items).toEqual([]);
    vi.useRealTimers();
  });

  it('移动端：长按卡片 → 底部抽屉（顶部显示条目信息）→ 点「编辑」打开编辑弹窗', async () => {
    vi.useFakeTimers();
    MockPlatform.isMobile = true;
    const vault = new MockVault();
    await initApp(vault);
    await seedItems(vault, [
      { id: '1', title: '抽屉测试', scene: '学习', priority: 'minor', created: '2025-06-14 10:00:00', completed: null },
    ]);
    await App.refresh();
    const card = document.querySelector('.todo-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
    vi.advanceTimersByTime(550);
    const sheet = document.querySelector('.bz-item-sheet');
    expect(sheet).not.toBeNull();
    // 鼠标路径残余 click（同桌面菜单测试）：松手补发的 click 吞掉后再操作
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();
    // 顶部信息区与列表一字不差：标题 + 场景标签 + 时间标签（buildSheetHead 复用列表 meta）
    const head = sheet!.querySelector('.bz-item-sheet-head') as HTMLElement;
    expect(head).not.toBeNull();
    expect(head.querySelector('.bz-item-sheet-entry .todo-content-span')!.textContent).toBe('抽屉测试');
    expect(head.textContent).toContain('#学习');
    expect(head.querySelector('.todo-meta-container')).not.toBeNull();
    expect(head.querySelector('.bz-tag-time')).not.toBeNull();
    const editItem = [...sheet!.querySelectorAll('.bz-item-sheet-item')].find(
      (b) => b.textContent!.includes('编辑')
    ) as HTMLElement;
    editItem.click();
    expect(document.getElementById('add-todo-popup')!.style.display).toBe('block');
    expect((document.querySelector('h4') as HTMLElement).textContent).toBe('编辑备忘录');
    MockPlatform.isMobile = false;
    vi.useRealTimers();
  });

  it('移动端：抽屉拆分「优先级切换」项——点「转为重要」即时写盘并刷新', async () => {
    vi.useFakeTimers();
    MockPlatform.isMobile = true;
    const vault = new MockVault();
    await initApp(vault);
    await seedItems(vault, [
      { id: '1', title: '优先级', scene: '工作', priority: 'minor', created: '2025-06-14 10:00:00', completed: null },
    ]);
    await App.refresh();
    const card = document.querySelector('.todo-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
    vi.advanceTimersByTime(550);
    card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const sheet = document.querySelector('.bz-item-sheet') as HTMLElement;
    // 抽屉里有拆分出的优先级项（次要与重要各显示对应文案）
    const prioItem = [...sheet.querySelectorAll('.bz-item-sheet-item')].find(
      (b) => b.textContent!.includes('转为重要')
    ) as HTMLElement;
    expect(prioItem).toBeDefined();
    prioItem.click();
    await vi.advanceTimersByTimeAsync(100);
    const items = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(items[0].priority).toBe('important');
    // 刷新后卡片场景标签挂 important 样式（红色）
    const sceneTag = document.querySelector('.todo-card .bz-tag-scene') as HTMLElement;
    expect(sceneTag.classList.contains('important')).toBe(true);
    MockPlatform.isMobile = false;
    vi.useRealTimers();
  });
});


describe('从当前笔记/光标创建（ticket 05）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('📌 位置按钮：记录当前笔记路径与光标位置', async () => {
    const vault = new MockVault();
    const app = makeApp(vault) as any;
    app.workspace.getActiveFile = () => ({ path: '我的/笔记A.md', basename: '笔记A' });
    app.workspace.activeEditor = { editor: { getCursor: () => ({ line: 3, ch: 5 }) } };
    setApp(app);
    setBzSettingsProvider(() => ({ ...SETTINGS }));
    await App.init(SETTINGS);
    UIManager.showAddDialog(null);
    const posBtn = document.getElementById('add-todo-pos-btn') as HTMLButtonElement;
    posBtn.click();
    expect(posBtn.textContent).toBe('📌 笔记A');
    expect((posBtn as any).positionData).toEqual({ notePath: '我的/笔记A.md', notePosition: { line: 3, ch: 5 } });
    // 再点取消
    posBtn.click();
    expect(posBtn.textContent).toBe('📌');
  });

  it('无活动文件点位置按钮 → 「无法获取当前位置」', async () => {
    const vault = new MockVault();
    await initApp(vault);
    UIManager.showAddDialog(null);
    (document.getElementById('add-todo-pos-btn') as HTMLButtonElement).click();
    expect(hasNotice('无法获取当前位置')).toBe(true);
  });

  it('URL 内容保存时自动提取 url 字段', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    await initApp(vault);
    UIManager.showAddDialog(null);
    (document.getElementById('add-todo-content') as HTMLTextAreaElement).value = 'https://example.com/page 示例页';
    (document.getElementById('add-todo-save') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(50);
    const items = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(items[0].url).toBe('https://example.com/page');
    expect(items[0].title).toBe('示例页'); // display 作为标题
    vi.useRealTimers();
  });
});

describe('设置弹窗与新建默认值（第 9 轮设置扩展）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.useRealTimers();
  });

  it('⚙️ 设置弹窗含 9 项（提醒/显示/新建/场景分组）', async () => {
    const vault = new MockVault();
    await initApp(vault);
    UIManager.showMain(null, false);
    const settingsBtn = [...document.querySelectorAll('#todo-popup button')].find((b) => b.className === 'todo-btn-settings')!;
    (settingsBtn as HTMLElement).click();
    const popup = document.getElementById('bz-settings-modal-popup')!;
    const names = [...popup.querySelectorAll('.setting-item')].map((el) => (el as HTMLElement).dataset.name);
    // 9 项设置 + 4 个分组标题 = 13 个 setting-item
    expect(names.length).toBe(13);
    // 项名称（润色后的启动弹窗文案）
    expect(names).toContain('启动时自动弹出');
    expect(names).toContain('打开笔记自动提醒');
    expect(names).toContain('默认排序方式');
    expect(names).toContain('默认显示归档');
    expect(names).toContain('到期时间格式');
    expect(names).toContain('新条目默认优先级');
    expect(names).toContain('新条目默认场景');
    expect(names).toContain('完成后自动归档');
    expect(names).toContain('场景');
    // 已删除：到期轮询（到期通知/到期检查间隔）与剪贴板监听/平台映射（ticket 59）
    expect(names).not.toContain('到期通知');
    expect(names).not.toContain('到期检查间隔（秒）');
    expect(names).not.toContain('剪贴板监听');
    expect(names).not.toContain('平台映射');
    // 旧 AI 推荐按钮不存在
    expect(document.getElementById('add-todo-ai-recommend')).toBeNull();
  });

  it('新条目默认场景（memoDefaultScene）与默认优先级生效', async () => {
    const vault = new MockVault();
    const app = makeApp(vault);
    setApp(app as any);
    setBzSettingsProvider(() => ({ ...SETTINGS }));
    setSettingsProvider(() => ({ ...SETTINGS } as any));
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
    resetAIProviderCache();
    await App.init({ ...SETTINGS, memoDefaultScene: '学习', memoDefaultPriority: 'important' });
    UIManager.showAddDialog(null);
    const activeScene = document.querySelector('#add-todo-scenes .scene-btn.active');
    expect((activeScene as HTMLElement).dataset.scene).toBe('学习');
    const activePriority = document.querySelector('#add-todo-priority .priority-btn.active');
    expect((activePriority as HTMLElement).dataset.priority).toBe('important');
  });

  it('默认优先级缺省 → 次要（minor）', async () => {
    const vault = new MockVault();
    await initApp(vault);
    UIManager.showAddDialog(null);
    const activePriority = document.querySelector('#add-todo-priority .priority-btn.active');
    expect((activePriority as HTMLElement).dataset.priority).toBe('minor');
  });

  it('场景列表变更后重建添加弹窗场景按钮（即时生效）', async () => {
    const vault = new MockVault();
    await initApp(vault);
    UIManager.showAddDialog(null);
    const before = document.querySelectorAll('#add-todo-scenes .scene-btn').length;
    expect(before).toBe(6);
    // 设置弹窗保存自定义场景 → 重建
    DataManager.init({ ...SETTINGS, memoScenarios: '工作,生活' });
    if (UIManager.addMask) {
      UIManager.addMask.remove();
      if (UIManager.addPopup) UIManager.addPopup.remove();
      UIManager.addMask = null;
      UIManager.addPopup = null;
      UIManager.createAddDialog();
    }
    UIManager.showAddDialog(null);
    const after = document.querySelectorAll('#add-todo-scenes .scene-btn');
    expect(after.length).toBe(2);
    expect((after[0] as HTMLElement).dataset.scene).toBe('工作');
  });
});

describe('多行输入（ticket 49）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('内容输入框为 textarea：单行高起始，max-height 8 行，禁止拖拽', async () => {
    const vault = new MockVault();
    await initApp(vault);
    const content = document.getElementById('add-todo-content')!;
    expect(content.tagName).toBe('TEXTAREA');
    const ta = content as HTMLTextAreaElement;
    // 行高/高度/禁止拖拽由 styles.css #add-todo-content 提供（jsdom 不加载样式表，验 id 与 autoGrow 行为）
    expect(content.id).toBe('add-todo-content');
    expect(content.getAttribute('placeholder')).toBe('输入备忘录内容...');
  });

  it('keydown Enter 不触发保存/关闭（保存只走按钮）', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    await initApp(vault);
    UIManager.showAddDialog(null);
    const content = document.getElementById('add-todo-content') as HTMLTextAreaElement;
    content.value = '回车测试';
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.advanceTimersByTimeAsync(50);
    // 未触发保存（memo.json 为空数组）
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!)).toEqual([]);
    expect(document.getElementById('add-todo-popup')!.style.display).toBe('block'); // 未关闭
    vi.useRealTimers();
  });

  it('多行内容保存：title 保留换行', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    await initApp(vault);
    UIManager.showAddDialog(null);
    const content = document.getElementById('add-todo-content') as HTMLTextAreaElement;
    content.value = '第一行\n第二行\n第三行';
    (document.getElementById('add-todo-save') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(50);
    const items = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(items[0].title).toBe('第一行\n第二行\n第三行');
    vi.useRealTimers();
  });

  it('auto-grow：随内容增高，超 8 行封顶 + 内部滚动，清空回到一行高', async () => {
    const vault = new MockVault();
    await initApp(vault);
    const content = document.getElementById('add-todo-content') as HTMLTextAreaElement;
    // 3 行高度：自适应
    Object.defineProperty(content, 'scrollHeight', { value: 80, configurable: true });
    content.dispatchEvent(new Event('input'));
    expect(content.style.height).toBe('80px');
    expect(content.style.overflowY).toBe('hidden');
    // 超 8 行（184px）：封顶 + 内部滚动
    Object.defineProperty(content, 'scrollHeight', { value: 400, configurable: true });
    content.dispatchEvent(new Event('input'));
    expect(content.style.height).toBe('184px');
    expect(content.style.overflowY).toBe('auto');
    // 空内容：回到一行高
    Object.defineProperty(content, 'scrollHeight', { value: 0, configurable: true });
    content.value = '';
    content.dispatchEvent(new Event('input'));
    expect(content.style.height).toBe('37px');
    expect(content.style.overflowY).toBe('hidden');
  });

  it('编辑回填多行内容', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    await initApp(vault);
    await seedItems(vault, [
      { id: '1', title: '第一行\n第二行', scene: '学习', priority: 'important', created: '2025-06-14 10:00:00', completed: null },
    ]);
    await App.refresh();
    // 长按卡片出跟手菜单 → 点「编辑」打开编辑弹窗
    const card = document.querySelector('.todo-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 60, clientY: 60 }));
    vi.advanceTimersByTime(550);
    const menu = document.querySelector('.bz-item-menu')!;
    const editItem = [...menu.querySelectorAll('.bz-item-menu-item')].find(
      (b) => b.textContent!.includes('编辑')
    ) as HTMLElement;
    editItem.click();
    const content = document.getElementById('add-todo-content') as HTMLTextAreaElement;
    expect(content.value).toBe('第一行\n第二行');
    expect(document.querySelector('h4')!.textContent).toBe('编辑备忘录');
    vi.useRealTimers();
  });
});

describe('移动端默认全屏（ticket 68）', () => {
  afterEach(() => {
    MockPlatform.isMobile = false;
  });

  it('移动端+开关开：showMain 后 popup 挂 bz-win-mfs（真全屏）', async () => {
    const vault = new MockVault();
    await initApp(vault);
    setSettingsProvider(() => ({ ...SETTINGS, memoMobileDefaultFullscreen: true } as any));
    MockPlatform.isMobile = true;
    UIManager.showMain(null, false);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('todo-popup')!.classList.contains('bz-win-mfs')).toBe(true);
  });

  it('移动端+开关关：不挂类（常规卡）', async () => {
    const vault = new MockVault();
    await initApp(vault);
    MockPlatform.isMobile = true;
    UIManager.showMain(null, false);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('todo-popup')!.classList.contains('bz-win-mfs')).toBe(false);
  });

  it('桌面端：开关开也不挂类', async () => {
    const vault = new MockVault();
    await initApp(vault);
    setSettingsProvider(() => ({ ...SETTINGS, memoMobileDefaultFullscreen: true } as any));
    UIManager.showMain(null, false);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('todo-popup')!.classList.contains('bz-win-mfs')).toBe(false);
  });

  it('设置弹窗：仅移动端显示「移动端默认全屏」行', async () => {
    const vault = new MockVault();
    await initApp(vault);
    const settingNames = () =>
      [...document.querySelectorAll('#bz-settings-modal-popup .setting-item')].map((el) => (el as HTMLElement).dataset.name);
    // 桌面端：无该行（设置项名在 dataset.name，与既有断言口径一致）
    (document.querySelector('.todo-btn-settings') as HTMLElement).click();
    expect(settingNames()).not.toContain('移动端默认全屏');
    // 移动端：有该行（toggle 语义：再点先关旧再开新）
    MockPlatform.isMobile = true;
    (document.querySelector('.todo-btn-settings') as HTMLElement).click();
    expect(settingNames()).toContain('移动端默认全屏');
  });
});
