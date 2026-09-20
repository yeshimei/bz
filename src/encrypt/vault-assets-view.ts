/**
 * 保险库·资产视图纯渲染 helper（encrypt 域；ADR-0085）
 * 统一保险库工作台的静态 HTML 生成：概览（hero+统计卡+最近+体检摘要）、
 * 加密笔记 / 加密日记的列表行与详情卡。
 * 本文件零交互绑定（绑定集中在 UIManager）——只做「数据 → HTML 字符串 / DOM 片段」。
 * 图标 = `<i data-lucide>` 统一占位（呈报#59/E5 收编，vIc 工厂；挂 DOM 后 core mountIcons 兑现）。
 */
import { escapeHtml, formatRelativeTime } from '../core/utils';
import { emptyHtmlStr } from '../core/ui/str';
import type { SafeNote } from './data';

export type VaultAsset = 'overview' | 'note' | 'diary';

/** 资产分类色（P1 档案库：笔记=松石/日记=靛蓝；密码资产色随 ADR-0158 视图退役删除）。
 *  note/diary 为数据语义分类色（与 styles.css --bz-vault-teal/indigo 同源，无对应 --bz-* token）。 */
export const ASSET_COLOR: Record<'note' | 'diary', string> = {
  note: '#2e7d68',
  diary: '#5a63a8',
};

export interface AssetCounts {
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
  /** 最近 N 条（笔记 + 日记；密码本已移出保险库面板）。id 供点击流水直接定位条目（note/diary 均可定位） */
  recent: Array<{ kind: 'note' | 'diary'; id?: string; title: string; sub: string; time: string }>;
  health: { issues: number; lastChecked?: string } | null;
}

/**
 * 图标占位工厂（呈报#59/E5 收编）：产 core 统一 `<i data-lucide>` 占位串（挂 DOM 后由
 * core/ui icons.ts `mountIcons` → Obsidian setIcon 兑现，官方 lucide 升级自动跟随），
 * 不再维护全域独一份的手绘 ICON_PATHS 表。旧 24 枚语义一枚不丢：
 * - 直用官方名：lock / lock-open / key / file-lock / book-lock（合并形官方图标）/
 *   eye / download / trash-2 / copy / stethoscope / search / refresh-cw / settings /
 *   x / chevron-left / star / layout-grid / plus / eye-off / triangle-alert / film / image；
 * - 别名归一（统一体系无对应者，注记）：`more-h` → `more-horizontal`（lucide 无短名，
 *   diary/render.ts 同款先例）；`star-outline` → `star`（lucide 无独立描边变体，
 *   star 默认即描边，与旧手绘 path 逐字同形，语义不丢）。
 * 尺寸：占位 class = `bz-vault-ic bz-vault-ic--<size>`（mountIcons 原样保留 class），
 *   尺寸由 encrypt/styles.css 容器规则 + 档位表接管（与旧内联 width/height 等效）。
 * 兑现点：ui.ts ensureElements / renderDeskNotes / renderNoteDetail / createMobPage /
 *   buildSheetHead / bindOverviewArea（既有）+ index.ts mountEncryptStatusBar /
 *   ui.ts attachStatusBar（状态栏重绘侧）。
 */
const LUCIDE_ALIAS: Record<string, string> = {
  'more-h': 'more-horizontal',
  'star-outline': 'star',
};

export function vIc(name: string, size = 14): string {
  const lucide = LUCIDE_ALIAS[name] || name;
  return `<i data-lucide="${lucide}" class="bz-vault-ic bz-vault-ic--${size}" aria-hidden="true"></i>`;
}

/**
 * 状态栏内容单源（一致性整改：ui.ts attachStatusBar 与 index.ts mountEncryptStatusBar
 * 两侧消费同一份，不再各持一份逐字副本）：lucide 锁图标（解锁态开锁）+ 文案。
 * 铁律：图标不用 emoji。
 */
export function statusbarHtml(unlocked: boolean): string {
  return `${vIc(unlocked ? 'lock-open' : 'lock', 12)} 保险库`;
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
          // 流水行按真实资产值标记（一致性整改）：点击经 UIManager.bindOverviewArea 按值分流——
          // note 行落笔记列表、diary 行落加密日记列表，均带 id 直定位该条目
          return `<div class="bz-vault-minirow" role="button" tabindex="0" data-recent="${r.kind}"${r.id ? ` data-recent-id="${escapeHtml(r.id)}"` : ''}>
            <span class="av" style="background:${color}">${vIc(iconName, 14)}</span>
            <div class="mid"><div class="a">${escapeHtml(r.title)}</div><div class="b">${escapeHtml(r.sub)}</div></div>
            <span class="tm">${escapeHtml(r.time)}</span></div>`;
        })
        .join('')
    : emptyHtmlStr('lock', '还没有动态', '笔记或日记入库后，最近动态在这里显示');
  return `
  <div class="bz-vault-hero">
    <div class="ht">${vIc('lock', 14)} 保险库已解锁 · 笔记集中管理</div>
    <div class="hn">${counts.note + counts.diary} 项资产${counts.note + counts.diary > 0 ? ' · 尽在掌握' : ''}</div>
    <div class="hd">同一把主密码 · AES-256-GCM</div>
    <div class="hbtns">
      <button class="hbtn" data-hero="lock-note">${vIc('file-lock', 14)} 存入笔记</button>
      <button class="hbtn" data-hero="health">${vIc('stethoscope', 14)} 体检</button>
    </div>
  </div>
  <div class="bz-vault-cards">
    <div class="card" role="button" tabindex="0" data-nav="note">
      <div class="ct"><span class="k" style="background:${ASSET_COLOR.note}">${vIc('file-lock', 13)}</span>笔记条目</div>
      <div class="num">${counts.note}<small>篇</small></div>
      <div class="cd">${counts.note ? '正文与附件全量密文' : '还没有笔记'}</div>
    </div>
    <div class="card" role="button" tabindex="0" data-nav="note">
      <div class="ct"><span class="k" style="background:${ASSET_COLOR.note}">${vIc('image', 13)}</span>随库附件</div>
      <div class="num">${attachments}<small>个</small></div>
      <div class="cd">随笔记一并加密镜像</div>
    </div>
    <div class="card" role="button" tabindex="0" data-nav="note">
      <div class="ct"><span class="k" style="background:${ASSET_COLOR.note}">${vIc('lock', 13)}</span>附件密文</div>
      <div class="num">${kb}</div>
      <div class="cd">附件镜像密文字节</div>
    </div>
  </div>
  <div class="bz-vault-two">
    <div class="panel">
      <div class="pt">最近加密<span class="more" role="button" tabindex="0" data-hero="recent-all">查看全部 →</span></div>
      ${recentRows}
    </div>
    <div class="panel" role="button" tabindex="0" data-hero="health" title="打开保险库体检">
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
    <div class="bz-vault-row ${active ? 'on' : ''}" role="button" tabindex="0" data-noteid="${escapeHtml(note.id)}" data-kind="${kind}">
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
      : `<button class="bbtn indigo" data-detail="restore-diary">${vIc('download', 14)} 还原回日记</button>
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

// （呈报#59/E5 收编：lucide path 手绘表 ICON_PATHS 已整表退役——图标语义映射见 vIc
//  处注释，占位经 core mountIcons/setIcon 兑现，官方升级自动跟随，不再欠对表维护债。）
