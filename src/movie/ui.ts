/**
 * 影视 UI（ticket 14 修正版：对齐源码逐字——卡片/overlay/添加/编辑/设置弹窗）
 */
import type { App, TFile } from 'obsidian';
import { Setting } from 'obsidian';
import { notice, notify } from '../core/notice';
import { escManager } from '../core/esc-manager';
import { formatRelativeTime, pad2 } from '../core/utils';
import { getSettings, saveSettings, tryGetSettings } from '../core/settings-provider';
import { openSettingsModal, createSettingsGroup } from '../core/settings-modal';
import { isMobileEnv, applyMobileWindowFullscreen } from '../core/mobile';
import { STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED, getTypeColor, getStarRating, ALL_TAGS, getGroupForTag } from './constants';
import { M, takeHomeFilmStatus, type MovieItem } from './state';
import { getDisplayItems, refreshDataAndView, rebuildItems } from './data';
import { attachItemActions, refreshItemSheet, registerSheetCompanion, unregisterSheetCompanion, type ItemAction } from '../core/item-actions';
import { confirm } from '../core/confirm';
import { runAIRecommend, runSimilarRecommend } from './recommend';
import { watchPosterFetch } from './poster-watch';
import { openAnalysisModal } from '../movie-report/analysis'; // ADR-0048：报告独立域，📊 按钮跨域显式引用（纯数据回引 constants 无环）
import { emitDomainEvent } from '../core/domain-bus';

/** 渲染卡片列表（分页，源码 L279-426 逐字） */
export function renderAll(displayItems: any[], container: HTMLElement, app: App): void {
  const total = displayItems.length;
  if (total === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">暂无符合条件的影视记录</p>';
    return;
  }

  if (M.loadedCount === 0) M.loadedCount = Math.min(M.pageSize, total);
  const showCount = Math.min(M.loadedCount, total);

  container.innerHTML = '';
  const itemsToRender = displayItems.slice(0, showCount);

  itemsToRender.forEach((item) => {
    const card = document.createElement('div');
    card.style.cssText = `
      display: flex; align-items: flex-start; padding: 10px 8px;
      border-radius: 8px; margin-bottom: 8px;
      background: var(--background-secondary); cursor: pointer;
      transition: background 0.2s;
    `;
    // 手势：长按卡片弹抽屉（统一动作）；双击整卡打开影视笔记（2026-08-22 用户决策回加，
    // ticket 69 手势收敛曾移除双击；与抽屉/右键「打开」同路径 openMovieNote）

    if (item.poster) {
      const posterFile = app.vault.getAbstractFileByPath(item.poster);
      if (posterFile && /\.(png|jpe?g|gif|webp)$/i.test(posterFile.name)) {
        const img = document.createElement('img');
        img.src = app.vault.getResourcePath(posterFile as TFile);
        img.style.cssText = `
          width: 48px; height: 64px; object-fit: cover;
          border-radius: 6px; margin-right: 12px; flex-shrink: 0;
          background: var(--background-modifier-border);
        `;
        card.appendChild(img);
      }
    }

    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'flex: 1; min-width: 0;';

    const nameEl = document.createElement('div');
    nameEl.textContent = item.name;
    nameEl.style.cssText = `
      font-weight: 600; font-size: 1rem;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    `;

    const metaRow = document.createElement('div');
    metaRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap;';

    const badge = document.createElement('span');
    badge.textContent = item.typeTag;
    const color = getTypeColor(item.group);
    badge.style.cssText = `
      display: inline-block; padding: 2px 8px; border-radius: 10px;
      font-size: 0.75rem;
      background: ${color};
      color: white;
      white-space: nowrap;
    `;
    metaRow.appendChild(badge);

    const statusContainer = document.createElement('span');
    statusContainer.style.cssText = 'display: inline-flex; align-items: center; gap: 4px;';
    // 手势收敛：状态徽章不再单独可点（长按卡片弹抽屉统一操作）

    if (item.status === STATUS_WATCHING) {
      const watchingBadge = document.createElement('span');
      watchingBadge.textContent = '在看';
      watchingBadge.style.cssText = `
        font-size: 0.75rem;
        background: var(--text-accent);
        color: var(--background-primary);
        padding: 2px 8px; border-radius: 10px;
      `;
      statusContainer.appendChild(watchingBadge);
    } else if (item.status === STATUS_WANT) {
      const wish = document.createElement('span');
      wish.textContent = '想看';
      wish.style.cssText = `
        font-size: 0.75rem;
        background: var(--text-muted);
        color: var(--background-primary);
        padding: 2px 8px; border-radius: 10px;
      `;
      statusContainer.appendChild(wish);
    } else if (item.status === STATUS_WATCHED) {
      if (item.rating !== null && item.rating > 0) {
        const stars = document.createElement('span');
        // 已看卡片评分显示（设置项 movieRatingDisplay：stars 星星串 / number ⭐数字）
        const s = tryGetSettings() as any;
        stars.textContent = s.movieRatingDisplay === 'number' ? `⭐${item.rating}` : getStarRating(item.rating);
        stars.style.cssText = 'font-size: 0.85rem;';
        statusContainer.appendChild(stars);
      }
      if (item.watchDate) {
        const dateEl = document.createElement('span');
        dateEl.textContent = formatRelativeTime(item.watchDate as string);
        dateEl.style.cssText = 'font-size: 0.8rem; color: var(--text-muted); white-space: nowrap;';
        statusContainer.appendChild(dateEl);
      }
    }

    metaRow.appendChild(statusContainer);
    infoDiv.appendChild(nameEl);
    infoDiv.appendChild(metaRow);

    if (item.review) {
      const reviewDiv = document.createElement('div');
      reviewDiv.style.cssText = `
        margin-top: 6px; font-size: 0.75rem; color: var(--text-muted);
        display: flex; align-items: baseline; gap: 4px;
      `;
      const reviewTextSpan = document.createElement('span');
      reviewTextSpan.textContent = item.review;
      reviewTextSpan.style.overflow = 'hidden';
      reviewTextSpan.style.textOverflow = 'ellipsis';
      reviewTextSpan.style.whiteSpace = 'pre-wrap';
      reviewDiv.appendChild(reviewTextSpan);
      infoDiv.appendChild(reviewDiv);
    }

    card.appendChild(infoDiv);
    attachMovieActions(card, item, app);

    // 双击整卡 → 打开影视笔记（300ms 内两次单击；单击无操作防误触——沿用剪藏回退双击先例）
    let lastCardClick = 0;
    card.addEventListener('click', (e) => {
      const now = Date.now();
      if (lastCardClick && now - lastCardClick < 300) {
        e.stopPropagation();
        e.preventDefault();
        openMovieNote(item, app);
      }
      lastCardClick = now;
    });

    container.appendChild(card);
  });

  if (showCount < total) {
    const loadMoreDiv = document.createElement('div');
    loadMoreDiv.style.cssText = 'text-align:center; padding: 8px; color: var(--text-muted); font-size:0.8rem;';
    loadMoreDiv.textContent = '滚动加载更多...';
    loadMoreDiv.id = 'load-more-indicator';
    container.appendChild(loadMoreDiv);
  }
}

/** 渲染列表 */
export function renderList(): void {
  if (!M.currentOverlay) return;
  const listContainer = M.currentOverlay.querySelector('.list-container');
  if (!listContainer) return;
  const app = M.appRef;
  if (!app) return;
  renderAll(getDisplayItems(), listContainer as HTMLElement, app);
}

/** 无限滚动（源码 L437-459） */
export function setupInfiniteScroll(container: HTMLElement): void {
  const oldListener = (container as any)._scrollListener;
  if (oldListener) {
    container.removeEventListener('scroll', oldListener);
  }
  const listener = () => {
    if (M.isLoadingMore) return;
    if (M.loadedCount >= getDisplayItems().length) return;
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 100) {
      M.isLoadingMore = true;
      M.loadedCount = Math.min(M.loadedCount + M.pageSize, getDisplayItems().length);
      const app = M.appRef;
      if (app && M.currentOverlay) {
        renderAll(getDisplayItems(), container, app);
      }
      M.isLoadingMore = false;
    }
  };
  (container as any)._scrollListener = listener;
  container.addEventListener('scroll', listener);
}

