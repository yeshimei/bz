/**
 * 影院（cinema）渲染纯层·跨布局共享件（ADR-0104 markup 单源 + ADR-0105 布局分层）。
 *
 * 本文件是「原型 × 插件」markup 的共享口径层：格式化（星串/状态·类型色/相对日期兜底语义）、
 * 稳定键、海报内芯、片卡、共享弹窗（详情/表单/确认/设置——ADR-0103 §3 三风格共用）、
 * AI 荐片页与菜单/抽屉行等跨布局件全部出自这里——
 *   - 插件侧：ui.ts 直接 import（事件绑定/core 服务/数据读写留 ui.ts）；
 *   - 原型侧：dev 打成 prototype-render.js（IIFE，挂 window.BZR_cinema），壳消费同一份。
 * 布局差异层（午夜场 desk/mob 壳、侧栏、chips、视图装配）在 layouts/midnight/，
 * 域入口 render.ts 聚合两者。
 * 纯层契约（import 白名单由 tests/core/render-purity.test.ts 守卫承担，其余为层约定）：
 * 白名单仅 `../core/ui/str` 与域内 constants/types（state 仅 type-only，编译期擦除）；
 * 禁模块级可变状态（条目与视图状态显式入参）；图标一律 `<i data-lucide>` 占位，由各端 mountIcons 物化。
 * 演示数据字段与插件形状不同处取兼容回退（AI 推荐 name/meta、itemKey 回退 new:name、
 * status 中文串经 statusNum 归一——壳 localStorage 旧档与演示字段是串）。
 */
import { esc, iconSpan } from '../core/ui/str';
import {
  STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED,
  GROUP_ORDER, TYPE_COLORS, getGroupForTag, getStarString,
} from './constants';
import type { CinemaItem } from './state';

// ---------- 图标名 ----------

/** lucide 图标名（均为 Obsidian setIcon 已注册名） */
export const ICON = {
  ai: 'bot',
  stat: 'bar-chart-3',
  close: 'x',
  search: 'search',
  add: 'plus',
  edit: 'pencil',
  del: 'trash-2',
  confirm: 'alert-circle',
  back: 'chevron-left',
  grid: 'layout-grid',
  eye: 'eye',
  play: 'play',
  globe: 'globe',
} as const;

// ---------- 格式化/口径 ----------

/** 类型色（原型 TYPE_C 口径：其他 = #8a8578） */
export function typeColor(group: string): string {
  return group === '其他' ? '#8a8578' : (TYPE_COLORS[group] ?? '#8a8578');
}

/** 状态色（原型 ST_C 口径） */
export const ST_COLOR: Record<string, string> = { 想看: '#98917f', 在看: '#d97c1d', 已看: '#4a9a5c' };
/** 演示数据兼容：status 可能是中文串（评审壳 localStorage 旧档/演示字段直读），归一为数值口径 */
export function statusNum(status: number | string): number {
  if (typeof status === 'number') return status;
  return status === '想看' ? STATUS_WANT : status === '在看' ? STATUS_WATCHING : STATUS_WATCHED;
}
export function statusColor(status: number | string): string {
  const v = statusNum(status);
  return v === STATUS_WANT ? ST_COLOR['想看'] : v === STATUS_WATCHING ? ST_COLOR['在看'] : ST_COLOR['已看'];
}
export function statusText(status: number | string): string {
  const v = statusNum(status);
  return v === STATUS_WANT ? '想看' : v === STATUS_WATCHING ? '在看' : '已看';
}

/** 豆瓣搜索页 URL（无豆瓣链接条目的直达兜底） */
export function doubanSearchUrl(name: string): string {
  return 'https://movie.douban.com/search?q=' + encodeURIComponent(name);
}

// ---------- 稳定键（CM3：file.path / new:name；演示数据无 file 回退 new:name） ----------

export function itemKey(it: CinemaItem): string {
  return it.file?.path ?? `new:${it.name}`;
}
export function itemByKey(items: CinemaItem[], key: string | undefined): CinemaItem | undefined {
  if (!key) return undefined;
  return items.find((it) => itemKey(it) === key);
}

// ---------- 海报 ----------

/** 海报内芯 HTML：有图出图（onerror 兜底换首字占位），无图出首字占位（原型 .pw>.ph 同构）；
 *  资源 URL 由调用方解析（插件 vault resourcePath，壳直接给演示字段） */
