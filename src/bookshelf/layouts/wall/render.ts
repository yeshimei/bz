/**
 * 书架墙布局（ADR-0105 布局差异层）：面板骨架/头行标签/排序 segmented/书脊墙装箱/空态。
 * 共享口径与借书卡见 ../../shared.ts；本文件只写「书脊墙」这一布局的排布差异。
 */
import { esc, emptyHtmlStr, iconSpan } from '../../../core/ui/str';
import { EMPTY_BOOKS_ICON, EMPTY_SEARCH_ICON, EMPTY_FILTER_ICON, ICON } from '../../constants';
import { itemId, statusColor, type RenderHooks } from '../../shared';
import { SORT_LABEL } from '../../constants';
import type { BookshelfItem, SideId, SortKey } from '../../state';

// ---------- 书脊视觉（原型 p4-full 口径） ----------

/** 分类色板（CONTEXT 词条「分类」终稿 20 类全覆盖 + 「未分类」；取值同原型 CAT。
 *  深审 cons C6：旧板含超纲的龙与地下城/天文学/生物学，而终稿 11 类走散列兜底——
 *  现按拍板清单重铺，超纲分类名回落散列兜底色，保底有色不迁移数据） */
const CAT: Record<string, { bg: string; fg: string }> = {
  '推理': { bg: '#7a3b52', fg: '#f2dee6' }, '科幻': { bg: '#3d5a73', fg: '#e2ecf4' },
  '奇幻': { bg: '#3f5a4a', fg: '#dfeee4' }, '恐怖': { bg: '#3a2a33', fg: '#e3d5dc' },
  '武侠': { bg: '#9a5a2f', fg: '#f7ead9' }, '戏剧': { bg: '#6e3b57', fg: '#f0dfe9' },
  '历史小说': { bg: '#8a6d3b', fg: '#f5ecd8' }, '历史': { bg: '#7c6844', fg: '#f0e8d4' },
  '哲学': { bg: '#4f6f52', fg: '#e9efe6' }, '心理学': { bg: '#5c5273', fg: '#e9e4f2' },
  '科学': { bg: '#2f5679', fg: '#dbe9f4' }, '社科': { bg: '#5f5a45', fg: '#ece7d6' },
  '艺术': { bg: '#6b4a6e', fg: '#efe2f0' }, '摄影': { bg: '#2f4858', fg: '#dbe8f0' },
  '中国古典文学': { bg: '#8f4a3a', fg: '#f2e4d8' }, '中国现当代文学': { bg: '#a0552f', fg: '#f6e6da' },
  '中国散文': { bg: '#6d7a3f', fg: '#eef0dc' }, '外国小说': { bg: '#455a7a', fg: '#e0e7f2' },
  '外国散文': { bg: '#57707a', fg: '#e2ecf0' }, '纪实': { bg: '#4a5245', fg: '#e4e8de' },
  '未分类': { bg: '#6b6257', fg: '#ded8ce' },
};
const FALLBACKS = ['#8a6d3b', '#4f6f52', '#3d5a73', '#8f4a3a', '#5c5273', '#7a3b52', '#6d7a3f', '#2f4858'];

function fallbackColor(seed: string): { bg: string; fg: string } {
  let h = 0;
  for (const ch of seed) h = (h * 31 + (ch.codePointAt(0) || 0)) >>> 0;
  return { bg: FALLBACKS[h % FALLBACKS.length], fg: '#f0e8d8' };
}

/** 分类色（未入色板按名散列兜底） */
export function catColor(cat: string): { bg: string; fg: string } {
  return CAT[cat] || fallbackColor(cat);
}

function shade(hex: string, p: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v: number) => Math.max(0, Math.min(255, v + p));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** 墙内标尺快照（每次整墙渲染前由全量条目算出，替代原 ui.ts 模块级 wallMax*） */
export interface BsWallScale { maxHrs: number; maxWc: number }

/** 墙内标尺（高度按时长、厚度按字数开方的归一化上限） */
export function wallScale(items: BookshelfItem[]): BsWallScale {
  return {
    maxHrs: Math.max(3600000, ...items.map((b) => b.readingTimeMs)),
    maxWc: Math.max(10000, ...items.map((b) => b.wordCount)),
  };
}

/** 书脊内联样式：高度=时长（150~230px）、厚度=字数开方（22~56px，无字数回退批注密度）、
 *  分类色（未读倒扣灰）+ 同分类 ±7% 明度抖动；颜色走 --c1/--c2 变量（皮肤层可接管） */
