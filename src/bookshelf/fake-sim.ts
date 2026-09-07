/**
 * 书架墙行为单源 · sim 启动入口（issue 245/ADR-0106，范式承 belongings 试点）
 *
 * 评审壳侧启动器：把真行为层（ui.ts 及其依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeVault 注入 core/app（data.ts 的 scanMarkdownBooks / reading-report 的
 *     getAllBookNotes 真实现原样跑在假 vault 上——md 解析/EPUB 聚合/排序筛选全真，
 *     只把「文件系统」换成 localStorage，见 fake/fake-obsidian.ts）；
 *   - 种子数据：window.BS.ITEMS（prototype-data.js，真实库 164 册同构快照，md 162 + EPUB 2），
 *     或评审壳父页同名全局——**逆向还原成 vault 原始形态**再入库（与 belongings 的 json 直灌不同，
 *     书库是 vault 域：md 书目 = 带标签 frontmatter 的笔记 + weava-data.json 聚合 + 封面图），
 *     让 parseBookFile/metadataCache 真解析路径原样跑通；每次启动无条件重灌（面板只读，无脏数据态）；
 *   - 设置注入：setSettingsProvider（真 settings-provider 实现可用，注入默认值；
 *     ?skin= 评审钩子可覆写 bookshelfSkin 直达五肤预览）。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_bookshelf，iframe 壳只调 boot + openBookshelf。
 * 插件的 ui.ts / data.ts / index.ts / reading-report 一律零改动——行为代码单源。
 */
import { FakeApp } from './fake/fake-obsidian';
import { setApp, getApp } from '../core/app';
import { setSettingsProvider } from '../core/settings-provider';
import { esc } from '../core/ui/str';
import { ensureBookshelf, openBookshelf as openBookshelfDomain } from './index';
import { catColor } from './render';
import { openReportView } from './ui';

/** 种子条目（prototype-data.js 的 BookshelfItem 同构快照 + 生成器补的 ctime） */
interface BsSeedItem {
  id: string;
  title: string;
  author: string;
  category: string | null;
  cover: string | null;
  bookReview: string | null;
  readingDate: string | null;
  completionDate: string | null;
  progress: number;
  readingTimeFormat: string | null;
  readingTimeMs: number;
  highlights: number;
  thinks: number;
  wordCount: number;
  pages: number;
  status: string;
  isEpub: boolean;
  epubVaultPath: string | null;
  ctime: number;
}

declare global {
  interface Window {
    BS?: { ITEMS?: BsSeedItem[] };
  }
}

/** 种子源：自身 window 优先（同文档场景）；iframe 场景读父页（评审壳持有 BS） */
function seedItems(): BsSeedItem[] {
  const src = window.BS || (window.parent && (window.parent as Window).BS) || null;
  return src?.ITEMS || [];
}

/** ISO 日期 → 本地正午时间戳（adapter stats 的 toDateString 逆变换；正午避时区边界） */
function dateToTs(date: string | null): number {
  if (!date || date.length < 10) return 0;
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  if (!y || !m || !d) return 0;
  return new Date(y, m - 1, d, 12).getTime();
}

/** md 书目笔记合成（frontmatter 与 data.ts parseBookFile 的读取键一一对应） */
function mdContent(it: BsSeedItem): string {
  const lines = [
    '---',
    'tags:',
    '  - book',
    `author: ${it.author}`,
    `category: ${it.category || '未分类'}`,
  ];
  if (it.cover) lines.push(`cover: ${it.cover}`);
  if (it.bookReview) lines.push(`bookReview: ${it.bookReview}`);
  if (it.readingDate) lines.push(`readingDate: ${it.readingDate}`);
  if (it.completionDate) lines.push(`completionDate: ${it.completionDate}`);
  lines.push(`readingProgress: ${it.progress}`);
  if (it.readingTimeMs > 0) lines.push(`readingTime: ${it.readingTimeMs}`);
  if (it.readingTimeFormat) lines.push(`readingTimeFormat: ${it.readingTimeFormat}`);
  lines.push(
    `highlights: ${it.highlights}`,
    `thinks: ${it.thinks}`,
    `wordCount: ${it.wordCount}`,
    `pages: ${it.pages}`,
    '---',
    '',
    `${it.title}`,
    '',
  );
  return lines.join('\n');
}

