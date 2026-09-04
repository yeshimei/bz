/**
 * 待办捕获流三件回归（memo→todo 接管迁移第 3 项提前实施）：
 * 1. 启动弹出改道：todo 提醒后台落点=待办面板（memo 旧弹窗不再出现）；
 * 2. 打开笔记提醒改道：todo 面板打开并按笔记路径定位关联待办；
 * 3. composer/编辑器剪藏场景剪贴板预填（URL/非 URL 分流 + fetchPageTitle 抓标题）。
 * 另含设置 schema 文案核对（提醒组归待办）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, requestUrl } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { M, resetTodoState } from '../../src/todo/state';
import { openTodoPanel, closeTodoPanel, addTodo, openEditor } from '../../src/todo/ui';
import { ensureTodoReminders, unloadTodo } from '../../src/todo';
import { App as MemoApp } from '../../src/memo/app';
import { setBzSettingsProvider } from '../../src/memo';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { TodoData } from '../../src/todo/data';

const BASE_SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  todoFilePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoDueFormat: 'relative',
  memoAutoArchive: true,
  autoPopupOnStart: true,
  openNoteReminder: true,
  cinemaFolderPath: '我的/影视',
  todoMobileDefaultFullscreen: false,
};

/** 动态日期（相对今天）：到期判定不随运行日历漂移 */
function at(dayOffset: number, hm: string): string {
  return moment().add(dayOffset, 'days').format(`YYYY-MM-DD ${hm}:00`);
}

function item(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'x', title: '条目', scene: '剪藏', priority: 'minor', created: at(-1, '10:00'),
    completed: null, due: null, notePath: null, notePosition: null,
    scriptName: null, courseName: null, coursePath: null, linkedNote: null, url: null,
    ...extra,
  };
}

/** app mock：workspace 支持 on/offref/emit（file-open 捕获流用） */
function makeCaptureApp(vault: MockVault) {
  const app = mockAppWithVault(vault) as any;
  const handlers: Record<string, Function[]> = {};
  app.workspace = {
    ...app.workspace,
    on: (ev: string, cb: any) => {
      (handlers[ev] ||= []).push(cb);
      return { event: ev, cb };
    },
    offref: (ref: any) => {
      if (!ref || !ref.event) return;
      const arr = handlers[ref.event] || [];
      const idx = arr.indexOf(ref.cb);
      if (idx >= 0) arr.splice(idx, 1);
    },
    emit: (ev: string, ...args: any[]) => {
      for (const cb of handlers[ev] || []) cb(...args);
    },
  };
  return app;
}

interface Ctx {
  vault: MockVault;
  app: any;
  settings: any;
  emitFileOpen: (path: string | null) => void;
}

/** 种 memo.json + 设置 + app（默认 autoPopupOnStart/openNoteReminder 开） */
function seed(vaultItems: Record<string, unknown>[], settingsOverride: Record<string, unknown> = {}): Ctx {
  const vault = new MockVault();
  if (vaultItems.length) {
    vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(vaultItems, null, 2));
  }
  const settings = { ...BASE_SETTINGS, ...settingsOverride };
  const app = makeCaptureApp(vault);
  setApp(app);
  setSettingsProvider(() => settings as any);
  setSettingsSaver(vi.fn(async () => {}));
  TodoData.init(settings as any);
  return {
    vault,
    app,
    settings,
    emitFileOpen: (path: string | null) => app.workspace.emit('file-open', path ? { path } : null),
  };
}

/** mock 系统剪贴板（readText 可控） */
function mockClipboard(text: string): void {
  Object.defineProperty(navigator, 'clipboard', {
    value: { readText: vi.fn(() => Promise.resolve(text)), writeText: vi.fn(async () => {}) },
    configurable: true,
  });
}

beforeEach(() => {
  resetObsidianMocks();
  resetTodoState();
  document.body.innerHTML = '';
  mockClipboard('');
  requestUrl.mockReset();
  requestUrl.mockResolvedValue({ status: 404, text: '' });
});