export function posterInner(item: CinemaItem, url: string | null): string {
  const ph = `<div class="ph">${esc(item.name[0] ?? '')}</div>`;
  if (!url) return ph;
  return `<img loading="lazy" src="${esc(url)}" onerror="this.outerHTML='<div class=\\'ph\\'>${esc(item.name[0] ?? '')}</div>'">`;
}

/** 片卡 HTML（desk 网格与 mob 长按网格同一张卡；data-cinema-key = CM3 稳定键）；
 *  fetching=后台抓取中 → 海报区遮罩 spinner（ADR-0113） */
export function pcardHtml(it: CinemaItem, posterUrl: string | null, fetching = false): string {
  const r = it.rating;
  return `<div class="pcard" data-cinema-key="${esc(itemKey(it))}"><div class="pw">${posterInner(it, posterUrl)}${fetching ? '<div class="pw-fetch"><span class="pw-spin"></span></div>' : ''}
    ${(() => { const st = statusNum(it.status); return st !== STATUS_WATCHED ? `<span class="badge" style="background:${statusColor(st)}">${statusText(st)}</span>` : ''; })()}</div>
    <div class="pname">${esc(it.name)}</div>
    <div class="pmeta">${esc(it.year || '')}${it.year && it.director ? ' · ' : ''}${esc(it.director || '')}</div>
    <div class="pstars">${r && r > 0 ? getStarString(r) + `<span class="num">${Number(r).toFixed(1)}</span>` : '<span style="opacity:.35">未评分</span>'}</div></div>`;
}

// ---------- 视图状态快照（纯层禁读 M：筛选/排序/视图显式入参） ----------

export type CinemaViewKind = 'list' | 'ai' | 'stat';

export interface CinemaView {
  view: CinemaViewKind;
  typeFilter: string | null;
  statusFilter: string | null;
  sortMode: string;
  searchKeyword: string;
}

/** 任一筛选激活（空态文案口径） */
export function viewFiltered(view: CinemaView): boolean {
  return !!(view.typeFilter || view.statusFilter || view.searchKeyword);
}

// ---------- 共享弹窗（ADR-0103 §3：三风格共用，scoped 午夜场锚样式零复制） ----------

/** 详情弹窗内容（.cn-modal dm-*；海报 URL 由调用方解析） */
export function detailModalHtml(it: CinemaItem, posterUrl: string | null): string {
  const badge = (color: string, text: string) => `<span class="dm-chip" style="background:${color}">${esc(text)}</span>`;
  const rows: [string, string][] = ([
    ['类型', it.genre ?? ''],
    ['导演', it.director ?? ''],
    ['主演', it.actors ?? ''],
    ['制片国家/地区', it.region ?? ''],
    ['上映日期', it.year ?? ''],
    ['豆瓣评分', it.doubanRating ?? ''],
  ] as [string, string][]).filter(([, v]) => v !== '');
  return `<div class="cn-modal" style="max-width:400px;width:100%">
    <div class="dm-head"><div class="dm-poster">${posterUrl ? `<img src="${esc(posterUrl)}" onerror="this.remove()">` : ''}</div>
      <div style="flex:1;min-width:0"><div class="dm-title">${esc(it.name)}</div>
        <div class="dm-badges">${badge(typeColor(it.group), it.typeTag)}
          ${(() => { const st = statusNum(it.status); return st !== STATUS_WATCHED ? badge(statusColor(st), statusText(st)) : ''; })()}
          ${it.rating && it.rating > 0 ? `<span class="dm-stars">${getStarString(it.rating)}</span><span class="dm-rating">${Number(it.rating).toFixed(1)}</span>` : ''}
          ${it.watchDate ? `<span class="dm-date">${esc((it.watchDate || '').slice(0, 10))}</span>` : ''}</div>
        ${it.review ? `<div class="dm-review">${esc(it.review)}</div>` : ''}</div></div>
    ${rows.length ? '<div class="dm-sec">豆 瓣 信 息</div>' + rows.map(([k, v]) => `<div class="dm-kv"><span class="dm-kv-k">${k}</span><span class="dm-kv-v">${esc(v)}</span></div>`).join('') : ''}
    ${it.doubanUrl ? `<div class="dm-kv"><span class="dm-kv-k">豆瓣链接</span><span class="dm-kv-v"><a href="${esc(it.doubanUrl)}" target="_blank" rel="noopener">${esc(it.doubanUrl)}</a></span></div>` : ''}
    ${it.synopsis ? `<div class="dm-sec">简 介</div><div style="font-size:12px;line-height:1.8;color:var(--ink-2);text-align:justify">${esc(it.synopsis)}</div>` : ''}
    <div class="dm-actions"><button class="dm-btn j-similar">${iconSpan(ICON.ai)}找同类</button><button class="dm-btn j-edit">${iconSpan(ICON.edit)}编辑</button><button class="dm-btn danger j-del">${iconSpan(ICON.del)}删除</button></div>
  </div>`;
}

