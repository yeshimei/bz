/**
 * 主面板与标签栏（原脚本 160-240 + 735-1362 的 UI 部分）。
 * 负责面板/遮罩/头部/标签栏/进度条的创建，init 幂等入口，ESC 注册。
 */
import { Setting } from 'obsidian';
import { pad2 } from '../../core/utils';
import { notice } from '../../core/notice';
import { escManager } from '../../core/esc-manager';
import type { EscHandle } from '../../core/esc-manager';
import { onDomainEvent } from '../../core/domain-bus';
import { getSettings, saveSettings, tryGetSettings } from '../../core/settings-provider';
import { applyMobileWindowFullscreen, isMobileEnv } from '../../core/mobile';
import { openSettingsModal, createSettingsGroup } from '../../core/settings-modal';
import { applyDirectories, getPrimaryTagsConfig, getPrimaryTagsInDisplayOrder, getTagEmoji } from '../config';
import { applyUiSettings, getDefaultDateFilterSetting, getDefaultSelectedTagSetting } from './ui-settings';
import { state } from '../state';
import { loadAll, onFullRefresh, onLightRefresh, onProgress, onLoadingChange, onFileChange, clearEncryptedEntries, reloadWithEncrypted } from '../store';
import { lockSafe, isUnlocked, onUnlockChange } from '../encrypt';
import { applyFilter, cancelEdit, updateSticky, initScroll } from './entries';
import { createTag, rebuildTags, refreshSubTagsBar } from './filter-shared';
import { createTagPicker, createAddDialog, createDatePicker, showDatePicker, openAddDialog } from './dialogs';
import { registerOpenDialogCommand } from './quote';

// ===== 进度条（原 202-237） =====

function ensureProgressBar(): HTMLElement | null {
  const tagContainer = document.getElementById('diary-tag-container');
  if (!tagContainer) return null;
  let progressBar = tagContainer.querySelector('.diary-github-progress-bar') as HTMLElement | null;
  if (!progressBar) {
    progressBar = document.createElement('div');
    progressBar.className = 'diary-github-progress-bar';
    tagContainer.insertBefore(progressBar, tagContainer.querySelector('.diary-tags-scroll-container'));
  }
  progressBar.style.width = '0%';
  progressBar.style.opacity = '1';
  progressBar.style.height = '2px';
  return progressBar;
}

function updateProgress(loadedCount: number, totalCount: number) {
  const bar = ensureProgressBar();
  if (!bar) return;
  if (totalCount === 0) {
    bar.style.opacity = '0';
    return;
  }
  const percent = (loadedCount / totalCount) * 100;
  bar.style.width = `${percent}%`;
  if (loadedCount >= totalCount) {
    bar.style.opacity = '0';
  }
}

function hideProgress() {
  const bar = document.querySelector('.diary-github-progress-bar') as HTMLElement | null;
  if (bar) bar.style.opacity = '0';
}

// ===== 主面板创建（原 744-864） =====

