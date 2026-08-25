/**
 * 备忘录 UI 补测（覆盖率目标）：_handleAddSave 字段收集全分支（占位符回填/剪贴板 URL/
 * 场景与优先级缺省/代码脚本名/公开课课程名两种来源）、编辑写回与脏数据兜底、
 * 截止日期清除、场景切换剪贴板预填（含 fetchPageTitle 与拒绝路径）、ESC 共享确认遮罩优先、
 * Renderer 排序三模式与并列回退、打开动作（内部笔记/外部 URL 兜底）、建议列表过滤。
 * 兼容性冻结：只按现状断言，不改生产代码。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { setBzSettingsProvider } from '../../src/memo';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { App } from '../../src/memo/app';
import { UIManager, Renderer } from '../../src/memo/ui';
import { MockVault } from '../mock-vault';
import {
  resetObsidianMocks,
  getNoticeMessages,
  hasNotice,
  clearNotices,
  requestUrl as mockRequestUrl,
} from '../mock-obsidian-entry';
import { notifyMemoAction } from '../../src/smartcat';

vi.mock('../../src/smartcat', () => ({ notifyMemoAction: vi.fn() }));

const mockedNotify = vi.mocked(notifyMemoAction);

const SETTINGS = {
  todoFilePath: 'CONFIG/STORAGE',
  scenarios: '',
  showFileName: true,
  autoPopupOnStart: false,
  movieFolderPath: '我的/影视',
};

async function initApp(vault: MockVault) {
  const workspace = {
    on: vi.fn(() => ({ ref: 'file-open-ref' })),
    offref: vi.fn(),
    getLeaf: vi.fn(() => ({ openFile: vi.fn(async () => {}), view: null })),
    getActiveFile: () => null,
  };
  const app: any = { vault, workspace, metadataCache: { getFileCache: () => null }, commands: { removeCommand: vi.fn() } };
  setApp(app);
  setBzSettingsProvider(() => ({ ...SETTINGS }));
  setSettingsProvider(() => ({ ...SETTINGS }) as any);
  setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
  resetAIProviderCache();
  await App.init(SETTINGS);
  return app;
}

async function seedItems(vault: MockVault, items: any[]) {
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(items));
  await App.loadData();
}

function q<T extends HTMLElement>(sel: string): T {
  return document.querySelector(sel) as T;
}

/** 打开新建弹窗并切到指定场景 */
function openWithScene(scene: string | null) {
  UIManager.showAddDialog(null);
  if (scene) {
    const btn = [...document.querySelectorAll('#add-todo-scenes .scene-btn')].find(
      (b) => (b as HTMLElement).dataset.scene === scene
    ) as HTMLElement;
    btn.click();
  }
}

