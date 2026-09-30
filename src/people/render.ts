/**
 * 脸谱渲染纯层（issue 447 / 450 / 451 / 455 / ADR-0104 markup 单源）：面板壳 / 折子封面墙 / 详情折页册 /
 * 数据源弹窗 / 统计与档案弹窗 / 档案与随手记 / 互动数据的 markup 全部在此，ui.ts 与评审壳共用同一份。
 * 纯度：import 图只进域内零依赖模块（types.ts 兼容读单源 personOf/bondOf；render-purity 守卫同口径）——
 * DOM 构建走本文件自持 helper；时间文案由调用方算好注入，本层只拼字符串。
 * 折子语义（G 案拍板）：一人一册——封面竖排姓名 + 修复印章；详情折页册 issue 455 起为三折
 * （卷一《其人》/ 卷二《相交》/ 《纪事》；原画像折拆双卷、编年史并入纪事折，数据与档案两页改独立弹窗），
 * 收起折显竖排引文，点折脊展开。真实数据形态适配：竖排名 >7 字截断（实测最长 37 字）、
 * 零媒体不出徽章（74% 联系人零语音）、消息量级万格式化（max 20,773）。
 */
import type { FaceEvent, GenerationConfirmInfo, ImportRecord, ManualEvent, PersonEntry, PersonProfile } from './types';
// 终态标注取值（ADR-0224/0225）——只取类型，保持渲染层不碰数据层实现
import type { DescSkip } from './datasource';
// 会话流标签 → 图标（issue 529；chat.ts 是零依赖纯逻辑，两侧共用同一张词表）
import { chatTagIcon } from './chat';
import { bondOf, personOf } from './types';

// ---------------- 自持小件（纯 DOM helper；与旧 ui.ts 同款签名） ----------------

/** 头像色板（按名字 hash 取色——封面面孔识别） */
const AVATAR_COLORS = ['#b5534a', '#5a8f6d', '#4a7d9e', '#8a6bb0', '#b08a3e', '#7a8b4a', '#a05d7a', '#5f6b7a'];

export function el(
  tag: string,
  cls?: string,
  arg?: Node | Node[] | Record<string, string>,
  ...rest: Array<Node | Node[]>
): HTMLElement {
  const flat = (ns: Array<Node | Node[]>): Node[] => ns.flatMap((n): Node[] => (Array.isArray(n) ? n : [n]));
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (arg === undefined) {
    for (const c of flat(rest)) node.appendChild(c);
  } else if (Array.isArray(arg)) {
    for (const c of flat([...arg, ...rest])) node.appendChild(c);
  } else if (arg instanceof Node) {
    node.appendChild(arg);
    for (const c of flat(rest)) node.appendChild(c);
  } else {
    for (const [k, v] of Object.entries(arg)) node.setAttribute(k, v);
    for (const c of flat(rest)) node.appendChild(c);
  }
  return node;
}

export function text(s: string): Text {
  return document.createTextNode(s);
}

export function textEl(tag: string, s: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = s;
  return node;
}

export function button(cls: string, label: string, attrs: Record<string, string>): HTMLElement {
  const b = el('button', cls, attrs) as HTMLButtonElement;
  b.type = 'button';
  b.textContent = label;
  return b;
}

export function initials(name: string): string {
  const s = name.trim();
  return s ? [...s][0] : '?';
}

export function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** ts → `YYYY-MM-DD`（水位印章 / 随手记默认值） */
export function formatDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 消息量格式化：≥1 万显「1.2 万」（余数 ≥100 才带小数，正好整万不带零头），其余千分位（实测量级 1 ~ 20,773） */
export function formatCount(n: number): string {
  if (n >= 10000) {
    const w = (n / 10000).toFixed(n % 10000 >= 100 ? 1 : 0);
    return `${w.endsWith('.0') ? w.slice(0, -2) : w} 万`;
  }
  return n.toLocaleString('en-US');
}

/** 秒 → 人读时长（回复时延 / 语音总时长） */
export function formatReplySec(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '—';
  if (sec < 60) return `${Math.round(sec)} 秒`;
  if (sec < 3600) return `${Math.round(sec / 60)} 分`;
  return `${(sec / 3600).toFixed(1)} 时`;
}

/**
 * 回复时延取值（issue 449）：优先中位数（更抗「刷屏一条隔很久」的失真）；
 * 旧数据没有中位数字段 → 回落平均值；两者都缺（旧数据 / 部分统计，issue 454）→ 0
 * （无样本，原样透传由 formatReplySec 出占位）。
 */
export function replyLatencySec(median: number | undefined, avg: number | undefined): number {
  return median ?? avg ?? 0;
}

/**
 * 竖排姓名截断（真实形态适配：实测最长 37 字、纯数字字母名 4 人）：
 * ≤7 字原样竖排；更长取前 6 字 +「…」。
 */
export function vtName(name: string): string {
  const s = String(name ?? '').trim();
  return [...s].length <= 7 ? s : `${[...s].slice(0, 6).join('')}…`;
}

/** media 形状（结构类型，不引 media.ts 值链） */
export interface MediaShape {
  voiceCount: number;
  voiceTotalSec: number;
  imageCount: number;
}

/** 媒体徽章文案（零项不出）：「语音 26 条 · 4 分 · 图片 14 张」；空返回 '' */
export function mediaLabel(s: MediaShape | null | undefined): string {
  if (!s) return '';
  const parts: string[] = [];
  if (s.voiceCount > 0) {
    parts.push(`语音 ${s.voiceCount} 条`);
    if (s.voiceTotalSec > 0) parts.push(formatDuration(s.voiceTotalSec));
  }
  if (s.imageCount > 0) parts.push(`图片 ${s.imageCount} 张`);
  return parts.join(' · ');
}

/** 秒 → `N 分` / `N.N 时`（语音总时长） */
export function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} 秒`;
  if (sec < 3600) return `${Math.round(sec / 60)} 分`;
  return `${(sec / 3600).toFixed(1)} 时`;
}

/** 路径 → 可加载的资源 URI。
 *  - 评审壳：window.BZW_MEDIA_BASE 有值时（预览服务注入）走服务路由；
 *  - 库内相对路径：走 vault getResourcePath（app://<id>/...，必可加载）；
 *  - 库外绝对路径：app://local/ 兜底（467 起库内不再存明文头像——保库记录头像走 avatarUri 的 data URL，
 *    本兜底仅供数据源行的库外字节路径等历史形态）。 */
export function localResourceUri(path: string): string {
  const norm = path.replace(/\\/g, '/');
  const escape = (s: string): string => s.replace(/#/g, '%23').replace(/\?/g, '%3F');
  if (typeof window !== 'undefined') {
    const base = (window as { BZW_MEDIA_BASE?: string }).BZW_MEDIA_BASE;
    if (base) return base + escape(encodeURI(norm));
    const w = window as unknown as {
      app?: { vault?: { adapter?: { getResourcePath?: (p: string) => string } } };
    };
    const adapter = w.app?.vault?.adapter;
    const res = adapter?.getResourcePath;
    if (adapter && res && !/^[A-Za-z]:/.test(norm) && !/^(https?:)?\/\//.test(norm) && !norm.startsWith('/')) {
      try { return res.call(adapter, norm); } catch { /* 拿不到走兜底 */ }
    }
  }
  if (/^(https?:)?\/\//.test(norm) || norm.startsWith('/')) return norm;
  const rel = norm.replace(/^[A-Za-z]:/, '').replace(/^\/+/, '');
  return `app://local/${escape(encodeURI(rel))}`;
}

/** 头像 URI（467）：保库记录解出的 data URL / 数据根字节直读的 data URL 原样用；其余走 localResourceUri */
export function avatarUri(a: string): string {
  return a.startsWith('data:') ? a : localResourceUri(a);
}

