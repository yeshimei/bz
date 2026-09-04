/**
 * 书架墙读书笔记窗口（迁移自旧 src/library/ui.ts 的读书笔记/EPUB 读书笔记弹窗，旧域退役）：
 *  - md 书：浏览划线/批注树（按笔记标题层级分组），双击跳原文（path#^id + 聚焦），
 *    长按内容编辑批注、长按日期删除划线（core/flow-dialog 确认，先关壳再确认、终态重开壳）；
 *  - EPUB 书：从 weave-data.json 渲染 划线+想法（按章节分组），双击 weave-cfi 深链跳原文，
 *    长按编辑想法/删除划线（直改 weave-data.json，ADR-0013 扩展记录竞态例外）。
 * 基线（铁律 6）：弹窗壳走组件库 uiModal，按钮/输入走 bz-btn/bz-input，空态走 uiEmpty；
 * 域内只留笔记列表排版（bz-bs-notes-*）。
 * 写盘保持旧域收口语义：md 走 vault.process 原子读改写（src/bookshelf/notes.ts）。
 */
import type { App, TFile } from 'obsidian';
import { notice } from '../core/notice';
import { longPress } from '../core/dom';
import { openFlowDialog } from '../core/flow-dialog';
import { escManager } from '../core/esc-manager';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { uiModal, uiEmpty } from '../core/ui';
import { parseBookNotes, jumpToHighlight, updateComment, deleteHighlight } from './notes';
import type { BookNoteNode } from './notes';
import {
  loadEpubBookNotes, buildEpubJumpLink, updateEpubNoteComment, deleteEpubNote, findWeaveBookByPath,
} from './epub-notes';
import type { EpubBookNote } from './epub-notes';

// ---------- md 书：读书笔记树渲染 ----------

