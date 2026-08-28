/**
 * 文献盒动作观察（bili-downloader 域 → 小橘行为流，ADR-0066）
 * bili 域（ui.ts 添加保存 / 批处理终态）经 emitDomainEvent('bili-tasks', evt) 派发 → 总线订阅进入，
 * 本模块构造 StructuredMeta 供 addObservation(source, { structured }) 路由到行为流。
 * 用户拍板只收两个节点（Q6）：添加转文献任务（added）/ 单条转文献成功（converted）；
 * 编辑与失败事件返回 null（不进小橘）。行为流 = 轻量记录、不向量化（ticket 123 知识内容口径）。
 */
import type { StructuredMeta } from './types';

/** 文献盒动作事件（bili 域 emitDomainEvent('bili-tasks', evt) 载荷；ADR-0066） */
export type BiliActionEvent =
  | { kind: 'added'; id?: string; url: string }
  | { kind: 'converted'; id?: string; url: string; notePath?: string | null }
  | { kind: 'edited'; id?: string; url: string }
  | { kind: 'failed'; id?: string; url: string; notePath?: string | null };

/** 从 url 提取 BV 号（BV1xx411c7mD）；失败返回空串 */
function bvOf(url: string): string {
  const m = String(url || '').match(/BV[0-9A-Za-z]{10}/);
  return m ? m[0] : '';
}

/** 笔记路径尾名去扩展名（'文献盒/xxx.md' → 'xxx'）；失败返回空串 */
function titleOf(notePath: string | null | undefined): string {
  if (!notePath) return '';
  const base = String(notePath).replace(/\\/g, '/').split('/').pop() || '';
  return base.replace(/\.md$/i, '');
}

/** 文献盒事件 → StructuredMeta（added/converted 之外返回 null——用户拍板只收两个节点） */
export function buildBiliStructured(evt: BiliActionEvent): StructuredMeta | null {
  if (!evt || typeof evt !== 'object') return null;
  if (evt.kind === 'added') {
    return {
      entityType: 'bili',
      action: 'added',
      name: bvOf(evt.url) || evt.url,
      id: evt.id,
      extras: { url: evt.url },
    };
  }
  if (evt.kind === 'converted') {
    return {
      entityType: 'bili',
      action: 'converted',
      name: titleOf(evt.notePath) || bvOf(evt.url) || '一部视频',
      id: evt.id,
      extras: { url: evt.url, notePath: evt.notePath ?? null },
    };
  }
  return null;
}