/** 组 → 细分 tag 映射（表单 choices 用；与原型 GROUP_SUBS 同序） */
export const GROUP_SUBS_OF: Record<string, string[]> = {
  电影: [], 剧集: ['国产剧', '美剧', '英剧', '德剧', '日剧', '韩剧', '哥伦比亚剧'], 动漫: ['日漫', '国漫', '美漫'], 纪录片: [], 公开课: ['公开课', 'TED'],
};

/** 表单可选类型（组顺序展开细分；「其他」不入表单） */
export function formAllTags(): string[] {
  const out: string[] = [];
  for (const g of GROUP_ORDER) {
    if (g === '其他') continue;
    const subs = GROUP_SUBS_OF[g];
    if (subs.length) subs.forEach((t) => out.push(t));
    else out.push(g);
  }
  return out;
}

/** 表单 choices 行（类型/状态 chip；dot 色按 attr 取类型色或状态色） */
export function formChoicesHtml(values: string[], cur: string, attr: string): string {
  return values.map((v) =>
    `<button type="button" class="f-choice-btn${v === cur ? ' is-on' : ''}" data-${attr}="${v}"><span class="dot" style="background:${attr === 'f-tag' ? typeColor(getGroupForTag(v) ?? '其他') : ST_COLOR[v] ?? '#888'}"></span>${v}</button>`).join('');
}

/** 添加/编辑表单弹窗内容（保存/切状态等接线留各端行为层） */
export function formModalHtml(opts: { editing: boolean; name: string; typeTag: string; stText: string; rating: number; review: string }): string {
  const { editing } = opts;
  const initSt = opts.stText;
  const ratingVal = opts.rating;
  return `<div class="cn-modal" style="width:100%">
    <div class="cn-modal-title">${editing ? '编辑影视' : '添加影视'}</div>
    <div class="f-field"><span class="f-label">名 称</span><input class="f-input j-name" value="${esc(opts.name)}" placeholder="影视名称"></div>
    <div class="f-field"><span class="f-label">类 型</span><div class="f-choice j-tags">${formChoicesHtml(formAllTags(), opts.typeTag, 'f-tag')}</div></div>
    <div class="f-field"><span class="f-label">状 态</span><div class="f-choice j-sts">${formChoicesHtml(['想看', '在看', '已看'], initSt, 'f-st')}</div></div>
    <div class="f-field j-rating" style="display:${initSt === '已看' ? '' : 'none'}"><span class="f-label">评 分</span>
      <div class="f-range-row"><input type="range" class="f-range j-range" min="1" max="10" step="0.1" value="${ratingVal}"><span class="f-range-val j-rval">${Number(ratingVal).toFixed(1)}</span></div></div>
    <div class="f-field j-review" style="display:${initSt === '已看' ? '' : 'none'}"><span class="f-label">影 评</span><textarea class="f-input j-review-t" placeholder="写点什么…">${esc(opts.review)}</textarea></div>
    <div class="dm-actions"><button class="dm-btn gold j-save">${editing ? '保存' : '添加'}</button></div>
  </div>`;
}

/** 删除确认弹窗内容（sticky；删除动作留行为层） */
export function confirmModalHtml(item: CinemaItem): string {
  return `<div class="cn-modal cn-confirm" style="max-width:320px;width:100%">
    <span class="cn-confirm-ic">${iconSpan(ICON.confirm)}</span>
    <div class="cn-confirm-title">删除影视</div>
    <p>确定删除「${esc(item.name)}」吗？</p>
    <div class="cn-confirm-sub">将移入系统回收站，可在回收站恢复</div>
    <div class="dm-actions"><button class="dm-btn j-cancel">取消</button><button class="dm-btn danger j-del">${iconSpan(ICON.del)}删除</button></div>
  </div>`;
}

