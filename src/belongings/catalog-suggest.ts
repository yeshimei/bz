/**
 * 归物本 · 物品归类编排（issue 478 阶段 B）：分类表优先，两次 Jev 选择 + 哨兵回落 LLM。
 *
 * 返回值语义（调用方据此分流）：
 * - 返回 `null` = 「没有表，走不了这条路」→ 调用方回落旧 LLM 自由生成；
 * - 抛错 = 「有表但这轮没成功」（含用户主动取消的 AbortError）→ 调用方内联提示。
 *   二者务必分清，不可混：null 是「正常分支切换」，抛错是「本轮失败」。
 *
 * 流程严格按序：本地别名直配 → Jev 选组（含哨兵）→ Jev 选类（含哨兵）→ LLM 表内回落。
 *
 * 为什么手写 try/catch 而不复用 `core/jev-fallback.ts` 的 `judgeOrFallback`：
 * `judgeOrFallback` 是「单题 → 单 parse → 单 fallback」的编排，fallback 内容在调用前即固定。
 * 本编排是**两题串行**——第一题（选组）的成败决定第二题（选类）的有无，且两题各自的 LLM
 * 回落候选集不同（选组失败 = 全表；选类失败 = 该组）。强行套 `judgeOrFallback` 要两次闭包
 * 共享「当前组」状态、fallback 取数随阶段变，反而难读且易错。故在此**手写** try/catch，
 * 但纪律与 `judgeOrFallback` 完全一致（ADR-0173 §2 / ADR-0181 四类不可用 + 取消不回落）：
 * ①未配置 ②请求失败 ③畸形答案 → 转 LLM 回落；④取消（signal.aborted）→ 抛 AbortError 不回落。
 */
import { createAI } from '../core/ai';
import { askJev, isJevConfigured, type JevResult } from '../core/jev';
import {
  loadCategoryTable,
  matchByAlias,
  groupMenu,
  itemMenu,
  iconOf,
  type CategoryItem,
  type CategoryTable,
} from '../core/category-table';

/** 哨兵项键（追加在 Jev 候选清单末尾，意为「以上都不合适」） */
const SENTINEL = '__other__';
/** 哨兵项展示文案 */
const SENTINEL_LABEL = '以上都不合适';

/** 取消异常（AbortError 语义；与 core/jev.ts / core/jev-fallback.ts 同义，各模块各持一份） */
function abortError(): Error {
  const e = new Error('归类请求已取消');
  e.name = 'AbortError';
  return e;
}

/** LLM 回落候选条目（category/icon 取自表，group 仅用于提示词展示） */
interface Candidate {
  category: string;
  icon: string;
  group: string;
}

/** 取组内某分类条目（找不到返回 null） */
function findItem(table: CategoryTable, groupId: string, itemId: string): CategoryItem | null {
  const g = table.groups.find((x) => x.id === groupId);
  if (!g) return null;
  return g.items.find((x) => x.id === itemId) ?? null;
}

/** 全表候选集（每个分类一条，带所属组名） */
function fullTableCandidates(table: CategoryTable): Candidate[] {
  const out: Candidate[] = [];
  for (const g of table.groups) {
    for (const it of g.items) out.push({ category: it.name, icon: it.icon, group: g.name });
  }
  return out;
}

/** 某组候选集 */
function groupCandidates(table: CategoryTable, groupId: string): Candidate[] {
  const g = table.groups.find((x) => x.id === groupId);
  if (!g) return [];
  return g.items.map((it) => ({ category: it.name, icon: it.icon, group: g.name }));
}

/**
 * LLM 回落（表内选择，**严禁自由生成**）：把候选集喂给模型，要求只输出候选里的一个分类 + 其图标。
 * 必须校验返回值确实在候选集内，否则抛错——保证有表时 AI 永远不造表外分类。
 * @param candidates 候选分类条目（取自表，category 全表唯一）
 * @param state 拼好的 state 文本（物品名 + 历史分类）
 * @param signal 取消通道（透传 createAI）
 */