/** 搜索切换（源码 L462-483） */
export function toggleSearch(): void {
  const searchContainer = document.getElementById('movie-search-container') as HTMLElement | null;
  const searchInput = document.getElementById('movie-search-input') as HTMLInputElement | null;
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
    M.searchKeyword = '';
    if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
    M.loadedCount = 0;
    renderList();
  }
}

/** 关闭主界面（源码 L486-496） */
export function closeOverlay(): void {
  M.searchKeyword = '';
  if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);

  if (M.currentOverlay) {
    M.currentOverlay.remove();
    M.currentOverlay = null;
  }
  // 子弹窗保留，由 ESC 逐层关闭
}

// ---------- 添加弹窗（源码 L506-796 逐字） ----------

export function closeAddModal(): void {
  if (M.addOverlay) {
    M.addOverlay.remove();
    M.addOverlay = null;
  }
}

/** 类型标签按钮组（13 类）：选中变化经 onChange 回调同步外部状态 */
function createTagGroup(initial: string, onChange: (tag: string) => void): { container: HTMLElement } {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
  let selectedTag = initial;
  const tagButtons: HTMLElement[] = [];
  ALL_TAGS.forEach((tag) => {
    const group = getGroupForTag(tag);
    const color = getTypeColor(group!);
    const btn = document.createElement('button');
    btn.textContent = tag;
    btn.style.cssText = `
      padding: 6px 14px; border-radius: 20px;
      border: 1px solid var(--background-modifier-border);
      box-shadow: none;
      background: var(--background-secondary); color: var(--text-normal);
      cursor: pointer; font-size: 0.85rem;
    `;
    if (selectedTag === tag) {
      btn.style.background = color;
      btn.style.color = 'white';
      btn.style.borderColor = color;
    }
    btn.addEventListener('click', () => {
      tagButtons.forEach((b) => {
        b.style.background = 'var(--background-secondary)';
        b.style.color = 'var(--text-normal)';
        b.style.borderColor = 'var(--background-modifier-border)';
      });
      const newColor = getTypeColor(group!);
      btn.style.background = newColor;
      btn.style.color = 'white';
      btn.style.borderColor = newColor;
      selectedTag = tag;
      onChange(tag);
    });
    tagButtons.push(btn);
    container.appendChild(btn);
  });
  return { container };
}

/** 状态单选按钮组（想看/在看/已看） */
function createStatusGroup(initial: number, onChange: (status: number) => void): { container: HTMLElement } {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
  const buttonGroup = document.createElement('div');
  buttonGroup.style.cssText = 'display: flex; gap: 12px;';
  let selectedStatus = initial;
  const options = [
    { value: STATUS_WANT, label: '想看' },
    { value: STATUS_WATCHING, label: '在看' },
    { value: STATUS_WATCHED, label: '已看' },
  ];
  const radioButtons: HTMLElement[] = [];
  options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.textContent = opt.label;
    btn.style.cssText = `
      padding: 6px 14px; border-radius: 20px;
      box-shadow: none;
      background: var(--background-secondary); color: var(--text-normal);
      cursor: pointer; font-size: 0.85rem; min-width: 70px;
    `;
    if (selectedStatus === opt.value) {
      btn.style.background = 'var(--interactive-accent)';
      btn.style.color = 'var(--text-on-accent, white)';
      btn.style.borderColor = 'var(--interactive-accent)';
    }
    btn.addEventListener('click', () => {
      radioButtons.forEach((b) => {
        b.style.background = 'var(--background-secondary)';
        b.style.color = 'var(--text-normal)';
        b.style.borderColor = 'var(--background-modifier-border)';
      });
      btn.style.background = 'var(--interactive-accent)';
      btn.style.color = 'var(--text-on-accent, white)';
      btn.style.borderColor = 'var(--interactive-accent)';
      selectedStatus = opt.value;
      onChange(opt.value);
    });
    radioButtons.push(btn);
    buttonGroup.appendChild(btn);
  });
  container.appendChild(buttonGroup);
  return { container };
}

/** 多行文本输入行（影评） */
function createTextareaRow(placeholder: string, rows: number): { container: HTMLElement; textarea: HTMLTextAreaElement } {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
  const textarea = document.createElement('textarea');
  textarea.rows = rows;
  textarea.placeholder = placeholder;
  textarea.style.cssText = `
    width: 100%; padding: 6px 8px; border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary); color: var(--text-normal);
    font-size: 0.9rem;
    resize: vertical;
  `;
  container.appendChild(textarea);
  return { container, textarea };
}