function createMaskAndPopup() {
  const existingMask = document.getElementById('diary-filter-mask');
  const existingPopup = document.getElementById('diary-tag-filter');
  if (existingMask) existingMask.remove();
  if (existingPopup) existingPopup.remove();

  state.ui.maskLayer = document.createElement('div');
  state.ui.maskLayer.id = 'diary-filter-mask';
  state.ui.maskLayer.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;background:var(--background-modifier-cover);z-index:9998;visibility:hidden;';
  state.ui.maskLayer.onclick = () => {
    state.ui.maskLayer!.style.visibility = 'hidden';
    state.ui.tagFilterPopup!.style.visibility = 'hidden';
  };

  state.ui.tagFilterPopup = document.createElement('div');
  state.ui.tagFilterPopup.id = 'diary-tag-filter';
  state.ui.tagFilterPopup.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.2);z-index:9999;width:90%;max-width:800px;max-height:80vh;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif;visibility:hidden;';

  const header = createHeader();
  const tagsContainer = createTagBar();
  state.ui.entriesContainer = document.createElement('div');
  state.ui.entriesContainer.id = '__diary-entries-container__';
  state.ui.entriesContainer.style.cssText = 'flex:1;overflow-y:auto;padding:0;position:relative;min-height:300px;';

  const searchContainer = document.createElement('div');
  searchContainer.id = 'diary-search-container';
  searchContainer.style.cssText = 'padding: 0 24px 12px 24px;';

  const searchInput = document.createElement('input');
  searchInput.id = 'diary-search-input';
  searchInput.type = 'text';
  searchInput.placeholder = '🔍 搜索日记（正文、类型、时间）...';
  searchInput.style.cssText = `
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  background: var(--background-primary);
  color: var(--text-normal);
  outline: none;
  box-sizing: border-box;
`;
  searchInput.addEventListener('input', (e) => {
    const keyword = (e.target as HTMLInputElement).value.trim();
    if (state.data.searchDebounceTimer) clearTimeout(state.data.searchDebounceTimer);
    state.data.searchDebounceTimer = setTimeout(() => {
      state.data.currentSearchKeyword = keyword;
      applyFilter();
    }, 300);
  });
  searchContainer.appendChild(searchInput);

  state.ui.tagFilterPopup.appendChild(header);
  state.ui.tagFilterPopup.appendChild(tagsContainer);
  state.ui.tagFilterPopup.appendChild(searchContainer);
  state.ui.tagFilterPopup.appendChild(state.ui.entriesContainer);

  // 创建二级标签区域容器（初始隐藏）
  const subTagsContainer = document.createElement('div');
  subTagsContainer.id = 'diary-subtags-container';
  subTagsContainer.style.cssText = 'padding: 0 24px 12px 24px; display: none; flex-wrap: wrap; gap: 8px;  margin-top: 12px;';

  // 插入到 diary-tag-container 之后，search-container 之前
  const tagContainer = document.getElementById('diary-tag-container');
  if (tagContainer && tagContainer.parentNode) {
    tagContainer.insertAdjacentElement('afterend', subTagsContainer);
  } else {
    // 降级：直接添加到 popup
    state.ui.tagFilterPopup.insertBefore(subTagsContainer, searchContainer);
  }

  document.body.appendChild(state.ui.maskLayer);
  document.body.appendChild(state.ui.tagFilterPopup);
  createTagPicker();
}

// ===== 关闭面板（关面板即上锁，ADR-0017 固定行为） =====

/** 隐藏主面板并锁定保险箱：上锁后加密条目完全不可见（Q21-a） */
function closePanel() {
  if (state.ui.maskLayer) state.ui.maskLayer.style.visibility = 'hidden';
  if (state.ui.tagFilterPopup) state.ui.tagFilterPopup.style.visibility = 'hidden';
  // isUnlocked 自带降级链（未注入设置视为未解锁），不会抛错
  if (isUnlocked()) {
    lockSafe();
    clearEncryptedEntries();
  }
}

// ===== 头部（原 822-864） =====

function createHeader() {
  const header = document.createElement('div');
  header.className = 'diary-popup-header';
  header.style.cssText = 'padding:20px 24px 12px 24px;display:flex;justify-content:space-between;align-items:center;';

  const titleContainer = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = '日记本';
  title.style.cssText = 'margin:0;font-size:18px;font-weight:600;color:var(--text-normal);cursor:pointer;display:flex;align-items:center;';
  title.onclick = (e) => {
    e.stopPropagation();
    showDatePicker();
  };
  titleContainer.appendChild(title);

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display:flex;align-items:center;gap:8px;';
  const settingsButton = createButton('⚙️', '日记本设置', () => openDiarySettingsModal());
  const searchButton = createButton('🔍', '搜索日记', () => toggleSearch());
  searchButton.style.opacity = '0';
  searchButton.style.pointerEvents = 'none';

  const addButton = createButton('✏️', '写日记', () => openAddDialog());

  const closeButton = createButton('❌', '关闭', () => {
    closePanel();
  });

  buttonContainer.appendChild(addButton);
  buttonContainer.appendChild(searchButton);
  buttonContainer.appendChild(settingsButton);
  buttonContainer.appendChild(closeButton);
  header.appendChild(titleContainer);
  header.appendChild(buttonContainer);
  return header;
}

