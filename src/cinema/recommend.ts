/**
 * 影院（cinema）AI 荐片：复刻 movie/recommend.ts（真实 AI 调用 + 页内等待/结果 + 加入想看）
 * - 口味画像 buildTasteProfile（加权统计类型/题材/导演/主演/地区 + 最近观影）
 * - 提示词 buildRecommendPrompt（要求真实存在、引用画像偏好）
 * - AI 页内化（用户拍板）：点入口切 AI 页 → 等待消息就地在页内显示 → 完成后结果列表就地渲染（不弹窗）
 */
import type { App } from 'obsidian';
import { notice } from '../core/notice';
import { createAI } from '../core/ai';
import { STATUS_WANT, STATUS_WATCHED } from './constants';
import type { CinemaItem } from './state';
import { M } from './state';
import { refreshDataAndView } from './data';

/** 类型 → 默认 tag（加入想看用） */
const GROUP_DEFAULT_TAG: Record<string, string> = {
  电影: '电影',
  剧集: '国产剧',
  动漫: '日漫',
  纪录片: '纪录片',
  公开课: '公开课',
};

/** 构建口味画像（加权：评分即权重；最近 10 部带影评摘要） */
export function buildTasteProfile(): any {
  const watched = M.items.filter((i) => i.status === STATUS_WATCHED && i.rating !== null && i.rating > 0);
  const weight = (i: CinemaItem) => i.rating as number;

  const topBy = (key: (i: CinemaItem) => string | null) => {
    const acc: Record<string, number> = {};
    watched.forEach((i) => {
      const val = key(i);
      if (!val) return;
      String(val).split('/').map((s) => s.trim()).filter(Boolean).forEach((part) => {
        acc[part] = (acc[part] || 0) + weight(i);
      });
    });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}×${v.toFixed(1)}`);
  };

  const recent = [...watched]
    .sort((a, b) => {
      const da = a.watchDate ? new Date(a.watchDate).getTime() : 0;
      const db = b.watchDate ? new Date(b.watchDate).getTime() : 0;
      return db - da;
    })
    .slice(0, 10)
    .map((i) => `${i.name}(${i.group},评分${i.rating}${i.review ? '，影评：' + i.review.slice(0, 60) : ''})`);

  return {
    total: watched.length,
    groups: topBy((i) => i.group),
    genres: topBy((i) => i.genre),
    directors: topBy((i) => i.director),
    actors: topBy((i) => i.actors),
    regions: topBy((i) => i.region),
    recent,
  };
}

/** 构建推荐提示词（逐字复刻 movie/recommend buildRecommendPrompt） */
export function buildRecommendPrompt(profile: any, recent: string[], allNames: string[]): string {
  return `你是资深影视推荐官。用户已看 ${profile.total} 部影视，以下是其口味画像（个人评分1~10加权统计，数值为加权分）：
品类分布：${profile.groups.join('、') || '无'}
类型偏好：${profile.genres.join('、') || '无'}
导演偏好：${profile.directors.join('、') || '无'}
主演偏好：${profile.actors.join('、') || '无'}
地区偏好：${profile.regions.join('、') || '无'}
最近看的10部：${recent.join('；')}

请基于画像推荐 5 部用户可能喜欢的、且不在排除清单中的影视（电影/剧集/动漫/纪录片/公开课均可）。推荐理由必须具体引用画像中的偏好信号（如"你偏爱X导演的Y风格"）。只推荐真实存在的影视，避免编造。

排除清单（不要推荐这些）：${allNames.join('、')}

严格输出 JSON（不要输出其他内容）：{"recommendations":[{"title":"片名","year":"年份","director":"导演","type":"电影|剧集|动漫|纪录片|公开课","reason":"推荐理由"}]}`;
}

/** 解析 AI 返回 JSON（兼容裸数组 / recommendations / similar / suggestions / items / movies 键） */
export function parseRecommendJson(raw: string): any[] | null {
  try {
    let cleaned = raw.trim();
    const codeBlockMatch = cleaned.match(/```json\s*([\s\S]*?)```/);
    if (codeBlockMatch) cleaned = codeBlockMatch[1].trim();
    const data = JSON.parse(cleaned);
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      for (const key of ['recommendations', 'similar', 'similar_movies', 'suggestions', 'items', 'movies']) {
        if (Array.isArray(data[key]) && data[key].length > 0) return data[key];
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** 本地时间 YYYY-MM-DD HH:mm:ss */
function localNowFormat(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 加入想看（AI 推荐条目 → 建笔记，评分 -1） */
export async function quickAddWant(app: App, name: string, type: string): Promise<void> {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    notice('推荐条目缺少片名，已跳过加入想看');
    return;
  }
  const tag = GROUP_DEFAULT_TAG[type] || '电影';
  let folderObj = app.vault.getAbstractFileByPath(M.folderPath);
  if (!folderObj) await app.vault.createFolder(M.folderPath);
  const filePath = `${M.folderPath}/《${trimmedName}》.md`;
  if (app.vault.getAbstractFileByPath(filePath)) {
    notice(`影视「${trimmedName}」已在库中`);
    return;
  }
  const now = localNowFormat();
  const content = `---
tags:
- ${tag}
观影日期: ${now}
评分: -1
海报: 
---
`;
  try {
    await app.vault.create(filePath, content);
    notice(`已加入想看：${trimmedName}`, 'success');
    refreshDataAndView(app);
  } catch (e) {
    notice('创建笔记失败', 'error');
    console.error(e);
  }
}

/**
 * AI 荐片（页内化）：等待消息与结果都就地渲染在 AI 页内，不弹窗。
 * 触发方确保 M.view 已切到 'ai' 且 renderAll 已渲染（工具钮/开始按钮统一走 runAIRecommend）。
 */
export async function runAIRecommend(app: App): Promise<void> {
  // 若从非 AI 页触发（如左栏工具钮），先切页让等待态可见
  M.aiRunning = true;
  M.aiWaitMsg = 'AI 正在分析你的观影口味…';
  M.aiResult = null;
  M.aiError = null;
  M.view = 'ai';
  M.renderFn?.();

  try {
    const profile = buildTasteProfile();
    const allNames = M.items.map((i) => i.name);
    const prompt = buildRecommendPrompt(profile, profile.recent, allNames);
    M.aiWaitMsg = `已分析 ${profile.total} 部观影历史，正在生成推荐…`;
    M.renderFn?.();
    const ai = createAI();
    const raw = await ai.json(prompt, {});
    const parsed = parseRecommendJson(raw);
    if (!parsed || parsed.length === 0) {
      M.aiRunning = false;
      M.aiError = 'AI 分析失败：返回格式无法解析';
      M.renderFn?.();
      return;
    }
    M.aiRunning = false;
    M.aiResult = parsed;
    M.renderFn?.();
  } catch (e: any) {
    M.aiRunning = false;
    M.aiError = 'AI 分析失败：' + (e.message || e);
    M.renderFn?.();
  }
}
