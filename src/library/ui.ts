/**
 * 书库 ui（ticket 12）：主面板/筛选设置/读书笔记弹窗/批注编辑。
 * 源码：书库.js L210-1007、L1118-1217
 * 改造（ticket 62 书库代码质量）：
 *  - 视觉样式全部收敛到 styles.css（bz-lib-*，铁律 9），不再内联 style.cssText；
 *  - 长按手势统一走 core longPress（原 4 处 pointer 定时器手写）；
 *  - 两个编辑弹窗合并为 openNoteEditModal；
 *  - 纯 EPUB 书库（无 markdown 书目）不再被空态提前 return 吞掉；
 *  - 删死变量 libraryModal / getSubfolder 转发。
 */
import { notice, createIconBtn, longPress } from '../core/dom';
import { openFlowDialog } from '../core/flow-dialog';
import {
  attachItemActions,
  registerSheetCompanion,
  unregisterSheetCompanion,
  type ItemAction,
} from '../core/item-actions';
import { escManager } from '../core/esc-manager';
import { allocZ, topifyZ } from '../core/z-order';
import { tryGetSettings } from '../core/settings-provider';
import { openSettingsModal } from '../core/settings-modal';
import { mobileFullscreenGroup } from '../core/settings-common';
import type { SettingsSchema } from '../core/settings-schema';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { formatFileSize } from '../core/utils';
import { getBookItems, sortItemList, deriveBookSettings, loadEpubBookItems } from './items';
import type { BookItem } from './items';
import { parseBookNotes, jumpToHighlight, updateComment, deleteHighlight } from './notes';
import type { BookNoteNode } from './notes';
import { loadEpubBookNotes, buildEpubJumpLink, updateEpubNoteComment, deleteEpubNote, findWeaveBookByPath } from './epub-notes';
import type { EpubBookNote } from './epub-notes';

// ---------- 模块级状态（源码 L212-218） ----------
let libraryOverlay: HTMLElement | null = null;
let libraryListContainer: HTMLElement | null = null;
let currentItems: BookItem[] = [];
let sortState = { key: 'readingDate', order: 'desc' };
let categoryFilter = '全部';
let statusFilter = '全部';

export function showLibrary(app: any) {
  // 移动端默认全屏：复用打开（visibility 常驻）也重挂，设置变更后重开生效
  applyMobileWindowFullscreen(document.querySelector<HTMLElement>('.bz-lib-modal--full'), tryGetSettings().libraryMobileDefaultFullscreen === true);
  if (libraryOverlay) {
    topifyZ(libraryOverlay); // ADR-0067：显示即发号，谁后显示谁在上
    libraryOverlay.style.visibility = 'visible';
    // P1-19：复用打开前重扫数据（md 书目 + EPUB 条目），外部增删书目后重开即可见
    currentItems = getBookItems(app);
    void loadEpubBookItems(app).then((epubItems) => {
      if (epubItems && epubItems.length > 0) {
        currentItems = [...currentItems, ...epubItems];
      }
      renderAfterEpubMerge(app);
    });
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = '__book_library__';
  overlay.className = 'bz-lib-overlay bz-lib-overlay--1000'; // 修饰名仅作标识钩子（层级已动态发号 ADR-0067）
  overlay.style.zIndex = String(allocZ()); // ADR-0067：首建即显示即发号（modal 为子节点随动）

  const modal = document.createElement('div');
  modal.className = 'bz-lib-modal bz-lib-modal--full';
  applyMobileWindowFullscreen(modal, tryGetSettings().libraryMobileDefaultFullscreen === true);

  const header = document.createElement('div');
  header.className = 'bz-lib-header';
  const titleP = document.createElement('p');
  titleP.className = 'bz-lib-header-title';
  titleP.textContent = '书库';
  header.appendChild(titleP);

  const headerButtons = document.createElement('div');
  headerButtons.className = 'bz-lib-header-btns';

  const reportBtn = createIconBtn('🧮', '打开阅读数据分析报告', () => {
    (app as any).commands.executeCommandById('bz-reading-report-open');
  });
  // 筛选弹窗（ADR-0009：视图与筛选挂 🔀，⚙️ 只留给真设置）
  const filterBtn = createIconBtn('🔀', '视图与筛选', () => {
    openFilterModal(app);
  });
  // 书库设置弹窗（ADR-0009 域设置弹窗；分组卡片重设计：目录/列表显示/移动端）
  const settingsBtn = createIconBtn('⚙️', '书库设置', () => openLibrarySettings(app));

  // 关闭图符统一（ticket 51→130）：bz-win-close + ❌
  const closeBtn = createIconBtn('❌', '关闭', () => (overlay.style.visibility = 'hidden'));
  closeBtn.classList.add('bz-win-close');

  // 按钮秩序：报告 → 筛选 → 设置 → 关闭（功能 → ⚙️ → 关闭）
  headerButtons.appendChild(reportBtn);
  headerButtons.appendChild(filterBtn);
  headerButtons.appendChild(settingsBtn);
  headerButtons.appendChild(closeBtn);
  header.appendChild(headerButtons);

  const listContainer = document.createElement('div');
  listContainer.className = 'bz-lib-list';
  libraryListContainer = listContainer;

  modal.appendChild(header);
  modal.appendChild(listContainer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  // P0-9：面板关闭走 visibility:hidden 常驻复用（性能设计），isConnected 恒真会让本层「永真」，
  // 吞掉注册序更早的他域层的 ESC。可见性必须按真实显示状态判定。
  escManager.register('lib', {
    isVisible: () => overlay.isConnected && overlay.style.visibility !== 'hidden',
    close: () => (overlay.style.visibility = 'hidden'),
  });

  libraryOverlay = overlay;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.style.visibility = 'hidden';
  });
  // 注：不再私挂 document 级 keydown 监听（见 core/esc-manager 立约），ESC 关闭统一走上方注册的 lib 层。

  // 先同步渲染 markdown 书目；EPUB 条目（ADR-0013）异步并入后重渲染。
  // 空态判定放到 EPUB 合并之后：纯 EPUB 书库（无 markdown 书目）不被提前 return 吞掉。
  currentItems = getBookItems(app);
  void loadEpubBookItems(app).then((epubItems) => {
    if (epubItems && epubItems.length > 0) {
      currentItems = [...currentItems, ...epubItems];
    }
    renderAfterEpubMerge(app);
  });

  if (currentItems.length === 0 && libraryListContainer) {
    listContainer.innerHTML = '<p class="bz-lib-empty">正在加载书库…</p>';
  } else {
    renderLibraryList(app);
  }
}