export function openAddModal(app: App, prefill?: { name?: string; tag?: string; status?: number }): void {
  if (M.addOverlay) {
    closeAddModal();
    return;
  }

  const addOverlayDiv = document.createElement('div');
  addOverlayDiv.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.4); z-index: 1200;
    display: flex; align-items: center; justify-content: center;
  `;
  const addModal = document.createElement('div');
  addModal.style.cssText = `
    background: var(--background-primary); color: var(--text-normal);
    border-radius: 12px; width: 90%; max-width: 480px;
    padding: 20px; display: flex; flex-direction: column; gap: 16px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    border: 1px solid var(--background-modifier-border);
    max-height: 90vh;
    overflow-y: auto;
  `;

  const titleEl = document.createElement('div');
  titleEl.textContent = '添加影视';
  titleEl.style.cssText = 'font-size: 1.2rem; font-weight: 600;';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = '名称';
  nameInput.style.cssText = `
    width: 100%; padding: 8px 12px;
    border-radius: 6px; border: 1px solid var(--background-modifier-border);
    background: var(--background-primary); color: var(--text-normal);
    font-size: 0.95rem;
  `;

  if (prefill && prefill.name) nameInput.value = prefill.name;

  // 标题存在性实时检测：输入时检查《name》.md 是否已存在，存在则在输入框下方提示
  const dupHint = document.createElement('div');
  dupHint.style.cssText = 'color: var(--color-red); font-size: 0.8rem; display: none;';
  const checkTitleExists = (): void => {
    const name = nameInput.value.trim();
    if (!name) {
      dupHint.style.display = 'none';
      return;
    }
    const existing = app.vault.getAbstractFileByPath(`${M.folderPath}/《${name}》.md`);
    if (existing) {
      dupHint.textContent = `⚠️ 「${name}」已存在，确认后将直接打开已有笔记`;
      dupHint.style.display = 'block';
    } else {
      dupHint.style.display = 'none';
    }
  };
  nameInput.addEventListener('input', checkTitleExists);
  checkTitleExists();

  // 类型选择（13 个标签按钮组）+ 状态单选（想看/在看/已看）
  let selectedTag = (prefill && prefill.tag) || '电影';
  const typeContainer = createTagGroup(selectedTag, (t) => {
    selectedTag = t;
    updateInputVisibility();
  }).container;
  let selectedStatus = prefill && prefill.status !== undefined ? prefill.status : STATUS_WATCHED;
  const statusContainer = createStatusGroup(selectedStatus, (s) => {
    selectedStatus = s;
    updateInputVisibility();
  }).container;

  // 评分滑块（1~6 · 0.1 步进，默认 3.5）与影评（季集已移除；无日期字段——保存时默认当前日期）
  const ratingContainer = document.createElement('div');
  ratingContainer.style.cssText = 'display: none;'; // 仅已看状态下显示
  const ratingValue = document.createElement('div');
  ratingValue.className = 'bz-movie-rating-value';
  const ratingSlider = document.createElement('input');
  ratingSlider.type = 'range';
  ratingSlider.min = '1';
  ratingSlider.max = '6';
  ratingSlider.step = '0.1';
  ratingSlider.value = '3.5';
  ratingSlider.className = 'bz-movie-rating-slider';
  const updateRatingValue = () => {
    ratingValue.textContent = Number(ratingSlider.value).toFixed(1); // 滑块对应分数实时显示
  };
  ratingSlider.addEventListener('input', updateRatingValue);
  updateRatingValue();
  ratingContainer.appendChild(ratingValue);
  ratingContainer.appendChild(ratingSlider);
  const reviewRow = createTextareaRow('影评（可选）', 3);

  function updateInputVisibility() {
    const showRatingReview = selectedStatus === STATUS_WATCHED;
    ratingContainer.style.display = showRatingReview ? 'block' : 'none';
    reviewRow.container.style.display = showRatingReview ? 'flex' : 'none';
  }

  // 按钮
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.style.cssText = `
    box-shadow: none;
    padding: 6px 16px; border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    color: var(--text-normal); cursor: pointer;
  `;
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '确定';
  confirmBtn.style.cssText = `
    box-shadow: none;
    padding: 6px 16px; border-radius: 6px;
    background: var(--interactive-accent); color: var(--text-on-accent, white);
    border: none; cursor: pointer; font-weight: 500;
  `;

  cancelBtn.addEventListener('click', closeAddModal);
  confirmBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      notice('请输入名称');
      return;
    }
    if (!selectedTag) {
      notice('请选择类型');
      return;
    }

    const targetFolder = M.folderPath;
    let folderObj = app.vault.getAbstractFileByPath(targetFolder);
    if (!folderObj) await app.vault.createFolder(targetFolder);

    const fileName = `《${name}》.md`;
    const filePath = `${targetFolder}/${fileName}`;
    const existingFile = app.vault.getAbstractFileByPath(filePath);
    if (existingFile) {
      notice(`影视「${name}」已存在，正在打开`);
      closeAddModal();
      closeOverlay();
      await app.workspace.getLeaf().openFile(existingFile as TFile);
      return;
    }

    let ratingValue: number;
    if (selectedStatus === STATUS_WANT) ratingValue = -1;
    else if (selectedStatus === STATUS_WATCHING) ratingValue = 0;
    else {
      ratingValue = parseFloat(ratingSlider.value); // 滑块必有值（1~6），无需校验
    }

    // 无日期字段：观影日期默认当前日期
    const watchDateValue = localNowFormat().replace('T', ' ');
    const reviewText = reviewRow.textarea.value.trim();

    let fileContent = `---\ntags:\n- ${selectedTag}\n观影日期: ${watchDateValue}\n评分: ${ratingValue}\n`;
    if (reviewText) fileContent += `影评: ${reviewText}\n`;
    fileContent += `海报: \n---\n`;

    try {
      const newFile = await app.vault.create(filePath, fileContent);
      // ticket 074（域事件派发）：创建动作观察（emitDomainEvent → smartcat 订阅；未初始化/关闭时静默）
      emitDomainEvent('movie', {
        kind: 'created',
        name,
        status: selectedStatus === STATUS_WANT ? 'want' : selectedStatus === STATUS_WATCHING ? 'watching' : 'watched',
        rating: ratingValue,
        review: reviewText || null,
      });
      closeAddModal();
      closeOverlay();
      refreshDataAndView(app);
      await app.workspace.getLeaf().openFile(newFile);
      // 创建完成：常驻 progress 通知「正在获取海报和豆瓣信息…」→ 海报字段填充后原地更新为已完成
      const handle = notify('正在获取海报和豆瓣信息…', { type: 'progress' });
      watchPosterFetch(app, newFile, handle);
    } catch (e) {
      notice('创建笔记失败', 'error');
      console.error(e);
    }
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);

  addModal.appendChild(titleEl);
  addModal.appendChild(nameInput);
  addModal.appendChild(dupHint);
  addModal.appendChild(typeContainer);
  addModal.appendChild(statusContainer);
  addModal.appendChild(ratingContainer);
  addModal.appendChild(reviewRow.container);
  addModal.appendChild(btnRow);

  updateInputVisibility();

  addOverlayDiv.appendChild(addModal);
  document.body.appendChild(addOverlayDiv);
  M.addOverlay = addOverlayDiv;
  addOverlayDiv.addEventListener('click', (e) => {
    if (e.target === addOverlayDiv) closeAddModal();
  });
  setTimeout(() => nameInput.focus(), 50);
}

/** 本地时间格式 YYYY-MM-DDTHH:mm:ss（moment 语义） */
function localNowFormat(): string {
  const d = new Date();
  const p = pad2;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ---------- 编辑弹窗（源码 L800-1046 逐字） ----------

export function closeEditModal(): void {
  if (M.editOverlay) {
    M.editOverlay.remove();
    M.editOverlay = null;
  }
}

/** 【待接线】ticket 084a B5：影视编辑弹窗，当前无生产调用点（死代码，仅测试直调）。
 *  本弹窗确认回调可改 状态/评分/观影日期/影评 但零 emitDomainEvent('movie', …) 派发。
 *  若未来启用：确认回调 processFrontMatter 落盘后，按电影名对齐 5 挂点模式补
 *  emitDomainEvent('movie', { kind: 'status' | 'rated' | 'review', name: item.name, ... })，
 *  接线完成后再移除本注释（复用 smartcat 订阅侧 300ms 防重，B6）。 */
export function openEditModal(item: any, app: App): void {
  if (M.editOverlay) {
    closeEditModal();
    return;
  }

  const editOverlayDiv = document.createElement('div');
  editOverlayDiv.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.4); z-index: 1200;
    display: flex; align-items: center; justify-content: center;
  `;
  const editModal = document.createElement('div');
  editModal.style.cssText = `
    background: var(--background-primary); color: var(--text-normal);
    border-radius: 12px; width: 90%; max-width: 480px;
    padding: 20px; display: flex; flex-direction: column; gap: 16px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    border: 1px solid var(--background-modifier-border);
    max-height: 90vh;
    overflow-y: auto;
  `;

  const titleEl = document.createElement('div');
  titleEl.textContent = `编辑影视 - 《${item.name}》`;
  titleEl.style.cssText = 'font-size: 1.2rem; font-weight: 600;';

  const infoRow = document.createElement('div');
  infoRow.style.cssText = 'display: flex; gap: 16px; font-size: 0.9rem; color: var(--text-muted);';
  infoRow.innerHTML = `<span>类型：${item.typeTag}</span>`;
  editModal.appendChild(titleEl);
  editModal.appendChild(infoRow);

  // 状态单选（仅在看、已看）
  const statusContainer = document.createElement('div');
  statusContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
  const statusButtonGroup = document.createElement('div');
  statusButtonGroup.style.cssText = 'display: flex; gap: 12px;';

  const statusOptions = [
    { value: STATUS_WATCHING, label: '在看' },
    { value: STATUS_WATCHED, label: '已看' },
  ];
  let selectedStatus = item.status === STATUS_WANT ? STATUS_WATCHING : item.status;
  const statusRadioButtons: HTMLElement[] = [];

  statusOptions.forEach((opt) => {
    const btn = document.createElement('button');
    btn.textContent = opt.label;
    btn.style.cssText = `
      padding: 6px 14px; border-radius: 20px;
      box-shadow: none;
      background: var(--background-secondary); color: var(--text-normal);
      cursor: pointer; font-size: 0.85rem; min-width: 70px;
    `;
    if (selectedStatus === opt.value) {
      btn.style.background = 'var(--interactive-accent)';
      btn.style.color = 'var(--text-on-accent, white)';
      btn.style.borderColor = 'var(--interactive-accent)';
    }
    btn.addEventListener('click', () => {
      statusRadioButtons.forEach((b) => {
        b.style.background = 'var(--background-secondary)';
        b.style.color = 'var(--text-normal)';
        b.style.borderColor = 'var(--background-modifier-border)';
      });
      btn.style.background = 'var(--interactive-accent)';
      btn.style.color = 'var(--text-on-accent, white)';
      btn.style.borderColor = 'var(--interactive-accent)';
      selectedStatus = opt.value;
      updateInputVisibility();
    });
    statusRadioButtons.push(btn);
    statusButtonGroup.appendChild(btn);
  });

  statusContainer.appendChild(statusButtonGroup);
  editModal.appendChild(statusContainer);

  // 评分
  const ratingContainer = document.createElement('div');
  ratingContainer.style.cssText = 'display: flex; gap: 8px; align-items: center;';
  const ratingInput = document.createElement('input');
  ratingInput.type = 'number';
  ratingInput.min = '0.1';
  ratingInput.max = '5';
  ratingInput.step = '0.1';
  ratingInput.placeholder = '评分（0.1~5）';
  ratingInput.style.cssText = `
    flex: 1; padding: 6px 8px; border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary); color: var(--text-normal);
    font-size: 0.9rem;
    width: 100%;
  `;
  if (item.status === STATUS_WATCHED && item.rating !== null && item.rating > 0) {
    ratingInput.value = item.rating;
  }
  ratingContainer.appendChild(ratingInput);
  editModal.appendChild(ratingContainer);

  // 观影日期 —— 强制显示今天
  const dateContainer = document.createElement('div');
  dateContainer.style.cssText = 'display: flex; gap: 8px; align-items: center;';
  const dateInput = document.createElement('input');
  dateInput.type = 'datetime-local';
  dateInput.step = '1';
  dateInput.placeholder = '观影日期';
  dateInput.style.cssText = `
    flex: 1; padding: 6px 8px; border-radius: 6px;
    text-indent: 8px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary); color: var(--text-normal);
    font-size: 0.9rem;
  `;
  dateInput.value = localNowFormat();
  dateContainer.appendChild(dateInput);
  editModal.appendChild(dateContainer);

  // 影评
  const reviewContainer = document.createElement('div');
  reviewContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
  const reviewTextarea = document.createElement('textarea');
  reviewTextarea.rows = 3;
  reviewTextarea.placeholder = '影评（可选）';
  reviewTextarea.style.cssText = `
    width: 100%; padding: 6px 8px; border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary); color: var(--text-normal);
    font-size: 0.9rem;
    resize: vertical;
  `;
  if (item.review) {
    reviewTextarea.value = item.review;
  }
  reviewContainer.appendChild(reviewTextarea);
  editModal.appendChild(reviewContainer);

  function updateInputVisibility() {
    const showRatingReview = selectedStatus === STATUS_WATCHED;
    ratingContainer.style.display = showRatingReview ? 'flex' : 'none';
    reviewContainer.style.display = showRatingReview ? 'flex' : 'none';
  }

  // 按钮
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.style.cssText = `
    box-shadow: none;
    padding: 6px 16px; border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    color: var(--text-normal); cursor: pointer;
  `;
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '确定';
  confirmBtn.style.cssText = `
    box-shadow: none;
    padding: 6px 16px; border-radius: 6px;
    background: var(--interactive-accent); color: var(--text-on-accent, white);
    border: none; cursor: pointer; font-weight: 500;
  `;

  cancelBtn.addEventListener('click', closeEditModal);
  confirmBtn.addEventListener('click', async () => {
    if (selectedStatus === STATUS_WATCHED) {
      const ratingVal = parseFloat(ratingInput.value);
      if (isNaN(ratingVal) || ratingVal <= 0) {
        notice('已看状态请填写大于 0 的评分');
        return;
      }
    }

    let ratingValue: number;
    if (selectedStatus === STATUS_WATCHING) ratingValue = 0;
    else if (selectedStatus === STATUS_WATCHED) {
      ratingValue = parseFloat(ratingInput.value);
    } else {
      ratingValue = item.rating ?? -1;
    }

    const now = new Date();
    const watchDate = (dateInput.value || localNowFormat()).replace('T', ' ');
    const reviewText = reviewTextarea.value.trim();

    await app.fileManager.processFrontMatter(item.file, (fm: Record<string, any>) => {
      fm['评分'] = ratingValue;
      fm['观影日期'] = watchDate;
      if (reviewText) {
        fm['影评'] = reviewText;
      } else {
        delete fm['影评'];
      }
    });

    notice('已更新影视信息', 'success');
    closeEditModal();
    refreshDataAndView(app);
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  editModal.appendChild(btnRow);

  updateInputVisibility();

  editOverlayDiv.appendChild(editModal);
  document.body.appendChild(editOverlayDiv);
  M.editOverlay = editOverlayDiv;
  editOverlayDiv.addEventListener('click', (e) => {
    if (e.target === editOverlayDiv) closeEditModal();
  });
}

// ---------- 筛选/排序弹窗（源码 L1048-1216 逐字；ADR-0009：挂 🔀，非设置） ----------

/** 筛选/排序弹窗内容渲染（openFilterModal 拆分）：类型/状态/排序三组按钮，实时生效 */
function renderFilterSettings(content: HTMLElement): void {

  content.innerHTML = '';

  // 筛选：类型（['全部', ...ALL_TAGS] 单标签按钮，实时生效）
  const filterSection = document.createElement('div');
  filterSection.style.cssText = 'margin-bottom: 20px;';
  const typeGroup = document.createElement('div');
  typeGroup.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;';
  const typeFilters = ['全部', ...ALL_TAGS];
  typeFilters.forEach((opt) => {
    const btn = document.createElement('button');
    btn.textContent = opt;
    btn.style.cssText = `
      padding: 6px 14px; border-radius: 20px; box-shadow: none;
      background: var(--background-secondary); color: var(--text-normal);
      cursor: pointer; font-size: 0.85rem;
      border: 1px solid var(--background-modifier-border);
    `;
    let color: string | null = null;
    if (opt !== '全部') {
      const group = getGroupForTag(opt);
      if (group) color = getTypeColor(group);
    }
    if (M.typeFilter === opt) {
      if (color) {
        btn.style.background = color;
        btn.style.color = 'white';
        btn.style.borderColor = color;
      } else {
        btn.style.background = 'var(--interactive-accent)';
        btn.style.color = 'var(--text-on-accent, white)';
        btn.style.borderColor = 'var(--interactive-accent)';
      }
    }
    btn.addEventListener('click', () => {
      M.typeFilter = opt;
      M.loadedCount = 0;
      renderList();
      renderFilterSettings(content);
    });
    typeGroup.appendChild(btn);
  });
  filterSection.appendChild(typeGroup);

  // 筛选：状态
  const statusGroup = document.createElement('div');
  statusGroup.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
  const statusFilters = ['全部', '想看', '在看', '已看'];
  statusFilters.forEach((opt) => {
    const btn = document.createElement('button');
    btn.textContent = opt;
    btn.style.cssText = `
      padding: 6px 14px; border-radius: 20px; box-shadow: none;
      background: var(--background-secondary); color: var(--text-normal);
      cursor: pointer; font-size: 0.85rem;
      border: 1px solid var(--background-modifier-border);
    `;
    if (M.statusFilter === opt) {
      btn.style.background = 'var(--interactive-accent)';
      btn.style.color = 'var(--text-on-accent, white)';
      btn.style.borderColor = 'var(--interactive-accent)';
    }
    btn.addEventListener('click', () => {
      M.statusFilter = opt;
      M.loadedCount = 0;
      renderList();
      renderFilterSettings(content);
    });
    statusGroup.appendChild(btn);
  });
  filterSection.appendChild(statusGroup);
  content.appendChild(filterSection);

  // 排序
  const sortSection = document.createElement('div');
  sortSection.style.cssText = 'margin-bottom: 8px;';
  const sortGroup = document.createElement('div');
  sortGroup.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
  const sortOptions = [
    { label: '日期↓', key: 'date', order: 'desc' },
    { label: '日期↑', key: 'date', order: 'asc' },
    { label: '评分↓', key: 'rating', order: 'desc' },
    { label: '评分↑', key: 'rating', order: 'asc' },
    { label: '名称A-Z', key: 'name', order: 'asc' },
    { label: '名称Z-A', key: 'name', order: 'desc' },
  ];
  sortOptions.forEach((opt) => {
    const btn = document.createElement('button');
    btn.textContent = opt.label;
    btn.style.cssText = `
      padding: 6px 12px; border-radius: 16px; box-shadow: none;
      background: var(--background-secondary); color: var(--text-normal);
      cursor: pointer; font-size: 0.85rem;
      border: 1px solid var(--background-modifier-border);
    `;
    if (M.sortState.key === opt.key && M.sortState.order === opt.order) {
      btn.style.background = 'var(--interactive-accent)';
      btn.style.color = 'var(--text-on-accent, white)';
      btn.style.borderColor = 'var(--interactive-accent)';
    }
    btn.addEventListener('click', () => {
      M.sortState.key = opt.key;
      M.sortState.order = opt.order as 'asc' | 'desc';
      M.loadedCount = 0;
      renderList();
      renderFilterSettings(content);
    });
    sortGroup.appendChild(btn);
  });
  sortSection.appendChild(sortGroup);
  content.appendChild(sortSection);
}

export function closeFilterModal(): void {
  if (M.settingsOverlay) {
    M.settingsOverlay.remove();
    M.settingsOverlay = null;
  }
}

export function openFilterModal(): void {
  if (M.settingsOverlay) {
    closeFilterModal();
    return;
  }

  const settingsOverlayDiv = document.createElement('div');
  settingsOverlayDiv.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.3); z-index: 1100;
    display: flex; align-items: center; justify-content: center;
  `;
  const settingsModal = document.createElement('div');
  settingsModal.style.cssText = `
    background: var(--background-primary); color: var(--text-normal);
    border-radius: 12px; width: 90%; max-width: 500px;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    border: 1px solid var(--background-modifier-border);
  `;

  const settingsHeader = document.createElement('div');
  settingsHeader.style.cssText = `
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 16px; border-bottom: 1px solid var(--background-modifier-border);
  `;
  settingsHeader.innerHTML = '<h3 style="margin:0;">筛选与排序</h3>';
  const closeSettingsBtn = document.createElement('button');
  closeSettingsBtn.textContent = '✕';
  closeSettingsBtn.className = 'bz-win-close';
  closeSettingsBtn.style.cssText = `
    background: none; border: none; font-size: 1.3rem; cursor: pointer; color: var(--text-muted);
  `;
  closeSettingsBtn.addEventListener('click', closeFilterModal);
  settingsHeader.appendChild(closeSettingsBtn);

  const settingsContent = document.createElement('div');
  settingsContent.style.cssText = 'padding: 16px; max-height: 70vh; overflow-y: auto;';

  renderFilterSettings(settingsContent);
  settingsModal.appendChild(settingsHeader);
  settingsModal.appendChild(settingsContent);
  settingsOverlayDiv.appendChild(settingsModal);
  document.body.appendChild(settingsOverlayDiv);

  M.settingsOverlay = settingsOverlayDiv;
  settingsOverlayDiv.addEventListener('click', (e) => {
    if (e.target === settingsOverlayDiv) closeFilterModal();
  });
}

// ---------- 主 overlay（源码 L1219-1402 逐字） ----------

export function createOverlay(app: App, statusType?: string): void {
  registerEscapeHandler(); // 确保监听已注册
  // 主页点击"在看/想看"传入初始筛选；无参数时恢复默认"全部"
  if (statusType) M.statusFilter = statusType;
  else {
    // 主页.js（dataviewjs）写 window.__homeFilmStatus 遗留全局 → 消费并清除（兼容遗留通道）
    const home = takeHomeFilmStatus() || (window as any).__homeFilmStatus || null;
    if (home) {
      M.statusFilter = home;
      (window as any).__homeFilmStatus = null;
    } else {
      M.statusFilter = '全部';
    }
  }
  M.loadedCount = 0;
  // 移动端默认全屏：复用打开（已存在 → visibility visible）也重挂，设置变更后重开生效
  applyMobileWindowFullscreen(M.currentOverlay?.firstElementChild as HTMLElement | null, tryGetSettings().movieMobileDefaultFullscreen === true);
  if (M.currentOverlay) {
    M.currentOverlay.style.visibility = 'visible';
    renderList();
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = '__yin_ying__';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); z-index: 1000;
    display: flex; align-items: center; justify-content: center;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: var(--background-primary); color: var(--text-normal);
    border-radius: 12px; width: 100%; max-width: 600px; height: 90vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
  `;
  applyMobileWindowFullscreen(modal, tryGetSettings().movieMobileDefaultFullscreen === true);

  const header = document.createElement('div');
  header.className = 'bz-win-head';
  header.style.cssText = `
    display: flex; justify-content: space-between; align-items: center;
    padding: 0 26px;
  `;
  header.innerHTML = '<p style="font-size:.8rem;">影视</p>';

  const headerButtons = document.createElement('div');
  headerButtons.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  /** 统一头部图标按钮：普通 14px/22×26，关闭 ❌ 13px/21×25，圆角 4 / hover 背景 */
  const mkBtn = (text: string, title: string, color: string, onClick: (e: MouseEvent) => void) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    if (title) btn.title = title;
    const isClose = text === '❌';
    btn.style.cssText = `
      background: none; border: none; font-size: ${isClose ? 13 : 14}px;
      cursor: pointer; color: ${color}; box-shadow: none;
      padding: 0; width: ${isClose ? 21 : 22}px; height: ${isClose ? 25 : 26}px; border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    `;
    if (isClose) btn.classList.add('bz-win-close');
    btn.addEventListener('mouseover', () => (btn.style.background = 'var(--background-secondary)'));
    btn.addEventListener('mouseout', () => (btn.style.background = 'none'));
    btn.addEventListener('click', onClick);
    headerButtons.appendChild(btn);
    return btn;
  };

  // 抽屉内已有「AI 荐片」动作，头部不再放 AI 推荐图标（用户决策）

  const analysisBtn = mkBtn('📊', '影视数据分析', 'var(--text-normal)', (e) => {
    e.stopPropagation();
    openAnalysisModal(app);
  });

  // 筛选/排序弹窗（ADR-0009：挂 🔀，⚙️ 只留给真设置）
  const filterBtn = mkBtn('🔀', '筛选与排序', 'var(--text-normal)', (e) => {
    e.stopPropagation();
    openFilterModal();
  });

  // 影视设置弹窗（ADR-0009 域设置弹窗；分组卡片重设计 + ticket 100 文案规范）
  const settingsBtn = mkBtn('⚙️', '影视设置', 'var(--text-normal)', (e) => {
    e.stopPropagation();
    openSettingsModal({
      title: '影视设置',
      maxWidth: 560,
      build: (el) => {
        const s = getSettings();
        // ===== 目录组 =====
        const dirGroup = createSettingsGroup(el, { icon: 'folder-open', name: '目录' });
        new Setting(dirGroup)
          .setName('影视文件夹')
          .setDesc('存放影视笔记的文件夹路径')
          .addText((text) =>
            text.setValue(s.movieFolderPath || '').onChange(async (v) => {
              s.movieFolderPath = v;
              await saveSettings();
            })
          );
        new Setting(dirGroup)
          .setName('每页加载数量')
          .setDesc('列表首次加载和滚动加载时显示的条数')
          .addText((text) =>
            text.setValue(s.moviePageSize || '').onChange(async (v) => {
              s.moviePageSize = v;
              await saveSettings();
            })
          );
        // ===== 默认视图组 =====
        const viewGroup = createSettingsGroup(el, { icon: 'monitor', name: '默认视图' });
        new Setting(viewGroup)
          .setName('默认排序')
          .setDesc('打开影视列表时默认的排序方式')
          .addDropdown((dd) =>
            dd
              .addOption('date-desc', '日期↓')
              .addOption('date-asc', '日期↑')
              .addOption('rating-desc', '评分↓')
              .addOption('rating-asc', '评分↑')
              .addOption('name-asc', '名称A-Z')
              .addOption('name-desc', '名称Z-A')
              .setValue(s.movieDefaultSort || 'date-desc')
              .onChange(async (v) => {
                s.movieDefaultSort = v;
                await saveSettings();
              })
          );
        new Setting(viewGroup)
          .setName('默认类型筛选')
          .setDesc('打开影视列表时默认选中的类型')
          .addDropdown((dd) => {
            dd.addOption('', '全部');
            for (const tag of ALL_TAGS) dd.addOption(tag, tag);
            dd.setValue(s.movieDefaultTypeFilter || '').onChange(async (v) => {
              s.movieDefaultTypeFilter = v;
              await saveSettings();
            });
          });
        new Setting(viewGroup)
          .setName('默认状态筛选')
          .setDesc('打开影视列表时默认选中的状态')
          .addDropdown((dd) =>
            dd
              .addOption('全部', '全部')
              .addOption('想看', '想看')
              .addOption('在看', '在看')
              .addOption('已看', '已看')
              .setValue(s.movieDefaultStatusFilter || '全部')
              .onChange(async (v) => {
                s.movieDefaultStatusFilter = v;
                await saveSettings();
              })
          );
        new Setting(viewGroup)
          .setName('已看卡片评分显示')
          .setDesc('已看条目评分以星星串或数字显示')
          .addDropdown((dd) =>
            dd
              .addOption('stars', '星星串')
              .addOption('number', '⭐数字')
              .setValue(s.movieRatingDisplay || 'stars')
              .onChange(async (v) => {
                s.movieRatingDisplay = v;
                await saveSettings();
              })
          );
        // 海报抓取指引（ADR-0007：外部工具承担；描述去包名细节，详见 README/ADR）
        new Setting(viewGroup)
          .setName('海报抓取')
          .setDesc('海报与豆瓣信息由独立的外部工具提供，需另行安装运行');
        // ===== 移动端组（仅移动端显示） =====
        if (isMobileEnv()) {
          const mobileGroup = createSettingsGroup(el, { icon: 'smartphone', name: '移动端' });
          new Setting(mobileGroup)
            .setName('移动端默认全屏')
            .setDesc('移动端打开主窗口时默认全屏，关闭则显示常规卡片')
            .addToggle((toggle) =>
              toggle.setValue(!!s.movieMobileDefaultFullscreen).onChange(async (v) => {
                s.movieMobileDefaultFullscreen = v;
                await saveSettings();
              })
            );
        }
      },
    });
  });

  const closeBtn = mkBtn('❌', '关闭', 'var(--text-muted)', () => closeOverlay());

  const addBtn = mkBtn('✏️', '添加影视', 'var(--text-normal)', (e) => {
    e.stopPropagation();
    openAddModal(app);
  });

  const searchBtn = mkBtn('🔍', '搜索影视', 'var(--text-muted)', (e) => {
    e.stopPropagation();
    toggleSearch();
  });


  headerButtons.appendChild(addBtn);
  headerButtons.appendChild(searchBtn);
  headerButtons.appendChild(analysisBtn);
  headerButtons.appendChild(filterBtn);
  headerButtons.appendChild(settingsBtn);
  headerButtons.appendChild(closeBtn);
  header.appendChild(headerButtons);

  const searchContainer = document.createElement('div');
  searchContainer.id = 'movie-search-container';
  searchContainer.style.cssText = 'display: none; padding: 0 24px 12px 24px;';

  const searchInput = document.createElement('input');
  searchInput.id = 'movie-search-input';
  searchInput.type = 'text';
  searchInput.placeholder = '🔍 搜索影视（名称、类型、影评）...';
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
    if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
    M.searchDebounceTimer = setTimeout(() => {
      M.searchKeyword = keyword;
      M.loadedCount = 0;
      renderList();
    }, 300);
  });
  searchContainer.appendChild(searchInput);

  const listContainer = document.createElement('div');
  listContainer.className = 'list-container';
  listContainer.style.cssText = 'flex: 1; overflow-y: auto; padding: 8px 16px;';

  modal.appendChild(header);
  modal.appendChild(searchContainer);
  modal.appendChild(listContainer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  M.currentOverlay = overlay;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay();
  });

  rebuildItems(app);
  M.loadedCount = 0;
  renderList();
  setupInfiniteScroll(listContainer);
}