async function llmFallback(
  candidates: Candidate[],
  state: string,
  signal?: AbortSignal,
): Promise<{ category: string; icon: string }> {
  const lines = candidates
    .map((c) => `- ${c.group} / ${c.category}（图标：${c.icon}）`)
    .join('\n');
  const prompt = [
    '你是物品收纳助手。请从下面的分类清单里，为物品选一个最贴切的分类，并给出该分类对应的图标。',
    '',
    state,
    '',
    '可选分类清单（每行一个，格式「组 / 分类名（图标：图标名）」）：',
    lines,
    '',
    '要求：',
    '1. category：必须是上方清单里的某一个分类名（一字不差，不要带组前缀）。',
    '2. icon：必须是该分类对应的图标名（括号内的值），不要自造。',
    '只输出 JSON 对象，格式：{"category":"<清单里的分类名>","icon":"<该分类的图标>"}',
  ].join('\n');

  const ai = createAI();
  const raw = await ai.json(prompt, { signal });
  let obj: any;
  try {
    let text = String(raw || '').trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();
    obj = JSON.parse(text);
  } catch (e) {
    throw new Error('LLM 回落返回的归类结果无法解析（不是合法 JSON）');
  }
  const category = String(obj?.category ?? '').trim();
  const hit = candidates.find((c) => c.category === category);
  if (!hit) {
    throw new Error(
      `LLM 回落给出的分类「${category}」不在分类表候选集内，已拒绝（有表时绝不造表外分类）`,
    );
  }
  // 图标以表为准，避免模型抄错图标名导致 setIcon 静默失败
  return { category: hit.category, icon: hit.icon };
}

/** 选组：返回命中组 id；任何「不可用」（未配置/失败/哨兵/畸形）返回 null（交由上层 LLM 回落全表） */
async function selectGroup(
  table: CategoryTable,
  state: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!isJevConfigured()) return null;
  const criteria: Record<string, string> = { ...groupMenu(table), [SENTINEL]: SENTINEL_LABEL };
  try {
    const res: JevResult = await askJev(
      state,
      {
        group: {
          type: 'choice',
          instructions: '从下面的分组里，选出这个物品最可能属于的那一个。',
          criteria,
        },
      },
      { signal },
    );
    const ans = res.answers.group;
    if (!ans || ans.type !== 'choice') return null; // 畸形（缺题单键/题型不符）
    const choice = ans.choice;
    if (choice === SENTINEL) return null; // 哨兵 → 兜底
    if (table.groups.some((g) => g.id === choice)) return choice; // 命中某 g001
    return null; // criteria 之外的畸形键
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e; // ④ 取消不回落
    return null; // ①/② 失败 → 回落
  }
}

/** 选类：返回命中分类 id；任何「不可用」（失败/哨兵/畸形）返回 null（交由上层 LLM 回落该组） */
async function selectItem(
  table: CategoryTable,
  groupId: string,
  state: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const criteria: Record<string, string> = { ...itemMenu(table, groupId), [SENTINEL]: SENTINEL_LABEL };
  try {
    const res: JevResult = await askJev(
      state,
      {
        item: {
          type: 'choice',
          instructions: '从下面的分类里，选出这个物品最可能属于的那一个。',
          criteria,
        },
      },
      { signal },
    );
    const ans = res.answers.item;
    if (!ans || ans.type !== 'choice') return null; // 畸形
    const choice = ans.choice;
    if (choice === SENTINEL) return null; // 哨兵 → 兜底
    const g = table.groups.find((x) => x.id === groupId);
    if (g && g.items.some((it) => it.id === choice)) return choice; // 命中某 c0123
    return null; // criteria 之外的畸形键
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e; // ④ 取消不回落
    return null; // ①/② 失败 → 回落
  }
}

export interface SuggestCategoryOpts {
  /** 取消通道：已 aborted 时抛 AbortError 且不回落（用户主动放弃，回落等于白烧一次 LLM） */
  signal?: AbortSignal;
}

/**
 * 归类编排：分类表优先。
 * - 返回 `{category, icon}` → 命中（本地直配 / Jev 两段命中 / LLM 表内命中）；
 * - 返回 `null` → 无表，调用方应回落旧 LLM 自由生成；
 * - 抛错 → 有表但这轮没成功（含 AbortError），调用方内联提示。
 */