/** jsdom 无 clipboard：全局桩（readText 默认空串，用例内可改写返回值） */
const clipboardRead = vi.fn(async () => '');

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  localStorage.clear();
  clearNotices();
  mockedNotify.mockClear();
  clipboardRead.mockClear();
  Object.defineProperty(navigator, 'clipboard', {
    value: { readText: clipboardRead, writeText: vi.fn(async () => {}) },
    configurable: true,
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('_handleAddSave 字段收集分支', () => {
  it('内容为空但自定义占位符有 URL → 以占位符入库并提取 url/title', async () => {
    const vault = new MockVault();
    await initApp(vault);
    openWithScene('工作'); // 非剪藏场景会清空内容并还原默认占位符
    const content = q<HTMLTextAreaElement>('#add-todo-content');
    content.value = '';
    content.placeholder = 'https://example.com/a 示例页'; // 模拟剪藏预填残留
    q<HTMLButtonElement>('#add-todo-save').click();
    await vi.advanceTimersByTimeAsync(50);
    const items = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(items[0]).toMatchObject({ title: '示例页', url: 'https://example.com/a', scene: '工作' });
    expect(getNoticeMessages()).not.toContain('请输入内容');
  });

  it('rawClipboard 兜底：无占位符时从 rawClipboard 提取 URL 入库', async () => {
    const vault = new MockVault();
    await initApp(vault);
    openWithScene('剪藏');
    const content = q<HTMLTextAreaElement>('#add-todo-content');
    content.value = '';
    content.placeholder = '输入备忘录内容...'; // 默认占位符不参与回填
    content.dataset.rawClipboard = 'https://x.com/y 标题X';
    q<HTMLButtonElement>('#add-todo-save').click();
    await vi.advanceTimersByTimeAsync(50);
    const items = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    // 现状断言：rawClipboard 只回填 URL 本体，标题取自回填内容的 display（无尾随文本 = URL 原样）
    expect(items[0].title).toBe('https://x.com/y');
    expect(items[0].url).toBe('https://x.com/y');
  });

  it('彻底无内容 → 「请输入内容」；无选中场景 → 「请选择场景」', async () => {
    const vault = new MockVault();
    await initApp(vault);
    openWithScene(null);
    q<HTMLButtonElement>('#add-todo-save').click();
    await vi.advanceTimersByTimeAsync(20);
    expect(hasNotice('请输入内容')).toBe(true);

    // 有内容但清掉场景选中态
    q<HTMLTextAreaElement>('#add-todo-content').value = '有内容';
    document.querySelectorAll('#add-todo-scenes .scene-btn.active').forEach((b) => b.classList.remove('active'));
    q<HTMLButtonElement>('#add-todo-save').click();
    await vi.advanceTimersByTimeAsync(20);
    expect(hasNotice('请选择场景')).toBe(true);
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!)).toEqual([]);
  });

  it('代码场景带脚本名；公开课场景优先 data-path、其次按名称匹配建议表', async () => {
    const vault = new MockVault();
    await initApp(vault);
    // ① 代码 + 脚本名
    openWithScene('代码');
    q<HTMLInputElement>('#add-todo-script').value = 'build.sh';
    q<HTMLTextAreaElement>('#add-todo-content').value = '跑构建';
    q<HTMLButtonElement>('#add-todo-save').click();
    await vi.advanceTimersByTimeAsync(50);
    let items = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(items[0]).toMatchObject({ scene: '代码', scriptName: 'build.sh' });

    // ② 公开课 + dataset.coursePath
    openWithScene('公开课');
    const course = q<HTMLInputElement>('#add-todo-course');
    course.value = '课程甲';
    course.dataset.coursePath = '我的/影视/课程甲.md';
    q<HTMLTextAreaElement>('#add-todo-content').value = '看课';
    q<HTMLButtonElement>('#add-todo-save').click();
    await vi.advanceTimersByTimeAsync(50);
    items = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(items[0]).toMatchObject({ scene: '公开课', courseName: '课程甲', coursePath: '我的/影视/课程甲.md' });

    // ③ 公开课 无 dataset.coursePath → 按名称在建议表兜底匹配（大小写不敏感）
    openWithScene('公开课');
    UIManager.courseSuggestions = [{ name: 'Course B', path: '/b.md' }];
    const course2 = q<HTMLInputElement>('#add-todo-course');
    course2.value = 'course b';
    delete course2.dataset.coursePath;
    q<HTMLTextAreaElement>('#add-todo-content').value = '再看';
    q<HTMLButtonElement>('#add-todo-save').click();
    await vi.advanceTimersByTimeAsync(50);
    items = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(items[0]).toMatchObject({ courseName: 'course b', coursePath: '/b.md' });
  });

  it('编辑既有条目：updateItem 落盘 + edited 观察携带新旧值', async () => {
    const vault = new MockVault();
    await initApp(vault);
    await seedItems(vault, [
      { id: 'e1', title: '旧标题', scene: '学习', priority: 'minor', created: '2025-06-14 10:00:00', completed: null },
    ]);
    const target = App.state.todoItems.find((i) => i.id === 'e1')!;
    UIManager.showAddDialog(target);
    q<HTMLTextAreaElement>('#add-todo-content').value = '新标题';
    q<HTMLButtonElement>('#add-todo-save').click();
    await vi.advanceTimersByTimeAsync(50);
    const items = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(items[0].title).toBe('新标题');
    expect(mockedNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'edited',
        old: expect.objectContaining({ title: '旧标题', scene: '学习' }),
        next: expect.objectContaining({ title: '新标题', scene: '学习' }),
      })
    );
  });

  it('editingId 指向不存在的条目（脏数据）→ 「保存失败：条目不存在」', async () => {
    const vault = new MockVault();
    await initApp(vault);
    openWithScene('工作');
    q<HTMLTextAreaElement>('#add-todo-content').value = '幽灵条目';
    (UIManager as any).addEditingId = 'ghost-id';
    q<HTMLButtonElement>('#add-todo-save').click();
    await vi.advanceTimersByTimeAsync(50);
    expect(getNoticeMessages().some((m) => m.startsWith('保存失败：'))).toBe(true);
    expect(mockedNotify).not.toHaveBeenCalled();
  });
});

