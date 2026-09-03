/**
 * bz Renderer 补测（覆盖率目标）：createPositionTag/createCourseTag 跳转分支、
 * createDueTag 三色、createSceneTag 优先级、createPlatformTag、createCard 链接三分支。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { setBzSettingsProvider } from '../../src/memo';
import { App } from '../../src/memo/app';
import { Renderer } from '../../src/memo/ui';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices } from '../mock-obsidian-entry';
import moment from 'moment';

function makeApp(vault: MockVault, editor: any = null) {
  return {
    vault,
    workspace: {
      on: vi.fn(() => ({ ref: 'r' })),
      offref: vi.fn(),
      getLeaf: vi.fn(() => ({ openFile: vi.fn(async () => {}), view: editor ? { editor } : null })),
      getActiveFile: () => null,
    },
    metadataCache: { getFileCache: () => null },
    commands: { removeCommand: vi.fn() },
  };
}

const SETTINGS = {
  todoFilePath: 'CONFIG/STORAGE',
  scenarios: '',
  showFileName: true,
  autoPopupOnStart: false,
  cinemaFolderPath: '我的/影视',
};

const editorMock = {
  focus: vi.fn(),
  setCursor: vi.fn(),
  scrollIntoView: vi.fn(),
};

function baseItem(extra: any = {}): any {
  return {
    id: 't1', title: '测试条目', scene: '剪藏', priority: 'minor', created: '2025-01-01 10:00:00',
    completed: null, due: null, notePath: null, notePosition: null, url: null,
    ...extra,
  };
}

let appRef: any;

beforeEach(async () => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  localStorage.clear();
  editorMock.focus.mockClear();
  editorMock.setCursor.mockClear();
  editorMock.scrollIntoView.mockClear();
  const vault = new MockVault();
  vault.files.set('笔记/A.md', '正文');
  appRef = makeApp(vault, editorMock);
  setApp(appRef as any);
  setBzSettingsProvider(() => ({ ...SETTINGS }));
  setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
  resetAIProviderCache();
  await App.init(SETTINGS);
});

describe('Renderer.createPositionTag', () => {
  it('文件存在：📌 + 文件名，点击跳转并定位光标', async () => {
    const tag = Renderer.createPositionTag(baseItem({ notePath: '笔记/A.md', notePosition: { line: 3, ch: 5 } }));
    expect(tag!.textContent).toBe('📌 A');
    tag!.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(editorMock.focus).toHaveBeenCalled();
    expect(editorMock.setCursor).toHaveBeenCalledWith(3, 5);
    expect(editorMock.scrollIntoView).toHaveBeenCalled();
  });

  it('文件不存在：⚠️ + 文件名 + 错误色', () => {
    const tag = Renderer.createPositionTag(baseItem({ notePath: '不存在/缺失.md' }));
    expect(tag!.textContent).toBe('⚠️ 缺失.md');
    expect(tag!.classList.contains('bz-tag-warn')).toBe(true); // 错误色由 .bz-tag-warn 提供
  });

  it('公开课场景与课程同名：返回 null（不重复显示）', () => {
    const tag = Renderer.createPositionTag(
      baseItem({ scene: '公开课', courseName: '《A》', notePath: '笔记/A.md' })
    );
    expect(tag).toBeNull();
  });
});

describe('Renderer.createCourseTag', () => {
  it('文件存在：点击打开笔记并标记已提醒', async () => {
    const tag = Renderer.createCourseTag(baseItem({ scene: '公开课', courseName: '《测试课》', coursePath: '笔记/A.md' }));
    expect(tag.textContent).toBe('🎓 测试课');
    tag.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(App.state.remindedFiles.has('笔记/A.md')).toBe(true);
  });

  it('文件不存在：title 提示 + 不可点击', () => {
    const tag = Renderer.createCourseTag(baseItem({ scene: '公开课', courseName: '《测试课》', coursePath: '不存在/x.md' }));
    expect(tag.title).toBe('关联文件不存在');
    expect(tag.classList.contains('bz-tag-missing')).toBe(true);
  });
});

describe('Renderer.createScriptTag / createPlatformTag', () => {
  it('createScriptTag：💻 前缀', () => {
    expect(Renderer.createScriptTag('测试脚本').textContent).toBe('💻 测试脚本');
  });

  it('createPlatformTag：域名图标 + 平台文本', () => {
    const tag = Renderer.createPlatformTag('https://github.com/example', 'GitHub');
    expect(tag.textContent).toContain('GitHub');
  });

  it('createPlatformTag：无效 URL 不抛错', () => {
    const tag = Renderer.createPlatformTag('not-a-url', '未知');
    expect(tag.textContent).toContain('未知');
  });
});

describe('Renderer.createSceneTag / createDueTag', () => {
  it('createSceneTag：重要红色背景，次要默认', () => {
    const imp = Renderer.createSceneTag(baseItem({ priority: 'important' }));
    expect(imp.classList.contains('important')).toBe(true); // 红色背景由 .bz-tag-scene.important 提供
    const minor = Renderer.createSceneTag(baseItem());
    expect(minor.classList.contains('important')).toBe(false);
  });

  it('createDueTag：逾期红 / 今天橙 / 未来灰', () => {
    const overdue = Renderer.createDueTag(baseItem({ due: '2020-01-01 10:00' }));
    expect(overdue.textContent).toContain('');
    expect(overdue.classList.contains('overdue')).toBe(true); // 红色背景由 .bz-tag-due.overdue 提供
    const now = new Date(Date.now() + 5 * 60000); // +5 分钟，保证未过期
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayDue = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const today = Renderer.createDueTag(baseItem({ due: todayDue }));
    expect(today.textContent).toContain('');
    expect(today.classList.contains('today')).toBe(true);
    const future = Renderer.createDueTag(baseItem({ due: '2099-01-01 10:00' }));
    expect(future.textContent).toContain('📅');
  });
});

describe('Renderer.createCard 链接三分支', () => {
  it('linkedNote：内部笔记链接', () => {
    const card = Renderer.createCard(baseItem({ linkedNote: '笔记/A.md' }), false);
    const link = card.querySelector('a')!;
    expect(link.textContent).toBe('测试条目');
    expect(link.classList.contains('bz-todo-link')).toBe(true); // 链接色由 .bz-todo-link 提供
  });

  it('url：外部链接（点击 openUrl）', () => {
    const card = Renderer.createCard(baseItem({ url: 'https://example.com' }), false);
    const link = card.querySelector('a')!;
    expect(link.href).toBe('https://example.com/');
    appRef.openUrl = vi.fn();
    link.click();
    expect(appRef.openUrl).toHaveBeenCalledWith('https://example.com');
  });

  it('纯文本：无链接，多行内容 pre-wrap 展示', () => {
    const card = Renderer.createCard(baseItem({ title: '第一行\n第二行' }), false);
    expect(card.querySelector('a')).toBeNull();
    expect(card.textContent).toContain('第一行');
    const contentSpan = card.querySelector('span') as HTMLElement;
    expect(contentSpan.classList.contains('todo-content-span')).toBe(true);
  });

  it('归档条目：📦 图标 + 透明度', () => {
    const card = Renderer.createCard(baseItem({ completed: '2025-01-02 10:00' }), true);
    expect(card.textContent).toContain('📦');
    expect(card.classList.contains('archived')).toBe(true); // 半透明由 .todo-card.archived 提供
  });

  it('公开课/代码场景 meta 标签渲染', () => {
    const card = Renderer.createCard(
      baseItem({ scene: '公开课', courseName: '《课》', coursePath: '笔记/A.md', scriptName: null }),
      false
    );
    expect(card.textContent).toContain('🎓 课');
    const code = Renderer.createCard(baseItem({ scene: '代码', scriptName: 'build.sh' }), false);
    expect(code.textContent).toContain('💻 build.sh');
  });
});

describe('Renderer.render 空态/归档分隔', () => {
  it('空列表 → 空态文案', () => {
    const container = document.createElement('div');
    Renderer.render(container, [], false);
    expect(container.textContent).toContain('没有备忘录 🎉');
  });

  it('过滤后空 → 没有匹配的备忘录', () => {
    const container = document.createElement('div');
    App.state.filter = (i: any) => i.title.includes('不存在');
    Renderer.render(container, [baseItem()], false);
    expect(container.textContent).toContain('没有匹配的备忘录');
    App.state.filter = null;
  });

  it('归档条目 + 显示归档 → 分隔线与卡片', () => {
    const container = document.createElement('div');
    const done = baseItem({ id: 'done1', completed: '2025-01-02 10:00' });
    Renderer.render(container, [done], true);
    expect(container.textContent).toContain('已归档');
    expect(container.querySelectorAll('.todo-card').length).toBe(1);
  });
});

describe('排序与归档模式（第 9 轮设置扩展）', () => {
  function renderItems(items: any[]) {
    const container = document.createElement('div');
    Renderer.render(container, items, App.state.showArchived);
    return container;
  }

  it('memoSortMode=created → 按创建时间降序', () => {
    (App.settings as any).memoSortMode = 'created';
    const container = renderItems([
      baseItem({ id: 'a', title: '旧', created: '2024-01-01 10:00:00' }),
      baseItem({ id: 'b', title: '新', created: '2025-01-01 10:00:00' }),
    ]);
    const cards = container.querySelectorAll('.todo-card');
    expect((cards[0].textContent || '').includes('新')).toBe(true);
    expect((cards[1].textContent || '').includes('旧')).toBe(true);
  });

  it('memoAutoArchive=false → 完成条目保留主列表（勾选态 + 划线 + 排最后）', () => {
    (App.settings as any).memoAutoArchive = false;
    const container = renderItems([
      baseItem({ id: 'a', title: '未完成', completed: null }),
      baseItem({ id: 'b', title: '已完成', completed: '2025-01-02 10:00:00' }),
    ]);
    const cards = container.querySelectorAll('.todo-card');
    expect(cards.length).toBe(2);
    // 完成条目排最后
    expect((cards[1].textContent || '').includes('已完成')).toBe(true);
    const checkbox = cards[1].querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(true);
    // 划线样式
    const contentSpan = cards[1].querySelector('span') as HTMLElement;
    expect(contentSpan.classList.contains('done')).toBe(true);
    // 无「已归档」分隔段
    expect(container.textContent).not.toContain('已归档');
  });

  it('memoAutoArchive 默认开（未设置）→ 完成条目进入归档段', () => {
    delete (App.settings as any).memoAutoArchive;
    const container = renderItems([
      baseItem({ id: 'a', title: '未完成', completed: null }),
      baseItem({ id: 'b', title: '已完成', completed: '2025-01-02 10:00:00' }),
    ]);
    const cards = container.querySelectorAll('.todo-card');
    expect(cards.length).toBe(1);
  });
});

describe('Renderer.createDueTag 格式（第 9 轮设置扩展）', () => {
  it('memoDueFormat=absolute → 固定 MM/DD HH:mm 格式', () => {
    (App.settings as any).memoDueFormat = 'absolute';
    const due = moment().add(3, 'days').format('YYYY-MM-DD 14:30:00');
    const tag = Renderer.createDueTag(baseItem({ due }));
    expect((tag.textContent || '').includes('到期')).toBe(true);
    expect(tag.textContent).toContain(moment(due.replace('T', ' ')).format('MM/DD'));
    expect(tag.textContent).toContain('14:30');
  });

  it('默认 relative → 「明天 HH:mm 到期」', () => {
    (App.settings as any).memoDueFormat = 'relative';
    const due = moment().add(1, 'day').format('YYYY-MM-DD 14:30:00');
    const tag = Renderer.createDueTag(baseItem({ due }));
    expect((tag.textContent || '').includes('明天')).toBe(true);
    expect(tag.textContent).toContain('14:30');
  });
});
