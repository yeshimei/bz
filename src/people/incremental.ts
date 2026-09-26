/**
 * 增量提炼纯逻辑（issue 441 / 评审 443）：「哪条消息算新」的判定与素材合并去重——
 * 无 DOM 的纯函数，ui 层只做编排（issue 439-441 评审：核心判定必须有单测，故自成模块）。
 *
 * 增量模式（提炼层 buildFace / buildFaceIncremental 只管给定消息集合，判定留在本层）：
 * - full  首次导入（无锚点）→ 全量提炼（ui 层走 digest.buildFace）。
 * - newer 只把 ts ≥ lastProcessedTs（同秒容差）的消息送提炼；更早的不重复烧 token（提示条数）。
 * - older 全部消息都严格早于锚点且指纹对不上（内容不同的补充导出 / 补录老数据）→ 仍提炼并提示，不静默丢。
 * - skip  同一份导出再导（整份指纹＝条数 + 跨度已在导入记录里）→ 不调用 AI，提示「没有新消息」。
 */
import {
  buildBondPrompt,
  buildChroniclePrompt,
  buildPersonPrompt,
  buildProfileNote,
  chunkMetaOf,
  chunkMessages,
  evenlySample,
  extractBatch,
  mergeBatches,
  toPortraitMaterial,
  sampleWarnOf,
  MATERIAL_LIMITS,
  type AskLLM,
  type BatchExtract,
  type BuiltFace,
  type FaceRunOptions,
  type MergedMaterial,
} from './digest';
import type { FaceDigest, FaceEvent, ManualEvent, PersonEntry, PersonProfile, UnifiedMessage } from './types';

export type IncrementalPlan = {
  mode: 'full' | 'newer' | 'older' | 'skip';
  /** 将送提炼的消息（skip 为空） */
  msgs: UnifiedMessage[];
  /** 早于锚点、本次不重复提炼的条数（newer 模式供提示） */
  olderCount: number;
};

/** 增量计划（组内消息按 ts 升序，parse 层保证；调用方保证 msgs 非空） */
export function planIncremental(msgs: UnifiedMessage[], existing: PersonEntry | undefined): IncrementalPlan {
  const anchor = existing?.lastProcessedTs;
  if (!anchor) return { mode: 'full', msgs, olderCount: 0 };
  // 先过整份指纹（评审 P2-1）：条数与跨度都已在导入记录里 = 同一导出再导 → skip。
  // 只看「尾锚点重合」会误伤结尾重合但内容不同的导出（如另存的一段历史），那些必须继续往下判。
  const from = new Date(msgs[0].ts).toISOString();
  const to = new Date(msgs[msgs.length - 1].ts).toISOString();
  const dup = existing.imports.some((r) => r.messageCount === msgs.length && r.timeFrom === from && r.timeTo === to);
  if (dup) return { mode: 'skip', msgs: [], olderCount: msgs.length };
  // 同秒容差（评审 P2-1）：ts ≥ anchor（即 > anchor - 1）都算新素材——秒级导出里与锚点同秒的消息不丢
  const newer = msgs.filter((m) => m.ts > anchor - 1);
  if (newer.length) return { mode: 'newer', msgs: newer, olderCount: msgs.length - newer.length };
  // 全部严格早于锚点且指纹对不上：内容不同的补充导出 → 按补录提炼，不静默丢
  return { mode: 'older', msgs, olderCount: 0 };
}

/**
 * 新批素材并入旧脸谱（issue 450 抽出的合并单源，buildFaceIncremental 与 jobs 引擎共用）：
 * 旧在前合并去重——同键旧条目优先、新批的轻重标记（kind）回填；不抽样（抽样在 digest.toPortraitMaterial）。
 * interests / threads（issue 455）：旧 digest 无此字段时从空起（老数据不丢、新批照常并入）。
 */
export function mergeWithOld(merged: MergedMaterial, old: FaceDigest | undefined): MergedMaterial {
  return {
    events: dedupeEvents([...(old?.events ?? []), ...merged.events]),
    quotes: dedupeByText([...(old?.quotes ?? []), ...merged.quotes], (q) => q.text),
    moments: dedupeByText([...(old?.moments ?? []), ...merged.moments], (m) => m.summary),
    traits: dedupeByText([...(old?.traits ?? []), ...merged.traits], (t) => t),
    interests: dedupeByText([...(old?.interests ?? []), ...merged.interests], (i) => i.topic),
    threads: dedupeByText([...(old?.threads ?? []), ...merged.threads], (t) => t.text),
  };
}