describe('添加弹窗交互细节', () => {
  it('截止日期：change 显隐 ✕ 清除按钮，点击清空并隐藏', async () => {
    const vault = new MockVault();
    await initApp(vault);
    openWithScene(null);
    const dueInput = q<HTMLInputElement>('#add-todo-due-input');
    const dueClear = q<HTMLButtonElement>('#add-todo-due-clear');
    expect(dueClear.style.display).toBe('none');
    dueInput.value = '2025-07-01T08:00';
    dueInput.dispatchEvent(new Event('change'));
    expect(dueClear.style.display).toBe('inline-block');
    dueClear.click();
    expect(dueInput.value).toBe('');
    expect(dueClear.style.display).toBe('none');
  });

  it('剪藏场景剪贴板预填：URL+标题拆分进两个占位符；纯 URL 触发 fetchPageTitle；读取失败静默', async () => {
    const vault = new MockVault();
    const app = await initApp(vault);
    (app as any).workspace.getActiveFile = () => null;

    // ① 带标题文本
    openWithScene(null);
    clipboardRead.mockResolvedValueOnce('https://example.com/page 示例页');
    const clipBtn = [...qAll('.scene-btn')].find((b) => (b as HTMLElement).dataset.scene === '剪藏')!;
    clipBtn.click();
    await vi.advanceTimersByTimeAsync(20);
    expect(q<HTMLTextAreaElement>('#add-todo-content').placeholder).toBe('https://example.com/page');
    expect(q<HTMLInputElement>('#add-todo-title').placeholder).toBe('示例页');

    // ② 纯 URL（display===url）→ fetchPageTitle（requestUrl mock 返回空页 → 无标题，占位符保持 URL）
    mockRequestUrl.mockClear();
    clipboardRead.mockResolvedValueOnce('https://plain.com/x');
    clipBtn.click();
    await vi.advanceTimersByTimeAsync(20);
    expect(mockRequestUrl).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://plain.com/x' }));
    expect(q<HTMLTextAreaElement>('#add-todo-content').placeholder).toBe('https://plain.com/x');

    // ③ 读取被拒 → catch 静默不炸
    clipboardRead.mockRejectedValueOnce(new Error('denied'));
    // 先切走再切回触发读取
    ([...qAll('.scene-btn')].find((b) => (b as HTMLElement).dataset.scene === '工作') as HTMLElement).click();
    clipBtn.click();
    await vi.advanceTimersByTimeAsync(20);
    expect(q<HTMLTextAreaElement>('#add-todo-content').placeholder).toBe('输入备忘录内容...');
  });

  /** querySelectorAll 快捷 */
  function qAll(sel: string): HTMLElement[] {
    return [...document.querySelectorAll(sel)] as HTMLElement[];
  }

  it('编辑回填：剪藏+url 显示标题框；代码+脚本名延迟触发建议；公开课回填课程；定位与到期恢复', async () => {
    const vault = new MockVault();
    const app = await initApp(vault);
    vault.files.set('我的/笔记A.md', '# 笔记A');
    const editItem: any = {
      id: 'm1',
      title: '剪辑条目',
      scene: '剪藏',
      priority: 'important',
      created: '2025-06-14 10:00:00',
      completed: null,
      url: 'https://example.com/clip',
      due: '2025-07-01 08:00',
      notePath: '我的/笔记A.md',
      notePosition: { line: 2, ch: 1 },
    };
    UIManager.showAddDialog(editItem);
    await vi.advanceTimersByTimeAsync(150);
    const h4 = q<HTMLHeadingElement>('#add-todo-popup h4');
    expect(h4.textContent).toBe('编辑备忘录');
    expect(q<HTMLInputElement>('#add-todo-title').style.display).toBe('block'); // 剪藏+url → 标题框显示
    expect(q<HTMLInputElement>('#add-todo-due-input').value).toBe('2025-07-01T08:00');
    expect(q<HTMLButtonElement>('#add-todo-due-clear').style.display).toBe('inline-block');
    expect(q<HTMLButtonElement>('#add-todo-pos-btn').textContent).toBe('📌 笔记A'); // 文件存在 → 定位标签
    const prioBtn = [...qAll('#add-todo-priority .priority-btn')].find(
      (b) => (b as HTMLElement).dataset.priority === 'important'
    )!;
    expect(prioBtn.classList.contains('active')).toBe(true);

    // 代码场景编辑：scriptName 回填 + 100ms 后补发 input（建议渲染）
    const codeItem: any = {
      id: 'm2', title: '跑脚本', scene: '代码', priority: 'minor', created: '2025-06-14 10:00:00',
      completed: null, scriptName: 'deploy.sh',
    };
    UIManager.showAddDialog(codeItem);
    expect(q<HTMLInputElement>('#add-todo-script').value).toBe('deploy.sh');
    expect(q<HTMLInputElement>('#add-todo-course').value).toBe('');

    // 公开课编辑：courseName/coursePath 回填
    const courseItem: any = {
      id: 'm3', title: '上课', scene: '公开课', priority: 'minor', created: '2025-06-14 10:00:00',
      completed: null, courseName: '课程乙', coursePath: '我的/影视/课程乙.md',
    };
    UIManager.showAddDialog(courseItem);
    expect(q<HTMLInputElement>('#add-todo-course').value).toBe('课程乙');

    // 场景不在按钮列表 → 回退第一个场景
    UIManager.showAddDialog({ ...codeItem, scene: '不存在的场景' });
    const activeScene = q<HTMLElement>('#add-todo-scenes .scene-btn.active');
    expect(activeScene.dataset.scene).toBe('剪藏');
    void app;
  });

  it('编辑条目定位文件缺失 → 📌 不升级为笔记名', async () => {
    const vault = new MockVault();
    await initApp(vault);
    UIManager.showAddDialog({
      id: 'm9', title: '丢文件', scene: '工作', priority: 'minor', created: '2025-06-14 10:00:00',
      completed: null, notePath: '缺失/没了.md', notePosition: { line: 0, ch: 0 },
    } as any);
    await vi.advanceTimersByTimeAsync(10);
    expect(q<HTMLButtonElement>('#add-todo-pos-btn').textContent).toBe('📌');
  });
});

