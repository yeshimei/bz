/**
 * 影院类型判定（issue 395；ADR-0181 起补 LLM 回落）：把**豆瓣查询字段**交给 Jev Choice，
 * 从闭合词表里选一个 typeTag；Jev 不可用则回落 LLM（题面同样给闭合词表，回执严格校验）。
 *
 * 与已撤销的 393 版（issue 394 全删）的区别在**材料**：
 * 393 拿的是笔记 frontmatter，而「添加影视」表单阶段笔记根本还没落盘——那版只能服务已存在的笔记，
 * 而库里 686 篇全都有分类，于是命令一次也不会触发。本版拿的是豆瓣查询结果
 * （是否剧集 / 制片国家地区 / 豆瓣类型），这三个是**客观事实**，判定才有依据。
 *
 * 候选 = `ALL_TAGS` 去掉「公开课」（2026-09-21 用户拍板：公开课不参与自动分类，手选仍可用），
 * 末尾追加显式哨兵「以上都不是」——Choice 语义下模型必选其一，这个出口必须显式给出。
 * 不允许逃逸：哨兵命中 / Jev 置信度不足 / LLM 回执不在清单，一律不写值，留给用户手点。
 *
 * 回落口径（2026-09-23 用户拍板，ADR-0181）：未配置 / 请求失败 / 答案畸形都回落 LLM；
 * 取消（`signal.aborted`）不回落。**弃权不是失败**——Jev 选哨兵或置信度不足是有效判定，
 * 不回落（回落等于绕过 Jev 的校准概率）；两道都不可用才抛错，由调用方留空。
 */
import { createAI } from '../core/ai';
import { judgeOrFallback } from '../core/jev-fallback';
import type { JevAskOptions, JevChoiceAnswer, JevChoiceQuestion } from '../core/jev';
import { ALL_TAGS, getGroupForTag } from './constants';

/** 显式哨兵：候选清单末尾追加，命中即视为「都不合适」 */
export const TYPE_SENTINEL = '以上都不是';
/** 置信度兜底阈值：选中具体项但低于此值同样不采信 */
export const CONFIDENCE_FLOOR = 0.5;
/** 不参与自动判定的 tag（用户手选仍可用） */
const EXCLUDED_FROM_DECIDE = ['公开课'];
/** Jev choice 题单键 */
const Q_KEY = 'type';

/** 判定线索（Jev 题面与 LLM 回落 prompt 共用一份，避免两处漂移） */
const DECIDE_HINTS =
  '判断线索：是否剧集区分「电影」与其他剧种；制片国家/地区决定是国产剧、美剧、日剧、韩剧、英剧还是德剧；' +
  '豆瓣类型里含「动画」时按地区归入日漫、国漫或美漫；含「纪录片」时归「纪录片」（此时不按剧集判）。';

/** Jev 题面（候选值的说明是该标签所属的组） */
const JEV_INSTRUCTIONS =
  `根据下面这部影视的豆瓣信息，从候选清单里选出最贴切的分类标签。候选值的说明是该标签所属的组。${DECIDE_HINTS}若都不贴切，请选「${TYPE_SENTINEL}」。`;

/** 判定所需的豆瓣字段（够用即可；Jev 官方：塞太多无关内容掉精度） */
export interface TypeDecideInfo {
  /** 片名 */
  title?: string | null;
  /** 是否剧集（ApiZero is_tv / rexxar mediaType）——区分电影与各剧种的唯一依据 */
  isTv?: boolean | null;
  /** 制片国家/地区——区分国产剧 / 美剧 / 日剧 / 韩剧 / 英剧 / 德剧 / 哥伦比亚剧的唯一依据 */
  area?: string | null;
  /** 豆瓣类型（剧情 / 动画 / 纪录片 …）——动画与纪录片的判据 */
  genre?: string | null;
  /** 年份（同名条目多版本时的佐证） */
  year?: string | null;
}

