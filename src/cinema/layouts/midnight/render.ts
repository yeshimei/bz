/**
 * 午夜场布局（ADR-0105 布局差异层）：desk/mob 双壳骨架、侧栏 rail、移动 chips、
 * 视图装配（列表/AI/分析页头）与渲染胶水。共享口径与共享弹窗/AI 页见 ../../shared.ts；
 * 本文件只写「午夜场」这一布局的排布差异（gazette/booth 风格延后，清单与设置键已备）。
 * 纯层契约同 shared：禁 obsidian/core 服务、禁模块级可变状态（数据与视图状态显式入参）、
 * 图标 `<i data-lucide>` 占位。jsdom 无布局值依赖（本层不读 offsetWidth 等布局口径）。
 */
import { esc, iconSpan } from '../../../core/ui/str';
import { GROUP_ORDER } from '../../constants';
import {
  ICON, ST_COLOR, statusText, typeColor,
  cardHtml, cardStatus, viewFiltered,
  type CinemaView,
} from '../../shared';
import { cardFace, cardGroup, type CardEntry } from '../../seasons';
import type { CinemaItem } from '../../state';

// ---------- 壳骨架 ----------

/** desk 壳（900×620：左侧栏 + 主视图；j-groups/j-status/j-view 为渲染挂点） */
export function midnightDeskHtml(): string {
  return `<section class="bz-cinema--midnight" data-cinema-root="midnight">
    <div class="d-body">
      <aside class="d-rail">
        <div class="rail-brand"><h1>影院</h1><div class="en">CINEMA CLUB</div></div>
        <div class="rail-sec">
          <div class="rail-label">类 型</div>
          <div class="j-groups"></div>
          <div class="rail-label" style="padding-top:14px">状 态</div>
          <div class="j-status"></div>
        </div>
        <div class="rail-foot">
          <button class="rail-item j-tool" data-tool="ai">${iconSpan(ICON.ai)}AI 荐片</button>
          <button class="rail-item j-tool" data-tool="stat">${iconSpan(ICON.stat)}观影分析</button>
        </div>
      </aside>
      <div class="d-main j-view"></div>
    </div>
  </section>`;
}

/** mob 壳（移动端独立自绘；j-mtitle/j-mcnt/j-chips/j-mq/j-mview 为渲染挂点） */
export function midnightMobHtml(): string {
  return `<section class="mob bz-cinema--midnight bz-panel-mtop" data-cinema-root="midnight">
    <div class="m-head"><h2 class="j-mtitle">全部</h2><span class="cnt j-mcnt"></span>
      <span class="m-acts">
        <button class="add j-madd bz-touch-target bz-touch-target--lg" data-cinema-add title="添加影片">${iconSpan(ICON.add)}</button>
        <button class="m-tool j-mai bz-touch-target bz-touch-target--lg" title="AI 荐片">${iconSpan(ICON.ai)}</button>
        <button class="m-tool j-mstat bz-touch-target bz-touch-target--lg" title="观影分析">${iconSpan(ICON.stat)}</button>
        <button class="m-tool j-mclose bz-touch-target bz-touch-target--lg" title="关闭">${iconSpan(ICON.close)}</button>
      </span>
    </div>
    <div class="m-chips j-chips"></div>
    <label class="m-search">${iconSpan(ICON.search)}<input class="j-mq" placeholder="搜索片名、类型、导演、主演、影评…"><button type="button" class="q-clear" data-cinema-clear title="清空搜索" aria-label="清空搜索" hidden>${iconSpan(ICON.close)}</button></label>
    <div class="m-scroll j-mview"></div>
  </section>`;
}

// ---------- 侧栏 / chips ----------

const railRow = (on: boolean, attr: string, color: string, name: string, n: number) =>
  `<button class="rail-item${on ? ' is-on' : ''}" ${attr}><span class="dot" style="background:${color}"></span>${esc(name)}<span class="n">${n}</span></button>`;

/** 侧栏 rail（类型 + 状态两组；计数 = **卡片**数——合并开后「剧集 9」与网格 9 张卡对得上，
 *  不是「库里 33 个季笔记」那种点了对不上的数）。
 *  ai/stat 页 rail 整体熄灭（含「全部」）——它是列表视图的筛选控件，非列表页不表达选中 */