describe('ESC 层级：共享确认遮罩最优先', () => {
  it('共享确认遮罩存在 → ESC 只移除它，添加弹窗保持打开', async () => {
    const vault = new MockVault();
    await initApp(vault);
    UIManager.hideMain();
    UIManager.showAddDialog(null);
    const shared = document.createElement('div');
    shared.id = '__shared_confirm_mask__';
    document.body.appendChild(shared);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('__shared_confirm_mask__')).toBeNull();
    expect(q<HTMLDivElement>('#add-todo-popup').style.display).toBe('block'); // 未被一并关闭
  });
});

describe('Renderer 排序模式', () => {
  function baseItem(extra: any = {}): any {
    return {
      id: extra.id || 't', title: extra.title || '条目', scene: '工作', priority: 'minor',
      created: '2025-01-01 10:00:00', completed: null,
      ...extra,
    };
  }

  function render(items: any[]): HTMLElement {
    const c = document.createElement('div');
    Renderer.render(c, items, false);
    return c;
  }

  beforeEach(async () => {
    const vault = new MockVault();
    await initApp(vault);
  });

  it('due 模式：逾期 > 未来 > 无到期；同档按创建时间降序', () => {
    (App.settings as any).memoSortMode = 'due';
    App.state.sortByPriority = false;
    const c = render([
      baseItem({ id: 'a', title: '无到期', created: '2025-01-03 09:00:00' }),
      baseItem({ id: 'b', title: '已过期', due: '2024-01-01 08:00' }),
      baseItem({ id: 'c', title: '未来到期', due: '2099-01-01 08:00', created: '2025-01-02 09:00:00' }),
      baseItem({ id: 'd', title: '未来到期早建', due: '2099-01-01 08:00', created: '2025-01-01 08:00:00' }),
    ]);
    const titles = [...c.querySelectorAll('.todo-content-span')].map((e) => e.textContent);
    expect(titles).toEqual(['已过期', '未来到期', '未来到期早建', '无到期']);
  });

  it('priority 模式：重要在前；同档按创建时间降序', () => {
    (App.settings as any).memoSortMode = 'priority';
    App.state.sortByPriority = false;
    const c = render([
      baseItem({ id: 'a', title: '次要新', created: '2025-02-01 09:00:00' }),
      baseItem({ id: 'b', title: '重要旧', priority: 'important', created: '2024-01-01 09:00:00' }),
      baseItem({ id: 'c', title: '次要旧', created: '2024-06-01 09:00:00' }),
    ]);
    const titles = [...c.querySelectorAll('.todo-content-span')].map((e) => e.textContent);
    expect(titles).toEqual(['重要旧', '次要新', '次要旧']);
  });

  it('sortByPriority=true 时无视设置排序模式强制紧急优先', () => {
    (App.settings as any).memoSortMode = 'created';
    App.state.sortByPriority = true;
    const c = render([
      baseItem({ id: 'a', title: '最新普通', created: '2025-03-01 09:00:00' }),
      baseItem({ id: 'b', title: '过期重要', priority: 'important', due: '2020-01-01 08:00', created: '2020-01-01 09:00:00' }),
    ]);
    const titles = [...c.querySelectorAll('.todo-content-span')].map((e) => e.textContent);
    expect(titles[0]).toBe('过期重要'); // 到期紧迫压过一切
  });
});

