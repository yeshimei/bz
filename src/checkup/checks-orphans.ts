/**
 * 数据体检·检查三：孤儿条目（D4 检查 c）。
 *
 * 域条目里指向库内文件的引用，指向的文件已不存在 = 孤儿：
 * - 影院：影视条目的「海报」附件缺失（frontmatter 海报路径指向的文件不存在）；
 * - 书架墙：md 书目封面缺失 / EPUB 条目指向的 EPUB 文件缺失（weave 阅读数据残留）；
 * - 剪藏本：clipbook.json 侧写 savedArchive 残留指向的剪藏笔记已不存在（可修复）；
 * - 收藏本：条目「关联笔记」指向的笔记不存在（可修复 = 清空关联字段，条目本体保留）。
 *
 * 修复边界（只读纪律）：影院海报/书架封面在用户笔记 frontmatter 里、EPUB 清单是
 * weave 插件的数据文件——一律只报告不动；可修复的只有插件自有 json（favorites/clipbook）。
 */
import type { App } from 'obsidian';
import type { CheckIssue, CheckOpts, CheckResult, CheckSection } from './types';
import { fileExists, readRawJson, jsonScanTargets } from './files';
import { tryGetSettings } from '../core/settings-provider';
import { parseMovieFile } from '../cinema/data';
import { scanMarkdownBooks, loadEpubItems } from '../bookshelf/data';

/** 默认剪藏目录（clipbook 域 clipDir 同默认：articleDirectory 设置可改） */
function clipDirOf(): string {
  const s = tryGetSettings() as any;
  return ((s && s.articleDirectory) || '归档/网页剪藏').replace(/\/+$/, '');
}

/** 剪藏目录内全部笔记的 frontmatter url 集合（url 命中判定与 clipbook/store 同款） */
async function clipUrlSet(app: App): Promise<Set<string>> {
  const dir = clipDirOf();
  const set = new Set<string>();
  const files = app.vault.getMarkdownFiles().filter((f: any) => f.path.startsWith(dir + '/'));
  for (const f of files) {
    const cache = app.metadataCache.getFileCache(f as any);
    const url = cache?.frontmatter?.url;
    if (typeof url === 'string' && url) set.add(url);
  }
  return set;
}

/** 检查三：孤儿条目（只读；逐域让出主线程） */
export async function checkOrphans(app: App, opts: CheckOpts = {}): Promise<CheckResult> {
  const issues: CheckIssue[] = [];
  let scanned = 0;

  // 1) 影院：影视条目海报缺失（frontmatter「海报」路径指向的文件不存在）
  {
    const s = tryGetSettings() as any;
    const folder = (s && s.cinemaFolderPath) || '我的/影视';
    const files = app.vault.getMarkdownFiles().filter((f: any) => f.path.startsWith(folder + '/'));
    for (const f of files) {
      if (opts.isCancelled?.()) return null;
      const item = parseMovieFile(f as any, app);
      if (!item) continue;
      scanned += 1;
      const poster = (item.poster || '').trim();
      if (poster && !fileExists(app, poster)) {
        issues.push({
          severity: 'warn',
          title: `影视《${item.name}》的海报文件不存在`,
          detail: `笔记：${f.path}\n海报路径：${poster}\n详情页会显示占位图；请补回文件或清空笔记的「海报」字段。`,
        });
      }
      await opts.tick?.(`影院 · ${item.name}`);
    }
  }

  // 2) 书架墙：md 书封面缺失 / EPUB 文件缺失
  {
    const mdBooks = scanMarkdownBooks(app);
    for (const b of mdBooks) {
      if (opts.isCancelled?.()) return null;
      scanned += 1;
      const cover = (b.cover || '').trim();
      if (cover && !fileExists(app, cover)) {
        issues.push({
          severity: 'warn',
          title: `书目《${b.title}》的封面文件不存在`,
          detail: `笔记：${(b.file as any)?.path || '(未知)'}\n封面路径：${cover}\n书架墙会显示占位封面；请补回文件或清空笔记的 cover 字段。`,
        });
      }
      await opts.tick?.(`书架墙 · ${b.title}`);
    }
    const epubs = await loadEpubItems(app);
    for (const b of epubs) {
      if (opts.isCancelled?.()) return null;
      scanned += 1;
      const p = (b.epubVaultPath || '').trim();
      if (p && !fileExists(app, p)) {
        issues.push({
          severity: 'warn',
          title: `EPUB 书目《${b.title}》指向的文件不存在`,
          detail: `EPUB 路径：${p}\n该条目来自 weave 阅读数据（weave-data.json，外部插件数据，体检不改动）；请重新导入或清理 Weave 插件数据。`,
        });
      }
      await opts.tick?.(`书架墙 · ${b.title}`);
    }
  }

  // 3) 剪藏本：侧写 savedArchive 残留指向的剪藏笔记不存在（可修复）
  {
    const sidecarFile = jsonScanTargets(app).find((t) => t.file.endsWith('/clipbook.json'))?.file || 'CONFIG/STORAGE/clipbook.json';
    const parsed = await readRawJson(app, sidecarFile);
    if (parsed && parsed.ok && parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
      const savedArchive = (parsed.data as any).savedArchive;
      if (Array.isArray(savedArchive)) {
        const urls = await clipUrlSet(app);
        for (const entry of savedArchive) {
          if (opts.isCancelled?.()) return null;
          scanned += 1;
          const url = entry && typeof entry === 'object' ? String((entry as any).url || '') : '';
          if (url && !urls.has(url)) {
            issues.push({
              severity: 'warn',
              title: `剪藏残留《${String((entry as any).title || url)}》对应的剪藏笔记不存在`,
              detail: `侧写文件：${sidecarFile}\n链接：${url}\n剪藏目录（${clipDirOf()}）里已没有该链接的笔记，这条「已保存」残留失去意义，可清除。`,
              fixGroup: 'clipbook',
              fixKey: url,
              fixLabel: '清除残留',
            });
          }
          await opts.tick?.('剪藏本 · 已保存残留');
        }
      }
    }
  }

  // 4) 收藏本：关联笔记不存在（可修复 = 清空关联字段，条目本体保留）
  {
    const favFile = jsonScanTargets(app).find((t) => t.file.endsWith('/favorites.json'))?.file || 'CONFIG/STORAGE/favorites.json';
    const parsed = await readRawJson(app, favFile);
    if (parsed && parsed.ok && Array.isArray(parsed.data)) {
      for (const it of parsed.data) {
        if (opts.isCancelled?.()) return null;
        if (!it || typeof it !== 'object') continue;
        scanned += 1;
        const note = String((it as any).linkedNote || '').trim();
        if (note && !fileExists(app, note)) {
          issues.push({
            severity: 'warn',
            title: `收藏「${String((it as any).title || (it as any).url || '(无标题)')}」的关联笔记不存在`,
            detail: `数据文件：${favFile}\n关联路径：${note}\n「跳转笔记」会提示文件不存在；可清除该关联（收藏条目本体保留）。`,
            fixGroup: 'favorites',
            fixKey: String((it as any).id || ''),
            fixLabel: '清除关联',
          });
        }
        await opts.tick?.('收藏本 · 关联笔记');
      }
    }
  }

  const summary = issues.length ? `扫描 ${scanned} 个条目，发现 ${issues.length} 处指向缺失` : `扫描 ${scanned} 个条目，未发现指向缺失`;
  const section: CheckSection = { id: 'orphan', name: '孤儿条目', summary, issues, scanned };
  return section;
}
