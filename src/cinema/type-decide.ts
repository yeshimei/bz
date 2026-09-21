/**
 * 影院类型自动判定（issue 393 / ADR-0174）：从闭合词表 ALL_TAGS 里用 Jev Choice 选一个 typeTag。
 *
 * 受限分类逻辑内联影院域（ADR-0174 §1，不强上 core）：候选单源 ALL_TAGS + 显式哨兵
 * 「以上都不是」+ 置信度兜底（confidence < 0.5 视为「都不合适」）。不允许逃逸（ADR-0174 §4）：
 * 哨兵命中或置信度不足都不写值，留给人工处理。
 *
 * 本文件把可单测的纯逻辑（buildTypeCriteria / buildTypeState / judgeTypeChoice /
 * decideCinemaType）与 app 交互的命令入口（decideTypeForActiveFile）放一起，但两者
 * 边界清晰：前者不碰 Obsidian API，便于 vitest 无头断言（含「criteria 是对象」这类
 * 踩过的 422 坑）；后者编排状态读取、跳过的短路、零写入策略。
 */
import type { App } from 'obsidian';
import { askJev, isJevConfigured, type JevAskOptions, type JevChoiceAnswer, type JevChoiceQuestion } from '../core/jev';
import { notice } from '../core/notice';
import { isUnderFolder } from '../core/utils';
import { ALL_TAGS, getGroupForTag, getGroupSafe } from './constants';
import { normalizeTags } from './data';
import { resolveCinemaFolderPath } from './state';

/** 显式哨兵：候选清单末尾追加，命中即视为「都不合适」（ADR-0174 §2） */
export const TYPE_SENTINEL = '以上都不是';
/** 置信度兜底阈值（ADR-0174 §2 第二道闸）：选中具体项但 < 0.5 同样零写入 */
export const CONFIDENCE_FLOOR = 0.5;
/** Jev choice 题单键 */
const Q_KEY = 'type';

/** 判定所需的一部影视信息（够用即可，不灌正文——Jev 官方：塞太多无关内容掉精度） */
export interface CinemaTypeInfo {
  /** 片名（《X》剥壳后的标题） */
  title?: string | null;
  /** 豆瓣 genre → frontmatter「类型」 */
  genre?: string | null;
  /** 简介 */
  synopsis?: string | null;
  /** 导演 */
  director?: string | null;
  /** 年份（上映日期取前四位） */
  year?: string | null;
}

/**
 * 候选 criteria（字典）：直接取 ALL_TAGS 单源，值用 getGroupForTag 组名当说明；
 * 末尾追加哨兵「以上都不是」。禁止在调用点另抄一份（第二事实源会漂移，ADR-0174 §5）。
 */
export function buildTypeCriteria(): Record<string, string> {
  const criteria: Record<string, string> = {};
  for (const tag of ALL_TAGS) {
    criteria[tag] = getGroupForTag(tag) ?? '其他';
  }
  criteria[TYPE_SENTINEL] = '以上候选都不匹配';
  return criteria;
}

/** 把影视信息压成紧凑 state（跳过空字段；最多给 Jev 几行关键事实，不灌正文） */
export function buildTypeState(info: CinemaTypeInfo): string {
  const lines: string[] = [];
  if (info.title) lines.push(`标题：${info.title}`);
  if (info.genre) lines.push(`豆瓣类型：${info.genre}`);
  if (info.director) lines.push(`导演：${info.director}`);
  if (info.year) lines.push(`年份：${info.year}`);
  if (info.synopsis) lines.push(`简介：${info.synopsis}`);
  return lines.join('\n');
}

/**
 * 判定（纯函数，可单测）：命中哨兵 → null；命中具体项但 confidence < 阈值 → null；
 * choice 不在 criteria（接口异常防御）→ null；否则返回该 tag。
 */
export function judgeTypeChoice(answer: JevChoiceAnswer, criteria: Record<string, string>): string | null {
  const choice = answer.choice;
  if (!(choice in criteria)) return null;          // 不在候选清单，异常防御
  if (choice === TYPE_SENTINEL) return null;        // 显式哨兵 → 不写值
  if (answer.confidence < CONFIDENCE_FLOOR) return null; // 置信度兜底（第二道闸）
  return choice;
}