/** 借书卡封面（分类色 SVG data URI，承旧壳 demoCoverUri 口径；存为「图片文件」内容） */
function coverDataUri(it: BsSeedItem): string {
  const c = catColor(it.category || '未分类');
  const t = String(it.title || '');
  const mid = Math.ceil(t.length / 2);
  const lines = t.length <= 7 ? [t] : [t.slice(0, mid), t.slice(mid)];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="210"><rect width="150" height="210" fill="${c.bg}"/><rect x="9" y="9" width="132" height="192" fill="none" stroke="${c.fg}" stroke-opacity=".4"/>` +
    lines.map((ln, i) => `<text x="75" y="${104 + (i - (lines.length - 1) / 2) * 26}" text-anchor="middle" font-family="Songti SC,SimSun,serif" font-size="17" fill="${c.fg}">${esc(ln)}</text>`).join('') +
    `<text x="75" y="186" text-anchor="middle" font-family="Songti SC,SimSun,serif" font-size="10" fill="${c.fg}" fill-opacity=".75">${esc(it.author || '')}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** EPUB 条目逆向 → weave-data.json 聚合（buildEpubItem 的读取面；ADR-0013 口径） */
function epubAggregate(it: BsSeedItem): Record<string, unknown> {
  return {
    meta: {
      title: it.title,
      author: it.author,
      subjects: it.category ? [it.category] : [],
      coverPath: it.cover || '',
    },
    file: { vaultPath: it.epubVaultPath || it.id },
    reading: {
      position: { percent: (it.progress || 0) / 100 },
      stats: {
        lastReadTime: dateToTs(it.readingDate),
        completedTime: dateToTs(it.completionDate),
        totalReadTime: it.readingTimeMs || 0,
      },
      sessions: [],
    },
    notes: { highlights: [], excerpts: [] },
  };
}

/** 种子：把原型演示数据逆向成 vault 原始形态写进 fake vault（md 笔记 / weave-data.json / 封面图）。
 *  面板只读（issue 223），无「用户改过数据」态——每次启动无条件重灌，评审壳重复自检天然干净。 */
function seedDatabase(app: FakeApp): void {
  const vault = app.vault;
  const books: Record<string, unknown> = {};
  for (const it of seedItems()) {
    if (it.isEpub) {
      books[it.epubVaultPath || it.id] = epubAggregate(it);
      continue;
    }
    // md 书目笔记（id 即 vault 路径；ctime 供 primaryDate 的 file.stat 口径）
    vault.putFile(it.id, mdContent(it), it.ctime);
    // 封面图（coverUrl 要求 getAbstractFileByPath 命中图片扩展名；内容 = data URI）
    if (it.cover) vault.putFile(it.cover, coverDataUri(it));
  }
  if (Object.keys(books).length) {
    vault.putFile('CONFIG/STORAGE/weave-data.json', JSON.stringify({ books }));
  }
}

/** 默认设置（settings-provider 真实现注入；键与插件 data.json 同形；?skin= 评审直达） */
function injectSettings(): void {
  const skin = new URLSearchParams(location.search).get('skin') || 'nordic';
  setSettingsProvider(
    () =>
      ({
        bookshelfFolderPath: '书库',
        bookTag: 'book',
        bookshelfSkin: skin,
        bookshelfDefaultSide: 'all',
        bookshelfSortMode: 'recent',
        bookshelfMobileDefaultFullscreen: false,
      }) as never
  );
}

/** 壳入口：一次性启动（种子 + 注入 + ESC/自动刷新接线；幂等） */
export function bootBookshelfSim(): void {
  const g = window as unknown as { __bzBsSimBooted?: boolean };
  if (g.__bzBsSimBooted) return;
  g.__bzBsSimBooted = true;
  const app = new FakeApp();
  seedDatabase(app);
  // core/app 的 setApp 形参是 obsidian App 类型；评审壳 FakeApp 只实现依赖链读取面，
  // 运行期 data.ts 以 (app as any) 访问 plugins 等——类型断言收敛此处差异。
  setApp(app as never);
  injectSettings();
  // index.ts 真接线：ESC 层 + vault modify 自动刷新 + M.appRef（ensure 幂等）
  ensureBookshelf(getApp());
}

/** 打开书架墙（index.ts openBookshelf 真实现：toggle 语义 + applyDefaultView + createOverlay） */
export function openBookshelf(): void {
  openBookshelfDomain(getApp());
}

/** 打开报告视图（ui.ts openReportView；原型无命令系统，深链命令 bz-reading-report-open 的函数面） */
export function openReport(): void {
  openReportView(getApp());
}
