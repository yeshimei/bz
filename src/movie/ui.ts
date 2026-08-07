/**
 * 影视 UI（ticket 14 修正版：对齐源码逐字——卡片/overlay/添加/编辑/设置弹窗）
 */
import type { App, TFile } from 'obsidian';
import { Notice } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { checkAndShowChangelog } from '../core/changelog';
import { formatRelativeTime } from '../core/utils';
import { STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED, getTypeColor, getStarRating, TYPE_GROUPS, ALL_TAGS, getGroupForTag } from './constants';
import { M, takeHomeFilmStatus } from './state';
import { getDisplayItems, refreshDataAndView, rebuildItems } from './data';
import { openRecommendModal } from './recommend';

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
    card.addEventListener('dblclick', () => {
      app.workspace.openLinkText(item.file.path as string, '', false);
      closeOverlay();
    });

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

    const isClickable = item.status === STATUS_WANT || item.status === STATUS_WATCHING;
    const statusContainer = document.createElement('span');
    statusContainer.style.cssText = 'display: inline-flex; align-items: center; gap: 4px;';
    if (isClickable) {
      statusContainer.style.cursor = 'pointer';
      statusContainer.title = '点击编辑';
    }

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
        stars.textContent = getStarRating(item.rating);
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

    if (isClickable) {
      statusContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(item, app);
      });
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
  checkAndShowChangelog('movie');
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

  // 类型选择（13 个标签按钮组）
  const typeContainer = document.createElement('div');
  typeContainer.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
  let selectedTag = (prefill && prefill.tag) || '电影';
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
      updateInputVisibility();
    });
    tagButtons.push(btn);
    typeContainer.appendChild(btn);
  });

  // 状态单选（按钮组）
  const statusContainer = document.createElement('div');
  statusContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
  const statusButtonGroup = document.createElement('div');
  statusButtonGroup.style.cssText = 'display: flex; gap: 12px;';
  let selectedStatus = prefill && prefill.status !== undefined ? prefill.status : STATUS_WATCHED;
  const statusOptions = [
    { value: STATUS_WANT, label: '想看' },
    { value: STATUS_WATCHING, label: '在看' },
    { value: STATUS_WATCHED, label: '已看' },
  ];
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

  // 季集
  const seasonContainer = document.createElement('div');
  seasonContainer.style.cssText = 'display: flex; gap: 8px; align-items: center;';
  const seasonInput = document.createElement('input');
  seasonInput.type = 'text';
  seasonInput.placeholder = '季集（可选）';
  seasonInput.style.cssText = `
    flex: 1; padding: 6px 8px; border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary); color: var(--text-normal);
    font-size: 0.9rem;
  `;
  seasonContainer.appendChild(seasonInput);

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
  ratingContainer.appendChild(ratingInput);

  // 观影日期
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
  reviewContainer.appendChild(reviewTextarea);

  function updateInputVisibility() {
    const showRatingReview = selectedStatus === STATUS_WATCHED;
    ratingContainer.style.display = showRatingReview ? 'flex' : 'none';
    reviewContainer.style.display = showRatingReview ? 'flex' : 'none';
    const group = getGroupForTag(selectedTag);
    seasonContainer.style.display = group !== '电影' ? 'flex' : 'none';
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
      new Notice('请输入名称');
      return;
    }
    if (!selectedTag) {
      new Notice('请选择类型');
      return;
    }

    const targetFolder = M.folderPath;
    let folderObj = app.vault.getAbstractFileByPath(targetFolder);
    if (!folderObj) await app.vault.createFolder(targetFolder);

    const fileName = `《${name}》.md`;
    const filePath = `${targetFolder}/${fileName}`;
    const existingFile = app.vault.getAbstractFileByPath(filePath);
    if (existingFile) {
      new Notice(`影视“${name}”已存在，正在打开`);
      closeAddModal();
      closeOverlay();
      await app.workspace.getLeaf().openFile(existingFile as TFile);
      return;
    }

    let ratingValue: number;
    if (selectedStatus === STATUS_WANT) ratingValue = -1;
    else if (selectedStatus === STATUS_WATCHING) ratingValue = 0;
    else if (selectedStatus === STATUS_WATCHED) {
      const inputRating = parseFloat(ratingInput.value);
      if (isNaN(inputRating) || inputRating <= 0) {
        new Notice('已看状态请填写大于0的评分');
        return;
      }
      ratingValue = inputRating;
    } else {
      ratingValue = -1;
    }

    const now = new Date();
    const watchDateValue = (dateInput.value || localNowFormat()).replace('T', ' ');
    const seasonEpisode = seasonInput.value.trim();
    const reviewText = reviewTextarea.value.trim();

    let fileContent = `---\ntags:\n- ${selectedTag}\n观影日期: ${watchDateValue}\n评分: ${ratingValue}\n`;
    if (seasonEpisode) fileContent += `季集: ${seasonEpisode}\n`;
    if (reviewText) fileContent += `影评: ${reviewText}\n`;
    fileContent += `海报: \n---\n`;

    try {
      const newFile = await app.vault.create(filePath, fileContent);
      closeAddModal();
      closeOverlay();
      refreshDataAndView(app);
      await app.workspace.getLeaf().openFile(newFile);
    } catch (e) {
      new Notice('创建笔记失败');
      console.error(e);
    }
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);

  addModal.appendChild(titleEl);
  addModal.appendChild(nameInput);
  addModal.appendChild(typeContainer);
  addModal.appendChild(statusContainer);
  addModal.appendChild(seasonContainer);
  addModal.appendChild(ratingContainer);
  addModal.appendChild(dateContainer);
  addModal.appendChild(reviewContainer);
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
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ---------- 编辑弹窗（源码 L800-1046 逐字） ----------

