/**
 * 内容监控（移植自 SmartCat.js ContentMonitor + InteractionManager 的笔记读取辅助）
 * getApp 经 core/app；无需 window。recentMonologues 原版无写入方（恒空）——保留接口。
 */
import { getApp } from '../core/app';
import { eventSystem } from './state';
import { EVENTS } from './types';

export interface BookDescriptionOptions {
  title?: string;
  author?: string;
  translator?: string;
  publisher?: string;
  publicationYear?: string | number;
  category?: string;
  readingProgress?: string | number;
  readingTimeFormat?: string;
  highlights?: string | number;
  thinks?: string | number;
  ISBN?: string;
}

/** 书籍一句话描述（原 generateBookDescription 逐字字段） */
export function generateBookDescription(): string | null {
  try {
    const app = getApp();
    const activeLeaf = (app.workspace as any).getMostRecentLeaf();
    if (!activeLeaf || !activeLeaf.view) return null;
    const view = activeLeaf.view;
    let frontmatter: BookDescriptionOptions = {};
    if (view.file) {
      const fileCache = (app.metadataCache as any).getFileCache(view.file);
      if (fileCache && fileCache.frontmatter) frontmatter = fileCache.frontmatter;
    }
    const parts: string[] = [];
    if (frontmatter.title) parts.push(`书名：《${frontmatter.title}》`);
    if (frontmatter.author) parts.push(`作者：${frontmatter.author}`);
    if (frontmatter.translator) parts.push(`译者：${frontmatter.translator}`);
    if (frontmatter.publisher) parts.push(`出版社：${frontmatter.publisher}`);
    if (frontmatter.publicationYear) {
      let year: string | number = frontmatter.publicationYear;
      if (typeof year === 'string') {
        const m = year.match(/\d{4}/);
        if (m) year = m[0];
      }
      parts.push(`出版年份：${year}`);
    }
    if (frontmatter.category) parts.push(`分类：${frontmatter.category}`);
    if (frontmatter.readingProgress !== undefined) parts.push(`阅读进度：${frontmatter.readingProgress}%`);
    if (frontmatter.readingTimeFormat) parts.push(`阅读时长：${frontmatter.readingTimeFormat}`);
    if (frontmatter.highlights !== undefined) parts.push(`高亮数量：${frontmatter.highlights}个`);
    if (frontmatter.thinks !== undefined) parts.push(`想法数量：${frontmatter.thinks}个`);
    if (frontmatter.ISBN) parts.push(`ISBN：${frontmatter.ISBN}`);
    return parts.join('，') || null;
  } catch (error) {
    eventSystem.emit('bookDescriptionError', { error });
    return null;
  }
}

/** 当前笔记是否带 book 标签（原 hasBookTag：metadataCache tags + frontmatter tags 任一含 book） */
export function hasBookTag(): boolean {
  try {
    const app = getApp();
    const currentFile = (app.workspace as any).getActiveFile();
    if (!currentFile) return false;
    const fileCache = (app.metadataCache as any).getFileCache(currentFile);
    if (!fileCache) return false;
    const allTags = fileCache.tags || [];
    const frontmatterTags = fileCache.frontmatter?.tags || [];
    const combinedTags = [
      ...allTags.map((t: any) => t.tag),
      ...(Array.isArray(frontmatterTags) ? frontmatterTags : [frontmatterTags]),
    ];
    return combinedTags.some((tag: any) => tag && typeof tag === 'string' && tag.toLowerCase().includes('book'));
  } catch (e) {
    return false;
  }
}

/** 光标上下文（原 getCursorContext：contextLength=0 仅当前行；否则按比例向上/向下截取） */
export function getCursorContext(contextLength: number, contextSplitRatio: number): string | null {
  try {
    const app = getApp();
    const activeLeaf = (app.workspace as any).getMostRecentLeaf();
    if (!activeLeaf || !activeLeaf.view || !activeLeaf.view.editor) return null;
    const editor = activeLeaf.view.editor;
    const content = editor.getValue();
    const cursor = editor.getCursor();
    const lines = content.split('\n');
    const currentLine = lines[cursor.line] || '';

    if (contextLength === 0) return currentLine;

    let context = currentLine + '\n';
    let totalLength = currentLine.length;
    const upLimit = Math.floor(contextLength * contextSplitRatio);
    const downLimit = contextLength - upLimit;

    let upLength = 0;
    let upIndex = cursor.line - 1;
    while (upIndex >= 0 && upLength < upLimit) {
      const line = lines[upIndex];
      if (upLength + line.length <= upLimit) {
        context = line + '\n' + context;
        upLength += line.length;
        totalLength += line.length;
      } else {
        const remaining = upLimit - upLength;
        context = line.substring(0, remaining) + '\n' + context;
        upLength = upLimit;
        totalLength += remaining;
      }
      upIndex--;
    }

    let downLength = 0;
    let downIndex = cursor.line + 1;
    while (downIndex < lines.length && downLength < downLimit && totalLength < contextLength) {
      const line = lines[downIndex];
      const availableSpace = Math.min(downLimit - downLength, contextLength - totalLength);
      if (line.length <= availableSpace) {
        context += line + '\n';
        downLength += line.length;
        totalLength += line.length;
      } else {
        context += line.substring(0, availableSpace) + '\n';
        downLength = downLimit;
        totalLength = contextLength;
      }
      downIndex++;
    }
    return context.length > 0 ? context.substring(0, contextLength) : null;
  } catch (error) {
    return null;
  }
}

/** 视口内容（原 getViewportContent：全文前 500 字硬编码） */
export function getViewportContent(): string | null {
  try {
    const app = getApp();
    const activeLeaf = (app.workspace as any).getMostRecentLeaf();
    if (!activeLeaf || !activeLeaf.view || !activeLeaf.view.editor) return null;
    return activeLeaf.view.editor.getValue().substring(0, 500);
  } catch (e) {
    return null;
  }
}

/** 当前笔记上下文（原 getCurrentNoteContext：{content, cursorLine, fileName}） */
export function getCurrentNoteContext(): { content: string; cursorLine: number; fileName: string } {
  try {
    const app = getApp();
    let content = '';
    let cursorLine = -1;
    let fileName = '当前笔记';
    const activeLeaf = (app.workspace as any).getMostRecentLeaf();
    if (activeLeaf && activeLeaf.view) {
      const view = activeLeaf.view;
      if (view.editor) {
        const editor = view.editor;
        content = editor.getValue();
        const cursor = editor.getCursor();
        cursorLine = cursor.line;
        if (view.file) fileName = view.file.basename || '未命名文件';
      }
    }
    return { content, cursorLine, fileName };
  } catch (error) {
    return { content: '', cursorLine: -1, fileName: '未知文件' };
  }
}

/** 可见内容（原 getVisibleContent：预览/编辑模式；编辑模式取 .markdown-source-view textContent） */
export function getVisibleContent(): string | null {
  try {
    const app = getApp();
    const activeLeaf = (app.workspace as any).getMostRecentLeaf();
    if (!activeLeaf || !activeLeaf.view) return null;
    const view = activeLeaf.view;
    if (view.getViewType && view.getViewType() === 'markdown') {
      const mode = view.getMode ? view.getMode() : 'source';
      if (mode === 'preview') {
        const previewContainer = view.containerEl && view.containerEl.querySelector('.markdown-preview-view');
        return previewContainer ? (previewContainer.textContent || '').substring(0, 1500) : null;
      }
      if (mode === 'source') {
        const editorElement = view.containerEl && view.containerEl.querySelector('.markdown-source-view');
        return editorElement ? (editorElement.textContent || '').substring(0, 1500) : null;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}