/** EPUB 合并后统一渲染：空库内嵌空态（l4），否则渲染列表 */
function renderAfterEpubMerge(app: any): void {
  if (!libraryOverlay || !libraryListContainer) return;
  if (currentItems.length === 0) renderLibraryEmpty(app);
  else renderLibraryList(app);
}

/** 空库内嵌空态（l4：不再自动关窗 + 短 toast）：路径 + tags 说明 + ⚙️ 设置入口 */
function renderLibraryEmpty(app: any): void {
  if (!libraryListContainer) return;
  const settings = deriveBookSettings();
  libraryListContainer.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'bz-lib-empty';

  const main = document.createElement('div');
  main.textContent = `书库「${settings.folderPath}」中还没有书籍笔记`;
  const guide = document.createElement('div');
  guide.textContent = `将书籍笔记放入该文件夹，并在 frontmatter 中添加 tags: ${settings.bookTag} 标签`;
  const settingsBtn = document.createElement('button');
  settingsBtn.textContent = '⚙️ 去设置';
  settingsBtn.addEventListener('click', () => openLibrarySettings(app));

  empty.appendChild(main);
  empty.appendChild(guide);
  empty.appendChild(settingsBtn);
  libraryListContainer.appendChild(empty);
}

// ===== 书库设置 schema（ticket 131 声明式，ADR-0064）=====
// 闭包内 field 名驱动工厂（textSetting/toggleSetting）退役 → 键直绑行；组序/行序/maxWidth 保持现状。
/** 书库设置 schema（置于模块顶层供文案 lint 直接引用） */
export function librarySettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        icon: 'folder-open', name: '目录',
        rows: [
          // ticket 128：书库文件夹（统一路径选择器录入，无手输文本框）
          { type: 'path', mode: 'single', name: '书库文件夹', desc: '存放书籍笔记的文件夹路径', binding: { key: 'libraryFolderPath' } },
          { type: 'text', name: '书籍识别标签', desc: '识别书籍笔记所用的标签名', binding: { key: 'bookTag' } },
        ],
      },
      {
        icon: 'eye', name: '列表显示',
        rows: [
          { type: 'toggle', name: '显示文件大小', desc: '在书籍卡片上显示文件大小', binding: { key: 'showFileSize' } },
          { type: 'toggle', name: '显示阅读时长', desc: '在书籍卡片上显示阅读时长', binding: { key: 'showReadingTime' } },
          { type: 'toggle', name: '显示划线数', desc: '在书籍卡片上显示划线数量', binding: { key: 'showHighlights' } },
          { type: 'toggle', name: '显示想法数', desc: '在书籍卡片上显示想法数量', binding: { key: 'showThinks' } },
          { type: 'toggle', name: '显示书评摘要', desc: '在书籍卡片上显示书评摘要', binding: { key: 'showReview' } },
        ],
      },
      mobileFullscreenGroup('libraryMobileDefaultFullscreen'),
    ],
  };
}

/** 书库设置弹窗（头部 ⚙️ 与空库空态「去设置」入口共用） */
function openLibrarySettings(app: any): void {
  openSettingsModal({
    title: '书库设置',
    maxWidth: 560,
    schema: librarySettingsSchema(),
  });
}

