/**
 * 脸谱渲染纯层（issue 447 / 450 / 451 / ADR-0104 markup 单源）：面板壳 / 折子封面墙 / 详情折页册 /
 * 数据源弹窗 / 档案与随手记 / 互动数据的 markup 全部在此，ui.ts 与评审壳共用同一份。
 * 纯度：零值 import（仅 type import，render-purity 守卫剥离后 import 图为空）——
 * DOM 构建走本文件自持 helper；时间文案由调用方算好注入，本层只拼字符串。
 * 折子语义（G 案拍板）：一人一册——封面竖排姓名 + 修复印章；详情五折（画像/事件/大事记/数据/档案），
 * 收起折显竖排引文，点折脊展开。真实数据形态适配：竖排名 >7 字截断（实测最长 37 字）、
 * 零媒体不出徽章（74% 联系人零语音）、消息量级万格式化（max 20,773）。
 */
import type { ImportRecord, PersonEntry, PersonProfile } from './types';

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
 * 旧数据没有中位数字段 → 回落平均值；0 = 无样本，原样透传由 formatReplySec 出占位。
 */
export function replyLatencySec(median: number | undefined, avg: number): number {
  return median ?? avg;
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

/** 面板壳：头行（brand + 数据源图标）+ 统计行 + 生成进度块槽位 + body + 数据源弹层容器 */
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
  /** 已完成成文阶段数（画像 / 时间线，0~2） */
  stagesDone: number;
  /** 队列位置（1 起）与总人数 */
  queueIndex: number;
  queueTotal: number;
  /** error 态错误说明 */
  errorText?: string;
}

/** 进度百分比（issue 450 口径）：(已完成批 + 已完成成文阶段) / (总批数 + 2)，钳 0~100 */
export function jobsPercent(batchesDone: number, batchesTotal: number, stagesDone: number): number {
  const denom = (batchesTotal > 0 ? batchesTotal : 0) + 2;
  const numer = Math.max(0, batchesDone || 0) + Math.max(0, stagesDone || 0);
  return Math.min(100, Math.round((numer / denom) * 100));
}

/** 阶段键 → 已完成成文阶段数：时间线进行中 = 画像已完成（1）；done = 2；其余 0 */
export function jobsStagesDone(stage: string | undefined, status: JobsUiStatus): number {
  if (status === 'done') return 2;
  return stage === 'chronicle' ? 1 : 0;
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
  error: { label: '删除任务', hook: 'data-people-jobs-dismiss' },
  done: null,
};

/**
 * 进度块（面板头统计行下）：细进度条 + 引擎主文案 + 队列副文案 + 灰字说明 + 状态动作钮。
 * 主文案整句展示（切批 / 抽样说明可能是长句）：不截断、允许换行（样式 overflow-wrap）。
 */
export function progressBlock(s: JobsBlockState): HTMLElement {
  const pct = jobsPercent(s.batchesDone, s.batchesTotal, s.stagesDone);
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
  block.appendChild(el('div', 'bz-people-jobs-main', text(s.message || jobsFallbackMessage(s.status, s.name))));
  block.appendChild(el('div', 'bz-people-jobs-queue', text(jobsQueueLabel(s.queueIndex, s.queueTotal, s.name))));
  block.appendChild(el('div', 'bz-people-jobs-note', text('生成在后台继续，关掉面板不会中断；重开面板回到这里看进度。')));
  const action = JOBS_ACTIONS[s.status];
  const foot: HTMLElement[] = [];
  if (s.status === 'error' && s.errorText) foot.push(el('span', 'bz-people-jobs-err', text(s.errorText)));
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
  /** 已完成成文阶段数（画像 / 时间线，0~2） */
  stagesDone: number;
  /** 失败态可否断点续跑：漂移类失败（消息集已变）接不上，只能重新生成 */
  resumable: boolean;
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
      const pct = jobsPercent(job.batchesDone, job.batchesTotal, job.stagesDone);
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

/**
 * 折子封面卡（issue 447 / 451）：竖排姓名 + 关系标签 + 消息量 + 修复印章（四态）。
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
  const card = el('div', 'bz-people-fold', [
    el('div', 'bz-people-fold-inner', [
      foldSealNode(p, opts.job ?? null),
      el('div', 'bz-people-fold-title vt', { title: p.name }, text(vtName(p.name))),
      // 无关系、无跨度时不再兜底「N 条」——meta 行已有同一数字，卡面重复（448 评审 P2）
      el('div', 'bz-people-fold-who', text(rel || (span ? span : '新折'))),
      el('div', 'bz-people-fold-meta', text([
        total ? `${formatCount(total)} 条` : '尚无消息',
        label,
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

export type FoldId = 'p' | 'e' | 'c' | 'd' | 'f';

const FOLD_TITLES: Array<[FoldId, string, string]> = [
  ['p', '画像', '画像与代表原话'],
  ['e', '事件', '交往事件与随手记'],
  ['c', '大事记', '关系时间线'],
  ['d', '数据', '互动统计与媒体'],
  ['f', '档案', '人物档案'],
];

export interface FoldDetailOpts {
  fold: FoldId;
  media: MediaShape | null;
  profEdit: boolean;
  noteAdd: boolean;
}

export interface FoldDetailHeadOpts {
  /** 未生成脸谱 → 出「画脸谱」 */
  canGenerate: boolean;
}

