/**
 * 剪藏本渲染纯层（issue 247/ADR-0104：原型 × 插件 markup 单源）。
 *
 * 剪藏本无第二布局，单文件即全部 markup：面板骨架（桌面三栏 + 移动双屏 + 移动详情）/
 * 左 rail 点线索引行 / 中栏目录条目 / 右栏阅读面 / 移动源胶囊与列表与详情正文。
 * 原型 × 插件 markup 单源：
 *   - 插件侧：ui.ts 直接 import（事件绑定/core 服务/数据读写留 ui.ts）；
 *   - 评审壳侧：esbuild 打成 IIFE → 同目录 prototype-render.js（window.BZR_clipbook）；
 *     行为单源（ADR-0106）后壳直接跑真 ui.ts，markup 天然同源。
 *
 * 纯度契约（tests/core/render-purity.test.ts 守卫，违者门禁红）：
 *   - import 白名单：`../core/ui/str`（零依赖字符串工具）、`./types`（type-only）、
 *     `./md`（零依赖段落化）；
 *   - 禁 obsidian / moment / core 服务 / 组件库 barrel；
 *   - 禁模块级可变状态：条目与视图状态一律显式入参；
 *   - 时间展示串由调用方注入（timeOf 回调/入参）——core/utils 的 formatRelativeTime
 *     依赖 moment，纯层不引用，两侧展示串同出 ui.ts 一处不裂。
 *
 * 图标 = iconSpan 占位串（str.ts），由两侧各自 mountIcons 兑现（产物 span.bz-icon 同构）。
 * data-clip-* 钩子即两侧事件绑定与测试断言的共同契约，改钩子先改这里。
 * 编辑部印刷风视觉拍板定稿（issue 214，p1-final 原型）：本文件只做 markup 平移，任何视觉值不动。
 */
import { esc, iconSpan } from '../core/ui/str';
import { toParagraphs } from './md';
import type { ClipArticle, ClipParagraph } from './types';

/** esc/iconSpan 再导出：行为层与评审壳演示 markup 同源 */
export { esc, iconSpan };
/** 条目类型再导出（行为层统一从 render.ts 取用） */
export type { ClipArticle, ClipParagraph } from './types';

// ==================== 常量 ====================

/** lucide 图标名（原 ui.ts ICO 迁入） */
export const ICO = {
  inbox: 'inbox',
  feed: 'rss',
  clip: 'scissors',
  bili: 'play-square',
  mail: 'mail',
  book: 'book-open',
  check: 'check',
  download: 'download',
  external: 'external-link',
  trash: 'trash-2',
  search: 'search',
  x: 'x',
  arrow: 'arrow-left',
  link: 'link',
  globe: 'globe',
  folder: 'folder-open',
  rotate: 'rotate-ccw',
  radio: 'radio',
};

// ==================== 面板骨架 ====================

/** 面板骨架（原 ui.ts buildDom 模板平移）：桌面三栏 + 移动双屏 + 移动详情 overlay。
 *  桌面 1180×760、关闭 = 点遮罩/ESC（头行无按钮）；移动全屏态有 ✕。 */
