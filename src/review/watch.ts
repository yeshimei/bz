/**
 * 复习计划监听器（ticket 098）：
 *  - 监听文件夹自动加入（批量收编确认 + 新建自动加入 + 排除名单）
 *  - 删除计划内文件 → 确认「是否同步移除复习记录？」
 *  - 重命名/移动计划内文件 → 确认「是否更新文件名/路径？」（不更新 → 新路径写排除名单）
 * 依赖方向：store 层（confirm 为 core，无其它域 DOM）；经 index.ts 事件接线；refresh 函数体延迟解析。
 */
import type { App, TFile } from 'obsidian';
import { notice } from '../core/notice';
import { confirm } from '../core/confirm';
import { tryGetSettings, saveSettings } from '../core/settings-provider';
import { ReviewDataManager } from './data';

/** 目录边界判定：path 恰为 folder 或位于其下（递归语义） */
export function isUnderFolder(folder: string, path: string): boolean {
  const f = (folder || '').trim().replace(/\/+$/, '');
  if (!f) return false;
  return path === f || path.startsWith(f + '/');
}

export class ReviewWatcher {
  app: App;
  dataManager: ReviewDataManager;

  /** 已做过批量收编提示的目录（内存幂等，防每次开面板重弹） */
  private batchPrompted = new Set<string>();
  /** 删除确认防抖缓冲（多文件删除合并为一次确认） */
  private deleteQueue: string[] = [];
  private deleteTimer: ReturnType<typeof setTimeout> | null = null;

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

  /** vault create：监听目录内新建 md → 自动加入（未排除、未在计划） */
  async onVaultCreate(file: TFile): Promise<void> {
    if (file.extension !== 'md') return;
    if (!this.isWatched(file.path)) return;
    if (this.isExcluded(file.path)) return;
    const items = await this.dataManager.loadItems();
    if (items.some((i) => i.filePath === file.path)) return;
    await this.dataManager.addItem(file.path, file.basename);
    notice(`已自动加入复习计划：${file.basename}`, 'success');
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
        const firstName = (batch[0] || '').split('/').pop();
        confirm({
          title: n > 1 ? `删除 ${n} 篇笔记` : '笔记已删除',
          message:
            n > 1
              ? `有 ${n} 篇笔记已从 vault 删除，是否同步移除复习计划里的记录？不移除则保留（文件恢复后继续复习，列表现删除线）。`
              : `「${firstName}」已从 vault 删除，是否同步移除复习计划里的记录？不移除则保留（文件恢复后继续复习，列表现删除线）。`,
          confirmText: '移除',
          cancelText: '保留',
          onConfirm: async () => {
            for (const path of batch) await this.dataManager.removeItem(path);
            // 仅监听目录内的删除写排除名单（防自动加回；目录外的删除无监听风险）
            await this.excludePaths(batch.filter((p) => this.isWatched(p)));
            notice(`已移除 ${n} 条复习记录`, 'success');
            await this.refresh();
          },
          onCancel: () => {
            void this.refresh();
          },
        });
      }, 300);
    })();
  }

  /** vault rename：计划内文件改名/移动 → 确认「更新文件名/路径？」；不更新 → 新路径写排除名单 */
  onVaultRename(file: TFile, oldPath: string): void {
    void (async () => {
      if (file.extension !== 'md') return;
      if (oldPath === file.path) return;
      const items = await this.dataManager.loadItems();
      if (!items.some((i) => i.filePath === oldPath)) return;
      confirm({
        title: '笔记已重命名/移动',
        message: `「${oldPath.split('/').pop()}」→「${file.path.split('/').pop()}」，是否更新复习计划里的文件名/路径？不更新则记录挂起（列表现删除线），文件回到原路径后恢复。`,
        confirmText: '更新',
        cancelText: '不更新',
        onConfirm: async () => {
          const updated = await this.dataManager.updateFilePath(oldPath, file.path, file.basename);
          if (updated) {
            notice('已更新复习计划路径', 'success');
            await this.refresh();
          }
        },
        onCancel: async () => {
          // 不更新 → 新路径排除（防监听器把它当新文件又建一条记录）
          if (this.isWatched(file.path)) await this.excludePaths([file.path]);
          await this.refresh();
        },
      });
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

  /** 目录存量批量收编确认：确认 → 批量加入；取消 → 这批文件写排除名单（Q7） */
  async promptBatchAddForFolder(folder: string): Promise<void> {
    const items = await this.dataManager.loadItems();
    const candidates = this.collectAutoaddCandidates(folder, items);
    if (!candidates.length) return;
    this.batchPrompted.add(folder);
    confirm({
      title: '批量加入复习计划',
      message: `监听文件夹「${folder}」下有 ${candidates.length} 篇笔记未加入复习计划，是否加入？（取消后这些笔记不再自动加入）`,
      confirmText: '加入',
      cancelText: '取消',
      onConfirm: async () => {
        let ok = 0;
        for (const p of candidates) {
          try {
            await this.dataManager.addItem(p, p.split('/').pop()!.replace(/\.md$/, ''));
            ok++;
          } catch {
            /* 并发已加入 → 跳过 */
          }
        }
        notice(`已加入 ${ok} 篇笔记到复习计划`, 'success');
        await this.refresh();
      },
      onCancel: async () => {
        await this.excludePaths(candidates);
        notice(`已跳过 ${candidates.length} 篇，不再自动加入`, 'info');
      },
    });
  }

  /** 打开复习面板时：对未提示过的监听目录做存量收编确认（幂等） */
  async promptBatchAddAll(): Promise<void> {
    for (const folder of this.watchedFolders) {
      if (this.batchPrompted.has(folder)) continue;
      await this.promptBatchAddForFolder(folder);
    }
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
    this.batchPrompted.clear();
  }
}