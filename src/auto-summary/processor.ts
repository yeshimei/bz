/**
 * 自动摘要 processor（ticket 10）：AI 摘要生成 + 文件处理，源码逐字移植。
 * 源码：自动摘要.js L63-121
 */
import { parseFrontmatter, buildFrontmatter, extractBodyForAI } from './parser';
import type { AIService } from '../core/ai';

/** AI 生成摘要（提示词逐字保留；失败静默返回 null） */
export async function aiProcess(ai: AIService, bodyText: string): Promise<Record<string, any> | null> {
  const prompt = `你是一个资讯文章分析助手。以下是一篇已转换为 Markdown 的文章正文。请分析内容，返回一个 JSON 对象（只返回 JSON，不要其他文字）：

{
  "title": "生成中文标题，15-30字，完整陈述句或疑问句。禁止冒号、破折号、句中句号问号，需要连接时用逗号",
  "author": "文章作者。如果原文没有明确的作者署名，填 null",
  "summary": "150-250字的详细摘要。包含核心观点、关键事实、重要数据和结论。直接陈述内容，绝对禁止使用'本文'、'本文章'、'这篇文章'、'文章指出'、'作者认为'等前缀词",
  "tags": ["标签1", "标签2", "标签3"]
}

tags 规则：
- 3-6 个中文标签，每个不超过 5 个字
- 涵盖：主题领域、关键技术/概念、应用场景

文章正文：
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

/** 处理单个文件：已有 summary 跳过、正文 <100 跳过、写回 frontmatter */
export async function processFile(app: any, ai: AIService, file: any): Promise<void> {
  try {
    const content = await app.vault.read(file);
    const { fm, body } = parseFrontmatter(content);

    // 已有 summary 则跳过
    if (fm && fm.summary) return;

    const bodyText = extractBodyForAI(body);
    if (!bodyText || bodyText.length < 100) return;

    console.log(`[自动摘要] 处理: ${file.basename}`);
    const aiResult = await aiProcess(ai, bodyText);
    if (!aiResult) return;

    // 更新 frontmatter
    const newFm = fm || {};
    if (aiResult.title) newFm.title = aiResult.title;
    if (aiResult.author) newFm.author = aiResult.author;
    if (aiResult.summary) newFm.summary = aiResult.summary;
    if (aiResult.tags) newFm.tags = aiResult.tags;

    const newContent = buildFrontmatter(newFm) + '\n\n' + body;
    await app.vault.modify(file, newContent);
    console.log(`[自动摘要] ✅ 完成: ${file.basename}`);
  } catch (e) {
    console.error(`[自动摘要] 处理失败: ${file.basename}`, e);
  }
}
