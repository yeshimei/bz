/**
 * 影视 AI 推荐（ticket 14，源码 L1419-1650 逐字移植）
 */
import type { App } from 'obsidian';
import { pad2 } from '../core/utils';
import { notice, notify } from '../core/notice';
import { createAI } from '../core/ai';
import { STATUS_WATCHED } from './constants';
import { refreshDataAndView } from './data';
import { watchPosterFetch } from './poster-watch';
import { M } from './state';

const GROUP_DEFAULT_TAG: Record<string, string> = {
  电影: '电影',
  剧集: '国产剧',
  动漫: '日漫',
  纪录片: '纪录片',
  公开课: '公开课',
};

/** 构建口味画像 */
export function buildTasteProfile(): any {
  const watched = M.items.filter((i) => i.status === STATUS_WATCHED && i.rating !== null && i.rating > 0);
  const weight = (i: any) => i.rating;

  const topBy = (key: (i: any) => string | null) => {
    const acc: Record<string, number> = {};
    watched.forEach((i) => {
      const val = key(i);
      if (!val) return;
      String(val)
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((part) => {
          acc[part] = (acc[part] || 0) + weight(i);
        });
    });
    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k, v]) => `${k}×${v.toFixed(1)}`);
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

/** 构建推荐提示词（逐字） */
export function buildRecommendPrompt(profile: any, recent: string[], allNames: string[]): string {
  return `你是资深影视推荐官。用户已看 ${profile.total} 部影视，以下是其口味画像（个人评分1~5加权统计，数值为加权分）：
品类分布：${profile.groups.join('、') || '无'}
类型偏好：${profile.genres.join('、') || '无'}
导演偏好：${profile.directors.join('、') || '无'}
主演偏好：${profile.actors.join('、') || '无'}
地区偏好：${profile.regions.join('、') || '无'}
最近看的10部：${recent.join('；')}

请基于画像推荐 5 部用户可能喜欢的、且不在排除清单中的影视（电影/剧集/动漫/纪录片/公开课均可）。推荐理由必须具体引用画像中的偏好信号（如“你偏爱X导演的Y风格”）。只推荐真实存在的影视，避免编造。

排除清单（不要推荐这些）：${allNames.join('、')}

严格输出 JSON（不要输出其他内容）：{"recommendations":[{"title":"片名","year":"年份","director":"导演","type":"电影|剧集|动漫|纪录片|公开课","reason":"推荐理由"}]}`;
}

/** 一键加入想看（直接建笔记，不弹确认表单） */
export async function quickAddWant(app: App, name: string, type: string): Promise<void> {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    // AI 返回条目缺片名时不建文件（《.md》空名笔记），仅提示跳过
    notice('推荐条目缺少片名，已跳过加入想看');
    return;
  }
  const tag = GROUP_DEFAULT_TAG[type] || '电影';
  let folderObj = app.vault.getAbstractFileByPath(M.folderPath);
  if (!folderObj) await app.vault.createFolder(M.folderPath);
  const filePath = `${M.folderPath}/${`《${trimmedName}》`}.md`;
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
    const newFile = await app.vault.create(filePath, content);
    notice(`已加入想看：${trimmedName}`, 'success');
    refreshDataAndView(app);
    // 常驻 progress 通知：外部 watcher 抓海报/豆瓣信息，海报字段填充后原地更新为已完成
    const handle = notify('正在获取海报和豆瓣信息…', { type: 'progress' });
    watchPosterFetch(app, newFile, handle);
  } catch (e) {
    notice('创建笔记失败', 'error');
  }
}

/** 解析 AI 返回 JSON（兼容裸数组 / recommendations / similar / similar_movies / suggestions / items / movies 键） */
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

/**
 * AI 荐片（动态通知模式）：点击发进度通知（不弹窗、不阻塞，用户可继续干别的），
 * 完成后通知原地更新为成功，并自动弹出推荐结果界面。遮罩点击/ESC 关闭。
 * 动态消息与「找同类」同一套文案模板（仅标题区分）。
 */
export async function runAIRecommend(app: App): Promise<void> {
  const handle = notify('AI 分析中…', { type: 'progress' });
  try {
    const profile = buildTasteProfile();
    const allNames = M.items.map((i) => i.name);
    const prompt = buildRecommendPrompt(profile, profile.recent, allNames);
    handle.setMessage(`已分析 ${profile.total} 部观影历史，正在生成推荐…`);
    const ai = createAI();
    const raw = await ai.json(prompt, {});
    const parsed = parseRecommendJson(raw);
    if (!parsed || parsed.length === 0) {
      handle.setType('error');
      handle.setMessage('AI 分析失败：返回格式无法解析');
      return;
    }
    handle.setType('success');
    handle.setMessage(`AI 分析完成，共推荐 ${parsed.length} 部`);
    showResultWindow(app, '🤖 AI 荐片', parsed);
  } catch (e: any) {
    handle.setType('error');
    handle.setMessage('AI 分析失败：' + (e.message || e));
  }
}

/**
 * 找同类（动态通知模式）：以基准影片 + 已看库调 AI，点击只发进度通知，
 * 完成后自动弹出结果窗口（与 AI 荐片同一窗口与消息模板）。
 */
