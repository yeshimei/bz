/**
 * 影院（cinema）渲染纯层·跨布局共享件（ADR-0104 markup 单源 + ADR-0105 布局分层）。
 *
 * 本文件是「原型 × 插件」markup 的共享口径层：格式化（星串/状态·类型色/相对日期兜底语义）、
 * 稳定键、海报内芯、片卡、共享弹窗（详情/表单/设置——ADR-0103 §3 三风格共用；删除确认
 * 已收编 core/flow-dialog）、AI 荐片页与菜单/抽屉行等跨布局件全部出自这里——
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
import type { CardEntry, SeasonSlot, SeriesCard } from './seasons';
import { cmpByRelease, seasonsByRelease } from './seasons';

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

// ---------- 剧集按季合并（cinemaMergeSeasons；分组口径在 ./seasons 单源） ----------

/** 季段状态三态：已看=金实 / 在看=橙斜纹 / 未看·想看=空段（用户 2026-09-18 拍板口径） */
export type SeasonSegState = 'watched' | 'watching' | 'empty';

export function seasonSegState(item: CinemaItem): SeasonSegState {
  const st = statusNum(item.status);
  return st === STATUS_WATCHED ? 'watched' : st === STATUS_WATCHING ? 'watching' : 'empty';
}

/** 合并卡聚合状态（角标口径）：任一看在 → 在看；否则任一想看 → 想看；全已看 → 已看。
 *  `extra` = 特别篇：聚合口径**含**它们（电影版特别篇刚看完，badge 该亮「已看」而不是被季拉成「在看」）。 */
export function seriesStatus(seasons: SeasonSlot[], extra: CinemaItem[] = []): number {
  const states = seasons.map((s) => statusNum(s.item.status)).concat(extra.map((it) => statusNum(it.status)));
  if (states.includes(STATUS_WATCHING)) return STATUS_WATCHING;
  if (states.includes(STATUS_WANT)) return STATUS_WANT;
  return STATUS_WATCHED;
}

/** 卡片状态（rail 计数与角标共用；合并卡取聚合态） */
export function cardStatus(e: CardEntry): number {
  return e.kind === 'series' ? seriesStatus(e.seasons, e.specials) : statusNum(e.item.status);
}

/**
 * 季圆点（2026-09-18 用户二次点名形态）：**一个圆点 = 一季**，贴在**海报左下角**，
 * **不出注释文字**——原 D1 的那句「全 N 季已看 / S6 在看 · 6/7 季」按用户要求整条去掉
 * （卡片因此回到原高度，季进度也不占名字上方的行）。
 * 三态与分段条同口径：金实 = 已看 / 橙实 = 在看 / 空心描边 = 未看·想看；季号顺序即左右顺序，
 * 季多时换行且仍左对齐（方位由用户 2026-09-18 订正为左下，原写右下）。
 * 文字去掉后信息只剩颜色，故补 `role=img` + aria-label 供读屏。
 */
export function seasonDotsHtml(seasons: SeasonSlot[]): string {
  const n = { watched: 0, watching: 0, empty: 0 };
  const dots = seasons.map((s) => {
    const st = seasonSegState(s.item);
    n[st]++;
    // data-cinema-season-key：行为层据此在悬浮该圆点时把卡片正脸换成这一季（ui.ts 委托处理）
    return `<i class="${st}" data-cinema-season-key="${esc(itemKey(s.item))}"></i>`;
  }).join('');
  const label = `各季进度：共 ${seasons.length} 季，已看 ${n.watched}、在看 ${n.watching}、未看 ${n.empty}`;
  return `<span class="season-dots" role="img" aria-label="${esc(label)}">${dots}</span>`;
}

/** 卡片正脸四件（海报内芯 / 名字 / meta / 星级；`name`/`rating` 可覆盖 = 合并卡口径） */
export interface CardFacePieces { poster: string; name: string; meta: string; stars: string }

/**
 * 卡片正脸件**唯一出口**：卡面渲染与「悬浮季圆点换脸」共用它——行为层不许自己拼第二套
 * 名字/meta/星级 格式（否则悬浮前后的排版口径会漂）。
 * opts.name：合并卡正脸写归一名称（老友记）而非该季全名；opts.rating：合并卡评分取**最新已评季**
 * （正脸季可能是在看不评分），普通卡留空即用条目自身评分。
 */
