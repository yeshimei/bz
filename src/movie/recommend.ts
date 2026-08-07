/**
 * 影视 AI 推荐（ticket 14，源码 L1419-1650 逐字移植）
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import { createAI } from '../core/ai';
import { STATUS_WATCHED, STATUS_WANT } from './constants';
import { refreshDataAndView } from './data';
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
  const tag = GROUP_DEFAULT_TAG[type] || '电影';
  let folderObj = app.vault.getAbstractFileByPath(M.folderPath);
  if (!folderObj) await app.vault.createFolder(M.folderPath);
  const filePath = `${M.folderPath}/${`《${name}》`}.md`;
  if (app.vault.getAbstractFileByPath(filePath)) {
    new Notice(`影视“${name}”已在库中`);
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
    new Notice(`✅ 已加入想看：${name}`);
    refreshDataAndView(app);
  } catch (e) {
    new Notice('创建笔记失败');
  }
}

/** 解析 AI 返回 JSON */
export function parseRecommendJson(raw: string): any[] | null {
  try {
    let cleaned = raw.trim();
    const codeBlockMatch = cleaned.match(/```json\s*([\s\S]*?)```/);
    if (codeBlockMatch) cleaned = codeBlockMatch[1].trim();
    const data = JSON.parse(cleaned);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.recommendations)) return data.recommendations;
    return null;
  } catch {
    return null;
  }
}

/** 打开 AI 推荐弹窗 */
export async function openRecommendModal(app: App): Promise<void> {
  if (M.recommendOverlay) {
    M.recommendOverlay.remove();
    M.recommendOverlay = null;
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;
    z-index: 1300;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: var(--background-primary); border-radius: 12px;
    width: 100%; max-width: 520px; max-height: 80vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 20px; flex-shrink: 0; border-bottom: 1px solid var(--background-modifier-border);
  `;
  header.innerHTML = '<span style="font-size:1.1rem;font-weight:600;">🤖 AI 推荐</span>';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ 关闭';
  closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:.9rem;box-shadow:none;';
  closeBtn.addEventListener('click', () => {
    overlay.remove();
    M.recommendOverlay = null;
  });
  header.appendChild(closeBtn);

  const statusEl = document.createElement('div');
  statusEl.style.cssText = 'color: var(--text-muted); font-size: 0.9rem; padding: 16px 20px;';
  statusEl.textContent = '🧠 正在分析你的观影历史…';

  const listContainer = document.createElement('div');
  listContainer.style.cssText = 'flex:1; overflow-y:auto; padding: 0 20px 20px;';
  listContainer.className = 'recommend-list';

  modal.appendChild(header);
  modal.appendChild(statusEl);
  modal.appendChild(listContainer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  M.recommendOverlay = overlay;

  try {
    const profile = buildTasteProfile();
    const allNames = M.items.map((i) => i.name);
    const recent = profile.recent;
    const prompt = buildRecommendPrompt(profile, recent, allNames);
    statusEl.textContent = `🧠 已分析 ${profile.total} 部观影历史，正在生成推荐…`;

    const ai = createAI();
    const raw = await ai.json(prompt, {});
    const parsed = parseRecommendJson(raw);

    if (!parsed || parsed.length === 0) {
      statusEl.textContent = '⚠️ AI 返回格式无法解析：' + String(raw).slice(0, 200);
      return;
    }

    statusEl.style.display = 'none';
    renderRecommendList(listContainer, parsed);
  } catch (e: any) {
    statusEl.textContent = '❌ 生成失败：' + (e.message || e);
    console.error(e);
  }
}

/** 渲染推荐列表 */
export function renderRecommendList(container: HTMLElement, list: any[]): void {
  container.innerHTML = '';
  list.forEach((rec) => {
    const card = document.createElement('div');
    card.style.cssText = `
      background: var(--background-secondary); border-radius: 8px;
      padding: 12px 16px; margin-bottom: 10px;
    `;

    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:6px;';
    const title = document.createElement('span');
    title.textContent = rec.title || '?';
    title.style.cssText = 'font-weight:600; font-size:1rem;';
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

    const addBtn = document.createElement('button');
    addBtn.textContent = '加入想看';
    addBtn.style.cssText = 'background:var(--interactive-accent); color:var(--text-on-accent); border:none; border-radius:4px; padding:4px 12px; cursor:pointer; font-size:.8rem; margin-bottom:8px;';
    addBtn.addEventListener('click', () => {
      if (M.appRef) quickAddWant(M.appRef, rec.title, rec.type);
    });

    const reason = document.createElement('div');
    reason.textContent = '💡 ' + (rec.reason || '');
    reason.style.cssText = 'color:var(--text-muted); font-size:.8rem;';

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
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