describe('打开动作与跳转', () => {
  let appRef: any;

  beforeEach(async () => {
    const vault = new MockVault();
    vault.files.set('笔记/A.md', '正文');
    appRef = await initApp(vault);
  });

  it('openItem：linkedNote 存在开文件；缺失提示；URL 打开异常走 electron 兜底不炸', async () => {
    // ① 存在 → openFile
    await Renderer.openItem({ linkedNote: '笔记/A.md', url: null } as any);
    const leaf = appRef.workspace.getLeaf.mock.results.pop()!.value;
    expect(leaf.openFile).toHaveBeenCalled();

    // ② 缺失 → notice
    clearNotices();
    await Renderer.openItem({ linkedNote: '缺失/没了.md', url: null } as any);
    expect(hasNotice('关联笔记不存在')).toBe(true);

    // ③ URL + openUrl 抛错 + window.require 不存在 → 静默兜底
    clearNotices();
    appRef.openUrl = () => {
      throw new Error('no shell');
    };
    expect(() => Renderer.openItem({ linkedNote: null, url: 'https://x.com' } as any)).not.toThrow();
  });

  it('openLinkedNote：文件缺失直接提示且不关面板', async () => {
    clearNotices();
    Renderer.openLinkedNote({ notePath: '缺失/没了.md' } as any);
    expect(hasNotice('关联笔记不存在')).toBe(true);
  });

  it('buildSheetHead 完成态挂 done 划线；buildMeta 平台标签仅在可识别平台出现', () => {
    const head = Renderer.buildSheetHead({ title: '已完成项', completed: '2025-01-02 10:00' } as any);
    expect(head.querySelector('.todo-content-span')!.classList.contains('done')).toBe(true);
    // zhihu.com 可识别 → 知乎标签
    const meta1 = Renderer.buildMeta({ title: 't', scene: '剪藏', priority: 'minor', created: '2025-01-01 10:00:00', url: 'https://zhihu.com/a' } as any);
    expect(meta1.textContent).toContain('知乎');
    // 无法识别平台的 URL → 无平台标签
    const meta2 = Renderer.buildMeta({ title: 't', scene: '剪藏', priority: 'minor', created: '2025-01-01 10:00:00', url: 'https://unknown-site.example/a' } as any);
    expect(meta2.querySelector('.bz-tag-platform')).toBeNull();
  });

  it('createPositionTag：showFileName=false 只显示 📌', () => {
    App.state.showFileName = false;
    const tag = Renderer.createPositionTag({
      notePath: '笔记/A.md',
      notePosition: { line: 0, ch: 0 },
    } as any);
    expect(tag!.textContent).toBe('📌');
    App.state.showFileName = true;
  });
});

describe('面板基础与确认代理', () => {
  it('createMainUI 幂等；getEntriesContainer 返回容器；hideMain 空引用安全；showConfirm 走共享确认框', async () => {
    const vault = new MockVault();
    await initApp(vault);
    UIManager.createMainUI(); // 二次调用幂等
    expect(document.querySelectorAll('#todo-mask').length).toBe(1);
    expect(UIManager.getEntriesContainer()).not.toBeNull();
    // hideMain 空引用安全
    const savedMask = UIManager.mask;
    UIManager.mask = null;
    UIManager.popup = null;
    expect(() => UIManager.hideMain()).not.toThrow();
    UIManager.mask = savedMask;
    // showConfirm 代理到 core confirm（空标题由代理层先兜底为「确认删除」）
    UIManager.showConfirm('', '', () => {});
    expect(document.getElementById('__shared_confirm_mask__')).not.toBeNull();
    expect(
      document.querySelector('#__shared_confirm_popup__ h4')!.textContent
    ).toBe('确认删除');
  });
});