export function spineVars(it: BookshelfItem, scale: BsWallScale): string {
  const dense = it.highlights + it.thinks;
  const wc = it.wordCount > 0 ? it.wordCount : dense * 800;
  const h = 150 + (it.readingTimeMs / scale.maxHrs) * 80;
  const th = 22 + Math.sqrt(Math.min(wc, scale.maxWc) / scale.maxWc) * 34;
  const c = it.status === '未读' ? { bg: '#6b6257', fg: '#ded8ce' } : catColor(it.category || '未分类');
  let sh = 0;
  for (const ch of it.title) sh = (sh * 31 + (ch.codePointAt(0) || 0)) >>> 0;
  const jit = (sh % 15) - 7;
  return `height:${Math.round(h)}px;width:${Math.round(th)}px;--c1:${shade(c.bg, jit)};--c2:${c.fg}`;
}

/** 长书名自适应：按「：」拆主/副题双竖列（丛书书脊范式），各列独立缩字号（下限 9px），
 *  拉丁/数字直立；书脊按列数加宽（上限 64px） */
export function fitTitle(spine: HTMLElement, it: BookshelfItem): void {
  const t = spine.querySelector('.bz-bs-spine-title') as HTMLElement;
  const avail = parseFloat(spine.style.height) - 36;
  let parts = it.title.split(/[:：]/);
  if (parts.length > 2) parts = [parts[0], parts.slice(1).join('：')];
  const fitFs = (n: number) => Math.max(9, Math.min(14, Math.floor(avail / (1.18 * Math.max(1, n)))));
  const cols = parts.map((p) => ({ p, fs: fitFs([...p].length) }));
  let width = 24;
  for (const c of cols) width += Math.ceil(c.fs * 1.25) + 6;
  t.innerHTML = cols
    .map((c, i) => `<span class="${i === 0 ? 't-main' : 't-sub'}" style="font-size:${c.fs}px;letter-spacing:${Math.max(1, Math.round(c.fs * 0.18))}px">${esc(c.p)}</span>`)
    .join('');
  spine.style.width = `${Math.min(64, Math.max(parseFloat(spine.style.width), width))}px`;
}

/** 单条书脊 HTML（未读倒扣灰 / 在读抽出一截垂书签带 / 已读盖「讫」印）。
 *  尾部透明命中层（bz-touch-target--xl，深审 ui F6）：书脊最小厚 22px 却是开借书卡的
 *  主点击目标，触屏（pointer:coarse）经 core 热区类外扩命中面 ≥40px，视觉 1:1 不变；
 *  桌面该类不生成伪元素，覆盖层本身与书脊同面，行为无差 */
export function spineHTML(it: BookshelfItem, scale: BsWallScale): string {
  const cls = it.status === '已读' ? 'read' : it.status === '在读' ? 'reading' : 'unread';
  return `<div class="bz-bs-spine ${cls}" style="${spineVars(it, scale)}" data-bs-id="${esc(itemId(it))}" data-bs-epub="${it.isEpub ? '1' : ''}" title="${esc(it.title)} · ${esc(it.status)}${it.progress > 0 ? ' ' + it.progress + '%' : ''}">
    <span class="bz-bs-spine-title"></span>
    ${it.status === '已读' ? '<span class="stamp">讫</span>' : ''}
    ${it.status === '在读' ? '<span class="ribbon"></span>' : ''}
    <span class="bz-bs-touch bz-touch-target--xl" aria-hidden="true"></span>
  </div>`;
}

// ---------- 墙体装箱（DOM 胶水：两侧同构执行） ----------

function mkBookend(): HTMLElement {
  const d = document.createElement('div');
  d.className = 'bz-bs-bookend';
  return d;
}

function mkSpine(it: BookshelfItem, scale: BsWallScale): HTMLElement {
  const wrap = document.createElement('div');
  wrap.innerHTML = spineHTML(it, scale);
  const sp = wrap.firstElementChild as HTMLElement;
  fitTitle(sp, it);
  return sp;
}

/** 单个分类分区装箱：按当前墙宽逐条塞书脊，塞不下才换排（隔板从排首占位参与测宽）；
 *  窗口缩放由 resize 防抖整墙重排 */
export function packZone(shelf: HTMLElement, cat: string, books: BookshelfItem[], scale: BsWallScale): void {
  let zone: HTMLElement | null = null;
  const newRow = () => {
    zone = document.createElement('div');
    zone.className = 'bz-bs-zone';
    zone.appendChild(mkBookend());
    const dv = document.createElement('div');
    dv.className = 'bz-bs-divider';
    dv.textContent = cat + ' 区';
    zone.appendChild(dv);
    shelf.appendChild(zone);
  };
  for (let i = 0; i < books.length; i++) {
    if (!zone) newRow();
    const sp = mkSpine(books[i], scale);
    zone!.appendChild(sp);
    if (zone!.scrollWidth > zone!.clientWidth) {
      zone!.removeChild(sp);
      if (!zone!.querySelector('.bz-bs-spine')) zone!.appendChild(sp); // 单条就超宽：硬塞防死循环
      else { i--; zone = null; } // 这条留到下一排
    }
  }
  zone = null;
}

