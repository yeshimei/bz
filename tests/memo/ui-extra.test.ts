/**
 * 备忘录 UI 修复回归（P2）：建议列表注入转义、document click 监听自注销
 * （弹窗销毁/重建路径，reloadScenes 同款）、ESC 双窗口径（主面板 || 添加弹窗）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setBzSettingsProvider } from '../../src/memo';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { App } from '../../src/memo/app';
import { DataManager } from '../../src/memo/data';
import { UIManager } from '../../src/memo/ui';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

// 观测点换线注记：memo/ui 的 smartcat 观察已改 emitDomainEvent('memo', …) 派发，
// 本文件不断言观察事件（无总线订阅者时 fire-and-forget 静默），原 smartcat barrel mock 随之移除。

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
    getLeaf: vi.fn(() => ({ openFile: vi.fn(), view: null })),
    getActiveFile: () => null,
  };
  const app: any = { vault, workspace, metadataCache: { getFileCache: () => null }, commands: { removeCommand: vi.fn() } };
  setApp(app);
  setBzSettingsProvider(() => ({ ...SETTINGS }));
  setSettingsProvider(() => ({ ...SETTINGS } as any));
  await App.init(SETTINGS);
  return app;
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  localStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('建议列表注入转义（P2）', () => {
  it('脚本名含 HTML → 建议列表按文本渲染，不产生 <script> 标签', async () => {
    const vault = new MockVault();
    await initApp(vault);
    UIManager.showAddDialog(null);
    UIManager.scriptSuggestions = ['<script>alert(1)</script>evil.js'];
    // 切到「代码」场景显示脚本输入框
    const codeBtn = [...document.querySelectorAll('#add-todo-scenes .scene-btn')].find(
      (b) => (b as HTMLElement).dataset.scene === '代码'
    ) as HTMLElement;
    codeBtn.click();
    const scriptInput = document.getElementById('add-todo-script') as HTMLInputElement;
    scriptInput.dispatchEvent(new Event('input'));

    const box = document.getElementById('add-todo-script-suggestions')!;
    expect(box.querySelector('script')).toBeNull();
    expect(box.textContent).toContain('<script>alert(1)</script>evil.js'); // 纯文本呈现
  });

  it('课程名/path 含 HTML 与引号 → 文本转义渲染 + data-path 属性值转义引号', async () => {
    const vault = new MockVault();
    await initApp(vault);
    // 课程建议来自 DataManager.getCourseNotes：先 mock 为空，避免异步覆盖下方注入值
    vi.spyOn(DataManager, 'getCourseNotes').mockResolvedValue([]);
    UIManager.showAddDialog(null);
    await new Promise((r) => setTimeout(r, 0));
    UIManager.courseSuggestions = [{ name: '<img src=x onerror=alert(1)>课', path: '/a" onmouseover="x.md' }];
    const courseBtn = [...document.querySelectorAll('#add-todo-scenes .scene-btn')].find(
      (b) => (b as HTMLElement).dataset.scene === '公开课'
    ) as HTMLElement;
    courseBtn.click();
    const courseInput = document.getElementById('add-todo-course') as HTMLInputElement;
    courseInput.dispatchEvent(new Event('input'));

    const box = document.getElementById('add-todo-course-suggestions')!;
    expect(box.querySelector('img')).toBeNull(); // 不产生 <img> 标签
    const span = box.querySelector('.bz-suggest-item span')!;
    expect(span.textContent).toBe('<img src=x onerror=alert(1)>课'); // 名称按文本呈现
    expect(span.getAttribute('data-path')).toBe('/a" onmouseover="x.md'); // 属性值完整还原（引号已转义）
    expect(box.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;'); // 序列化层面是转义文本
  });
});

describe('document click 监听自注销（P2 监听泄漏）', () => {
  it('添加弹窗销毁重建（reloadScenes 同款路径）→ 旧监听在下次点击时自注销', async () => {
    const vault = new MockVault();
    await initApp(vault);
    UIManager.showAddDialog(null); // 创建弹窗：script + course 两条 document click 监听
    // reloadScenes 同款重建：移除旧弹窗 DOM 后重建
    UIManager.addMask!.remove();
    UIManager.addPopup!.remove();
    UIManager.addMask = null;
    UIManager.addPopup = null;
    UIManager.createAddDialog();

    const rmSpy = vi.spyOn(document, 'removeEventListener');
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // 两个旧监听（容器已脱离文档）均在首次点击时注销
    expect(rmSpy.mock.calls.filter(([type]) => type === 'click').length).toBe(2);
    rmSpy.mockRestore();
  });

  it('弹窗仅隐藏未销毁时监听保留（再次打开仍可点外关闭建议框）', async () => {
    const vault = new MockVault();
    await initApp(vault);
    vi.spyOn(DataManager, 'getCourseNotes').mockResolvedValue([]);
    UIManager.showAddDialog(null);
    await new Promise((r) => setTimeout(r, 0));
    // 先注入建议数据再切场景（切到公开课会自动触发一次渲染）
    UIManager.courseSuggestions = [{ name: '公开课A', path: '/a.md' }];
    const courseBtn = [...document.querySelectorAll('#add-todo-scenes .scene-btn')].find(
      (b) => (b as HTMLElement).dataset.scene === '公开课'
    ) as HTMLElement;
    courseBtn.click();
    const box = document.getElementById('add-todo-course-suggestions')!;
    // 建议已渲染（jsdom 无样式表，以渲染产物为信号；真实可见性由 .bz-suggest-box 的 !important 承担）
    expect(box.classList.contains('bz-suggest-box')).toBe(true);
    expect(box.querySelectorAll('.bz-suggest-item').length).toBe(1);

    // 隐藏弹窗（不销毁）→ 点外部建议框收起（监听仍挂载）
    UIManager.hideAddDialog();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(box.style.display).toBe('none');

    // 再次打开后建议照常渲染、点外部照常收起（监听未被误删）
    UIManager.showAddDialog(null);
    courseBtn.click();
    expect(box.classList.contains('bz-suggest-box')).toBe(true);
    expect(box.querySelectorAll('.bz-suggest-item').length).toBe(1);
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(box.style.display).toBe('none');
  });
});

describe('ESC 双窗口径（P2）', () => {
  it('主面板不可见、仅添加弹窗可见 → ESC 关闭添加弹窗（修复失灵）', async () => {
    const vault = new MockVault();
    await initApp(vault); // App.init 已注册 ESC 层
    UIManager.hideMain(); // 主面板不可见
    UIManager.showAddDialog(null);
    expect(document.getElementById('add-todo-popup')!.style.display).toBe('block');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('add-todo-popup')!.style.display).toBe('none');
  });

  it('主面板可见 → ESC 仍关闭主面板（原行为不回归）', async () => {
    const vault = new MockVault();
    await initApp(vault);
    UIManager.showMain(null, false);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('todo-popup')!.style.display).toBe('flex');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('todo-popup')!.style.display).toBe('none');
  });

  it('e1-memo：弹窗内 ESC 只关添加弹窗——一次 ESC 不连关主面板（草稿不丢）', async () => {
    const vault = new MockVault();
    await initApp(vault);
    UIManager.showMain(null, false);
    await new Promise((r) => setTimeout(r, 20));
    UIManager.showAddDialog(null);
    expect(document.getElementById('todo-popup')!.style.display).toBe('flex'); // 主面板开
    expect(document.getElementById('add-todo-popup')!.style.display).toBe('block'); // 添加弹窗开

    // 弹窗内部按 ESC：addPopup 层 stopImmediatePropagation 拦停冒泡 → 只关添加弹窗，主面板保持
    document.getElementById('add-todo-content')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(document.getElementById('add-todo-popup')!.style.display).toBe('none');
    expect(document.getElementById('todo-popup')!.style.display).toBe('flex');

    // 主面板外（document 层）再按 ESC → 才关主面板（层级语义不回归）
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('todo-popup')!.style.display).toBe('none');
  });
});
