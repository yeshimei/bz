/**
 * 附件搬移域——UI 层（统一路径选择器 + 执行编排）。
 * 自绘 DOM 弹窗（铁律 3/9：bz- 前缀类名，样式收敛在根 styles.css）；不依赖 obsidian Modal。
 * ticket 128（ADR-0061）：原 FolderSelectModal（运行时单选弹窗 + 手输输入框）退役，目标文件夹
 * 经 core 统一路径选择器（core/path-picker，卡片弹窗 + 搜索选择）录入；保留 attachLastFolder
 * 记忆语义（选择器初始高亮上次文件夹）与「（库根目录）」空串语义（dest '' = 移动到 vault 根）。
 * 移动与全库链接更新走 Obsidian 内建 `app.fileManager.renameFile`（ADR-0014，自动更新内部链接，
 * 避免 v1 自研全库扫描 + 逐个 modify 导致的大库卡顿）。
 */
import { notice } from '../core/notice';
import { getSettings, saveSettings } from '../core/settings-provider';
import { confirm } from '../core/confirm';
import { openPathPicker } from '../core/path-picker';
import { collectResources, planMoves } from './data';

/** 当前打开笔记；无则 null */
function getActiveNote(app: any): any | null {
  return app?.workspace?.getActiveFile?.() ?? null;
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

/** 命令入口：当前笔记 → 统一路径选择器选目标文件夹（记忆上次 attachLastFolder → 初始高亮）→ 预览确认 → 执行 */
export function moveAttachments(app: any): void {
  const note = getActiveNote(app);
  if (!note) {
    notice('没有打开的笔记', 'warning');
    return;
  }
  // 记忆上次文件夹（attachLastFolder 运行时字段）：选择器初始高亮，便于快速重复搬移
  const settings: any = getSettings?.();
  const last = ((settings && settings.attachLastFolder) || '').trim().replace(/^\/+|\/+$/g, '');
  openPathPicker({
    title: '选择目标文件夹',
    mode: 'single',
    okText: '移动',
    desc: '把当前笔记引用的附件移动到所选文件夹（同名冲突自动改名，全库引用链接自动更新）',
    selected: last ? [last] : [],
    onConfirm: (list) => {
      const dest = (list[0] || '').trim().replace(/^\/+|\/+$/g, '');
      void (async () => {
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
    },
  });
}