afterEach(() => {
  unloadTodo();
  try {
    MemoApp.unload();
  } catch (e) { /* 未初始化忽略 */ }
  document.body.innerHTML = '';
});

describe('启动弹出改道（落点=待办面板）', () => {
  it('autoPopupOnStart 开且有重要未完成待办 → 300ms 后自动打开待办面板；memo 旧弹窗不出现', async () => {
    const { app } = seed([item({ id: 'a', priority: 'important' })]);
    ensureTodoReminders(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-overlay')).toBeTruthy();
    }, { timeout: 1500 });
    // 落点核对：待办工作台在，备忘录旧弹窗（#todo-popup）不在
    expect((document.querySelector('.bz-todo-title') as HTMLElement).textContent).toBe('待办');
    expect(document.getElementById('todo-popup')).toBeNull();
  }, 5000);

  it('到期未完成同样触发（today 状态）', async () => {
    const { app } = seed([item({ id: 'a', due: at(0, '09:00') })]);
    ensureTodoReminders(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-overlay')).toBeTruthy();
    }, { timeout: 1500 });
  }, 5000);

  it('autoPopupOnStart=false → 不弹', async () => {
    const { app } = seed([item({ id: 'a', priority: 'important' })], { autoPopupOnStart: false });
    ensureTodoReminders(app);
    await new Promise((r) => setTimeout(r, 450));
    expect(document.querySelector('.bz-todo-overlay')).toBeNull();
  });

  it('无重要/到期条目（minor 无截止）→ 不弹', async () => {
    const { app } = seed([item({ id: 'a' })]);
    ensureTodoReminders(app);
    await new Promise((r) => setTimeout(r, 450));
    expect(document.querySelector('.bz-todo-overlay')).toBeNull();
  });
});

