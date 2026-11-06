/**
 * clipbook（剪藏本）：剪藏笔记正文顶部的摘要卡（ADR-0290）。
 *
 * 历史：原写侧往每篇剪藏正文塞一段
 * `` ```dataviewjs \n await dv.view(`CONFIG/SCRIPTS/DataView/摘要`) \n ``` ``，
 * 把作者私人库里的脚本路径固化进所有用户的笔记——没装 Dataview、或库里没有那份脚本，
 * 打开笔记就是一段报错块（ADR-0005 第 2 节的旧决策已推翻）。
 * 现在：保存时不写任何指令，**AI 摘要写回成功那一刻**才生成静态 callout——Obsidian
 * 原生语法，零插件依赖，形态与旧渲染一致（`[!summary]` 标题 + 摘要 + 标签）。
 *
 * 纯函数，node 可测。
 */

/** 卡片头标记（与旧脚本 `dv.paragraph` 渲染出的同款类型） */
const CARD_HEAD_RE = /^>\s*\[!summary\][+-]?/;

/** 设置键单源（设置面板声明 / 默认值 / auto-summary 写回判定共用，防字面量散射漏改） */
export const SUMMARY_CARD_KEY = 'clipbookSummaryCard';

export interface SummaryCardParts {
  /** 卡片标题（笔记 basename） */
  title: unknown;
  /** 摘要正文；空 → 不产卡（AI 未配置/摘要失败时调用侧按空串跳过写盘） */
  summary: unknown;
  /** 标签（frontmatter tags） */
  tags?: unknown;
}

/** 生成卡片文本；摘要为空返回 ''。摘要内换行折成空格——callout 多行需逐行引用前缀，
 *  而摘要本身是单段文字，折行比另造多行引用省事且不破块。 */
export function summaryCardText(parts: SummaryCardParts): string {
  const summary = String(parts.summary ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (!summary) return '';
  const title = String(parts.title ?? '').replace(/[\r\n]+/g, ' ').trim();
  const tags = (Array.isArray(parts.tags) ? parts.tags : [])
    .map((t) => String(t ?? '').trim().replace(/^#+/, '').replace(/\s+/g, ''))
    .filter((t) => t.length > 0)
    .map((t) => `#${t}`);
  const out = [title ? `> [!summary] ${title}` : '> [!summary]', `> ${summary}`];
  if (tags.length) out.push('>', `> ${tags.join(' ')}`);
  return out.join('\n');
}

/** 开头卡片的行区间 [start, end)；正文最顶上没有卡返回 null。
 *  只认开头的 `> [!summary]` 引用块——正文中段用户自己写的 callout 一概不碰。 */
function topCardRange(lines: string[]): [number, number] | null {
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length || !CARD_HEAD_RE.test(lines[i].trim())) return null;
  let j = i + 1;
  while (j < lines.length && /^\s*>/.test(lines[j])) j++;
  return [i, j];
}

/** 统一换行后拆行（剪藏笔记由本插件写入，恒 LF；外部改过的 CRLF 在此归一） */
function toLines(body: unknown): string[] {
  return String(body ?? '').replace(/\r\n/g, '\n').split('\n');
}

/** 剥掉正文开头的摘要卡（右栏读剪藏正文用：右栏自己渲染摘要与标签，不重复显示）。 */
export function stripSummaryCard(body: unknown): string {
  const src = String(body ?? '');
  const lines = toLines(src);
  const r = topCardRange(lines);
  if (!r) return src;
  return lines.slice(0, r[0]).concat(lines.slice(r[1])).join('\n').replace(/^\s+/, '');
}

/** 剥掉正文开头的旧 dataviewjs 摘要块（ADR-0290 之前的写侧产物）。 */
export function stripLegacyDataviewBlock(body: unknown): string {
  return String(body ?? '').replace(/^\s*```dataviewjs[\s\S]*?```\s*/, '');
}

/** 替换正文开头的摘要卡（没有则前置）。顺带清掉开头的旧 dataviewjs 块——
 *  存量笔记重新生成一次摘要即原地升级成原生卡。card 为空 = 只清旧块、不落新卡。 */
export function upsertSummaryCard(body: unknown, card: string): string {
  const base = stripLegacyDataviewBlock(body);
  const cardText = String(card || '').trim();
  if (!cardText) return base;
  const lines = toLines(base);
  const r = topCardRange(lines);
  const restLines = r ? lines.slice(r[1]) : lines;
  const rest = restLines.join('\n').replace(/^\s+/, '');
  return cardText + (rest ? '\n\n' + rest : '');
}