// ---------- ESC（源码 L1403-1415 逐字） ----------

export function registerEscapeHandler(): void {
  escManager.register('movie', {
    isVisible: () => !!(M.editOverlay || M.addOverlay || M.settingsOverlay || M.currentOverlay || M.recommendOverlay),
    close: () => {
      if (M.editOverlay) closeEditModal();
      else if (M.addOverlay) closeAddModal();
      else if (M.recommendOverlay) {
        M.recommendOverlay.remove();
        M.recommendOverlay = null;
      } else if (M.settingsOverlay) closeFilterModal();
      else if (M.currentOverlay) closeOverlay();
    },
  });
}

// ===== 统一抽屉（手势统一组件；影视接入：打开/状态流转/写改影评/编辑/删除） =====

/** 抽屉顶部信息区：海报 + 名称 + 类型徽章 + 状态/评分 + 观影日期 + 影评两行省略（与卡片一字不差） */
function buildMovieSheetHead(item: MovieItem, app: App): HTMLElement {
  const head = document.createElement('div');
  head.className = 'bz-item-sheet-entry';
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;gap:12px;align-items:flex-start;';

  if (item.poster) {
    const posterFile = app.vault.getAbstractFileByPath(item.poster);
    if (posterFile && /\.(png|jpe?g|gif|webp)$/i.test(posterFile.name)) {
      const img = document.createElement('img');
      img.src = app.vault.getResourcePath(posterFile as TFile);
      img.style.cssText =
        'width:52px;height:70px;object-fit:cover;border-radius:6px;flex-shrink:0;background:var(--background-modifier-border);';
      body.appendChild(img);
    }
  }

  const info = document.createElement('div');
  info.style.cssText = 'flex:1;min-width:0;';

  const name = document.createElement('div');
  name.className = 'bz-item-sheet-movie-name';
  name.textContent = item.name;
  info.appendChild(name);

  const meta = document.createElement('div');
  meta.className = 'bz-item-sheet-movie-meta';
  const typeBadge = document.createElement('span');
  typeBadge.className = 'bz-movie-badge';
  typeBadge.textContent = item.typeTag;
  typeBadge.style.background = getTypeColor(item.group); // 动态类型色（功能色）
  meta.appendChild(typeBadge);
  if (item.status === STATUS_WATCHING) {
    const w = document.createElement('span');
    w.className = 'bz-movie-badge bz-movie-badge--accent';
    w.textContent = '在看';
    meta.appendChild(w);
  } else if (item.status === STATUS_WANT) {
    const w = document.createElement('span');
    w.className = 'bz-movie-badge';
    w.textContent = '想看';
    meta.appendChild(w);
  } else if (item.status === STATUS_WATCHED) {
    if (item.rating !== null && item.rating > 0) {
      const stars = document.createElement('span');
      stars.className = 'bz-movie-stars';
      stars.textContent = getStarRating(item.rating);
      meta.appendChild(stars);
    }
    if (item.watchDate) {
      const d = document.createElement('span');
      d.className = 'bz-movie-date';
      d.textContent = formatRelativeTime(item.watchDate);
      meta.appendChild(d);
    }
  }
  info.appendChild(meta);

  if (item.review) {
    const review = document.createElement('div');
    review.className = 'bz-item-sheet-movie-review';
    review.textContent = item.review;
    info.appendChild(review);
  }

  body.appendChild(info);
  head.appendChild(body);
  return head;
}