export function panelHtml(): string {
  return `
    <div class="bz-panel-frame bz-clip-frame bz-panel-mtop">
      <!-- 桌面三栏 -->
      <div class="bz-clip-desk">
        <div class="bz-panel-head bz-panel-head--tall">
          <div class="bz-panel-title">剪藏本</div>
          <div class="bz-panel-head-sp"></div>
          <div class="bz-clip-issue" data-clip-issue></div>
          <div class="bz-clip-head-search bz-search">${iconSpan(ICO.search)}<input class="bz-input" type="text" data-clip-desk-search placeholder="检索标题、摘要、站点…"></div>
        </div>
        <div class="bz-clip-desk-body">
          <div class="bz-rail bz-rail--wide bz-clip-rail">
            <div class="bz-clip-rail-label">SITE 站点</div>
            <div class="bz-rail-scroll" data-clip-rail></div>
            <div class="bz-clip-rail-foot" data-clip-rail-foot></div>
          </div>
          <div class="bz-clip-mid">
            <div class="bz-clip-toc-head">目录</div>
            <div class="bz-clip-list" data-clip-list></div>
          </div>
          <div class="bz-clip-read" data-clip-read-pane tabindex="0">
            <div class="bz-clip-read-scroll"><div class="bz-clip-read-body" data-clip-reader></div></div>
          </div>
        </div>
      </div>
      <!-- 移动双屏 -->
      <div class="bz-clip-mob" data-clip-mob>
        <div class="bz-clip-mob-top">
          <div class="bz-clip-mob-title">剪藏本</div>
          <button class="bz-icon-btn bz-icon-btn--lg" data-clip-mob-search title="搜索">${iconSpan(ICO.search)}</button>
          <button class="bz-icon-btn bz-icon-btn--lg bz-icon-btn--close" data-clip-mob-close title="关闭">${iconSpan(ICO.x)}</button>
        </div>
        <div class="bz-clip-mob-searchbar" data-clip-mob-searchbar style="display:none">
          <input class="bz-input" type="text" data-clip-mob-input placeholder="搜索标题、摘要、站点、标签">
        </div>
        <div class="bz-mobstrip" data-clip-mob-sources></div>
        <div class="bz-clip-mob-list" data-clip-mob-list></div>
      </div>
      <!-- 移动详情 overlay（屏2） -->
      <div class="bz-clip-mob-detail bz-panel-mtop" data-clip-mob-detail style="display:none">
        <div class="bz-clip-mob-detail-top">
          <button class="bz-icon-btn bz-icon-btn--lg" data-clip-mob-back title="返回">${iconSpan(ICO.arrow)}</button>
          <div class="bz-clip-mob-detail-title" data-clip-mob-title></div>
          <button class="bz-clip-mob-save" data-clip-mob-save title="保存到剪藏本">${iconSpan(ICO.download, 'bz-ic--sm')}</button>
        </div>
        <div class="bz-clip-mob-detail-body" data-clip-mob-detail-body></div>
      </div>
    </div>
  `;
}

// ==================== 小工具 / 口径 ====================

/** 展示站点短名（issue 214 原型口径：果壳科学人 → 果壳，其余原样） */
export function siteShort(s: string): string {
  return String(s || '').replace('果壳科学人', '果壳');
}