export function railHtml(cards: CardEntry[], view: CinemaView): { groups: string; status: string } {
  const listOn = view.view === 'list';
  const g: Record<string, number> = {};
  const c: Record<string, number> = { 想看: 0, 在看: 0, 已看: 0 };
  cards.forEach((e) => { const grp = cardGroup(e); g[grp] = (g[grp] || 0) + 1; c[statusText(cardStatus(e))]++; });
  let groups = railRow(listOn && !view.typeFilter && !view.statusFilter, 'data-g="全部"', 'var(--gold)', '全部', cards.length);
  for (const name of GROUP_ORDER) {
    groups += railRow(listOn && view.typeFilter === name && !view.statusFilter, `data-g="${name}"`, typeColor(name), name, g[name] || 0);
  }
  let status = '';
  for (const s of ['想看', '在看', '已看'] as const) {
    status += railRow(listOn && view.statusFilter === s, `data-s="${s}"`, ST_COLOR[s], s, c[s]);
  }
  return { groups, status };
}

/** 移动端筛选 chips（全部/类型/状态横滑条；ai/stat 页同 rail 口径整体熄灭）。
 *  `bz-touch-target--lg`：触屏（pointer:coarse）::after 外扩热区（core 单源，视觉零改动，
 *  绝对定位外扩不触发横滑容器额外滚动宽度；desk 的 rail/seg 等鼠标惯用件不挂）。 */
export function chipsHtml(view: CinemaView): string {
  const listOn = view.view === 'list';
  let html = `<button class="chip bz-touch-target--lg${listOn && !view.typeFilter && !view.statusFilter ? ' is-on' : ''}" data-c="all">${iconSpan(ICON.grid)}全部</button>`;
  for (const name of GROUP_ORDER) {
    html += `<button class="chip bz-touch-target--lg${listOn && view.typeFilter === name && !view.statusFilter ? ' is-on' : ''}" data-c="${name}">${name}</button>`;
  }
  for (const s of ['想看', '在看', '已看'] as const) {
    html += `<button class="chip bz-touch-target--lg${listOn && view.statusFilter === s ? ' is-on' : ''}" data-s="${s}">${s}</button>`;
  }
  return html;
}

// ---------- 视图装配 ----------

/** 空态页（筛选无命中 / 库空两态） */
export function emptyPageHtml(filtered: boolean): string {
  return `<div class="cn-empty-page"><div class="big">${filtered ? '无匹配影片' : '影片空空如也'}</div>
    ${filtered ? '<button class="dm-btn j-clear" data-cinema-clear style="margin-top:6px">清空筛选</button>' : '<span style="font-size:11.5px">点右上「添加影片」开始记录</span>'}</div>`;
}

/** ai/stat 页头（返回钮 + 标题 + 计数） */
export function spHeadHtml(title: string, cnt: string): string {
  return `<div class="sp-head"><button class="sp-back j-back">${iconSpan(ICON.back)}</button><span class="sp-title">${esc(title)}</span><span class="sp-cnt j-spcnt">${cnt}</span></div>`;
}

/** 渲染输入快照（一次渲染的全部数据与回调，显式入参——纯层禁读模块态） */
export interface MidnightRenderInput {
  /** 全量卡片条目（rail/chips 计数口径；合并开启时剧集多季合一张） */
  allCards: CardEntry[];
  /** 当前展示卡片条目（筛选 + 排序 + 按季合并后，与网格逐张对应） */
  cards: CardEntry[];
  /** 视图状态快照 */
  view: CinemaView;
  /** 网格每行列数（插件读设置钳制，壳给演示值） */
  cols: number;
  /** 列表标题（组 + 状态叠加口径，listTitle） */
  title: string;
  /** 已看部数（分析页头计数；分析页仍按笔记条数统计，不随按季合并变） */
  watchedCount: number;
  /** AI 荐片页 HTML（shared aiPageHtml 产物） */
  aiHtml: string;
  /** AI 结果部数（页头计数；null = 无结果） */
  aiCount: number | null;
  /** 观影分析页 HTML（analysis.buildAnalysisHTML / 壳自绘演示统计） */
  statHtml: string;
  /** 海报资源解析（插件 vault resourcePath，壳给演示字段直读） */
  poster: (it: CinemaItem) => string | null;
  /** 后台抓取中（插件 douban-queue pending 集合，壳给演示 false） */
  fetching?: (it: CinemaItem) => boolean;
}

/** 卡片条目 → HTML（正脸解析留在渲染层：合并卡拿 face 季的海报与抓取态） */
function cardsHtml(cards: CardEntry[], inp: MidnightRenderInput): string {
  return cards.map((e) => {
    const face = cardFace(e);
    return cardHtml(e, inp.poster(face), inp.fetching?.(face) ?? false);
  }).join('');
}