export function renderLibraryList(app: any) {
  let filtered = [...currentItems];
  if (categoryFilter !== '全部') {
    filtered = filtered.filter(
      (item) => item.category === categoryFilter || item.subfolder === categoryFilter
    );
  }
  if (statusFilter !== '全部') {
    filtered = filtered.filter((item) => item.status === statusFilter);
  }
  filtered = sortItemList(filtered, sortState.key, sortState.order);

  const container = libraryListContainer!;
  container.style.display = 'block';
  container.style.columnCount = '';
  container.style.flexWrap = '';
  container.innerHTML = '';

  if (filtered.length === 0) {
    const p = document.createElement('p');
    p.className = 'bz-lib-empty';
    p.textContent = '📭 没有找到符合条件的书籍';
    container.appendChild(p);
    return;
  }

  const settings = deriveBookSettings();
  filtered.forEach((item) => {
    container.appendChild(renderBookCard(app, item, settings));
  });
}

/** 单本书卡片渲染（renderLibraryList 拆分） */
function renderBookCard(app: any, item: BookItem, settings: any): HTMLElement {
  const card = document.createElement('div');
  card.className = 'bz-lib-card';

  // ---- 封面区域（双击转跳书籍：md 开原笔记 / EPUB 开阅读器；单击读书笔记收敛进抽屉） ----
  const coverWrapper = document.createElement('div');
  coverWrapper.className = 'bz-lib-cover';
  coverWrapper.title = '双击在阅读器/原文中打开';

  if (item.cover) {
    const coverFile = app.vault.getAbstractFileByPath(item.cover);
    if (coverFile && /\.(png|jpe?g|gif|webp)$/i.test(coverFile.name)) {
      const img = document.createElement('img');
      img.className = 'bz-lib-cover-img';
      img.src = app.vault.getResourcePath(coverFile);
      coverWrapper.appendChild(img);
    }
  }
  if (!coverWrapper.firstChild) {
    const noCover = document.createElement('div');
    noCover.className = 'bz-lib-cover-placeholder';
    noCover.textContent = '📖';
    coverWrapper.appendChild(noCover);
  }

  // 双击转跳书籍（用户拍板保留）：md → 打开原笔记；EPUB → 打开阅读器
  coverWrapper.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    app.workspace.openLinkText(item.file.path, '', false);
    libraryOverlay!.style.visibility = 'hidden';
  });

  card.appendChild(coverWrapper);

  // ---- 信息区域 ----
  const infoDiv = document.createElement('div');
  infoDiv.className = 'bz-lib-info';

  // 标题行（打开原文收敛进抽屉，仅展示）
  const titleRow = document.createElement('div');
  titleRow.className = 'bz-lib-title-row';
  const titleEl = document.createElement('div');
  titleEl.className = 'bz-lib-title';
  titleEl.textContent = item.title;

  const statusBadge = document.createElement('span');
  statusBadge.className = `bz-lib-badge bz-lib-badge--${item.status}`;
  statusBadge.textContent = item.status;
  titleRow.appendChild(titleEl);
  if (item.status !== '已读') titleRow.appendChild(statusBadge);
  infoDiv.appendChild(titleRow);

  // 元数据行（仅显示作者，删除了分类/子文件夹显示）
  const metaRow = document.createElement('div');
  metaRow.className = 'bz-lib-meta';
  if (item.author) {
    const authorSpan = document.createElement('span');
    authorSpan.textContent = `✍️ ${item.author}`;
    metaRow.appendChild(authorSpan);
  }
  infoDiv.appendChild(metaRow);

  // 进度行
  const progressRow = document.createElement('div');
  progressRow.className = 'bz-lib-progress';

  if (item.readingProgress !== undefined && item.readingProgress > 0) {
    const progressText = document.createElement('span');
    progressText.className = 'bz-lib-chip bz-lib-chip--pill';
    progressText.textContent = `📊 ${item.readingProgress}%`;
    progressRow.appendChild(progressText);
  }

  if (settings.showReadingTime !== false && item.readingTimeFormat) {
    const timeSpan = document.createElement('span');
    timeSpan.className = 'bz-lib-chip';
    timeSpan.textContent = `⏱️ ${item.readingTimeFormat}`;
    progressRow.appendChild(timeSpan);
  }

  if (settings.showHighlights !== false || settings.showThinks !== false) {
    const parts: string[] = [];
    if (settings.showHighlights !== false && item.highlights > 0) {
      parts.push(`💡 划线${item.highlights}`);
    }
    if (settings.showThinks !== false && item.thinks > 0) {
      parts.push(`🧠 想法${item.thinks}`);
    }
    if (parts.length) {
      const noteSpan = document.createElement('span');
      noteSpan.className = 'bz-lib-chip';
      noteSpan.textContent = parts.join(' · ');
      progressRow.appendChild(noteSpan);
    }
  }

  if (settings.showFileSize !== false) {
    const formattedSize = formatFileSize(item.sizeBytes);
    if (formattedSize) {
      const sizeSpan = document.createElement('span');
      sizeSpan.className = 'bz-lib-chip';
      sizeSpan.textContent = `📦 ${formattedSize}`;
      progressRow.appendChild(sizeSpan);
    }
  }

  infoDiv.appendChild(progressRow);

  // 书评
  if (settings.showReview !== false && item.bookReview) {
    const reviewDiv = document.createElement('div');
    reviewDiv.className = 'bz-lib-review';
    reviewDiv.textContent = item.bookReview;
    infoDiv.appendChild(reviewDiv);
  }

  card.appendChild(infoDiv);

  // 统一抽屉（桌面右键/移动长按）：打开原文 → 读书笔记
  attachItemActions(card, buildBookActions(app, item), { sheetHead: buildBookSheetHead(item) });
  return card;
}

