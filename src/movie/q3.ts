/**
 * 影视 Q3 海报整理（ticket 14 修正版：对齐源码 initQ3 逐字）
 */
import type { App, TFile } from 'obsidian';
import { Notice } from 'obsidian';

let q3Initialized = false;

/** 测试/重建用：允许重新注册 */
export function resetQ3(): void {
  q3Initialized = false;
}

/** 注册 Q3 海报整理（enableQ3 时调用，源码 L63-153 逐字） */
export function initQ3(app: App, folderPath: string, posterFolder: string): void {
  if (q3Initialized) return;
  const CONFIG_FOLDER = posterFolder;
  const PROCESSING_FILES = new Set<string>();

  async function ensureFolder(): Promise<void> {
    const folder = app.vault.getAbstractFileByPath(CONFIG_FOLDER);
    if (!folder) await app.vault.createFolder(CONFIG_FOLDER);
  }

  async function updateNoteLink(file: TFile, oldImagePath: string, newImagePath: string): Promise<void> {
    let content = await app.vault.read(file);
    const oldLink = `![[${oldImagePath}]]`;
    const newLink = `![[${newImagePath}]]`;
    if (content.includes(oldLink)) {
      content = content.replace(oldLink, newLink);
      await app.vault.modify(file, content);
    }
  }

  async function setPosterProperty(file: TFile, posterPath: string): Promise<void> {
    await app.fileManager.processFrontMatter(file, (fm: Record<string, any>) => {
      if (fm['海报'] !== posterPath) fm['海报'] = posterPath;
    });
  }

  async function processNote(noteFile: TFile): Promise<void> {
    if (!noteFile || PROCESSING_FILES.has(noteFile.path)) return;
    const filePath = noteFile.path;
    if (!filePath.startsWith(folderPath + '/')) return;

    const cache = app.metadataCache.getFileCache(noteFile);
    if (!cache) return;

    const content = await app.vault.read(noteFile);
    const imageMatch = content.match(/!\[\[([^\]]+)\]\]/);
    if (!imageMatch) return;

    let imagePath = imageMatch[1].trim();
    const imageFile = app.metadataCache.getFirstLinkpathDest(imagePath, noteFile.path);
    if (!imageFile) return;

    const ext = (imageFile.extension || '').toLowerCase();
    const validExt = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];
    if (!validExt.includes(ext)) return;

    if (imageFile.parent && imageFile.parent.path === CONFIG_FOLDER) {
      await setPosterProperty(noteFile, imageFile.path);
      return;
    }

    PROCESSING_FILES.add(noteFile.path);
    await ensureFolder();

    let newPath = `${CONFIG_FOLDER}/${imageFile.name}`;
    let finalImagePath: string;
    if (await app.vault.adapter.exists(newPath)) {
      const timestamp = Date.now();
      const base = imageFile.basename;
      const newName = `${base}_${timestamp}.${ext}`;
      newPath = `${CONFIG_FOLDER}/${newName}`;
      await app.fileManager.renameFile(imageFile, newPath);
      finalImagePath = newPath;
    } else {
      await app.fileManager.renameFile(imageFile, newPath);
      finalImagePath = newPath;
    }

    await updateNoteLink(noteFile, imagePath, finalImagePath);
    await setPosterProperty(noteFile, finalImagePath);
    PROCESSING_FILES.delete(noteFile.path);
    new Notice(`${noteFile.basename} 的电影海报已更新！`);
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const onModify = (file: TFile) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => processNote(file), 300);
  };

  const onOpen = (leaf: any) => {
    if (leaf?.view?.file) processNote(leaf.view.file);
  };

  (app.vault as any).on('modify', onModify);
  (app.workspace as any).on('file-open', onOpen);

  const activeFile = app.workspace.getActiveFile();
  if (activeFile) processNote(activeFile as TFile);
  q3Initialized = true;
}
