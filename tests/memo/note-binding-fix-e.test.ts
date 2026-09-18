/**
 * 备忘录（memo）· T5「给当前笔记记一笔」（bz-memo-note-binding）功能直测
 * （review-deep memo-arch 测试缺口 1）
 *
 * 背景：该命令此前只有 smoke 命令注册与 home entry-menu 映射两处「名字断言」，功能面零直测。
 * 本文件钉死 src/memo/index.ts addMemoForActiveNote 的两条分支：
 *   1. 有打开笔记：创建弹窗「定位到笔记」钮呈 is-on（绑定态），保存后条目
 *      notePath = 该笔记路径（预置绑定直达数据面，不必再点定位钮）；
 *   2. 无打开笔记（空工作区）：notice 提示「当前没有打开的笔记，未绑定」+ 普通创建弹窗
 *      （presetNote 不注入 → 定位钮非 is-on）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetMemoState } from '../../src/memo/state';
import { unloadMemo } from '../../src/memo/ui';
import { MemoData } from '../../src/memo/data';

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'minor',
  memoDefaultScene: '',
  memoOpenScene: '全部',
  memoDoneWindow: '30',
  cinemaFolderPath: '我的/影视',
};

const NOTE_PATH = '笔记/正在写的论文.md';

function seedVault(activePath: string | null): { vault: MockVault; app: any } {
  const vault = new MockVault();
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify([], null, 2));
  vault.files.set(NOTE_PATH, '# 论文\n\n正文段落。\n');
  const settings = { ...SETTINGS };
  const app = mockAppWithVault(vault);
  // 当前打开笔记（getActiveFile）：activePath 为 null 模拟空工作区
  app.workspace.getActiveFile = () => (activePath ? vault.file(activePath) : null);
  setApp(app);
  setSettingsProvider(() => settings as any);
  setSettingsSaver(vi.fn(async () => {}));
  MemoData.init(settings as any);
  return { vault, app };
}

/** 创建弹窗的「定位到笔记」chip 钮（uiBtn chip 档）与文字标签 */
function posBtn(): HTMLElement {
  return document.querySelector('.bz-memo-editor .bz-btn--chip') as HTMLElement;
}

async function openBindingDialog(app: any): Promise<void> {
  const { addMemoForActiveNote } = await import('../../src/memo');
  addMemoForActiveNote(app);
  await vi.waitFor(() => {
    expect(document.querySelector('.bz-memo-editor')).toBeTruthy();
  });
}

beforeEach(() => {
  resetObsidianMocks();
  resetMemoState();
  document.body.innerHTML = '';
});

afterEach(() => {
  unloadMemo();
  document.body.innerHTML = '';
});

describe('给当前笔记记一笔（bz-memo-note-binding，T5）', () => {
  it('有打开笔记：定位钮呈 is-on（值为该笔记路径——保存后 notePath 落盘）', async () => {
    const { vault, app } = seedVault(NOTE_PATH);
    await openBindingDialog(app);

    // 绑定态：is-on + 文字 = 笔记名（剥 .md 扩展名）
    const btn = posBtn();
    expect(btn.classList.contains('is-on')).toBe(true);
    expect(btn.textContent).toContain('正在写的论文');
    expect(hasNotice('当前没有打开的笔记，未绑定')).toBe(false);

    // 值即笔记路径：填内容保存 → notePath 预置落盘（无需手点定位钮）
    const editor = document.querySelector('.bz-memo-editor') as HTMLElement;
    (editor.querySelector('textarea') as HTMLTextAreaElement).value = '论文待办一条';
    (editor.querySelector('.bz-memo-form-actions .bz-btn--primary') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-editor')).toBeNull();
    });
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw).toHaveLength(1);
    expect(raw[0].notePath).toBe(NOTE_PATH);
  });

  it('无打开笔记：notice 提示 + 普通弹窗（定位钮不注入绑定）', async () => {
    const { vault, app } = seedVault(null);
    await openBindingDialog(app);

    expect(hasNotice('当前没有打开的笔记，未绑定')).toBe(true);
    const btn = posBtn();
    expect(btn.classList.contains('is-on')).toBe(false);
    expect(btn.textContent).toContain('定位到笔记');

    // 普通弹窗保存 → 条目无 notePath 绑定
    const editor = document.querySelector('.bz-memo-editor') as HTMLElement;
    (editor.querySelector('textarea') as HTMLTextAreaElement).value = '无绑定的一条';
    (editor.querySelector('.bz-memo-form-actions .bz-btn--primary') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(document.querySelector('.bz-memo-editor')).toBeNull();
    });
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    expect(raw).toHaveLength(1);
    expect(raw[0].notePath).toBeNull();
  });
});
