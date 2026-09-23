/**
 * 知识盒（knowledge 域）UI —— ADR-0112 三部重构（原型为唯一真理）：
 * 部壹·文献（四种录入进货 + 文献词典列表 + 预览）、部贰·卡片（卡片盒扫描展示）、
 * 部叁·主题（主题笔记仅展示，写作与检索归 Obsidian + 第二大脑）。
 * 知识盒只整理关联：文献→卡片 = 连一张旧卡 + 一句为什么（related 键，源文献自动互链）。
 * 录入入口四名词（issue 309/312；顺序 2026-09-14 复核为 图版在影像之前）：名词（一个词）/ 段落（一段文字，AI 自动出标题）/ 影像（B 站视频任务）/
 * 图版（拖入或粘贴图片，AI 读图成文，issue 312；**可多张**，issue 313）。名词 / 段落 / 图版共用一个面板壳
 * （同壳三态：单行 input / 多行 textarea / 图片拖入区 + 来源行一致）。关联时机 = **AI 出内容即起跑**：
 * 属性区「关联」行走「分析中… → 关联名」；分析期间按钮不锁（issue 327）——重新生成 / 总结随点随断在途
 * 裁判、新内容回来再分析；确认写入全程不动关联行，把结果写进新笔记 related 后**直接关窗**。
 * 面板不设取消钮（退出走点遮罩 / ESC，有草稿先过二次确认）。
 * 事件刷新：knowledge:tasks（视频 converted/failed + 本域生成事件，小橘行为流亦订阅此通道）。
 * 影像两个界面（issue 310 + 2026-09-14 复核）：**录入界面**（主窗「影像」按钮 / 命令 / 聚合讯直达；
 * 词典皮行内标签行，初始只出链接行，解析跑完才展开信息 / 分P / 剪辑 / 清晰度 / 保存；标题栏不放出口钮
 * ——保存即落队列并打开**处理面板**）→ **处理面板**（任务列表 + 图标钮：新增 / 批量 play↔square / 历史；
 * 历史是**同一面板内的第二视图**，不在新弹窗里——切过去题字换「历 史」、图标组只留返回箭头）。
 * 两界面的头部同用主窗词典头（.bz-kb-head + 题字，左列计数 / 右列图标组），图标一律 lucide
 * （iconSpan 占位 + mountIcons 兑现，无 emoji）。
 * 移除（ADR-0112 原型拍板）：领域筛选/搜索/双击打开/抽屉/面板内设置按钮（设置走设置面板域）。
 */
import { Component, MarkdownRenderer, setIcon, type App } from 'obsidian';
import { imageDataUrl, imageExtOfMime, imageMimeOfPath } from '../core/ai';
import { localNow } from '../core/ui/str';
import type { SettingsSchema } from '../core/settings-schema';
import { isMobileEnv } from '../core/mobile';
import { tryGetSettings, getSettings, saveSettings } from '../core/settings-provider';
import { getKnowledgeBoxes } from '../core/knowledge-boxes';
import { getLinkBridge } from '../core/link-now';
import { attachItemActions, type ItemAction } from '../core/item-actions';
import { confirmDiscard, openFlowDialog } from '../core/flow-dialog';
import { notice, notify } from '../core/notice';
import { escapeHtml, fetchPageTitle, formatRelativeTime, stripMdExt, openExternalUrl } from '../core/utils';
import { iconSpan } from '../core/ui/str';
import { mountIcons } from '../core/ui/icons';
import { uiSuggest } from '../core/ui/suggest';
import { topifyZ } from '../core/z-order';
import { emitDomainEvent, onDomainEvent } from '../core/domain-bus';
import { getApp } from '../core/app';
import type BzSettings from '../settings';
import { KnowledgeData, normalizeLooseTime, secToTimeText, timeTextToSec } from './data';
import { mountCtx, orphanCards, refCounts } from './mount-data';
import type { KnowledgeTask } from './types';
import { BatchRunner, type BatchEvents } from './processor';
import { openMountTree } from './mount-canvas';
import { backfillNotes, findDuplicateTermNote, generateImageDraft, generateImageNote, generatePassageDraft, generatePassageNote, generateTermDraft, generateTermNote, parseDomainList, resolveImageDir, type DraftFields, type DraftHooks } from './note-gen';
import { canonicalVideoUrl, cleanSourceTitle, isUrlLikeSourceText, normalizeSourceUrl, noteSourceName, type TermSource } from './source';
import { fetchCheckedQualities, fetchVideoMeta, needsBvidRepair, parseBvid, resolveVideo, type ResolvedVideo, type VideoMeta } from './video-meta';
import { RangeBar } from './range-bar';
import {
  motionAddIn, motionAddOut, motionAddReveal, motionCardsAppended, motionContentArrive, motionDupHint,
  motionEntryIn, motionEntryOut, motionEntryPenOn, motionEntryPreviewIn, motionLitReveal, motionMainIn,
  motionMainOut, motionMetaSetValue, motionPenOff, motionPreviewBody, motionRelChips, motionRelRowIn,
  motionSheetIn, motionSheetOut, motionSrcChipIn, motionStampBadge, motionTeardown, motionThumbsIn,
  motionTreeIn, motionTreeOut, motionTreeCards, motionTreeEdges, motionTreeMenu, motionProgressIn,
  motionVideoIn, motionVideoOut, motionVideoRows, motionClosing, type MotionCue,
} from './motion';

/** 文献类型 → 紧凑行名（issue 309/312 四类：名词 / 段落 / 影像 / 图版；未知类型按名词兜底）；
 *  行内标签（字距版）与紧凑写法同源派生，别再各写一份映射（review 2026-09-14） */
function litKindPlain(type: string): string {
  if (type === 'video') return '影像';
  if (type === 'passage') return '段落';
  if (type === 'image') return '图版';
  return '名词';
}
/** 同一映射的行内标签（每字间加空格的「词典字距」排版） */
function litKindLabel(type: string): string {
  return litKindPlain(type).split('').join(' ');
}
/** 图版单次录入的图片张数上限（issue 313）：一次 AI 请求的图片数封顶，避免大图组拖垮上行与费用 */
const IMAGE_ENTRY_MAX = 9;

/** 「被引 N」徽标 tooltip（卡片部与文献部共用一份文案：同一个数就该说同一句话） */
function refBadgeTitle(n: number): string {
  return `被 ${n} 处引用（正文双链 + 关联属性）`;
}

/**
 * 录入预填扩展（issue 329，供剪藏本划选工具框等程序化入口消费；全可选，缺省零影响）。
 * source 不在此——来源走 showXxxEntry 的 src 参数（TermSource），由 index.ts 把契约的
 * url/note 两态归一后传入。onCreated 语义：确认写入成功落盘后回调 notePath，且**不自动打开笔记**
 * （ADR-0144 工具框流程）；取消 / 写入失败不回调。
 */
export interface EntryPrefill {
  /** 段落态正文预填（名词态走 term 参数，图版态无正文） */
  text?: string;
  /** 图版态 data URL 图片预填（走 acceptImageFiles 同构校验与上限） */
  images?: string[];
  /** 写入成功落盘后回调笔记路径 */
  onCreated?: (notePath: string) => void;
}
/** 后台建链动态通知的去重键（issue 327）：同键原地更新，progress 起跑 → 结果落地 */
const REL_BG_NOTICE_KEY = 'bz-kb-entry-rel';

interface StatusMeta { label: string; cls: string; }
const STATUS_META: Record<KnowledgeTask['status'], StatusMeta> = {
  pending: { label: '待处理', cls: 'bz-kb-pending' },
  processing: { label: '处理中', cls: 'bz-kb-processing' },
  success: { label: '成功', cls: 'bz-kb-success' },
  failed: { label: '失败', cls: 'bz-kb-failed' },
};

function q<T extends HTMLElement>(root: HTMLElement, sel: string): T | null {
  return root.querySelector(sel) as T | null;
}

/**
 * 从剪贴板取图片文件（issue 312 图版；多图 issue 313：一次粘贴可带多张）
 * 优先 items（截图粘贴常带 image/png，且 files 在部分环境为空），再退回 files；
 * 两条路都取到内容时按 items 优先（同一批图可能两边都有，避免收两遍）。无图返回空数组。
 */
function clipboardImageFiles(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const out: File[] = [];
  const items = dt.items;
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it?.kind === 'file' && /^image\//i.test(it.type)) {
        const f = it.getAsFile();
        if (f) out.push(f);
      }
    }
  }
  if (out.length) return out;
  const files = dt.files;
  if (files) {
    for (let i = 0; i < files.length; i++) {
      if (/^image\//i.test(files[i]?.type || '')) out.push(files[i]);
    }
  }
  return out;
}

/** HTML 转义（进度文案来自外部进程 stdout，统一转义防注入；core escapeHtml 转发壳） */
function esc(s: unknown): string {
  return escapeHtml(String(s ?? ''));
}

/** 历史笔记行展示名：去目录（含反斜杠兼容）去 .md 后缀；空路径回退原串 */
function shortNoteName(path: string): string {
  const base = String(path || '').replace(/\\/g, '/').split('/').pop() || '';
  return stripMdExt(base) || String(path || '');
}

/**
 * frontmatter.related 展示名解析（行扫描实现；issue 309 起预览「关联」区与录入面板关联行共用）：
 * 只认 `related:` 起头的列表项 `- "[[路径|名]]"`，取别名优先、否则取去目录去 .md 的文件名
 * （展示名不长成路径）；遇非列表项即结束。
 */
export function parseRelatedNames(text: string): string[] {
  const lines = String(text ?? '').split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return [];
  const out: string[] = [];
  let inRelated = false;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') break;
    if (/^related:/.test(line)) { inRelated = true; continue; }
    if (!inRelated) continue;
    if (/^\s+-\s/.test(line)) {
      const mm = line.match(/^\s*-\s*"?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]"?\s*$/);
      if (mm) out.push(mm[2] || shortNoteName(mm[1]));
    } else if (line.trim() !== '') {
      break; // related 列表结束
    }
  }
  return out;
}

/** 失败原因白话化：外部工具 stderr / AI 报错多为英文原文，行内映射为中文白话；未命中返回截断原文 */
export function humanizeError(reason: string | null | undefined): string {
  const s = String(reason ?? '').trim();
  if (!s) return '';
  if (/未找到 bili-dl|npm install -g @jwbz\/bili-downloader|ENOENT.*bili-dl/i.test(s)) {
    return '下载工具未安装：在电脑上运行 npm install -g @jwbz/bili-downloader 后重试';
  }
  if (/ffmpeg/i.test(s)) return '视频处理工具（ffmpeg）不可用：检查电脑是否已安装，或设置里的「ffmpeg 路径」';
  if (/ffprobe/i.test(s)) return '视频探测工具（ffprobe）不可用：检查电脑是否已安装，或设置里的「ffprobe 路径」';
  if (/找不到 Python|无法启动 Python|python.*ENOENT/i.test(s)) {
    return '语音转写失败：未找到 Python——设置里「Python 路径」填 python（一般装了 Python 即可），或运行 where python 查绝对路径填入';
  }
  if (/未配置 pythonPath/i.test(s)) {
    return '语音转写未配置：知识盒设置「Python 路径」填 python 即可（一般装了 Python 就能用，走系统 PATH），或填绝对路径（Windows 在命令提示符运行 where python 可查）';
  }
  if (/pip install faster-whisper|faster-whisper 环境已安装/i.test(s)) {
    return '语音转写失败：faster-whisper 未安装，请在目标 Python 中运行 pip install faster-whisper';
  }
  if (/whisper|faster.whisper|no module/i.test(s)) {
    return '语音转写失败：检查设置里的「Python 路径」与「Whisper 模型」';
  }
  if (/API Key|AI 配置|未配置|Unauthorized|\b401\b|invalid_api_key|insufficient|quota/i.test(s)) {
    return 'AI 配置不可用：请在插件设置 → AI 配置里检查 API Key';
  }
  if (/AI 请求超时|AI 返回的不是 JSON/i.test(s)) return 'AI 响应异常：网络不稳定或服务繁忙，稍后重试';
  if (/转录文件读取失败|无转录文件/i.test(s)) return '转写稿缺失：视频处理步骤未完成，可重试';
  if (/ETIMEDOUT|ESOCKETTIMEDOUT|timed? ?out|超时/i.test(s)) return '网络超时：请检查网络连接后重试';
  if (/ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|getaddrinfo|fetch failed/i.test(s)) {
    return '网络连接失败：请检查网络或代理设置后重试';
  }
  if (/^-352|\b412\b|风控|请求过于频繁/i.test(s)) return 'B 站风控拦截：稍后再试，或在设置里配置登录 Cookie';
  if (/视频不存在|稿件不存在|\b404\b|not found/i.test(s)) return '视频不存在或已删除：请检查链接是否正确';
  return s.length > 160 ? s.slice(0, 160) + '…' : s;
}

interface RowRunState {
  steps: string[];
  phase: string | null;
  pct: number | null;
  startAt: number;
}

/** 步骤完成态文案映射（工具步骤名 → 「已…」；插件侧 AI 两步亦在此） */
const STEP_DONE_MAP: Record<string, string> = {
  'AI 生成文献笔记中': '已生成文献笔记',
  '笔记落盘中': '已落盘笔记',
};
function stepDoneLabel(step: string): string {
  const mapped = STEP_DONE_MAP[step];
  if (mapped) return mapped;
  return step.endsWith('中') ? `已${step.slice(0, -1)}` : `已${step}`;
}

function shortUrlText(url: string): string {
  const m = url.match(/BV[0-9A-Za-z]{8,12}/i) || url.match(/b23\.tv\/([0-9A-Za-z]+)/i);
  if (m) return m[0];
  return url.length > 28 ? url.slice(0, 28) + '…' : url;
}

const fmtElapsed = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
};

/** 本地时间戳「YYYY-MM-DD HH:mm:ss」（卡片 date / 术语卡日期展示共用） */
function dateStamp(): string {
  return localNow(); // issue 365 收编：原手写与 core/ui/str localNow 逐字等价
}

/**
 * 三个盒子目录（ADR-0141 §4：解析单源在 core/knowledge-boxes，本域只做本地面板取用壳）。
 * 传空对象即走缺省盒名——「设置未载入」场景原样保留旧语义（不悄悄读全局设置）。
 */
function litDirOf(s: Partial<BzSettings> | undefined): string {
  return getKnowledgeBoxes(s || {}).lit;
}
/** 卡片目录（缺省「卡片盒」） */
function cardboxDirOf(s: Partial<BzSettings> | undefined): string {
  return getKnowledgeBoxes(s || {}).cardbox;
}
/** 主题目录（缺省「主题盒」） */
function topicDirOf(s: Partial<BzSettings> | undefined): string {
  return getKnowledgeBoxes(s || {}).topic;
}

function parseDateRaw(raw: string | undefined | null): number {
  const s = String(raw ?? '').trim();
  if (!s) return NaN;
  const d1 = new Date(s.replace(' ', 'T'));
  if (!isNaN(d1.valueOf())) return d1.valueOf();
  const d2 = new Date(s);
  return d2.valueOf();
}

/** 剥 frontmatter 返回正文 */
function stripFrontmatter(text: string): string {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return text.slice(m ? m[0].length : 0).replace(/^\r?\n+/, '');
}

/** 部壹文献条目（数据源 = 文献目录文件夹实况，不从数据文件派生） */
interface KnowledgeNoteEntry {
  file: any;
  path: string;
  title: string;
  type: string;
  domain: string;
  summary: string;
  source: string;      // 出处原文值（URL 或 [[双链]]；2026-09-16 起四类文献统一走这一个键）
  sourceTitle: string; // 出处标题（外链抓到的页面标题 / 视频原题；可选）
  date: string;
  created: number;
}

/** 三部预览共用最小面：文献/卡片/主题行点击开同一个弹层（缺省字段安全降级） */
interface PreviewEntry {
  file: any;
  path: string;
  title: string;
  type?: string;
  domain?: string;
  date?: string;
  source?: string;
  sourceTitle?: string;
}

/** 部贰卡片条目（领域只认 `domain`；`category` 历史别名已摘，2026-09-16 统一） */
interface CardEntry {
  file: any;
  path: string;
  title: string;
  domain: string;
  review: boolean;
  created: number;
}

/** 部叁主题条目（仅展示） */
interface TopicEntry {
  file: any;
  path: string;
  title: string;
  where: string;
  created: number;
}

/** 知识盒设置 schema（声明式五组；ADR-0112 更名并新增卡片/主题目录，ADR-0141 增「自动关联」组） */
export function knowledgeSettingsSchema(opts?: { onClearHistory?: () => void | Promise<void>; onClearSuggestCache?: () => void | Promise<void> }): SettingsSchema {
  // 自动关联的总开关是**启动快照**配置（监听注册发生在域初始化），一次弹窗会话只提示一次（文案冻结同第二大脑面板）
  let reloadWarned = false;
  const warnReload = () => {
    if (reloadWarned) return;
    reloadWarned = true;
    notice('自动关联设置已保存，重载插件后生效', 'info');
  };
  /** 缺省开语义（键缺失视为开，沿用原 !== false 口径） */
  const boolDefaultOn = (key: string) => ({
    get: () => (tryGetSettings() as any)[key] !== false,
    set: (v: boolean) => {
      (getSettings() as any)[key] = v;
    },
    save: () => saveSettings(),
  });
  return {
    groups: [
      {
        // 外观组（issue 246 占位单卡）：布局/主题各一档，域 UI 消费待皮肤设计时接入
        icon: 'palette', name: '外观',
        rows: [
          { type: 'choiceCards', name: '面板布局', binding: { key: 'knowledgeSkin' }, options: [{ value: 'default', label: '词条', prevClass: 'bz-sp-prev-panel' }] },
          { type: 'choiceCards', name: '面板主题', binding: { key: 'knowledgeSkinTheme' }, layoutKey: 'knowledgeSkin', options: [{ value: 'manila', label: '牛皮纸', layout: 'default', prevClass: 'bz-sp-prev-manila' }] },
        ],
      },
      {
        icon: 'folder-open', name: '目录与分类',
        rows: [
          { type: 'path', mode: 'single', name: '文献文件夹', desc: '文献笔记所在文件夹，部壹扫描这里', binding: { key: 'knowledgeDirectory' } },
          { type: 'path', mode: 'single', name: '图版图片文件夹', desc: '图版录入的图片落地位置，留空默认放文献文件夹下的 assets',
            binding: { key: 'knowledgeImageFolder' },
            // 空值 = 回落到文献文件夹下的 assets（把「实际会落到哪」显式显示出来，不让人猜）
            fallbackValue: () => resolveImageDir(tryGetSettings() || {}) },
          { type: 'path', mode: 'single', name: '卡片文件夹', desc: '你自己写的卡片笔记所在文件夹，部贰扫描后把提炼的卡落在这里', binding: { key: 'knowledgeCardboxDirectory' } },
          { type: 'path', mode: 'single', name: '主题文件夹', desc: '主题笔记所在文件夹，部叁展示为主，自动关联会写入关联属性', binding: { key: 'knowledgeTopicDirectory' } },
          { type: 'textarea', name: '领域词表', desc: '逗号分隔的领域词，留空则 AI 自由写领域', binding: { key: 'knowledgeDomainList' }, placeholder: '物理,医学,计算机,经济…' },
        ],
      },
      {
        // 自动关联（ADR-0141 §1：原第二大脑「自动双链」组迁入本域，正名「自动关联」）。
        // 没有「关联范围」行——范围恒为上面三个文件夹，不再可配（ADR-0141 §2）。
        icon: 'link', name: '自动关联',
        rows: [
          { type: 'toggle', name: '自动关联', desc: '三个盒子的笔记改动后自动建关联，候选近邻经 AI 裁判筛选', binding: boolDefaultOn('linkAgentEnabled'), onChange: warnReload },
          // 2026-09-23：三行原为 text + 「三函数绑定 + onChange 钳制复写」——那是「number 键
          // （linkAgentTopK/MaxLinks/MinScore）在 text 行里被收窄到 string」逼出来的绕行。
          // 改标准 number 行后：键直绑（类型本就 number）；钳制交给输入框 min/max/step；
          // 空串不再被 Number('') 误写成默认值（parseClampedNumber 空→null→不写）。
          { type: 'number', name: '单篇候选数量 TopK', desc: '每篇笔记的近邻候选数，越大召回越全也越慢', binding: { key: 'linkAgentTopK' }, min: 1, max: 50, step: 1, visibleWhen: (s) => s.linkAgentEnabled !== false, isChild: true },
          { type: 'number', name: '每篇关联上限', desc: '0 表示不限量，由 AI 裁判自行决定', binding: { key: 'linkAgentMaxLinks' }, min: 0, max: 100, step: 1, visibleWhen: (s) => s.linkAgentEnabled !== false, isChild: true },
          { type: 'number', name: '候选相似度下限', desc: '低于此分的候选直接丢弃不送 AI 裁判，0 表示不过滤', binding: { key: 'linkAgentMinScore' }, min: 0, max: 1, step: 0.05, visibleWhen: (s) => s.linkAgentEnabled !== false, isChild: true },
          { type: 'toggle', name: '完成通知', desc: '处理完成后通知提醒，关闭则全程静默', binding: boolDefaultOn('linkAgentNotify'), visibleWhen: (s) => s.linkAgentEnabled !== false, isChild: true },
          { type: 'toggle', name: '失效关联自动清理', desc: '目标笔记删除后自动移除指向它的失效关联条目', binding: boolDefaultOn('linkAgentAutoClean'), visibleWhen: (s) => s.linkAgentEnabled !== false, isChild: true },
          { type: 'toggle', name: '已有关联不再建链', desc: '笔记已有关联时自动跳过处理', binding: boolDefaultOn('linkAgentRespectRelated'), visibleWhen: (s) => s.linkAgentEnabled !== false, isChild: true },
        ],
      },
      {
        icon: 'settings-2', name: '视频处理',
        rows: [
          { type: 'toggle', name: '详细进度提示', desc: '处理中显示当前步骤与耗时，关闭则仅显示步骤徽章', binding: { key: 'knowledgeProgressDetail' } },
          { type: 'toggle', name: '保留视频原件', desc: '转文献完成后保留视频文件，关闭则只生成文献笔记', binding: { key: 'knowledgeKeepVideo' } },
          { type: 'select', name: '下载清晰度', desc: '以视频源可用档位为准，低档优先命中缓存', binding: { key: 'knowledgeQuality' }, options: [{ value: 'highest', label: '最高' }, { value: '1080', label: '1080P' }, { value: '720', label: '720P' }] },
          { type: 'toggle', name: '遇错即停', desc: '单条失败后停止处理剩余任务，关闭则失败后继续', binding: { key: 'knowledgeStopOnFailure' } },
          { type: 'text', name: '输出文件夹', desc: '视频文件落地文件夹，留空跟随工具配置', binding: { key: 'knowledgeOutputDir' }, placeholder: '如 D:/videos' },
          { type: 'toggle', name: '视频压缩', desc: '转文字前压缩视频，默认开启', binding: { key: 'knowledgeCompress' } },
          { type: 'number', name: '压缩质量 CRF', desc: '数值越小画质越高，范围 18 到 28', binding: { key: 'knowledgeCrf' }, min: 18, max: 28, step: 1 },
        ],
      },
      // 「工具」组（ffmpeg / ffprobe / Python 路径、Whisper 模型、缓存文件夹与保留天数）2026-09-16 移除：
      // 这些是「负责把外部工具装起来」的人才调的参数，不是记笔记的人该面对的旋钮。
      // **设置键与消费链原样保留**（settings.ts 的键声明 + processor 的读取都没动）：存量用户配过的值
      // 继续生效，只是不再从面板暴露；留空本来就走工具侧默认值。
      {
        icon: 'wrench', name: '维护',
        rows: [
          {
            type: 'button', name: '清空历史', desc: '移除全部成功归档的转文献记录，文献笔记与视频文件保留在库中',
            buttonText: '清空历史', onClick: () => { if (opts?.onClearHistory) void opts.onClearHistory(); },
          },
          // 挂载树（issue 318）：自动跑建议开关 + 建议缓存维护（ADR-0139 §3）
          { type: 'toggle', name: '挂载建议', desc: '打开挂载树时自动跑 AI 语义建议，关闭则只看双链', binding: { key: 'knowledgeMountAutoSuggest' } },
          {
            type: 'button', name: '清空建议缓存', desc: '清空候选与生成时间，保留已固定和已取消的留档',
            buttonText: '清空建议缓存', onClick: () => { if (opts?.onClearSuggestCache) void opts.onClearSuggestCache(); },
          },
        ],
      },
    ],
  };
}