// ===== 日记本设置弹窗（ADR-0009 域设置弹窗；分组卡片重设计，2026-08 用户拍板方案 A） =====

/** 通用下拉设置项（显示组/默认视图组共用）；onUiChanged 在保存后同步 UI 状态 */
function dropdownSetting(
  parent: HTMLElement,
  s: any,
  name: string,
  desc: string,
  field: string,
  options: [string, string][],
  onUiChanged?: () => void
) {
  return new Setting(parent)
    .setName(name)
    .setDesc(desc)
    .addDropdown((dd) => {
      for (const [value, label] of options) dd.addOption(value, label);
      dd.setValue(s[field] || options[0][0]).onChange(async (v) => {
        s[field] = v;
        await saveSettings();
        onUiChanged?.();
      });
    });
}

/** 目录组：日记/影视/信目录 + 每批加载数量 */
function addDirectoryGroup(el: HTMLElement, s: any) {
  const dirGroup = createSettingsGroup(el, { icon: 'folder-open', name: '目录' });
  const textSetting = (name: string, desc: string, field: string) =>
    new Setting(dirGroup)
      .setName(name)
      .setDesc(desc)
      .addText((text) =>
        text.setValue(s[field] || '').onChange(async (v) => {
          s[field] = v;
          await saveSettings();
          applyDirectories(s);
        })
      );
  textSetting('日记目录', '存放日记文件的文件夹路径', 'diaryDirectory');
  textSetting('影视目录', '存放影视笔记的文件夹路径', 'movieDirectory');
  textSetting('信目录', '存放信件的文件夹路径', 'letterDirectory');
  textSetting('每批加载数量', '滚动加载时每批显示的条目数', 'diaryBatchSize');
}

/** 显示组变更联动：应用 UI 设置并重建标签栏与列表 */
function uiSettingsChanged(s: any) {
  applyUiSettings(s);
  rebuildTags();
  applyFilter();
}

/** 显示组：标签计数 / 默认日期取自文件 / 标签表情 / 渲染方式 / 标签排序 */
function addViewGroup(el: HTMLElement, s: any) {
  const viewGroup = createSettingsGroup(el, { icon: 'eye', name: '显示' });
  const toggleSetting = (name: string, desc: string, field: string, syncUi: boolean) =>
    new Setting(viewGroup)
      .setName(name)
      .setDesc(desc)
      .addToggle((toggle) =>
        toggle.setValue(!!s[field]).onChange(async (v) => {
          s[field] = v;
          await saveSettings();
          if (syncUi) uiSettingsChanged(s);
        })
      );
  toggleSetting('显示标签计数', '在标签按钮上显示该标签包含的条目数量', 'showTagCount', true);
  toggleSetting('默认日期取自文件', '添加日记时默认日期取自当前打开的日记文件，否则用当前时间', 'useFileDateTime', true);
  toggleSetting('标签按钮显示表情', '筛选栏与写日记弹窗的标签按钮显示表情，关闭则显示文字', 'diaryTagShowEmoji', true);
  dropdownSetting(viewGroup, s, '卡片内容渲染方式', '日记卡片内容按格式渲染或纯文本显示', 'diaryContentRenderMode', [
    ['markdown', 'Markdown'],
    ['plain', '纯文本'],
  ], () => uiSettingsChanged(s));
  dropdownSetting(viewGroup, s, '标签排序', '筛选栏主标签按内置配置顺序或条目数量排序', 'diaryTagSortMode', [
    ['fixed', '按固定顺序'],
    ['count', '按条目数量'],
  ], () => uiSettingsChanged(s));
}

