/**
 * source 退役编排（issue 336 / ADR-0149）：知识盒卡片 frontmatter source 的删除同步。
 *
 * 两条链路（ADR-0149 决策 1/2）：
 * - 降级（可回退处）：剪藏被删时，用剪藏自身 frontmatter 的 url 把指向它的 source 行级
 *   改写回外链形态——恢复 ADR-0144 物化前的两态，出处信息零丢失（retireKnowledgeSourcesForClip）；
 * - 摘除（兜底）：任何 md 被删且无 url 可回退（影院笔记、用户经 Obsidian 删除等）→
 *   行级摘除指向它的 source 行，sourceTitle 保留（retireSourcesOnMdDeleted 消费者）。
 *
 * 扫描口径：知识盒目录（knowledgeDirOf）内 md 卡片，frontmatter 走 metadataCache
 * 预筛（避免全量读文件），命中卡片才读全文 → source.ts retireSourceLine 行级手术 → 写回。
 * 通知合并一条（正文无 emoji，notice.ts 规范）。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { notify } from '../core/notice';
import { retireSourceLine, sourcePointsAt } from './source';

/** 知识盒目录（设置键 knowledgeDirectory，缺省「文献盒」；trim+斜杠归一口径同 note-gen/mount-data） */
export function knowledgeDirOf(): string {
  return (
    String(tryGetSettings()?.knowledgeDirectory ?? '')
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\/+|\/+$/g, '')
  ) || '文献盒';
}

/**
 * 对知识盒目录内 source 指向 retiredPath 的卡片做行级退役（scan → 手术 → 写回）。
 * 返回实际改写/摘除的卡片数（未命中/幂等跳过不计）。单卡失败静默跳过不阻断整批。
 */
export async function retireKnowledgeSources(app: App, retiredPath: string, fallbackUrl?: string | null): Promise<number> {
  const target = String(retiredPath || '').trim();
  if (!target) return 0;
  const dir = knowledgeDirOf();
  const files = (app.vault.getMarkdownFiles() || []).filter((f: any) => f.path.startsWith(dir + '/') && f.path.endsWith('.md'));
  // metadataCache 预筛：frontmatter source 命中退役路径的卡片才读全文（避免全量读）
  const hits = files.filter((f: any) => {
    try {
      const fm = app.metadataCache?.getFileCache?.(f)?.frontmatter;
      return !!fm && sourcePointsAt((fm as any).source, target);
    } catch (e) {
      return false;
    }
  });
  let changed = 0;
  for (const f of hits) {
    try {
      const content: string = await app.vault.read(f);
      const next = retireSourceLine(content, target, fallbackUrl);
      if (next !== null && next !== content) {
        await app.vault.modify(f, next);
        changed++;
      }
    } catch (e) {
      console.warn('[knowledge] source 退役写回失败（跳过该卡）', f.path, e);
    }
  }
  return changed;
}

/**
 * 剪藏删除 → 卡片 source 降级契约（issue 336 链路 1，clipbook/ui 删除流 trash 前调用）：
 * 有 url → 降级回外链（success 通知「已把 N 张知识卡片来源回退为原链接」）；无 url →
 * 改调摘除（info 通知「已摘除 N 张知识卡片的失效来源」）。N=0 不弹任何通知。
 * 返回退役卡片数（调用方不以此决定删除流走向——降级失败不阻断删除）。
 */
export async function retireKnowledgeSourcesForClip(app: App, clipPath: string, clipUrl?: string | null): Promise<number> {
  const url = String(clipUrl ?? '').trim();
  const n = await retireKnowledgeSources(app, clipPath, url || null);
  if (n > 0) {
    if (url) notify(`已把 ${n} 张知识卡片来源回退为原链接`, { type: 'success' });
    else notify(`已摘除 ${n} 张知识卡片的失效来源`, { type: 'info' });
  }
  return n;
}

/**
 * md-deleted 消费体（issue 336 链路 2，ADR-0149 决策 2）：被删 md 被卡片 source 内链指向时
 * 行级摘除断链 source（sourceTitle 保留），有摘除才合并一条通知。已降级（外链形态）卡片
 * 天然不命中。不限被删文件目录——卡片 source 可指向任意笔记（录入入口带当前笔记）。
 */
export async function retireSourcesOnMdDeleted(app: App, deletedPath: string): Promise<number> {
  const n = await retireKnowledgeSources(app, deletedPath, null);
  if (n > 0) notify(`已摘除 ${n} 张知识卡片的失效来源`, { type: 'info' });
  return n;
}
