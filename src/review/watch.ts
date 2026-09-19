/**
 * 复习计划监听器（ticket 098；ticket 099 修订）：
 *  - 监听文件夹自动加入（新建自动加入 + 排除名单）
 *  - 删除计划内文件 → 确认「是否同步移除复习记录？」
 *  - 重命名/移动计划内文件 → 自动更新路径（不再确认，ticket 099）
 *  - 监听文件夹添加：选择弹窗后立即确认存量收编（取消=什么都不做，不再写排除名单，ticket 099）
 * 依赖方向：store 层（confirm 为 core，无其它域 DOM）；经 index.ts 事件接线；refresh 函数体延迟解析。
 */
import { isUnderFolder as isUnderFolderCore, stripMdExt } from '../core/utils';
import type { App, TFile } from 'obsidian';
import { notice, notifySaveError, notifyUndo } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { tryGetSettings, saveSettings } from '../core/settings-provider';
import { ReviewDataManager } from './data';

/** 目录边界判定：path 恰为 folder 或位于其下（递归语义；core isUnderFolder 转发壳） */
export function isUnderFolder(folder: string, path: string): boolean {
  return isUnderFolderCore(folder, path);
}

/** ticket 100：自动加入提醒合并窗口（3 秒；测试可注入短值） */
export let REVIEW_AUTO_ADD_MERGE_MS = 3000;
export function __setAutoAddMergeMsForTests(ms: number): void {
  REVIEW_AUTO_ADD_MERGE_MS = ms;
}

/** ticket n2：改名通知合并窗口（3 秒；批量重命名只弹一条；测试可注入短值） */
export let RENAME_MERGE_MS = 3000;
export function __setRenameMergeMsForTests(ms: number): void {
  RENAME_MERGE_MS = ms;
}

export class ReviewWatcher {
  app: App;
  dataManager: ReviewDataManager;

  /** 删除确认防抖缓冲（多文件删除合并为一次确认） */
  private deleteQueue: string[] = [];
  private deleteTimer: ReturnType<typeof setTimeout> | null = null;
  /** ticket 100：新笔记自动加入提醒合并缓冲（3 秒窗口收集，多条合并一条通知） */
  private autoAddQueue: string[] = [];
  private autoAddTimer: ReturnType<typeof setTimeout> | null = null;
  /** ticket n2：改名通知合并缓冲（3 秒窗口收集；列表/文件树更新仍即时） */
  private renameQueue: string[] = [];
  private renameTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(app: App, dataManager: ReviewDataManager) {
    this.app = app;
    this.dataManager = dataManager;
  }

  get watchedFolders(): string[] {
    const s = tryGetSettings() as any;
    return Array.isArray(s?.reviewWatchedFolders)
      ? (s.reviewWatchedFolders as any[]).filter((x) => typeof x === 'string' && x.trim().length > 0)
      : [];
  }

  get excludedNotes(): string[] {
    const s = tryGetSettings() as any;
    return Array.isArray(s?.reviewExcludedNotes) ? (s.reviewExcludedNotes as string[]) : [];
  }

  isWatched(path: string): boolean {
    return this.watchedFolders.some((f) => isUnderFolder(f, path));
  }

  isExcluded(path: string): boolean {
    return this.excludedNotes.includes(path);
  }

  /** 追加排除名单（去重 + 落盘；手动/确认四类表态共用） */
  async excludePaths(paths: string[]): Promise<void> {
    const s = tryGetSettings() as any;
    const cur = Array.isArray(s?.reviewExcludedNotes) ? [...(s.reviewExcludedNotes as string[])] : [];
    let changed = false;
    for (const p of paths) {
      if (p && !cur.includes(p)) {
        cur.push(p);
        changed = true;
      }
    }
    if (!changed) return;
    if (s) s.reviewExcludedNotes = cur;
    await saveSettings();
  }

  /** ticket 57：单条解除排除记录（数据 reviewExcludedNotes 既有；仅补 UI 管理入口） */
  async removeExcludedNote(path: string): Promise<void> {
    const s = tryGetSettings() as any;
    if (!s) return;
    const cur = Array.isArray(s.reviewExcludedNotes) ? [...(s.reviewExcludedNotes as string[])] : [];
    const kept = cur.filter((p) => p !== path);
    if (kept.length === cur.length) return;
    s.reviewExcludedNotes = kept;
    await saveSettings();
  }

