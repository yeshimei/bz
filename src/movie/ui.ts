/**
 * 影视 UI（ticket 14：renderAll/renderList/无限滚动/搜索/overlay/添加/编辑/设置/ESC）
 */
import type { App } from 'obsidian';
import { Notice, TFile } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { checkAndShowChangelog } from '../core/changelog';
import { formatRelativeTime } from '../core/utils';
import { STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED, getTypeColor, getStarRating, TYPE_GROUPS, ALL_TAGS, getGroupForTag } from './constants';
import { getDisplayItems, refreshDataAndView, rebuildItems } from './data';
import { openRecommendModal } from './recommend';
import { M, takeHomeFilmStatus } from './state';

/** 渲染卡片列表（分页） */
export function renderAll(displayItems: any[], container: HTMLElement, app: App): void {
  container.innerHTML = '';
  const total = displayItems.length;

  if (total === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">暂无符合条件的影视记录</p>';
    return;
  }

  if (M.loadedCount === 0) {
    M.loadedCount = Math.min(M.pageSize, total);
  }
  const showCount = Math.min(M.loadedCount, total);
  const slice = displayItems.slice(0, showCount);

  slice.forEach((item) => {
    container.appendChild(createMovieCard(item, app));
  });

  if (showCount < total) {
    const indicator = document.createElement('div');
    indicator.id = 'load-more-indicator';
    indicator.style.cssText = 'text-align:center; padding: 8px; color: var(--text-muted); font-size:0.8rem;';
    indicator.textContent = '滚动加载更多...';
    container.appendChild(indicator);
  }
}

/** 创建影视卡片 */
export function createMovieCard(item: any, app: App): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText = `
    background: var(--background-secondary);
    border-radius: 8px; padding: 12px 16px; margin-bottom: 10px;
    cursor: default;
  `;

  // 双击打开笔记
  card.addEventListener('dblclick', () => {
    app.workspace.openLinkText(item.file.path, '', false);
    closeOverlay();
  });

  // 海报
  const posterContainer = document.createElement('div');
  posterContainer.style.cssText = 'display:flex; align-items:flex-start; gap:12px;';

  if (item.poster) {
    const posterFile = app.vault.getAbstractFileByPath(item.poster);
    if (posterFile && posterFile instanceof TFile && /\.(png|jpe?g|gif|webp)$/i.test(posterFile.path)) {
      const img = document.createElement('img');
      img.src = app.vault.getResourcePath(posterFile);
      img.style.cssText = 'width:48px; height:64px; object-fit:cover; border-radius:4px; flex-shrink:0;';
      posterContainer.appendChild(img);
    }
  }

  const infoContainer = document.createElement('div');
  infoContainer.style.cssText = 'flex:1; min-width:0;';

  // 标题行 + 类型徽章
  const titleRow = document.createElement('div');
  titleRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:4px;';
  const nameEl = document.createElement('span');
  nameEl.textContent = item.name;
  nameEl.style.cssText = 'font-weight:600; font-size:1rem; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
  const typeBadge = document.createElement('span');
  typeBadge.textContent = item.typeTag;
  typeBadge.style.cssText = `background:${getTypeColor(item.group)}; color:white; font-size:.7rem; padding:2px 8px; border-radius:10px; flex-shrink:0;`;
  titleRow.appendChild(nameEl);
  titleRow.appendChild(typeBadge);

  // 状态区
  const statusContainer = document.createElement('div');
  statusContainer.style.cssText = 'margin:4px 0; display:flex; align-items:center; gap:6px; min-height:20px;';

  if (item.status === STATUS_WATCHING) {
    const badge = document.createElement('span');
    badge.textContent = '在看';
    badge.style.cssText = 'background:var(--text-accent); color:var(--background-primary); font-size:.7rem; padding:2px 8px; border-radius:10px;';
    statusContainer.appendChild(badge);
  } else if (item.status === STATUS_WANT) {
    const badge = document.createElement('span');
    badge.textContent = '想看';
    badge.style.cssText = 'background:var(--text-muted); color:var(--background-primary); font-size:.7rem; padding:2px 8px; border-radius:10px;';
    statusContainer.appendChild(badge);
  } else if (item.status === STATUS_WATCHED && item.rating !== null) {
    const stars = document.createElement('span');
    stars.textContent = getStarRating(item.rating);
    stars.style.cssText = 'font-size:.85rem;';
    statusContainer.appendChild(stars);
    if (item.watchDate) {
      const date = document.createElement('span');
      date.textContent = formatRelativeTime(item.watchDate);
      date.style.cssText = 'color:var(--text-muted); font-size:.75rem;';
      statusContainer.appendChild(date);
    }
  }

  // 在看/想看 → 点击打开编辑弹窗
  if (item.status === STATUS_WATCHING || item.status === STATUS_WANT) {
    statusContainer.style.cursor = 'pointer';
    statusContainer.addEventListener('click', () => openEditModal(item, app));
  }

  // 影评
  if (item.review) {
    const review = document.createElement('div');
    review.textContent = item.review;
    review.style.cssText = 'color:var(--text-muted); font-size:.8rem; white-space:pre-wrap; margin-top:4px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;';
    infoContainer.appendChild(titleRow);
    infoContainer.appendChild(statusContainer);
    infoContainer.appendChild(review);
  } else {
    infoContainer.appendChild(titleRow);
    infoContainer.appendChild(statusContainer);
  }

  posterContainer.appendChild(infoContainer);
  card.appendChild(posterContainer);
  return card;
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