/** 默认视图组：默认日期筛选 / 默认选中标签 / 保存后进入编辑 */
function addDefaultViewGroup(el: HTMLElement, s: any) {
  const defaultGroup = createSettingsGroup(el, { icon: 'monitor', name: '默认视图' });
  dropdownSetting(defaultGroup, s, '面板默认日期筛选', '打开日记本面板时默认的日期范围', 'diaryDefaultDateFilter', [
    ['all', '全部'],
    ['this-month', '本月'],
  ], () => uiSettingsChanged(s));
  dropdownSetting(defaultGroup, s, '默认选中标签', '打开面板时默认选中的主标签', 'diaryDefaultSelectedTag', [
    ['', '全部'],
    ...Object.keys(getPrimaryTagsConfig()).map((tag) => [tag, tag] as [string, string]),
  ], () => uiSettingsChanged(s));
  new Setting(defaultGroup)
    .setName('保存后进入编辑')
    .setDesc('保存日记后直接进入编辑模式')
    .addToggle((toggle) =>
      toggle.setValue(!!s.diaryJumpToEditAfterSave).onChange(async (v) => {
        s.diaryJumpToEditAfterSave = v;
        await saveSettings();
      })
    );
}

/** 移动端组：仅移动端显示「移动端默认全屏」 */
function addMobileGroup(el: HTMLElement, s: any) {
  if (!isMobileEnv()) return;
  const mobileGroup = createSettingsGroup(el, { icon: 'smartphone', name: '移动端' });
  new Setting(mobileGroup)
    .setName('移动端默认全屏')
    .setDesc('移动端打开主窗口时默认全屏，关闭则显示常规卡片')
    .addToggle((toggle) =>
      toggle.setValue(!!s.diaryMobileDefaultFullscreen).onChange(async (v) => { s.diaryMobileDefaultFullscreen = v; await saveSettings(); })
    );
}

/** 打开日记本设置弹窗 */
function openDiarySettingsModal() {
  openSettingsModal({
    title: '日记本设置',
    maxWidth: 560,
    build: (el) => {
      const s = getSettings() as any;
      addDirectoryGroup(el, s);
      addViewGroup(el, s);
      addDefaultViewGroup(el, s);
      addMobileGroup(el, s);
    },
  });
}

// ===== 通用按钮（原 1132-1141） =====

function createButton(text: string, title: string, onClick: () => void) {
  const button = document.createElement('button');
  button.textContent = text;
  button.title = title;
  // 规格：普通 14px/22×26，关闭 ❌ 13px/21×25
  const isClose = text === '❌';
  button.style.cssText =
    `background:none;border:none;font-size:${isClose ? 13 : 14}px;cursor:pointer;color:var(--text-muted);padding:0;width:${isClose ? 21 : 22}px;height:${isClose ? 25 : 26}px;border-radius:4px;display:flex;align-items:center;justify-content:center;box-shadow:none;transition:background 0.2s;`;
  if (isClose) button.classList.add('bz-win-close');
  button.onmouseover = () => (button.style.background = 'var(--background-secondary)');
  button.onmouseout = () => (button.style.background = 'none');
  button.onclick = onClick;
  return button;
}

// ===== 标签栏（原 1144-1362） =====

function createTagBar() {
  const tagsContainer = document.createElement('div');
  tagsContainer.id = 'diary-tag-container';
  tagsContainer.style.cssText = 'padding:10px 24px;';

  const tagsScrollContainer = document.createElement('div');
  tagsScrollContainer.className = 'diary-tags-scroll-container';

  // 遍历主标签（不含二级标签；加密固定最后，用户决策）
  const config = getPrimaryTagsConfig();
  for (const tag of getPrimaryTagsInDisplayOrder()) {
    tagsScrollContainer.appendChild(createTag(tag, config[tag]?.emoji || '📖', null));
  }

  tagsContainer.appendChild(tagsScrollContainer);
  return tagsContainer;
}

// ===== 设置读取（实现见 ui-settings.ts；applyUiSettings 由 main.ts 经此导入） =====
export { applyUiSettings } from './ui-settings';
// ===== 搜索（原 867-912） =====

export function setLoadingState(loading: boolean) {
  const searchBtn = document.querySelector('.diary-popup-header button[title="搜索日记"]') as HTMLButtonElement | null;
  const searchContainer = document.getElementById('diary-search-container');
  const searchInput = document.getElementById('diary-search-input') as HTMLInputElement | null;

  if (searchBtn) {
    searchBtn.disabled = loading;
    searchBtn.style.opacity = loading ? '0.5' : '1';
    searchBtn.style.pointerEvents = loading ? 'none' : 'auto';
  }

  if (loading) {
    if (searchContainer && searchContainer.style.display !== 'none') {
      searchContainer.style.display = 'none';
    }
    if (searchInput) {
      searchInput.value = '';
    }
    if (state.data.searchDebounceTimer) clearTimeout(state.data.searchDebounceTimer);
    state.data.currentSearchKeyword = '';
  }
}

