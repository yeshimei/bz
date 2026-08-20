/**
 * 附件搬移域——UI 层（文件夹选择弹窗 + 执行编排）。
 * 自绘 DOM 弹窗（铁律 3/9：bz- 前缀类名，样式收敛在根 styles.css）；不依赖 obsidian Modal。
 */
import { notice } from '../core/notice';
import { getSettings, saveSettings } from '../core/settings-provider';
import { escManager } from '../core/esc-manager';
import { collectResources, planMoves, planRewritePairs, applyReplacements } from './data';

/** 当前打开笔记；无则 null */
export function getActiveNote(app: any): any | null {
  return app?.workspace?.getActiveFile?.() ?? null;
}

/** 文件夹选择弹窗（自绘 DOM；onPick 回调选中的库内文件夹路径） */
export class FolderSelectModal {
  private app: any;
  private onPick: (folder: string) => void;
  private mask: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private listEl: HTMLElement | null = null;
  private folders: string[] = [];

  constructor(app: any, onPick: (folder: string) => void) {
    this.app = app;
    this.onPick = onPick;
  }

  open(): void {
    const old = document.getElementById('bz-attach-folder-mask');
    if (old) old.remove();
    const settings: any = getSettings?.();
    const last = (settings && settings.attachLastFolder) || '';

    const mask = document.createElement('div');
    mask.id = 'bz-attach-folder-mask';
    mask.className = 'bz-attach-mask';
    mask.onclick = (e) => {
      if (e.target === mask) this.close();
    };

    const popup = document.createElement('div');
    popup.className = 'bz-attach-popup';

    const title = document.createElement('div');
    title.className = 'bz-attach-title';
    title.textContent = '选择目标文件夹';
    popup.appendChild(title);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'bz-attach-input';
    input.placeholder = '如：归档/附件（库内路径）';
    input.value = last;
    input.addEventListener('input', () => this.filter());
    this.input = input;
    popup.appendChild(input);

    const list = document.createElement('div');
    list.className = 'bz-attach-folder-list';
    this.listEl = list;
    popup.appendChild(list);

    const actions = document.createElement('div');
    actions.className = 'bz-attach-actions';
    const cancel = document.createElement('button');
    cancel.className = 'bz-attach-btn bz-attach-btn--ghost';
    cancel.textContent = '取消';
    cancel.onclick = () => this.close();
    const ok = document.createElement('button');
    ok.className = 'bz-attach-btn bz-attach-btn--primary';
    ok.textContent = '移动';
    ok.onclick = () => this.submit();
    actions.appendChild(cancel);
    actions.appendChild(ok);
    popup.appendChild(actions);

    mask.appendChild(popup);
    document.body.appendChild(mask);
    this.mask = mask;
    escManager.register('bz-attach-folder', {
      isVisible: () => !!this.mask && this.mask.isConnected,
      close: () => this.close(),
    });
    input.focus();
    input.select();

    this.refreshFolders();
    this.filter();
  }

  refreshFolders(): void {
    const set = new Set<string>();
    const files =
      this.app?.vault?.getFiles?.() ?? this.app?.vault?.getMarkdownFiles?.() ?? [];
    for (const f of files) {
      const idx = f.path.lastIndexOf('/');
      if (idx !== -1) set.add(f.path.slice(0, idx));
    }
    set.add('');
    this.folders = [...set].sort();
  }

  filter(): void {
    if (!this.listEl) return;
    const q = (this.input?.value || '').trim().toLowerCase();
    // 输入恰好等于某个目录 → 视为“已选中”，显示完整列表（预填上次文件夹时不把列表滤掉）
    const exact = !!q && this.folders.some((f) => f === q);
    this.listEl.textContent = '';
    for (const folder of this.folders) {
      if (q && !exact && !folder.toLowerCase().includes(q)) continue;
      const item = document.createElement('div');
      item.className = 'bz-attach-folder-item';
      item.textContent = folder === '' ? '（库根目录）' : folder;
      item.addEventListener('click', () => {
        if (this.input) this.input.value = folder;
        this.filter();
      });
      this.listEl.appendChild(item);
    }
  }