/** 详情头：印章字 + 名 + meta + 统计 + 水位印 + 图标工具条（画脸谱/返回列表） */
export function foldDetailHead(p: PersonEntry, media: MediaShape | null, opts: FoldDetailHeadOpts): HTMLElement {
  const total = p.imports.reduce((s, r) => s + r.messageCount, 0);
  const label = mediaLabel(media);
  const voice = media?.voiceCount ?? 0;
  return el('div', 'bz-people-dt-head', [
    el('div', 'bz-people-dt-seal', { style: `background:${avatarColor(p.name)}` }, text(initials(p.name))),
    el('div', 'bz-people-dt-id', [
      el('div', 'bz-people-dt-name', text(p.name)),
      el('div', 'bz-people-card-meta', text([
        total ? `${formatCount(total)} 条消息 · ${p.imports.length} 次导入` : '尚无导入',
        p.digest ? `脸谱生成于 ${p.digest.generatedAt.slice(0, 10)}` : '脸谱未生成',
      ].join(' · '))),
      ...(label ? [el('div', 'bz-people-media-badge', text(label))] : []),
    ]),
    el('div', 'bz-people-dt-nums', [
      el('div', '', [el('div', 'bz-people-dt-n', text(formatCount(total))), el('div', 'bz-people-dt-t', text('消息'))]),
      el('div', '', [el('div', 'bz-people-dt-n', text(voice ? String(voice) : '—')), el('div', 'bz-people-dt-t', text(voice ? `语音 · ${formatDuration(media?.voiceTotalSec ?? 0)}` : '语音'))]),
      el('div', '', [el('div', 'bz-people-dt-n', text(media?.imageCount ? String(media.imageCount) : '—')), el('div', 'bz-people-dt-t', text('图片'))]),
    ]),
    p.lastProcessedTs
      ? el('div', 'bz-people-dt-watermark', { title: '脸谱已提炼到这天的消息；之后的新消息再导入会增量补画' }, text(`已画到 ${formatDay(p.lastProcessedTs)}`))
      : el('div', 'bz-people-dt-watermark bz-people-dt-watermark-todo', text('未画脸谱')),
    el('div', 'bz-people-dt-actions', [
      ...(opts.canGenerate ? [iconButton('paintbrush', 'bz-people-btn bz-people-btn-ghost bz-people-icon-btn', { 'data-people-generate-one': '', 'aria-label': '画脸谱', title: '画脸谱（用已导入的消息生成）' })] : []),
      iconButton('arrow-left', 'bz-people-btn bz-people-btn-ghost bz-people-icon-btn', { 'data-people-back-btn': '', 'aria-label': '返回列表', title: '返回列表' }),
    ]),
  ]);
}

/** 折页册：五折；fold = 当前展开折，其余收起显竖排引文 */
export function foldBook(p: PersonEntry, opts: FoldDetailOpts, bodies: Record<FoldId, HTMLElement[]>, spills: Record<FoldId, string>): HTMLElement {
  const book = el('div', 'bz-people-book', { 'data-people-book': '' });
  for (const [id, title] of FOLD_TITLES) {
    const on = opts.fold === id;
    // 切换钩子挂整片折页（收起折点竖排引文区也能切）；展开折不带——防吞折内按钮点击
    const leaf = el('div', `bz-people-leaf${on ? ' bz-people-leaf-on' : ''}`, on
      ? { 'data-people-leaf': id }
      : { 'data-people-leaf': id, 'data-people-leaf-head': id });
    leaf.appendChild(el('div', 'bz-people-leaf-spine', { 'aria-hidden': 'true' }));
    leaf.appendChild(el('div', 'bz-people-leaf-head', [
      el('span', 'bz-people-leaf-zh', text(title)),
      el('span', 'bz-people-leaf-cnt', text(spillMeta(p, id))),
    ]));
    if (on) {
      const body = el('div', 'bz-people-leaf-body');
      for (const node of bodies[id] ?? []) body.appendChild(node);
      leaf.appendChild(body);
    } else {
      leaf.appendChild(el('div', 'bz-people-leaf-spill vt', text(spills[id] || title)));
    }
    book.appendChild(leaf);
  }
  return book;
}