/** 书库抽屉动作：打开原文（md 笔记 / EPUB 阅读器）→ 读书笔记（companion 弹窗） */
function buildBookActions(app: any, item: BookItem): ItemAction[] {
  const acts: ItemAction[] = [];

  // 打开原文（与封面双击同路径）
  acts.push({
    icon: 'book-open',
    label: '打开原文',
    onClick: () => {
      app.workspace.openLinkText(item.file.path, '', false);
      if (libraryOverlay) libraryOverlay.style.visibility = 'hidden';
    },
  });

  // 读书笔记（md 划线/批注弹窗；EPUB 划线/想法弹窗；companion 叠抽屉）
  acts.push({
    icon: 'highlighter',
    label: '读书笔记',
    onClick: () => {
      if (item.isEpub) showEpubBookNotes(app, item);
      else showBookNotes(app, item.file.path);
    },
  });

  return acts;
}

/** 书库抽屉头部：📖 + 书名；小字=作者 · 状态 · 进度 */
function buildBookSheetHead(item: BookItem): HTMLElement {
  const head = document.createElement('div');
  head.className = 'bz-item-sheet-entry';
  const body = document.createElement('div');
  body.style.cssText = 'display:flex; align-items:flex-start; gap:10px;';

  const emoji = document.createElement('span');
  emoji.className = 'bz-item-sheet-emoji';
  emoji.textContent = '📖';
  body.appendChild(emoji);

  const info = document.createElement('div');
  info.style.cssText = 'flex:1; min-width:0;';
  const title = document.createElement('div');
  title.className = 'bz-item-sheet-title';
  title.textContent = item.title;
  info.appendChild(title);
  const subParts: string[] = [];
  if (item.author) subParts.push(`✍️ ${item.author}`);
  subParts.push(item.status);
  if (item.readingProgress > 0) subParts.push(`${item.readingProgress}%`);
  const sub = document.createElement('div');
  sub.className = 'bz-item-sheet-sub';
  sub.textContent = subParts.join(' · ');
  info.appendChild(sub);

  body.appendChild(info);
  head.appendChild(body);
  return head;
}

// ============ 筛选弹窗 ============

let settingsOverlay: HTMLElement | null = null;

export function openFilterModal(app: any) {
  if (settingsOverlay) {
    closeFilterModal();
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'bz-lib-overlay bz-lib-overlay--1100'; // 修饰名仅作 0.3 半透明底视觉钩子（层级已动态化）
  overlay.style.zIndex = String(allocZ()); // ADR-0067：新建即显示即发号

  const modal = document.createElement('div');
  modal.className = 'bz-lib-modal bz-lib-modal--sm';

  const header = document.createElement('div');
  header.className = 'bz-lib-modal-header bz-lib-modal-header--tight';
  const title = document.createElement('h3');
  title.className = 'bz-lib-modal-title';
  title.textContent = '视图与筛选';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'bz-lib-modal-close bz-win-close';
  closeBtn.textContent = '❌';
  closeBtn.addEventListener('click', closeFilterModal);
  header.appendChild(title);
  header.appendChild(closeBtn);

  const content = document.createElement('div');
  content.className = 'bz-lib-modal-content';

  function renderSettings() {
    content.innerHTML = '';

    const categorySection = document.createElement('div');
    categorySection.className = 'bz-lib-filter-section';
    const categoryGroup = document.createElement('div');
    categoryGroup.className = 'bz-lib-filter-group';
    const categories = ['全部', ...getAllCategories()];
    categories.forEach((cat) => {
      const btn = document.createElement('button');
      btn.className = `bz-lib-pill${categoryFilter === cat ? ' bz-lib-pill--active' : ''}`;
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        categoryFilter = cat;
        renderLibraryList(app);
        renderSettings();
      });
      categoryGroup.appendChild(btn);
    });
    categorySection.appendChild(categoryGroup);
    content.appendChild(categorySection);

    const statusSection = document.createElement('div');
    statusSection.className = 'bz-lib-filter-section';
    const statusGroup = document.createElement('div');
    statusGroup.className = 'bz-lib-filter-group';
    const statuses = ['全部', '未读', '在读', '已读'];
    statuses.forEach((st) => {
      const btn = document.createElement('button');
      btn.className = `bz-lib-pill${statusFilter === st ? ' bz-lib-pill--active' : ''}`;
      btn.textContent = st;
      btn.addEventListener('click', () => {
        statusFilter = st;
        renderLibraryList(app);
        renderSettings();
      });
      statusGroup.appendChild(btn);
    });
    statusSection.appendChild(statusGroup);
    content.appendChild(statusSection);

    const sortSection = document.createElement('div');
    sortSection.className = 'bz-lib-filter-section bz-lib-filter-section--tight';
    const sortGroup = document.createElement('div');
    sortGroup.className = 'bz-lib-filter-group';
    const sortOptions = [
      { label: '书名 A-Z', key: 'title', order: 'asc' },
      { label: '书名 Z-A', key: 'title', order: 'desc' },
      { label: '作者 A-Z', key: 'author', order: 'asc' },
      { label: '作者 Z-A', key: 'author', order: 'desc' },
      { label: '开始日期 ↑', key: 'readingDate', order: 'asc' },
      { label: '开始日期 ↓', key: 'readingDate', order: 'desc' },
      { label: '完成日期 ↑', key: 'completionDate', order: 'asc' },
      { label: '完成日期 ↓', key: 'completionDate', order: 'desc' },
      { label: '进度 ↑', key: 'readingProgress', order: 'asc' },
      { label: '进度 ↓', key: 'readingProgress', order: 'desc' },
    ];
    sortOptions.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = `bz-lib-pill bz-lib-pill--sm${sortState.key === opt.key && sortState.order === opt.order ? ' bz-lib-pill--active' : ''}`;
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        sortState.key = opt.key;
        sortState.order = opt.order;
        renderLibraryList(app);
        renderSettings();
      });
      sortGroup.appendChild(btn);
    });
    sortSection.appendChild(sortGroup);
    content.appendChild(sortSection);
  }

  function getAllCategories() {
    const cats = new Set<string>();
    currentItems.forEach((item) => {
      if (item.category && item.category !== '未分类') cats.add(item.category);
      if (item.subfolder) cats.add(item.subfolder);
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'zh'));
  }

  renderSettings();

  modal.appendChild(header);
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  escManager.register('lib', { isVisible: () => overlay.isConnected, close: () => closeFilterModal() });
  settingsOverlay = overlay;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeFilterModal();
  });
}