export function closeEditModal(): void {
  if (M.editOverlay) {
    M.editOverlay.remove();
    M.editOverlay = null;
  }
}

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

  // 季集
  const seasonContainer = document.createElement('div');
  seasonContainer.style.cssText = 'display: flex; gap: 8px; align-items: center;';
  const seasonInput = document.createElement('input');
  seasonInput.type = 'text';
  seasonInput.placeholder = '季集（可选）';
  seasonInput.style.cssText = `
    flex: 1; padding: 6px 8px; border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary); color: var(--text-normal);
    font-size: 0.9rem;
  `;
  const fm = app.metadataCache.getFileCache(item.file)?.frontmatter;
  if (fm && fm['季集']) {
    seasonInput.value = fm['季集'].toString();
  }
  seasonContainer.appendChild(seasonInput);
  editModal.appendChild(seasonContainer);

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
    const group = getGroupForTag(item.typeTag);
    seasonContainer.style.display = group !== '电影' ? 'flex' : 'none';
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
        new Notice('已看状态请填写大于0的评分');
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
    const seasonEpisode = seasonInput.value.trim();
    const reviewText = reviewTextarea.value.trim();

    await app.fileManager.processFrontMatter(item.file, (fm: Record<string, any>) => {
      fm['评分'] = ratingValue;
      fm['观影日期'] = watchDate;
      if (seasonEpisode) {
        fm['季集'] = seasonEpisode;
      } else {
        delete fm['季集'];
      }
      if (reviewText) {
        fm['影评'] = reviewText;
      } else {
        delete fm['影评'];
      }
    });

    new Notice('已更新影视信息');
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

// ---------- 设置/筛选弹窗（源码 L1048-1216 逐字） ----------

export function closeSettings(): void {
  if (M.settingsOverlay) {
    M.settingsOverlay.remove();
    M.settingsOverlay = null;
  }
}

export function openSettingsModal(): void {
  if (M.settingsOverlay) {
    closeSettings();
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
  closeSettingsBtn.style.cssText = `
    background: none; border: none; font-size: 1.3rem; cursor: pointer; color: var(--text-muted);
  `;
  closeSettingsBtn.addEventListener('click', closeSettings);
  settingsHeader.appendChild(closeSettingsBtn);

  const settingsContent = document.createElement('div');
  settingsContent.style.cssText = 'padding: 16px; max-height: 70vh; overflow-y: auto;';

  function refreshSettingsUI() {
    settingsContent.innerHTML = '';

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
        refreshSettingsUI();
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
        refreshSettingsUI();
      });
      statusGroup.appendChild(btn);
    });
    filterSection.appendChild(statusGroup);
    settingsContent.appendChild(filterSection);

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
        refreshSettingsUI();
      });
      sortGroup.appendChild(btn);
    });
    sortSection.appendChild(sortGroup);
    settingsContent.appendChild(sortSection);
  }

  refreshSettingsUI();
  settingsModal.appendChild(settingsHeader);
  settingsModal.appendChild(settingsContent);
  settingsOverlayDiv.appendChild(settingsModal);
  document.body.appendChild(settingsOverlayDiv);

  M.settingsOverlay = settingsOverlayDiv;
  settingsOverlayDiv.addEventListener('click', (e) => {
    if (e.target === settingsOverlayDiv) closeSettings();
  });
}