/** 打开影视笔记（与卡片双击同路径） */
function openMovieNote(item: MovieItem, app: App): void {
  void app.workspace.openLinkText(item.file.path as string, '', false);
  closeOverlay();
}

/** 写评分时的默认分值（标记已看直改默认分；与评分窗滑块初始值一致） */
const DEFAULT_RATING = 3.5;

/**
 * 快捷状态流转（想看 → 在看 / 在看 → 已看 / 想看 → 已看 直改标记，不弹窗）。
 * 状态由评分推断（无独立状态字段）：想看=-1 / 在看=0 / 已看=>0。
 * 标记在看 → 评分 0；标记已看 → 默认评分 3.5（抽屉保持，可随即「改分」）。
 * 标记在看与标记已看都写观影日期 = 当前日期（用户需求，2026-08-23）。
 */
async function setMovieStatus(item: MovieItem, status: number, app: App): Promise<void> {
  const ratingValue = status === STATUS_WATCHING ? 0 : status === STATUS_WATCHED ? DEFAULT_RATING : -1;
  const watchDate = localNowFormat().replace('T', ' ');
  await app.fileManager.processFrontMatter(item.file, (fm: Record<string, any>) => {
    fm['评分'] = ratingValue;
    fm['观影日期'] = watchDate;
  });
  // ticket 074（域事件派发）：状态流转观察（from = 改前状态，setMovieStatus 不就地更新 item.status）
  emitDomainEvent('movie', {
    kind: 'status',
    name: item.name,
    from: item.status === STATUS_WANT ? 'want' : item.status === STATUS_WATCHING ? 'watching' : 'watched',
    to: status === STATUS_WANT ? 'want' : status === STATUS_WATCHING ? 'watching' : 'watched',
  });
  item.watchDate = watchDate; // 本地同步：抽屉头部相对时间即时刷新
  notice(status === STATUS_WATCHED ? '已标记已看' : '已标记在看', 'success');
  refreshDataAndView(app);
}