  /** vault create：监听目录内新建 md → 自动加入（未排除、未在计划）；ticket 100：3 秒窗口合并提醒 + 开关 */
  async onVaultCreate(file: TFile): Promise<void> {
    if (file.extension !== 'md') return;
    if (!this.isWatched(file.path)) return;
    if (this.isExcluded(file.path)) return;
    const items = await this.dataManager.loadItems();
    if (items.some((i) => i.filePath === file.path)) return;
    try {
      await this.dataManager.addItem(file.path, file.basename);
    } catch (e) {
      // F10：查重类错误（并发已加入）静默；写盘类失败给人话提示——自动加入不再静默失败
      if (e instanceof Error && e.message.includes('已在复习计划中')) return;
      notifySaveError(e, '自动加入复习计划');
      return;
    }
    // U8：面板开着时列表即时补卡（对齐 rename 路径的「列表即时、通知合并」）
    void this.refresh();
    // 提醒开关（默认开）：3 秒窗口内多条合并成一条通知
    const s = tryGetSettings() as any;
    if (s && s.reviewAutoAddNotice === false) return;
    this.autoAddQueue.push(file.basename);
    if (this.autoAddTimer) return;
    this.autoAddTimer = setTimeout(() => {
      this.autoAddTimer = null;
      const batch = this.autoAddQueue;
      this.autoAddQueue = [];
      if (!batch.length) return;
      const shown = batch.slice(0, 3).join('、');
      const tail = batch.length > 3 ? ` 等 ${batch.length - 3} 篇` : '';
      notice(batch.length > 1 ? `已自动加入复习计划：${shown}${tail}` : `已自动加入复习计划：${shown}`, 'success');
    }, REVIEW_AUTO_ADD_MERGE_MS);
  }

  /** vault delete：计划内文件删除 → 防抖合并确认「同步移除复习记录？」 */
  onVaultDelete(file: TFile): void {
    void (async () => {
      const items = await this.dataManager.loadItems();
      if (!items.some((i) => i.filePath === file.path)) return;
      this.deleteQueue.push(file.path);
      if (this.deleteTimer) return;
      this.deleteTimer = setTimeout(async () => {
        this.deleteTimer = null;
        const batch = this.deleteQueue;
        this.deleteQueue = [];
        if (!batch.length) return;
        const n = batch.length;
        // C10：口径与 confirmBatchAddForFolder 对齐——展示名剥 .md 扩展名
        const firstName = stripMdExt((batch[0] || '').split('/').pop() || '');
        void openFlowDialog({
          title: n > 1 ? `删除 ${n} 篇笔记` : '笔记已删除',
          message:
            n > 1
              ? `有 ${n} 篇笔记已从 vault 删除，是否同步移除复习计划里的记录？不移除则保留（文件恢复后继续复习，列表现删除线）。`
              : `「${firstName}」已从 vault 删除，是否同步移除复习计划里的记录？不移除则保留（文件恢复后继续复习，列表现删除线）。`,
          actions: [
            { label: '保留', value: 'cancel' },
            // danger（issue 291 评审补）：移除 = 同步删掉复习计划里的记录并写入排除名单
            //（删除类主动作，故主按钮不高亮；「保留」才是无损选项，手册 §9/§10）
            { label: '移除', value: 'ok', cta: true, danger: true },
          ],
        }).then(async (v) => {
          if (v === 'ok') {
            // C-UX2：先快照待移除条目（撤销原样插回），移除后挂撤销通知——
            // 连带清理类删除同样有反悔窗口（与全域删除形制对齐）
            const cur = await this.dataManager.loadItems();
            const removed = cur.filter((i) => batch.includes(i.filePath));
            // A13：单趟 RMW 批量移除（原逐篇 removeItem = N 次全文件读写）
            await this.dataManager.removeItems(batch);
            // 仅监听目录内的删除写排除名单（防自动加回；目录外的删除无监听风险）
            await this.excludePaths(batch.filter((p) => this.isWatched(p)));
            notifyUndo(`已移除 ${n} 条复习记录`, () => {
              void (async () => {
                try {
                  for (const item of removed) await this.dataManager.restoreItem(item);
                  await this.refresh();
                } catch (e) {
                  notifySaveError(e, '恢复复习记录');
                }
              })();
            });
            await this.refresh();
          } else {
            void this.refresh();
          }
        });
      }, 300);
    })();
  }