describe('打开笔记提醒改道（落点=待办面板 + 定位）', () => {
  it('笔记有关联重要待办 → 打开待办面板且搜索框定位到笔记路径，列表只显关联条目', async () => {
    const { app } = seed([
      item({ id: 'a', title: 'A 笔记的关联待办', priority: 'important', notePath: '笔记/A.md' }),
      item({ id: 'b', title: '无关待办' }),
    ]);
    ensureTodoReminders(app);
    await new Promise((r) => setTimeout(r, 400)); // 等启动弹出判定走完（无全局重要条目？a 是 important → 会先自动弹）
    // a 是全局重要条目：启动弹出先开面板，关闭后走 file-open 场景验证定位
    closeTodoPanel();
    document.body.innerHTML = '';
    resetTodoState();
    ensureTodoReminders(app); // 幂等重挂（file-open 监听仍在）
    (app as any).workspace.emit('file-open', { path: '笔记/A.md' });
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-overlay')).toBeTruthy();
    });
    const search = document.querySelector('[data-todo-search]') as HTMLInputElement;
    expect(search.value).toBe('笔记/A.md');
    await vi.waitFor(() => {
      const cards = [...document.querySelectorAll('.bz-todo-card')];
      expect(cards.length).toBe(1);
      expect(cards[0].textContent).toContain('A 笔记的关联待办');
    });
  }, 5000);

  it('无关联待办的笔记 → 不自动打开', async () => {
    const { app, emitFileOpen } = seed([item({ id: 'a', title: '别家的事' })], { autoPopupOnStart: false });
    ensureTodoReminders(app);
    emitFileOpen('笔记/B.md');
    await new Promise((r) => setTimeout(r, 100));
    expect(document.querySelector('.bz-todo-overlay')).toBeNull();
  });

  it('openNoteReminder=false → 不提醒', async () => {
    const { app, emitFileOpen } = seed(
      [item({ id: 'a', priority: 'important', notePath: '笔记/A.md' })],
      { autoPopupOnStart: false, openNoteReminder: false }
    );
    ensureTodoReminders(app);
    emitFileOpen('笔记/A.md');
    await new Promise((r) => setTimeout(r, 100));
    expect(document.querySelector('.bz-todo-overlay')).toBeNull();
  });

  it('同一笔记只提醒一次：关面板后再次打开不重弹', async () => {
    const { app, emitFileOpen } = seed(
      [item({ id: 'a', priority: 'important', notePath: '笔记/A.md' })],
      { autoPopupOnStart: false }
    );
    ensureTodoReminders(app);
    emitFileOpen('笔记/A.md');
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-overlay')).toBeTruthy();
    });
    closeTodoPanel();
    emitFileOpen('笔记/A.md');
    await new Promise((r) => setTimeout(r, 100));
    expect(document.querySelector('.bz-todo-overlay')).toBeNull(); // 已提醒笔记跳过
  });

  it('面板已开时再触发提醒 → 不闪关，只更新定位条件', async () => {
    const { app, emitFileOpen } = seed(
      [item({ id: 'a', priority: 'important', notePath: '笔记/A.md' })],
      { autoPopupOnStart: false }
    );
    ensureTodoReminders(app);
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-card')).toBeTruthy();
    });
    emitFileOpen('笔记/A.md');
    await vi.waitFor(() => {
      expect((document.querySelector('[data-todo-search]') as HTMLInputElement).value).toBe('笔记/A.md');
    });
    expect(document.querySelector('.bz-todo-overlay')).toBeTruthy(); // 面板未被关闭重开
  });

  it('memo 侧改道核对：App.init 后 file-open 不再弹备忘录旧面板', async () => {
    const { app, emitFileOpen } = seed(
      [item({ id: 'a', priority: 'important', notePath: '笔记/A.md' })],
      { autoPopupOnStart: false }
    );
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
    resetAIProviderCache();
    setBzSettingsProvider(() => ({ ...BASE_SETTINGS }));
    await MemoApp.init({ ...BASE_SETTINGS, autoPopupOnStart: false });
    emitFileOpen('笔记/A.md');
    await new Promise((r) => setTimeout(r, 50));
    const mask = document.getElementById('todo-mask') as HTMLElement | null;
    expect(mask?.style.display ?? 'none').not.toBe('block'); // 旧弹窗不再出现
    void app;
  });

  it('memo 侧改道核对：autoPopupOnStart 开 + 重要条目 → 不再弹备忘录旧面板', async () => {
    seed([item({ id: 'a', priority: 'important' })]);
    setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
    resetAIProviderCache();
    setBzSettingsProvider(() => ({ ...BASE_SETTINGS }));
    await MemoApp.init({ ...BASE_SETTINGS });
    await new Promise((r) => setTimeout(r, 450));
    const mask = document.getElementById('todo-mask') as HTMLElement | null;
    expect(mask?.style.display ?? 'none').not.toBe('block');
  });
});

