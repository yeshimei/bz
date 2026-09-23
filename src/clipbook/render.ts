/**
 * 剪藏本渲染纯层（issue 247/ADR-0104：原型 × 插件 markup 单源）。
 *
 * 剪藏本无第二布局，单文件即全部 markup：面板骨架（桌面三栏 + 移动双屏 + 移动详情）/
 * 左 rail 点线索引行 / 中栏目录条目 / 右栏阅读面 / 移动源胶囊与列表与详情正文。
 * 原型 × 插件 markup 单源：
 *   - 插件侧：ui.ts 直接 import（事件绑定/core 服务/数据读写留 ui.ts）；
 *   - 评审壳侧：esbuild 打成 IIFE → prototypes/clipbook/prototype-render.js（window.BZR_clipbook，
 *     产物路径见 scripts/build-preview.mjs）；行为单源（ADR-0106）后壳直接跑真 ui.ts，markup 天然同源。
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
import { esc, iconSpan, pad2 } from '../core/ui/str';
import { CHART_PASTEL_SERIES, CHART_RANK_BADGES, CHART_HIGHLIGHT } from '../core/chart-palette';
import { formatMinutes, REPORT_TOP_N, shiftBuckets, shiftOfHour, type ClipDayRow, type ClipLibraryStats, type ClipReportData } from './report-stats';
import type { ClipArticle } from './types';

/** esc/iconSpan 再导出：行为层与评审壳演示 markup 同源 */
export { esc, iconSpan };
/** 条目类型再导出（行为层统一从 render.ts 取用） */
export type { ClipArticle } from './types';

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
  checks: 'check-check',
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
          <!-- 刊名电传纸带（.scratch/clip-title/d.html D 版 1:1，2026-09-23 拍板）：tape 内字位 span 供
               motion 逐字击打；字车 cur 常驻 blink（boot 由 motion 先送带首再随击推进）；lamp = 收带铃圆点。
               span 间不得有空白（textContent 契约=「剪藏本」）；静默渲染不演即终态 -->
          <div class="bz-panel-title bz-clip-title-wire" data-clip-title-wire><div class="bz-clip-title-tape"><span class="bz-clip-tape-ch">剪</span><span class="bz-clip-tape-ch">藏</span><span class="bz-clip-tape-ch">本</span><span class="bz-clip-tape-cur" aria-hidden="true"></span></div><i class="bz-clip-tape-lamp" aria-hidden="true"></i></div>
          <div class="bz-panel-head-sp"></div>
          <!-- 头行右侧「电传抬头单」（2026-09-23 头行五版拍板 D 版 + C 版期号戳章）：
               期号戳章 + 细分隔 + 检索（纸底色/点线/上下边线/日期随当日追加拍板逐次撤去）。
               data-clip-issue = 戳章（第 N 期）；检索钩子（data-clip-desk-search / data-clip-search-clear）不变。
               效率#12 ✕ 清除钮：定位走内联随单源 markup 两侧生效；图标用内联 SVG——.bz-search .bz-ic 的
               左缘绝对定位会劫持 iconSpan 产物，且 mountIcons 换节点会丢内联样式；不带 display 内联值，
               hidden 属性才能生效 -->
          <div class="bz-clip-head-strip">
            <span class="bz-clip-issue-stamp" data-clip-issue></span>
            <span class="bz-clip-strip-sep" aria-hidden="true"></span>
            <div class="bz-clip-head-search bz-search">${iconSpan(ICO.search)}<input class="bz-input" type="text" data-clip-desk-search placeholder="检索标题、摘要、站点、来源…"><button type="button" class="bz-clip-search-clear" data-clip-search-clear title="清除搜索" aria-label="清除搜索" hidden style="position:absolute;right:6px;top:50%;transform:translateY(-50%);border:none;background:transparent;cursor:pointer;color:var(--bz-text-3);padding:2px;line-height:0"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
          </div>
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
          <!-- 移动刊名 = 期号戳章（2026-09-23 拍板）：与桌面抬头单同款同钩（data-clip-issue），renderHeadIssue 双端同填 -->
          <div class="bz-clip-issue-stamp" data-clip-issue></div>
          <span class="bz-clip-mob-act" data-clip-mob-report role="button">报告</span>
          <span class="bz-clip-mob-act" data-clip-mob-search role="button">搜索</span>
          <span class="bz-clip-mob-act" data-clip-mob-close role="button">关闭</span>
        </div>
        <div class="bz-clip-mob-searchbar" data-clip-mob-searchbar style="display:none">
          <input class="bz-input" type="text" data-clip-mob-input placeholder="检索标题、摘要、站点、来源…">
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

