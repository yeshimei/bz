/**
 * 影院（cinema）AI 荐片：复刻 movie/recommend.ts（真实 AI 调用 + 页内等待/结果 + 加入想看）
 * - 口味画像 buildTasteProfile（加权统计类型/题材/导演/主演/地区 + 最近观影）
 * - 提示词（2026-09-11 方案 A，用户拍板）：prompt 只发画像 + 最近已看，不发全量片名；
 *   要 20 部按匹配度排序 → 结果层去重（在库/重复/空名）取前 5 → 不足补问一轮（排除已见名单）
 * - AI 页内化（用户拍板）：点入口切 AI 页 → 等待消息就地在页内显示 → 完成后结果列表就地渲染（不弹窗）
 * - ADR-0087：自旧 movie 迁入 runSimilarRecommend/buildSimilarPrompt（找同类）
 */
import type { App } from 'obsidian';
import { notice, notifySaveError } from '../core/notice';
import { localNow } from '../core/ui/str';
import { createAI } from '../core/ai';
import { emitDomainEvent } from '../core/domain-bus';
import { STATUS_WATCHED } from './constants';
import type { CinemaItem } from './state';
import { M } from './state';
import { refreshDataAndView } from './data';
import { enqueueDoubanFetch } from './douban-queue';

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

/** 荐片配额（方案 A，用户拍板 2026-09-11）：首轮要 20 → 本地去重 → 取匹配度前 5；不足 5 部补问一轮 */
const RECOMMEND_ASK = 20;
const RECOMMEND_TAKE = 5;
const FOLLOWUP_ASK = 10;

/** 构建推荐提示词（2026-09-11 方案 A：不再打包全量片名做排除清单——
 *  prompt 只发正向信号（画像 + 最近已看），要求多给（20 部按匹配度排序），
 *  「不荐库内已有」职责移到结果层去重；token 从库规模线性降为常量级） */
export function buildRecommendPrompt(profile: any, recent: string[]): string {
  return `你是资深影视推荐官。用户已看 ${profile.total} 部影视，以下是其口味画像（个人评分1~10加权统计，数值为加权分）：
品类分布：${profile.groups.join('、') || '无'}
类型偏好：${profile.genres.join('、') || '无'}
导演偏好：${profile.directors.join('、') || '无'}
主演偏好：${profile.actors.join('、') || '无'}
地区偏好：${profile.regions.join('、') || '无'}
最近看的10部：${recent.join('；')}

请基于画像推荐 ${RECOMMEND_ASK} 部用户可能喜欢的影视（电影/剧集/动漫/纪录片/公开课均可），按与口味的匹配度从高到低排序。推荐理由必须具体引用画像中的偏好信号（如"你偏爱X导演的Y风格"）。只推荐真实存在的影视，避免编造。

严格输出 JSON（不要输出其他内容）：{"recommendations":[{"title":"片名","year":"年份","director":"导演","type":"电影|剧集|动漫|纪录片|公开课","reason":"推荐理由"}]}`;
}

/** 补问提示词（方案 A 第二轮）：只排除「已经推荐过的名字」（≤20 个，常量级），
 *  在库去重仍由结果层承担；凑不满 5 部就按实际所得展示 */
export function buildFollowupPrompt(profile: any, recent: string[], excludeNames: string[]): string {
  return `你是资深影视推荐官。用户已看 ${profile.total} 部影视，以下是其口味画像（个人评分1~10加权统计，数值为加权分）：
品类分布：${profile.groups.join('、') || '无'}
类型偏好：${profile.genres.join('、') || '无'}
导演偏好：${profile.directors.join('、') || '无'}
主演偏好：${profile.actors.join('、') || '无'}
地区偏好：${profile.regions.join('、') || '无'}
最近看的10部：${recent.join('；')}

刚才已经向你推荐过以下影片（不要重复推荐）：${excludeNames.join('、')}

请再推荐 ${FOLLOWUP_ASK} 部用户可能喜欢的影视（电影/剧集/动漫/纪录片/公开课均可），按与口味的匹配度从高到低排序，避开上面已出现过的。推荐理由必须具体引用画像中的偏好信号（如"你偏爱X导演的Y风格"）。只推荐真实存在的影视，避免编造。

严格输出 JSON（不要输出其他内容）：{"recommendations":[{"title":"片名","year":"年份","director":"导演","type":"电影|剧集|动漫|纪录片|公开课","reason":"推荐理由"}]}`;
}

