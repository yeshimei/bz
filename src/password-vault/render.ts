/**
 * 密码本渲染纯层（issue 251/ADR-0110：原型 × 插件 markup 单源）。
 *
 * 密码本无第二布局，单文件即全部 markup：面板骨架（桌面三栏 + 移动单列双屏）/
 * 锁屏（金色印章）/ 添加弹窗 / 平台编辑弹窗 / 确认框 / 平台行 / 账号卡 / 移动页。
 * 原型 × 插件 markup 单源：
 *   - 插件侧：ui.ts 直接 import（事件绑定/core 服务/数据读写留 ui.ts）；
 *   - 评审壳侧：esbuild 打成 IIFE → 同目录 prototype-render.js（window.BZR_password_vault）；
 *     行为单源（ADR-0106）后壳直接跑真 ui.ts，markup 天然同源。
 *
 * 纯度契约（tests/core/render-purity.test.ts 守卫，违者门禁红）：
 *   - import 白名单：`../core/ui/str`（零依赖字符串工具）；`./data` 仅 type-only（编译期擦除）；
 *   - 禁 obsidian / moment / core 服务 / 组件库 barrel；
 *   - 禁模块级可变状态：条目与视图状态一律显式入参。
 *
 * 图标 = 原型 v1 自绘内联 SVG（ICONS 表，金印/星/眼等专绘），非 lucide 占位——
 * 值内嵌 markup 两侧零差异；data-* 钩子即两侧事件绑定与测试断言的共同契约，改钩子先改这里。
 * 本文件只做 markup 平移（自 ui.ts，issue 251），任何视觉值不动。
 */
import { colorOf, esc, escAttr } from '../core/ui/str';
import type { PasswordVaultEntry, PlatformGroup } from '../encrypt/vault-data';

/** esc/colorOf/escAttr 再导出：行为层与评审壳演示 markup 同源（收口 core/ui/str，批次 G） */
export { esc, colorOf, escAttr };
/** 条目类型再导出（type-only，编译期擦除——render 产物不拖数据层依赖链） */
export type { PasswordVaultEntry, PlatformGroup } from '../encrypt/vault-data';

// ==================== 常量与工具 ====================

/** 相对时间（原型同款） */
export function relTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 864e5;
  if (diff < 1) return '今天';
  if (diff < 2) return '昨天';
  if (diff < 30) return Math.round(diff) + ' 天前';
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

/** 本地日期（账号卡 meta「创建于」用） */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN');
}

/** 密码掩码圆点 */
export function dots(p: string): string {
  return '•'.repeat(Math.min((p || '').length, 18));
}

/** SVG 图标（原型同款自绘，非 lucide 占位） */
export const ICONS = {
  seal: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><rect x="4" y="10" width="16" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15" r="1.6" fill="#fff" stroke="none"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h18M3 12h18M3 17h18"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 15 9l7 .8-5.3 4.7 1.6 6.9L12 17.8 5.7 21.4l1.6-6.9L2 9.8 9 9z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>',
  menuDots: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
  open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M8 7h9v9"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeoff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.39-1.61M2 2l20 20"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  go: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
};

/** 平台色（图标底色） */
const AV_BG = (platform: string) => `background:${colorOf(platform)}`;

/**
 * 平台头像 HTML：品牌色字母底 + favicon 真实图标盖层。
 * 真实图标（createSiteIcon）加载成功 → 隐藏字母、完整显示图标；失败 → 露出字母回退。
 * 渲染后需调 ui.ts hydrateAvatars 注入 <img>（createSiteIcon 需 JS 创建，行为层职责）。
 */
export function avatarHTML(platform: string, url: string | null | undefined, cls = 'bz-password-vault-av'): string {
  const ch = (platform || '?').slice(0, 1);
  return `<div class="${cls} bz-pwv-avatar" style="${AV_BG(platform)}" data-avatar="1" data-url="${escAttr(url || '')}"><span>${ch}</span></div>`;
}

// ==================== 面板骨架（原 ui.ts deskHTML/mobHTML 及子模板平移） ====================

