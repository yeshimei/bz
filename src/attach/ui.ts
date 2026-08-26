/**
 * 附件搬移域——UI 层（文件夹选择弹窗 + 执行编排）。
 * 自绘 DOM 弹窗（铁律 3/9：bz- 前缀类名，样式收敛在根 styles.css）；不依赖 obsidian Modal。
 * 移动与全库链接更新走 Obsidian 内建 `app.fileManager.renameFile`（ADR-0014，自动更新内部链接，
 * 避免 v1 自研全库扫描 + 逐个 modify 导致的大库卡顿）。
 */
import { notice } from '../core/notice';
import { getSettings, saveSettings } from '../core/settings-provider';
import { escManager } from '../core/esc-manager';
import { confirm } from '../core/confirm';
import { collectResources, planMoves } from './data';

/** 当前打开笔记；无则 null */
function getActiveNote(app: any): any | null {
  return app?.workspace?.getActiveFile?.() ?? null;
}

/** 文件夹选择弹窗可配项（ticket 099 追加：跨域复用参数面；缺省 = 附件搬移原行为） */
export interface FolderSelectOptions {
  /** 弹窗标题（默认「选择目标文件夹」） */
  title?: string;
  /** 确定按钮文案（默认「移动」） */
  okText?: string;
  /** 输入框 placeholder（默认「如：归档/附件（库内路径）」） */
  placeholder?: string;
  /** 初始输入值；提供时不读取 attachLastFolder 记忆（避免跨域串味） */
  initial?: string;
}

/** 文件夹选择弹窗（自绘 DOM；onPick 回调选中的库内文件夹路径；z-index 200000 压一切弹窗） */
export class FolderSelectModal {
  private app: any;
  private onPick: (folder: string) => void;
  private opts: FolderSelectOptions;
  private mask: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private listEl: HTMLElement | null = null;
  private folders: string[] = [];

  constructor(app: any, onPick: (folder: string) => void, opts: FolderSelectOptions = {}) {
    this.app = app;
    this.onPick = onPick;
    this.opts = opts;
  }

  open(): void {
    const old = document.getElementById('bz-attach-folder-mask');
    if (old) old.remove();
    const settings: any = getSettings?.();
    const last = this.opts.initial !== undefined ? this.opts.initial : (settings && settings.attachLastFolder) || '';

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
    title.textContent = this.opts.title || '选择目标文件夹';
    popup.appendChild(title);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'bz-attach-input';
    input.placeholder = this.opts.placeholder || '如：归档/附件（库内路径）';
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
    ok.textContent = this.opts.okText || '移动';
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
  /** 是否走了 fileManager（自动更新内部链接） */
  linksAuto: boolean;
}

/**
 * 执行附件搬移：移动当前笔记附件到目标文件夹（仅同名冲突才改名）。
 * 经 `app.fileManager.renameFile` 移动并自动更新全库内部链接（Obsidian 内建）；
 * 无 fileManager（异常环境）回退 `vault.rename`（不更新链接，warning 通知）。
 * dest 允许空串 = 库根目录（与文件夹选择器「（库根目录）」选项一致，P20 修复自相矛盾——
 * 可选却提交被拒；根目录场景 dest 为空时直接移动到 vault 根）。
 */
export async function runMove(app: any, note: any, destFolder: string): Promise<MoveSummary | null> {
  const dest = (destFolder || '').trim().replace(/^\/+|\/+$/g, '');
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

    // 仅非根目录需要建目录；根目录（''）必然存在
    if (dest && !app.vault.getAbstractFileByPath(dest)) await app.vault.createFolder(dest);
    const fmRename = app?.fileManager?.renameFile;
    let failed = 0;
    for (const m of moves) {
      const f = app.vault.getAbstractFileByPath(m.fromPath);
      if (!f) {
        failed++;
        continue;
      }
      try {
        if (fmRename) await fmRename.call(app.fileManager, f, m.toPath);
        else await app.vault.rename(f, m.toPath);
      } catch (e) {
        failed++;
        console.warn('[附件搬移] 移动失败:', m.fromPath, e);
      }
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

    const linksAuto = !!fmRename;
    const renamedCount = moves.filter((m) => m.renamed).length;
    // 成功数口径（P2）：moved = 计划数 − 失败数，通知文案与实际一致
    const movedCount = moves.length - failed;
    const failTail = failed ? `，失败 ${failed} 个` : '';
    const linkTail = linksAuto ? '，内部链接已自动更新' : '，链接未自动更新';
    const destLabel = dest || '库根目录';
    notice(`已移动 ${movedCount} 个资源到 ${destLabel}，改名 ${renamedCount} 个${linkTail}${failTail}`, linksAuto && failed === 0 ? 'success' : 'warning');
    return { moved: movedCount, renamed: renamedCount, linksAuto };
  } catch (e) {
    console.error('[附件搬移] 失败:', e);
    notice('附件搬移失败，已中止（原文件未改动）', 'error');
    return null;
  }
}

/** 命令入口：当前笔记 → 文件夹选择 → 预览确认（将移动 N 个、改名 M 个）→ 执行 */
export async function moveAttachments(app: any): Promise<void> {
  const note = getActiveNote(app);
  if (!note) {
    notice('没有打开的笔记', 'warning');
    return;
  }
  new FolderSelectModal(app, (folder) => {
    void (async () => {
      const dest = (folder || '').trim().replace(/^\/+|\/+$/g, '');
      try {
        const allFiles = (app.vault.getFiles?.() || app.vault.getAllLoadedFiles?.() || []).map((f: any) => f.path);
        const noteContent = await app.vault.read(note);
        const resources = collectResources(noteContent, allFiles, note.path);
        if (resources.length === 0) {
          notice('当前笔记没有可移动的资源文件', 'info');
          return;
        }
        const moves = planMoves(resources, dest, allFiles);
        if (moves.length === 0) {
          notice('资源已全部在目标文件夹', 'info');
          return;
        }
        // P20：执行前展示预览确认（移动/改名数）；根目录文案用「库根目录」展示
        const destLabel = dest || '库根目录';
        const renamedCount = moves.filter((m) => m.renamed).length;
        const renameTail = renamedCount ? `，${renamedCount} 个将改名（目标已有同名文件）` : '';
        confirm({
          title: '移动附件',
          message: `将移动 ${moves.length} 个资源到「${destLabel}」${renameTail}。\n\n移动后全库引用这些附件的链接会自动更新。`,
          confirmText: '移动',
          onConfirm: () => {
            void runMove(app, note, dest);
          },
        });
      } catch (e) {
        console.error('[附件搬移] 预览失败:', e);
        notice('附件搬移失败，已中止（原文件未改动）', 'error');
      }
    })();
  }).open();
}