export function toggleSearch() {
  const searchContainer = document.getElementById('diary-search-container');
  const searchInput = document.getElementById('diary-search-input') as HTMLInputElement | null;
  if (!searchContainer) return;

  if (searchContainer.style.display === 'none' || getComputedStyle(searchContainer).display === 'none') {
    searchContainer.style.display = 'block';
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  } else {
    searchContainer.style.display = 'none';
    if (searchInput) {
      searchInput.value = '';
    }
    state.data.currentSearchKeyword = '';
    if (state.data.searchDebounceTimer) clearTimeout(state.data.searchDebounceTimer);
    applyFilter();
  }
}

// ===== 初始化入口（原 160-200） =====

let diaryEscHandle: EscHandle | null = null;
let refreshCallbacksRegistered = false;
let unlockListenerRegistered = false;
/** 文件监听退订函数（模块级）：面板关闭复开由 fileListenerAttached 守卫防重复订阅 */
let fileEventUnsubscribes: (() => void)[] = [];

// ===== 文件监听（域事件总线换线） =====

/**
 * 订阅三条 modified 通道：面板同时展示日记/影视/信三类卡片（历史如此）。
 * vault 裸事件由 core/obsidian-adapter 统一订阅并转译，此处只挂语义通道；
 * isInternalUpdate 回环抑制留在订阅端 onFileChange 内部。先退订旧订阅再挂新，
 * 防御 fileListenerAttached 被外部复位时重复叠加 handler。
 */
function attachFileChangeListeners(): void {
  detachFileChangeListeners();
  fileEventUnsubscribes = [
    onDomainEvent('diary:file-modified', onFileChange),
    onDomainEvent('movie:file-modified', onFileChange),
    onDomainEvent('letter:file-modified', onFileChange),
  ];
}

/** 退订文件监听（幂等，onDomainEvent 返回的退订函数本身可重复调用） */
function detachFileChangeListeners(): void {
  for (const off of fileEventUnsubscribes) off();
  fileEventUnsubscribes = [];
}

/**
 * 初始化日记过滤器主入口（幂等：面板已存在时仅重新显示）
 */
export async function init(plugin?: { registerEvent: (ref: unknown) => unknown }) {
  try {
  if (document.getElementById('diary-tag-filter')) {
    document.getElementById('diary-tag-filter')!.style.visibility = 'visible';
    const mask = document.getElementById('diary-filter-mask');
    if (mask) mask.style.visibility = 'visible';
    if (state.ui.scrollContainer) setTimeout(updateSticky, 100);
    // 面板已存在但数据从未加载成功 → 补一次加载
    if (state.data.originalDiaryEntries.length === 0 && !state.data.isLoadingData) {
      loadAll();
    }
    return;
  }

  state.ui.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // 注册 UI 刷新回调（必须在 loadAll 之前：首次加载即触发渲染/进度/加载态）
  if (!refreshCallbacksRegistered) {
    onFullRefresh(() => {
      if (state.ui.editingEntryId) cancelEdit(state.ui.editingEntryId, null);
      applyFilter();
      rebuildTags();
    });
    onLightRefresh(() => {
      rebuildTags();
    });
    onProgress(updateProgress);
    onLoadingChange(setLoadingState);
    refreshCallbacksRegistered = true;
  }

  // 保险箱解锁/上锁联动（ADR-0017）：解锁后重并加密条目进列表；上锁后清除，
  // 标签栏「加密」按钮随之回到锁定态。refresh 回调会自动重建标签与筛选。
  if (!unlockListenerRegistered) {
    onUnlockChange(() => {
      if (isUnlocked()) {
        void reloadWithEncrypted();
      } else {
        clearEncryptedEntries();
      }
    });
    unlockListenerRegistered = true;
  }

  await registerOpenDialogCommand();
  createMaskAndPopup();
  createAddDialog();
  createDatePicker();
  registerEscapeListener();
  // 默认视图（设置项 diaryDefaultDateFilter / diaryDefaultSelectedTag，重启生效）
  const defaultDateFilter = getDefaultDateFilterSetting();
  if (defaultDateFilter === 'this-month') {
    const now = new Date();
    state.data.currentDateFilter = {
      year: String(now.getFullYear()),
      month: pad2(now.getMonth() + 1),
    };
  } else {
    state.data.currentDateFilter = null;
  }
  const defaultTag = getDefaultSelectedTagSetting();
  if (defaultTag) {
    state.data.selectedTags = new Set([defaultTag]);
  } else {
    state.data.selectedTags.clear();
  }

  // 默认不弹窗：面板创建后保持隐藏，由 ribbon/命令（showDiaryPanel）显示
  state.ui.isPopupShown = true;

  initScroll();
  await loadAll();

  // 注册文件监听（自动刷新）：改走域事件总线三条 modified 通道
  // （plugin 参数保留签名兼容；旧版在此注册 vault 裸事件引用，现由 adapter 统一接线）
  if (!state.events.fileListenerAttached) {
    attachFileChangeListeners();
    state.events.fileListenerAttached = true;
  }
  } catch (err: any) {
    console.error('[日记本] 初始化失败:', err);
    try {
      notice('日记本初始化失败：' + (err?.message || err), 'error');
    } catch (e) {}
  }
}

