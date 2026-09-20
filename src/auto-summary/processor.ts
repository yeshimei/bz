/**
 * 自动摘要 processor（ticket 22）：缺失字段 AI 补全 + 文件处理 + 通知。
 * 源码：自动摘要.js L63-121（逐字移植；ticket 22 改为缺什么补什么）
 *
 * 结果契约（A5/N4）：processFile 返回结构化结果（ProcessOutcome）替代 void+全吞——
 * 队列泵据此驱动失败熔断（EFF-3）与批次成败汇总（EFF-1/N-UI4）；写盘阶段失败
 * （AI 已成功后）发人话提示 + 重试，与 AI 失败分支同待遇。
 */
import { parseFrontmatter, buildFrontmatter, extractBodyForAI } from './parser';
import { AUTO_SUMMARY_KEYS } from './keys';
import { notify } from '../core/notice';
import type { NoticeHandle } from '../core/notice';
import { getAIProvider, type AIService } from '../core/ai';
import { tryGetSettings } from '../core/settings-provider';

/** 通知去重键自增序号：同一次尝试内 progress→结果 原地合并；不同文件/重试 各弹各（ticket 1） */
let attemptSeq = 0;
function dedupeKeyFor(file: any): string {
  return `auto-summary:${file.path}#${++attemptSeq}`;
}

/** processFile 结果契约（A5）：队列泵可感知任务结局——
 *  ok/partial=有写回产出；skipped-*=正常早退；ai-failed/write-failed/error=失败（熔断计数面） */
export type ProcessOutcome =
  | 'ok'
  | 'partial'
  | 'ai-failed'
  | 'skipped-short'
  | 'skipped-complete'
  | 'write-failed'
  | 'error';

/** 失败原因人话化：AI 未配置 → 引导设置（原技术错误详情在 console）；其余通用重试文案 */
async function humanizeFailReason(): Promise<string> {
  try {
    await getAIProvider(); // 配置解析成功即缓存；仅在失败时复查一次
    return '摘要生成失败，请重试';
  } catch {
    return 'AI 服务未配置或不可用，请到设置页配置';
  }
}

/** processFile 可选项（enh 包 1/2） */
export interface ProcessOptions {
  /** force：跳过缺失检测直接重建——只重建 summary/tags，不动用户自定义标题（手动重跑入口） */
  force?: boolean;
  /** quiet：批量队列驱动时抑制单文件通知（进度由队列聚合通知承载；成败由批次收场汇总承载） */
  quiet?: boolean;
}

/** 缺失字段 → JSON 模板定义（规则文案逐字保留；不含 author；ticket 124：summary 按长度档位） */
const FIELD_DEFS: Record<string, string> = {
  title:
    '"title": "生成中文标题，15-30字，完整陈述句，不得使用疑问句或疑问语气（为何/为什么/怎么/如何/吗/呢）。禁止冒号、破折号、句中句号问号，需要连接时用逗号"',
  summary:
    '"summary": "150-250字的详细摘要。包含核心观点、关键事实、重要数据和结论。直接陈述内容，绝对禁止使用\'本文\'、\'本文章\'、\'这篇文章\'、\'文章指出\'、\'作者认为\'等前缀词"',
  tags: '"tags": ["标签1", "标签2", "标签3"]',
};

/** 字段中文名（N-UI5 差异化回执用） */
const FIELD_LABELS: Record<string, string> = { title: '标题', summary: '摘要', tags: '标签' };

/** ticket 124（Q8 详设一）：摘要长度档位 → summary 字数要求（输出上限走设置面板，issue 334/ADR-0148） */
export const SUMMARY_LENGTH_RULES: Record<string, string> = {
  simple:
    '"summary": "50-100字的简短摘要。提炼核心观点与关键结论。直达内容，禁止使用\'本文\'、\'本文章\'、\'文章\'、\'作者认为\'等前缀词"',
  standard:
    '"summary": "150-250字的详细摘要。包含核心观点、关键事实、重要数据和结论。直接陈述内容，绝对禁止使用\'本文\'、\'本文章\'、\'这篇文章\'、\'文章指出\'、\'作者认为\'等前缀词"',
  detailed:
    '"summary": "300-400字的详尽摘要。完整覆盖核心观点、关键事实、重要数据、推论与结论，条理清晰。直接陈述内容，绝对禁止使用\'本文\'、\'本文章\'、\'这篇文章\'、\'文章指出\'、\'作者认为\'等前缀词"',
};

/** ticket 124（Q8 详设二）：标签规则（数量区间由设置控制） */
export function buildTagsRule(tagRange: string): string {
  return `tags 规则：
- ${tagRange || '3-6'} 个中文标签，每个不超过 5 个字
- 涵盖：主题领域、关键技术/概念、应用场景`;
}

