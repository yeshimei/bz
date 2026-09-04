/**
 * 待办（todo）UI 层测试：面板结构/场景栏/编辑器场景联动/添加场景弹窗/右键菜单/勾选完成
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
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

/** 动态日期（相对今天）：测试不随运行日历漂移（「今日」口径 / 30 天时间界依赖） */
function at(dayOffset: number, hm: string): string {
  return moment().add(dayOffset, 'days').format(`YYYY-MM-DD ${hm}:00`);
}

function seedVault(): { vault: MockVault; app: ReturnType<typeof mockAppWithVault>; settings: any; saveSpy: ReturnType<typeof vi.fn> } {
  const vault = new MockVault();
  const items = [
    { id: 'a', title: '完成阅读报告', scene: '学习', priority: 'important', created: at(-3, '10:00'), completed: null, due: at(0, '09:00') },
    { id: 'b', title: 'ffmpeg 转写参数整理', scene: '代码', priority: 'minor', created: at(-2, '09:00'), completed: null, due: null, scriptName: 'transcribe.py' },
    { id: 'c', title: '给影评加封面', scene: '剪藏', priority: 'minor', created: at(-1, '08:00'), completed: null, due: at(0, '10:00'), url: 'https://example.com/x' },
    { id: 'd', title: '重看注意力机制', scene: '公开课', priority: 'minor', created: at(-3, '12:00'), completed: at(-1, '11:00'), due: null, courseName: '《动手学深度学习》' },
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

/** 向 vault 追加条目（打开面板前注入，测「今日只看今天」/30 天时间界） */
function pushItem(vault: MockVault, item: Record<string, unknown>): void {
  const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
  raw.push(item);
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(raw, null, 2));
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
    // 桌面左栏场景：全部/今日/重要 + 6 默认场景；移动横滑条同 9
    const navItems = overlay.querySelectorAll('[data-todo-nav] [data-todo-scene]');
    expect(navItems.length).toBe(9);
    expect(overlay.querySelectorAll('[data-todo-mob-scenes] [data-todo-scene]').length).toBe(9);
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

describe('todo 增强包（场景工作台已拍板项）', () => {
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

  /** 在浮层菜单/抽屉中按文案点菜单项 */
  function menuItems(): HTMLElement[] {
    return [...document.querySelectorAll('.bz-item-menu-item')] as HTMLElement[];
  }
  function clickMenuItem(label: string): void {
    const hit = menuItems().find((b) => b.querySelector('.bz-item-menu-label')?.textContent === label);
    expect(hit, `菜单项「${label}」应存在`).toBeTruthy();
    (hit as HTMLElement).click();
  }

  it('「重要」伪场景：跨场景聚合 star 条目（star 图标 + 警示色点，范式照「今日」）', async () => {
    const { app } = seedVault();
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-scene="重要"]')).toBeTruthy();
    });
    const impBtn = document.querySelector('[data-todo-scene="重要"]') as HTMLElement;
    // star 图标（mountIcons → setIcon mock 记 data-icon）+ 警示色点
    expect(impBtn.querySelector('[data-icon="star"]')).toBeTruthy();
    expect(impBtn.querySelector('.bz-todo-nav-dot')).toBeTruthy();
    // 计数：未完成重要项仅 a（已完成次要项 d 不算）
    expect(impBtn.querySelector('.bz-todo-nav-cnt')?.textContent).toBe('1');
    impBtn.click();
    await vi.waitFor(() => {
      const cards = document.querySelectorAll('.bz-todo-card');
      expect(cards.length).toBe(1);
      expect(cards[0].textContent).toContain('完成阅读报告');
    });
    // 主头行计数与伪场景同口径
    expect((document.querySelector('[data-todo-main-count]') as HTMLElement).textContent).toContain('1 项');
  });

  it('「今日」口径改只看今天：已完成区仅今天完成的，历史完成不显示', async () => {
    const { vault, app } = seedVault();
    pushItem(vault, { id: 'e', title: '今天补完的逾期项', scene: '生活', priority: 'minor', created: at(-1, '10:00'), completed: at(0, '09:00') });
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-scene="今日"]')).toBeTruthy();
    });
    (document.querySelector('[data-todo-scene="今日"]') as HTMLElement).click();
    await vi.waitFor(() => {
      // 未完成：a/c 今天到期；昨天完成的 d 不再放行
      expect(document.querySelectorAll('.bz-todo-card').length).toBe(2);
    });
    const bar = document.querySelector('.bz-todo-donebar') as HTMLElement;
    bar.click();
    await vi.waitFor(() => {
      const doneCards = document.querySelectorAll('.bz-todo-card.bz-todo-done');
      expect(doneCards.length).toBe(1); // 只有今天完成的 e
      expect(doneCards[0].textContent).toContain('今天补完的逾期项');
    });
    expect(document.body.textContent).not.toContain('重看注意力机制'); // 历史完成去「全部」看
  });

  it('「今日」与计数口径对齐：nav 徽标 = 主头行总项数（未完成到期 + 今天完成）', async () => {
    const { vault, app } = seedVault();
    pushItem(vault, { id: 'e', title: '今天补完的逾期项', scene: '生活', priority: 'minor', created: at(-1, '10:00'), completed: at(0, '09:00') });
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-scene="今日"]')).toBeTruthy();
    });
    (document.querySelector('[data-todo-scene="今日"]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-todo-card').length).toBe(2);
    });
    const navBtn = document.querySelector('[data-todo-scene="今日"]') as HTMLElement;
    expect(navBtn.querySelector('.bz-todo-nav-cnt')?.textContent).toBe('3'); // a + c + e
    const count = (document.querySelector('[data-todo-main-count]') as HTMLElement).textContent!;
    expect(count).toContain('3 项');
    expect(count).toContain('2 未完成');
  });

  it('已完成折叠时间界：展开默认只列近 30 天，尾部「更早 N 条」放全', async () => {
    const { vault, app } = seedVault();
    pushItem(vault, { id: 'f', title: '四十天前的旧账', scene: '工作', priority: 'minor', created: at(-41, '10:00'), completed: at(-40, '10:00') });
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-donebar')).toBeTruthy();
    });
    (document.querySelector('.bz-todo-donebar') as HTMLElement).click();
    await vi.waitFor(() => {
      // 展开：只列近 30 天（d 昨天 + e 今天注入前为 1 条 d），40 天前的 f 不列
      const doneCards = document.querySelectorAll('.bz-todo-card.bz-todo-done');
      expect(doneCards.length).toBe(1);
      expect(doneCards[0].textContent).toContain('重看注意力机制');
      expect(document.body.textContent).not.toContain('四十天前的旧账');
    });
    const more = document.querySelector('[data-todo-donemore]') as HTMLElement;
    expect(more.textContent).toContain('更早 1 条');
    more.click();
    await vi.waitFor(() => {
      const doneCards = document.querySelectorAll('.bz-todo-card.bz-todo-done');
      expect(doneCards.length).toBe(2);
      expect(doneCards[1].textContent).toContain('四十天前的旧账');
    });
    expect(document.querySelector('[data-todo-donemore]')).toBeNull();
  });

  it('删除接撤销：三段式确认框 + notifyUndo 撤销后条目插回原位', async () => {
    const { vault, app } = seedVault();
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-card[data-todo-id="b"]')).toBeTruthy();
    });
    // 右键条目 b → 菜单 → 删除
    const card = document.querySelector('.bz-todo-card[data-todo-id="b"]') as HTMLElement;
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-item-menu')).toBeTruthy();
    });
    clickMenuItem('删除');
    // 三段式确认框：标题「删除待办」+ 问句（「」引号）+ 后果说明
    await vi.waitFor(() => {
      expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy();
    });
    const popup = document.getElementById('__shared_confirm_popup__') as HTMLElement;
    expect(popup.querySelector('h4')?.textContent).toBe('删除待办');
    const msg = popup.querySelector('p')?.textContent || '';
    expect(msg).toContain('确定删除待办「ffmpeg 转写参数整理」吗');
    expect(msg).toContain('撤销');
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw.find((r: any) => r.id === 'b')).toBeUndefined();
    });
    // 删除 toast 挂「撤销」按钮
    await vi.waitFor(() => {
      const undo = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '撤销');
      expect(undo).toBeTruthy();
    });
    [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '撤销')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // 撤销后插回原位（原始文件序 [a,b,c,d]，b 回 idx=1）
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw.map((r: any) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  it('composer 补全半径：保存 toast 挂「补全」action 直开该条编辑器', async () => {
    const { app } = seedVault();
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-composer-input]')).toBeTruthy();
    });
    const input = document.querySelector('[data-todo-composer-input]') as HTMLInputElement;
    input.value = '带补全半径的录入';
    (document.querySelector('[data-todo-composer-add]') as HTMLElement).click();
    await vi.waitFor(() => {
      const act = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '补全');
      expect(act).toBeTruthy();
    });
    ([...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '补全') as HTMLElement).click();
    await vi.waitFor(() => {
      const editor = document.querySelector('.bz-todo-editor') as HTMLElement;
      expect(editor).toBeTruthy();
      expect((editor.querySelector('textarea') as HTMLTextAreaElement).value).toBe('带补全半径的录入');
    });
  });

  it('录入当场可见：「今日」视图 composer 保存后新条目置顶出现（场景兜底 memoDefaultScene）', async () => {
    const { vault, app, settings } = seedVault();
    settings.memoDefaultScene = '代码'; // composer 场景缺省兜底 = 设置值
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-scene="今日"]')).toBeTruthy();
    });
    (document.querySelector('[data-todo-scene="今日"]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-todo-card').length).toBe(2);
    });
    const input = document.querySelector('[data-todo-composer-input]') as HTMLInputElement;
    input.value = '临时记一笔';
    (document.querySelector('[data-todo-composer-add]') as HTMLElement).click();
    await vi.waitFor(() => {
      const cards = [...document.querySelectorAll('.bz-todo-card')];
      expect(cards.some((c) => c.textContent?.includes('临时记一笔'))).toBe(true); // 无到期也当场可见
    });
    // 场景兜底用 memoDefaultScene（非第一个场景）
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw.find((r: any) => r.title === '临时记一笔').scene).toBe('代码');
  });

  it('空态升级：.bz-empty 三件套（图标 + 一句话 + 「新建待办」动作按钮）', async () => {
    const { app } = seedVault();
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.bz-todo-card').length).toBe(3);
    });
    const inp = document.querySelector('[data-todo-search]') as HTMLInputElement;
    inp.value = '绝对不存在的关键词';
    inp.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250));
    const empty = document.querySelector('.bz-empty') as HTMLElement;
    expect(empty).toBeTruthy();
    expect(empty.querySelector('.bz-empty-ic')).toBeTruthy();
    expect(empty.querySelector('.bz-empty-title')?.textContent).toBe('没有匹配的待办');
    const cta = empty.querySelector('.bz-btn') as HTMLElement;
    expect(cta.textContent).toContain('新建待办');
    cta.click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-editor')).toBeTruthy();
    });
  });

  it('场景项右键菜单：在设置中编辑 / 重命名（批量改条目 + 设置串）/ 删除场景', async () => {
    const { vault, app, settings } = seedVault();
    pushItem(vault, { id: 'g', title: '工作场景条目', scene: '工作', priority: 'minor', created: at(-1, '10:00'), completed: null });
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-nav] [data-todo-scene="工作"]')).toBeTruthy();
    });
    const navBtn = document.querySelector('[data-todo-nav] [data-todo-scene="工作"]') as HTMLElement;
    navBtn.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 }));
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-item-menu')).toBeTruthy();
    });
    const labels = menuItems().map((b) => b.querySelector('.bz-item-menu-label')?.textContent);
    expect(labels).toContain('在设置中编辑');
    expect(labels).toContain('重命名');
    expect(labels).toContain('删除场景');
    // 重命名 工作 → 职场：条目 scene 批量迁移 + memoScenarios 设置串更新（与旧 memo 共用）
    clickMenuItem('重命名');
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-addscene')).toBeTruthy();
    });
    const wrap = document.querySelector('.bz-todo-addscene') as HTMLElement;
    const input = wrap.querySelector('.bz-input') as HTMLInputElement;
    expect(input.value).toBe('工作');
    input.value = '职场';
    (wrap.querySelector('.bz-btn--primary') as HTMLElement).click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw.find((r: any) => r.id === 'g').scene).toBe('职场');
    });
    expect(settings.memoScenarios).toBe('剪藏,职场,学习,生活,代码,公开课');
    // 左栏即时出现新场景名
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-scene="职场"]')).toBeTruthy();
    });
  });

  it('删除场景：非空条目确认后迁入默认场景并移出设置串', async () => {
    const { vault, app, settings } = seedVault();
    pushItem(vault, { id: 'g', title: '工作场景条目', scene: '工作', priority: 'minor', created: at(-1, '10:00'), completed: null });
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-nav] [data-todo-scene="工作"]')).toBeTruthy();
    });
    const navBtn = document.querySelector('[data-todo-nav] [data-todo-scene="工作"]') as HTMLElement;
    navBtn.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 }));
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-item-menu')).toBeTruthy();
    });
    clickMenuItem('删除场景');
    await vi.waitFor(() => {
      expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy();
    });
    const popup = document.getElementById('__shared_confirm_popup__') as HTMLElement;
    const msg = popup.querySelector('p')?.textContent || '';
    expect(msg).toContain('确定删除场景「工作」吗');
    expect(msg).toContain('1 条待办将迁入默认场景「剪藏」'); // memoDefaultScene 未设 → 兜底其余第一个
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw.find((r: any) => r.id === 'g').scene).toBe('剪藏');
    });
    expect(settings.memoScenarios).not.toContain('工作');
  });

  it('设置 schema：移动端组不写描述（对齐其余域铁律）', async () => {
    const { app } = seedVault();
    const { todoSettingsSchema } = await import('../../src/todo/settings');
    const schema = todoSettingsSchema();
    const mob = schema.groups.find((g) => g.name === '移动端');
    expect(mob).toBeTruthy();
    expect((mob!.rows[0] as any).name).toBe('移动端默认全屏');
    expect((mob!.rows[0] as any).desc).toBeUndefined();
    void app;
  });
});