  /** vault rename：计划内文件改名/移动 → 自动更新路径（ticket 099：不再弹确认）；
   *   ticket n2：通知改合并窗口（窗口内多条合并一条；列表/文件树刷新仍即时） */
  onVaultRename(file: TFile, oldPath: string): void {
    void (async () => {
      if (file.extension !== 'md') return;
      if (oldPath === file.path) return;
      const items = await this.dataManager.loadItems();
      if (!items.some((i) => i.filePath === oldPath)) return;
      const updated = await this.dataManager.updateFilePath(oldPath, file.path, file.basename);
      if (!updated) {
        // F11：新路径已被另一条目占用 → 条目悬挂旧路径成删除线，给人话提示而非静默
        notice('新路径已存在复习条目，未能自动更新路径，请手动处理');
        return;
      }
      await this.refresh(); // 列表自动更新（即时）
      this.renameQueue.push(file.basename);
      if (this.renameTimer) return;
      this.renameTimer = setTimeout(() => {
        this.renameTimer = null;
        const batch = this.renameQueue;
        this.renameQueue = [];
        if (!batch.length) return;
        const shown = batch.slice(0, 3).join('、');
        const tail = batch.length > 3 ? `，等 ${batch.length - 3} 篇` : '';
        notice(
          batch.length > 1 ? `已更新 ${batch.length} 篇笔记的复习路径：${shown}${tail}` : '已更新复习计划路径',
          'success'
        );
      }, RENAME_MERGE_MS);
    })();
  }

  /** 未加入候选：目录内全部 md − 已加入 − 已排除（递归；挂起记录占位路径天然排除） */
  collectAutoaddCandidates(folder: string, items: Array<{ filePath: string }>): string[] {
    return this.app.vault
      .getMarkdownFiles()
      .map((f) => f.path)
      .filter((p) => isUnderFolder(folder, p))
      .filter((p) => !items.some((i) => i.filePath === p))
      .filter((p) => !this.isExcluded(p));
  }

  /** 选择监听文件夹后的存量收编确认（ticket 099）：确认 → 批量全部加入并返回 true；取消 → 什么都不做返回 false（不写排除名单） */
  async confirmBatchAddForFolder(folder: string): Promise<boolean> {
    const items = await this.dataManager.loadItems();
    const candidates = this.collectAutoaddCandidates(folder, items);
    if (!candidates.length) return true; // 无存量候选：直接接受
    const v = await openFlowDialog({
      title: '批量加入复习计划',
      message: `监听文件夹「${folder}」下有 ${candidates.length} 篇笔记未加入复习计划，是否一并加入？`,
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '加入', value: 'ok', cta: true },
      ],
    });
    if (v !== 'ok') return false;
    // A13：单趟 RMW 批量加入（原逐篇 addItem = N 次全文件读写）
    const res = await this.dataManager.addItems(
      candidates.map((p) => ({ filePath: p, fileName: stripMdExt(p.split('/').pop()!) }))
    );
    notice(`已加入 ${res.added} 篇笔记到复习计划`, 'success');
    await this.refresh();
    return true;
  }

  /** 移除监听文件夹（ticket 099 追加）：同时清空该目录下全部排除记录——否则二次添加时存量被旧黑名单挡住。
   *  返回清理的排除条数（仅用于提示文案）。 */
  async removeWatchedFolder(folder: string): Promise<number> {
    const s = tryGetSettings() as any;
    if (!s) return 0;
    const folders = Array.isArray(s.reviewWatchedFolders) ? [...(s.reviewWatchedFolders as string[])] : [];
    const idx = folders.indexOf(folder);
    if (idx !== -1) folders.splice(idx, 1);
    s.reviewWatchedFolders = folders;
    const before = Array.isArray(s.reviewExcludedNotes) ? [...(s.reviewExcludedNotes as string[])] : [];
    const kept = before.filter((p) => !isUnderFolder(folder, p));
    s.reviewExcludedNotes = kept;
    await saveSettings();
    return before.length - kept.length;
  }

  private async refresh(): Promise<void> {
    const { uiManager } = await import('./index');
    await uiManager?.refreshPanel();
    const { reviewApp } = await import('./app');
    await reviewApp.applyReviewStyles(this.app);
  }

  /** 卸载清理（定时器/缓冲） */
  destroy(): void {
    if (this.deleteTimer) {
      clearTimeout(this.deleteTimer);
      this.deleteTimer = null;
    }
    this.deleteQueue = [];
    if (this.autoAddTimer) {
      clearTimeout(this.autoAddTimer);
      this.autoAddTimer = null;
    }
    this.autoAddQueue = [];
    if (this.renameTimer) {
      clearTimeout(this.renameTimer);
      this.renameTimer = null;
    }
    this.renameQueue = [];
  }
}