/**
 * 锁屏容器（共用骨架：内容由 ui.ts 用 core/ui/lock-screen 注入，三域同源）
 * 只留容器——印章/标题/统计卡/输入/按钮全部由共享组件渲染，本域注入口径与金色风格。
 */
export function lockHTML(which: 'desk' | 'mob'): string {
  return `
      <div class="bz-password-vault-lock" data-lock="${which}"></div>`;
}

/** 添加/编辑密码条目弹窗 */
export function modalHTML(which: 'desk' | 'mob'): string {
  return `
      <div class="bz-password-vault-modal" data-modal="${which}">
        <div class="bz-password-vault-dialog">
          <h3>添加密码条目</h3>
          <div class="sub">带 * 为必填 · 平台与账号密码不可为空</div>
          <label>平台 *</label><input data-f="platform" placeholder="如 GitHub">
          <label>链接（可选）</label><input data-f="url" placeholder="https://…">
          <label>账号 *</label><input data-f="account" placeholder="登录账号 / 邮箱 / 手机号">
          <label>密码 *</label>
          <div class="pwdrow"><input data-f="password" placeholder="密码"><button class="gen" data-act="gen">生成</button></div>
          <label>备注（可选）</label><input data-f="note" placeholder="备用信息…">
          <div class="err" data-f-err></div>
          <div class="btns"><button class="cancel" data-act="cancel">取消</button><button class="save" data-act="save">保存</button></div>
        </div>
      </div>`;
}

/** 确认框（原型自绘双实例同步） */
export function confirmHTML(which: 'desk' | 'mob'): string {
  return `
      <div class="bz-password-vault-pop2" data-confirm="${which}">
        <div class="card"><h3>确认</h3><div class="msg"></div>
        <div class="btns"><button class="cancel" data-act="cancel">取消</button><button class="ok" data-act="ok">确定</button></div></div>
      </div>`;
}

/** 平台编辑弹窗 */
export function platEditHTML(which: 'desk' | 'mob'): string {
  return `
      <div class="bz-password-vault-pop2 bz-password-vault-platedit" data-plat-edit="${which}">
        <div class="card">
          <h3>编辑平台信息</h3>
          <div class="sub">改名/改链接将应用到该平台全部账号</div>
          <label>平台名 *</label><input data-f="platform" placeholder="如 GitHub">
          <label>链接（可选）</label><input data-f="url" placeholder="https://…">
          <div class="err"></div>
          <div class="btns"><button class="cancel" data-act="cancel">取消</button><button class="save" data-act="save">保存</button></div>
        </div>
      </div>`;
}

/** 桌面骨架：品牌导航（全部/已收藏）+ 列表 + 详情 + 锁屏/弹层 */
export function deskHTML(): string {
  return `
      <div class="bz-password-vault-nav">
        <div class="bz-password-vault-logo">
          <div class="seal">${ICONS.seal}</div>
          <div class="name">密码本<small>PASSWORD VAULT</small></div>
        </div>
        <div class="bz-password-vault-navitem on" data-view="all">${ICONS.list}全部条目<span class="cnt" data-cnt="all"></span></div>
        <div class="bz-password-vault-navitem" data-view="fav">${ICONS.star}已收藏<span class="cnt" data-cnt="fav"></span></div>
      </div>
      <div class="bz-password-vault-list">
        <div class="bz-password-vault-listhead">
          <h1>全部条目</h1>
          <div class="bz-password-vault-search">${ICONS.search}<input placeholder="搜索平台、账号、备注…"></div>
        </div>
        <div class="bz-password-vault-count"></div>
        <div class="bz-password-vault-rows"></div>
      </div>
      <div class="bz-password-vault-detail">
        <div class="bz-password-vault-empty">
          ${ICONS.lock}
          <div class="t">选择一条记录</div>
          <div class="d">左侧列表选中后，这里显示完整详情与操作</div>
        </div>
      </div>
      ${lockHTML('desk')}
      <div class="bz-password-vault-toast"></div>
      ${modalHTML('desk')}
      ${confirmHTML('desk')}
      ${platEditHTML('desk')}
    `;
}

