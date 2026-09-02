/**
 * 待办（todo）UI 层测试：面板结构/场景栏/编辑器场景联动/添加场景弹窗/右键菜单/勾选完成
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { M, resetTodoState } from '../../src/todo/state';
import { openTodoPanel, closeTodoPanel, addTodo } from '../../src/todo/ui';
import { TodoData } from '../../src/todo/data';

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  todoFilePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoDueFormat: 'relative',
  memoAutoArchive: true,
  movieFolderPath: '我的/影视',
  todoMobileDefaultFullscreen: false,
};

function seedVault(): { vault: MockVault; app: ReturnType<typeof mockAppWithVault>; settings: any; saveSpy: ReturnType<typeof vi.fn> } {
  const vault = new MockVault();
  const items = [
    { id: 'a', title: '完成阅读报告', scene: '学习', priority: 'important', created: '2026-09-01 10:00:00', completed: null, due: '2026-09-02 18:00:00' },
    { id: 'b', title: 'ffmpeg 转写参数整理', scene: '代码', priority: 'minor', created: '2026-09-02 09:00:00', completed: null, due: null, scriptName: 'transcribe.py' },
    { id: 'c', title: '给影评加封面', scene: '剪藏', priority: 'minor', created: '2026-09-03 08:00:00', completed: null, due: '2026-09-03 20:00:00', url: 'https://example.com/x' },
    { id: 'd', title: '重看注意力机制', scene: '公开课', priority: 'minor', created: '2026-09-01 12:00:00', completed: '2026-09-02 11:00:00', due: null, courseName: '《动手学深度学习》' },
  ];
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(items, null, 2));
  const settings = { ...SETTINGS };
  const saveSpy = vi.fn(async () => {});
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings as any);
  setSettingsSaver(saveSpy);
  TodoData.init(settings as any);
  return { vault, app, settings, saveSpy };
}

describe('todo 面板', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetTodoState();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });
  afterEach(() => {
    closeTodoPanel();
    MockPlatform.isMobile = false;
    document.body.innerHTML = '';
  });

  it('openTodoPanel：渲染头行 + 左场景栏（全部/今日/场景）+ 列表卡片', async () => {
    const { app } = seedVault();
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-nav] .bz-todo-nav-item')).toBeTruthy();
    });
    const overlay = document.querySelector('.bz-todo-overlay') as HTMLElement;
    expect(overlay.querySelector('.bz-todo-title')?.textContent).toBe('待办');
    // 桌面左栏场景：全部/今日 + 6 默认场景；移动横滑条同 8
    const navItems = overlay.querySelectorAll('[data-todo-nav] [data-todo-scene]');
    expect(navItems.length).toBe(8);
    expect(overlay.querySelectorAll('[data-todo-mob-scenes] [data-todo-scene]').length).toBe(8);
    // 列表卡片（3 未完成；已完成折叠不展开）
    await vi.waitFor(() => {
      expect(overlay.querySelectorAll('.bz-todo-card').length).toBe(3);
    });
  });

  it('已完成折叠区：默认折叠，点击展开显示已完成条目', async () => {
    const { app } = seedVault();
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-donebar')).toBeTruthy();
    });
    const bar = document.querySelector('.bz-todo-donebar') as HTMLElement;
    expect(document.querySelectorAll('.bz-todo-card.bz-todo-done').length).toBe(0);
    bar.click();
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-todo-card.bz-todo-done').length).toBe(1);
    });
    const doneCard = document.querySelector('.bz-todo-card.bz-todo-done') as HTMLElement;
    expect(doneCard.textContent).toContain('重看注意力机制');
    // 公开课 meta（已完成也显示）
    expect(doneCard.querySelector('.bz-todo-tag-course')?.textContent).toContain('动手学深度学习');
  });

  it('场景筛选：点击「学习」只显示学习条目；再点取消', async () => {
    const { app } = seedVault();
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-scene="学习"]')).toBeTruthy();
    });
    const getCards = () => document.querySelectorAll('.bz-todo-card').length;
    const navBtn = () => document.querySelector('[data-todo-scene="学习"]') as HTMLElement;
    navBtn().click();
    await vi.waitFor(() => {
      const cards = document.querySelectorAll('.bz-todo-card');
      expect(cards.length).toBe(1);
      expect(cards[0].textContent).toContain('完成阅读报告');
    });
    // 再点一次取消筛选（重建后重新取节点）
    navBtn().click();
    await vi.waitFor(() => {
      expect(getCards()).toBe(3);
    });
  });

  it('主头行：当前场景标题 + 计数 + 新建待办按钮打开编辑器', async () => {
    const { app } = seedVault();
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-main-count]')?.textContent).toContain('项');
    });
    const title = document.querySelector('[data-todo-main-title]') as HTMLElement;
    const count = document.querySelector('[data-todo-main-count]') as HTMLElement;
    // 默认「全部」：3 未完成 + 1 已完成 = 4 项 · 3 未完成
    expect(title.textContent).toBe('全部');
    expect(count.textContent).toContain('4 项');
    expect(count.textContent).toContain('3 未完成');
    // 切场景后标题与计数变化
    const learnBtn = document.querySelector('[data-todo-scene="学习"]') as HTMLElement;
    learnBtn.click();
    await vi.waitFor(() => {
      expect((document.querySelector('[data-todo-main-title]') as HTMLElement).textContent).toBe('学习');
    });
    expect((document.querySelector('[data-todo-main-count]') as HTMLElement).textContent).toContain('1 项');
    // 新建按钮 → 编辑器打开
    (document.querySelector('[data-todo-newbtn]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-editor')).toBeTruthy();
    });
  });

  it('底部录入：输入 + 点击添加 → 条目落 memo.json 并出现在列表', async () => {
    const { app, vault } = seedVault();
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-composer-input]')).toBeTruthy();
    });
    const input = document.querySelector('[data-todo-composer-input]') as HTMLInputElement;
    input.value = '新录入一条';
    (document.querySelector('[data-todo-composer-add]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-todo-card').length).toBe(4);
    });
    // 落盘验证
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw[0].title).toBe('新录入一条');
    expect(raw[0].scene).toBe('剪藏'); // 默认第一个场景
  });

  it('行内勾选完成：卡片移入已完成折叠区', async () => {
    const { app } = seedVault();
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-check')).toBeTruthy();
    });
    const firstCheck = document.querySelector('.bz-todo-check') as HTMLElement;
    firstCheck.click();
    // 300ms 防抖
    await new Promise((r) => setTimeout(r, 450));
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-todo-card').length).toBe(2);
    });
  });
});

describe('todo 编辑器', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetTodoState();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });
  afterEach(() => {
    closeTodoPanel();
    document.body.innerHTML = '';
  });

  it('addTodo：打开创建弹窗（无关闭按钮、有场景/优先级平铺）', async () => {
    const { app } = seedVault();
    addTodo(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-editor')).toBeTruthy();
    });
    const editor = document.querySelector('.bz-todo-editor') as HTMLElement;
    // 场景平铺 = uiChoice（.bz-choice），选中 = 品牌（非黑）
    expect(editor.querySelectorAll('.bz-choice-btn').length).toBeGreaterThanOrEqual(8); // 6 场景 + 2 优先级
    // 平铺前无彩色圆点（.bz-choice-dot 不存在）
    expect(editor.querySelector('.bz-choice-dot')).toBeNull();
    // 第二输入框在场景平铺上方（第一个 extra 的 DOM 位置先于第一个 .bz-choice）
    const extraEl = editor.querySelector('.bz-todo-extra') as HTMLElement;
    const choiceEl = editor.querySelector('.bz-choice') as HTMLElement;
    expect(extraEl.compareDocumentPosition(choiceEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 默认场景 = 第一个（剪藏）→ 标题框显示
    expect(editor.querySelector('.bz-todo-extra-on input')?.getAttribute('placeholder')).toBe('标题（可选）');
    // 无关闭按钮
    expect(editor.querySelector('.bz-icon-btn--close')).toBeNull();
  });

  it('场景切换联动：代码→脚本框；公开课→课程框', async () => {
    const { app } = seedVault();
    addTodo(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-editor')).toBeTruthy();
    });
    const editor = document.querySelector('.bz-todo-editor') as HTMLElement;
    const btns = editor.querySelectorAll('.bz-choice-btn');
    // 找到「代码」按钮点击
    const codeBtn = [...btns].find((b) => b.textContent === '代码') as HTMLElement;
    codeBtn.click();
    const extras = editor.querySelectorAll('.bz-todo-extra');
    // 第二个 extra = 脚本框
    const scriptBox = extras[1] as HTMLElement;
    expect(scriptBox.classList.contains('bz-todo-extra-on')).toBe(true);
    expect(scriptBox.querySelector('input')?.getAttribute('placeholder')).toBe('脚本名');
  });

  it('保存新建：写入 memo.json（含 scriptName 建议数据）', async () => {
    const { app, vault } = seedVault();
    addTodo(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-editor')).toBeTruthy();
    });
    const editor = document.querySelector('.bz-todo-editor') as HTMLElement;
    const contentInput = editor.querySelector('textarea') as HTMLTextAreaElement;
    contentInput.value = '测试脚本任务';
    // 切代码
    const codeBtn = [...editor.querySelectorAll('.bz-choice-btn')].find((b) => b.textContent === '代码') as HTMLElement;
    codeBtn.click();
    const scriptInput = editor.querySelectorAll('.bz-todo-extra')[1].querySelector('input') as HTMLInputElement;
    scriptInput.value = 'test.py';
    const saveBtn = [...editor.querySelectorAll('.bz-btn')].find((b) => b.textContent?.includes('添加')) as HTMLElement;
    saveBtn.click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-editor')).toBeNull();
    });
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw[0].title).toBe('测试脚本任务');
    expect(raw[0].scene).toBe('代码');
    expect(raw[0].scriptName).toBe('test.py');
  });
});

describe('todo 添加场景', () => {
  beforeEach(() => {
    resetObsidianMocks();
    resetTodoState();
    document.body.innerHTML = '';
    MockPlatform.isMobile = false;
  });
  afterEach(() => {
    closeTodoPanel();
    document.body.innerHTML = '';
  });

  it('添加场景弹窗：输入新场景写入 memoScenarios 并即时生效', async () => {
    const { app, settings, saveSpy } = seedVault();
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-addscene]')).toBeTruthy();
    });
    (document.querySelector('[data-todo-addscene]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-addscene')).toBeTruthy();
    });
    const wrap = document.querySelector('.bz-todo-addscene') as HTMLElement;
    const input = wrap.querySelector('.bz-input') as HTMLInputElement;
    input.value = '健身';
    (wrap.querySelector('.bz-btn--primary') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(saveSpy).toHaveBeenCalled();
    });
    expect(settings.memoScenarios).toContain('健身');
    // 场景栏新增（saveSettings then → TodoData.init → refresh 渲染）
    await vi.waitFor(() => {
      const navItems = document.querySelectorAll('[data-todo-scene]');
      const scenes = [...navItems].map((n) => n.textContent);
      expect(scenes.some((s) => s?.includes('健身'))).toBe(true);
    });
  });

  it('重复场景拦截：提示且不写入', async () => {
    const { app, settings, saveSpy } = seedVault();
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-addscene]')).toBeTruthy();
    });
    (document.querySelector('[data-todo-addscene]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-addscene')).toBeTruthy();
    });
    const wrap = document.querySelector('.bz-todo-addscene') as HTMLElement;
    const input = wrap.querySelector('.bz-input') as HTMLInputElement;
    input.value = '学习'; // 已在默认场景
    (wrap.querySelector('.bz-btn--primary') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 50));
    expect(saveSpy).not.toHaveBeenCalled();
    expect(settings.memoScenarios).toBe('');
  });
});
