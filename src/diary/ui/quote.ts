/**
 * 写摘抄命令与命令注册（原脚本 3763-4120）。
 */
import { MarkdownView, Notice, moment } from 'obsidian';
import { escapeHtml, generateBlockId, sleep } from '../../core/utils';
import { getApp } from '../app';
import { parseNaturalTime } from '../parser';
import { addEntry } from '../store';
import { jumpToEntry } from './entries';
import { openAddDialog, saveNewEntry } from './dialogs';
import { syncDateTime } from './datetime-picker';

// ===== 命令注册（原 3763-3774） =====

let diaryCommandRegistered = false;

export async function registerOpenDialogCommand() {
  if (!diaryCommandRegistered) {
    (getApp() as any).commands.addCommand({
      id: 'bz-diary-open-add-dialog',
      name: '打开写日记弹窗',
      callback: () => {
        openAddDialog();
      },
    });
    diaryCommandRegistered = true;
  }
}

// ===== 摘抄数据获取（原 3792-3892） =====

interface QuoteData {
  wikiLink: string;
  selectedText: string;
  originalRawText: string;
  filePath: string;
  blockId: string;
  dateFromSpan: string | null;
  hasSpan: boolean;
  commentValue: string | null;
}

async function getSelectedTextAndBlockId(): Promise<QuoteData | null> {
  const activeView = getApp().workspace.getActiveViewOfType(MarkdownView);
  if (!activeView || !(activeView as any).editor) {
    new Notice('请先打开一个笔记文件');
    return null;
  }
  const editor = (activeView as any).editor;
  const file = activeView.file;
  if (!file) {
    new Notice('请先打开一个笔记文件');
    return null;
  }
  let rawSelectedText = '';
  let targetLine = -1;
  let dateFromSpan: string | null = null;
  let cleanSpanContent = '';

  if (editor.somethingSelected()) {
    rawSelectedText = editor.getSelection();
    const selection = editor.listSelections()[0];
    if (selection) targetLine = selection.anchor.line;
  } else {
    const cursor = editor.getCursor();
    targetLine = cursor.line;
    rawSelectedText = editor.getLine(targetLine).trim();
    if (!rawSelectedText) {
      new Notice('当前行没有文字内容');
      return null;
    }
  }

  if (!rawSelectedText) {
    new Notice('未获取到文字内容');
    return null;
  }

  const spanRegex = /<span[^>]*>([\s\S]*?)<\/span>/i;
  const match = rawSelectedText.match(spanRegex);

  let commentValue: string | null = null;

  if (match) {
    const spanContent = match[1];
    cleanSpanContent = spanContent.replace(/<[^>]*>/g, '').trim();

    // 尝试从span中提取data-date属性
    const dateMatch = rawSelectedText.match(/data-date\s*=\s*["']([^"']+)["']/i);
    if (dateMatch) {
      dateFromSpan = dateMatch[1];
    } else {
      // 没有data-date，尝试获取笔记属性readingDate
      const fileCache = getApp().metadataCache.getFileCache(file);
      if (fileCache && fileCache.frontmatter && fileCache.frontmatter.readingDate) {
        const readingDate = fileCache.frontmatter.readingDate;
        // 尝试解析readingDate
        const readingMoment = moment(readingDate);
        if (readingMoment.isValid()) {
          dateFromSpan = readingMoment.format('YYYY-MM-DD HH:mm:ss');
        } else {
          // 解析失败，使用当前日期
          dateFromSpan = moment().format('YYYY-MM-DD HH:mm:ss');
        }
      } else {
        // 没有readingDate，使用当前日期
        dateFromSpan = moment().format('YYYY-MM-DD HH:mm:ss');
      }
    }

    // 从原始文本中提取 data-comment 属性值
    const commentMatch = rawSelectedText.match(/data-comment\s*=\s*["']([^"']*)["']/i);
    commentValue = commentMatch ? commentMatch[1] : null;
  }

  // 清洗文本：去掉末尾的块ID（如 ^abc123）
  const cleanSelectedText = rawSelectedText.replace(/\s+\^[a-zA-Z0-9\-_]+$/, '');

  // 确保块ID存在（从行中提取或生成）
  const lineText = editor.getLine(targetLine);
  const blockIdMatch = lineText.match(/\^([a-zA-Z0-9\-_]+)$/);
  let blockId: string;
  if (blockIdMatch) {
    blockId = blockIdMatch[1];
  } else {
    blockId = generateBlockId();
    const newLine = lineText + ' ^' + blockId;
    editor.setLine(targetLine, newLine);
    await getApp().vault.modify(file, editor.getValue());
    await sleep(100);
  }

  // 生成双链，如果span中有内容，使用span的纯文本内容作为显示文本
  const displayText = cleanSpanContent || cleanSelectedText;
  const wikiLink = `[[${file.path.replace(/\.md$/, '')}#^${blockId}|${displayText}]]`;

  return {
    wikiLink,
    selectedText: displayText, // 用于预览
    originalRawText: rawSelectedText, // 原始文本
    filePath: file.path,
    blockId,
    dateFromSpan, // 从span中提取的日期
    hasSpan: !!match, // 标记是否有span
    commentValue,
  };
}