/** 移动骨架：顶栏 + 搜索 + 列表 + FAB + 详情页 + 锁屏/弹层 */
export function mobHTML(): string {
  return `
      <div class="bz-password-vault-mobbar">
        <div class="seal">${ICONS.seal}</div>
        <div class="t">密码本</div>
        <button class="bz-password-vault-mobclose" data-act="mob-close" aria-label="关闭">${ICONS.x}</button>
      </div>
      <div class="bz-password-vault-mobsearch">${ICONS.search}<input placeholder="搜索平台、账号、备注…"></div>
      <div class="bz-password-vault-moblist"></div>
      <button class="bz-password-vault-fab">${ICONS.plus}</button>
      <div class="bz-password-vault-mobpage">
        <div class="bz-password-vault-mobsheet">
          <div class="head">
            <button class="bz-password-vault-back">${ICONS.back}</button>
            <div class="t">详情</div>
            <button class="ic" data-act="menu">${ICONS.menuDots}</button>
          </div>
          <div class="bz-password-vault-mobbody"></div>
        </div>
      </div>
      ${lockHTML('mob')}
      <div class="bz-password-vault-toast"></div>
      ${modalHTML('mob')}
      ${confirmHTML('mob')}
      ${platEditHTML('mob')}
    `;
}

// ==================== 空态 ====================

/** 空态（cls 区分桌面/移动；icon 仅桌面详情默认态带；cta 可选） */
export function emptyHtml(
  cls: 'bz-password-vault-empty' | 'bz-password-vault-mobempty',
  t: string,
  d: string,
  opts?: { style?: string; icon?: string; ctaLabel?: string; ctaAct?: string }
): string {
  const style = opts?.style ? ` style="${opts.style}"` : '';
  const icon = opts?.icon ?? '';
  const cta = opts?.ctaLabel ? `<button class="act" data-act="${opts.ctaAct}">${opts.ctaLabel}</button>` : '';
  return `<div class="${cls}"${style}>${icon}<div class="t">${t}</div><div class="d">${d}</div>${cta}</div>`;
}

// ==================== 桌面行/卡 ====================

/** 桌面搜索态账号行（选中态 on 类挂行容器，由 ui.ts 拼 className） */
export function hitRowHtml(d: PasswordVaultEntry): string {
  return `${avatarHTML(d.platform, d.url)}
          <div class="mid"><div class="pl">${esc(d.platform)}${d.fav ? ' <span class="star">★</span>' : ''}</div><div class="ac">${esc(d.account || '(无账号)')}</div></div>
          <div class="tm">${relTime(d.createdAt)}</div>`;
}

/** 桌面平台聚合行 */
export function platRowHtml(opts: {
  platform: string;
  url: string;
  account: string;
  count: number;
  time: string;
  fav: boolean;
  selected: boolean;
}): string {
  const favStar = opts.fav ? ' <span class="star">★</span>' : '';
  const countBadge = opts.count > 1 ? `<span class="bz-password-vault-plcount">${opts.count}</span>` : '';
  return `${avatarHTML(opts.platform, opts.url)}
        <div class="mid"><div class="pl">${esc(opts.platform)}${favStar}${countBadge}</div><div class="ac">${opts.account ? esc(opts.account) : ''}</div></div>
        <div class="tm">${relTime(opts.time)}</div>`;
}

/** 平台详情头（detailhead + accthead + 账号容器；桌面详情与搜索态单卡共用） */
export function platDetailShellHtml(opts: { platform: string; url: string; fav: boolean; count: number }): string {
  const favStar = opts.fav ? ' <span style="color:var(--pwv-warn)">★</span>' : '';
  return `<div class="bz-password-vault-detailhead">
      <div class="ttl"><h2>${esc(opts.platform)}${favStar}</h2>
        ${opts.url ? `<a class="url" href="${esc(opts.url)}" target="_blank" rel="noopener">${esc(opts.url)} ↗</a>` : '<div class="url" style="color:var(--pwv-faint)">无链接</div>'}</div>
    </div>
    <div class="bz-password-vault-accthead">
      <div class="t">${opts.count} 个账号</div>
      <button class="add" data-act="plat-add">+ 在该平台新增账号</button>
    </div>
    <div class="bz-password-vault-accts"></div>`;
}

