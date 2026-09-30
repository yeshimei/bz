/**
 * 图片描述段（issue 470 / ADR-0196 决策 8、9；ADR-0197 决策 4）：画脸谱链的工具段（prep）
 * 之后、素材切批（chunked）之前的插件 AI 段——用 AI 面板当前服务商与模型给已关联进聊天仓的
 * 图片出描述，批级断点、逐批合并回聊天仓派生 text（`[图片] 描述`）。
 *
 * 分工：本文件只放**纯判定与缝**——批切分、上下文窗（首图前 1 小时 ~ 末图后 1 小时、
 * 上限 6000 字、超限按距图片时间远近裁两端）、prompt 组装、回执解析、派生档读图与
 * data URL 换算、断点账本形态；阶段编排（确认门 / 批循环 / safe.write 串行链）在 jobs.ts
 * 的 runDescribeStage。合并纯函数 applyImageDescToMsgs 在 datasource.ts（与
 * applyImageMapToMsgs / applyVoiceToMsgs 同族）。
 *
 * 边界（ADR-0195 / ADR-0197）：不调外部进程、不改写数据根；输入图只取工具产的派生档
 * `desc/`（长边 1280），不取原图、不取微信缩略图（约 120px 读不出截图里的字）。
 */
import { DEFAULT_AI_PROVIDER, getProviderDescriptor, imageDataUrl, imageMimeOfPath } from '../core/ai';
import { tryGetSettings } from '../core/settings-provider';
import { extractJsonLoose } from './digest';
import { SENSITIVE_SKIP, isDescSkipped, type StoreMsg } from './datasource';
import type { DescribeConfirmInfo } from './types';

// ---------------- 断点账本（PersonJob.describe；仿 PrepProgress 形态，纯元数据无原文） ----------------

/**
 * describe 段进度账本。权威在聊天仓（描述已合并 = 该图 text 非空），本账本供进度展示与
 * 「确认过 / 跳过过」的语义记忆（续跑不再重复弹确认——用户已授权过这次花费）。
 */
export interface DescribeProgress {
  /** 图片总数（建段时聊天仓口径） */
  imgCount: number;
  /** 每批张数（续跑按存储值重切批边界，不随设置漂移——同 chunkOpts 口径） */
  batchSize: number;
  /** 总批数 */
  totalBatches: number;
  /** 已完成批数（批内图片全部有描述；展示与重启后的进度行） */
  doneBatches: number;
  /** 用户已点过「开始」（续跑 / 重试不再二次弹确认） */
  confirmed?: boolean;
  /** 用户已选「跳过图片描述」（续跑不再问、不再描述；跳过 ≠ 取消——整链继续走到画像生成） */
  skipped?: boolean;
  /** 被服务商判敏感拒绝并已标注的张数（ADR-0224）。展示口径，权威在聊天仓的 descSkip */
  sensitive?: number;
  /**
   * 「有欠账、零可读」的张数（ADR-0225 决策 3）：本段一张派生档都没读动时的欠账数。
   * 有值即整段零调用收尾，交 runJob 结束任务并明确告知（不再往下烧画像调用）。
   */
  unreadable?: number;
}

/** 缺省每批张数（spec 用户故事 47：默认 20 张，可配） */
export const DESCRIBE_DEFAULT_BATCH_SIZE = 20;

/** 建段账本 */
export function newDescribeProgress(imgCount: number, batchSize: number): DescribeProgress {
  const size = clampBatchSize(batchSize);
  return { imgCount, batchSize: size, totalBatches: Math.ceil(imgCount / size), doneBatches: 0 };
}

/** 每批张数钳制（1~200；非法值回落缺省 20） */
export function clampBatchSize(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 1) return DESCRIBE_DEFAULT_BATCH_SIZE;
  return Math.min(200, Math.round(v));
}

/** 设置键 peopleDescBatchSize → 每批张数（未配置 / 非法回落缺省；数据层唯一读设置点） */
export function batchSizeFromSettings(): number {
  const s = (tryGetSettings() ?? {}) as Record<string, unknown>;
  return clampBatchSize(s.peopleDescBatchSize);
}