// ---------- AI 荐片页（共享页；画像/结果状态显式入参） ----------

/** AI 推荐结果条目（插件 smartcat 返回与壳演示池字段不同，取兼容回退） */
export function aiRecName(r: any): string {
  return r?.title || r?.name || '未命名';
}
export function aiRecMeta(r: any): string {
  return r?.meta || [r?.type, r?.director].filter(Boolean).join(' · ');
}

/** AI 荐片页输入快照（running/waitMsg/error/results = M 同构；pref = 画像行；inLibrary = 查库回调） */
export interface AiPageInput {
  running: boolean;
  waitMsg: string;
  error: string | null;
  results: any[] | null;
  pref: string;
  inLibrary: (name: string) => boolean;
}

/** AI 荐片页 HTML（待机/等待/失败/结果四态；按钮钩子 data-cinema-ai-start / data-rec-add） */
export function aiPageHtml(inp: AiPageInput): string {
  if (inp.running) {
    return `<div class="ai-guide"><div class="ai-spin"></div>
      <span class="ai-ic">${iconSpan(ICON.ai)}</span><div class="ai-title">${esc(inp.waitMsg || 'AI 正在分析你的观影口味…')}</div>
      <div class="ai-sub">正在生成推荐，请稍候</div></div>`;
  }
  if (inp.error) {
    return `<div class="ai-guide"><span class="ai-ic ai-err-ic">${iconSpan(ICON.ai)}</span>
      <div class="ai-title">AI 分析失败</div><div class="ai-sub">${esc(inp.error)}</div>
      <button class="ai-start j-ai-start" data-cinema-ai-start>重试</button></div>`;
  }
  if (inp.results && inp.results.length > 0) {
    const cards = inp.results.map((rec: any, i: number) => {
      const name = aiRecName(rec);
      const inLib = inp.inLibrary(name);
      return `<div class="rec-card"><div class="rec-main"><div class="rec-name">${esc(name)}
        <a href="${esc(doubanSearchUrl(name))}" target="_blank" rel="noopener" title="在豆瓣搜索">${iconSpan(ICON.globe)}</a></div>
        <div class="rec-meta">${esc(aiRecMeta(rec))}</div><div class="rec-reason">${esc(rec?.reason || '')}</div></div>
        <button class="rec-add" data-rec-add="${i}"${inLib ? ' disabled' : ''}>${inLib ? '已在库中' : '＋ 想看'}</button></div>`;
    }).join('');
    return `<div class="ai-pref">偏好：<b>${esc(inp.pref)}</b></div>
      <div class="rec-list">${cards}</div>
      <div style="text-align:center;margin-top:14px"><button class="dm-btn j-ai-more" data-cinema-ai-start>${iconSpan(ICON.ai)}换一批</button></div>`;
  }
  return `<div class="ai-pref">偏好：<b>${esc(inp.pref)}</b></div>
    <div class="ai-guide">
      <div class="ai-title">让 AI 读懂你的片库</div>
      <div class="ai-sub">基于你的评分、影评与偏好标签生成荐片，<br>结果可直接加入想看清单</div>
      <button class="ai-start j-ai-start" data-cinema-ai-start>${iconSpan(ICON.ai)}开始推荐</button></div>`;
}

// ---------- 长按抽屉头部（动作行由 core/item-actions 统一渲染：见 ui.ts openSheet） ----------

/** 抽屉头部（海报 + 名称 + meta 行；海报 URL 由调用方解析）。动作行不再自绘——
 *  移动端抽屉与桌面菜单统一走 core/item-actions（ADR：手势与浮层单源）。 */
export function sheetHeadHtml(it: CinemaItem, posterUrl: string | null): string {
  return `<div class="cn-sheet-head">${posterUrl ? `<img class="cn-sheet-poster" src="${esc(posterUrl)}" onerror="this.remove()">` : ''}
    <div><div class="cn-sheet-name">${esc(it.name)}</div><div class="cn-sheet-sub">${esc(it.year || '')} · ${esc(it.director || it.group)} · ${statusText(it.status)}</div></div></div>`;
}