export function closeFilterModal() {
  if (settingsOverlay) {
    settingsOverlay.remove();
    settingsOverlay = null;
  }
}

// ---------- 读书笔记树渲染（showBookNotes 拆分） ----------

/** 读书笔记树递归渲染：无高亮的非一级节点跳过 */
function renderBookNoteNode(node: BookNoteNode, container: HTMLElement, app: any, filePath: string): void {
  if (node.level !== 0 && !node.hasHighlight) {
    return;
  }

  if (node.level === 0) {
    for (const child of node.children) {
      renderBookNoteNode(child, container, app, filePath);
    }
    return;
  }

  const cleanHeading = node.heading!.replace(/\s*\[\^[0-9]+\]\s*/g, '').trim();

  const headingEl = document.createElement('div');
  headingEl.textContent = cleanHeading;
  headingEl.className = 'bz-lib-note-heading';
  // 字号/字重/外边距按层级动态计算（功能性内联，铁律 9 允许）
  headingEl.style.fontSize = Math.max(0.9, 1.2 - node.level * 0.1) + 'rem';
  headingEl.style.fontWeight = node.level === 1 ? 'bold' : '600';
  headingEl.style.margin = node.level === 1 ? '16px 0 8px 0' : '12px 0 6px 0';
  container.appendChild(headingEl);

  for (const hl of node.highlights) {
    container.appendChild(renderHighlightBlock(hl, app, filePath));
  }

  for (const child of node.children) {
    renderBookNoteNode(child, container, app, filePath);
  }
}

/** 单条高亮块渲染（原文/批注/日期 + 双击跳转/长按编辑批注/长按删除高亮） */
function renderHighlightBlock(hl: any, app: any, filePath: string): HTMLElement {
  const block = document.createElement('div');
  block.className = 'bz-lib-hl';

  // ---- 内容区域（原文 + 批注）----
  const contentArea = document.createElement('div');
  contentArea.className = 'bz-lib-hl-body';

  const quote = document.createElement('div');
  quote.className = 'bz-lib-quote';
  quote.textContent = `❝ ${hl.text}`;
  contentArea.appendChild(quote);

  if (hl.comment) {
    const commentEl = document.createElement('div');
    commentEl.className = 'bz-lib-comment';
    commentEl.textContent = hl.comment;
    contentArea.appendChild(commentEl);
  }

  // ---- 日期区域 ----
  const dateEl = document.createElement('div');
  dateEl.className = hl.date ? 'bz-lib-hl-date bz-lib-hl-date--pointer' : 'bz-lib-hl-date';
  dateEl.textContent = hl.date || '无日期';

  block.appendChild(contentArea);
  block.appendChild(dateEl);

  // 1. 双击整个块 => 跳转
  block.addEventListener('dblclick', () => {
    jumpToHighlight(app, filePath, hl.id);
    setTimeout(() => {
      if (bookNotesOverlay) {
        bookNotesOverlay.remove();
        bookNotesOverlay = null;
      }
    }, 200);
  });

  // 2. 长按内容区域 => 编辑批注
  longPress(contentArea, () => {
    openEditCommentModal(app, filePath, hl.id, hl.text, hl.comment || '', () => {
      showBookNotes(app, filePath);
    });
  });

  // 3. 长按日期区域 => 删除高亮（统一 core/flow-dialog；壳层级 11100 > 流程框 10060，先关壳再确认，取消/确认后均重开）
  if (hl.date) {
    longPress(dateEl, () => {
      closeBookNotesModal();
      void openFlowDialog({
        title: '删除划线',
        message: '确定要删除该高亮及其批注吗？此操作不可撤销。',
        actions: [
          { label: '取消', value: 'cancel' },
          { label: '删除', value: 'ok', cta: true },
        ],
      }).then((v) => {
        if (v === 'ok') {
          deleteHighlight(app, filePath, hl.id, hl.text, () => {
            showBookNotes(app, filePath);
          });
        } else {
          showBookNotes(app, filePath);
        }
      });
    });
  }

  return block;
}