/** 关闭小弹窗（幂等）：注销 ESC + 附属浮层注册 + 移除遮罩 */
function closeMovieTinyModal(mask: HTMLElement, modalEsc: { unregister: () => void }): void {
  modalEsc.unregister();
  unregisterSheetCompanion(mask);
  mask.remove();
}

/**
 * 评分窗（评分 / 改分 共用）：滑块拖动 + 实时数值；遮罩点击/ESC 关闭，无取消按钮。
 * 无日期输入：默认当年日期（已有观影日期则保留，改分不覆盖）。
 * 确认：评分、观影日期 写入 frontmatter（已看状态由评分 >0 表达，不写状态字段）。
 */
export function openRateModal(item: MovieItem, app: App, title: string, onDone?: () => void): void {
  const mask = document.createElement('div');
  mask.className = 'bz-movie-tiny-mask';
  const modal = document.createElement('div');
  modal.className = 'bz-movie-tiny-modal';

  const t = document.createElement('div');
  t.className = 'bz-movie-tiny-title';
  t.textContent = title;

  const hasRating = item.rating !== null && item.rating > 0;
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '1';
  slider.max = '6';
  slider.step = '0.1';
  slider.className = 'bz-movie-rating-slider';
  slider.value = String(hasRating ? item.rating : DEFAULT_RATING);

  const valueLabel = document.createElement('div');
  valueLabel.className = 'bz-movie-rating-value';
  const updateValue = () => {
    valueLabel.textContent = `⭐ ${Number(slider.value).toFixed(1)}`;
  };
  slider.addEventListener('input', updateValue);
  updateValue();

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'bz-movie-tiny-confirm';
  confirmBtn.textContent = '确认';

  const modalEsc = escManager.register('bz-movie-rate', {
    isVisible: () => mask.isConnected,
    close: () => closeMovieTinyModal(mask, modalEsc),
  });

  confirmBtn.addEventListener('click', async () => {
    const ratingVal = parseFloat(slider.value);
    // 无日期输入：新评分默认当年日期；已有观影日期保留（改分不覆盖旧日期）
    const watchDate = item.watchDate || localNowFormat().replace('T', ' ');
    await app.fileManager.processFrontMatter(item.file, (fm: Record<string, any>) => {
      fm['评分'] = ratingVal;
      fm['观影日期'] = watchDate;
    });
    // ticket 074（域事件派发）：评分/改分观察（from = 改前评分，改前无分 → 首次评分）
    emitDomainEvent('movie', { kind: 'rated', name: item.name, fromRating: item.rating, toRating: ratingVal });
    notice('已更新影视信息', 'success');
    item.rating = ratingVal;
    item.watchDate = watchDate;
    closeMovieTinyModal(mask, modalEsc);
    refreshDataAndView(app);
    onDone?.();
  });

  mask.addEventListener('click', (e) => {
    if (e.target === mask) closeMovieTinyModal(mask, modalEsc);
  });

  modal.appendChild(t);
  modal.appendChild(valueLabel);
  modal.appendChild(slider);
  modal.appendChild(confirmBtn);
  mask.appendChild(modal);
  registerSheetCompanion(mask); // 抽屉保持时叠于其上：点击遮罩/按钮不触发抽屉关闭
  document.body.appendChild(mask);
}