/** 无限滚动 */
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

/** 搜索切换 */
export function toggleSearch(): void {
  if (!M.currentOverlay) return;
  const container = M.currentOverlay.querySelector('#movie-search-container') as HTMLElement;
  if (!container) return;
  const isHidden = container.style.display === 'none' || !container.style.display;
  container.style.display = isHidden ? 'block' : 'none';
  if (!isHidden) {
    M.searchKeyword = '';
    const input = M.currentOverlay.querySelector('#movie-search-input') as HTMLInputElement;
    if (input) input.value = '';
    M.loadedCount = 0;
    renderList();
  }
}

/** 关闭主 overlay（触发 changelog） */
export function closeOverlay(): void {
  checkAndShowChangelog('movie');
  M.searchKeyword = '';
  const timer = M.searchDebounceTimer;
  if (timer) clearTimeout(timer);
  if (M.currentOverlay) {
    M.currentOverlay.remove();
    M.currentOverlay = null;
  }
}

// ---------- 添加弹窗 ----------

export function openAddModal(app: App, prefill?: { name?: string; tag?: string; status?: number }): void {
  if (M.addOverlay) return;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;
    z-index: 1200;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: var(--background-primary); border-radius: 12px;
    width: 100%; max-width: 520px; max-height: 85vh; overflow-y: auto;
    padding: 24px;
  `;

  const title = document.createElement('h3');
  title.textContent = '➕ 添加影视';
  title.style.cssText = 'margin:0 0 16px 0;';

  // 名称
  const nameLabel = document.createElement('label');
  nameLabel.textContent = '影视名称';
  nameLabel.style.cssText = 'display:block; margin-bottom:4px; font-size:.9rem;';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = '例如：《肖申克的救赎》';
  nameInput.value = prefill?.name || '';
  nameInput.style.cssText = 'width:100%; margin-bottom:12px;';

  // 类型标签
  const tagLabel = document.createElement('label');
  tagLabel.textContent = '类型标签';
  tagLabel.style.cssText = 'display:block; margin-bottom:4px; font-size:.9rem;';
  const tagSelect = document.createElement('select');
  tagSelect.style.cssText = 'width:100%; margin-bottom:12px;';
  ALL_TAGS.forEach((tag) => {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = tag;
    tagSelect.appendChild(opt);
  });
  if (prefill?.tag) tagSelect.value = prefill.tag;

  // 状态
  const statusLabel = document.createElement('label');
  statusLabel.textContent = '状态';
  statusLabel.style.cssText = 'display:block; margin-bottom:4px; font-size:.9rem;';
  const statusSelect = document.createElement('select');
  statusSelect.style.cssText = 'width:100%; margin-bottom:12px;';
  [['想看', STATUS_WANT], ['在看', STATUS_WATCHING], ['已看', STATUS_WATCHED]].forEach(([label, val]) => {
    const opt = document.createElement('option');
    opt.value = String(val);
    opt.textContent = String(label);
    statusSelect.appendChild(opt);
  });
  if (prefill?.status !== undefined) statusSelect.value = String(prefill.status);

  // 评分（已看时显示）
  const ratingWrap = document.createElement('div');
  const ratingLabel = document.createElement('label');
  ratingLabel.textContent = '评分（1-5）';
  ratingLabel.style.cssText = 'display:block; margin-bottom:4px; font-size:.9rem;';
  const ratingInput = document.createElement('input');
  ratingInput.type = 'number';
  ratingInput.min = '1';
  ratingInput.max = '5';
  ratingInput.step = '0.1';
  ratingInput.style.cssText = 'width:100%; margin-bottom:12px;';
  ratingWrap.appendChild(ratingLabel);
  ratingWrap.appendChild(ratingInput);
  ratingWrap.style.display = statusSelect.value === String(STATUS_WATCHED) ? 'block' : 'none';
  statusSelect.addEventListener('change', () => {
    ratingWrap.style.display = statusSelect.value === String(STATUS_WATCHED) ? 'block' : 'none';
  });

  // 观影日期
  const dateLabel = document.createElement('label');
  dateLabel.textContent = '观影日期';
  dateLabel.style.cssText = 'display:block; margin-bottom:4px; font-size:.9rem;';
  const dateInput = document.createElement('input');
  dateInput.type = 'datetime-local';
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  dateInput.value = nowStr;
  dateInput.style.cssText = 'width:100%; margin-bottom:12px;';

  // 季集
  const seasonLabel = document.createElement('label');
  seasonLabel.textContent = '季集（可选）';
  seasonLabel.style.cssText = 'display:block; margin-bottom:4px; font-size:.9rem;';
  const seasonInput = document.createElement('input');
  seasonInput.type = 'text';
  seasonInput.placeholder = '例如：S1E1 或 3';
  seasonInput.style.cssText = 'width:100%; margin-bottom:12px;';

  // 影评
  const reviewLabel = document.createElement('label');
  reviewLabel.textContent = '影评（可选）';
  reviewLabel.style.cssText = 'display:block; margin-bottom:4px; font-size:.9rem;';
  const reviewInput = document.createElement('textarea');
  reviewInput.rows = 3;
  reviewInput.style.cssText = 'width:100%; margin-bottom:16px;';

  // 按钮
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; gap:8px; justify-content:flex-end;';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.style.cssText = 'background:var(--background-modifier-border); border:none; border-radius:4px; padding:6px 16px; cursor:pointer;';
  cancelBtn.addEventListener('click', closeAddModal);
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '确认添加';
  confirmBtn.style.cssText = 'background:var(--interactive-accent); color:var(--text-on-accent); border:none; border-radius:4px; padding:6px 16px; cursor:pointer;';
  confirmBtn.addEventListener('click', async () => {
    await handleAddConfirm(app, nameInput, tagSelect, statusSelect, ratingInput, dateInput, seasonInput, reviewInput);
  });
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);

  modal.appendChild(title);
  modal.appendChild(nameLabel);
  modal.appendChild(nameInput);
  modal.appendChild(tagLabel);
  modal.appendChild(tagSelect);
  modal.appendChild(statusLabel);
  modal.appendChild(statusSelect);
  modal.appendChild(ratingWrap);
  modal.appendChild(dateLabel);
  modal.appendChild(dateInput);
  modal.appendChild(seasonLabel);
  modal.appendChild(seasonInput);
  modal.appendChild(reviewLabel);
  modal.appendChild(reviewInput);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  M.addOverlay = overlay;
}

async function handleAddConfirm(app: App, nameInput: HTMLInputElement, tagSelect: HTMLSelectElement, statusSelect: HTMLSelectElement, ratingInput: HTMLInputElement, dateInput: HTMLInputElement, seasonInput: HTMLInputElement, reviewInput: HTMLTextAreaElement): Promise<void> {
  const name = nameInput.value.trim();
  if (!name) {
    new Notice('请输入影视名称');
    return;
  }
  const selectedTag = tagSelect.value;
  const selectedStatus = Number(statusSelect.value);
  let ratingValue: number | string;
  if (selectedStatus === STATUS_WANT) ratingValue = -1;
  else if (selectedStatus === STATUS_WATCHING) ratingValue = 0;
  else {
    const r = parseFloat(ratingInput.value);
    if (isNaN(r) || r <= 0) {
      new Notice('已看状态请填写大于0的评分');
      return;
    }
    ratingValue = r;
  }

  const watchDateValue = (dateInput.value || new Date().toISOString().slice(0, 19).replace('T', ' ')).replace('T', ' ');

  // 重名检查
  const existing = app.vault.getAbstractFileByPath(`${M.folderPath}/${`《${name}》`}.md`);
  if (existing) {
    new Notice(`影视"${name}"已存在，正在打开`);
    closeAddModal();
    app.workspace.getLeaf().openFile(existing as TFile);
    return;
  }

  const seasonEpisode = seasonInput.value.trim();
  const reviewText = reviewInput.value.trim();

  let fmLines = [
    '---',
    'tags:',
    `- ${selectedTag}`,
    `观影日期: ${watchDateValue}`,
    `评分: ${ratingValue}`,
  ];
  if (seasonEpisode) fmLines.push(`季集: ${seasonEpisode}`);
  if (reviewText) fmLines.push(`影评: ${reviewText}`);
  fmLines.push('海报: ');
  fmLines.push('---');

  try {
    await app.vault.create(`${M.folderPath}/${`《${name}》`}.md`, fmLines.join('\n'));
    new Notice(`✅ 已添加影视：${name}`);
    closeAddModal();
    refreshDataAndView(app);
  } catch (e) {
    new Notice('创建笔记失败');
  }
}

export function closeAddModal(): void {
  if (M.addOverlay) {
    M.addOverlay.remove();
    M.addOverlay = null;
  }
}

// ---------- 编辑弹窗 ----------

export function openEditModal(item: any, app: App): void {
  if (M.editOverlay) return;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;
    z-index: 1200;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: var(--background-primary); border-radius: 12px;
    width: 100%; max-width: 520px; max-height: 85vh; overflow-y: auto;
    padding: 24px;
  `;

  const title = document.createElement('h3');
  title.textContent = '✏️ 编辑影视';
  title.style.cssText = 'margin:0 0 16px 0;';

  const nameDisplay = document.createElement('div');
  nameDisplay.textContent = item.name;
  nameDisplay.style.cssText = 'font-size:1.1rem; font-weight:600; margin-bottom:16px;';

  // 状态（仅 在看/已看）
  const statusLabel = document.createElement('label');
  statusLabel.textContent = '状态';
  statusLabel.style.cssText = 'display:block; margin-bottom:4px; font-size:.9rem;';
  const statusSelect = document.createElement('select');
  statusSelect.style.cssText = 'width:100%; margin-bottom:12px;';
  const selectedStatus = item.status === STATUS_WANT ? STATUS_WATCHING : item.status;
  [[STATUS_WATCHING, '在看'], [STATUS_WATCHED, '已看']].forEach(([val, label]) => {
    const opt = document.createElement('option');
    opt.value = String(val);
    opt.textContent = String(label);
    statusSelect.appendChild(opt);
  });
  statusSelect.value = String(selectedStatus);

  // 评分
  const ratingLabel = document.createElement('label');
  ratingLabel.textContent = '评分（1-5）';
  ratingLabel.style.cssText = 'display:block; margin-bottom:4px; font-size:.9rem;';
  const ratingInput = document.createElement('input');
  ratingInput.type = 'number';
  ratingInput.min = '1';
  ratingInput.max = '5';
  ratingInput.step = '0.1';
  ratingInput.value = item.rating !== null && item.rating > 0 ? String(item.rating) : '';
  ratingInput.style.cssText = 'width:100%; margin-bottom:12px;';
  const ratingWrap = document.createElement('div');
  ratingWrap.appendChild(ratingLabel);
  ratingWrap.appendChild(ratingInput);
  ratingWrap.style.display = statusSelect.value === String(STATUS_WATCHED) ? 'block' : 'none';
  statusSelect.addEventListener('change', () => {
    ratingWrap.style.display = statusSelect.value === String(STATUS_WATCHED) ? 'block' : 'none';
  });

  // 季集
  const seasonLabel = document.createElement('label');
  seasonLabel.textContent = '季集（可选）';
  seasonLabel.style.cssText = 'display:block; margin-bottom:4px; font-size:.9rem;';
  const seasonInput = document.createElement('input');
  seasonInput.type = 'text';
  seasonInput.value = item.file ? '' : '';
  seasonInput.style.cssText = 'width:100%; margin-bottom:12px;';

  // 影评
  const reviewLabel = document.createElement('label');
  reviewLabel.textContent = '影评（可选）';
  reviewLabel.style.cssText = 'display:block; margin-bottom:4px; font-size:.9rem;';
  const reviewInput = document.createElement('textarea');
  reviewInput.rows = 3;
  reviewInput.value = item.review || '';
  reviewInput.style.cssText = 'width:100%; margin-bottom:16px;';

  // 按钮
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; gap:8px; justify-content:flex-end;';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.style.cssText = 'background:var(--background-modifier-border); border:none; border-radius:4px; padding:6px 16px; cursor:pointer;';
  cancelBtn.addEventListener('click', closeEditModal);
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '保存修改';
  confirmBtn.style.cssText = 'background:var(--interactive-accent); color:var(--text-on-accent); border:none; border-radius:4px; padding:6px 16px; cursor:pointer;';
  confirmBtn.addEventListener('click', async () => {
    await handleEditConfirm(app, item, statusSelect, ratingInput, seasonInput, reviewInput);
  });
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);

  modal.appendChild(title);
  modal.appendChild(nameDisplay);
  modal.appendChild(statusLabel);
  modal.appendChild(statusSelect);
  modal.appendChild(ratingWrap);
  modal.appendChild(seasonLabel);
  modal.appendChild(seasonInput);
  modal.appendChild(reviewLabel);
  modal.appendChild(reviewInput);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  M.editOverlay = overlay;

  // 加载当前季集
  const cache = app.metadataCache.getFileCache(item.file);
  const fm = cache?.frontmatter;
  if (fm && fm['季集'] !== undefined) {
    seasonInput.value = String(fm['季集']);
  }
}

