/**
 * 主面板与标签栏（原脚本 160-240 + 735-1362 的 UI 部分）。
 * 负责面板/遮罩/头部/标签栏/进度条的创建，init 幂等入口，ESC 注册。
 */
import { escManager } from '../../core/esc-manager';
import type { EscHandle } from '../../core/esc-manager';
import { getApp } from '../app';
import { getPrimaryTagsConfig, getSubTagsOfPrimary, getTagEmoji, isSubTag, getParentPrimaryTag } from '../config';
import { state, setCurrentActiveParentForSub, getCurrentActiveParentForSub } from '../state';
import { loadAll, onFullRefresh, onLightRefresh, onProgress, onLoadingChange, onFileChange } from '../store';
import { applyFilter, cancelEdit, updateSticky, initScroll } from './entries';
import { createTag, rebuildTags, refreshSubTagsBar } from './filter-shared';
import { createTagPicker, createAddDialog, createConfirmDialog, createDatePicker, showDatePicker, openAddDialog } from './dialogs';
import { registerOpenDialogCommand, registerQuoteCommand } from './quote';

/** 面板内使用的标签配置访问器（由 ui-config 提供，避免直接依赖 config 的变更状态） */

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

export function createMaskAndPopup() {
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
  buttonContainer.style.cssText = 'display:flex;align-items:center;gap:12px;';
  const searchButton = createButton('🔍', '搜索日记', () => toggleSearch());
  searchButton.style.fontSize = '15px';
  searchButton.style.marginTop = '4px';
  searchButton.style.opacity = '0';
  searchButton.style.pointerEvents = 'none';

  const addButton = createButton('✏️', '写日记', () => openAddDialog());
  addButton.style.fontSize = '15px';
  addButton.style.marginTop = '4px';

  const closeButton = createButton('❌', '关闭', () => {
    state.ui.maskLayer!.style.visibility = 'hidden';
    state.ui.tagFilterPopup!.style.visibility = 'hidden';
  });
  closeButton.style.fontSize = '13px';
  closeButton.style.marginTop = '5px';

  buttonContainer.appendChild(addButton);
  buttonContainer.appendChild(searchButton);
  buttonContainer.appendChild(closeButton);
  header.appendChild(titleContainer);
  header.appendChild(buttonContainer);
  return header;
}

// ===== 通用按钮（原 1132-1141） =====

function createButton(text: string, title: string, onClick: () => void) {
  const button = document.createElement('button');
  button.textContent = text;
  button.title = title;
  button.style.cssText =
    'background:none;border:none;font-size:28px;cursor:pointer;color:var(--text-muted);padding:0;width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;box-shadow:none;transition:background 0.2s;margin-top:0px;';
  button.onmouseover = () => (button.style.background = 'var(--background-secondary)');
  button.onmouseout = () => (button.style.background = 'none');
  button.onclick = onClick;
  return button;
}

// ===== 标签栏（原 1144-1362） =====

export function createTagBar() {
  const tagsContainer = document.createElement('div');
  tagsContainer.id = 'diary-tag-container';
  tagsContainer.style.cssText = 'padding:10px 24px;';

  const tagsScrollContainer = document.createElement('div');
  tagsScrollContainer.className = 'diary-tags-scroll-container';

  // 遍历主标签（不含二级标签）
  for (const [tag, config] of Object.entries(getPrimaryTagsConfig())) {
    tagsScrollContainer.appendChild(createTag(tag, config.emoji, null));
  }

  tagsContainer.appendChild(tagsScrollContainer);
  return tagsContainer;
}

// ===== 设置读取（实现见 ui-settings.ts） =====
export { applyUiSettings, getDefaultTagSetting, getEnableLongPressSetting, getShowTagCountSetting, getUseFileDateTimeSetting } from './ui-settings';
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

/**
 * 初始化日记过滤器主入口（幂等：面板已存在时仅重新显示）
 */
export async function init(plugin?: { registerEvent: (ref: unknown) => unknown }) {
  if (document.getElementById('diary-tag-filter')) {
    document.getElementById('diary-tag-filter')!.style.visibility = 'visible';
    const mask = document.getElementById('diary-filter-mask');
    if (mask) mask.style.visibility = 'visible';
    if (state.ui.scrollContainer) setTimeout(updateSticky, 100);
    return;
  }

  state.ui.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  await registerOpenDialogCommand();
  await registerQuoteCommand();
  createMaskAndPopup();
  createAddDialog();
  createDatePicker();
  registerEscapeListener();

  // 加载即打开面板（原脚本此处首次不显示，属缺陷，修正）
  state.ui.isPopupShown = true;
  state.ui.maskLayer!.style.visibility = 'visible';
  state.ui.tagFilterPopup!.style.visibility = 'visible';

  initScroll();
  await loadAll();

  // 注册文件监听（自动刷新）
  if (!state.events.fileListenerAttached) {
    state.events.fileModifyHandler = onFileChange as any;
    if (plugin) {
      plugin.registerEvent(getApp().vault.on('modify', state.events.fileModifyHandler as any));
    } else {
      getApp().vault.on('modify', state.events.fileModifyHandler as any);
    }
    state.events.fileListenerAttached = true;
  }

  // 注册 UI 刷新回调（全量/轻量）
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
}

/** 显示日记面板（ribbon/命令入口） */
export async function showDiaryPanel(plugin?: { registerEvent: (ref: unknown) => unknown }) {
  await init(plugin);
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
        main.style.visibility = 'hidden';
        const popup = byId('diary-tag-filter');
        if (popup) popup.style.visibility = 'hidden';
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

