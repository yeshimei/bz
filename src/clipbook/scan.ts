/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：剪藏目录扫描 + 源模型。
 * 纯数据层（无 DOM），node 环境可测（依赖 metadataCache mock）。
 *
 * - 扫描剪藏目录 .md，按 frontmatter 契约（url+created 必需，缺任一跳过）解析为
 *   剪藏条目（迁移自 src/clipping/view.ts parseArticleFile 语义，ADR-0050 url 字段）；
 * - 目录变化增量路径由 UI 层订阅 clipping:file-* 域事件（path-classify 已按
 *   articleDirectory 归类），增量单文件解析沿用同一 parseClipFile。
 * - 「剪藏本」源模型：读全部剪藏（含目录空态/未配置态判定）。
 */

import { getApp } from '../core/app';

/** 剪藏解析条目（与阅读视图 ClipArticle.origin=clip 侧对齐的轻量结构） */
export interface ClipNote {
  path: string;
  file: any;
  url: string;
  author: string;
  site: string;
  summary: string;
  tags: string[];
  title: string;
  /** frontmatter created 解析时间（非法回退当前时间，P1-23） */
  created: number;
  /** 反链笔记 basename 清单（去《》书名号；UI 展示用） */
  backlinkNames: string[];
  /** 站点域名（favicon 用；无则空） */
  domain: string;
}

/** metadataCache 解析兜底：优先 getApp()（测试/真实一致），无则回退文件直挂 frontmatter */
function defaultCache(f: any): any {
  try {
    const app = getApp();
    if (app && typeof app.metadataCache?.getFileCache === 'function') {
      return app.metadataCache.getFileCache(f);
    }
  } catch (e) { /* 未注入 app（node 环境）忽略 */ }
  return f && f.frontmatter;
}

/**
 * 解析单个剪藏文件（metadataCache frontmatter；缺 url 或 created 跳过 → null）。
 * created 解析失败（如 "1750000000000" 数字值）→ Invalid Date 会让 toISOString 抛
 * RangeError 卡死列表渲染——回退当前时间（P1-23 语义保留）。
 */
export function parseClipFile(file: any, getCache?: (f: any) => any, getBacklinks?: (f: any) => any): ClipNote | null {
  const cache = (getCache || defaultCache)(file);
  const fm = cache && cache.frontmatter;
  if (!fm) return null;
  if (!fm.url || !fm.created) return null;

  const title = file.basename || String(file.name || '').replace(/\.md$/, '');
  let created = new Date(fm.created).valueOf();
  if (isNaN(created)) created = Date.now();

  let backlinkNames: string[] = [];
  try {
    const bl = (getBacklinks || (() => null))(file);
    if (bl && bl.data && typeof bl.data.size === 'number' && bl.data.size > 0) {
      backlinkNames = Array.from(bl.data.keys())
        .map((p: any) => String(p || '').split('/').pop() || '')
        .map((n: string) => n.replace(/^《|》$/g, '').replace(/\.md$/, ''));
    }
  } catch (e) { /* 反链解析失败忽略 */ }

  let domain = '';
  try {
    if (fm.url) domain = new URL(String(fm.url)).hostname;
  } catch (e) { /* 非法 URL 忽略 */ }

  return {
    path: file.path,
    file,
    url: String(fm.url),
    author: fm.author ? String(fm.author) : '',
    site: fm.site ? String(fm.site) : '未知',
    summary: fm.summary ? String(fm.summary) : '',
    tags: Array.isArray(fm.tags) ? (fm.tags as string[]).map(String) : fm.tags ? [String(fm.tags)] : [],
    title,
    created,
    backlinkNames,
    domain,
  };
}

/** 扫描剪藏目录全部 .md → 解析为剪藏条目（created 降序）；目录不存在/无子级 → null（区分空态） */
export async function scanClipDirectory(
  dirPath: string,
  deps: { vault: any; parse?: (f: any) => ClipNote | null }
): Promise<ClipNote[] | null> {
  const dir = deps.vault.getAbstractFileByPath(dirPath);
  if (!dir || !Array.isArray(dir.children)) return null;
  const mdFiles = (dir.children as any[]).filter((f: any) => f && f.extension === 'md');
  const parse = deps.parse || ((f: any) => parseClipFile(f));
  const notes: ClipNote[] = [];
  for (const f of mdFiles) {
    try {
      const n = parse(f);
      if (n) notes.push(n);
    } catch (e) { /* 单文件解析失败跳过 */ }
  }
  notes.sort((a, b) => b.created - a.created);
  return notes;
}
