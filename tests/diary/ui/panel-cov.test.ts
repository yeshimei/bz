/**
 * 覆盖率补测：panel 主面板。
 * 重点：进度条分支、头部按钮回调（标题/搜索/添加/设置）、⚙️ 设置弹窗控件写回
 * （目录文本/显示组开关与下拉/移动端组）、ESC 分层关闭、unregisterEscLayer、
 * init 幂等重入补加载、init 异常兜底通知、遮罩点击隐藏、setLoadingState/toggleSearch。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setApp } from '../../../src/diary/app';
import { applyDirectories, resetTagsConfig } from '../../../src/diary/config';
import { init, unregisterEscLayer, setLoadingState, toggleSearch, showDiaryPanel } from '../../../src/diary/ui/panel';
import { openAddDialog, createTagPicker, showDatePicker } from '../../../src/diary/ui/dialogs';
import { showDateTimePicker } from '../../../src/diary/ui/datetime-picker';
import { applyUiSettings, getContentRenderModeSetting, getDefaultDateFilterSetting, getShowTagCountSetting } from '../../../src/diary/ui/ui-settings';
import { state, setDiaryDataMap } from '../../../src/diary/state';
import { loadAll } from '../../../src/diary/store';
import * as configModule from '../../../src/diary/config';
import { setSettingsProvider, setSettingsSaver, saveSettings } from '../../../src/core/settings-provider';
import { closeSettingsModal } from '../../../src/core/settings-modal';
import {
  resetObsidianMocks,
  clearNotices,
  hasNotice,
  Platform as MockPlatform,
} from '../../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../../mock-vault';

let vault: MockVault;
let app: any;
let settingsObj: Record<string, any>;
const saverSpy = vi.fn(async () => {});

beforeEach(async () => {
  document.body.innerHTML = '';
  resetTagsConfig();
  applyDirectories({});
  resetObsidianMocks();
  clearNotices();
  MockPlatform.isMobile = false;
  saverSpy.mockClear();
  setSettingsProvider(() => settingsObj as any);
  setSettingsSaver(saverSpy);
  settingsObj = {
    diaryDirectory: '我的/日记', movieDirectory: '我的/影视', letterDirectory: '我的/信',
    diaryBatchSize: '20', showTagCount: true, useFileDateTime: false,
    diaryTagShowEmoji: true, diaryContentRenderMode: 'markdown', diaryTagSortMode: 'fixed',
    diaryDefaultDateFilter: 'all', diaryDefaultSelectedTag: '', diaryJumpToEditAfterSave: false,
  };
  state.data.selectedTags.clear();
  state.data.currentDateFilter = null;
  state.data.currentSearchKeyword = '';
  state.data.originalDiaryEntries = [];
  state.data.currentFilteredEntries = [];
  state.ui.isPopupShown = false;
  state.ui.editingEntryId = null;
  state.events.fileListenerAttached = false;
  if (state.data.searchDebounceTimer) clearTimeout(state.data.searchDebounceTimer);
  setDiaryDataMap(null);
  vault = new MockVault();
  vault.files.set('我的/日记/2024-01-01.md', '# 📖 08:00\n第一条日记\n');
  vault.files.set('我的/日记/2024-01-02.md', '# ✍️ 09:00\n第二条日记\n');
  app = mockAppWithVault(vault);
  setApp(app);
  await init({ registerEvent: () => {} });
});

/** 从设置弹窗取指定名称的 Setting 控件组（mock Setting 把实例挂在 settingEl.__setting） */
function settingControl(name: string) {
  const el = [...document.querySelectorAll('#bz-settings-modal-popup .setting-item')].find(
    (s) => (s as HTMLElement).dataset.name === name
  );
  expect(el, `设置项「${name}」应存在`).toBeTruthy();
  return ((el as any).__setting).controls as any[];
}

/** 头部按钮（按 title 定位） */
function headBtn(title: string): HTMLElement {
  const btn = [...document.querySelectorAll('.diary-popup-header button')].find(
    (b) => (b as HTMLElement).title === title
  ) as HTMLElement;
  expect(btn, `头部应有「${title}」按钮`).toBeTruthy();
  return btn;
}

describe('进度条', () => {
  it('加载完成后进度条隐藏（totalCount=0 分支）；容器缺失时进度回调安全返回', async () => {
    const bar = document.querySelector('.diary-github-progress-bar') as HTMLElement;
    expect(bar).toBeTruthy(); // 加载过程中创建
    expect(bar.style.opacity).toBe('0'); // 收尾 emitProgress(0,0) 隐藏
    // 容器缺失 → ensureProgressBar 早退，loadAll 不抛错
    document.getElementById('diary-tag-container')!.remove();
    await expect(loadAll()).resolves.toBeUndefined();
  });
});