/** 候选条目名（title 兜底 name） */
function recTitle(r: any): string {
  return String(r?.title || r?.name || '').trim();
}

/**
 * 结果层去重：跳过空名 / 已拾取或已见过的名字 / 在库已有（it.name 精确匹配）；
 * 每个见过的名字都记入 taken——补问轮的排除清单据此构造（在库的也不再返回）
 */
function dedupeRecommendations(cands: any[], taken: Set<string>): any[] {
  const out: any[] = [];
  for (const r of cands ?? []) {
    const name = recTitle(r);
    if (!name || taken.has(name)) continue;
    taken.add(name);
    if (M.items.some((it) => it.name === name)) continue;
    out.push(r);
  }
  return out;
}

/**
 * 荐片结果精修（refine）：首轮候选去重后取前 5（AI 排序即相关性序）；
 * 不足 5 部 → 带已见名单补问一轮（FOLLOWUP_ASK），再去重补足；补问失败保留首轮所得。
 * 全程不抛错（内部兜底），空列表由 runAIPage 落错误文案。
 */
async function refineRecommend(first: any[]): Promise<any[]> {
  const taken = new Set<string>();
  const picked = dedupeRecommendations(first, taken).slice(0, RECOMMEND_TAKE);
  if (picked.length >= RECOMMEND_TAKE) return picked;
  M.aiWaitMsg = `首轮候选在库较多，正在补充推荐…`;
  M.renderFn?.();
  try {
    const profile = buildTasteProfile();
    const ai = createAI();
    const raw = await ai.json(buildFollowupPrompt(profile, profile.recent, [...taken]), {});
    const more = parseRecommendJson(raw);
    if (more) picked.push(...dedupeRecommendations(more, taken));
  } catch {
    /* 补问失败：保留首轮所得 */
  }
  return picked.slice(0, RECOMMEND_TAKE);
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
  const now = localNow();
  const content = `---
tags:
- ${tag}
观影日期: ${now}
评分: -1
海报: 
---
`;
  try {
    const f = await app.vault.create(filePath, content);
    notice(`已加入想看：${trimmedName}`, 'success');
    // 事件补发（smartcat 行为流观察；ADR-0087 cinema 接管）：created want
    emitDomainEvent('movie', { kind: 'created', name: trimmedName, status: 'want', rating: null, review: null });
    // 入抓取队列（ADR-0113）：卡片 loading 反馈，无通知
    enqueueDoubanFetch(f, trimmedName);
    refreshDataAndView(app);
  } catch (e) {
    notifySaveError(e, '加入想看');
    console.error(e);
  }
}

/** AI 页请求参数：初始等待消息 + prompt/waitMsg 构造器（荐片与找同类仅此不同） */
interface AIPageOpts {
  /** 荐片传 null；找同类传基准影片（「换一批」按基准重跑） */
  base: CinemaItem | null;
  initWaitMsg: string;
  prepare: () => { prompt: string; waitMsg: string };
  /** 可选结果精修（荐片专用）：首轮结果 → 去重 + 不足补问 → 最终列表；找同类不传 */
  refine?: (first: any[]) => Promise<any[]>;
}

/**
 * AI 页状态机 runner（荐片/找同类共用骨架）：
 * 重入防护 → 置等待态切 AI 页 → 构造 prompt 发请求 → 解析回填结果 / 错误。
 * 结果与等待消息都就地渲染在 AI 页内，不弹窗。
 */
