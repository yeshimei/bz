/**
 * 保险库·资产视图纯渲染 helper（encrypt 域；ADR-0085）
 * 统一保险库工作台的静态 HTML 生成：概览（hero+统计卡+最近+体检摘要）、
 * 加密笔记 / 加密日记的列表行与详情卡。
 * 本文件零交互绑定（绑定集中在 UIManager）——只做「数据 → HTML 字符串 / DOM 片段」。
 * 图标用 lucide path 内联 SVG（currentColor）。
 */
import { escapeHtml, formatRelativeTime } from '../core/utils';
import type { SafeNote } from './data';

export type VaultAsset = 'overview' | 'pw' | 'note' | 'diary';

/** 资产分类色（P1 档案库：密码=品牌金/笔记=松石/日记=靛蓝）。
 *  pw 随 issue 198 批 D 金色归 --bz-brand 系（内联 style 引用全局 token，随明暗翻色）；
 *  note/diary 为数据语义分类色（与 styles.css --bz-vault-teal/indigo 同源，无对应 --bz-* token）。 */
export const ASSET_COLOR: Record<'pw' | 'note' | 'diary', string> = {
  pw: 'var(--bz-brand)',
  note: '#2e7d68',
  diary: '#5a63a8',
};

export interface AssetCounts {
  pw: number;
  note: number;
  diary: number;
}

/** 概览统计输入 */
export interface OverviewStats {
  counts: AssetCounts;
  /** 随库附件数（纯笔记口径，不含日记条目） */
  attachments: number;
  /** 附件密文字节聚合（blobSize 之和，纯笔记口径） */
  attBytes: number;
  /** 最近 N 条（笔记 + 日记；密码本已移出保险库面板）。id 供点击流水直接定位条目（diary 无独立资产不传） */
  recent: Array<{ kind: 'note' | 'diary'; id?: string; title: string; sub: string; time: string }>;
  health: { issues: number; lastChecked?: string } | null;
}