export async function suggestCategoryByCatalog(
  app: unknown,
  name: string,
  history: string[],
  opts: SuggestCategoryOpts = {},
): Promise<{ category: string; icon: string } | null> {
  // ④ 取消优先于一切：用户主动放弃，不读表、不 Jev、不回落 LLM
  if (opts.signal?.aborted) throw abortError();

  const table = await loadCategoryTable(app);
  if (!table) return null; // 没有表 → 走不了这条路，由调用方回落旧 LLM 自由生成

  // 2) 本地别名直配：一次网络都不发
  const local = matchByAlias(name, table);
  if (local) return local;

  const state = `物品名称：${name}\n历史分类（优先复用）：${history.join('、') || '暂无'}`;

  // 3) Jev 第一次：选组
  const groupId = await selectGroup(table, state, opts.signal);
  if (groupId === null) {
    // 未配置 / 失败 / 哨兵 / 畸形 → 全表 LLM 回落（严禁自由生成）
    return llmFallback(fullTableCandidates(table), state, opts.signal);
  }

  // 4) Jev 第二次：选类
  const itemId = await selectItem(table, groupId, state, opts.signal);
  if (itemId === null) {
    // 失败 / 哨兵 / 畸形 → 该组 LLM 回落
    return llmFallback(groupCandidates(table, groupId), state, opts.signal);
  }

  const item = findItem(table, groupId, itemId)!;
  return { category: item.name, icon: item.icon };
}

/* ═══════════════════════════════════════════════════════════════
 * 表单联想源（issue 488）：分类表直接作为 #bm-cat 输入框的下拉候选
 *
 * 形态 = 「历史分类在前、表内分类在后」的单一候选串（uiSuggest 消费）：
 * - 历史分类是用户真实用过的（频次降序派生），永远排最前；
 * - 表内分类补齐「没写过但表里有」的部分，组序 = 表序（人类整理的语义序）；
 * - 同名去重（历史优先），图标同理：历史记过的图标 > 表内图标；
 * - 别名作为**搜索关键词**（keywordsOf）而非独立候选——搜「充电宝」能出
 *   「移动电源」，但下拉里不出现重复行。
 * ═══════════════════════════════════════════════════════════════ */

/** 联想源的完整形状（uiSuggest 各槽位的取数闭包都已备好） */
export interface CatSuggestSource {
  /** 候选串（历史 + 表内，去重保序） */
  list: string[];
  /** 候选 → 图标名（历史 > 表 > ''） */
  iconOf: (name: string) => string;
  /** 候选 → 额外搜索关键词（= 表内别名；历史分类与无别名候选为空数组） */
  keywordsOf: (name: string) => string[];
  /** 候选 → 别名提示（下拉小字；无别名 = ''） */
  aliasHintOf: (name: string) => string;
  /** 表是否参与本次联想（false = 未下载，纯历史模式） */
  hasTable: boolean;
}

/**
 * 组装联想源（纯函数，不碰 app/网络）。
 * @param history 历史分类（调用方传派生好的频次降序串）
 * @param historyIconOf 历史分类 → 图标（用户用过的记档；命中优先于表）
 * @param table 分类表（null = 未下载 → 纯历史模式）
 */
export function buildCatSuggest(
  history: string[],
  historyIconOf: (name: string) => string,
  table: CategoryTable | null,
): CatSuggestSource {
  const icon = new Map<string, string>();
  const keywords = new Map<string, string[]>();
  const aliasHint = new Map<string, string>();
  const list: string[] = [];
  const seen = new Set<string>();

  const push = (name: string, iconName: string, aliases: string[]): void => {
    if (!name || seen.has(name)) return;
    seen.add(name);
    list.push(name);
    if (iconName) icon.set(name, iconName);
    if (aliases.length) {
      keywords.set(name, [...aliases]);
      aliasHint.set(name, aliases.join('、'));
    }
  };

  // 历史条目图标优先级：历史记档（馆内首个已设图标）> 表内同名 > 表内别名直配 > 空（issue 489）。
  // 值不动（历史分类原样保留），只补视觉——馆里没设过图标的历史分类在下载表后也能带上图标。
  for (const name of history) {
    const icon =
      historyIconOf(name) ||
      (table ? iconOf(table, name) || matchByAlias(name, table)?.icon || '' : '');
    push(name, icon, []);
  }
  if (table) {
    for (const g of table.groups) {
      for (const it of g.items) push(it.name, it.icon, it.aliases);
    }
  }
  return {
    list,
    iconOf: (name) => icon.get(name) ?? '',
    keywordsOf: (name) => keywords.get(name) ?? [],
    aliasHintOf: (name) => aliasHint.get(name) ?? '',
    hasTable: !!table,
  };
}