/**
 * 增量 / 补录提炼（ui 层编排调用；digest.buildFace 保持「只管给定消息集合」的通用性）：
 * 新消息分批采集 → 与旧脸谱的事件 / 原话 / 场景 / 特质 / 兴趣 / 未竟合并去重 → 用合并后素材重画双卷与时间线。
 * 去重口径与 digest.ts 一致：事件按 ts|summary 且 kind 回填、其余按文本键（合并单源 mergeWithOld）；
 * 送 prompt 的素材超限按时间跨度均匀抽样（evenlySample 首尾必保）——合并去重后旧素材
 * 不再把新素材挤出头部（评审 P2-1 同号的 P1-1：此前 slice 留头，旧素材满额时新素材全丢）。
 * 上限统一取 digest 的 MATERIAL_LIMITS（quotes 60 / moments 40 / traits 30 / interests 40 / threads 30 / chronicle 300）；
 * 落盘的 digest.events 保持全量，抽样只影响送 prompt 与落盘的 moments / traits / quotes / interests / threads 口径
 * （issue 449 缺陷修复：moments / traits 此前只吃新批且不落盘，增量一次旧「共同记忆 / 表达 DNA」全丢）。
 * mediaNote（issue 445）：媒体素材清单说明，ui 层传跨导入累计口径（本层消息只是新切片，自算会少算）；
 * statsNote（issue 449）：互动统计叙述段，同样由 ui 层按聊天仓最新 insights 生成后透传；
 * profile（issue 455）：手动档案，转档案段进两卷 prompt；sampleWarn（issue 455）缺省按本层消息量自算，
 * 增量场景建议调用方按全量消息数覆盖（本层只见到新切片）。
 * opts（issue 450 收拢旧位置参数）：onProgress 阶段化进度、onMaterial 中间计数（合并后、抽样前）。
 * 调用数 = 批数 + 3（其人 + 我们 + 时间线），与成本预告口径一致。
 */
export async function buildFaceIncremental(
  askExtract: AskLLM,
  askPortrait: AskLLM,
  msgs: UnifiedMessage[],
  name: string,
  old: FaceDigest | undefined,
  opts: FaceRunOptions = {}
): Promise<BuiltFace> {
  const { mediaNote, statsNote, profile, sampleWarn: warnOverride, onProgress, onMaterial } = opts;
  const chunks = chunkMessages(msgs);
  if (!chunks.length) throw new Error('没有可提炼的文本消息');
  const batches: BatchExtract[] = [];
  for (let i = 0; i < chunks.length; i++) {
    batches.push(await extractBatch(askExtract, chunks[i], name));
    onProgress?.({ stage: 'extracting', done: i + 1, total: chunks.length, current: chunkMetaOf(chunks[i]) });
  }
  const merged = mergeWithOld(mergeBatches(batches), old);
  onMaterial?.({ events: merged.events.length, quotes: merged.quotes.length, moments: merged.moments.length, traits: merged.traits.length });
  const material = toPortraitMaterial(merged, {
    mediaNote,
    statsNote,
    profileNote: buildProfileNote(profile) || undefined,
    sampleEvents: true,
  });
  const sampleWarn = warnOverride ?? sampleWarnOf(msgs.length);
  onProgress?.({ stage: 'person', done: 0, total: 1 });
  const person = (await askPortrait(buildPersonPrompt(name, material, sampleWarn))).trim();
  if (!person) throw new Error('卷一《其人》生成为空');
  onProgress?.({ stage: 'bond', done: 0, total: 1 });
  const bond = (await askPortrait(buildBondPrompt(name, material, sampleWarn))).trim();
  if (!bond) throw new Error('卷二《我们》生成为空');
  // 时间线是次要产物：失败不阻断双卷（与 digest.buildFace 同口径）
  let chronicle = '';
  if (merged.events.length) {
    onProgress?.({ stage: 'chronicle', done: 0, total: 1 });
    try {
      chronicle = (await askPortrait(buildChroniclePrompt(name, evenlySample(merged.events, MATERIAL_LIMITS.chronicle), mediaNote, statsNote))).trim();
    } catch {
      chronicle = '';
    }
  }
  return {
    person,
    bond,
    chronicle,
    events: merged.events,
    quotes: material.quotes,
    moments: material.moments,
    traits: material.traits,
    interests: material.interests,
    threads: material.threads,
  };
}

/** 事件合并去重：key = ts|summary，后出现的轻重标记回填（与 digest.ts mergeEvents 同口径）；结果按日期升序 */
export function dedupeEvents(events: FaceEvent[]): FaceEvent[] {
  const byKey = new Map<string, FaceEvent>();
  for (const e of events) {
    const key = `${e.ts}|${e.summary}`;
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, e);
    else if (!prev.kind && e.kind) byKey.set(key, { ...prev, kind: e.kind });
  }
  return [...byKey.values()].sort((a, b) => a.ts.localeCompare(b.ts));
}

/** 按键去重只留首个，保持输入顺序（与 digest.ts dedupeBy 同口径） */
export function dedupeByText<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/** 手动随手记并入脸谱事件（重画时送进时间线与事件列表）：ts|summary 去重后按 ts 排序 */
export function mergeManualEvents(events: FaceEvent[], manual: ManualEvent[] | undefined): FaceEvent[] {
  if (!manual?.length) return events;
  const seen = new Set(events.map((e) => `${e.ts}|${e.summary}`));
  const extra = manual
    .map((m) => ({ ts: m.ts, summary: m.summary }))
    .filter((e) => e.ts && e.summary && !seen.has(`${e.ts}|${e.summary}`));
  if (!extra.length) return events;
  return [...events, ...extra].sort((a, b) => a.ts.localeCompare(b.ts));
}