export async function runSimilarRecommend(item: any, app: App): Promise<void> {
  const handle = notify('AI 分析中…', { type: 'progress' });
  try {
    const watched = M.items.filter((i) => i.status === STATUS_WATCHED && i.name !== item.name);
    handle.setMessage(`已分析 ${M.items.length} 部影视，正在生成同类推荐…`);
    const ai = createAI();
    const raw = await ai.json(buildSimilarPrompt(item, watched), {});
    const parsed = parseRecommendJson(raw);
    if (!parsed || parsed.length === 0) {
      handle.setType('error');
      handle.setMessage('AI 分析失败：返回格式无法解析');
      return;
    }
    handle.setType('success');
    handle.setMessage(`AI 分析完成，共推荐 ${parsed.length} 部`);
    showResultWindow(app, `找同类 ·《${item.name}》`, parsed);
  } catch (e: any) {
    handle.setType('error');
    handle.setMessage('AI 分析失败：' + (e.message || e));
  }
}

/** 找同类提示词：以基准影片 + 已看库为输入，要求推荐未看过的同类佳作（输出结构与其他 AI 保持一致） */
export function buildSimilarPrompt(item: any, watched: any[]): string {
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

/**
 * 统一推荐结果窗口（AI 荐片 / 找同类共用）：居中卡片、头部行 + ✕ 关闭（bz-win-close）、
 * 内容区滚动隐藏滚动条；遮罩点击/ESC 关闭。与主窗口视觉规范一致。
 */
export function showResultWindow(app: App, title: string, list: any[]): void {
  if (M.recommendOverlay) {
    M.recommendOverlay.remove();
    M.recommendOverlay = null;
  }

  const overlay = document.createElement('div');
  overlay.className = 'bz-movie-overlay--1300'; // e3：z-index 由根样式 .bz-movie-overlay--* 档位类提供
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: var(--background-primary); border-radius: 14px;
    width: min(94vw, 680px);
    max-height: 84vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 12px 40px rgba(0,0,0,0.28);
  `;

  const header = document.createElement('div');
  header.className = 'bz-win-head';
  const titleEl = document.createElement('span');
  titleEl.style.cssText = 'font-size: 1.05rem; font-weight: 600;';
  titleEl.textContent = title;
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.className = 'bz-win-close';
  closeBtn.addEventListener('click', () => {
    overlay.remove();
    M.recommendOverlay = null;
  });
  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const listContainer = document.createElement('div');
  listContainer.className = 'recommend-list';
  listContainer.style.cssText = 'flex:1; overflow-y:auto; padding: 14px 16px 18px; scrollbar-width: none;';

  modal.appendChild(header);
  modal.appendChild(listContainer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  M.recommendOverlay = overlay;
  // 点遮罩 = 关闭（用户拍板：小弹窗靠遮罩关闭）
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      M.recommendOverlay = null;
    }
  });

  renderRecommendList(listContainer, list);
}


/** 渲染推荐列表 */
export function renderRecommendList(container: HTMLElement, list: any[]): void {
  container.innerHTML = '';
  list.forEach((rec) => {
    const card = document.createElement('div');
    card.style.cssText = `
      background: var(--background-secondary); border-radius: 10px;
      padding: 14px 16px; margin-bottom: 12px;
    `;

    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex; align-items:baseline; gap:8px; margin-bottom:6px; flex-wrap:wrap;';
    const title = document.createElement('span');
    title.textContent = rec.title || '?';
    title.style.cssText = 'font-weight:600; font-size:0.95rem;';
    const year = document.createElement('span');
    year.textContent = rec.year || '';
    year.style.cssText = 'color:var(--text-muted); font-size:.8rem;';
    const type = document.createElement('span');
    type.textContent = rec.type || '';
    type.style.cssText = 'color:var(--text-muted); font-size:.8rem;';
    titleRow.appendChild(title);
    titleRow.appendChild(year);
    titleRow.appendChild(type);

    const director = document.createElement('div');
    director.textContent = '导演：' + (rec.director || '');
    director.style.cssText = 'color:var(--text-muted); font-size:.8rem; margin-bottom:8px;';

    // 缺片名条目禁用「加入想看」，避免创建《.md》空名笔记
    const hasTitle = typeof rec.title === 'string' && !!rec.title.trim();
    const addBtn = document.createElement('button');
    addBtn.textContent = '加入想看';
    if (!hasTitle) {
      addBtn.disabled = true;
      addBtn.title = '缺少片名，无法加入想看';
    }
    addBtn.style.cssText = 'background:var(--interactive-accent); color:var(--text-on-accent); border:none; border-radius:4px; padding:4px 12px; cursor:pointer; font-size:.8rem; margin-bottom:8px;';
    addBtn.addEventListener('click', () => {
      if (!hasTitle) return;
      if (M.appRef) quickAddWant(M.appRef, rec.title, rec.type);
    });

    const reason = document.createElement('div');
    reason.textContent = '💡 ' + (rec.reason || '');
    reason.style.cssText = 'color:var(--text-muted); font-size:.8rem; line-height:1.6;';

    card.appendChild(titleRow);
    card.appendChild(director);
    card.appendChild(addBtn);
    card.appendChild(reason);
    container.appendChild(card);
  });
}


/** 本地时间 YYYY-MM-DD HH:mm:ss（moment 语义） */
function localNowFormat(): string {
  const d = new Date();
  const p = pad2;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