// ---------- markup 构建器 ----------

/** 空态三态（库空 / 搜索无命中 / 筛选无书）；folder/tag 由调用方解析（插件读设置，壳给演示值） */
export function wallEmptyHTML(itemsTotal: number, q: string, folder: string, tag: string): string {
  const cfg = !itemsTotal
    ? { icon: EMPTY_BOOKS_ICON, title: '书库还是空的', desc: `把书籍笔记放进「${folder}」文件夹，并在 frontmatter 添加 tags: ${tag} 标签` }
    : q
      ? { icon: EMPTY_SEARCH_ICON, title: '没有找到相关的书', desc: '试试其他关键词，或换一个筛选' }
      : { icon: EMPTY_FILTER_ICON, title: '这个筛选下还没有书', desc: '换一个状态或分类标签，或用搜索找找' };
  return `<div class="bz-bs-wall-empty">${emptyHtmlStr(cfg.icon, cfg.title, cfg.desc)}</div>`;
}

/** 首扫加载态占位（B8：rebuild 完成前墙位不闪空白） */
export function wallLoadingHTML(): string {
  return `<div class="bz-bs-wall-empty">${emptyHtmlStr('loader', '正在整理书架…', '')}</div>`;
}

/** 统计标签行 HTML（纸质标签；状态四张 + 分类册数标签；点选筛选、再点回全馆） */
export function labelsHtml(items: BookshelfItem[], side: SideId, catFilter: string): string {
  const statusDefs: { f: SideId; n: number; t: string }[] = [
    { f: 'all', n: items.length, t: '全馆藏书' },
    { f: 'done', n: items.filter((x) => x.status === '已读').length, t: '已读 · 讫' },
    { f: 'reading', n: items.filter((x) => x.status === '在读').length, t: '在读 · 抽出' },
    { f: 'unread', n: items.filter((x) => x.status === '未读').length, t: '未读 · 倒叠' },
  ];
  // 分类标签计数与筛选同口径（深审 func F6：旧板排除未读致「3 册」点开 5 本——
  // catFilter 过滤含未读（在倒叠区），标签册数一并计入，两口径恒等）
  const cats = new Map<string, { n: number; ms: number }>();
  for (const b of items) {
    const k = b.category || '未分类';
    const c = cats.get(k) || { n: 0, ms: 0 };
    c.n++;
    c.ms += b.readingTimeMs;
    cats.set(k, c);
  }
  const catPairs = [...cats.entries()].sort((a, b) => b[1].n - a[1].n);
  // 弱化口径（issue 226 对齐原型 .off）：任一筛选激活时，未选中标签（状态+分类）弱化；
  // 「全馆藏书」恒亮作为「回到全部」出口
  const filtering = side !== 'all' || catFilter !== 'all';
  const html = statusDefs.map((d) => {
    const on = d.f === 'all' ? side === 'all' && catFilter === 'all' : side === d.f;
    const off = filtering && !on && d.f !== 'all';
    return `
    <div class="bz-bs-taglabel${on ? ' on' : ''}${off ? ' off' : ''}" data-bs-side="${d.f}">
      <span class="pin"></span><div class="n">${d.n}</div><div class="t">${d.t}</div>
    </div>`;
  }).join('');
  // 分类标签独立子容器（桌面 display:contents 隐身；移动端并入头行一行横滑——styles.css @media 块；与原型同构）
  const catHtml = catPairs.map(([cat, c]) => {
    const hrs = c.ms > 0 ? ` · ${Math.round(c.ms / 3600000)} 时` : '';
    const off = filtering && catFilter !== cat;
    return `<div class="bz-bs-taglabel dim-cat${catFilter === cat ? ' on' : ''}${off ? ' off' : ''}" data-bs-cat="${esc(cat)}">
      <span class="pin"></span><div class="n">${esc(cat)}</div><div class="t">${c.n} 册${hrs}</div>
    </div>`;
  }).join('');
  return `${html}<div class="bz-bs-cats">${catHtml}</div>`;
}

/** 排序三档 segmented HTML（点选即生效）。
 *  挂 core .bz-touch-target（深审 ui F6/§8.2）：移动端 28px 档钮热区外扩至下限 */
