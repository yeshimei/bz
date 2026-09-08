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
          <span class="bz-clip-mob-act" data-clip-mob-search role="button">搜索</span>
          <span class="bz-clip-mob-act" data-clip-mob-close role="button">关闭</span>
        </div>
        <div class="bz-clip-mob-searchbar" data-clip-mob-searchbar style="display:none">
          <input class="bz-input" type="text" data-clip-mob-input placeholder="检索标题、摘要、站点…">
        </div>
        <div class="bz-clip-mob-list" data-clip-mob-list></div>
      </div>
      <!-- 移动详情 overlay（屏2） -->
      <div class="bz-clip-mob-detail bz-panel-mtop" data-clip-mob-detail style="display:none">
        <div class="bz-clip-mob-detail-top">
          <span class="bz-clip-mob-d-back" data-clip-mob-back role="button">‹ 返回</span>
          <div class="bz-clip-mob-detail-title" data-clip-mob-title></div>
          <span class="bz-clip-mob-save" data-clip-mob-save role="button">存为剪藏</span>
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

/** 行内 markup：md.ts 保留的链接记号 → 锚点（data-clip-ext 供行为层接管打开），余文照常 esc */
export function inlineHtml(text: string): string {
  let out = '';
  let last = 0;
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out += esc(text.slice(last, m.index));
    out += `<a class="bz-clip-md-link" href="${esc(m[2])}" data-clip-ext target="_blank" rel="noopener noreferrer">${esc(m[1])}</a>`;
    last = m.index + m[0].length;
  }
  out += esc(text.slice(last));
  return out;
}

/** 正文段落 markup（md.ts 段落化结果 → p/quote/img；图片 src 经 resolver 解析，拒载丢段；
 *  p/quote 行内链接成锚） */