async function runAIPage(app: App, opts: AIPageOpts): Promise<void> {
  // 重入防护：AI 运行中再点入口/开始按钮直接忽略（防双倍 token 消耗与并发写 M.aiResult 互相覆盖）
  if (M.aiRunning) return;
  M.aiRunning = true;
  M.aiWaitMsg = opts.initWaitMsg;
  M.aiResult = null;
  M.aiError = null;
  M.aiBase = opts.base;
  M.view = 'ai';
  M.renderFn?.();

  try {
    const { prompt, waitMsg } = opts.prepare();
    M.aiWaitMsg = waitMsg;
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
    // B（补扫 cinema P2）：refine（荐片补问轮，含第二次 AI 往返）期间保持 aiRunning=true——
    // 提前翻 false 会落在「aiRunning=false/aiResult=null/aiError=null」的三空态上：AI 页整页
    // 回落待机 guide、「开始推荐」重新可点、重入守卫失效（可触发第二次并发 AI 双倍 token、
    // 两轮结果互相覆盖）。翻 false 推迟到 refine 结束、结果/错误落定之后
    const final = opts.refine ? await opts.refine(parsed) : parsed;
    M.aiRunning = false;
    if (!final.length) {
      M.aiError = '没有凑齐可推荐的库外新片，换一批再试';
      M.renderFn?.();
      return;
    }
    M.aiResult = final;
    M.renderFn?.();
  } catch (e: any) {
    M.aiRunning = false;
    M.aiError = 'AI 分析失败：' + (e.message || e);
    M.renderFn?.();
  }
}

/**
 * AI 荐片（页内化）。
 * 触发方确保 M.view 已切到 'ai' 且 renderAll 已渲染（页内「开始/重试/换一批」按钮统一走 runAIRecommend；
 * 左栏工具钮只切页不发请求——增强包需求 4 按需触发）。
 */
export function runAIRecommend(app: App): Promise<void> {
  return runAIPage(app, {
    base: null, // 荐片模式（「换一批」重跑荐片而非找同类）
    initWaitMsg: 'AI 正在分析你的观影口味…',
    prepare: () => {
      const profile = buildTasteProfile();
      return {
        prompt: buildRecommendPrompt(profile, profile.recent),
        waitMsg: `已分析 ${profile.total} 部观影历史，正在生成推荐…`,
      };
    },
    refine: refineRecommend,
  });
}

/**
 * 找同类（ADR-0087 自旧 movie/recommend.ts runSimilarRecommend 迁入）：
 * 以基准影片 + 已看库为输入，推荐同类佳作。
 * @param item 当前详情/基准影片
 */
export function runSimilarRecommend(item: CinemaItem, app: App): Promise<void> {
  return runAIPage(app, {
    base: item, // 记录基准影片供「换一批」重跑
    initWaitMsg: 'AI 正在分析同类影片…',
    prepare: () => ({
      prompt: buildSimilarPrompt(item, M.items.filter((i) => i.status === STATUS_WATCHED && i.name !== item.name)),
      waitMsg: `已分析 ${M.items.length} 部影视，正在生成同类推荐…`,
    }),
  });
}

/** 找同类提示词：以基准影片 + 已看库为输入，要求推荐未看过的同类佳作（输出结构与其他 AI 保持一致） */
export function buildSimilarPrompt(item: CinemaItem, watched: CinemaItem[]): string {
  const self = `片名《${item.name}》（${item.typeTag || '未知类型'}${item.rating !== null && item.rating > 0 ? `，我的评分 ${item.rating}` : ''}${item.review ? `，我的影评「${item.review.slice(0, 80)}」` : ''}${item.director ? `，导演 ${item.director}` : ''}）`;
  const list = watched
    .map((i) => `${i.name}（${i.typeTag || ''}${i.rating !== null && i.rating > 0 ? `，评分${i.rating}` : ''}）`)
    .join('、');
  return `你是资深影视推荐官。以下是我的影视库里的「基准影片」和我「已看过的影片清单」。
基准影片：${self}
我已看过：${list || '（暂无）'}
请推荐 3~5 部与基准影片气质相近、但我还没看过的同类佳作（可从真实世界影视中挑选），结合我的观影口味说明理由。
严格输出 JSON（不要输出其他内容）：{"recommendations":[{"title":"片名","year":"年份","type":"类型","director":"导演","reason":"为何与基准影片同类、为何适合我"}]}`;
}