/** 图标（供 UI 拼接按钮时复用） */
export function vIc(name: string, size = 14): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] || ''}</svg>`;
}

/** 概览视图完整 HTML（host 挂到 area 后自绑 [data-hero] / .card[data-nav]） */
export function overviewHTML(stats: OverviewStats): string {
  const { counts, attachments, attBytes, recent, health } = stats;
  const kb = attBytes > 0 ? (attBytes / 1024).toFixed(1) + ' KB' : '—';
  const healthRows =
    health == null
      ? `<div class="bz-vault-hrow"><span class="dot" style="background:var(--bz-text-3)"></span><span class="lbl">待处理</span><span class="n">未体检</span></div>`
      : `<div class="bz-vault-hrow"><span class="dot" style="background:${health.issues ? 'var(--bz-danger)' : 'var(--bz-success)'}"></span><span class="lbl">待处理</span><span class="n">${health.issues}</span></div>`;
  const recentRows = recent.length
    ? recent
        .map((r) => {
          const color = r.kind === 'note' ? ASSET_COLOR.note : ASSET_COLOR.diary;
          const iconName = r.kind === 'note' ? 'file-lock' : 'book-lock';
          // 日记条目已无独立资产入口，点击统一落加密笔记列表（data-recent 不再写 'diary'）；
          // 笔记条目带 id，点击后直定位该条目（原型：点流水 → 列表选中该篇）
          return `<div class="bz-vault-minirow" data-recent="note"${r.id ? ` data-recent-id="${escapeHtml(r.id)}"` : ''}>
            <span class="av" style="background:${color}">${vIc(iconName, 14)}</span>
            <div class="mid"><div class="a">${escapeHtml(r.title)}</div><div class="b">${escapeHtml(r.sub)}</div></div>
            <span class="tm">${escapeHtml(r.time)}</span></div>`;
        })
        .join('')
    : '<div class="bz-empty"><span class="bz-empty-ic">' + vIc('lock', 28) + '</span><div class="bz-empty-title">还没有动态</div><div class="bz-empty-desc">笔记或日记入库后，最近动态在这里显示</div></div>';
  return `
  <div class="bz-vault-hero">
    <div class="ht">${vIc('lock', 14)} 保险库已解锁 · 笔记集中管理</div>
    <div class="hn">${counts.note} 项资产${counts.note > 0 ? ' · 尽在掌握' : ''}</div>
    <div class="hd">同一把主密码 · AES-256-GCM</div>
    <div class="hbtns">
      <button class="hbtn" data-hero="lock-note">${vIc('file-lock', 14)} 存入笔记</button>
      <button class="hbtn" data-hero="health">${vIc('stethoscope', 14)} 体检</button>
    </div>
  </div>
  <div class="bz-vault-cards">
    <div class="card" data-nav="note">
      <div class="ct"><span class="k" style="background:${ASSET_COLOR.note}">${vIc('file-lock', 13)}</span>笔记条目</div>
      <div class="num">${counts.note}<small>篇</small></div>
      <div class="cd">${counts.note ? '正文与附件全量密文' : '还没有笔记'}</div>
    </div>
    <div class="card" data-nav="note">
      <div class="ct"><span class="k" style="background:${ASSET_COLOR.note}">${vIc('image', 13)}</span>随库附件</div>
      <div class="num">${attachments}<small>个</small></div>
      <div class="cd">随笔记一并加密镜像</div>
    </div>
    <div class="card" data-nav="note">
      <div class="ct"><span class="k" style="background:${ASSET_COLOR.note}">${vIc('lock', 13)}</span>附件密文</div>
      <div class="num">${kb}</div>
      <div class="cd">附件镜像密文字节</div>
    </div>
  </div>
  <div class="bz-vault-two">
    <div class="panel">
      <div class="pt">最近加密<span class="more" data-hero="recent-all">查看全部 →</span></div>
      ${recentRows}
    </div>
    <div class="panel" data-hero="health" title="打开保险库体检">
      <div class="pt">保险库体检<span class="more">查看 →</span></div>
      ${healthRows}
      <div class="bz-vault-hrow"><span class="dot" style="background:var(--bz-text-3)"></span><span class="lbl">完整性校验</span><span class="n">${health?.lastChecked || '—'}</span></div>
    </div>
  </div>`;
}

/** 笔记/日记列表行 HTML（kind 决定色/图标/副行；active 高亮） */
export function noteRowHTML(note: SafeNote, kind: 'note' | 'diary', active: boolean): string {
  const color = ASSET_COLOR[kind];
  const iconName = kind === 'note' ? 'file-lock' : 'book-lock';
  const sub =
    kind === 'note'
      ? `${note.attachments.length} 个附件 · ${escapeHtml(note.path)}`
      : (note.path.split('/').pop() || note.title) + (note.attachments.length ? ` · ${note.attachments.length} 个附件` : '');
  return `
    <div class="bz-vault-row ${active ? 'on' : ''}" data-noteid="${escapeHtml(note.id)}" data-kind="${kind}">
      <span class="av" style="background:${color}">${vIc(iconName, 16)}</span>
      <div class="mid"><div class="t1">${escapeHtml(note.title)}</div><div class="t2">${sub}</div></div>
      <span class="tm">${escapeHtml(formatRelativeTime(note.createdAt))}</span>
    </div>`;
}

/** 笔记/日记详情卡 HTML（含各资产动作按钮，绑定由 UIManager 完成） */
export function noteDetailHTML(note: SafeNote, kind: 'note' | 'diary', plainPreview?: string): string {
  const color = ASSET_COLOR[kind];
  const iconName = kind === 'note' ? 'file-lock' : 'book-lock';
  // 附件收敛为统计行（原型口径）：数字 + title 挂全部附件名，不再铺 chips
  const attLine = note.attachments.length
    ? `<span class="val" title="${escapeHtml(note.attachments.map((a) => a.path.split('/').pop() || a.path).join('、'))}">${note.attachments.length} 个</span>`
    : '<span class="val">无附件</span>';
  const pathLine = kind === 'note' ? `${escapeHtml(note.path)} · 已移出` : `${escapeHtml(note.path)} · 已还原该段`;
  const created = new Date(note.createdAt).toLocaleString('zh-CN', { hour12: false });
  const actionBtns =
    kind === 'note'
      ? `<button class="bbtn teal" data-detail="preview">${vIc('eye', 14)} 解密预览</button>
         <button class="bbtn" data-detail="restore">${vIc('download', 14)} 取出还原</button>
         <button class="bbtn danger" data-detail="delete">${vIc('trash-2', 14)} 销毁</button>`
      : `<button class="bbtn" style="background:${color};color:#fff" data-detail="restore-diary">${vIc('download', 14)} 还原回日记</button>
         <button class="bbtn" data-detail="copy-diary">${vIc('copy', 14)} 复制正文</button>
         <button class="bbtn danger" data-detail="destroy-diary">${vIc('trash-2', 14)} 彻底销毁</button>`;
  return `
    <div class="bz-vault-dhead">
      <span class="big" style="background:${color}">${vIc(iconName, 21)}</span>
      <div class="ttl"><h2>${escapeHtml(note.title)}</h2><div class="url">${pathLine}</div></div>
    </div>
    <div class="bz-vault-dcontent">
      ${kind === 'note'
        ? `<div class="field"><div class="lab">附件镜像</div><div class="valrow">${attLine}</div></div>
           <div class="field"><div class="lab">加密时间</div><div class="valrow"><span class="val">${escapeHtml(created)}</span></div></div>
           <div class="note hint">原笔记正文已 100% 密文化；双击列表行可压缩预览（原图按需加载原层）。</div>`
        : `<div class="field"><div class="lab">正文预览</div><div class="note pre">${plainPreview ? escapeHtml(plainPreview).replace(/\n/g, '<br>') : '（未解密预览）'}</div></div>
           <div class="field"><div class="lab">加密于</div><div class="valrow"><span class="val">${escapeHtml(created)}</span></div></div>`}
      <div class="bigbtns">${actionBtns}</div>
    </div>`;
}

/** lucide path 表（与 vault-pw-view 互补；两者各自收敛本文件使用项） */
const ICON_PATHS: Record<string, string> = {
  lock: '<rect x="4" y="10" width="16" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  'lock-open': '<rect x="4" y="10" width="16" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 7.9-.9"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3z"/>',
  'file-lock': '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 12v4"/><circle cx="12" cy="9" r="1.4" fill="currentColor" stroke="none"/>',
  'book-lock': '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  'trash-2': '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  'more-h': '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  stethoscope: '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  'refresh-cw': '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  star: '<path d="M12 2 15 9l7 .8-5.3 4.7 1.6 6.9L12 17.8 5.7 21.4l1.6-6.9L2 9.8 9 9z"/>',
  'star-outline': '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  'layout-grid': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  'eye-off': '<path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.39-1.61M2 2l20 20"/>',
  'triangle-alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 20h16a2 2 0 0 0 1.73-2"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
};