/** 站点徽标色：站名哈希 → 固定饱和度/亮度的 hue（同站恒色，无需配色表） */
export function siteTint(site: string): string {
  let h = 0;
  const t = String(site || '');
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 42%, 52%)`;
}

/** 移动条目状态点 */
export function dotHtml(st: string): string {
  return `<span class="bz-clip-dot ${st}"></span>`;
}

/** 状态章（移动详情）：状态 → { 图标, 色类 } */
export function stateFlag(st: string): { icon: string; cls: string } {
  if (st === 'saved') return { icon: ICO.check, cls: 'ok' };
  if (st === 'reading') return { icon: ICO.book, cls: 'warn' };
  return { icon: ICO.mail, cls: 'info' };
}

/** 状态文字（阅读面 meta / 移动状态章共用口径） */
export function stateLabel(st: string): string {
  return st === 'saved' ? '已保存' : st === 'reading' ? '在读' : st === 'read' ? '已读' : '未读';
}

// ==================== 左 rail（V1 点线索引） ====================

/** data-src JSON 序列化选择器（UP 行携带 platform=B站 + up=uid；site 行携带站点名） */
export type SrcSelJson = { kind: 'all' } | { kind: 'inbox'; platform: string; up: string | null } | { kind: 'clip' } | { kind: 'site'; site: string };

/** rail 源行（原 ui.ts railItemHtml 平移）：徽标/图标槽位保留 DOM（编辑部皮肤 CSS 隐藏，结构给测试） */
export function railItemHtml(sel: SrcSelJson, label: string, unread: number, total: number, icon: string | null, color: string | null, active: boolean, sub?: string): string {
  // G：JSON 过 esc 再进单引号属性——UP 主名含单引号时原实现提前闭合属性，点击 JSON.parse 抛错该源失效
  // 前缀槽三态保留 DOM（issue 214：编辑部皮肤在域 CSS 内隐藏徽标/图标，V1 = 纯文字点线索引）
  const badge = icon === 'feed'
    ? `<span class="bz-rail-badge" style="--bz-rail-tint:${color || '#58a6ff'}">${esc(sub || label.slice(0, 1))}</span>`
    : icon === 'bili'
      ? `<span class="bz-rail-badge bili">${esc(sub || label.slice(0, 1))}</span>`
      : icon === 'clip'
        ? `<span class="bz-rail-ic">${iconSpan('scissors')}</span>`
        : `<span class="bz-rail-ic${sel.kind === 'all' ? ' bz-rail-ic--accent' : ''}">${icon ? iconSpan(icon) : ''}</span>`;
  // 计数 = 未读（搜索态为命中数，橘粗）/ 总数（issue 214 V1 口径）
  const count = `<span class="bz-rail-count">${unread > 0 ? `<b>${unread}</b>` : unread}/${total}</span>`;
  return `
    <div class="bz-rail-item${active ? ' on' : ''}" data-src='${esc(JSON.stringify(sel))}' title="${esc(label)}">
      ${badge}
      <span class="bz-rail-name">${esc(label)}</span>
      <span class="bz-clip-lead"></span>
      ${count}
    </div>`;
}

/** rail 脚注（issue 214）：今日已读 N 篇（news.json stats.byDate，键 YYYY-MM-DD；缺省 0） */
export function railFootHtml(todayRead: number): string {
  return `今日已读<br><b>${todayRead}</b> 篇`;
}

// ==================== 中栏目录（序号制条目） ====================

/** 目录条目序列（编辑部目录：序号 + 标题 + 「站点 · 时间」一行；摘要不入目录）。
 *  timeOf 注入展示时间串（moment 留在行为层，纯层不引用）；列表空由调用方走 uiEmpty。 */
export function tocListHtml(list: ClipArticle[], curId: string | null, timeOf: (a: ClipArticle) => string): string {
  return list.map((a, i) => `
    <div class="bz-clip-item bz-clip-item--${a.st}${curId && curId === a.id ? ' on' : ''}" data-id="${esc(a.id)}">
      <span class="bz-clip-no">${String(i + 1).padStart(2, '0')}</span>
      <div class="bz-clip-item-main">
        <div class="bz-clip-item-t"><span>${esc(a.title)}</span></div>
        <div class="bz-clip-item-meta">${esc(siteShort(a.srcName))} · ${esc(timeOf(a))}</div>
      </div>
    </div>`).join('');
}

// ==================== 右栏阅读面 ====================

/** 图片段来源解析回调签名（实现留行为层：外链直用 / vault 嵌链走资源路径） */
export type ImgResolver = (src: string) => string | null;

/** 正文段落 markup（md.ts 段落化结果 → p/quote/img；图片 src 经 resolver 解析，拒载丢段） */
export function paragraphsHtml(paras: ClipParagraph[], resolveImg: ImgResolver): string {
  return paras.map((p) => {
    if (p.type === 'img') {
      const src = resolveImg(p.text);
      return src ? `<img class="bz-clip-art-img" src="${esc(src)}" alt="文章配图" loading="lazy">` : '';
    }
    return p.type === 'quote'
      ? `<blockquote>${esc(p.text)}</blockquote>`
      : `<p>${esc(p.text)}</p>`;
  }).join('');
}

/** 摘要块（奶油底 + 橘细左线 + 衬线小标） */
export function summaryHtml(summary: string): string {
  return `<div class="bz-clip-art-sum"><span class="bz-clip-art-sum-h">${iconSpan('sparkles', 'bz-ic--xs')}摘要</span>${esc(summary)}</div>`;
}

/** 剪藏正文懒加载占位（行为层 loadClipBody 完成前的一行 dim 段） */
export function clipLoadingHtml(): string {
  return `<p class="dim">正在读取剪藏正文…</p>`;
}

/** 桌面阅读面（原 ui.ts renderReader 模板平移）：meta 行（时间 · 站点橘 · 状态右缘）
 *  + 字号分段挂位 + 摘要 + 正文 + 剪藏「打开笔记」文字脚（issue 214 文末唯一保留动作）。 */
export function readerHtml(a: ClipArticle, opts: { time: string; paras: string }): string {
  const openNoteFoot = a.origin === 'clip' && a.notePath
    ? `<div class="bz-clip-art-foot"><span role="button" tabindex="0" data-clip-open-note>打开笔记 ${iconSpan(ICO.external, 'bz-ic--xs')}</span></div>`
    : '';
  return `
    <div class="bz-clip-art-title">${esc(a.title)}</div>
    <div class="bz-clip-art-meta">
      <span>${esc(opts.time)}</span>
      <span class="bz-clip-art-site"><span class="bz-clip-art-site-name">${esc(siteShort(a.srcName))}</span></span>
      <span class="bz-clip-art-state">${stateLabel(a.st)}</span>
    </div>
    <div class="bz-clip-art-fs" data-clip-fs></div>
    ${a.summary ? summaryHtml(a.summary) : ''}
    <div class="bz-clip-art-md" data-clip-md>${opts.paras || `<p class="dim">${esc(a.origin === 'clip' ? '（笔记暂无正文）' : '正文已清空（已处理条目）')}</p>`}</div>
    ${openNoteFoot}
  `;
}

// ==================== 移动端（双屏） ====================

/** 移动源胶囊（.bz-mobstrip 行；未读气泡 = bz-badge--brand） */
export function mobChipHtml(sel: SrcSelJson, label: string, unread: number, active: boolean, icon: string | null, sub?: string): string {
  return `
    <div class="bz-mobstrip-chip${active ? ' is-on' : ''}" data-src='${esc(JSON.stringify(sel))}'>
      ${icon === 'feed' ? `<span class="bz-clip-favchip sm">${esc(sub || label.slice(0, 1))}</span>` : ''}
      <span>${esc(label)}</span>
      ${unread ? `<span class="bz-badge bz-badge--brand">${unread}</span>` : ''}
    </div>`;
}

/** 移动列表（issue 224：未读在前、组内最新在前，与桌面目录同序；摘要两行 + 状态点） */
export function mobListHtml(list: ClipArticle[], timeOf: (a: ClipArticle) => string): string {
  return list.map((a) => `
    <div class="bz-clip-mob-item" data-id="${esc(a.id)}">
      <div class="bz-clip-item-t">${dotHtml(a.st)}<span>${esc(a.title)}</span></div>
      ${a.summary ? `<div class="bz-clip-item-sum">${esc(a.summary)}</div>` : ''}
      <div class="bz-clip-item-meta"><span>${esc(a.srcName)}</span><span class="bz-clip-item-time">${esc(timeOf(a))}</span></div>
    </div>`).join('');
}

/** 移动详情正文（屏2）：标题 / 首字 chip 来源行 / 状态章 / 摘要 / 正文 */
export function mobDetailHtml(a: ClipArticle, opts: { time: string; paras: string }): string {
  const flag = stateFlag(a.st);
  return `
    <div class="bz-clip-mob-d-title">${esc(a.title)}</div>
    <div class="bz-clip-mob-d-meta"><span class="bz-clip-favchip">${esc(a.srcName.slice(0, 1))}</span><span>${esc(a.srcName)}</span><span class="bz-clip-mob-d-time">${esc(opts.time)}</span></div>
    <div class="bz-clip-art-flag ${flag.cls}">${iconSpan(flag.icon, 'bz-ic--xs')}${stateLabel(a.st)}</div>
    ${a.summary ? summaryHtml(a.summary) : ''}
    <div class="bz-clip-art-md">${opts.paras || `<p class="dim">${esc(a.origin === 'clip' ? '（剪藏笔记正文请在 Obsidian 中打开）' : '正文已清空')}</p>`}</div>
  `;
}