// ============ 读书笔记模态 ============

let bookNotesOverlay: HTMLElement | null = null;
/** 在途打开序号：vault.read 异步窗口内连开两本时，旧请求过期作废，只留最后一次（P2 双弹窗竞态） */
let bookNotesLoadSeq = 0;

export function showBookNotes(app: any, filePath: string) {
  if (bookNotesOverlay) {
    bookNotesOverlay.remove();
    bookNotesOverlay = null;
  }

  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file) {
    notice('文件不存在');
    return;
  }

  const seq = ++bookNotesLoadSeq;
  // 先建窗放占位，vault.read 完成后填充（大文件不白屏；l4）
  const { overlay, contentContainer } = createBookNotesModal(`📚 《${file.basename}》的读书笔记`, () => closeBookNotesModal());
  contentContainer.innerHTML = '<p class="bz-lib-empty">正在加载…</p>';
  bookNotesOverlay = overlay;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeBookNotesModal();
  });

  void app.vault
    .read(file)
    .then((content: string) => {
      if (seq !== bookNotesLoadSeq) return; // 过期在途请求：已被更新一次的打开取代
      const parsed = parseBookNotes(content, file.basename);
      contentContainer.innerHTML = '';
      if (!parsed.root || parsed.root.children.length === 0) {
        const p = document.createElement('p');
        p.className = 'bz-lib-empty';
        p.textContent = '📭 没有找到高亮或批注';
        contentContainer.appendChild(p);
      } else {
        renderBookNoteNode(parsed.root, contentContainer, app, filePath);
      }
    })
    .catch((e) => {
      if (seq !== bookNotesLoadSeq) return;
      console.error(`读书笔记读取失败: ${filePath}`, e);
      contentContainer.innerHTML = '<p class="bz-lib-empty">笔记读取失败，请稍后重试</p>';
    });
}

// ---------- EPUB 读书笔记模态（ADR-0013 扩展） ----------
let epubBookNotesOverlay: HTMLElement | null = null;

/** EPUB 书读书笔记：划线+想法按章节分组；双击跳原文、长按编辑想法/删除。 */
export function showEpubBookNotes(app: any, item: BookItem) {
  if (epubBookNotesOverlay) {
    epubBookNotesOverlay.remove();
    epubBookNotesOverlay = null;
  }

  const { overlay, contentContainer } = createBookNotesModal(`📚 《${item.title}》的读书笔记`, () => closeEpubBookNotesModal());
  contentContainer.innerHTML = '<p class="bz-lib-empty">正在加载…</p>';
  epubBookNotesOverlay = overlay;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeEpubBookNotesModal();
  });

  void (async () => {
    const vaultPath = String(item.file?.path || '').trim();
    const book = await findWeaveBookByPath(app, vaultPath);
    if (!book) {
      contentContainer.innerHTML = '<p class="bz-lib-empty">📭 未找到该书阅读数据</p>';
      return;
    }
    // 传入已取到的 book，避免二次读取 weave-data.json
    const notes = await loadEpubBookNotes(app, vaultPath, book);
    if (notes.length === 0) {
      contentContainer.innerHTML = '<p class="bz-lib-empty">📭 没有找到高亮或想法</p>';
      return;
    }
    renderEpubBookNoteTree(app, book, vaultPath, notes, contentContainer, () => {
      // 编辑/删除后重开（与 md showBookNotes 的 onDone 语义一致）
      void showEpubBookNotes(app, item);
    });
  })();
}