/** 影评窗（写影评 / 改影评共用）：多行文本；遮罩点击/ESC 关闭，无取消按钮。空文本 = 删除影评字段。 */
export function openReviewModal(item: MovieItem, app: App, title: string, onDone?: () => void): void {
  const mask = document.createElement('div');
  mask.className = 'bz-movie-tiny-mask';
  const modal = document.createElement('div');
  modal.className = 'bz-movie-tiny-modal';

  const t = document.createElement('div');
  t.className = 'bz-movie-tiny-title';
  t.textContent = title;

  const reviewArea = document.createElement('textarea');
  reviewArea.className = 'bz-movie-tiny-textarea';
  reviewArea.placeholder = '写点什么…';
  if (item.review) reviewArea.value = item.review;

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'bz-movie-tiny-confirm';
  confirmBtn.textContent = '确认';

  const modalEsc = escManager.register('bz-movie-review', {
    isVisible: () => mask.isConnected,
    close: () => closeMovieTinyModal(mask, modalEsc),
  });

  confirmBtn.addEventListener('click', async () => {
    const reviewText = reviewArea.value.trim();
    await app.fileManager.processFrontMatter(item.file, (fm: Record<string, any>) => {
      if (reviewText) fm['影评'] = reviewText;
      else delete fm['影评'];
    });
    // ticket 074（域事件派发）：影评 写/改/删 观察（from = 改前影评，text 空 = 删除）
    emitDomainEvent('movie', { kind: 'review', name: item.name, fromReview: item.review, toReview: reviewText || null });
    notice(reviewText ? '已保存影评' : '已删除影评', 'success');
    closeMovieTinyModal(mask, modalEsc);
    refreshDataAndView(app);
    if (reviewText) item.review = reviewText;
    else item.review = null;
    onDone?.();
  });

  mask.addEventListener('click', (e) => {
    if (e.target === mask) closeMovieTinyModal(mask, modalEsc);
  });

  modal.appendChild(t);
  modal.appendChild(reviewArea);
  modal.appendChild(confirmBtn);
  mask.appendChild(modal);
  registerSheetCompanion(mask); // 抽屉保持时叠于其上：点击遮罩/按钮不触发抽屉关闭
  document.body.appendChild(mask);
}

/** 删除影视笔记（二次确认，不可撤销） */
function confirmDeleteMovie(item: MovieItem, app: App): void {
  confirm({
    title: '删除影视',
    message: `确定删除《${item.name}》吗？\n\n此操作不可撤销，影视笔记将从笔记库永久删除。`,
    confirmText: '删除',
    onConfirm: async () => {
      await app.vault.delete(item.file);
      // ticket 074（域事件派发）：删除影视观察
      emitDomainEvent('movie', { kind: 'deleted', name: item.name });
      notice('影视已删除', 'success');
      refreshDataAndView(app);
    },
  });
}

// ===== 详情（豆瓣字段 + 个人记录 + 简介/海报/豆瓣链接） =====

/** 详情数据：豆瓣字段行 / 豆瓣链接 / 我的记录行 / 简介 / 海报资源地址 */
interface MovieDetailData {
  rows: [string, string][];
  doubanUrl: string | null;
  mine: [string, string][];
  synopsis: string | null;
  posterUrl: string | null;
}