describe('头部按钮与遮罩', () => {
  it('点击标题打开日期筛选；点击搜索/添加按钮生效', () => {
    headBtn('搜索日记').click(); // 打开搜索框
    expect(document.getElementById('diary-search-container')!.style.display).toBe('block');
    headBtn('搜索日记').click(); // 再点收起并清关键词

    headBtn('写日记').click();
    expect(document.getElementById('add-diary-mask')!.style.display).toBe('block');
    // 关闭写日记弹窗，避免影响后续断言
    document.getElementById('add-diary-mask')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    (document.querySelector('#diary-tag-filter h3') as HTMLElement).click(); // 标题 = 日期筛选
    expect(document.getElementById('diary-date-filter-mask')!.style.display).toBe('block');
    document.getElementById('diary-date-filter-mask')!.style.display = 'none';
  });

  it('按钮悬停/移出切换背景；点击主遮罩隐藏面板', async () => {
    await showDiaryPanel();
    const add = headBtn('写日记');
    add.dispatchEvent(new Event('mouseover'));
    expect(add.style.background).toBe('var(--background-secondary)');
    add.dispatchEvent(new Event('mouseout'));
    expect(add.style.background).toBe('none');

    const mask = document.getElementById('diary-filter-mask')!;
    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(mask.style.visibility).toBe('hidden');
    expect(document.getElementById('diary-tag-filter')!.style.visibility).toBe('hidden');
  });
});

describe('⚙️ 日记本设置弹窗控件写回', () => {
  function openModal() {
    headBtn('日记本设置').click();
    expect(document.getElementById('bz-settings-modal-popup')).toBeTruthy();
  }

  it('目录组文本项 onChange 写回设置并应用目录常量', async () => {
    openModal();
    const [text] = settingControl('日记目录');
    text.trigger('我的/日记X');
    await new Promise((r) => setTimeout(r, 0));
    expect(settingsObj.diaryDirectory).toBe('我的/日记X');
    expect((configModule as any).DIARY_DIRECTORY).toBe('我的/日记X');
    expect(saverSpy).toHaveBeenCalled();
    // 还原目录，避免污染其他用例
    applyDirectories({});
    closeSettingsModal();
  });

  it('显示组开关联动 UI（计数开关→重建标签栏）；渲染方式/排序下拉写回', async () => {
    openModal();
    const [countToggle] = settingControl('显示标签计数');
    countToggle.trigger(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(getShowTagCountSetting()).toBe(false);
    expect(settingsObj.showTagCount).toBe(false);

    const [renderDd] = settingControl('卡片内容渲染方式');
    renderDd.trigger('plain');
    await new Promise((r) => setTimeout(r, 0));
    expect(getContentRenderModeSetting()).toBe('plain');

    const [sortDd] = settingControl('标签排序');
    sortDd.trigger('count');
    await new Promise((r) => setTimeout(r, 0));
    expect(settingsObj.diaryTagSortMode).toBe('count');

    // 还原
    applyUiSettings({ diaryContentRenderMode: 'markdown' });
    settingsObj.showTagCount = true;
    closeSettingsModal();
  });

  it('默认视图组下拉写回；保存后进入编辑开关写回', async () => {
    openModal();
    const [dateDd] = settingControl('面板默认日期筛选');
    dateDd.trigger('this-month');
    await new Promise((r) => setTimeout(r, 0));
    expect(getDefaultDateFilterSetting()).toBe('this-month');

    const [tagDd] = settingControl('默认选中标签');
    tagDd.trigger('书');
    await new Promise((r) => setTimeout(r, 0));
    expect(settingsObj.diaryDefaultSelectedTag).toBe('书');

    const [jumpToggle] = settingControl('保存后进入编辑');
    jumpToggle.trigger(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(settingsObj.diaryJumpToEditAfterSave).toBe(true);

    // 还原
    applyUiSettings({ diaryDefaultDateFilter: 'all', diaryDefaultSelectedTag: '', diaryJumpToEditAfterSave: false });
    closeSettingsModal();
  });

  it('移动端组仅移动端渲染；「移动端默认全屏」开关写回并在显示时挂全屏类', async () => {
    MockPlatform.isMobile = true;
    settingsObj.diaryMobileDefaultFullscreen = false;
    openModal();
    const names = [...document.querySelectorAll('#bz-settings-modal-popup .setting-item')].map(
      (el) => (el as HTMLElement).dataset.name
    );
    expect(names).toContain('移动端默认全屏');
    const [mfs] = settingControl('移动端默认全屏');
    mfs.trigger(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(settingsObj.diaryMobileDefaultFullscreen).toBe(true);
    closeSettingsModal();

    // 显示面板：开关开 + 移动端 → 挂 bz-win-mfs 全屏类
    await showDiaryPanel();
    expect(document.getElementById('diary-tag-filter')!.classList.contains('bz-win-mfs')).toBe(true);

    // 关闭开关 + 桌面端 → 摘类
    MockPlatform.isMobile = false;
    settingsObj.diaryMobileDefaultFullscreen = false;
    await showDiaryPanel();
    expect(document.getElementById('diary-tag-filter')!.classList.contains('bz-win-mfs')).toBe(false);
  });
});

describe('ESC 分层关闭', () => {
  it('顶层弹窗优先：写日记弹窗开着时 ESC 只关它，主面板保持可见', async () => {
    await showDiaryPanel();
    openAddDialog();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('add-diary-mask')!.style.display).toBe('none');
    expect(document.getElementById('add-diary-popup')!.style.display).toBe('none');
    expect(document.getElementById('diary-tag-filter')!.style.visibility).toBe('visible');
  });

  it('依次覆盖 标签选择器 / 日期筛选 / 滚轮选择器 的 ESC 关闭', async () => {
    await showDiaryPanel();
    createTagPicker();
    const entry = state.data.originalDiaryEntries[0];
    const { showTagPicker } = await import('../../../src/diary/ui/dialogs');
    showTagPicker(entry.id!);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('diary-tag-selector-mask')!.style.display).toBe('none');

    showDatePicker();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('diary-date-filter-mask')!.style.display).toBe('none');

    const dtMask = showDateTimePicker((await import('obsidian')).moment('2024-06-15 14:30'), () => {});
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dtMask.isConnected).toBe(false);
  });

  it('仅主面板可见时 ESC 关闭整个面板', async () => {
    await showDiaryPanel();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('diary-tag-filter')!.style.visibility).toBe('hidden');
    expect(document.getElementById('diary-filter-mask')!.style.visibility).toBe('hidden');
  });

  it('unregisterEscLayer 后 ESC 不再关闭主面板', async () => {
    await showDiaryPanel();
    unregisterEscLayer();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('diary-tag-filter')!.style.visibility).toBe('visible');
  });
});