// ---------- 主 overlay（源码 L1219-1402 逐字） ----------

export function createOverlay(app: App, statusType?: string): void {
  registerEscapeHandler(); // 确保监听已注册
  // 主页点击"在看/想看"传入初始筛选；无参数时恢复默认"全部"
  if (statusType) M.statusFilter = statusType;
  else {
    const home = takeHomeFilmStatus();
    M.statusFilter = home || '全部';
  }
  M.loadedCount = 0;
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
  if (window.innerWidth <= 768) {
    modal.style.height = '100vh';
    modal.style.borderRadius = '0';
    modal.style.maxWidth = '100%';
    modal.style.paddingTop = '24px';
  }

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex; justify-content: space-between; align-items: center;
    padding: 0 26px;
  `;
  header.innerHTML = '<p style="font-size:.8rem;">影视</p>';

  const headerButtons = document.createElement('div');
  headerButtons.style.cssText = 'display: flex; align-items: center;';

  const mkBtn = (text: string, title: string, css: string, onClick: (e: MouseEvent) => void) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    if (title) btn.title = title;
    btn.style.cssText = css;
    btn.addEventListener('click', onClick);
    headerButtons.appendChild(btn);
    return btn;
  };

  const analysisBtn = mkBtn('📊', '观影数据分析', `
    background: none; border: none; font-size: .7rem;
    cursor: pointer; color: var(--text-normal); box-shadow: none;
    padding: 0; margin-left: 15px;
  `, (e) => {
    e.stopPropagation();
    const commands = (app as any).commands;
    if (commands && commands.commands && commands.commands['movie-analysis-open']) {
      commands.executeCommandById('movie-analysis-open');
    } else {
      new Notice('请先在命令面板运行一次「影视：观影数据分析」');
    }
  });

  const recommendBtn = mkBtn('🤖', 'AI 推荐', `
    background: none; border: none; font-size: .7rem;
    cursor: pointer; color: var(--text-normal); box-shadow: none;
    padding: 0; margin-left: 15px;
  `, (e) => {
    e.stopPropagation();
    openRecommendModal(app);
  });

  const settingsBtn = mkBtn('⚙️', '', `
    background: none; border: none; border-radius: 6px; font-size: 0.7rem;
    cursor: pointer; color: var(--text-normal); box-shadow: none;
    padding: 0; margin-left: 15px;
  `, (e) => {
    e.stopPropagation();
    openSettingsModal();
  });

  const closeBtn = mkBtn('❌', '', `
    background: none; border: none; font-size: 0.55rem;
    cursor: pointer; color: var(--text-muted); box-shadow: none;
    padding: 0; margin-left: 15px;
  `, () => closeOverlay());

  const addBtn = mkBtn('✏️', '', `
    background: none; border: none; font-size: .65rem;
    cursor: pointer; color: var(--text-normal); box-shadow: none;
    padding: 0; margin-left: 15px;
  `, (e) => {
    e.stopPropagation();
    openAddModal(app);
  });

  const searchBtn = mkBtn('🔍', '搜索影视', `
    background: none; border: none; font-size: 15px;
    cursor: pointer; color: var(--text-muted); box-shadow: none;
    padding: 0; width: 20px; height: 20px; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s; margin-left: 15px; margin-top: 4px;
  `, (e) => {
    e.stopPropagation();
    toggleSearch();
  });
  searchBtn.addEventListener('mouseover', () => {
    searchBtn.style.background = 'var(--background-secondary)';
  });
  searchBtn.addEventListener('mouseout', () => {
    searchBtn.style.background = 'none';
  });

  headerButtons.appendChild(addBtn);
  headerButtons.appendChild(searchBtn);
  headerButtons.appendChild(analysisBtn);
  headerButtons.appendChild(recommendBtn);
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
      } else if (M.settingsOverlay) closeSettings();
      else if (M.currentOverlay) closeOverlay();
    },
  });
}
