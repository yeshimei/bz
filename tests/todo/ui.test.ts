/**
 * 待办（todo）UI 层测试：面板结构/场景栏/编辑器场景联动/添加场景弹窗/右键菜单/勾选完成
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, Platform as MockPlatform } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { M, resetTodoState } from '../../src/todo/state';
import { openTodoPanel, closeTodoPanel, addTodo, openEditor } from '../../src/todo/ui';
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
  cinemaFolderPath: '我的/影视',
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

  it('桌面尺寸记忆（ADR-0084）：有记忆值时打开即套用记忆宽高', async () => {
    const { app, settings } = seedVault();
    settings.todoPanelWidth = 900;
    settings.todoPanelHeight = 650;
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-panel')).toBeTruthy();
    });
    const panel = document.querySelector('.bz-todo-panel') as HTMLElement;
    expect(panel.style.width).toBe('900px');
    expect(panel.style.height).toBe('650px');
  });

  it('桌面尺寸记忆（ADR-0084）：记忆值超视口 92% 时打开即钳到上限', async () => {
    const { app, settings } = seedVault();
    settings.todoPanelWidth = 5000;
    settings.todoPanelHeight = 5000;
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-panel')).toBeTruthy();
    });
    const panel = document.querySelector('.bz-todo-panel') as HTMLElement;
    // jsdom 视口 1024×768 → 92% = 942×706
    expect(panel.style.width).toBe('942px');
    expect(panel.style.height).toBe('706px');
  });

  it('桌面尺寸记忆（ADR-0084）：拖动右缘 → 写回 settings 并保存', async () => {
    const { app, settings, saveSpy } = seedVault();
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-panel')).toBeTruthy();
    });
    const panel = document.querySelector('.bz-todo-panel') as HTMLElement;
    // jsdom 无布局：mock rect 给面板真实尺寸（右缘在 x=720）
    const rect = { width: 720, height: 580, left: 0, top: 0 };
    panel.getBoundingClientRect = () => rect as DOMRect;
    // 右缘（内偏 1px）按下 + 拖宽到 900
    panel.dispatchEvent(new MouseEvent('mousedown', { clientX: 719, clientY: 300, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 900, clientY: 300, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 900, clientY: 300, bubbles: true }));
    await vi.waitFor(() => {
      expect(settings.todoPanelWidth).toBe(901);
    });
    expect(settings.todoPanelHeight).toBe(580);
    // T2：resize 落盘走 150ms trailing 防抖——等待防抖窗口后 save 被调用
    await vi.waitFor(() => {
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  it('移动端：不写内联宽高（满屏规则由 CSS 媒体查询接管，内联样式不再压成小卡）', async () => {
    const { app, settings } = seedVault();
    settings.todoPanelWidth = 900;
    settings.todoPanelHeight = 650;
    MockPlatform.isMobile = true;
    try {
      openTodoPanel(app);
      await vi.waitFor(() => {
        expect(document.querySelector('.bz-todo-panel')).toBeTruthy();
      });
      const panel = document.querySelector('.bz-todo-panel') as HTMLElement;
      expect(panel.style.width).toBe('');
      expect(panel.style.height).toBe('');
    } finally {
      MockPlatform.isMobile = false;
    }
  });

  it('设置播种：memoSortMode/memoShowArchivedByDefault 打开面板时初始化排序与已完成折叠区', async () => {
    const { app, settings } = seedVault();
    settings.memoSortMode = 'created';
    settings.memoShowArchivedByDefault = true;
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-card')).toBeTruthy();
    });
    expect(M.sortMode).toBe('created');
    expect(M.showDone).toBe(true);
    // 按创建排序生效（created 降序：最新的「给影评加封面」在前）+ 已完成折叠区展开（4 卡全显）
    const cards = document.querySelectorAll('.bz-todo-card');
    expect(cards.length).toBe(4);
    expect(cards[0].textContent).toContain('给影评加封面');
  });

  it('设置播种：非法 memoSortMode 回退紧急优先；memoShowArchivedByDefault 缺省折叠', async () => {
    const { app, settings } = seedVault();
    settings.memoSortMode = 'bogus';
    delete (settings as any).memoShowArchivedByDefault;
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-card')).toBeTruthy();
    });
    expect(M.sortMode).toBe('priority');
    expect(M.showDone).toBe(false);
    // 已完成折叠区默认收起：3 张未完成卡
    expect(document.querySelectorAll('.bz-todo-card').length).toBe(3);
  });

  it('搜索防抖 180ms：防抖窗口内不重渲，窗口后过滤生效（修复前每键全量重渲且注释称 250ms）', async () => {
    const { app } = seedVault();
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-todo-card').length).toBe(3);
    });
    const inp = document.querySelector('[data-todo-search]') as HTMLInputElement;
    inp.value = 'ffmpeg';
    inp.dispatchEvent(new Event('input'));
    // 防抖窗口内：列表未过滤（仍 3 张未完成卡）
    expect(document.querySelectorAll('.bz-todo-card').length).toBe(3);
    await new Promise((r) => setTimeout(r, 250));
    expect(document.querySelectorAll('.bz-todo-card').length).toBe(1);
    expect(document.querySelectorAll('.bz-todo-card')[0].textContent).toContain('ffmpeg 转写参数整理');
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

  it('公开课新建：点课程建议 → 保存写入 courseName + coursePath（memo 面板课程标签可跳转）', async () => {
    const { app, vault } = seedVault();
    // 公开课笔记（影视目录 + 公开课标签）→ getCourseNotes 数据源
    vault.files.set('我的/影视/动手学深度学习.md', '---\ntags: [公开课]\n---\n\n课程笔记');
    addTodo(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-editor')).toBeTruthy();
    });
    const editor = document.querySelector('.bz-todo-editor') as HTMLElement;
    const contentInput = editor.querySelector('textarea') as HTMLTextAreaElement;
    contentInput.value = '看完第三课';
    // 切公开课
    const courseBtn0 = [...editor.querySelectorAll('.bz-choice-btn')].find((b) => b.textContent === '公开课') as HTMLElement;
    courseBtn0.click();
    const courseInput = editor.querySelectorAll('.bz-todo-extra')[2].querySelector('input') as HTMLInputElement;
    // 等异步课程建议装载后输入过滤
    courseInput.value = '动手学';
    courseInput.dispatchEvent(new Event('input'));
    await vi.waitFor(() => {
      expect(courseInput.parentElement!.querySelector('.bz-todo-sug-item')).toBeTruthy();
    });
    const sug = [...editor.querySelectorAll('.bz-todo-sug-item')].find((b) => b.textContent === '动手学深度学习') as HTMLElement;
    sug.click();
    expect(courseInput.value).toBe('动手学深度学习');
    const saveBtn = [...editor.querySelectorAll('.bz-btn')].find((b) => b.textContent?.includes('添加')) as HTMLElement;
    saveBtn.click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-editor')).toBeNull();
    });
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw[0].scene).toBe('公开课');
    expect(raw[0].courseName).toBe('动手学深度学习');
    expect(raw[0].coursePath).toBe('我的/影视/动手学深度学习.md');
  });

  it('公开课编辑：点建议回填 coursePath 落盘；清空课程名后 coursePath 一并清空', async () => {
    const { app, vault } = seedVault();
    vault.files.set('我的/影视/动手学深度学习.md', '---\ntags: [公开课]\n---\n\n课程笔记');
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(M.items.length).toBeGreaterThan(0);
    });
    // 编辑既有公开课条目 d（courseName《动手学深度学习》，无 coursePath）
    openEditor(M.items.find((i) => i.id === 'd')!);
    let editor = document.querySelector('.bz-todo-editor') as HTMLElement;
    expect(editor).toBeTruthy();
    const courseInput = editor.querySelectorAll('.bz-todo-extra')[2].querySelector('input') as HTMLInputElement;
    // 触发建议（异步课程建议装载后可见）→ 点笔记名建议（覆盖原书名号名）
    courseInput.value = '动手学';
    courseInput.dispatchEvent(new Event('input'));
    await vi.waitFor(() => {
      return [...editor.querySelectorAll('.bz-todo-sug-item')].some((b) => b.textContent === '动手学深度学习');
    });
    const sug = [...editor.querySelectorAll('.bz-todo-sug-item')].find((b) => b.textContent === '动手学深度学习') as HTMLElement;
    sug.click();
    expect(courseInput.value).toBe('动手学深度学习');
    const saveBtn = [...editor.querySelectorAll('.bz-btn')].find((b) => b.textContent?.includes('保存')) as HTMLElement;
    saveBtn.click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-editor')).toBeNull();
    });
    let raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw.find((r: any) => r.id === 'd').coursePath).toBe('我的/影视/动手学深度学习.md');
    // 再编辑：清掉课程名 → coursePath 一并清空（不残留旧 path）
    M.items = await TodoData.loadItems();
    openEditor(M.items.find((i) => i.id === 'd')!);
    editor = document.querySelector('.bz-todo-editor') as HTMLElement;
    const courseInput2 = editor.querySelectorAll('.bz-todo-extra')[2].querySelector('input') as HTMLInputElement;
    courseInput2.value = '';
    const saveBtn2 = [...editor.querySelectorAll('.bz-btn')].find((b) => b.textContent?.includes('保存')) as HTMLElement;
    saveBtn2.click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-editor')).toBeNull();
    });
    raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    const dAfter = raw.find((r: any) => r.id === 'd');
    expect(dAfter.courseName).toBeNull();
    expect(dAfter.coursePath).toBeNull();
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