export function paragraphsHtml(paras: ClipParagraph[], resolveImg: ImgResolver): string {
  return paras.map((p) => {
    if (p.type === 'img') {
      const src = resolveImg(p.text);
      return src ? `<img class="bz-clip-art-img" src="${esc(src)}" alt="文章配图" loading="lazy">` : '';
    }
    return p.type === 'quote'
      ? `<blockquote>${inlineHtml(p.text)}</blockquote>`
      : `<p>${inlineHtml(p.text)}</p>`;
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

/** 桌面阅读面（原 ui.ts renderReader 模板平移）：meta 行（时间 · 站点橘）
 *  + 摘要 + 正文（行内链接成锚）+ 剪藏「打开笔记」文字脚（issue 214 文末唯一保留动作）。 */
export function readerHtml(a: ClipArticle, opts: { time: string; paras: string }): string {
  const openNoteFoot = a.origin === 'clip' && a.notePath
    ? `<div class="bz-clip-art-foot"><span role="button" tabindex="0" data-clip-open-note>打开笔记 ${iconSpan(ICO.external, 'bz-ic--xs')}</span></div>`
    : '';
  return `
    <div class="bz-clip-art-title">${esc(a.title)}</div>
    <div class="bz-clip-art-meta">
      <span>${esc(opts.time)}</span>
      <span class="bz-clip-art-site"><span class="bz-clip-art-site-name">${esc(siteShort(a.srcName))}</span></span>
    </div>
    ${a.summary ? summaryHtml(a.summary) : ''}
    <div class="bz-clip-art-md" data-clip-md>${opts.paras || `<p class="dim">${esc(a.origin === 'clip' ? '（笔记暂无正文）' : '正文已清空（已处理条目）')}</p>`}</div>
    ${openNoteFoot}
  `;
}

// ==================== 移动端（双屏；m3 目录索引逐字落域 = site 章 + 已收折叠） ====================

/** 移动目录条目（原型 m3 行式：状态点 + 衬线标题(flex1 两行) + [在读章] + 右侧时间 同一行）。
 *  st 类挂行级（saved 整行降灰）；供 active（未读/在读）与 arch（已收）两段共用渲染。 */
export function mobListHtml(list: ClipArticle[], timeOf: (a: ClipArticle) => string): string {
  return list.map((a) => `
    <div class="bz-clip-mob-item ${a.st}" data-id="${esc(a.id)}">
      <span class="bz-clip-mob-dot ${a.st}"></span>
      <span class="bz-clip-mob-ttl">${esc(a.title)}</span>
      ${a.st === 'reading' ? '<span class="bz-clip-mob-tag">在读</span>' : ''}
      <span class="bz-clip-mob-time">${esc(timeOf(a))}</span>
    </div>`).join('');
}

/** 移动章目录一章（ui.ts 组装：active/arch 段串由 mobListHtml 渲染后显式传入，纯层不持状态） */
export interface MobChapter {
  /** 章名（site） */
  site: string;
  /** 未读 news 条数（章头计数；搜索态 = 命中口径由调用方折算） */
  unread: number;
  /** 常显段（未读/在读）条数 */
  activeN: number;
  /** 已收段（saved 语义）条数 */
  savedN: number;
  /** 常显段条目串 */
  activeHtml: string;
  /** 已收段条目串 */
  archHtml: string;
}

/** 章头（m3 原型 .ch-hd：橘竖条章名 + 未读·已收计数 + 细线拖尾；data-src 承载 site 源——长按批量已读） */
export function mobChHeadHtml(site: string, unread: number, savedN: number): string {
  const cntTxt = unread > 0 || savedN > 0
    ? `${unread > 0 ? `${unread} 未读` : ''}${unread > 0 && savedN > 0 ? ' · ' : ''}${savedN > 0 ? `${savedN} 已收` : ''}`
    : '';
  return `
    <div class="bz-clip-mob-ch-hd" data-src='${esc(JSON.stringify({ kind: 'site', site }))}' title="${esc(site)}">
      <span class="bz-clip-mob-ch-name">${esc(site)}</span>
      <span class="bz-clip-mob-ch-n">${cntTxt}</span>
      <span class="bz-clip-mob-ch-rule"></span>
    </div>`;
}

/** 已收折叠行（m3 原型 .c-fold：点线夹「已收 N 篇」；open 态 = 已展开 + 箭头翻转；三角纯 CSS 无字号依赖） */
export function mobFoldHtml(n: number, open: boolean): string {
  return `
    <div class="bz-clip-mob-fold${open ? ' on' : ''}" data-fold role="button" aria-expanded="${open}">
      <span class="bz-clip-mob-fold-rule"></span>
      <span class="bz-clip-mob-fold-lab">${open ? '收起' : `已收 <b>${n}</b> 篇`}</span>
      <span class="bz-clip-mob-fold-ar"></span>
      <span class="bz-clip-mob-fold-rule"></span>
    </div>`;
}

/** 章目录整列（m3 原型 render 逐字：章内 未读/在读常显 → 折叠行 → 已收段；arch 显隐 = hidden 属性）。
 *  searching = 折叠不生效（命中全平铺，无折叠行）；expanded = 已展开的 site 集合（行为层持有，显式入参）。 */
export function mobTocHtml(chapters: MobChapter[], searching: boolean, expanded: Set<string>): string {
  return chapters.map((ch) => {
    const open = expanded.has(ch.site);
    const fold = !searching && ch.savedN > 0 ? mobFoldHtml(ch.savedN, open) : '';
    const arch = ch.archHtml
      ? (searching || open
        ? `<div class="bz-clip-mob-arch">${ch.archHtml}</div>`
        : `<div class="bz-clip-mob-arch" hidden>${ch.archHtml}</div>`)
      : '';
    return `
      <div class="bz-clip-mob-ch">
        ${mobChHeadHtml(ch.site, ch.unread, ch.savedN)}
        <div class="bz-clip-mob-ch-items">${ch.activeHtml}${fold}${arch}</div>
      </div>`;
  }).join('');
}

/** 目录空态（m3 原型 .no-hit 样式；无任何内容 / 搜索无命中共用，文案由调用方给） */
export function mobNoHitHtml(text: string): string {
  return `<div class="bz-clip-mob-no-hit">${esc(text)}</div>`;
}

/** 移动详情正文（屏2，m3 原型逐字）：期次行(站·时间 + 第 n 则/总数) / 大标题 / 细线 / 正文（行内链接成锚）/ 读下一则脚 */
export function mobDetailHtml(a: ClipArticle, opts: { time: string; paras: string; seq: string }): string {
  return `
    <div class="bz-clip-mob-d-kicker"><span>${esc(siteShort(a.srcName))} · ${esc(opts.time)}</span><span>${esc(opts.seq)}</span></div>
    <div class="bz-clip-mob-d-title">${esc(a.title)}</div>
    <hr class="bz-clip-mob-d-rule">
    <div class="bz-clip-mob-d-md">${opts.paras || `<p>${esc(a.origin === 'clip' ? '（剪藏笔记正文请在 Obsidian 中打开）' : '正文已清空')}</p>`}</div>
    <div class="bz-clip-mob-d-foot"><span class="bz-clip-mob-d-next" data-clip-mob-next>↓ 读下一则</span><span class="bz-clip-mob-d-fch">${esc(siteShort(a.srcName))}</span></div>
  `;
}