describe('init 幂等重入与异常兜底', () => {
  it('面板已存在且数据被清空 → 再次 init 补一次加载', async () => {
    state.data.originalDiaryEntries = [];
    state.data.currentFilteredEntries = [];
    await init({ registerEvent: () => {} });
    // 重入分支内的 loadAll 未被 await，轮询等待补加载完成
    const start = Date.now();
    while (state.data.originalDiaryEntries.length < 2) {
      if (Date.now() - start > 3000) throw new Error('补加载超时');
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(state.data.originalDiaryEntries.length).toBe(2);
    expect(document.getElementById('diary-tag-filter')!.style.visibility).toBe('visible');
  });

  it('注册文件监听失败 → 「日记本初始化失败」错误通知', async () => {
    document.body.innerHTML = ''; // 强制走完整初始化路径
    state.events.fileListenerAttached = false;
    vi.spyOn(app.vault, 'on').mockImplementation(() => {
      throw new Error('监听挂了');
    });
    await init({ registerEvent: () => {} });
    expect(hasNotice(/日记本初始化失败/)).toBe(true);
  });
});

describe('搜索框状态', () => {
  it('setLoadingState(true/false)：禁用与恢复、隐藏已展开的搜索框、双输入防抖清理', () => {
    const container = document.getElementById('diary-search-container')!;
    const input = document.getElementById('diary-search-input') as HTMLInputElement;
    container.style.display = 'block';
    input.value = '旧关键词';
    setLoadingState(true);
    expect(container.style.display).toBe('none');
    expect(input.value).toBe('');
    const searchBtn = headBtn('搜索日记') as HTMLButtonElement;
    expect(searchBtn.disabled).toBe(true);
    expect(searchBtn.style.opacity).toBe('0.5');
    expect(searchBtn.style.pointerEvents).toBe('none');
    setLoadingState(false);
    expect(searchBtn.disabled).toBe(false);
    expect(searchBtn.style.opacity).toBe('1');
    expect(searchBtn.style.pointerEvents).toBe('auto');
  });

  it('连续输入两次触发防抖计时器清理路径', () => {
    const input = document.getElementById('diary-search-input') as HTMLInputElement;
    input.value = '第一';
    input.dispatchEvent(new Event('input'));
    input.value = '第二';
    expect(() => input.dispatchEvent(new Event('input'))).not.toThrow();
    if (state.data.searchDebounceTimer) clearTimeout(state.data.searchDebounceTimer);
  });
});