/** 账本防御性归一（旧落盘 / 外部改动的坏结构不炸引擎；无账本返回 null） */
export function describeOf(job: { describe?: DescribeProgress | null }): DescribeProgress | null {
  const d = job.describe;
  if (!d || typeof d !== 'object') return null;
  d.batchSize = clampBatchSize(d.batchSize);
  if (!Number.isFinite(d.imgCount) || (d.imgCount as number) < 0) d.imgCount = 0;
  if (!Number.isFinite(d.totalBatches) || (d.totalBatches as number) < 0) d.totalBatches = Math.ceil(d.imgCount / d.batchSize);
  if (!Number.isFinite(d.doneBatches) || (d.doneBatches as number) < 0) d.doneBatches = 0;
  return d;
}

// ---------------- 阶段文案（与 PREP_PHASE_LABELS 同词汇体系：`图片描述 3/82 批`） ----------------

/** describe 段的阶段标签（进度块阶段行 / job.message 同源） */
export const DESCRIBE_LABEL = '图片描述';

/** 阶段行文案：`图片描述 已完成批数/总批数 批` */
export function describeStageLine(done: number, total: number): string {
  return `${DESCRIBE_LABEL} ${Math.max(0, done)}/${Math.max(0, total)} 批`;
}

/** 段内总进度 0~100（进度条 / 印章共用；total=0 时不假报，返回 0） */
export function describeOverallPct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((Math.min(done, total) / total) * 100)));
}

// ---------------- 敏感拒绝识别（ADR-0224） ----------------
// 标注的取值与 isDescSkipped 在 datasource.ts（紧邻 StoreMsg，欠账口径与它同处）；此处只放
// 纯字符串判定——它不依赖仓结构，故留在描述段自己的文件里。

/**
 * 敏感拒绝识别（ADR-0224 决策 1）：服务商**明确说**内容敏感 / 不安全，且不是限流或服务端错。
 *
 * 启发式，**宁可漏判也不误判**——漏判只是退回既有「退避重试 → 耗尽报错」路径（用户可重试失败项），
 * 误判却会把一次网络抖动放大成 20 次逐张慢调用。故要求：①命中敏感关键词 ②不是 429/5xx。
 * 真实样本（issue 520 用户实测）：
 * `AI 请求失败: 系统检测到输入或生成内容可能包含不安全或敏感内容…（fallback: Request failed, status 400）`
 */
export function isSensitiveRefusal(message: string): boolean {
  if (!message) return false;
  if (!/(敏感|不安全|content[\s_-]*polic|sensitive|flagged|moderation)/i.test(message)) return false;
  return !/(^|[^0-9])(429|500|502|503|504)([^0-9]|$)/.test(message);
}

// ---------------- 图片集与批切分（聊天仓口径；确定性重导——批级断点的根基） ----------------

/** 一张待描述图片（聊天仓消息的投影；key 定位消息、img 定位派生档） */
export interface DescribeImageRef {
  key: string;
  /** 毫秒时间戳 */
  ts: number;
  /** 图片定位（`月/文件名`，与派生档 `desc/<月>/<名>.jpg` 同构） */
  img: string;
}

/**
 * 聊天仓 → 待描述图片集：type=3 且已关联 img（image_map 合并后的口径）。text 是否非空
 * **不在此过滤**——那是批的完成判定（全部有描述的批直接跳过），不是图片集的 membership。
 * 按 ts 升序（仓本就有序，防御性重排）。
 */
export function imageRefsOf(msgs: StoreMsg[]): DescribeImageRef[] {
  const out: DescribeImageRef[] = [];
  for (const m of msgs) {
    if (m.type !== 3) continue;
    const img = String(m.img ?? '').trim();
    if (!img) continue;
    out.push({ key: m.key, ts: m.ts, img });
  }
  return out.sort((a, b) => a.ts - b.ts || a.key.localeCompare(b.key));
}

/** 确定性切批：每批 batchSize 张（末批可少）；batchSize 非法按缺省钳制 */
export function describeBatches(refs: DescribeImageRef[], batchSize: number): DescribeImageRef[][] {
  const size = clampBatchSize(batchSize);
  const out: DescribeImageRef[][] = [];
  for (let i = 0; i < refs.length; i += size) out.push(refs.slice(i, i + size));
  return out;
}