/** 状态章（移动详情）：状态 → { 图标, 色类 }（保留：与 styles.css 的 .bz-clip-art-flag 档同源，
 *  现渲染面已不挂章——「打开即已读」让位后语义冗余，纯层口径函数留作既有测试锚） */
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

/** rail 源行（原 ui.ts railItemHtml 平移）：徽标/图标槽位保留 DOM（编辑部皮肤 CSS 隐藏，结构给测试）。
 *  行内「✓✓」批量已读小钮已退役（2026-09-19 用户拍板：hover 浮出的快捷钮删掉）——
 *  源级批量已读只保留右键菜单一条路径（ui.ts renderRail 的 attachItemActions）。 */
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

/** rail 脚注（issue 214；2026-09-23 拍板 A 版合块）：「今日已读 ··· N 篇」点线引导行
 *  （复用 rail 行内 .bz-clip-lead 点线语言），与「我读了什么」入口共居 .bz-clip-rail-foot
 *  一条顶线之下（入口 markup 见 clipReportEntryHtml）。 */
export function railFootHtml(todayRead: number): string {
  return `<div class="bz-clip-foot-row">今日已读<i class="bz-clip-lead"></i><b>${todayRead}</b> 篇</div>`;
}

/** rail 脚注·阅读报告入口（issue 358）：点开「我读了什么」报告弹层。
 *  与书库「阅读分析报告」（bz-reading-report-open）并列的另一份报告——本域自有的
 *  剪藏阅读流水，数据出 clipbook.json readLog，不深链书库报告。 */
export function clipReportEntryHtml(): string {
  return `<div class="bz-clp-rep-entry" data-clp-rep-entry role="button" tabindex="0">我读了什么 ${iconSpan('chevron-right', 'bz-ic--xs')}</div>`;
}

// ==================== 中栏目录（序号制条目） ====================

/** 标题命中高亮（效率#13）：先 esc 再大小写不敏感 `<mark>` 包裹——
 *  转义后的文本与转义后的关键词做 indexOf 分段（不劈开 &amp; 等实体，防注入）；
 *  kw 空/无命中原样返回。只做 title 段（meta 行不高亮，控制噪音）。 */
export function highlightTitleHtml(title: string, kw: string): string {
  const safe = esc(title);
  const needle = esc((kw || '').trim()).toLowerCase();
  if (!needle) return safe;
  const hay = safe.toLowerCase();
  let out = '';
  let i = 0;
  for (;;) {
    const hit = hay.indexOf(needle, i);
    if (hit === -1) {
      out += safe.slice(i);
      break;
    }
    out += `${safe.slice(i, hit)}<mark>${safe.slice(hit, hit + needle.length)}</mark>`;
    i = hit + needle.length;
  }
  return out;
}

/** 目录卡 meta 尾标签（效率#9）：前两个 + 超出省略号，纯展示（点击筛选未做） */
function tocTagsHtml(tags: string[]): string {
  if (!tags.length) return '';
  const shown = tags.slice(0, 2).map((t) => `#${esc(t)}`).join(' ');
  return `<span class="bz-clip-item-tags">${shown}${tags.length > 2 ? ' …' : ''}</span>`;
}

/** 目录条目序列（编辑部目录：序号 + 标题 + 「站点 · 时间」一行；摘要不入目录）。
 *  timeOf 注入展示时间串（moment 留在行为层，纯层不引用）；列表空由调用方走 uiEmpty。
 *  kw（效率#13）：搜索关键词，标题段命中 `<mark>` 高亮；meta 行不高亮。 */