export function sortSegHtml(sortMode: SortKey): string {
  return (Object.keys(SORT_LABEL) as SortKey[])
    .map((k) => `<button type="button" class="bz-touch-target${sortMode === k ? ' on' : ''}" data-bs-sort="${k}">${SORT_LABEL[k]}</button>`)
    .join('');
}

/** 面板骨架 HTML（书脊墙 1:1；皮肤+亮暗类由调用方传——插件读设置/主题体，壳走 ?skin=/?theme=） */
export function panelHtml(skinClass: string): string {
  return `
    <div class="bz-panel-frame bz-bs-panel bz-panel-mtop ${esc(skinClass)}">
      <div class="bz-bs-wallpage">
      <div class="bz-bs-header">
        <div class="bz-bs-plaque" data-bs-plaque><h1>书库</h1><p>LIBRARY</p></div>
        <div class="bz-bs-labels" id="bz-bs-labels"></div>
      </div>
        <div class="bz-bs-tools">
          <div class="bz-bs-searchbox">
            <input id="bz-bs-dsearch" class="bz-bs-search" type="text" placeholder="检索书名或作者…" autocomplete="off">
            <button type="button" class="bz-icon-btn bz-bs-search-clear" data-bs-search-clear title="清除检索" aria-label="清除检索" hidden>${iconSpan(ICON.close)}</button>
          </div>
          <div class="bz-bs-seg" id="bz-bs-sortseg"></div>
          <div class="bz-bs-hint" id="bz-bs-hint"></div>
        </div>
        <div class="bz-bs-view bz-bs-view-shelf active">
          <div class="bz-bs-room">
            <div class="bz-bs-shelf" id="bz-bs-shelf"></div>
            <div class="bz-bs-wallnote">—— 书脊的高度是时长，厚度是批注，抽出的是正在进行 ——</div>
          </div>
        </div>
        <div class="bz-bs-view bz-bs-view-report">
          <div class="bz-rr-head">
            <span class="bz-rr-title">${iconSpan(ICON.report, 'bz-ic--sm')}阅读分析报告</span>
            <!-- 深审 RR-U1/EFF-1：桌面也可见（左栏导航随书脊墙换血退役，头行返回钮 = 全宽度唯一返回出口）；
                 RR-U3/EFF-10：22×26px icon 档挂 bz-touch-target--lg 热区外扩 + aria-label（同文件清除钮先例） -->
            <button class="bz-icon-btn bz-rr-close bz-touch-target bz-touch-target--lg" data-rr-goto-shelf title="返回书库" aria-label="返回书库">${iconSpan(ICON.close)}</button>
          </div>
          <div class="bz-rr-content"></div>
        </div>
      </div>
    </div>`;
}

// ---------- 渲染胶水（六步/整墙：两侧同构执行；hooks 物化图标） ----------

/** 整墙渲染：分类分区（未读入倒叠区）+ 动态装箱 + 在墙计数 + 空态。
 *  all = 全量条目（标尺口径），list = 当前展示列表（筛选+排序后）。 */
export function renderWallInto(
  shelf: HTMLElement,
  opts: {
    hint: HTMLElement | null;
    all: BookshelfItem[];
    list: BookshelfItem[];
    q: string;
    emptyFolder: string;
    emptyTag: string;
    hooks?: RenderHooks;
  },
): void {
  const scale = wallScale(opts.all);
  const onShelf = opts.list.filter((b) => b.status !== '未读');
  const unread = opts.list.filter((b) => b.status === '未读');
  shelf.innerHTML = '';
  if (opts.hint) opts.hint.textContent = `${onShelf.length + unread.length} 册在墙`;
  if (!onShelf.length && !unread.length) {
    shelf.innerHTML = wallEmptyHTML(opts.all.length, opts.q, opts.emptyFolder, opts.emptyTag);
    opts.hooks?.mountIcons(shelf);
    return;
  }
  // 分类分区（未读除外）按册数降序；排序档决定分区内书序
  const zones = new Map<string, BookshelfItem[]>();
  for (const b of onShelf) {
    const k = b.category || '未分类';
    const arr = zones.get(k) || [];
    arr.push(b);
    zones.set(k, arr);
  }
  const sortedZones = [...zones.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [cat, books] of sortedZones) packZone(shelf, cat, books, scale);
  if (unread.length) {
    const zone = document.createElement('div');
    zone.className = 'bz-bs-zone';
    const dv = document.createElement('div');
    dv.className = 'bz-bs-divider';
    dv.textContent = '倒 叠 区';
    zone.appendChild(dv);
    zone.appendChild(mkBookend());
    for (const b of unread) zone.appendChild(mkSpine(b, scale));
    zone.appendChild(mkBookend());
    shelf.appendChild(zone);
  }
}
