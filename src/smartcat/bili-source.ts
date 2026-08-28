/**
 * 文献盒动作观察（bili-downloader 域 → 小橘行为流，ADR-0066；ADR-0067 语义充实）
 * bili 域（ui.ts 添加保存 / 批处理引擎）经 emitDomainEvent('bili-tasks', evt) 派发 → 总线订阅进入，
 * 本模块构造 StructuredMeta 供 addObservation(source, { structured }) 路由到行为流。
 * 用户拍板只收两个节点（Q6）：添加转文献任务（added）/ 单条转文献成功（converted）；
 * 编辑与失败事件返回 null（不进小橘）。行为流 = 轻量记录、不向量化（ticket 123 知识内容口径）。
 * ADR-0067 追加：解析到标题/UP主 后发出 parsed 事件——**不是新条目**，而是充实之前那条
 * added 条目（BV 号 → 标题，extras 补 uploader/url），见 enrichBiliAddedWithParsed。
 */
import type { BehaviorItem, StructuredMeta } from './types';

/** 文献盒动作事件（bili 域 emitDomainEvent('bili-tasks', evt) 载荷；ADR-0066/0067） */
export type BiliActionEvent =
  | { kind: 'added'; id?: string; url: string }
  | { kind: 'parsed'; id?: string; url: string; title: string; uploader?: string }
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

/** 文献盒事件 → StructuredMeta（added/converted 之外返回 null——用户拍板只收两个节点；
 *  parsed 走 enrichBiliAddedWithParsed 更新既有条目，不新增） */
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

/**
 * 充实既有「添加转文献任务」条目（ADR-0067）：parsed 事件到达时，在行为流里找
 * 最近一条 source=bili-downloader / type=added / extras.url 相同 的条目，
 * 把 name 从 BV 号替换为标题、extras 补充 title/uploader（存储 description 的
 * `${source}:${action} ${name}` 一并随之更新——面板文案按 metadata 渲染，标题即显）。
 * 返回是否命中改写；未命中（旧数据/已滚动清理）静默忽略，不新增条目。
 */
export function enrichBiliAddedWithParsed(stream: BehaviorItem[], evt: { url: string; title: string; uploader?: string }): boolean {
  const url = String(evt?.url || '');
  const title = String(evt?.title || '').trim();
  if (!url || !title) return false;
  for (let i = stream.length - 1; i >= 0; i--) {
    const b = stream[i];
    if (b.source !== 'bili-downloader' || b.type !== 'added') continue;
    const meta = (b.metadata ?? {}) as StructuredMeta;
    if (String(meta?.extras?.url || '') !== url) continue;
    const extras = { ...(meta?.extras ?? {}), url, title, uploader: evt.uploader ?? meta?.extras?.uploader ?? '' };
    const enriched: StructuredMeta = { ...meta, name: title, extras };
    b.metadata = enriched;
    b.description = `bili-downloader:added ${title}`;
    return true;
  }
  return false;
}