/** 读书笔记/EPUB 读书笔记共享的外壳：遮罩+弹窗+头部+关闭，返回 overlay 与内容容器。 */
function createBookNotesModal(title: string, onClose: () => void): { overlay: HTMLElement; contentContainer: HTMLElement } {
  const overlay = document.createElement('div');
  // 读书笔记壳作为抽屉附属浮层（后于抽屉创建，动态发号自然压过——ADR-0067）
  overlay.className = 'bz-lib-overlay bz-lib-overlay--11100'; // 修饰名仅作标识钩子
  overlay.style.zIndex = String(allocZ());
  // 抽屉来源打开时：笔记弹窗作为附属浮层叠在抽屉上（内部点击不误关抽屉）
  registerSheetCompanion(overlay);

  const modal = document.createElement('div');
  modal.className = 'bz-lib-modal bz-lib-modal--full-lg';
  applyMobileWindowFullscreen(modal, tryGetSettings().libraryMobileDefaultFullscreen === true);

  const header = document.createElement('div');
  header.className = 'bz-lib-modal-header';
  const titleSpan = document.createElement('span');
  titleSpan.className = 'bz-lib-modal-title--lg';
  titleSpan.textContent = title;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'bz-lib-modal-close--sm bz-win-close';
  closeBtn.textContent = '❌';
  closeBtn.addEventListener('click', onClose);
  header.appendChild(titleSpan);
  header.appendChild(closeBtn);

  const contentContainer = document.createElement('div');
  contentContainer.className = 'bz-lib-notes-body';

  modal.appendChild(header);
  modal.appendChild(contentContainer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  escManager.register('lib', { isVisible: () => overlay.isConnected, close: onClose });

  return { overlay, contentContainer };
}

function closeBookNotesModal() {
  if (bookNotesOverlay) {
    unregisterSheetCompanion(bookNotesOverlay);
    bookNotesOverlay.remove();
    bookNotesOverlay = null;
  }
}

function closeEpubBookNotesModal() {
  if (epubBookNotesOverlay) {
    unregisterSheetCompanion(epubBookNotesOverlay);
    epubBookNotesOverlay.remove();
    epubBookNotesOverlay = null;
  }
}

/** 按章节分组渲染（保留首现顺序）。 */
function groupEpubNotesByChapter(notes: EpubBookNote[]): { chapterTitle: string; items: EpubBookNote[] }[] {
  const byTitle = new Map<string, EpubBookNote[]>();
  for (const note of notes) {
    const key = note.chapterTitle;
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key)!.push(note);
  }
  return [...byTitle].map(([chapterTitle, items]) => ({ chapterTitle, items }));
}

/** 递归渲染 EPUB 读书笔记树（章节标题 + 高亮块）。 */
function renderEpubBookNoteTree(
  app: any,
  book: any,
  vaultPath: string,
  notes: EpubBookNote[],
  container: HTMLElement,
  onChanged: () => void
): void {
  const groups = groupEpubNotesByChapter(notes);
  groups.forEach((group, index) => {
    const headingEl = document.createElement('div');
    headingEl.className = 'bz-lib-note-heading';
    headingEl.textContent = group.chapterTitle;
    // 首组与后续组外边距不同（功能性内联）
    headingEl.style.fontSize = '1rem';
    headingEl.style.fontWeight = 'bold';
    headingEl.style.margin = index === 0 ? '0 0 8px 0' : '16px 0 8px 0';
    container.appendChild(headingEl);
    for (const note of group.items) {
      container.appendChild(renderEpubHighlightBlock(app, book, vaultPath, note, onChanged));
    }
  });
}

/** 单条 EPUB 划线块（原文/想法/日期 + 双击跳原文/长按编辑/长按删除）。 */
function renderEpubHighlightBlock(
  app: any,
  book: any,
  vaultPath: string,
  note: EpubBookNote,
  onChanged: () => void
): HTMLElement {
  const block = document.createElement('div');
  block.className = 'bz-lib-hl';

  const contentArea = document.createElement('div');
  contentArea.className = 'bz-lib-hl-body';

  const quote = document.createElement('div');
  quote.className = 'bz-lib-quote';
  quote.textContent = `❝ ${note.text}`;
  contentArea.appendChild(quote);

  if (note.comment) {
    const commentEl = document.createElement('div');
    commentEl.className = 'bz-lib-comment';
    commentEl.textContent = note.comment;
    contentArea.appendChild(commentEl);
  }

  const dateEl = document.createElement('div');
  dateEl.className = 'bz-lib-hl-date bz-lib-hl-date--pointer';
  if (note.createdTime) {
    const d = new Date(note.createdTime);
    dateEl.textContent = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } else {
    dateEl.textContent = '无日期';
  }

  block.appendChild(contentArea);
  block.appendChild(dateEl);

  const highlightId = String(note.highlight?.id || '');

  // 双击整个块 → 跳原文（weave-cfi 深链）
  block.addEventListener('dblclick', () => {
    const linkText = buildEpubJumpLink(book, note);
    if (!linkText) return;
    app.workspace.openLinkText(linkText, '', false);
    closeEpubBookNotesModal();
  });

  // 长按内容 → 编辑想法
  longPress(contentArea, () => {
    openEpubEditCommentModal(app, vaultPath, highlightId, note, onChanged);
  });

  // 长按日期 → 删除高亮（统一 core/flow-dialog：壳 11100 > 流程框 10060，先关壳，取消/确认后均重开）
  longPress(dateEl, () => {
    closeEpubBookNotesModal();
    void openFlowDialog({
      title: '删除划线',
      message: '确定要删除该划线和想法吗？此操作不可撤销。',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '删除', value: 'ok', cta: true },
      ],
    }).then((v) => {
      if (v === 'ok') {
        void deleteEpubNote(app, vaultPath, highlightId).then((ok) => {
          // 失败也重开壳（列表保留该条）并给明确 toast（B2：失败路径不能只剩关掉的壳、无任何反馈）
          if (!ok) notice('删除划线和想法失败，请重试', 'error');
          onChanged();
        });
      } else {
        onChanged();
      }
    });
  });

  return block;
}

