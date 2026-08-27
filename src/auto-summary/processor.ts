/**
 * 自动摘要 processor（ticket 22）：缺失字段 AI 补全 + 文件处理 + 通知。
 * 源码：自动摘要.js L63-121（逐字移植；ticket 22 改为缺什么补什么）
 */
import { parseFrontmatter, buildFrontmatter, extractBodyForAI } from './parser';
import { notify } from '../core/notice';
import type { NoticeHandle } from '../core/notice';
import { getAIProvider, type AIService } from '../core/ai';
import { tryGetSettings } from '../core/settings-provider';

/** 通知去重键自增序号：同一次尝试内 progress→结果 原地合并；不同文件/重试 各弹各（ticket 1） */
let attemptSeq = 0;
function dedupeKeyFor(file: any): string {
  return `auto-summary:${file.path}#${++attemptSeq}`;
}

/** 失败原因人话化：AI 未配置 → 引导设置（原技术错误详情在 console）；其余通用重试文案 */
async function humanizeFailReason(): Promise<string> {
  try {
    await getAIProvider(); // 配置解析成功即缓存；仅在失败时复查一次
    return '摘要生成失败，请重试';
  } catch {
    return 'AI 服务未配置或不可用，请到设置页配置';
  }
}

/** 缺失字段 → JSON 模板定义（规则文案逐字保留；不含 author；ticket 124：summary 按长度档位） */
const FIELD_DEFS: Record<string, string> = {
  title:
    '"title": "生成中文标题，15-30字，完整陈述句或疑问句。禁止冒号、破折号、句中句号问号，需要连接时用逗号"',
  summary:
    '"summary": "150-250字的详细摘要。包含核心观点、关键事实、重要数据和结论。直接陈述内容，绝对禁止使用\'本文\'、\'本文章\'、\'这篇文章\'、\'文章指出\'、\'作者认为\'等前缀词"',
  tags: '"tags": ["标签1", "标签2", "标签3"]',
};

/** ticket 124（Q8 详设一）：摘要长度档位 → summary 字数要求与 max_tokens */
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
      modelOptions: { max_tokens: length === 'detailed' ? 2048 : 1024, temperature: 0.3 },
    });
    const jsonMatch = (result || '').match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
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
    await app.vault.rename(file, newPath);
    return { target: app.vault.getAbstractFileByPath(newPath) || file, renamed: true, failed: false };
  } catch (e) {
    console.warn('[自动摘要] 重命名失败，仅写 frontmatter title:', e);
    return { target: file, renamed: false, failed: true };
  }
}

/** 通知文案：《title》 + 空行 + summary + 空行 + #tags（缺哪段不显示哪段） */
export function formatSummaryNotice(fm: Record<string, any>): string {
  const parts: string[] = [];
  if (fm.title) parts.push(`《${fm.title}》`);
  if (fm.summary) parts.push(String(fm.summary));
  if (Array.isArray(fm.tags) && fm.tags.length) parts.push(fm.tags.map((t: any) => `#${t}`).join(' '));
  return parts.join('\n\n');
}

/** 处理单个文件：缺什么补什么（title/summary/tags），字段齐全跳过；成功通知。
 *  ticket 124（Q8 详设）：摘要长度/标签开关数量/时机由设置驱动。 */
export async function processFile(app: any, ai: AIService, file: any): Promise<void> {
  let h: NoticeHandle | null = null;
  // 设置参数（ticket 124：摘要长度/标签开关数量由设置驱动；tryGetSettings 未注入时安全返回空对象）
  const s = tryGetSettings() as any;
  const summaryLength = String(s.autoSummaryLength || 'standard');
  const tagsEnabled = s.autoSummaryTagsEnabled !== false;
  const tagCount = String(s.autoSummaryTagCount || '3-6');
  try {
    const content = await app.vault.read(file);
    const { fm, body } = parseFrontmatter(content);

    const bodyText = extractBodyForAI(body);
    if (!bodyText || bodyText.length < 100) return;

    // 缺失字段检测（空串/空数组视为缺失；ticket 124：标签开关关掉时不要求 tags）
    const missing: string[] = [];
    if (!fm || !fm.title) missing.push('title');
    if (!fm || !fm.summary) missing.push('summary');
    if (tagsEnabled !== false && (!fm || !Array.isArray(fm.tags) || fm.tags.length === 0)) missing.push('tags');
    if (missing.length === 0) return; // 字段齐全，无需处理

    console.log(`[自动摘要] 补全缺失字段(${missing.join('/')}): ${file.basename}`);
    // 开始调用 AI：动态通知（进行中 → 原地更新为结果；去重键按文件区分，连续剪藏各弹各）
    const startName = fm && fm.title ? fm.title : file.basename;
    const key = dedupeKeyFor(file);
    h = notify(`正在为《${startName}》生成摘要…`, { type: 'progress', dedupeKey: key });
    const aiResult = await aiProcess(ai, bodyText, missing, { summaryLength, tagsEnabled, tagCount });
    if (!aiResult) {
      // 失败：人话原因 + action「重试」（点按重跑当前文件；原技术错误详情在 console）
      const reason = await humanizeFailReason();
      if (h) {
        h.setMessage(reason);
        h.setType('error');
        const retryBtn = document.createElement('button');
        retryBtn.className = 'bz-notice-action';
        retryBtn.textContent = '重试';
        retryBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          retryBtn.remove();
          if (h) h.hide();
          void processFile(app, ai, file);
        });
        h.el.appendChild(retryBtn);
      }
      return;
    }

    // AI 标题 → 重命名笔记文件（rename 只改路径不改内容；失败/无需改回退原 file）
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
    // 仅将 AI 生成的目标字段合并进最新 frontmatter，防盲写覆盖并发追加（P1-21；rename 后对新路径生效）
    const latest = await app.vault.read(targetFile);
    const latestParsed = parseFrontmatter(latest);
    const mergedFm: Record<string, any> = { ...(latestParsed.fm || {}) };
    if (missing.includes('title') && aiResult.title) mergedFm.title = aiResult.title;
    if (missing.includes('summary') && aiResult.summary) mergedFm.summary = aiResult.summary;
    if (missing.includes('tags') && Array.isArray(aiResult.tags) && aiResult.tags.length) {
      mergedFm.tags = aiResult.tags;
    }

    const newContent = buildFrontmatter(mergedFm) + '\n\n' + latestParsed.body;
    await app.vault.modify(targetFile, newContent);
    if (renameFailed) {
      // B5：标题已在上面真实写入 frontmatter，此刻的「已写入」文案才站得住
      notify('自动改名失败，标题已写入笔记，请手动重命名', { type: 'warning' });
    }

    const msg = formatSummaryNotice(mergedFm);
    if (msg) {
      // 成功：同去重键原地合并 → 切换 success 图标并按显式时长驻留（≥8s，正文无 emoji）
      notify(msg, { type: 'success', dedupeKey: key, duration: 8000 });
    } else if (h) {
      h.hide();
    }
    console.log(`[自动摘要] ✅ 完成: ${targetFile.basename}`);
  } catch (e) {
    if (h) h.hide();
    console.error(`[自动摘要] 处理失败: ${file.basename}`, e);
  }
}