/** 折脊 meta 小字（各折条数概览） */
function spillMeta(p: PersonEntry, id: FoldId): string {
  switch (id) {
    case 'p': return p.digest?.portrait ? '修' : '空';
    case 'e': return `${p.digest?.events.length ?? 0} 事${(p.manualEvents?.length ?? 0) ? ` · ${p.manualEvents!.length} 记` : ''}`;
    case 'c': return p.digest?.chronicle ? '编年' : '空';
    case 'd': return p.imports.length ? `${p.imports.length} 次导入` : '—';
    case 'f': return profileFilled(p.profile) ? '有档' : '补档';
  }
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

/** 画像折正文：画像 mini markdown + 代表原话 */
export function foldPortraitBody(mdRoot: HTMLElement, p: PersonEntry): HTMLElement[] {
  const out: HTMLElement[] = [mdRoot];
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

/** 事件折正文：交往事件 + 随手记（含录入行；today = 录入行默认日期） */
export function foldEventsBody(p: PersonEntry, noteAdd: boolean, today: string): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (p.digest?.events.length) {
    const events = el('div', 'bz-people-events');
    for (const ev of p.digest.events) {
      events.appendChild(el('div', `bz-people-event${ev.kind === 'major' ? ' bz-people-event-major' : ''}`, [
        el('span', 'bz-people-event-ts', text(ev.ts)),
        el('span', 'bz-people-event-dot'),
        el('span', 'bz-people-event-summary', text(ev.summary)),
      ]));
    }
    out.push(events);
  } else {
    out.push(el('div', 'bz-people-empty-hint', text('还没有交往事件。导入聊天生成脸谱后会提炼出来。')));
  }
  const evs = p.manualEvents ?? [];
  if (noteAdd) out.push(noteAddRow(today));
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
  out.push(el('div', 'bz-people-prof-entry', [
    ...(noteAdd ? [] : [button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '记一笔', { 'data-people-note-add': '' })]),
  ]));
  return out;
}

/** 大事记折正文：chronicle mini markdown（空态兜底） */
export function foldChronicleBody(mdRoot: HTMLElement | null): HTMLElement[] {
  return mdRoot ? [mdRoot] : [el('div', 'bz-people-empty-hint', text('还没有关系时间线。重画脸谱后会生成。'))];
}

/** 数据折正文：互动数据卡（由调用方组装；含导入记录 meta 与旧数据占位） */
export function foldDataBody(card: HTMLElement | null, p: PersonEntry): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (card) out.push(card);
  else if (p.imports.length) out.push(el('div', 'bz-people-empty-hint', text('这次导入还没有互动统计（旧版数据）。从数据源再导入一次即可生成。')));
  else out.push(el('div', 'bz-people-empty-hint', text('还没有导入记录。')));
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
      button('bz-people-btn bz-people-btn-acc bz-people-btn-sm', '保存档案', { 'data-people-prof-save': '' }),
      button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '取消', { 'data-people-prof-cancel': '' }),
    ]),
  ]);
}