/** 候选 criteria（字典）：`ALL_TAGS` 单源去掉公开课，值取所属组当说明 + 末尾哨兵 */
export function buildTypeCriteria(): Record<string, string> {
  const criteria: Record<string, string> = {};
  for (const tag of ALL_TAGS) {
    if (EXCLUDED_FROM_DECIDE.includes(tag)) continue;
    criteria[tag] = getGroupForTag(tag) ?? '其他';
  }
  criteria[TYPE_SENTINEL] = '以上候选都不匹配';
  return criteria;
}

/** 把豆瓣字段压成紧凑 state（跳过空字段） */
export function buildTypeState(info: TypeDecideInfo): string {
  const lines: string[] = [];
  if (info.title) lines.push(`片名：${info.title}`);
  if (info.isTv !== null && info.isTv !== undefined) lines.push(`是否剧集：${info.isTv ? '是' : '否'}`);
  if (info.area) lines.push(`制片国家/地区：${info.area}`);
  if (info.genre) lines.push(`豆瓣类型：${info.genre}`);
  if (info.year) lines.push(`年份：${info.year}`);
  return lines.join('\n');
}

/** 判定（纯函数）：哨兵 → null；置信度不足 → null；不在候选清单（接口异常）→ null */
export function judgeTypeChoice(answer: JevChoiceAnswer, criteria: Record<string, string>): string | null {
  const choice = answer.choice;
  if (!(choice in criteria)) return null;
  if (choice === TYPE_SENTINEL) return null;
  if (answer.confidence < CONFIDENCE_FLOOR) return null;
  return choice;
}

// ---------------- LLM 回落（Jev 不可用时的后补通道，ADR-0181） ----------------

/** LLM 回落 prompt：候选清单**原样拷贝**进题面（闭合约束在提示词里给，回执再严格校验） */
export function buildTypeLlmPrompt(info: TypeDecideInfo, criteria: Record<string, string>): string {
  const menu = Object.keys(criteria)
    .map((tag) => (tag === TYPE_SENTINEL ? tag : `${tag}（${criteria[tag]}）`))
    .join('、');
  return [
    '你是影视分类助手。根据下面的豆瓣信息，从候选分类里选出最贴切的一个。',
    `候选分类：${menu}`,
    DECIDE_HINTS,
    `若都不贴切，选「${TYPE_SENTINEL}」。`,
    '只输出 JSON 对象：{"type":"候选分类之一"}',
    '',
    buildTypeState(info),
  ].join('\n');
}

/** LLM 输出 → tag（严格校验：剥 codefence → JSON → 值须 ∈ 候选且非哨兵，否则 null 弃权） */
export function parseTypeLlmOutput(raw: string, criteria: Record<string, string>): string | null {
  let text = String(raw || '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  let obj: any;
  try {
    obj = JSON.parse(text);
  } catch {
    return null;
  }
  const tag = String(obj?.type ?? '').trim();
  if (!tag || tag === TYPE_SENTINEL || !(tag in criteria)) return null;
  return tag;
}

/** LLM 回落入口：请求失败（未配置 / 网络）抛错，由调用方留空；输出不合规则弃权（null） */
async function decideTypeByLlm(info: TypeDecideInfo, criteria: Record<string, string>): Promise<string | null> {
  const raw = await createAI().json(buildTypeLlmPrompt(info, criteria));
  return parseTypeLlmOutput(raw, criteria);
}

/**
 * 编排（`core/jev-fallback` 单源）：Jev Choice 优先，不可用回落 LLM。
 * 两道都不可用才抛错，由调用方「不预选」（分类留空、交给用户手点）——不引第三层兜底。
 */
export async function decideCinemaType(info: TypeDecideInfo, opts?: JevAskOptions): Promise<string | null> {
  const criteria = buildTypeCriteria();
  return judgeOrFallback<string | null>({
    signal: opts?.signal,
    config: opts?.config,
    request: () => {
      const question: JevChoiceQuestion = { type: 'choice', instructions: JEV_INSTRUCTIONS, criteria };
      return { state: buildTypeState(info), questions: { [Q_KEY]: question } };
    },
    parse: (answers) => {
      const answer = answers[Q_KEY];
      if (!answer || answer.type !== 'choice') throw new Error('Jev 未返回有效的 choice 答案');
      return judgeTypeChoice(answer, criteria);
    },
    fallback: () => decideTypeByLlm(info, criteria),
  });
}