/** 列表视图头 + 工具行（d-head/d-tools；添加钮钩子 data-cinema-add） */
export function listHeadHtml(inp: MidnightRenderInput): string {
  return `<div class="d-head"><h2 class="j-title">${esc(inp.title)}</h2><span class="cnt j-cnt">· ${inp.cards.length} 部</span>
    <button class="add j-add" data-cinema-add>${iconSpan(ICON.add)}添加影片</button></div>`;
}
export function listToolsHtml(view: CinemaView): string {
  return `<div class="d-tools"><label class="d-search">${iconSpan(ICON.search)}<input class="j-q" placeholder="搜索片名、类型、导演、主演、影评…" value="${esc(view.searchKeyword)}"><button type="button" class="q-clear" data-cinema-clear title="清空搜索" aria-label="清空搜索"${view.searchKeyword ? '' : ' hidden'}>${iconSpan(ICON.close)}</button></label>
    <div class="seg j-sort">${([['date', '最近观看'], ['created', '加入先后'], ['rating', '按评分']] as const).map(([k, l]) => `<button data-k="${k}" class="${view.sortMode === k ? 'is-on' : ''}">${l}</button>`).join('')}</div></div>`;
}

// ---------- 渲染胶水（desk/mob 各自回填挂点；两侧同构执行） ----------

/** desk 渲染：侧栏 rail + 主视图（list/ai/stat 按视图状态装配） */
export function renderMidnightDesk(root: HTMLElement, inp: MidnightRenderInput): void {
  const rail = railHtml(inp.allCards, inp.view);
  const groupsEl = root.querySelector('.j-groups');
  const statusEl = root.querySelector('.j-status');
  if (groupsEl) groupsEl.innerHTML = rail.groups;
  if (statusEl) statusEl.innerHTML = rail.status;
  const view = root.querySelector('.j-view');
  if (!view) return;
  const v = inp.view;
  if (v.view === 'ai') {
    view.innerHTML = spHeadHtml('AI 荐片', inp.aiCount ? `· ${inp.aiCount} 部` : '') + `<div class="sp-body">${inp.aiHtml}</div>`;
  } else if (v.view === 'stat') {
    view.innerHTML = spHeadHtml('观影分析', `· ${inp.watchedCount} 部已看`) + `<div class="sp-body">${inp.statHtml}</div>`;
  } else {
    const body = inp.cards.length
      ? `<div class="d-scroll"><div class="grid" style="grid-template-columns:repeat(${inp.cols},1fr)">${cardsHtml(inp.cards, inp)}</div></div>`
      : emptyPageHtml(viewFiltered(v));
    view.innerHTML = listHeadHtml(inp) + listToolsHtml(v) + body;
  }
}

/** mob 渲染：标题/计数 + 主视图（list=m-grid / ai、stat=sp-body）+ chips */
export function renderMidnightMob(root: HTMLElement, inp: MidnightRenderInput): void {
  const v = inp.view;
  const t = v.view === 'list' ? inp.title : v.view === 'ai' ? 'AI 荐片' : '观影分析';
  const titleEl = root.querySelector('.j-mtitle');
  const cntEl = root.querySelector('.j-mcnt');
  if (titleEl) titleEl.textContent = t;
  if (cntEl) cntEl.textContent = v.view === 'list' ? `· ${inp.cards.length}` : '';
  // 深审批 B #2/#3：搜索框值回显（mob 壳是静态 input，重开面板按旧词过滤而框空白 = 隐形筛选；
  // 与 desk 的 value 绑定同源口径，保「会话内搜索词存续」语义）+ 尾 ✕ 显隐随词同步（有词才显示）
  const q = root.querySelector<HTMLInputElement>('.j-mq');
  if (q && q.value !== v.searchKeyword) q.value = v.searchKeyword;
  const qClear = root.querySelector<HTMLElement>('.m-search .q-clear');
  if (qClear) qClear.hidden = !v.searchKeyword;
  const mv = root.querySelector<HTMLElement>('.j-mview');
  if (mv) {
    if (v.view === 'list') {
      // 深审批 B #1：空态分支与 desk 同构（筛选无命中 / 空库两态）——此前 mob 恒渲染 m-grid，
      // 空库或无命中整片空白。清词/清筛按钮走 data-cinema-clear 委托（ui.ts 全端已生效）。
      // 空态时容器转 flex（.cn-mempty），空态页才能撑满垂直居中。
      mv.className = inp.cards.length ? 'm-scroll j-mview' : 'm-scroll j-mview cn-mempty';
      mv.innerHTML = inp.cards.length
        ? `<div class="m-grid">${cardsHtml(inp.cards, inp)}</div>`
        : emptyPageHtml(viewFiltered(v));
    } else if (v.view === 'ai') {
      mv.className = 'sp-body j-mview';
      mv.innerHTML = inp.aiHtml;
    } else {
      mv.className = 'sp-body j-mview';
      mv.innerHTML = inp.statHtml;
    }
  }
  const chips = root.querySelector('.j-chips');
  if (chips) chips.innerHTML = chipsHtml(v);
}
