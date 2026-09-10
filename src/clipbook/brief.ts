/**
 * 剪藏本·每日简报（ADR-0119 / issue 263）：AI 要点生成与回写。
 *
 * 链路分工：上游 = 数据源守护 spawn `bili-downloader --brief` 抓取（字幕优先 / 无字幕转写）并把
 * 转录稿路径登记进 news.json `briefs` 段（条目 body 留空 = 待出稿）；本模块是**插件侧的 AI 环节**
 * （ADR-0011：工具不调 AI，AI 与落数据归插件）——扫描待出稿 → 读转录稿（bili-dl 缓存
 * `resume-brief-<bvid>.txt`）→ `createAI()` 产**要点列表**（按小节分组，明确不要时间轴）→ 写回 body。
 *
 * 失败处理（ADR-0119 §11）：单条失败写 `error` 形成**可见错误条目**（列表可见 + 可手动重跑），
 * 不静默吞、不阻断其余条目。
 *
 * 触发时机：面板打开装载完成后调一次（`runBriefSummaries`）；无待出稿时零开销直接返回。
 */
import { createAI } from '../core/ai';
import { writeBriefPatch } from './store';

/** 单条转录稿注入上限（短视频远够；防异常长文把 prompt 撑爆） */
const TRANSCRIPT_MAX = 12000;

/** 待出稿判定：有 bvid、无要点、无错误、有转录稿路径（守护已跑完抓取） */
export function pendingBriefs(briefs: any[]): any[] {
  return (briefs || []).filter((b) =>
    !!b && !!b.bvid && !b.body && !b.error && !!b.transcriptPath);
}

/** 清洗 AI 产出：去代码围栏、去首尾空白、压掉空行尾巴 */
export function cleanPoints(text: string): string {
  let s = String(text || '').trim();
  s = s.replace(/^```[a-zA-Z]*\s*\n?/, '').replace(/\n?```\s*$/, '');
  return s.trim();
}

/** 要点提示词：按小节分组的要点列表；只依据原文；不要时间轴（区别于既有 47 篇外部工具产物的结构） */
export function buildBriefPrompt(b: any, transcript: string): string {
  const title = String((b && b.title) || '（无标题）');
  const up = String((b && b.upName) || '');
  const dur = Number((b && b.duration) || 0);
  const body = String(transcript || '').slice(0, TRANSCRIPT_MAX);
  return [
    '你是简报编辑。下面是一期短视频的完整字幕/转录文字，请提炼成**要点列表**供快速扫读。',
    '',
    '要求：',
    '- 用 markdown：`## 小节标题` 分组，每组下面用 `- ` 列要点',
    '- 2–4 个小组，每组 2–4 条；每条一句话，保留关键事实、数字、人名、公司名与产品名',
    '- 只依据原文，不要补充外部信息，不要臆测，不要写「本视频介绍了」这类空话',
    '- **不要输出时间轴或时间戳**，不要整句复述原文',
    '- 直接输出要点正文，不要任何前后解释或总结语',
    '',
    `视频标题：${title}`,
    up ? `UP 主：${up}` : '',
    dur > 0 ? `时长：${dur} 秒` : '',
    '',
    '转录全文：',
    body,
  ].filter((s) => s !== '').join('\n');
}

/** 转录稿读取器（桌面端 window.require('fs')；非桌面端/不可得 → null） */
function defaultReadText(absPath: string): string | null {
  try {
    const w = window as any;
    if (!w || !w.require) return null;
    const fs = w.require('fs');
    if (!fs || typeof fs.readFileSync !== 'function') return null;
    return String(fs.readFileSync(absPath, 'utf8') || '');
  } catch {
    return null;
  }
}

/** runBriefSummaries 注入项（测试打桩用；生产走默认实现） */
export interface BriefSummaryDeps {
  /** AI 服务（缺省 createAI()） */
  ai?: { chat(prompt: string): Promise<string> } | null;
  /** 读转录稿全文（缺省 window.require('fs').readFileSync） */
  readText?: (absPath: string) => string | null;
  /** 写回补丁（缺省 store.writeBriefPatch） */
  writePatch?: (bvid: string, patch: Record<string, any>) => Promise<void>;
  /** 单条进度回调（可选） */
  onItem?: (bvid: string, i: number, n: number) => void;
}

/**
 * 逐条生成要点并回写。返回 { done, failed, skipped }。
 * - 转录稿缺失（缓存已过期/被清理）→ 不写 error，记 skip（条目仍可手动重跑）；
 * - AI 未配置/调用失败 → 写 error（可见错误条目，可手动重跑）；
 * - 已存在要点的条目不动（幂等，重复调用安全）。
 */
export async function runBriefSummaries(
  briefs: any[],
  deps: BriefSummaryDeps = {}
): Promise<{ done: number; failed: number; skipped: number }> {
  const pending = pendingBriefs(briefs);
  if (!pending.length) return { done: 0, failed: 0, skipped: 0 };
  const readText = deps.readText || defaultReadText;
  const writePatch = deps.writePatch || writeBriefPatch;
  const ai = deps.ai !== undefined ? deps.ai : createAI();

  let done = 0;
  let failed = 0;
  let skipped = 0;
  for (let i = 0; i < pending.length; i++) {
    const b = pending[i];
    const bvid = String(b.bvid);
    if (deps.onItem) deps.onItem(bvid, i + 1, pending.length);
    const transcript = readText(String(b.transcriptPath || ''));
    if (!transcript || !transcript.trim()) {
      skipped++;   // 转录稿取不到（保留期已过）——不写错误，留给手动重跑
      continue;
    }
    if (!ai || typeof ai.chat !== 'function') {
      failed++;
      await writePatch(bvid, { error: 'AI 未配置：请在插件设置中配置 AI 提供方后重跑本条' });
      continue;
    }
    try {
      const out = cleanPoints(await ai.chat(buildBriefPrompt(b, transcript)));
      if (!out) throw new Error('AI 产出为空');
      await writePatch(bvid, { body: out, error: undefined });
      done++;
    } catch (e: any) {
      failed++;
      await writePatch(bvid, { error: `要点生成失败：${(e && e.message) || String(e)}` });
    }
  }
  return { done, failed, skipped };
}