/** 档案折正文：编辑态/有档显卡，全空给入口行 */
export function foldProfileBody(p: PersonEntry, editing: boolean): HTMLElement[] {
  const out: HTMLElement[] = [];
  const hasProf = profileFilled(p.profile);
  if (hasProf || editing) out.push(editing ? profileEditor(p.profile) : profileView(p.profile));
  if (!hasProf && !editing) {
    out.push(el('div', 'bz-people-prof-entry bz-people-prof-entry-solo', [
      el('span', 'bz-people-prof-entry-hint', text('聊天之外的也可以记：')),
      button('bz-people-btn bz-people-btn-ghost bz-people-btn-sm', '补人物档案', { 'data-people-prof-new': '' }),
    ]));
  }
  return out;
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
export function miniMarkdown(md: string): HTMLElement {
  const root = el('div', 'bz-people-portrait');
  let list: HTMLUListElement | null = null;
  let quote: HTMLQuoteElement | null = null;
  const appendInline = (elm: HTMLElement, str: string): void => {
    const parts = str.split(/\*\*(.+?)\*\*/g);
    parts.forEach((part, i) => {
      if (!part) return;
      if (i % 2 === 1) elm.appendChild(textEl('strong', part));
      else elm.appendChild(document.createTextNode(part));
    });
  };
  for (const raw of String(md ?? '').replace(/```+/g, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { list = null; quote = null; continue; }
    if (line.startsWith('### ')) { list = null; quote = null; root.appendChild(textEl('h5', line.slice(4))); continue; }
    if (line.startsWith('## ')) { list = null; quote = null; root.appendChild(textEl('h4', line.slice(3))); continue; }
    if (line.startsWith('- ')) {
      quote = null;
      if (!list) { list = document.createElement('ul'); root.appendChild(list); }
      const li = document.createElement('li');
      appendInline(li, line.slice(2));
      list.appendChild(li);
      continue;
    }
    if (line.startsWith('>')) {
      list = null;
      if (!quote) { quote = document.createElement('blockquote'); root.appendChild(quote); }
      const p = document.createElement('p');
      appendInline(p, line.slice(1).replace(/^\s/, ''));
      quote.appendChild(p);
      continue;
    }
    list = null;
    quote = null;
    const p = document.createElement('p');
    appendInline(p, line);
    root.appendChild(p);
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
    el('div', 'bz-people-ds-ava', { style: `background:${avatarColor(row.name)}` }, text(initials(row.name))),
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
  pop.appendChild(el('div', 'bz-people-ds-head', [
    el('div', 'bz-people-ds-title', text('数据源')),
    el('div', 'bz-people-ds-headmeta', text([
      s.scanning ? '正在扫描…' : s.rows ? `${s.rows.length} 位联系人` : '',
      s.hiddenGroups > 0 ? `${s.hiddenGroups} 个群聊未纳入` : '',
    ].filter(Boolean).join(' · '))),
    iconButton('refresh-cw', `bz-people-btn bz-people-btn-ghost bz-people-icon-btn bz-people-ds-rescan${s.scanning ? ' bz-people-spin' : ''}`,
      { 'data-people-ds-scan': '', 'aria-label': s.scanning ? '扫描中' : '重扫', title: s.scanning ? '扫描中…' : '重扫' }),
  ]));
  pop.appendChild(el('div', 'bz-people-ds-path', text(s.dataDir || '尚未配置数据文件夹——到「设置 → 脸谱」粘贴预处理导出目录。' + (s.scannedAt ? ` · 扫描于 ${s.scannedAt}` : ''))));

  if (s.desktopOnly) {
    pop.appendChild(el('div', 'bz-people-ds-empty', text('数据源扫描仅桌面端支持（需要读取库外文件夹）。')));
  } else if (s.scanning) {
    pop.appendChild(el('div', 'bz-people-ds-empty', text('正在扫描数据文件夹…')));
  } else if (!s.rows) {
    pop.appendChild(el('div', 'bz-people-ds-empty', text('还没扫描。点右上刷新图标读取数据文件夹里的联系人。')));
  } else if (!s.rows.length) {
    pop.appendChild(el('div', 'bz-people-ds-empty', text(
      s.hiddenGroups > 0
        ? `没有可导入的单聊（另有 ${s.hiddenGroups} 个群聊未纳入，可在设置开启）。`
        : '数据文件夹里没有找到联系人（各联系人目录下需有 chat.json）。'
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

  const foot = el('div', 'bz-people-ds-foot', [
    el('span', 'bz-people-ds-count', { 'data-people-ds-count': '' }, text(footerLabel(s))),
    ...(s.generateable && !s.importing
      ? [button('bz-people-btn bz-people-btn-acc', '画脸谱', { 'data-people-ds-generate': '', title: '关闭弹窗，用预览素材生成脸谱' })]
      : []),
    button('bz-people-btn bz-people-btn-acc', s.importing ? '导入中…' : '导入所选', { 'data-people-ds-import': '' }),
  ]);
  pop.appendChild(foot);
  if (s.notice) pop.appendChild(el('div', 'bz-people-ds-notice', { 'data-people-ds-notice': '' }, text(s.notice)));
  wrap.appendChild(pop);
  return wrap;
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