export function tocListHtml(list: ClipArticle[], curId: string | null, timeOf: (a: ClipArticle) => string, kw = ''): string {
  return list.map((a, i) => `
    <div class="bz-clip-item bz-clip-item--${a.st}${curId && curId === a.id ? ' on' : ''}" role="button" tabindex="0" data-id="${esc(a.id)}">
      <span class="bz-clip-no">${pad2(i + 1)}</span>
      <div class="bz-clip-item-main">
        <div class="bz-clip-item-t"><span>${highlightTitleHtml(a.title, kw)}</span></div>
        <div class="bz-clip-item-meta">${esc(siteShort(a.srcName))} · ${esc(timeOf(a))}${tocTagsHtml(a.tags)}</div>
      </div>
    </div>`).join('');
}

// ==================== 中栏目录折叠段（ADR-0108：已读/已收双折叠，桌面新增） ====================

/** 桌面折叠行（编辑部风点线：隔线 + 「已读 N 篇 / 已收 N 篇」衬线小标；展开态文案切「收起」同移动）。
 *  data-desk-fold 供行为层 toggle；tabindex="0"（C-UI5 键盘可达：Enter/Space 开合由 ui.ts bindItemMenus 接线） */
export function deskFoldRowHtml(kind: 'read' | 'saved', n: number, open: boolean): string {
  const label = kind === 'read' ? '已读' : '已收';
  const lab = open ? '收起' : `${label} <b>${n}</b> 篇`;
  return `
    <div class="bz-clip-desk-fold${open ? ' on' : ''}" data-desk-fold="${kind}" role="button" tabindex="0" aria-expanded="${open}">
      <span class="bz-clip-desk-fold-rule"></span>
      <span class="bz-clip-desk-fold-lab">${lab}</span>
      <span class="bz-clip-desk-fold-ar"></span>
      <span class="bz-clip-desk-fold-rule"></span>
    </div>`;
}

/** 桌面折叠段体（未展开 = hidden；纯结构，视觉由 styles.css） */
export function foldBodyHtml(html: string, open: boolean): string {
  return html ? `<div class="bz-clip-desk-fold-body"${open ? '' : ' hidden'}>${html}</div>` : '';
}

// ==================== 右栏阅读面 ====================

/** 摘要块（奶油底 + 橘细左线 + 衬线小标） */
export function summaryHtml(summary: string): string {
  return `<div class="bz-clip-art-sum"><span class="bz-clip-art-sum-h">${iconSpan('sparkles', 'bz-ic--xs')}摘要</span>${esc(summary)}</div>`;
}

/** 标签 chip 行（效率#9）：阅读面 meta 行下的 AI 标签展示（clip 条目 frontmatter tags；
 *  news 条目 tags 常空不显行）。纯展示（点击筛选未做）。 */
function artTagsHtml(tags: string[]): string {
  if (!tags.length) return '';
  return `<div class="bz-clip-art-tags">${tags.map((t) => `<span class="bz-clip-art-tag">${esc(t)}</span>`).join('')}</div>`;
}

/** 桌面阅读面（原 ui.ts renderReader 模板平移）：meta 行（时间 · 站点橘）+ 标签行 + 摘要
 *  + 正文容器（markdown 原文由行为层经 Obsidian MarkdownRenderer 异步水合，diary/knowledge 同范式；
 *  note = 非空时的 dim 占位文案）+ 剪藏「打开笔记」文字脚（issue 214 文末唯一保留动作）。 */