export function facePiecesHtml(
  it: CinemaItem, posterUrl: string | null, opts: { name?: string; rating?: number | null } = {},
): CardFacePieces {
  const r = opts.rating !== undefined ? opts.rating : it.rating;
  return {
    poster: posterInner(it, posterUrl),
    name: esc(opts.name ?? it.name),
    meta: esc([it.year || '', it.director || ''].filter(Boolean).join(' · ')),
    stars: r && r > 0 ? starsHtml(r) + `<span class="num">${Number(r).toFixed(1)}</span>` : '<span class="star-none">未评分</span>',
  };
}

/** 星级**元素化**唯一出口（issue 403）：逐颗点亮要有可动画的「颗」，故由纯文本 ★☆ 改成五个 `<i>`。
 *  星数口径仍走 `getStarString`（含半星取整规则），文本内容逐字不变
 *  （textContent 依然是「★★★★☆」），按文本断言的消费方不受影响。
 *  `is-on` = 点亮的颗（卡片保存后逐颗点亮、表单滑杆预览都用它）。 */
export function starsHtml(rating: number): string {
  const lit = starsLit(rating);
  return Array.from({ length: 5 }, (_, i) => (i < lit ? '<i class="is-on">★</i>' : '<i>☆</i>')).join('');
}

/** 点亮的颗数（表单滑杆预览按它判断「有没有多点亮一颗」；口径同 getStarString 的 ★ 数） */
export function starsLit(rating: number): number {
  return (getStarString(rating).match(/★/g) ?? []).length;
}

/**
 * 片卡 HTML 唯一出口（desk 网格 / mob 网格 / 局部重刷共用；data-cinema-key = CM3 稳定键，
 * 合并卡为 `series:` 键）。fetching=后台抓取中 → 海报区遮罩 spinner（ADR-0113）。
 * 合并卡与普通卡同构：海报区（含季圆点）/ 名字 / meta / 星级——季圆点贴在**海报左下角**，
 * 不额外占卡片高度；正脸 = 最近观看的一季，评分取最新已评季（读作「你最近在追的那一季」）。
 * `.pw-face` 是海报内芯的独立包裹层：悬浮季圆点时行为层只换它，抓取遮罩/角标/圆点原地不动。
 */
export function cardHtml(e: CardEntry, posterUrl: string | null, fetching = false): string {
  const it = e.kind === 'series' ? e.face : e.item;
  const st = cardStatus(e);
  const p = facePiecesHtml(it, posterUrl, e.kind === 'series' ? { name: e.name, rating: e.rating } : {});
  // 深审批 B #4：卡片键盘可达——裸 div 补 tabindex/role/aria-label（片名+状态），
  // Enter/Space 开详情由 ui.ts 委托层承接（对齐 review 域不可达卡整改范式）
  const label = `${e.kind === 'series' ? e.name : it.name}，${statusText(st)}`;
  return `<div class="pcard${e.kind === 'series' ? ' pcard-series' : ''}" data-cinema-key="${esc(e.kind === 'series' ? e.key : itemKey(it))}" tabindex="0" role="button" aria-label="${esc(label)}"><div class="pw"><div class="pw-face">${p.poster}</div>${fetching ? '<div class="pw-fetch"><span class="pw-spin"></span></div>' : ''}
    ${st !== STATUS_WATCHED ? `<span class="badge" style="background:${statusColor(st)}">${statusText(st)}</span>` : ''}${e.kind === 'series' ? seasonDotsHtml(e.seasons) : ''}</div>
    <div class="pname">${p.name}</div>
    <div class="pmeta">${p.meta}</div>
    <div class="pstars">${p.stars}</div></div>`;
}