/** 账号卡（桌面详情/搜索态单卡同构） */
export function acctCardHtml(d: PasswordVaultEntry, shown: boolean): string {
  return `<div class="accrow">
        <div class="name">${esc(d.account || '(无账号)')}${d.fav ? '<span class="star">★</span>' : ''}</div>
        <button class="copyac" data-act="copy-ac">${ICONS.copy} 复制账号</button>
      </div>
      <div class="pwrow">
        <div class="pw ${shown ? '' : 'mask'}">${shown ? esc(d.password) : dots(d.password)}</div>
        <button class="mini" data-act="eye">${shown ? ICONS.eyeoff : ICONS.eye}</button>
        <button class="mini" data-act="copy-pw">${ICONS.copy}</button>
      </div>
      ${d.note ? `<div class="note">${esc(d.note)}</div>` : ''}
      <div class="meta">创建于 ${esc(fmtDate(d.createdAt))}${d.url ? ' · <a href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.url.replace('https://', '')) + ' ↗</a>' : ''}</div>`;
}

// ==================== 移动行/页 ====================

/** 移动搜索态账号卡 */
export function mobHitCardHtml(d: PasswordVaultEntry): string {
  return `${avatarHTML(d.platform, d.url, 'av')}
          <div class="mid"><div class="pl">${esc(d.platform)}${d.fav ? ' <span class="star">★</span>' : ''}</div><div class="ac">${esc(d.account || '(无账号)')}</div></div>
          <div class="go">${ICONS.go}</div>`;
}

/** 移动平台卡 */
export function mobPlatCardHtml(opts: { platform: string; url: string; account: string; count: number; fav: boolean }): string {
  const favStar = opts.fav ? ' <span class="star">★</span>' : '';
  const cnt = opts.count > 1 ? `<span class="cnt">${opts.count}</span>` : '';
  return `${avatarHTML(opts.platform, opts.url, 'av')}
        <div class="mid"><div class="pl">${esc(opts.platform)}${favStar}${cnt}</div><div class="ac">${opts.account ? esc(opts.account) : ''}</div></div>
        <div class="go">${ICONS.go}</div>`;
}

/** 移动详情页头（平台名/链接 + 新增账号钮；平台页与账号页共用） */
export function mobPlatHeadHtml(opts: { platform: string; url: string; fav: boolean }): string {
  const favStar = opts.fav ? ' <span style="color:var(--pwv-warn)">★</span>' : '';
  return `<div class="bz-password-vault-mobplathead">
      <div><div style="font-size:17px;font-weight:700">${esc(opts.platform)}${favStar}</div>${opts.url ? `<a style="font-size:12px;color:var(--pwv-gold-ink)" href="${esc(opts.url)}" target="_blank" rel="noopener">${esc(opts.url)} ↗</a>` : '<div style="font-size:12px;color:var(--pwv-faint)">无链接</div>'}</div>
      <button class="bz-password-vault-btn gold" data-act="add">+ 新增账号</button>
    </div>`;
}

/** 移动账号段（withId=平台页多账号态，按钮带 data-id；账号页单卡态不带） */
export function mobSegHtml(d: PasswordVaultEntry, shown: boolean, withId: boolean): string {
  const idAttr = withId ? ` data-id="${d.id}"` : '';
  return `<div class="bz-password-vault-seg">
          <div class="seghead"><div class="acc">${esc(d.account || '(无账号)')}${d.fav ? ' <span class="star">★</span>' : ''}</div>
            <button class="copyac" data-act="copy-ac"${idAttr}>${ICONS.copy} 复制账号</button></div>
          <div class="pwdline"><div class="pw ${shown ? '' : 'mask'}">${shown ? esc(d.password) : dots(d.password)}</div>
            <button class="mini" data-act="eye"${idAttr}>${shown ? ICONS.eyeoff : ICONS.eye}</button>
            <button class="mini" data-act="copy-pw"${idAttr}>${ICONS.copy}</button></div>
          ${d.note ? `<div class="note">${esc(d.note)}</div>` : ''}
          <div class="segmeta">创建于 ${esc(fmtDate(d.createdAt))}${d.url ? ' · ' + esc(d.url.replace('https://', '')) : ''}</div>
        </div>`;
}