/** markdown 去饰取纯文本（折脊引文用）：剥 #/>/-/** 与围栏，压成一行 */
export function mdPlain(md: string): string {
  return String(md ?? '')
    .replace(/```+/g, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^#{1,6}\s*/, '').replace(/^>\s?/, '').replace(/^-\s*/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .join(' ');
}

/** 引文截断（折脊竖排引文；竖排每字占一格，40 字约一折高） */
export function spillOf(s: string, n = 40): string {
  const t = mdPlain(s);
  return [...t].length <= n ? t : `${[...t].slice(0, n).join('')}…`;
}

// ---------------- 面板壳 ----------------

/**
 * 图标按钮：lucide 占位放按钮**内部**（mountIcons 只替换占位元素本身——
 * 占位若在 button 上会把按钮整个换成 span，点击钩子即灭，448 踩过）。
 * label 走 aria-label + title。
 */
export function iconButton(icon: string, cls: string, attrs: Record<string, string>): HTMLElement {
  const b = el('button', cls, attrs) as HTMLButtonElement;
  b.type = 'button';
  b.appendChild(el('i', 'bz-ic', { 'data-lucide': icon, 'aria-hidden': 'true' }));
  return b;
}

/**
 * 面板壳（issue 505）：打开面板就是这一册相册——没有标题栏、没有品牌行。
 * 册子本体（摊开的两页 / 详情跨页 / 册页弹窗）画在 `data-people-spread` 里；
 * 右下沿两枚小签（找一找 / 数据源）常驻；进度便签与合并横幅各自一个绝对定位槽位。
 */
export function panelShell(): HTMLElement {
  return el('div', 'bz-people-panel', [
    el('div', 'bz-people-page-wrap', { 'data-people-scroll': 'wrap' }, [
      el('div', 'bz-people-spread', { 'data-people-spread': '' }),
    ]),
    el('div', 'bz-people-tabs', [
      button('bz-people-tab', '找一找', { 'data-people-dialog': 'find' }),
      button('bz-people-tab', '数据源', { 'data-people-dialog': 'ds' }),
    ]),
    el('div', 'bz-people-jobs-slot', { 'data-people-jobs-slot': '' }),
    el('div', 'bz-people-banner-slot', { 'data-people-banner-slot': '' }),
  ]);
}

// ---------------- 生成进度块（issue 450：阶段化进度 + 后台化） ----------------

/** 进度块任务态（ui 层从引擎快照映射；本层只管画） */
export type JobsUiStatus = 'running' | 'paused' | 'interrupted' | 'done' | 'error';

export interface JobsBlockState {
  /** 任务 talker（挂块根 data 钩子，resume / dismiss 派发用） */
  talker: string;
  name: string;
  status: JobsUiStatus;
  /** 引擎主文案（切批 / 抽样 / 第 N 批 / 素材汇总）；空串回落状态兜底文案 */
  message: string;
  /** 当前阶段键（497：后段主行按阶段标签显示，不再停在过期批号） */
  stage?: string;
  batchesDone: number;
  batchesTotal: number;
  /** 已完成成文阶段数（其人 / 我们 / 编年史，0~3；issue 455 四阶段） */
  stagesDone: number;
  /** 队列位置（1 起）与总人数 */
  queueIndex: number;
  queueTotal: number;
  /** error 态错误说明 */
  errorText?: string;
  /** error 态可否断点续跑（issue 453）：漂移判废（消息集已变）接不上，只能删除重来 */
  resumable?: boolean;
  /** 工具段进度（469：preprocess 阶段；无 = 该任务不带 prep / 已完成） */
  prep?: JobsPrepState;
  /** 图片描述段进度（470：describe 阶段；无 = 该任务不在该段） */
  describe?: JobsDescribeState;
}

/** 工具段进度视图（ui 从引擎 job.prep 映射；本层只管画） */
export interface JobsPrepState {
  /** 阶段行文案（ui 侧 prepStageLine 组装，如 `媒体导出 312/1631`）。非 null = 任务正处
   * preprocess 段（阶段行上屏、进度条用 overall）；null = 工具段已过（AI 段暂停等不带阶段信息） */
  stageText: string | null;
  /** 整段总进度 0~100（进度条；四段均分折算） */
  overall: number;
  /** 单条媒体 / 语音失败累计（>0 且非 running 时出「重试失败项」） */
  failed: number;
}

/** 图片描述段进度视图（470；ui 从引擎 job.describe × stage 映射，本层只管画） */
export interface JobsDescribeState {
  /** 阶段行文案（ui 侧 describeStageLine 组装，如 `图片描述 3/82 批`） */
  stageText: string;
  /** 段内总进度 0~100（进度条） */
  overall: number;
}

/** 进度百分比（issue 455 口径）：(已完成批 + 已完成成文阶段) / (总批数 + 3)，钳 0~100 */
export function jobsPercent(batchesDone: number, batchesTotal: number, stagesDone: number): number {
  const denom = (batchesTotal > 0 ? batchesTotal : 0) + 3;
  const numer = Math.max(0, batchesDone || 0) + Math.max(0, stagesDone || 0);
  return Math.min(100, Math.round((numer / denom) * 100));
}

/**
 * 阶段键 → 已完成成文阶段数（issue 455 四阶段：extracting 逐批 → person 画其人 → bond 写我们 → chronicle 编年史）：
 * chronicle 进行中 = 其人 / 我们已完成（2）；bond 进行中 = 1；其余（extracting / person / 旧版 portrait）= 0；
 * done = 3。
 */
export function jobsStagesDone(stage: string | undefined, status: JobsUiStatus): number {
  if (status === 'done') return 3;
  if (stage === 'chronicle') return 2;
  if (stage === 'bond') return 1;
  return 0;
}

/** 状态 → 动作钮（label + data 钩子）；done 无动作 */
const JOBS_ACTIONS: Record<JobsUiStatus, { label: string; hook: string } | null> = {
  // 运行中不再给「暂停」钮（issue 502 续）：画谱是一次想看完的连续过程，
  // 摆在眼前的暂停反而诱发误触；要中断就关面板 / 换人跑，任务本身留断点可续。
  running: null,
  paused: { label: '继续生成', hook: 'data-people-jobs-resume' },
  interrupted: { label: '继续生成', hook: 'data-people-jobs-resume' },
  // issue 453：error 也出「继续生成」——451 已放宽 resume 接受 error（从 batchesDone 续跑）。
  // 450 时这里只有「删除任务」，把用户逼到别的入口（详情头 / 数据源弹窗）去「重新画」，那才是重烧。
  error: { label: '继续生成', hook: 'data-people-jobs-resume' },
  done: null,
};

/** 进度块动作列表：主动作（继续生成等）+ issue 517 的「取消」——中断 / 暂停 / 报错（可续）态在
 *  「继续生成」后追加「取消」（删任务：AI 作废不落盘，详情头随之回到「补画脸谱」）。
 *  running 保持无动作（502：要中断关面板留断点）；done 无动作（产物已入保库，进度块等收起）；
 *  仅「接不上」的 error（漂移判废）维持单枚「删除任务」——续跑必然再判废，删了重来才对。 */
function jobsActionsOf(s: JobsBlockState): Array<{ label: string; hook: string }> {
  if (s.status === 'error' && s.resumable === false) return [{ label: '删除任务', hook: 'data-people-jobs-dismiss' }];
  const main = JOBS_ACTIONS[s.status];
  if (!main) return [];
  return s.status === 'done' ? [main] : [main, { label: '取消', hook: 'data-people-jobs-cancel' }];
}

/**
 * 工具段主行文案（469）：preprocess 阶段（或其暂停 / 中断面）的阶段行——带 `已完成/总数`
 * （media/derive/transcribe 段末 [bz-info] 汇总校正，进行中按 [bz-p].pct 推算）。
 */
function prepStagePart(s: JobsBlockState): string | null {
  return s.prep?.stageText ?? null;
}

/** 图片描述段主行文案（470）：describe 阶段（或其暂停 / 中断面）的阶段行 */
function describeStagePart(s: JobsBlockState): string | null {
  return s.describe?.stageText ?? null;
}

/**
 * 后段阶段键 → 主行标签（497）：person / bond / chronicle 各自有名有姓，
 * 不再回落成过期的「第 N/M 批」；prep / describe 段自有阶段行，不在此列。
 * 三名与详情折页名逐字对齐（其人 / 相交 / 纪事，issue 455 拍板）——引擎侧旧词
 * 「我们」「关系时间线」不再上屏。
 */
export function jobsStageLabel(stage: string | undefined): string | null {
  switch (stage) {
    case 'chunked': return '正在切批组装素材…';
    case 'person': return '正在生成《其人》…';
    case 'bond': return '正在生成《相交》…';
    case 'chronicle': return '正在生成《纪事》…';
    default: return null;
  }
}

/** 状态词段（主行头；running 无词） */
function jobsStatusPrefix(status: JobsUiStatus): string {
  switch (status) {
    case 'paused': return '已暂停';
    case 'interrupted': return '上次中断';
    case 'error': return '生成失败';
    default: return '';
  }
}

/**
 * 进度锚点（主行中段）：prep 阶段行 → describe 阶段行 → 后段阶段标签 → 批位。
 * 状态面口径同 497：error 无阶段信息时回落「已完成 N/M 批」，interrupted 不挂后段标签（只说中断）。
 */
function jobsAnchor(s: JobsBlockState): string {
  const prep = prepStagePart(s);
  if (prep) return prep;
  const desc = describeStagePart(s);
  if (desc) return desc;
  if (s.status === 'error') return `已完成 ${s.batchesDone}/${s.batchesTotal} 批`;
  if (s.status === 'interrupted') return '';
  const stage = jobsStageLabel(s.stage);
  if (stage) return stage;
  // 暂停面不报批位：批号只在运行中当锚点（批位随 message 细节补，避免与「第 N 批」各说一遍）
  if (s.status === 'paused') return '';
  return s.batchesTotal > 0 ? `第 ${Math.min(s.batchesDone + 1, s.batchesTotal)}/${s.batchesTotal} 批` : '';
}

/** 骨架化（判重用的粗比对：状态语 / 连接符 / 省略号不参与，`正在生成《纪事》…` ≡ `《纪事》`） */
function skeleton(line: string): string {
  return line.replace(/正在|生成|·|\s/g, '').replace(/…$/, '');
}

/**
 * 细节文案去状态词：`已暂停（12/60 批）` → `12/60 批`——主行已写状态，细节不再念一遍。
 */
function stripStatusWord(detail: string, status: JobsUiStatus): string {
  const word = jobsStatusPrefix(status);
  if (!detail || !word || !detail.startsWith(word)) return detail;
  const rest = detail.slice(word.length).replace(/^[ ·：:，,、—-]+/, '').trim();
  return /^[（(][^）)]*[）)]$/.test(rest) ? rest.slice(1, -1).trim() : rest;
}

/**
 * 锚点与细节合并——同一件事只留更详尽的一条，避免并排重复念：
 *   `正在生成《纪事》…` + `《纪事》完成，正在提炼人物档案…` → 留后者（细节已含锚点信息）；
 *   `第 12/60 批` + `第 12/60 批 · 2026-05-01 ~ …`   → 留后者；
 *   `正在切批组装素材…` + `消息 20773 条 → 35 批 · 共 38 次 AI 调用` → 两段都留（各说一层）。
 */
function mergeAnchorDetail(anchor: string, detail: string): { anchor: string; detail: string } {
  if (!detail) return { anchor, detail: '' };
  if (!anchor) return { anchor: '', detail };
  const key = skeleton(anchor);
  const bare = skeleton(detail);
  if (key && bare.includes(key)) return { anchor: detail, detail: '' };
  if (key && key.includes(bare)) return { anchor, detail: '' };
  const tag = anchor.split(' ')[0];
  if (tag && detail.startsWith(tag)) return { anchor: detail, detail: '' };
  return { anchor, detail };
}

/** 主行两段（head = 状态 · 锚点，粗体；detail = 引擎细节，同行内次级灰字） */
export interface JobsMainLine {
  head: string;
  detail: string;
}

/**
 * 主行文案（497 两行版 → 现口径「一行到底」）：`状态词 · 进度锚点 · 引擎细节`。
 * 副行已取消——引擎细节改挂主行尾部（`.bz-people-jobs-detail`，同行内次级灰字），
 * 用户不等也能看见整条链在流动：批号与日期段、素材统计、阶段推进句、prep 等待句。
 * error 面不挂细节（原因由底部错误行承担）；done 只有一句（该态不上屏，见 ui.renderJobs）。
 */
export function jobsMainLine(s: JobsBlockState): JobsMainLine {
  if (s.status === 'done') return { head: '脸谱已生成', detail: '' };
  const anchor = jobsAnchor(s);
  const detail = s.status === 'error' ? '' : stripStatusWord((s.message ?? '').trim(), s.status);
  const merged = mergeAnchorDetail(anchor, detail);
  const head = [jobsStatusPrefix(s.status), merged.anchor].filter(Boolean).join(' · ');
  return { head: head || '正在生成', detail: merged.detail };
}

/**
 * 进度便签（issue 505：贴到册子左下沿的一张纸，不再顶在面板头上）。
 * 四块：队列行（一人一任务顺序跑，画的是谁、队里第几位）/ 细进度条 + 百分比 /
 * 主行（状态 · 锚点 · 引擎细节，一行到底）/ 动作行（错误说明 + 继续 / 删除 / 重试）。
 * 469：preprocess 阶段进度条 = 工具段折算总进度；470：describe 阶段 = 描述批进度。
 */
export function jobsNote(s: JobsBlockState): HTMLElement {
  const stagePart = prepStagePart(s);
  const descPart = describeStagePart(s);
  const pct = stagePart ? s.prep!.overall : descPart ? s.describe!.overall : jobsPercent(s.batchesDone, s.batchesTotal, s.stagesDone);
  const block = el('div', 'bz-people-jobs', {
    'data-people-jobs': '',
    'data-people-jobs-talker': s.talker,
    role: 'status',
  });
  // 队列行：只有真的在排队（不止一位）才写——「第 2/3 位 · 徐雯静」
  if (s.queueTotal > 1) {
    const who = el('div', 'bz-people-jobs-who');
    who.append(
      text('第 '),
      textEl('b', String(Math.min(Math.max(1, s.queueIndex), s.queueTotal))),
      text('/'),
      textEl('span', String(s.queueTotal)),
      text(` 位 · ${s.name || s.talker}`),
    );
    block.appendChild(who);
  }
  const meter = el('div', 'bz-people-jobs-meter');
  meter.appendChild(el('div', 'bz-people-jobs-track', { 'aria-hidden': 'true' },
    el('div', 'bz-people-jobs-fill', { style: `width:${pct}%` })));
  meter.appendChild(el('span', 'bz-people-jobs-pct', text(`${pct}%`)));
  block.appendChild(meter);
  // 主行：状态 · 锚点（粗体）+ 引擎细节（同行内次级灰字，不另起第二行）
  const line = jobsMainLine(s);
  const mainEl = el('div', 'bz-people-jobs-main', text(line.head));
  if (line.detail) mainEl.appendChild(el('span', 'bz-people-jobs-detail', text(` · ${line.detail}`)));
  block.appendChild(mainEl);
  const foot: HTMLElement[] = [];
  if (s.status === 'error' && s.errorText) foot.push(el('span', 'bz-people-jobs-err', text(s.errorText)));
  // 469 失败分流：prep 段有计账失败（单条媒体 / 语音）且任务不在跑 → 出「重试失败项」
  // （工具幂等只补失败项；AI 段已完成的批次照常保留）
  if (s.prep && s.prep.failed > 0 && s.status !== 'running' && s.status !== 'done') {
    foot.push(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '重试失败项', { 'data-people-jobs-prep-retry': '' }));
  }
  for (const action of jobsActionsOf(s)) {
    foot.push(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', action.label, { [action.hook]: '' }));
  }
  if (foot.length) block.appendChild(el('div', 'bz-people-jobs-foot', foot));
  return block;
}

// ---------------- 相册簿（issue 505：打开面板就是一本自粘式相册） ----------------

/** 一页贴几张（2 列 × 3 行）；一摊 = 左右两页 */
export const AL_PER_PAGE = 6;
export const PER_SPREAD = 2;

/** 一侧的翻页余量：还剩几页、折算成露在外面的几层纸边 */
export interface TurnSide {
  pages: number;
  flips: number;
}

export interface TurnLoad {
  left: TurnSide;
  right: TurnSide;
}

export function pageTotal(count: number): number {
  return Math.max(1, Math.ceil(count / AL_PER_PAGE));
}

/** 最后一摊的左页序号（永远是偶数） */
export function lastCur(total: number): number {
  return total % PER_SPREAD === 0 ? Math.max(0, total - PER_SPREAD) : total - 1;
}

/** 两侧的翻页余量：cur 左边剩几页、右边剩几页 → 折算成还能翻几次 */
export function turnLoad(cur: number, total: number): TurnLoad {
  const lp = cur;
  const rp = Math.max(0, total - cur - PER_SPREAD);
  return { left: { pages: lp, flips: Math.ceil(lp / PER_SPREAD) }, right: { pages: rp, flips: Math.ceil(rp / PER_SPREAD) } };
}

/** 两侧的「叠纸」：还能翻几次就露几层纸边（最多 4 层），纸边本身也能点（与热区同一用法） */
function stackSide(side: 'l' | 'r', flips: number): HTMLElement {
  const box = el('div', `bz-people-stack bz-people-stack-${side}`, flips ? { 'data-people-turn': side === 'l' ? 'prev' : 'next' } : undefined);
  for (let i = 1; i <= Math.min(flips, 4); i++) box.appendChild(el('i', '', { style: `--i:${i}` }));
  return box;
}

/** 翻页热区：册子两侧的空白，点一下翻过去（悬停自己亮一下，读屏标签说明还有几页） */
function turnStrip(dir: 'prev' | 'next', side: TurnSide): HTMLElement | null {
  if (side.flips <= 0) return null;
  const b = el('button', `bz-people-turn bz-people-turn-${dir === 'prev' ? 'l' : 'r'}`, {
    'data-people-turn': dir,
    'aria-label': dir === 'prev' ? `往前翻一摊（前面还有 ${side.pages} 页）` : `往后翻一摊（后面还有 ${side.pages} 页）`,
  }) as HTMLButtonElement;
  b.type = 'button';
  return b;
}

/**
 * 一摊（册壳 + 两侧叠纸与热区）。掀过去那张纸不在这儿画（见 ui 的翻摊）：
 * 它是一块挂在页面上的固定纸，免得受册子内部的包含块 / 层叠 / 溢出影响。
 */
export function albumSpread(inner: HTMLElement[], load: TurnLoad, opts: { boot?: boolean; turn?: 'next' | 'prev' | ''; mod?: string } = {}): HTMLElement {
  const cls = ['bz-people-spread', opts.boot ? 'bz-people-boot' : '', opts.turn ? `bz-people-turn-${opts.turn}` : '', opts.mod ?? ''].filter(Boolean).join(' ');
  const wrap = el('div', 'bz-people-page-wrap', { 'data-people-scroll': 'wrap' });
  const spread = el('div', cls, { 'data-people-spread': '' });
  for (const n of inner) spread.appendChild(n);
  const left = turnStrip('prev', load.left);
  if (left) spread.appendChild(left);
  const right = turnStrip('next', load.right);
  if (right) spread.appendChild(right);
  spread.appendChild(stackSide('l', load.left.flips));
  spread.appendChild(stackSide('r', load.right.flips));
  wrap.appendChild(spread);
  return wrap;
}

/** 中缝：两页之间那道压出来的沟（折痕用纸色虚线转述） */
export function albumGutter(): HTMLElement {
  return el('div', 'bz-people-gutter');
}

/** 页眉左边那枚小签：常规页写「第几页 / 共几页」，空册与解密中写状态 */
export function headChip(inner: Node | string): HTMLElement {
  return el('span', 'bz-people-head-count', typeof inner === 'string' ? text(inner) : inner);
}

// ---------------- 照片角上的印（issue 451 四态 → 相册口径） ----------------

/**
 * 印态（互斥）：还没洗出来（无印）/ 画谱中（带进度环，点印即「本批做完后暂停」）/
 * 排队中 / 画谱中断（歇、停）/ 已画（画）/ 旧版（旧）。
 * 任务态压过脸谱水位：已有脸谱又在中途补画的人显「画谱中」，否则用户看到的是一张过期的印。
 */
export type FoldSealState = 'none' | 'running' | 'halted' | 'queued' | 'drawn' | 'legacy';

export interface AlbumSeal {
  state: FoldSealState;
  /** 印上的字（单字；none 不出印） */
  text: string;
  title: string;
  /** 画谱中的进度环（0~100；仅 running 有） */
  pct?: number;
  /** 印能点的动作：只 running（暂停）可点，其余印只是标记（动作在详情页） */
  action: 'pause' | null;
}

/** 卡片上的任务视图（ui 从引擎快照映射；本层只管画） */
export interface FoldCardJob {
  status: JobsUiStatus;
  batchesDone: number;
  batchesTotal: number;
  /** 已完成成文阶段数（其人 / 相交 / 纪事，0~3） */
  stagesDone: number;
  /** 失败态可否断点续跑：漂移类失败（消息集已变）接不上，只能重新生成 */
  resumable: boolean;
  /** 排在队里还没轮到（issue 505：一人一任务顺序跑，等的这位也上印） */
  queued?: boolean;
  /** 工具段总进度 0~100（469：preprocess 阶段的印章百分比；缺省按批口径算） */
  prepPct?: number;
  /** 图片描述段总进度 0~100（470：describe 阶段的印章百分比；优先于 prepPct） */
  describePct?: number;
}

export function albumSealOf(p: PersonEntry, job: FoldCardJob | null): AlbumSeal {
  const name = p.name || p.id;
  if (job && job.status !== 'done' && job.queued) {
    return { state: 'queued', text: '等', title: `「${name}」排在队里，等着画`, action: null };
  }
  if (job && job.status !== 'done') {
    const prog = job.batchesTotal ? `${job.batchesDone}/${job.batchesTotal} 批` : '尚未切批';
    if (job.status === 'running') {
      const pct = job.describePct ?? job.prepPct ?? jobsPercent(job.batchesDone, job.batchesTotal, job.stagesDone);
      return {
        state: 'running',
        text: '画',
        pct,
        title: `正在生成「${name}」的脸谱（${prog}）——点这里在本批做完后暂停`,
        action: 'pause',
      };
    }
    if (job.status === 'error' && !job.resumable) {
      return { state: 'halted', text: '停', title: `「${name}」上次生成中断且接不上（消息集已变）——去详情页重新生成`, action: null };
    }
    return {
      state: 'halted',
      text: job.status === 'error' ? '停' : '歇',
      title: `「${name}」${job.status === 'error' ? '上次生成失败' : '上次没画完'}（${prog}）——去详情页从断点继续，已画完的批次不重画`,
      action: null,
    };
  }
  // 旧单卷脸谱（只有 portrait）先认出来：它虽有 digest，但「旧版」这枚印要提醒重画一次
  if (isLegacyFace(p)) return { state: 'legacy', text: '旧', title: `「${name}」的脸谱还是旧版单卷——去详情页重画一次`, action: null };
  // 「已画」判据与 deleteTierOf 同源：只认三卷正文任一非空——空壳 digest（字段全空）不算已画，
  // 否则墙上盖「已画」印、详情三折全是「还没生成」、删除却按未画谱走，同一份数据两处判定打架
  if (p.digest && (personOf(p.digest) || bondOf(p.digest) || p.digest.chronicle)) {
    return {
      state: 'drawn',
      text: p.lastProcessedTs ? '画' : '绘',
      title: `「${name}」的脸谱已画到这天——去详情页用新导入的消息补画（没有新消息会跳过）`,
      action: null,
    };
  }
  return { state: 'none', text: '', title: '', action: null };
}

/** 旧版单卷脸谱：正文还挂在旧字段 portrait 上（双卷之前的落盘） */
function isLegacyFace(p: PersonEntry): boolean {
  return !!p.digest && !p.digest.person && !!p.digest.portrait;
}

/** 印节点：画谱中那枚是 button（点即暂停），其余是标记块 */
export function albumSealNode(p: PersonEntry, job: FoldCardJob | null): HTMLElement | null {
  const seal = albumSealOf(p, job);
  if (seal.state === 'none') return null;
  if (seal.state === 'running') {
    const b = el('button', 'bz-people-seal bz-people-seal-run', {
      'data-people-seal-act': 'pause',
      'aria-label': `暂停生成：${p.name || p.id}`,
      title: seal.title,
    }) as HTMLButtonElement;
    b.type = 'button';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'bz-people-seal-ring');
    svg.setAttribute('viewBox', '0 0 36 36');
    const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    track.setAttribute('cx', '18');
    track.setAttribute('cy', '18');
    track.setAttribute('r', '15.6');
    track.setAttribute('pathLength', '100');
    const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    arc.setAttribute('class', 'bz-people-seal-arc');
    arc.setAttribute('cx', '18');
    arc.setAttribute('cy', '18');
    arc.setAttribute('r', '15.6');
    arc.setAttribute('pathLength', '100');
    arc.setAttribute('style', `stroke-dasharray:${Math.max(0, Math.min(100, seal.pct ?? 0))} 100`);
    svg.append(track, arc);
    b.append(svg, el('span', '', text(seal.text)));
    return b;
  }
  return el('div', `bz-people-seal bz-people-seal-${seal.state}`, { title: seal.title }, text(seal.text));
}

// ---------------- 一张照片 / 一行 / 一页 ----------------

/** 照片数据（ui 侧备好，本层只管画） */
export interface AlbumPhoto {
  p: PersonEntry;
  /** 头像文件路径（空串走首字印） */
  avatar: string;
  /** 这一格在页里的序号（--i：显影 / 飞进来的先后） */
  index: number;
  /** 新素材条数（>0 贴「新 N」） */
  fresh: number;
  /** 30 天内的重要日子（照片角上的提醒贴纸） */
  due: { what: string; date: string; days: number } | null;
  /** 引擎任务（印态；无任务按脸谱水位） */
  job: FoldCardJob | null;
}

/** 这一摊的一次性动效入参（issue 507）：导入完飞回的那几位 + 刚画完的那位 */
export interface AlbumCellOpts {
  /** 刚导进来的那几位（人物 id 名单）→ 对应格子放「飞回」动画 */
  drop?: string[];
  /** 刚画完那一位（人物 id）→ 那一格从灰里显影 */
  dev?: string;
}

/** 头像：有照片就是照片，没有走「首字印」（印色按名字取色，一页里不至于一片红） */
export function avatarNode(name: string, avatar: string, sizeCls = ''): HTMLElement {
  if (avatar) return el('img', sizeCls, { src: avatarUri(avatar), alt: name });
  const s = el('span', `${sizeCls} bz-people-ava-txt`.trim(), {
    style: `background:hsl(${avatarHue(name)} 34% 46%)`,
  }, text(initials(name)));
  return s;
}

function avatarHue(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % 360;
}

/** 这一位总共导入了多少条消息 */
function msgsOf(p: PersonEntry): number {
  return p.imports.reduce((s, r) => s + r.messageCount, 0);
}

/** 一张照片（膜下的一格）：照片 + 印 + 角上的贴纸 + 底下那张手写标签。
 *  `opts.drop` = 这一趟刚导进来的那几位 → 照片飞回册页；`opts.dev` = 刚画完那位 → 从灰里洗出颜色
 *  （issue 507：两个一次性动效的类名，505 之后没人挂，CSS 白白候着） */
export function albumPhoto(ph: AlbumPhoto, opts: AlbumCellOpts = {}): HTMLElement {
  const { p, avatar, index, fresh, due, job } = ph;
  const name = p.name || p.id;
  const seal = albumSealOf(p, job);
  const todo = seal.state === 'none'; // 还没洗出来：不盖印，照片是空白的
  const cell = el('div', [
    'bz-people-cell',
    todo ? 'bz-people-todo' : '',
    seal.state === 'queued' ? 'bz-people-wait' : '',
    opts.drop?.includes(p.id) ? 'bz-people-drop' : '',
    opts.dev && opts.dev === p.id ? 'bz-people-dev' : '',
  ].filter(Boolean).join(' '), {
    'data-people-pocket': p.id,
    tabindex: '0',
    role: 'button',
    style: `--i:${index}`,
    'aria-label': `${name} · ${formatCount(msgsOf(p))} 条消息`,
  });
  const print = el('div', 'bz-people-print');
  print.appendChild(el('div', 'bz-people-photo', avatarNode(name, avatar)));
  if (todo) print.appendChild(el('div', 'bz-people-blank', text('还没洗出来')));
  const sealNode = albumSealNode(p, job);
  if (sealNode) print.appendChild(sealNode);
  if (fresh > 0) print.appendChild(el('div', 'bz-people-fresh', text(`新 ${formatCount(fresh)}`)));
  if (due) print.appendChild(el('div', 'bz-people-due', { title: `${due.what} · ${due.date}` }, text(`${due.what} ${due.days} 天`)));
  const meta = job && job.status !== 'done'
    ? (job.queued ? '排队中'
      : job.status === 'running' ? `画谱中 ${job.describePct ?? job.prepPct ?? jobsPercent(job.batchesDone, job.batchesTotal, job.stagesDone)}%`
        : job.status === 'error' ? '失败待续' : '已暂停')
    : `${formatCount(msgsOf(p))} 条`;
  print.appendChild(el('div', 'bz-people-cap', [
    el('span', 'bz-people-name', text(vtName(name))),
    el('span', `bz-people-meta${job && job.status === 'running' ? ' bz-people-meta-run' : ''}`, text(meta)),
  ]));
  cell.appendChild(print);
  return cell;
}

/** 空位：这一格还没贴上人 */
export function albumVacant(): HTMLElement {
  const s = el('span', 'bz-people-vacs');
  s.append(text('空位'), el('br'), text('等新照片'));
  return el('div', 'bz-people-cell bz-people-vacant', s);
}

/** 后半摊的占位页（issue 507）：照片还没排到这一页，纸也照样摊开——别让册子只剩半本。
 *  关键：这一页**不报页码**（报的话会出现「第 2 / 1 页」这种伪编号）。 */
export function albumBlankPage(): HTMLElement {
  const rows: HTMLElement[] = [];
  for (let i = 0; i < AL_PER_PAGE; i += 2) {
    const r = el('div', 'bz-people-row');
    r.append(albumVacant(), albumVacant(), el('div', 'bz-people-row-note'));
    rows.push(r);
  }
  return el('div', 'bz-people-page', [
    el('div', 'bz-people-page-head', [
      headChip('空页'),
      el('span', 'bz-people-head-right', el('span', 'bz-people-head-note', text('还没贴到这一页'))),
    ]),
    albumSleeve(rows),
  ]);
}

/** 这一行贴的是「哪几年的人」：起年越早，衬纸越黄一档（翻页时一眼看出时间段） */
function rowEra(a: AlbumPhoto | null, b: AlbumPhoto | null): number {
  const from = a?.p.imports.map((r) => r.timeFrom).sort()[0] ?? b?.p.imports.map((r) => r.timeFrom).sort()[0] ?? '';
  const y = Number(from.slice(0, 4)) || 0;
  if (!y) return 0;
  return y >= 2024 ? 0 : y >= 2022 ? 1 : y >= 2020 ? 2 : 3;
}

/** 这一行两人的共同点（只在真有共同点时落笔，没有就留一条空线） */
function rowNote(a: AlbumPhoto | null, b: AlbumPhoto | null): string {
  if (!a || !b) return '';
  const ta = (a.p.profile?.tags ?? []).filter(Boolean);
  const tb = (b.p.profile?.tags ?? []).filter(Boolean);
  for (const t of ta) if (tb.includes(t)) return `都算「${t}」`;
  const ya = (a.p.imports.map((r) => r.timeFrom).sort()[0] ?? '').slice(0, 4);
  const yb = (b.p.imports.map((r) => r.timeFrom).sort()[0] ?? '').slice(0, 4);
  if (ya && ya === yb) return `${ya} 年认识的`;
  return '';
}

/** 一行两张：两张照片 + 底下一行手写批注（一行一组，像同一张衬纸上的两个人） */
export function albumRow(a: AlbumPhoto | null, b: AlbumPhoto | null, opts: AlbumCellOpts = {}): HTMLElement {
  const row = el('div', 'bz-people-row', { 'data-era': String(rowEra(a, b)) });
  row.appendChild(a ? albumPhoto(a, opts) : albumVacant());
  row.appendChild(b ? albumPhoto(b, opts) : albumVacant());
  row.appendChild(el('div', 'bz-people-row-note', text(rowNote(a, b))));
  return row;
}

/** 贴相区：一组组照片 + 罩在上面的一整张透明膜（膜比网格四周各宽一圈，才像「隔层」） */
export function albumSleeve(rows: HTMLElement[]): HTMLElement {
  return el('div', 'bz-people-boardarea', [
    el('div', 'bz-people-sleeve', [
      el('div', 'bz-people-board', rows),
      el('div', 'bz-people-film'),
    ]),
  ]);
}

/**
 * 一页（页眉 + 贴相区）。第一页报总账（几位 / 多少条 / 几张脸谱），往后每页报这一页的说话跨度——
 * 「接着往前」「最近一次说话」这些字都省了，越简越不抢版面。
 */
export function albumPage(cells: Array<AlbumPhoto | null>, no: number, totalPeople: number, ledger: { faces: number; msgs: number }, opts: AlbumCellOpts = {}): HTMLElement {
  const slots: Array<AlbumPhoto | null> = cells.slice(0, AL_PER_PAGE);
  while (slots.length < AL_PER_PAGE) slots.push(null);
  const rows: HTMLElement[] = [];
  for (let i = 0; i < slots.length; i += 2) rows.push(albumRow(slots[i], slots[i + 1], opts));
  const head = el('div', 'bz-people-page-head');
  head.appendChild(headChip(el('span', 'bz-people-head-count-in', [
    textEl('b', String(no)),
    text(' / '),
    textEl('span', String(pageTotal(totalPeople))),
  ])));
  if (no === 1) {
    head.appendChild(el('span', 'bz-people-head-label', text('最近说过话的')));
    const l = el('span', 'bz-people-head-ledger');
    l.append(
      text('共 '), textEl('b', formatCount(totalPeople)), text(' 位 · '),
      textEl('b', formatCount(ledger.msgs)), text(' 条 · '),
      textEl('b', String(ledger.faces)), text(' 张脸谱'),
    );
    head.appendChild(el('span', 'bz-people-head-right', l));
  } else {
    const names = cells.filter((c): c is AlbumPhoto => !!c).map((c) => c.p.name);
    const span = names.length ? `${names[names.length - 1]} ~ ${names[0]}` : '';
    head.appendChild(el('span', 'bz-people-head-right', el('span', 'bz-people-head-note', text(span))));
  }
  const page = el('div', 'bz-people-page', head);
  page.appendChild(albumSleeve(rows));
  return page;
}

// ---------------- 上锁封面 / 空册 / 冷读 ----------------

/** 上锁：整册合着，只看得见封皮与搭扣（脸谱存在加密保库里，没解锁就只有这一张封面） */
export function lockCover(boot = false): HTMLElement {
  const spread = el('div', `bz-people-spread bz-people-lockwrap${boot ? ' bz-people-boot' : ''}`);
  const cover = el('div', 'bz-people-cover', [
    el('div', 'bz-people-cover-band'),
    el('div', 'bz-people-cover-title', text('脸谱')),
    el('div', 'bz-people-cover-sub', text('人物消息脸谱')),
    el('div', 'bz-people-clasp', el('i', 'bz-ic', { 'data-lucide': 'lock', 'aria-hidden': 'true' })),
    el('div', 'bz-people-cover-hint', text('脸谱数据在加密保库里 —— 解锁后才能查看。聊天原文只在本机提炼，不落盘。')),
  ]);
  const acts = el('div', 'bz-people-cover-acts', [
    button('bz-people-btn', '取消', { 'data-people-lock': 'cancel' }),
    iconButton('unlock', 'bz-people-btn bz-people-btn-acc', { 'data-people-lock': 'unlock' }),
  ]);
  acts.lastElementChild!.appendChild(text(' 解锁保险库'));
  cover.appendChild(acts);
  spread.appendChild(cover);
  const wrap = el('div', 'bz-people-page-wrap', { 'data-people-scroll': 'wrap' }, spread);
  return wrap;
}

/** 空册那枚印上的笑脸：三个部件各自描出来（pathLength=100 把每段归一，快慢才一致） */
function emptyMark(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'bz-people-empty-ico');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const add = (tag: string, attrs: Record<string, string>): void => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    svg.appendChild(n);
  };
  add('circle', { cx: '12', cy: '12', r: '9.4', pathLength: '100' });
  add('path', { d: 'M8 14.3s1.6 2.2 4 2.2 4-2.2 4-2.2', pathLength: '100' });
  add('path', { d: 'M9 9.4h.02', pathLength: '100' });
  add('path', { d: 'M15 9.4h.02', pathLength: '100' });
  return svg;
}

/** 标题一个字一个字写出来（一个字一层遮罩，从左抹到右） */
function writeOut(s: string): HTMLElement {
  return el('div', 'bz-people-empty-title', [...s].map((c, i) => el('span', 'bz-people-w', { style: `--i:${i}` }, text(c))));
}

/** 空册：左边一页全是空位（相册本身），右边那页夹着一张写好的说明纸 */
export function albumEmpty(): HTMLElement {
  const vac: HTMLElement[] = [];
  for (let i = 0; i < AL_PER_PAGE; i++) vac.push(albumVacant());
  const rows: HTMLElement[] = [];
  for (let i = 0; i < vac.length; i += 2) {
    const r = el('div', 'bz-people-row');
    r.append(vac[i], vac[i + 1], el('div', 'bz-people-row-note'));
    rows.push(r);
  }
  const left = el('div', 'bz-people-page', [
    el('div', 'bz-people-page-head', [
      headChip('空册'),
      el('span', 'bz-people-head-label', text('相册簿还是空的')),
      el('span', 'bz-people-head-right', el('span', 'bz-people-head-note', text('空位都留着'))),
    ]),
    albumSleeve(rows),
  ]);
  const right = el('div', 'bz-people-page', [
    el('div', 'bz-people-page-head', [headChip('空册'), el('span', 'bz-people-head-label', text('第一张照片等着贴'))]),
    el('div', 'bz-people-empty', [
      el('div', 'bz-people-empty-mark', emptyMark()),
      writeOut('还没贴一张照片'),
      el('div', 'bz-people-empty-hint', text('打开「数据源」勾选联系人导入，再点「画脸谱」——AI 会为对方修一册脸谱：画像、性格、共同回忆，洗成照片贴进来。聊天原文只在本机提炼，不落盘。')),
      button('bz-people-btn bz-people-btn-acc', '打开数据源', { 'data-people-dialog': 'ds' }),
    ]),
  ]);
  const spread = el('div', 'bz-people-spread', { 'data-people-spread': '' }, [left, albumGutter(), right]);
  return el('div', 'bz-people-page-wrap', { 'data-people-scroll': 'wrap' }, spread);
}

/** 冷读（issue 483；514 重排）：左页 = 居中解密进度卡（大数字 + 细进度条），右页 = 照片墙骨架
 *  （「先不急着看」的洗照片隐喻）。进度由 ui 轮询原位刷新（data-people-load-num / -fill / -total）。 */
export function albumLoad(done: number, total: number | null): HTMLElement {
  const rows: HTMLElement[] = [];
  for (let i = 0; i < AL_PER_PAGE; i += 2) {
    const r = el('div', 'bz-people-row');
    r.append(
      el('div', 'bz-people-cell bz-people-wait', el('div', 'bz-people-print')),
      el('div', 'bz-people-cell bz-people-wait', el('div', 'bz-people-print')),
      el('div', 'bz-people-row-note'),
    );
    rows.push(r);
  }
  const pct = total && total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null;
  const left = el('div', 'bz-people-page', [
    el('div', 'bz-people-page-head', [
      headChip('解密中'),
      el('span', 'bz-people-head-label', text('正在解密联系人数据')),
      el('span', 'bz-people-head-right', el('span', 'bz-people-head-note', text('解密完就摊开'))),
    ]),
    el('div', 'bz-people-empty', [
      el('div', 'bz-people-load-figure', [
        el('span', 'bz-people-load-num', { 'data-people-load-num': '' }, text(String(done))),
        // 分母 span 常驻（清单未读到先只显「位」，paintLoadCount 读到后原位补 `/ N 位`）
        el('span', 'bz-people-load-total', text(total ? `/ ${total} 位` : '位')),
      ]),
      el('div', 'bz-people-load-bar', { 'aria-hidden': 'true' },
        el('div', 'bz-people-load-fill', { 'data-people-load-fill': '', style: `width:${pct ?? 0}%` })),
      el('div', 'bz-people-empty-hint', text(total ? '保库记录逐位解密中——先不急着看，摊开就好。' : '保库记录逐位解密中——清单还在读，先不急着看。')),
    ]),
  ]);
  const right = el('div', 'bz-people-page', [
    el('div', 'bz-people-page-head', [headChip('解密中'), el('span', 'bz-people-head-label', text('解密完就摊开')), el('span', 'bz-people-head-right', el('span', 'bz-people-head-note', text('先不急着看')))]),
    albumSleeve(rows),
  ]);
  const spread = el('div', 'bz-people-spread bz-people-spread-load', { 'data-people-spread': '' }, [left, albumGutter(), right]);
  return el('div', 'bz-people-page-wrap', { 'data-people-scroll': 'wrap' }, spread);
}

/** 总账文案（第一页页眉的小签；空册时也用它） */
export function statsText(people: PersonEntry[]): string {
  const total = people.reduce((s, p) => s + p.imports.reduce((x, r) => x + r.messageCount, 0), 0);
  const faces = people.filter((p) => p.digest).length;
  return people.length ? `${people.length} 位人物 · ${formatCount(total)} 条消息 · ${faces} 张脸谱` : '还没有人物';
}

// ---------------- 详情：对面翻开的那一页 ----------------

export type FoldId = 'p' | 'b' | 'e';

/** 三折的页签名与卷名（其人 / 相交 / 纪事，issue 455 拍板） */
export const FOLD_TITLES: Array<[FoldId, string, string]> = [
  ['p', '其人', '卷一 · 人物画像与代表原话'],
  ['b', '相交', '卷二 · 关系画像'],
  ['e', '纪事', '编年 + 按月交往事件'],
];

/** 详情页一眼账（相纸右边那几张小纸片）：数据不够的项不贴那一片 */
export interface DtFacts {
  /** 谁先开口：我发起的占比 0~100 */
  mePct: number;
  /** 最热的一月 [YYYY-MM, 条数] */
  month: [string, number] | null;
  images: number;
  voices: number;
}

export interface DetailOpts {
  /** 详情翻在哪一侧（点左页的照片 → 详情在右；点右页的 → 详情在左） */
  side: 'left' | 'right';
  fold: FoldId;
  /** 这一折刚换过来 → 正文放进动画（issue 507：505 之后 `.bz-people-in` 没人挂，CSS 白候一版） */
  foldIn?: boolean;
  /** 头像文件路径（空串走首字印） */
  avatar: string;
  /** 当前折的正文（ui 侧用 fold*Body 备好） */
  body: HTMLElement[];
  /** 引擎任务（决定头一个动作是「画脸谱 / 继续生成 / 重新画」） */
  job: FoldCardJob | null;
  facts: DtFacts | null;
}

/** 头上那枚印：待画 / 旧版 / 画谱中 / 画到 + 日期（日期折两行小字，方框里放得下不溢出） */
function stampNode(p: PersonEntry, job: FoldCardJob | null): Node | Node[] {
  const seal = albumSealOf(p, job);
  if (seal.state === 'none') return text('待画');
  if (seal.state === 'legacy') return text('旧版');
  if (seal.state === 'queued' || seal.state === 'running' || seal.state === 'halted') return text('画谱中');
  if (!p.lastProcessedTs) return text('已画');
  const [y, mo, day] = formatDay(p.lastProcessedTs).split('-');
  // 「2026-」/「03-12」两行摆（em 是 block）：日期在窄印里断在连字符上，读起来还是一串
  return [text('画到 '), el('em', undefined, text(`${y}-`)), el('em', undefined, text(`${mo}-${day}`))];
}

function detailFacts(p: PersonEntry, facts: DtFacts): HTMLElement | null {
  const out: HTMLElement[] = [];
  const me = Math.max(0, Math.min(100, Math.round(facts.mePct)));
  const duoVal = el('span', 'bz-people-fact-v');
  duoVal.append(text('我 '), textEl('b', `${me}%`), text(' · TA '), textEl('b', `${100 - me}%`));
  out.push(el('div', 'bz-people-fact', [
    el('span', 'bz-people-fact-k', text('谁先开口')),
    el('span', 'bz-people-fact-bar', el('i', '', { style: `width:${me}%` })),
    duoVal,
  ]));
  if (facts.month) {
    const v = el('span', 'bz-people-fact-v');
    v.append(text(`${facts.month[0]} · `), textEl('b', formatCount(facts.month[1])), text(' 条'));
    out.push(el('div', 'bz-people-fact', [el('span', 'bz-people-fact-k', text('最热的一月')), v]));
  }
  if (facts.images || facts.voices) {
    const v = el('span', 'bz-people-fact-v');
    v.append(text('图 '), textEl('b', formatCount(facts.images)), text(' · 语 '), textEl('b', formatCount(facts.voices)));
    out.push(el('div', 'bz-people-fact', [el('span', 'bz-people-fact-k', text('素材水位')), v]));
  }
  return out.length ? el('div', 'bz-people-dt-facts', out) : null;
}

/** 详情页（对面翻开的那一页）：头顶两栏 + 动作小签 + 三折签 + 纸页 */
export function detailPage(p: PersonEntry, opts: DetailOpts): HTMLElement {
  const name = p.name || p.id;
  const total = p.imports.reduce((s, r) => s + r.messageCount, 0);
  const from = p.imports.map((r) => r.timeFrom).sort()[0] ?? '';
  const to = p.imports.map((r) => r.timeTo).sort().pop() ?? '';
  const page = el('div', `bz-people-page bz-people-dpage bz-people-sit-${opts.side === 'left' ? 'l' : 'r'}`, { 'data-people-detail': p.id });
  const head = el('div', 'bz-people-page-head');
  head.appendChild(el('span', 'bz-people-head-label', text(`脸谱 · ${name}`)));
  head.appendChild(el('span', 'bz-people-head-right',
    button('bz-people-close', '合上这页', { 'data-people-act': 'back' })));
  page.appendChild(head);

  const body = el('div', 'bz-people-pagebody', { 'data-people-scroll': 'detail' });

  // 头顶两栏：宝丽来那张照片靠左贴着，右边放标签 / 账目 / 一眼账
  const frame = el('div', 'bz-people-bigframe', [
    el('div', 'bz-people-tape', { style: '--tr:calc(var(--t2) * -2)' }),
    el('div', 'bz-people-bigphoto', avatarNode(name, opts.avatar)),
    el('div', 'bz-people-dt-stamp', stampNode(p, opts.job)),
    el('div', 'bz-people-bigname', text(name)),
  ]);
  const side = el('div', 'bz-people-dt-side');
  const tags = (p.profile?.tags ?? []).filter(Boolean);
  if (tags.length) side.appendChild(el('div', 'bz-people-dt-tags', tags.map((t) => tagStk(t))));
  const due = dueSoonOf(p);
  if (due) {
    const line = el('div', 'bz-people-due-line');
    line.append(el('i', 'bz-ic', { 'data-lucide': 'gift', 'aria-hidden': 'true' }), el('span', '', text(`${due.what} · ${due.date}（还有 ${due.days} 天）`)));
    side.appendChild(line);
  }
  const meta = el('div', 'bz-people-dt-meta');
  meta.append(
    textEl('b', formatCount(total)), text(' 条消息 · '),
    textEl('span', formatCount(p.imports.length)), text(' 次导入'),
  );
  meta.appendChild(el('br'));
  meta.append(text(p.digest?.generatedAt ? `脸谱生成于 ${p.digest.generatedAt.slice(0, 10)}` : '还没画过脸谱'));
  if (from && to) {
    meta.appendChild(el('br'));
    meta.append(text(`交往 ${from.slice(0, 10)} ~ ${to.slice(0, 10)}`));
  }
  side.appendChild(meta);
  const facts = opts.facts ? detailFacts(p, opts.facts) : null;
  if (facts) side.appendChild(facts);
  body.appendChild(el('div', 'bz-people-dttop', [el('div', 'bz-people-bigph', frame), side]));

  // 动作小签：画谱是主路（第一个），其余是记事 / 数据 / 档案 / 删除 / 查看聊天（issue 529）
  const gen = genActionOf(p, opts.job);
  const acts = el('div', 'bz-people-acts', [
    el('button', 'bz-people-act', { 'data-people-act': 'generate' }, [
      el('i', 'bz-ic', { 'data-lucide': gen.icon, 'aria-hidden': 'true' }),
      el('span', '', text(gen.label)),
      el('span', 'bz-people-act-hint', text(gen.hint)),
    ]),
    el('button', 'bz-people-act', { 'data-people-act': 'note' }, [
      el('i', 'bz-ic', { 'data-lucide': 'import', 'aria-hidden': 'true' }), el('span', '', text('补充素材')),
    ]),
    el('button', 'bz-people-act', { 'data-people-act': 'stats' }, [
      el('i', 'bz-ic', { 'data-lucide': 'bar-chart-3', 'aria-hidden': 'true' }), el('span', '', text('互动统计')),
    ]),
    el('button', 'bz-people-act', { 'data-people-act': 'prof' }, [
      el('i', 'bz-ic', { 'data-lucide': 'contact', 'aria-hidden': 'true' }), el('span', '', text('补充背景')),
    ]),
    el('button', 'bz-people-act', { 'data-people-act': 'del', 'data-people-del': p.id }, [
      el('i', 'bz-ic', { 'data-lucide': 'trash-2', 'aria-hidden': 'true' }), el('span', '', text('删除联系人')),
    ]),
    // issue 529：这里原来是第二枚「合上这页」（与页眉右上角那枚完全重复）——换成聊天入口：
    // 聊天仓里那几万条消息终于有地方看（关页仍走页眉右上角那枚）
    el('button', 'bz-people-act', { 'data-people-act': 'chat' }, [
      el('i', 'bz-ic', { 'data-lucide': 'message-circle', 'aria-hidden': 'true' }), el('span', '', text('查看聊天')),
    ]),
  ]);
  for (const b of Array.from(acts.children)) (b as HTMLButtonElement).type = 'button';
  body.appendChild(acts);

  // 三折签：其人 / 相交 / 纪事
  const tabs = el('div', 'bz-people-ftabs', FOLD_TITLES.map(([id, label]) =>
    button(`bz-people-ftab${opts.fold === id ? ' on' : ''}`, label, { 'data-people-fold': id, 'data-people-leaf-head': id })));
  body.appendChild(tabs);
  const title = FOLD_TITLES.find(([id]) => id === opts.fold)?.[2] ?? '';
  body.appendChild(el('div', 'bz-people-fsheet', [
    el('div', 'bz-people-fsheet-head', el('span', 'bz-people-fsheet-title', text(title))),
    el('div', `bz-people-fsheet-body${opts.foldIn ? ' bz-people-in' : ''}`, opts.body),
  ]));
  page.appendChild(body);
  return page;
}

/** 头一个动作（画脸谱 / 继续生成 / 重新画）：跟着任务态与脸谱水位走 */
function genActionOf(p: PersonEntry, job: FoldCardJob | null): { label: string; hint: string; icon: string } {
  const seal = albumSealOf(p, job);
  if (seal.state === 'running' || seal.state === 'queued' || seal.state === 'halted') {
    return { label: '继续生成', hint: '不从头重烧', icon: 'refresh-cw' };
  }
  if (seal.state === 'drawn' || seal.state === 'legacy') return { label: '补画脸谱', hint: '用新导入的消息', icon: 'paintbrush' };
  return { label: '画脸谱', hint: '用已导入的消息生成', icon: 'paintbrush' };
}

/** 这一行两人的共同点用的标签贴纸（档案页与详情页共用一枚） */
export function tagStk(t: string): HTMLElement {
  const kinds = new Set(['前同事', '大学同学', '室友', '旅伴', '表妹', '游戏搭子']);
  const cls = `bz-people-stk${kinds.has(t) ? ' bz-people-stk-red' : ''}`;
  return el('span', cls, { style: `transform:rotate(${[...t].length % 2 ? 3 : -3}deg)` }, text(t));
}

/** 30 天内有重要日子就返回那一条（照片角上的提醒贴纸与详情页的那行都用它） */
export function dueSoonOf(p: PersonEntry, today = new Date()): { what: string; date: string; days: number } | null {
  const list = p.profile?.importantDates ?? [];
  let best: { what: string; date: string; days: number } | null = null;
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  for (const d of list) {
    const m = /^(\d{2})-(\d{2})$/.exec(String(d.date ?? ''));
    if (!m) continue;
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    if (!(mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31)) continue;
    let when = new Date(base);
    when.setMonth(mm - 1, dd);
    // 月日进位校验（2 月 30 / 平年 2 月 29 这类不存在的日子 setMonth 会静默滚进下个月）：
    // 滚了就跳过——按错误日期倒数比不提醒更糟
    if (when.getMonth() !== mm - 1 || when.getDate() !== dd) continue;
    if (when.getTime() < base) when = new Date(today.getFullYear() + 1, mm - 1, dd);
    const days = Math.round((when.getTime() - base) / 86400000);
    if (days >= 0 && days <= 30 && (!best || days < best.days)) best = { what: d.what, date: d.date, days };
  }
  return best;
}

// ---------------- 折正文（其人 / 相交 / 纪事） ----------------

/** 折内空态提示：一句话说清「这一折为什么还空着」，动作在详情头的画笔钮上 */
export function foldHint(msg: string): HTMLElement {
  return el('div', 'bz-people-empty-hint', text(msg));
}

function secTitle(t: string): HTMLElement {
  return el('div', 'bz-people-sec-title', text(t));
}

/** 一张随手记纸片（纪事折与「记一笔」页签同一张；排序由调用方定）。
 *  `pendingDel`（D 组拍板）：点了「撕掉」等确认的那条——按钮就地换成「撕掉这张？」确认 / 取消。 */
function noteRow(m: ManualEvent, pendingDel = false): HTMLElement {
  const row = el('div', 'bz-people-note-row', [
    el('span', 'bz-people-note-ts', text(m.ts)),
    el('span', 'bz-people-note-sum', text(m.summary)),
  ]);
  if (pendingDel) {
    row.appendChild(el('span', 'bz-people-note-ask', [
      textEl('span', '撕掉这张？'),
      button('bz-people-note-del-ok', '撕掉', { 'data-people-note-del-ok': m.id }),
      button('bz-people-note-del-no', '取消', { 'data-people-note-del-cancel': m.id }),
    ]));
  } else {
    row.appendChild(button('bz-people-note-del', '撕掉', { 'data-people-note-del': m.id }));
  }
  return row;
}

/**
 * 「另有 N 条」的收口（issue 507）：多出来的先收着（`.bz-people-more-hide`），末尾一枚
 * 「…另有 N 条」，点一下原地摊开（ui 侧把收着的摘出来、按钮自己退场）。
 * 六处列表同一套口径：性格特质 / 代表原话 / 最近在聊什么 / 留下的片刻 / 未竟之事 / 同月纪事——
 * 可见条数与原来一模一样，变的是「后面还有的都点得开」。
 */
export function clipList(cls: string, items: HTMLElement[], first: number, moreText: string): HTMLElement {
  const box = el('div', cls);
  items.forEach((n, i) => {
    if (i >= first) n.classList.add('bz-people-more-hide');
    box.appendChild(n);
  });
  if (items.length > first) box.appendChild(button('bz-people-more', moreText, { 'data-people-more': '' }));
  return box;
}

/** 其人折正文（卷一《其人》）：markdown + 性格特质 + 代表原话 + 最近在聊什么 + 留下的片刻 */
export function foldPersonBody(mdRoot: HTMLElement | null, p: PersonEntry): HTMLElement[] {
  const out: HTMLElement[] = [mdRoot ?? foldHint('其人画像还没生成——画一次脸谱就会写出来。')];
  const traits = p.digest?.traits ?? [];
  if (traits.length) {
    out.push(secTitle('性格特质'), clipList(
      'bz-people-traits',
      traits.map((t) => el('span', 'bz-people-trait', text(t))),
      12,
      `…另有 ${traits.length - 12} 条`,
    ));
  }
  const quotes = p.digest?.quotes ?? [];
  if (quotes.length) {
    out.push(secTitle('代表原话'), clipList(
      'bz-people-quotes',
      quotes.map((q) => el('div', 'bz-people-quote-card', [
        el('div', 'bz-people-quote-text', text(`「${q.text}」`)),
        el('div', 'bz-people-quote-meta', text(`${q.who === '我' ? '我' : p.name} · ${q.ts}`)),
      ])),
      8,
      `…另有 ${quotes.length - 8} 条`,
    ));
  }
  const interests = p.digest?.interests ?? [];
  if (interests.length) {
    out.push(secTitle('最近在聊什么'), clipList(
      'bz-people-md bz-people-ints',
      interests.map((t) => el('div', 'bz-people-it', [el('span', 'bz-people-date', text(t.ts)), el('span', '', text(t.topic))])),
      10,
      `…另有 ${interests.length - 10} 条`,
    ));
  }
  const moments = p.digest?.moments ?? [];
  if (moments.length) {
    out.push(secTitle('留下的片刻'), clipList(
      'bz-people-md bz-people-moms',
      moments.map((t) => el('div', 'bz-people-it', [el('span', 'bz-people-date', text(t.ts)), el('span', '', text(t.summary))])),
      6,
      `…另有 ${moments.length - 6} 个片刻`,
    ));
  }
  return out;
}

/** 相交折正文（卷二《相交》）：markdown + 未竟之事 */
export function foldBondBody(mdRoot: HTMLElement | null, p: PersonEntry): HTMLElement[] {
  const out: HTMLElement[] = [mdRoot ?? foldHint('关系画像还没生成——画一次脸谱就会写出来。')];
  const threads = p.digest?.threads ?? [];
  if (threads.length) {
    out.push(secTitle('未竟之事'), clipList(
      // 与另两处同形列表（`bz-people-ints` / `bz-people-moms`）保持一致，给一枚专有类名好让调用方锚定
      'bz-people-md bz-people-thr',
      threads.map((t) => el('div', 'bz-people-it', [el('span', 'bz-people-date', text(t.ts)), el('span', '', text(t.text))])),
      8,
      `…另有 ${threads.length - 8} 条`,
    ));
  }
  return out;
}

/** 纪事折正文：编年时间线在前，按月交往事件（可折）在后，随手记列表收尾；noteDelPending 供撕掉确认回显 */
export function foldEventsBody(p: PersonEntry, noteDelPending: string | null = null): HTMLElement[] {
  const out: HTMLElement[] = [];
  const chron = p.digest?.chronicle ?? '';
  if (chron) {
    out.push(el('div', 'bz-people-chron', miniMarkdown(chron)));
    out.push(el('div', 'bz-people-ev-divider', el('span', '', text('纪事 · 按月'))));
  }
  const events = p.digest?.events ?? [];
  if (events.length) {
    const by = new Map<string, typeof events>();
    for (const e of events) {
      const m = e.ts.slice(0, 7);
      const arr = by.get(m) ?? [];
      arr.push(e);
      by.set(m, arr);
    }
    const months = [...by.keys()].sort();
    const wrap = el('div', 'bz-people-months');
    months.forEach((m) => {
      const evs = [...(by.get(m) ?? [])].sort((a, b) => (a.kind === 'major' ? 0 : 1) - (b.kind === 'major' ? 0 : 1));
      const inner = clipList('bz-people-mon-in', evs.map((e) =>
        el('div', `bz-people-ev${e.kind === 'major' ? ' bz-people-major' : ''}`, [
          el('span', 'bz-people-ev-ts', text(e.ts)),
          el('span', 'bz-people-ev-sum', text(e.summary)),
        ])), 14, `…同月另有 ${evs.length - 14} 条`);
      const head = el('button', 'bz-people-mon-head', { 'data-people-mon': m }) as HTMLButtonElement;
      head.type = 'button';
      head.append(el('span', 'bz-people-mon-plus', text('+')), el('span', 'bz-people-mon-chip', text(m)), el('span', 'bz-people-mon-cnt', text(`${evs.length} 条`)));
      // 默认全收着（复评：首月不再自动展开）；点开的状态留在 DOM 上，滚动不再触发整页重画（turnTo 钉住详情摊）
      wrap.appendChild(el('div', 'bz-people-mon', [head, el('div', 'bz-people-mon-body', inner)]));
    });
    out.push(wrap);
  } else if (!out.length) {
    out.push(foldHint('交往纪事还没生成——画一次脸谱就会排出来。'));
  }
  const manual = p.manualEvents ?? [];
  if (manual.length) {
    out.push(secTitle('随手记'), el('div', 'bz-people-notes', manual.map((m) => noteRow(m, noteDelPending === m.id))));
  }
  return out;
}

// ---------------- 删除三档（issue 500 / 501 / 502 续） ----------------

/**
 * 删除门禁档（issue 500）：按「手上有没有画成的脸谱」分三档——
 *   drawn（已画谱）      = 有画像正文 → 删前重输主密码（不可逆产物，与密文销毁同防护）；
 *   unfinished（画谱未完成）= 无画像但有未完成任务 → 弹确认框二次确认；
 *   undrawn（未画谱）     = 都没 → 弹确认框二次确认。
 * 「有画像」判据：卷一 / 卷二 / 纪事任一有正文。卷一《其人》是必达产物，重画中断不会留下空卷，
 * 所以「有 digest 正文」等价于「手上有一份看得的脸谱」。
 * **只看正文、不看 digest 对象本身**：空壳 digest（字段全空，旧单卷空串那类）不算已画——
 * 不给用户上无谓的密码门。已画谱压过未完成任务：手上那份画像删了不可逆，补画中也要输主密码。
 */
export type DeleteTier = 'undrawn' | 'unfinished' | 'drawn';

/** job 只读 status 一字段（FoldCardJob / JobView 皆可传，免得为判档造一个假件） */
export function deleteTierOf(p: PersonEntry, job?: { status: string } | null): DeleteTier {
  const d = p.digest;
  if (personOf(d) || bondOf(d) || d?.chronicle) return 'drawn';
  return job && job.status !== 'done' ? 'unfinished' : 'undrawn';
}

/** 档案是否至少填了一项（决定档案页内容；issue 487 扩十维后同步覆盖） */
export function profileFilled(prof: PersonProfile | undefined): boolean {
  if (!prof) return false;
  return Boolean(
    prof.tags?.length || prof.birthday?.trim() || prof.nickname?.trim() || prof.metVia?.trim()
    || prof.job?.trim() || prof.personality?.trim() || prof.likes?.length || prof.interests?.length
    || prof.hometown?.trim() || prof.habits?.trim() || prof.quote?.trim() || prof.dislikes?.length
    || prof.recentLife?.trim() || prof.note?.trim() || prof.metAt?.trim()
    || prof.socials?.length || prof.relationships?.length || prof.importantDates?.length,
  );
}

/** 统计弹窗正文（issue 455 自「数据」折迁来）：互动数据卡 + 占位（含导入记录 meta 与旧数据提示） */
export function statsPopBody(card: HTMLElement | null, p: PersonEntry): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (card) out.push(card);
  else if (p.imports.length) {
    // 有导入记录但没有明细统计，分两种：合成记录（452 只带媒体三项，聊天仓没算月度分布）→
    // 画完脸谱落盘时才算得出来；真·旧版数据（无 stats）→ 再导一次即可（issue 454）
    const poolOnly = p.imports.some((r) => r.stats && !r.stats.monthly?.length);
    out.push(el('div', 'bz-people-empty-hint', { 'data-people-data-hint': '' }, text(poolOnly
      ? '这些消息还没画过脸谱——画完脸谱后这里会有完整的互动统计（月度分布 / 回复时延 / 活跃时段）。'
      : '这次导入还没有互动统计（旧版数据）。从数据源再导入一次即可生成。')));
  } else out.push(el('div', 'bz-people-empty-hint', { 'data-people-data-hint': '' }, text('还没有导入记录。')));
  return out;
}

/** 互动数据卡：头行（区间/来源）+ 月度柱图 + 指标行（调用方传已构建的 chart/rows） */
export function insightsCard(range: string, file: string, chart: HTMLElement | null, rows: HTMLElement): HTMLElement {
  const card = el('div', 'bz-people-ins', [
    el('div', 'bz-people-ins-head', [
      el('div', 'bz-people-ins-range', text(range)),
      el('div', 'bz-people-ins-file', text(file)),
    ]),
  ]);
  if (chart) card.appendChild(chart);
  card.appendChild(rows);
  return card;
}

/** 月度柱图（纯 CSS 柱条；月份标签首尾必显、中段抽稀） */
export function monthlyChart(monthly: Array<[string, number]>): HTMLElement | null {
  if (!monthly.length) return null;
  const max = monthly.reduce((a, [, n]) => Math.max(a, n), 0);
  const chart = el('div', 'bz-people-chart');
  for (const [month, n] of monthly) {
    const h = max > 0 ? Math.max(Math.round((n / max) * 100), 4) : 0;
    chart.appendChild(el('div', 'bz-people-col', { title: `${month} · ${n} 条` },
      el('div', 'bz-people-col-bar', { style: `height:${h}%` })));
  }
  const labels = el('div', 'bz-people-chart-labels');
  const step = monthly.length <= 8 ? 1 : Math.ceil(monthly.length / 6);
  monthly.forEach(([month], i) => {
    const show = i === 0 || i === monthly.length - 1 || i % step === 0;
    labels.appendChild(el('span', '', text(show ? month.slice(2) : '')));
  });
  return el('div', undefined, [chart, labels]);
}

/** 指标行（谁主动 / 回复时延 / 活跃时段 / 消息形态）——条形与数值由调用方算好注入 */
export function insRow(label: string, mid: HTMLElement | string, val: string): HTMLElement {
  return el('div', 'bz-people-ins-row', [
    el('span', 'bz-people-ins-label', text(label)),
    typeof mid === 'string' ? el('span', '', text('')) : mid,
    el('span', 'bz-people-ins-val', text(val)),
  ]);
}

export function duoBar(mePct: number, otherPct: number): HTMLElement {
  return el('div', 'bz-people-duo', [
    mePct > 0 ? el('div', 'bz-people-duo-me', { style: `width:${mePct}%` }) : el('div', 'bz-people-duo-me'),
    otherPct > 0 ? el('div', 'bz-people-duo-other', { style: `width:${otherPct}%` }) : el('div', 'bz-people-duo-other'),
  ]);
}

export function hourStrip(hourly: number[]): { strip: HTMLElement; peak: number; total: number } {
  const total = hourly.reduce((a, n) => a + n, 0);
  const max = Math.max(...hourly);
  const strip = el('div', 'bz-people-strip', hourly.map((n, i) => {
    const h = max > 0 && n > 0 ? Math.max(Math.round((n / max) * 100), 6) : 0;
    return el('div', 'bz-people-strip-bar', { style: `height:${h}%`, title: `${i} 点 · ${n} 条` });
  }));
  return { strip, peak: hourly.indexOf(max), total };
}

export function kindChips(kinds: Array<[string, number]>): HTMLElement {
  const total = kinds.reduce((a, [, n]) => a + n, 0);
  return el('div', 'bz-people-kinds', kinds.map(([k, n]) =>
    el('span', 'bz-people-kind', text(`${k} ${formatCount(n)} · ${Math.round((n / total) * 100)}%`))));
}

// ---------------- 档案与随手记（markup） ----------------

/** 档案展示卡：只列填过的字段（issue 487 扩十维，顺序与编辑卡一致） */
export function profileView(prof: PersonProfile | undefined): HTMLElement {
  const rows: HTMLElement[] = [];
  const addRow = (label: string, value: string) => {
    rows.push(el('div', 'bz-people-prof-row', [
      el('span', 'bz-people-prof-label', text(label)),
      el('span', 'bz-people-prof-value', text(value)),
    ]));
  };
  const listText = (arr?: string[]) => (arr ?? []).filter(Boolean).join('、');
  if (prof?.socials?.length) {
    rows.push(el('div', 'bz-people-prof-row', [
      el('span', 'bz-people-prof-label', text('社交账号')),
      el('span', 'bz-people-prof-value', text(prof.socials.map((s) => [s.platform, s.handle].filter(Boolean).join(' ')).filter(Boolean).join(' · '))),
    ]));
  }
  if (prof?.birthday?.trim()) addRow('生日', prof.birthday.trim());
  if (prof?.nickname?.trim()) addRow('称呼', prof.nickname.trim());
  if (prof?.metVia?.trim()) addRow('认识方式', prof.metVia.trim());
  if (prof?.metAt?.trim()) addRow('认识时间', prof.metAt.trim());
  if (prof?.hometown?.trim()) addRow('家乡 / 现居', prof.hometown.trim());
  if (prof?.job?.trim()) addRow('职业', prof.job.trim());
  if (prof?.personality?.trim()) addRow('性格', prof.personality.trim());
  if (prof?.interests?.length) addRow('兴趣爱好', listText(prof.interests));
  if (prof?.habits?.trim()) addRow('作息 / 习惯', prof.habits.trim());
  if (prof?.quote?.trim()) addRow('口头禅', prof.quote.trim());
  if (prof?.likes?.length) addRow('喜欢', listText(prof.likes));
  if (prof?.dislikes?.length) addRow('反感 / 雷点', listText(prof.dislikes));
  if (prof?.recentLife?.trim()) addRow('近况', prof.recentLife.trim());
  if (prof?.relationships?.length) {
    addRow('身边人', prof.relationships
      .map((r) => (r.who && r.relation ? `${r.who}（${r.relation}）` : r.who || r.relation))
      .filter(Boolean)
      .join('、'));
  }
  if (prof?.importantDates?.length) {
    addRow('重要日子', prof.importantDates
      .map((d) => [d.date, d.what].filter(Boolean).join(' '))
      .filter(Boolean)
      .join('、'));
  }
  if (prof?.tags?.length) {
    rows.push(el('div', 'bz-people-prof-row', [
      el('span', 'bz-people-prof-label', text('标签')),
      el('span', 'bz-people-prof-tags', prof.tags.filter(Boolean).map((t) => el('span', 'bz-people-chip', text(t)))),
    ]));
  }
  if (prof?.note?.trim()) addRow('备注', prof.note.trim());
  rows.push(el('div', 'bz-people-prof-actions', [
    button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '编辑档案', { 'data-people-prof-edit': '' }),
    button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', 'AI 补充', { 'data-people-prof-ai': '', title: 'AI 读交往素材推断缺失字段，填进表单待你确认' }),
  ]));
  return el('div', 'bz-people-prof', rows);
}

function profInput(value: string, placeholder: string, attr: [string, string], cls = 'bz-people-input'): HTMLInputElement {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = cls;
  inp.value = value;
  inp.placeholder = placeholder;
  inp.setAttribute(attr[0], attr[1]);
  return inp;
}

export function socialRow(platform: string, handle: string): HTMLElement {
  return el('div', 'bz-people-prof-subrow', [
    profInput(platform, '平台（微信 / 微博…）', ['data-people-prof-social-platform', '']),
    profInput(handle, '账号', ['data-people-prof-social-handle', '']),
    button('bz-people-ico bz-people-ico-sm', '×', { 'data-people-prof-social-del': '', 'aria-label': '删除这条社交账号' }),
  ]);
}

/** 身边人行（issue 487：复用 socials 的行模式与 data 钩子风格）：who + relation */
export function relationRow(who: string, relation: string): HTMLElement {
  return el('div', 'bz-people-prof-subrow', [
    profInput(who, '称呼（如 老妈）', ['data-people-prof-rel-who', '']),
    profInput(relation, '关系（如 母亲）', ['data-people-prof-rel-relation', '']),
    button('bz-people-ico bz-people-ico-sm', '×', { 'data-people-prof-rel-del': '', 'aria-label': '删除这条身边人' }),
  ]);
}

/** 重要日子行（issue 487：复用 socials 的行模式与 data 钩子风格）：date + what */
export function dateRow(date: string, what: string): HTMLElement {
  return el('div', 'bz-people-prof-subrow', [
    profInput(date, '日子（如 05-20 / 每年立冬）', ['data-people-prof-date-date', '']),
    profInput(what, '是什么日子', ['data-people-prof-date-what', '']),
    button('bz-people-ico bz-people-ico-sm', '×', { 'data-people-prof-date-del': '', 'aria-label': '删除这条重要日子' }),
  ]);
}

export function tagChip(t: string): HTMLElement {
  return el('span', 'bz-people-tag-chip', [
    el('span', 'bz-people-prof-tag-text', text(t)),
    button('bz-people-ico bz-people-ico-sm', '×', { 'data-people-prof-tag-del': '', 'aria-label': `删除标签 ${t}` }),
  ]);
}

/** 档案编辑卡：行内增删只动 DOM，点「保存档案」才读全量写盘（issue 487 扩十维） */
export function profileEditor(prof: PersonProfile | undefined): HTMLElement {
  const grid = (label: string, input: HTMLElement) =>
    el('div', 'bz-people-prof-row', [el('span', 'bz-people-prof-label', text(label)), input]);
  /** 数组维度 → 顿号串（编辑态一格格输入，保存时切分） */
  const listText = (arr?: string[]) => (arr ?? []).join('、');
  /** 行组：楷体标签 + 可增行列表（subrow 们）+ 追加钮——加的行由 ui 委托 append 进列表 */
  const group = (label: string, hook: string, addLabel: string, addHook: string, rows: HTMLElement[]): HTMLElement => {
    const list = el('div', 'bz-people-prof-sub', { [hook]: '' }, rows);
    return el('div', 'bz-people-prof-row', [
      el('span', 'bz-people-prof-label', text(label)),
      list,
      button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', addLabel, { [addHook]: '' }),
    ]);
  };
  const socialRows = (prof?.socials ?? []).map((s) => socialRow(s.platform, s.handle));
  const relRows = (prof?.relationships ?? []).map((r) => relationRow(r.who, r.relation));
  const dateRows = (prof?.importantDates ?? []).map((d) => dateRow(d.date, d.what));
  const tagList = el('div', 'bz-people-tag-edit', { 'data-people-prof-tag-list': '' }, (prof?.tags ?? []).map((t) => tagChip(t)));
  const tagInput = profInput('', '加标签…', ['data-people-prof-tag-input', ''], 'bz-people-input bz-people-tag-input');
  return el('div', 'bz-people-prof bz-people-prof-edit', [
    group('社交账号', 'data-people-prof-social-list', '+ 社交账号', 'data-people-prof-add-social', socialRows),
    grid('生日', profInput(prof?.birthday ?? '', 'YYYY-MM-DD 或 MM-DD', ['data-people-prof-field', 'birthday'])),
    grid('称呼', profInput(prof?.nickname ?? '', 'TA 喜欢被怎么称呼', ['data-people-prof-field', 'nickname'])),
    grid('认识方式', profInput(prof?.metVia ?? '', '怎么认识的', ['data-people-prof-field', 'metVia'])),
    grid('认识时间', profInput(prof?.metAt ?? '', '比如 2023 年夏天', ['data-people-prof-field', 'metAt'])),
    grid('家乡 / 现居', profInput(prof?.hometown ?? '', '家乡 · 现居', ['data-people-prof-field', 'hometown'])),
    grid('职业', profInput(prof?.job ?? '', '职业', ['data-people-prof-field', 'job'])),
    grid('性格', profInput(prof?.personality ?? '', '性格特点，一段话', ['data-people-prof-field', 'personality'])),
    grid('兴趣爱好', profInput(listText(prof?.interests), '顿号分隔，如 爬山、摇滚、推理小说', ['data-people-prof-field', 'interests'])),
    grid('口头禅', profInput(prof?.quote ?? '', '口头禅 / 代表句', ['data-people-prof-field', 'quote'])),
    grid('喜欢', profInput(listText(prof?.likes), '顿号分隔：话题 / 送礼参考', ['data-people-prof-field', 'likes'])),
    grid('反感 / 雷点', profInput(listText(prof?.dislikes), '顿号分隔：反感的事 / 雷点', ['data-people-prof-field', 'dislikes'])),
    grid('作息 / 习惯', profInput(prof?.habits ?? '', '作息 / 生活习惯', ['data-people-prof-field', 'habits'])),
    grid('近况', profInput(prof?.recentLife ?? '', '最近在忙什么 / 状态', ['data-people-prof-field', 'recentLife'])),
    group('身边人', 'data-people-prof-rel-list', '+ 身边人', 'data-people-prof-add-rel', relRows),
    group('重要日子', 'data-people-prof-date-list', '+ 重要日子', 'data-people-prof-add-date', dateRows),
    el('div', 'bz-people-prof-row', [
      el('span', 'bz-people-prof-label', text('标签')),
      tagList,
      tagInput,
      button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '+ 标签', { 'data-people-prof-tag-add': '' }),
    ]),
    grid('备注', profInput(prof?.note ?? '', '一句话备注', ['data-people-prof-field', 'note'])),
    el('div', 'bz-people-prof-actions', [
      button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', 'AI 补充', { 'data-people-prof-ai': '', title: 'AI 只填空白字段，填完你可检查再保存' }),
      button('bz-people-btn bz-people-btn-acc bz-people-btn-sm', '保存档案', { 'data-people-prof-save': '' }),
      button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '取消', { 'data-people-prof-cancel': '' }),
    ]),
  ]);
}

/** 补充背景弹窗正文（issue 455 自「档案」折迁来）：编辑态/有档显卡，全空给入口行；AI 补充按钮三态常驻。
 *  leaveConfirm（D 组脏守卫）：确认开着撞上整页重画时把这枚条画出来（常态由 ui 就地插入）。 */
export function profilePopBody(p: PersonEntry, editing: boolean, leaveConfirm = false): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (editing && leaveConfirm) out.push(profLeaveAsk());
  const hasProf = profileFilled(p.profile);
  if (hasProf || editing) out.push(editing ? profileEditor(p.profile) : profileView(p.profile));
  if (!hasProf && !editing) {
    out.push(el('div', 'bz-people-prof-entry bz-people-prof-entry-solo', [
      el('span', 'bz-people-prof-entry-hint', text('聊天之外的也可以记：')),
      button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '补人物档案', { 'data-people-prof-new': '' }),
      button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', 'AI 补充', { 'data-people-prof-ai': '', title: 'AI 读交往素材推断档案，填进表单待你确认' }),
    ]));
  }
  return out;
}

// ---------------- 册页弹窗（issue 505：弹窗不再浮层，是册子里翻出来的一页） ----------------

/** 册页弹窗外壳：页眉（标题 + 元信息 + 合上这页）+ 可滚正文 + 页脚 */
export interface SubPageOpts {
  /** 靠人的页翻到详情那一侧；单页（数据源 / 画谱确认 / 找一找）摊满整册 */
  side?: 'left' | 'right';
  title: string;
  meta?: string;
  /** 页眉右上的额外动作（数据源页的「同步 / 停止」） */
  head?: HTMLElement[];
  /** 页脚（勾选总账 / 导入按钮那一整块） */
  foot?: HTMLElement | null;
  /** 页根钩子名（ui 的 data 委托据此认页） */
  hook: string;
}

export function subPage(opts: SubPageOpts, body: HTMLElement[]): HTMLElement {
  const cls = ['bz-people-page', 'bz-people-dpage', 'bz-people-sub', opts.side ? `bz-people-sit-${opts.side === 'left' ? 'l' : 'r'}` : ''].filter(Boolean).join(' ');
  const page = el('div', cls, { 'data-people-sub': opts.hook });
  const head = el('div', 'bz-people-page-head');
  head.appendChild(el('span', 'bz-people-head-label', text(opts.title)));
  if (opts.meta) head.appendChild(el('span', 'bz-people-head-note', text(opts.meta)));
  const right = el('span', 'bz-people-head-right');
  for (const n of opts.head ?? []) right.appendChild(n);
  right.appendChild(button('bz-people-close', '合上这页', { 'data-people-close': '' }));
  head.appendChild(right);
  page.appendChild(head);
  page.appendChild(el('div', 'bz-people-pagebody', { 'data-people-scroll': 'pop' }, body));
  if (opts.foot) page.appendChild(opts.foot);
  return page;
}

/**
 * 数据源册页：路径行 + 通知行 + 同步条 + 逐行勾选（含导入水位）+ 图例，
 * 页脚是勾选总账与「导入所选」（D 组拍板：页脚「画脸谱」退役——画谱从详情页动作列 / 印章逐人发起）。
 */
export function dsPage(s: DsModalState): HTMLElement {
  const body: HTMLElement[] = [];
  body.push(el('div', 'bz-people-ds-path', text(`${s.dataDir}${s.scannedAt ? ` · 扫描于 ${s.scannedAt}` : ''}`)));
  if (s.notice) body.push(el('div', 'bz-people-notice bz-people-ds-notice', { 'data-people-ds-notice': '' }, text(s.notice)));
  if (s.sync) body.push(dsSyncLineNode(s.sync));
  if (!s.rows) {
    // 空态按状态分支（B 组审查 P3）：扫描进行中别再说「还没扫描」；未配置数据根要指路设置
    body.push(el('div', 'bz-people-empty-hint', text(s.desktopOnly
      ? '数据源导入仅桌面端支持（要读库外文件夹）——手机 / 平板上仍可查看已画好的脸谱。'
      : s.scanning
        ? '正在扫描联系人目录…'
        : !s.dataDir
          ? '还没扫描。到「设置 → 脸谱 → 数据源」粘贴数据根目录路径，再点右上「同步」。'
          : '还没扫描。点右上「同步」从微信取数，或等同步完成后自动刷新。')));
  } else {
    // 过滤框（D 组拍板）：复用找一找的 findbox 结构与样式口径；只裁显示不动勾选
    const fbox = el('div', 'bz-people-findbox');
    fbox.appendChild(el('i', 'bz-ic', { 'data-lucide': 'search', 'aria-hidden': 'true' }));
    const finp = document.createElement('input');
    finp.className = 'bz-people-input';
    finp.value = s.filter;
    finp.setAttribute('data-people-ds-filter', '');
    finp.setAttribute('placeholder', '按名字过滤联系人…');
    fbox.appendChild(finp);
    if (s.filter.trim()) fbox.appendChild(iconButton('x', 'bz-people-ico bz-people-ico-sm', { 'data-people-ds-filter-clear': '', 'aria-label': '清空过滤' }));
    body.push(fbox);
    if (!s.rows.length) {
      // 扫过但没人，分两种说：没填过滤字 = 目录里真没扫到人；填了 = 过滤无结果
      body.push(el('div', 'bz-people-empty-hint', text(s.filter.trim()
        ? `没匹配「${s.filter.trim()}」的联系人——清掉过滤字再看全名单。`
        : '这个目录里没有扫到联系人——确认微信已登录、同步已完成，或数据根目录选对了。')));
    } else {
      const list = el('div', 'bz-people-ds-list', { 'data-people-ds-list': '' });
      for (const r of s.rows) list.appendChild(dsRow(r, s.selected.includes(r.name), s.groupEnabled === true));
      body.push(list);
      const legend = el('div', 'bz-people-ds-legend');
      legend.append(
        el('span', '', [el('i', 'bz-people-ds-dot-ok'), text('有更新')]),
        el('span', '', [el('i', 'bz-people-ds-dot-idle'), text('已导无更新')]),
        el('span', '', [el('i', 'bz-people-ds-dot-none'), text('未导入')]),
      );
      if (s.rows.some((r) => (r.newCount ?? 0) > 0)) {
        legend.appendChild(button('bz-people-ds-pickfresh', '勾有更新的', { 'data-people-ds-pickfresh': '' }));
      }
      body.push(legend);
    }
  }
  const foot = el('div', 'bz-people-pop-foot');
  foot.appendChild(el('span', 'bz-people-ds-count', { 'data-people-ds-count': '' }, text(footerLabel(s))));
  foot.appendChild(el('span', 'bz-people-spacer'));
  const imp = button('bz-people-btn bz-people-btn-acc', s.importing ? '导入中…' : '导入所选', { 'data-people-ds-import': '' });
  if (s.importing || s.syncing) imp.setAttribute('disabled', '');
  foot.appendChild(imp);
  // 右上角动作位（issue 465）：语义从「重读目录」升级为「同步——从微信重新取数」；
  // 运行中该位置只出「停止」，绝不与「同步」并列——互斥动作不并列。导入中同理禁点
  // （导入循环在读写数据根，同步工具同时写会撞半截产物——双向守卫的渲染半边）
  const head: HTMLElement[] = [];
  head.push(s.syncing
    ? button('bz-people-btn bz-people-btn-sm', '停止', { 'data-people-ds-sync-stop': '', title: '停止同步——已导出的部分保留，重跑可续传' })
    : button('bz-people-btn bz-people-btn-sm', '同步', {
        'data-people-ds-sync': '',
        title: '从微信重新解密并导出，需要微信已登录',
        ...(s.importing ? { disabled: '', title: '正在导入所选——等导入完成再同步' } : {}),
      }));
  const meta = s.syncing
    ? '正在同步…'
    : s.scanning
      ? '正在扫描…'
      : s.rows
        ? (s.filter.trim()
          ? `${s.rows.length} / 共 ${s.totalRows} 位` // 过滤中（D 组）：N / 总 M 位
          : `${s.rows.length} 位联系人${s.hiddenGroups ? ` · ${s.hiddenGroups} 个群聊未纳入` : ''}`)
        : '';
  return subPage({ title: '数据源', meta, head, foot, hook: 'ds' }, body);
}

/**
 * 画谱开工单（issue 497：两次确认合一；513：改行式清单；523：只报素材；
 * 530：报账补全——一张「这一趟会动什么」的账单）。
 *
 * 版式按用户拍板的示意图（530）：四组一条流水线，一组之内一行一项；
 * 每行 = 名称（灰）+ 本次工作量（深）+ 右侧「· 另一笔数」。
 * 尾部朱红 = 这条素材线自己的另一笔数（待 LLM 校对 / 已描述）；
 * 尾部灰 = 仓的口径提示（仓内共 N 条），「有些灰、有些红」是示意图里的定法。
 * 用户拍板：**没有序号圆章**（别自作聪明铺行号）；**全为 0 的整行不出**；
 * 不要灰字小字、不要额外说明；按钮只留一枚「开始生成」
 * （反悔走右上「合上这页」，与取消是同一条路）。
 */
export function genPage(info: GenerationConfirmInfo): HTMLElement {
  const body: HTMLElement[] = [];
  const num = (v: number): string => v.toLocaleString('en-US'); // 1,289 / 20,773；两位数以内原样

  if (info.empty) {
    const who = info.skipped?.length ? `「${info.skipped.join('」「')}」` : '这些联系人';
    body.push(el('div', 'bz-people-gen-none', text(`${who}没有新消息，也没有待描述 / 待转写 / 待校对的素材，无需重新生成。`)));
    body.push(el('div', 'bz-people-gen-actions', [
      button('bz-people-btn bz-people-btn-acc', '开始生成', { 'data-people-gen-start': '', disabled: '' }),
    ]));
    return subPage({ title: '开始生成脸谱', hook: 'gen' }, body);
  }

  /** 一行；`zero` = 这一行上的数全为 0（那就不出——用户拍板不为「0」占一行）。
   *  `tail` = 尾部另一笔数，`scope` = 那笔数只是仓的口径提示（灰），否则朱红。
   *  行里没有序号：用户拍板「去掉编号」。 */
  const row = (zero: boolean, name: string, value: string, tail = '', scope = false): HTMLElement | null => {
    if (zero) return null;
    return el('div', 'bz-people-gen-row', [
      el('span', 'bz-people-gen-k', text(name)),
      el('span', 'bz-people-gen-v', text(value)),
      ...(tail
        ? [el('span', `bz-people-gen-tail${scope ? ' bz-people-gen-tail-s' : ''}`, text(`· ${tail}`))]
        : []),
    ]);
  };
  const group = (title: string, rows: Array<HTMLElement | null>): void => {
    const out = rows.filter((r): r is HTMLElement => r !== null);
    if (!out.length) return; // 这一组一行都没出 → 连组名也不铺
    body.push(el('div', 'bz-people-gen-group', text(title)));
    body.push(el('div', 'bz-people-gen-rows', out));
  };

  group('本趟要处理的素材', [
    row(!info.voices && !info.voiceProofread, '微信语音条',
      `${num(info.voices)} 条待转写`, info.voiceProofread ? `${num(info.voiceProofread)} 条待 LLM 校对` : ''),
    row(!info.images && !info.imagesDescribed, '图片',
      `${num(info.images)} 张待描述`, info.imagesDescribed ? `${num(info.imagesDescribed)} 张已描述` : ''),
    row(!info.materials && !info.materialsTotal, '聊天记录',
      `${num(info.materials)} 条`, info.materialsTotal ? `仓内共 ${num(info.materialsTotal)} 条` : '', true),
    row(!info.recs && !info.recProofread, '录音',
      `${num(info.recs)} 条`, info.recProofread ? `${num(info.recProofread)} 条待校对` : ''),
    row(!info.mediaFail, '源图损坏/缺失', `${num(info.mediaFail)} 张`),
  ]);
  group('中间工序', [
    row(false, '并仓', ''),
    row(!info.batches, '采集提炼', `${num(info.batches)} 批`),
  ]);
  group('重画', [
    row(false, '三卷', '《其人》《相交》《纪事》'),
    row(false, '补充背景', '十维档案回填'),
  ]);
  group('落盘', [row(false, '账', '')]);

  body.push(el('div', 'bz-people-gen-actions', [
    button('bz-people-btn bz-people-btn-acc', '开始生成', { 'data-people-gen-start': '' }),
  ]));
  return subPage({ title: '开始生成脸谱', hook: 'gen' }, body);
}

/** 互动统计册页 */
export function statsPage(p: PersonEntry, body: HTMLElement[]): HTMLElement {
  return subPage({ title: '互动统计', meta: p.name, hook: 'stats' }, body);
}

/** 补充背景册页 */
export function profPage(p: PersonEntry, body: HTMLElement[], editing: boolean): HTMLElement {
  return subPage({ title: '补充背景', meta: editing ? `${p.name} · 编辑中` : p.name, hook: 'prof' }, body);
}

/**
 * 档案脏守卫确认条（D 组拍板）：「改动还没保存——放弃？」+ 放弃 / 继续编辑。
 * 多数时候由 ui 就地插入（不整页重画，编辑卡的未保存值得以保留）；整页重画若撞上
 * 确认开着（profLeaveConfirm），profilePopBody 也会把这枚条画出来，两路同一份 markup。
 */
export function profLeaveAsk(): HTMLElement {
  return el('div', 'bz-people-prof-leaveask', [
    el('span', 'bz-people-prof-leaveask-tx', text('改动还没保存——放弃？')),
    el('span', 'bz-people-prof-leaveask-acts', [
      button('bz-people-btn bz-people-btn-sm bz-people-btn-danger', '放弃', { 'data-people-prof-leave-ok': '' }),
      button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '继续编辑', { 'data-people-prof-leave-cancel': '' }),
    ]),
  ]);
}

// ---------------- 设置行 markup ----------------

/** 「我的头像」设置行展示态（issue 529；来源判定在 me-avatar.ts，这里只摆 markup） */
export interface MyAvatarRowState {
  /** 预览图（data URL / 库内相对路径；空 = 首字印） */
  url: string;
  source: 'custom' | 'wechat' | 'none';
  /** 数据根没配（微信那档连影子都摸不到——文案里指路） */
  noDataRoot?: boolean;
}

/** 来源那一句话（如实说清「现在用的是哪张」，别让用户猜） */
function myAvatarSourceText(s: MyAvatarRowState): string {
  if (s.source === 'custom') return '当前：自定义图片（存在 vault 的 CONFIG/FACES/我 里）';
  if (s.source === 'wechat') return '当前：微信数据里扒出来的本人头像';
  return s.noDataRoot
    ? '当前：还没设置——先配好数据根再同步，或者直接传一张'
    : '当前：还没设置——跑一次同步就能拿到微信里的本人头像，也可以直接传一张';
}

/** 「我的头像」设置行：预览 + 上传 / 恢复默认（交互在 settings.ts） */
export function myAvatarRow(s: MyAvatarRowState): HTMLElement {
  const box = el('div', 'bz-people-setava', { 'data-people-setava': '' });
  box.appendChild(s.url
    ? el('img', 'bz-people-setava-img', { src: avatarUri(s.url), alt: '我的头像' })
    : el('span', 'bz-people-setava-txt', text('我')));
  const col = el('div', 'bz-people-setava-col');
  col.appendChild(el('div', 'bz-people-setava-hint', text(myAvatarSourceText(s))));
  col.appendChild(el('div', 'bz-people-setava-acts', [
    // 组件库按钮（设置面板的控件基线；面板是本行唯一消费面——ADR-0153 起原生设置页只留跳转）
    button('bz-btn bz-btn--primary bz-btn--sm', '上传图片…', { 'data-people-setava-pick': '' }),
    button('bz-btn bz-btn--ghost bz-btn--sm', '恢复默认', { 'data-people-setava-reset': '' }),
  ]));
  box.appendChild(col);
  return box;
}

// ---------------- 会话流（issue 529：详情页「查看聊天」与录音「查看轮次」共用一份） ----------------

/**
 * 会话流的一条（微信式：头像 + 气泡，我方靠右绿气泡）。
 * 数据侧原料 = `chat.ts` 的 `ChatLineData`——渲染层不剥标签、不算时间，只摆 markup。
 */
export interface ChatLine {
  /** 稳定键（聊天页给 data 钩子认条；录音轮次不带） */
  key?: string;
  /** 我方（右侧绿气泡） */
  me: boolean;
  /** 头像图（data URL / vault 路径；空 = 首字印） */
  avatar: string;
  /** 首字印与 alt 用的名字（「我」/ 联系人 / 群成员） */
  who: string;
  /** 群聊里气泡上方那行名字（空 = 不显——单聊不写名，微信同款） */
  name?: string;
  /** 媒体标签（`[图片]` 这类，含方括号；空 = 纯文本） */
  tag?: string;
  /** 气泡正文（图片描述 / 语音转写 / 回复内容；可空） */
  text: string;
  /** 时间分隔条文案（空串 = 不出条） */
  sep?: string;
  /** 旁音轮（不进仓的留档轮：淡出显示，供复核我们没误杀） */
  side?: boolean;
}

export interface ChatStreamOpts {
  /** 顶部一行说明（录音轮次：「逐轮时间轴 · N 轮 · 并成 M 段」） */
  head?: string;
  /** 顶部「更早的消息」入口（聊天页专用；null / 缺省 = 没有更早） */
  more?: HTMLElement | null;
  /** 列表空态文案（缺省不出空态块） */
  empty?: string;
}

/**
 * 会话流列表（两个上屏面共用：详情页「查看聊天」页 + 录音页签「查看轮次」）。
 * 观感照微信：气泡带小尖角、时间分隔条居中淡出、群聊才在气泡上方写发送者名。
 */
export function chatStream(lines: ChatLine[], opts: ChatStreamOpts = {}): HTMLElement {
  const box = el('div', 'bz-people-chat');
  if (opts.head) box.appendChild(el('div', 'bz-people-chat-head', text(opts.head)));
  if (opts.more) box.appendChild(opts.more);
  const list = el('div', 'bz-people-chat-list', { 'data-people-chat-list': '' });
  if (!lines.length && opts.empty) list.appendChild(el('div', 'bz-people-empty-hint', text(opts.empty)));
  for (const l of lines) {
    if (l.sep) list.appendChild(el('div', 'bz-people-chat-sep', el('span', '', text(l.sep))));
    const row = el('div', `bz-people-chat-row${l.me ? ' me' : ''}${l.side ? ' side' : ''}${l.name ? ' named' : ''}`);
    row.appendChild(el('div', 'bz-people-chat-ava', avatarNode(l.who || (l.me ? '我' : '?'), l.avatar)));
    const col = el('div', 'bz-people-chat-col');
    if (l.name) col.appendChild(el('div', 'bz-people-chat-who', text(l.name)));
    const bub = el('div', 'bz-people-chat-bub');
    if (l.tag) {
      const chip = el('span', 'bz-people-chat-tag');
      const icon = chatTagIcon(l.tag);
      if (icon) chip.appendChild(el('i', 'bz-ic', { 'data-lucide': icon, 'aria-hidden': 'true' }));
      chip.appendChild(text(l.tag));
      bub.appendChild(chip);
    }
    if (l.text) bub.appendChild(el('span', 'bz-people-chat-tx', text(l.text)));
    if (!l.tag && !l.text) bub.appendChild(el('span', 'bz-people-chat-tx', text('（空消息）')));
    col.appendChild(bub);
    row.appendChild(col);
    list.appendChild(row);
  }
  box.appendChild(list);
  return box;
}

/** 「更早的消息」哨兵（点一下 / 进视口都放一页；ui 侧挂 IO）。
 *  真 button（不是 div + role）：键盘 Enter / 空格照旧可点，焦点环与宿主基线一套走。 */
export function chatMoreBar(hidden: number): HTMLElement {
  return el('button', 'bz-people-chat-more', { 'data-people-chat-more': '', type: 'button' },
    text(hidden > 0 ? `更早的消息（还有 ${formatCount(hidden)} 条）` : '更早的消息'));
}

/** 聊天页展示态（ui 侧备好；lines 时间升序，最后一条 = 最新） */
export interface ChatViewState {
  /** 联系人称呼（页眉 meta） */
  name: string;
  /** 已上屏的行 */
  lines: ChatLine[];
  /** 聊天仓时间线总条数（页脚只读行报数用） */
  total: number;
  /** 上面还有更早的（出「更早的消息」哨兵） */
  hasMore: boolean;
  /** 正在读保库记录（首屏） */
  loading: boolean;
  /** 读不了的原因（上锁 / 记录损坏；空 = 正常） */
  error?: string;
}

/**
 * 聊天记录册页（issue 529）：仿微信聊天页——会话流铺满，页脚是只读说明 + 「回到最新」。
 * 只有读得到聊天仓的人才翻得开；分页（一页 50 条、往上长）由 ui 侧的状态驱动，这里只管画。
 */
export function chatPage(s: ChatViewState): HTMLElement {
  const body: HTMLElement[] = [];
  if (s.loading) {
    body.push(el('div', 'bz-people-empty-hint', text('正在读聊天记录…')));
  } else if (s.error) {
    body.push(el('div', 'bz-people-empty-hint', text(s.error)));
  } else if (!s.total) {
    body.push(el('div', 'bz-people-empty-hint', text('聊天仓里还没有这个人的消息——先在「补充素材」里补几笔，或到数据源导入微信记录。')));
  } else {
    body.push(chatStream(s.lines, {
      more: s.hasMore ? chatMoreBar(s.total - s.lines.length) : null,
      empty: '这一页没有可显示的消息。',
    }));
  }
  const foot = el('div', 'bz-people-chat-bar');
  foot.appendChild(el('div', 'bz-people-chat-readonly', text(
    s.total ? `只读 · 来自微信导入的聊天记录 · 共 ${formatCount(s.total)} 条` : '只读 · 来自微信导入的聊天记录',
  )));
  if (s.lines.length) foot.appendChild(button('bz-people-chat-jump', '回到最新', { 'data-people-chat-bottom': '' }));
  return subPage({ title: '聊天记录', meta: s.name, hook: 'chat', foot }, body);
}

// ---------------- 补充素材册页（issue 509 / ADR-0212：文本 / 图片 / 录音三页签） ----------------

export type SuppTab = 'text' | 'image' | 'rec';

const SUPP_TABS: Array<[SuppTab, string, string]> = [
  ['text', '记一笔', '随手记一件事'],
  ['image', '留影', '补画谱素材图'],
  ['rec', '原声', '通话 / 见面录音'],
];

/** 待落盘的图片（页内暂存，ui 层持有） */
export interface SuppImageQueueItem {
  /** 原文件绝对路径（落盘复制的源） */
  path: string;
  name: string;
  /** 归属时间戳毫秒（默认 mtime，页内可改） */
  ts: number;
  /** 归属：true = 对方发的（默认），false = 我发的 */
  peer: boolean;
}

export interface SuppImageViewState {
  queue: SuppImageQueueItem[];
  /** 聊天仓已有图片总数（type=3 且 img 有值） */
  imported: number;
  /** 其中未描述的（img 有值、text 空——不进时间线）。**不含三种终态标注的**（那是终态不欠账，ADR-0224/0225） */
  undescribed: number;
  /** 源图损坏 / 缺失、已标终态跳过的张数（ADR-0225）——如实上屏，别让 304 变成神秘数字 */
  broken: number;
  missing: number;
  /** 描述动作进行中（引擎 describe 段在跑） */
  describeBusy: boolean;
  modelLabel: string;
  /** 已入库的留影（预览网格；新的在前。url 由 ui 侧按数据根拼好）。
   *  分片口径（issue 519）：只装**已渲染的前段**——千张级全量把 data URL 一次拉齐是
   *  开页冻死的病根，ui 侧按 shown 切片，`hidden` = 尚未渲染的张数（>0 出「还有 N 张」哨兵）。
   *  `skip` = 该图的终态标注（ADR-0224 敏感 / ADR-0225 源图损坏·缺失）。敏感是启发式判定，
   *  格子上给「解除」入口（没有撤回入口的错杀不可挽回）；损坏 / 缺失是磁盘事实、无解除入口。 */
  items: Array<{ img: string; text: string; url: string; skip?: DescSkip; label?: string }>;
  /** 未渲染的留影张数（0 = 全量已铺完，无哨兵） */
  hidden: number;
  /** 点了叉、等二次确认的那张（img 相对路径；复评点名要问一声） */
  imgDel?: string;
}

export type SuppRecRowStatus = 'pending' | 'queued' | 'running' | 'interrupted' | 'failed' | 'awaiting-merge' | 'merged';

export interface SuppRecRowState {
  file: string;
  status: SuppRecRowStatus;
  /** 状态行文案（如 声纹窗 3000/10984 · 转写 12/579） */
  phaseText: string;
  pct: number | null;
  /** 当前阶段（running 态；与 recording.recordingStageOf 的 RecordingStage 同构字面量——
   *  render 纯度守卫不引驱动层，两处联合类型须同步改） */
  stage?: 'load' | 'vad' | 'voiceprint' | 'transcribe';
  /** 已耗时人话（running 态：45s / 3m12s） */
  elapsed?: string;
  /** 质心模式诊断（处理过才有；dual 不显） */
  mode?: string;
  /** 已切轮数（sidecar 有 turns 才有） */
  turns?: number;
  /** 已滤掉的旁音轮数（ADR-0216；留账不进仓，可「查看轮次」复核） */
  sideSpeaks?: number;
  /** 排队位次（queued 态；1 = 下一个跑） */
  queuePos?: number;
  /** 起点毫秒（一等数据，ADR-0217；行上显示/可改） */
  startMs?: number;
  errText?: string;
  /**
   * 源文件已不在磁盘（issue 528）：只剩仓里 `rec:<文件名>:*` 轮次。
   * 行集合必须是「磁盘文件 ∪ 仓内已并入文件名」——只按磁盘列行的话，文件被外部删掉后
   * 行随文件一起消失，**删除入口也没了**，而 storeStatsOf 还在数仓里那些轮次：
   * 统计永远退不掉、还一直进画谱素材（大琳删了 .aac，录音仍报 410 条）。
   * 渲染口径：徽章「源已失」；不给改起点 / 查看轮次（原件与 sidecar 都不在了）；删除照给。
   */
  orphan?: boolean;
}

/**
 * 录音导入队列项（选文件 → 确认起点 → 落盘；ADR-0217「起点是一等数据」）。
 * `startMs` 为 null = 必填未填（渲染标红，导入时拦下）——**不许静默回落 mtime**。
 */
export interface SuppRecQueueItem {
  /** 原文件绝对路径（落盘复制的源） */
  path: string;
  name: string;
  /** 源文件字节 sha256（判重；null = 算不出，按放行处理） */
  sha256: string | null;
  /** 起点毫秒（null = 待填；用户确认过的值才落库） */
  startMs: number | null;
  /** 候选起点（相对时间信息反推；点一下即填） */
  candidates: number[];
  /** 与库里已有录音同内容（sha256 命中）→ 导入时跳过 */
  dupOf?: string;
  /** 归属抽检存疑（issue 516 Q15）：听不出「我」或该联系人的声音 → 默认跳过，要导得点「仍然导入」 */
  suspect?: boolean;
  /** 存疑但用户点了「仍然导入」 */
  keep?: boolean;
  /** 抽检还没跑完（在跑 check 进程） */
  checking?: boolean;
}

export interface SuppRecViewState {
  rows: SuppRecRowState[];
  /** 声纹参考（质心）就绪态 */
  ref: 'ready' | 'missing' | 'building';
  /** 「重建质心」二次确认开着（复评：覆盖式重跑要先问一声） */
  refConfirm?: boolean;
  /** 本次待导入的录音（选完文件、还没落盘） */
  queue: SuppRecQueueItem[];
  /** 删除二次确认开着的那一行（issue 516 Q12/Q13；null = 没开） */
  del?: { file: string; alsoFile: boolean; drawn: boolean };
  /** 正在改起点的那一行（ADR-0217：改完回写 meta，已并仓的同步重排绝对时间） */
  startEdit?: string;
  /** 「查看轮次」正在看的那条（读 sidecar 预览，含被滤的旁音轮——复核我们没误杀） */
  turnsView?: { file: string; lines: SuppRecTurnLine[]; meAvatar: string; otherAvatar: string };
  /** 库里已有的疑似重复组（同内容不同名；issue 516 Q3——只报不清，删不删你说了算） */
  dupGroups?: string[][];
}

/** 逐轮时间轴的展示行（`<名>.turns.md` 的面板预览；ADR-0217） */
export interface SuppRecTurnLine {
  idx: number;
  /** 绝对时刻（起点 + 轮内偏移，`10:14:03`） */
  at: string;
  /** 轮内起止（`03:02-03:07`） */
  range: string;
  speaker: string;
  emotion?: string;
  text: string;
  /** 旁音轮（不进聊天仓，仅留档复核） */
  side: boolean;
  /** 段首轮的段序（1 起；ADR-0220 §7——进仓就是这一段一条消息）。非段首不带 */
  segHead?: number;
  /** 与上一行同属一段（段内后续轮） */
  segCont?: boolean;
}

const SUPP_REC_LABEL: Record<SuppRecRowStatus, string> = {
  pending: '待处理',
  queued: '排队中',
  running: '转写中',
  interrupted: '已中断',
  failed: '失败',
  'awaiting-merge': '待并仓',
  merged: '已并入',
};

/** 录音处理阶段链（issue 511；展示单源——key 与 recording.RecordingStage 同构） */
const SUPP_REC_STAGES: Array<{ key: SuppRecRowState['stage'] & string; label: string }> = [
  { key: 'load', label: '启动模型' },
  { key: 'vad', label: 'VAD 切窗' },
  { key: 'voiceprint', label: '声纹分离' },
  { key: 'transcribe', label: '逐轮转写' },
];

/** 阶段名（ui 拼 running 文案用：progress.text 缺席时兜底「<阶段名>…」） */
export function suppRecStageLabel(key: SuppRecRowState['stage'] & string): string {
  return SUPP_REC_STAGES.find((s) => s.key === key)?.label ?? key;
}

/** 阶段链行：`启动模型 → VAD 切窗 → 声纹分离 → 逐轮转写`（骨架在此、上色单源 applyRecStageChain） */
function recStageChain(cur: NonNullable<SuppRecRowState['stage']>): HTMLElement {
  const chain = el('div', 'bz-people-supp-stagechain', { 'data-rec-chain': '' });
  SUPP_REC_STAGES.forEach((s, i) => {
    if (i) chain.appendChild(el('span', 'bz-people-supp-stage-sep', text('→')));
    chain.appendChild(el('span', 'bz-people-supp-stage', { 'data-stage-key': s.key }, text(s.label)));
  });
  applyRecStageChain(chain, cur);
  return chain;
}

/** 轮询帧的链高亮原位刷新（ui tick 调；只动 class，不重建 DOM） */
export function applyRecStageChain(chain: HTMLElement, cur: NonNullable<SuppRecRowState['stage']>): void {
  const curIdx = SUPP_REC_STAGES.findIndex((s) => s.key === cur);
  chain.querySelectorAll<HTMLElement>('[data-stage-key]').forEach((sEl) => {
    const i = SUPP_REC_STAGES.findIndex((s) => s.key === sEl.getAttribute('data-stage-key'));
    if (i < 0) return;
    sEl.className = i === curIdx ? 'bz-people-supp-stage on' : i < curIdx ? 'bz-people-supp-stage done' : 'bz-people-supp-stage';
  });
}

/** 补充素材页（原「记一笔」扩容；hook 沿用 'note'——ui 的委托面不变）；noteDelPending 供撕掉确认回显 */
export function suppPage(p: PersonEntry, tab: SuppTab, image: SuppImageViewState, rec: SuppRecViewState, today: string, noteDelPending: string | null = null): HTMLElement {
  const body: HTMLElement[] = [];
  body.push(el('div', 'bz-people-ftabs bz-people-supp-tabs', SUPP_TABS.map(([id, label, hint]) =>
    button(`bz-people-ftab${tab === id ? ' on' : ''}`, label, { 'data-people-supp-tab': id, title: hint }))));
  if (tab === 'text') {
    body.push(noteAddRow(today));
    // 已记的几笔就列在下面（复评：就地管理，不用翻到纪事折里找）——新的在上
    const notes = [...(p.manualEvents ?? [])].sort((a, b) => b.ts.localeCompare(a.ts));
    body.push(el('div', 'bz-people-supp-stat', text(
      notes.length ? `已记 ${notes.length} 笔` : '还没记过——上面写一条，就落在这一列。',
    )));
    if (notes.length) {
      body.push(el('div', 'bz-people-notes bz-people-supp-notes', notes.map((m) => noteRow(m, noteDelPending === m.id))));
    }
  } else if (tab === 'image') {
    body.push(...suppImageBody(image));
  } else {
    body.push(...suppRecBody(rec));
  }
  return subPage({ title: '补充素材', meta: p.name, hook: 'note' }, body);
}

function suppImageBody(s: SuppImageViewState): HTMLElement[] {
  const out: HTMLElement[] = [];
  out.push(el('div', 'bz-people-supp-acts', [
    button('bz-people-btn bz-people-btn-acc bz-people-btn-sm', '选图片…', { 'data-people-supp-img-pick': '' }),
  ]));
  if (s.queue.length) {
    const list = el('div', 'bz-people-supp-qlist');
    s.queue.forEach((it, i) => {
      const row = el('div', 'bz-people-supp-qrow');
      row.appendChild(el('span', 'bz-people-supp-qname', { title: it.path }, text(it.name)));
      const ts = document.createElement('input');
      ts.type = 'datetime-local';
      ts.className = 'bz-people-input bz-people-supp-qts';
      ts.value = suppLocalTsValue(it.ts);
      ts.setAttribute('data-people-supp-img-ts', String(i));
      row.appendChild(ts);
      row.appendChild(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', it.peer ? '对方发的' : '我发的', {
        'data-people-supp-img-peer': String(i),
        title: '点一下换归属（默认对方发的）',
      }));
      row.appendChild(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '×', { 'data-people-supp-img-drop': String(i), 'aria-label': '移除' }));
      list.appendChild(row);
    });
    out.push(list);
    out.push(el('div', 'bz-people-supp-acts', [
      button('bz-people-btn bz-people-btn-acc bz-people-btn-sm', `落盘并导入 ${s.queue.length} 张`, { 'data-people-supp-img-import': '' }),
    ]));
  }
  // 终态标注如实报（ADR-0225）：这两类描述不了，不说清就被当成「又漏了 / 又重扫」的神秘数字
  const unusable = s.broken + s.missing;
  const unusableNote = unusable > 0
    ? ` · ${[s.broken > 0 ? `源图损坏 ${s.broken} 张` : '', s.missing > 0 ? `源图缺失 ${s.missing} 张` : '']
        .filter(Boolean).join('、')}（无法描述）`
    : '';
  out.push(el('div', 'bz-people-supp-stat', text(
    s.imported > 0
      ? `已入库图片 ${s.imported} 张${s.undescribed > 0 ? ` · 未描述 ${s.undescribed} 张` : ' · 全部有描述'}${unusableNote}`
      : '还没补过图片。',
  )));
  if (s.imported > 0 && s.undescribed > 0) {
    out.push(el('div', 'bz-people-supp-acts', [
      button('bz-people-btn bz-people-btn-sm', s.describeBusy ? '描述进行中…' : `生成描述（${s.modelLabel}）`, {
        'data-people-supp-img-desc': '',
        ...(s.describeBusy ? { disabled: '' } : {}),
        title: '用 AI 面板当前模型给未描述的图片写画面描述，按张计费',
      }),
    ]));
  }
  // 预览网格（复评）：入库的图看得见、点得开放大、描述在图下面、右上角的叉删得掉（要先问一声）
  if (s.items.length) {
    const grid = el('div', 'bz-people-supp-imggrid');
    for (const it of s.items) grid.appendChild(suppImgCell(s.imgDel, it));
    if (s.hidden > 0) grid.appendChild(suppImgMore(s.hidden));
    out.push(grid);
  }
  return out;
}

/** 一格留影（全量渲染与增量追加共用；单源铁律——issue 519 分片后两条路都得长一个样） */
function suppImgCell(
  imgDel: string | undefined,
  it: { img: string; text: string; url: string; skip?: DescSkip; label?: string },
): HTMLElement {
  const cap = it.text.replace(/^\[图片\]\s*/, '');
  const box = el('div', 'bz-people-supp-imgbox');
  box.appendChild(el('img', 'bz-people-supp-imgthumb', {
    src: it.url, alt: cap, loading: 'lazy',
    'data-people-supp-img-view': it.img, title: '点开看大图',
  }));
  box.appendChild(button('bz-people-supp-imgdel', '×', {
    'data-people-supp-img-del': it.img,
    'aria-label': '删掉这张',
    title: '从时间线里删掉这张（原件留在数据根，不会动）',
  }));
  if (it.skip) box.appendChild(el('div', 'bz-people-supp-imgsens', text(it.label ?? '敏感')));
  if (imgDel === it.img) {
    box.appendChild(el('div', 'bz-people-supp-imgask', [
      el('div', 'bz-people-supp-imgask-tx', text('删掉这张？')),
      el('div', 'bz-people-supp-imgask-acts', [
        button('bz-people-supp-imgask-yes', '删掉', { 'data-people-supp-img-del-ok': it.img }),
        button('bz-people-supp-imgask-no', '取消', { 'data-people-supp-img-del-cancel': '' }),
      ]),
    ]));
  }
  const cell = el('div', 'bz-people-supp-imgcell', [box]);
  // 敏感格子的「行」本身是撤回入口（ADR-0224 决策 7）：标注是启发式判定，一定有误伤，
  // 没有撤回入口的错杀不可挽回。点一下 = 解除标注并重试描述（计费授权由这一次点击承担，
  // 与「生成描述」按钮同口径——它是个显式动作，不再二次弹确认）。
  if (it.skip === 'sensitive') {
    cell.appendChild(button('bz-people-supp-imgcap bz-people-supp-imgcap-sens', '敏感 · 解除', {
      'data-people-supp-img-unsens': it.img,
      title: '这张被判为敏感内容、已跳过描述——点一下解除标注并重试',
    }));
  } else if (it.skip) {
    // 源图损坏 / 缺失（ADR-0225）：磁盘事实，不是启发式判定——不给「解除」按钮（那只会把用户
    // 送进「解除 → 又跳过 → 再标注」的空转）。修好后重新导出媒体，下一轮 prep 自动放回队列。
    cell.appendChild(el('div', 'bz-people-supp-imgcap bz-people-supp-imgcap-none', {
      title: `${it.skip === 'broken' ? '源图打不开（文件本身损坏）' : '源图没导出（数据根里只有微信缩略图）'}，无法生成描述——重新导出媒体后会自动重试`,
    }, text(it.label ?? '无法描述')));
  } else {
    cell.appendChild(el('div', `bz-people-supp-imgcap${cap ? '' : ' bz-people-supp-imgcap-none'}`,
      { title: cap || '未描述' }, text(cap || '未描述')));
  }
  return cell;
}

/** 网格尾部哨兵（hidden > 0 才有）：滚到自动追加一片，点了也追加（IO 怪异时的兜底） */
function suppImgMore(hidden: number): HTMLElement {
  return el('button', 'bz-people-supp-imgmore', { 'data-people-supp-img-more': '', type: 'button' },
    text(`还有 ${hidden} 张 · 继续看`));
}

/**
 * 网格增量追加下一片（issue 519；ui 侧滚到哨兵 / 点哨兵时调用）：格子与全量渲染同一份
 * 构建，只 append 不重建——滚到千张也不回头全量重画。追加后原位换新哨兵（hidden 归 0 即移除），
 * 返回当前哨兵（没有更多返回 null，ui 拿它重挂 / 摘 IntersectionObserver）。
 */
export function appendSuppImageGridPage(
  grid: HTMLElement,
  page: Array<{ img: string; text: string; url: string; skip?: DescSkip; label?: string }>,
  hidden: number,
  imgDel?: string,
): HTMLElement | null {
  for (const it of page) grid.appendChild(suppImgCell(imgDel, it));
  const fresh = hidden > 0 ? suppImgMore(hidden) : null;
  const old = grid.querySelector<HTMLElement>('[data-people-supp-img-more]');
  if (fresh) {
    if (old) old.replaceWith(fresh);
    else grid.appendChild(fresh);
  } else {
    old?.remove();
  }
  return fresh;
}

function suppRecBody(s: SuppRecViewState): HTMLElement[] {
  const out: HTMLElement[] = [];
  const refLine = el('div', 'bz-people-supp-ref');
  refLine.append(
    text('声纹参考：'),
    textEl('b', s.ref === 'building' ? '构建中…' : s.ref === 'ready' ? '已建' : '未建'),
  );
  if (s.ref !== 'building' && !s.refConfirm) {
    refLine.appendChild(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', s.ref === 'ready' ? '重建质心' : '建质心', {
      'data-people-supp-rec-ref': '',
      title: '从该联系人的微信语音按归属建声纹参考（本地跑，几分钟）',
    }));
  }
  out.push(refLine);
  // 重建是覆盖式重跑：点一下先要二次确认（复评）——只在**已建**时问（没建过没有可覆盖的）
  if (s.ref === 'ready' && s.refConfirm) {
    out.push(el('div', 'bz-people-supp-reffirm', [
      el('div', 'bz-people-supp-reffirm-tx', text('重建会覆盖现在的声纹质心——确认重建？')),
      el('div', 'bz-people-supp-reffirm-acts', [
        button('bz-people-btn bz-people-btn-sm bz-people-btn-danger', '确认重建', { 'data-people-supp-rec-ref-ok': '' }),
        button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '取消', { 'data-people-supp-rec-ref-cancel': '' }),
      ]),
    ]));
  }
  out.push(el('div', 'bz-people-supp-acts', [
    button('bz-people-btn bz-people-btn-acc bz-people-btn-sm', '添加录音…', { 'data-people-supp-rec-add': '' }),
  ]));
  if (s.queue.length) out.push(...suppRecQueueBody(s.queue));
  // 疑似重复巡检（issue 516 Q3）：只报不清——同一份录音换了名会被当两条，删哪条得你来定
  const dups = s.dupGroups ?? [];
  if (dups.length) {
    const warn = el('div', 'bz-people-supp-dups');
    warn.appendChild(el('div', 'bz-people-supp-dupshead', text(
      `库里有 ${dups.length} 组疑似重复（内容一样、名字不同）——没有自动删，你看过再定：`,
    )));
    for (const g of dups) {
      warn.appendChild(el('div', 'bz-people-supp-duprow', { title: '这些文件字节完全相同' }, text(g.join('  ＝  '))));
    }
    out.push(warn);
  }
  // 孤儿行提示（issue 528）：原件不在了、仓里的轮次还在——不说清就是「统计怎么删都不退」
  const orphanN = s.rows.filter((r) => r.orphan).length;
  if (orphanN) {
    out.push(el('div', 'bz-people-supp-orphans', text(
      `有 ${orphanN} 条录音的原件已不在磁盘，但聊天仓里的转写轮次还在（仍计入统计、也进画谱素材）——在下面标「源已失」的行点「删除」即可清掉。`,
    )));
  }
  if (!s.rows.length) {
    out.push(el('div', 'bz-people-empty-hint', text('还没有录音。AAC / M4A / MP3 都行——时间默认取文件名或文件属性，说话人分离与转写交给本地管线。')));
    return out;
  }
  const list = el('div', 'bz-people-supp-list');
  for (const r of s.rows) {
    list.appendChild(suppRecRow(r, s.del?.file === r.file ? s.del : undefined, s.startEdit === r.file, s.turnsView));
  }
  out.push(list);
  return out;
}

/**
 * 删除二次确认（issue 516 Q12/Q13）：在行内展开，一句话说清代价（轮次在不在仓、脸谱要不要重画）。
 * 「同时删除录音原件」默认勾选；不勾 = 只清我们这边的副本，行回落「待处理」可重跑（改阈值/重建质心后重转）。
 */
function recDelConfirm(r: SuppRecRowState, del: NonNullable<SuppRecViewState['del']>): HTMLElement {
  const box = el('div', 'bz-people-supp-delbox');
  const inLedger = r.status === 'merged' || r.status === 'awaiting-merge';
  box.appendChild(el('div', 'bz-people-del-line', text(
    r.orphan
      ? `这条录音的原件已不在磁盘——删除会清掉聊天仓里那 ${r.turns ?? 0} 条转写轮次，统计与画谱素材跟着减${del.drawn ? '；脸谱正文不会跟着变，要反映得重新画谱（花钱）' : ''}。`
      : inLedger
        ? `删除会把这条录音的转写轮次从聊天仓一并清掉${del.drawn ? '；脸谱正文不会跟着变，要反映得重新画谱（花钱）' : ''}。`
        : `这条还没进聊天仓——删除只清账本与派生档${del.drawn ? '；脸谱正文不会跟着变' : ''}。`,
  )));
  // 原件勾选框：孤儿行的原件早就没了（勾了只是空动作也说不清），不给这个勾
  if (!r.orphan) {
    const label = document.createElement('label');
    label.className = 'bz-people-supp-delchk';
    const ck = document.createElement('input');
    ck.type = 'checkbox';
    ck.checked = del.alsoFile;
    ck.setAttribute('data-people-supp-rec-del-file', r.file);
    label.appendChild(ck);
    label.appendChild(text(' 同时删除录音原件（不勾只清账本，之后可重跑）'));
    box.appendChild(label);
  }
  box.appendChild(el('div', 'bz-people-supp-rowfoot', [
    button('bz-people-btn bz-people-btn-sm bz-people-btn-danger', '确认删除', { 'data-people-supp-rec-del-ok': r.file }),
    button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '取消', { 'data-people-supp-rec-del-cancel': r.file }),
  ]));
  return box;
}

/**
 * 导入队列（ADR-0217 决策 3）：逐条确认**起点**——解析得出的直接预填，含「周X / N点N分」
 * 这类相对信息时给候选下拉（不自动反推，见 recording.recordingStartCandidates），
 * 推不出的**必填标红**（不许静默回落 mtime：76 分钟录音落一条错日期，整条时间线全歪）。
 */
function suppRecQueueBody(queue: SuppRecQueueItem[]): HTMLElement[] {
  const out: HTMLElement[] = [];
  const list = el('div', 'bz-people-supp-qlist');
  queue.forEach((it, i) => {
    const row = el('div', `bz-people-supp-qrow${it.startMs === null ? ' need-ts' : ''}${it.suspect && !it.keep ? ' suspect' : ''}`);
    row.appendChild(el('span', 'bz-people-supp-qname', { title: it.path }, text(it.name)));
    if (it.dupOf) row.appendChild(el('span', 'bz-people-supp-qwarn', { title: `与库里「${it.dupOf}」内容相同` }, text('重复')));
    if (it.checking) row.appendChild(el('span', 'bz-people-supp-qwarn', text('抽检中…')));
    else if (it.suspect) {
      row.appendChild(el('span', 'bz-people-supp-qwarn bz-people-supp-qwarn-hard', {
        title: `抽检听不出「我」或该联系人的声音（可能选错了录音）——默认跳过，确认要导就点右钮`,
      }, text(it.keep ? '存疑·已允许' : '听着不像你们俩')));
      row.appendChild(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', it.keep ? '仍然导入：已允许' : '仍然导入', {
        'data-people-supp-rec-keep': String(i),
      }));
    }
    if (it.candidates.length > 1) {
      const sel = document.createElement('select');
      sel.className = 'bz-people-input bz-people-supp-qcand';
      sel.setAttribute('data-people-supp-rec-cand', String(i));
      sel.setAttribute('data-people-supp-rec-path', it.path); // 身份钩子：ui 侧按 path 认条目（下标在队列增删后会串位）
      sel.setAttribute('title', '文件名只给了「周X / N点N分」这类相对信息——选一个候选日期');
      it.candidates.forEach((c) => {
        const o = document.createElement('option');
        o.value = String(c);
        o.textContent = suppLocalTsValue(c).replace('T', ' ');
        if (c === it.startMs) o.selected = true;
        sel.appendChild(o);
      });
      row.appendChild(sel);
    }
    const ts = document.createElement('input');
    ts.type = 'datetime-local';
    ts.className = 'bz-people-input bz-people-supp-qts';
    ts.value = it.startMs === null ? '' : suppLocalTsValue(it.startMs);
    ts.setAttribute('data-people-supp-rec-ts', String(i));
    ts.setAttribute('data-people-supp-rec-path', it.path); // 身份钩子：队列重排后 harvest 仍认得这条（B 组审查 P1）
    if (it.startMs === null) ts.setAttribute('placeholder', '必填：这条录音的起点');
    row.appendChild(ts);
    row.appendChild(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '×', { 'data-people-supp-rec-drop': String(i), 'aria-label': '移除' }));
    list.appendChild(row);
  });
  out.push(list);
  const miss = queue.filter((q) => q.startMs === null).length;
  const suspect = queue.filter((q) => q.suspect && !q.keep).length;
  out.push(el('div', 'bz-people-supp-acts', [
    button('bz-people-btn bz-people-btn-acc bz-people-btn-sm', `落盘并导入 ${queue.length - suspect} 条`, { 'data-people-supp-rec-import': '' }),
  ]));
  out.push(el('div', 'bz-people-pop-note', text(
    miss > 0
      ? `有 ${miss} 条还没确认起点（标红处）——录音起点决定整条转写的绝对时间，填完再落盘。`
      : suspect > 0
        ? `有 ${suspect} 条抽检听不出你或该联系人的声音（可能选错了录音）——默认不导入；确认没错就点「仍然导入」。`
        : '起点 = 这条录音开始录的时刻（不是复制进来的时刻）；转写轮次的绝对时间靠它推。之后也能在行上改。',
  )));
  return out;
}

/**
 * 逐轮时间轴预览（面板内读 sidecar 渲染，同 `<名>.turns.md` 口径）：**含旁音轮**，
 * 旁音打标——这份视图的用处之一就是复核我们没误杀（issue 516 Q16b）。
 * issue 529：会话流本体收进 `chatStream`（与详情页「查看聊天」同一份 markup），
 * 这里只把轮次翻译成展示行。
 */
function recTurnsPreview(lines: SuppRecTurnLine[], meAvatar: string, otherAvatar: string): HTMLElement {
  const sideN = lines.filter((l) => l.side).length;
  const segN = lines.reduce((m, l) => Math.max(m, l.segHead ?? 0), 0);
  return chatStream(lines.map((l) => {
    const me = l.speaker === '我';
    return {
      me,
      avatar: me ? meAvatar : l.side ? '' : otherAvatar,
      who: l.speaker,
      // 旁音轮不是联系人本人的声音：名字上屏，一眼看清这条为什么不进聊天仓
      ...(l.side ? { name: l.speaker } : {}),
      text: l.text || '（空转写）',
      side: l.side,
    };
  }), {
    // 录音头（issue 516 Q22）：不新造消息，把「这条录音是什么、并成了几段」贴在全轮列表顶上
    head: `逐轮时间轴 · ${lines.length} 轮 · 并成 ${segN} 段${sideN ? ` · 旁音 ${sideN}（不进聊天仓）` : ''}`,
    empty: '账本里还没有轮次——转写跑完才会有。',
  });
}

function suppRecRow(r: SuppRecRowState, del?: SuppRecViewState['del'], startEdit = false, turnsView?: SuppRecViewState['turnsView']): HTMLElement {
  const row = el('div', `bz-people-supp-row${r.orphan ? ' orphan' : ''}`, { 'data-people-supp-row': r.file });
  const head = el('div', 'bz-people-supp-rowhead');
  head.appendChild(el('span', 'bz-people-supp-qname', { title: r.file }, text(r.file)));
  // 孤儿行徽章「源已失」：状态仍是已并入（仓里有轮次），但原件和 sidecar 都没了
  head.appendChild(el(
    'span',
    `bz-people-supp-badge bz-people-supp-badge-${r.orphan ? 'orphan' : r.status}`,
    text(r.orphan ? '源已失' : SUPP_REC_LABEL[r.status]),
  ));
  row.appendChild(head);
  if (del) {
    row.appendChild(recDelConfirm(r, del));
    return row;
  }
  if (turnsView?.file === r.file) {
    row.appendChild(recTurnsPreview(turnsView.lines, turnsView.meAvatar, turnsView.otherAvatar));
    row.appendChild(el('div', 'bz-people-supp-rowfoot', [
      button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '收起', { 'data-people-supp-rec-turns-close': r.file }),
    ]));
    return row;
  }
  if (r.status === 'running' || r.status === 'interrupted' || r.status === 'awaiting-merge') {
    const meter = el('div', 'bz-people-jobs-meter');
    if (r.pct !== null) {
      meter.appendChild(el('div', 'bz-people-jobs-track', { 'aria-hidden': 'true' }, el('div', 'bz-people-jobs-fill', { style: `width:${r.pct}%` })));
      meter.appendChild(el('span', 'bz-people-jobs-pct', text(`${r.pct}%`)));
    }
    row.appendChild(meter);
  }
  if (r.status === 'running' && r.stage) row.appendChild(recStageChain(r.stage));
  if (r.status === 'running') {
    // running 的 meta 自建：ptext / elapsed 包 data 属性，tickRecRows 每秒原位定点更新（不整行重画）
    const meta = el('div', 'bz-people-supp-rowmeta');
    meta.appendChild(el('span', undefined, { 'data-rec-ptext': '' }, text(r.phaseText)));
    if (r.mode === 'me-only') meta.appendChild(text(' · 单质心：非我即对方'));
    if (r.mode === 'blind') meta.appendChild(text(' · 无质心：盲分'));
    if (r.turns !== undefined) meta.appendChild(text(` · ${r.turns} 轮`));
    if (r.elapsed) {
      meta.appendChild(text(' · '));
      meta.appendChild(el('span', undefined, { 'data-rec-elapsed': '' }, text(`已 ${r.elapsed}`)));
    }
    row.appendChild(meta);
    const stop = button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '停止', { 'data-people-supp-rec-stop': r.file });
    row.appendChild(el('div', 'bz-people-supp-rowfoot', [stop]));
    return row;
  }
  if (r.status === 'queued') {
    // 排队中（ADR-0218 决策 5）：全局一条串行跑，排队行只给「移出队列」——这条不对就走，
    // 要腾机器用进度块的「清空队列」。排队 / 处理中的行不给删除（issue 516 Q14）。
    row.appendChild(el('div', 'bz-people-supp-rowmeta', text(`排队中 · 第 ${r.queuePos ?? 1} 位`)));
    const out = button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '移出队列', { 'data-people-supp-rec-dequeue': r.file });
    row.appendChild(el('div', 'bz-people-supp-rowfoot', [out]));
    return row;
  }
  const bits: string[] = [];
  if (r.phaseText) bits.push(r.phaseText);
  if (r.mode === 'me-only') bits.push('单质心：非我即对方');
  if (r.mode === 'blind') bits.push('无质心：盲分');
  if (r.orphan) bits.push(`原件已不在磁盘 · 仓内 ${r.turns ?? 0} 条转写轮次仍在统计与素材`);
  else if (r.turns !== undefined) bits.push(`${r.turns} 轮`);
  if (r.sideSpeaks) bits.push(`已滤 ${r.sideSpeaks} 轮旁音`);
  if (bits.length) row.appendChild(el('div', 'bz-people-supp-rowmeta', text(bits.join(' · '))));
  // 起点（ADR-0217：一等数据，行上可见可改）——绝对时间的唯一来源。孤儿行没元数据可改。
  if (startEdit && !r.orphan) {
    const line = el('div', 'bz-people-supp-startrow');
    line.appendChild(el('span', undefined, text('起点')));
    const inp = document.createElement('input');
    inp.type = 'datetime-local';
    inp.className = 'bz-people-input bz-people-supp-qts';
    inp.value = r.startMs ? suppLocalTsValue(r.startMs) : '';
    inp.setAttribute('data-people-supp-rec-start', r.file);
    line.appendChild(inp);
    row.appendChild(line);
  } else if (!r.orphan && r.startMs !== undefined) {
    row.appendChild(el('div', 'bz-people-supp-rowmeta', text(`起点 ${suppLocalTsValue(r.startMs).replace('T', ' ')}`)));
  }
  const foot: HTMLElement[] = [];
  if (r.status === 'failed' && r.errText) foot.push(el('span', 'bz-people-jobs-err', text(r.errText)));
  if (r.status === 'pending') foot.push(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '处理', { 'data-people-supp-rec-run': r.file }));
  if (r.status === 'interrupted') foot.push(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '续跑', { 'data-people-supp-rec-run': r.file }));
  if (r.status === 'failed') foot.push(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '重试', { 'data-people-supp-rec-run': r.file }));
  if (r.status === 'awaiting-merge') foot.push(button('bz-people-btn bz-people-btn-acc bz-people-btn-sm', '并仓', { 'data-people-supp-rec-merge': r.file, title: '转写完成但还没进时间线——点这里按轮次并仓' }));
  // 孤儿行（issue 528）：原件与 sidecar 都不在，改起点 / 查看轮次无从谈起——只留「删除」，那正是清掉它的唯一入口
  if (!r.orphan) {
    if (startEdit) foot.push(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '收起', { 'data-people-supp-rec-start-cancel': r.file }));
    else foot.push(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '改起点', { 'data-people-supp-rec-start-edit': r.file, title: '录音开始录的时刻——改完绝对时间跟着重排（已并仓的同步回写）' }));
    if (r.turns !== undefined) {
      foot.push(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '查看轮次', { 'data-people-supp-rec-turns': r.file, title: '逐轮时间轴（含被滤的旁音轮）——复核我们没误杀' }));
    }
  }
  // 删除入口：处理中 / 排队中不给（issue 516 Q14）——先「停止」/「移出队列」再删
  foot.push(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '删除', { 'data-people-supp-rec-del': r.file, title: r.orphan ? '清掉这条录音在聊天仓里的转写轮次（原件早已不在磁盘）' : '删掉这条录音（二次确认里可勾选是否连原件一起删）' }));
  if (foot.length) row.appendChild(el('div', 'bz-people-supp-rowfoot', foot));
  return row;
}

/** ts → datetime-local 输入值（本地时区，分钟精度；ui 侧起点候选原位同步也用它） */
export function suppLocalTsValue(ts: number): string {
  const d = new Date(ts);
  const p2 = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/**
 * 录音处理进度块（509：挂画谱任务进度块同一位置；引擎队列空而录音在跑时由 ui 渲染）。
 * 复用 jobsNote 的纸条视觉，只列在跑 / 中断的录音。
 */
export function recNote(rows: SuppRecRowState[]): HTMLElement {
  const block = el('div', 'bz-people-jobs', { 'data-people-rec-note': '', role: 'status' });
  const running = rows.filter((r) => r.status === 'running').length;
  const waiting = rows.filter((r) => r.status === 'queued').length;
  block.appendChild(el('div', 'bz-people-jobs-who', text(`录音处理 · ${running} 条在跑${waiting ? ` · ${waiting} 条等待` : ''}`)));
  for (const r of rows) {
    if (r.status !== 'running' && r.status !== 'queued' && r.status !== 'interrupted') continue;
    const line = el('div', 'bz-people-jobs-main', text(r.file));
    const detail = r.status === 'queued' ? `排队中 · 第 ${r.queuePos ?? 1} 位` : r.phaseText;
    if (detail) line.appendChild(el('span', 'bz-people-jobs-detail', text(` · ${detail}`)));
    block.appendChild(line);
  }
  // 清空队列（腾机器；与行上的「移出队列」语义正交——那条不对 / 全部不跑了）
  if (waiting) {
    block.appendChild(el('div', 'bz-people-jobs-foot', [
      button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '清空队列', { 'data-people-rec-clear-queue': '' }),
    ]));
  }
  return block;
}

/**
 * 删除联系人册页（issue 500 / 501 / 502 续 / 506）：两档——
 * 未画谱 / 画谱未完成：本页二次确认；
 * 已画谱：主密码就在这一页里重输（不再是另弹一屏宿主锁屏）——密码框 + 错误行都归本页，
 * 校验失败留在页上改，取消 / 合上这页就退出去，什么都不删。
 */
export function delPage(p: PersonEntry, tier: DeleteTier): HTMLElement {
  const body: HTMLElement[] = [el('div', 'bz-people-del-who', text(`「${p.name}」`))];
  body.push(el('div', 'bz-people-del-line', text(tier === 'drawn'
    ? '这个人已经有画成的脸谱——删除会连同脸谱正文、聊天仓、随手记与头像一起销毁，不可恢复。'
    : tier === 'unfinished'
      ? '这个人的脸谱还没画完——删掉要从头再画，未完成的任务一并停掉。'
      : '这个人还没画过脸谱——删掉之后要重新导入才能再画。')));
  body.push(el('div', 'bz-people-del-note', text(tier === 'drawn'
    ? '要删除，请重输主密码确认。'
    : '数据源目录与聊天原文不动，之后可以重新导入。')));
  if (tier === 'drawn') {
    const pw = document.createElement('input');
    pw.type = 'password';
    pw.className = 'bz-people-input bz-people-del-pw-input';
    pw.placeholder = '主密码';
    pw.autocomplete = 'off';
    pw.setAttribute('data-people-del-pw', '');
    body.push(el('div', 'bz-people-del-pw', [
      pw,
      // 错误行常驻 DOM（`data-people-del-err` 是 ui 侧写文案的锚），空串时靠 CSS 收起
      el('div', 'bz-people-del-err', { 'data-people-del-err': '' }),
    ]));
  }
  const actions = el('div', 'bz-people-del-actions', [
    button('bz-people-btn', '取消', { 'data-people-del-cancel': '' }),
    button('bz-people-btn bz-people-btn-acc', '删除', { 'data-people-del-ok': '' }),
  ]);
  body.push(actions);
  return subPage({ title: '删除联系人', hook: 'del', side: undefined }, body);
}

// ---------------- 找一找（几十位翻页嫌慢，按名字 / 标签把人捞出来） ----------------

export interface FindRow {
  p: PersonEntry;
  avatar: string;
  /** 第几页（1 起）与左 / 右半 */
  page: number;
  half: '左' | '右';
  state: 'todo' | 'drawing' | 'legacy' | 'drawn';
}

export function findPage(opts: { q: string; total: number; rows: FindRow[]; tags: string[] }): HTMLElement {
  const q = opts.q.trim();
  const body: HTMLElement[] = [];
  const box = el('div', 'bz-people-findbox');
  box.appendChild(el('i', 'bz-ic', { 'data-lucide': 'search', 'aria-hidden': 'true' }));
  const inp = document.createElement('input');
  inp.className = 'bz-people-input';
  inp.value = q;
  inp.setAttribute('data-people-find', '');
  inp.setAttribute('placeholder', '名字或标签，比如「摄影」「表妹」「阿澈」…');
  box.appendChild(inp);
  if (q) box.appendChild(iconButton('x', 'bz-people-ico bz-people-ico-sm', { 'data-people-find-clear': '', 'aria-label': '清空' }));
  body.push(box);
  if (!q) {
    body.push(el('div', 'bz-people-empty-hint', text(`共 ${opts.total} 位，输一个字就能把人捞出来，点一下就翻到 TA 那页。`)));
    if (opts.tags.length) body.push(el('div', 'bz-people-find-tags', opts.tags.map((t) => button('bz-people-stk', t, { 'data-people-find-tag': t }))));
  } else if (!opts.rows.length) {
    body.push(el('div', 'bz-people-empty-hint', text(`没找到「${q}」这个人。换个字试试，或者去「数据源」看看是不是还没导进来。`)));
  } else {
    body.push(el('div', 'bz-people-find-n', text(`找到 ${opts.rows.length} 位`)));
    const list = el('div', 'bz-people-ds-list');
    for (const r of opts.rows) {
      const name = r.p.name || r.p.id;
      const tags = (r.p.profile?.tags ?? []).filter(Boolean).join(' · ');
      const state = r.state === 'todo' ? '待画' : r.state === 'drawing' ? '画谱中' : r.state === 'legacy' ? '旧版' : '已画';
      const row = el('button', 'bz-people-find-row', { 'data-people-find-open': r.p.id }) as HTMLButtonElement;
      row.type = 'button';
      row.append(
        el('span', 'bz-people-find-ava', avatarNode(name, r.avatar)),
        el('span', 'bz-people-find-main', [
          el('span', 'bz-people-find-name', text(name)),
          el('span', 'bz-people-find-meta', text(tags)),
        ]),
        el('span', 'bz-people-find-side', text(`第 ${r.page} 页 ${r.half} · ${state}`)),
      );
      list.appendChild(row);
    }
    body.push(list);
  }
  return subPage({ title: '找一找', meta: q ? `「${q}」` : `共 ${opts.total} 位`, hook: 'find' }, body);
}

/** 合并横幅：同一个人的多份记录并成一张时，横贴在册子上沿的一条纸 */
export function mergeBanner(msg: string, calm = false): HTMLElement {
  const box = el('div', `bz-people-banner${calm ? ' bz-people-banner-calm' : ''}`);
  box.appendChild(el('i', 'bz-ic', { 'data-lucide': calm ? 'database' : 'layers', 'aria-hidden': 'true' }));
  box.appendChild(el('span', 'bz-people-banner-tx', text(msg)));
  box.appendChild(button('bz-people-banner-x', '×', { 'data-people-banner-close': '', 'aria-label': '收起' }));
  return box;
}

/** 随手记录入行：日期（默认今天）+ 一句话 */
export function noteAddRow(today: string): HTMLElement {
  const date = document.createElement('input');
  date.type = 'date';
  date.className = 'bz-people-input bz-people-note-date';
  date.value = today;
  date.setAttribute('data-people-note-date', '');
  const txt = profInput('', '一句话记下这一天……', ['data-people-note-text', ''], 'bz-people-input bz-people-note-text');
  return el('div', 'bz-people-note-add', [
    date,
    txt,
    button('bz-people-btn bz-people-btn-acc bz-people-btn-sm', '记一笔', { 'data-people-note-save': '' }),
  ]);
}

// ---------------- 迷你 markdown（受限语法，ADR-0191 §4；纯 DOM 构建） ----------------

/** 只认：## / ### 小节、- 列表、> 引用块、**粗体**、普通段落。其余语法原样输出文本。 */
/** 长文层次（455 评审拍板）：## 小节印章字——按小节语义取字，未登记的按序号章 */
const MD_SEALS: Record<string, string> = {
  画像速写: '速', 性格与思维: '性', '表达 DNA': '言', 兴趣爱好: '趣', 价值观与红线: '则',
  习惯: '常', 情感倾向: '情', 关系定性: '定', 互动结构: '动', 演变阶段: '变',
  我们的语言: '语', 共同记忆: '忆', 冲突与修复: '克', 未竟之事: '未', 经营建议: '营',
};
const MD_CN_NO = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/** 条目行首日期签：`（2026-03-05）` / `（2026-03-05 至 03-07）` 之类整体抽成签 */
const MD_DATE_RE = /^（([-\d至~\/\s年]+?)）\s*/;

export function miniMarkdown(md: string): HTMLElement {
  const root = el('div', 'bz-people-portrait');
  let sec: HTMLElement | null = null;
  let body: HTMLElement | null = null;
  let list: HTMLElement | null = null;
  let quote: HTMLElement | null = null;
  let no = 0;
  const appendInline = (elm: HTMLElement, str: string): void => {
    const parts = str.split(/\*\*(.+?)\*\*/g);
    parts.forEach((part, i) => {
      if (!part) return;
      if (i % 2 === 1) elm.appendChild(textEl('strong', part));
      else elm.appendChild(document.createTextNode(part));
    });
  };
  // `## 标题` → 小节块：印章字 + 标题 + 渐隐细线，长文切成可扫读的段
  const openSec = (title: string): void => {
    sec = document.createElement('section');
    sec.className = 'bz-md-sec';
    const head = document.createElement('div');
    head.className = 'bz-md-sec-h';
    const seal = document.createElement('span');
    seal.className = 'bz-md-seal';
    seal.textContent = MD_SEALS[title] ?? MD_CN_NO[no] ?? '·';
    const rule = document.createElement('i');
    rule.className = 'bz-md-rule';
    head.append(seal, textEl('h4', title), rule);
    body = document.createElement('div');
    body.className = 'bz-md-sec-b';
    sec.append(head, body);
    root.appendChild(sec);
    list = null;
    quote = null;
    no++;
  };
  for (const raw of String(md ?? '').replace(/```+/g, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { list = null; quote = null; continue; }
    if (line.startsWith('## ')) { openSec(line.slice(3).trim()); continue; }
    if (!sec) openSec('概述');
    if (line.startsWith('### ')) {
      list = null; quote = null;
      body!.appendChild(textEl('h5', line.slice(4)));
      continue;
    }
    if (line.startsWith('- ')) {
      quote = null;
      if (!list) { list = document.createElement('div'); list.className = 'bz-md-items'; body!.appendChild(list); }
      const it = document.createElement('div');
      it.className = 'bz-md-it';
      it.appendChild(el('span', 'bz-md-mk'));
      let rest = line.slice(2).trim();
      const m = rest.match(MD_DATE_RE);
      if (m) {
        it.appendChild(el('span', 'bz-md-date', [text(m[1])]));
        rest = rest.slice(m[0].length);
      }
      const tx = document.createElement('span');
      tx.className = 'bz-md-tx';
      appendInline(tx, rest);
      it.appendChild(tx);
      list.appendChild(it);
      continue;
    }
    if (line.startsWith('>')) {
      list = null;
      if (!quote) { quote = document.createElement('div'); quote.className = 'bz-md-quote'; body!.appendChild(quote); }
      const p = document.createElement('p');
      appendInline(p, line.slice(1).replace(/^\s/, ''));
      quote.appendChild(p);
      continue;
    }
    list = null;
    quote = null;
    const p = document.createElement('p');
    appendInline(p, line);
    body!.appendChild(p);
  }
  return root;
}

export interface DsRowState {
  name: string;
  /** 界面显示名（issue 501：纯名；name 仍是目录键，勾选 / 定位都用它） */
  displayName: string;
  rawCount: number;
  isGroup: boolean;
  /** 归一化口径媒体徽章文案（'' = 不显示） */
  media: string;
  previewCount: number;
  newCount: number;
  /** true = newCount 是「有无新」哨兵（stats 路径无键集合，显示「有新消息」不带条数；485） */
  newApprox?: boolean;
  processedTs: number | null;
  /** 头像文件路径（有则行首出照片，无则首字圆章） */
  avatar?: string | null;
  /** 保库记录里已有这个人的聊天仓（水位判定的「已入库」那半） */
  imported?: boolean;
  /** 完整聊天这一趟已经导出过、还没入库（导出阶段的中间态） */
  exported?: boolean;
}

export interface DsModalState {
  dataDir: string;
  scanning: boolean;
  importing: boolean;
  /** null = 还没扫过；[] = 扫过无联系人 */
  rows: DsRowState[] | null;
  /** 勾选名单快照：册页重渲染时回显勾选框（448 评审 P1：重建不丢视觉勾选） */
  selected: string[];
  hiddenGroups: number;
  notice: string;
  /** 非桌面端（无 window.require） */
  desktopOnly: boolean;
  /** 数据源页过滤字（D 组；空 = 未过滤） */
  filter: string;
  /** 全量联系人总数（过滤中页眉「N / 共 M 位」的 M） */
  totalRows: number;
  /** 未过滤的全量行（页脚勾选总账的口径——被滤掉的行勾着也照常计入，不因看不见而丢账） */
  allRows?: DsRowState[];
  /** 本次扫描完成时刻（HH:MM 展示；'' = 未扫） */
  scannedAt: string;
  /** 同步进行中（issue 465）：右上角只出「停止」、页脚「导入所选」置灰 */
  syncing: boolean;
  /** 「群聊纳入列表」设置（peopleIncludeGroups）：开 = 群聊行可勾可选，关/缺省 = 灰 off「未纳入」 */
  groupEnabled?: boolean;
  /** 同步进度行（册页内一条，不占画像生成进度便签——ADR-0196 决策 6；null = 无同步动态） */
  sync: DsSyncLine | null;
}

/** 同步进度行（ui 层从 sync.ts 状态映射而来；render 只管形状） */
export interface DsSyncLine {
  status: 'running' | 'ok' | 'stopped' | 'error';
  /** 主文案（阶段标签 / 终态词；段内位置与已耗时由 ui 层拼好，百分比由渲染层追加） */
  text: string;
  /** 副文案（[bz-step] 步骤行 / 完成摘要 / 错误原因） */
  sub: string;
  /** 当前联系人副行（「大琳 · 20,773 条」；空 = 不显示。484：逐人事件滚动显示最近一位） */
  contact: string;
  /** 百分比（null = 该阶段不可估，绝不假报——进度条走不定态样式） */
  pct: number | null;
  /** 错误 / 停止面的下一步动作（空 = 工具文案已含） */
  hint: string;
  /** 失败明细（「名：原因」，最多展示 3 行 + 汇总） */
  failures: string[];
}

/** 导入水位：勾这一位、点导入，会发生什么（水位签的文案与色档）。
 *  `groupEnabled` = 「群聊纳入列表」设置开：群聊行照常给水位（可勾可选）；
 *  关（缺省）= 群聊不出水位、行画成不可勾（isGroup 无条件 off 是旧约——设置开了还灰着等于开关没做）。 */
export function dsWaterOf(row: DsRowState, groupEnabled = false): { k: string; label: string } | null {
  if (row.isGroup && !groupEnabled) return null;
  // 完整聊天已经导出来了、还没入库：中间态（停在导出阶段时，导完的那几位就停在这儿）。
  // 已入库的就算导出账还在，也该走后面的「无新素材」—— 所以这儿先看 imported
  if (row.exported && !row.imported) return { k: 'exported', label: '已导出 · 待入库' };
  if (!row.imported) return { k: 'full', label: `全新 · ${formatCount(row.rawCount)} 条` };
  if (row.newCount > 0) return { k: 'newer', label: row.newApprox ? '增量 · 有新消息' : `增量 · ${formatCount(row.newCount)} 条` };
  return { k: 'skip', label: '无新素材' };
}

/** 水位行文案（行尾灰字）：未导入 / 已导 N 条 · 画到日期 / · 未画脸谱 */
export function dsWatermark(row: DsRowState): string {
  if (!row.imported) return '未导入';
  const drawn = row.processedTs ? `画到 ${formatDay(row.processedTs).slice(5)}` : '未画脸谱';
  return `已导 ${formatCount(row.rawCount)} 条 · ${drawn}`;
}

/** 数据源行：勾选框 + 头像 + 名 / 条数 + 右侧水位签与已导账。
 *  `groupEnabled` 开 = 群聊行是普通行（可勾）；关 = 灰 off（点勾 / 空格都无反应，角标「未纳入」） */
export function dsRow(row: DsRowState, on: boolean, groupEnabled = false): HTMLElement {
  const fresh = row.newCount > 0 && row.imported;
  const water = dsWaterOf(row, groupEnabled);
  const groupOff = row.isGroup && !groupEnabled;
  // 三档不可勾：群聊（设置未纳入时）、「已导入且无新素材」（issue 507：再导一遍等于白导）
  const cls = `bz-people-ds-row${on ? ' bz-people-ds-on' : ''}${fresh ? ' bz-people-ds-fresh' : ''}${groupOff ? ' bz-people-ds-off' : ''}${water?.k === 'skip' ? ' bz-people-ds-skip' : ''}`;
  // tabindex（D 组键盘可达）：勾选框可聚焦，Space 切勾选由 ui 的 keydown 委托接（与点击同账）
  const box = el('span', 'bz-people-ds-box', { 'data-people-ds-check': row.name, role: 'checkbox', tabindex: '0', 'aria-checked': on ? 'true' : 'false' },
    on ? el('i', 'bz-ic', { 'data-lucide': 'check', 'aria-hidden': 'true' }) : text(''));
  const name = row.displayName + (row.isGroup ? '（群）' : '');
  return el('label', cls, [
    box,
    row.isGroup ? text('') : el('span', 'bz-people-ds-ava', avatarNode(row.displayName || row.name, row.avatar ?? '')),
    el('span', 'bz-people-ds-main', [
      el('span', 'bz-people-ds-name', text(name)),
      el('span', 'bz-people-ds-meta', text([`${formatCount(row.rawCount)} 条`, row.media].filter(Boolean).join(' · '))),
    ]),
    el('span', 'bz-people-ds-side', [
      water ? el('span', `bz-people-ds-water bz-people-ds-w-${water.k}`, text(water.label)) : text(''),
      el('span', 'bz-people-ds-mark', text(groupOff ? '未纳入' : dsWatermark(row))),
    ]),
  ]);
}

/** 页脚账：勾了几位、会发生什么（全新 / 增量 / 跳过逐项报）。
 *  口径取 allRows（未过滤全量；D 组过滤只裁列表显示，勾着但被滤掉的行照常入账）。
 *  群聊随开关入账（设置开 = 行可勾 = 账也认）；关着时行本就不可选、扫描也不列，自然不出现。 */
function footerLabel(s: DsModalState): string {
  const groupEnabled = s.groupEnabled === true;
  const picked = (s.allRows ?? s.rows ?? []).filter((r) => s.selected.includes(r.name));
  if (!picked.length) return '未勾选联系人';
  const n = { full: 0, newer: 0, skip: 0, exported: 0 };
  let msgs = 0;
  for (const r of picked) {
    const w = dsWaterOf(r, groupEnabled);
    if (!w) continue;
    if (w.k === 'full') { n.full++; msgs += r.rawCount; }
    else if (w.k === 'exported') { n.exported++; msgs += r.rawCount; } // 已导出没入库：这批也照样并进来
    else if (w.k === 'newer') { n.newer++; msgs += r.newCount; }
    else if (w.k === 'skip') n.skip++;
  }
  if (picked.length && n.skip === picked.length) return '所选暂无新素材（已导过的会被跳过）';
  const bits = [
    n.full ? `全新 ${n.full} 位` : '',
    n.newer ? `增量 ${n.newer} 位` : '',
    n.exported ? `待入库 ${n.exported} 位` : '',
    n.skip ? `跳过 ${n.skip} 位` : '',
  ].filter(Boolean);
  return `已选 ${picked.length} 位 · 将并入 ${formatCount(msgs)} 条${bits.length ? `（${bits.join(' · ')}）` : ''}`;
}

/** 同步条：和进度便签同一套小纸条（黄纸 + 一道虚边），出错那档才转红 */
export function dsSyncLineNode(line: DsSyncLine): HTMLElement {
  const box = el('div', `bz-people-syncline${line.status === 'error' ? ' bz-people-syncline-err' : ''}`, { 'data-people-ds-sync-line': line.status });
  const main = line.pct === null ? line.text : `${line.text} ${line.pct}%`;
  box.appendChild(el('div', 'bz-people-sync-text', { 'data-people-ds-sync-text': '' }, text(main)));
  if (line.status === 'running') {
    const track = el('div', 'bz-people-sync-track');
    track.appendChild(line.pct === null
      ? el('div', 'bz-people-sync-indet')
      : el('div', 'bz-people-sync-bar', { style: `width:${line.pct}%` }));
    box.appendChild(track);
  }
  // 联系人行 / 副行常驻（空则藏起来）：running 期间原位更新只换文本，不重建整条
  const contact = el('div', 'bz-people-sync-contact', { 'data-people-ds-sync-contact': '' }, text(line.contact));
  if (!line.contact) contact.hidden = true;
  box.appendChild(contact);
  for (const f of line.failures) box.appendChild(el('div', 'bz-people-sync-fail', { 'data-people-ds-sync-fail': '' }, text(f)));
  const sub = el('div', 'bz-people-sync-sub', { 'data-people-ds-sync-sub': '' }, text(line.sub));
  if (!line.sub) sub.hidden = true;
  box.appendChild(sub);
  if (line.hint) box.appendChild(el('div', 'bz-people-sync-sub', text(line.hint)));
  return box;
}

/** 导入记录 meta（详情页账目行） */
export function importMeta(rec: ImportRecord, textMsgs: number): string {
  return `${rec.timeFrom.slice(0, 7)} ~ ${rec.timeTo.slice(0, 7)} · 共 ${formatCount(textMsgs)} 条文本（形态占比含图片/语音等全部消息形态）`;
}