  submit(): void {
    const folder = (this.input?.value || '').trim().replace(/^\/+|\/+$/g, '');
    this.close();
    this.onPick(folder);
  }

  close(): void {
    if (this.mask) {
      this.mask.remove();
      this.mask = null;
    }
  }
}

export interface MoveSummary {
  moved: number;
  renamed: number;
  links: number;
  notes: number;
}

/**
 * 执行附件搬移：移动附件到目标文件夹（仅同名冲突才改名）+ 全库改写链接。
 * 返回汇总统计（供通知/测试断言）。
 */
export async function runMove(app: any, note: any, destFolder: string): Promise<MoveSummary | null> {
  const dest = (destFolder || '').trim().replace(/^\/+|\/+$/g, '');
  if (!dest) {
    notice('未选择目标文件夹', 'warning');
    return null;
  }
  try {
    const allFiles = (app.vault.getFiles?.() || app.vault.getAllLoadedFiles?.() || []).map((f: any) => f.path);
    const noteContent = await app.vault.read(note);
    const resources = collectResources(noteContent, allFiles, note.path);
    if (resources.length === 0) {
      notice('当前笔记没有可移动的资源文件', 'info');
      return null;
    }
    const moves = planMoves(resources, dest, allFiles);
    if (moves.length === 0) {
      notice('资源已全部在目标文件夹', 'info');
      return null;
    }
    const mdFiles = app.vault.getMarkdownFiles?.() ?? [];
    const mdMap: Record<string, string> = {};
    for (const mf of mdFiles) mdMap[mf.path] = await app.vault.read(mf);
    const plan = planRewritePairs(mdMap, allFiles, moves);

    // 执行：建目录 → 移动 → 改写链接
    if (!app.vault.getAbstractFileByPath(dest)) await app.vault.createFolder(dest);
    for (const m of moves) {
      const f = app.vault.getAbstractFileByPath(m.fromPath);
      if (f) await app.vault.rename(f, m.toPath);
    }
    const byFile = new Map<string, { raw: string; newRaw: string }[]>();
    for (const p of plan.pairs) {
      const arr = byFile.get(p.filePath) || [];
      arr.push({ raw: p.raw, newRaw: p.newRaw });
      byFile.set(p.filePath, arr);
    }
    for (const [path, list] of byFile) {
      const f = app.vault.getAbstractFileByPath(path);
      if (!f) continue;
      let content = await app.vault.read(f);
      content = applyReplacements(content, list);
      await app.vault.modify(f, content);
    }

    // 记忆上次文件夹（运行时字段，不暴露设置）
    const settings: any = getSettings?.();
    if (settings) {
      settings.attachLastFolder = dest;
      try {
        await saveSettings?.();
      } catch (e) {
        /* 失败静默 */
      }
    }

    const renamedCount = moves.filter((m) => m.renamed).length;
    notice(`已移动 ${moves.length} 个资源到 ${dest}，改名 ${renamedCount} 个，改写 ${plan.linkCount} 处链接`, 'success');
    return { moved: moves.length, renamed: renamedCount, links: plan.linkCount, notes: plan.touchedFiles.length };
  } catch (e) {
    console.error('[附件搬移] 失败:', e);
    notice('附件搬移失败，已中止（原文件未改动）', 'error');
    return null;
  }
}

/** 命令入口：当前笔记 → 文件夹选择 → 执行 */
export async function moveAttachments(app: any): Promise<void> {
  const note = getActiveNote(app);
  if (!note) {
    notice('没有打开的笔记', 'warning');
    return;
  }
  new FolderSelectModal(app, (folder) => {
    void runMove(app, note, folder);
  }).open();
}