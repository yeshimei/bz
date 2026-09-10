/**
 * 日记本（diary）渲染纯层 · markup 单源（ADR-0104/ADR-0115）。
 *
 * 原型评审壳（prototypes/diary/prototype.html）与插件 ui.ts 消费同一份 markup：
 * 改这里一处两侧生效；禁 obsidian/moment/core 服务 import（render-purity 守卫强制），
 * 类型一律取 ./types（零依赖）。行为（事件/懒加载/markdown 渲染/加密解密）在 ui.ts。
 */
import { esc } from '../core/ui/str';
import type { WallEntry, WallMedia } from './types';

// ===== 头行/灯箱按钮 → lucide 图标名（ui 侧经 core/ui uiIcon 挂载） =====
// 注意：日期筛选入口是【品牌行】div[data-act="date-picker"]（非 button，不注图标），
// 故此处无 date-picker 词条；关闭/设置按钮已按用户要求从头行移除（关闭走 ESC 与点遮罩）。
export const ACT_ICON: Record<string, string> = {
  add: 'pen-line',
  search: 'search',
  'lb-close': 'x',
  'lb-prev': 'chevron-left',
  'lb-next': 'chevron-right',
};

/** 媒体类型 → lucide 图标（灯箱加载失败提示用；媒体块本体不显示图标——用户要求去掉） */
export const KIND_ICON: Record<WallMedia['kind'], string> = {
  img: 'image',
  video: 'video-off',
  audio: 'music',
};

// ===== 媒体 MIME（灯箱/音频块播放用；按扩展名判定） =====

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
};

/** 媒体引用名 → MIME（未知扩展名回落 application/octet-stream） */
export function mimeOfMediaName(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot > -1 ? name.slice(dot + 1).toLowerCase() : '';
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

// ===== 面板壳（桌面/移动双实例同壳） =====

/**
 * 面板壳 markup：头行（品牌 + 按钮组）/ chips 行 / 二级标签行 / 搜索行 / 两栏主体
 * （章节栏 + 瀑布）/ 灯箱 / 底部抽屉。按钮全部空壳挂 data-act，图标由 ui 侧 decorateIcons 注入。
 *
 * 头行按钮组只留「写日记 / 搜索」：关闭、设置、按年月跳转三枚按钮已按用户 2026-09-10 要求移除。
 * 日期筛选入口仍由品牌行承担（点「日记本」标题即开筛选弹窗，title 已注明）。
 */
export function wallPanelHTML(): string {
  return `
      <div class="bz-diary-head bz-win-head">
        <div class="bz-diary-brand" data-act="date-picker" title="按日期筛选">
          <span class="bz-diary-bookname">日记本</span>
          <span class="bz-diary-range"></span>
        </div>
        <div class="bz-diary-btns">
          <button class="bz-diary-icon-btn bz-touch-target--xl" data-act="add" title="写日记"></button>
          <button class="bz-diary-icon-btn bz-touch-target--xl" data-act="search" title="搜索"></button>
        </div>
      </div>
      <div class="bz-diary-chiprow"></div>
      <div class="bz-diary-subrow" style="display:none"></div>
      <div class="bz-diary-searchrow" style="display:none"></div>
      <div class="bz-diary-body">
        <div class="bz-rail bz-diary-rail"></div>
        <div class="bz-diary-wall"></div>
      </div>
      <div class="bz-diary-lb">
        <button class="bz-diary-lbnav bz-diary-lbnav--prev" data-act="lb-prev" title="上一个（←）"></button>
        <button class="bz-diary-lbclose" data-act="lb-close" title="关闭"></button>
        <button class="bz-diary-lbnav bz-diary-lbnav--next" data-act="lb-next" title="下一个（→）"></button>
        <div class="bz-diary-lbmedia"></div>
        <div class="bz-diary-lbcap"></div>
        <div class="bz-diary-lbsub"></div>
      </div>
      <div class="bz-sheet-mask bz-diary-sheet-mask"></div>
      <div class="bz-sheet bz-diary-sheet">
        <div class="bz-sheet-grip"></div>
        <div class="bz-sheet-head bz-diary-sheet-head">
          <span class="bz-diary-sheet-emoji"></span>
          <div class="bz-diary-sheet-info">
            <div class="bz-sheet-title bz-diary-sheet-time"></div>
            <div class="bz-diary-sheet-content"></div>
            <div class="bz-diary-sheet-media"></div>
          </div>
        </div>
        <div class="bz-sheet-body bz-sheet-actions bz-diary-sheet-actions"></div>
      </div>
    `;
}

// ===== 日分节统计（节头右侧「N 图 · N 视频 · …」） =====

export interface WallDayStats {
  imgs: number;
  vids: number;
  auds: number;
  texts: number;
}

/** 单日统计：媒体按类计数 + 有正文条目数 */
export function dayStats(list: WallEntry[]): WallDayStats {
  let imgs = 0;
  let vids = 0;
  let auds = 0;
  let texts = 0;
  list.forEach((e) => {
    e.media.forEach((k) => {
      if (k.kind === 'video') vids++;
      else if (k.kind === 'audio') auds++;
      else imgs++;
    });
    if (e.content) texts++;
  });
  return { imgs, vids, auds, texts };
}

/** 统计 → 节头 HTML（零值类不显示；全空显示「空」） */
export function statHtml(s: WallDayStats): string {
  const parts: string[] = [];
  if (s.imgs) parts.push(`<b>${s.imgs}</b> 图`);
  if (s.vids) parts.push(`<b>${s.vids}</b> 视频`);
  if (s.auds) parts.push(`<b>${s.auds}</b> 音频`);
  if (s.texts) parts.push(`<b>${s.texts}</b> 条文字`);
  return parts.join(' · ') || '空';
}

/** 节头日期的星期文案（'周日'…'周六'） */
export const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

// ===== 灯箱题注（增强 #6：标题行去文件名，改「日期 时间 · 标签字」） =====

export function lbCaption(entry: WallEntry): string {
  return `${entry.date} ${entry.time}` + (entry.tags.length ? ` · ${entry.tags.join(' ')}` : '');
}

/** 灯箱副行：日记正文文字（去媒体引用；空正文回落原文） */
export function lbSubText(entry: WallEntry): string {
  return entry.text || entry.content || '';
}

// ===== 媒体块题注（增强 #6：「emoji 时间　标签字」，标签为空仅时间） =====

export function mediaCapHtml(entry: WallEntry): string {
  const tagText = entry.tags.filter((t) => t !== '加密').join(' ');
  return `<span style="opacity:.75">${esc(entry.emoji)} ${esc(entry.time)}</span>${tagText ? `　${esc(tagText)}` : ''}`;
}