/**
 * AI 结果规范化（A2 schema 校验单源）：title/summary 必须非空 string、tags 必须 string[]，
 * 违规字段按「未生成」处理——旧实现仅 truthy 守卫，`{"title":{"main":…}}` 经 String()
 * 物化成 `[object Object]` 真实改名事故；tags 已有 isArray 设防，此处三字段守卫合一。
 */
function normalizeAIResult(raw: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  if (typeof raw.title === 'string' && raw.title.trim()) out.title = raw.title.trim();
  if (typeof raw.summary === 'string' && raw.summary.trim()) out.summary = raw.summary.trim();
  if (Array.isArray(raw.tags)) {
    const tags = raw.tags.filter((t: any) => typeof t === 'string' && t.trim()).map((t: string) => t.trim());
    if (tags.length > 0) out.tags = tags;
  }
  return out;
}

/** AI 生成缺失字段（提示词按 missing 裁剪与设置参数；失败静默返回 null） */
export async function aiProcess(
  ai: AIService,
  bodyText: string,
  missing: string[],
  opts: { summaryLength?: string; tagsEnabled?: boolean; tagCount?: string } = {},
): Promise<Record<string, any> | null> {
  // length：档位映射 summary 规则；tags：开关关掉时不生成/不补全 tags
  const length = opts.summaryLength || 'standard';
  const summaryRule = SUMMARY_LENGTH_RULES[length] || SUMMARY_LENGTH_RULES.standard;
  const needed = missing.filter((f) => f !== 'tags' || opts.tagsEnabled !== false);
  const fieldLines = needed.filter((f) => FIELD_DEFS[f]).map((f) => '  ' + (f === 'summary' ? summaryRule : FIELD_DEFS[f]));
  if (fieldLines.length === 0) return null;

  const prompt = `你是一个资讯文章分析助手。以下是一篇已转换为 Markdown 的文章正文。请分析内容，返回一个 JSON 对象（只返回 JSON，不要其他文字）：

{
${fieldLines.join(',\n')}
}

${needed.includes('tags') ? buildTagsRule(opts.tagCount || '3-6') + '\n\n' : ''}文章正文：
${bodyText.substring(0, 6000)}`;

  try {
    const result = await ai.prompt(prompt, 'deepseek-v4-flash', {
      // temperature 属任务语义（分析类低温）；max_tokens 面板独裁不在此传（issue 334/ADR-0148）——
      // 推理模型思考耗尽小预算曾致 content 空串必失败，上限唯一权威 = 设置面板后自愈
      modelOptions: { temperature: 0.3 },
    });
    // A2：解析成功也过规范化层——类型错位字段按未生成处理，不物化 String()
    const jsonMatch = (result || '').match(/\{[\s\S]*\}/);
    if (jsonMatch) return normalizeAIResult(JSON.parse(jsonMatch[0]));
  } catch (e) {
    console.warn('[自动摘要] AI 处理失败:', e);
  }
  return null;
}

/** 重命名结果：目标文件 + 是否实际改名 + 是否执行失败（失败回退为仅写 frontmatter title） */
interface RenameOutcome {
  target: any;
  renamed: boolean;
  failed: boolean;
}

