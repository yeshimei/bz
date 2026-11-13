/**
 * clipbook：单篇文章的 AI 摘要（门面用）——阅读器标题下面那一段「内容简介」。
 *
 * 与「存进剪藏本时的自动摘要」共用同一套提示词与长度档位（auto-summary 的
 * aiProcess）：两处必须一个口径，否则同一篇文章在剪藏笔记里和阅读器里会长成
 * 两种篇幅的摘要，用户会以为哪边算错了。
 *
 * 这里只管「正文 → 一段摘要」，不碰存储：写回 news.json 由门面宿主做，
 * 因为那条路径要走 bz 自己的合并写队列（后台抓取是另一个写者）。
 */
import { createAI } from '../core/ai';
import { aiProcess } from '../auto-summary/processor';
import { tryGetSettings } from '../core/settings-provider';

/** 正文 → 摘要；空正文或 AI 没给出东西时返回 null（调用方按失败处理，不写空串） */
export async function summarizeClipBody(body: string): Promise<string | null> {
  const text = String(body || '').trim();
  if (!text) return null;
  const s = tryGetSettings() as any;
  const out = await aiProcess(createAI(), text, ['summary'], {
    summaryLength: String(s?.autoSummaryLength || 'standard'),
  });
  const summary = String(out?.summary ?? '').trim();
  return summary || null;
}
