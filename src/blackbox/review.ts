/**
 * 黑匣子复盘（ticket 62）：纯手动触发（命令 + 面板按钮，无定时）。
 * 对一段时期日记做 AI 分析 → 四段报告（人物画像更新/事件汇报/情绪聚合/反思建议）JSON 落盘 reviews[]，
 * 每条事实锚定（引用日期+原文片段）；产物同步写入对话流；复盘时聚合画像 AI 观察（≤5 裁旧）。
 * 失败降级：AI 失败返回 false 不阻断，不落盘。
 */
import { getApp } from '../core/app';
import { createAI } from '../core/ai';
import { BlackBoxDataManager, genId } from './data';
import { scanAllDiaryEntries } from './diary-scan';
import { personLabel } from './types';
import type { BlackBoxData, DiarySourceEntry, Profile, Review } from './types';

/** AI 复盘返回结构（四段 + 新人物） */
export interface ReviewResult {
  profileUpdates: string[];
  eventSummary: string[];
  emotionTrend: string;
  reflections: string[];
  newPeople: string[];
}

/** AI 观察上限（≤5 条裁旧） */
const MAX_OBSERVATIONS = 5;

/** 构建复盘提示词（条目 + 画像概要 + 四段结构要求）；空条目返回 null */
export function buildReviewPrompt(entries: DiarySourceEntry[], profiles: Profile[], mentions: { name: string; count: number }[]): string | null {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const lines = entries.map((e) => `- [${e.date} ${e.time}] ${(e.content || '').slice(0, 400)}`);
  const profileSummary = profiles.length
    ? profiles.map((p) => `- ${p.name}：${p.impression || '（无印象）'}${p.aiObservations && p.aiObservations.length ? '；AI 观察：' + p.aiObservations[p.aiObservations.length - 1].text : ''}`).join('\n')
    : '（暂无画像）';
  const mentionSummary = mentions.length ? mentions.map((m) => `${m.name}×${m.count}`).join('、') : '（无）';
  return `你是「包仔」，正在为用户做日记复盘。请阅读以下时间段内的日记条目，输出四段复盘报告：
1. profileUpdates：人物画像更新（每条引用具体日期与原文片段，禁止泛泛而谈），格式「名字（提及 N 次）：观察（YYYY-MM-DD 日记）」
2. eventSummary：事件汇报（大事时间线，每条一句，含日期）
3. emotionTrend：情绪聚合趋势（一段话，基于日记实际内容，禁止编造）
4. reflections：反思与建议（每条引用日期+原文片段，禁止无依据的鸡汤）
另输出 newPeople：提及 ≥2 次但尚未建画像的人物名（供一键确认建画像）。

当前画像：
${profileSummary}

提及候选：${mentionSummary}

日记条目：
${lines.join('\n')}

只返回 JSON：{"profileUpdates":[],"eventSummary":[],"emotionTrend":"","reflections":[],"newPeople":[]}`;
}

/** 容错解析复盘 JSON（剥离代码块；损坏返回 null） */
export function parseReviewJson(text: string): ReviewResult | null {
  if (!text || typeof text !== 'string') return null;
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  t = t.slice(start, end + 1);
  let raw: any;
  try {
    raw = JSON.parse(t);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);
  return {
    profileUpdates: strArr(raw.profileUpdates),
    eventSummary: strArr(raw.eventSummary),
    emotionTrend: typeof raw.emotionTrend === 'string' ? raw.emotionTrend : '',
    reflections: strArr(raw.reflections),
    newPeople: strArr(raw.newPeople),
  };
}

/** 应用复盘：reviews[] 落盘 + period + 对话流追加 + 画像 AI 观察聚合（≤5 裁旧，不覆盖用户印象） */
export function applyReview(data: BlackBoxData, result: ReviewResult, entries: DiarySourceEntry[]): void {
  if (!data || !result) return;
  const dates = entries.map((e) => e.date).filter(Boolean).sort();
  const from = dates[0] || '';
  const to = dates[dates.length - 1] || '';
  const rv: Review = {
    id: genId('rv'),
    createdAt: new Date().toISOString(),
    period: { from, to },
    report: {
      profileUpdates: result.profileUpdates || [],
      eventSummary: result.eventSummary || [],
      emotionTrend: result.emotionTrend || '',
      reflections: result.reflections || [],
    },
    newPeople: result.newPeople || [],
  };
  data.reviews.push(rv);

  // 对话流可见（assistant 消息：复盘报告摘要）
  const summary = [
    ...(rv.report.profileUpdates || []),
    ...(rv.report.eventSummary || []),
    rv.report.emotionTrend,
    ...(rv.report.reflections || []),
  ]
    .filter(Boolean)
    .join('\n');
  data.chat.push({
    role: 'assistant',
    content: `【复盘 ${from} ~ ${to}】\n${summary}`,
    ts: rv.createdAt,
  });

  // 画像 AI 观察聚合（profileUpdates 里解析出的人物 → 追加观察，≤5 裁旧；不覆盖 impression）
  for (const line of rv.report.profileUpdates || []) {
    const m = line.match(/^(.+?)（/);
    if (!m) continue;
    const name = m[1].trim();
    const pf = data.profiles.find((p) => p.name === name);
    if (!pf || pf.humanEdited) continue; // humanEdited 锁：不追加
    const obsText = line.replace(/^(.+?)（提及 \d+ 次）：/, '').trim() || line;
    const obs = { ts: rv.createdAt, text: `AI 观察：${obsText}`, source: { path: '', lineNumber: 0, time: '' } };
    pf.aiObservations.push(obs);
    // 裁旧：只保留最近 MAX_OBSERVATIONS 条
    if (pf.aiObservations.length > MAX_OBSERVATIONS) {
      pf.aiObservations = pf.aiObservations.slice(pf.aiObservations.length - MAX_OBSERVATIONS);
    }
  }
}

/** 手动复盘（命令入口）：扫描自上次复盘以来的日记 → AI 四段报告 → 落盘 */
export async function manualReview(app: any, ai?: any): Promise<boolean> {
  try {
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    const all = await scanAllDiaryEntries(app);
    if (all.length === 0) return false;
    // period：自上次复盘 createdAt 起（无则全量）
    const lastReview = data.reviews.length ? data.reviews[data.reviews.length - 1].createdAt.slice(0, 10) : '';
    const entries = lastReview ? all.filter((e) => e.date >= lastReview) : all;
    if (entries.length === 0) return false;
    const service = ai || createAI();
    const prompt = buildReviewPrompt(entries, data.profiles, data.mentions);
    if (!prompt) return false;
    const text = await service.json(prompt);
    const result = parseReviewJson(text);
    if (!result) return false;
    applyReview(data, result, entries);
    await dm.save(data);
    return true;
  } catch {
    return false; // 失败降级：不阻断
  }
}

/** 面板复盘按钮入口（复用 manualReview；供 panel 调用） */
export function triggerManualReview(app: any, ai?: any): Promise<boolean> {
  return manualReview(app, ai);
}