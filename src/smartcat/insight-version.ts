/**
 * 洞察版本化（ticket 092 方向二，ADR-0039）：反思洞察的「被推翻」语义 + 主题键 + 候选通道。
 *
 * 设计要点（086 v4 裁决逐条落地）：
 *  1. supersede 语义 = **排序前剔除**（二选一拍板：前置 filter 最简单且最稳——废弃洞察不进 GA
 *     加法分空间；αRel=1.5 下线性减项盖不住，乘法惩罚仍会挤占 top10 名额）。
 *     落点：memory.ts retrieve()/formatMemoriesForPrompt() 前置 isSupersededInsight 过滤；
 *     retrieve() 的 topN=10 与三处调用点是冻结契约，剔除只发生在排序管线内部。
 *  2. 主题键 = 受限枚举 工作|兴趣|关系|健康|环境（LLM 打标时从中选，解析失败回退词法关键词映射），
 *     杜绝自由措辞导致同主题多键；insight 条目可选字段 theme，旧数据零迁移。
 *  3. 候选既有洞察通道：reflect 时给 LLM 参照防重复结论——按「词法重叠 + 固定加权 + 新近」排序取
 *     Top-N（对齐 evidenceTop 窗口量级的裁剪思路），独立 token 预算（每条只注入 id+描述前 N 字，
 *     总字符预算封顶）；纯函数构造，异常由调用方裁剪为空块，不整轮失败、不共享反思退避。
 *  4. supersede 写点：reflect 的 LLM 输出顶层 {supersede: <候选编号|insightId>}（最多 1 个/批次）；
 *     校验 id 存在且 type=insight 才生效；pinned 保护 / 幂等 / 环形拒绝（visited 集）。
 *  5. DDID 短格式：洞察 id 太长，dashboard/展示层用短数字索引（buildInsightShortIndex），仅展示层。
 */
import type { MemoryStreamEntry } from './types';

/** 主题键受限枚举（v4 裁决：五选一；LLM 解析失败回退 THEME_KEYWORDS 词法映射） */
export const INSIGHT_THEMES = ['工作', '兴趣', '关系', '健康', '环境'] as const;
export type InsightTheme = (typeof INSIGHT_THEMES)[number];

/** 词法映射表（LLM 打标失败/缺省时的兜底：description 关键词命中即归主题；无命中 → undefined 不强标） */
export const THEME_KEYWORDS: Record<InsightTheme, string[]> = {
  工作: ['工作', '上班', '加班', '项目', '会议', '代码', '编程', '任务', '上线', '需求', '老板', '同事加班', '复盘'],
  兴趣: ['游戏', '兴趣', '爱好', '电影', '影', '书', '读', '音乐', '追剧', '收藏', '爬山', '旅行', '摄影', '画画'],
  关系: ['朋友', '家人', '妈妈', '爸爸', '对象', '恋爱', '聊天', '聚会', '父母', '孩子', '伴侣', '室友'],
  健康: ['睡', '熬夜', '累', '生病', '感冒', '运动', '健身', '跑步', '体检', '焦虑', '情绪', '低落', '压力', '饮食'],
  环境: ['天气', '搬家', '房间', '城市', '出差', '通勤', '下雨', '降温', '台风', '装修', '噪音'],
};

/** 主题键枚举校验（对齐 H4 sanitizeEmotion 风格）：仅接受 INSIGHT_THEMES 键集内枚举，缺失/未知 → undefined */
export function sanitizeInsightTheme(value: unknown): InsightTheme | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  if (!v) return undefined;
  return (INSIGHT_THEMES as readonly string[]).includes(v) ? (v as InsightTheme) : undefined;
}

/** 词法主题兜底（纯函数）：关键词表顺序扫描（工作→兴趣→关系→健康→环境），命中即返回；无命中 → undefined */
export function lexicalTheme(description: string): InsightTheme | undefined {
  if (typeof description !== 'string' || !description) return undefined;
  const text = description.toLowerCase();
  for (const theme of INSIGHT_THEMES) {
    if (THEME_KEYWORDS[theme].some((k) => text.includes(k))) return theme;
  }
  return undefined;
}