/** 汇总条目详情（frontmatter 优先、条目解析兜底）；无任何内容返回 null */
function collectMovieDetail(item: MovieItem, app: App): MovieDetailData | null {
  const fm = app.metadataCache.getFileCache(item.file)?.frontmatter ?? {};
  const str = (v: unknown) => {
    if (v === undefined || v === null) return '';
    const s = String(v).trim();
    return s === 'undefined' ? '' : s;
  };
  // ISO 日期时间截取日期段（观影日期常带 T10:00:00 尾巴）
  const datePart = (v: string | null) => (v ? (v.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? v) : '');

  const rows: [string, string][] = (
    [
      ['类型', str(fm['类型'] ?? item.genre)],
      ['导演', str(item.director ?? fm['导演'])],
      ['主演', str(item.actors ?? fm['主演'])],
      ['制片国家/地区', str(item.region ?? fm['制片国家/地区'])],
      ['上映日期', str(fm['上映日期'])],
      ['片长', str(fm['片长'])],
      ['季集', str(fm['季集'])],
      ['豆瓣评分', fm['豆瓣评分'] !== undefined ? str(fm['豆瓣评分']) : ''],
    ] as [string, string][]
  ).filter(([, v]) => v !== '');

  // 我的记录：观影日期 / 我的评分（仅已看态）/ 影评
  const mine: [string, string][] = [];
  if (datePart(item.watchDate)) mine.push(['观影日期', datePart(item.watchDate)]);
  if (item.status === STATUS_WATCHED && item.rating !== null && item.rating > 0) mine.push(['我的评分', String(item.rating)]);
  if (item.review) mine.push(['影评', item.review]);

  const douban = str(fm['豆瓣链接']);
  const synopsis = str(fm['简介']);
  let posterUrl: string | null = null;
  if (item.poster) {
    const posterFile = app.vault.getAbstractFileByPath(item.poster);
    if (posterFile && /\.(png|jpe?g|gif|webp)$/i.test(posterFile.name)) {
      posterUrl = app.vault.getResourcePath(posterFile as TFile);
    }
  }

  if (!rows.length && !mine.length && !douban && !synopsis && !posterUrl) return null;
  return { rows, doubanUrl: /^https?:\/\//.test(douban) ? douban : null, mine, synopsis: synopsis || null, posterUrl };
}

/** 是否有值得弹窗的详情内容（海报不算——卡片已展示，仅随窗口附带） */
function hasDetailContent(d: MovieDetailData): boolean {
  return d.rows.length > 0 || d.mine.length > 0 || !!d.doubanUrl || !!d.synopsis;
}

/** 详情窗：海报横幅 + 豆瓣字段 + 豆瓣链接 + 我的记录 + 简介；遮罩点击/ESC 关闭，无取消按钮 */
function openDetailModal(item: MovieItem, app: App): void {
  const d = collectMovieDetail(item, app);
  if (!d) return;

  const mask = document.createElement('div');
  mask.className = 'bz-movie-tiny-mask';
  const modal = document.createElement('div');
  modal.className = 'bz-movie-tiny-modal bz-movie-detail-modal';

  const t = document.createElement('div');
  t.className = 'bz-movie-tiny-title';
  t.textContent = `《${item.name}》`;
  modal.appendChild(t);

  if (d.posterUrl) {
    const img = document.createElement('img');
    img.className = 'bz-movie-detail-poster';
    img.src = d.posterUrl;
    img.alt = '';
    modal.appendChild(img);
  }

  const body = document.createElement('div');
  /** label 左 / 值右字段行 */
  const addRow = (label: string, value: HTMLElement): void => {
    const row = document.createElement('div');
    row.className = 'bz-movie-detail-row';
    const l = document.createElement('span');
    l.className = 'bz-movie-detail-label';
    l.textContent = label;
    value.classList.add('bz-movie-detail-value');
    row.appendChild(l);
    row.appendChild(value);
    body.appendChild(row);
  };
  const textRow = (label: string, text: string): void => {
    const v = document.createElement('span');
    v.textContent = text;
    addRow(label, v);
  };
  /** 分区小标题（我的记录 / 简介） */
  const addSection = (title: string): void => {
    const sec = document.createElement('div');
    sec.className = 'bz-movie-detail-section';
    sec.textContent = title;
    body.appendChild(sec);
  };

  for (const [k, v] of d.rows) textRow(k, v);

  if (d.doubanUrl) {
    const a = document.createElement('a');
    a.className = 'bz-movie-detail-link';
    a.href = d.doubanUrl;
    a.textContent = d.doubanUrl;
    a.target = '_blank';
    a.rel = 'noopener';
    addRow('豆瓣链接', a);
  }

  if (d.mine.length) {
    addSection('我的记录');
    for (const [k, v] of d.mine) textRow(k, v);
  }

  if (d.synopsis) {
    addSection('简介');
    const p = document.createElement('p');
    p.className = 'bz-movie-detail-synopsis';
    p.textContent = d.synopsis;
    body.appendChild(p);
  }

  modal.appendChild(body);

  const modalEsc = escManager.register('bz-movie-detail', {
    isVisible: () => mask.isConnected,
    close: () => closeMovieTinyModal(mask, modalEsc),
  });
  mask.addEventListener('click', (e) => {
    if (e.target === mask) closeMovieTinyModal(mask, modalEsc);
  });
  mask.appendChild(modal);
  registerSheetCompanion(mask); // 抽屉保持时叠于其上：点击遮罩/按钮不触发抽屉关闭
  document.body.appendChild(mask);
}

// ===== 复制双链 =====

async function copyMovieLink(item: MovieItem): Promise<void> {
  const link = `[[《${item.name}》]]`;
  await navigator.clipboard.writeText(link);
  notice(`已复制双链：${link}`, 'success');
}


/**
 * 挂统一操作（桌面右键 + 移动端抽屉）：
 * 打开 > 状态流转 >（已看）评分/影评 > 删除。
 * 动作随状态动态：想看=标记在看 + 标记已看（并列，可跳过在看直跳已看）；在看=标记已看
 * （直改标记，抽屉保持并刷新为已看动作）；已看=评分/改分（滑块窗）+ 写/改影评（影评窗），
 * 评分与影评按有无内容切换文案。标记在看/已看均把观影日期更新为当前日期。
 */
function attachMovieActions(card: HTMLElement, item: MovieItem, app: App): void {
  // 状态/评分/影评变化后：动作列表 + 头部信息一并刷新（抽屉保持）
  const rebuild = () => refreshItemSheet(buildActions(), buildMovieSheetHead(item, app));
  const buildActions = (): ItemAction[] => {
    const acts: ItemAction[] = [];
    acts.push({ icon: 'external-link', label: '打开', title: '打开影视笔记', onClick: () => openMovieNote(item, app) });
    // 状态流转/评分/影评靠前（紧跟打开）：
    if (item.status === STATUS_WANT) {
      acts.push({
        icon: 'eye',
        label: '标记在看',
        title: '标记在看',
        keepOpen: true,
        onClick: () =>
          void setMovieStatus(item, STATUS_WATCHING, app).then(() => {
            item.status = STATUS_WATCHING;
            item.rating = 0;
            rebuild();
          }),
      });
      // 想看 → 已看 直跳（放「标记在看」下面，用户需求 2026-08-23）
      acts.push({
        icon: 'check-circle',
        label: '标记已看',
        title: '标记已看',
        keepOpen: true,
        onClick: () =>
          void setMovieStatus(item, STATUS_WATCHED, app).then(() => {
            item.status = STATUS_WATCHED;
            item.rating = DEFAULT_RATING; // 与落盘一致：已看 = 有评分，抽屉刷新显示「改分」
            rebuild();
          }),
      });
    } else if (item.status === STATUS_WATCHING) {
      acts.push({
        icon: 'check-circle',
        label: '标记已看',
        title: '标记已看',
        keepOpen: true,
        onClick: () =>
          void setMovieStatus(item, STATUS_WATCHED, app).then(() => {
            item.status = STATUS_WATCHED;
            item.rating = DEFAULT_RATING; // 与落盘一致：已看 = 有评分，抽屉刷新显示「改分」
            rebuild();
          }),
      });
    } else {
      // 已看态：评分/影评按有无内容切换文案（评分 → 改分；写影评 → 改影评）；改分小字 = 当前分数
      const hasRating = item.rating !== null && item.rating > 0;
      acts.push({
        icon: 'star',
        label: hasRating ? '改分' : '评分',
        title: hasRating ? '改分' : '评分',
        sub: hasRating ? Number(item.rating).toFixed(1) : undefined,
        keepOpen: true,
        onClick: () => openRateModal(item, app, hasRating ? '改分' : '评分', rebuild),
      });
      acts.push({
        icon: 'message-square',
        label: item.review ? '改影评' : '写影评',
        title: item.review ? '改影评' : '写影评',
        keepOpen: true,
        onClick: () => openReviewModal(item, app, item.review ? '改影评' : '写影评', rebuild),
      });
    }
    // 详情：有豆瓣字段/简介/个人记录任一才显示（海报随窗口展示，不计入触发）
    const details = collectMovieDetail(item, app);
    if (details && hasDetailContent(details)) {
      acts.push({
        icon: 'info',
        label: '详情',
        title: '详情',
        keepOpen: true,
        onClick: () => openDetailModal(item, app),
      });
    }
    acts.push({
      icon: 'link',
      label: '复制双链',
      title: '复制双链',
      keepOpen: true,
      onClick: () => void copyMovieLink(item),
    });
    acts.push({
      icon: 'sparkles',
      label: '找同类',
      title: '找同类（AI 分析）',
      onClick: () => void runSimilarRecommend(item, app),
    });
    acts.push({
      icon: 'bot',
      label: 'AI 荐片',
      title: 'AI 荐片（口味推荐）',
      onClick: () => void runAIRecommend(app),
    });
    acts.push({
      icon: 'trash-2',
      label: '删除',
      title: '删除',
      kind: 'danger',
      onClick: () => confirmDeleteMovie(item, app),
    });
    return acts;
  };

  attachItemActions(card, buildActions(), { sheetHead: buildMovieSheetHead(item, app) });
}
