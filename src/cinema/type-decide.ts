/**
 * 影院类型判定（issue 395）：把**豆瓣查询字段**交给 Jev Choice，从闭合词表里选一个 typeTag。
 *
 * 与已撤销的 393 版（issue 394 全删）的区别在**材料**：
 * 393 拿的是笔记 frontmatter，而「添加影视」表单阶段笔记根本还没落盘——那版只能服务已存在的笔记，
 * 而库里 686 篇全都有分类，于是命令一次也不会触发。本版拿的是豆瓣查询结果
 * （是否剧集 / 制片国家地区 / 豆瓣类型），这三个是**客观事实**，判定才有依据。
 *
 * 候选 = `ALL_TAGS` 去掉「公开课」（2026-09-21 用户拍板：公开课不参与自动分类，手选仍可用），
 * 末尾追加显式哨兵「以上都不是」——Jev 一定会选一个，这个出口必须显式给出（Choice 语义）。
 * 不允许逃逸：哨兵命中或置信度不足都不写值，留给用户手点。
 */
import { askJev, isJevConfigured, type JevAskOptions, type JevChoiceAnswer, type JevChoiceQuestion } from '../core/jev';
import { ALL_TAGS, getGroupForTag } from './constants';

/** 显式哨兵：候选清单末尾追加，命中即视为「都不合适」 */
export const TYPE_SENTINEL = '以上都不是';
/** 置信度兜底阈值：选中具体项但低于此值同样不采信 */
export const CONFIDENCE_FLOOR = 0.5;
/** 不参与自动判定的 tag（用户手选仍可用） */
const EXCLUDED_FROM_DECIDE = ['公开课'];
/** Jev choice 题单键 */
const Q_KEY = 'type';

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

/**
 * 编排：组 state + 调 Jev choice + 判定。
 * 未配置或请求失败一律上抛，由调用方决定「不预选」——本链不回落 LLM
 * （回落等于回到「自由写类目」的漂移老路）。
 */
export async function decideCinemaType(info: TypeDecideInfo, opts?: JevAskOptions): Promise<string | null> {
  if (!isJevConfigured()) {
    throw new Error('Jev 决策通道未配置（设置 → AI → Jev 决策通道）');
  }
  const criteria = buildTypeCriteria();
  const question: JevChoiceQuestion = {
    type: 'choice',
    instructions:
      '根据下面这部影视的豆瓣信息，从候选清单里选出最贴切的分类标签。候选值的说明是该标签所属的组。' +
      '判断线索：是否剧集区分「电影」与其他剧种；制片国家/地区决定是国产剧、美剧、日剧、韩剧、英剧还是德剧；' +
      '豆瓣类型里含「动画」时按地区归入日漫、国漫或美漫；含「纪录片」时归「纪录片」（此时不按剧集判）。' +
      '若都不贴切，请选「以上都不是」。',
    criteria,
  };
  const result = await askJev(buildTypeState(info), { [Q_KEY]: question }, opts);
  const answer = result.answers[Q_KEY];
  if (!answer || answer.type !== 'choice') {
    throw new Error('Jev 未返回有效的 choice 答案');
  }
  return judgeTypeChoice(answer, criteria);
}
