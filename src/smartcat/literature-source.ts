/**
 * 文献盒动作观察（literature 域 → 小橘行为流；ADR-0066 起建、ADR-0067 语义充实、ADR-0072 迁出为新域）
 * literature 域（视频批处理引擎 / 术语生成流程）经 emitDomainEvent('literature:tasks', evt) 派发 → 总线订阅进入，
 * 本模块构造 StructuredMeta 供 addObservation(source, { structured }) 路由到行为流。
 * ticket 136 用户拍板：只收「视频转文献成功（converted）+ 术语生成成功（term-generated）」两个节点；
 * 添加任务/解析/编辑/失败事件返回 null（不进小橘）。行为流 = 轻量记录、不向量化（ticket 123 知识内容口径）。
 */
import type { StructuredMeta } from './types';

/** 文献盒动作事件（literature 域 emitDomainEvent('literature:tasks', evt) 载荷；ADR-0066/0072） */
export type LiteratureActionEvent =
  | { kind: 'converted'; id?: string; url: string; notePath?: string | null }
  | { kind: 'term-generated'; id?: string; term: string; title?: string | null };

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

/** 文献盒事件 → StructuredMeta（converted/term-generated 之外返回 null——ticket 136 用户拍板只收这两类） */
export function buildLiteratureStructured(evt: LiteratureActionEvent): StructuredMeta | null {
  if (!evt || typeof evt !== 'object') return null;
  if (evt.kind === 'converted') {
    return {
      entityType: 'literature',
      action: 'converted',
      name: titleOf(evt.notePath) || bvOf(evt.url) || '一部视频',
      id: evt.id,
      extras: { url: evt.url, notePath: evt.notePath ?? null },
    };
  }
  if (evt.kind === 'term-generated') {
    return {
      entityType: 'literature',
      action: 'term-generated',
      name: String(evt.term || '').trim() || '术语',
      id: evt.id,
      extras: { term: evt.term, title: evt.title ?? null },
    };
  }
  return null;
}
