/**
 * 书库 ui（ticket 12）：主面板/筛选设置/读书笔记弹窗/批注编辑，源码逐字移植。
 * 源码：书库.js L210-1007、L1118-1217
 */
import { Setting } from 'obsidian';
import { notice, createIconBtn } from '../core/dom';
import { escManager } from '../core/esc-manager';
import { checkAndShowChangelog } from '../core/changelog';
import { getSettings, saveSettings } from '../core/settings-provider';
import { openSettingsModal } from '../core/settings-modal';
import type BzSettings from '../settings';
import { getBookItems, sortItemList, formatFileSize, getStatusColors, deriveBookSettings, getSubfolder } from './items';
import type { BookItem } from './items';
import { parseBookNotes, jumpToHighlight, updateComment, deleteHighlight } from './notes';
import type { ParsedBookNotes, BookNoteNode, BookHighlight } from './notes';

// ---------- 模块级状态（源码 L212-218） ----------
let libraryOverlay: HTMLElement | null = null;
let libraryModal: HTMLElement | null = null;
let libraryListContainer: HTMLElement | null = null;
let currentItems: BookItem[] = [];
let sortState = { key: 'readingDate', order: 'desc' };
let categoryFilter = '全部';
let statusFilter = '全部';

export function showLibrary(app: any) {
  checkAndShowChangelog('library');

  if (libraryOverlay) {
    libraryOverlay.style.visibility = 'visible';
    return;
  }

  currentItems = getBookItems(app);
  if (currentItems.length === 0) {
    const settings = deriveBookSettings();
    notice(`未找到任何书籍笔记（路径：${settings.folderPath}，需包含 tags: book）`);
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = '__book_library__';
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
    modal.style.paddingTop = '34px';
  }

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex; justify-content: space-between; align-items: center;
    padding: 0 26px;
  `;
  header.innerHTML = '<p style="font-size:.8rem;">书库</p>';

  const headerButtons = document.createElement('div');
  headerButtons.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  const reportBtn = createIconBtn('🧮', '打开阅读数据分析报告', () => {
    (app as any).commands.executeCommandById('bz-show-reading-report');
  });
  // 筛选弹窗（ADR-0009：视图与筛选挂 🔀，⚙️ 只留给真设置）
  const filterBtn = createIconBtn('🔀', '视图与筛选', () => {
    openFilterModal(app);
  });
  // 书库设置弹窗（ADR-0009 域设置弹窗：文件夹/识别标签/显示开关）
  const settingsBtn = createIconBtn('⚙️', '书库设置', () => {
    openSettingsModal({
      title: '书库设置',
      build: (el) => {
        const s = getSettings();
        const textSetting = (name: string, desc: string, field: keyof BzSettings) =>
          new Setting(el)
            .setName(name)
            .setDesc(desc)
            .addText((text) =>
              text.setValue(String((s as any)[field] || '')).onChange(async (v) => {
                (s as any)[field] = v;
                await saveSettings();
              })
            );
        const toggleSetting = (name: string, desc: string, field: keyof BzSettings) =>
          new Setting(el)
            .setName(name)
            .setDesc(desc)
            .addToggle((toggle) =>
              toggle.setValue(!!(s as any)[field]).onChange(async (v) => {
                (s as any)[field] = v;
                await saveSettings();
              })
            );
        textSetting('书库文件夹', '存放书籍笔记的根目录', 'libraryFolderPath');
        textSetting('读书笔记路径', '长按书籍时打开的读书笔记所在目录', 'libraryNotePath');
        textSetting('书籍识别标签', 'Frontmatter 中用于识别书籍笔记的标签名', 'bookTag');
        toggleSetting('显示文件大小', '', 'showFileSize');
        toggleSetting('显示阅读时长', '', 'showReadingTime');
        toggleSetting('显示划线数', '', 'showHighlights');
        toggleSetting('显示想法数', '', 'showThinks');
        toggleSetting('显示书评摘要', '', 'showReview');
      },
    });
  });

  const closeBtn = createIconBtn('❌', '关闭', () => (overlay.style.visibility = 'hidden'));

  headerButtons.appendChild(reportBtn);
  headerButtons.appendChild(settingsBtn);
  headerButtons.appendChild(filterBtn);
  headerButtons.appendChild(closeBtn);
  header.appendChild(headerButtons);

  const listContainer = document.createElement('div');
  listContainer.style.cssText = 'flex: 1; overflow-y: auto; padding: 8px 16px;';
  libraryListContainer = listContainer;

  modal.appendChild(header);
  modal.appendChild(listContainer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  escManager.register('lib', { isVisible: () => overlay.isConnected, close: () => (overlay.style.visibility = 'hidden') });

  libraryOverlay = overlay;
  libraryModal = modal;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.style.visibility = 'hidden';
  });
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.style.visibility = 'hidden';
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  renderLibraryList(app);
}
export function renderLibraryList(app: any) {
  const settings = deriveBookSettings();
  const colors = getStatusColors();

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
    container.innerHTML =
      '<p style="text-align:center; color:var(--text-muted);">📭 没有找到符合条件的书籍</p>';
    return;
  }

  filtered.forEach((item) => {
    const card = document.createElement('div');
    card.style.cssText = `
      display: flex; align-items: flex-start; padding: 12px;
      border-radius: 10px; margin-bottom: 10px;
      background: var(--background-secondary);
      transition: background 0.2s;
    `;

    // ---- 封面区域（单击打开读书笔记） ----
    const coverWrapper = document.createElement('div');
    coverWrapper.style.cssText = `
      cursor: pointer;
      flex-shrink: 0;
      margin-right: 14px;
    `;
    coverWrapper.title = '单击打开读书笔记';

    if (item.cover) {
      const coverFile = app.vault.getAbstractFileByPath(item.cover);
      if (coverFile && /\.(png|jpe?g|gif|webp)$/i.test(coverFile.name)) {
        const img = document.createElement('img');
        img.src = app.vault.getResourcePath(coverFile);
        img.style.cssText = `
          width: 56px; height: 80px; object-fit: cover;
          border-radius: 6px;
          background: var(--background-modifier-border);
          display: block;
        `;
        coverWrapper.appendChild(img);
      } else {
        const noCover = document.createElement('div');
        noCover.textContent = '📖';
        noCover.style.cssText = `
          width: 56px; height: 80px; background: var(--background-modifier-border);
          border-radius: 6px; display: flex;
          align-items: center; justify-content: center; font-size: 1.8rem;
          color: var(--text-muted);
        `;
        coverWrapper.appendChild(noCover);
      }
    } else {
      const noCover = document.createElement('div');
      noCover.textContent = '📖';
      noCover.style.cssText = `
        width: 56px; height: 80px; background: var(--background-modifier-border);
        border-radius: 6px; display: flex;
        align-items: center; justify-content: center; font-size: 1.8rem;
        color: var(--text-muted);
      `;
      coverWrapper.appendChild(noCover);
    }

    coverWrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      showBookNotes(app, item.file.path);
    });

    card.appendChild(coverWrapper);

    // ---- 信息区域 ----
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'flex: 1; min-width: 0;';

    // 标题行（标题单击打开原笔记）
    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px;';
    const titleEl = document.createElement('div');
    titleEl.textContent = item.title;
    titleEl.style.cssText = `
      font-weight: 700; font-size: 1rem;
      cursor: pointer;
    `;
    titleEl.title = '单击打开原笔记';
    titleEl.addEventListener('click', (e) => {
      e.stopPropagation();
      app.workspace.openLinkText(item.file.path, '', false);
      libraryOverlay!.style.visibility = 'hidden';
    });

    const statusBadge = document.createElement('span');
    statusBadge.textContent = item.status;
    statusBadge.style.cssText = `
      font-size: 0.65rem; background: ${(colors.badgeBg as any)[item.status]}; color: white;
      padding: 2px 8px; border-radius: 20px; white-space: nowrap;
    `;
    titleRow.appendChild(titleEl);
    if (item.status !== '已读') titleRow.appendChild(statusBadge);
    infoDiv.appendChild(titleRow);

    // 元数据行（仅显示作者，删除了分类/子文件夹显示）
    const metaRow = document.createElement('div');
    metaRow.style.cssText =
      'display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0; font-size: 0.75rem; color: var(--text-muted);';
    if (item.author) {
      const authorSpan = document.createElement('span');
      authorSpan.textContent = `✍️ ${item.author}`;
      metaRow.appendChild(authorSpan);
    }
    // 分类显示已移除
    infoDiv.appendChild(metaRow);

    // 进度行
    const progressRow = document.createElement('div');
    progressRow.style.cssText =
      'margin: 6px 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;';

    if (item.readingProgress !== undefined && item.readingProgress > 0) {
      const progressText = document.createElement('span');
      progressText.textContent = `📊 ${item.readingProgress}%`;
      progressText.style.cssText = 'font-size: 0.7rem; padding: 2px 6px; border-radius: 12px;';
      progressRow.appendChild(progressText);
    }

    if (settings.showReadingTime !== false && item.readingTimeFormat) {
      const timeSpan = document.createElement('span');
      timeSpan.textContent = `⏱️ ${item.readingTimeFormat}`;
      timeSpan.style.cssText = 'font-size: 0.7rem;';
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
        noteSpan.textContent = parts.join(' · ');
        noteSpan.style.cssText = 'font-size: 0.7rem;';
        progressRow.appendChild(noteSpan);
      }
    }

    if (settings.showFileSize !== false) {
      const formattedSize = formatFileSize(item.sizeBytes);
      if (formattedSize) {
        const sizeSpan = document.createElement('span');
        sizeSpan.textContent = `📦 ${formattedSize}`;
        sizeSpan.style.cssText = 'font-size: 0.7rem;';
        progressRow.appendChild(sizeSpan);
      }
    }

    infoDiv.appendChild(progressRow);

    // 书评
    if (settings.showReview !== false && item.bookReview) {
      const reviewDiv = document.createElement('div');
      reviewDiv.style.cssText = `
        margin-top: 6px; font-size: 0.7rem; color: var(--text-muted);
        padding: 6px 8px; border-radius: 8px; line-height: 1.3;
      `;
      reviewDiv.textContent = item.bookReview;
      infoDiv.appendChild(reviewDiv);
    }

    card.appendChild(infoDiv);
    container.appendChild(card);
  });
}

// ============ 设置面板 ============

let settingsOverlay: HTMLElement | null = null;

export function openFilterModal(app: any) {
  if (settingsOverlay) {
    closeFilterModal();
    return;
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.3); z-index: 1100;
    display: flex; align-items: center; justify-content: center;
  `;
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: var(--background-primary); color: var(--text-normal);
    border-radius: 12px; width: 90%; max-width: 500px;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    border: 1px solid var(--background-modifier-border);
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 16px; border-bottom: 1px solid var(--background-modifier-border);
  `;
  header.innerHTML = '<h3 style="margin:0;">视图与筛选</h3>';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText =
    'background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);';
  closeBtn.addEventListener('click', closeFilterModal);
  header.appendChild(closeBtn);

  const content = document.createElement('div');
  content.style.cssText = 'padding: 16px; max-height: 70vh; overflow-y: auto;';

  function renderSettings() {
    content.innerHTML = '';

    const categorySection = document.createElement('div');
    categorySection.style.cssText = 'margin-bottom: 20px;';
    const categoryGroup = document.createElement('div');
    categoryGroup.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
    const categories = ['全部', ...getAllCategories()];
    categories.forEach((cat) => {
      const btn = document.createElement('button');
      btn.textContent = cat;
      btn.style.cssText = `
        padding: 5px 12px; border-radius: 20px; box-shadow: none;
        background: var(--background-secondary); color: var(--text-normal); cursor: pointer; font-size: 0.8rem;
      `;
      if (categoryFilter === cat) {
        btn.style.background = 'var(--interactive-accent)';
        btn.style.color = 'white';
      }
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
    statusSection.style.cssText = 'margin-bottom: 20px;';
    const statusGroup = document.createElement('div');
    statusGroup.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
    const statuses = ['全部', '未读', '在读', '已读'];
    statuses.forEach((st) => {
      const btn = document.createElement('button');
      btn.textContent = st;
      btn.style.cssText = `
        padding: 5px 12px; border-radius: 20px; box-shadow: none;
        background: var(--background-secondary); color: var(--text-normal); cursor: pointer; font-size: 0.8rem;
      `;
      if (statusFilter === st) {
        btn.style.background = 'var(--interactive-accent)';
        btn.style.color = 'white';
      }
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
    sortSection.style.cssText = 'margin-bottom: 8px;';
    const sortGroup = document.createElement('div');
    sortGroup.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
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
      btn.textContent = opt.label;
      btn.style.cssText = `
        padding: 5px 10px; border-radius: 16px; box-shadow: none;
        background: var(--background-secondary); color: var(--text-normal); cursor: pointer; font-size: 0.75rem;
      `;
      if (sortState.key === opt.key && sortState.order === opt.order) {
        btn.style.background = 'var(--interactive-accent)';
        btn.style.color = 'white';
      }
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

// ============ 读书笔记模态 ============

let bookNotesOverlay: HTMLElement | null = null;

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

  app.vault.read(file).then((content: string) => {
    const parsed = parseBookNotes(content, file.basename);

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); z-index: 1200;
      display: flex; align-items: center; justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: var(--background-primary); color: var(--text-normal);
      border-radius: 12px; width: 100%; max-width: 700px; height: 85vh;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    `;
    if (window.innerWidth <= 768) {
      modal.style.height = '100vh';
      modal.style.borderRadius = '0';
      modal.style.maxWidth = '100%';
      modal.style.paddingTop = '34px';
    }

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 20px; border-bottom: 1px solid var(--background-modifier-border);
    `;
    const titleSpan = document.createElement('span');
    titleSpan.textContent = `📚 《${parsed.bookTitle}》的读书笔记`;
    titleSpan.style.cssText = 'font-size: 1.1rem; font-weight: 600;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '❌';
    closeBtn.style.cssText = `
      background: none; border: none; font-size: 0.8rem;
      cursor: pointer; color: var(--text-muted);
      box-shadow: none; padding: 0;
    `;
    closeBtn.addEventListener('click', () => {
      overlay.remove();
      bookNotesOverlay = null;
    });
    header.appendChild(titleSpan);
    header.appendChild(closeBtn);

    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = 'flex: 1; overflow-y: auto; padding: 16px 20px;';

    // ---- 递归渲染函数 ----
    function renderNode(node: BookNoteNode, container: HTMLElement) {
      if (node.level !== 0 && !node.hasHighlight) {
        return;
      }

      if (node.level === 0) {
        for (const child of node.children) {
          renderNode(child, container);
        }
        return;
      }

      const cleanHeading = node.heading!.replace(/\s*\[\^[0-9]+\]\s*/g, '').trim();

      const headingEl = document.createElement('div');
      headingEl.textContent = cleanHeading;
      const fontSize = Math.max(0.9, 1.2 - node.level * 0.1) + 'rem';
      const fontWeight = node.level === 1 ? 'bold' : '600';
      const margin = node.level === 1 ? '16px 0 8px 0' : '12px 0 6px 0';
      headingEl.style.cssText = `
        font-size: ${fontSize};
        font-weight: ${fontWeight};
        margin: ${margin};
        color: var(--heading-color, var(--text-accent));
        user-select: none;
      `;
      container.appendChild(headingEl);

      for (const hl of node.highlights) {
        const block = document.createElement('div');
        block.style.cssText = 'margin-bottom: 12px; padding: 0 0 25px 0; border-bottom: 1px solid var(--background-modifier-border);';

        // ---- 内容区域（原文 + 批注）----
        const contentArea = document.createElement('div');
        contentArea.style.cssText = 'user-select: none;';

        const quote = document.createElement('div');
        quote.style.cssText = `
          font-style: italic; color: var(--text-muted); font-size: 0.75em;
          padding: 15px 0px 5px 0px; margin-bottom: 2px;
        `;
        quote.textContent = `❝ ${hl.text}`;
        contentArea.appendChild(quote);

        if (hl.comment) {
          const commentEl = document.createElement('div');
          commentEl.style.cssText = `
            margin-left: 12px; font-size: 0.75em;
            color: var(--text-normal); padding: 5px 0px;
          `;
          commentEl.textContent = hl.comment;
          contentArea.appendChild(commentEl);
        }

        // ---- 日期区域 ----
        const dateEl = document.createElement('div');
        if (hl.date) {
          dateEl.textContent = hl.date;
          dateEl.style.cssText = `
            text-align: right; font-size: 0.65em;
            color: var(--text-faint); margin-top: 2px;
            user-select: none;
            cursor: pointer;
          `;
        } else {
          dateEl.textContent = '无日期';
          dateEl.style.cssText = `
            text-align: right; font-size: 0.65em;
            color: var(--text-faint); margin-top: 2px;
            user-select: none;
            cursor: default;
          `;
        }

        // 将内容区域和日期添加到块
        block.appendChild(contentArea);
        block.appendChild(dateEl);

        // ---------- 交互事件 ----------
        let contentLongPressTimer: ReturnType<typeof setTimeout> | null = null;
        let dateLongPressTimer: ReturnType<typeof setTimeout> | null = null;

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
        contentArea.addEventListener('pointerdown', (e) => {
          e.stopPropagation(); // 防止冒泡到 block
          contentLongPressTimer = setTimeout(() => {
            contentLongPressTimer = null;
            openEditCommentModal(app, filePath, hl.id, hl.text, hl.comment || '', () => {
              showBookNotes(app, filePath);
            });
          }, 500);
        });
        contentArea.addEventListener('pointerup', () => {
          if (contentLongPressTimer) {
            clearTimeout(contentLongPressTimer);
            contentLongPressTimer = null;
          }
        });
        contentArea.addEventListener('pointerleave', () => {
          if (contentLongPressTimer) {
            clearTimeout(contentLongPressTimer);
            contentLongPressTimer = null;
          }
        });

        // 3. 长按日期区域 => 删除高亮
        if (hl.date) {
          dateEl.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            dateLongPressTimer = setTimeout(() => {
              dateLongPressTimer = null;
              deleteHighlight(app, filePath, hl.id, hl.text, () => {
                showBookNotes(app, filePath);
              });
            }, 500);
          });
          dateEl.addEventListener('pointerup', () => {
            if (dateLongPressTimer) {
              clearTimeout(dateLongPressTimer);
              dateLongPressTimer = null;
            }
          });
          dateEl.addEventListener('pointerleave', () => {
            if (dateLongPressTimer) {
              clearTimeout(dateLongPressTimer);
              dateLongPressTimer = null;
            }
          });
        }

        container.appendChild(block);
      }

      for (const child of node.children) {
        renderNode(child, container);
      }
    }

    if (!parsed.root || parsed.root.children.length === 0) {
      contentContainer.innerHTML = '<p style="color:var(--text-muted);">📭 没有找到高亮或批注</p>';
    } else {
      renderNode(parsed.root, contentContainer);
    }

    modal.appendChild(header);
    modal.appendChild(contentContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    escManager.register('lib', { isVisible: () => overlay.isConnected, close: () => { overlay.remove(); bookNotesOverlay = null; } });
    bookNotesOverlay = overlay;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        bookNotesOverlay = null;
      }
    });
  });
}

// ---------- 编辑批注弹窗 ----------
export function openEditCommentModal(
  app: any,
  filePath: string,
  highlightId: string,
  text: string,
  oldComment: string,
  onDone?: () => void
) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); z-index: 1300;
    display: flex; align-items: center; justify-content: center;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: var(--background-primary); color: var(--text-normal);
    border-radius: 12px; width: 90%; max-width: 500px;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    border: 1px solid var(--background-modifier-border);
    max-height: 80vh;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 16px; border-bottom: 1px solid var(--background-modifier-border);
  `;
  header.innerHTML = '<h3 style="margin:0;">编辑批注</h3>';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText =
    'background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);';
  closeBtn.addEventListener('click', () => overlay.remove());
  header.appendChild(closeBtn);

  const content = document.createElement('div');
  content.style.cssText = 'padding: 16px; overflow-y: auto;';

  const quoteDiv = document.createElement('div');
  quoteDiv.style.cssText = `
    font-style: italic; color: var(--text-muted); font-size: 0.85em;
    padding: 8px 0; border-radius: 4px;
    margin-bottom: 16px;
    user-select: text;
  `;
  quoteDiv.textContent = `❝ ${text}`;
  content.appendChild(quoteDiv);

  const textarea = document.createElement('textarea');
  textarea.value = oldComment || '';
  textarea.style.cssText = `
    width: 100%; min-height: 100px; padding: 8px;
    font-size: 0.9rem; border-radius: 4px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    resize: vertical;
    box-sizing: border-box;
  `;
  content.appendChild(textarea);

  const btnGroup = document.createElement('div');
  btnGroup.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.style.cssText = `
    padding: 6px 16px; border-radius: 4px;
    background: var(--background-secondary); color: var(--text-normal);
    border: none; cursor: pointer;
  `;
  cancelBtn.addEventListener('click', () => overlay.remove());

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '保存';
  saveBtn.style.cssText = `
    padding: 6px 16px; border-radius: 4px;
    background: var(--interactive-accent); color: white;
    border: none; cursor: pointer;
  `;
  saveBtn.addEventListener('click', () => {
    const newComment = textarea.value;
    updateComment(app, filePath, highlightId, text, newComment, () => {
      overlay.remove();
      if (onDone) onDone();
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

// ---------- 测试辅助/导出 ----------
export function _testResetLibrary() {
  libraryOverlay = null;
  libraryModal = null;
  libraryListContainer = null;
  currentItems = [];
  sortState = { key: 'readingDate', order: 'desc' };
  categoryFilter = '全部';
  statusFilter = '全部';
  settingsOverlay = null;
  bookNotesOverlay = null;
}

export { getSubfolder };