export function readerHtml(a: ClipArticle, opts: { time: string; note: string }): string {
  const openNoteFoot = a.origin === 'clip' && a.notePath
    ? `<div class="bz-clip-art-foot"><span role="button" tabindex="0" data-clip-open-note>打开笔记 ${iconSpan(ICO.external, 'bz-ic--xs')}</span></div>`
    : '';
  return `
    <div class="bz-clip-art-title">${esc(a.title)}</div>
    <div class="bz-clip-art-meta">
      <span>${esc(opts.time)}</span>
      <span class="bz-clip-art-site"><span class="bz-clip-art-site-name">${esc(siteShort(a.srcName))}</span></span>
    </div>
    ${artTagsHtml(a.tags)}
    ${a.summary ? summaryHtml(a.summary) : ''}
    <div class="bz-clip-art-md markdown-rendered" data-clip-md>${opts.note ? `<p class="dim">${esc(opts.note)}</p>` : ''}</div>
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

/** 移动章目录一章（ui.ts 组装：active/read/saved 段串由 mobListHtml 渲染后显式传入，纯数据层不持状态）。

 *  段语义（ADR-0108）：章内未读常显；「已读」= 本会话快照时已读骨架（折叠可开）；「已收」= 已剪藏/收藏承接（折叠）。 */
export interface MobChapter {
  /** 章名（site） */
  site: string;
  /** 未读 news 条数（章头计数；搜索态 = 命中口径由调用方折算） */
  unread: number;
  /** 常显段（未读）条数 */
  activeN: number;
  /** 已读段条数 */
  readN: number;
  /** 已收段（saved 语义）条数 */
  savedN: number;
  /** 该源未读 news 数（效率#4：>0 时章头挂常驻灰态「全部标为已读」小钮；口径与 rail 源行同款确认流） */
  markAllN?: number;
  /** 常显段条目串 */
  activeHtml: string;
  /** 已读段条目串 */
  readHtml: string;
  /** 已收段条目串 */
  savedHtml: string;
}

/** 章头（m3 原型 .ch-hd：橘竖条章名 + 未读·已读·已收计数 + 细线拖尾；data-src 承载该源——长按批量已读）。
 *  markAllN（效率#4）：>0 时行尾挂常驻灰态「✓✓」小钮（长按抽屉之外的可见入口，点击流与 rail 同链；接线在 ui.ts renderMobToc）。 */
export function mobChHeadHtml(site: string, unread: number, readN: number, savedN: number, markAllN = 0): string {
  const seg: string[] = [];
  if (unread > 0) seg.push(`${unread} 未读`);
  if (readN > 0) seg.push(`${readN} 已读`);
  if (savedN > 0) seg.push(`${savedN} 已收`);
  const cntTxt = seg.join(' · ');
  const mark = markAllN > 0
    ? `<span class="bz-clip-mob-ch-mark" data-clip-ch-markall role="button" aria-label="全部标为已读" title="全部标为已读（${markAllN} 篇）">${iconSpan(ICO.checks, 'bz-ic--xs')}</span>`
    : '';
  return `
    <div class="bz-clip-mob-ch-hd" data-src='${esc(JSON.stringify({ kind: 'site', site }))}' title="${esc(site)}">
      <span class="bz-clip-mob-ch-name">${esc(site)}</span>
      <span class="bz-clip-mob-ch-n">${cntTxt}</span>
      <span class="bz-clip-mob-ch-rule"></span>
      ${mark}
    </div>`;
}

/** 折叠行（m3 原型 .c-fold：四线夹「已读/已收 N 篇」；open 态 = 已展开 + 箭头翻转；data-fold-kind 区分段） */
export function mobFoldHtml(kind: 'read' | 'saved', n: number, open: boolean): string {
  const label = kind === 'read' ? '已读' : '已收';
  return `
    <div class="bz-clip-mob-fold${open ? ' on' : ''}" data-fold data-fold-kind="${kind}" role="button" tabindex="0" aria-expanded="${open}">
      <span class="bz-clip-mob-fold-rule"></span>
      <span class="bz-clip-mob-fold-lab">${open ? '收起' : `${label} <b>${n}</b> 篇`}</span>
      <span class="bz-clip-mob-fold-ar"></span>
      <span class="bz-clip-mob-fold-rule"></span>
    </div>`;
}

/** 折叠段 body（吸附 active 段后）；缩 setOpen 语义由 mobTocHtml 显式传入 expanded 集合（行为层持有，显式入参）。
 *  段 key = `${kind}:${site}`（read/saved 两段独立记忆）。 */
export function mobFoldBodyHtml(kind: 'read' | 'saved', html: string, open: boolean): string {
  return html
    ? (open
      ? `<div class="bz-clip-mob-arch" data-arch-kind="${kind}">${html}</div>`
      : `<div class="bz-clip-mob-arch" data-arch-kind="${kind}" hidden>${html}</div>`)
    : '';
}

/** 章目录整列（m3 原型 render 逐字：章内 未读常显 → 已读折叠 → 已收折叠；段显隐 = hidden 属性）。
 *  searching = 折叠不生效（命中平铺，无折叠行）；expanded = 已展开的段 key 集合（${kind}:${site}）。 */
export function mobTocHtml(chapters: MobChapter[], searching: boolean, expanded: Set<string>): string {
  return chapters.map((ch) => {
    const readOpen = expanded.has('read:' + ch.site);
    const savedOpen = expanded.has('saved:' + ch.site);
    const foldRead = !searching && ch.readN > 0 ? mobFoldHtml('read', ch.readN, readOpen) : '';
    const foldSaved = !searching && ch.savedN > 0 ? mobFoldHtml('saved', ch.savedN, savedOpen) : '';
    const readBody = mobFoldBodyHtml('read', ch.readHtml, searching || readOpen);
    const savedBody = mobFoldBodyHtml('saved', ch.savedHtml, searching || savedOpen);
    return `
      <div class="bz-clip-mob-ch">
        ${mobChHeadHtml(ch.site, ch.unread, ch.readN, ch.savedN, ch.markAllN || 0)}
        <div class="bz-clip-mob-ch-items">${ch.activeHtml}${foldRead}${readBody}${foldSaved}${savedBody}</div>
      </div>`;
  }).join('');
}

/** 目录空态（m3 原型 .no-hit 样式；无任何内容 / 搜索无命中共用，文案由调用方给） */
export function mobNoHitHtml(text: string): string {
  return `<div class="bz-clip-mob-no-hit">${esc(text)}</div>`;
}

/** 移动详情正文（屏2，m3 原型逐字）：期次行(站·时间 + 第 n 则/总数) / 大标题 / 细线 / 正文（行内链接成锚）/ 读下一则脚 */
export function mobDetailHtml(a: ClipArticle, opts: { time: string; note: string; seq: string }): string {
  return `
    <div class="bz-clip-mob-d-kicker"><span>${esc(siteShort(a.srcName))} · ${esc(opts.time)}</span><span>${esc(opts.seq)}</span></div>
    <div class="bz-clip-mob-d-title">${esc(a.title)}</div>
    <hr class="bz-clip-mob-d-rule">
    <div class="bz-clip-mob-d-md markdown-rendered" data-clip-mob-md>${opts.note ? `<p>${esc(opts.note)}</p>` : ''}</div>
    <div class="bz-clip-mob-d-foot"><span class="bz-clip-mob-d-next" data-clip-mob-next>↓ 读下一则</span><span class="bz-clip-mob-d-fch">${esc(siteShort(a.srcName))}</span></div>
  `;
}

// ==================== 阅读报告弹层（issue 358「我读了什么」） ====================
// 剪藏本自有阅读报告（数据 = clipbook.json readLog），与书库「阅读分析报告」并列不深链。
// 分段懒生成（仿 reading-report 分片范式）：行为层逐段让出主线程填充；周期切换重算重渲。

/** 报告弹层骨架：桌面卡 + 移动 .bz-panel-mtop 真全屏；头行 = 标题 + 周期 seg + 关闭钮；
 *  体 = data-clp-rep-body（行为层骨架 → 分段填充）。data-clp-rep-* 即行为层委托契约。 */
export function clipReportShellHtml(): string {
  return `
    <div class="bz-panel-frame bz-clip-report-frame bz-panel-mtop">
      <div class="bz-panel-head">
        <div class="bz-panel-title">我读了什么</div>
        <div class="bz-clp-rep-seg" data-clp-rep-period role="tablist" aria-label="统计周期">
          <button class="bz-clp-rep-seg-btn on" data-period="week" type="button">本周</button>
          <button class="bz-clp-rep-seg-btn" data-period="month" type="button">本月</button>
        </div>
        <div class="bz-panel-head-sp"></div>
        <span class="bz-clp-rep-close" role="button" tabindex="0" data-clp-rep-close title="关闭">${iconSpan(ICO.x)}</span>
      </div>
      <div class="bz-clp-rep-body" data-clp-rep-body></div>
    </div>`;
}

/** 骨架占位（分片计算完成前先见「统计中…」，不「像没点」） */
export function clipReportSkeletonHtml(): string {
  return `<div class="bz-clp-rep-skeleton">统计中…</div>`;
}

// 空态 markup 退役（审查修复批 体验⑨⑩）：自造 .bz-clp-rep-empty 换 core uiEmpty 标准件
// （手册 §8.3 空态带动作；两态文案与动作组装在 report-ui.ts buildClipReportEmpty）。

/** 单期报告分段（懒生成；段序冻结：概览 → 来源分布 → 阅读时段） */
export interface ClipReportSection {
  /** 段稳定键（进度/调试用） */
  key: string;
  /** 段进度文案（无 emoji） */
  label: string;
  /** 调用时才拼装该段 HTML */
  generate: () => string;
}

export function buildClipReportSections(d: ClipReportData, opts?: ClipReportViewOpts): ClipReportSection[] {
  const secs: ClipReportSection[] = [
    { key: 'overview', label: '统计概览', generate: () => clipReportOverviewHtml(d, opts) },
    { key: 'sources', label: '来源分布', generate: () => clipReportSourcesHtml(d) },
    { key: 'hours', label: '阅读时段', generate: () => clipReportHoursHtml(d) },
  ];
  // 报库盘点（2026-09-23 重做拍板）：news.json 真实家底（建库以来）；不可用则整段省略
  if (opts?.library && opts.library.total > 0) {
    secs.push({ key: 'library', label: '报库盘点', generate: () => clipReportLibraryHtml(opts.library!) });
  }
  return secs;
}

/** 报告视图装配选项（效率#20：Top5 可点回看的可定位信息由行为层现查后注入，纯层不持状态） */
export interface ClipReportViewOpts {
  /** 当前库内可定位条目的 key 集（articleKeyOf / clip:<path>）；
   *  缺省/null = 不可知，Top5 全部不挂「打开」钮（保留策略清掉的条目诚实不承诺）。 */
  availableKeys?: Set<string> | null;
  /** 报库盘点数据（news.json 真实库聚合；缺省/null = news 不可用，整段省略） */
  library?: ClipLibraryStats | null;
  /** 本期最投入的一天（null = 本期无有效阅读段，不显该行） */
  busiest?: ClipDayRow | null;
}

/** 统计日期串（2026-09-19 → 「9 月 19 日」；报告语境是当前周期，不显年） */
function dayCn(iso: string): string {
  const parts = iso.split('-');
  return parts.length >= 3 ? `${Number(parts[1])} 月 ${Number(parts[2])} 日` : esc(iso);
}

/** 段 1·统计概览：四格 hero（篇数/总时长/活跃天数/连续天数）+ 最投入的一天 + 读得最久 Top 5。
 *  hero/排名徽章取 chart-palette 粉彩系与浅底徽章色（图表配色单源），墨字走域皮肤。
 *  opts.availableKeys（效率#20）：命中的行挂 data-clip-rep-key + 行尾「打开」钮（点击回看，
 *  面板开着 selectArticle / 未开 revealClipArticle 链路，接线在 report-ui.ts）；失隐条目不挂。 */
function clipReportOverviewHtml(d: ClipReportData, opts?: ClipReportViewOpts): string {
  const keys = opts?.availableKeys || null;
  const topRows = d.topArticles.map((a, i) => {
    const badge = CHART_RANK_BADGES[i % CHART_RANK_BADGES.length];
    const openable = !!keys && keys.has(a.key);
    const openBtn = openable
      ? `<span class="bz-clp-rep-top-open" data-clip-rep-open role="button" tabindex="0" title="打开该篇回看">打开 ${iconSpan(ICO.external, 'bz-ic--xs')}</span>`
      : '';
    return `
    <div class="bz-clp-rep-top-row"${openable ? ` data-clip-rep-key="${esc(a.key)}"` : ''}>
      <span class="bz-clp-rep-rank" style="background:${badge}">${i + 1}</span>
      <span class="bz-clp-rep-top-title" title="${esc(a.title)}">${esc(a.title)}</span>
      <span class="bz-clp-rep-top-src">${esc(a.src)}</span>
      <span class="bz-clp-rep-top-min">${esc(formatMinutes(a.minutes))}</span>
      ${openBtn}
    </div>`;
  }).join('');
  const busiest = opts?.busiest
    ? `<div class="bz-clp-rep-busiest"><span>最投入的一天</span><i class="bz-clp-rep-lead" aria-hidden="true"></i><b>${dayCn(opts.busiest.date)}</b><span class="bz-clp-rep-busiest-min">${esc(formatMinutes(opts.busiest.minutes))}</span></div>`
    : '';
  return `
    <div class="bz-clp-rep-sec">
      <div class="bz-clp-rep-sec-h">统计概览</div>
      <div class="bz-clp-rep-hero bz-clp-rep-hero--4">
        <div class="bz-clp-rep-hero-card"><b>${d.articles}</b><span>已读篇数</span></div>
        <div class="bz-clp-rep-hero-card"><b>${esc(formatMinutes(d.totalMinutes))}</b><span>总时长</span></div>
        <div class="bz-clp-rep-hero-card"><b>${d.activeDays}</b><span>活跃天数</span></div>
        <div class="bz-clp-rep-hero-card"><b>${d.streakDays}</b><span>连续天数</span></div>
      </div>
      ${busiest}
      ${topRows ? `<div class="bz-clp-rep-top"><div class="bz-clp-rep-sub">读得最久</div>${topRows}</div>` : ''}
    </div>`;
}

/** 段 2·来源分布（站点/UP/订阅源 Top N）：水平条形行（环形图被否拍板后的统一范式，
 *  与 reading-report generateBarRows 同构；粉彩系列色按行循环） */
function clipReportSourcesHtml(d: ClipReportData): string {
  const rows = d.bySrc.slice(0, REPORT_TOP_N);
  if (!rows.length) {
    return `<div class="bz-clp-rep-sec"><div class="bz-clp-rep-sec-h">来源分布</div><p class="bz-clp-rep-none">本期暂无来源数据</p></div>`;
  }
  const max = Math.max(1, ...rows.map((r) => r.minutes));
  const barRows = rows.map((r, i) => {
    const width = Math.max(2, Math.round((r.minutes / max) * 100));
    return `
    <div class="bz-clp-rep-bar-row">
      <span class="bz-clp-rep-bar-label" title="${esc(r.name)}">${esc(r.name)}</span>
      <span class="bz-clp-rep-bar-track"><i style="width:${width}%;background:${CHART_PASTEL_SERIES[i % CHART_PASTEL_SERIES.length]}"></i></span>
      <span class="bz-clp-rep-bar-val">${r.articles} 篇 · ${esc(formatMinutes(r.minutes))}</span>
    </div>`;
  }).join('');
  return `
    <div class="bz-clp-rep-sec">
      <div class="bz-clp-rep-sec-h">来源分布</div>
      <div class="bz-clp-rep-bars">${barRows}</div>
    </div>`;
}

/** 段 3·阅读时段：四班工时（原创「报社工班」口径：夜/晨/午/晚）+ 24 小时柱（每柱 = 该小时阅读
 *  分钟数；粉彩底，最高柱 CHART_HIGHLIGHT 强调）+ 高峰人话（班次归属） */
function clipReportHoursHtml(d: ClipReportData): string {
  const max = Math.max(0, ...d.hours);
  const cols = d.hours.map((m, h) => {
    const height = max > 0 && m > 0 ? 10 + Math.round((m / max) * 44) : 3;
    const accent = max > 0 && m > 0 && m === max;
    const bg = accent ? CHART_HIGHLIGHT : CHART_PASTEL_SERIES[0];
    return `<div class="bz-clp-rep-hcol"><div class="bz-clp-rep-hbar${accent ? ' accent' : ''}" style="height:${height}px;background:${bg}" title="${h} 点 · ${esc(formatMinutes(m))}"></div><div class="bz-clp-rep-hlabel">${h}</div></div>`;
  }).join('');
  const peakHour = max > 0 ? d.hours.indexOf(max) : -1;
  const peakText = peakHour >= 0 ? `${peakHour} 点前后（${shiftOfHour(peakHour)}）` : '暂无';
  // 四班工时条（与来源分布同 bar-row 语言；横排四班各占一行）
  const shifts = shiftBuckets(d.hours);
  const shiftMax = Math.max(1, ...shifts.map((s) => s.minutes));
  const shiftRows = shifts.map((s, i) => `
    <div class="bz-clp-rep-bar-row">
      <span class="bz-clp-rep-bar-label">${s.label}<span class="bz-clp-rep-shift-span">${s.span}</span></span>
      <span class="bz-clp-rep-bar-track"><i style="width:${Math.max(2, Math.round((s.minutes / shiftMax) * 100))}%;background:${CHART_PASTEL_SERIES[i % CHART_PASTEL_SERIES.length]}"></i></span>
      <span class="bz-clp-rep-bar-val">${esc(formatMinutes(s.minutes))}</span>
    </div>`).join('');
  return `
    <div class="bz-clp-rep-sec">
      <div class="bz-clp-rep-sec-h">阅读时段</div>
      <div class="bz-clp-rep-sub">工班盘点</div>
      <div class="bz-clp-rep-bars">${shiftRows}</div>
      <div class="bz-clp-rep-sub">全天 24 小时</div>
      <div class="bz-clp-rep-hours">${cols}</div>
      <div class="bz-clp-rep-hours-note">每根柱 = 该小时的阅读分钟 · 阅读高峰在 ${peakText}</div>
    </div>`;
}

/** 段 4·报库盘点（2026-09-23 重做新增，news.json 真实家底 · 建库以来）：
 *  四格 hero（在流/已读/待读/已读率）+ 近 14 天收录柱 + 在流来源 Top + 压库最久的待读。 */
function clipReportLibraryHtml(lib: ClipLibraryStats): string {
  const paceMax = Math.max(1, lib.byDayPeak);
  const paceCols = lib.byDay.map((d, i) => {
    const height = d.n > 0 ? 10 + Math.round((d.n / paceMax) * 44) : 3;
    const accent = lib.byDayPeak > 0 && d.n === lib.byDayPeak;
    const bg = accent ? CHART_HIGHLIGHT : CHART_PASTEL_SERIES[i % CHART_PASTEL_SERIES.length];
    return `<div class="bz-clp-rep-hcol"><div class="bz-clp-rep-hbar${accent ? ' accent' : ''}" style="height:${height}px;background:${bg}" title="${esc(d.label)} · 收 ${d.n} 篇"></div><div class="bz-clp-rep-hlabel">${esc(d.label)}</div></div>`;
  }).join('');
  const platMax = Math.max(1, ...lib.topPlatforms.map((p) => p.n));
  const platRows = lib.topPlatforms.map((p, i) => `
    <div class="bz-clp-rep-bar-row">
      <span class="bz-clp-rep-bar-label" title="${esc(p.name)}">${esc(p.name)}</span>
      <span class="bz-clp-rep-bar-track"><i style="width:${Math.max(2, Math.round((p.n / platMax) * 100))}%;background:${CHART_PASTEL_SERIES[i % CHART_PASTEL_SERIES.length]}"></i></span>
      <span class="bz-clp-rep-bar-val">${p.n} 篇</span>
    </div>`).join('');
  const oldest = lib.oldestUnread
    ? `<div class="bz-clp-rep-old"><span class="bz-clp-rep-old-tag">压库</span><span class="bz-clp-rep-top-title" title="${esc(lib.oldestUnread.title)}">${esc(lib.oldestUnread.title)}</span><span class="bz-clp-rep-top-src">${esc(lib.oldestUnread.src)}</span><span class="bz-clp-rep-top-min">压了 ${lib.oldestUnread.days} 天</span></div>`
    : '';
  return `
    <div class="bz-clp-rep-sec">
      <div class="bz-clp-rep-sec-h">报库盘点 · 建库以来</div>
      <div class="bz-clp-rep-hero bz-clp-rep-hero--4">
        <div class="bz-clp-rep-hero-card"><b>${lib.total}</b><span>在流篇数</span></div>
        <div class="bz-clp-rep-hero-card"><b>${lib.readCount}</b><span>已读</span></div>
        <div class="bz-clp-rep-hero-card"><b>${lib.unread}</b><span>待读</span></div>
        <div class="bz-clp-rep-hero-card"><b>${lib.readRate}%</b><span>已读率</span></div>
      </div>
      <div class="bz-clp-rep-sub">近 14 天收录节奏</div>
      <div class="bz-clp-rep-hours">${paceCols}</div>
      <div class="bz-clp-rep-hours-note">每天收进来的新剪报 · 单日最多收 ${lib.byDayPeak} 篇</div>
      <div class="bz-clp-rep-sub">在流来源</div>
      <div class="bz-clp-rep-bars">${platRows}</div>
      ${oldest}
    </div>`;
}