// ---------------- 对话上下文窗（描述质量的关键：让模型知道「前后聊到哪」） ----------------

/** 上下文窗缺省参数：首图前 1 小时 ~ 末图后 1 小时；字符上限 6000（spec 图片描述小节） */
export const DESCRIBE_CONTEXT_DEFAULTS = { windowMs: 3600_000, maxChars: 6000 } as const;

export interface DescribeContextOpts {
  /** 时间窗半径（毫秒；缺省 1 小时） */
  windowMs?: number;
  /** 字符上限（缺省 6000） */
  maxChars?: number;
}

interface ContextLine {
  ts: number;
  text: string;
  len: number;
}

/** 发送者名：我 / 仓内 who / 对方 */
function contextNameOf(m: StoreMsg): string {
  if (m.isSender) return '我';
  const who = String(m.who ?? '').trim();
  return who || '对方';
}

/** 毫秒 → `HH:MM`（本地时区；对话行的可读时间头） */
function hhmm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 批的对话上下文（纯函数）：取时间线消息（text 非空）落在 [首图前 windowMs, 末图后 windowMs]
 * 的行，拼 `HH:MM 名：文本`（已有 `[成员名] ` 前缀 / 标签头的行不再叠名）；超字符上限时
 * **按距图片时间远近裁两端**——窗口里距图片跨度越远的行越先裁（前段裁最旧、后段裁最新，
 * 距离相同裁后端），图片跨度之内的行距离为 0、最后才可能被动到。只读不改入参。
 */
export function contextWindowOf(msgs: StoreMsg[], imgFromTs: number, imgToTs: number, opts: DescribeContextOpts = {}): string {
  const windowMs = opts.windowMs ?? DESCRIBE_CONTEXT_DEFAULTS.windowMs;
  const maxChars = Math.max(1, opts.maxChars ?? DESCRIBE_CONTEXT_DEFAULTS.maxChars);
  const from = imgFromTs - windowMs;
  const to = imgToTs + windowMs;
  const lines: ContextLine[] = [];
  for (const m of msgs) {
    const t = String(m.text ?? '');
    if (!t || m.ts < from || m.ts > to) continue;
    const line = t.startsWith('[') ? `${hhmm(m.ts)} ${t}` : `${hhmm(m.ts)} ${contextNameOf(m)}：${t}`;
    lines.push({ ts: m.ts, text: line, len: line.length });
  }
  if (!lines.length) return '';
  // 总字符 = 行长和 + 行间换行；裁掉一行减 len+1（连同其后的分隔符）
  let lo = 0;
  let hi = lines.length - 1;
  let total = lines.reduce((s, l) => s + l.len, 0) + (lines.length - 1);
  while (total > maxChars && hi >= lo) {
    const fd = Math.max(0, imgFromTs - lines[lo].ts); // 前端行距图片的远近（窗内图片跨度之前才算远）
    const bd = Math.max(0, lines[hi].ts - imgToTs);
    if (fd > bd) total -= lines[lo++].len + 1;
    else total -= lines[hi--].len + 1;
  }
  return lines.slice(lo, hi + 1).map((l) => l.text).join('\n');
}

// ---------------- prompt 与回执 ----------------

/** 图片描述的 AI 调用面：`{text, images}` 多模态输入（core/ai AIInput 的图片子集）→ 回执文本 */
export type AskDescribe = (input: { text: string; images: string[] }) => Promise<string>;

/**
 * 批描述 prompt（一组图合成一次调用，spec「批 20 张/次调用」）：JSON 契约
 * `{"descs":[...]}`，数组长度 = 图片张数；结合上下文理解、但只描述图片可见内容。
 */