/** 单条目片卡（pcardHtml 调用点先于合并卡存在：douban-queue 测试与语义单条入口仍用此名） */
export function pcardHtml(it: CinemaItem, posterUrl: string | null, fetching = false): string {
  return cardHtml({ kind: 'single', item: it }, posterUrl, fetching);
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

/** 热门短评折叠阈值（字）：超过则收成 3 行（451/687 有值，中位 39 字、最长 465） */
const HOT_FOLD_MIN = 120;

/** 详情弹窗内容（.cn-modal dm-*；海报 URL 由调用方解析） */
export function detailModalHtml(it: CinemaItem, posterUrl: string | null): string {
  const badge = (color: string, text: string) => `<span class="dm-chip" style="background:${color}">${esc(text)}</span>`;
  const rows: [string, string][] = ([
    ['类型', it.genre ?? ''],
    ['导演', it.director ?? ''],
    ['主演', it.actors ?? ''],
    ['制片国家/地区', it.region ?? ''],
    ['上映日期', it.releaseDate ?? it.year ?? ''], // 完整年月日（year 只留年，卡片/统计用）
    ['片长', it.duration ?? ''],
    ['季集', it.seasonText ? `${it.seasonText} 集` : ''],
    ['豆瓣评分', it.doubanRating ?? ''],
  ] as [string, string][]).filter(([, v]) => v !== '');
  const hot = (it.hotComment ?? '').trim();
  const hotFold = hot.length > HOT_FOLD_MIN; // 长评收起，行为层 data-dm-fold 接线展开/收起
  return `<div class="cn-modal cn-modal--detail">
    <div class="dm-head"><div class="dm-poster">${posterUrl ? `<img src="${esc(posterUrl)}" onerror="this.remove()">` : ''}</div>
      <div style="flex:1;min-width:0"><div class="dm-title">${esc(it.name)}</div>
        <div class="dm-badges">${badge(typeColor(it.group), it.typeTag)}
          ${(() => { const st = statusNum(it.status); return st !== STATUS_WATCHED ? badge(statusColor(st), statusText(st)) : ''; })()}
          ${it.rating && it.rating > 0 ? `<span class="dm-stars">${getStarString(it.rating)}</span><span class="dm-rating">${Number(it.rating).toFixed(1)}</span>` : ''}
          ${it.watchDate ? `<span class="dm-date">${esc((it.watchDate || '').slice(0, 10))}</span>` : ''}</div>
        ${it.review ? `<div class="dm-review">${esc(it.review)}</div>` : ''}</div></div>
    ${rows.length ? '<div class="dm-sec">豆 瓣 信 息</div>' + rows.map(([k, v]) => `<div class="dm-kv"><span class="dm-kv-k">${k}</span><span class="dm-kv-v">${esc(v)}</span></div>`).join('') : ''}
    ${it.doubanUrl ? `<div class="dm-kv"><span class="dm-kv-k">豆瓣链接</span><span class="dm-kv-v"><a href="${esc(it.doubanUrl)}" target="_blank" rel="noopener">${esc(it.doubanUrl)}</a></span></div>` : ''}
    ${hot ? `<div class="dm-sec">热 门 短 评</div><div class="dm-quote${hotFold ? ' is-fold' : ''}" data-dm-quote>${esc(hot)}</div>${hotFold ? `<button type="button" class="dm-fold j-quote-fold" data-dm-fold>展开全文（${hot.length} 字）</button>` : ''}` : ''}
    ${it.synopsis ? `<div class="dm-sec">简 介</div><div class="dm-synopsis">${esc(it.synopsis)}</div>` : ''}
    <div class="dm-actions"><button class="dm-btn j-similar">${iconSpan(ICON.ai)}找同类</button><button class="dm-btn j-edit">${iconSpan(ICON.edit)}编辑</button><button class="dm-btn danger j-del">${iconSpan(ICON.del)}删除</button></div>
  </div>`;
}

// ---------- 合并卡详情弹窗（D1）：头部 + 各季明细行 ----------

/** 合并卡条目计数文案（`共 N 季 · M 部电影`）：季按季数；并入的条目**按各自类型**（细分 tag：
 *  电影 / 纪录片 / 日漫…）归类计数，同类合并成一个数字——2026-09-20 用户指出笼统写「特别篇」
 *  不如写对应类型（「2 部电影」一眼知道多出来的是什么）。类型为空回落所属组。
 *  卡片详情弹窗头与移动端抽屉头**同源**，禁各写一遍。 */
export function seriesCountsText(card: SeriesCard): string {
  const byType = new Map<string, number>();
  for (const it of card.specials) {
    const t = it.typeTag || it.group;
    byType.set(t, (byType.get(t) ?? 0) + 1);
  }
  const extra = [...byType].map(([t, n]) => `${n} 部${t}`).join(' · ');
  return `共 ${card.seasons.length} 季` + (extra ? ` · ${extra}` : '');
}

/**
 * 合并卡详情弹窗内容。头部 = 正脸（最近看的）海报 + 片名 + 共 N 季（并入条目按类型再带
 * 「· M 部电影」）+ 聚合状态 + 最新评分；正文 = 明细行，**特别篇不单开区段**
 * （2026-09-20 用户拍板：不区分季与特别篇；同日拍板整列一个口径——各季与特别篇
 * **统一按上映日期升序**，不再是「先排季、特别篇顺在其后」），行内
 * `data-cinema-season-key` = 行内条目键，点击进该条目详情、右键 / 长按出该条目的动作——
 * 季行与特别篇行同一套结构与同一套绑定。
 * **不放分节小标题与操作提示**（用户 2026-09-20 点名去掉，弹窗只留头部 + 行）。
 * **不放 找同类/编辑/删除**：三者都作用在一条笔记上，合集级无落点（口径见 ADR-0168）；
 * 行级动作落在行上。
 */
export function seriesDetailModalHtml(card: SeriesCard, posterOf: (it: CinemaItem) => string | null): string {
  const face = card.face;
  const url = posterOf(face);
  const st = seriesStatus(card.seasons, card.specials);
  const badge = (color: string, text: string) => `<span class="dm-chip" style="background:${color}">${esc(text)}</span>`;
  const thumb = (it: CinemaItem): string => {
    const t = posterOf(it);
    return `<div class="s-thumb">${t ? `<img src="${esc(t)}" alt="" onerror="this.remove()">` : ''}</div>`;
  };
  const rowOf = (it: CinemaItem, cls: string): string => {
    const sub = [
      it.group !== card.group ? esc(it.group) : '', // 特别篇常是电影/纪录片：标出组，免得看着像「某一季」
      it.watchDate ? `观影 ${esc(it.watchDate.slice(0, 10))}` : '',
      it.seasonText ? esc(it.seasonText) : '', // 深审批 B #6：季集原文自带单位（「2季」），不再拼「 集」出「2季 集」叠字
    ].filter(Boolean).join(' · ');
    const r = it.rating;
    return `<div class="s-row${cls}" data-cinema-season-key="${esc(itemKey(it))}">${thumb(it)}
      <div class="s-mid"><div class="s-name">${esc(it.name)}</div>${sub ? `<div class="s-sub">${sub}</div>` : ''}</div>
      <span class="s-chip" style="background:${statusColor(it.status)}">${statusText(it.status)}</span>
      <span class="s-rate${r && r > 0 ? '' : ' none'}">${r && r > 0 ? Number(r).toFixed(1) : '—'}</span></div>`;
  };
  // 行序 = **各季与特别篇统一按上映日期升序**（最早在前）——2026-09-20 用户拍板：不再
  // 「先排季、特别篇顺在其后」，整列一个口径看上映先后。缺上映日期的排最后；日期相同
  // 季在前（季内按季号）、特别篇之间保库内原序（sort 稳定）。
  // 整列包一层 .s-list：原来头部与首行之间的间隔由「各 季 明 细」小标题的 border-top + margin 顶着，
  // 小标题去掉后首行贴住头部（2026-09-20 用户看图指出），间隔改由列表自己给（styles.css）。
  const rowSrc: { it: CinemaItem; special: boolean }[] = [
    ...seasonsByRelease(card.seasons).map((s) => ({ it: s.item, special: false })),
    ...card.specials.map((it) => ({ it, special: true })),
  ].sort((a, b) => cmpByRelease(a.it, b.it) || (a.special === b.special ? 0 : a.special ? 1 : -1));
  const rows = rowSrc.map(({ it, special }) => rowOf(it, special ? ' s-row-special' : '')).join('');
  return `<div class="cn-modal cn-modal--detail">
    <div class="dm-head"><div class="dm-poster">${url ? `<img src="${esc(url)}" onerror="this.remove()">` : ''}</div>
      <div style="flex:1;min-width:0"><div class="dm-title">${esc(card.name)}<span class="dm-n">${seriesCountsText(card)}</span></div>
        <div class="dm-badges">${badge(typeColor(card.group), face.typeTag)}
          ${st !== STATUS_WATCHED ? badge(statusColor(st), statusText(st)) : ''}
          ${card.rating && card.rating > 0 ? `<span class="dm-stars">${getStarString(card.rating)}</span><span class="dm-rating">${Number(card.rating).toFixed(1)}</span>` : ''}
          ${face.watchDate ? `<span class="dm-date">${esc(face.watchDate.slice(0, 10))}</span>` : ''}</div></div></div>
    <div class="s-list">${rows}</div>
  </div>`;
}

/** 组 → 细分 tag 映射（表单 choices 用；与原型 GROUP_SUBS 同序） */
export const GROUP_SUBS_OF: Record<string, string[]> = {
  电影: [], 剧集: ['国产剧', '美剧', '英剧', '德剧', '日剧', '韩剧', '哥伦比亚剧'], 动漫: ['日漫', '国漫', '美漫'], 纪录片: [], 公开课: ['公开课'],
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

/** 添加/编辑表单弹窗内容（保存 / 解析 / 翻转等接线留行为层）。
 *  新增态 = **双面卡片**（issue 395）：正面只有名称 + 状态，点「解析」拉豆瓣 → 翻到背面看全部信息；
 *  编辑态 = 单面到底：已有笔记不必重新解析，全字段直出 + 保存。 */
export function formModalHtml(opts: { editing: boolean; name: string; typeTag: string; stText: string; rating: number; review: string }): string {
  const { editing } = opts;
  const initSt = opts.stText;
  const ratingVal = opts.rating;
  const nameField = `<div class="f-field"><span class="f-label">名 称</span><input class="f-input j-name" value="${esc(opts.name)}" placeholder="影视名称"></div>`;
  const stField = `<div class="f-field"><span class="f-label">状 态</span><div class="f-choice j-sts">${formChoicesHtml(['想看', '在看', '已看'], initSt, 'f-st')}</div></div>`;
  const ratingField = `<div class="f-field j-rating" style="display:${initSt === '已看' ? '' : 'none'}"><span class="f-label">评 分</span>
      <div class="f-range-row"><input type="range" class="f-range j-range" min="1" max="10" step="0.1" value="${ratingVal}"><span class="f-range-val j-rval">${Number(ratingVal).toFixed(1)}</span><span class="f-stars j-stars" data-lit="${starsLit(ratingVal)}">${starsHtml(ratingVal)}</span></div></div>`;
  const reviewField = `<div class="f-field j-review" style="display:${initSt === '已看' ? '' : 'none'}"><span class="f-label">影 评</span><textarea class="f-input j-review-t" placeholder="写点什么…">${esc(opts.review)}</textarea></div>`;
  if (editing) {
    return `<div class="cn-modal" style="width:100%">
    <div class="cn-modal-title">编辑影视</div>
    ${nameField}
    <div class="f-field"><span class="f-label">类 型</span><div class="f-choice j-tags">${formChoicesHtml(formAllTags(), opts.typeTag, 'f-tag')}</div></div>
    ${stField}${ratingField}${reviewField}
    <div class="dm-actions"><button class="dm-btn gold j-save">保存</button></div>
  </div>`;
  }
  // 解析按钮：转圈与文案分开两个节点——行为层改文案若用 textContent 会连转圈一起抹掉。
  // 背面不再有「返回」按钮（2026-09-21 用户拍板去掉：解析完就是最终形态，没有回头路要留）
  return `<div class="cn-modal cn-modal--flip" style="width:100%">
    <div class="form-flip j-flip">
      <div class="form-face form-face--front">
        <div class="cn-modal-title">添加影视</div>
        ${nameField}${stField}
        <div class="dm-actions"><button class="dm-btn gold j-parse"><span class="f-spin"></span><span class="j-parse-text">解析</span></button></div>
      </div>
      <div class="form-face form-face--back">
        <div class="j-back"></div>
        <div class="dm-actions"><button class="dm-btn gold j-save">保存</button></div>
      </div>
    </div>
  </div>`;
}

/** 卡片背面的豆瓣字段（数据来自豆瓣查询，**尚未落盘**——展示的是「即将写入」的值） */
export interface FormPreviewData {
  posterUrl: string;
  title: string;
  typeTag: string;
  genre: string;
  director: string;
  actors: string;
  region: string;
  releaseDate: string;
  duration: string;
  doubanRating: string;
  doubanUrl: string;
  hotComment: string;
}

/** 背面里需要由行为层回填的当前值（分类与状态可点改，见下方下拉） */
export interface FormBackOpts {
  typeTag: string;
  stText: string;
  /** 分类仍在判定中（2026-09-21）：徽标显示占位骨架，出结果后由行为层就地替换 */
  classifying?: boolean;
}

/** 分类徽标：判定中显示占位骨架（不预告默认值，避免「先看到一个错值再变」），
 *  出结果后可点开候选清单。渲染与就地更新共用同一份 markup（行为层别手拼第二份）。 */
export function formTagChipHtml(typeTag: string, pending = false): string {
  if (pending) return '<span class="dm-chip dm-chip--pick is-pending"><span class="dm-skel"></span></span>';
  return `<button type="button" class="dm-chip dm-chip--pick" data-pick="tag" style="background:${typeColor(getGroupForTag(typeTag) ?? '其他')}">${esc(typeTag)}</button>`;
}

/** 状态徽标：与分类同形制、同一套 dm-pick 机制 */
export function formStChipHtml(stText: string): string {
  return `<button type="button" class="dm-chip dm-chip--pick" data-pick="st" style="background:${ST_COLOR[stText] ?? '#888'}">${esc(stText)}</button>`;
}

/** 卡片背面（issue 395）：**与详情弹窗同形制**（dm-head + 豆瓣信息 + 热门短评）。
 *  唯一区别：详情弹窗的类型/状态是只读徽标，这里是可点下拉（点击展开候选，选中即回填）。
 *  不放「我的记录」段（2026-09-21 用户拍板去掉：评分/影评不在添加时填）。
 *  徽标不带小三角（2026-09-21 用户拍板：能点就够了，不额外加装饰性指示）。 */
export function formBackHtml(d: FormPreviewData | null, o: FormBackOpts): string {
  if (!d) return '';
  const rows = ([
    ['豆瓣类型', d.genre],
    ['导演', d.director],
    ['主演', d.actors],
    ['制片国家/地区', d.region],
    ['上映日期', d.releaseDate],
    ['片长', d.duration],
    ['豆瓣评分', d.doubanRating],
  ] as [string, string][]).filter(([, v]) => v !== '');
  const hot = (d.hotComment ?? '').trim();
  const tagItems = formAllTags()
    .map((t) => `<button type="button" class="dm-pick-item${t === o.typeTag ? ' is-on' : ''}" data-f-tag="${esc(t)}"><span class="dot" style="background:${typeColor(getGroupForTag(t) ?? '其他')}"></span>${esc(t)}</button>`)
    .join('');
  const stItems = ['想看', '在看', '已看']
    .map((s) => `<button type="button" class="dm-pick-item${s === o.stText ? ' is-on' : ''}" data-f-st="${esc(s)}"><span class="dot" style="background:${ST_COLOR[s] ?? '#888'}"></span>${esc(s)}</button>`)
    .join('');
  // 海报：骨架垫在底下，img 加载完加 is-ready 淡入（onload 顺带给 .dm-poster 收掉骨架动画）
  return `
    <div class="dm-head">
      <div class="dm-poster">${d.posterUrl ? `<img src="${esc(d.posterUrl)}" alt="" onload="this.parentNode.classList.add('is-ready')" onerror="this.remove()">` : ''}</div>
      <div style="flex:1;min-width:0">
        <div class="dm-title">${esc(d.title)}</div>
        <div class="dm-badges">${formTagChipHtml(o.typeTag, !!o.classifying)}${formStChipHtml(o.stText)}</div>
      </div>
    </div>
    <div class="dm-pick-list" data-pick-list="tag">${tagItems}</div>
    <div class="dm-pick-list" data-pick-list="st">${stItems}</div>
    ${rows.length ? '<div class="dm-sec">豆 瓣 信 息</div>' + rows.map(([k, v]) => `<div class="dm-kv"><span class="dm-kv-k">${k}</span><span class="dm-kv-v">${esc(v)}</span></div>`).join('') : ''}
    ${d.doubanUrl ? `<div class="dm-kv"><span class="dm-kv-k">豆瓣链接</span><span class="dm-kv-v"><a href="${esc(d.doubanUrl)}" target="_blank" rel="noopener">${esc(d.doubanUrl)}</a></span></div>` : ''}
    ${hot ? `<div class="dm-sec">热 门 短 评</div><div class="dm-quote">${esc(hot)}</div>` : ''}
  `;
}

// 删除确认弹窗已收编 core/flow-dialog（一致审查#1）：行为层 openConfirm 走 openFlowDialog +
// 域皮 `cn-skin bz-cinema-flow-dialog`（styles.css 映射段），confirmModalHtml 退役。

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

/** 合并卡抽屉头部（同 class 同构，数据取卡片自身）：卡片没有「哪一个条目」可指——
 *  头部写归一剧名 + `共 N 季 · M 部电影` 计数（正脸季海报），与卡片详情弹窗头部同一套计数文案。 */
export function seriesSheetHeadHtml(card: SeriesCard, posterUrl: string | null): string {
  return `<div class="cn-sheet-head">${posterUrl ? `<img class="cn-sheet-poster" src="${esc(posterUrl)}" onerror="this.remove()">` : ''}
    <div><div class="cn-sheet-name">${esc(card.name)}</div><div class="cn-sheet-sub">${esc(seriesCountsText(card))}</div></div></div>`;
}
