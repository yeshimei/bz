/**
 * 自动摘要 processor（ticket 22）：缺失字段 AI 补全 + 文件处理 + 通知。
 * 源码：自动摘要.js L63-121（逐字移植；ticket 22 改为缺什么补什么）
 */
import { parseFrontmatter, buildFrontmatter, extractBodyForAI } from './parser';
import { notify } from '../core/notice';
import type { NoticeHandle } from '../core/notice';
import type { AIService } from '../core/ai';

/** 缺失字段 → JSON 模板定义（规则文案逐字保留；不含 author） */
const FIELD_DEFS: Record<string, string> = {
  title:
    '"title": "生成中文标题，15-30字，完整陈述句或疑问句。禁止冒号、破折号、句中句号问号，需要连接时用逗号"',
  summary:
    '"summary": "150-250字的详细摘要。包含核心观点、关键事实、重要数据和结论。直接陈述内容，绝对禁止使用\'本文\'、\'本文章\'、\'这篇文章\'、\'文章指出\'、\'作者认为\'等前缀词"',
  tags: '"tags": ["标签1", "标签2", "标签3"]',
};

const TAGS_RULE = `tags 规则：
- 3-6 个中文标签，每个不超过 5 个字
- 涵盖：主题领域、关键技术/概念、应用场景`;

/** AI 生成缺失字段（提示词按 missing 裁剪；失败静默返回 null） */
export async function aiProcess(
  ai: AIService,
  bodyText: string,
  missing: string[]
): Promise<Record<string, any> | null> {
  const fieldLines = missing.filter((f) => FIELD_DEFS[f]).map((f) => '  ' + FIELD_DEFS[f]);
  if (fieldLines.length === 0) return null;

  const prompt = `你是一个资讯文章分析助手。以下是一篇已转换为 Markdown 的文章正文。请分析内容，返回一个 JSON 对象（只返回 JSON，不要其他文字）：

{
${fieldLines.join(',\n')}
}

${missing.includes('tags') ? TAGS_RULE + '\n\n' : ''}文章正文：
${bodyText.substring(0, 6000)}`;

  try {
    const result = await ai.prompt(prompt, 'deepseek-v4-flash', {
      modelOptions: { max_tokens: 1024, temperature: 0.3 },
    });
    const jsonMatch = (result || '').match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.warn('[自动摘要] AI 处理失败:', e);
  }
  return null;
}

/** AI 标题 → 重命名笔记文件（清理非法字符/截断/防重名；失败返回原 file） */
async function renameToTitle(app: any, file: any, title: string): Promise<any> {
  const clean = String(title)
    .replace(/[\\/:*?"<>|\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  if (!clean || clean === file.basename) return file;
  const dir = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '/';
  let newPath = `${dir}/${clean}.md`;
  let n = 1;
  while (app.vault.getAbstractFileByPath(newPath)) {
    newPath = `${dir}/${clean} (${n++}).md`;
  }
  try {
    await app.vault.rename(file, newPath);
    return app.vault.getAbstractFileByPath(newPath) || file;
  } catch (e) {
    console.warn('[自动摘要] 重命名失败，仅写 frontmatter title:', e);
    return file;
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

/** 处理单个文件：缺什么补什么（title/summary/tags），字段齐全跳过；成功通知 */
export async function processFile(app: any, ai: AIService, file: any): Promise<void> {
  let h: NoticeHandle | null = null;
  try {
    const content = await app.vault.read(file);
    const { fm, body } = parseFrontmatter(content);

    const bodyText = extractBodyForAI(body);
    if (!bodyText || bodyText.length < 100) return;

    // 缺失字段检测（空串/空数组视为缺失）
    const missing: string[] = [];
    if (!fm || !fm.title) missing.push('title');
    if (!fm || !fm.summary) missing.push('summary');
    if (!fm || !Array.isArray(fm.tags) || fm.tags.length === 0) missing.push('tags');
    if (missing.length === 0) return; // 字段齐全，无需处理

    console.log(`[自动摘要] 补全缺失字段(${missing.join('/')}): ${file.basename}`);
    // 开始调用 AI：动态通知（进行中 → 原地更新为结果）
    const startName = fm && fm.title ? fm.title : file.basename;
    h = notify(`正在为《${startName}》生成摘要…`, { type: 'progress' });
    const aiResult = await aiProcess(ai, bodyText, missing);
    if (!aiResult) {
      if (h) {
        h.setType('error');
        h.setMessage('❌ 摘要生成失败，请重试');
        window.setTimeout(() => h && h.hide(), 2500);
      }
      return;
    }

    // 写回：只写缺失字段（不覆盖已有）
    let targetFile = file;
    const newFm = fm || {};
    if (missing.includes('title') && aiResult.title) {
      newFm.title = aiResult.title;
      targetFile = await renameToTitle(app, file, aiResult.title);
    }
    if (missing.includes('summary') && aiResult.summary) newFm.summary = aiResult.summary;
    if (missing.includes('tags') && Array.isArray(aiResult.tags) && aiResult.tags.length) {
      newFm.tags = aiResult.tags;
    }

    const newContent = buildFrontmatter(newFm) + '\n\n' + body;
    await app.vault.modify(targetFile, newContent);

    const msg = formatSummaryNotice(newFm);
    if (msg && h) {
      h.setMessage(msg);
      h.setType('success');
    } else if (h) {
      h.hide();
    }
    console.log(`[自动摘要] ✅ 完成: ${targetFile.basename}`);
  } catch (e) {
    if (h) h.hide();
    console.error(`[自动摘要] 处理失败: ${file.basename}`, e);
  }
}