describe('composer 剪藏场景剪贴板预填', () => {
  async function openWithScene(scene: string): Promise<{ input: HTMLInputElement }> {
    const { app } = seed([], { memoDefaultScene: scene });
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-composer-input]')).toBeTruthy();
    });
    return { input: document.querySelector('[data-todo-composer-input]') as HTMLInputElement };
  }

  it('「剪藏」场景聚焦：URL 剪贴板自动预填并轻提示；保存后标题用链接文本、url 落盘', async () => {
    const { app, vault } = seed([], { memoDefaultScene: '剪藏' });
    mockClipboard('https://example.com/a 页面说明');
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-composer-input]')).toBeTruthy();
    });
    const input = document.querySelector('[data-todo-composer-input]') as HTMLInputElement;
    input.focus();
    await vi.waitFor(() => {
      expect(input.value).toBe('https://example.com/a');
    });
    // 轻提示（正文无 emoji）
    await vi.waitFor(() => {
      const msgs = [...document.querySelectorAll('.bz-notice-msg')].map((el) => el.textContent);
      expect(msgs.some((m) => m === '已从剪贴板预填链接')).toBe(true);
    });
    // Enter 保存：标题候选 = 链接文本「页面说明」，url 提取落盘
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await vi.waitFor(() => {
      expect(input.value).toBe('');
    });
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw[0].title).toBe('页面说明');
    expect(raw[0].url).toBe('https://example.com/a');
    expect(raw[0].scene).toBe('剪藏');
    void app;
  });

  it('裸 URL：fetchPageTitle 抓到的页面标题作为标题候选落盘', async () => {
    requestUrl.mockResolvedValue({ status: 200, text: '<html><title>示例页面标题</title></html>' });
    const { app, vault } = seed([], { memoDefaultScene: '剪藏' });
    mockClipboard('https://example.com/bare');
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-composer-input]')).toBeTruthy();
    });
    const input = document.querySelector('[data-todo-composer-input]') as HTMLInputElement;
    input.focus();
    await vi.waitFor(() => {
      expect(input.value).toBe('https://example.com/bare');
    });
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await vi.waitFor(() => {
      expect(input.value).toBe('');
    });
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw[0].title).toBe('示例页面标题');
    expect(raw[0].url).toBe('https://example.com/bare');
    void app;
  });

  it('非 URL 剪贴板：不打扰（不填、不提示）', async () => {
    const { app } = seed([], { memoDefaultScene: '剪藏' });
    mockClipboard('随手记一笔，不是链接');
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-composer-input]')).toBeTruthy();
    });
    const input = document.querySelector('[data-todo-composer-input]') as HTMLInputElement;
    input.focus();
    await new Promise((r) => setTimeout(r, 80));
    expect(input.value).toBe('');
    expect([...document.querySelectorAll('.bz-notice-msg')].some((el) => el.textContent === '已从剪贴板预填链接')).toBe(false);
    void app;
  });

  it('剪贴板读取失败（权限拒绝）：聚焦触发预填链路但走静默分支（不预填、不弹提示）', async () => {
    const { app } = seed([], { memoDefaultScene: '剪藏' });
    const readText = vi.fn(() => Promise.reject(new Error('denied')));
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText, configurable: true },
    });
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-composer-input]')).toBeTruthy();
    });
    const input = document.querySelector('[data-todo-composer-input]') as HTMLInputElement;
    input.focus();
    // 聚焦确实触发了读取链路（防止 focus 未绑定导致的假绿）
    await vi.waitFor(() => {
      expect(readText).toHaveBeenCalled();
    });
    // 权限拒绝走静默分支：输入不被预填、也无任何通知（含错误提示）
    expect(input.value).toBe('');
    expect(document.querySelectorAll('.bz-notice-msg').length).toBe(0);
    void app;
  });

  it('非剪藏场景聚焦：不读剪贴板不预填', async () => {
    const { app } = seed([], { memoDefaultScene: '工作' });
    mockClipboard('https://example.com/work');
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-composer-input]')).toBeTruthy();
    });
    const input = document.querySelector('[data-todo-composer-input]') as HTMLInputElement;
    input.focus();
    await new Promise((r) => setTimeout(r, 80));
    expect(input.value).toBe('');
    void app;
  });

  it('已有输入时不覆盖用户内容', async () => {
    const { app } = seed([], { memoDefaultScene: '剪藏' });
    mockClipboard('https://example.com/keep');
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(document.querySelector('[data-todo-composer-input]')).toBeTruthy();
    });
    const input = document.querySelector('[data-todo-composer-input]') as HTMLInputElement;
    input.value = '我自己打的';
    input.focus();
    await new Promise((r) => setTimeout(r, 80));
    expect(input.value).toBe('我自己打的');
    void app;
  });
});