// ===== 弹窗覆盖（原 3895-3963） =====

function addPreviewToDialog(popup: HTMLElement, text: string, q: any) {
  if (q.previewElement) q.previewElement.remove();

  const previewElement = document.createElement('div');
  previewElement.style.cssText = `
      margin: 0 0 16px 0;
      padding: 0;
  `;

  // 创建 label
  const label = document.createElement('label');
  label.textContent = '摘抄内容';
  label.style.cssText = `
      display: block;
      margin-bottom: 6px;
      font-size: 14px;
      color: var(--text-muted);
      font-weight: 500;
  `;

  // 创建内容显示区
  const contentDiv = document.createElement('div');
  contentDiv.style.cssText = `
      padding: 12px;
      background: var(--background-secondary);
      border-radius: 8px;
      font-size: 14px;
      color: var(--text-normal);
      max-height: 150px;
      overflow-y: auto;
      ;white-space: pre-wrap
      word-break: break-word;
  `;
  contentDiv.innerHTML = escapeHtml(text);

  previewElement.appendChild(label);
  previewElement.appendChild(contentDiv);

  // 插入到日期选择器之前
  const dateTimeControl = popup.querySelector('.datetime-picker-container');
  if (dateTimeControl) {
    dateTimeControl.parentNode!.insertBefore(previewElement, dateTimeControl);
  } else {
    // 降级处理：插入到标题之后
    const title = popup.querySelector('.add-diary-title');
    if (title) title.insertAdjacentElement('afterend', previewElement);
    else popup.insertBefore(previewElement, popup.firstChild);
  }
  return previewElement;
}

function cleanupDialogOverrides(popup: HTMLElement | null, mask: HTMLElement | null, q: any) {
  if (q.previewElement) {
    q.previewElement.remove();
    q.previewElement = null;
  }
  if (q.originalSaveHandler && popup) {
    const saveBtn = Array.from(popup.querySelectorAll('button')).find((btn) => btn.textContent === '保存');
    if (saveBtn) (saveBtn as HTMLButtonElement).onclick = q.originalSaveHandler;
  }
  if (q.originalCancelHandler && popup) {
    const cancelBtn = Array.from(popup.querySelectorAll('button')).find((btn) => btn.textContent === '取消');
    if (cancelBtn) (cancelBtn as HTMLButtonElement).onclick = q.originalCancelHandler;
  }
  if (q.originalMaskHandler && mask) mask.onclick = q.originalMaskHandler;
  q.pendingQuoteData = null;
}

// ===== 自定义保存（原 3965-4026） =====

function createQuoteSaveHandler(popup: HTMLElement, mask: HTMLElement, quoteData: QuoteData, q: any) {
  return async function () {
    const datetimeInput = document.getElementById('add-diary-datetime') as HTMLInputElement | null;
    if (!datetimeInput) {
      new Notice('无法获取日期时间');
      return;
    }

    if (!quoteData.wikiLink || quoteData.wikiLink.trim() === '') {
      new Notice('摘抄内容为空，无法保存');
      return;
    }

    // 读取用户选择的多个标签
    const typeContainer = document.getElementById('add-diary-type-container')!;
    const selTagNames: string[] = [];
    typeContainer.querySelectorAll('.diary-tag-selector-btn.diary-active').forEach((btn) => {
      selTagNames.push((btn as HTMLElement).dataset.tag!);
    });
    if (selTagNames.length === 0) {
      new Notice('请至少选择一个标签');
      return;
    }

    // 日期时间处理
    const userInput = datetimeInput.value.trim();
    let targetMoment = parseNaturalTime(userInput);
    if (!targetMoment || !targetMoment.isValid()) {
      targetMoment = moment(userInput, 'YYYY-MM-DD HH:mm', true);
      if (!targetMoment.isValid()) {
        new Notice('日期时间格式不正确');
        return;
      }
    }

    const dateStr = targetMoment.format('YYYY-MM-DD');
    const timeStr = targetMoment.format('HH:mm');

    try {
      // 构建最终内容
      let finalContent = quoteData.wikiLink;
      if (quoteData.commentValue) {
        finalContent += quoteData.commentValue;
      }
      if (quoteData.filePath && quoteData.filePath.startsWith('书库/')) {
        const fileName = quoteData.filePath.split('/').pop()!.replace(/\.md$/, '');
        finalContent += `\n\n#《${fileName}》`;
      }

      const newEntry = await addEntry(dateStr, timeStr, selTagNames, finalContent);
      if (!newEntry) throw new Error('addEntry 返回空');
      new Notice('摘抄已保存');
      mask.style.display = 'none';
      popup.style.display = 'none';
      cleanupDialogOverrides(popup, mask, q);
      await jumpToEntry(newEntry, 'edit');
    } catch (error: any) {
      console.error('保存摘抄失败:', error);
      new Notice('保存摘抄失败: ' + error.message);
    }
  };
}