/**
 * 编排（判定通道）：组 state + 调 Jev choice + 判定。
 * 失败（超时 / 非 2xx / 网络 / 响应畸形 / 未配置）一律上抛，由命令层决定零写入——
 * 本链不回落 LLM（ADR-0174 §3 决策 6：回落等于回到「自由写类目」漂移老路）。
 */
export async function decideCinemaType(
  info: CinemaTypeInfo,
  opts?: JevAskOptions
): Promise<string | null> {
  if (!isJevConfigured()) {
    throw new Error('Jev 决策通道未配置（插件设置 → AI → Jev 决策通道）');
  }
  const criteria = buildTypeCriteria();
  const question: JevChoiceQuestion = {
    type: 'choice',
    instructions:
      '根据下面这部影视的信息，从候选清单里选出最贴切的分类标签。候选值的说明是该标签所属的组。' +
      '若都不贴切，请选「以上都不是」。',
    criteria,
  };
  const result = await askJev(buildTypeState(info), { [Q_KEY]: question }, opts);
  const answer = result.answers[Q_KEY];
  if (!answer || answer.type !== 'choice') {
    throw new Error('Jev 未返回有效的 choice 答案');
  }
  return judgeTypeChoice(answer as JevChoiceAnswer, criteria);
}

/** 《X》剥壳 → 标题（无书名号则原样） */
function stripTitle(basename: string): string {
  const m = basename.match(/^《(.+?)》$/);
  return m ? m[1] : basename;
}

/**
 * 命令 bz-cinema-type-decide 入口：作用于当前活动笔记。
 * - 已有命中 ALL_TAGS 的 tag → 跳过（零 Jev 调用，提示「已有分类」，不静默改写用户原生 tags）；
 * - 否则取信息 → decideCinemaType → 写入 frontmatter tags（保持影院域写法）；
 * - 哨兵 / 低置信度 → 不写；Jev 抛错（含未配置）→ 提示 + 零写入（不回落 LLM）。
 */
export async function decideTypeForActiveFile(app: App): Promise<void> {
  const file = app.workspace.getActiveFile();
  if (!file) {
    notice('没有正在打开的笔记，无法判定类型', 'warning');
    return;
  }
  // 目录范围守卫（issue 393 审查补丁）：仅影视目录内的笔记才判定，避免把影视 typeTag
  // 写进用户手工维护的原生 tags（不可逆）。单源：目录由 resolveCinemaFolderPath 解析、
  // 边界由 isUnderFolder 判定（复用 encrypt 边界同款工具，不另造第二套范围规则）。
  const folder = resolveCinemaFolderPath();
  if (!isUnderFolder(folder, file.path)) {
    notice('这不是影视笔记，无法判定类型', 'warning');
    return;
  }
  const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
  const existingTags = normalizeTags(fm['tags']);
  // 已有命中 → 跳过（保持用户原生 tags 不被静默改写；零 Jev 调用）
  if (existingTags.some((t) => ALL_TAGS.includes(t))) {
    notice('该片已有分类，未做改动', 'info');
    return;
  }
  const info: CinemaTypeInfo = {
    title: stripTitle(file.basename),
    genre: fm['类型'] ?? null,
    synopsis: fm['简介'] ?? null,
    director: fm['导演'] ?? null,
    year: fm['上映日期'] ? String(fm['上映日期']).slice(0, 4) : null,
  };
  let decided: string | null;
  try {
    decided = await decideCinemaType(info);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    notice(`类型判定失败：${msg}`, 'error');
    return;
  }
  if (decided === null) {
    notice('未能确定类型（置信度不足或不属于任何候选），留待人工分类', 'info');
    return;
  }
  // 回归守卫：补出的 tag 必能经 getGroupSafe 命中已知组（ADR-0174 §4：闭合词表不容游离值）
  if (getGroupSafe(decided) === '其他') {
    notice(`类型判定结果「${decided}」未命中已知组，未写入`, 'warning');
    return;
  }
  await app.fileManager.processFrontMatter(file, (f) => {
    const tags = normalizeTags(f['tags']);
    if (!tags.includes(decided)) {
      tags.unshift(decided);
      f['tags'] = tags;
    }
  });
  notice(`已判定类型为「${decided}」`, 'success');
}