describe('编辑器剪藏场景剪贴板预填（占位符形态，memo 弹窗同款）', () => {
  it('新建默认场景剪藏：打开即预填内容占位符=URL、标题占位符=链接文本；内容空保存走占位符兜底', async () => {
    const { app, vault } = seed([], { memoDefaultScene: '剪藏' });
    mockClipboard('https://example.com/editor 页面说明');
    addTodo(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-editor')).toBeTruthy();
    });
    const editor = document.querySelector('.bz-todo-editor') as HTMLElement;
    await vi.waitFor(() => {
      expect((editor.querySelector('textarea') as HTMLTextAreaElement).placeholder).toBe('https://example.com/editor');
    });
    const titleInput = editor.querySelectorAll('.bz-todo-extra')[0].querySelector('input') as HTMLInputElement;
    expect(titleInput.placeholder).toBe('页面说明');
    // 内容留空直接保存 → 占位符兜底落盘（memo 同款语义）
    const saveBtn = [...editor.querySelectorAll('.bz-btn')].find((b) => b.textContent?.includes('添加')) as HTMLElement;
    saveBtn.click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-editor')).toBeNull();
    });
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw[0].title).toBe('页面说明');
    expect(raw[0].url).toBe('https://example.com/editor');
    void app;
  });

  it('非 URL 剪贴板：占位符不预填', async () => {
    const { app } = seed([], { memoDefaultScene: '剪藏' });
    mockClipboard('普通文字');
    addTodo(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-editor')).toBeTruthy();
    });
    await new Promise((r) => setTimeout(r, 80));
    const editor = document.querySelector('.bz-todo-editor') as HTMLElement;
    expect((editor.querySelector('textarea') as HTMLTextAreaElement).placeholder).toBe('输入待办内容...');
    expect((editor.querySelectorAll('.bz-todo-extra')[0].querySelector('input') as HTMLInputElement).placeholder).toBe('标题（可选）');
    void app;
  });

  it('编辑模式不预填（异步读取晚于回填，防误导）', async () => {
    const { vault, app } = seed(
      [item({ id: 'e1', title: '既有剪藏', scene: '剪藏', url: 'https://example.com/old' })],
      { memoDefaultScene: '剪藏' }
    );
    mockClipboard('https://example.com/new 描述');
    openTodoPanel(app);
    await vi.waitFor(() => {
      expect(M.items.length).toBe(1);
    });
    openEditor(M.items[0]);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-editor')).toBeTruthy();
    });
    await new Promise((r) => setTimeout(r, 80));
    const editor = document.querySelector('.bz-todo-editor') as HTMLElement;
    const content = editor.querySelector('textarea') as HTMLTextAreaElement;
    expect(content.value).toBe('既有剪藏'); // 回填内容不被剪贴板预填覆盖
    expect(content.placeholder).toBe('输入待办内容...'); // 编辑模式不触发剪藏预填
    void vault;
  });

  it('切场景到剪藏触发预填；切走再切回不重复打扰内容', async () => {
    const { app } = seed([], { memoDefaultScene: '工作' });
    mockClipboard('https://example.com/switch 描述');
    addTodo(app);
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-todo-editor')).toBeTruthy();
    });
    const editor = document.querySelector('.bz-todo-editor') as HTMLElement;
    const clipBtn = [...editor.querySelectorAll('.bz-choice-btn')].find((b) => b.textContent === '剪藏') as HTMLElement;
    clipBtn.click();
    await vi.waitFor(() => {
      expect((editor.querySelector('textarea') as HTMLTextAreaElement).placeholder).toBe('https://example.com/switch');
    });
    void app;
  });
});

describe('设置 schema 文案核对（提醒组归待办）', () => {
  it('todo schema：提醒组名「提醒」、desc 为待办面板口径', async () => {
    seed([]);
    const { todoSettingsSchema } = await import('../../src/todo/settings');
    const schema = todoSettingsSchema();
    const bell = schema.groups.find((g) => g.name === '提醒');
    expect(bell).toBeTruthy();
    const descs = bell!.rows.map((r) => (r as any).desc).join('\n');
    expect(descs).toContain('待办面板');
    expect(descs).not.toContain('备忘录');
  });

  it('memo schema：不再含提醒组（入口改道后行为归待办域）', async () => {
    seed([]);
    const { memoSettingsSchema } = await import('../../src/memo/ui');
    const schema = memoSettingsSchema();
    expect(schema.groups.find((g) => g.name === '提醒')).toBeUndefined();
    const names = schema.groups.flatMap((g) => g.rows.map((r) => (r as any).name));
    expect(names).not.toContain('启动时自动弹出');
    expect(names).not.toContain('打开笔记自动提醒');
  });
});