/** AI 标题 → 重命名笔记文件（清理非法字符/截断/防重名；无需改/失败返回原 file 并给出标记） */
async function renameToTitle(app: any, file: any, title: string): Promise<RenameOutcome> {
  const clean = String(title)
    .replace(/[\\/:*?"<>|\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  if (!clean || clean === file.basename) return { target: file, renamed: false, failed: false };
  const dir = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '/';
  let newPath = `${dir}/${clean}.md`;
  let n = 1;
  while (app.vault.getAbstractFileByPath(newPath)) {
    newPath = `${dir}/${clean} (${n++}).md`;
  }
  try {
    // 必须走 fileManager.renameFile：它会联动更新全库指向该文件的双链（含知识盒 source 这类
    // frontmatter 引号字符串内的 [[路径|名]]）；vault.rename 只搬路径不更新任何引用，
    // 曾致文献笔记来源断链。老宿主无 fileManager 才回退（对齐 attach 域同一范式）。
    const fmRename = app?.fileManager?.renameFile;
    if (fmRename) await fmRename.call(app.fileManager, file, newPath);
    else await app.vault.rename(file, newPath);
    return { target: app.vault.getAbstractFileByPath(newPath) || file, renamed: true, failed: false };
  } catch (e) {
    console.warn('[自动摘要] 重命名失败，仅写 frontmatter title:', e);
    return { target: file, renamed: false, failed: true };
  }
}

/** tags 缺失判定（N3 保守侧）：解析降级为非空字符串的 tags（如单引号流式数组 `['a','b']`，
 *  本解析器不认但 YAML 合法）不判缺失——宁缺勿覆，AI 不得覆盖用户已有标签 */
function tagsMissing(fm: Record<string, any> | null): boolean {
  if (!fm || !fm.tags) return true;
  if (Array.isArray(fm.tags)) return fm.tags.length === 0;
  return String(fm.tags).trim() === '';
}

/** 失败通知 + 重试出口（N5：统一走 core notice action 通道——appendActionBtn 自带
 *  tabIndex + Enter/Space 键盘可达，手拼 .bz-notice-action DOM 退役） */
function notifyRetryable(reason: string, retry: () => void): void {
  notify(reason, {
    type: 'error',
    duration: 0,
    action: { label: '重试', onClick: retry },
  });
}

/** 重试 = 回域队列（F9：retrySummaryWithAI 复用 processingPaths 去重，双击不双跑）；
 *  函数级动态 import 解 processor←→index 环（ADR-0002） */
function retryViaQueue(app: any, ai: AIService, file: any, force: boolean): void {
  void import('./index')
    .then((m) => m.retrySummaryWithAI(app, ai, file, force))
    .catch(() => { /* 队列入口不可用（卸载中）时放弃重试 */ });
}

/** 处理单个文件：缺什么补什么（title/summary/tags），字段齐全跳过；返回结构化结果（A5）。
 *  ticket 124（Q8 详设）：摘要长度/标签开关数量/时机由设置驱动。
 *  enh 包 1：force 档跳过缺失检测直接重建，且只重建 summary/tags——title 不进目标
 *  字段（不重命名、不覆盖），用户改过的标题不吞；enh 包 2：quiet 抑制单文件通知。 */
export async function processFile(app: any, ai: AIService, file: any, opts: ProcessOptions = {}): Promise<ProcessOutcome> {
  const force = opts.force === true;
  let h: NoticeHandle | null = null;
  // AI 有效产出已到手（此后异常 = 写回阶段失败，N4 分型依据：写盘失败必须人话可见）
  let delivered = false;
  // 设置参数（ticket 124：摘要长度/标签开关数量由设置驱动；tryGetSettings 未注入时安全返回空对象）
  const s = tryGetSettings() as any;
  const summaryLength = String(s[AUTO_SUMMARY_KEYS.length] || 'standard');
  const tagsEnabled = s[AUTO_SUMMARY_KEYS.tagsEnabled] !== false;
  const tagCount = String(s[AUTO_SUMMARY_KEYS.tagCount] || '3-6');
  try {
    const content = await app.vault.read(file);
    const { fm, body } = parseFrontmatter(content);

    const bodyText = extractBodyForAI(body);
    if (!bodyText || bodyText.length < 100) {
      // N-UI2：手动（force）路径短正文早退给人话反馈——右键/命令点按后零 toast 只能归因「坏了」；
      // 自动触发路径维持静默（无诉求）
      if (force) notify('正文过短（不足 100 字），未生成摘要', { type: 'info' });
      return 'skipped-short';
    }

    // 缺失字段检测（空串/空数组视为缺失；ticket 124：标签开关关掉时不要求 tags）。
    // force（enh 包 1）：跳过检测直接重建——目标字段固定 summary(+tags)，title 不入列
    const missing: string[] = [];
    if (force) {
      missing.push('summary');
      if (tagsEnabled !== false) missing.push('tags');
    } else {
      if (!fm || !fm.title) missing.push('title');
      if (!fm || !fm.summary) missing.push('summary');
      if (tagsEnabled !== false && tagsMissing(fm)) missing.push('tags');
      if (missing.length === 0) return 'skipped-complete'; // 字段齐全，无需处理
    }

    // 开始调用 AI：动态通知（进行中 → 原地更新为结果；去重键按文件区分，连续剪藏各弹各）；
    // quiet（批量队列驱动）不发单文件通知——进度与成败由队列聚合/汇总承载（enh 包 2）
    const startName = fm && fm.title ? fm.title : file.basename;
    const key = dedupeKeyFor(file);
    if (!opts.quiet) {
      h = notify(`正在为《${startName}》生成摘要…`, { type: 'progress', dedupeKey: key });
    }
    const aiResult = await aiProcess(ai, bodyText, missing, { summaryLength, tagsEnabled, tagCount });
    if (!aiResult) {
      // 失败：人话原因 + action「重试」。失败通知常驻（duration<=0 不自动消失）保「重试」窗口；
      // quiet 批量路径静音（N-UI4：逐篇常驻 error 堆屏退役，批次收场统一汇总）
      const reason = await humanizeFailReason();
      if (h) h.hide();
      if (opts.quiet) console.warn('[自动摘要] AI 失败（批量批次，由收场汇总）:', reason);
      else notifyRetryable(reason, () => retryViaQueue(app, ai, file, force));
      return 'ai-failed';
    }
    delivered = true;

    // AI 标题 → 重命名笔记文件（fileManager.renameFile 联动更新全库双链；失败/无需改回退原 file）。
    // A2：aiResult.title 已规范化为非空 string——`[object Object]` 改名事故不再可达
    let targetFile = file;
    let renameFailed = false; // warning 推迟到 modify 成功后发（B5：文案承诺「标题已写入」需以真实落盘为前提）
    if (missing.includes('title') && aiResult.title) {
      const outcome = await renameToTitle(app, file, aiResult.title);
      targetFile = outcome.target;
      if (outcome.renamed) {
        notify(`已重命名为《${aiResult.title}》`, { type: 'success' });
      } else if (outcome.failed) {
        renameFailed = true;
      }
    }

    // 写回前重读目标文件最新内容（AI 处理期间可能被外部修改）：正文一律取磁盘最新，
    // 仅将 AI 生成的目标字段合并进最新 frontmatter，防盲写覆盖并发追加（P1-21；rename 后对新路径生效）。
    // A1：latestParsed.fm 只含管辖键，非管辖键原文行在 extraLines 原样拼回——类型零漂移
    const latest = await app.vault.read(targetFile);
    const latestParsed = parseFrontmatter(latest);
    const mergedFm: Record<string, any> = { ...(latestParsed.fm || {}) };
    if (missing.includes('title') && aiResult.title) mergedFm.title = aiResult.title;
    if (missing.includes('summary') && aiResult.summary) mergedFm.summary = aiResult.summary;
    if (missing.includes('tags') && Array.isArray(aiResult.tags) && aiResult.tags.length) {
      mergedFm.tags = aiResult.tags;
    }

    // 重建时原样拼回未识别原文行 + 非管辖键原文行（审计修复 + A1），防外来剪藏 frontmatter 重建丢行/类型漂移
    const newContent = buildFrontmatter(mergedFm, latestParsed.extraLines) + '\n\n' + latestParsed.body;
    await app.vault.modify(targetFile, newContent);
    if (renameFailed) {
      // B5：标题已在上面真实写入 frontmatter，此刻的「已写入」文案才站得住
      notify('自动改名失败，标题已写入笔记，请手动重命名', { type: 'warning' });
    }

    // N-UI5 回执诚信 gate：比对「请求了但未拿到」的字段集——非空时不得谎报「已完成」
    // （缺口不写回 → 下轮打开仍判缺失重触发，回执必须让用户知道是半成品）
    const notDelivered = missing.filter((f) =>
      f === 'tags' ? !(Array.isArray(aiResult.tags) && aiResult.tags.length > 0) : !aiResult[f]
    );
    if (notDelivered.length > 0) {
      const got = missing.filter((f) => !notDelivered.includes(f));
      const gotTxt = got.map((f) => FIELD_LABELS[f]).join('、');
      const missTxt = notDelivered.map((f) => FIELD_LABELS[f]).join('、');
      const msg = gotTxt ? `已写入${gotTxt}，${missTxt}未能生成` : `AI 未生成${missTxt}`;
      if (opts.quiet) console.warn(`[自动摘要] 部分补全（批量批次，由收场汇总）: ${msg}`);
      else notifyRetryable(`${msg}，可重试`, () => retryViaQueue(app, ai, targetFile, force));
      return 'partial';
    }

    // 成功：同去重键原地合并 → 切换 success 图标按默认时长驻留（2026-09-19 拍板：
    // 正文固定「已完成」不再回显 title/summary/tags，toast 只做完成回执）。
    // quiet 批量路径静音（EFF-1：N 篇一模一样的「已完成」逐篇弹退役，批次收场单条汇总）。
    // 挂「查看」action（enh 包 3）：打开剪藏本面板并选中该条——clipbook 与本域互为依赖面，
    // 环引用按项目规约走函数级延迟解析（动态 import）
    if (!opts.quiet) {
      notify('已完成', {
        type: 'success',
        dedupeKey: key,
        action: {
          label: '查看',
          onClick: () => {
            import('../clipbook/ui')
              .then((m) => m.revealClipArticle(targetFile.path))
              .catch(() => { /* 剪藏本面板不可用（如卸载中）时忽略 */ });
          },
        },
      });
    }
    return 'ok';
  } catch (e) {
    if (h) h.hide();
    console.error(`[自动摘要] 处理失败: ${file.basename}`, e);
    // N4 分型：写回阶段（AI 已成功、可能已改名）失败必须人话可见——与 AI 失败分支同待遇
    // （常驻 error + 重试），旧实现全吞让 AI 花费白费且半失败态无人知晓；
    // 读盘等早段意外（1.5s 窗内文件被删等）维持 console 静默
    if (delivered) {
      notifyRetryable('摘要写入失败，请重试', () => retryViaQueue(app, ai, file, force));
      return 'write-failed';
    }
    return 'error';
  }
}