async function handleEditConfirm(app: App, item: any, statusSelect: HTMLSelectElement, ratingInput: HTMLInputElement, seasonInput: HTMLInputElement, reviewInput: HTMLTextAreaElement): Promise<void> {
  const selectedStatus = Number(statusSelect.value);
  let ratingValue: number | string;
  if (selectedStatus === STATUS_WATCHING) {
    ratingValue = 0;
  } else {
    const r = parseFloat(ratingInput.value);
    if (isNaN(r) || r <= 0) {
      new Notice('已看状态请填写大于0的评分');
      return;
    }
    ratingValue = r;
  }

  const watchDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const seasonEpisode = seasonInput.value.trim();
  const reviewText = reviewInput.value.trim();

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
}

export function closeEditModal(): void {
  if (M.editOverlay) {
    M.editOverlay.remove();
    M.editOverlay = null;
  }
}

// ---------- 设置/筛选弹窗 ----------

export function openSettingsModal(): void {
  if (M.settingsOverlay) return;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;
    z-index: 1200;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: var(--background-primary); border-radius: 12px;
    width: 100%; max-width: 480px; max-height: 85vh; overflow-y: auto;
    padding: 24px;
  `;

  const title = document.createElement('h3');
  title.textContent = '⚙️ 筛选与排序';
  title.style.cssText = 'margin:0 0 16px 0;';

  // 排序
  const sortLabel = document.createElement('label');
  sortLabel.textContent = '排序方式';
  sortLabel.style.cssText = 'display:block; margin-bottom:4px; font-size:.9rem;';
  const sortSelect = document.createElement('select');
  sortSelect.style.cssText = 'width:100%; margin-bottom:16px;';
  const sortOptions = [
    ['date_desc', '日期↓'],
    ['date_asc', '日期↑'],
    ['rating_desc', '评分↓'],
    ['rating_asc', '评分↑'],
    ['name_asc', '名称A-Z'],
    ['name_desc', '名称Z-A'],
  ];
  sortOptions.forEach(([val, label]) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = String(label);
    sortSelect.appendChild(opt);
  });
  sortSelect.value = `${M.sortState.key}_${M.sortState.order}`;

  // 类型筛选
  const typeLabel = document.createElement('label');
  typeLabel.textContent = '类型筛选';
  typeLabel.style.cssText = 'display:block; margin-bottom:4px; font-size:.9rem;';
  const typeSelect = document.createElement('select');
  typeSelect.style.cssText = 'width:100%; margin-bottom:16px;';
  ['全部', ...Object.keys(TYPE_GROUPS)].forEach((g) => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    typeSelect.appendChild(opt);
  });
  typeSelect.value = M.typeFilter;

  // 状态筛选
  const statusLabel = document.createElement('label');
  statusLabel.textContent = '状态筛选';
  statusLabel.style.cssText = 'display:block; margin-bottom:4px; font-size:.9rem;';
  const statusSelect = document.createElement('select');
  statusSelect.style.cssText = 'width:100%; margin-bottom:20px;';
  ['全部', '想看', '在看', '已看'].forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    statusSelect.appendChild(opt);
  });
  statusSelect.value = M.statusFilter;

  // 按钮
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; gap:8px; justify-content:flex-end;';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.style.cssText = 'background:var(--background-modifier-border); border:none; border-radius:4px; padding:6px 16px; cursor:pointer;';
  cancelBtn.addEventListener('click', closeSettings);
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '应用';
  confirmBtn.style.cssText = 'background:var(--interactive-accent); color:var(--text-on-accent); border:none; border-radius:4px; padding:6px 16px; cursor:pointer;';
  confirmBtn.addEventListener('click', () => {
    const [key, order] = sortSelect.value.split('_');
    M.sortState.key = key;
    M.sortState.order = order as 'asc' | 'desc';
    M.typeFilter = typeSelect.value;
    M.statusFilter = statusSelect.value;
    M.loadedCount = 0;
    closeSettings();
    renderList();
  });
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);

  modal.appendChild(title);
  modal.appendChild(sortLabel);
  modal.appendChild(sortSelect);
  modal.appendChild(typeLabel);
  modal.appendChild(typeSelect);
  modal.appendChild(statusLabel);
  modal.appendChild(statusSelect);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  M.settingsOverlay = overlay;
}

export function closeSettings(): void {
  if (M.settingsOverlay) {
    M.settingsOverlay.remove();
    M.settingsOverlay = null;
  }
}

// ---------- 主 overlay ----------

export function createOverlay(app: App, statusType?: string): void {
  let initialStatus = statusType;
  if (!initialStatus) {
    initialStatus = takeHomeFilmStatus() ?? '全部';
  }

  const overlay = document.createElement('div');
  overlay.id = '__yin_ying__';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;
    z-index: 1000;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: var(--background-primary); border-radius: 12px;
    width: 100%; max-width: 600px; height: 90vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
  `;

  if (window.innerWidth <= 768) {
    modal.style.height = '100vh';
    modal.style.borderRadius = '0';
    modal.style.maxWidth = '100%';
    modal.style.paddingTop = '24px';
  }

  // 头部
  const header = document.createElement('div');
  header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 16px; flex-shrink:0; border-bottom:1px solid var(--background-modifier-border);';
  header.innerHTML = '<p style="font-size:.8rem; margin:0;">影视</p>';

  const btnGroup = document.createElement('div');
  btnGroup.style.cssText = 'display:flex; gap:4px;';

  const addBtn = document.createElement('button');
  addBtn.textContent = '✏️';
  addBtn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:1rem; box-shadow:none;';
  addBtn.addEventListener('click', () => openAddModal(app));
  btnGroup.appendChild(addBtn);

  const searchBtn = document.createElement('button');
  searchBtn.textContent = '🔍';
  searchBtn.title = '搜索影视';
  searchBtn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:1rem; box-shadow:none;';
  searchBtn.addEventListener('mouseenter', () => {
    searchBtn.style.background = 'var(--background-modifier-hover)';
  });
  searchBtn.addEventListener('mouseleave', () => {
    searchBtn.style.background = 'none';
  });
  searchBtn.addEventListener('click', () => toggleSearch());
  btnGroup.appendChild(searchBtn);

  const analysisBtn = document.createElement('button');
  analysisBtn.textContent = '📊';
  analysisBtn.title = '观影数据分析';
  analysisBtn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:1rem; box-shadow:none;';
  analysisBtn.addEventListener('click', () => {
    const commands = (app as any).commands;
    if (commands && commands.commands && commands.commands['movie-analysis-open']) {
      commands.executeCommandById('movie-analysis-open');
    } else {
      new Notice('请先在命令面板运行一次「影视：观影数据分析」');
    }
  });
  btnGroup.appendChild(analysisBtn);

  const recommendBtn = document.createElement('button');
  recommendBtn.textContent = '🤖';
  recommendBtn.title = 'AI 推荐';
  recommendBtn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:1rem; box-shadow:none;';
  recommendBtn.addEventListener('click', () => {
    openRecommendModal(app);
  });
  btnGroup.appendChild(recommendBtn);

  const settingsBtn = document.createElement('button');
  settingsBtn.textContent = '⚙️';
  settingsBtn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:1rem; box-shadow:none;';
  settingsBtn.addEventListener('click', () => openSettingsModal());
  btnGroup.appendChild(settingsBtn);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '❌';
  closeBtn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:.8rem; box-shadow:none;';
  closeBtn.addEventListener('click', closeOverlay);
  btnGroup.appendChild(closeBtn);

  header.appendChild(btnGroup);

  // 搜索区
  const searchContainer = document.createElement('div');
  searchContainer.id = 'movie-search-container';
  searchContainer.style.cssText = 'display:none; padding:0 24px 12px 24px;';
  const searchInput = document.createElement('input');
  searchInput.id = 'movie-search-input';
  searchInput.type = 'text';
  searchInput.placeholder = '🔍 搜索影视（名称、类型、影评）...';
  searchInput.style.cssText = 'width:100%;';
  searchInput.addEventListener('input', () => {
    if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
    M.searchDebounceTimer = setTimeout(() => {
      M.searchKeyword = searchInput.value;
      M.loadedCount = 0;
      renderList();
    }, 300);
  });
  searchContainer.appendChild(searchInput);

  // 列表容器
  const listContainer = document.createElement('div');
  listContainer.className = 'list-container';
  listContainer.style.cssText = 'flex:1; overflow-y:auto; padding: 12px 16px;';

  modal.appendChild(header);
  modal.appendChild(searchContainer);
  modal.appendChild(listContainer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  M.currentOverlay = overlay;
  M.renderListFn = renderList;

  // 应用初始状态过滤
  if (initialStatus && initialStatus !== '全部') {
    M.statusFilter = initialStatus;
  }

  rebuildItems(app);
  M.loadedCount = 0;
  renderList();
  setupInfiniteScroll(listContainer);

  // 点击遮罩空白关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeOverlay();
    }
  });
}

// ---------- ESC ----------

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