/** 主题解析主入口：LLM 枚举值优先（白名单外一律丢弃），回退词法映射；两路皆空 → undefined（不强标） */
export function resolveTheme(llmRaw: unknown, description: string): InsightTheme | undefined {
  return sanitizeInsightTheme(llmRaw) ?? lexicalTheme(description);
}

/** 人工废弃标记（dashboard「废弃」按钮写点）：supersededBy='manual' 表示人工推翻、无后继洞察 */
export const MANUAL_SUPERSEDED_BY = 'manual';

/** 已废弃判定（检索剔除的唯一口径）：type=insight 且 supersededBy 为非空字符串（观察条目即使带脏字段也不受影响） */
export function isSupersededInsight(m: MemoryStreamEntry | null | undefined): boolean {
  if (!m || m.type !== 'insight') return false;
  return typeof m.supersededBy === 'string' && m.supersededBy.length > 0;
}

/**
 * 环形引用检测（纯函数）：将设置 target.supersededBy = replacementId（边 target→replacement），
 * 若沿 replacement 的 supersededBy 链能走回 target 则成环 → true。visited 集防既有环死循环。
 */
export function supersedeCreatesCycle(stream: MemoryStreamEntry[], targetId: string, replacementId: string): boolean {
  if (targetId === replacementId) return true; // 自指即环
  const byId = new Map(stream.map((m) => [m.id, m]));
  const visited = new Set<string>([replacementId]);
  let cur: string | undefined = replacementId;
  while (cur) {
    const next = byId.get(cur)?.supersededBy;
    if (!next || typeof next !== 'string') return false;
    if (next === targetId) return true;
    if (visited.has(next)) return false; // 既有环：走不出 target 也别死循环
    visited.add(next);
    cur = next;
  }
  return false;
}

/**
 * supersede 写点校验（092 设计第 4/5/7 条，纯函数直接改写 stream 条目）：
 *  - ref 解析：number → 候选短编号反查 indexMap；string → 真实 insight id（两者都支持）
 *  - 校验链：id 存在 且 type=insight 且非自指；pinned=true 拒绝（人工固定不被自动 supersede）；
 *    已被同一后继废弃 → 幂等 no-op 返回 true；已被其它后继废弃 → 拒绝；环形 → 拒绝
 *  - 生效：target.supersededBy = replacementId，返回 true；任何一步不过 → false（不改任何数据）
 */
export function applySupersede(
  stream: MemoryStreamEntry[],
  ref: unknown,
  replacementId: string,
  indexMap?: Map<number, string>,
): boolean {
  // ① ref → 目标 id
  let targetId: string | undefined;
  if (typeof ref === 'number' && Number.isFinite(ref)) targetId = indexMap?.get(ref);
  else if (typeof ref === 'string' && ref.trim()) targetId = ref.trim();
  if (!targetId) return false;
  // ② id 存在且 type=insight 才生效（观察条目/不存在 id 一律拒绝）
  const target = stream.find((m) => m.id === targetId);
  if (!target || target.type !== 'insight') return false;
  // ③ 自指拒绝（环形特例）
  if (targetId === replacementId) return false;
  // ④ pinned 保护：人工固定的洞察不接受自动 supersede
  if (target.pinned === true) return false;
  // ⑤ 幂等：同后继重复标记 no-op 成功；异后继拒绝（先到先得）
  if (typeof target.supersededBy === 'string' && target.supersededBy.length > 0) {
    return target.supersededBy === replacementId;
  }
  // ⑥ 环形拒绝（visited 集）
  if (supersedeCreatesCycle(stream, targetId, replacementId)) return false;
  target.supersededBy = replacementId;
  return true;
}

// ---------------- 候选既有洞察通道（reflect 防重复结论参照） ----------------

