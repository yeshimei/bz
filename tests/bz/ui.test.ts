/**
 * 备忘录 UI 测试（ticket 04/05）：面板渲染、排序置顶、勾选完成/归档、
 * 长按编辑/删除、AI 推荐（mock fetch）。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setApp } from '../../src/core/app';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { setBzSettingsProvider } from '../../src/bz';
import { App } from '../../src/bz/app';
import { UIManager } from '../../src/bz/ui';
import { DataManager } from '../../src/bz/data';
import { MockVault } from '../mock-vault';
import { MockNotice, resetObsidianMocks } from '../mock-obsidian-entry';
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
  platformMapping: '',
  showFileName: true,
  autoPopupOnStart: false,
  movieFolderPath: '我的/影视',
};

async function initApp(vault: MockVault) {
  const app = makeApp(vault);
  setApp(app as any);
  setBzSettingsProvider(() => ({ ...SETTINGS }));
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
    expect(cards[0].textContent).toContain('🔴');
    expect(cards[0].textContent).toContain('5天前已过期');
    expect(cards[1].textContent).toContain('今日到期');
    expect(cards[1].textContent).toContain('⚠️');
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
    const content = document.getElementById('add-todo-content') as HTMLInputElement;
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

  it('编辑：长按 #场景标签 500ms 打开编辑弹窗（回填内容）', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    await initApp(vault);
    await seedItems(vault, [
      { id: '1', title: '编辑我', scene: '学习', priority: 'important', created: '2025-06-14 10:00:00', completed: null },
    ]);
    await App.refresh();
    const sceneTag = [...document.querySelectorAll('.todo-card span')].find(
      (sp) => sp.textContent!.includes('#学习')
    ) as HTMLElement;
    sceneTag.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
    vi.advanceTimersByTime(550);
    expect(document.getElementById('add-todo-popup')!.style.display).toBe('block');
    expect((document.querySelector('h4') as HTMLElement).textContent).toBe('编辑备忘录');
    expect((document.getElementById('add-todo-content') as HTMLInputElement).value).toBe('编辑我');
    vi.useRealTimers();
  });

  it('长按时间标签 → 删除确认弹窗 → 确认删除', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    await initApp(vault);
    await seedItems(vault, [
      { id: '1', title: '删除我', scene: '工作', priority: 'minor', created: '2025-06-14 10:00:00', completed: null },
    ]);
    await App.refresh();
    // 时间标签（最后一个 span）
    const spans = document.querySelectorAll('.todo-card span');
    const timeTag = spans[spans.length - 1] as HTMLElement;
    timeTag.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
    vi.advanceTimersByTime(550);
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
});

describe('备忘录 AI 推荐（ticket 05）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (global as any).fetch;
  });

  function sseBody(content: string) {
    const encoder = new TextEncoder();
    const chunks = [`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n`, 'data: [DONE]\n'];
    return new ReadableStream({
      start(controller) {
        chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
        controller.close();
      },
    });
  }

  it('AI 推荐成功：自动选中场景与优先级 + Notice', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    await initApp(vault);
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody('{"scene": "学习", "priority": "重要"}'),
    });
    UIManager.showAddDialog(null);
    const content = document.getElementById('add-todo-content') as HTMLInputElement;
    content.value = '复习概率论';
    const aiBtn = document.getElementById('add-todo-ai-recommend') as HTMLButtonElement;
    aiBtn.click();
    // 等 AI 返回
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(100);
    const activeScene = document.querySelector('#add-todo-scenes .scene-btn.active');
    expect((activeScene as HTMLElement).dataset.scene).toBe('学习');
    const activePriority = document.querySelector('#add-todo-priority .priority-btn.active');
    expect((activePriority as HTMLElement).dataset.priority).toBe('important');
    expect(MockNotice.instances.some((n) => n.message.includes('AI 推荐'))).toBe(true);
    // 按钮恢复
    expect(aiBtn.textContent).toBe('✨ AI 推荐');
    vi.useRealTimers();
  });

  it('AI 失败 → 「AI 推荐失败，请手动选择」', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    await initApp(vault);
    (global as any).fetch = vi.fn().mockRejectedValue(new Error('网络错误'));
    UIManager.showAddDialog(null);
    const content = document.getElementById('add-todo-content') as HTMLInputElement;
    content.value = '测试内容';
    (document.getElementById('add-todo-ai-recommend') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(MockNotice.instances.some((n) => n.message.includes('AI 推荐失败，请手动选择'))).toBe(true);
    vi.useRealTimers();
  });

  it('推荐场景不在列表 → 提示手动选择', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    await initApp(vault);
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseBody('{"scene": "不存在场景", "priority": "重要"}'),
    });
    UIManager.showAddDialog(null);
    (document.getElementById('add-todo-content') as HTMLInputElement).value = 'x';
    (document.getElementById('add-todo-ai-recommend') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(MockNotice.instances.some((n) => n.message.includes('不在可选列表中'))).toBe(true);
    vi.useRealTimers();
  });

  it('内容为空点 AI 推荐 → 「请先输入备忘录内容」', async () => {
    const vault = new MockVault();
    await initApp(vault);
    UIManager.showAddDialog(null);
    (document.getElementById('add-todo-ai-recommend') as HTMLButtonElement).click();
    expect(MockNotice.instances.some((n) => n.message === '请先输入备忘录内容')).toBe(true);
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
    expect(MockNotice.instances.some((n) => n.message === '无法获取当前位置')).toBe(true);
  });

  it('URL 内容保存时自动提取 url 字段', async () => {
    vi.useFakeTimers();
    const vault = new MockVault();
    await initApp(vault);
    UIManager.showAddDialog(null);
    (document.getElementById('add-todo-content') as HTMLInputElement).value = 'https://example.com/page 示例页';
    (document.getElementById('add-todo-save') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(50);
    const items = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(items[0].url).toBe('https://example.com/page');
    expect(items[0].title).toBe('示例页'); // display 作为标题
    vi.useRealTimers();
  });
});