// ---------- 编辑想法/批注共用弹窗 ----------

/**
 * 编辑弹窗共用外壳（编辑批注 openEditCommentModal 与编辑想法 openEpubEditCommentModal 合并）。
 * onSave 返回 void（同步内完成关闭）或 Promise<boolean>（true 才关闭）。
 */
function openNoteEditModal(opts: {
  title: string;
  quote: string;
  initial: string;
  /** 返回 true 才关闭弹窗（md 编辑批注经 updateComment 成功回调 resolve；EPUB 编辑想法按写回结果）。 */
  onSave: (value: string) => Promise<boolean>;
}): void {
  const overlay = document.createElement('div');
  // 编辑弹窗后于读书笔记壳创建，动态发号自然压过（ADR-0067）
  overlay.className = 'bz-lib-overlay bz-lib-overlay--11101'; // 修饰名仅作标识钩子
  overlay.style.zIndex = String(allocZ());

  const modal = document.createElement('div');
  modal.className = 'bz-lib-modal bz-lib-modal--sm';

  const header = document.createElement('div');
  header.className = 'bz-lib-modal-header';
  const title = document.createElement('h3');
  title.className = 'bz-lib-modal-title';
  title.textContent = opts.title;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'bz-lib-modal-close bz-win-close';
  closeBtn.textContent = '❌';
  closeBtn.addEventListener('click', () => overlay.remove());
  header.appendChild(title);
  header.appendChild(closeBtn);

  const content = document.createElement('div');
  content.className = 'bz-lib-modal-content';

  const quoteDiv = document.createElement('div');
  quoteDiv.className = 'bz-lib-edit-quote';
  quoteDiv.textContent = `❝ ${opts.quote}`;
  content.appendChild(quoteDiv);

  const textarea = document.createElement('textarea');
  textarea.className = 'bz-lib-edit-textarea';
  textarea.value = opts.initial;
  content.appendChild(textarea);

  const btnGroup = document.createElement('div');
  btnGroup.className = 'bz-lib-edit-btns';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'bz-lib-btn bz-lib-btn--ghost';
  cancelBtn.textContent = '取消';
  cancelBtn.addEventListener('click', () => overlay.remove());

  const saveBtn = document.createElement('button');
  saveBtn.className = 'bz-lib-btn bz-lib-btn--primary';
  saveBtn.textContent = '保存';
  saveBtn.addEventListener('click', () => {
    void opts.onSave(textarea.value).then((ok) => {
      if (ok) overlay.remove();
    });
  });

  btnGroup.appendChild(cancelBtn);
  btnGroup.appendChild(saveBtn);
  content.appendChild(btnGroup);

  modal.appendChild(header);
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  escManager.register('lib', { isVisible: () => overlay.isConnected, close: () => overlay.remove() });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  setTimeout(() => textarea.focus(), 50);
}

/** 编辑批注弹窗（md 高亮：updateComment 成功后回调关闭）。 */
export function openEditCommentModal(
  app: any,
  filePath: string,
  highlightId: string,
  text: string,
  oldComment: string,
  onDone?: () => void
) {
  openNoteEditModal({
    title: '编辑批注',
    quote: text,
    initial: oldComment || '',
    onSave: (v: string) =>
      new Promise<boolean>((resolve) => {
        updateComment(app, filePath, highlightId, text, v, () => resolve(true));
      }).then((ok) => {
        if (ok && onDone) onDone();
        return ok;
      }),
  });
}

/** 编辑想法弹窗（EPUB：直改 weave-data.json）。 */
export function openEpubEditCommentModal(
  app: any,
  vaultPath: string,
  highlightId: string,
  note: EpubBookNote,
  onDone?: () => void
) {
  openNoteEditModal({
    title: '编辑想法',
    quote: note.text,
    initial: note.comment || '',
    onSave: async (v: string) => {
      const ok = await updateEpubNoteComment(app, vaultPath, highlightId, v);
      if (ok && onDone) onDone();
      return ok;
    },
  });
}

// ---------- 测试辅助/卸载导出 ----------
/** 卸载清理（l1）与测试复位共用：显式 remove 主窗等 bz-lib 浮层 DOM，再重置引用 */
export function _testResetLibrary() {
  const removeEl = (el: HTMLElement | null) => {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  };
  removeEl(libraryOverlay);
  removeEl(settingsOverlay);
  removeEl(bookNotesOverlay);
  removeEl(epubBookNotesOverlay);
  // 兜底：未持引用的 bz-lib 浮层（如编辑弹窗 11101）一并移除，保证卸载后 DOM 无残留
  document.querySelectorAll('.bz-lib-overlay').forEach((el) => el.remove());
  libraryOverlay = null;
  libraryListContainer = null;
  currentItems = [];
  sortState = { key: 'readingDate', order: 'desc' };
  categoryFilter = '全部';
  statusFilter = '全部';
  settingsOverlay = null;
  bookNotesOverlay = null;
  bookNotesLoadSeq = 0;
  epubBookNotesOverlay = null;
}
