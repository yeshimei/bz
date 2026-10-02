/**
 * 写作内页的媒体入库（ADR-0233）：把从本机挑的照片 / 录音 / 视频写进 vault，正文里留一条 `![[名字]]`。
 *
 * 为什么单列一个模块：本域只有这一处**写二进制**，把它收在一个文件里，
 * 「哪些盘上写入是允许的」在 D3 直写守门里就只放行这一个文件（`tests/core/d3-write-gate.test.ts`
 * 的白名单按文件粒度）。ui.ts 那边只管挑文件、插引用、报结果。
 *
 * 落点规矩：**优先交宿主**——`fileManager.getAvailablePathForAttachment` 按用户设的「附件默认位置」
 * 给一个不重名的路径（本机 vault = `CONFIG/APPENDIX`，与用户在 Obsidian 里拖图入笔记的落点一致）；
 * 旧宿主 / 评审壳没有这条 API 时退到日记目录下的 `附件/`，自己避重名（`_2` 后缀，永不覆盖）。
 */
import type { App } from 'obsidian';
import { DIARY_DIRECTORY } from './config';

/** 认的媒体类型：与 `render.ts` 的 `MIME_BY_EXT`、`data.ts` 的媒体扩展名同族——
 *  选了别的类型插进正文也只是一行死链 */
export const PICK_MEDIA_ACCEPT = 'image/*,video/*,audio/*';

/** 单件媒体的体积上限（MB）：正文是纯文本、媒体是外链文件，这里只挡「一次读进内存会卡住」的大件
 *  （与 encrypt.ts 的 64MB 附件上限同源） */
export const MEDIA_PICK_MAX_MB = 64;

/** 退回的附件目录（宿主没有 getAvailablePathForAttachment 时用） */
const FALLBACK_MEDIA_DIR = `${DIARY_DIRECTORY}/附件`;

/** 宿主侧「附件默认位置」的窄接口（旧宿主 / 评审壳可能没有，故按可选能力探测） */
type AttachmentPathHost = {
  fileManager?: { getAvailablePathForAttachment?: (name: string, sourcePath?: string) => Promise<string> };
};

/** 挑一件媒体 → 落进 vault，返回最终**文件名**（正文 `![[名字]]` 用它）。失败抛出，由调用方报人话。 */
export async function writePickedMedia(app: App, file: File): Promise<string> {
  const path = await mediaPathFor(app, file.name);
  await app.vault.createBinary(path, await file.arrayBuffer());
  return path.split('/').pop() || file.name;
}

/** 落点路径：优先宿主给的「附件默认位置」；没有这条 API 时退 `我的/日记/附件/` 并自己避重名 */
export async function mediaPathFor(app: App, name: string): Promise<string> {
  const host = app as unknown as AttachmentPathHost;
  const getPath = host.fileManager?.getAvailablePathForAttachment;
  if (typeof getPath === 'function') {
    return await getPath.call(host.fileManager, name, `${DIARY_DIRECTORY}/`);
  }
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  try {
    if (!(await app.vault.adapter.exists(FALLBACK_MEDIA_DIR))) {
      await app.vault.createFolder(FALLBACK_MEDIA_DIR);
    }
  } catch {
    /* 目录已存在 / 无权限：交给 createBinary 自己报错 */
  }
  let path = `${FALLBACK_MEDIA_DIR}/${name}`;
  for (let i = 2; app.vault.getAbstractFileByPath(path); i++) {
    path = `${FALLBACK_MEDIA_DIR}/${base}_${i}${ext}`;
  }
  return path;
}