/** 读书笔记树递归渲染：无高亮的非一级节点跳过 */
function renderBookNoteNode(node: BookNoteNode, container: HTMLElement, app: App, filePath: string): void {
  if (node.level !== 0 && !node.hasHighlight) {
    return;
  }

  if (node.level === 0) {
    for (const child of node.children) {
      renderBookNoteNode(child, container, app, filePath);
    }
    return;
  }

  const cleanHeading = (node.heading || '').replace(/\s*\[\^[0-9]+\]\s*/g, '').trim();

  const headingEl = document.createElement('div');
  headingEl.textContent = cleanHeading;
  headingEl.className = 'bz-bs-note-heading';
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
function renderHighlightBlock(hl: any, app: App, filePath: string): HTMLElement {
  const block = document.createElement('div');
  block.className = 'bz-bs-hl';

  // ---- 内容区域（原文 + 批注）----
  const contentArea = document.createElement('div');
  contentArea.className = 'bz-bs-hl-body';

  const quote = document.createElement('div');
  quote.className = 'bz-bs-quote';
  quote.textContent = `❝ ${hl.text}`;
  contentArea.appendChild(quote);

  if (hl.comment) {
    const commentEl = document.createElement('div');
    commentEl.className = 'bz-bs-comment';
    commentEl.textContent = hl.comment;
    contentArea.appendChild(commentEl);
  }

  // ---- 日期区域 ----
  const dateEl = document.createElement('div');
  dateEl.className = hl.date ? 'bz-bs-hl-date bz-bs-hl-date--pointer' : 'bz-bs-hl-date';
  dateEl.textContent = hl.date || '无日期';

  block.appendChild(contentArea);
  block.appendChild(dateEl);

  // 1. 双击整个块 => 跳转
  block.addEventListener('dblclick', () => {
    jumpToHighlight(app, filePath, hl.id);
    // audit H：捕获当次弹窗关闭句柄——200ms 内重开的弹窗不被旧定时器误关
    const openedClose = mdNotesClose;
    setTimeout(() => {
      if (mdNotesClose && mdNotesClose === openedClose) mdNotesClose();
    }, 200);
  });

  // 2. 长按内容区域 => 编辑批注
  longPress(contentArea, () => {
    openEditCommentModal(app, filePath, hl.id, hl.text, hl.comment || '', () => {
      showBookNotes(app, filePath);
    });
  });

  // 3. 长按日期区域 => 删除高亮（统一 core/flow-dialog：先关壳再确认，取消/确认后均重开）
  if (hl.date) {
    longPress(dateEl, () => {
      closeMdNotesModal();
      void openFlowDialog({
        title: '删除划线',
        message: '确定要删除该划线及其批注吗？此操作不可撤销。',
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

// ============ md 读书笔记模态 ============

/** md 读书笔记弹窗关闭句柄（audit H：句柄化，dblclick 跳转后的延迟关壳按引用命中） */
let mdNotesClose: (() => void) | null = null;
/** 在途打开序号：vault.read 异步窗口内连开两本时，旧请求过期作废，只留最后一次（P2 双弹窗竞态） */
let bookNotesLoadSeq = 0;

/** md 书读书笔记窗口（划线/批注树；filePath 为书笔记路径，title 兜底取 basename） */
export function showBookNotes(app: App, filePath: string, title?: string) {
  if (mdNotesClose) closeMdNotesModal();

  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file) {
    notice('文件不存在');
    return;
  }
  const bookTitle = title || (file as TFile).basename;

  const seq = ++bookNotesLoadSeq;
  // 先建窗放占位，vault.read 完成后填充（大文件不白屏；l4）
  const { popup, close } = openNotesShell(`《${bookTitle}》的读书笔记`);
  mdNotesClose = close;
  const contentContainer = popup.querySelector('.bz-bs-notes-body') as HTMLElement;
  contentContainer.innerHTML = '<p class="bz-bs-notes-empty">正在加载…</p>';

  void app.vault
    .read(file as TFile)
    .then((content: string) => {
      if (seq !== bookNotesLoadSeq) return; // 过期在途请求：已被更新一次的打开取代
      const parsed = parseBookNotes(content, bookTitle);
      contentContainer.innerHTML = '';
      if (!parsed || parsed.root.children.length === 0) {
        contentContainer.appendChild(uiEmpty({ icon: 'highlighter', title: '没有找到高亮或批注', desc: '在原文中划线后这里会显示' }));
      } else {
        renderBookNoteNode(parsed.root, contentContainer, app, filePath);
      }
    })
    .catch((e) => {
      if (seq !== bookNotesLoadSeq) return;
      console.error(`读书笔记读取失败: ${filePath}`, e);
      contentContainer.innerHTML = '<p class="bz-bs-notes-empty">笔记读取失败，请稍后重试</p>';
    });
}

function closeMdNotesModal() {
  if (mdNotesClose) {
    const close = mdNotesClose;
    mdNotesClose = null;
    close();
  }
}

// ============ EPUB 读书笔记模态 ============

let epubNotesClose: (() => void) | null = null;

/** EPUB 书读书笔记窗口：划线+想法按章节分组；双击跳原文、长按编辑想法/删除。 */
export function showEpubBookNotes(app: App, vaultPath: string, title: string) {
  if (epubNotesClose) closeEpubNotesModal();

  const { popup, close } = openNotesShell(`《${title}》的读书笔记`);
  epubNotesClose = close;
  const contentContainer = popup.querySelector('.bz-bs-notes-body') as HTMLElement;
  contentContainer.innerHTML = '<p class="bz-bs-notes-empty">正在加载…</p>';

  void (async () => {
    const path = String(vaultPath || '').trim();
    const book = await findWeaveBookByPath(app, path);
    if (!book) {
      contentContainer.innerHTML = '';
      contentContainer.appendChild(uiEmpty({ icon: 'book', title: '未找到该书阅读数据', desc: '用 Weave 阅读器打开这本书后这里会显示' }));
      return;
    }
    // 传入已取到的 book，避免二次读取 weave-data.json
    const notes = await loadEpubBookNotes(app, path, book);
    if (notes.length === 0) {
      contentContainer.innerHTML = '';
      contentContainer.appendChild(uiEmpty({ icon: 'highlighter', title: '没有找到高亮或想法', desc: '在阅读器中划线后这里会显示' }));
      return;
    }
    renderEpubBookNoteTree(app, book, path, notes, contentContainer, () => {
      // 编辑/删除后重开（与 md showBookNotes 的 onDone 语义一致）
      showEpubBookNotes(app, path, title);
    });
  })();
}

function closeEpubNotesModal() {
  if (epubNotesClose) {
    const close = epubNotesClose;
    epubNotesClose = null;
    close();
  }
}

/** 关闭全部读书笔记弹窗（主面板 closeOverlay / 插件卸载共用，不留孤儿浮层） */
export function closeBookNoteModals(): void {
  closeMdNotesModal();
  closeEpubNotesModal();
  bookNotesLoadSeq = 0;
}

// ---------- 共用外壳与渲染 ----------

/** 读书笔记弹窗外壳（组件库 uiModal：头行标题+关闭；移动端默认全屏跟随书架墙键） */
function openNotesShell(title: string): { popup: HTMLElement; close: () => void } {
  const body = document.createElement('div');
  body.className = 'bz-bs-notes';
  const list = document.createElement('div');
  list.className = 'bz-bs-notes-body';
  body.appendChild(list);
  const fullscreen = (tryGetSettings() as Record<string, unknown>).bookshelfMobileDefaultFullscreen === true;
  const { popup, close } = uiModal({
    content: body,
    maxWidth: 700,
    head: true,
    title,
    className: 'bz-bs-notes-pop',
    onClose: () => {
      // 句柄自清（遮罩/ESC/✕ 任一路径关闭都不留悬空句柄）
      if (mdNotesClose === close) mdNotesClose = null;
      if (epubNotesClose === close) epubNotesClose = null;
    },
  });
  applyMobileWindowFullscreen(popup, fullscreen);
  return { popup, close };
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
  app: App,
  book: any,
  vaultPath: string,
  notes: EpubBookNote[],
  container: HTMLElement,
  onChanged: () => void
): void {
  const groups = groupEpubNotesByChapter(notes);
  groups.forEach((group, index) => {
    const headingEl = document.createElement('div');
    headingEl.className = 'bz-bs-note-heading';
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
  app: App,
  book: any,
  vaultPath: string,
  note: EpubBookNote,
  onChanged: () => void
): HTMLElement {
  const block = document.createElement('div');
  block.className = 'bz-bs-hl';

  const contentArea = document.createElement('div');
  contentArea.className = 'bz-bs-hl-body';

  const quote = document.createElement('div');
  quote.className = 'bz-bs-quote';
  quote.textContent = `❝ ${note.text}`;
  contentArea.appendChild(quote);

  if (note.comment) {
    const commentEl = document.createElement('div');
    commentEl.className = 'bz-bs-comment';
    commentEl.textContent = note.comment;
    contentArea.appendChild(commentEl);
  }

  const dateEl = document.createElement('div');
  dateEl.className = 'bz-bs-hl-date bz-bs-hl-date--pointer';
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
    closeEpubNotesModal();
  });

  // 长按内容 → 编辑想法
  longPress(contentArea, () => {
    openEpubEditCommentModal(app, vaultPath, highlightId, note, onChanged);
  });

  // 长按日期 → 删除高亮（统一 core/flow-dialog：先关壳，取消/确认后均重开）
  longPress(dateEl, () => {
    closeEpubNotesModal();
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
 * onSave 返回 Promise<boolean>（true 才关闭）。
 */
function openNoteEditModal(opts: {
  title: string;
  quote: string;
  initial: string;
  /** 返回 true 才关闭弹窗（md 编辑批注经 updateComment 结果 resolve；EPUB 编辑想法按写回结果）。 */
  onSave: (value: string) => Promise<boolean>;
}): void {
  const body = document.createElement('div');
  body.className = 'bz-bs-edit';

  const quoteDiv = document.createElement('div');
  quoteDiv.className = 'bz-bs-edit-quote';
  quoteDiv.textContent = `❝ ${opts.quote}`;
  body.appendChild(quoteDiv);

  const textarea = document.createElement('textarea');
  textarea.className = 'bz-input bz-bs-edit-textarea';
  textarea.value = opts.initial;
  body.appendChild(textarea);

  const btnGroup = document.createElement('div');
  btnGroup.className = 'bz-btn-row bz-bs-edit-btns';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'bz-btn bz-btn--ghost';
  cancelBtn.type = 'button';
  cancelBtn.textContent = '取消';
  cancelBtn.addEventListener('click', () => close());
  const { close } = uiModal({
    content: body,
    maxWidth: 420,
    head: true,
    title: opts.title,
    className: 'bz-bs-edit-pop',
  });

  const saveBtn = document.createElement('button');
  saveBtn.className = 'bz-btn bz-btn--primary';
  saveBtn.type = 'button';
  saveBtn.textContent = '保存';
  saveBtn.addEventListener('click', () => {
    // audit H：onSave 失败（reject）不再无响应悬挂弹窗——notice + 弹窗保留
    void opts.onSave(textarea.value)
      .then((ok) => {
        if (ok) close();
      })
      .catch((e) => {
        console.error('保存批注失败:', e);
        notice('保存失败，请重试', 'error');
      });
  });

  btnGroup.appendChild(cancelBtn);
  btnGroup.appendChild(saveBtn);
  body.appendChild(btnGroup);

  setTimeout(() => textarea.focus(), 50);
}

/** 编辑批注弹窗（md 高亮：updateComment 成功后回调关闭）。 */
export function openEditCommentModal(
  app: App,
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
    // audit H：updateComment 返回 Promise<boolean>（false=文件缺失/未命中/IO 失败），
    // 弹窗按结果开关，不再被「永不 resolve」的回调包装悬挂
    onSave: (v: string) =>
      updateComment(app, filePath, highlightId, text, v).then((ok) => {
        if (ok && onDone) onDone();
        return ok;
      }),
  });
}

/** 编辑想法弹窗（EPUB：直改 weave-data.json）。 */
export function openEpubEditCommentModal(
  app: App,
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

// ---------- 测试辅助/卸载 ----------

/** 卸载清理与测试复位共用：关闭全部读书笔记浮层并移除残留遮罩 */
export function _resetBookNotesUi(): void {
  closeBookNoteModals();
  // 兜底：句柄已失（极端路径）时按内容标识整体移除本域弹窗遮罩
  document.querySelectorAll('.bz-overlay-mask').forEach((mask) => {
    if (mask.querySelector('.bz-bs-notes, .bz-bs-edit')) mask.remove();
  });
}