// ===== 注册写摘抄命令（原 4029-4120） =====

export async function registerQuoteCommand() {
  const q: any = {
    pendingQuoteData: null,
    originalSaveHandler: null,
    originalCancelHandler: null,
    originalMaskHandler: null,
    previewElement: null,
  };

  (getApp() as any).commands.addCommand({
    id: 'bz-diary-create-quote',
    name: '写摘抄',
    callback: async () => {
      console.log('📝 写摘抄命令被触发');
      const quoteData = await getSelectedTextAndBlockId();
      if (!quoteData) return;

      q.pendingQuoteData = quoteData;
      if (!document.getElementById('add-diary-mask')) {
        new Notice('日记弹窗未初始化，请先打开日记本');
        return;
      }

      openAddDialog();
      await sleep(150);

      const mask = document.getElementById('add-diary-mask');
      const popup = document.getElementById('add-diary-popup');
      if (!mask || !popup) {
        new Notice('无法打开日记弹窗');
        q.pendingQuoteData = null;
        return;
      }

      // 添加预览
      q.previewElement = addPreviewToDialog(
        popup,
        quoteData.selectedText + (quoteData.commentValue ? `（${quoteData.commentValue}）` : ''),
        q
      );

      // 设置标签：默认只选中"摘抄"，用户可自行多选
      const typeContainer = document.getElementById('add-diary-type-container');
      if (typeContainer) {
        typeContainer.querySelectorAll('.diary-tag-selector-btn').forEach((btn) => {
          btn.classList.remove('diary-active');
        });
        const quoteBtn = typeContainer.querySelector('[data-tag="摘抄"]');
        if (quoteBtn) quoteBtn.classList.add('diary-active');
      }

      // 设置初始日期时间
      const datetimeInput = document.getElementById('add-diary-datetime') as HTMLInputElement | null;
      if (datetimeInput) {
        // 设置默认值：优先使用当前时间
        datetimeInput.value = moment().format('YYYY-MM-DD HH:mm');

        // 如果span中有日期，将其作为初始值显示（用户可以修改）
        if (quoteData.dateFromSpan) {
          const dateMatch = quoteData.dateFromSpan.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):\d{2}$/);
          if (dateMatch) {
            datetimeInput.value = `${dateMatch[1]} ${dateMatch[2]}`;
          } else {
            const m = moment(quoteData.dateFromSpan, ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm'], true);
            if (m.isValid()) {
              datetimeInput.value = m.format('YYYY-MM-DD HH:mm');
            }
          }
        }

        syncDateTime();
      }

      // 通过文本内容查找保存按钮
      const allBtns = Array.from(popup.querySelectorAll('button'));
      const originalSaveBtn = allBtns.find((btn) => btn.textContent === '保存');
      if (originalSaveBtn) {
        q.originalSaveHandler = (originalSaveBtn as HTMLButtonElement).onclick;
        const newSaveBtn = originalSaveBtn.cloneNode(true) as HTMLButtonElement;
        newSaveBtn.onclick = null;
        originalSaveBtn.parentNode!.replaceChild(newSaveBtn, originalSaveBtn);
        newSaveBtn.onclick = createQuoteSaveHandler(popup, mask, quoteData, q);
        console.log('✅ 保存按钮已替换');
      } else {
        console.warn("❌ 未找到文本为'保存'的按钮");
      }

      // 遮罩处理
      q.originalMaskHandler = mask.onclick;
      mask.onclick = (e) => {
        if (e.target === mask) cleanupDialogOverrides(popup, mask, q);
        if (q.originalMaskHandler) q.originalMaskHandler.call(mask, e);
      };
    },
  });
}