export class UIManager {
  app: App;
  // ---- 主壳（三部）----
  mask: HTMLElement | null = null;
  popup: HTMLElement | null = null;
  contentEl: HTMLElement | null = null;
  part: 'z1' | 'z2' | 'z3' = 'z1';
  /**
   * 动效层 boot 消费标志（motion.ts 口径）：showMain 置 'boot'，点部签置 'part'，
   * 首个渲染消费即熄复位 'silent'——后台文件变更刷新等非首次渲染静默不重播。
   */
  private motionCue: MotionCue = 'silent';
  private allNotes: KnowledgeNoteEntry[] = [];
  private allCards: CardEntry[] = [];
  private allTopics: TopicEntry[] = [];
  /** 已渲染的卡片行数（issue 323：翻页只**追加**新行，不再整表 innerHTML 重建） */
  private cardsShown = 0;
  /** 卡片行容器（与表头/页脚分离，追加与徽标补丁都打在它身上） */
  private cardRowsEl: HTMLElement | null = null;
  /**
   * 挂载引用索引（issue 320 / 323）：整库扫描一次并**缓存到面板对象上**——
   * 行引用计数徽标（refCounts）、孤儿筛选与行标记（orphanCards）共用这一份；
   * counts 算好后**传给 orphanCards 复用**（其内部不再自行复算一遍）。
   *
   * 323 起改**面板会话缓存 + 脏标记**：切到卡片部不再整库重扫（1503+ 文件逐个解析出站链是切换卡顿的大头），
   * 只有**落卡 / 库内文件变更 / 目录变更 / 显式刷新**才置脏重算。
   */
  private mountIndex: { counts: Record<string, number>; orphans: Set<string> } | null = null;
  private mountIndexDirty = true;
  /** 部贰「只看孤儿」筛选开关（内存态，重渲染 / 换部来回都保留） */
  private cardOrphanOnly = false;
  private loadedLitDir = '';
  private loadedCardDir = '';
  private loadedTopicDir = '';
  private backfilledDir = '';
  // ---- 影像：录入弹层 / 处理面板（内含历史视图）（issue 310）----
  videoMask: HTMLElement | null = null;
  videoPopup: HTMLElement | null = null;
  videoList: HTMLElement | null = null;
  /** 批量钮的图标容器（play ↔ square 就地换字符，issue 310 去 emoji） */
  private runIcon: HTMLElement | null = null;
  // ---- 添加任务弹窗 ----
  addMask: HTMLElement | null = null;
  addPopup: HTMLElement | null = null;
  /** 用户动过表单（issue 326 关闭二次确认的脏标记）：只在真实用户事件点打标、开窗/保存成功复位——
   *  不做数值比对，因为打开即自动重抓（ADR-0133）会程序化改写 url 与时长区间，比值必假阳 */
  private addDirty = false;
  // ---- 添加弹窗解析态（ADR-0133：解析按钮 + 只读信息区 + 双把手范围）----
  /** 解析序列号：新解析/关弹窗使在途响应过期（回填前校验丢弃） */
  private addUrlSeq = 0;
  /** 解析中（解析按钮 loading、保存禁用） */
  private addResolving = false;
  /**
   * 下半个表单是否展开（issue 310：录入界面初始**只显示链接行**，解析跑完才展开
   * 信息 / 分P / 剪辑 / 清晰度 / 保存）。置 true 的时机：解析流程结束（成功或失败）、
   * 编辑既有任务（已有数据）；置 false：新开弹窗、链接被改动（旧信息作废，需重新解析）。
   */
  private addRevealed = false;
  /** 解析成功的信息（null = 未解析 / 失败态） */
  private addMeta: VideoMeta | null = null;
  /** 实测清晰度档位（null = 未取到 → 固定列表回落） */
  private addQualities: number[] | null = null;
  /** 当前选中分 P（1 起） */
  private addPage = 1;
  /** 当前 P 时长（秒；0 = 未知 → 进度条不可用、只出时间框） */
  private addDuration = 0;
  /** 范围选择（秒；全选 = 整片） */
  private addStart = 0;
  private addEnd = 0;
  /** 双把手范围条实例（重建时销毁旧的） */
  private addBar: RangeBar | null = null;
  /** 主面板自动重抓（ADR-0133）：进行中标记 + 已尝试任务 id 集（防重入/防重复请求） */
  private backfillRunning = false;
  private backfillTried = new Set<string>();
  /** 处理面板当前视图：tasks=任务队列 / history=归档（2026-09-14 复核起同面板切换，无独立历史窗） */
  private videoView: 'tasks' | 'history' = 'tasks';
  // ---- 文字录入面板（名词 / 段落 / 图版同壳三态，issue 309/312）----
  termMask: HTMLElement | null = null;
  termPopup: HTMLElement | null = null;
  /** 当前录入态：term = 一个词（名词）/ passage = 一段文字（段落）/ image = 一张图（图版） */
  private entryMode: 'term' | 'passage' | 'image' = 'term';
  private termPreview: { domain: string; body: string; title?: string } | null = null;
  /**
   * 用户已就地改过的属性字段（建议 5）：流式期间**不再用 AI 值覆盖它**——用户刚打完的标题
   * 不该被下一帧 delta 冲掉。点「重新生成」= 新一轮 → 整集合清空，这就是用户要的「覆盖」语义。
   */
  private userEdited = new Set<'term' | 'title' | 'domain'>();
  /** 领域行编辑态的联想象（进编辑态建、出编辑态销，见 beginMetaEdit） */
  private termDomainSuggest: ReturnType<typeof uiSuggest> | null = null;
  /** 生成流在途（ADR-0152/issue 343）：与 termSaving 分开——「是否正在生成」与「是否正在落盘」是两件事 */
  private termGenerating = false;
  /** 确认写入的落盘过程在途（承接原 termGenerating 的写入语义）：期间不接生成 / 再次写入 */
  private termSaving = false;
  /** 草稿中断标记（ADR-0152 决策 6）：流断在半个 JSON 上 → 已流入的正文保留可见，但**不可写** */
  private termDraftBroken = false;
  /** 在途生成流的中断器（ADR-0152 决策 7）：再点生成 = abort 重开；关窗二次确认**之后**才 abort */
  private termGenAbort: AbortController | null = null;
  /** 已流入正文区的正文（空串 = 还没有正文字符到达）：中断收场据此判断「有没有半篇要保留」 */
  private termStreamBody = '';
  private termSource: TermSource | null = null; // 来源（名词/段落/图版共用行，ADR-0116；null = 未填）
  /**
   * 图版待落盘图片（issue 312；多图 issue 313）：拖入/粘贴/选择后**只留在内存**
   * （bytes 原样 + 预览用 data URL），确认写入时才 createBinary 进图片目录——
   * 与「草稿不落盘」同口径，取消不留孤儿文件。顺序 = 用户放入顺序（就是笔记里的图片顺序）。
   * desc = 该张的用户图注（ADR-0145 逐图描述框；属于草稿态——删图连描述一起没，关面板即清）。
   */
  private entryImages: Array<{ mime: string; bytes: ArrayBuffer; dataUrl: string; desc: string }> = [];
  /** 确认写入成功后的回调（issue 329 剪藏本工具框流程）：有回调则写入后**不自动打开笔记**（ADR-0144），路径交调用方 */
  private entryOnCreated: ((notePath: string) => void) | null = null;
  /** 关联行状态机：idle（未生成）→ loading（预演中）→ done/empty/queued/failed/off */
  private entryRelState: 'idle' | 'loading' | 'done' | 'empty' | 'queued' | 'failed' | 'off' = 'idle';
  /** 关联行结果文案（done 时 = 关联标题顿号串） */
  private entryRelText = '';
  /** 预演命中的目标路径（确认写入时据此写 related，不重跑检索与裁判） */
  private entryPreviewPicks: string[] = [];
  /** 预演命中的候选（path 与展示名成对：写入按 path、渲染按 title；点掉时按下标同步删两处） */
  private entryPreviewItems: { path: string; title: string }[] = [];
  /** 预演是否已给出确定结果（done）——确定过就连「0 命中」也算结论，写入时不再重跑管线 */
  private entryPreviewDone = false;
  /** 在跑预演的中断器（issue 327）：重新生成 / 总结 / 关面板 / 确认写入转后台时 abort 在途裁判请求 */
  private entryRelAbort: AbortController | null = null;
  /** 预演序号：重新生成 / 关闭面板让在途结果作废（晚到的响应不得覆盖新状态） */
  private entryRelSeq = 0;
  private termSrcSuggest: ReturnType<typeof uiSuggest> | null = null;
  private termSrcTimer: ReturnType<typeof setTimeout> | null = null;

  private editingId: string | null = null;
  private onKeydown: (e: KeyboardEvent) => void = () => {};
  /** Ctrl+V 粘贴截图监听（issue 312；document 级，图版态才接管——见 createTermUI） */
  private onPaste: (e: ClipboardEvent) => void = () => {};
  private batchAbortLabel: '终止' | '终止整批' | null = null;
  private runState = new Map<string, RowRunState>();
  private runTimer: ReturnType<typeof setInterval> | null = null;
  private fileListenerRefs: (() => void)[] = [];
  private fileListenerAttached = false;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRefreshPaths = new Set<string>();
  private pendingDeletePaths = new Set<string>();

