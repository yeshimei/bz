/**
 * 选区读取助手（ticket 02/06）：从当前活动编辑器读取选中文字 + 起止位置快照。
 * 供黑匣子录入自动填充（概念名/摘抄文本锁定）与来源笔记原位注入（[[目标|原文字]]）复用。
 * 无活动编辑器 / 无选中文字 / 选区读取失败 → 返回 null（调用方正常降级，永不拒收）。
 */
import type { App } from 'obsidian';

/** 选区快照（起止为行/列，供注入时替换原文；filePath 为来源笔记路径） */
export interface SelectionSnapshot {
  text: string;
  filePath: string | null;
  line: number;
  ch: number;
  endLine: number;
  endCh: number;
}

/** 读取当前选区快照；不可用时返回 null */
export function getSelectionSnapshot(app: App): SelectionSnapshot | null {
  try {
    const ws: any = app && (app as any).workspace;
    const ae = ws && ws.activeEditor;
    const editor = ae && ae.editor;
    if (!editor || typeof editor.getSelection !== 'function') return null;
    const text = (editor.getSelection() || '').trim();
    if (!text) return null;
    const from = editor.getCursor ? editor.getCursor('from') : null;
    const to = editor.getCursor ? editor.getCursor('to') : null;
    return {
      text,
      filePath: ae.file && typeof ae.file.path === 'string' ? ae.file.path : null,
      line: from && typeof from.line === 'number' ? from.line : 0,
      ch: from && typeof from.ch === 'number' ? from.ch : 0,
      endLine: to && typeof to.line === 'number' ? to.line : 0,
      endCh: to && typeof to.ch === 'number' ? to.ch : 0,
    };
  } catch (e) {
    // 选区读取失败：不阻断录入
    return null;
  }
}
