/**
 * 剪藏本·每日简报（ADR-0119 / issue 263）：AI 一句话总结生成与回写。
 *
 * 链路分工：上游 = 数据源守护 spawn `bili-downloader --brief` 抓取（字幕优先 / 无字幕转写）并把
 * 转录稿路径登记进 news.json `briefs` 段（条目 body 留空 = 待出稿）；本模块是**插件侧的 AI 环节**
 * （ADR-0011：工具不调 AI，AI 与落数据归插件）——扫描待出稿 → 读转录稿（bili-dl 缓存
 * `resume-brief-<bvid>.txt`）→ `createAI()` 产**一句话总结**（不分段、不带标题与要点符号）→ 写回 body。
 *
 * 产出形态（2026-09-10 用户拍板修订）：初版产出「按小节分组的要点列表」，实际阅读后判为过长，
 * 改为**一句话总结**；需要细节时看阅读面的「完整转录稿」折叠区。故 body = 一句自然句。
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

/** 待出稿判定：有 bvid、无总结、无错误、有转录稿路径（守护已跑完抓取） */
export function pendingBriefs(briefs: any[]): any[] {
  return (briefs || []).filter((b) =>
    !!b && !!b.bvid && !b.body && !b.error && !!b.transcriptPath);
}

/**
 * 清洗 AI 产出：去代码围栏、**压成单行**（一句话总结不该有换行/列表符号）、去首尾空白。
 * 模型偶尔仍会吐 `## 标题` 或 `- ` 前缀，一并剥掉（口径：body 恒为一句自然句）。
 */
export function cleanSummary(text: string): string {
  let s = String(text || '').trim();
  s = s.replace(/^```[a-zA-Z]*\s*\n?/, '').replace(/\n?```\s*$/, '');
  s = s
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*#>\s]+/, '').trim())
    .filter(Boolean)
    .join('');
  return s.trim();
}

/** 一句话总结提示词：只出一句、不分段、不带标题与符号；只依据原文；60 字以内 */
export function buildBriefPrompt(b: any, transcript: string): string {
  const title = String((b && b.title) || '（无标题）');
  const up = String((b && b.upName) || '');
  const dur = Number((b && b.duration) || 0);
  const body = String(transcript || '').slice(0, TRANSCRIPT_MAX);
  return [
    '你是简报编辑。下面是一期短视频的完整字幕/转录文字，请用**一句话**概括它讲了什么。',
    '',
    '要求：',
    '- **只输出一句话**：不分段、不加小标题、不用任何列表符号（-、*、数字序号都不要）',
    '- 抓住最关键的信息：谁做了什么、结论或结果是什么；保留关键数字与核心人名、公司名、产品名',
    '- 只依据原文，不要补充外部信息，不要臆测',
    '- 60 字以内，直接给句子本身，不要「本期」「本视频」「该视频介绍了」这类前缀',
    '- 不要时间轴或时间戳',
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
 * 逐条生成一句话总结并回写。返回 { done, failed, skipped }。
 * - 转录稿缺失（缓存已过期/被清理）→ 不写 error，记 skip（条目仍可手动重跑）；
 * - AI 未配置/调用失败 → 写 error（可见错误条目，可手动重跑）；
 * - 已存在总结的条目不动（幂等，重复调用安全）。
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
      const out = cleanSummary(await ai.chat(buildBriefPrompt(b, transcript)));
      if (!out) throw new Error('AI 产出为空');
      await writePatch(bvid, { body: out, error: undefined });
      done++;
    } catch (e: any) {
      failed++;
      await writePatch(bvid, { error: `总结生成失败：${(e && e.message) || String(e)}` });
    }
  }
  return { done, failed, skipped };
}
