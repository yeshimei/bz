/**
 * clipbook 门面的真实接线（剪藏成书）。
 *
 * facade.ts 只放形状与纯逻辑；这里把「读盘 → 归一 → 已读/保存动作」接上 bz 自己的
 * 数据层与写入队列。main.ts 只 new 一次挂到插件实例上，卸载时置空。
 *
 * 三条边界：
 * - 只读剪藏本的盘上现值，不借面板的 M 内存面（阅读器可能在任何时候调用）；
 * - 已读走 flowMarkAllRead（bz 的串行队列 + 统计 + 行为流口径）；
 * - 保存走 flowSave（写剪藏笔记 + 标已处理 + 事件 + 自动摘要登记）。
 */
import { getApp } from '../core/app';
import { needsFolderSetup } from '../core/folder-setup';
import { readNewsData, emptyData, getNewsFilePath, writeNewsDataMerged } from './news-data';
import { readClipbookData, clipbookFilePath, updateClipbookData, type ClipbookData } from './data';
import { scanClipDirectory } from './scan';
import { clipDir, clipFilePathOf } from './save';
import { flowMarkAllRead, flowSave, trimReadLog } from './flow';
import { summarizeClipBody } from './summarize';
import { accrueRead, readSecondsView } from './readtime';
import { buildExportIndex, createClipbookFacade, fnv, type ClipbookFacade } from './facade';
import { openClipbook } from './index';

/** 文件指纹：mtime + size；读不到给 0（文件还没建也是变化） */
async function statSig(path: string): Promise<string> {
  try {
    const st = await getApp().vault.adapter.stat(path);
    return st ? `${st.mtime}:${st.size}` : 'none';
  } catch {
    return 'err';
  }
}

export function createClipbookFacadeHost(): ClipbookFacade {
  return createClipbookFacade({
    async readIndex() {
      const app = getApp();
      const res = await readNewsData();
      const data = res.ok ? res.data : emptyData();
      const sidecar = await readClipbookData();
      const dir = clipDir();
      const clips = dir ? await scanClipDirectory(dir, { vault: app.vault }) : null;
      return buildExportIndex({
        articles: data.articles || [],
        clips,
        rssFeeds: data.rssFeeds || [],
        upIds: data.bilibiliUps || [],
        upInfo: data.bilibiliUpInfo || {},
        sources: data.sources || emptyData().sources,
        /* 秒数视图要把旧 readLog 折进来：readSeconds 是这次才有的段，之前面板里
           读的时长只在流水里。折算只发生在读取时，不写盘（写回会重复入账）。 */
        readSeconds: readSecondsView(sidecar.readSeconds, sidecar.readLog),
      });
    },

    async readNote(path) {
      return String(await getApp().vault.adapter.read(path));
    },

    async markRead(raws) {
      const out = await flowMarkAllRead(raws);
      return out.bumped;
    },

    async save(raw) {
      const ok = await flowSave({ raw });
      return ok ? { ok: true, notePath: clipFilePathOf(raw?.title) } : { ok: false };
    },

    /* 摘要写 news.json 的 `aiSummary`，**不碰 `summary`**：后者是 RSS 抓来的
       description，剪藏本自己的列表在用，混在一起会互相顶掉。
       写盘走合并写队列（后台抓取是另一个写者，盲覆盖会丢它刚追加的文章）。 */
    async summarize(raw) {
      const summary = await summarizeClipBody(String(raw?.body || ''));
      if (!summary) return { ok: false, code: 'aiFailed' as const };
      const written = await writeNewsDataMerged({ set: { articles: [{ ...raw, aiSummary: summary }] } });
      return written ? { ok: true, summary } : { ok: false, code: 'writeFailed' as const };
    },

    /* 阅读时长回写：秒数累进 readSeconds，凑满的整分钟补进 readLog。
       走 updateClipbookData 的读改写事务（与面板自己的会话封存同一条队列），
       阅读器和面板同时写也不会互相覆盖。 */
    async recordRead(batch) {
      let written = 0;
      try {
        await updateClipbookData((cur) => {
          const out = accrueRead({
            readSeconds: cur.readSeconds,
            readLoggedSeconds: cur.readLoggedSeconds,
            batch,
            ts: Date.now(),
          });
          written = batch.length;
          const next: ClipbookData = {
            ...cur,
            readSeconds: out.readSeconds,
            readLoggedSeconds: out.readLoggedSeconds,
          };
          if (out.log.length) {
            const now = Date.now();
            next.readLog = trimReadLog([...(cur.readLog || []), ...out.log], now);
          }
          return next;
        });
      } catch {
        /* 写盘失败不能让阅读器那边当成功：返回 0，下一拍会把新秒数带上来 */
        return 0;
      }
      return written;
    },

    isFolderReady() {
      return !needsFolderSetup('clipbook');
    },

    async dataVersion() {
      const app = getApp();
      const dir = clipDir();
      const files = dir
        ? app.vault.getFiles().filter((f) => f.path.startsWith(`${dir}/`) && f.extension === 'md')
        : [];
      const newest = files.reduce((max, f) => Math.max(max, Number(f.stat?.mtime) || 0), 0);
      const sig = [
        `news:${await statSig(getNewsFilePath())}`,
        `side:${await statSig(clipbookFilePath())}`,
        `clips:${files.length}:${newest}`,
      ].join('|');
      return fnv(sig);
    },

    /* 与命令 bz-clipbook-open 同一个入口：首次会顺带装载面板，已装载则直接 show */
    open() {
      openClipbook(getApp());
    },
  });
}
