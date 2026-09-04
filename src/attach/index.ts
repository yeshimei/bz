/**
 * 附件搬移域入口（ticket 65）。
 * 命令 bz-attach-move 由 main.ts 裸注册；此处提供回调 + 主页磁贴自动播种。
 */
import { getApp } from '../core/app';
import { generateId } from '../core/utils';
import { loadLauncherData, saveLauncherData, placeAtEnd } from '../launcher/data';
import { moveAttachments } from './ui';

export { moveAttachments } from './ui';
export * from './data';

export const ATTACH_COMMAND_ID = 'bz-attach-move';

/** 打开附件搬移（main.ts 命令回调 / 右键菜单回调）；note 可选：右键指定笔记时透传 */
export function openAttachMove(app?: any, note?: any): void {
  moveAttachments(app || getApp(), note);
}

/**
 * 文件右键菜单入口（main.ts onload 调用，plugin.registerEvent 保证卸载自动清理）：
 * file-menu 事件里 md 笔记挂「搬移此笔记附件」，与命令入口同一条执行链路
 * （openAttachMove → moveAttachments，右键的笔记优先于当前活动笔记）。
 */
export function ensureAttachFileMenu(plugin: any): void {
  try {
    plugin.registerEvent(
      plugin.app.workspace.on('file-menu', (menu: any, file: any) => {
        // 仅 md 笔记挂菜单（附件搬移语义是「笔记引用的附件」；文件夹/其他文件不挂）
        if (!file || file.isFolder || !file.path || file.extension !== 'md') return;
        menu.addItem((item: any) => {
          item
            .setTitle('搬移此笔记附件')
            .setIcon('folder-down')
            .onClick(() => openAttachMove(plugin.app, file));
        });
      })
    );
  } catch (e) {
    /* 注册失败静默（不影响命令入口） */
  }
}

/**
 * 主页磁贴自动播种（desktop + mobile）：缺 bz-attach-move 磁贴时 placeAtEnd 追加到末尾，
 * 保存 launcher.json（幂等，失败静默）。
 */
export async function ensureAttachSeed(app: any): Promise<void> {
  try {
    const data = await loadLauncherData(app);
    let changed = false;
    for (const key of ['desktop', 'mobile'] as const) {
      const cfg = data[key];
      const cols = cfg && typeof cfg.columns === 'number' ? cfg.columns : key === 'desktop' ? 6 : 4;
      const tiles = cfg ? cfg.tiles : [];
      if (tiles.some((t) => t.commandId === ATTACH_COMMAND_ID)) continue;
      const tile = { id: generateId('lt-'), commandId: ATTACH_COMMAND_ID, x: 0, y: 0, w: 1, h: 1 };
      data[key] = { tiles: placeAtEnd(tiles, tile, cols), columns: cols };
      changed = true;
    }
    if (changed) await saveLauncherData(app, data);
  } catch (e) {
    /* 播种失败静默（不影响主功能） */
  }
}