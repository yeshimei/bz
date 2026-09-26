/**
 * 脸谱渲染纯层（issue 447 / 450 / 451 / 455 / ADR-0104 markup 单源）：面板壳 / 折子封面墙 / 详情折页册 /
 * 数据源弹窗 / 统计与档案弹窗 / 档案与随手记 / 互动数据的 markup 全部在此，ui.ts 与评审壳共用同一份。
 * 纯度：import 图只进域内零依赖模块（types.ts 兼容读单源 personOf/bondOf；render-purity 守卫同口径）——
 * DOM 构建走本文件自持 helper；时间文案由调用方算好注入，本层只拼字符串。
 * 折子语义（G 案拍板）：一人一册——封面竖排姓名 + 修复印章；详情折页册 issue 455 起为四折
 * （卷一《其人》/ 卷二《我们》/ 事件 / 时间线；原画像折拆双卷，数据与档案两页改独立弹窗），
 * 收起折显竖排引文，点折脊展开。真实数据形态适配：竖排名 >7 字截断（实测最长 37 字）、
 * 零媒体不出徽章（74% 联系人零语音）、消息量级万格式化（max 20,773）。
 */
import type { FaceEvent, ImportRecord, PersonEntry, PersonProfile } from './types';

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

/** 消息量格式化：≥1 万显「1.2 万」（余数 ≥100 才带小数），其余千分位（实测量级 1 ~ 20,773） */
export function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(n % 10000 >= 100 ? 1 : 0)} 万`;
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

/** 面板壳：头行（brand + 数据源图标）+ 统计行 + 生成进度块槽位 + body + 数据源弹层容器 + 统计/档案弹层容器 */
export function panelShell(): HTMLElement {
  return el('div', 'bz-people-panel', [
    el('div', 'bz-people-head', [
      el('div', 'bz-people-brand', [
        el('div', 'bz-people-mark', { 'aria-hidden': 'true' }, el('i', 'bz-ic', { 'data-lucide': 'smile' })),
        el('div', 'bz-people-brand-text', [
          el('h1', 'bz-people-title', text('脸谱')),
          el('div', 'bz-people-sub', text('人物消息脸谱')),
        ]),
      ]),
      el('div', 'bz-people-head-actions', [
        iconButton('database', 'bz-people-btn bz-people-btn-ghost bz-people-icon-btn', { 'data-people-ds-open': '', 'aria-label': '数据源', title: '数据源' }),
      ]),
    ]),
    el('div', 'bz-people-stats', { 'data-people-stats': '' }),
    el('div', 'bz-people-jobs-slot', { 'data-people-jobs-slot': '', hidden: '' }),
    el('div', 'bz-people-body', { 'data-people-body': '' }),
    el('div', 'bz-people-ds-layer', { 'data-people-ds-layer': '', hidden: '' }),
    el('div', 'bz-people-pop-layer', { 'data-people-pop-layer': '', hidden: '' }),
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

/** 队列副文案：多人生成 `（2/5 人）当前：大琳`；单人生成 `当前：大琳` */
export function jobsQueueLabel(queueIndex: number, queueTotal: number, name: string): string {
  const pos = queueTotal > 1 ? `（${Math.max(1, queueIndex)}/${queueTotal} 人）` : '';
  return `${pos}当前：${name}`;
}

/** 无引擎文案时的状态兜底（讲清下一步） */
export function jobsFallbackMessage(status: JobsUiStatus, name: string): string {
  switch (status) {
    case 'running': return `正在生成「${name}」的脸谱…`;
    case 'paused': return '已暂停——点「继续生成」接着画';
    case 'interrupted': return `上次「${name}」生成中断了——点「继续生成」接着画（已完成的批次不重画）`;
    case 'error': return `「${name}」生成失败`;
    case 'done': return `「${name}」的脸谱已生成`;
  }
}

/** 状态 → 动作钮（label + data 钩子）；done 无动作 */
const JOBS_ACTIONS: Record<JobsUiStatus, { label: string; hook: string } | null> = {
  running: { label: '暂停', hook: 'data-people-jobs-pause' },
  paused: { label: '继续生成', hook: 'data-people-jobs-resume' },
  interrupted: { label: '继续生成', hook: 'data-people-jobs-resume' },
  // issue 453：error 也出「继续生成」——451 已放宽 resume 接受 error（从 batchesDone 续跑）。
  // 450 时这里只有「删除任务」，把用户逼到别的入口（详情头 / 数据源弹窗）去「重新画」，那才是重烧。
  error: { label: '继续生成', hook: 'data-people-jobs-resume' },
  done: null,
};

/** 进度块动作：仅「接不上」的 error（漂移判废）才出「删除任务」——续跑必然再判废，删了重来才对 */
function jobsActionOf(s: JobsBlockState): { label: string; hook: string } | null {
  if (s.status === 'error' && s.resumable === false) return { label: '删除任务', hook: 'data-people-jobs-dismiss' };
  return JOBS_ACTIONS[s.status];
}

/**
 * 工具段主行文案（469）：preprocess 阶段（或其暂停 / 中断面）的阶段行——带 `已完成/总数`
 * （media/derive/transcribe 段末 [bz-info] 汇总校正，进行中按 [bz-p].pct 推算）。
 */
function prepStagePart(s: JobsBlockState): string | null {
  return s.prep?.stageText ?? null;
}

/**
 * 进度块（面板头统计行下）：细进度条 + 引擎主文案 + 队列副文案 + 灰字说明 + 状态动作钮。
 * 主文案整句展示（切批 / 抽样说明可能是长句）：不截断、允许换行（样式 overflow-wrap）。
 * 469：preprocess 阶段主行 = 阶段 + 计数（`媒体导出 312/1631`），进度条 = 工具段折算总进度；
 * 暂停 / 中断面同样带阶段信息（`已暂停 · 语音转写 45/1289`）；AI 段的暂停 / 中断面不带。
 */
export function progressBlock(s: JobsBlockState): HTMLElement {
  const stagePart = prepStagePart(s);
  const pct = stagePart ? s.prep!.overall : jobsPercent(s.batchesDone, s.batchesTotal, s.stagesDone);
  const block = el('div', 'bz-people-jobs', {
    'data-people-jobs': '',
    'data-people-jobs-talker': s.talker,
    role: 'status',
  });
  block.appendChild(el('div', 'bz-people-jobs-meter', [
    el('div', 'bz-people-jobs-bar', { 'aria-hidden': 'true' },
      el('div', 'bz-people-jobs-fill', { style: `width:${pct}%` })),
    el('span', 'bz-people-jobs-pct', text(`${pct}%`)),
  ]));
  // 455 评审：状态一行说清，不读引擎长文案（批次细节归进度条，错误细节归错误行）
  const next = Math.min(s.batchesDone + 1, s.batchesTotal);
  const main = s.status === 'error'
    ? `生成失败 · 已完成 ${s.batchesDone}/${s.batchesTotal} 批`
    : s.status === 'paused' ? (stagePart ? `已暂停 · ${stagePart}` : '已暂停')
    : s.status === 'interrupted' ? (stagePart ? `上次生成中断了 · ${stagePart}` : '上次生成中断了')
    : s.status === 'done' ? '脸谱已生成'
    : stagePart ?? `正在生成 · 第 ${next}/${s.batchesTotal} 批`;
  block.appendChild(el('div', 'bz-people-jobs-main', text(main)));
  const action = jobsActionOf(s);
  const foot: HTMLElement[] = [];
  if (s.status === 'error' && s.errorText) foot.push(el('span', 'bz-people-jobs-err', text(s.errorText)));
  // 469 失败分流：prep 段有计账失败（单条媒体 / 语音）且任务不在跑 → 出「重试失败项」
  // （工具幂等只补失败项；AI 段已完成的批次照常保留）
  if (s.prep && s.prep.failed > 0 && s.status !== 'running' && s.status !== 'done') {
    foot.push(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '重试失败项', { 'data-people-jobs-prep-retry': '' }));
  }
  if (action) foot.push(button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', action.label, { [action.hook]: '' }));
  if (foot.length) block.appendChild(el('div', 'bz-people-jobs-foot', foot));
  return block;
}

// ---------------- 列表（折子封面墙） ----------------

/** 统计行文案 */
export function statsText(people: PersonEntry[]): string {
  const total = people.reduce((s, p) => s + p.imports.reduce((x, r) => x + r.messageCount, 0), 0);
  const faces = people.filter((p) => p.digest).length;
  return people.length
    ? `${people.length} 位人物 · ${formatCount(total)} 条消息 · ${faces} 张脸谱`
    : '还没有人物';
}

/** 合并横幅：to 已选 = 二次确认；未选 = 点选提示 */
export function mergeBar(fromName: string, toName: string | null): HTMLElement {
  return toName
    ? el('div', 'bz-people-merge-bar', [
      el('div', 'bz-people-merge-text', text(`确认合并：把「${fromName}」的导入记录与随手记并到「${toName}」，「${fromName}」将被删除；对方的脸谱不带入，合并后建议重画。`)),
      button('bz-people-btn bz-people-btn-acc', '确认合并', { 'data-people-merge-confirm': '' }),
      button('bz-people-btn bz-people-btn-ghost', '取消', { 'data-people-merge-cancel': '' }),
    ])
    : el('div', 'bz-people-merge-bar', [
      el('div', 'bz-people-merge-text', text(`合并重复人物：点选一张折子，把「${fromName}」的导入记录与随手记并过去——对方保留，「${fromName}」这本将删除。`)),
      button('bz-people-btn bz-people-btn-ghost', '取消合并', { 'data-people-merge-cancel': '' }),
    ]);
}

export interface FoldCardOpts {
  /** 跨导入累计媒体（零素材 null 不出徽章） */
  media: MediaShape | null;
  mergeFrom: boolean;
  mergePick: boolean;
  /** 生成引擎任务（issue 451）：印章四态的来源；无任务 = 按脸谱水位判已画 / 未画 */
  job?: FoldCardJob | null;
  /** 头像文件路径（有则卡面右上出照片章，无则文字印） */
  avatar?: string;
}

// ---------------- 折子印章四态（issue 451：未画谱 / 画谱中 / 画谱中断 / 已画谱） ----------------

/**
 * 印章四态（互斥）。判定优先级：**任务态压过脸谱水位**——已有脸谱又在中途补画的人显「画谱中」
 * 而不是「已画谱」，否则用户看到的是一张过期的印。
 */
export type FoldSealState = 'todo' | 'running' | 'halted' | 'done';

/** 印章动作 kind（ui 事件委托按它分发）；每态恰好一个，互不并列 */
export type FoldSealAction = 'draw' | 'pause' | 'resume' | 'redraw';

export interface FoldSeal {
  state: FoldSealState;
  /** 印章可见文字（可含 \n 两行；样式 white-space: pre-line 承接） */
  text: string;
  /** 悬停说明：讲清当前状态与点击后果 */
  title: string;
  /** 印章点击动作（印章即入口——不往卡面加新元素，448 的「卡面不放动作」仍守） */
  action: { kind: FoldSealAction; label: string };
}

/** 卡片上的任务视图（ui 从引擎快照映射；本层只管画） */
export interface FoldCardJob {
  status: JobsUiStatus;
  batchesDone: number;
  batchesTotal: number;
  /** 已完成成文阶段数（其人 / 我们 / 编年史，0~3；issue 455 四阶段） */
  stagesDone: number;
  /** 失败态可否断点续跑：漂移类失败（消息集已变）接不上，只能重新生成 */
  resumable: boolean;
  /** 工具段总进度 0~100（469：preprocess 阶段的印章百分比；缺省按批口径算） */
  prepPct?: number;
}

/**
 * 印章四态判定与动作（issue 451，纯函数——文案与动作成对，单测锁契约）：
 * 任务 running → 画谱中；paused / interrupted / error → 画谱中断；无活跃任务时按 digest 判已画谱 / 未画谱。
 * 已画谱的「补画」走 auto 模式，没有新消息由 ui 层预筛拦下（通知「没有新消息、无需重画」），不烧 AI。
 */
export function foldSeal(p: PersonEntry, job: FoldCardJob | null): FoldSeal {
  const name = p.name || p.id;
  if (job && job.status !== 'done') {
    const prog = job.batchesTotal ? `${job.batchesDone}/${job.batchesTotal} 批` : '尚未切批';
    if (job.status === 'running') {
      const pct = job.prepPct ?? jobsPercent(job.batchesDone, job.batchesTotal, job.stagesDone);
      return {
        state: 'running',
        text: `画谱中\n${pct}%`,
        title: `正在生成「${name}」的脸谱（${prog}）——点这里在本批做完后暂停`,
        action: { kind: 'pause', label: '暂停' },
      };
    }
    if (job.status === 'error' && !job.resumable) {
      return {
        state: 'halted',
        text: '画谱中断',
        title: `「${name}」上次生成中断且接不上（消息集已变）——点这里重新生成`,
        action: { kind: 'redraw', label: '重新生成' },
      };
    }
    return {
      state: 'halted',
      text: `画谱中断\n${job.batchesTotal ? `${job.batchesDone}/${job.batchesTotal}` : '待续'}`,
      title: `「${name}」${job.status === 'error' ? '上次生成失败' : '上次没画完'}（${prog}）——点这里从断点继续，已画完的批次不重画`,
      action: { kind: 'resume', label: '继续生成' },
    };
  }
  if (p.digest) {
    return {
      state: 'done',
      text: p.lastProcessedTs ? `画到\n${formatDay(p.lastProcessedTs).slice(2)}` : '已画',
      title: `「${name}」的脸谱已画到这天——点这里用新导入的消息补画（没有新消息会跳过）`,
      action: { kind: 'redraw', label: '补画' },
    };
  }
  return {
    state: 'todo',
    text: '待画',
    title: `「${name}」还没有脸谱——点这里用已导入的消息画一张`,
    action: { kind: 'draw', label: '画脸谱' },
  };
}

/**
 * 印章节点（foldCard 与 ui 原位刷新共用同一份 markup——印章单源）。
 * 用 button 而非 div：印章本身就是动作入口（451），不再往卡面加第二个元素。
 */
export function foldSealNode(p: PersonEntry, job: FoldCardJob | null): HTMLElement {
  const seal = foldSeal(p, job);
  const b = el('button', `bz-people-seal bz-people-seal-${seal.state}`, {
    'data-people-seal-act': seal.action.kind,
    'aria-label': `${seal.action.label}：${p.name || p.id}`,
    title: seal.title,
  }) as HTMLButtonElement;
  b.type = 'button';
  b.textContent = seal.text;
  return b;
}

/** 头像章（455 评审）：封面卡右上以照片为印，四态走印环（金环 = 已画，虚环 = 待画）——动作语义与 foldSealNode 同一单源 */
function foldAvaNode(p: PersonEntry, seal: ReturnType<typeof foldSeal>, avatar: string): HTMLElement {
  const b = el('button', `bz-people-seal bz-people-seal-${seal.state} bz-people-fold-ava`, {
    'data-people-seal-act': seal.action.kind,
    'aria-label': `${seal.action.label}：${p.name || p.id}`,
    title: seal.title,
  }) as HTMLButtonElement;
  b.type = 'button';
  b.appendChild(el('img', '', { src: avatarUri(avatar), alt: p.name }));
  return b;
}

/**
 * 折子封面卡（issue 447 / 451）：竖排姓名 + 关系标签 + 消息量 + 印章（四态；有头像时印章即照片章）。
 * 水位 = lastProcessedTs（已画到的提炼锚点）；印章四态与动作见 foldSeal。
 * 卡面不放动作（448：合并 / 删除收进详情头图标工具条）——印章本身即入口，不新增元素。
 */
export function foldCard(p: PersonEntry, opts: FoldCardOpts): HTMLElement {
  const total = p.imports.reduce((s, r) => s + r.messageCount, 0);
  const from = p.imports.map((r) => r.timeFrom).sort()[0];
  const to = p.imports.map((r) => r.timeTo).sort().pop();
  const span = from && to ? `${from.slice(0, 7)} ~ ${to.slice(0, 7)}` : '';
  const rel = (p.profile?.tags ?? []).filter(Boolean)[0] ?? '';
  const label = mediaLabel(opts.media);
  const seal = foldSeal(p, opts.job ?? null);
  const card = el('div', 'bz-people-fold', [
    el('div', 'bz-people-fold-inner', [
      opts.avatar ? foldAvaNode(p, seal, opts.avatar) : foldSealNode(p, opts.job ?? null),
      el('div', 'bz-people-fold-title vt', { title: p.name }, text(vtName(p.name))),
      // 无关系、无跨度时不再兜底「N 条」——meta 行已有同一数字，卡面重复（448 评审 P2）
      el('div', 'bz-people-fold-who', text(rel || (span ? span : '新折'))),
      el('div', 'bz-people-fold-meta', text([
        total ? `${formatCount(total)} 条` : '尚无消息',
        label,
        seal.state === 'done' && p.lastProcessedTs ? `画到 ${formatDay(p.lastProcessedTs).slice(2)}` : '',
      ].filter(Boolean).join(' · '))),
    ]),
  ]);
  if (opts.mergeFrom) card.classList.add('bz-people-fold-merge-src');
  else if (opts.mergePick) card.classList.add('bz-people-fold-merge-pick');
  card.setAttribute('data-people-card', p.id);
  return card;
}

/** 墙容器（data 钩子供原位刷新） */
export function foldWall(): HTMLElement {
  return el('div', 'bz-people-wall', { 'data-people-wall': '' });
}

/** 空库态：修谱引导（导入走数据源弹窗） */
export function wallEmpty(): HTMLElement {
  return el('div', 'bz-people-empty', [
    el('div', 'bz-people-empty-mark', { 'aria-hidden': 'true' }, el('i', 'bz-ic', { 'data-lucide': 'smile' })),
    el('div', 'bz-people-empty-title', text('还没有脸谱')),
    el('div', 'bz-people-empty-hint', text('打开「数据源」勾选联系人导入预览，再点「画脸谱」——AI 会为对方修一册脸谱：画像、性格、共同回忆。聊天原文只在本机提炼，不落盘。')),
    button('bz-people-btn bz-people-btn-acc', '打开数据源', { 'data-people-ds-open': '' }),
  ]);
}

// ---------------- 详情（折页册） ----------------

/** 折 id（issue 455 三折，评审拍板合并）：p = 卷一《其人》，b = 卷二《相交》，e = 《纪事》（编年 + 按月事件）；统计与档案为详情头弹窗 */
export type FoldId = 'p' | 'b' | 'e';

const FOLD_TITLES: Array<[FoldId, string, string]> = [
  ['p', '其人', '卷一 · 人物画像与代表原话'],
  ['b', '相交', '卷二 · 关系画像'],
  ['e', '纪事', '关系时间线（编年）+ 交往事件（按月）'],
];

export interface FoldDetailOpts {
  fold: FoldId;
}

export interface FoldDetailHeadOpts {
  /** 未生成脸谱 → 出「画脸谱」 */
  canGenerate: boolean;
  /**
   * 生成任务（issue 453）：有未完成任务时，工具条画笔钮改成「继续生成」（刷新图标 + 进度提示），
   * 点它不再从第 1 批重烧——详情头本来就是把用户引向重烧的入口之一。
   */
  job?: FoldCardJob | null;
  /** 头像文件绝对路径（数据目录 avatar.<ext>；缺省回落首字印章） */
  avatar?: string;
}

/** 详情头（455 评审采纳「居家档案型」）：圆照金环（无则首字印）+ 名 + 档案印签 + 数字下地的一行 meta + 朱色图标工具条 */
export function foldDetailHead(p: PersonEntry, media: MediaShape | null, opts: FoldDetailHeadOpts): HTMLElement {
  const total = p.imports.reduce((s, r) => s + r.messageCount, 0);
  const job = opts.job && opts.job.status !== 'done' ? opts.job : null;
  const action = job
    ? iconButton('refresh-cw', 'bz-people-btn bz-people-btn-ghost bz-people-icon-btn', {
      'data-people-generate-one': '',
      'aria-label': job.status === 'running' ? '正在生成' : '继续生成',
      title: job.status === 'running'
        ? `正在生成「${p.name}」的脸谱（${job.batchesDone}/${job.batchesTotal} 批）——进度看面板顶部`
        : `继续生成（已完成 ${job.batchesDone}/${job.batchesTotal} 批，不会从头重烧）`,
    })
    : opts.canGenerate
      ? iconButton('paintbrush', 'bz-people-btn bz-people-btn-ghost bz-people-icon-btn', { 'data-people-generate-one': '', 'aria-label': '画脸谱', title: '画脸谱（用已导入的消息生成）' })
      : null;
  // 名旁印签：手动档案的关系标签（无档案不出，绝不拿 AI 编）
  const tags = (p.profile?.tags ?? []).filter(Boolean).slice(0, 3);
  // meta 一行：数字下地加重（H1 拍板），语音/图片等明细归「互动统计」弹窗
  const meta = el('div', 'bz-people-card-meta');
  if (total) {
    meta.appendChild(textEl('b', formatCount(total)));
    meta.appendChild(text(` 条消息 · ${p.imports.length} 次导入`));
    if (p.digest) meta.appendChild(text(` · 脸谱生成于 ${p.digest.generatedAt.slice(0, 10)}`));
  } else meta.appendChild(text('尚无导入'));
  const id = el('div', 'bz-people-dt-id', [
    el('div', 'bz-people-dt-name', [
      text(p.name),
      ...(tags.length ? [el('span', 'bz-people-dt-tags', tags.map((t) => el('span', 'bz-people-dt-tag', [text(t)])))] : []),
    ]),
    meta,
  ]);
  return el('div', 'bz-people-dt-head', [
    opts.avatar
      ? el('img', 'bz-people-dt-avatar', { src: avatarUri(opts.avatar), alt: p.name })
      : el('div', 'bz-people-dt-seal', { style: `background:${avatarColor(p.name)}` }, text(initials(p.name))),
    id,
    el('div', 'bz-people-dt-actions', [
      ...(action ? [action] : []),
      // 455 评审：记一笔自纪事折抽出，独立弹窗，入口在互动统计之前
      iconButton('pencil', 'bz-people-btn bz-people-btn-ghost bz-people-icon-btn', { 'data-people-note-open': '', 'aria-label': '记一笔', title: '记一笔' }),
      // issue 455：数据统计 / 补充背景两页折改独立弹窗，入口收进详情头工具条（返回钮在前、DOM 序居其左）
      iconButton('bar-chart-3', 'bz-people-btn bz-people-btn-ghost bz-people-icon-btn', { 'data-people-stats-open': '', 'aria-label': '互动统计', title: '互动统计' }),
      iconButton('contact', 'bz-people-btn bz-people-btn-ghost bz-people-icon-btn', { 'data-people-prof-open': '', 'aria-label': '补充背景', title: '补充背景' }),
      iconButton('arrow-left', 'bz-people-btn bz-people-btn-ghost bz-people-icon-btn', { 'data-people-back-btn': '', 'aria-label': '返回列表', title: '返回列表' }),
    ]),
  ]);
}

/** 折页册（issue 455 四折）；折题竖排成窄书脊条，展开折正文占主幅（点书脊切换） */
export function foldBook(p: PersonEntry, opts: FoldDetailOpts, bodies: Record<FoldId, HTMLElement[]>): HTMLElement {
  const book = el('div', 'bz-people-book', { 'data-people-book': '' });
  for (const [id, title] of FOLD_TITLES) {
    const on = opts.fold === id;
    // 切换钩子挂整片折页（收起折点书脊也能切）；展开折不带——防吞折内按钮点击
    const leaf = el('div', `bz-people-leaf${on ? ' bz-people-leaf-on' : ''}`, on
      ? { 'data-people-leaf': id }
      : { 'data-people-leaf': id, 'data-people-leaf-head': id });
    leaf.appendChild(el('div', 'bz-people-leaf-spine', { 'aria-hidden': 'true' }));
    leaf.appendChild(el('div', 'bz-people-leaf-head', [
      el('span', 'bz-people-leaf-zh', text(title)),
    ]));
    if (on) {
      const body = el('div', 'bz-people-leaf-body');
      for (const node of bodies[id] ?? []) body.appendChild(node);
      leaf.appendChild(body);
    }
    book.appendChild(leaf);
  }
  return book;
}

/** 档案是否至少填了一项（决定档案折内容） */
export function profileFilled(prof: PersonProfile | undefined): boolean {
  if (!prof) return false;
  return Boolean(
    (prof.socials && prof.socials.length) ||
    (prof.tags && prof.tags.length) ||
    (prof.birthday ?? '').trim() || (prof.metVia ?? '').trim() || (prof.metAt ?? '').trim() ||
    (prof.hometown ?? '').trim() || (prof.job ?? '').trim() || (prof.note ?? '').trim()
  );
}

// ---------------- 详情折内容（纯 markup；数据由调用方备好） ----------------

/** 折内空态提示：一句话 + 可选「打开数据源」动作（448 评审 P2 的入口内联习惯，markup 单源收进本层） */
export function foldHint(msg: string, action?: string): HTMLElement {
  const d = el('div', 'bz-people-empty-hint');
  d.appendChild(text(msg));
  if (action) {
    d.appendChild(el('br'));
    d.appendChild(button('bz-people-btn bz-people-btn-ghost', action, { 'data-people-ds-open': '' }));
  }
  return d;
}

/** 其人折正文（卷一《其人》，issue 455）：markdown + 代表原话；空态引导导入（旧单卷数据由 personOf 兼容读进来） */
export function foldPersonBody(mdRoot: HTMLElement | null, p: PersonEntry): HTMLElement[] {
  const out: HTMLElement[] = mdRoot
    ? [mdRoot]
    : [foldHint('还没有其人画像。从数据源导入一次即可生成。', '打开数据源')];
  if (p.digest?.quotes?.length) {
    out.push(el('div', 'bz-people-section-title', text('代表原话')));
    const quotes = el('div', 'bz-people-quotes');
    for (const q of p.digest.quotes) {
      quotes.appendChild(el('div', 'bz-people-quote', [
        el('div', 'bz-people-quote-text', text(`「${q.text}」`)),
        el('div', 'bz-people-quote-meta', text(`${q.who === '我' ? '我' : p.name} · ${q.ts}`)),
      ]));
    }
    out.push(quotes);
  }
  return out;
}

/** 我们折正文（卷二《我们》，issue 455）：markdown；空态引导导入 */
export function foldBondBody(mdRoot: HTMLElement | null): HTMLElement[] {
  return mdRoot ? [mdRoot] : [foldHint('还没有关系画像。从数据源导入一次即可生成。', '打开数据源')];
}

/** 纪事折正文（455 评审拍板合并）：编年时间线在前，按月交往事件在后，随手记列表收尾（录入行已抽成详情头「记一笔」弹窗） */
export function foldEventsBody(p: PersonEntry): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (p.digest?.chronicle) {
    out.push(el('div', 'bz-people-chronicle', [miniMarkdown(p.digest.chronicle)]));
    out.push(el('div', 'bz-people-ev-divider', [el('span', '', [text('纪事 · 按月')])]));
  }
  if (p.digest?.events.length) {
    // 按月分组（升序）：月内大事件（major）在上、日常在下；月组默认收起，点头部展开
    const byMonth = new Map<string, FaceEvent[]>();
    for (const ev of p.digest.events) {
      const month = ev.ts.slice(0, 7);
      const list = byMonth.get(month);
      if (list) list.push(ev);
      else byMonth.set(month, [ev]);
    }
    const months = el('div', 'bz-people-ev-months');
    for (const [month, evs] of [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      evs.sort((a, b) => (a.kind === 'major' ? 0 : 1) - (b.kind === 'major' ? 0 : 1));
      const group = el('div', 'bz-people-ev-mon');
      group.appendChild(el('button', 'bz-people-ev-mon-head', { 'data-people-ev-mon': '', 'aria-label': `展开 ${month}` }, [
        el('span', 'bz-people-ev-mon-plus', text('+')),
        el('span', 'bz-people-ev-mon-name', text(month)),
        el('span', 'bz-people-ev-mon-cnt', text(`${evs.length} 条`)),
      ]));
      const body = el('div', 'bz-people-ev-mon-body');
      for (const ev of evs) {
        body.appendChild(el('div', `bz-people-event${ev.kind === 'major' ? ' bz-people-event-major' : ''}`, [
          el('span', 'bz-people-event-ts', text(ev.ts)),
          el('span', 'bz-people-event-dot'),
          el('span', 'bz-people-event-summary', text(ev.summary)),
        ]));
      }
      group.appendChild(body);
      months.appendChild(group);
    }
    out.push(months);
  } else if (!out.length) {
    out.push(el('div', 'bz-people-empty-hint', text('还没有交往纪事。导入聊天生成脸谱后会提炼出来。')));
  }
  const evs = p.manualEvents ?? [];
  if (evs.length) {
    out.push(el('div', 'bz-people-section-title', text('随手记')));
    const list = el('div', 'bz-people-notes');
    for (const ev of evs) {
      list.appendChild(el('div', 'bz-people-note', [
        el('span', 'bz-people-note-ts', text(ev.ts)),
        el('span', 'bz-people-note-summary', text(ev.summary)),
        button('bz-people-btn bz-people-btn-ghost bz-people-note-del', '删', { 'data-people-ev-del': ev.id }),
      ]));
    }
    out.push(list);
  }
  return out;
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
  const card = el('div', 'bz-people-insights', [
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
  const wrap = el('div', 'bz-people-chart-wrap');
  const chart = el('div', 'bz-people-chart');
  for (const [month, n] of monthly) {
    const h = max > 0 ? Math.max(Math.round((n / max) * 100), 4) : 0;
    chart.appendChild(el('div', 'bz-people-col', { title: `${month} · ${n} 条` },
      el('div', 'bz-people-col-bar', { style: `height:${h}%` })));
  }
  wrap.appendChild(chart);
  const labels = el('div', 'bz-people-chart-labels');
  const step = monthly.length <= 8 ? 1 : Math.ceil(monthly.length / 6);
  monthly.forEach(([month], i) => {
    const show = i === 0 || i === monthly.length - 1 || i % step === 0;
    labels.appendChild(el('span', '', text(show ? month.slice(2) : '')));
  });
  wrap.appendChild(labels);
  return wrap;
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

/** 档案展示卡：只列填过的字段 */
export function profileView(prof: PersonProfile | undefined): HTMLElement {
  const rows: HTMLElement[] = [];
  const addRow = (label: string, value: string) => {
    rows.push(el('div', 'bz-people-prof-row', [
      el('span', 'bz-people-prof-label', text(label)),
      el('span', 'bz-people-prof-value', text(value)),
    ]));
  };
  if (prof?.socials?.length) {
    rows.push(el('div', 'bz-people-prof-row', [
      el('span', 'bz-people-prof-label', text('社交账号')),
      el('span', 'bz-people-prof-value', text(prof.socials.map((s) => [s.platform, s.handle].filter(Boolean).join(' ')).filter(Boolean).join(' · '))),
    ]));
  }
  if (prof?.birthday?.trim()) addRow('生日', prof.birthday.trim());
  if (prof?.metVia?.trim()) addRow('认识方式', prof.metVia.trim());
  if (prof?.metAt?.trim()) addRow('认识时间', prof.metAt.trim());
  if (prof?.hometown?.trim()) addRow('家乡 / 现居', prof.hometown.trim());
  if (prof?.job?.trim()) addRow('职业', prof.job.trim());
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

function profInput(value: string, placeholder: string, attr: [string, string], cls = 'bz-people-prof-input'): HTMLInputElement {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = cls;
  inp.value = value;
  inp.placeholder = placeholder;
  inp.setAttribute(attr[0], attr[1]);
  return inp;
}

export function socialRow(platform: string, handle: string): HTMLElement {
  return el('div', 'bz-people-prof-social-row', [
    profInput(platform, '平台（微信 / 微博…）', ['data-people-prof-social-platform', ''], 'bz-people-prof-input bz-people-prof-social-platform'),
    profInput(handle, '账号', ['data-people-prof-social-handle', ''], 'bz-people-prof-input bz-people-prof-social-handle'),
    button('bz-people-btn bz-people-btn-ghost bz-people-prof-x', '×', { 'data-people-prof-social-del': '', 'aria-label': '删除这条社交账号' }),
  ]);
}

export function tagChip(t: string): HTMLElement {
  return el('span', 'bz-people-prof-tag', [
    el('span', 'bz-people-prof-tag-text', text(t)),
    button('bz-people-btn bz-people-btn-ghost bz-people-prof-x', '×', { 'data-people-prof-tag-del': '', 'aria-label': `删除标签 ${t}` }),
  ]);
}

/** 档案编辑卡：行内增删只动 DOM，点「保存档案」才读全量写盘 */
export function profileEditor(prof: PersonProfile | undefined): HTMLElement {
  const grid = (label: string, input: HTMLElement) =>
    el('div', 'bz-people-prof-row', [el('span', 'bz-people-prof-label', text(label)), input]);
  const socialList = el('div', 'bz-people-prof-social-list', { 'data-people-prof-social-list': '' });
  for (const s of prof?.socials ?? []) socialList.appendChild(socialRow(s.platform, s.handle));
  const tagList = el('div', 'bz-people-prof-tag-list', { 'data-people-prof-tag-list': '' });
  for (const t of prof?.tags ?? []) tagList.appendChild(tagChip(t));
  const tagInput = profInput('', '加标签…', ['data-people-prof-tag-input', ''], 'bz-people-prof-input bz-people-prof-tag-input');
  return el('div', 'bz-people-prof bz-people-prof-edit', [
    el('div', 'bz-people-prof-row', [
      el('span', 'bz-people-prof-label', text('社交账号')),
      el('div', 'bz-people-prof-social', [
        socialList,
        el('div', 'bz-people-prof-social-tools', [
          button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '+ 社交账号', { 'data-people-prof-add-social': '' }),
        ]),
      ]),
    ]),
    grid('生日', profInput(prof?.birthday ?? '', 'YYYY-MM-DD 或 MM-DD', ['data-people-prof-field', 'birthday'])),
    grid('认识方式', profInput(prof?.metVia ?? '', '怎么认识的', ['data-people-prof-field', 'metVia'])),
    grid('认识时间', profInput(prof?.metAt ?? '', '比如 2023 年夏天', ['data-people-prof-field', 'metAt'])),
    grid('家乡 / 现居', profInput(prof?.hometown ?? '', '家乡 · 现居', ['data-people-prof-field', 'hometown'])),
    grid('职业', profInput(prof?.job ?? '', '职业', ['data-people-prof-field', 'job'])),
    el('div', 'bz-people-prof-row', [
      el('span', 'bz-people-prof-label', text('标签')),
      el('div', 'bz-people-prof-tags-edit', [
        tagList,
        el('div', 'bz-people-prof-tag-tools', [
          tagInput,
          button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '+ 标签', { 'data-people-prof-tag-add': '' }),
        ]),
      ]),
    ]),
    grid('备注', profInput(prof?.note ?? '', '一句话备注', ['data-people-prof-field', 'note'])),
    el('div', 'bz-people-prof-actions', [
      button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', 'AI 补充', { 'data-people-prof-ai': '', title: 'AI 只填空白字段，填完你可检查再保存' }),
      button('bz-people-btn bz-people-btn-acc bz-people-btn-sm', '保存档案', { 'data-people-prof-save': '' }),
      button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '取消', { 'data-people-prof-cancel': '' }),
    ]),
  ]);
}

/** 补充背景弹窗正文（issue 455 自「档案」折迁来）：编辑态/有档显卡，全空给入口行；AI 补充按钮三态常驻 */
export function profilePopBody(p: PersonEntry, editing: boolean): HTMLElement[] {
  const out: HTMLElement[] = [];
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

// ---------------- 统计 / 档案弹窗（issue 455：自折册改独立弹窗，壳沿数据源弹窗形制） ----------------

/**
 * 弹窗壳（互动统计 / 补充背景共用）：遮罩 + 面板（标题 + 关闭钮）+ 可滚动正文。
 * 遮罩与关闭钮都带 `data-people-pop-close`，点击关弹走 ui 委托；rootHook 标识是哪只弹窗开着。
 */
export function popShell(title: string, rootHook: string, body: HTMLElement[]): HTMLElement {
  const wrap = el('div', 'bz-people-pop', { [rootHook]: '' });
  wrap.appendChild(el('div', 'bz-people-pop-dim', { 'data-people-pop-close': '' }));
  const pop = el('div', 'bz-people-pop-panel', { role: 'dialog', 'aria-label': title });
  pop.appendChild(el('div', 'bz-people-pop-head', [
    el('div', 'bz-people-pop-title', text(title)),
    iconButton('x', 'bz-people-btn bz-people-btn-ghost bz-people-icon-btn', { 'data-people-pop-close': '', 'aria-label': '关闭', title: '关闭' }),
  ]));
  const content = el('div', 'bz-people-pop-body');
  for (const node of body) content.appendChild(node);
  pop.appendChild(content);
  wrap.appendChild(pop);
  return wrap;
}

/** 随手记录入行：日期（默认今天）+ 一句话 */
export function noteAddRow(today: string): HTMLElement {
  const date = document.createElement('input');
  date.type = 'date';
  date.className = 'bz-people-prof-input bz-people-note-date';
  date.value = today;
  date.setAttribute('data-people-note-date', '');
  const txt = profInput('', '一句话记下这一天……', ['data-people-note-text', ''], 'bz-people-prof-input bz-people-note-text');
  return el('div', 'bz-people-note-add', [
    date,
    txt,
    button('bz-people-btn bz-people-btn-acc bz-people-btn-sm', '记一笔', { 'data-people-note-save': '' }),
    button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '收起', { 'data-people-note-cancel': '' }),
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

// ---------------- 数据源弹窗（issue 447 拍板形态） ----------------

export interface DsRowState {
  name: string;
  rawCount: number;
  isGroup: boolean;
  /** 归一化口径媒体徽章文案（'' = 不显示） */
  media: string;
  previewCount: number;
  newCount: number;
  processedTs: number | null;
  /** 头像文件路径（有则行首出照片，无则首字圆章） */
  avatar?: string | null;
}

export interface DsModalState {
  dataDir: string;
  scanning: boolean;
  importing: boolean;
  /** null = 还没扫过；[] = 扫过无联系人 */
  rows: DsRowState[] | null;
  selectedCount: number;
  /** 勾选名单快照：弹层重渲染时回显复选框（448 评审 P1：重建层不丢视觉勾选） */
  selected: string[];
  freshCount: number;
  hiddenGroups: number;
  notice: string;
  /** 导入完成有新素材 → 出「画脸谱」 */
  generateable: boolean;
  /** 非桌面端（无 window.require） */
  desktopOnly: boolean;
  /** 本次扫描完成时刻（HH:MM 展示；'' = 未扫） */
  scannedAt: string;
  /** 同步进行中（issue 465）：右上角只出「停止」、页脚「导入所选 / 画脸谱」置灰 */
  syncing: boolean;
  /** 同步进度行（弹窗内一条，不占画像生成进度块——ADR-0196 决策 6；null = 无同步动态） */
  sync: DsSyncLine | null;
}

/** 同步进度行（ui 层从 sync.ts 状态映射而来；render 只管形状） */
export interface DsSyncLine {
  status: 'running' | 'ok' | 'stopped' | 'error';
  /** 主文案（阶段标签 / 终态词；百分比由渲染层追加） */
  text: string;
  /** 副文案（[bz-step] 步骤行 / 完成摘要 / 错误原因） */
  sub: string;
  /** 百分比（null = 该阶段不可估，绝不假报） */
  pct: number | null;
  /** 错误 / 停止面的下一步动作（空 = 工具文案已含） */
  hint: string;
  /** 失败明细（「名：原因」，最多展示 3 行 + 汇总） */
  failures: string[];
}

/** 水位行文案：未导入 / 已导 N 条 · 画到日期 / · 未画脸谱 */
export function dsWatermark(row: DsRowState): string {
  if (!row.previewCount) return '未导入';
  const drawn = row.processedTs ? ` · 画到 ${formatDay(row.processedTs).slice(2)}` : ' · 未画脸谱';
  return `已导 ${formatCount(row.previewCount)} 条${drawn}`;
}

/** 四态行：有更新（fresh 高亮 + 新 N 条）/ 无更新 / 未导入 / 群聊禁勾 */
export function dsRow(row: DsRowState, on: boolean): HTMLElement {
  const fresh = row.newCount > 0;
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = on;
  cb.disabled = row.isGroup;
  cb.setAttribute('data-people-ds-check', row.name);
  const cls = `bz-people-ds-row${on ? ' bz-people-ds-on' : ''}${fresh ? ' bz-people-ds-fresh' : ''}${row.isGroup ? ' bz-people-ds-off' : ''}`;
  return el('label', cls, [
    cb,
    row.avatar
      ? el('img', 'bz-people-ds-ava bz-people-ds-ava-img', { src: avatarUri(row.avatar), alt: row.name })
      : el('div', 'bz-people-ds-ava', { style: `background:${avatarColor(row.name)}` }, text(initials(row.name))),
    el('div', 'bz-people-ds-main', [
      el('div', 'bz-people-ds-name', text(row.name + (row.isGroup ? '（群）' : ''))),
      el('div', 'bz-people-ds-meta', text([
        `${formatCount(row.rawCount)} 条`,
        row.media,
      ].filter(Boolean).join(' · '))),
    ]),
    el('div', 'bz-people-ds-side', [
      ...(fresh ? [el('span', 'bz-people-ds-new', text(`新 ${row.newCount} 条`))] : []),
      el('span', 'bz-people-ds-mark', text(dsWatermark(row))),
    ]),
  ]);
}

/** 数据源弹窗整体（面板内弹层内容；遮罩点击/关闭钮走 ui 委托） */
export function dsModal(s: DsModalState): HTMLElement {
  const wrap = el('div', 'bz-people-ds-pop', { 'data-people-ds-pop': '' });
  wrap.appendChild(el('div', 'bz-people-ds-dim', { 'data-people-ds-dim': '' }));
  const pop = el('div', 'bz-people-ds-panel', { role: 'dialog', 'aria-label': '数据源' });
  // 右上角动作位（issue 465：语义从「重读目录」升级为「同步——从微信重新取数」；
  // 运行中该位置只出「停止」，绝不与「同步」并列——互斥动作不并列）
  const syncBtn = s.syncing
    ? button('bz-people-btn bz-people-btn-ghost bz-people-ds-syncbtn', '停止', {
      'data-people-ds-sync-stop': '',
      'aria-label': '停止同步',
      title: '停止同步——已导出的部分保留，重跑可续传',
    })
    : button('bz-people-btn bz-people-btn-ghost bz-people-ds-syncbtn', '同步', {
      'data-people-ds-sync': '',
      'aria-label': '同步',
      title: '从微信重新解密并导出，需要微信已登录',
    });
  pop.appendChild(el('div', 'bz-people-ds-head', [
    el('div', 'bz-people-ds-title', text('数据源')),
    el('div', 'bz-people-ds-headmeta', text([
      s.syncing ? '正在同步…' : s.scanning ? '正在扫描…' : s.rows ? `${s.rows.length} 位联系人` : '',
      s.hiddenGroups > 0 ? `${s.hiddenGroups} 个群聊未纳入` : '',
    ].filter(Boolean).join(' · '))),
    syncBtn,
  ]));
  pop.appendChild(el('div', 'bz-people-ds-path', text(s.dataDir || '尚未配置数据根目录——到「设置 → 脸谱」粘贴预处理导出目录。' + (s.scannedAt ? ` · 扫描于 ${s.scannedAt}` : ''))));
  // 同步进度行（弹窗内一条：主文案 + 百分比条 + 副文案 + 失败明细 + 下一步动作）
  if (s.sync) pop.appendChild(dsSyncLineNode(s.sync));

  if (s.desktopOnly) {
    pop.appendChild(el('div', 'bz-people-ds-empty', text('数据源扫描仅桌面端支持（需要读取库外文件夹）。')));
  } else if (s.scanning) {
    pop.appendChild(el('div', 'bz-people-ds-empty', text('正在扫描数据根目录…')));
  } else if (!s.rows) {
    pop.appendChild(el('div', 'bz-people-ds-empty', text('还没扫描。点右上「同步」从微信取数，或等同步完成后自动刷新。')));
  } else if (!s.rows.length) {
    pop.appendChild(el('div', 'bz-people-ds-empty', text(
      s.hiddenGroups > 0
        ? `没有可导入的单聊（另有 ${s.hiddenGroups} 个群聊未纳入，可在设置开启）。`
        : '数据根目录里没有找到联系人（各联系人目录下需有 chat.json）。'
    )));
  } else {
    const list = el('div', 'bz-people-ds-list');
    for (const r of s.rows) list.appendChild(dsRow(r, s.selected.includes(r.name)));
    pop.appendChild(list);
    const hasFresh = s.rows.some((r) => r.newCount > 0);
    pop.appendChild(el('div', 'bz-people-ds-legend', [
      el('span', '', [el('i', 'bz-people-dot bz-people-dot-ok'), text('有更新')]),
      el('span', '', [el('i', 'bz-people-dot bz-people-dot-idle'), text('已导无更新')]),
      el('span', '', [el('i', 'bz-people-dot bz-people-dot-none'), text('未导入')]),
      ...(hasFresh ? [button('bz-people-ds-pickfresh', '勾有更新的', { 'data-people-ds-pickfresh': '' })] : []),
    ]));
  }

  // 页脚（issue 465：同步进行中「导入所选 / 画脸谱」置灰——数据根与聊天仓的输入都在变）
  const foot = el('div', 'bz-people-ds-foot', [
    el('span', 'bz-people-ds-count', { 'data-people-ds-count': '' }, text(footerLabel(s))),
    ...(s.generateable && !s.importing
      ? [button('bz-people-btn bz-people-btn-acc', '画脸谱', s.syncing
        ? { 'data-people-ds-generate': '', disabled: '', title: '同步进行中——完成后可画脸谱' }
        : { 'data-people-ds-generate': '', title: '关闭弹窗，用预览素材生成脸谱' })]
      : []),
    button('bz-people-btn bz-people-btn-acc', s.importing ? '导入中…' : '导入所选', s.syncing
      ? { 'data-people-ds-import': '', disabled: '', title: '同步进行中——完成后可导入' }
      : { 'data-people-ds-import': '' }),
  ]);
  pop.appendChild(foot);
  if (s.notice) pop.appendChild(el('div', 'bz-people-ds-notice', { 'data-people-ds-notice': '' }, text(s.notice)));
  wrap.appendChild(pop);
  return wrap;
}

/**
 * 同步进度行（issue 465 / ADR-0196 决策 6：弹窗内一条进度行，不占画像生成的进度块）。
 * 主行带原位更新钩子（data-people-ds-sync-line / -text / -sub / -bar）：运行中逐帧只换
 * 文本与条宽，不重建弹窗。钩子与右上角「同步」按钮（data-people-ds-sync）刻意区分——
 * 按钮钩子归属点击委托，进度行不该命中它。
 */
export function dsSyncLineNode(line: DsSyncLine): HTMLElement {
  const mod = line.status === 'running' ? 'run' : line.status === 'error' ? 'err' : line.status === 'stopped' ? 'stop' : 'done';
  const row = el('div', `bz-people-ds-syncline bz-people-ds-syncline-${mod}`, { 'data-people-ds-sync-line': '' });
  row.appendChild(el('div', 'bz-people-ds-sync-head', [
    el('span', 'bz-people-ds-sync-text', { 'data-people-ds-sync-text': '' }, text(line.text + (line.pct != null ? ` ${line.pct}%` : ''))),
  ]));
  if (line.status === 'running' && line.pct != null) {
    row.appendChild(el('div', 'bz-people-ds-sync-track', [
      el('div', 'bz-people-ds-sync-bar', { 'data-people-ds-sync-bar': '', style: `width:${Math.max(0, Math.min(100, line.pct))}%` }),
    ]));
  }
  // 副文案节点恒渲染（空时 hidden）：运行中原位更新要能找到它——首帧 sub 为空也会来帧
  const subNode = el('div', 'bz-people-ds-sync-sub', { 'data-people-ds-sync-sub': '' }, text(line.sub));
  if (!line.sub) subNode.hidden = true;
  row.appendChild(subNode);
  const shown = line.failures.slice(0, 3);
  for (const f of shown) row.appendChild(el('div', 'bz-people-ds-sync-fail', text(f)));
  if (line.failures.length > 3) row.appendChild(el('div', 'bz-people-ds-sync-fail', text(`等共 ${line.failures.length} 位失败——重跑同步只补失败项`)));
  if (line.hint) row.appendChild(el('div', 'bz-people-ds-sync-hint', text(line.hint)));
  return row;
}

function footerLabel(s: DsModalState): string {
  if (!s.rows) return '';
  if (!s.selectedCount) return '未勾选联系人';
  return s.freshCount
    ? `已选 ${s.selectedCount} 位 · 新素材 ${s.freshCount} 条`
    : `已选 ${s.selectedCount} 位 · 所选暂无新素材`;
}

/** 导入记录 meta（数据折头） */
export function importMeta(rec: ImportRecord, textMsgs: number): string {
  return `${rec.timeFrom.slice(0, 7)} ~ ${rec.timeTo.slice(0, 7)} · 共 ${formatCount(textMsgs)} 条文本（形态占比含图片/语音等全部消息形态）`;
}