/** 候选通道参数（独立 token 预算；N 对齐 evidenceTop 窗口量级的裁剪思路，预算是硬约束） */
export const CANDIDATE_CONFIG = {
  /** 最多注入候选条数（evidenceTop=50 同量级思路；实际条数同时受总字符预算约束） */
  topN: 12,
  /** 每条只注入描述前 N 字（不全文） */
  clipChars: 40,
  /** 全部候选项合计字符预算封顶（不含头行说明）；超预算截停 */
  budgetChars: 600,
} as const;

/** 候选通道产出：block 直接拼进 reflect prompt（空列表 → ''）；indexMap 供 LLM 回传候选编号时反解真实 id */
export interface ReflectCandidates {
  block: string;
  count: number;
  indexMap: Map<number, string>;
}

/** 种子文本 → 关键词集（≥2 字、去重、上限 40 个，控成本） */
function seedKeywords(seedText: string): string[] {
  const raw = typeof seedText === 'string' ? seedText : '';
  const words = raw.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2);
  return Array.from(new Set(words)).slice(0, 40);
}

/**
 * 构造候选既有洞察块（纯函数，可测）：未废弃 insight 按「词法重叠降序 → 新近优先」排序，
 * 取前 topN 条编 C1..Cn，行格式 `C1[工作] 描述前40字`；累计超 budgetChars 即截停。
 * 防御式编码：字段非法一律跳过，绝不抛错——调用方（reflect）无需为它准备退避通道。
 */
export function buildReflectCandidates(
  stream: MemoryStreamEntry[],
  seedText: string,
  opts: { topN?: number; clipChars?: number; budgetChars?: number } = {},
): ReflectCandidates {
  const topN = Math.max(0, Math.floor(opts.topN ?? CANDIDATE_CONFIG.topN));
  const clipChars = Math.max(1, Math.floor(opts.clipChars ?? CANDIDATE_CONFIG.clipChars));
  const budgetChars = Math.max(0, Math.floor(opts.budgetChars ?? CANDIDATE_CONFIG.budgetChars));
  const kws = seedKeywords(seedText);
  const pool = (Array.isArray(stream) ? stream : []).filter((m) => m && m.type === 'insight' && !isSupersededInsight(m) && typeof m.description === 'string');
  const scored = pool.map((m) => {
    const desc = (m.description || '').toLowerCase();
    let hits = 0;
    for (const k of kws) if (desc.includes(k.toLowerCase())) hits++;
    return { m, hits };
  });
  scored.sort((a, b) => b.hits - a.hits || new Date(b.m.created || 0).getTime() - new Date(a.m.created || 0).getTime());
  const lines: string[] = [];
  const indexMap = new Map<number, string>();
  let used = 0;
  for (const s of scored) {
    if (lines.length >= topN) break;
    const theme = sanitizeInsightTheme(s.m.theme) ?? lexicalTheme(s.m.description) ?? '未分类';
    const line = `C${lines.length + 1}[${theme}] ${(s.m.description || '').slice(0, clipChars)}`;
    if (used + line.length > budgetChars && lines.length > 0) break; // 预算截停（至少保住第一条）
    used += line.length;
    indexMap.set(lines.length + 1, s.m.id as string);
    lines.push(line);
  }
  const block = lines.length
    ? '\n\n你既有的相关洞察（仅供对照，避免得出重复结论）：\n' + lines.join('\n') +
      '\n若本批结论推翻了某条旧洞察，在 JSON 顶层加 "supersede": 候选编号（如 2，最多 1 个）；没有则省略该字段。'
    : '';
  return { block, count: lines.length, indexMap };
}

// ---------------- DDID 展示层短索引 ----------------

/**
 * 洞察短数字索引（DDID 短格式，仅展示层）：全量洞察按 stream 出现顺序编 1..n（含已废弃，序号稳定可回溯）。
 * dashboard 用它把超长 insight_id 显示成 #7；不写盘、不影响数据层。
 */
export function buildInsightShortIndex(stream: MemoryStreamEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  let n = 0;
  for (const m of Array.isArray(stream) ? stream : []) {
    if (m && m.type === 'insight' && m.id) map.set(m.id, ++n);
  }
  return map;
}