export function buildDescribePrompt(imageCount: number, context: string): string {
  return [
    '你是聊天记录图片描述助手。接下来给你一批聊天里的图片（按对话时间顺序），请为每张图片写一条描述。',
    '只输出 JSON，不要任何解释、不要代码围栏：',
    `{"descs":["第1张的描述","第2张的描述"]}`,
    `硬约束：descs 数组长度必须等于图片张数 ${imageCount}，逐张对应、不得合并或省略。`,
    '描述要求：',
    '- 简体中文，1-2 句，客观说出图片里能看到的内容；截图类图片概括在聊什么、关键信息是什么（图中文字可提炼要点）。',
    '- 可借助对话上下文理解图片在说什么，但只写图片本身可见的内容，不臆测图中没有的事实与数字。',
    ...(context ? ['', '【对话上下文】', context] : []),
  ].join('\n');
}

/**
 * 回执解析（宽松取 JSON 单源 extractJsonLoose；契约不符抛可重试错误）：descs 数组长度必须
 * 等于图片张数。空串描述不在此判死（模型对读不出的图可能回空）——合并侧跳过空描述，不废整批。
 */
export function parseDescribeReply(raw: string, expect: number): string[] {
  const arr = (extractJsonLoose(raw) as { descs?: unknown } | null)?.descs;
  if (!Array.isArray(arr)) throw new Error('图片描述回执缺少 descs 数组');
  const out = arr.map((d) => String(d ?? '').trim());
  if (out.length !== expect) throw new Error(`图片描述数量不符（回 ${out.length} 条，应为 ${expect} 条）`);
  return out;
}

// ---------------- 派生档读图（fs 缝 + data URL 换算） ----------------

/** describe 段所需的最小 fs 面（读派生档字节；缺省桌面端 window.require('fs') 适配） */
export interface DescribeFs {
  readBytes(path: string): Uint8Array | null;
}

function defaultDescribeFs(): DescribeFs | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { require?: (id: string) => unknown };
  if (!w.require) return null;
  try {
    const fs = w.require('fs') as { readFileSync(p: string): Buffer };
    return {
      readBytes: (p) => {
        try {
          const buf = fs.readFileSync(p);
          return buf ? new Uint8Array(buf) : null;
        } catch {
          return null;
        }
      },
    };
  } catch {
    return null;
  }
}

let describeFsOverride: DescribeFs | null = null;

/** 测试注入缝：替换 / 还原 fs 假件（传 null 还原缺省实现） */
export function setDescribeFsForTests(fs: DescribeFs | null): void {
  describeFsOverride = fs;
}

function fso(): DescribeFs | null {
  return describeFsOverride ?? defaultDescribeFs();
}

/** 派生档绝对路径：`<数据根>/<联系人>/desc/<月>/<名>.jpg`（img 的 `月/文件名` 直接拼在 desc/ 下） */
export function descImagePath(dataRoot: string, talker: string, img: string): string {
  const base = `${dataRoot}/${talker}/desc/${String(img).trim()}`.replace(/\\/g, '/');
  return base.replace(/\/+/g, '/');
}

/**
 * 读一张派生档并换成 data URL（core/ai 多模态通道的输入形态）。读不动 / 格式不受支持 /
 * 空文件返回 null——调用方把该图从本批剔除（单条失败不废整批），绝不回落原图或微信缩略图。
 */
export function descDataUrlOf(dataRoot: string, talker: string, img: string): string | null {
  const fs = fso();
  if (!fs || !dataRoot || !talker) return null;
  const path = descImagePath(dataRoot, talker, img);
  const bytes = fs.readBytes(path);
  if (!bytes || !bytes.byteLength) return null;
  const mime = imageMimeOfPath(path);
  if (!mime) return null;
  try {
    return imageDataUrl(bytes, mime);
  } catch {
    return null;
  }
}

// ---------------- 确认窗数据（ADR-0196 决策 8：只报张数 / 批数 / 调用数，不报金额） ----------------

/** 当前 AI 面板的服务商显示名与生效模型（描述走它的多模态通道，不新增视觉档设置键） */
export function describeModelLabelOf(): { provider: string; model: string } {
  const s = (tryGetSettings() ?? {}) as Record<string, unknown>;
  const id = String(s.aiProvider ?? '') || DEFAULT_AI_PROVIDER;
  const desc = getProviderDescriptor(id);
  const model = String((s.aiModelOverrides as Record<string, string> | undefined)?.[id] ?? '') || desc.model || '默认模型';
  return { provider: desc.label, model };
}