  constructor(app: App) {
    this.app = app;
    this.createMainUI();
    this.createVideoUI();
    this.createAddDialog();
    this.createTermUI();
    this.onKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // ESC 关最上层：术语面板 → 添加弹窗 → 处理面板（历史视图先退回队列）→ 主面板
      // （issue 326：录入面板关闭改走二次确认请求——有草稿先弹风格化确认，干净态直关）
      if (this.termPopup && this.termPopup.style.display === 'flex') this.requestTermClose();
      else if (this.addPopup && this.addPopup.style.display === 'flex') this.requestAddClose();
      else if (this.videoPopup && this.videoPopup.style.display === 'flex') {
        if (this.videoView === 'history') this.switchVideoView('tasks');
        else this.hideVideo();
      }
      else if (this.previewHostEl?.isConnected) this.closeSheet(); // 直达预览的独立宿主（主面板不在场）同样 ESC 可关
      else if (this.popup && this.popup.style.display === 'flex') this.hideMain();
    };
    document.addEventListener('keydown', this.onKeydown);
  }

  // ==================== 主壳（三部） ====================

  createMainUI(): void {
    if ((this.mask && this.mask.isConnected) || (this.popup && this.popup.isConnected)) return;
    const mask = document.createElement('div');
    mask.id = 'knowledge-mask';
    mask.className = 'bz-overlay-mask bz-kb-mask'; // issue 365 收编单源后此处漏挂 → 遮罩零尺寸不可见、点不着关不掉
    mask.style.display = 'none';
    mask.onclick = () => this.hideMain();

    const popup = document.createElement('div');
    popup.id = 'knowledge-popup';
    popup.className = 'bz-kb-window kb';
    if (isMobileEnv()) popup.classList.add('bz-panel-mtop'); // 移动端主窗真全屏（ADR-0116，样式见 styles.css 尾部）
    popup.style.display = 'none';
    // 移动端头部定稿（章回式）：题字居中一行，部切换通栏三格挪出头部压双细线；桌面维持竖排部签居中题字
    const partBtns = `
          <button class="bz-kb-part is-on" data-kb-act="part" data-part="z1">部壹 · 文献</button>
          <button class="bz-kb-part" data-kb-act="part" data-part="z2">部贰 · 卡片</button>
          <button class="bz-kb-part" data-kb-act="part" data-part="z3">部叁 · 主题</button>`;
    popup.innerHTML = isMobileEnv() ? `
      <div class="bz-kb-head">
        <div class="bz-kb-brand">
          <div class="bz-kb-title">知 识 盒</div>
          <div class="bz-kb-top">LEXICON · BOX OF NOTES</div>
        </div>
        <button class="bz-kb-mclose" data-kb-act="kb-close" title="关闭知识盒">✕</button>
      </div>
      <div class="bz-kb-parts">${partBtns}
      </div>
      <div class="bz-kb-sc" id="kb-sc"></div>` : `
      <div class="bz-kb-head">
        <div class="bz-kb-parts">${partBtns}
        </div>
        <div class="bz-kb-brand">
          <div class="bz-kb-title">知 识 盒</div>
          <div class="bz-kb-top">LEXICON · BOX OF NOTES</div>
        </div>
      </div>
      <div class="bz-kb-sc" id="kb-sc"></div>`;
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    this.mask = mask;
    this.popup = popup;
    this.contentEl = q<HTMLElement>(popup, '#kb-sc');
    popup.addEventListener('click', (e) => this.onShellClick(e as MouseEvent));
    this.contentEl?.addEventListener('scroll', () => this.onContentScroll());
    this.attachFileListener();
  }

  /** 主壳点击委托（部切换 / 录入入口 / 文献行 / 主题行 / 返回） */
  private onShellClick(e: MouseEvent): void {
    const t = (e.target as HTMLElement).closest('[data-kb-act]') as HTMLElement | null;
    if (!t) return;
    const act = t.getAttribute('data-kb-act');
    if (act === 'part') { this.part = (t.getAttribute('data-part') as 'z1' | 'z2' | 'z3') || 'z1'; this.motionCue = 'part'; void this.refreshCurrent(); this.syncPartButtons(); }
    else if (act === 'term-entry') this.showTermEntry();
    else if (act === 'passage-entry') this.showPassageEntry();
    else if (act === 'video-entry') this.showVideoEntry();
    else if (act === 'image-entry') this.showImageEntry();
    else if (act === 'lit-peek') { const p = t.getAttribute('data-path') || ''; const n = this.allNotes.find((x) => x.path === p); if (n) void this.openPreview(n); }
    else if (act === 'card-peek') { const p = t.getAttribute('data-path') || ''; const c = this.allCards.find((x) => x.path === p); if (c) void this.openPreview(c, 'card'); }
    // 看挂载树（issue 319）：卡片列表行 / 卡片预览弹层共用一个分支——以该笔记为主卡开全屏白板
    else if (act === 'mount-tree') { const p = t.getAttribute('data-path') || ''; if (p) void openMountTree(p); }
    else if (act === 'cards-orphan') {
      if (!this.mountIndex) return; // 索引未统计（扫描失败）：芯片置灰，不给假状态
      this.cardOrphanOnly = !this.cardOrphanOnly;
      this.motionCue = 'part'; // 动效层：用户主动换池 = 翻部级编排（重建后消费）
      this.renderCards(); // 池随筛选变化 → 重建（内部回收到首屏 80 行）
    }
    else if (act === 'topic-open') { const p = t.getAttribute('data-path') || ''; const tp = this.allTopics.find((x) => x.path === p); if (tp) void this.openPreview({ file: tp.file, path: tp.path, title: tp.title, domain: tp.where }, 'topic'); }
    else if (act === 'kb-close') this.hideMain(); // 移动端全屏主窗出口（ADR-0116：手机无 ESC/遮罩边缘）
  }

  private syncPartButtons(): void {
    if (!this.popup) return;
    this.popup.querySelectorAll('.bz-kb-part').forEach((b) => {
      b.classList.toggle('is-on', (b as HTMLElement).getAttribute('data-part') === this.part);
    });
  }

  showMain(): void {
    this.createMainUI();
    if (!this.popup || !this.mask || !this.contentEl) return;
    topifyZ(this.mask, this.popup);
    this.mask.style.display = 'block';
    this.popup.style.display = 'flex';
    // 动效层：落纸壳入场；boot 标志置位，首个渲染（refreshCurrent → renderXxx）消费即熄
    this.motionCue = 'boot';
    motionMainIn(this.popup);
    // 评审便利：#replay 重播首屏编排（motion.ts 的 hashchange 钩子消费；插件内无害）
    (window as unknown as Record<string, unknown>).__bzKbReplay = () => {
      if (!this.popup || !this.mask) return;
      this.mask.style.display = 'block';
      this.popup.style.display = 'flex';
      this.motionCue = 'boot';
      motionMainIn(this.popup);
      void this.refreshCurrent();
    };
    void this.refreshCurrent();
    void this.runBackfill();
  }

  hideMain(): void {
    // 动效层：退场中忽略重复关闭（ESC 连按 / 遮罩连点），收纸演完才交还 display
    if (this.popup && motionClosing(this.popup)) return;
    const popup = this.popup;
    const mask = this.mask;
    motionMainOut(popup, () => {
      if (mask) mask.style.display = 'none';
      if (popup) popup.style.display = 'none';
    });
  }

  /** 当前部数据 + 渲染（目录变更检测 → 清缓存重扫） */
  private async refreshCurrent(): Promise<void> {
    if (!this.contentEl) return;
    const s = tryGetSettings() as Partial<BzSettings> | undefined;
    if (this.part === 'z1') {
      const dir = litDirOf(s);
      if (this.loadedLitDir && this.loadedLitDir !== dir) this.allNotes = [];
      await this.loadLiterature(dir);
      this.renderLiterature(); // 首屏先出文献行：不把列表卡在整库索引上（与部贰同策略）
      if (this.part !== 'z1') return; // 期间换了部 → 本次作废
      if (this.mountIndexDirty) await this.loadMountIndex();
      if (this.part === 'z1') this.patchLitBadges(); // 索引落地后补文献行的「被引 N」
    } else if (this.part === 'z2') {
      const dir = cardboxDirOf(s);
      if (this.loadedCardDir && this.loadedCardDir !== dir) { this.allCards = []; this.markCardsDirty(); }
      await this.loadCards(dir);
      this.renderCards(); // 首屏先出卡片行：不把列表卡在整库扫描上
      if (this.part !== 'z2') return;
      if (this.mountIndexDirty) await this.loadMountIndex(); // 会话缓存：只有脏了才整库重扫（issue 323）
      if (this.part === 'z2') this.applyMountIndex(); // 扫描落地后补徽标 / 孤儿标记 / 筛选计数
    } else {
      const dir = topicDirOf(s);
      if (this.loadedTopicDir && this.loadedTopicDir !== dir) this.allTopics = [];
      await this.loadTopics(dir);
      this.renderTopics();
    }
  }

  /** 部壹文献扫描：文献目录下全部 .md（含子目录），metadataCache 解析 frontmatter */
  private async loadLiterature(dir: string): Promise<void> {
    const app = getApp();
    this.loadedLitDir = dir;
    const prefix = dir + '/';
    const mdFiles = (app.vault.getFiles() || []).filter((f: any) => f.path.startsWith(prefix) && f.extension === 'md');
    const entries: KnowledgeNoteEntry[] = [];
    for (const f of mdFiles) {
      const e = await this.parseNoteFile(f);
      if (e) entries.push(e);
    }
    entries.sort((a, b) => (b.created - a.created) || a.path.localeCompare(b.path));
    this.allNotes = entries;
  }

  private async parseNoteFile(file: any): Promise<KnowledgeNoteEntry | null> {
    const app = getApp();
    try {
      const cache = app.metadataCache.getFileCache(file);
      const fm = cache && (cache as any).frontmatter;
      const title = fm && fm.title ? String(fm.title) : file.basename;
      const date = fm && fm.date ? String(fm.date) : '';
      let created = parseDateRaw(date);
      if (isNaN(created)) {
        try {
          const st = (file as any).stat;
          created = st && st.ctime ? new Date(st.ctime).valueOf() : 0;
        } catch { created = 0; }
      }
      return {
        file, path: file.path, title,
        type: fm && fm.type ? String(fm.type) : '',
        domain: fm && fm.domain ? String(fm.domain) : '',
        summary: fm && fm.summary ? String(fm.summary) : '',
        source: fm && fm.source ? String(fm.source) : '',
        sourceTitle: fm && fm.sourceTitle ? String(fm.sourceTitle) : '',
        date, created,
      };
    } catch (e) {
      console.warn('解析文献笔记失败:', file.path, e);
      return null;
    }
  }

  private renderLiterature(): void {
    if (!this.contentEl) return;
    // 行内不再有 LIT-xx 编号（2026-09-16 用户拍板）：那个编号取的是「当前列表第几行」，
    // 每新增一篇全体 +1，拿它当索引毫无意义，超过 99 篇还会撑破两位排版。
    const rows = this.allNotes.map((n) => {
      const kind = litKindLabel(n.type);
      return `<div class="bz-kb-lexrow" data-kb-act="lit-peek" data-path="${esc(n.path)}">
        <div class="bz-kb-hw"><span class="bz-kb-w">${esc(n.title)}</span><span class="bz-kb-pos ${n.type === 'video' ? 'hot' : n.type === 'image' ? 'img' : ''}">${kind}</span><span class="bz-kb-dom">${esc(n.domain || '未分类')}</span></div>
        <div class="bz-kb-tail"><span class="bz-kb-meta">${esc(n.date || '')}</span></div>
      </div>`;
    }).join('');
    this.contentEl.innerHTML = `
      <div class="bz-kb-pd">
        <div class="bz-kb-entryrow">
          <button class="bz-kb-entrybtn" data-kb-act="term-entry"><b>名词</b></button>
          <button class="bz-kb-entrybtn" data-kb-act="passage-entry"><b>段落</b></button>
          <button class="bz-kb-entrybtn" data-kb-act="image-entry"><b>图版</b></button>
          <button class="bz-kb-entrybtn" data-kb-act="video-entry"><b>影像</b></button>
        </div>
        ${rows || '<div class="bz-kb-empty">「文献目录」还没有文献笔记——从上面的四种录入开始。</div>'}
      </div>`;
    // 动效层：词典行抽卡接力（boot = 首开编排 / part = 翻部编排 / silent = 后台刷新静默）；消费即熄
    motionLitReveal(this.contentEl, this.motionCue);
    this.motionCue = 'silent';
  }

  /** 三部共用预览弹层（文献/卡片/主题同一样式）：正文真 Markdown 渲染（视频 ![[mp4]] 内嵌可播）+ 关联 + 可点来源（只读；关闭走 ✕/ESC） */
  private async openPreview(n: PreviewEntry, kind: 'lit' | 'card' | 'topic' = 'lit'): Promise<void> {
    const app = getApp();
    let raw = '';
    try { raw = await app.vault.read(n.file); } catch { raw = ''; }
    const body = stripFrontmatter(raw);
    // 纯文本段落 = 渲染失败兜底（只在渲染抛错/无产出或空正文时写入，绝不预填——预填 + 追加渲染 = 双份，issue 275）
    const parasHtml = body
      .split(/\r?\n\r?\n+/)
      .map((b) => b.trim())
      .filter(Boolean)
      .map((b) => `<p>${esc(b)}</p>`)
      .join('') || '<p>（无正文）</p>';
    const rels = await this.noteRels(n);
    // 来源（可点外开）：**四类文献统一这一块**（2026-09-16 视频的 url 键并入 source，
    // 此前视频显「原文」、其余显「来源」＝同一件事两个名字）。只出外链型 source，
    // 内部双链来源交给 Obsidian 原生反链（与旧口径一致）。
    const srcHtml = n.source && !n.source.startsWith('[[')
      ? `<div class="bz-kb-sec">来 源</div><div class="bz-kb-cliplink"><a class="bz-lit-srcopen" data-lit-src-url="${esc(n.source)}" href="#">${esc(n.sourceTitle || n.source)}</a></div>`
      : '';
    // 预览头不放「××预览」标题（2026-09-24 用户拍板）：笔记标题 + 部签 + 领域已说明一切
    // 部签色档随类型：影像 hot（红）、图版 img（accent 蓝），与名词/段落灰签区分
    const badge = kind === 'card'
      ? { text: '卡 片', cls: '' }
      : kind === 'topic'
        ? { text: '主 题', cls: '' }
        : { text: litKindLabel(n.type || ''), cls: n.type === 'video' ? 'hot' : n.type === 'image' ? 'img' : '' };
    // 挂载树入口只留卡片（2026-09-24 用户拍板：文献/主题笔记没有挂载数的概念）
    const mtBtn = kind === 'card'
      ? `<button class="bz-kb-mt-openbtn" data-kb-act="mount-tree" data-path="${esc(n.path)}" title="以这张卡为主卡打开挂载树">看挂载树</button>`
      : '';
    const ovl = this.openSheet(this.sheetWrap('', `
      <div class="bz-kb-hw"><span class="bz-kb-w" style="font-size:17px">${esc(n.title)}</span>
        <span class="bz-kb-pos ${badge.cls}">${badge.text}</span>
        <span class="bz-kb-dom">${esc(n.domain || '未分类')}</span></div>
      <div class="bz-kb-tail"><span class="bz-kb-meta">${esc(n.date || '')}</span>${mtBtn}</div>
      <div class="bz-kb-paras" id="bz-kb-preview-body"></div>
      ${rels.length ? `<div class="bz-kb-sec">关 联</div><div class="bz-kb-rels">${rels.map((r) => `<span class="bz-kb-cite">${esc(r)}</span>`).join('')}</div>` : ''}
      ${srcHtml}`));
    motionSheetIn(ovl); // 动效层：纸面摊开揭出
    this._previewNote = n;
    // 正文真 Markdown 渲染：加粗/列表/标题/引用原生出，视频 ![[mp4]] 内嵌为可播放 <video>。
    // ADR-0122 追加语义契约：render 是「追加到容器」，渲染前容器必须为空（预填纯文本再渲染 = 双份，issue 275）；
    // 兜底改事后判定——渲染抛错/无产出（mock、空产出）才回退纯文本段落；空正文显式「（无正文）」，不留全白。
    // 查询走 openSheet 返回的 ovl（issue 329 独立宿主场景 this.popup 查不到）
    const bodyEl = ovl ? q<HTMLElement>(ovl, '#bz-kb-preview-body') : null;
    if (bodyEl) {
      bodyEl.textContent = '';
      if (body) {
        try {
          const comp = new Component();
          await MarkdownRenderer.render(this.app, body, bodyEl, n.path, comp);
          comp.unload();
        } catch { /* 渲染失败回退纯文本 */ }
        if (!bodyEl.querySelector('*')) {
          // 成败判据 =「是否产出元素」：嵌入型正文（如纯 ![[…mp4]]）渲染成功产出 video 但无文本，
          // 不得因 textContent 为空误触发兜底（否则字面嵌入叠加在视频后 = 双份复现，review 275 修复）
          bodyEl.innerHTML = parasHtml;
        }
      } else {
        bodyEl.innerHTML = parasHtml;
      }
    }
    // 来源/原文链接统一外开
    const srcLinks = ovl ? ovl.querySelectorAll('[data-lit-src-url]') : [];
    srcLinks.forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._openExternal(a.getAttribute('data-lit-src-url') || '');
      });
    });
    // 动效层：摘录逐段浮现 + 关联签片弹出（正文渲染兜底完成后编排）
    motionPreviewBody(ovl);
  }
  private _previewNote: PreviewEntry | null = null;

  /**
   * 按 path 直达文献预览（issue 329 跨域 API，ADR-0144 划词锚定双链点击）：主面板不出场——
   * openPreview 同一渲染入口与样式（ADR-0122 渲染契约），主窗不在场时落独立弹层宿主。
   * 命中并打开返回 true；路径不在文献目录 / 文件缺失 / 解析失败返回 false，由调用方
   * notice 后回退 app.workspace.openLinkText（Obsidian 原生环境维持原生跳转）。
   */
  async openPreviewByPath(path: string): Promise<boolean> {
    const p = String(path || '').trim().replace(/\\/g, '/');
    if (!p || !p.toLowerCase().endsWith('.md')) return false;
    const dir = litDirOf(tryGetSettings() as Partial<BzSettings> | undefined);
    if (!p.startsWith(dir + '/')) return false; // 不在文献目录：不是文献盒的菜
    const file = getApp().vault.getAbstractFileByPath(p);
    if (!file || (file as any).isFolder) return false;
    const entry = await this.parseNoteFile(file);
    if (!entry) return false;
    await this.openPreview(entry);
    return true;
  }

  /** 卡片编辑入口已整体移除（2026-09-16 用户拍板）：卡片的创建与编辑归用户自己在卡片文件夹里做，
   *  知识盒只做扫描与展示。 */

  /** 部贰卡片扫描：领域只认 `domain`（2026-09-16 统一：`category` 兜底已摘——
   *  它是历史别名，实测库里 0 张卡在用；写入侧唯一写 category 的落卡也已移除）。 */
  private async loadCards(dir: string): Promise<void> {
    const app = getApp();
    this.loadedCardDir = dir;
    const prefix = dir + '/';
    const mdFiles = (app.vault.getFiles() || []).filter((f: any) => f.path.startsWith(prefix) && f.extension === 'md');
    const out: CardEntry[] = [];
    for (const f of mdFiles) {
      try {
        const cache = app.metadataCache.getFileCache(f);
        const fm = (cache && (cache as any).frontmatter) || {};
        let created = 0;
        try { created = (f as any).stat?.ctime ? new Date((f as any).stat.ctime).valueOf() : 0; } catch { created = 0; }
        out.push({
          file: f, path: f.path,
          title: fm && fm.title ? String(fm.title) : f.basename,
          domain: fm && fm.domain ? String(fm.domain) : '未分类',
          review: fm && fm.reviewStart != null,
          created,
        });
      } catch { /* 单文件解析失败跳过 */ }
    }
    out.sort((a, b) => b.created - a.created || a.path.localeCompare(b.path));
    this.allCards = out;
  }

  /**
   * 挂载引用索引（issue 320；ADR-0138 §5 同包四项）：整库扫描一次并**缓存到面板对象上**——
   * 行引用计数徽标（refCounts）、孤儿筛选与行标记（orphanCards）共用这一份；
   * counts 算好后**传给 orphanCards 复用**（其内部不再自行复算一遍）。
   *
   * **323 起按面板会话缓存 + 脏标记**：切到「卡片」部不再整库重扫（1500+ 文件逐个解析出站链
   * 是切换卡顿的最大头），只有**落卡 / 库内文件变更 / 目录变更 / 显式刷新**才置脏重算。
   * 扫描异常按空索引降级：芯片显「未统计」并置灰，列表照常渲染（异常时留脏，下次再试）。
   */
  private async loadMountIndex(): Promise<void> {
    try {
      const ctx = mountCtx();
      const counts = await refCounts(ctx);
      this.mountIndex = { counts, orphans: new Set(await orphanCards(ctx, counts)) };
    } catch {
      this.mountIndex = null;
    }
    if (this.mountIndex) this.mountIndexDirty = false;
  }

  /** 卡片列表与挂载索引一起置脏（落卡 / 库内文件变更 / 目录变更 → 下次进部贰重算） */
  private markCardsDirty(): void {
    this.mountIndexDirty = true;
    this.cardsShown = 0;
    this.cardRowsEl = null;
  }

  /** 当前筛选后的卡片池（只有孤儿筛选依赖挂载索引；不筛选时池 = 全部卡片） */
  private cardPool(): CardEntry[] {
    const idx = this.mountIndex;
    return this.cardOrphanOnly && idx ? this.allCards.filter((c) => idx.orphans.has(c.path)) : this.allCards;
  }

  /** 表头芯片（原地同步：索引落地后只改这一个节点，不重建整表） */
  private cardBarHtml(): string {
    const idx = this.mountIndex;
    return `<div class="bz-kb-cbar"><button class="bz-kb-cfilter${this.cardOrphanOnly ? ' is-on' : ''}" data-kb-act="cards-orphan"${
      idx ? '' : ' disabled'
    } title="${idx ? '只列既无入链也无挂载的卡' : '挂载索引未统计（扫描失败）'}">孤 儿${
      idx ? ` · ${idx.orphans.size}` : ' · 未统计'
    }</button><span class="bz-kb-meta">全部 ${this.allCards.length} 张</span></div>`;
  }

  /** 单行 HTML（全量重建与增量追加共用同一份模板） */
  private cardRowHtml(c: CardEntry): string {
    const idx = this.mountIndex;
    const n = idx?.counts[c.path] ?? 0; // 引用计数：0 不出徽标更干净（只数用户双链）
    const orphan = idx?.orphans.has(c.path) ?? false;
    return `<div class="bz-kb-lexrow" data-kb-act="card-peek" data-path="${esc(c.path)}">
      <div class="bz-kb-hw"><span class="bz-kb-w">${esc(c.title)}</span>${
        orphan ? '<span class="bz-kb-orphan" title="既无入链也无挂载">孤 儿</span>' : ''
      }<span class="bz-kb-dom">${esc(
      c.domain
    )}</span></div>
      <div class="bz-kb-tail"><span>${c.review ? '复习中 · 到期由闹钟安排' : '未入复习'}</span>${
        n > 0 ? `<span class="bz-kb-refbadge" title="${esc(refBadgeTitle(n))}">被引 ${n}</span>` : ''
      }<button class="bz-kb-mt-openbtn" data-kb-act="mount-tree" data-path="${esc(c.path)}" title="以这张卡为主卡打开挂载树">看挂载树</button></div>
    </div>`;
  }

  /**
   * 全量重建（换部 / 换筛选 / 落卡）：只搭表头 + 空行容器 + 页脚，行由 `appendCardRows` 追加。
   * 此后翻页与徽标落地都**不再**走 innerHTML 全表重建（issue 323：滚动到底反复触发时 O(n²) 抖动）。
   */
  private renderCards(): void {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = `<div class="bz-kb-pd">
      ${this.cardBarHtml()}
      <div class="bz-kb-rows" id="kb-card-rows"></div>
      <div class="bz-kb-empty" id="kb-card-more" data-kb-act="cards-more" style="display:none"></div>
    </div>`;
    this.cardRowsEl = q<HTMLElement>(this.contentEl, '#kb-card-rows');
    this.cardsShown = 0;
    this.appendCardRows(80); // 首屏 80 行（口径不变）
    // 动效层：首屏抽卡编排消费完毕（增量追加由 appendCardRows 内部自理），此后静默
    this.motionCue = 'silent';
  }

  /** 追加 n 行（增量：已渲染的行不动，滚动位置与 DOM 节点都保住） */
  private appendCardRows(n: number): void {
    const rowsEl = this.cardRowsEl;
    if (!rowsEl) return;
    const pool = this.cardPool();
    if (pool.length === 0) {
      rowsEl.innerHTML = `<div class="bz-kb-empty">${
        this.cardOrphanOnly ? '没有孤儿卡——每张卡都有人挂或挂着谁。' : '卡片目录还没有卡片——在「卡片文件夹」里新建一篇笔记即可。'
      }</div>`;
      this.cardsShown = 0;
      this.updateCardMore(pool);
      motionLitReveal(rowsEl, this.motionCue); // 动效层：空态轻揭出（silent 直通）
      return;
    }
    const from = Math.max(0, this.cardsShown);
    const to = Math.min(pool.length, from + n);
    if (to > from) {
      const tmp = document.createElement('div');
      tmp.innerHTML = pool.slice(from, to).map((c) => this.cardRowHtml(c)).join('');
      const frag = document.createDocumentFragment();
      while (tmp.firstChild) frag.appendChild(tmp.firstChild);
      rowsEl.appendChild(frag);
      this.cardsShown = to;
      // 动效层：新行抽卡揭出——首屏随 cue 编排，滚动增量永远播（新增行本是突然出现，揭出是纯增益）
      motionCardsAppended(rowsEl, from, this.motionCue);
    }
    this.updateCardMore(pool);
  }

  /** 页脚「还有 N 张」原地更新（不重渲整表） */
  private updateCardMore(pool: CardEntry[]): void {
    const moreEl = this.contentEl ? q<HTMLElement>(this.contentEl, '#kb-card-more') : null;
    if (!moreEl) return;
    const rest = pool.length - this.cardsShown;
    moreEl.style.display = rest > 0 ? '' : 'none';
    moreEl.textContent = rest > 0 ? `↓ 还有 ${rest} 张，滚动或点此加载` : '';
  }

  /** 索引落地后**原地**补徽标与孤儿标记（按行 querySelector 定位，不重建已渲染行） */
  private patchCardBadges(): void {
    const rowsEl = this.cardRowsEl;
    const idx = this.mountIndex;
    if (!rowsEl || !idx) return;
    for (const row of Array.from(rowsEl.querySelectorAll<HTMLElement>('.bz-kb-lexrow'))) {
      const path = row.getAttribute('data-path') || '';
      if (idx.orphans.has(path)) {
        const hw = row.querySelector<HTMLElement>('.bz-kb-hw');
        if (hw && !hw.querySelector('.bz-kb-orphan')) {
          const span = document.createElement('span');
          span.className = 'bz-kb-orphan';
          span.title = '既无入链也无挂载';
          span.textContent = '孤 儿';
          motionStampBadge(span); // 动效层：孤儿签盖章落位
          const dom = hw.querySelector('.bz-kb-dom');
          if (dom) hw.insertBefore(span, dom);
          else hw.appendChild(span);
        }
      }
      const n = idx.counts[path] ?? 0;
      if (n > 0) {
        const tail = row.querySelector<HTMLElement>('.bz-kb-tail');
        if (tail && !tail.querySelector('.bz-kb-refbadge')) {
          const b = document.createElement('span');
          b.className = 'bz-kb-refbadge';
          b.title = refBadgeTitle(n);
          b.textContent = `被引 ${n}`;
          motionStampBadge(b); // 动效层：被引徽标盖章落位
          const btn = tail.querySelector('.bz-kb-mt-openbtn');
          if (btn) tail.insertBefore(b, btn);
          else tail.appendChild(b);
        }
      }
    }
  }

  /**
   * 文献行的「被引 N」徽标（2026-09-16 采纳建议 8）：索引落地后**原地补**，不重建整表
   * （保住滚动位置，与 patchCardBadges 同一手法）。口径与卡片部**同一个数**——
   * 都取 `mountIndex.counts`（正文双链 + related + mounted，去自链），只是各查各的路径。
   * 0 不出徽标（列表更干净，与卡片部一致）。
   */
  private patchLitBadges(): void {
    const idx = this.mountIndex;
    if (!this.contentEl || !idx) return;
    for (const row of Array.from(this.contentEl.querySelectorAll<HTMLElement>('.bz-kb-lexrow[data-kb-act=lit-peek]'))) {
      const path = row.getAttribute('data-path') || '';
      const n = idx.counts[path] ?? 0;
      if (n <= 0) continue;
      const tail = row.querySelector<HTMLElement>('.bz-kb-tail');
      if (!tail || tail.querySelector('.bz-kb-refbadge')) continue;
      const b = document.createElement('span');
      b.className = 'bz-kb-refbadge';
      b.title = refBadgeTitle(n);
      b.textContent = `被引 ${n}`;
      motionStampBadge(b); // 动效层：被引徽标盖章落位
      tail.appendChild(b); // 尾插：日期恒左、徽标凭 margin-left:auto 独占右侧（首插会把日期带到右边，2026-09-24 用户拍板）
    }
  }

  /** 芯片原地同步（索引落地时改这一个节点：计数 / 置灰 / 点亮，不重建整表） */
  private syncCardChip(): void {
    const chip = this.contentEl ? this.contentEl.querySelector<HTMLElement>('[data-kb-act="cards-orphan"]') : null;
    if (!chip) return;
    const idx = this.mountIndex;
    chip.classList.toggle('is-on', this.cardOrphanOnly);
    chip.textContent = `孤 儿${idx ? ` · ${idx.orphans.size}` : ' · 未统计'}`;
    chip.setAttribute('title', idx ? '只列既无入链也无挂载的卡' : '挂载索引未统计（扫描失败）');
    (chip as HTMLButtonElement).disabled = !idx;
  }

  /**
   * 索引落地：孤儿筛选开着时**池会变** → 全量重建；否则只打徽标补丁 + 更新页脚
   * （保住已渲染行与滚动位置——issue 323 的第二处根因）。
   */
  private applyMountIndex(): void {
    this.syncCardChip();
    if (!this.mountIndex) return; // 扫描失败：芯片显「未统计」并置灰，列表照常
    if (this.cardOrphanOnly) this.renderCards();
    else {
      this.patchCardBadges();
      this.updateCardMore(this.cardPool());
    }
  }

  private moreCards(): void {
    if (this.cardsShown >= this.cardPool().length) return;
    this.appendCardRows(80);
  }

  private onContentScroll(): void {
    const sc = this.contentEl;
    if (!sc || this.part !== 'z2') return;
    if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 60) this.moreCards();
  }

  /** 部叁主题扫描（仅展示） */
  private async loadTopics(dir: string): Promise<void> {
    const app = getApp();
    this.loadedTopicDir = dir;
    const prefix = dir + '/';
    const mdFiles = (app.vault.getFiles() || []).filter((f: any) => f.path.startsWith(prefix) && f.extension === 'md');
    const out: TopicEntry[] = mdFiles.map((f: any) => {
      let created = 0;
      try { created = (f as any).stat?.mtime ? new Date((f as any).stat.mtime).valueOf() : 0; } catch { created = 0; }
      return { file: f, path: f.path, title: f.basename, where: dir, created };
    });
    out.sort((a, b) => b.created - a.created || a.path.localeCompare(b.path));
    this.allTopics = out;
  }

  private renderTopics(): void {
    if (!this.contentEl) return;
    const rows = this.allTopics.map((t) => {
      const rel = formatRelativeTime(String(t.created || ''));
      return `<div class="bz-kb-lexrow" data-kb-act="topic-open" data-path="${esc(t.path)}">
      <div class="bz-kb-hw"><span class="bz-kb-w">${esc(t.title)}</span><span class="bz-kb-dom">${esc(t.where)}</span></div>
      <div class="bz-kb-tail"><span class="bz-kb-meta">${rel === '无效日期' ? '' : esc(rel)}</span></div>
    </div>`;
    }).join('');
    this.contentEl.innerHTML = `<div class="bz-kb-pd">
      ${rows || '<div class="bz-kb-empty">主题目录还没有笔记。</div>'}
    </div>`;
    // 动效层：主题行抽卡接力（消费 motionCue 即熄）
    motionLitReveal(this.contentEl, this.motionCue);
    this.motionCue = 'silent';
  }

  /** 读笔记 frontmatter related 展示名列表（预览「关联」区；解析见 parseRelatedNames） */
  private async noteRels(n: PreviewEntry): Promise<string[]> {
    try {
      return parseRelatedNames(await getApp().vault.read(n.file));
    } catch { return []; }
  }

  /** 独立弹层宿主（issue 329 文献预览直达）：主面板不在场时预览弹层的全屏定位底座——
   *  纸墨变量随 .kb 作用域生效，topifyZ 发号；用完由 closeSheet 撤除，不常驻空壳节点 */
  private previewHostEl: HTMLElement | null = null;

  /** 弹层宿主：主窗显示中挂主窗（既有路径零变化）；否则落独立宿主（直达预览不强行展开主面板） */
  private sheetHost(): HTMLElement {
    if (this.popup && this.popup.style.display === 'flex') return this.popup;
    if (!this.previewHostEl || !this.previewHostEl.isConnected) {
      const host = document.createElement('div');
      host.className = 'bz-kb-sheet-host kb';
      document.body.appendChild(host);
      topifyZ(host);
      this.previewHostEl = host;
    }
    return this.previewHostEl;
  }

  /** 弹层（面板内覆盖；返回 ovl 供调用方就地查询——独立宿主场景 this.popup 查不到） */
  private openSheet(html: string): HTMLElement | null {
    this.closeSheet();
    const host = this.sheetHost();
    const ovl = document.createElement('div');
    ovl.className = 'bz-kb-ovl';
    ovl.innerHTML = `<div class="bz-kb-sheet">${html}</div>`;
    ovl.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-kb-act],[data-kb-close]') as HTMLElement | null;
      if (e.target === ovl || (t && t.hasAttribute('data-kb-close'))) { this.closeSheet(); return; }
      if (!t) return;
      const act = t.getAttribute('data-kb-act');
      // 独立宿主（预览直达）时主窗 onShellClick 不在场：挂载树入口在此兜住（主窗场景由 onShellClick 独家处理，防双开）
      if (act === 'mount-tree' && host !== this.popup) {
        const p = t.getAttribute('data-path') || '';
        if (p) void openMountTree(p);
      }
    });
    host.appendChild(ovl);
    return ovl;
  }
  private closeSheet(): void {
    // 动效层：预览纸面折回收起再移除（ovl 是自毁节点，退场随节点销毁；jsdom/无 WAAPI 同步移除零时差）
    const dropHost = (): void => {
      if (this.previewHostEl && !this.previewHostEl.querySelector('.bz-kb-ovl')) {
        this.previewHostEl.remove();
        this.previewHostEl = null;
      }
    };
    let pending = 0;
    for (const host of [this.popup, this.previewHostEl]) {
      host?.querySelectorAll<HTMLElement>('.bz-kb-ovl').forEach((x) => {
        if (x.dataset.bzMotionClosing === '1') { x.remove(); return; } // 退场中被换层：硬删不留残影
        pending++;
        motionSheetOut(x, () => {
          x.remove();
          pending--;
          dropHost();
        });
      });
    }
    if (!pending) dropHost(); // 无弹层在场：独立宿主直接撤空壳
  }
  private sheetWrap(title: string, body: string): string {
    // 空 title = 不出头行（预览弹层不放「××预览」标题，2026-09-24）
    const head = title ? `<div class="bz-kb-sheet-head"><span class="bz-kb-sheet-title">${esc(title)}</span></div>` : '';
    return `${head}<div class="bz-kb-sheet-body">${body}</div>`;
  }

  /** 旧笔记自动补全（note-gen；AI 未配置跳过并提示一句）；每目录至多跑一次 */
  private async runBackfill(): Promise<void> {
    const dir = litDirOf(tryGetSettings() as Partial<BzSettings> | undefined);
    if (this.backfilledDir === dir) return;
    this.backfilledDir = dir;
    try {
      const res = await backfillNotes();
      if (res && res.aiSkipped) {
        notice('AI 未配置：部分旧笔记缺少领域分类，已跳过补全（配置 AI 后重新打开面板可补全）', 'info');
      }
      if (res && res.filled > 0 && this.part === 'z1') await this.refreshCurrent();
    } catch { /* 补全失败静默，不影响列表 */ }
  }

  // ---- 主面板增量刷新（knowledge:file-* 四通道 300ms 防抖） ----

  private scheduleRefreshFlush(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(async () => {
      const deletes = Array.from(this.pendingDeletePaths);
      const modifies = Array.from(this.pendingRefreshPaths);
      this.pendingDeletePaths.clear();
      this.pendingRefreshPaths.clear();
      for (const p of deletes) this.removeCached(p);
      for (const p of modifies) this.invalidateCached(p);
      if (this.popup && this.popup.style.display === 'flex') await this.refreshCurrent();
    }, 300);
  }

  private removeCached(path: string): void {
    this.allNotes = this.allNotes.filter((n) => n.path !== path);
    this.allCards = this.allCards.filter((c) => c.path !== path);
    this.allTopics = this.allTopics.filter((t) => t.path !== path);
  }
  private invalidateCached(_path: string): void {
    // 任一缓存目录标记清零即可迫使 refreshCurrent 重扫（modifies 单条难精确定位到部）
    this.loadedLitDir = '';
    this.loadedCardDir = '';
    this.loadedTopicDir = '';
    // 库内笔记改了 → 引用图可能变 → 挂载索引置脏（下次进卡片部重算一次，切部本身不重算——issue 323）
    this.mountIndexDirty = true;
  }

  private attachFileListener(): void {
    if (this.fileListenerAttached) return;
    const inAnyDir = (path: string) => {
      const s = tryGetSettings() as Partial<BzSettings> | undefined;
      return path.startsWith(litDirOf(s) + '/') || path.startsWith(cardboxDirOf(s) + '/') || path.startsWith(topicDirOf(s) + '/');
    };
    const modifyHandler = (p: string) => { if (inAnyDir(p)) { this.pendingRefreshPaths.add(p); this.scheduleRefreshFlush(); } };
    const deleteHandler = (evt: { path: string }) => { if (inAnyDir(evt.path)) { this.pendingDeletePaths.add(evt.path); this.scheduleRefreshFlush(); } };
    const renameHandler = (evt: { oldPath: string; newPath: string; movedOut: boolean }) => {
      if (inAnyDir(evt.oldPath)) this.pendingDeletePaths.add(evt.oldPath);
      if (!evt.movedOut && inAnyDir(evt.newPath)) this.pendingRefreshPaths.add(evt.newPath);
      this.scheduleRefreshFlush();
    };
    this.fileListenerRefs = [
      onDomainEvent<{ path: string }>('knowledge:file-created', (evt) => modifyHandler(evt.path)),
      onDomainEvent<{ path: string }>('knowledge:file-modified', (evt) => modifyHandler(evt.path)),
      onDomainEvent<{ path: string }>('knowledge:file-deleted', deleteHandler),
      onDomainEvent<{ oldPath: string; newPath: string; movedOut: boolean }>('knowledge:file-renamed', renameHandler),
    ];
    this.fileListenerAttached = true;
  }

  // ==================== 影像 · 处理队列面板（issue 310） ====================

  createVideoUI(): void {
    const mask = document.createElement('div');
    mask.id = 'knowledge-video-mask';
    mask.className = 'bz-overlay-mask bz-kb-mask'; // issue 365 收编单源后此处漏挂 → 遮罩零尺寸不可见、点不着关不掉
    mask.style.display = 'none';
    mask.onclick = () => this.hideVideo();
    const popup = document.createElement('div');
    popup.id = 'knowledge-video-popup';
    popup.className = 'bz-kb-window kb';
    popup.style.display = 'none';
    // 头部与主窗同款词典头（issue 310）：中列题字 + 左列状态计数 + 右列图标组
    // （2026-09-14 复核：计数与按钮左右对调——说明性文字在左，可操作钮在右）。
    // 处理 / 历史是**同一面板内的两个视图**（2026-09-14 复核：历史不再另开弹窗）：
    // 切到历史时题字换「历 史」、图标组只留返回箭头。
    // 图标一律 lucide（emoji 退役，issue 310）：markup 出 `<i data-lucide>` 占位，挂 DOM 后 mountIcons 兑现。
    const header = document.createElement('div');
    header.className = 'bz-kb-head';
    header.innerHTML = `
      <div class="bz-kb-vmeta" id="lit-video-counts"></div>
      <div class="bz-kb-brand">
        <div class="bz-kb-title">影 像</div>
        <div class="bz-kb-top">VIDEO · TO LITERATURE</div>
      </div>
      <div class="bz-lit-head-btns">
        <button id="lit-btn-video-add" title="新增影像">${iconSpan('plus')}</button>
        <button id="lit-btn-video-run" class="bz-lit-run-btn" title="批量处理（桌面端）">${iconSpan('play')}</button>
        <button id="lit-btn-video-history" title="历史">${iconSpan('history')}</button>
        <button id="lit-btn-video-back" title="返回处理队列" style="display:none;">${iconSpan('arrow-left')}</button>
      </div>`;
    const list = document.createElement('div');
    list.id = 'knowledge-video-list';
    list.className = 'bz-kb-list';
    popup.appendChild(header);
    popup.appendChild(list);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    this.videoMask = mask;
    this.videoPopup = popup;
    this.videoList = list;
    mountIcons(popup); // `<i data-lucide>` 占位 → 真 SVG（两端同源，core/ui icons）
    // 运行钮的图标容器（单钮态机 play ↔ square 就地换图标，不走 innerHTML 重排）
    this.runIcon = q<HTMLElement>(popup, '#lit-btn-video-run .bz-ic');
    this._bindVideoHeaderEvents();
    this._syncVideoHead(); // 初始 = 处理视图（首帧即把移动端不支持的批量 / 历史钮藏好）
  }

  private _bindVideoHeaderEvents(): void {
    const p = this.videoPopup;
    if (!p) return;
    q<HTMLButtonElement>(p, '#lit-btn-video-add')!.onclick = () => this.showAddDialog();
    q<HTMLButtonElement>(p, '#lit-btn-video-run')!.onclick = () => {
      if (BatchRunner.running) void this.onAbortBatch();
      else void this.onRunBatch();
    };
    q<HTMLButtonElement>(p, '#lit-btn-video-history')!.onclick = () => this.showHistory();
    q<HTMLButtonElement>(p, '#lit-btn-video-back')!.onclick = () => this.switchVideoView('tasks');
  }

  /**
   * 处理面板头部同步（issue 310 复核）：按当前视图换题字与图标组——
   * 处理视图 = 新增 / 批量 / 历史；历史视图 = 只留返回箭头（退回处理队列）。
   * 移动端无批处理能力：批量与历史钮恒藏（故历史视图在移动端不可达）。
   */
  private _syncVideoHead(): void {
    const p = this.videoPopup;
    if (!p) return;
    const inHistory = this.videoView === 'history';
    const mobile = isMobileEnv();
    const title = q<HTMLElement>(p, '.bz-kb-title');
    const top = q<HTMLElement>(p, '.bz-kb-top');
    if (title) title.textContent = inHistory ? '历 史' : '影 像';
    if (top) top.textContent = inHistory ? 'VIDEO · ARCHIVE' : 'VIDEO · TO LITERATURE';
    const show = (sel: string, v: boolean): void => {
      const el = q<HTMLElement>(p, sel);
      if (el) el.style.display = v ? '' : 'none';
    };
    show('#lit-btn-video-add', !inHistory);
    show('#lit-btn-video-run', !inHistory && !mobile);
    show('#lit-btn-video-history', !inHistory && !mobile);
    show('#lit-btn-video-back', inHistory);
  }

  /**
   * 打开「影像」录入界面（issue 310：主窗入口 / 命令 / 聚合讯直达录入界面，
   * 不再先落到处理队列；处理队列与历史从**保存后**进入——保存即落队列并打开处理面板）。
   * prefill 存在则预填链接（聚合讯「保存至文献」入口，ADR-0068；有链接即自动解析）。
   */
  showVideoEntry(prefill?: { url: string; title?: string | null; uploader?: string | null }): void {
    this.showAddDialog(prefill ? { url: prefill.url, title: prefill.title ?? null, uploader: prefill.uploader ?? null } : undefined);
  }

  /** 打开「影像 · 处理」队列面板（面板默认视图）；打开即自动重抓缺信息任务（ADR-0133） */
  showVideoTasks(): void {
    if (!this.videoPopup || !this.videoMask) return;
    this.videoView = 'tasks';
    this._showVideoWindow();
    void this.backfillVideoTasks();
  }

  /**
   * 切到「历史」视图（2026-09-14 复核）：历史在**同一个面板内**打开，不再另开弹窗——
   * 题字换「历 史」、图标组只留返回箭头、计数换「共 N 条」。
   */
  showHistory(): void {
    if (!this.videoPopup || !this.videoMask) return;
    this.videoView = 'history';
    this._showVideoWindow();
  }

  /** 面板内视图切换（处理 ⇄ 历史） */
  private switchVideoView(view: 'tasks' | 'history'): void {
    this.videoView = view;
    void this.refreshVideoPanel();
  }

  /** 面板显示 + 按当前视图重绘（两个入口共用的收尾） */
  private _showVideoWindow(): void {
    if (!this.videoMask || !this.videoPopup) return;
    const fresh = this.videoPopup.style.display !== 'flex';
    topifyZ(this.videoMask, this.videoPopup);
    this.videoMask.style.display = 'block';
    this.videoPopup.style.display = 'flex';
    // 动效层：壳落纸只在真开（抬层重入不重播）；行接力随 refreshVideoPanel 消费 cue
    this.motionCue = 'part';
    motionVideoIn(this.videoPopup);
    void this.refreshVideoPanel();
  }

  /**
   * 打开面板时的自动重抓（ADR-0133）：对缺标题任务串行补信息（标题/UP/时长，只补缺失），
   * 成功即落库；任务间 300ms 间隔防风控；已尝试过的 id 会话内不再重试，失败静默。
   * ADR-0134：链接里没有 BV 号的 **B 站**任务（b23.tv 短链）一并重抓——顺手把 url 修成规范链接，
   * 否则下载阶段认不出 BV 号（存量任务也据此自愈）。非 B 站链接（YouTube 等）不纳入；
   * 已成功的任务只补信息、不改 url（成败判别口径随 `isTerminal` 的「成功」侧）。
   */
  private async backfillVideoTasks(): Promise<void> {
    if (this.backfillRunning) return;
    this.backfillRunning = true;
    try {
      const tasks = await KnowledgeData.loadTasks();
      const todo = tasks.filter((t) => !t.archived && t.url && !this.backfillTried.has(t.id)
        && (!t.title || (t.status !== 'success' && needsBvidRepair(t.url))));
      if (todo.length) {
        const cookie = String(tryGetSettings()?.bilibiliCookie || '');
        for (const t of todo) {
          this.backfillTried.add(t.id);
          try {
            const res = await resolveVideo(t.url, cookie, Math.max(0, (t.page || 1) - 1));
            if (res) await this._persistResolved(t, res);
          } catch { /* 单条失败静默，继续后续 */ }
          await new Promise((r) => setTimeout(r, 300));
        }
        await this.refreshVideoPanel();
      }
    } catch { /* 面板流程不因重抓失败中断 */ }
    finally { this.backfillRunning = false; }
  }

  hideVideo(): void {
    if (this.videoPopup && motionClosing(this.videoPopup)) return; // 动效层：退场中忽略重复关闭
    const popup = this.videoPopup;
    const mask = this.videoMask;
    motionVideoOut(popup, () => {
      if (mask) mask.style.display = 'none';
      if (popup) popup.style.display = 'none';
    });
  }

  async refreshVideoPanel(): Promise<void> {
    const tasks = await KnowledgeData.loadTasks();
    if (!this.videoList) return;
    const cue = this.motionCue; // 动效层：异步读库前捕 cue，读完按此编排并复位（批量事件刷新走 silent）
    this.motionCue = 'silent';
    this._syncVideoHead();
    this.videoList.innerHTML = '';
    if (this.videoView === 'history') { this.renderHistory(tasks); motionVideoRows(this.videoList, cue); return; }
    const active = tasks.filter((t) => !t.archived);
    const running = BatchRunner.running;
    if (running) {
      const idx = active.findIndex((t) => t.status === 'processing');
      const banner = document.createElement('div');
      banner.className = 'bz-kb-banner';
      banner.innerHTML = `${iconSpan('loader')} ${idx >= 0 ? `正在处理 第 ${idx + 1}/${active.length} 部…` : '正在准备处理…'}`;
      mountIcons(banner);
      this.videoList.appendChild(banner);
    }
    this._syncStatusCounts(active);
    if (active.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bz-kb-empty';
      empty.textContent = '暂无转文献任务。点右上角加号添加视频链接与起止时间，回到桌面端即可批量处理。';
      this.videoList.appendChild(empty);
      motionVideoRows(this.videoList, cue); // 动效层：空态轻揭出
      this._syncRunButton(active);
      return;
    }
    for (const t of active) this.videoList.appendChild(this.renderRow(t));
    motionVideoRows(this.videoList, cue); // 动效层：任务卡显影接力（silent 直通，批量途中不闪）
    this._syncRunButton(active);
  }

  private _syncStatusCounts(tasks: KnowledgeTask[]): void {
    const el = this.videoPopup ? q<HTMLElement>(this.videoPopup, '#lit-video-counts') : null;
    if (!el) return;
    const count = (s: KnowledgeTask['status']) => tasks.filter((t) => t.status === s).length;
    const parts: string[] = [];
    if (count('pending')) parts.push(`${count('pending')} 待处理`);
    if (count('processing')) parts.push(`${count('processing')} 处理中`);
    if (count('failed')) parts.push(`${count('failed')} 失败`);
    el.textContent = parts.join(' · ');
  }

  /** 单钮态机：空闲 play / 运行中 square（终止靠 title hover 区分），移动端整钮隐藏 */
  private _syncRunButton(tasks: KnowledgeTask[]): void {
    if (!this.videoPopup) return;
    const run = q<HTMLButtonElement>(this.videoPopup, '#lit-btn-video-run');
    if (!run) return;
    const running = BatchRunner.running;
    const hasWork = tasks.some((t) => t.status === 'pending' || t.status === 'failed');
    if (running) {
      run.disabled = false;
      const retry = this.batchAbortLabel === '终止整批';
      if (this.runIcon) setIcon(this.runIcon, 'square');
      run.title = retry ? '中止整批（处理失败任务中）' : '中止批量处理';
    } else {
      run.disabled = !hasWork;
      if (this.runIcon) setIcon(this.runIcon, 'play');
      run.title = '批量处理（桌面端）';
    }
  }

  private renderRow(task: KnowledgeTask): HTMLElement {
    const card = document.createElement('div');
    card.className = 'bz-kb-taskcard';
    card.dataset.id = task.id;
    const meta = STATUS_META[task.status] ?? STATUS_META.pending;
    const pageTag = task.page && task.page > 1 ? `P${task.page} · ` : '';
    const timeText = task.start && task.end ? `${pageTag}${task.start} ~ ${task.end}` : `${pageTag}整片`;
    const durText = task.duration ? ` · ${secToTimeText(task.duration)}` : '';
    const linkLine = task.title
      ? `<a class="bz-kb-tlink" href="${esc(task.url)}" title="${esc(task.url)}">${esc(task.title)}</a>`
      : `<span class="bz-kb-turl" title="${esc(task.url)}">${esc(shortUrlText(task.url))}</span>`;
    const upText = task.uploader ? ` · UP主 ${esc(task.uploader)}` : '';
    card.innerHTML = `
      <div class="bz-kb-trow">
        <span class="bz-kb-status ${meta.cls}">${meta.label}</span>
        ${linkLine}
      </div>
      <div class="bz-kb-tmeta">${timeText}${durText}${upText}${task.remark ? ' · ' + esc(task.remark) : ''}</div>
      ${task.status === 'processing' ? (this.runState.has(task.id) ? '<div class="bz-kb-progress-box"></div>' : (task.reason ? `<div class="bz-kb-progress">${esc(task.reason)}</div>` : '')) : ''}
      ${task.status === 'failed' && task.reason ? `<div class="bz-kb-progress bz-kb-progress-error" title="${esc(task.reason)}">${esc(humanizeError(task.reason))}</div>` : ''}
      ${task.status === 'success' && task.notePath ? `<div class="bz-kb-notepath">${iconSpan('file-text')} ${esc(task.notePath)}</div>` : ''}`;
    mountIcons(card);
    const actions = this.buildCardActions(task);
    if (actions.length) attachItemActions(card, actions);
    const titleLink = q<HTMLAnchorElement>(card, '.bz-kb-tlink');
    if (titleLink) titleLink.onclick = (e) => { e.stopPropagation(); this._openExternal(titleLink.href || task.url); };
    card.addEventListener('click', () => {
      if (task.status === 'success' && task.notePath) this.openNote(task.notePath);
      else if (task.status === 'pending' || task.status === 'failed') this.showAddDialog(task);
    });
    return card;
  }

  private buildCardActions(task: KnowledgeTask): ItemAction[] {
    const actions: ItemAction[] = [];
    if (task.status === 'success') {
      if (task.notePath) actions.push({ icon: 'book-open', label: '打开文献笔记', onClick: () => this.openNote(task.notePath!) });
      if (task.videoPath) actions.push({ icon: 'copy', label: '复制视频路径', onClick: () => void this.copyText(task.videoPath!) });
      actions.push({ icon: 'pencil', label: '编辑', onClick: () => this.showAddDialog(task) });
    } else if (task.status === 'failed' || task.status === 'pending') {
      actions.push({ icon: 'pencil', label: '编辑', onClick: () => this.showAddDialog(task) });
    }
    actions.push({ icon: 'trash-2', label: '删除', kind: 'danger', onClick: () => void this.confirmDelete(task) });
    return actions;
  }

  /** 行内进度定点更新（不等 storage 落库，一到立即刷 DOM） */
  private updateRowProgress(id: string): void {
    if (!this.videoList) return;
    const st = this.runState.get(id);
    const card = q<HTMLElement>(this.videoList, `.bz-kb-taskcard[data-id="${id}"]`);
    if (!card || !st) return;
    let box = q<HTMLElement>(card, '.bz-kb-progress-box');
    if (!box) {
      box = document.createElement('div');
      box.className = 'bz-kb-progress-box';
      const meta = q<HTMLElement>(card, '.bz-kb-tmeta');
      if (meta) meta.after(box);
      else card.appendChild(box);
    }
    if (tryGetSettings().knowledgeProgressDetail === false) {
      const cur = st.steps[st.steps.length - 1] || '处理中…';
      box.innerHTML = `<div class="bz-kb-progress">${esc(cur)}</div>`;
      return;
    }
    const segs = st.steps.map((s, i) =>
      i === st.steps.length - 1
        ? `<span class="bz-kb-step-cur">${esc(s)}</span>`
        : `<span class="bz-kb-step-done">✓ ${esc(stepDoneLabel(s))}</span>`
    );
    const pct = st.phase === 'download' ? st.pct : null;
    const bar = pct != null
      ? `<div class="bz-kb-progress-track"><div class="bz-kb-progress-fill" style="width:${Math.min(100, Math.max(0, pct))}%"></div></div>`
      : '';
    box.innerHTML = `
      <div class="bz-kb-steps">${segs.join('<span class="bz-kb-step-arrow">→</span>')}${pct != null ? ` <span class="bz-kb-step-pct">${Math.round(pct)}%</span>` : ''}</div>
      ${bar}
      <div class="bz-kb-elapsed">${iconSpan('timer')} ${fmtElapsed(Date.now() - st.startAt)}</div>`;
    mountIcons(box);
  }

  private startRunTimer(): void {
    this.clearRunTimer();
    this.runTimer = setInterval(() => {
      for (const id of Array.from(this.runState.keys())) this.updateRowProgress(id);
    }, 1000);
  }

  private clearRunTimer(): void {
    if (this.runTimer !== null) { clearInterval(this.runTimer); this.runTimer = null; }
  }

  private async onRunBatch(): Promise<void> {
    if (!BatchRunner.available()) {
      notice('仅桌面端可用：批量处理需要 Node.js 外部进程', 'error');
      return;
    }
    if (BatchRunner.running) return;
    const tasks = await KnowledgeData.loadTasks();
    const work = tasks.filter((t) => !t.archived && (t.status === 'pending' || t.status === 'failed'));
    if (work.length === 0) { notice('没有待处理或失败的任务', 'info'); return; }
    this.batchAbortLabel = work.every((t) => t.status === 'failed') ? '终止整批' : '终止';
    const ui = this;
    ui.startRunTimer();
    const events: BatchEvents = {
      onTaskProgress: (t, stepText, progress) => {
        let st = ui.runState.get(t.id);
        if (!st) { st = { steps: [], phase: null, pct: null, startAt: Date.now() }; ui.runState.set(t.id, st); }
        if (stepText && stepText !== '启动中…' && !st.steps.includes(stepText)) st.steps.push(stepText);
        if (progress) {
          if (progress.phase) st.phase = progress.phase;
          if (progress.pct != null) st.pct = progress.pct;
        }
        ui.updateRowProgress(t.id);
      },
      onTaskInfo: () => { void ui.refreshVideoPanel(); },
      onTaskDone: () => { void ui.refreshVideoPanel(); },
      onBatchDone: (summary) => {
        ui.clearRunTimer();
        ui.runState.clear();
        const head = `处理完成：成功 ${summary.success} 部`;
        const tail = summary.failed ? `，失败 ${summary.failed} 部` : '';
        const end = summary.aborted ? '（已中止）' : summary.stopped ? '（遇错即停）' : '';
        notice(head + tail + end, summary.failed || summary.aborted || summary.stopped ? 'warning' : 'success');
        void ui.refreshVideoPanel();
      },
    };
    const runP = BatchRunner.runAll(work, events);
    void this.refreshVideoPanel();
    try {
      await runP;
    } finally {
      this.batchAbortLabel = null;
    }
  }

  private async onAbortBatch(): Promise<void> {
    if (!BatchRunner.running) return;
    const v = await openFlowDialog({
      title: '中止批量处理？',
      message: '当前正在处理的视频将停止，已成功的保留在列表；未开始的项保持待处理，可稍后继续。',
      // issue 291：流程框挂 document.body，脱离面板根后纸墨 token 与域弹窗类全部失效。
      // 必须显式带两个类——'kb' = 纸墨变量作用域（本域 styles.css :7-33，亮暗两档），
      // 'bz-kb-flow-dialog' = 域弹窗类（供 id 选择器把共享壳改写成本域材质），
      // 否则本框与同域的「添加文献」「术语录入」弹窗不同皮（缺 'kb' 连底色都失效，同 issue 257 事故）。
      className: 'kb bz-kb-flow-dialog',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '中止', value: 'ok', danger: true },
      ],
    });
    if (v !== 'ok') return;
    BatchRunner.abort();
    await this.refreshVideoPanel();
  }

  private async confirmDelete(task: KnowledgeTask): Promise<void> {
    const v = await openFlowDialog({
      title: '删除转文献任务',
      message: '仅从列表移除记录，已生成的文献笔记与视频不受影响。',
      // issue 291：同上——弹窗挂 body 必须自带 'kb'（token 作用域）+ 'bz-kb-flow-dialog'（域皮）
      className: 'kb bz-kb-flow-dialog',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '删除', value: 'ok', danger: true },
      ],
    });
    if (v !== 'ok') return;
    await KnowledgeData.deleteTask(task.id);
    await this.refreshVideoPanel();
  }

  private async confirmClearHistory(): Promise<void> {
    const v = await openFlowDialog({
      title: '清空历史',
      message: '将移除全部「成功」归档记录；文献笔记与视频文件保留在原处。',
      // issue 291：同上——挂 body 的流程框须显式带皮肤类才与「处理面板」同皮
      className: 'kb bz-kb-flow-dialog',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '清空', value: 'ok', danger: true },
      ],
    });
    if (v !== 'ok') return;
    await KnowledgeData.clearHistory();
    await this.refreshVideoPanel();
  }

  // ==================== 影像 · 录入界面（词典皮 + 解析后展开，issue 310） ====================

  createAddDialog(): void {
    const addMask = document.createElement('div');
    addMask.id = 'knowledge-add-mask';
    addMask.className = 'bz-overlay-mask bz-kb-mask'; // issue 365 收编单源后此处漏挂 → 遮罩零尺寸不可见、点不着关不掉
    addMask.style.display = 'none';
    addMask.onclick = () => this.requestAddClose(); // issue 326：有草稿先确认
    const popup = document.createElement('div');
    popup.id = 'knowledge-add-popup';
    popup.className = 'bz-lit-dialog kb'; // kb：纸墨皮变量作用域（缺此背景 var(--panel) 失效成透明，issue 257）
    popup.style.display = 'none';
    // 词典皮（issue 310：与名词/段落录入同壳）：标题栏 → 链接行 + 解析 →
    // 「解析完成后」才展开的下半个表单（只读信息 / 分P / 剪辑 / 清晰度 / 保存）。
    // ADR-0133 的解析式录入契约不变（单框 + 解析按钮 → 只读信息 → 双把手范围 + 时间框 → 清晰度）。
    popup.innerHTML = `
      <div class="bz-lit-sheet-head">
        <span class="bz-lit-sheet-title">影 像</span>
        <span id="lit-add-mode" class="bz-lit-mode-tag" style="display:none;">编辑任务</span>
      </div>
      <div id="lit-add-fail" class="bz-lit-form-alert" style="display:none;"></div>
      <div class="bz-lit-term-row">
        <span class="bz-lit-term-meta-k">链接</span>
        <input id="lit-add-url" type="text" autocomplete="off">
        <button id="lit-add-resolve" type="button">解析</button>
      </div>
      <div id="lit-add-rstate" class="bz-lit-rstate" style="display:none;"></div>
      <div id="lit-add-more" style="display:none;">
        <div class="bz-lit-term-row">
          <span class="bz-lit-term-meta-k">标题</span>
          <span id="lit-add-ititle" class="bz-lit-term-meta-v"></span>
        </div>
        <div class="bz-lit-term-row">
          <span class="bz-lit-term-meta-k">UP 主</span>
          <span id="lit-add-iuploader" class="bz-lit-term-meta-v"></span>
        </div>
        <div class="bz-lit-term-row" id="lit-add-page-row" style="display:none;">
          <span class="bz-lit-term-meta-k">分P</span>
          <select id="lit-add-page"></select>
        </div>
        <div class="bz-lit-term-row" id="lit-add-pagenum-row" style="display:none;">
          <span class="bz-lit-term-meta-k">分P</span>
          <input id="lit-add-page-num" type="number" min="1" step="1">
        </div>
        <div class="bz-lit-term-row">
          <span class="bz-lit-term-meta-k">剪辑</span>
          <input id="lit-add-start" type="text" autocomplete="off">
          <span class="bz-lit-range-dash">~</span>
          <input id="lit-add-end" type="text" autocomplete="off">
          <button id="lit-add-whole" type="button">整片</button>
        </div>
        <div id="lit-add-rb"></div>
        <div class="bz-lit-term-row">
          <span class="bz-lit-term-meta-k">清晰度</span>
          <select id="lit-add-quality"></select>
        </div>
        <div id="lit-add-rhint" class="bz-lit-rhint" style="display:none;"></div>
        <div class="bz-lit-term-actions">
          <button id="lit-add-save" class="bz-lit-accent-btn">保存</button>
        </div>
      </div>`;
    document.body.appendChild(addMask);
    document.body.appendChild(popup);
    this.addMask = addMask;
    this.addPopup = popup;
    q<HTMLButtonElement>(popup, '#lit-add-save')!.onclick = () => void this._handleAddSave();
    q<HTMLButtonElement>(popup, '#lit-add-resolve')!.onclick = () => void this._handleResolve();
    q<HTMLButtonElement>(popup, '#lit-add-whole')!.onclick = () => { this.addDirty = true; this._resetAddRange(); };
    // 档位下拉（issue 326）：选项在 _renderAdd 里重建但元素常驻，change 只由用户切换触发——打脏标
    q<HTMLSelectElement>(popup, '#lit-add-quality')?.addEventListener('change', () => { this.addDirty = true; });
    // 链接框：输入即作废已解析信息并放弃在途解析（需重新点「解析」，ADR-0133）；回车 = 解析
    const addUrlInput = q<HTMLInputElement>(popup, '#lit-add-url');
    if (addUrlInput) {
      addUrlInput.addEventListener('input', () => {
        this.addDirty = true; // 用户动过链接（issue 326 关闭确认）
        this.addUrlSeq++; // 在途解析过期（回填前序列号校验丢弃）
        this.addResolving = false; // 改输入 = 放弃在途解析：按钮恢复可用
        this._setResolveState(null);
        this.addRevealed = false; // 链接变了 → 下半表单收起，须重新解析（issue 310）
        if (this.addMeta || this.addDuration > 0) {
          this.addMeta = null;
          this.addQualities = null;
          this.addDuration = 0;
          this.addStart = 0;
          this.addEnd = 0;
          this.addPage = 1; // 分 P 同作废（防把上一条视频选过的 P 落到新链接，review 306）
        }
        this._renderAdd();
      });
      addUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (this.addResolving) return; // 解析中不重复起请求（按钮同款约束）
          void this._handleResolve();
        }
      });
    }
    // 分P 下拉：切 P → 量程更新 + 范围重置 + 档位重查（ADR-0133）
    q<HTMLSelectElement>(popup, '#lit-add-page')?.addEventListener('change', (e) => {
      this.addDirty = true; // 用户切了分P（issue 326 关闭确认）
      void this._switchAddPage(Number((e.target as HTMLSelectElement).value) || 1);
    });
    // 时间框：blur/回车提交秒值（钳制 + 同步进度条）；↑/↓ = ±1 秒（Shift ±10）；回车提交后保存
    for (const [sel, which] of [['#lit-add-start', 'start'], ['#lit-add-end', 'end']] as const) {
      const input = q<HTMLInputElement>(popup, sel);
      if (!input) continue;
      input.addEventListener('change', () => { this.addDirty = true; this._commitTimeInput(which); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          this.addDirty = true; // 键调时间也是用户改动（issue 326 关闭确认）
          this._nudgeTime(which, e.key === 'ArrowUp' ? 1 : -1, e.shiftKey ? 10 : 1);
        } else if (e.key === 'Enter') { e.preventDefault(); this._commitTimeInput(which, true); void this._handleAddSave(); }
      });
    }
    const numInput = q<HTMLInputElement>(popup, '#lit-add-page-num');
    if (numInput) {
      // 输入即同步状态：_renderAdd 的回写不吞用户手填（review 306）
      numInput.addEventListener('input', () => {
        this.addDirty = true; // 用户填了分P（issue 326 关闭确认）
        const n = Number(numInput.value.trim());
        this.addPage = Number.isInteger(n) && n > 0 ? n : 1;
      });
      numInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); void this._handleAddSave(); }
      });
    }
    this._renderAdd();
  }

  showAddDialog(editItem?: Partial<KnowledgeTask>): void {
    if (!this.addPopup || !this.addMask) return;
    // 影像处理面板垫底（2026-09-24 用户拍板）：不开出口图标，录入弹窗打开时直接把面板
    // 开在下面（只展示，不触发 backfill 自动重抓）；录入窗随后 topify 压上，面板四边留可见余量
    if (!this.videoPopup || this.videoPopup.style.display !== 'flex') {
      this.videoView = 'tasks';
      this._showVideoWindow();
    }
    this.addUrlReset(); // 开弹窗使在途解析过期（ADR-0133）
    this.addDirty = false; // 开窗即干净基线（issue 326：脏标只在用户事件点打）
    this.editingId = editItem?.id ?? null;
    // 编辑既有任务：数据本来就有 → 直接展开下半表单（不逼用户为了看一眼再去点解析，issue 310）
    this.addRevealed = !!this.editingId;
    const modeTag = q<HTMLElement>(this.addPopup, '#lit-add-mode');
    if (modeTag) modeTag.style.display = this.editingId ? 'inline-block' : 'none';
    (q<HTMLInputElement>(this.addPopup, '#lit-add-url')!).value = editItem?.url ?? '';
    // 解析态回显（ADR-0133）：编辑态先铺任务已有信息（解析失败不丢），再自动重抓刷新
    this.addMeta = editItem && (editItem.title || editItem.uploader)
      ? { title: editItem.title || undefined, uploader: editItem.uploader || undefined }
      : null;
    this.addQualities = null;
    this.addResolving = false;
    this.addPage = editItem?.page && editItem.page > 0 ? editItem.page : 1;
    this.addDuration = editItem?.duration && editItem.duration > 0 ? editItem.duration : 0;
    this.addStart = timeTextToSec(editItem?.start ?? '') ?? 0;
    this.addEnd = timeTextToSec(editItem?.end ?? '') ?? this.addDuration;
    this._setResolveState(null);
    this._renderAdd(this.editingId !== null);
    // 编辑回填补刀：start=0 且无时长时 _paintRange 不碰框（防吞手填），这里按任务已有数据显式落框
    if (editItem?.start && this.addDuration <= 0) {
      const sEl = q<HTMLInputElement>(this.addPopup, '#lit-add-start');
      if (sEl) sEl.value = secToTimeText(this.addStart);
    }
    if (editItem?.quality) {
      const qSel = q<HTMLSelectElement>(this.addPopup, '#lit-add-quality');
      if (qSel) qSel.value = editItem.quality;
    }
    const fail = q<HTMLElement>(this.addPopup, '#lit-add-fail');
    if (fail) {
      const reason = editItem?.status === 'failed' ? (editItem.reason || '') : '';
      fail.style.display = reason ? 'block' : 'none';
      fail.textContent = reason ? `上次处理失败：${humanizeError(reason)}` : '';
      fail.title = reason;
    }
    topifyZ(this.addMask, this.addPopup);
    this.addMask.style.display = 'block';
    this.addPopup.style.display = 'flex';
    motionAddIn(this.addPopup); // 动效层：落纸入场
    const urlInput = q<HTMLInputElement>(this.addPopup, '#lit-add-url');
    if (urlInput) setTimeout(() => urlInput.focus(), 100);
    // 打开即自动重抓（ADR-0133：无需用户操作；失败静默保留已有值）
    if ((editItem?.url ?? '').trim()) void this._handleResolve({ auto: true });
  }

  /** 弹窗全量重绘（ADR-0133 状态单源）：信息区 / 分P 控件 / 范围条 / 档位下拉 / 按钮态 */
  private _renderAdd(preserveQuality = false): void {
    const popup = this.addPopup;
    if (!popup) return;
    const prevQuality = preserveQuality ? q<HTMLSelectElement>(popup, '#lit-add-quality')?.value ?? null : null;
    const meta = this.addMeta;
    const pages = meta?.pages || [];
    const multi = pages.length > 1;
    // 下半表单总闸（issue 310）：未解析 = 只有链接行可见（保存随之不可达 → 先解析是唯一路径）
    const more = q<HTMLElement>(popup, '#lit-add-more');
    if (more) {
      const wasHidden = more.style.display === 'none';
      more.style.display = this.addRevealed ? 'block' : 'none';
      // 动效层：解析跑完 = 词典条目展开释义（只在「从未展开 → 展开」的瞬间播）
      if (wasHidden && this.addRevealed) motionAddReveal(more);
    }
    // 信息区（标题 / UP 主只读；缺项显示占位）
    const tEl = q<HTMLElement>(popup, '#lit-add-ititle');
    if (tEl) { tEl.textContent = meta?.title || '（未取到标题）'; tEl.title = meta?.title || ''; }
    const uEl = q<HTMLElement>(popup, '#lit-add-iuploader');
    if (uEl) { uEl.textContent = meta?.uploader || '（未取到）'; uEl.title = meta?.uploader || ''; }
    // 分P：多 P 下拉；单 P 隐藏（拍板）；无 pages 信息 → 数字框（失败态口径，可手填）
    const pageRow = q<HTMLElement>(popup, '#lit-add-page-row');
    const numRow = q<HTMLElement>(popup, '#lit-add-pagenum-row');
    if (pageRow) pageRow.style.display = multi ? '' : 'none';
    if (numRow) numRow.style.display = pages.length ? 'none' : '';
    const sel = q<HTMLSelectElement>(popup, '#lit-add-page');
    if (multi && sel) {
      sel.innerHTML = pages.map((p) => `<option value="${p.page}">${esc(this._pageLabel(p))}</option>`).join('');
      sel.value = String(this.addPage);
    }
    const num = q<HTMLInputElement>(popup, '#lit-add-page-num');
    if (num && !pages.length) num.value = this.addPage > 1 ? String(this.addPage) : '';
    this._rebuildBar();
    this._paintRange();
    this._renderQualitySelect(prevQuality);
    const rBtn = q<HTMLButtonElement>(popup, '#lit-add-resolve');
    if (rBtn) { rBtn.disabled = this.addResolving; rBtn.textContent = this.addResolving ? '解析中…' : '解析'; }
    const sBtn = q<HTMLButtonElement>(popup, '#lit-add-save');
    if (sBtn) sBtn.disabled = this.addResolving;
  }

  /** 分P 下拉项文案：P{n} · {标题} · {时长}（时长未知省略） */
  private _pageLabel(p: { page: number; part: string; duration: number }): string {
    const parts = [`P${p.page}`];
    if (p.part) parts.push(p.part);
    if (p.duration > 0) parts.push(secToTimeText(p.duration));
    return parts.join(' · ');
  }

  /** 档位标签：4K / 2K / {h}P（口径随 CLI qualityLabel，不带帧率） */
  private _heightLabel(h: number): string {
    return h >= 2160 ? '4K' : h >= 1440 ? '2K' : `${h}P`;
  }

  /**
   * 清晰度下拉重绘（ADR-0133）：有实测档位 → [最高, 实测各档]，默认选中全局设置对应的具体档
   * （不可用回落最高可用 + 提示）；无实测档位 → 固定 [最高, 1080P, 720P]，默认全局档。
   * prevValue 仍在新列表内时优先保留（编辑态回显 / 切 P 重查）。
   */
  private _renderQualitySelect(prevValue: string | null): void {
    const popup = this.addPopup;
    if (!popup) return;
    const sel = q<HTMLSelectElement>(popup, '#lit-add-quality');
    if (!sel) return;
    const hint = q<HTMLElement>(popup, '#lit-add-rhint');
    const globalQ = String(tryGetSettings()?.knowledgeQuality || 'highest');
    const heights = this.addQualities;
    const opts: Array<{ value: string; label: string }> = [];
    let def = 'highest';
    let hintText = '';
    if (heights && heights.length) {
      opts.push({ value: 'highest', label: '最高' });
      for (const h of heights) opts.push({ value: String(h), label: this._heightLabel(h) });
      const gv = /^\d+$/.test(globalQ) ? Number(globalQ) : 0;
      if (gv) {
        if (heights.includes(gv)) def = String(gv);
        else { def = String(heights[0]); hintText = `全局 ${gv}P 在该视频不可用，已选最高可用 ${heights[0]}P`; }
      }
    } else {
      opts.push({ value: 'highest', label: '最高' }, { value: '1080', label: '1080P' }, { value: '720', label: '720P' });
      if (/^\d+$/.test(globalQ) && (globalQ === '1080' || globalQ === '720')) def = globalQ;
    }
    const keep = prevValue && opts.some((o) => o.value === prevValue) ? prevValue : null;
    sel.innerHTML = opts.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
    sel.value = keep || def;
    if (hint) { hint.style.display = hintText ? '' : 'none'; hint.textContent = hintText; }
  }

  /** 范围条重建（量程 < 2 秒 = 无进度条：失败态/未知时长只出时间框）；实例在宿主上时只 set 复用（重绘不摘把手） */
  private _rebuildBar(): void {
    const popup = this.addPopup;
    if (!popup) return;
    const host = q<HTMLElement>(popup, '#lit-add-rb');
    if (!host) return;
    if (this.addDuration < 2) {
      host.innerHTML = '';
      host.style.display = 'none';
      this.addBar = null;
      return;
    }
    host.style.display = '';
    if (this.addBar && this.addBar.el.parentElement === host) {
      this.addBar.set(this.addDuration, this.addStart, this.addEnd);
      return;
    }
    host.innerHTML = '';
    const bar = new RangeBar({
      onChange: (s, e) => { this.addDirty = true; this.addStart = s; this.addEnd = e; this._paintRange(); },
    });
    bar.set(this.addDuration, this.addStart, this.addEnd);
    host.appendChild(bar.el);
    this.addBar = bar;
  }

  /** 范围值 → 进度条 + 时间框（`only` = 只重写该框、不碰另一个——防覆盖用户正在输入的框；null = 两个都写） */
  private _paintRange(only: 'start' | 'end' | null = null): void {
    const popup = this.addPopup;
    if (!popup) return;
    if (this.addBar && this.addDuration >= 2) this.addBar.set(this.addDuration, this.addStart, this.addEnd);
    const sEl = q<HTMLInputElement>(popup, '#lit-add-start');
    const eEl = q<HTMLInputElement>(popup, '#lit-add-end');
    if (sEl && only !== 'end') {
      // 全量重画（only=null）按状态写，零值显式写空（secToTimeText(0)='0:00'，不能直写）——
      // 重置/开窗/整片/失败态靠它清场，防上一轮手填残留被当真值落库；
      // 单框提交/微调（only='start'）且 start=0 且无时长时不碰：框空（没填）与手填 0:00 数值同形，写空会吞手填
      const showStart = this.addStart > 0 || this.addDuration > 0;
      if (only === null) sEl.value = showStart ? secToTimeText(this.addStart) : '';
      else if (showStart) sEl.value = secToTimeText(this.addStart);
    }
    if (eEl && only !== 'start') eEl.value = this.addEnd > 0 ? secToTimeText(this.addEnd) : '';
  }

  /** 「整片」一键重置（ADR-0133）：有量程 → 全选；无时长 → 清空时间框 */
  private _resetAddRange(): void {
    this.addStart = 0;
    this.addEnd = this.addDuration > 0 ? this.addDuration : 0;
    this._paintRange();
  }

  /** 时间框提交（blur/回车）：宽松解析 → 钳制到量程 → 回写状态与把手；非法值时回填旧值 */
  private _commitTimeInput(which: 'start' | 'end', silent = false): void {
    const popup = this.addPopup;
    if (!popup) return;
    const input = q<HTMLInputElement>(popup, which === 'start' ? '#lit-add-start' : '#lit-add-end');
    if (!input) return;
    const raw = input.value.trim();
    const sec = timeTextToSec(raw);
    if (sec === null) {
      if (raw && !silent) notice('时间格式看不懂：支持 12.2 / 12-2 / 1:30:05 等，单个数字按分钟算', 'error');
      input.value = this.addDuration > 0 ? secToTimeText(which === 'start' ? this.addStart : this.addEnd) : '';
      return;
    }
    if (which === 'start') this.addStart = Math.max(0, Math.min(sec, this.addDuration > 0 ? this.addEnd - 1 : Number.MAX_SAFE_INTEGER));
    else this.addEnd = Math.min(this.addDuration > 0 ? this.addDuration : Number.MAX_SAFE_INTEGER, Math.max(sec, this.addDuration > 0 ? this.addStart + 1 : 0));
    this._paintRange(which);
  }

  /** 时间框 ↑/↓ 微调（ADR-0133：一次 1 秒，Shift ±10） */
  private _nudgeTime(which: 'start' | 'end', dir: 1 | -1, step: number): void {
    if (which === 'start') this.addStart = Math.max(0, Math.min(this.addStart + dir * step, this.addDuration > 0 ? this.addEnd - 1 : Number.MAX_SAFE_INTEGER));
    else this.addEnd = Math.min(this.addDuration > 0 ? this.addDuration : Number.MAX_SAFE_INTEGER, Math.max(this.addEnd + dir * step, this.addDuration > 0 ? this.addStart + 1 : 0));
    this._paintRange(which);
  }

  /** 解析态提示行（解析中/失败原因；null = 隐藏） */
  private _setResolveState(text: string | null, kind: 'busy' | 'error' = 'error'): void {
    const el = this.addPopup ? q<HTMLElement>(this.addPopup, '#lit-add-rstate') : null;
    if (!el) return;
    el.style.display = text ? '' : 'none';
    el.textContent = text || '';
    el.classList.toggle('is-error', !!text && kind === 'error');
  }

  /** 分P 切换（ADR-0133）：量程与范围重置为全选，档位按该 P 的 cid 静默重查（未登录/失败 → 清档回落固定列表） */
  private async _switchAddPage(p: number): Promise<void> {
    const popup = this.addPopup;
    if (!popup) return;
    this.addPage = p;
    const pages = this.addMeta?.pages || [];
    const sel = pages.find((x) => x.page === p) || pages[0];
    const dur = sel?.duration || this.addMeta?.duration || 0;
    this.addDuration = dur;
    this.addStart = 0;
    this.addEnd = dur;
    this._rebuildBar();
    this._paintRange();
    const cookie = String(tryGetSettings()?.bilibiliCookie || '');
    // 短链（b23.tv）链接里没有 BV 号：用解析出的 meta.bvid（ADR-0134）
    const bvid = this.addMeta?.bvid || parseBvid(q<HTMLInputElement>(popup, '#lit-add-url')?.value || '');
    if (!cookie || !bvid || !sel?.cid) return;
    const cur = q<HTMLSelectElement>(popup, '#lit-add-quality')?.value ?? null;
    const seq = this.addUrlSeq; // 过期判据含序列号：切 P 后改输入（addPage 被重置为 1）也会作废本次查询
    const qualities = await fetchCheckedQualities(bvid, sel.cid, cookie);
    if (this.addPopup !== popup || this.addPage !== p || this.addUrlSeq !== seq) return;
    // 拿不到（含登录态失效）→ 清档回落固定列表，不留上一 P 的档位当真
    this.addQualities = qualities;
    this._renderQualitySelect(cur);
  }

  /**
   * 「解析」按钮 / 打开弹窗自动重抓（ADR-0133）：净化写回 → resolveVideo（meta + 实测档位）→ 渲染。
   * 手动解析：按钮 loading + 保存禁用；自动重抓：全程静默、不阻塞保存（失败保留已有值）。
   * 手动解析失败进失败态（可手填分 P 与时间范围）；编辑态自动重抓成功 → 即落库（只补缺失字段）。
   */
  private async _handleResolve(opts?: { auto?: boolean }): Promise<void> {
    const popup = this.addPopup;
    if (!popup) return;
    const urlInput = q<HTMLInputElement>(popup, '#lit-add-url');
    if (!urlInput) return;
    const cleaned = normalizeSourceUrl(urlInput.value.trim());
    if (!cleaned) {
      if (!opts?.auto) { notice('请填写视频链接或 BV 号', 'error'); urlInput.focus(); }
      return;
    }
    if (cleaned !== urlInput.value) urlInput.value = cleaned; // 净化写回（用户可见）
    const seq = ++this.addUrlSeq;
    const manual = !opts?.auto;
    if (manual) {
      this.addResolving = true;
      this._setResolveState('解析中…', 'busy');
      this._renderAdd(true);
    }
    const cookie = String(tryGetSettings()?.bilibiliCookie || '');
    const res = await resolveVideo(cleaned, cookie, Math.max(0, this.addPage - 1));
    if (seq !== this.addUrlSeq || this.addPopup !== popup) return; // 过期响应丢弃：busy 态由输入处理/关闭/新解析各自收尾
    this.addResolving = false;
    this.addRevealed = true; // 解析跑完（无论成功失败）→ 展开下半表单（issue 310）
    if (!res) {
      if (!opts?.auto) {
        this.addMeta = null;
        this.addQualities = null;
        this.addDuration = 0;
        this.addStart = 0;
        this.addEnd = 0;
        this._setResolveState('解析失败：拿不到视频信息（网络不可达 / 视频被删 / 非 B 站链接）——可手动填写分 P 与时间范围');
      }
      this._renderAdd(true);
      return;
    }
    this._setResolveState(null);
    this._applyResolved(res);
    // 短链（b23.tv 分享链接）写回规范链接：用户看得见落地目标，下载器也才认得出 BV 号（ADR-0134）
    if (res.meta.bvid && !parseBvid(cleaned)) urlInput.value = canonicalVideoUrl(res.meta.bvid);
    this._renderAdd(opts?.auto === true);
    if (opts?.auto) {
      const editId = this.editingId; // await 前捕获：期间换任务/关弹窗即作废（review 306）
      if (editId) {
        const tasks = await KnowledgeData.loadTasks();
        const cur = tasks.find((t) => t.id === editId);
        if (cur && this.editingId === editId && this.addPopup === popup) await this._persistResolved(cur, res);
      }
    }
  }

  /** 解析结果落地到弹窗状态：分 P 校正 / 量程 / 范围（首次拿到时长 → 全选；已有范围 → 钳制保持） */
  private _applyResolved(res: ResolvedVideo): void {
    const meta = res.meta;
    const pages = meta.pages || [];
    if (pages.length > 1) {
      if (!pages.some((p) => p.page === this.addPage)) this.addPage = pages[0].page;
    } else {
      this.addPage = pages[0]?.page ?? 1;
    }
    const sel = pages.find((p) => p.page === this.addPage) || pages[0];
    const newDur = sel?.duration || meta.duration || 0;
    // 新时长缺失（如只拿到标题的兜底路径）→ 保留旧量程，防编辑态范围被清成"成对填写"死局（review 306）
    const dur = newDur > 0 ? newDur : this.addDuration;
    const hadRange = this.addDuration > 0;
    this.addMeta = meta;
    this.addQualities = res.qualities || null;
    this.addDuration = dur;
    if (dur > 0) {
      if (hadRange) {
        this.addStart = Math.max(0, Math.min(this.addStart, dur - 1));
        this.addEnd = Math.min(dur, Math.max(this.addEnd, this.addStart + 1));
      } else {
        this.addStart = 0;
        this.addEnd = dur;
      }
    }
  }

  /** 抓取成功即落库（ADR-0133）：只补缺失字段（标题/UP/时长），失败静默不打断录入 */
  private async _persistResolved(task: KnowledgeTask, res: ResolvedVideo): Promise<void> {
    try {
      const patch: Partial<KnowledgeTask> = {};
      const meta = res.meta;
      // 存量短链任务顺手修 URL（老链接只存了 b23.tv，下载阶段认不出 BV 号；ADR-0134）
      if (meta.bvid && needsBvidRepair(task.url)) patch.url = canonicalVideoUrl(meta.bvid);
      if (!task.title && meta.title) patch.title = meta.title;
      if (!task.uploader && meta.uploader) patch.uploader = meta.uploader;
      // duration 语义 = 该任务将下载的那个分 P 的时长（多 P 时按 task.page 取，与弹窗保存同口径）
      const pages = meta.pages || [];
      const pageIdx = Math.max(0, (task.page || 1) - 1);
      const sel = pages[pageIdx] || pages[0];
      const dur = (sel && sel.duration > 0 ? sel.duration : 0) || meta.duration || 0;
      if (!task.duration && dur > 0) patch.duration = dur;
      if (!Object.keys(patch).length) return;
      await KnowledgeData.updateTask(task.id, patch);
      // 面板可见时同步刷新卡片（不派域事件：smartcat 行为流只收 converted / term-generated）
      if (this.videoPopup && this.videoPopup.style.display === 'flex') await this.refreshVideoPanel();
    } catch { /* 落库失败不阻塞（用户仍可点保存） */ }
  }

  hideAddDialog(): void {
    if (this.addPopup && motionClosing(this.addPopup)) return; // 动效层：退场中忽略重复关闭
    const popup = this.addPopup;
    const mask = this.addMask;
    motionAddOut(popup, () => {
      if (mask) mask.style.display = 'none';
      if (popup) popup.style.display = 'none';
    });
    this.editingId = null;
    this.addUrlReset(); // 关弹窗使在途解析过期（杜绝迟到回填到已卸载 DOM）
    this.addMeta = null;
    this.addQualities = null;
    this.addResolving = false;
    this.addRevealed = false;
    this.addPage = 1;
    this.addDuration = 0;
    this.addStart = 0;
    this.addEnd = 0;
    this.addBar = null;
    // 清档位下拉：下次干净打开时无残值可选（编辑态由 showAddDialog 显式回填 task.quality，review 306）
    const qSel = this.addPopup ? q<HTMLSelectElement>(this.addPopup, '#lit-add-quality') : null;
    if (qSel) qSel.innerHTML = '';
  }

  /** 录入解析清理：序列号失效在途响应（开/关弹窗共用，ADR-0133） */
  private addUrlReset(): void {
    this.addUrlSeq++;
  }

  private async _handleAddSave(): Promise<void> {
    if (!this.addPopup) return;
    if (this.addResolving) { notice('解析中，请稍候', 'info'); return; }
    // 保存前净化兜底（ADR-0133）：裸 BV 号/非 http 文本原样
    let url = normalizeSourceUrl((q<HTMLInputElement>(this.addPopup, '#lit-add-url')?.value ?? '').trim());
    if (!url) { notice('请填写视频链接或 BV 号', 'error'); q<HTMLInputElement>(this.addPopup, '#lit-add-url')?.focus(); return; }
    // 解析过但链接里没有 BV 号（b23.tv 短链）→ 按解析出的 bvid 落库规范链接（ADR-0134）
    const resolvedBvid = this.addMeta?.bvid;
    if (resolvedBvid && needsBvidRepair(url)) url = canonicalVideoUrl(resolvedBvid);
    // 时间框现值先提交进状态（防用户输入后直接点保存）
    this._commitTimeInput('start', true);
    this._commitTimeInput('end', true);
    const dur = this.addDuration;
    // 框文本提前读（whole 与成对校验同源）：dur=0 时「两端框都空」才算整片——显式手填的 0:00 不再被整片判定吞掉
    const sRaw = (q<HTMLInputElement>(this.addPopup, '#lit-add-start')?.value ?? '').trim();
    const eRaw = (q<HTMLInputElement>(this.addPopup, '#lit-add-end')?.value ?? '').trim();
    // 整片判定：有量程 = 全选（start=0 且 end=duration）；无时长 = 两端都空
    const whole = dur > 0 ? this.addStart <= 0 && this.addEnd >= dur : !sRaw && !eRaw;
    let start: string | null = null;
    let end: string | null = null;
    if (!whole) {
      // 成对与否看框文本：0:00 是合法开始值（从零截段），数值 0 分不清「没填」——框空才是没填
      // （保存前 _commitTimeInput 已把非法/空输入归位：dur>0 恒回填状态值，dur=0 空则留空）
      if (!sRaw || !eRaw) { notice('开始与结束时间需成对填写', 'error'); return; }
      if (this.addStart >= this.addEnd) { notice('结束时间需大于开始时间', 'error'); return; }
      start = secToTimeText(this.addStart);
      end = secToTimeText(this.addEnd);
    }
    // 分P：多 P 下拉 → 选中值（P1 归一 null）；无 pages 信息 → 数字框手填；单 P 恒 null
    let page: number | null = null;
    const pages = this.addMeta?.pages || [];
    if (pages.length > 1) {
      page = this.addPage > 1 ? this.addPage : null;
    } else if (!pages.length) {
      const raw = (q<HTMLInputElement>(this.addPopup, '#lit-add-page-num')?.value ?? '').trim();
      if (raw) {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1) { notice('分P 应为正整数（留空 = 第 1 P）', 'error'); q<HTMLInputElement>(this.addPopup, '#lit-add-page-num')?.focus(); return; }
        page = n > 1 ? n : null;
      }
    }
    const quality = (q<HTMLSelectElement>(this.addPopup, '#lit-add-quality')?.value ?? '').trim() || null;
    const editing = this.editingId;
    try {
      const patch = {
        url,
        start,
        end,
        quality,
        page,
        title: this.addMeta?.title || null,
        uploader: this.addMeta?.uploader || null,
        duration: dur > 0 ? dur : null,
      };
      if (editing) {
        await KnowledgeData.updateTask(editing, patch);
      } else {
        await KnowledgeData.addTask(patch);
      }
      this.hideAddDialog();
      // 保存后落到「处理」队列（issue 310：录入界面不再兼作列表，给出明确的落点与反馈）
      notice(editing ? '任务已更新' : '已加入影像处理队列', 'success');
      this.showVideoTasks();
    } catch (e: any) {
      notice('保存失败：' + (e?.message ?? String(e)), 'error');
    }
  }

  // ==================== 历史（处理面板内的第二视图，2026-09-14 复核） ====================

  /** 归档行渲染进面板内容区（`tasks` 由调用方一次读库后传入，避免一次刷新读两遍） */
  private renderHistory(tasks: KnowledgeTask[]): void {
    if (!this.videoList) return;
    this.videoList.innerHTML = '';
    const rows = tasks.filter((t) => t.archived);
    const countsEl = this.videoPopup ? q<HTMLElement>(this.videoPopup, '#lit-video-counts') : null;
    if (countsEl) countsEl.textContent = `共 ${rows.length} 条`;
    if (rows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bz-kb-empty';
      empty.textContent = '暂无历史记录。成功的任务完成时会自动归档到这里。';
      this.videoList.appendChild(empty);
      return;
    }
    const groups = new Map<string, KnowledgeTask[]>();
    for (const t of rows) {
      const key = t.url || t.id;
      const g = groups.get(key);
      if (g) g.push(t);
      else groups.set(key, [t]);
    }
    const sortedGroups = Array.from(groups.values()).map((g) => {
      g.sort((a, b) => String(a.processedAt || a.created).localeCompare(String(b.processedAt || b.created)));
      return g;
    });
    sortedGroups.sort((a, b) => {
      const la = String(a[a.length - 1]?.processedAt || a[a.length - 1]?.created || '');
      const lb = String(b[b.length - 1]?.processedAt || b[b.length - 1]?.created || '');
      return lb.localeCompare(la);
    });
    for (const g of sortedGroups) this.videoList.appendChild(this.renderHistoryGroup(g));
  }

  private renderHistoryGroup(group: KnowledgeTask[]): HTMLElement {
    const head = group[0];
    const card = document.createElement('div');
    card.className = 'bz-kb-taskcard bz-kb-hgroup';
    card.dataset.url = head.url || '';
    const href = head.url ? `href="${esc(head.url)}"` : '';
    const upText = head.uploader ? `<span class="bz-kb-hup">${esc(head.uploader)}</span>` : '';
    card.innerHTML = `
      <div class="bz-kb-trow">
        ${head.title
          ? `<a class="bz-kb-tlink" ${href} title="${esc(head.url || '')}">${esc(head.title)}</a>`
          : `<span class="bz-kb-turl" title="${esc(head.url || '')}">${esc(shortUrlText(head.url || ''))}</span>`}
        ${upText}
      </div>`;
    for (const task of group) {
      const line = document.createElement('div');
      line.className = 'bz-kb-hnote';
      line.innerHTML = `${iconSpan('file-text')} ${esc(shortNoteName(task.notePath || ''))}<span class="bz-kb-hnote-time">${iconSpan('clock')} ${esc(formatRelativeTime(task.processedAt || task.created || ''))}</span>`;
      mountIcons(line);
      line.addEventListener('click', () => { if (task.notePath) this.openNote(task.notePath); });
      const actions: ItemAction[] = [];
      if (task.notePath) actions.push({ icon: 'book-open', label: '打开文献笔记', onClick: () => this.openNote(task.notePath!) });
      if (task.videoPath) actions.push({ icon: 'copy', label: '复制视频路径', onClick: () => void this.copyText(task.videoPath!) });
      actions.push({ icon: 'trash-2', label: '移出历史', kind: 'danger', onClick: () => void this.confirmDelete(task) });
      attachItemActions(line, actions);
      card.appendChild(line);
    }
    const link = q<HTMLAnchorElement>(card, '.bz-kb-tlink');
    if (link && head.url) link.onclick = (e) => { e.stopPropagation(); this._openExternal(head.url); };
    return card;
  }

  // ============ 录入面板：名词 / 段落 / 图版同壳三态（142 简洁版 + issue 309/312；155 总结入口 2026-09-16 退役） ============

  createTermUI(): void {
    const mask = document.createElement('div');
    mask.id = 'knowledge-term-mask';
    mask.className = 'bz-overlay-mask bz-kb-mask'; // issue 365 收编单源后此处漏挂 → 遮罩零尺寸不可见、点不着关不掉
    mask.style.display = 'none';
    mask.onclick = () => this.requestTermClose(); // issue 326：有草稿先确认
    const popup = document.createElement('div');
    popup.id = 'knowledge-term-popup';
    popup.className = 'bz-lit-dialog bz-lit-term-dialog kb'; // kb：纸墨皮变量作用域（缺此背景 var(--panel) 失效成透明，issue 257）
    popup.setAttribute('data-lit-entry', 'term'); // 同壳三态：term=一个词 / passage=一段文字 / image=一张图（issue 309/312）
    popup.style.display = 'none';
    const body = document.createElement('div');
    body.className = 'bz-lit-term-body';
    // 词典皮（issue 258/快改批 + issue 309/312 同壳三态）：标题栏+✕ 已退役 / 输入行与来源行同款
    // 标签行 / 生成；预览态：属性卡（含「关联」行）+ 内容卡 + 重新生成/确认写入。
    // 三态只差第一行控件（单行 input / 多行 textarea / 图片拖入区）与属性首行（名词文本 vs 只读标题），
    // 由 popup 上的 data-lit-entry 切换 `.bz-lit-term-only` / `.bz-lit-passage-only` / `.bz-lit-image-only`。
    // 属性行的编辑出口（ADR-0152 决策 16-19，2026-09-16 修订）：**标题与领域改为可编辑**
    // （决策 9 的「AI 产出一律只读」被推翻）——正文仍只读（那是 AI 的产出，改它等于重写），
    // 标题/领域是「编目」动作，必须留给用户；名词行同样可就地改（提交时写回输入框）。
    // 编辑形态 = **点一下才变**（静态与只读逐像素一致，hover 才给极轻提示），回车/失焦提交、ESC 放弃。
    // 属性行次序（2026-09-16 修订）：名词/标题 → 领域 → 来源 → 关联 → 日期（日期沉到最末行）；
    // 关联行**只在正式开跑后出现**（idle 整行隐藏，避免草稿到达前挂一行假的「—」）。
    // 生成入口按状态只出一条（ADR-0152 决策 7/12）：预览收起时是输入行下方的「生成」，
    // 预览展开后该入口移交底部「重新生成」（两处不并列）。
    body.innerHTML = `
      <div class="bz-lit-sheet-head">
        <span class="bz-lit-sheet-title" id="lit-entry-title">名词</span>
      </div>
      <div class="bz-lit-term-row bz-lit-term-only">
        <span class="bz-lit-term-meta-k">名词</span>
        <input id="lit-term-input" type="text" autocomplete="off">
      </div>
      <div id="lit-term-dup" class="bz-lit-dup-hint bz-lit-term-only" style="display:none;"></div>
      <div class="bz-lit-term-row bz-lit-passage-only">
        <span class="bz-lit-term-meta-k">段落</span>
        <textarea id="lit-passage-input" rows="6" placeholder="粘贴一段文字…"></textarea>
      </div>
      <div class="bz-lit-term-row bz-lit-image-only">
        <span class="bz-lit-term-meta-k">图版</span>
        <div id="lit-image-drop" class="bz-lit-drop" tabindex="0" role="button">
          <div id="lit-image-grid" class="bz-lit-drop-grid" style="display:none;"></div>
          <span id="lit-image-hint" class="bz-lit-drop-hint">拖入图片，或 Ctrl+V 粘贴截图</span>
        </div>
        <input id="lit-image-file" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple style="display:none;">
      </div>
      <div class="bz-lit-term-row">
        <span class="bz-lit-term-meta-k">来源</span>
        <input id="lit-term-src" type="text" autocomplete="off">
        <span id="lit-term-src-chip" class="bz-lit-srcchip" style="display:none;"></span>
      </div>
      <div class="bz-lit-term-actions" id="lit-term-gen-row">
        <button id="lit-term-generate" class="bz-lit-accent-btn">生成</button>
      </div>
      <div id="lit-term-preview" style="display:none;">
        <div class="bz-lit-term-card">
          <div class="bz-lit-term-meta">
            <div class="bz-lit-term-meta-row bz-lit-term-only"><span class="bz-lit-term-meta-k">名词</span><span id="lit-term-meta-term" class="bz-lit-term-meta-v is-editable" data-term-edit="term"></span></div>
            <div class="bz-lit-term-meta-row bz-lit-titled-only"><span class="bz-lit-term-meta-k">标题</span><span id="lit-entry-meta-title" class="bz-lit-term-meta-v is-editable" data-term-edit="title"></span></div>
            <div class="bz-lit-term-meta-row"><span class="bz-lit-term-meta-k">领域</span><span id="lit-term-meta-domain" class="bz-lit-term-meta-v is-editable" data-term-edit="domain"></span></div>
            <div class="bz-lit-term-meta-row" id="lit-term-meta-srcrow" style="display:none;"><span class="bz-lit-term-meta-k">来源</span><span id="lit-term-meta-src" class="bz-lit-term-meta-v bz-lit-srcopen" data-term-src-open="1"></span></div>
            <div class="bz-lit-term-meta-row" id="lit-term-meta-relrow" style="display:none;"><span class="bz-lit-term-meta-k">关联</span><span id="lit-term-meta-rel" class="bz-lit-term-meta-v bz-lit-rel-idle"></span></div>
            <div class="bz-lit-term-meta-row"><span class="bz-lit-term-meta-k">日期</span><span id="lit-term-meta-date" class="bz-lit-term-meta-v"></span></div>
          </div>
        </div>
        <div class="bz-lit-term-card">
          <div id="lit-term-content" class="bz-lit-term-content"></div>
        </div>
        <div class="bz-lit-term-actions">
          <button id="lit-term-regenerate">重新生成</button>
          <button id="lit-term-save" class="bz-lit-accent-btn">确认写入</button>
        </div>
      </div>`;
    popup.appendChild(body);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    this.termMask = mask;
    this.termPopup = popup;
    // 统一遮罩点关（issue 271）：✕ 已退役，点遮罩即收起；issue 326 起经 requestTermClose（草稿先确认）。
    // 只留 onclick 一条道——原先 onclick 与 addEventListener 双注册会把确认弹两次
    q<HTMLButtonElement>(popup, '#lit-term-generate')!.onclick = () => void this.onTermGenerate();
    // 底部「重新生成」= 同一个生成动作（ADR-0152 决策 7：生成流在途时再点 = abort 重开）；
    // 原「总结」入口已退役（2026-09-16），该槽位交给重新生成，紧邻确认写入
    q<HTMLButtonElement>(popup, '#lit-term-regenerate')!.onclick = () => void this.onTermGenerate();
    q<HTMLButtonElement>(popup, '#lit-term-save')!.onclick = () => void this.onTermConfirm();
    q<HTMLInputElement>(popup, '#lit-term-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); void this.onTermGenerate(); }
    });
    // 名词重名实时提醒（ADR-0143/issue 328）：输入即查，命中内联提示、改名即消；只提醒不阻断（确认写入再硬拦一道）
    q<HTMLInputElement>(popup, '#lit-term-input')?.addEventListener('input', () => this.refreshTermDupHint());
    // 段落是多行输入：回车用于换行，Ctrl/Cmd + Enter 才触发生成
    q<HTMLTextAreaElement>(popup, '#lit-passage-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void this.onTermGenerate(); }
    });
    // 图版图片行（issue 312；多图 issue 313）：拖入 / 点选文件 / Ctrl+V 粘贴三条路都收，
    // 一次可给多张（拖一组、选择器多选、剪贴板多图），统一落进 acceptImageFiles
    const zone = q<HTMLElement>(popup, '#lit-image-drop');
    const fileInput = q<HTMLInputElement>(popup, '#lit-image-file');
    if (zone && fileInput) {
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('is-over');
        const files = Array.from((e as DragEvent).dataTransfer?.files || []);
        if (files.length) void this.acceptImageFiles(files);
      });
      zone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const files = Array.from(fileInput.files || []);
        fileInput.value = ''; // 复位：同一文件再选一次也要能触发 change
        if (files.length) void this.acceptImageFiles(files);
      });
      // 缩略图上的 ✕ 删除单张（事件委托：缩略图每次重建，逐个挂监听会漏）；
      // 逐图描述框（ADR-0145）点击不冒泡到拖入区（否则点框写字会顺手弹文件选择器）
      q<HTMLElement>(popup, '#lit-image-grid')?.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement)?.closest?.('[data-lit-image-remove]') as HTMLElement | null;
        if (btn) {
          e.stopPropagation(); // 别顺手弹出文件选择器
          this.removeEntryImage(Number(btn.getAttribute('data-lit-image-remove')));
          return;
        }
        if ((e.target as HTMLElement)?.closest?.('[data-lit-image-desc]')) e.stopPropagation();
      });
      // 逐图描述框输入（ADR-0145）：委托同步进内存图项（描述属图片项，删图连描述一起没）
      q<HTMLElement>(popup, '#lit-image-grid')?.addEventListener('input', (e) => {
        const inp = (e.target as HTMLElement)?.closest?.('[data-lit-image-desc]') as HTMLInputElement | null;
        if (!inp) return;
        const i = Number(inp.getAttribute('data-lit-image-desc'));
        if (Number.isInteger(i) && i >= 0 && i < this.entryImages.length) this.entryImages[i].desc = inp.value;
      });
    }
    // Ctrl+V 粘贴截图：面板开着且当前是图版态才接管（document 级——粘贴焦点可能在弹层任意处）
    this.onPaste = (e: ClipboardEvent) => {
      if (!this.termPopup || this.termPopup.style.display !== 'flex' || this.entryMode !== 'image') return;
      const files = clipboardImageFiles(e.clipboardData);
      if (!files.length) return;
      e.preventDefault();
      void this.acceptImageFiles(files);
    };
    document.addEventListener('paste', this.onPaste);
    // 来源行事件（ADR-0116）
    const srcInput = q<HTMLInputElement>(popup, '#lit-term-src');
    if (srcInput) {
      srcInput.addEventListener('input', () => {
        if (this.termSrcTimer) clearTimeout(this.termSrcTimer);
        this.termSrcTimer = setTimeout(() => this.termSrcTryCommit(srcInput), 450);
      });
      srcInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const raw = (srcInput.value || '').trim();
        if (raw && isUrlLikeSourceText(raw)) {
          // URL 字样整串 → 直接落外部 chip（回车即确认）；非 URL 交给联想层选中回填
          e.preventDefault();
          this.termSrcSet({ kind: 'external', url: normalizeSourceUrl(raw) }, srcInput);
        }
      });
      // 联想源：vault 全部 .md（现值过滤、上限 12）；空输入不弹空壳
      this.termSrcSuggest = uiSuggest({
        anchor: srcInput,
        max: 12,
        iconOf: () => '📄',
        labelOf: (p: string) => noteSourceName(p),
        source: () => {
          if (!srcInput.value.trim()) return [];
          return (getApp().vault.getFiles() || []).filter((f: any) => f.extension === 'md').map((f: any) => f.path);
        },
        onPick: (p: string) => this.termSrcSet({ kind: 'note', path: p }, srcInput),
      });
    }
    // 委托：属性行就地编辑 / 关联候选点掉 / 来源 chip ✕ 清除 / meta 行点击打开（动态渲染元素，委托一次）
    popup.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      // 属性行进入编辑态（建议 5：点一下才变；已在编辑态时点输入框不重入）
      const editEl = target.closest('[data-term-edit]') as HTMLElement | null;
      if (editEl && !editEl.querySelector('input')) {
        e.stopPropagation();
        this.beginMetaEdit(editEl, editEl.getAttribute('data-term-edit') as 'term' | 'title' | 'domain');
        return;
      }
      // 点掉一条关联候选（建议 5：本轮不写，不可撤销）
      const dropEl = target.closest('[data-rel-drop]') as HTMLElement | null;
      if (dropEl) {
        e.stopPropagation();
        this.dropEntryRelPick(Number(dropEl.getAttribute('data-rel-drop')));
        return;
      }
      const t = target.closest('[data-term-src-clear],[data-term-src-open]') as HTMLElement | null;
      if (!t) return;
      e.stopPropagation();
      if (t.hasAttribute('data-term-src-clear')) {
        const input = q<HTMLInputElement>(popup, '#lit-term-src');
        this.termSrcClear(input);
      } else if (this.termSource) {
        // meta 行点击：内部笔记 → 打开笔记；外部链接 → 系统浏览器
        if (this.termSource.kind === 'note') this.openNote(this.termSource.path);
        else this._openExternal(this.termSource.url);
      }
    });
  }

  /**
   * 打开「名词」录入（一个词）；term 预填（命令带选中词时自动生成）；src 预填来源（ADR-0116——
   * 仅命令入口带当前笔记，主窗按钮入口不预填）。
   * opts（issue 329 预填扩展，全可选）：见 EntryPrefill——text/images/onCreated；source 走 src 参数。
   */
  showTermEntry(term?: string, src?: TermSource | null, opts?: EntryPrefill): void {
    this.showEntry('term', term, src, opts);
  }

  /**
   * 打开「段落」录入（一段文字，AI 自动出标题）；来源行与名词同构（ADR-0116）。
   * issue 326：支持选区预填（命令入口）。2026-09-16 起预填**同样自动生成**（用户拍板「统一都自动跑」）——
   * 原「大段文字让用户确认后再生成」的差异取消，showEntry 里的自动生成改挂 term + passage 两态。
   * opts（issue 329）：text/images/onCreated 预填。
   */
  showPassageEntry(text?: string, src?: TermSource | null, opts?: EntryPrefill): void {
    this.showEntry('passage', text, src, opts);
  }

  /**
   * 打开「图版」录入（可放多张图，AI 读图成文，issue 312/313）；来源行与名词/段落同构（ADR-0116）。
   * opts（issue 329）：images = data URL 数组预填进内存图列表（走 acceptImageFiles 同构校验与上限）；
   * onCreated = 写入成功回调（不自动打开笔记）。
   */
  showImageEntry(src?: TermSource | null, opts?: EntryPrefill): void {
    this.showEntry('image', '', src, opts);
  }

  /**
   * 同壳三态入口（issue 309/312）：三种录入态共用一套 DOM，只切 `data-lit-entry` 与首行控件——
   * 名词=单行 input（有预填即自动生成），段落=多行 textarea（回车换行，Ctrl/Cmd+回车生成），
   * 图版=图片拖入区（拖/点选/Ctrl+V 三条路都收，**可多张**，图只在内存，确认写入才落盘）。
   * 每次打开即回到全新态：草稿清空、来源清空、图片清空、关联行归位到「待写入」。
   * opts（issue 329）：images 在全新态就位后预填进内存（等价粘贴路径）；onCreated 挂到确认写入——
   * 有回调时写入成功**不自动打开笔记**（ADR-0144 工具框流程：不打断阅读），路径交调用方处置。
   */
  private showEntry(mode: 'term' | 'passage' | 'image', text?: string, src?: TermSource | null, opts?: EntryPrefill): void {
    if (!this.termPopup || !this.termMask) return;
    this.entryMode = mode;
    // 全新态：上一次的草稿、忙态、在途生成流与中断标记全部归零
    // （abort 在途流——它的结果不得写进这次新开的面板）
    this.abortTermGenerate();
    this.termGenerating = false;
    this.termSaving = false;
    this.termDraftBroken = false;
    this.termStreamBody = '';
    this.termPreview = null;
    this.userEdited.clear(); // 全新态：上一轮的用户覆盖层一并归零
    this.entryOnCreated = opts?.onCreated ?? null;
    this.resetEntryRel();
    this.clearEntryImage();
    this.termPopup.setAttribute('data-lit-entry', mode);
    const titleEl = q<HTMLElement>(this.termPopup, '#lit-entry-title');
    if (titleEl) titleEl.textContent = mode === 'passage' ? '段落' : mode === 'image' ? '图版' : '名词';
    const input = q<HTMLInputElement>(this.termPopup, '#lit-term-input');
    const area = q<HTMLTextAreaElement>(this.termPopup, '#lit-passage-input');
    const value = (text ?? '').trim();
    if (input) input.value = mode === 'term' ? value : '';
    if (area) area.value = mode === 'passage' ? value : '';
    this.termSrcReset(q<HTMLInputElement>(this.termPopup, '#lit-term-src'));
    if (src) this.termSrcSet(src, q<HTMLInputElement>(this.termPopup, '#lit-term-src'));
    this.setTermPreviewVisible(false);
    this.setTermContent('', false); // 清掉上一次留下的正文 / 占位文字
    this.refreshTermActions();
    topifyZ(this.termMask, this.termPopup);
    this.termMask.style.display = 'block';
    this.termPopup.style.display = 'flex';
    motionEntryIn(this.termPopup); // 动效层：落纸入场 + 题字揭出
    const zone = q<HTMLElement>(this.termPopup, '#lit-image-drop');
    const focusEl: HTMLElement | null = mode === 'passage' ? area : mode === 'image' ? zone : input;
    if (focusEl && !value) setTimeout(() => focusEl.focus(), 100);
    // 三态一致：有预填即自动跑（2026-09-16 用户拍板「统一都自动跑」）——
    // 段落此前要再点一次「生成」，与名词不同款；同一排入口两套节奏对用户是纯记忆负担。
    if ((mode === 'term' || mode === 'passage') && value) void this.onTermGenerate();
    // 图版图片预填（issue 329）：data URL 数组等价粘贴路径进内存（异步收图，收下即作废旧草稿——全新态无草稿可作废）
    if (mode === 'image' && opts?.images?.length) void this.acceptImageDataUrls(opts.images);
    this.resetTermDupHint(); // 全新态：输入已清空，重名提示一并归位（ADR-0143/issue 328）
  }

  /** 名词重名实时提醒（ADR-0143/issue 328）：同步查 vault（getAbstractFileByPath 内存索引，无需防抖），
   *  命中内联显示既有笔记名，改名即消；仅提醒不阻断、不锁按钮。 */
  private refreshTermDupHint(): void {
    if (!this.termPopup) return;
    const hint = q<HTMLElement>(this.termPopup, '#lit-term-dup');
    if (!hint) return;
    const term = (q<HTMLInputElement>(this.termPopup, '#lit-term-input')?.value ?? '').trim();
    const dup = term ? findDuplicateTermNote(term) : null;
    const wasHidden = hint.style.display === 'none';
    hint.textContent = dup ? '已存在同名文献笔记：' + String(dup).split('/').pop()?.replace(/\.md$/, '') : '';
    hint.style.display = dup ? '' : 'none';
    if (dup && wasHidden) motionDupHint(hint); // 动效层：重名提醒 = 一次性横摇警示
  }

  /** 重名提醒复位（开面板 / 关面板即全新态） */
  private resetTermDupHint(): void {
    const hint = this.termPopup ? q<HTMLElement>(this.termPopup, '#lit-term-dup') : null;
    if (hint) { hint.textContent = ''; hint.style.display = 'none'; }
  }

  // ---------- 图版图片收发（issue 312；多图 issue 313） ----------

  /**
   * 收下若干张图（拖入 / 点选 / 粘贴共用，一次可多张）：格式与体积在 core/ai 侧校验
   * （只认 PNG/JPEG/GIF/WebP、单图 ≤32MiB），不合规的那张就地提示并跳过，其余照收。
   * **追加到列表尾部** = 笔记里的图片顺序就是放入顺序；上限 IMAGE_ENTRY_MAX 张。
   * 收下后**作废已有草稿**（图组变了，旧解读不再对应）：预览收起、关联行归位。
   */
  private async acceptImageFiles(files: File[]): Promise<void> {
    if (!this.termPopup || this.entryMode !== 'image' || !files.length) return;
    if (this.termBusy) return; // 读图 / 落盘中：等它出结果，避免半途改图造成错配
    this.syncImageDescsFromDom(); // 加图前同步描述（尾部追加，既有索引不变，已输入的描述跨重绘保留）
    let hitLimit = false;
    let added = 0;
    for (const file of files) {
      if (this.entryImages.length >= IMAGE_ENTRY_MAX) { hitLimit = true; break; }
      const item = await this.readImageFile(file);
      if (!this.termPopup || this.entryMode !== 'image') return; // 异步期间面板已切换/关闭
      if (!item) continue;
      this.entryImages.push(item);
      added++;
    }
    if (hitLimit) notice(`一次最多放 ${IMAGE_ENTRY_MAX} 张图`, 'error');
    if (!added) return;
    const prevCount = this.entryImages.length - added; // 动效层：只有新增的几张要「贴上卡纸」
    this.renderEntryImage();
    this.draftInvalidate();
    motionThumbsIn(this.termPopup ? q<HTMLElement>(this.termPopup, '#lit-image-grid') : null, prevCount);
  }

  /**
   * data URL 图片预填（issue 329 剪藏本工具框「存为图版」）：程序化入口没有 File 对象——
   * 把 data URL 解码转 File 后交 acceptImageFiles，校验链（MIME 白名单 / 体积 / ≤9 张上限 /
   * 收下作废旧草稿）与粘贴路径完全同构。坏串 / 非 data URL 静默跳过。
   */
  private async acceptImageDataUrls(urls: string[]): Promise<void> {
    const files: File[] = [];
    (Array.isArray(urls) ? urls : []).forEach((u, i) => {
      const m = String(u || '').trim().match(/^data:(image\/[\w.+-]+);base64,([\s\S]+)$/i);
      if (!m) return;
      try {
        const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
        files.push(new File([bytes], `prefill-${i + 1}.png`, { type: m[1] }));
      } catch { /* 坏 base64：跳过该张 */ }
    });
    await this.acceptImageFiles(files);
  }

  /** 单张校验与读取（MIME 白名单 / 读失败 / 转 data URL 失败均就地提示并返回 null） */
  private async readImageFile(file: File): Promise<{ mime: string; bytes: ArrayBuffer; dataUrl: string; desc: string } | null> {
    const mime = (String(file.type || '').toLowerCase() === 'image/jpg'
      ? 'image/jpeg'
      : String(file.type || '').toLowerCase()) || imageMimeOfPath(file.name) || '';
    if (!imageExtOfMime(mime)) { notice('只支持 PNG / JPEG / GIF / WebP 图片', 'error'); return null; }
    let bytes: ArrayBuffer;
    try {
      bytes = await file.arrayBuffer();
    } catch {
      notice('读取图片失败', 'error');
      return null;
    }
    try {
      return { mime, bytes, dataUrl: imageDataUrl(bytes, mime), desc: '' };
    } catch (e: any) {
      notice(String(e?.message ?? e ?? '图片不可用'), 'error');
      return null;
    }
  }

  /** 删掉第 i 张（缩略图上的 ✕）：同样作废已有草稿（图组变了） */
  private removeEntryImage(i: number): void {
    if (!Number.isInteger(i) || i < 0 || i >= this.entryImages.length) return;
    if (this.termBusy) return; // 读图 / 落盘中不删，避免图文错配
    this.entryImages.splice(i, 1);
    this.renderEntryImage();
    this.draftInvalidate();
  }

  /** 草稿失效（图组 / 输入变了）：预览收起、生成按钮复位、关联行归位到「待写入」 */
  private draftInvalidate(): void {
    this.abortTermGenerate(); // 在途生成流同样作废：内容依据已变，它的结果不再对应屏幕上的输入
    this.termGenerating = false;
    this.termDraftBroken = false;
    this.termStreamBody = '';
    this.termPreview = null;
    this.userEdited.clear(); // 草稿作废 = 用户覆盖层一并作废（图组/输入已变）
    this.setTermPreviewVisible(false);
    this.refreshTermActions();
    this.resetEntryRel();
  }

  /** 把 DOM 上的逐图描述框值同步回内存图项——只在索引不变的时机调用（加图前/生成前/写入前）；
   *  删图后剩余项索引前移，旧 DOM 索引会错位覆写，故 removeEntryImage 路径绝不走这里。 */
  private syncImageDescsFromDom(): void {
    if (!this.termPopup) return;
    this.termPopup.querySelectorAll<HTMLInputElement>('[data-lit-image-desc]').forEach((inp) => {
      const i = Number(inp.getAttribute('data-lit-image-desc'));
      if (Number.isInteger(i) && i >= 0 && i < this.entryImages.length) this.entryImages[i].desc = inp.value;
    });
  }

  /**
   * 图片行渲染：有图显示缩略图网格（每张带 ✕ 与逐图描述框，可继续加），无图回到提示文案。
   * 描述框（ADR-0145）：每张图一个（单图即一框），属图片项——删图连描述一起没。
   * 注意：这里**不做** DOM→内存的描述同步——删图后剩余项索引前移，旧 DOM 索引会错位覆写；
   * 同步只在索引不变的时机做（加图前 / 生成前 / 写入前，见 syncImageDescsFromDom 调用点）。
   */
  private renderEntryImage(): void {
    if (!this.termPopup) return;
    const grid = q<HTMLElement>(this.termPopup, '#lit-image-grid');
    const hint = q<HTMLElement>(this.termPopup, '#lit-image-hint');
    const list = this.entryImages;
    if (grid) {
      if (list.length) {
        grid.style.display = '';
        // data URL 是本地自己生成的 base64，仅含 [A-Za-z0-9+/=;,] 与 MIME 前缀，可安全内联
        grid.innerHTML = list.map((im, i) => `<div class="bz-lit-drop-item">
            <img src="${im.dataUrl}" alt="">
            <button type="button" data-lit-image-remove="${i}" title="移除这张" aria-label="移除这张">${iconSpan('x')}</button>
            <input type="text" class="bz-lit-drop-desc" data-lit-image-desc="${i}" placeholder="图注（可选）" value="${esc(im.desc || '')}">
          </div>`).join('');
        mountIcons(grid); // `<i data-lucide>` 占位 → 真 SVG（innerHTML 重建后必须重挂，issue 313）
      } else {
        grid.style.display = 'none';
        grid.innerHTML = '';
      }
    }
    if (hint) {
      hint.textContent = list.length
        ? `已放 ${list.length} 张 · 继续拖入 / 粘贴，或点此添加`
        : '拖入图片，或 Ctrl+V 粘贴截图（可多张）';
    }
  }

  /** 图片状态清空（关面板 / 重开 / 写入完成后）——内存里的字节一并丢掉，不留孤儿文件 */
  private clearEntryImage(): void {
    this.entryImages = [];
    this.renderEntryImage();
  }

  /** 来源状态清空（chip 收起、输入框复位、计时器/联想层归零）——每次打开弹层即全新 */
  private termSrcReset(input: HTMLInputElement | null): void {
    if (this.termSrcTimer) { clearTimeout(this.termSrcTimer); this.termSrcTimer = null; }
    this.termSource = null;
    if (input) {
      input.value = '';
      input.style.display = '';
    }
    this.renderTermSrcChip(input);
    this.termSrcRefreshMeta();
  }

  private termSrcClear(input: HTMLInputElement | null): void {
    this.termSrcReset(input);
    if (input) setTimeout(() => input.focus(), 0);
  }

  /** 输入惰性提交：整串 URL 字样 → 外部 chip；其余文本等联想点选（不自动认领） */
  private termSrcTryCommit(input: HTMLInputElement): void {
    this.termSrcTimer = null;
    const raw = (input.value || '').trim();
    if (!raw || !isUrlLikeSourceText(raw)) return;
    this.termSrcSet({ kind: 'external', url: normalizeSourceUrl(raw) }, input);
  }

  /** 落来源：记录 + chip 渲染 + meta 行同步；外部来源异步抓标题（已有 title（如剪藏本预填）不重复抓；失败静默降级为纯链接） */
  private termSrcSet(src: TermSource, input: HTMLInputElement | null): void {
    this.termSource = src;
    this.renderTermSrcChip(input);
    this.termSrcRefreshMeta();
    if (src.kind === 'external' && !src.title) void this.termSrcFetchTitle(src);
  }

  private async termSrcFetchTitle(src: Extract<TermSource, { kind: 'external' }>): Promise<void> {
    try {
      const t = await fetchPageTitle(src.url);
      if (!t || this.termSource !== src) return; // 期间已被清除/更换 → 丢弃
      src.title = cleanSourceTitle(t); // 剥站点尾巴（_哔哩哔哩_bilibili / - 知乎 系）+ 实体解码
      const inp = this.termPopup ? q<HTMLInputElement>(this.termPopup, '#lit-term-src') : null;
      this.renderTermSrcChip(inp);
      this.termSrcRefreshMeta();
    } catch { /* 抓标题失败静默：chip 保持纯链接 */ }
  }

  /** chip 渲染：有来源 → 徽标（内/外）+ 名称 + ✕；无 → 输入框可见 */
  private renderTermSrcChip(input: HTMLInputElement | null): void {
    const popup = this.termPopup;
    if (!popup) return;
    const chip = q<HTMLElement>(popup, '#lit-term-src-chip');
    if (!chip) return;
    const src = this.termSource;
    if (!src) {
      chip.style.display = 'none';
      chip.textContent = '';
      if (input) input.style.display = '';
      return;
    }
    const isNote = src.kind === 'note';
    const label = isNote ? noteSourceName(src.path) : src.title || shortUrlText(src.url);
    chip.title = isNote ? src.path : src.url;
    chip.style.display = 'inline-flex';
    chip.innerHTML = `<b>${isNote ? '内 部' : '外 部'}</b><span>${esc(label)}</span><button type="button" data-term-src-clear title="清除来源" aria-label="清除来源">✕</button>`;
    if (input) input.style.display = 'none';
    motionSrcChipIn(chip); // 动效层：来源签拍进卡槽（标题异步抓回重渲时同款轻弹）
  }

  /** 预览属性卡第 4 行「来源」：有来源显行（可点开），无来源隐行 */
  private termSrcRefreshMeta(): void {
    const popup = this.termPopup;
    if (!popup) return;
    const row = q<HTMLElement>(popup, '#lit-term-meta-srcrow');
    const val = q<HTMLElement>(popup, '#lit-term-meta-src');
    if (!row || !val) return;
    const src = this.termSource;
    if (!src) { row.style.display = 'none'; val.textContent = ''; return; }
    row.style.display = '';
    val.textContent = src.kind === 'note'
      ? noteSourceName(src.path)
      : src.title || src.url;
    val.title = src.kind === 'note' ? src.path : src.url;
  }

  private setTermPreviewVisible(v: boolean): void {
    if (!this.termPopup) return;
    const p = q<HTMLElement>(this.termPopup, '#lit-term-preview');
    if (p) p.style.display = v ? 'flex' : 'none';
    // 生成入口与预览区互斥（同一动作只出一个槽位，ADR-0152 决策 12）：
    // 预览一展开，输入行下方的「生成」即让位给底部「重新生成」，两处不并列
    const genRow = q<HTMLElement>(this.termPopup, '#lit-term-gen-row');
    if (genRow) genRow.style.display = v ? 'none' : '';
  }

  /** 面板忙态：生成流在途 / 正在落盘——期间不接受新的写入与图片改动（生成键例外：再点 = 中止重开） */
  private get termBusy(): boolean {
    return this.termGenerating || this.termSaving;
  }

  /**
   * 生成 / 重新生成 / 确认写入三键可用性的**唯一刷新出口**（ADR-0152）：改完忙态调它，
   * 不要在别处直接动 disabled。三键各占一个槽位（决策 12：生成入口不留两处）：
   * - 「生成」（输入行下方，仅预览收起时可见）：只有落盘期间禁用。
   * - 「重新生成」（预览底部、确认写入之前）：生成流在途时**保持可点**——再点 = 中止重开（决策 7）；
   *   中断草稿下同样可点（它是从「中断」回到可写状态的那条路）；只有落盘期间禁用。
   * - 「确认写入」：忙态与**中断草稿**下都禁用——中断的半篇不允许落库（决策 6）。
   * issue 327：关联分析不锁任何按钮（setEntryRelBusy 已退役），忙态只锁这三键自己。
   */
  private refreshTermActions(): void {
    if (!this.termPopup) return;
    const gen = q<HTMLButtonElement>(this.termPopup, '#lit-term-generate');
    if (gen) gen.disabled = this.termSaving;
    const regen = q<HTMLButtonElement>(this.termPopup, '#lit-term-regenerate');
    if (regen) {
      regen.disabled = this.termSaving;
      regen.textContent = this.termGenerating ? '生成中…' : '重新生成';
    }
    const save = q<HTMLButtonElement>(this.termPopup, '#lit-term-save');
    if (save) save.disabled = this.termBusy || this.termDraftBroken;
  }

  /**
   * 正文区渲染：占位灰字 / 已流入正文共用同一个容器（textContent 单源）。
   * 值没变就不动 DOM——每帧都写会让流式期间的排版反复重排。
   */
  private setTermContent(text: string, pending: boolean): void {
    const el = this.termPopup ? q<HTMLElement>(this.termPopup, '#lit-term-content') : null;
    if (!el) return;
    if (el.textContent === text && el.classList.contains('bz-lit-term-pending') === pending) return;
    const wasPending = el.classList.contains('bz-lit-term-pending');
    el.classList.toggle('bz-lit-term-pending', pending);
    el.textContent = text;
    if (wasPending && !pending && text) motionContentArrive(el); // 动效层：首个正文字符到达 = 墨迹入纸
  }

  /**
   * 属性行的「分析中…」占位（ADR-0152 决策 4）：领域 / 标题这类 AI 产出的行，
   * 在值到达之前统一挂这一句灰字，与正文区的「正在生成…」同语气。
   */
  private setTermMetaPending(sel: string, text = '分析中…'): void {
    const el = this.termPopup ? q<HTMLElement>(this.termPopup, sel) : null;
    if (!el) return;
    // 与关联行 loading **同一套**信号（2026-09-16 统一）：滑动墨条 bz-lit-rel-bar + 同一句「分析中…」。
    // 属性区里凡「AI 正在算」的行都长这样，不再有的是灰字、有的是滑条。
    el.innerHTML = `<span class="bz-lit-rel-bar" aria-hidden="true"></span>${text}`;
    el.classList.add('bz-lit-meta-pending');
  }

  /** 属性行落值（到达即填）：值与占位同一出口，填完去掉占位灰；从「分析中…」落到真值时播「墨字落纸」 */
  private setTermMetaValue(sel: string, text: string): void {
    const el = this.termPopup ? q<HTMLElement>(this.termPopup, sel) : null;
    if (!el) return;
    const wasPending = el.classList.contains('bz-lit-meta-pending');
    el.textContent = text;
    el.classList.remove('bz-lit-meta-pending');
    if (wasPending) motionMetaSetValue(el); // 动效层：AI 值到达 = 墨字落纸（日期等非 pending 落值不播）
  }

  /* ---------- 属性行就地编辑（建议 5 / ADR-0152 决策 16-19） ---------- */

  /**
   * 进入编辑态：展示态 span **就地**换成同字号输入框（不跳布局），回车 / 失焦提交、ESC 放弃。
   * 领域行额外挂联想候选（见 domainCandidates）。已在编辑态（里面有 input）时不再套一层。
   */
  private beginMetaEdit(el: HTMLElement, field: 'term' | 'title' | 'domain'): void {
    if (!this.termPopup || el.querySelector('input')) return;
    const cur = (el.textContent ?? '').trim();
    el.classList.remove('is-editable');
    el.textContent = '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'bz-lit-term-meta-edit';
    input.value = cur === '—' ? '' : cur; // 占位符不是值
    input.placeholder = field === 'term' ? '术语' : field === 'title' ? '标题' : '领域';
    el.appendChild(input);
    let done = false;
    const finish = (commit: boolean): void => {
      if (done) return;
      done = true;
      this.termDomainSuggest?.detach();
      this.termDomainSuggest?.close();
      this.termDomainSuggest = null;
      const raw = input.value.trim();
      el.textContent = '';
      el.classList.add('is-editable');
      if (commit) this.commitMetaEdit(field, raw);
      else this.paintMetaField(field); // ESC = 放弃：按草稿重画回原值
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
      // stopPropagation 必需：这两个键冒泡到 document 会撞上「ESC 关面板」的分层处理器
      // （用户在属性行按 ESC 想放弃编辑，却弹出关闭确认框——真实键盘路径的 bug）
    });
    input.addEventListener('blur', () => finish(true));
    if (field === 'domain') {
      this.termDomainSuggest = uiSuggest({
        anchor: input,
        max: 12,
        iconOf: () => '🏷',
        labelOf: (v: string) => v,
        source: () => this.domainCandidates(),
        onPick: (v: string) => { input.value = v; },
      });
    }
    setTimeout(() => { input.focus(); input.select(); }, 0);
  }

  /**
   * 提交编辑：写进草稿（落盘取的就是它）+ 记「用户改过」→ 本轮流式不再覆盖该字段。
   * 名词行 = 术语本身，写回顶部输入框（落盘读的是输入框）并重查重名（ADR-0143 提示不能滞后）。
   */
  private commitMetaEdit(field: 'term' | 'title' | 'domain', raw: string): void {
    this.userEdited.add(field);
    if (field === 'term') {
      const input = this.termPopup ? q<HTMLInputElement>(this.termPopup, '#lit-term-input') : null;
      if (input && raw) input.value = raw;
      this.refreshTermDupHint();
    } else if (this.termPreview) {
      if (field === 'title') this.termPreview.title = raw;
      else this.termPreview.domain = raw;
    }
    this.paintMetaField(field);
  }

  /** 单个属性行按当前值重画成展示态（空值给占位「—」；名词取输入框、其余取草稿） */
  private paintMetaField(field: 'term' | 'title' | 'domain'): void {
    if (!this.termPopup) return;
    const sel = field === 'term' ? '#lit-term-meta-term' : field === 'title' ? '#lit-entry-meta-title' : '#lit-term-meta-domain';
    const text = field === 'term'
      ? (q<HTMLInputElement>(this.termPopup, '#lit-term-input')?.value ?? '').trim()
      : String((field === 'title' ? this.termPreview?.title : this.termPreview?.domain) ?? '').trim();
    this.setTermMetaValue(sel, text || '—');
  }

  /**
   * 领域候选（用户拍板口径）：**已用过的领域 ∪ 设置里的词表**，去重后按使用频次降序，
   * 只在词表里、还没用过的排在后面（频次视为 0）。
   * 已用过的从文献目录现扫 frontmatter（走 metadataCache，零 IO）——本机词表是空的，
   * 若只取词表就一条候选都没有，故「已用过」是主来源。
   */
  private domainCandidates(): string[] {
    const s = tryGetSettings() as Partial<BzSettings> | undefined;
    const app = getApp();
    const prefix = litDirOf(s) + '/';
    const used = new Map<string, number>();
    for (const f of (app.vault.getFiles() || []) as any[]) {
      if (!f || f.extension !== 'md' || !String(f.path).startsWith(prefix)) continue;
      const fm = (app.metadataCache.getFileCache(f) as any)?.frontmatter;
      const d = fm && fm.domain ? String(fm.domain).trim() : '';
      if (d) used.set(d, (used.get(d) ?? 0) + 1);
    }
    const out = [...used.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([d]) => d);
    for (const w of parseDomainList(s?.knowledgeDomainList)) {
      if (!used.has(w)) out.push(w);
    }
    return out;
  }

  /**
   * 关联行渲染（issue 309）：按 entryRelState 出文案与墨色档；两类录入共用同一行。
   * loading 态给一条滑动的墨色小条 + 「分析中…」——建链要跑近邻检索与 AI 裁判，
   * 面板必须让「正在跑」这件事看得见（而不是一行静止的灰字）。
   */
  private entryRelRefresh(): void {
    const el = this.termPopup ? q<HTMLElement>(this.termPopup, '#lit-term-meta-rel') : null;
    if (!el) return;
    const st = this.entryRelState;
    // idle = 关联还没开跑（草稿尚未到达）→ **整行不出**（2026-09-16 用户要求）：
    // 此前这里挂着「待写入 → —」，可那一刻关联根本没开始跑，展示一行静止的假状态只会误导。
    // 正式开跑（loading）起才让这一行出现——「看得见正在跑」的前提是它真的在跑。
    const row = this.termPopup ? q<HTMLElement>(this.termPopup, '#lit-term-meta-relrow') : null;
    if (row) {
      const wasHidden = row.style.display === 'none';
      row.style.display = st === 'idle' ? 'none' : '';
      if (wasHidden && st !== 'idle') motionRelRowIn(row); // 动效层：关联行登场轻揭出
    }
    el.className = 'bz-lit-term-meta-v';
    if (st === 'loading') {
      el.classList.add('bz-lit-rel-idle');
      el.innerHTML = '<span class="bz-lit-rel-bar" aria-hidden="true"></span>分析中…';
      return;
    }
    if (st === 'done') {
      el.classList.add('bz-lit-rel-ok');
      const items = this.entryPreviewItems;
      if (!items.length) { el.textContent = this.entryRelText || '已建立关联'; return; }
      // 每条候选一个 chip + ✕（建议 5）：点掉即从本轮写入里移除、**不给恢复**；
      // 重新生成会重算，被点掉的可能再出现（用户拍板）。
      el.innerHTML = items.map((it, i) =>
        `<span class="bz-lit-rel-chip"><span>${esc(it.title)}</span><button type="button" data-rel-drop="${i}" title="这条不写入">✕</button></span>`
      ).join('');
      motionRelChips(el); // 动效层：关联签片逐张插进卡槽
      return;
    }
    if (st === 'empty') { el.classList.add('bz-lit-rel-idle'); el.textContent = '暂无关联'; return; }
    if (st === 'queued') { el.classList.add('bz-lit-rel-idle'); el.textContent = '检索服务不可用，延后至桌面端处理'; return; }
    if (st === 'failed') { el.classList.add('bz-lit-rel-err'); el.textContent = '关联失败'; return; }
    if (st === 'off') { el.classList.add('bz-lit-rel-idle'); el.textContent = '自动双链未开启'; return; }
    el.classList.add('bz-lit-rel-idle');
    el.textContent = '—';
  }

  /**
   * 点掉一条关联候选（建议 5）：本轮不写它——`entryPreviewPicks`（写入用）与
   * `entryPreviewItems`（渲染用）按下标同步删，两数组恒等长。
   * **不可撤销**（用户拍板）：面板不给恢复入口；点「重新生成」会重算，被点掉的可能再出现。
   */
  private dropEntryRelPick(i: number): void {
    if (!Number.isInteger(i) || i < 0 || i >= this.entryPreviewItems.length) return;
    this.entryPreviewItems.splice(i, 1);
    this.entryPreviewPicks.splice(i, 1);
    this.entryRelText = this.entryPreviewItems.map((x) => x.title).join(' · ');
    this.entryRelRefresh();
  }

  /** 关联行与预演状态整体复位（打开/关闭面板、出新草稿、重生成/总结点下时共用）：abort 在途请求、结果清空、回到起点 */
  private resetEntryRel(): void {
    this.entryRelSeq++; // 在途预演的晚到响应据此丢弃
    this.entryRelAbort?.abort(); // issue 327：真中断在途裁判请求（不再白烧 token）
    this.entryRelAbort = null;
    this.entryPreviewPicks = [];
    this.entryPreviewItems = [];
    this.entryPreviewDone = false;
    this.entryRelText = '';
    this.setEntryRel('idle');
  }

  /** 关联行状态切换（单一出口，避免各处直接改字段后忘记重绘） */
  private setEntryRel(st: 'idle' | 'loading' | 'done' | 'empty' | 'queued' | 'failed' | 'off'): void {
    this.entryRelState = st;
    this.entryRelRefresh();
  }

  /**
   * 关联预演（issue 309）：AI 出内容后**立刻**跑——近邻检索 + AI 裁判，**只算不写**（草稿尚未落盘，
   * 故走 preview 而非 now）。属性区「关联」行就地走 loading → 关联名，这正是「生成完就看得到过程」。
   * 序号守卫：重新生成 / 关面板让在途结果作废，晚到的响应不得覆盖新状态。
   * issue 327：起跑前 abort 上一轮（真中断，不白烧 token）；分析期间**不锁任何按钮**——
   * 重新生成 / 总结随点随断随重跑，确认写入转后台。
   */
  private async runEntryRelPreview(content: string, title: string): Promise<void> {
    const bridge = getLinkBridge();
    const seq = ++this.entryRelSeq;
    this.entryPreviewPicks = [];
    this.entryPreviewItems = [];
    if (!bridge) { this.setEntryRel('off'); return; }
    this.entryRelAbort?.abort(); // 上一轮还在跑 → 先断（新内容一到即重新分析，旧的不再要）
    const ac = new AbortController();
    this.entryRelAbort = ac;
    this.entryRelText = '';
    this.setEntryRel('loading');
    try {
      const out = await bridge.preview(content, title, { signal: ac.signal });
      if (seq !== this.entryRelSeq) return; // 已有更新的预演（重新生成）/ 面板已重置
      if (out.status === 'done') {
        this.entryPreviewDone = true;
        this.entryPreviewPicks = out.picks.map((p) => p.path);
        this.entryPreviewItems = out.picks.map((p) => ({ path: p.path, title: p.title }));
        this.entryRelText = out.picks.map((p) => p.title).join(' · ');
        this.setEntryRel(out.picks.length ? 'done' : 'empty');
      } else if (out.status === 'queued') this.setEntryRel('queued');
      else if (out.status === 'skipped') this.setEntryRel('off');
      else this.setEntryRel('failed');
    } catch {
      if (seq === this.entryRelSeq) this.setEntryRel('failed');
    }
  }

  /**
   * 确认写入后的关联落库（issue 309 / 327 改版）：**全程不动关联行**——面板上显示过什么就是什么，
   * 不把行打回 loading（那会被读成「又在重新分析」，实际只是本地写 related）。
   * - 预演 done 有命中 → apply 落库（不重跑检索与裁判）；
   * - 预演 done 零命中（确定「无关联」）→ 无可写；
   * - 预演仍在分析 → 作废面板绑定的这次（省 token），后台重起 预演→apply，挂动态通知；
   * - 预演 failed → 兜底 now 同样转后台；
   * - 通道未接线 / off → 无可写。
   */
  private async commitEntryLinks(path: string): Promise<void> {
    const bridge = getLinkBridge();
    if (!bridge) return; // 关联行已显示「自动双链未开启」
    if (this.entryRelState === 'loading') {
      this.entryRelAbort?.abort();
      this.entryRelAbort = null;
      void this.backgroundRelCommit(path, this.termPreview?.body ?? '', this.entryHeadTitle());
      return;
    }
    if (this.entryPreviewDone && !this.entryPreviewPicks.length) return; // 确定「无关联」，不再重跑管线
    if (this.entryPreviewPicks.length) {
      await bridge.apply(path, this.entryPreviewPicks);
      return;
    }
    if (this.entryRelState === 'failed') void this.backgroundRelNow(path);
  }

  /**
   * 后台建链（issue 327）：分析中确认写入 / 预演失败兜底共用——不占面板，动态通知（同键原地更新）
   * 报进度与结果：分析中… → 已写入 N 条 / 未发现实质关联 / 已入队 / 失败原因。
   */
  private async backgroundRelCommit(path: string, content: string, title: string): Promise<void> {
    const bridge = getLinkBridge();
    if (!bridge) return;
    notify('知识盒关联：后台分析中…', { type: 'progress', dedupeKey: REL_BG_NOTICE_KEY });
    try {
      const out = await bridge.preview(content, title);
      if (out.status === 'skipped') {
        notify('知识盒关联：自动关联未开启，未写入', { type: 'info', dedupeKey: REL_BG_NOTICE_KEY });
        return;
      }
      if (out.status === 'queued') {
        notify('知识盒关联：检索服务不可用，已入队，服务可达后自动处理', { type: 'info', dedupeKey: REL_BG_NOTICE_KEY });
        return;
      }
      if (out.status === 'failed') {
        notify(`知识盒关联失败：${out.error || '未知错误'}`, { type: 'error', dedupeKey: REL_BG_NOTICE_KEY });
        return;
      }
      if (!out.picks.length) {
        notify('知识盒关联：未发现实质关联', { type: 'info', dedupeKey: REL_BG_NOTICE_KEY });
        return;
      }
      const r = await bridge.apply(path, out.picks.map((p) => p.path));
      notify(r.status === 'done' ? `知识盒关联：已写入 ${r.created} 条关联` : '知识盒关联：自动关联未开启，未写入', {
        type: r.status === 'done' ? 'success' : 'info',
        dedupeKey: REL_BG_NOTICE_KEY,
      });
    } catch (e) {
      notify(`知识盒关联失败：${e instanceof Error ? e.message : String(e)}`, { type: 'error', dedupeKey: REL_BG_NOTICE_KEY });
    }
  }

  /** 后台兜底建链（issue 327）：预演失败时的 bridge.now 完整管线，通知口径同 backgroundRelCommit */
  private async backgroundRelNow(path: string): Promise<void> {
    const bridge = getLinkBridge();
    if (!bridge) return;
    notify('知识盒关联：后台建链中…', { type: 'progress', dedupeKey: REL_BG_NOTICE_KEY });
    try {
      const out = await bridge.now(path);
      if (out.status === 'done' || out.status === 'skipped-related') {
        const created = out.status === 'done' ? out.created : 0;
        notify(created > 0 ? `知识盒关联：已写入 ${created} 条关联` : '知识盒关联：未发现实质关联', {
          type: created > 0 ? 'success' : 'info',
          dedupeKey: REL_BG_NOTICE_KEY,
        });
      } else if (out.status === 'queued') {
        notify('知识盒关联：检索服务不可用，已入队，服务可达后自动处理', { type: 'info', dedupeKey: REL_BG_NOTICE_KEY });
      } else if (out.status === 'out-of-scope') {
        notify('知识盒关联：该笔记不在三个盒子内，未写入', { type: 'info', dedupeKey: REL_BG_NOTICE_KEY });
      } else if (out.status === 'failed') {
        notify(`知识盒关联失败：${out.error}`, { type: 'error', dedupeKey: REL_BG_NOTICE_KEY });
      } else {
        notify('知识盒关联：自动关联未开启，未写入', { type: 'info', dedupeKey: REL_BG_NOTICE_KEY });
      }
    } catch (e) {
      notify(`知识盒关联失败：${e instanceof Error ? e.message : String(e)}`, { type: 'error', dedupeKey: REL_BG_NOTICE_KEY });
    }
  }

  /** 当前录入的头部标题：段落 / 图版取草稿里的 AI 标题（属性行已只读，无 DOM 来源），名词取输入框的词 */
  private entryHeadTitle(): string {
    if (!this.termPopup) return '';
    return this.entryTitled
      ? String(this.termPreview?.title ?? '').trim()
      : (q<HTMLInputElement>(this.termPopup, '#lit-term-input')?.value ?? '').trim();
  }

  /** 属性首行是否为「标题行」态（段落 / 图版用；名词的属性首行是只读的名词文本）。
   *  ADR-0152 决策 9 后本判定不再表示「可改标题」，仅表示该态要不要显示标题行。 */
  private get entryTitled(): boolean {
    return this.entryMode === 'passage' || this.entryMode === 'image';
  }

  private noticeTermError(e: unknown): void {
    const msg = String((e && (e as any).message) || e || '未知错误');
    if (/API Key|AI 配置|未配置/.test(msg)) {
      notice('未配置 AI：请到插件设置「AI 配置」页填 API Key 后再生成', 'error');
    } else {
      notice('生成失败：' + msg, 'error');
    }
  }

  private async onTermGenerate(): Promise<void> {
    if (!this.termPopup) return;
    const mode = this.entryMode;
    if (mode === 'image') { await this.onImageGenerate(); return; }
    if (this.termSaving) return; // 落盘期间不重开生成（生成流在途则相反：再点 = 中止重开，决策 7）
    const passage = mode === 'passage';
    const text = passage
      ? (q<HTMLTextAreaElement>(this.termPopup, '#lit-passage-input')?.value ?? '').trim()
      : (q<HTMLInputElement>(this.termPopup, '#lit-term-input')?.value ?? '').trim();
    if (!text) { notice(passage ? '请粘贴要整理的段落' : '请输入名词', 'error'); return; }
    // 再点生成（含流式途中）= 中止在途请求并重开（ADR-0152 决策 7）：正文区立刻回到「正在生成…」，
    // 旧草稿不留在屏上等新一轮结果——否则用户会把上一轮的半篇误读成本轮输出。
    this.abortTermGenerate();
    this.resetEntryRel(); // issue 327：点下即断在途预演（行归「—」），新内容回来再分析
    const ac = new AbortController();
    this.termGenAbort = ac;
    this.termGenerating = true;
    this.beginTermPreview();
    try {
      const hooks: DraftHooks = { signal: ac.signal, onProgress: (f) => this.applyDraftFields(f) };
      const draft: { summary: string; domain: string; title?: string } = passage
        ? await generatePassageDraft(text, hooks)
        : await generateTermDraft(text, hooks);
      if (this.termGenAbort !== ac) return; // 已被新一轮取代 / 用户已中止：这份结果作废
      this.finishTermPreview(draft);
      // 生成出内容即起关联预演（issue 309）：**不 await** —— 面板先回到可操作态，
      // 属性区「关联」行自己走 loading → 完成显示；分析期间按钮不锁（issue 327）。
      this.runEntryRelPreview(draft.summary, this.entryHeadTitle() || text);
    } catch (e) {
      if (this.termGenAbort !== ac) return; // 主动中止：静默——收场由触发方（重开 / 关窗）负责
      this.handleTermGenFailure(e);
    } finally {
      // 只有仍是「当前这一股流」才复位忙态：被取代的那股不得把新一轮的忙态提前解开
      if (this.termGenAbort === ac) {
        this.termGenAbort = null;
        this.termGenerating = false;
        this.refreshTermActions();
      }
    }
  }

  /**
   * 图版读图（issue 312；多图 issue 313）：图片 data URL 列表一次投给多模态模型
   * （core/ai 的 `{text, images}` 通道），出标题 / 领域 / 解读正文后与其余两态走同一套预览 + 关联预演。
   * 流式成形与再点重开口径与名词/段落一致（ADR-0152）：点下即展开骨架，再点 = 中止在途读图并重开。
   */
  private async onImageGenerate(): Promise<void> {
    if (!this.termPopup) return;
    if (this.termSaving) return; // 落盘期间不重开读图（读图在途则相反：再点 = 中止重开，决策 7）
    this.syncImageDescsFromDom(); // 描述框现值先进内存（ADR-0145：图注随读图请求喂 AI）
    const images = this.entryImages;
    if (!images.length) { notice('请先拖入或粘贴图片', 'error'); return; }
    this.abortTermGenerate();
    this.resetEntryRel(); // issue 327：点下即断在途预演（行归「—」），新内容回来再分析
    const ac = new AbortController();
    this.termGenAbort = ac;
    this.termGenerating = true;
    this.beginTermPreview();
    try {
      const hooks: DraftHooks = { signal: ac.signal, onProgress: (f) => this.applyDraftFields(f) };
      const draft = await generateImageDraft(images.map((im) => im.dataUrl), images.map((im) => im.desc), hooks);
      if (this.termGenAbort !== ac) return; // 已被新一轮取代 / 用户已中止：这份结果作废
      this.finishTermPreview(draft);
      this.runEntryRelPreview(draft.summary, this.entryHeadTitle());
    } catch (e) {
      if (this.termGenAbort !== ac) return; // 主动中止：静默
      this.handleTermGenFailure(e);
    } finally {
      if (this.termGenAbort === ac) {
        this.termGenAbort = null;
        this.termGenerating = false;
        this.refreshTermActions();
      }
    }
  }

  /** 中止在途生成流（ADR-0152 决策 7）：先置空句柄再 abort——它的收尾据此被序号守卫拦掉，
   *  不会把「用户自己关的窗 / 自己触发的重生成」误报成「生成中断」。 */
  private abortTermGenerate(): void {
    motionPenOff(); // 动效层：中止即收笔（新一轮 beginTermPreview 再起；关窗 / 作废草稿同路径收）
    const ac = this.termGenAbort;
    this.termGenAbort = null;
    ac?.abort();
  }

  /**
   * 点下即开界面（ADR-0152 决策 4）：预览区立刻展开，属性行先给「用户输入侧」的值（名词 / 日期），
   * AI 产出侧（领域 / 标题）挂「分析中…」，正文区挂「正在生成…」。
   * 生成期间界面必须在位——这是「界面立刻在位、内容依次到位」的前半句。
   * 注意这里**不设** termPreview：草稿仍以收尾的 parseAiJson 结果为准，界面提前展开不等于草稿提前成立。
   */
  private beginTermPreview(): void {
    if (!this.termPopup) return;
    this.termStreamBody = '';
    this.termDraftBroken = false;
    // 新一轮 = 用户覆盖层清空（建议 5 的「覆盖」语义）：上一轮改过的标题 / 领域不再拦住新的 AI 值。
    this.userEdited.clear();
    if (this.entryTitled) {
      this.setTermMetaPending('#lit-entry-meta-title');
    } else {
      const term = (q<HTMLInputElement>(this.termPopup, '#lit-term-input')?.value ?? '').trim();
      this.setTermMetaValue('#lit-term-meta-term', term || '—');
    }
    this.setTermMetaPending('#lit-term-meta-domain');
    this.setTermMetaValue('#lit-term-meta-date', dateStamp());
    this.setTermContent('正在生成…', true);
    this.setTermPreviewVisible(true);
    // 动效层：纸卡浮凸接力（属性卡先成形、内容卡随墨迹揭开）+「笔还在写」呼吸墨滴起笔
    const previewEl = q<HTMLElement>(this.termPopup, '#lit-term-preview');
    motionEntryPreviewIn(previewEl);
    motionEntryPenOn(q<HTMLElement>(this.termPopup, '#lit-term-content')?.closest<HTMLElement>('.bz-lit-term-card') ?? null);
    this.refreshTermActions();
    // 展开时滚一次（ADR-0152 决策 8：流式期间不自动跟随，否则会抢走用户自己的滚动位置）
    const prev = q<HTMLElement>(this.termPopup, '#lit-term-preview');
    prev?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * 流式字段到达（ADR-0152 决策 3/11）：正文逐字写，领域与标题到达即填。
   * 抽取器对「还没到的字段」给 null、对「到了但是空」给空串——两者不可混为一谈，故都按 null 判定。
   */
  private applyDraftFields(f: DraftFields): void {
    if (!this.termPopup) return;
    // 用户已改过的字段不再被流式覆盖（建议 5）：「覆盖」只在点「重新生成」时发生（新一轮清空 userEdited）
    if (f.domain !== null && !this.userEdited.has('domain')) this.setTermMetaValue('#lit-term-meta-domain', f.domain || '—');
    if (this.entryTitled && f.title !== null && !this.userEdited.has('title')) this.setTermMetaValue('#lit-entry-meta-title', f.title || '—');
    if (f.summary !== null) {
      this.termStreamBody = f.summary;
      this.setTermContent(f.summary, false);
    }
  }

  /**
   * 草稿收尾：流式只作用于渲染，草稿对象仍由收尾结果落定（保证「预览所见 == 落盘所写」）。
   * 这里用终值再填一遍——流式路径下大多早已到位，非流式降级路径下这才是唯一一次填充。
   */
  private finishTermPreview(draft: { summary: string; domain: string; title?: string }): void {
    // 用户改过的标题 / 领域以**用户值**收尾（建议 5）：AI 终值只填没被改过的那部分
    const keepTitle = this.userEdited.has('title');
    const keepDomain = this.userEdited.has('domain');
    this.termPreview = {
      domain: keepDomain ? String(this.termPreview?.domain ?? '') : draft.domain,
      body: draft.summary,
      title: keepTitle ? this.termPreview?.title : draft.title,
    };
    this.termStreamBody = draft.summary;
    this.termDraftBroken = false;
    motionPenOff(); // 动效层：草稿落定 = 收笔（墨滴只陪流式过程）
    if (!this.termPopup) return;
    if (this.entryTitled && !keepTitle) this.setTermMetaValue('#lit-entry-meta-title', draft.title || '—');
    if (!keepDomain) this.setTermMetaValue('#lit-term-meta-domain', draft.domain || '—');
    this.setTermContent(draft.summary, false);
    // 新草稿 = 关联行回到起点，上一次的写入出口与在途预演一并作废
    this.resetEntryRel();
    this.refreshTermActions();
  }

  /**
   * 生成失败分流（ADR-0152 决策 6）：已经流进正文 → 算「中断」——文字保留可见、草稿标记为不可写；
   * 一个字都没到 → 常规生成失败报错（骨架留在已展开态，可直接再点生成）。
   * 用户主动中止不会走到这里（由调用方的句柄守卫拦掉）。
   */
  private handleTermGenFailure(e: unknown): void {
    motionPenOff(); // 动效层：生成收场（失败 / 中断）即收笔
    if (this.termStreamBody) {
      this.termDraftBroken = true;
      notice('生成中断：已保留收到的内容，请重新生成后再写入', 'error');
    } else {
      this.noticeTermError(e);
    }
    this.refreshTermActions();
  }

  private async onTermConfirm(): Promise<void> {
    if (!this.termPopup || this.termBusy) return;
    // 中断草稿不可写（ADR-0152 决策 6）：半篇正文宁可留在屏上，也不落进文献盒
    if (this.termDraftBroken) { notice('生成中断：请重新生成后再写入', 'error'); return; }
    const mode = this.entryMode;
    const source = this.termSource; // 来源随确认时刻的值落库（ADR-0116）
    if (!this.termPreview) { notice('请先点击「生成」获取预览', 'info'); return; }
    const summary = this.termPreview.body;
    const domain = this.termPreview.domain;
    let term = '';
    let title = '';
    if (this.entryTitled) {
      // 标题行已只读（ADR-0152 决策 9）：值只从草稿取，不再回读 DOM
      title = String(this.termPreview.title ?? '').trim();
      if (!title) { notice('标题不能为空', 'error'); return; }
    } else {
      term = (q<HTMLInputElement>(this.termPopup, '#lit-term-input')?.value ?? '').trim();
      if (!term) { notice('请输入名词', 'error'); return; }
      // 名词重名硬拦截（ADR-0143/issue 328）：命中即拒写，预览与面板保留、改名即可重试；
      // 段落 / 图版标题 AI 生成，刻意不拦（重名 writeUniqueNote 兜底 _2 并列）
      const dup = findDuplicateTermNote(term);
      if (dup) { notice('已存在同名文献笔记：' + dup, 'error'); return; }
    }
    // 图版必须带着图走（预览存在但图被清掉 = 状态错位，宁可拒写也不留无图笔记）
    this.syncImageDescsFromDom(); // 描述框现值先进内存（ADR-0145：描述随图片一并落盘）
    const images = this.entryImages;
    if (mode === 'image' && !images.length) { notice('图片已丢失，请重新拖入', 'error'); return; }
    const onCreated = this.entryOnCreated; // await 前捕获（hideTermEntry 会复位回调）
    this.termSaving = true;
    this.refreshTermActions();
    const save = q<HTMLButtonElement>(this.termPopup, '#lit-term-save');
    if (save) save.textContent = '写入中…';
    try {
      let path: string;
      if (mode === 'image') {
        // 图版：图片本体逐张与笔记一并落盘（note-gen 负责命名、去重与写唯一路径；desc 走 ![[路径|描述]] 分叉）
        path = await generateImageNote({
          title,
          summary,
          domain,
          source,
          images: images.map((im) => ({ bytes: im.bytes, ext: imageExtOfMime(im.mime) || 'png', desc: String(im.desc || '').trim() })),
        });
        emitDomainEvent('knowledge:tasks', { kind: 'image-generated', title, notePath: path });
        try {
          await this.commitEntryLinks(path);
        } catch (le) {
          // 关联落库失败不回滚已写笔记、不再上抛——否则 onCreated 断链 + 用户重试落 _2 重名副本（issue 329 评审）
          console.warn('[knowledge] 关联写入失败（笔记已落盘）', le);
          notice('笔记已写入，但关联写入失败', 'warning');
        }
        this.clearEntryImage(); // 字节已进 vault，内存副本立刻丢掉
        notice('已生成图版文献笔记：' + title, 'success');
      } else {
        path = mode === 'passage'
          ? await generatePassageNote({ title, summary, domain, source })
          : await generateTermNote({ term, summary, domain, source });
        emitDomainEvent('knowledge:tasks', mode === 'passage'
          ? { kind: 'passage-generated', title, notePath: path }
          : { kind: 'term-generated', term, title: term, notePath: path });
        // 关联落库（issue 309）：预演结果写进 related；写完**直接关窗**（面板不逗留展示结果）
        try {
          await this.commitEntryLinks(path);
        } catch (le) {
          // 同图版分支：关联失败不回滚不吞 onCreated（issue 329 评审）
          console.warn('[knowledge] 关联写入失败（笔记已落盘）', le);
          notice('笔记已写入，但关联写入失败', 'warning');
        }
        notice(mode === 'passage' ? '已生成段落文献笔记：' + title : '已生成名词文献笔记：' + term, 'success');
      }
      this.hideTermEntry(true);
      // 写入成功后的去向（issue 329）：有 onCreated（剪藏本工具框流程）→ 回调路径、**不自动打开笔记**
      // （ADR-0144：不打断阅读；回调失败只记日志，不影响已完成的落盘）；否则维持「生成即开」。
      if (onCreated) {
        try { onCreated(path); } catch (e) { console.warn('[knowledge] onCreated 回调失败（笔记已写入）', e); }
      } else {
        this.openNote(path); // issue 326：生成即开——关掉录入面板直达生成的笔记（openNote 自带收主面板/队列面板）
      }
    } catch (e) {
      this.noticeTermError(e);
    } finally {
      this.termSaving = false;
      if (save) save.textContent = '确认写入';
      this.refreshTermActions();
    }
  }

  /**
   * 关闭录入面板。`immediate` = 写入成功路径（确认落盘后无可丢失，用户预期即时收场）：
   * 跳过收纸退场直接交还 display——否则关窗动画（240ms）与列表刷新竞速，
   * 「写入 → 关窗 + 笔记进列表」的既有断言/体感会被退场演出拖慢。
   */
  hideTermEntry(immediate = false): void {
    // 动效层：退场中忽略重复关闭（ESC 连按不会二次触发关闭确认框）
    if (this.termPopup && motionClosing(this.termPopup)) return;
    // 面板一关即在途生成流中止（ADR-0152 决策 7：关窗走二次确认，**用户确认之后**才走到这里；
    // 取消关闭 ⇒ 请求继续跑）。忙态一并归零——之后到达的那股流由句柄守卫丢弃，不改任何状态。
    this.abortTermGenerate();
    this.termGenerating = false;
    this.termSaving = false;
    this.termDraftBroken = false;
    this.termStreamBody = '';
    this.termPreview = null;
    this.entryOnCreated = null;
    this.resetEntryRel();
    this.clearEntryImage();
    this.resetTermDupHint();
    const srcInput = this.termPopup ? q<HTMLInputElement>(this.termPopup, '#lit-term-src') : null;
    this.termSrcReset(srcInput);
    if (immediate) {
      if (this.termMask) this.termMask.style.display = 'none';
      if (this.termPopup) this.termPopup.style.display = 'none';
    } else {
      // 动效层：收纸演完才交还 display（jsdom / 无 WAAPI 同步收口，测试零时差）
      const popup = this.termPopup;
      const mask = this.termMask;
      motionEntryOut(popup, () => {
        if (mask) mask.style.display = 'none';
        if (popup) popup.style.display = 'none';
      });
    }
    void this.refreshCurrent();
  }

  /**
   * 同壳三态脏判定（issue 326 关闭二次确认）：当前态输入非空 / 已有预览 / 生成中 / 图版有内存图，
   * 任一即脏。来源行**单独不算脏**——命令入口本就预填来源（ADR-0116），一打开就关就弹确认是骚扰。
   */
  private entryDirty(): boolean {
    if (!this.termPopup) return false;
    if (this.termBusy || this.termPreview || this.termDraftBroken) return true;
    if (this.entryMode === 'image') return this.entryImages.length > 0;
    const el = this.entryMode === 'passage'
      ? q<HTMLTextAreaElement>(this.termPopup, '#lit-passage-input')
      : q<HTMLInputElement>(this.termPopup, '#lit-term-input');
    return !!(el && el.value.trim());
  }

  /** 录入面板关闭请求（issue 326）：脏 → 风格化二次确认（ADR-0125 统一壳 + 知识盒域皮）；干净态直关。
   *  遮罩点击与 ESC 都走这里；确认写入成功路径直接调 hideTermEntry（不自带确认）。 */
  private requestTermClose(): void {
    if (!this.entryDirty()) { this.hideTermEntry(); return; }
    const what = this.entryMode === 'image' ? '图片' : this.entryMode === 'passage' ? '段落' : '名词';
    confirmDiscard(() => this.hideTermEntry(), `${what}还没生成写入，关闭后将丢失`, 'kb bz-kb-flow-dialog');
  }

  /** 影像录入弹窗关闭请求（issue 326）：用户动过表单（addDirty 事件打标）→ 二次确认；纯打开未动 → 直关。
   *  保存成功路径直接调 hideAddDialog（刚落库无可丢）。 */
  private requestAddClose(): void {
    if (this.addDirty) confirmDiscard(() => this.hideAddDialog(), '影像信息还没保存，关闭后将丢失', 'kb bz-kb-flow-dialog');
    else this.hideAddDialog();
  }

  // ==================== 通用小工具 ====================

  private openNote(path: string): void {
    const app = getApp();
    const file = app.vault.getAbstractFileByPath(path);
    if (file) {
      void app.workspace.getLeaf(false).openFile(file as any);
      this.hideMain();
      this.hideVideo();
    } else {
      notice('文献笔记不存在：' + path, 'error');
    }
  }

  private async copyText(text: string): Promise<void> {
    try { await navigator.clipboard.writeText(text); notice('已复制：' + text, 'success'); }
    catch { notice('复制失败', 'error'); }
  }

  /** 外链打开 = core 单源转发（一致#14：原域内 openUrl→electron 副本删除；最深兜底层
   *  多出 window.open + 人话提示——favorites F14 同款，正常桌面路径行为不变） */
  private _openExternal(url: string): void {
    openExternalUrl(getApp(), url);
  }

  destroy(): void {
    this.abortTermGenerate(); // 在途生成流随面板销毁中止
    motionTeardown(); // 动效层：撤全部在途退场簿记 / 编排定时器 / 循环注入件
    this.clearRunTimer();
    this.runState.clear();
    if (this.termSrcTimer) { clearTimeout(this.termSrcTimer); this.termSrcTimer = null; }
    this.addUrlReset(); // 录入 URL 防抖定时器/在途序列随销毁归零（issue 278）
    try { this.termSrcSuggest?.detach(); } catch { /* 忽略 */ }
    this.termSrcSuggest = null;
    if (this.refreshTimer) { clearTimeout(this.refreshTimer); this.refreshTimer = null; }
    for (const unsub of this.fileListenerRefs) {
      try { unsub(); } catch { /* 忽略 */ }
    }
    this.fileListenerRefs = [];
    this.fileListenerAttached = false;
    document.removeEventListener('keydown', this.onKeydown);
    document.removeEventListener('paste', this.onPaste); // issue 312：图版粘贴监听随面板销毁卸载
    this.onPaste = () => {};
    this.termPreview = null;
    this.entryImages = [];
    this.entryOnCreated = null;
    for (const el of [this.mask, this.popup, this.videoMask, this.videoPopup, this.addMask, this.addPopup, this.termMask, this.termPopup, this.previewHostEl]) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    this.previewHostEl = null;
    this.mask = null;
    this.popup = null;
    this.contentEl = null;
    this.videoMask = null;
    this.videoPopup = null;
    this.videoList = null;
    this.addMask = null;
    this.addPopup = null;
    this.termMask = null;
    this.termPopup = null;
  }
}
