/**
 * 数据体检·检查三：孤儿条目（D4 检查 c）。
 *
 * 域条目里指向库内文件的引用，指向的文件已不存在 = 孤儿：
 * - 影院：影视条目的「海报」附件缺失（frontmatter 海报路径指向的文件不存在）；
 * - 书架墙：md 书目封面缺失 / EPUB 条目指向的 EPUB 文件缺失（weave 阅读数据残留）；
 * - 剪藏本：clipbook.json 侧写 savedArchive 残留指向的剪藏笔记已不存在（可修复）；
 *   划词标注 marks / 待回写来源 pendingSource 指向的笔记已不存在（issue 339 扩展，可修复）；
 * - 收藏本：条目「关联笔记」指向的笔记不存在（可修复 = 清空关联字段，条目本体保留）；
 * - 知识盒：knowledge.json 任务的文献笔记 notePath / 视频文件 videoPath 指向缺失
 *   （issue 339 扩展，可修复 = 清字段，任务本体保留）。
 *
 * 修复边界（只读纪律）：影院海报/书架封面在用户笔记 frontmatter 里、EPUB 清单是
 * weave 插件的数据文件——一律只报告不动；可修复的只有插件自有 json
 * （favorites/clipbook/knowledge）。修复口径跟随 run.ts 的 fixOrphanIssues 现有模式。
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
          detail: `笔记：${(b.file as any)?.path || '(未知)'}\n封面路径：${cover}\n书库会显示占位封面；请补回文件或清空笔记的 cover 字段。`,
        });
      }
      await opts.tick?.(`书库 · ${b.title}`);
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
      await opts.tick?.(`书库 · ${b.title}`);
    }
  }

  // 3) 剪藏本：侧写指向缺失（可修复）——savedArchive 残留 / 划词标注 marks / 待回写来源 pendingSource
  {
    const sidecarFile = jsonScanTargets(app).find((t) => t.file.endsWith('/clipbook.json'))?.file || 'CONFIG/STORAGE/clipbook.json';
    const parsed = await readRawJson(app, sidecarFile);
    const data = parsed && parsed.ok && parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data) ? (parsed.data as any) : null;
    if (data) {
      const savedArchive = data.savedArchive;
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

      // 3b) 划词标注（issue 339 / ADR-0144）：标注 notePath 指向的笔记不存在 → 保存物化时该条被跳过
      const marks = data.marks && typeof data.marks === 'object' && !Array.isArray(data.marks) ? data.marks : {};
      for (const [articleKey, list] of Object.entries(marks)) {
        if (!Array.isArray(list)) continue;
        for (const mk of list) {
          if (opts.isCancelled?.()) return null;
          if (!mk || typeof mk !== 'object') continue;
          scanned += 1;
          const notePath = String((mk as any).notePath || '').trim();
          if (notePath && !fileExists(app, notePath)) {
            const find = String((mk as any).find || '');
            issues.push({
              severity: 'warn',
              title: `剪藏标注指向的笔记不存在（${notePath.split('/').pop() || notePath}）`,
              detail: `侧写文件：${sidecarFile}\n条目：${articleKey}\n标注原文：${find}\n笔记路径：${notePath}\n这条标注的目标笔记已删除，保存物化时会被跳过，可清除该标注记录。`,
              fixGroup: 'clipbook-marks',
              fixKey: JSON.stringify([articleKey, find, notePath]),
              fixLabel: '清除标注',
            });
          }
          await opts.tick?.('剪藏本 · 划词标注');
        }
      }

      // 3c) 待回写来源（issue 339 / ADR-0144）：pendingSource 里的笔记路径已不存在 → 物化回写被跳过
      const pendingSource =
        data.pendingSource && typeof data.pendingSource === 'object' && !Array.isArray(data.pendingSource)
          ? data.pendingSource
          : {};
      for (const [articleKey, list] of Object.entries(pendingSource)) {
        if (!Array.isArray(list)) continue;
        for (const p of list) {
          if (opts.isCancelled?.()) return null;
          scanned += 1;
          const notePath = String(p || '').trim();
          if (notePath && !fileExists(app, notePath)) {
            issues.push({
              severity: 'warn',
              title: `剪藏待回写来源指向的笔记不存在（${notePath.split('/').pop() || notePath}）`,
              detail: `侧写文件：${sidecarFile}\n条目：${articleKey}\n笔记路径：${notePath}\n保存物化时这条来源回写会因目标缺失被跳过，可清除该待回写记录。`,
              fixGroup: 'clipbook-source',
              fixKey: JSON.stringify([articleKey, notePath]),
              fixLabel: '清除待回写来源',
            });
          }
          await opts.tick?.('剪藏本 · 待回写来源');
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

  // 5) 知识盒：任务的文献笔记 / 视频文件指向缺失（issue 339 扩展；可修复 = 清字段，任务本体保留）
  {
    const kbFile = jsonScanTargets(app).find((t) => t.file.endsWith('/knowledge.json'))?.file || 'CONFIG/STORAGE/knowledge.json';
    const parsed = await readRawJson(app, kbFile);
    if (parsed && parsed.ok && Array.isArray(parsed.data)) {
      for (const it of parsed.data) {
        if (opts.isCancelled?.()) return null;
        if (!it || typeof it !== 'object') continue;
        scanned += 1;
        const id = String((it as any).id || '');
        const note = String((it as any).notePath || '').trim();
        const video = String((it as any).videoPath || '').trim();
        const title = String((it as any).title || (it as any).url || '(无标题)');
        if (note && !fileExists(app, note)) {
          issues.push({
            severity: 'warn',
            title: `知识盒任务「${title}」的文献笔记不存在`,
            detail: `数据文件：${kbFile}\n笔记路径：${note}\n任务卡「打开文献笔记」会失败；可清除该引用（任务本体保留）。`,
            fixGroup: 'knowledge',
            fixKey: id ? `${id}|note` : '',
            fixLabel: '清除笔记引用',
          });
        }
        if (video && !fileExists(app, video)) {
          issues.push({
            severity: 'warn',
            title: `知识盒任务「${title}」的视频文件不存在`,
            detail: `数据文件：${kbFile}\n视频路径：${video}\n任务卡「复制视频路径」指向的文件已缺失；可清除该路径（任务本体保留）。`,
            fixGroup: 'knowledge',
            fixKey: id ? `${id}|video` : '',
            fixLabel: '清除视频路径',
          });
        }
        await opts.tick?.('知识盒 · 任务引用');
      }
    }
  }

  const summary = issues.length ? `扫描 ${scanned} 个条目，发现 ${issues.length} 处指向缺失` : `扫描 ${scanned} 个条目，未发现指向缺失`;
  const section: CheckSection = { id: 'orphan', name: '孤儿条目', summary, issues, scanned };
  return section;
}