/** 显示日记面板（ribbon/命令入口） */
export async function showDiaryPanel(plugin?: { registerEvent: (ref: unknown) => unknown }) {
  await init(plugin);
  // 强制显示（init 创建时保持隐藏）
  const popup = document.getElementById('diary-tag-filter');
  if (popup) popup.style.visibility = 'visible';
  const mask = document.getElementById('diary-filter-mask');
  if (mask) mask.style.visibility = 'visible';
  // 移动端默认全屏：开关开=挂 .bz-win-mfs 全屏类（幂等），关=常规卡（每次显示均执行）
  applyMobileWindowFullscreen(popup, tryGetSettings().diaryMobileDefaultFullscreen === true);
  if (state.ui.scrollContainer) setTimeout(updateSticky, 100);
}

// ===== ESC 层级（原 4126-4146） =====

function registerEscapeListener() {
  diaryEscHandle = escManager.register('diary', {
    isVisible: () => {
      const byId = (id: string) => document.getElementById(id);
      const dt = byId('unified-datetime-picker-mask');
      if (dt && dt.isConnected) return true;
      const conf = byId('delete-confirm-mask');
      if (conf && conf.style.display === 'block') return true;
      const tag = byId('diary-tag-selector-mask');
      if (tag && tag.style.display === 'block') return true;
      const add = byId('add-diary-mask');
      if (add && add.style.display === 'block') return true;
      const date = byId('diary-date-filter-mask');
      if (date && date.style.display === 'block') return true;
      const main = byId('diary-filter-mask');
      return main ? main.style.visibility === 'visible' : false;
    },
    close: () => {
      const byId = (id: string) => document.getElementById(id);
      const conf = byId('delete-confirm-mask');
      if (conf && conf.style.display === 'block') {
        conf.style.display = 'none';
        return;
      }
      const tag = byId('diary-tag-selector-mask');
      if (tag && tag.style.display === 'block') {
        tag.style.display = 'none';
        return;
      }
      const add = byId('add-diary-mask');
      if (add && add.style.display === 'block') {
        add.style.display = 'none';
        const ap = byId('add-diary-popup');
        if (ap) ap.style.display = 'none';
        return;
      }
      const date = byId('diary-date-filter-mask');
      if (date && date.style.display === 'block') {
        date.style.display = 'none';
        return;
      }
      const main = byId('diary-filter-mask');
      if (main && main.style.visibility === 'visible') {
        closePanel();
      }
    },
  });
}

/** 卸载时注销 ESC 层级 */
export function unregisterEscLayer() {
  if (diaryEscHandle) {
    diaryEscHandle.unregister();
    diaryEscHandle = null;
  }
}

